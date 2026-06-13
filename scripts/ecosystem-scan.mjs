#!/usr/bin/env node
/**
 * Ecosystem scan harness for the "State of ARIA in npm UI libraries" report.
 *
 * For each configured library: downloads the default-branch source tarball,
 * scans it with aria-reach, filters out test/spec files, fetches live npm
 * download counts, and aggregates findings per taxonomy class.
 *
 * Usage:  npm run build && node scripts/ecosystem-scan.mjs
 * Output: reports/ecosystem-scan-<date>.json + markdown table on stdout
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPaths } from '../dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.ARIA_REACH_SCAN_CACHE ?? '/tmp/aria-reach-ecosystem';
const A_HAT = 0.1;

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

const TEST_FILE_RE = /\.spec\.|\.stories\.|\/(test|tests|testing|e2e|__tests__|fixtures|schematics)\//;

async function defaultBranch(gh) {
  const res = await fetch(`https://api.github.com/repos/${gh}`);
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${gh}`);
  return (await res.json()).default_branch;
}

async function weeklyDownloads(pkg) {
  const url = `https://api.npmjs.org/downloads/point/last-week/${pkg.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()).downloads ?? null;
}

function fetchSource(gh, branch, dest) {
  if (existsSync(dest)) return; // cached
  mkdirSync(dest, { recursive: true });
  execSync(
    `curl -sL "https://codeload.github.com/${gh}/tar.gz/refs/heads/${branch}" | tar xz --strip-components=1 -C "${dest}"`,
    { stdio: 'pipe', timeout: 300_000 },
  );
}

function aggregate(findings) {
  const by = (key) =>
    findings.reduce((acc, f) => ((acc[f[key]] = (acc[f[key]] ?? 0) + 1), acc), {});
  const topRules = Object.entries(by('ruleId'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([rule, n]) => `${rule} (${n})`);
  return {
    total: findings.length,
    files: new Set(findings.map((f) => f.file)).size,
    bySeverity: by('severity'),
    byClass: by('cls'),
    topRules,
  };
}

const results = [];
for (const lib of LIBS) {
  process.stderr.write(`\n→ ${lib.pkg} (${lib.gh}) ... `);
  try {
    const branch = await defaultBranch(lib.gh);
    const dest = join(CACHE, lib.gh.replace('/', '__'));
    fetchSource(lib.gh, branch, dest);
    const srcDir = lib.srcCandidates.map((c) => join(dest, c)).find(existsSync) ?? dest;
    const findings = scanPaths([srcDir]).filter((f) => !TEST_FILE_RE.test(f.file));
    const downloads = await weeklyDownloads(lib.pkg);
    const agg = aggregate(findings);
    results.push({
      pkg: lib.pkg,
      repo: `https://github.com/${lib.gh}`,
      branch,
      scannedPath: srcDir.replace(dest, '.'),
      weeklyDownloads: downloads,
      lri: downloads ? Math.round(downloads * A_HAT) : null,
      ...agg,
    });
    process.stderr.write(`${String(agg.total)} findings in ${String(agg.files)} files`);
  } catch (err) {
    process.stderr.write(`FAILED: ${err.message}`);
    results.push({ pkg: lib.pkg, repo: `https://github.com/${lib.gh}`, error: err.message });
  }
}

const date = new Date().toISOString().slice(0, 10);
const outDir = join(ROOT, 'reports');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `ecosystem-scan-${date}.json`);
writeFileSync(outFile, JSON.stringify({ date, aHat: A_HAT, results }, null, 2));

console.log(`\n\n| Library | Downloads/wk | Findings | Errors | Warnings | Class I/II/III/IV | Files |`);
console.log(`|---|---|---|---|---|---|---|`);
for (const r of results) {
  if (r.error) {
    console.log(`| ${r.pkg} | — | scan failed | | | | |`);
    continue;
  }
  const c = r.byClass;
  console.log(
    `| ${r.pkg} | ${r.weeklyDownloads?.toLocaleString('en-US') ?? '—'} | ${r.total} | ${r.bySeverity.error ?? 0} | ${r.bySeverity.warning ?? 0} | ${c.I ?? 0}/${c.II ?? 0}/${c.III ?? 0}/${c.IV ?? 0} | ${r.files} |`,
  );
}
console.log(`\nJSON written to ${outFile}`);
