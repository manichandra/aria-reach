const summaryEl = document.getElementById('summary');
const resultsEl = document.getElementById('results');
const highlightBtn = document.getElementById('highlight');

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

document.getElementById('scan').addEventListener('click', async () => {
  summaryEl.textContent = 'Scanning…';
  resultsEl.innerHTML = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['aria-reach.browser.js'],
    });
    const summary = await inPage(() => window.ariaReach.summary());
    render(summary);
    highlightBtn.style.display = 'inline-block';
  } catch (err) {
    summaryEl.textContent =
      'Could not scan this page (browser-internal pages and the extension store are not scannable). ' +
      String(err && err.message ? err.message : err);
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
    `<div class="muted hint">Hover a finding to highlight it on the page. Hover a Class chip for what it means.</div>`;

  // Category chips: anti-pattern classes (hover = taxonomy explanation)
  const classPills = Object.entries(summary.byClass)
    .sort()
    .map(([cls, n]) => {
      const key = cls.replace('Class ', '');
      const info = summary.classInfo[key];
      return `<span class="pill cls" title="${esc(info.name)}: ${esc(info.description)}">${esc(cls)} · ${esc(info.name)}: ${n}</span>`;
    })
    .join('');

  // Origin chips: likely upstream library attribution
  const originPills = Object.entries(summary.byOrigin)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([origin, n]) =>
        `<span class="pill" title="Findings whose nearest fingerprinted ancestor matches ${esc(origin)} — candidates for an upstream fix rather than per-app workarounds.">${esc(origin)}: ${n}</span>`,
    )
    .join('');

  const rows = summary.findings
    .map(
      (f) => `
      <div class="finding" data-id="${f.id}" title="${esc(f.message)}">
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

  // Hover a finding card → outline + scroll + tooltip on the live element
  for (const card of resultsEl.querySelectorAll('.finding[data-id]')) {
    const id = Number(card.dataset.id);
    card.addEventListener('mouseenter', () => {
      inPage((findingId) => window.ariaReach.highlightFinding(findingId), [id]).catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      inPage(() => window.ariaReach.clearHighlight()).catch(() => {});
    });
  }
}
