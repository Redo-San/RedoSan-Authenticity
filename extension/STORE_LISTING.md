# Store listing reference

Reference copy for the browser extension. No store submission is planned; the
release assets described in [`DISTRIBUTION.md`](DISTRIBUTION.md) are the
supported distribution path. This file keeps the listing copy, the permission
justifications and the data-use answers ready in case a maintainer ever pays the
Chrome Web Store fee or opens a public AMO listing.

## Identity

| Field             | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Name              | RedoSan Authenticity Inspector                             |
| Version           | `0.1.0` from `extension/package.json` (independent semver) |
| Firefox add-on ID | `inspector@redo-san.github.io`                             |
| License           | GPL-2.0 (root `LICENSE`)                                   |
| Homepage          | <https://redo-san.github.io/RedoSan-Authenticity/>         |
| Support           | Repository issues                                          |
| Default locale    | `en`; completed locales: `en`, `ar`                        |
| Chrome category   | Developer Tools                                            |
| Firefox category  | Web Development                                            |

Bump `extension/package.json` before every submission; the version is baked into
the manifest and the artifact names. Chrome accepts up to four dot-separated
integers (each at most 65535); AMO also accepts that form.

## Listing copy

### Short description (Chrome, 132 characters maximum)

Local image fingerprints and C2PA presence: SHA digests, perceptual hashes and
container details. No accounts, no tracking.

That text is 123 characters as a single line.

### Detailed description

RedoSan Authenticity Inspector reports what can be measured about an image
without uploading it anywhere.

- Right-click an image and choose **Inspect with RedoSan**, or open the toolbar
  popup to drop, paste or choose a file.
- Cryptographic digests: SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA-3,
  SHAKE, MD2, MD4, MD5, BLAKE2b, BLAKE2s, BLAKE3, RIPEMD-160 and Whirlpool;
  choose which ones run in the options page.
- Perceptual hashes: ahash, dhash, phash and whash, for similarity comparison.
- C2PA presence: detects the manifest container in PNG (`caBX`), JPEG (`APP11`)
  and WebP (`C2PA`) files and reports its offset and length. This is a presence
  check only; the extension does not verify signatures or certificates and does
  not claim that a file is authentic.
- Copy the report as JSON for a bug report or a diff.

Everything runs in the browser. The extension does not contact RedoSan or any
analytics service, has no account system, and has no host permissions.

### Single purpose (Chrome requirement)

Inspect an image's fingerprints and C2PA container locally, from the page or
from a file the user selects.

## Permission justifications

| Permission       | Target          | Justification                                                                                                                            |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `contextMenus`   | Chrome, Firefox | Adds one item, "Inspect with RedoSan", to the image context menu.                                                                        |
| `activeTab`      | Chrome, Firefox | Temporary access to the tab where the user invoked the menu or opened the popup; required to inject and message the panel.               |
| `storage`        | Chrome, Firefox | Stores the chosen language and the enabled-hash list locally. No sync storage, no remote copy.                                           |
| `scripting`      | Chrome MV3      | Injects the inspector bundle into the already-active tab after the click. Firefox MV2 uses `tabs.executeScript` and does not request it. |
| Host permissions | none            | The manifest has an empty `host_permissions` array; nothing runs on page load.                                                           |

There is no `web_accessible_resources` entry: the injected bundle is not
exposed to pages and cannot be loaded by a site.

## Data-use answers

Chrome Web Store privacy practices:

- Does not collect or use personal data.
- Does not sell or transfer data to third parties.
- Does not use or transfer data for purposes unrelated to the single purpose.
- Does not determine creditworthiness or for lending purposes.
- No remote code: every script is inside the package.
- No authentication, no accounts, no telemetry.

Firefox AMO data collection: **none**. The add-on does not collect or transmit
any data.

Wording nuance for reviewers: the context-menu path reads the bytes of the image
the user clicked from the address the page already loaded, so that request goes
to the page's own server. The extension never contacts a RedoSan server, and the
popup path (drop, paste, choose a file) performs no network request at all.

## Assets

| Asset                   | Status   | Notes                                                           |
| ----------------------- | -------- | --------------------------------------------------------------- |
| Icons 16/32/48/128      | present  | `extension/public/icon-*.png`                                   |
| Chrome screenshots      | needed   | 1280x800 or 640x480, at least one; use repository test fixtures |
| Chrome small promo tile | optional | 440x280                                                         |
| Firefox screenshots     | needed   | At least one; same images can be reused                         |

Screenshots must not contain third-party copyrighted images, personal data, or
claims that a file is authentic. Show the panel, the popup and the options page.

## Store status

No store submission is planned. The extension is distributed as GitHub Release
assets instead: the Chrome Web Store charges a one-time registration fee, Chrome
blocks off-store installs on Windows, and Firefox release builds reject unsigned
add-ons. [`DISTRIBUTION.md`](DISTRIBUTION.md) documents the install paths and
the Windows installer.

This file stays as reference material. If a maintainer ever pays the Chrome fee
or wants a public AMO listing, the copy, permission justifications and data-use
answers above are the text to paste. The previous automation
(`.github/workflows/wxt-release.yml` plus six repository secrets) was removed
because it could not publish anything without that payment.
