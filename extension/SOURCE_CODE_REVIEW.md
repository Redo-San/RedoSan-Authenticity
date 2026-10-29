# Source code review package

Add-ons that ship bundled or minified code must provide the source that
produces the published bundle. The Firefox build
(`.output/redosan-authenticity-inspector-0.1.0-firefox.zip`) is bundled by WXT
and Vite, so `npm run zip:firefox` also writes
`.output/redosan-authenticity-inspector-0.1.0-sources.zip`.

## What the sources zip contains

`zip.sourcesRoot` in `wxt.config.js` is the repository root, not `extension/`,
because two modules are shared with the site and live outside the extension
folder:

| Path                                | Why it is needed                                              |
| ----------------------------------- | ------------------------------------------------------------- |
| `extension/**`                      | Entrypoints, utilities, tests-free UI code and assets.        |
| `Fingerprint/hashing.js`            | The 21 digest implementations imported by `utils/hashes.js`.  |
| `Fingerprint/hashing_perceptual.js` | The four perceptual hashes imported by `utils/perceptual.js`. |
| `LICENSE`                           | GPL-2.0 text for the shared code.                             |

Excluded on purpose: `extension/node_modules`, `extension/.output`,
`extension/.wxt` and `extension/tests` (the tests are not needed to rebuild and
are covered by the repository). Everything else is unmodified source.

## Rebuild from the sources zip

Requires Node 22.14 or newer (the extension's `engines` field; CI uses Node 24)
and network access for `npm ci`.

```pwsh
# 1. Build the published artifacts from the extension folder.
cd extension
npx -y npm@11.20.0 run zip:firefox

# 2. Extract the sources archive somewhere outside the repository.
$dst = Join-Path $env:TEMP "redosan-sources-check"
Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive .output/redosan-authenticity-inspector-0.1.0-sources.zip $dst

# 3. Rebuild only from the extracted archive.
cd $dst/extension
npx -y npm@11.20.0 ci
npx -y npm@11.20.0 run zip:firefox

# 4. Both hashes must match.
(Get-FileHash .output/redosan-authenticity-inspector-0.1.0-firefox.zip).Hash
(Get-FileHash "<repository>/extension/.output/redosan-authenticity-inspector-0.1.0-firefox.zip").Hash
```

`npm ci` runs the `postinstall: wxt prepare` script, which regenerates the
`.wxt/` types; no other generated file is required. The archive is
self-contained: step 3 does not read anything from the original checkout.

## Verified result

Checked on 2026-10-29 with the archive produced by the commands above:

- `redosan-authenticity-inspector-0.1.0-firefox.zip` — 16 files, rebuilt hash
  identical to the published artifact:
  `1C36A83DD6EC7CD1D2A11FF91C34DCEF1C40A8CD1BBD7E1208C4C7578C94FC1F`.
- Per-file SHA-256 comparison of both archives: 0 differing files.
- The only build inputs are the archives above; no repository file outside the
  archive is read during the rebuild.

Re-run the check whenever a shared `Fingerprint/` file, a dependency, or the WXT
version changes; the hash changes with any source change, so compare the two
artifacts produced in the same session rather than the pinned value above.

## Chrome Web Store and Edge

Neither store requires a sources archive. The Chrome zip is
`.output/redosan-authenticity-inspector-0.1.0-chrome.zip`; Edge accepts the same
package through Partner Center. See `STORE_LISTING.md` for the listing copy and
permission justifications.
