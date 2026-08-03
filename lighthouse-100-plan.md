# Lighthouse Improvement Plan — 100% Target

**Baseline:** LHCI run 2026-08-01 (user run) · 40 reports (20 pages × 2 runs + 2× root) · `lighthouserc.js` · LH **12.6.1** · mobile 412×823 dsf 1.75 · simulate (RTT 150 ms / 1.6 Mbps / CPU ×4) · Headless Chrome 151
**Target:** Performance **95-100** · Accessibility **100** · Best Practices **100** · SEO **100** · CLS **0.00** (both runs) · TBT **≤ 200 ms** · LCP **≤ 1.8 s**
**Tooling:** `node .tools/lhr-summary.cjs` regenerates the baseline table + failed-audit + per-run CLS lists from `.lighthouseci/`.

## Progress since first baseline (2026-07-31)

Shipped and verified:
- Drop-zones now build **before first paint** (inline builder in 22 HTML files + `attachDropZoneEvents` extraction in `Style/shared.js` + `defer` on shared.js). Verified `dz=3` at first probe in 5/5 runs.
- Language data + i18n.js injected **synchronously via `document.write`** in `<head>` (22 files) → desktop CLS timestamp ≈ 0.017 avg (0.000–0.026), watermark ≈ 0.011.
- **CLS best-of-2 = 0.000 on all 20 pages** (was 0.31–0.59 on 9 pages).
- **SEO = 100 everywhere** (crawlable-anchors resolved).
- Accessibility 91–100, BP 96 everywhere.

## Baseline Summary (best of 2 runs per page)

| Page | Perf | A11y | BP | SEO | TBT (ms) | LCP (ms) | CLS |
|------|------|------|----|-----|----------|----------|-----|
| `/` (root SPA) | 67 | 100 | 96 | 100 | 1406 | 3195 | 0.000 |
| watermark | 74 | 96 | 96 | 100 | 1503 | 1603 | 0.000 |
| audio-watermark | 65 | 96 | 96 | 100 | 1749 | 1608 | 0.000 |
| fingerprint | 67 | 95 | 96 | 100 | 1410 | 1769 | 0.000 |
| search | 72 | 100 | 96 | 100 | 1407 | 2577 | 0.000 |
| pixel-injection | 74 | 96 | 96 | 100 | 1465 | 1740 | 0.000 |
| metadata | 66 | 95 | 96 | 100 | 1707 | 3175 | 0.000 |
| timestamp | 69 | 95 | 96 | 100 | 1517 | 2858 | 0.000 |
| did | 73 | 96 | 96 | 100 | 1621 | 1592 | 0.000 |
| c2pa | 69 | 95 | 96 | 100 | 1347 | 2911 | 0.000 |
| certificate | 71 | **91** | 96 | 100 | 2211 | 1886 | 0.000 |
| forensic | 67 | 95 | 96 | 100 | 1713 | 3056 | 0.000 |
| converter | 67 | 95 | 96 | 100 | 1672 | 1664 | 0.000 |
| removal-tools | 70 | 95 | 96 | 100 | 1431 | 2804 | 0.000 |
| id_forge | 67 | 100 | 96 | 100 | 1720 | 3114 | 0.000 |
| document-watermark | 70 | 96 | 96 | 100 | 1610 | 2615 | 0.000 |
| about | 70 | 96 | 96 | 100 | 1461 | 2711 | 0.000 |
| privacy | 71 | 96 | 96 | 100 | 1420 | 2769 | 0.000 |
| contact | 72 | 95 | 96 | 100 | 1376 | 2573 | 0.000 |
| social | 71 | 95 | 96 | 100 | 1489 | 2679 | 0.000 |

## Root-Cause Analysis (confirmed from the 40 LHRs)

### Performance (65-74) — TBT + LCP, both JS-driven
- **TBT 1347-2255 ms is the whole Perf gap** (bootup-time dominated). Attribution is misleading under `simulate` CPU×4: real eval times are small (docx 166 ms, jspdf 134 ms) but sequential evaluation of every vendor on every page inflates TBT. 63 of 69 requests are scripts; ~1.75 MiB transfer on the SPA root. Raw vendor sizes: `opentimestamps.min.js` **1.6 MB** (266 KiB gz, timestamp only), `jspdf.umd.min.js` **525 KB** + cdnjs jspdf **duplicate**, `ffmpeg.min.js` **2.9 MB** (converter), docx CDN (certificate), jszip ×2 **duplicates**.
- **LCP element is `div.help-card-body` (text) on every page**, render-delay = 70-87 % of LCP time (main-thread busy between FCP and LCP). FCP 1068-1768 ms, SI 1954-2704 ms.
- `unused-javascript` (772 KiB home) + `render-blocking-resources` common failures; `bf-cache` blocked on all pages (dev-server `no-store`).

### CLS — best-of-2 clean, but one spiky run per page
- Best-of-2 CLS = **0.000 × 20 pages** (our pre-first-paint work holds).
- **But 8 pages + root have exactly one bad run**: `/` 0.582, audio-watermark 0.328, contact 0.258, converter 0.290, fingerprint 0.291, forensic 0.291, id_forge 0.290, privacy 0.290, search 0.143. Pattern = single spiky run under LHCI load, other run 0.000 → **late i18n text swaps + late section activation racing the loaded main thread** (mobile simulate), not static layout bugs. Locally (desktop, real traces) no LayoutShift events occur.
- Root `/` 0.582 is the worst — SPA section activation (`#page-home` cards) late under load.

### Best Practices (96) — errors-in-console on all 20 pages, 3 distinct causes
1. `ReferenceError: i18n is not defined` at `shared.js:169` (`__()`) — fired on **certificate, pixel-injection, id_forge** when page scripts call `__()` before i18n.js exists. Root cause = **regression C1** (below).
2. `The script has an unsupported MIME type ('text/html')` — `Style/shared.js:656` registers the SW with the hardcoded GitHub Pages path `/RedoSan-Authenticity/sw.js?v=2`; on localhost that URL misses and `dev-server.js` (L79-83) serves `404.html` with **HTTP 200 + text/html** (also why no HTTP≥400 appears in network).
3. CSP directive `frame-ancestors` ignored via `<meta>` (spec) — cosmetic but flagged; `valid-source-maps` fails on certificate (stale `sourceMappingURL` to a missing map, likely from CDN vendor).
- BP category score renders 96 everywhere (only `errors-in-console` fails among weighted audits).

### Accessibility (91-100) — contrast + one select
- `color-contrast` fails on **17/20 pages** (all but `/`, search, id_forge) — the same accent-text pattern (`.dz-text strong` and similar) below 4.5:1.
- certificate only: `select-name` (phone-code `<select>` without accessible name) → A11y 91.

### SEO (100) — done
- crawlable-anchors resolved everywhere; no further action beyond keeping it green.

## Workflow & Verification Gate

### Required Skills per Task
| Skill | When to Use |
|-------|------------|
| `performance-optimization` / `core-web-vitals` | Phases 1-3 (JS delivery, CLS, LCP) |
| `frontend-ui-engineering` | Lazy-load architecture changes in SPA shell |
| `incremental-implementation` | Each phase → commit; verify before next phase |
| `test-driven-development` | Loader/script-injection logic + repaired tests |
| `playwright-best-practices` | Regression E2E after loading changes |
| `accessibility` | Phase 6 (contrast per page) |

### Verification Gate (after EVERY phase)
1. `node .tools/lhr-summary.cjs` — regenerate table + per-run CLS from `.lighthouseci/`.
2. Re-run LHCI on changed URLs: `npx lhci autorun --collect.url=<url>` (full suite at phase end).
3. `npm run check` + affected E2E (`npm run test:e2e-mpa`, `npm run test:e2e-all` for lazy-load regressions).
4. Update the baseline table above.

---

## Phase 0 — Fix Regression Blockers (code-review verdict: REQUEST CHANGES — do before anything else)

| # | Action | Files | Status |
|---|--------|-------|--------|
| 0.1 | **C1 — en loses i18n.js entirely**: head script injects i18n.js only when `lang !== 'en'` → `__()`/`switchLang`/`toggleLangDropdown` undefined for default-language users (`shared.js:232` downloadBlob, `search.js:180`, `simplified.js` ~50 calls; "i18n is not defined" in 3 LHRs). Fix: **always** `document.write(i18n.js)`; keep `i18n-data-{lang}.js` conditional; for `en` seed `window.__I18N_DATA.en = {}` (no fetch → no console noise, English is the HTML default) | 22 pages head script | — |
| 0.2 | **C2 — infinite MutationObserver→applyLang loop** (`i18n.js` L381-406): applyLang's own `textContent`/`innerHTML` swaps re-trigger the observer (~53 applies/s on ar, rAF-paced). Fix: reentrancy guard held through applyLang + its mutation microtasks (`Promise.resolve().then` release) | `Style/i18n.js` | — |
| 0.3 | **C3 — mojibake language data on disk** (verified byte-for-byte): `i18n.js` L88 + L113-119 show CP1256-misread strings (`╪د┘█╪╣╪▒╪ذ┘è╪ر`, `Fran├دais`, ...). Replace with proper UTF-8 (`العربية`, `Français`, `Español`, `中文`, `日本語`, `한국어`); audit `lang/i18n-data-*.js` values for the same pattern; regenerate `lang/*.json` reverse of `scripts/sync-i18n-json-to-js.js` | `Style/i18n.js`, `Style/lang/*` | — |
| 0.4 | **Repair tests broken by refactor**: 8 `initDropZones` tests (`cli/tests/shared_utils_test.js` L696/993/1183/1348) now call the removed builder path; 1 caching test in `i18n_test.js` breaks on the new `__I18N_DATA` cache. Add coverage: `attachDropZoneEvents`, `__I18N_EARLY` path, head-script injection | `cli/tests/*` | — |

## Phase 1 — Script Delivery (biggest lever: TBT ≤ 200 ms, JS transfer ≤ 350 KiB)
| # | Action | Files |
|---|--------|-------|
| 1.1 | Per-tool dependency manifest; inject vendors **lazily** on section activation (SPA) / tool page (MPA): opentimestamps → timestamp, pdf-lib/docx/jspdf → certificate/export, human.js → face-biometric, jszip → export paths, ffmpeg → converter | `index.html`, `Style/shared.js` or new `Style/loader.js`, pages |
| 1.2 | Remove CDN duplicates (jspdf, jszip) — keep local `vendor/` only | all pages |
| 1.3 | `defer` remaining scripts; move inline `onclick` to listeners | all pages |
| 1.4 | Minify unminified JS (~30 KiB) via `scripts/` tooling; ship minified | `scripts/` |
| 1.5 | Per-feature E2E regression after lazy load | `cli/tests/e2e/*` |

## Phase 2 — CLS: kill the spiky run (both runs must be 0.00)
| # | Action | Files |
|---|--------|-------|
| 2.1 | Finish 0.2 — the i18n loop is the top suspect for the late text-swap churn on the bad runs; re-measure LHCI ×2 | `Style/i18n.js` |
| 2.2 | Reserve min-height for result containers + section activation on the 9 spiky pages (mobile viewport): `.help-card` growth, `#page-home` card activation (root 0.582) | `Style/style.css`, `Style/pages/*/css/*.css`, `Style/simplified.js` |
| 2.3 | `font-display: swap` everywhere (audit clean — keep) | — |
| 2.4 | Gate: `cumulative-layout-shift` = 0.000 **in both runs** × 20 pages | — |

## Phase 3 — LCP ≤ 1.8 s (element: `div.help-card-body` text, render-delay 70-87 %)
| # | Action | Files |
|---|--------|-------|
| 3.1 | After Phase 1, re-measure (text LCP drops once parse no longer blocks) | — |
| 3.2 | Inline critical above-the-fold CSS (~16 KiB); load rest async | pages |
| 3.3 | `preconnect`/`dns-prefetch` for remaining CDNs or fully vendor | pages |
| 3.4 | Remove `legacy-javascript` remnants; check `browserslist`/build targets | `package.json`, scripts |

## Phase 4 — Best Practices 100 (clear errors-in-console)
| # | Action | Files |
|---|--------|-------|
| 4.1 | Drop `frame-ancestors` from the `<meta>` CSP (ignored by spec; GH Pages can't send headers) | 22 pages |
| 4.2 | SW registration: relative path (`../../sw.js` for MPA, `sw.js` for SPA — same base logic as i18n) instead of hardcoded `/RedoSan-Authenticity/sw.js` | `Style/shared.js` (L651-666) |
| 4.3 | `dev-server.js`: serve `404.html` with real status **404**; stop 200+text/html for missing assets; add `Cache-Control: max-age` for static assets (unblocks bf-cache locally) | `dev-server.js` (L79-83, L108) |
| 4.4 | certificate `valid-source-maps`: remove stale `sourceMappingURL` (CDN docx) or ship maps | `Style/pages/certificate/index.html` |
| 4.5 | Gate: `errors-in-console` empty × 20 pages | — |

## Phase 5 — SEO (verify only; already 100)
Re-run `crawlable-anchors` × 20 pages — no action expected.

## Phase 6 — Accessibility 100
| # | Action | Files |
|---|--------|-------|
| 6.1 | Extract failing contrast nodes from `.lighthouseci/lhr-*.json` (17 pages share the accent-text pattern) via `lhr-summary.cjs` | `.lighthouseci/` |
| 6.2 | Raise accent text (`.dz-text strong` etc.) to ≥ 4.5:1 (3:1 large); fix certificate `select-name` (label/aria-label on phone-code `<select>`) | `Style/style.css`, page css, `Style/pages/certificate/index.html` |
| 6.3 | Gate: `color-contrast` + `select-name` pass × 20 pages → A11y 100 | — |

## Phase 7 — Infra & Hardening
| # | Action | Files |
|---|--------|-------|
| 7.1 | dev-server cache headers (bf-cache) — with 4.3 | `dev-server.js` |
| 7.2 | Reduce DOM size (2024 elements home) if still penalized after 1.1 | `index.html`, `Style/simplified.js` |
| 7.3 | Tighten `lighthouserc.js`: performance minScore 0.9 (warn), others 0.95; `numberOfRuns: 3`; CLS assertion = median AND worst run | `lighthouserc.js` |
| 7.4 | LHCI in CI workflow (guard against regressions like C1/C2) | `.github/workflows/` |

---

## Definition of Done
- All 20 pages: Perf ≥ 95 · A11y 100 · BP 100 · SEO 100
- CLS 0.000 (both runs), TBT ≤ 200 ms, LCP ≤ 1.8 s on every page
- `npm run check` green; core + E2E suites green (lazy-load regression checked)
- `lighthouserc.js` assertions tightened and passing in CI
- No console errors on any page (BP gate)
