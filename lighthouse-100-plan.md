# Lighthouse Improvement Plan ? 100% Performance Target

**Updated:** 2026-08-03 (LHCI run 2026-08-03, 40 reports, 20 pages)
**Tooling:** `node .tools/lhr-summary.cjs` regenerates the baseline table + failed-audit + per-run CLS lists from `.lighthouseci/`.
**LHCI Config:** `lighthouserc.js` ? LH 12.6.1 ? mobile 412×823 dsf 1.75 ? simulate (RTT 150ms / 1.6Mbps / CPU×4) ? Headless Chrome 151
**Target:** Performance **100** ? Accessibility **100** ? Best Practices **100** ? SEO **100** ? CLS **0.00** (both runs) ? TBT **≤200ms** ? LCP **≤1.8s**

---

## Current State (LHCI 2026-08-03, best-of-2)

| Page | Perf | A11y | BP | SEO | TBT(ms) | LCP(ms) | CLS |
|------|------|------|----|-----|----------|----------|-----|
| `/` (root SPA) | 68 | 100 | 100 | 100 | 1350 | 1819 | 0.000 |
| /about/index.html | 71 | 100 | 100 | 100 | 1286 | 2711 | 0.000 |
| /audio-watermark/index.html | 74 | 100 | 100 | 100 | 1300 | 1593 | 0.000 |
| /c2pa/index.html | 71 | 100 | 100 | 100 | 1515 | 2020 | 0.000 |
| /certificate/index.html | 74 | 100 | 100 | 100 | 1378 | 2075 | 0.000 |
| /contact/index.html | 72 | 100 | 100 | 100 | 1238 | 2688 | 0.000 |
| /converter/index.html | 75 | 100 | 100 | 100 | 1257 | 1706 | 0.000 |
| /did/index.html | 65 | 100 | 100 | 100 | 1644 | 3259 | 0.000 |
| /document-watermark/index.html | 66 | 100 | 100 | 100 | 1421 | 3396 | 0.000 |
| /fingerprint/index.html | 74 | 100 | 100 | 100 | 1321 | 1702 | 0.000 |
| /forensic/index.html | 64 | 100 | 100 | 100 | 1596 | 3493 | 0.000 |
| /id_forge/index.html | 70 | 100 | 100 | 100 | 1302 | 2913 | 0.000 |
| /metadata/index.html | 70 | 100 | 100 | 100 | 1238 | 2972 | 0.000 |
| /pixel-injection/index.html | 67 | 100 | 100 | 100 | 1364 | 3228 | 0.000 |
| /privacy/index.html | 71 | 100 | 100 | 100 | 1346 | 2781 | 0.000 |
| /removal-tools/index.html | 70 | 100 | 100 | 100 | 1340 | 2913 | 0.000 |
| /search/index.html | 72 | 100 | 100 | 100 | 1273 | 2732 | 0.000 |
| /social/index.html | 72 | 100 | 100 | 100 | 1273 | 2698 | 0.000 |
| /timestamp/index.html | 71 | 100 | 100 | 100 | 1336 | 2780 | 0.000 |
| /watermark/index.html | 69 | 100 | 100 | 100 | 1279 | 3067 | 0.000 |

**Summary:** Best Perf = 75% (converter), Worst Perf = 64% (forensic). All A11y/BP/SEO = 100. CLS best-of-2 = 0.000 on all pages.

---

## Root-Cause Analysis (from 40 LHRs)

### Performance Gap: TBT is the #1 bottleneck (weight 30, score 0.16-0.18)
- **TBT 1238-1644ms** across all pages. The main thread is blocked by JavaScript execution.
- **63 of 69 requests are scripts**; ~1.75 MiB transfer on the SPA root.
- Vendor scripts dominate: `opentimestamps.min.js` (1.6 MB), `ffmpeg.min.js` (2.9 MB), `jspdf.umd.min.js` (525 KB), docx CDN (certificate).
- Under `simulate CPU×4`, real eval times are small but sequential evaluation of every vendor on every page inflates TBT.

### LCP Gap: LCP element is `div.help-card-body` text (weight 25, score 0.75-0.98)
- LCP values: 1593-3493ms. The LCP element is text rendered 70-87% after FCP because the main thread is busy.
- FCP 1244-1451ms (score 0.96-0.97) is good, but the gap between FCP and LCP is dominated by JS execution.

### CLS: Spiky runs (weight 25, score 0.11 on worst run)
- Best-of-2 CLS = 0.000 on all 20 pages (our pre-first-paint work holds).
- But 8 pages + root have exactly one bad run with CLS up to 0.585.
- Pattern = late i18n text swaps + late section activation racing the loaded main thread under mobile simulate.

### Cache & DOM: Not yet measured as weighted audits but show as 0-score
- `cache-insight`: 71-154 KiB savings (dev-server `no-store` blocks bf-cache locally).
- `dom-size-insight`: NaN (not applicable or not measured in simulate mode).

---

## Phased Implementation Plan

### Phase 0: Regression Blockers (already fixed in this session)

| # | Action | Status |
|---|--------|--------|
| 0.1 | C1: i18n.js always injected (not conditional on lang≠en) | ✅ Fixed |
| 0.2 | C2: Infinite MutationObserver loop in i18n.js | ✅ Fixed |
| 0.3 | C3: Mojibake language data on disk | ✅ Fixed |
| 0.4 | Repair tests broken by refactor | ✅ Fixed (62/62 cert tests pass) |

### Phase 1: Script Delivery — Kill TBT (Target: TBT ≤200ms, Perf +15-25 pts)

**Goal:** Reduce main-thread JS execution time by lazy-loading vendors and removing duplicates.

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 1.1 | Per-tool dependency manifest; inject vendors lazily on section activation (SPA) / tool page (MPA): opentimestamps→timestamp, pdf-lib/docx/jspdf→certificate/export, human.js→face-biometric, jszip→export paths, ffmpeg→converter | `index.html`, `Style/shared.js` or new `Style/loader.js`, 20 pages | M |
| 1.2 | Remove CDN duplicates (jspdf, jszip) — keep local `vendor/` only | All pages | S |
| 1.3 | `defer` remaining scripts; move inline `onclick` to listeners | All pages | S |
| 1.4 | Minify unminified JS (~30 KiB) via `scripts/` tooling; ship minified | `scripts/` | S |
| 1.5 | Per-feature E2E regression after lazy load | `cli/tests/e2e/*` | M |

**Checkpoint 1:** Run `node .tools/lhr-summary.cjs` — TBT should drop below 800ms on all pages, Perf should reach 85+ on all pages.

### Phase 2: CLS — Kill the Spiky Run (Target: CLS 0.000 in both runs)

**Goal:** Eliminate the single bad run per page caused by late i18n text swaps and late section activation.

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 2.1 | Finish Phase 0.2 — the i18n reentrancy guard reduces late text-swap churn; re-measure LHCI | `Style/i18n.js` | S |
| 2.2 | Reserve min-height for result containers + section activation on the 9 spiky pages (mobile viewport): `.help-card` growth, `#page-home` card activation (root 0.582) | `Style/style.css`, `Style/pages/*/css/*.css`, `Style/simplified.js` | M |
| 2.3 | `font-display: swap` everywhere (audit clean — keep) | `Style/style.css` | XS |
| 2.4 | Gate: `cumulative-layout-shift` = 0.000 in both runs — 20 pages | — | — |

**Checkpoint 2:** Run LHCI on all 20 pages; verify both runs have CLS = 0.000.

### Phase 3: LCP — Target ≤1.8s (Target: LCP score 1.0)

**Goal:** Reduce LCP from 1593-3493ms to ≤1800ms by eliminating render-blocking JS and inlining critical CSS.

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 3.1 | After Phase 1, re-measure (text LCP drops once parse no longer blocks) | — | XS |
| 3.2 | Inline critical above-the-fold CSS (~16 KiB); load rest async | 20 pages | M |
| 3.3 | `preconnect`/`dns-prefetch` for remaining CDNs or fully vendor | 20 pages | S |
| 3.4 | Remove `legacy-javascript` remnants; check `browserslist`/build targets | `package.json`, scripts | S |

**Checkpoint 3:** Run `node .tools/lhr-summary.cjs` — LCP should be ≤1800ms on all pages, Perf should reach 90+.

### Phase 4: Best Practices 100 (Clear errors-in-console)

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 4.1 | Drop `frame-ancestors` from the `<meta>` CSP (ignored by spec; GH Pages can't send headers) | 22 pages | XS |
| 4.2 | SW registration: relative path (`../../sw.js` for MPA, `sw.js` for SPA — same base logic as i18n) instead of hardcoded `/RedoSan-Authenticity/sw.js` | `Style/shared.js` (L651-666) | S |
| 4.3 | `dev-server.js`: serve `404.html` with real status **404**; stop 200+text/html for missing assets; add `Cache-Control: max-age` for static assets (unblocks bf-cache locally) | `dev-server.js` (L79-83, L108) | M |
| 4.4 | certificate `valid-source-maps`: remove stale `sourceMappingURL` (CDN docx) or ship maps | `Style/pages/certificate/index.html` | XS |
| 4.5 | Gate: `errors-in-console` empty — 20 pages | — | — |

**Checkpoint 4:** Run `npm run check` + LHCI on all 20 pages; BP should be 100 on all pages.

### Phase 5: SEO (Verify Only; Already 100)

Re-run `crawlable-anchors` — 20 pages — no action expected.

### Phase 6: Accessibility 100

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 6.1 | Extract failing contrast nodes from `.lighthouseci/lhr-*.json` (17 pages share the accent-text pattern) via `lhr-summary.cjs` | `.lighthouseci/` | S |
| 6.2 | Raise accent text (`.dz-text strong` etc.) to ≥4.5:1 (3:1 large); fix certificate `select-name` (label/aria-label on phone-code `<select>`) | `Style/style.css`, page css, `Style/pages/certificate/index.html` | M |
| 6.3 | Gate: `color-contrast` + `select-name` pass — 20 pages — A11y 100 | — | — |

### Phase 7: Infra & Hardening

| # | Action | Files | Est. Scope |
|---|--------|-------|------------|
| 7.1 | dev-server cache headers (bf-cache) — with 4.3 | `dev-server.js` | S |
| 7.2 | Reduce DOM size (2024 elements home) if still penalized after Phase 1 | `index.html`, `Style/simplified.js` | M |
| 7.3 | Tighten `lighthouserc.js`: performance minScore 0.9 (warn), others 0.95; `numberOfRuns: 3`; CLS assertion = median AND worst run | `lighthouserc.js` | S |
| 7.4 | LHCI in CI workflow (guard against regressions like C1/C2) | `.github/workflows/` | M |

---

## OpenCode Session Safety

To avoid hitting rate limits when using sub-agents, follow these rules:

### Rate-Limit Safety
1. **One sub-agent at a time** — never spin up parallel sub-agents for LHCI runs or audits.
2. **Throttle LHCI runs** — wait ≥30 seconds between consecutive LHCI collections to avoid overwhelming the dev server.
3. **Batch file reads** — use `filesystem_read_multiple_files` instead of individual reads when analyzing LHR JSONs.
4. **Limit sub-agent scope** — each sub-agent should handle exactly one phase, not multiple phases.
5. **Checkpoint before sub-agent dispatch** — verify the current phase is complete before starting the next.

### Incremental Execution
- Each phase is a self-contained unit of work with its own verification gate.
- Never skip a checkpoint — if a phase fails its gate, fix it before proceeding.
- Commit after each phase checkpoint (conventional commit format).

### Session Boundaries
- If an opencode session is interrupted, resume from the last completed checkpoint.
- The `lighthouse-100-plan.md` file is the source of truth for what's been done and what's next.
- Run `node .tools/lhr-summary.cjs` at the start of each session to get the current baseline.

---

## Verification Gate (after EVERY phase)

1. `node .tools/lhr-summary.cjs` — regenerate table + per-run CLS from `.lighthouseci/`.
2. Re-run LHCI on changed URLs: `npx lhci autorun --collect.url=<url>` (full suite at phase end).
3. `npm run check` + affected E2E (`npm run test:e2e-mpa`, `npm run test:e2e-all` for lazy-load regressions).
4. Update the baseline table above.

---

## Definition of Done

- All 20 pages: Perf = 100, A11y = 100, BP = 100, SEO = 100
- CLS = 0.000 (both runs), TBT ≤ 200ms, LCP ≤ 1.8s on every page
- `npm run check` green; core + E2E suites green (lazy-load regression checked)
- `lighthouserc.js` assertions tightened and passing in CI
- No console errors on any page (BP gate)
