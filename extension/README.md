# RedoSan Authenticity Inspector

Browser extension (plan Phase B) that inspects an image **locally**: it reports
cryptographic and perceptual fingerprints plus a C2PA presence check. No
network calls, no embedding, no host permissions, and nothing runs on page
load — `activeTab` access is granted only when the user opens the popup or
picks "Inspect with RedoSan" from the image context menu.

## Usage

1. Build: `npx -y npm@11.20.0 run build` (or `run build:firefox`).
2. Load `.output/chrome-mv3` as an unpacked extension.
3. Right-click any image → **Inspect with RedoSan**; the panel opens in the
   page's shadow DOM and never leaves the tab.
4. Or open the toolbar popup, then drop, paste, or choose a file. A report can
   be copied as JSON.

The options page picks the UI language (English/Arabic) and which hashes are
computed; disabled hashes are skipped entirely, so a report can be as small as
"one digest + C2PA".

## Commands

```bash
npx -y npm@11.20.0 install       # installs WXT and runs `wxt prepare`
npx -y npm@11.20.0 run dev       # Chrome dev build with hot reload
npx -y npm@11.20.0 run build     # production build in .output/chrome-mv3
npx -y npm@11.20.0 run build:firefox
npx -y npm@11.20.0 test          # node:test suite in tests/ (no browser needed)
npx -y npm@11.20.0 run zip       # store zip (zip:firefox also builds sources)
```

## Layout

| Path                               | Contents                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `entrypoints/background.js`        | Context menu, `activeTab` injection, language-driven menu label.                        |
| `entrypoints/inspector.content.js` | Shadow-root panel, injected on demand; `matches: []` keeps it out of the manifest.      |
| `entrypoints/popup/`               | Drop/paste/choose flow, report rendering, copy-as-JSON.                                 |
| `entrypoints/options/`             | Language picker and the per-hash toggles, saved through `@wxt-dev/storage`.             |
| `public/_locales/{en,ar}/`         | Manifest strings and UI strings; WXT copies `public/` to the manifest root.             |
| `utils/hash-names.js`              | Canonical hash names shared by the UI, the options page and the tests.                  |
| `utils/hashes.js`                  | 21 digests: SHA-1/256/384/512 via WebCrypto, the rest from `../Fingerprint/hashing.js`. |
| `utils/perceptual.js`              | ahash/dhash/phash/whash from `../Fingerprint/hashing_perceptual.js`.                    |
| `utils/c2pa-presence.js`           | Parse-only C2PA manifest-store detection (PNG `caBX`, JPEG APP11, WebP `C2PA`).         |
| `utils/inspect-image.js`           | `inspectImage(file)` orchestration and the 32x32 decoder.                               |
| `utils/report-view.js`             | Report display model plus a DOM renderer used by both the popup and the panel.          |
| `utils/settings*.js`               | Pure settings logic and its storage-backed wrapper.                                     |
| `utils/messages.js`                | `translate()`/`directionFor()` over the bundled locale files.                           |
| `utils/url.js`, `protocol.js`      | Context-menu URL validation and the background/inspector message contract.              |
| `tests/`                           | `node:test` suites; fixtures come from `../cli/tests/fixtures/`.                        |

Shared code is imported from the repository root, so `npm run dev` allows the
parent directory through `server.fs.allow` in `wxt.config.js`.

## Notes

- The locale JSON is the single source of strings. `messages.js` imports both
  catalogs instead of calling `browser.i18n.getMessage`, because the options
  page must be able to show a language that differs from the browser UI.
- Chrome MV3 adds the `scripting` permission for the on-demand injection; the
  Firefox MV2 build uses `tabs.executeScript` and does not request it.
- The inspector bundle is injected with `scripting.executeScript` /
  `tabs.executeScript`, never through `content_scripts`, so the manifest keeps
  `host_permissions: []` and shows no install-time warning.

## Scope

| Item                                        | Status |
| ------------------------------------------- | ------ |
| B0 scaffold                                 | done   |
| B1 inspection pipeline + unit tests         | done   |
| B2 context menu, popup, options, `_locales` | done   |
| B3 Firefox sources zip + store prep         | next   |
| B4 release workflow                         | next   |

See `.Plans/TAURI-WXT-DISTRIBUTION-PLAN.md` in the maintainer workspace for the
full plan; the plan file is not tracked in git.
