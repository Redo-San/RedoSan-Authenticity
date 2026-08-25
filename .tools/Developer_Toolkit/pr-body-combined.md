# Combined: dependency bumps + CI fixes + face-biometric Lighthouse perf

Closes #392, closes #393, closes #394
Supersedes and closes #395, closes #396, closes #397, closes #398, closes #399

## Why one PR instead of five merges

All five dependabot PRs are mechanical version bumps with long CI matrices.
Applying them locally into a single branch lets every check run once against
the final tree, then all six PRs close together on merge.

## Contents (6 commits)

### perf(face): 93-96% Lighthouse on the MPA face-biometric page

- 15 face module scripts now load post-paint via a sequential idle loader
  (`async=false` preserves execution order); the loader invokes
  `initFaceBiometric()` when done. mpa-router/music-player also inject
  after first paint.
- Root cause of the stubborn 0.33 CLS found via trace: an empty English
  i18n cache made `loadLang()` fetch `lang/en.json` and rewrite texts
  after first paint, shifting `.help-card`. Fixed by seeding a non-empty
  cache entry; deferred CSS uses the media=print pattern.
- Mobile results: LCP 4.9s -> 1.5s, CLS 0.41 -> 0, TBT -40%,
  Performance 52% -> 93-96%.

### chore(deps) + chore(ci): the five dependabot bumps

| Package/action | From | To | Refs |
|---|---|---|---|
| eslint-plugin-unicorn | 69.0.0 | 72.0.0 | #396 |
| @commitlint/cli | 20.5.3 | 21.2.2 | #398 |
| @commitlint/config-conventional | 21.0.1 | 21.2.2 | #399 |
| actions/checkout | v6.1.0 | v7.0.1 (SHA-pinned, 52 sites) | #395 |
| step-security/harden-runner | v2.20.0 | v2.21.0 (SHA-pinned, 18 sites) | #397 |

`config-conventional` moves from dependencies to devDependencies where it
belongs; npm resolved commitlint to 21.2.2 (>= both PR targets).

### fix(ci): TODO scanner no longer flags NOTE comments

Issues #392/#393/#394 are documented design notes (fuzzy-ECC security
limits, deliberate E2E coverage omission, fake-camera staging), not work
items. Dropped NOTE from the scanner pattern so they stop regenerating.

### chore(lint): unicorn 72 adopted at zero errors

- 28 condition reorderings applied after side-effect audit (probe calls
  and `fs.existsSync` stay rightmost); SW registration split to
  `.then().catch()`.
- `.env/**` added to ESLint ignores (secrets must never be linted).
- Two new rules disabled with written justification (IIFE module
  convention; getHTML/Sanitizer support).
- Result: 85 errors -> 0. Remaining 5,173 warnings are triaged in a
  phased ratchet plan (per-phase `--max-warnings` gates; local working
  notes, same treatment as the coverage/lighthouse plans).

## Verification

- `npm run test:core`: 1081 passed / 0 failed
- `npm run lint`: 0 errors (was 85)
- No old action SHAs remain; commitlint hooks pass on every commit
