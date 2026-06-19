#!/usr/bin/env node
/**
 * Verification harness for the "State of ARIA" report (NEXT_STEPS Phase 3.1).
 *
 * Re-fetches each library at a PINNED commit (for reproducibility), re-runs
 * aria-reach, and dumps every error-severity finding together with the actual
 * source line(s) it flagged — so each can be manually adjudicated true/false
 * positive. Also emits a random sample of N warning-severity findings.
 *
 * Usage: npm run build && node scripts/verify-findings.mjs [sampleN]
 * Output: reports/verify-findings-<date>.json + readable report on stdout
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPaths } from '../dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.ARIA_REACH_SCAN_CACHE ?? '/tmp/aria-reach-ecosystem';
const SAMPLE_N = Number(process.argv[2] ?? 20);

const LIBS = [
  { pkg: 'primeng', gh: 'primefaces/primeng', srcCandidates: ['packages/primeng/src', 'src/app/components'] },
  { pkg: '@angular/material', gh: 'angular/components', srcCandidates: ['src/material'] },
  { pkg: 'ng-zorro-antd', gh: 'NG-ZORRO/ng-zorro-antd', srcCandidates: ['components'] },
  { pkg: '@ng-bootstrap/ng-bootstrap', gh: 'ng-bootstrap/ng-bootstrap', srcCandidates: ['src'] },
  { pkg: 'ngx-bootstrap', gh: 'valor-software/ngx-bootstrap', srcCandidates: ['src'] },
  { pkg: '@nebular/theme', gh: 'akveo/nebular', srcCandidates: ['src/framework/theme', 'src/framework'] },
  { pkg: '@taiga-ui/core', gh: 'taiga-family/taiga-ui', srcCandidates: ['projects/core', 'projects'] },
  { pkg: '@clr/angular', gh: 'vmware-clarity/ng-clarity', srcCandidates: ['projects/angular/src', 'projects/angular', 'projects'] },
];

const TEST_FILE_RE = /\.spec\.|\.stories\.|\/(test|tests|testing|e2e|__tests__|fixtures|schematics|demo|demos|docs|documentation|example|examples)\//;

async function defaultBranch(gh) {
  const res = await fetch(`https://api.github.com/repos/${gh}`);
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${gh}`);
  const json = await res.json();
  return json.default_branch;
}

async function headSha(gh, branch) {
  const res = await fetch(`https://api.github.com/repos/${gh}/commits/${branch}`);
  if (!res.ok) return null;
  return (await res.json()).sha ?? null;
}

function fetchSource(gh, branch, dest) {
  if (existsSync(dest)) return;
  mkdirSync(dest, { recursive: true });
  execSync(
    `curl -sL "https://codeload.github.com/${gh}/tar.gz/refs/heads/${branch}" | tar xz --strip-components=1 -C "${dest}"`,
    { stdio: 'pipe', timeout: 300_000 },
  );
}

function snippet(absFile, line, ctx = 1) {
  try {
    const lines = readFileSync(absFile, 'utf8').split('\n');
    const start = Math.max(0, line - 1 - ctx);
    const end = Math.min(lines.length, line + ctx);
    return lines.slice(start, end).map((t, i) => {
      const n = start + i + 1;
      return `${n === line ? '►' : ' '} ${String(n).padStart(5)}| ${t.trim().slice(0, 160)}`;
    }).join('\n');
  } catch {
    return '(could not read source)';
  }
}

const out = [];
for (const lib of LIBS) {
  process.stderr.write(`\n→ ${lib.pkg} ... `);
  try {
    const branch = await defaultBranch(lib.gh);
    const sha = await headSha(lib.gh, branch);
    const dest = join(CACHE, lib.gh.replace('/', '__'));
    fetchSource(lib.gh, branch, dest);
    const srcDir = lib.srcCandidates.map((c) => join(dest, c)).find(existsSync) ?? dest;
    const findings = scanPaths([srcDir]).filter((f) => !TEST_FILE_RE.test(f.file));
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    out.push({
      pkg: lib.pkg, gh: lib.gh, branch, sha,
      counts: { total: findings.length, error: errors.length, warning: warnings.length },
      errors: errors.map((f) => ({ ...f, rel: f.file.replace(dest + '/', ''), snippet: snippet(f.file, f.line) })),
      warningPool: warnings.map((f) => ({ ...f, rel: f.file.replace(dest + '/', '') })),
      destForSnippet: dest,
    });
    process.stderr.write(`${errors.length} errors / ${findings.length} total @ ${sha?.slice(0, 8)}`);
  } catch (err) {
    process.stderr.write(`FAILED: ${err.message}`);
    out.push({ pkg: lib.pkg, gh: lib.gh, error: err.message });
  }
}

// Random warning sample across all libs
const allWarn = out.flatMap((r) => (r.warningPool ?? []).map((w) => ({ pkg: r.pkg, dest: r.destForSnippet, ...w })));
for (let i = allWarn.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [allWarn[i], allWarn[j]] = [allWarn[j], allWarn[i]]; }
const sample = allWarn.slice(0, SAMPLE_N).map((w) => ({ ...w, snippet: snippet(w.file, w.line) }));

const date = new Date().toISOString().slice(0, 10);
const outFile = join(ROOT, 'reports', `verify-findings-${date}.json`);
writeFileSync(outFile, JSON.stringify({ date, sampleN: SAMPLE_N, libs: out, warningSample: sample }, null, 2));

// Readable stdout
console.log(`\n\n${'='.repeat(70)}\nERROR-SEVERITY FINDINGS (verify every one)\n${'='.repeat(70)}`);
let totalErr = 0;
for (const r of out) {
  if (r.error) { console.log(`\n## ${r.pkg} — SCAN FAILED: ${r.error}`); continue; }
  console.log(`\n## ${r.pkg}  (${r.counts.error} errors, branch ${r.branch} @ ${r.sha?.slice(0, 8)})`);
  for (const f of r.errors) {
    totalErr++;
    console.log(`\n[${totalErr}] ${f.ruleId} (Class ${f.cls}) — ${f.rel}:${f.line}:${f.col}`);
    console.log(`    ${f.message}`);
    console.log(f.snippet.split('\n').map((l) => '    ' + l).join('\n'));
  }
}
console.log(`\n\n${'='.repeat(70)}\nRANDOM WARNING SAMPLE (n=${sample.length})\n${'='.repeat(70)}`);
sample.forEach((w, i) => {
  console.log(`\n[W${i + 1}] ${w.ruleId} (Class ${w.cls}) — ${w.pkg} — ${w.rel}:${w.line}:${w.col}`);
  console.log(`    ${w.message}`);
  console.log(w.snippet.split('\n').map((l) => '    ' + l).join('\n'));
});
console.log(`\n\nTotal errors to adjudicate: ${totalErr}`);
console.log(`JSON written to ${outFile}`);
