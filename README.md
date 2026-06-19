# aria-reach

Static analyzer for **ARIA anti-patterns in shared component libraries**, with npm **reach scoring** to prioritize the fixes that help the most assistive-technology users.

Most accessibility checkers audit *applications*. `aria-reach` targets the layer above them: the shared component libraries (UI kits, editors, media players, form frameworks) whose ARIA defects can propagate into downstream applications. A confirmed upstream fix can benefit many consumers as they adopt the corrected release — so that is where audit effort can pay off most.

`aria-reach` is the reference implementation of the four-class ARIA anti-pattern taxonomy from the paper *"ARIA Anti-Patterns in Shared Component Libraries: A Taxonomy and Force-Multiplied Remediation Strategy for Screen Reader Accessibility"* (under review; preprint link forthcoming). Each rule is grounded in a real upstream contribution to a major library.

## Install

```bash
npm install -g aria-reach   # or: npx aria-reach ...
```

**Build from source** (for contributors):
```bash
git clone https://github.com/manichandra/aria-reach.git
cd aria-reach && npm install && npm run build
node dist/cli.js scan src/
```

**New here? Follow the worked example in [GETTING_STARTED.md](GETTING_STARTED.md).**

## Scan templates for anti-patterns

```bash
aria-reach scan src/                  # .html/.htm + inline Angular templates in .ts/.js
aria-reach scan src/ --json           # machine-readable output
```

Exit code is `1` when any error-severity finding is reported, so it can gate CI.

### Use in CI (GitHub Action)

```yaml
# .github/workflows/accessibility.yml
name: accessibility
on: [push, pull_request]
jobs:
  aria-reach:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: manichandra/aria-reach@v0.1.2
        with:
          path: src            # file(s)/dir(s) to scan, space-separated
          # json: true         # machine-readable output
          # fail-on-error: false   # report-only, don't fail the job
```

The job fails when any error-severity ARIA finding is reported. GitHub-hosted runners already include Node ≥ 18.

Angular binding syntax is understood: `[attr.aria-hidden]="expr"` counts as the attribute being handled, and statically-unknowable bound values are never false-flagged. Inline component templates (`template: \`…\``) are extracted from `.ts`/`.js` sources with line numbers mapped back to the source file — scanning PrimeNG's real library source yields 172 findings across 51 component files.

## Scan any live page — runtime mode (framework-agnostic)

The runtime-detectable rules (Classes I–III) run against the rendered DOM of **any** app (React, Vue, Angular, vanilla — at runtime it's all DOM). When a finding or one of its ancestors has a recognized DOM fingerprint, it is labeled with a **likely** origin (PrimeNG, Angular Material, Quill, Video.js, USWDS, MUI, Ant Design, …). Attribution is heuristic and requires confirmation before proposing an upstream fix. The Angular-specific Class IV rule remains static-only because event bindings are compiled away at runtime.

- **Console snippet:** paste `dist/aria-reach.browser.js` (built via `npm run build:browser`) into any DevTools console → grouped report + `window.ariaReach.scan()/.report()/.summary()`. Works in Chrome, Edge, Firefox, and Safari.
- **Browser extension:** `npm run build:ext`, then load [browser-extension/](browser-extension/) unpacked in Chrome; Safari via Xcode's `safari-web-extension-converter`. See [browser-extension/README.md](browser-extension/README.md).

## The four anti-pattern classes

| Class | Anti-pattern | WCAG / ARIA | Grounding contribution |
|---|---|---|---|
| **I** | Decorative Noise Injection — separators/icons exposed to the accessibility tree | SC 1.1.1, 4.1.2 | PrimeNG breadcrumb separators ([primefaces/primeng#19568](https://github.com/primefaces/primeng/pull/19568)) |
| **II** | Live Region Urgency Miscalibration — `assertive` where `polite` belongs | SC 4.1.3 | Video.js description tracks ([videojs/video.js#9178](https://github.com/videojs/video.js/pull/9178)) |
| **III** | Widget Role Contract Violations — wrong/incomplete role, state, or property | SC 4.1.2, WAI-ARIA APG | Quill listbox pattern ([slab/quill#4807](https://github.com/slab/quill/pull/4807)), Angular Material calendar `aria-pressed`→`aria-selected` ([angular/components#33235](https://github.com/angular/components/pull/33235)) |
| **IV** | Async State Desynchronization — submission outruns async validation | SC 3.3.1, 3.3.4 | Angular Forms `awaitAsyncValidators` ([angular/angular#68661](https://github.com/angular/angular/pull/68661)) |

### Rules

| Rule | Class | Default severity |
|---|---|---|
| `decorative-separator-aria-hidden` | I | error / warning |
| `svg-decorative-aria-hidden` | I | warning |
| `assertive-live-region-review` | II | warning / info |
| `listbox-missing-options` | III | error |
| `option-missing-aria-selected` | III | error |
| `aria-pressed-in-selection-context` | III | error |
| `haspopup-missing-aria-expanded` | III | warning |
| `ngsubmit-await-async-validators` | IV | info |

## Reach scoring (Library Reach Index)

Quantify how far an upstream fix travels before you spend review effort:

```bash
aria-reach reach primeng quill video.js @angular/forms @angular/material
```

```
Library Reach Index (LRI = weekly downloads x A-hat)

package                 downloads/week   A-hat   LRI (est. deployments)
primeng                      2,012,345     0.1                  201,234
...
```

`LRI(L) = Dw(L) × Â(L)` — weekly npm downloads times an estimated deployments-per-download coefficient (`--a-hat`, default `0.1`). The LRI is an order-of-magnitude **prioritization instrument**, not a precise measurement: libraries with high LRI are the highest-leverage targets for upstream accessibility contribution.

## Library API

```js
import { scanPaths, scanSource, reach } from 'aria-reach';

const findings = scanPaths(['src/']);            // Finding[]
const inline = scanSource('<span>›</span>', 'x.html');
const rows = await reach(['primeng'], 0.1);      // ReachRow[]
```

## Limitations (read this)

Static analysis sees annotated-but-wrong patterns; it cannot prove a custom widget *lacking all semantics* is interactive, cannot evaluate bound expressions, and cannot replace runtime checkers (axe-core) or manual screen-reader testing (NVDA/JAWS/VoiceOver). Class IV detection is a heuristic: it flags the *opportunity* for desynchronization, not a proven defect. Use `aria-reach` as the library-layer complement to — never a substitute for — application-layer audits and AT testing.

## Framework support

| Surface | Static CLI | Runtime (snippet/extension) |
|---|---|---|
| Plain HTML | ✅ | ✅ |
| Angular templates (external + inline, binding syntax) | ✅ | ✅ (rendered) |
| React (JSX), Vue (SFC), Svelte | ⏳ roadmap | ✅ (rendered DOM) |
| Any page in a browser | — | ✅ |

The taxonomy is framework-agnostic (two of the five grounding case studies — Video.js and Quill — are vanilla JS). The static CLI started Angular-first because that ecosystem hosts the grounding contributions; runtime mode covers everything else today.

## Roadmap

- Chrome DevTools panel (inspect-element integration; Safari lacks the devtools WebExtensions API, so Safari keeps the popup)
- Dependency-graph propagation: enumerate downstream consumers affected by a library-level finding ("npm audit for accessibility")
- Class IV control-flow analysis of TypeScript component sources (async validator registration vs. submit paths)
- React/JSX and Vue SFC template extraction for the static CLI
- SARIF output for CI annotation

## Author

Manichandra Sajjanapu — personal open-source project; not affiliated with or representing any employer. MIT licensed. Contributions welcome.
