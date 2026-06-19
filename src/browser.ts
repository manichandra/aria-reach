/**
 * Browser entry point. Bundled (esbuild, IIFE) into:
 *   dist/aria-reach.browser.js  — paste into any DevTools console (Chrome,
 *   Edge, Firefox, Safari) or inject from the browser extension.
 *
 * Exposes `window.ariaReach` and runs a scan + console report on load.
 */
import { scanDom, type DomFinding } from './dom.js';
import type { AntiPatternClass } from './rules.js';

export const CLASS_INFO: Record<AntiPatternClass, { name: string; description: string }> = {
  I: {
    name: 'Decorative Noise Injection',
    description:
      'Purely decorative elements (separators, icons, ornaments) are exposed to the accessibility tree, so screen readers announce meaningless content like "chevron" between navigation items.',
  },
  II: {
    name: 'Live Region Urgency Miscalibration',
    description:
      'aria-live="assertive" (or role="alert") used for non-urgent updates — every update interrupts whatever the screen reader is currently speaking, fragmenting the user\'s context.',
  },
  III: {
    name: 'Widget Role Contract Violations',
    description:
      'A widget\'s ARIA role, state, or property breaks the W3C contract assistive technology relies on — e.g. aria-pressed on a calendar cell announces "button pressed" instead of "selected", or a listbox with no option semantics.',
  },
  IV: {
    name: 'Async State Desynchronization',
    description:
      'The UI proceeds before asynchronous state resolves — e.g. a form submits while async validators are still PENDING, so errors cannot be identified at the moment of submission (WCAG 3.3.1).',
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  error: '#dc2626',
  warning: '#d97706',
  info: '#0284c7',
};

export interface ScanSummary {
  total: number;
  bySeverity: Record<string, number>;
  byClass: Record<string, number>;
  byOrigin: Record<string, number>;
  classInfo: typeof CLASS_INFO;
  findings: {
    id: number;
    ruleId: string;
    cls: string;
    className: string;
    severity: string;
    selector: string;
    origin: string | null;
    message: string;
  }[];
}

/* ------------------------------------------------------------------ */
/* state shared by highlight features                                  */
/* ------------------------------------------------------------------ */

const ATTR = 'data-aria-reach-id';
let lastFindings: DomFinding[] = [];
const savedOutlines = new Map<HTMLElement, string>();
let tooltipEl: HTMLDivElement | null = null;
let overlayListener: ((e: Event) => void) | null = null;

function tagFindings(findings: DomFinding[]): void {
  // A page may be scanned repeatedly as its DOM changes. Remove old IDs first
  // so highlightFinding() cannot select a stale element from a previous scan.
  for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
    el.removeAttribute(ATTR);
  }
  lastFindings = findings;
  findings.forEach((f, i) => {
    f.element.setAttribute(ATTR, String(i));
  });
}

function ensureTooltip(): HTMLDivElement {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true'); // dev overlay must never enter the a11y tree
  el.style.cssText =
    'position:fixed;z-index:2147483647;max-width:420px;padding:8px 10px;' +
    'background:#1f2937;color:#f9fafb;font:12px/1.5 system-ui,sans-serif;' +
    'border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;display:none';
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

function showTooltipFor(target: Element, finding: DomFinding): void {
  const tip = ensureTooltip();
  const info = CLASS_INFO[finding.cls];
  tip.textContent = '';
  const head = document.createElement('div');
  head.style.cssText = `font-weight:700;color:${SEVERITY_COLORS[finding.severity] ?? '#fff'};margin-bottom:3px`;
  head.textContent = `${finding.severity.toUpperCase()} · ${finding.ruleId} · Class ${finding.cls} (${info.name})`;
  const body = document.createElement('div');
  body.textContent = finding.message;
  tip.append(head, body);
  if (finding.origin) {
    const origin = document.createElement('div');
    origin.style.cssText = 'margin-top:4px;color:#c4b5fd;font-weight:600';
    origin.textContent = `Likely upstream origin: ${finding.origin} — consider fixing it in the library, not per-app.`;
    tip.appendChild(origin);
  }
  const rect = target.getBoundingClientRect();
  tip.style.display = 'block';
  const top = rect.bottom + 8 + tip.offsetHeight > window.innerHeight ? rect.top - tip.offsetHeight - 8 : rect.bottom + 8;
  tip.style.top = `${Math.max(4, top)}px`;
  tip.style.left = `${Math.min(Math.max(4, rect.left), window.innerWidth - tip.offsetWidth - 8)}px`;
}

function hideTooltip(): void {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

function outlineElement(el: Element, severity: string): void {
  const html = el as HTMLElement;
  if (!savedOutlines.has(html)) savedOutlines.set(html, html.style.outline);
  html.style.outline = `3px solid ${SEVERITY_COLORS[severity] ?? '#dc2626'}`;
  html.style.outlineOffset = '2px';
}

function restoreOutlines(): void {
  for (const [el, prev] of savedOutlines) {
    el.style.outline = prev;
    el.style.outlineOffset = '';
  }
  savedOutlines.clear();
}

function summarize(findings: DomFinding[], limit = 50): ScanSummary {
  const count = (keyOf: (f: DomFinding) => string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const f of findings) {
      const k = keyOf(f);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };
  return {
    total: findings.length,
    bySeverity: count((f) => f.severity),
    byClass: count((f) => `Class ${f.cls}`),
    byOrigin: count((f) => f.origin ?? 'application code / unknown'),
    classInfo: CLASS_INFO,
    findings: findings.slice(0, limit).map(({ element: _element, ...rest }, i) => ({
      id: i,
      className: CLASS_INFO[rest.cls].name,
      ...rest,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

const api = {
  /** Full scan with live Element references (explorable in the console). */
  scan(root: Document | Element = document): DomFinding[] {
    const findings = scanDom(root);
    tagFindings(findings);
    return findings;
  },

  /** Serializable summary (used by the browser extension popup). Tags elements for highlightFinding(). */
  summary(root: Document | Element = document): ScanSummary {
    const findings = scanDom(root);
    tagFindings(findings);
    return summarize(findings);
  },

  /** Outline + scroll to one finding (popup hover). */
  highlightFinding(id: number): void {
    restoreOutlines();
    const el = document.querySelector(`[${ATTR}="${String(id)}"]`);
    const finding = lastFindings[id];
    if (!el || !finding) return;
    outlineElement(el, finding.severity);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showTooltipFor(el, finding);
  },

  /** Remove the single-finding highlight (popup hover out). */
  clearHighlight(): void {
    restoreOutlines();
    hideTooltip();
  },

  /**
   * Overlay mode: outline EVERY finding on the page (color = severity) and
   * show an explanation tooltip when hovering any outlined element.
   */
  highlight(root: Document | Element = document): number {
    api.clearHighlights();
    const findings = scanDom(root);
    tagFindings(findings);
    for (const f of findings) outlineElement(f.element, f.severity);
    overlayListener = (e: Event) => {
      const target = (e.target as Element | null)?.closest?.(`[${ATTR}]`);
      if (!target) {
        hideTooltip();
        return;
      }
      const finding = lastFindings[Number(target.getAttribute(ATTR))];
      if (finding) showTooltipFor(target, finding);
    };
    document.addEventListener('mouseover', overlayListener, true);
    return findings.length;
  },

  /** Full cleanup of overlay mode: outlines, tooltip, tags, listener. */
  clearHighlights(): void {
    restoreOutlines();
    hideTooltip();
    if (overlayListener) {
      document.removeEventListener('mouseover', overlayListener, true);
      overlayListener = null;
    }
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
      el.removeAttribute(ATTR);
    }
  },

  report(root: Document | Element = document): DomFinding[] {
    const findings = api.scan(root);
    const s = summarize(findings);
    /* eslint-disable no-console */
    console.group(
      `%caria-reach%c ${String(s.total)} finding(s)`,
      'background:#5b21b6;color:#fff;padding:2px 6px;border-radius:3px',
      'font-weight:bold',
    );
    if (findings.length > 0) {
      console.log('By severity:', s.bySeverity, ' By class:', s.byClass);
      console.log('By likely origin (upstream library attribution):', s.byOrigin);
      console.table(
        findings.map((f) => ({
          severity: f.severity,
          rule: f.ruleId,
          class: f.cls,
          origin: f.origin ?? '—',
          selector: f.selector,
        })),
      );
      console.log(
        'Explore live elements: window.ariaReach.scan() · Outline everything with hover tooltips: window.ariaReach.highlight() · Clean up: window.ariaReach.clearHighlights()',
      );
    } else {
      console.log('No ARIA anti-patterns detected on this page.');
    }
    console.groupEnd();
    /* eslint-enable no-console */
    return findings;
  },
};

declare global {
  interface Window {
    ariaReach: typeof api;
  }
}

window.ariaReach = api;
api.report();
