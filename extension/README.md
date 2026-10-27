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
```

Firefox variants: `dev:firefox`, `build:firefox`, `zip:firefox`.

## Scope

| Item                                        | Status  |
| ------------------------------------------- | ------- |
| B0 scaffold (this tree)                     | done    |
| B1 inspection pipeline + unit tests         | planned |
| B2 context menu, popup, options, `_locales` | planned |
| B3 Firefox sources zip + store prep         | planned |
| B4 release workflow                         | planned |

See `.Plans/TAURI-WXT-DISTRIBUTION-PLAN.md` in the maintainer workspace for the
full plan; the plan file is not tracked in git.
