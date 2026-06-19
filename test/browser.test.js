// Runtime API tests for window.ariaReach (the browser/extension surface).
// These cover the interaction state machine the popup depends on — pin state,
// the cached summary, overlay mode — and specifically guard the regression
// where Remove highlights (clearHighlights) stripped the DOM tags that the
// per-finding pin/hover used to resolve elements.
//
// Runs under jsdom. The browser module reads bare `window`/`document`/`Document`
// globals and runs api.report() on load, so DOM globals must be installed and
// console silenced BEFORE importing it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = `<!doctype html><html><body>
  <nav><a href="/">Home</a><span aria-hidden="true">›</span><a href="/a">A</a></nav>
  <ul role="listbox" aria-label="opts"></ul>
  <div aria-live="assertive">Saved</div>
  <button aria-pressed="false" role="gridcell">5</button>
  <table role="listbox"><tbody><tr><td role="option">x</td></tr></tbody></table>
</body></html>`;

const dom = new JSDOM(html);
const w = dom.window;
for (const k of ['window', 'document', 'Document', 'Element', 'HTMLElement', 'Node', 'SVGElement']) {
  globalThis[k] = k === 'window' ? w : k === 'document' ? w.document : w[k];
}
// jsdom doesn't implement scrollIntoView; the API calls it on pin/hover.
w.Element.prototype.scrollIntoView = () => {};

// Silence the one-time api.report() console output on module load.
const real = { log: console.log, group: console.group, groupEnd: console.groupEnd, table: console.table };
console.log = console.group = console.groupEnd = console.table = () => {};
await import('../dist/browser.js'); // side effect: defines window.ariaReach
Object.assign(console, real);

const ar = w.ariaReach;
const TAG = 'data-aria-reach-id';
const outlinedCount = () =>
  Array.from(w.document.querySelectorAll('*')).filter((el) => el.style && el.style.outline).length;

test('lastSummary(): null before a scan, cached afterward', () => {
  // report() on load uses scan(), which does not populate the summary cache.
  assert.equal(ar.lastSummary(), null);
  const s = ar.summary();
  assert.equal(s.total, 4);
  assert.deepEqual(ar.lastSummary(), s);
});

test('isOverlayOn(): false → true on highlight() → false on clearHighlights()', () => {
  assert.equal(ar.isOverlayOn(), false);
  ar.highlight();
  assert.equal(ar.isOverlayOn(), true);
  ar.clearHighlights();
  assert.equal(ar.isOverlayOn(), false);
});

test('pinFinding() tracks the pinned id; clearHighlight() resets it', () => {
  ar.summary(); // re-tag after the overlay test mutated state
  assert.equal(ar.pinnedFinding(), null);
  ar.pinFinding(2);
  assert.equal(ar.pinnedFinding(), 2);
  assert.ok(outlinedCount() >= 1, 'pinned element should be outlined');
  ar.clearHighlight();
  assert.equal(ar.pinnedFinding(), null);
  assert.equal(outlinedCount(), 0, 'dismiss should restore outlines');
});

test('pin/hover resolve elements after clearHighlights() strips tags (regression)', () => {
  ar.summary(); // tags elements + caches summary
  ar.clearHighlights(); // Remove-highlights: removes every data-aria-reach-id tag
  assert.equal(w.document.querySelectorAll(`[${TAG}]`).length, 0, 'tags should be stripped');

  // Pin still works — it now resolves via the cached element reference, not the tag.
  ar.pinFinding(1);
  assert.equal(ar.pinnedFinding(), 1);
  assert.ok(outlinedCount() >= 1, 'pin should outline its element even with no tags');
  ar.clearHighlight();

  // Hover preview likewise works post-clear.
  ar.highlightFinding(0);
  assert.ok(outlinedCount() >= 1, 'hover should outline its element even with no tags');
  ar.clearHighlight();
  assert.equal(outlinedCount(), 0);
});
