// ── Tests: textured contact-lens / periodic-pattern PAD (Gap 1) ──
// Run: node --test tests/test-iris-contact-lens.js
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");

const src = fs.readFileSync(
  path.join(__dirname, "..", "Iris_Biometric", "iris_liveness.js"),
  "utf8",
);
vm.runInThisContext(src, { filename: "iris_liveness.js" });
const IrisLiveness = global.IrisLiveness || global.window.IrisLiveness;

const W = 100, H = 100;
const iris = { cx: 50, cy: 50, radius: 30 };

/**
 *
 */
function noiseImg() {
  const g = new Float64Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = (Math.random() * 256) | 0;
  return g;
}

// Regular vertical stripes (period 5px) => periodic/printed pattern.
/**
 *
 */
function stripedImg() {
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      g[y * W + x] = x % 5 < 3 ? 40 : 220;
    }
  }
  return g;
}

test("periodicPatternTest: random texture is bona fide", () => {
  const r = IrisLiveness.periodicPatternTest(noiseImg(), W, H, iris);
  assert.strictEqual(r.attack, false, "stochastic texture must not be flagged: " + r.detail);
});

test("periodicPatternTest: striped pattern is flagged as attack", () => {
  const r = IrisLiveness.periodicPatternTest(stripedImg(), W, H, iris);
  assert.strictEqual(r.attack, true, "regular stripes must be flagged: " + r.detail);
  assert.ok(r.peakRatio > 0.22, "peakRatio should exceed threshold: " + r.peakRatio);
});

test("periodicPatternTest: missing iris is skipped (not an attack)", () => {
  const r = IrisLiveness.periodicPatternTest(noiseImg(), W, H, null);
  assert.strictEqual(r.attack, false);
  assert.strictEqual(r.score, 1);
});
