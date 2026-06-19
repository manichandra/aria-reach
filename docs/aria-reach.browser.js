"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/rules.ts
  var SEPARATOR_GLYPHS = /* @__PURE__ */ new Set([
    "\u203A",
    "\xBB",
    "\u2039",
    "\xAB",
    "/",
    "|",
    "\\",
    "\u2022",
    "\xB7",
    ">",
    "<",
    "-",
    "\u2013",
    "\u2014",
    "::",
    "\u2192",
    "\u2190",
    "\u25B8",
    "\u25B6",
    "\u27A4",
    "\u3009",
    "\u27E9"
  ]);
  var SEPARATOR_CLASS_HINT = /(separator|divider|chevron|caret)/i;
  var SELECTION_CONTAINER_ROLES = /* @__PURE__ */ new Set([
    "grid",
    "treegrid",
    "listbox",
    "tablist",
    "tree",
    "gridcell",
    "row"
  ]);
  var SELECTION_ITEM_ROLES = /* @__PURE__ */ new Set([
    "gridcell",
    "option",
    "row",
    "tab",
    "treeitem"
  ]);
  var TEXT_SEPARATOR_TAGS = /* @__PURE__ */ new Set(["span", "li", "i", "em", "b"]);
  function hasInteractiveDescendant(el) {
    for (const d of el.descendants()) {
      if (["a", "button", "input", "select", "textarea"].includes(d.tag)) return true;
    }
    return false;
  }
  function hasInteractiveAncestor(el) {
    for (const a of el.ancestors()) {
      if (a.tag === "a" || a.tag === "button") return true;
      if ((a.staticValue("role") ?? "").toLowerCase() === "button") return true;
    }
    return false;
  }
  var NON_OPTION_HINT = /(group|empty|message|chip|header|placeholder|no-?result|loading|separator|divider)/i;
  var decorativeSeparator = {
    id: "decorative-separator-aria-hidden",
    cls: "I",
    defaultSeverity: "warning",
    check(el) {
      if (el.has("aria-hidden") || el.has("aria-label") || el.has("aria-labelledby")) return null;
      if (hasInteractiveDescendant(el)) return null;
      if (hasInteractiveAncestor(el)) return null;
      const text = el.text().trim();
      const isLeaf = el.children.length === 0;
      if (isLeaf && TEXT_SEPARATOR_TAGS.has(el.tag) && text.length > 0 && text.length <= 3 && SEPARATOR_GLYPHS.has(text)) {
        return {
          message: `Decorative separator "${text}" is exposed to the accessibility tree and will be announced by screen readers. Add aria-hidden="true" (WCAG SC 1.1.1; Class I \u2014 Decorative Noise Injection).`
        };
      }
      if (text.length === 0 && SEPARATOR_CLASS_HINT.test(el.staticValue("class") ?? "")) {
        return {
          severity: "warning",
          message: `Element class suggests a decorative separator but it is not hidden from assistive technology. If purely decorative, add aria-hidden="true" (Class I \u2014 Decorative Noise Injection).`
        };
      }
      return null;
    }
  };
  var svgDecorative = {
    id: "svg-decorative-aria-hidden",
    cls: "I",
    defaultSeverity: "warning",
    check(el) {
      if (el.tag !== "svg") return null;
      if (el.has("aria-hidden") || el.has("aria-label") || el.has("aria-labelledby")) return null;
      if ((el.staticValue("role") ?? "").toLowerCase() === "img") return null;
      for (const d of el.descendants()) if (d.tag === "title") return null;
      return {
        message: `Inline <svg> is neither hidden from assistive technology nor given an accessible name. If decorative, add aria-hidden="true" focusable="false"; if informative, add role="img" with aria-label or a <title> (WCAG SC 1.1.1; Class I \u2014 Decorative Noise Injection).`
      };
    }
  };
  var assertiveLiveRegion = {
    id: "assertive-live-region-review",
    cls: "II",
    defaultSeverity: "warning",
    check(el) {
      if ((el.staticValue("aria-live") ?? "").toLowerCase() === "assertive") {
        return {
          message: `aria-live="assertive" interrupts ongoing screen reader speech. Reserve assertive for time-critical alerts; use "polite" for informational updates (WCAG SC 4.1.3; Class II \u2014 Live Region Urgency Miscalibration).`
        };
      }
      if ((el.staticValue("role") ?? "").toLowerCase() === "alert") {
        return {
          severity: "info",
          message: `role="alert" is implicitly assertive. Verify this content is genuinely time-critical; otherwise prefer role="status" or aria-live="polite" (Class II \u2014 Live Region Urgency Miscalibration).`
        };
      }
      return null;
    }
  };
  var listboxMissingOptions = {
    id: "listbox-missing-options",
    cls: "III",
    defaultSeverity: "error",
    check(el) {
      if ((el.staticValue("role") ?? "").toLowerCase() !== "listbox") return null;
      let sawRoleBinding = false;
      for (const d of el.descendants()) {
        const role = (d.staticValue("role") ?? "").toLowerCase();
        if (role === "option") return null;
        if (d.hasBinding("role")) sawRoleBinding = true;
        if (d.tag === "ng-content" || d.tag.includes("-")) return null;
      }
      if (sawRoleBinding) return null;
      return {
        message: `role="listbox" has no descendant with role="option". The listbox contract requires option children with aria-selected state (WAI-ARIA; WCAG SC 4.1.2; Class III \u2014 Widget Role Contract Violation).`
      };
    }
  };
  var optionMissingSelected = {
    id: "option-missing-aria-selected",
    cls: "III",
    defaultSeverity: "error",
    check(el) {
      if ((el.staticValue("role") ?? "").toLowerCase() !== "option") return null;
      if (el.has("aria-selected")) return null;
      const hint = `${el.rawValue("class") ?? ""} ${el.rawValue("id") ?? ""}`;
      if (NON_OPTION_HINT.test(hint)) return null;
      return {
        message: `role="option" without aria-selected: screen readers cannot announce selection state (WAI-ARIA required state; WCAG SC 4.1.2; Class III \u2014 Widget Role Contract Violation).`
      };
    }
  };
  var ariaPressedInSelectionContext = {
    id: "aria-pressed-in-selection-context",
    cls: "III",
    defaultSeverity: "error",
    check(el) {
      if (!el.has("aria-pressed")) return null;
      const ownRole = (el.staticValue("role") ?? "").toLowerCase();
      let inSelectionContext = SELECTION_ITEM_ROLES.has(ownRole);
      if (!inSelectionContext) {
        for (const a of el.ancestors()) {
          const role = (a.staticValue("role") ?? "").toLowerCase();
          if (SELECTION_CONTAINER_ROLES.has(role)) {
            inSelectionContext = true;
            break;
          }
        }
      }
      if (!inSelectionContext) return null;
      return {
        message: `aria-pressed communicates toggle-button state ("pressed"/"not pressed") but this element is in a selection context, which requires aria-selected ("selected"/"not selected"). Screen readers will announce the wrong interaction paradigm (WAI-ARIA; WCAG SC 4.1.2; Class III \u2014 Role Substitution Error).`
      };
    }
  };
  var haspopupMissingExpanded = {
    id: "haspopup-missing-aria-expanded",
    cls: "III",
    defaultSeverity: "warning",
    check(el) {
      if (!el.has("aria-haspopup")) return null;
      if (el.has("aria-expanded")) return null;
      return {
        message: `aria-haspopup without aria-expanded: assistive technology cannot announce whether the popup is open (WAI-ARIA APG; WCAG SC 4.1.2; Class III \u2014 Widget Role Contract Violation).`
      };
    }
  };
  var ngSubmitAwaitAsyncValidators = {
    id: "ngsubmit-await-async-validators",
    cls: "IV",
    defaultSeverity: "info",
    check(el) {
      if (!el.events.has("ngsubmit")) return null;
      if (el.has("awaitasyncvalidators")) return null;
      return {
        message: `(ngSubmit) fires synchronously even while async validators are PENDING, so submission can proceed with unresolved validation state (WCAG SC 3.3.1 Error Identification). If this form uses async validators, add [awaitAsyncValidators]="true" (angular/angular#68661) or guard on form.status !== 'PENDING' (Class IV \u2014 Async State Desynchronization).`
      };
    }
  };
  var allRules = [
    decorativeSeparator,
    svgDecorative,
    assertiveLiveRegion,
    listboxMissingOptions,
    optionMissingSelected,
    ariaPressedInSelectionContext,
    haspopupMissingExpanded,
    ngSubmitAwaitAsyncValidators
  ];

  // src/dom.ts
  var DomElementInfo = class _DomElementInfo {
    constructor(element) {
      this.element = element;
      __publicField(this, "events", /* @__PURE__ */ new Set());
    }
    get tag() {
      return this.element.tagName.toLowerCase();
    }
    get children() {
      return Array.from(this.element.children).map((c) => new _DomElementInfo(c));
    }
    has(name) {
      return this.element.hasAttribute(name);
    }
    hasBinding(_name) {
      return false;
    }
    staticValue(name) {
      return this.element.getAttribute(name) ?? void 0;
    }
    rawValue(name) {
      return this.element.getAttribute(name) ?? void 0;
    }
    text() {
      return this.element.textContent ?? "";
    }
    *ancestors() {
      let cur = this.element.parentElement;
      while (cur) {
        yield new _DomElementInfo(cur);
        cur = cur.parentElement;
      }
    }
    *descendants() {
      for (const d of Array.from(this.element.querySelectorAll("*"))) {
        yield new _DomElementInfo(d);
      }
    }
  };
  var LIBRARY_FINGERPRINTS = [
    { pattern: /^(p-|ui-)/, library: "PrimeNG / PrimeFaces" },
    { pattern: /^(mat-|cdk-)/, library: "Angular Material / CDK" },
    { pattern: /^ql-/, library: "Quill" },
    { pattern: /^vjs-/, library: "Video.js" },
    { pattern: /^usa-/, library: "USWDS (U.S. Web Design System)" },
    { pattern: /^ant-/, library: "Ant Design" },
    { pattern: /^Mui/, library: "MUI (Material UI)" },
    { pattern: /^chakra-/, library: "Chakra UI" },
    { pattern: /^el-/, library: "Element Plus" },
    { pattern: /^v-(btn|list|menu|select|chip|card)/, library: "Vuetify" },
    { pattern: /^(bs-|ngb-)/, library: "ng-bootstrap / ngx-bootstrap" },
    { pattern: /^dx-/, library: "DevExtreme" },
    { pattern: /^k-/, library: "Kendo UI" }
  ];
  function fingerprintOf(el) {
    const tokens = [el.tagName.toLowerCase(), ...Array.from(el.classList)];
    for (const token of tokens) {
      for (const { pattern, library } of LIBRARY_FINGERPRINTS) {
        if (pattern.test(token)) return library;
      }
    }
    return null;
  }
  function likelyOrigin(el) {
    let cur = el;
    while (cur) {
      const hit = fingerprintOf(cur);
      if (hit) return hit;
      cur = cur.parentElement;
    }
    return null;
  }
  function shortSelector(el) {
    const parts = [];
    let cur = el;
    while (cur && parts.length < 4 && cur.tagName.toLowerCase() !== "html") {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`${part}#${cur.id}`);
        break;
      }
      const cls = Array.from(cur.classList).slice(0, 2).join(".");
      if (cls) part += `.${cls}`;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }
  function scanDom(root = document) {
    const findings = [];
    const scope = root instanceof Document ? root.documentElement : root;
    const elements = [scope, ...Array.from(scope.querySelectorAll("*"))];
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
          element
        });
      }
    }
    return findings;
  }

  // src/browser.ts
  var CLASS_INFO = {
    I: {
      name: "Decorative Noise Injection",
      description: 'Purely decorative elements (separators, icons, ornaments) are exposed to the accessibility tree, so screen readers announce meaningless content like "chevron" between navigation items.'
    },
    II: {
      name: "Live Region Urgency Miscalibration",
      description: `aria-live="assertive" (or role="alert") used for non-urgent updates \u2014 every update interrupts whatever the screen reader is currently speaking, fragmenting the user's context.`
    },
    III: {
      name: "Widget Role Contract Violations",
      description: `A widget's ARIA role, state, or property breaks the W3C contract assistive technology relies on \u2014 e.g. aria-pressed on a calendar cell announces "button pressed" instead of "selected", or a listbox with no option semantics.`
    },
    IV: {
      name: "Async State Desynchronization",
      description: "The UI proceeds before asynchronous state resolves \u2014 e.g. a form submits while async validators are still PENDING, so errors cannot be identified at the moment of submission (WCAG 3.3.1)."
    }
  };
  var SEVERITY_COLORS = {
    error: "#dc2626",
    warning: "#d97706",
    info: "#0284c7"
  };
  var ATTR = "data-aria-reach-id";
  var lastFindings = [];
  var lastSummaryCache = null;
  var savedOutlines = /* @__PURE__ */ new Map();
  var tooltipEl = null;
  var overlayListener = null;
  var pinCleanup = null;
  var pinnedId = null;
  function clearPin() {
    if (pinCleanup) {
      const fn = pinCleanup;
      pinCleanup = null;
      fn();
    }
  }
  function tagFindings(findings) {
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
      el.removeAttribute(ATTR);
    }
    lastFindings = findings;
    findings.forEach((f, i) => {
      f.element.setAttribute(ATTR, String(i));
    });
  }
  function ensureTooltip() {
    if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;z-index:2147483647;max-width:420px;padding:8px 10px;background:#1f2937;color:#f9fafb;font:12px/1.5 system-ui,sans-serif;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;display:none";
    document.body.appendChild(el);
    tooltipEl = el;
    return el;
  }
  function showTooltipFor(target, finding, opts = {}) {
    const tip = ensureTooltip();
    const info = CLASS_INFO[finding.cls];
    tip.textContent = "";
    tip.style.pointerEvents = opts.onClose ? "auto" : "none";
    tip.style.paddingRight = opts.onClose ? "24px" : "10px";
    if (opts.onClose) {
      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "Dismiss");
      close.textContent = "\xD7";
      close.style.cssText = "position:absolute;top:1px;right:3px;background:none;border:none;color:#9ca3af;font:700 16px/1 system-ui,sans-serif;cursor:pointer;padding:2px 4px";
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        opts.onClose?.();
      });
      tip.appendChild(close);
    }
    const head = document.createElement("div");
    head.style.cssText = `font-weight:700;color:${SEVERITY_COLORS[finding.severity] ?? "#fff"};margin-bottom:3px`;
    head.textContent = `${finding.severity.toUpperCase()} \xB7 ${finding.ruleId} \xB7 Class ${finding.cls} (${info.name})`;
    const body = document.createElement("div");
    body.textContent = finding.message;
    tip.append(head, body);
    if (finding.origin) {
      const origin = document.createElement("div");
      origin.style.cssText = "margin-top:4px;color:#c4b5fd;font-weight:600";
      origin.textContent = `Likely upstream origin: ${finding.origin} \u2014 consider fixing it in the library, not per-app.`;
      tip.appendChild(origin);
    }
    const rect = target.getBoundingClientRect();
    tip.style.display = "block";
    const top = rect.bottom + 8 + tip.offsetHeight > window.innerHeight ? rect.top - tip.offsetHeight - 8 : rect.bottom + 8;
    tip.style.top = `${Math.max(4, top)}px`;
    tip.style.left = `${Math.min(Math.max(4, rect.left), window.innerWidth - tip.offsetWidth - 8)}px`;
  }
  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = "none";
  }
  function outlineElement(el, severity) {
    const html = el;
    if (!savedOutlines.has(html)) savedOutlines.set(html, html.style.outline);
    html.style.outline = `3px solid ${SEVERITY_COLORS[severity] ?? "#dc2626"}`;
    html.style.outlineOffset = "2px";
  }
  function restoreOutlines() {
    for (const [el, prev] of savedOutlines) {
      el.style.outline = prev;
      el.style.outlineOffset = "";
    }
    savedOutlines.clear();
  }
  function summarize(findings, limit = 50) {
    const count = (keyOf) => {
      const out = {};
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
      byOrigin: count((f) => f.origin ?? "application code / unknown"),
      classInfo: CLASS_INFO,
      findings: findings.slice(0, limit).map(({ element: _element, ...rest }, i) => ({
        id: i,
        className: CLASS_INFO[rest.cls].name,
        ...rest
      }))
    };
  }
  var api = {
    /** Full scan with live Element references (explorable in the console). */
    scan(root = document) {
      const findings = scanDom(root);
      tagFindings(findings);
      return findings;
    },
    /** Serializable summary (used by the browser extension popup). Tags elements for highlightFinding(). */
    summary(root = document) {
      const findings = scanDom(root);
      tagFindings(findings);
      lastSummaryCache = summarize(findings);
      return lastSummaryCache;
    },
    /** Cached summary from the last scan(), or null if the page hasn't been scanned. */
    lastSummary() {
      return lastSummaryCache;
    },
    /** Whether overlay mode (highlight-all) is currently active on the page. */
    isOverlayOn() {
      return overlayListener !== null;
    },
    /** Id of the finding currently pinned on the page, or null if none. */
    pinnedFinding() {
      return pinnedId;
    },
    /** Outline + scroll to one finding (popup hover). */
    highlightFinding(id) {
      restoreOutlines();
      const finding = lastFindings[id];
      const el = finding?.element;
      if (!el || !finding || !document.contains(el)) return;
      outlineElement(el, finding.severity);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      showTooltipFor(el, finding);
    },
    /** Remove the single-finding highlight (popup hover out). */
    clearHighlight() {
      clearPin();
      restoreOutlines();
      hideTooltip();
    },
    /**
     * Pin one finding: outline it, scroll it to center, and keep the tooltip
     * showing so the popup panel can close and stop blocking the page. The
     * tooltip follows the element while the page scrolls; a click anywhere on
     * the page (or the next scan) dismisses it.
     */
    pinFinding(id) {
      clearPin();
      restoreOutlines();
      const finding = lastFindings[id];
      const el = finding?.element;
      if (!el || !finding || !document.contains(el)) return;
      pinnedId = id;
      outlineElement(el, finding.severity);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const reposition = () => {
        if (document.contains(el)) showTooltipFor(el, finding, { onClose: clearPin });
        else clearPin();
      };
      reposition();
      const dismiss = () => clearPin();
      window.addEventListener("scroll", reposition, true);
      window.addEventListener("resize", reposition, true);
      document.addEventListener("click", dismiss, true);
      pinCleanup = () => {
        window.removeEventListener("scroll", reposition, true);
        window.removeEventListener("resize", reposition, true);
        document.removeEventListener("click", dismiss, true);
        restoreOutlines();
        hideTooltip();
        pinnedId = null;
      };
    },
    /**
     * Overlay mode: outline EVERY finding on the page (color = severity) and
     * show an explanation tooltip when hovering any outlined element.
     */
    highlight(root = document) {
      api.clearHighlights();
      const findings = scanDom(root);
      tagFindings(findings);
      for (const f of findings) outlineElement(f.element, f.severity);
      overlayListener = (e) => {
        const target = e.target?.closest?.(`[${ATTR}]`);
        if (!target) {
          hideTooltip();
          return;
        }
        const finding = lastFindings[Number(target.getAttribute(ATTR))];
        if (finding) showTooltipFor(target, finding);
      };
      document.addEventListener("mouseover", overlayListener, true);
      return findings.length;
    },
    /** Full cleanup of overlay mode: outlines, tooltip, tags, listener. */
    clearHighlights() {
      clearPin();
      restoreOutlines();
      hideTooltip();
      if (overlayListener) {
        document.removeEventListener("mouseover", overlayListener, true);
        overlayListener = null;
      }
      for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`))) {
        el.removeAttribute(ATTR);
      }
    },
    report(root = document) {
      const findings = api.scan(root);
      const s = summarize(findings);
      console.group(
        `%caria-reach%c ${String(s.total)} finding(s)`,
        "background:#5b21b6;color:#fff;padding:2px 6px;border-radius:3px",
        "font-weight:bold"
      );
      if (findings.length > 0) {
        console.log("By severity:", s.bySeverity, " By class:", s.byClass);
        console.log("By likely origin (upstream library attribution):", s.byOrigin);
        console.table(
          findings.map((f) => ({
            severity: f.severity,
            rule: f.ruleId,
            class: f.cls,
            origin: f.origin ?? "\u2014",
            selector: f.selector
          }))
        );
        console.log(
          "Explore live elements: window.ariaReach.scan() \xB7 Outline everything with hover tooltips: window.ariaReach.highlight() \xB7 Clean up: window.ariaReach.clearHighlights()"
        );
      } else {
        console.log("No ARIA anti-patterns detected on this page.");
      }
      console.groupEnd();
      return findings;
    }
  };
  window.ariaReach = api;
  api.report();
})();
