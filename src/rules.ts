export type Severity = 'error' | 'warning' | 'info';

/**
 * Structural interface every rule runs against. Implemented by:
 *  - ElementInfo (parse5-backed, static template scanning — CLI)
 *  - DomElementInfo (live-DOM-backed, runtime scanning — browser/extension)
 */
export interface ScannableElement {
  tag: string;
  children: ScannableElement[];
  /** Angular event bindings, e.g. (ngSubmit). Empty at runtime (compiled away). */
  events: ReadonlySet<string>;
  has(name: string): boolean;
  hasBinding(name: string): boolean;
  staticValue(name: string): string | undefined;
  /** Value as written — static literal or binding expression — if present. */
  rawValue(name: string): string | undefined;
  text(): string;
  ancestors(): Iterable<ScannableElement>;
  descendants(): Iterable<ScannableElement>;
}

/** Taxonomy class from "ARIA Anti-Patterns in Shared Component Libraries". */
export type AntiPatternClass = 'I' | 'II' | 'III' | 'IV';

export interface RuleResult {
  message: string;
  severity?: Severity;
}

export interface Rule {
  id: string;
  cls: AntiPatternClass;
  defaultSeverity: Severity;
  check(el: ScannableElement): RuleResult | null;
}

const SEPARATOR_GLYPHS = new Set([
  '›', '»', '‹', '«', '/', '|', '\\', '•', '·', '>', '<',
  '-', '–', '—', '::', '→', '←', '▸', '▶', '➤', '〉', '⟩',
]);

const SEPARATOR_CLASS_HINT = /(separator|divider|chevron|caret)/i;

const SELECTION_CONTAINER_ROLES = new Set([
  'grid', 'treegrid', 'listbox', 'tablist', 'tree', 'gridcell', 'row',
]);

const SELECTION_ITEM_ROLES = new Set([
  'gridcell', 'option', 'row', 'tab', 'treeitem',
]);

const TEXT_SEPARATOR_TAGS = new Set(['span', 'li', 'i', 'em', 'b']);

function hasInteractiveDescendant(el: ScannableElement): boolean {
  for (const d of el.descendants()) {
    if (['a', 'button', 'input', 'select', 'textarea'].includes(d.tag)) return true;
  }
  return false;
}

function hasInteractiveAncestor(el: ScannableElement): boolean {
  for (const a of el.ancestors()) {
    if (a.tag === 'a' || a.tag === 'button') return true;
    if ((a.staticValue('role') ?? '').toLowerCase() === 'button') return true;
  }
  return false;
}

/**
 * Class hints that mark a role="option" element as a *non-selectable* row
 * (group label, empty/"no results" message, input chip). Those are a
 * role-misuse smell, not a missing-aria-selected defect — the right fix is a
 * different role, so the "add aria-selected" remediation would be wrong advice.
 */
const NON_OPTION_HINT =
  /(group|empty|message|chip|header|placeholder|no-?result|loading|separator|divider)/i;

/**
 * Class I — Decorative Noise Injection.
 * Separator glyphs / decorative elements exposed to the accessibility tree.
 * Case study: PrimeNG breadcrumb separators (primefaces/primeng#19568).
 */
const decorativeSeparator: Rule = {
  id: 'decorative-separator-aria-hidden',
  cls: 'I',
  defaultSeverity: 'warning',
  check(el) {
    if (el.has('aria-hidden') || el.has('aria-label') || el.has('aria-labelledby')) return null;
    if (hasInteractiveDescendant(el)) return null;
    // A glyph inside a button/link is the control's (possibly only) accessible
    // name, not an inline separator. Hiding it could leave the control unnamed —
    // that is icon-button territory, out of scope for this rule.
    if (hasInteractiveAncestor(el)) return null;

    const text = el.text().trim();
    const isLeaf = el.children.length === 0;
    if (isLeaf && TEXT_SEPARATOR_TAGS.has(el.tag) && text.length > 0 && text.length <= 3 && SEPARATOR_GLYPHS.has(text)) {
      return {
        message:
          `Decorative separator "${text}" is exposed to the accessibility tree and will be announced by screen readers. ` +
          `Add aria-hidden="true" (WCAG SC 1.1.1; Class I — Decorative Noise Injection).`,
      };
    }
    if (text.length === 0 && SEPARATOR_CLASS_HINT.test(el.staticValue('class') ?? '')) {
      return {
        severity: 'warning',
        message:
          `Element class suggests a decorative separator but it is not hidden from assistive technology. ` +
          `If purely decorative, add aria-hidden="true" (Class I — Decorative Noise Injection).`,
      };
    }
    return null;
  },
};

/**
 * Class I — Decorative Noise Injection (SVG variant).
 * Inline SVG without aria-hidden and without an accessible-name pattern.
 */
const svgDecorative: Rule = {
  id: 'svg-decorative-aria-hidden',
  cls: 'I',
  defaultSeverity: 'warning',
  check(el) {
    if (el.tag !== 'svg') return null;
    if (el.has('aria-hidden') || el.has('aria-label') || el.has('aria-labelledby')) return null;
    if ((el.staticValue('role') ?? '').toLowerCase() === 'img') return null;
    for (const d of el.descendants()) if (d.tag === 'title') return null;
    return {
      message:
        `Inline <svg> is neither hidden from assistive technology nor given an accessible name. ` +
        `If decorative, add aria-hidden="true" focusable="false"; if informative, add role="img" with aria-label or a <title> ` +
        `(WCAG SC 1.1.1; Class I — Decorative Noise Injection).`,
    };
  },
};

/**
 * Class II — Live Region Urgency Miscalibration.
 * Case study: Video.js description tracks assertive -> polite (videojs/video.js#9178).
 */
const assertiveLiveRegion: Rule = {
  id: 'assertive-live-region-review',
  cls: 'II',
  defaultSeverity: 'warning',
  check(el) {
    if ((el.staticValue('aria-live') ?? '').toLowerCase() === 'assertive') {
      return {
        message:
          `aria-live="assertive" interrupts ongoing screen reader speech. Reserve assertive for time-critical alerts; ` +
          `use "polite" for informational updates (WCAG SC 4.1.3; Class II — Live Region Urgency Miscalibration).`,
      };
    }
    if ((el.staticValue('role') ?? '').toLowerCase() === 'alert') {
      return {
        severity: 'info',
        message:
          `role="alert" is implicitly assertive. Verify this content is genuinely time-critical; ` +
          `otherwise prefer role="status" or aria-live="polite" (Class II — Live Region Urgency Miscalibration).`,
      };
    }
    return null;
  },
};

/**
 * Class III — Widget Role Contract Violations (incomplete role implementation).
 * Case study: Quill toolbar pickers (slab/quill#4807).
 */
const listboxMissingOptions: Rule = {
  id: 'listbox-missing-options',
  cls: 'III',
  defaultSeverity: 'error',
  check(el) {
    if ((el.staticValue('role') ?? '').toLowerCase() !== 'listbox') return null;
    let sawRoleBinding = false;
    for (const d of el.descendants()) {
      const role = (d.staticValue('role') ?? '').toLowerCase();
      if (role === 'option') return null;
      if (d.hasBinding('role')) sawRoleBinding = true;
      // Options are almost always projected (<ng-content>) or supplied by a
      // wrapper component (<mat-option>, <nb-option>, …) whose internal
      // role="option" is invisible to static analysis. We cannot assert the
      // contract is broken in those cases — that is a runtime-only check.
      if (d.tag === 'ng-content' || d.tag.includes('-')) return null;
    }
    if (sawRoleBinding) return null; // option role may be assigned dynamically
    return {
      message:
        `role="listbox" has no descendant with role="option". The listbox contract requires option children with ` +
        `aria-selected state (WAI-ARIA; WCAG SC 4.1.2; Class III — Widget Role Contract Violation).`,
    };
  },
};

/**
 * Class III — Widget Role Contract Violations (missing required state).
 */
const optionMissingSelected: Rule = {
  id: 'option-missing-aria-selected',
  cls: 'III',
  defaultSeverity: 'error',
  check(el) {
    if ((el.staticValue('role') ?? '').toLowerCase() !== 'option') return null;
    if (el.has('aria-selected')) return null; // static or bound aria-selected satisfies the contract
    // Suppress role="option" on non-selectable rows (group label, empty/"no
    // results" message, input chip). Their identity lives in bound class/id
    // expressions; "add aria-selected" is the wrong remediation for them.
    const hint = `${el.rawValue('class') ?? ''} ${el.rawValue('id') ?? ''}`;
    if (NON_OPTION_HINT.test(hint)) return null;
    return {
      message:
        `role="option" without aria-selected: screen readers cannot announce selection state ` +
        `(WAI-ARIA required state; WCAG SC 4.1.2; Class III — Widget Role Contract Violation).`,
    };
  },
};

/**
 * Class III — Widget Role Contract Violations (role substitution error).
 * Case study: Angular Material mat-calendar aria-pressed -> aria-selected
 * (angular/components#33235): "15 button pressed" vs "15 selected".
 */
const ariaPressedInSelectionContext: Rule = {
  id: 'aria-pressed-in-selection-context',
  cls: 'III',
  defaultSeverity: 'error',
  check(el) {
    if (!el.has('aria-pressed')) return null;
    const ownRole = (el.staticValue('role') ?? '').toLowerCase();
    let inSelectionContext = SELECTION_ITEM_ROLES.has(ownRole);
    if (!inSelectionContext) {
      for (const a of el.ancestors()) {
        const role = (a.staticValue('role') ?? '').toLowerCase();
        if (SELECTION_CONTAINER_ROLES.has(role)) {
          inSelectionContext = true;
          break;
        }
      }
    }
    if (!inSelectionContext) return null;
    return {
      message:
        `aria-pressed communicates toggle-button state ("pressed"/"not pressed") but this element is in a selection ` +
        `context, which requires aria-selected ("selected"/"not selected"). Screen readers will announce the wrong ` +
        `interaction paradigm (WAI-ARIA; WCAG SC 4.1.2; Class III — Role Substitution Error).`,
    };
  },
};

/**
 * Class III — Widget Role Contract Violations (popup trigger missing state).
 */
const haspopupMissingExpanded: Rule = {
  id: 'haspopup-missing-aria-expanded',
  cls: 'III',
  defaultSeverity: 'warning',
  check(el) {
    if (!el.has('aria-haspopup')) return null;
    if (el.has('aria-expanded')) return null;
    return {
      message:
        `aria-haspopup without aria-expanded: assistive technology cannot announce whether the popup is open ` +
        `(WAI-ARIA APG; WCAG SC 4.1.2; Class III — Widget Role Contract Violation).`,
    };
  },
};

/**
 * Class IV — Async State Desynchronization (Angular-specific heuristic).
 * Case study: Angular Forms awaitAsyncValidators (angular/angular#68661).
 */
const ngSubmitAwaitAsyncValidators: Rule = {
  id: 'ngsubmit-await-async-validators',
  cls: 'IV',
  defaultSeverity: 'info',
  check(el) {
    if (!el.events.has('ngsubmit')) return null;
    if (el.has('awaitasyncvalidators')) return null;
    return {
      message:
        `(ngSubmit) fires synchronously even while async validators are PENDING, so submission can proceed with ` +
        `unresolved validation state (WCAG SC 3.3.1 Error Identification). If this form uses async validators, add ` +
        `[awaitAsyncValidators]="true" (angular/angular#68661) or guard on form.status !== 'PENDING' ` +
        `(Class IV — Async State Desynchronization).`,
    };
  },
};

export const allRules: Rule[] = [
  decorativeSeparator,
  svgDecorative,
  assertiveLiveRegion,
  listboxMissingOptions,
  optionMissingSelected,
  ariaPressedInSelectionContext,
  haspopupMissingExpanded,
  ngSubmitAwaitAsyncValidators,
];
