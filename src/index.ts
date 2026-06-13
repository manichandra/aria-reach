export { parseTemplate, normalizeAttrName, ElementInfo } from './template.js';
export { allRules } from './rules.js';
export type { Rule, RuleResult, Severity, AntiPatternClass, ScannableElement } from './rules.js';
export { scanPaths, scanSource, collectFiles, extractInlineTemplates } from './scanner.js';
export type { Finding } from './scanner.js';
export { reach, packageReach } from './reach.js';
export type { ReachRow } from './reach.js';
