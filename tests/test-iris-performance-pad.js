// ── Tests: APCER/BPCER PAD performance metrics (ISO/IEC 30107-3) ──
// Run: node --test tests/test-iris-performance-pad.js
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");

global.window = { location: { protocol: "file:", href: "file:///test" }, navigator: { userAgent: "node" } };
global.document = {};
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "..", "Iris_Biometric", "iris_performance.js"), "utf8"),
  { filename: "iris_performance.js" }
);
const P = global.window.IrisPerformance;

// labels: 0 = bona fide (live), 1 = attack. scores: higher = more live.
const labels = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
// Bona fide score 0.9, attacks score 0.2 → at threshold 0.5, all classified correctly.
const scores = [0.9, 0.9, 0.9, 0.9, 0.9, 0.2, 0.2, 0.2, 0.2, 0.2];

test("calculateAPCER: perfect separation => 0", () => {
  assert.strictEqual(P.calculateAPCER(labels, scores, 0.5), 0);
});
test("calculateBPCER: perfect separation => 0", () => {
  assert.strictEqual(P.calculateBPCER(labels, scores, 0.5), 0);
});
test("calculateAPCER: attacks accepted at a low threshold", () => {
  // threshold 0.1 → attacks (0.2) accepted as live
  assert.strictEqual(P.calculateAPCER(labels, scores, 0.1), 1);
});
test("calculateBPCER: bona fide rejected at a high threshold", () => {
  // threshold 0.95 → bona fide (0.9) rejected
  assert.strictEqual(P.calculateBPCER(labels, scores, 0.95), 1);
});
test("reportPADMetrics: returns DET + operating points", () => {
  const r = P.reportPADMetrics(labels, scores);
  assert.ok(Array.isArray(r.det) && r.det.length > 0, "DET curve missing");
  assert.strictEqual(r.apcerAtBpcer10, 0, "APCER@BPCER10 should be 0 for separable data");
  assert.ok(r.iapar >= 0 && r.iapar <= 1, "IAPAR out of range: " + r.iapar);
});
test("empty input is safe", () => {
  assert.strictEqual(P.calculateAPCER([], [], 0.5), 0);
  assert.strictEqual(P.calculateBPCER([], [], 0.5), 0);
  assert.deepStrictEqual(P.reportPADMetrics([], []), { apcerAtBpcer10: 0, apcerAtBpcer20: 0, bpcer: 0, iapar: 0, det: [] });
});
