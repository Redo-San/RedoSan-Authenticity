// Stryker configuration for RedoSan Authenticity
// Uses command runner since project tests use node:test (not mocha/jest).
// All paths are resolved relative to the working directory (repo root):
// https://stryker-mutator.io/docs/stryker-js/config-file/#glob-patterns
//
// Scope note: with coverageAnalysis "off" + command runner, EVERY mutant reruns the
// full test command, so cost = mutants x command time. The plan (Phase 2) says to
// calibrate `mutate` per tested module. Measured mutant counts per file:
//   document_watermark_core.js 979 | cbor.js 235 | audio_watermark_core.js 1778
//   c2pa.js 1814 | forensic_core.js 712 | timestamp.js ~1k | metadata.js ~1k
// Each sandboxed command run also costs a fixed ~18s of process overhead (Windows)
// on top of the tests, so this baseline gate bundles document_watermark_core.js +
// cbor.js (1214 mutants, ~1-3h) and stays clearly under the GitHub 6h job limit.
// Broaden `mutate` + command together as CI budget allows (add
// audio_watermark_core.js next: +1778 mutants).
// Baseline score recorded 2026-09-06 (fresh run): 47.03 total
//   (C2PA/cbor.js 76.17 | Document_Watermark/document_watermark_core.js 40.04).
// thresholds.break=40 ratchets regressions from that baseline until the score
// improves; raise it together with future scope expansions.
// @type {import('@stryker-mutator/api/core').StrykerOptions}
module.exports = {
  ignorePatterns: [
    "/.opencode",
    "/.agents",
    "/.claude",
    "/.Plans",
    "/.github",
    "/.env",
    "/.tools",
    "/agent",
    "/skills",
    "/vendor",
    "/reports",
    "/coverage",
    "/docs",
    "/certs",
    "/Style",
    "/backstop_data",
    "/.lh13",
    "/.lighthouseci",
    "/.playwright-mcp",
    "/test-results",
    "/tests",
    "cli/tests/fixtures",
  ],
  mutate: ["Document_Watermark/document_watermark_core.js", "C2PA/cbor.js"],
  testRunner: "command",
  commandRunner: {
    command:
      "node --test --test-timeout=120000 cli/tests/document_watermark_test.js cli/tests/c2pa_cbor_test.js",
  },
  reporters: ["progress", "clear-text", "html"],
  htmlReporter: {
    fileName: "reports/mutation/mutation-report.html",
  },
  coverageAnalysis: "off",
  concurrency: 2,
  timeoutMS: 120_000,
  timeoutFactor: 2,
  cleanTempDir: true,
  incremental: true,
  incrementalFile: ".stryker-tmp/incremental.json",
  thresholds: {
    high: 75,
    low: 65,
    break: 40,
  },
};
