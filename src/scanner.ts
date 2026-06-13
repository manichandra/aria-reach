import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseTemplate } from './template.js';
import { allRules, type Rule, type Severity, type AntiPatternClass } from './rules.js';

export interface Finding {
  ruleId: string;
  cls: AntiPatternClass;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  col: number;
}

const TEMPLATE_EXTENSIONS = new Set(['.html', '.htm']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

export function collectFiles(paths: string[]): string[] {
  const files: string[] = [];
  const walk = (p: string): void => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const entry of readdirSync(p)) {
        if (SKIP_DIRS.has(entry)) continue;
        walk(join(p, entry));
      }
      return;
    }
    const ext = extname(p).toLowerCase();
    if (p.endsWith('.min.js') || p.endsWith('.d.ts')) return;
    if (TEMPLATE_EXTENSIONS.has(ext) || SOURCE_EXTENSIONS.has(ext)) files.push(p);
  };
  for (const p of paths) walk(p);
  return files.sort();
}

function runRules(source: string, file: string, rules: Rule[], lineOffset = 0): Finding[] {
  const findings: Finding[] = [];
  const elements = parseTemplate(source);
  for (const el of elements) {
    for (const rule of rules) {
      const result = rule.check(el);
      if (!result) continue;
      findings.push({
        ruleId: rule.id,
        cls: rule.cls,
        severity: result.severity ?? rule.defaultSeverity,
        message: result.message,
        file,
        line: el.line + lineOffset,
        col: el.col,
      });
    }
  }
  return findings;
}

/**
 * Extract Angular inline templates (`template: \`...\``) from a TS/JS
 * component source, preserving the line offset of each template so findings
 * map back to real source lines.
 */
export function extractInlineTemplates(source: string): { template: string; lineOffset: number }[] {
  const out: { template: string; lineOffset: number }[] = [];
  const re = /template\s*:\s*`((?:[^`\\]|\\[\s\S])*)`/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const templateStart = match.index + match[0].indexOf('`') + 1;
    const lineOffset = source.slice(0, templateStart).split('\n').length - 1;
    out.push({ template: match[1], lineOffset });
  }
  return out;
}

export function scanSource(source: string, file: string, rules: Rule[] = allRules): Finding[] {
  const ext = extname(file).toLowerCase();
  if (SOURCE_EXTENSIONS.has(ext)) {
    const findings: Finding[] = [];
    for (const { template, lineOffset } of extractInlineTemplates(source)) {
      findings.push(...runRules(template, file, rules, lineOffset));
    }
    return findings;
  }
  return runRules(source, file, rules);
}

export function scanPaths(paths: string[], rules: Rule[] = allRules): Finding[] {
  const findings: Finding[] = [];
  for (const file of collectFiles(paths)) {
    findings.push(...scanSource(readFileSync(file, 'utf8'), file, rules));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  return findings;
}
