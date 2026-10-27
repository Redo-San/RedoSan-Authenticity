# RedoSan Authenticity Inspector

WXT scaffold for the browser extension (plan Phase B, item B0). The extension
is **inspection only** in v1: it reads an image and reports its cryptographic
and perceptual fingerprints plus a C2PA presence check. No network calls, no
embedding, and no host permissions.

## Commands

```bash
npx -y npm@11.20.0 install   # installs WXT and runs `wxt prepare`
npx -y npm@11.20.0 run dev   # Chrome dev build with hot reload
npx -y npm@11.20.0 run build # production build in .output/chrome-mv3
npx -y npm@11.20.0 test      # node:test suite in tests/ (no browser needed)
```

Firefox variants: `dev:firefox`, `build:firefox`, `zip:firefox`.

## Layout

| Path                     | Contents                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `entrypoints/`           | WXT entrypoints (`background`, `popup`); B2 adds the context menu, panel and options page. |
| `utils/hashes.js`        | 21 digests: SHA-1/256/384/512 via WebCrypto, the rest from `../Fingerprint/hashing.js`.    |
| `utils/perceptual.js`    | ahash/dhash/phash/whash from `../Fingerprint/hashing_perceptual.js`.                       |
| `utils/c2pa-presence.js` | Parse-only C2PA manifest-store detection (PNG `caBX`, JPEG APP11, WebP `C2PA`).            |
| `utils/inspect-image.js` | `inspectImage(file)` orchestration and the 32x32 decoder.                                  |
| `utils/format-report.js` | Text/JSON serialization.                                                                   |
| `tests/`                 | `node:test` suites; fixtures come from `../cli/tests/fixtures/`.                           |

Shared code is imported from the repository root, so `npm run dev` allows the
parent directory through `server.fs.allow` in `wxt.config.js`.

## Scope

| Item                                        | Status  |
| ------------------------------------------- | ------- |
| B0 scaffold (this tree)                     | done    |
| B1 inspection pipeline + unit tests         | done    |
| B2 context menu, popup, options, `_locales` | planned |
| B3 Firefox sources zip + store prep         | planned |
| B4 release workflow                         | planned |

See `.Plans/TAURI-WXT-DISTRIBUTION-PLAN.md` in the maintainer workspace for the
full plan; the plan file is not tracked in git.
