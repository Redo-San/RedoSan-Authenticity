# v1.7.1 — Face Biometric Hardening, i18n, SEO & Security

First patch since **v1.7 (2026-08-11)** — 60+ commits, 3,500+ tests across 58 unit + 40 E2E suites.

## Face Biometric

- **WebAuthn PRF vault** — passphrase lock replaced with FIDO2 WebAuthn PRF for key derivation (passkey-gated)
- **Session-scoped consent** — consent is per-session; no re-prompt within same tab
- **Help card** — expanded by default, readable on desktop, mobile-consent checkbox, RTL overflow fix
- **Anti-spoof + liveness** — passive liveness detection, ArcFace ONNX embedding, passkey prompt spam guard
- **Auto-register passkey** — apply user edits and auto-register on first use; unlock generation when passkeys cannot work
- **Full i18n** — all 125 `face.*` keys translated to Arabic; runtime `setStatus` calls wrapped with `__()` for translatability
- **100% coverage** — Face_Biometric module + E2E pipeline/UI specs; stabilised flaky camera tests on CI

## i18n

- **Keyless fallback** — Google Web Translate + MyMemory fallback for missing keys (no API key required)
- **Translation bot fix** — stop bot from regressing existing translations
- **Arabic quality** — 68 face-related mistranslations corrected; RTL overflow and help card sizing fixed

## SEO & Pages

- **Canonical + sitemap + robots** — MPA pages now have canonical URLs, followable links, and sitemap indexing
- **MPA style swap** — deferred print-media styles applied after AJAX content swap

## Security

- **CodeQL `js/xss-through-dom`** — `_irisEscHtml()` rewritten as regex-replacement pattern (same approach as `escHtml` in `Style/shared.js`)
- **SECURITY.md** — consolidated duplicate policies into a single root disclosure policy
- **Dependabot** — fast-uri 3.1.5→3.1.7 (4 high), qs 6.15.3→6.16.0 via override (2 moderate); `npm audit` → 0 vulnerabilities
- **Supply chain** — CodeQL action 4.37.5→4.37.6, gitleaks-action 2.3.9→3.0.0, acorn 8.17→8.18

## Responsive

- **Legacy browsers** — classic media-query syntax for pre-Chromium webviews
- **In-app webview** — skip Service Worker in embedded/in-app browsers to prevent cache stalls

## CI/CD

- **Conventional PR titles** — CI enforces `type(scope): message` before merge
- **Prettier** — runs on touched files before commit
- **ci.yml** — bumped all Actions SHAs; fixed todo scanner; adopted unicorn/eslint-config 72
- **E2E** — skip Puppeteer Chrome download on CI; increased axe-core timeout

## Bug Fixes

- MPA deferred print-media style injection on AJAX swap
- Face RTL overflow, passkey prompt spam, session-consent lifecycle
- codespell false positives (`fter`, `test`)
- Flaky `id_forge` sortable-by-time test (2ms→20ms delay)
- i18n key mismatches for face status messages
