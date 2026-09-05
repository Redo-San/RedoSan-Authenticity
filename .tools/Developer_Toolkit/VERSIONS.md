# Installed Toolkit Binaries

Pinned versions, sources, and verified checksums for the local binaries in this
folder. These binaries are gitignored (`*.exe` in `.gitignore` line 13) and are
installed on-disk only — mirroring the `cloc.exe` precedent.

| Binary         | Version        | Source                                                                                                  | Published checksum (sha256)                                        | Installed size |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------- |
| gitleaks.exe   | 8.30.1         | https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1 (`gitleaks_8.30.1_windows_x64.zip`)           | `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` | 21.5 MB        |
| rg.exe         | 15.2.0         | https://github.com/BurntSushi/ripgrep/releases/tag/15.2.0 (`ripgrep-15.2.0-x86_64-pc-windows-msvc.zip`) | `71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5` | 4.0 MB         |
| actionlint.exe | 1.7.12         | https://github.com/rhysd/actionlint/releases/tag/v1.7.12 (`actionlint_1.7.12_windows_amd64.zip`)        | `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9` | 6.1 MB         |
| fd.exe         | 10.5.0         | https://github.com/sharkdp/fd/releases/tag/v10.5.0 (`fd-v10.5.0-x86_64-pc-windows-msvc.zip`)            | `a227701b8551c35a9931d9f6da75503cf86d88e182d71fb849a70864c5d57cd7` | 3.9 MB         |
| cloc.exe       | (pre-existing) | (pre-existing)                                                                                          | (pre-existing)                                                     | 9.5 MB         |

## Verified 2026-09-05

- gitleaks checksum verified against `gitleaks_8.30.1_checksums.txt`.
- ripgrep checksum verified against the release `.sha256` sidecar (`CertUtil` format).
- actionlint checksum verified against `actionlint_1.7.12_checksums.txt`.
- fd checksum verified against the release asset digest (`sha256:…`) from the GitHub API.

## Usage notes (Windows / PowerShell)

- Standard CLI usage — `rg`, `fd`, `gitleaks`, `actionlint` follow their upstream
  docs; no extra PATH setup needed since the repo calls them by full path from this folder.
- `gitleaks`: the pre-commit hook (`scripts/secret-scan-precommit.ps1`) looks for
  gitleaks in PATH, `GITLEAKS_PATH`, and `%LOCALAPPDATA%\opencode\gitleaks\gitleaks.exe` —
  it does not yet probe this folder (see GIT-TOOLS-RESEARCH-PLAN.md, recommended integration).
- `fd`: remember positional order is `fd [pattern] [path]`. To list files by
  extension under a path, e.g. `fd.exe -e js . Style` (an explicit `.` pattern).
  A bare `fd -e js Style` treats `Style` as the search pattern, not the path.
- `actionlint` runs clean (exit 0) over all `.github/workflows/*` (verified 2026-09-05).
