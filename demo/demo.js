const scanRoot = document.getElementById('seeded-examples');
const summaryEl = document.getElementById('scan-summary');
const resultsEl = document.getElementById('scan-results');
const runBtn = document.getElementById('run-scan');
const highlightBtn = document.getElementById('highlight-all');
const clearBtn = document.getElementById('clear-highlights');

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function renderScan() {
  window.ariaReach.clearHighlights();
  const summary = window.ariaReach.summary(scanRoot);
  const severity = summary.bySeverity;

  summaryEl.innerHTML =
    `${summary.total} findings — ` +
    `<span class="sev-error">${severity.error ?? 0} errors</span>, ` +
    `<span class="sev-warning">${severity.warning ?? 0} warnings</span>, ` +
    `<span class="sev-info">${severity.info ?? 0} info</span>` +
    '<small>Likely origins are DOM-fingerprint heuristics and require confirmation.</small>' +
    '<small id="scan-action-status"></small>';

  if (summary.findings.length === 0) {
    resultsEl.innerHTML = '<p class="empty">No ARIA anti-patterns detected in the example region.</p>';
    return;
  }

  resultsEl.innerHTML = summary.findings
    .map(
      (finding) => `
        <button class="finding" type="button" data-finding-id="${finding.id}">
          <span class="finding-meta">
            <span class="sev-${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
            · Class ${escapeHtml(finding.cls)} · ${escapeHtml(finding.ruleId)}
            ${finding.origin ? ` · <span class="origin">likely ${escapeHtml(finding.origin)}</span>` : ''}
          </span>
          <span class="selector">${escapeHtml(finding.selector)}</span>
          <span class="message">${escapeHtml(finding.message)}</span>
        </button>`,
    )
    .join('');

  for (const button of resultsEl.querySelectorAll('[data-finding-id]')) {
    button.addEventListener('click', () => {
      window.ariaReach.highlightFinding(Number(button.dataset.findingId));
    });
  }
}

runBtn.addEventListener('click', renderScan);
highlightBtn.addEventListener('click', () => {
  window.ariaReach.highlight(scanRoot);
  document.getElementById('scan-action-status').textContent =
    'All current findings are highlighted on the left.';
});
clearBtn.addEventListener('click', () => {
  window.ariaReach.clearHighlights();
  document.getElementById('scan-action-status').textContent = 'Highlights cleared.';
});

renderScan();
