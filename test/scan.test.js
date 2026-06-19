import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scanPaths, scanSource } from '../dist/index.js';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const countBy = (findings, key) =>
  findings.reduce((acc, f) => {
    acc[f[key]] = (acc[f[key]] ?? 0) + 1;
    return acc;
  }, {});

test('bad.html: detects one instance of every anti-pattern', () => {
  const findings = scanPaths([fixture('bad.html')]);

  assert.deepEqual(countBy(findings, 'ruleId'), {
    'decorative-separator-aria-hidden': 2, // glyph span + class-hint divider (both warning, Class I)
    'svg-decorative-aria-hidden': 1,
    'assertive-live-region-review': 2, // aria-live=assertive (warning) + role=alert (info)
    'listbox-missing-options': 1,
    'option-missing-aria-selected': 1,
    'aria-pressed-in-selection-context': 1,
    'haspopup-missing-aria-expanded': 1,
    'ngsubmit-await-async-validators': 1,
  });

  assert.deepEqual(countBy(findings, 'severity'), { error: 3, warning: 5, info: 2 });
  assert.deepEqual(countBy(findings, 'cls'), { I: 3, II: 2, III: 4, IV: 1 });

  for (const f of findings) {
    assert.ok(f.line > 0, `${f.ruleId} should carry a source line`);
  }
});

test('good.html: remediated patterns produce zero findings', () => {
  assert.deepEqual(scanPaths([fixture('good.html')]), []);
});

test('angular.html: binding syntax counts as attribute presence', () => {
  const findings = scanPaths([fixture('angular.html')]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'ngsubmit-await-async-validators');
  assert.equal(findings[0].severity, 'info');
});

test('scanSource: static separator flagged, bound aria-hidden accepted', () => {
  const flagged = scanSource('<span>›</span>', 'inline.html');
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].ruleId, 'decorative-separator-aria-hidden');
  assert.equal(flagged[0].severity, 'warning');

  const bound = scanSource('<span [attr.aria-hidden]="true">›</span>', 'inline.html');
  assert.equal(bound.length, 0);

  const literal = scanSource('<span aria-hidden="true">›</span>', 'inline.html');
  assert.equal(literal.length, 0);
});

test('scanSource: aria-pressed outside selection context is not flagged', () => {
  const toggle = scanSource('<button aria-pressed="true">Bold</button>', 'inline.html');
  assert.equal(toggle.length, 0);
});

test('listbox-missing-options: projected/component options are not false-flagged', () => {
  // Options arrive via content projection — invisible to static analysis.
  const projected = scanSource('<div role="listbox"><ng-content></ng-content></div>', 'inline.html');
  assert.equal(projected.filter((f) => f.ruleId === 'listbox-missing-options').length, 0);

  // Options arrive as a wrapper component whose internal role we cannot see.
  const component = scanSource('<div role="listbox"><mat-option>A</mat-option></div>', 'inline.html');
  assert.equal(component.filter((f) => f.ruleId === 'listbox-missing-options').length, 0);

  // A literal listbox with literal non-option children still fires.
  const broken = scanSource('<div role="listbox"><div>not an option</div></div>', 'inline.html');
  assert.equal(broken.filter((f) => f.ruleId === 'listbox-missing-options').length, 1);
});

test('option-missing-aria-selected: non-selectable rows suppressed, real options flagged', () => {
  // Group label / empty message carrying role="option" — role misuse, not a
  // missing-state defect; the identity lives in the bound class/id expression.
  const group = scanSource(`<li [class]="cx('optionGroup')" role="option">G</li>`, 'inline.html');
  assert.equal(group.filter((f) => f.ruleId === 'option-missing-aria-selected').length, 0);
  const empty = scanSource(`<div [id]="noResultsElementId" role="option">No results</div>`, 'inline.html');
  assert.equal(empty.filter((f) => f.ruleId === 'option-missing-aria-selected').length, 0);

  // A real selectable option with no aria-selected (static or bound) still fires.
  const real = scanSource('<button class="dropdown-item" role="option">Item</button>', 'inline.html');
  const hit = real.filter((f) => f.ruleId === 'option-missing-aria-selected');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].severity, 'error');
});

test('decorative-separator: glyph inside a control is not flagged', () => {
  // Hiding the glyph would leave the button unnamed — out of scope here.
  const inButton = scanSource('<button><span>›</span></button>', 'inline.html');
  assert.equal(inButton.filter((f) => f.ruleId === 'decorative-separator-aria-hidden').length, 0);
});

test('inline-component.ts: Angular inline templates are extracted with correct line mapping', () => {
  const findings = scanPaths([fixture('inline-component.ts')]);
  assert.equal(findings.length, 2);

  const assertive = findings.find((f) => f.ruleId === 'assertive-live-region-review');
  const separator = findings.find((f) => f.ruleId === 'decorative-separator-aria-hidden');
  assert.ok(assertive, 'assertive live region detected inside inline template');
  assert.ok(separator, 'decorative separator detected inside inline template');

  // Lines must map back to the .ts file, not the template fragment
  assert.equal(assertive.line, 7);
  assert.equal(separator.line, 8);
  assert.ok(assertive.file.endsWith('inline-component.ts'));
});
