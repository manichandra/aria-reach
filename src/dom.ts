import { allRules, type ScannableElement, type Severity, type AntiPatternClass } from './rules.js';

/**
 * Live-DOM adapter: lets the runtime-capable rules scan the rendered DOM of
 * any page — framework-agnostic, because at runtime React/Vue/Angular/vanilla
 * all produce plain DOM.
 *
 * Notes vs. static scanning:
 *  - Angular bindings are compiled away at runtime, so hasBinding() is always
 *    false and the Class IV (ngSubmit) heuristic does not apply here.
 *  - Values seen here are the *resolved* attribute values — runtime scanning
 *    can therefore catch issues static analysis cannot, and vice versa.
 */
export class DomElementInfo implements ScannableElement {
  readonly events: ReadonlySet<string> = new Set<string>();

  constructor(readonly element: Element) {}

  get tag(): string {
    return this.element.tagName.toLowerCase();
  }

  get children(): DomElementInfo[] {
    return Array.from(this.element.children).map((c) => new DomElementInfo(c));
  }

  has(name: string): boolean {
    return this.element.hasAttribute(name);
  }

  hasBinding(_name: string): boolean {
    return false;
  }

  staticValue(name: string): string | undefined {
    return this.element.getAttribute(name) ?? undefined;
  }

  rawValue(name: string): string | undefined {
    return this.element.getAttribute(name) ?? undefined;
  }

  text(): string {
    return this.element.textContent ?? '';
  }

  *ancestors(): Generator<DomElementInfo> {
    let cur = this.element.parentElement;
    while (cur) {
      yield new DomElementInfo(cur);
      cur = cur.parentElement;
    }
  }

  *descendants(): Generator<DomElementInfo> {
    for (const d of Array.from(this.element.querySelectorAll('*'))) {
      yield new DomElementInfo(d);
    }
  }
}

/**
 * Component-library fingerprints: identify the *likely upstream origin* of a
 * finding from tag names and class prefixes. This is a heuristic candidate
 * for manual confirmation, not proof of package-level provenance.
 */
const LIBRARY_FINGERPRINTS: { pattern: RegExp; library: string }[] = [
  { pattern: /^(p-|ui-)/, library: 'PrimeNG / PrimeFaces' },
  { pattern: /^(mat-|cdk-)/, library: 'Angular Material / CDK' },
  { pattern: /^ql-/, library: 'Quill' },
  { pattern: /^vjs-/, library: 'Video.js' },
  { pattern: /^usa-/, library: 'USWDS (U.S. Web Design System)' },
  { pattern: /^ant-/, library: 'Ant Design' },
  { pattern: /^Mui/, library: 'MUI (Material UI)' },
  { pattern: /^chakra-/, library: 'Chakra UI' },
  { pattern: /^el-/, library: 'Element Plus' },
  { pattern: /^v-(btn|list|menu|select|chip|card)/, library: 'Vuetify' },
  { pattern: /^(bs-|ngb-)/, library: 'ng-bootstrap / ngx-bootstrap' },
  { pattern: /^dx-/, library: 'DevExtreme' },
  { pattern: /^k-/, library: 'Kendo UI' },
];

function fingerprintOf(el: Element): string | null {
  const tokens = [el.tagName.toLowerCase(), ...Array.from(el.classList)];
  for (const token of tokens) {
    for (const { pattern, library } of LIBRARY_FINGERPRINTS) {
      if (pattern.test(token)) return library;
    }
  }
  return null;
}

function likelyOrigin(el: Element): string | null {
  let cur: Element | null = el;
  while (cur) {
    const hit = fingerprintOf(cur);
    if (hit) return hit;
    cur = cur.parentElement;
  }
  return null;
}

function shortSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && parts.length < 4 && cur.tagName.toLowerCase() !== 'html') {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`${part}#${cur.id}`);
      break;
    }
    const cls = Array.from(cur.classList).slice(0, 2).join('.');
    if (cls) part += `.${cls}`;
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

export interface DomFinding {
  ruleId: string;
  cls: AntiPatternClass;
  severity: Severity;
  message: string;
  selector: string;
  /** Likely upstream component library, when identifiable. */
  origin: string | null;
  element: Element;
}

export function scanDom(root: Document | Element = document): DomFinding[] {
  const findings: DomFinding[] = [];
  const scope = root instanceof Document ? root.documentElement : root;
  const elements = [scope, ...Array.from(scope.querySelectorAll('*'))];
  for (const element of elements) {
    const adapted = new DomElementInfo(element);
    for (const rule of allRules) {
      const result = rule.check(adapted);
      if (!result) continue;
      findings.push({
        ruleId: rule.id,
        cls: rule.cls,
        severity: result.severity ?? rule.defaultSeverity,
        message: result.message,
        selector: shortSelector(element),
        origin: likelyOrigin(element),
        element,
      });
    }
  }
  return findings;
}
