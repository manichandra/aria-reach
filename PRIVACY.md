# Privacy Policy for aria-reach

**Effective date:** June 18, 2026

aria-reach is a browser extension that scans the Document Object Model (DOM) of the active browser tab for ARIA accessibility anti-patterns. This policy explains how the extension handles information.

## Information handling

aria-reach does **not** collect, store, transmit, sell, or share personal information, sensitive information, browsing history, website content, or usage data.

When the user clicks **Scan this page**, the extension temporarily reads the DOM of the active tab to identify ARIA anti-patterns and display the results in the extension popup. All analysis occurs locally in the user's browser. The analyzed page content and scan results are not sent to the developer or any third party.

## Data storage and retention

aria-reach does not use local storage, synchronized storage, cookies, analytics, telemetry, advertising, or tracking. It does not retain page content or scan results after the extension popup and page session end.

## Network access and third parties

The extension makes no external network requests and does not use third-party services to process page content. All executable code is included in the extension package; no remotely hosted code is used.

## Permissions

aria-reach requests only these Chrome permissions:

- **activeTab** — permits access to the current tab only after the user invokes the extension.
- **scripting** — permits the packaged scanner to run in that tab and analyze its rendered DOM.

These permissions are used solely to provide the user-requested accessibility scan.

## Children's privacy

Because aria-reach does not collect or transmit user data, it does not knowingly collect personal information from children.

## Changes to this policy

Material changes to this policy will be published in this repository with an updated effective date.

## Contact

Questions about this policy may be submitted through the project's public issue tracker:

https://github.com/manichandra/aria-reach/issues
