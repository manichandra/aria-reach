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
    'decorative-separator-aria-hidden': 2, // glyph span (error) + class-hint divider (warning)
    'svg-decorative-aria-hidden': 1,
    'assertive-live-region-review': 2, // aria-live=assertive (warning) + role=alert (info)
    'listbox-missing-options': 1,
    'option-missing-aria-selected': 1,
    'aria-pressed-in-selection-context': 1,
    'haspopup-missing-aria-expanded': 1,
    'ngsubmit-await-async-validators': 1,
  });

  assert.deepEqual(countBy(findings, 'severity'), { error: 4, warning: 4, info: 2 });
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
  assert.equal(flagged[0].severity, 'error');

  const bound = scanSource('<span [attr.aria-hidden]="true">›</span>', 'inline.html');
  assert.equal(bound.length, 0);

  const literal = scanSource('<span aria-hidden="true">›</span>', 'inline.html');
  assert.equal(literal.length, 0);
});

test('scanSource: aria-pressed outside selection context is not flagged', () => {
  const toggle = scanSource('<button aria-pressed="true">Bold</button>', 'inline.html');
  assert.equal(toggle.length, 0);
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
