# Distribution

The extension ships as GitHub Release assets. There is no store listing and no
store credential, by design: the two stores that matter for this build either
cost money or refuse the package unless it is signed and reviewed.

## Release assets

| Asset                                            | What it is                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `RedoSan-Inspector-Setup-<version>.exe`          | Windows installer: copies both builds, opens `chrome://extensions`, writes `INSTALL.txt`. |
| `redosan-authenticity-inspector-<v>-chrome.zip`  | MV3 build; unzip and load it in Chrome or Edge.                                           |
| `redosan-authenticity-inspector-<v>-firefox.zip` | MV2 build; rename to `.xpi` if you want Firefox to treat it as an add-on.                 |
| `redosan-authenticity-inspector-<v>-sources.zip` | Source archive for the AMO review or a reproducible rebuild.                              |
| `SHA256SUMS.txt`                                 | `sha256sum -c SHA256SUMS.txt` after downloading.                                          |

## Why there is no store listing

- **Chrome Web Store** requires a one-time registration fee. Without it, the
  only Windows path left is a local CRX, and Chrome blocked that in Chrome 33:
  "Windows and Mac installs must come from Chrome Web Store: As of Chrome 33, no
  external installs are allowed from a path to a local CRX file on Windows"
  ([Chrome docs](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)).
  The registry `update_url` route points at the Web Store, and the enterprise
  `ExtensionSettings` route only auto-installs off-store extensions on machines
  joined to an Active Directory domain
  ([Chrome Enterprise](https://support.google.com/chrome/a/answer/7532015)).
- **Firefox AMO** is free, but release and beta builds "will not allow unsigned
  extensions to be installed, with no override"
  ([MozillaWiki](https://wiki.mozilla.org/Add-ons/Extension_Signing)). The
  `xpinstall.signatures.required` policy that disables the check is
  **Firefox ESR only**, so it is not a general answer either.
- Edge Add-ons and Opera add-ons are free, but they add accounts, review cycles
  and listing maintenance for a ~90 KB inspector that makes no network calls.
  The Chrome build already loads in Edge.

## Install

### Chrome or Edge (unpacked)

1. Unzip `*-chrome.zip`, or use the folder the installer creates at
   `%LOCALAPPDATA%\RedoSan\AuthenticityInspector\chrome`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. **Load unpacked** and select the unzipped folder.
5. Pin the extension from the puzzle-piece menu.

Chrome keeps the extension across restarts. It may show a developer-mode notice;
dismiss it. Removing it is the usual **Remove** button on the same page.

### Firefox

Release Firefox cannot install an unsigned add-on permanently. Two options:

**A. Temporary (works in every build, lost on restart)**

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on** and select `manifest.json` inside the unzipped
   Firefox build (or the XPI).

**B. Permanent (free, no store listing)**

Sign the XPI through AMO's **unlisted** channel: create a free account, upload
the Firefox package (rename it to `.xpi`) and attach `*-sources.zip` as its
source archive. AMO returns a signed XPI that is not listed publicly. Then open
`about:addons` → gear icon → **Install Add-on From File** and select the signed
XPI. Unlisted signing costs nothing; it is the only way to get a permanent
install in release Firefox without paying anyone.

Firefox Developer Edition and Nightly can also set
`xpinstall.signatures.required=false` in `about:config`, which allows the
unsigned XPI to install permanently.

## Windows installer

`RedoSan-Inspector-Setup-<version>.exe` is built from
[`installer/installer.nsi`](installer/installer.nsi) and:

- installs per user under `%LOCALAPPDATA%\RedoSan\AuthenticityInspector`, with
  no elevation prompt and no registry policy;
- copies the Chrome/Edge build, the Firefox build, the XPI and `INSTALL.txt`;
- registers a normal uninstaller in **Apps & features**.

It deliberately does **not** write browser policies or force-install anything:
that is the managed-device path described above and it would make the extension
hard to remove. It also does not pass `--load-extension`: Google Chrome branded
builds ignore that switch (`--load-extension is not allowed in Google Chrome,
ignoring`), so the only working Chrome path is **Load unpacked**.

The installer is not code-signed, so SmartScreen may warn on first run. Verify
the download against `SHA256SUMS.txt` and use **More info → Run anyway**.

## Release process

`Actions → Extension Release → Run workflow`:

| Input     | Meaning                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `tag`     | Release tag; empty means `ext-v<version>` from `extension/package.json`                  |
| `publish` | `true` creates or updates the GitHub Release; `false` only builds and keeps the artifact |

The workflow runs the unit tests, builds both packages, verifies that every
archive has a root `manifest.json` and that the packaged manifests match the v1
scope, compiles the installer with NSIS, writes `SHA256SUMS.txt`, and publishes
from `main` only. It uses no repository secrets.

## Verification

```bash
sha256sum -c SHA256SUMS.txt
```

Every asset is rebuilt from the tagged commit by the workflow; the sources zip
reproduces the Firefox package byte-for-byte, so a reviewer can rebuild it with
the steps in [`SOURCE_CODE_REVIEW.md`](SOURCE_CODE_REVIEW.md).
