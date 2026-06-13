#!/usr/bin/env node
import { createRequire } from 'node:module';
import { scanPaths } from './scanner.js';
import { reach } from './reach.js';
import { formatFindings, formatReach } from './report.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const HELP = `aria-reach ${version}
Static analyzer for ARIA anti-patterns in shared component libraries.

Usage:
  aria-reach scan <files-or-dirs...> [--json]
      Scan .html/.htm files (including Angular templates) for the four
      anti-pattern classes: I Decorative Noise Injection, II Live Region
      Urgency Miscalibration, III Widget Role Contract Violations,
      IV Async State Desynchronization.
      Exit code 1 if any error-severity finding is reported.

  aria-reach reach <npm-packages...> [--a-hat <number>] [--json]
      Compute the Library Reach Index (LRI = weekly downloads x A-hat)
      for npm packages, to prioritize upstream remediation targets.

Options:
  --json           Machine-readable output
  --a-hat <n>      Deployments-per-download coefficient (default 0.1)
  -h, --help       Show this help
  -v, --version    Show version
`;

interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  json: boolean;
  aHat: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { command: undefined, positional: [], json: false, aHat: 0.1 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--a-hat') {
      const next = argv[++i];
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(`Invalid --a-hat value: ${next ?? '(missing)'}`);
        process.exit(2);
      }
      out.aHat = parsed;
    } else if (arg === '-h' || arg === '--help') {
      console.log(HELP);
      process.exit(0);
    } else if (arg === '-v' || arg === '--version') {
      console.log(version);
      process.exit(0);
    } else if (out.command === undefined) out.command = arg;
    else out.positional.push(arg);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'scan') {
    if (args.positional.length === 0) {
      console.error('scan: provide at least one file or directory.\n');
      console.error(HELP);
      process.exit(2);
    }
    const findings = scanPaths(args.positional);
    if (args.json) console.log(JSON.stringify(findings, null, 2));
    else console.log(formatFindings(findings));
    // exitCode (not process.exit) so piped stdout flushes completely
    process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
    return;
  }

  if (args.command === 'reach') {
    if (args.positional.length === 0) {
      console.error('reach: provide at least one npm package name.\n');
      console.error(HELP);
      process.exit(2);
    }
    const rows = await reach(args.positional, args.aHat);
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else console.log(formatReach(rows));
    return;
  }

  console.log(HELP);
  process.exit(args.command === undefined ? 0 : 2);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
