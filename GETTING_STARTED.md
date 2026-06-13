# Getting Started with aria-reach

A 10-minute walkthrough. Three ways to use the tool: **CLI** (scan source files),
**console snippet** (scan any live page), **browser extension** (one-click scan).

---

## 1. Build (until published to npm)

```bash
git clone <your-repo-url> && cd aria-reach
npm install
npm test            # builds + runs the test suite
npm run build:ext   # also produces the browser bundle + extension
```

After `npm publish`, users just run `npx aria-reach …`.

## 2. Your first scan — the worked example

This repo ships a deliberately broken Angular component:
[examples/breadcrumb.component.ts](examples/breadcrumb.component.ts).

```bash
node dist/cli.js scan examples/breadcrumb.component.ts
```

You'll get 5 findings, each with the **file:line**, a **severity**, the
**taxonomy class**, and the **WCAG citation**:

```
examples/breadcrumb.component.ts
  15:13  error  [Class I] decorative-separator-aria-hidden
      Decorative separator "›" is exposed to the accessibility tree … Add aria-hidden="true" (WCAG SC 1.1.1)
  20:5   warning [Class II] assertive-live-region-review
      aria-live="assertive" interrupts ongoing screen reader speech …
  22:5   warning [Class III] haspopup-missing-aria-expanded …
  24:7   error  [Class III] option-missing-aria-selected …
  25:7   error  [Class III] option-missing-aria-selected …

5 finding(s): 3 error(s), 2 warning(s), 0 info
```

How to read a finding, using line 24 as the example: the `<li role="option">`
declares itself an option but never tells assistive technology whether it is
*selected* — a screen reader user arrowing through the Year picker hears
"2025" with no state, instead of "2025, not selected, 1 of 2."

Now compare the remediated twin — it scans clean:

```bash
node dist/cli.js scan examples/breadcrumb.component.fixed.ts   # → No ARIA anti-patterns detected.
```

Diff the two files to see every fix pattern: `aria-hidden="true"` on the
separator, `polite` instead of `assertive`, `[attr.aria-expanded]` on the
trigger, `[attr.aria-selected]` on each option.

## 3. Scan a real project

```bash
node dist/cli.js scan src/                 # any folder: .html, .htm, plus inline
                                           # Angular templates inside .ts/.js
node dist/cli.js scan src/ --json          # machine-readable
```

Real-world proof: scanning PrimeNG's actual library source
(`packages/primeng/src`) reports **172 findings across 51 component files** —
including missing `aria-selected` on autocomplete options and unhidden
decorative SVGs in breadcrumb. Each one is a candidate upstream contribution.

## 4. Gate CI on it

Exit code is `1` when any error-severity finding exists:

```yaml
# .github/workflows/a11y.yml
- run: npx aria-reach scan src/
```

## 5. Reach scoring — where to spend remediation effort

```bash
node dist/cli.js reach primeng quill video.js @angular/forms @angular/material
```

Prints live weekly downloads and the Library Reach Index
(`LRI = downloads × Â`, default Â = 0.1) per package, plus the combined
estimated downstream deployments. Use it to rank which library's defect, once
fixed upstream, helps the most users.

## 6. Scan any live page (any framework) — console snippet

Copy the contents of `dist/aria-reach.browser.js`, open DevTools on any page
(Chrome, Edge, Firefox, or Safari), paste into the Console, press Enter. You
get a grouped report with **library attribution** — each finding labeled with
its likely upstream origin (PrimeNG, Angular Material, Quill, Video.js, USWDS,
MUI, Ant Design, …) — plus an API:

```js
window.ariaReach.report()    // grouped console report + table
window.ariaReach.scan()      // full findings with live element references
window.ariaReach.summary()   // serializable counts (what the extension uses)
```

This runtime mode is **framework-agnostic**: React, Vue, Svelte, vanilla —
at runtime everything is DOM.

## 7. Browser extension (Chrome today, Safari via Xcode converter)

See [browser-extension/README.md](browser-extension/README.md):
`npm run build:ext`, then load the folder unpacked at `chrome://extensions`.
Click the toolbar icon → **Scan this page** → counts by severity, origin
attribution pills, and the finding list.

## 8. What the CLI cannot see (honest limits)

Static analysis can't evaluate bound expressions (`[attr.aria-live]="x"` is
skipped, not guessed), can't detect a custom widget that has *no* ARIA at all,
and the Class IV rule is a heuristic (flags the opportunity, not a proven
bug). Pair the CLI (pre-merge, library source) with the runtime scan
(rendered DOM) and manual screen-reader testing (NVDA/JAWS/VoiceOver) for
full coverage.
