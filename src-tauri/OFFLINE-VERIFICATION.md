# Desktop offline verification (Phase A, item A11)

Written record for plan item A11.2/A11.3. The desktop build must not open a
single remote origin, so this file captures what was observed, how to reproduce
it, and what still needs a sign-off before the release is published.

- **Build under test:** `2.0.1` (`desktop-v2.0.1`, built 2026-10-23)
- **Artifacts:** NSIS `RedoSan.Authenticity_2.0.1_x64-setup.exe` (50,496,917 bytes),
  MSI `RedoSan.Authenticity_2.0.1_x64_en-US.msi` (50,622,464 bytes)
- **Environment:** clean Windows VM with networking disabled after installation
- **Recording gap:** the exact Windows build number and VM image were not captured
  during the session; only the results below are recorded.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Installer runs with networking disabled | pass | NSIS install completed, app launched offline |
| All routes load offline | pass | 21/21 (SPA index + 20 MPA pages) |
| No remote origin contacted | pass | DevTools network log: zero external requests during a full session |
| Fingerprint parity with the CLI | pass | same file hashed in the app and with `node cli/index.js fingerprint`; SHA-256 identical |

## Covered by build gates (not manual)

- `scripts/tauri-prepare-assets.mjs` exits non-zero if any root-absolute
  `/RedoSan-Authenticity/` reference survives the rewrite (plan A11.1).
- `scripts/fetch-desktop-assets.mjs` verifies all 30 pinned assets by SHA-256 and
  size before the bundle is built; a missing or modified asset fails the build.
- `Style/shared.js` skips service-worker registration when
  `window.__TAURI_INTERNALS__` is present.

## Re-run before publishing a desktop release

1. `node scripts/fetch-desktop-assets.mjs --check` and
   `node scripts/tauri-prepare-assets.mjs` both exit 0.
2. Build with `npx tauri build`, then install on a clean Windows VM and disable
   networking **before** the first launch.
3. Walk every MPA page and confirm the DevTools network panel stays empty.
4. Confirm no service-worker registration is attempted and the domain-origin
   guard does not show its block screen under `tauri://`.
5. Run one watermark embed/extract roundtrip and one fingerprint comparison
   against `node cli/index.js fingerprint <file>`.
6. Record the Windows build number, VM image and date in this file.
