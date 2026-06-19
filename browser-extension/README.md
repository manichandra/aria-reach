# aria-reach browser extension

Runtime companion to the `aria-reach` CLI: scans the **live DOM** of any page
(any framework — React, Vue, Angular, vanilla) for runtime-detectable ARIA
anti-patterns in Classes I–III. When an affected element or ancestor contains
a recognized DOM fingerprint, the extension labels its **likely upstream
component library** (PrimeNG, Angular Material, Quill, Video.js, USWDS, MUI,
Ant Design, …). Attribution is heuristic and requires confirmation.

The Angular-specific Class IV rule is available only in the static CLI because
Angular event bindings are compiled away in the live DOM.

## Build

From the repository root:

```bash
npm run build:ext      # bundles src/browser.ts → browser-extension/aria-reach.browser.js
```

## Install in Chrome / Edge / Brave (unpacked, no store needed)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this `browser-extension/` folder
4. Open any page → click the aria-reach toolbar icon → **Scan this page**

## Install in Safari

Safari uses the same WebExtensions code but requires a thin native wrapper,
generated with Xcode's converter (Xcode required):

```bash
xcrun safari-web-extension-converter browser-extension/ --project-location ./safari --app-name "aria-reach"
```

Then open the generated Xcode project, Run, and enable the extension in
Safari → Settings → Extensions (enable "Allow unsigned extensions" in the
Develop menu during local development). App Store distribution requires an
Apple Developer account.

Note: Safari does not support the `devtools_page` WebExtensions API, so the
extension uses a toolbar popup (works in both browsers). A Chrome-only
DevTools panel (inspect-element integration) is on the roadmap.

## No-install alternative (works today in any browser)

Copy the contents of `dist/aria-reach.browser.js` and paste into the DevTools
console of any page — it prints a grouped report and exposes
`window.ariaReach.scan()` / `.report()` / `.summary()`.

## Manual test checklist (popup)

The `window.ariaReach` runtime API is covered by `test/browser.test.js` (jsdom).
The popup's wiring depends on `chrome.tabs`/`chrome.scripting` and live event
timing, so verify it by hand after changing `popup.js` — load unpacked, scan a
page with several findings, then confirm:

1. **Hover** a finding row → element outlines + tooltip; **mouse out** → clears.
2. **Click** a finding → panel closes, the highlight + tooltip stay pinned, and
   the tooltip follows the element as you scroll.
3. **Dismiss** a pin via the tooltip **✕**, a click anywhere on the page, or a
   new scan.
4. **Reopen** the popup → results are restored without rescanning, and the
   pinned row is marked/scrolled into view. **Reload the page** then reopen →
   back to the clean prompt.
5. **Highlight all on page** → scrolling with the pointer over the list does
   **not** clear the highlights; clicking a row exits overlay and pins cleanly.
