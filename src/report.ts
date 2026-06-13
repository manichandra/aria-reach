import type { Finding } from './scanner.js';
import type { ReachRow } from './reach.js';

const COLORS = {
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  reset: '\u001b[0m',
};

const useColor = process.stdout.isTTY === true;
const paint = (color: keyof typeof COLORS, text: string): string =>
  useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text;

const SEVERITY_LABEL = {
  error: () => paint('red', 'error'),
  warning: () => paint('yellow', 'warning'),
  info: () => paint('cyan', 'info'),
};

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'No ARIA anti-patterns detected.\n';
  }
  const lines: string[] = [];
  let currentFile = '';
  for (const f of findings) {
    if (f.file !== currentFile) {
      currentFile = f.file;
      lines.push('', paint('bold', currentFile));
    }
    lines.push(
      `  ${String(f.line)}:${String(f.col)}  ${SEVERITY_LABEL[f.severity]()}  ` +
        `${paint('dim', `[Class ${f.cls}] ${f.ruleId}`)}\n      ${f.message}`,
    );
  }
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const infos = findings.filter((f) => f.severity === 'info').length;
  lines.push(
    '',
    paint(
      errors > 0 ? 'red' : 'yellow',
      `${String(findings.length)} finding(s): ${String(errors)} error(s), ${String(warnings)} warning(s), ${String(infos)} info`,
    ),
    '',
  );
  return lines.join('\n');
}

export function formatReach(rows: ReachRow[]): string {
  const lines: string[] = [];
  lines.push('', paint('bold', 'Library Reach Index (LRI = weekly downloads x A-hat)'), '');
  const pkgWidth = Math.max(12, ...rows.map((r) => r.pkg.length)) + 2;
  lines.push(
    `${'package'.padEnd(pkgWidth)}${'downloads/week'.padStart(16)}${'A-hat'.padStart(8)}${'LRI (est. deployments)'.padStart(25)}`,
  );
  let totalLri = 0;
  for (const r of rows) {
    totalLri += r.lri;
    lines.push(
      `${r.pkg.padEnd(pkgWidth)}${r.weeklyDownloads.toLocaleString('en-US').padStart(16)}` +
        `${String(r.aHat).padStart(8)}${r.lri.toLocaleString('en-US').padStart(25)}`,
    );
  }
  lines.push('', `Combined estimated downstream deployments: ${totalLri.toLocaleString('en-US')}`);
  lines.push(
    paint('dim', 'A-hat is an illustrative sensitivity parameter (default 0.1); treat LRI as an order-of-magnitude prioritization instrument.'),
    '',
  );
  return lines.join('\n');
}
