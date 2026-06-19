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
