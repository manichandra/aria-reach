const summaryEl = document.getElementById('summary');
const resultsEl = document.getElementById('results');
const highlightBtn = document.getElementById('highlight');
const scanBtn = document.getElementById('scan');

let currentTabId = null;
let overlayOn = false;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function inPage(func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func,
    args,
  });
  return result;
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  summaryEl.textContent = 'Scanning…';
  resultsEl.innerHTML = '';
  overlayOn = false;
  highlightBtn.style.display = 'none';
  highlightBtn.textContent = 'Highlight all on page';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') throw new Error('No active tab is available.');
    currentTabId = tab.id;
    const scannerLoaded = await inPage(
      () =>
        Boolean(
          window.ariaReach &&
          typeof window.ariaReach.summary === 'function' &&
          typeof window.ariaReach.highlight === 'function' &&
          typeof window.ariaReach.clearHighlights === 'function',
        ),
    );
    if (scannerLoaded) {
      await inPage(() => window.ariaReach.clearHighlights());
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['aria-reach.browser.js'],
      });
    }
    const summary = await inPage(() => window.ariaReach.summary());
    render(summary);
    highlightBtn.style.display = 'inline-block';
  } catch (err) {
    summaryEl.textContent =
      'Could not scan this page (browser-internal pages and the extension store are not scannable). ' +
      String(err && err.message ? err.message : err);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan this page';
  }
});

highlightBtn.addEventListener('click', async () => {
  if (!currentTabId) return;
  overlayOn = !overlayOn;
  if (overlayOn) {
    await inPage(() => window.ariaReach.highlight());
    highlightBtn.textContent = 'Remove highlights';
  } else {
    await inPage(() => window.ariaReach.clearHighlights());
    highlightBtn.textContent = 'Highlight all on page';
  }
});

function render(summary) {
  const sev = summary.bySeverity;
  summaryEl.innerHTML =
    `${summary.total} finding(s) — ` +
    `<span class="sev-error">${sev.error ?? 0} error</span>, ` +
    `<span class="sev-warning">${sev.warning ?? 0} warning</span>, ` +
    `<span class="sev-info">${sev.info ?? 0} info</span>` +
    `<div class="muted hint">Hover a finding to preview it · click to pin it and close this panel · hover a Class chip for what it means.</div>`;

  // Category chips: anti-pattern classes (hover = taxonomy explanation)
  const classPills = Object.entries(summary.byClass)
    .sort()
    .map(([cls, n]) => {
      const key = cls.replace('Class ', '');
      const info = summary.classInfo[key];
      return `<span class="pill cls" tabindex="0" title="${esc(info.name)}: ${esc(info.description)}">${esc(cls)} · ${esc(info.name)}: ${n}</span>`;
    })
    .join('');

  // Origin chips: likely upstream library attribution
  const originPills = Object.entries(summary.byOrigin)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([origin, n]) =>
        `<span class="pill" tabindex="0" title="Findings whose nearest fingerprinted ancestor matches ${esc(origin)}. This is a heuristic that requires confirmation.">${esc(origin)}: ${n}</span>`,
    )
    .join('');

  const rows = summary.findings
    .map(
      (f) => `
      <div class="finding" data-id="${f.id}" tabindex="0" title="${esc(f.message)}">
        <div class="meta">
          <span class="sev-${esc(f.severity)}">${esc(f.severity)}</span>
          <span title="${esc(f.className)}: ${esc(summary.classInfo[f.cls].description)}">[Class ${esc(f.cls)}]</span>
          ${esc(f.ruleId)}
          ${f.origin ? `— <span class="origin">likely ${esc(f.origin)}</span>` : ''}
        </div>
        <div class="selector">${esc(f.selector)}</div>
        <div class="msg">${esc(f.message)}</div>
      </div>`,
    )
    .join('');

  resultsEl.innerHTML =
    `<div>${classPills}</div><div>${originPills}</div>` +
    rows +
    (summary.total > summary.findings.length
      ? `<div class="finding muted">…and ${summary.total - summary.findings.length} more. Run window.ariaReach.report() in DevTools for the full list.</div>`
      : '');

  // Hover/focus a finding card → preview it (outline + scroll + tooltip).
  // Click → pin it on the page and close this panel so it stops blocking the view.
  // Suppress the hover preview while (a) a pin is starting — as the popup closes
  // the card's mouseleave/blur would otherwise wipe the new pin — and (b) overlay
  // mode is on, since the preview's restoreOutlines() would wipe the all-page
  // highlights (they share one saved-outline map).
  let pinning = false;
  const previewSuppressed = () => pinning || overlayOn;
  for (const card of resultsEl.querySelectorAll('.finding[data-id]')) {
    const id = Number(card.dataset.id);
    card.addEventListener('mouseenter', () => {
      if (previewSuppressed()) return;
      inPage((findingId) => window.ariaReach.highlightFinding(findingId), [id]).catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      if (previewSuppressed()) return;
      inPage(() => window.ariaReach.clearHighlight()).catch(() => {});
    });
    card.addEventListener('focus', () => {
      if (previewSuppressed()) return;
      inPage((findingId) => window.ariaReach.highlightFinding(findingId), [id]).catch(() => {});
    });
    card.addEventListener('blur', () => {
      if (previewSuppressed()) return;
      inPage(() => window.ariaReach.clearHighlight()).catch(() => {});
    });
    const pin = async () => {
      pinning = true;
      // If overlay mode is on, exit it cleanly first so we don't leave a dangling
      // page listener / stale outlines, then pin the single finding.
      await inPage((findingId) => {
        if (window.ariaReach.isOverlayOn && window.ariaReach.isOverlayOn()) {
          window.ariaReach.clearHighlights();
        }
        window.ariaReach.pinFinding(findingId);
      }, [id]).catch(() => {});
      window.close();
    };
    card.addEventListener('click', pin);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pin();
      }
    });
  }
}

// On open, restore the previous scan's results from the page (the scanner keeps
// them on window.ariaReach) instead of forcing a rescan. A page reload wipes
// window.ariaReach, so this naturally falls back to the initial prompt.
(async function restore() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') return;
    currentTabId = tab.id;
    const cached = await inPage(() =>
      window.ariaReach && typeof window.ariaReach.lastSummary === 'function'
        ? window.ariaReach.lastSummary()
        : null,
    );
    if (!cached) return;
    render(cached);
    highlightBtn.style.display = 'inline-block';
    overlayOn = await inPage(() =>
      window.ariaReach && typeof window.ariaReach.isOverlayOn === 'function'
        ? window.ariaReach.isOverlayOn()
        : false,
    ).catch(() => false);
    highlightBtn.textContent = overlayOn ? 'Remove highlights' : 'Highlight all on page';
    summaryEl.classList.remove('muted');
    // Restore which finding was pinned: mark its card and scroll it into view.
    const pinnedId = await inPage(() =>
      window.ariaReach && typeof window.ariaReach.pinnedFinding === 'function'
        ? window.ariaReach.pinnedFinding()
        : null,
    ).catch(() => null);
    if (pinnedId != null) {
      const card = resultsEl.querySelector(`.finding[data-id="${pinnedId}"]`);
      if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ block: 'nearest' });
      }
    }
  } catch {
    /* browser-internal page or scanner not injected — keep the initial prompt */
  }
})();
