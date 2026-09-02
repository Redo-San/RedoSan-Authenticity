// ── Tests: within-iris texture-contrast acquisition gate (Section-0 mitigation) ──
// Run: node --test cli/tests/test-iris-quality-contrast.js
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");

const docShim = {
  location: { protocol: "file:", href: "file:///test" },
  navigator: { userAgent: "node" },
};
global.window = docShim;
global.document = {};
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "..", "..", "Iris_Biometric", "iris_quality_full.js"), "utf8"),
  { filename: path.join(__dirname, "..", "..", "Iris_Biometric", "iris_quality_full.js") },
);
const Q = global.window.IrisQualityFull;

const W = 400, H = 400;
const iris = { x: 200, y: 200, radius: 90 };
const pupil = { x: 200, y: 200, radius: 25 };

/**
 *
 * @param annulusFn
 */
function buildImage(annulusFn) {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - iris.x, y - iris.y);
      let v;
      if (d < pupil.radius) v = 15;
      else if (d >= iris.radius * 0.4 && d <= iris.radius * 0.9) v = annulusFn(x, y, d);
      else if (d > iris.radius * 1.1 && d < iris.radius * 1.5) v = 245;
      else v = 200;
      g[y * W + x] = v;
    }
  }
  return g;
}

test("irisTextureContrast: textured annulus has high std; flat annulus ~0", () => {
  const textured = buildImage((x, y) => 128 + 60 * Math.sin(x / 3) * Math.cos(y / 3));
  const flat = buildImage(() => 128);
  const cTextured = Q.irisTextureContrast(textured, W, H, iris);
  const cFlat = Q.irisTextureContrast(flat, W, H, iris);
  assert.ok(cTextured > 10, "textured iris should exceed the gate floor: " + cTextured.toFixed(2));
  assert.ok(cFlat < 1, "flat iris annulus should be near-zero texture: " + cFlat.toFixed(2));
});

test("ACQUISITION_GATES exposes a conservative irisTextureContrastMin", () => {
  assert.strictEqual(Q.ACQUISITION_GATES.irisTextureContrastMin, 10);
});

test("evaluateAcquisitionGates: rejects a near-flat (low-texture) iris", () => {
  const img = buildImage(() => 128); // flat annulus → no usable texture
  const res = Q.evaluateAcquisitionGates({
    imageData: img, width: W, height: H, iris, pupil,
    mask: new Uint8Array(W * H).fill(1),
  });
  assert.strictEqual(res.passed, false);
  assert.ok(res.failures.some((f) => f.indexOf("irisTextureContrast") === 0),
    "expected a texture-contrast failure, got: " + JSON.stringify(res.failures));
});

test("evaluateAcquisitionGates: accepts a well-textured iris", () => {
  // High-frequency annulus: passes both the texture AND the sharpness gates.
  const img = buildImage((x, y) => 128 + 60 * Math.sin(x * 2.5) * Math.sin(y * 2.5));
  const res = Q.evaluateAcquisitionGates({
    imageData: img, width: W, height: H, iris, pupil,
    mask: new Uint8Array(W * H).fill(1),
  });
  assert.strictEqual(res.passed, true, "unexpected failures: " + JSON.stringify(res.failures));
});
