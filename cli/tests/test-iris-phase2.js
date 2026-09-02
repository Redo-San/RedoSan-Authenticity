// Phase 2 tests: margin gate, illumination detection, dual-eye persistence, FTA/FTER stats.
// Run with: node --test cli/tests/test-iris-phase2.js
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createCanvas, ImageData } = require("canvas");
const assert = require("node:assert");

globalThis.document = {
  createElement: (t) => (t === "canvas" ? createCanvas(1, 1) : null),
  getElementById: () => null,
  body: null,
};
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test" };
globalThis.ImageData = ImageData;
globalThis.__irisStatsMem = {};

/**
 *
 * @param rel
 */
function loadRel(rel) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.join(__dirname, rel) });
}
loadRel("../../Iris_Biometric/iris_quality_full.js");
loadRel("../../Iris_Biometric/iris_storage.js");
loadRel("../../Iris_Biometric/iris_ui.js");

const IrisQualityFull = globalThis.IrisQualityFull;
const IrisStorage = globalThis.IrisStorage;

/**
 *
 */
async function main() {
/**
 *
 * @param w
 * @param h
 * @param val
 */
function gray(w, h, val) {
  const d = new Uint8Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = val;
  return d;
}
/**
 *
 * @param w
 * @param h
 * @param c
 */
function rgba(w, h, c) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
  }
  return d;
}

// ── 1. Margin adequacy acquisition gate ──
const W = 100, H = 100;
const mask = new Uint8Array(W * H).fill(1);
const edge = {
  imageData: gray(W, H, 128), width: W, height: H, roi: null,
  pupil: { x: 20, y: 20, radius: 10 }, iris: { x: 20, y: 20, radius: 30 }, mask,
};
const gEdge = IrisQualityFull.evaluateAcquisitionGates(edge);
assert.ok(!gEdge.passed, "edge iris should not pass gates");
assert.ok(
  gEdge.failures.some((f) => f.startsWith("marginAdequacy")),
  "edge iris must fail marginAdequacy: " + gEdge.failures.join("; ")
);

const center = {
  imageData: gray(W, H, 128), width: W, height: H, roi: null,
  pupil: { x: 50, y: 50, radius: 12 }, iris: { x: 50, y: 50, radius: 30 }, mask,
};
const gCenter = IrisQualityFull.evaluateAcquisitionGates(center);
assert.ok(
  !gCenter.failures.some((f) => f.startsWith("marginAdequacy")),
  "centered iris must not fail marginAdequacy: " + gCenter.failures.join("; ")
);
assert.ok("marginAdequacy" in gCenter.metrics, "metrics must include marginAdequacy");
assert.strictEqual(gCenter.metrics.marginAdequacy, 100, "centered margin score = 100");

// ── 2. Illumination detection ──
const mono = IrisQualityFull.detectIllumination(rgba(10, 10, [120, 120, 120]), 10, 10);
assert.strictEqual(mono.modality, "monochrome", "equal channels => monochrome");
assert.strictEqual(mono.colorCapture, false);
const color = IrisQualityFull.detectIllumination(rgba(10, 10, [200, 40, 10]), 10, 10);
assert.strictEqual(color.modality, "color", "differing channels => color");
assert.strictEqual(color.colorCapture, true);
const empty = IrisQualityFull.detectIllumination(null, 0, 0);
assert.strictEqual(empty.modality, "unknown");

// ── 3. Dual-eye persistence through _rehydrate (plaintext path) ──
const store = new IrisStorage();
const rL = await store._rehydrate({ id: "t1", label: "L", eyeSide: "left", leftCode: [1, 2, 3], leftMask: [1, 1, 1] });
assert.strictEqual(rL.eyeSide, "left");
const rR = await store._rehydrate({ id: "t2", label: "R", eyeSide: "right", leftCode: [1, 2, 3], leftMask: [1, 1, 1] });
assert.strictEqual(rR.eyeSide, "right");
const rU = await store._rehydrate({ id: "t3", label: "U", leftCode: [1, 2, 3], leftMask: [1, 1, 1] });
assert.strictEqual(rU.eyeSide, "unknown", "missing eyeSide defaults to unknown");

// ── 4. FTA / FTER stats ──
globalThis.__irisStatsMem = {};
globalThis._irisResetStats();
globalThis._irisRecordFTA("segmentation-failed");
globalThis._irisRecordFTER("gates-failed");
let s = globalThis._irisGetStats();
assert.strictEqual(s.fta, 1, "FTA count = 1");
assert.strictEqual(s.fter, 1, "FTER count = 1");
globalThis._irisRecordFTA("segmentation-failed");
s = globalThis._irisGetStats();
assert.strictEqual(s.fta, 2, "FTA increments");
assert.strictEqual(s.lastFta.reason, "segmentation-failed");

console.log("Phase 2 tests passed ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
