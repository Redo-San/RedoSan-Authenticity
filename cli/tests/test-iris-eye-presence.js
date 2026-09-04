// ── Tests: iris eye-presence gate (reject photos with no usable iris) ──
// Run: node --test cli/tests/test-iris-eye-presence.js
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");

const src = fs.readFileSync(
  path.join(__dirname, "..", "..", "Iris_Biometric", "iris_engine.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.join(
    __dirname,
    "..",
    "..",
    "Iris_Biometric",
    "iris_engine.js",
  ),
});
const IrisEngine = global.IrisEngine || global.window.IrisEngine;

/**
 * Build a random-noise grayscale image.
 * @param {number} w - width
 * @param {number} h - height
 * @returns {Float64Array} grayscale luminance (0-255)
 */
function buildNoise(w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = (Math.random() * 256) | 0;
  return g;
}

/**
 * Build a uniform grayscale image.
 * @param {number} w - width
 * @param {number} h - height
 * @param {number} v - luminance value
 * @returns {Float64Array} grayscale luminance
 */
function buildUniform(w, h, v) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = v;
  return g;
}

/**
 * Build a synthetic frontal eye: white sclera, textured gray iris, black pupil.
 * Uses a seeded PRNG for deterministic texture.
 * @param {number} w - width
 * @param {number} h - height
 * @param {number} cx - eye center x
 * @param {number} cy - eye center y
 * @param {number} pupilR - pupil radius
 * @param {number} irisR - iris radius
 * @returns {Float64Array} grayscale luminance
 */
function buildEye(w, h, cx, cy, pupilR, irisR) {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      let v;
      if (d <= pupilR) v = 8; // dark pupil
      else if (d <= irisR) v = 120 + ((rand() * 30) | 0) - 15; // textured iris
      else v = 230; // bright sclera
      g[y * w + x] = v;
    }
  }
  return g;
}

/**
 * Run pupil + iris segmentation on a grayscale image.
 * @param {Float64Array|Uint8Array} gray - row-major grayscale luminance (0-255)
 * @param {number} w - width
 * @param {number} h - height
 * @returns {{pupil:object, iris:object}} detected pupil and iris
 */
function segment(gray, w, h) {
  const pupil = IrisEngine.detectPupil(gray, w, h);
  const iris = IrisEngine.detectIris(gray, w, h, pupil);
  return { pupil, iris };
}

test("noise image has no usable iris (rejected)", () => {
  const w = 160,
    h = 160;
  const gray = buildNoise(w, h);
  const { pupil, iris } = segment(gray, w, h);
  const res = IrisEngine.validateEyePresence(gray, w, h, pupil, iris);
  assert.strictEqual(res.ok, false, "random noise must not pass as an eye");
  assert.ok(res.reason && res.reason.length > 0);
});

test("uniform gray image has no usable iris (rejected)", () => {
  const w = 160,
    h = 160;
  const gray = buildUniform(w, h, 128);
  const { pupil, iris } = segment(gray, w, h);
  const res = IrisEngine.validateEyePresence(gray, w, h, pupil, iris);
  assert.strictEqual(res.ok, false, "flat image must not pass as an eye");
});

test("synthetic eye is detected and accepted (captures the eye)", () => {
  const w = 640,
    h = 480;
  const cx = 320,
    cy = 240,
    pupilR = 70,
    irisR = 160;
  const gray = buildEye(w, h, cx, cy, pupilR, irisR);
  const { pupil, iris } = segment(gray, w, h);
  // The IDO heuristic segments the pupil near the true center.
  assert.ok(pupil.radius > 5, "pupil radius plausible: " + pupil.radius);
  const res = IrisEngine.validateEyePresence(gray, w, h, pupil, iris);
  assert.strictEqual(
    res.ok,
    true,
    "real eye must pass (reason=" + res.reason + ")",
  );
});

test("off-center / wrong-size circle is rejected", () => {
  const w = 160,
    h = 160;
  // Eye placed at the very edge -> off-center gate should fire.
  const gray = buildEye(w, h, 8, 8, 10, 28);
  const { pupil, iris } = segment(gray, w, h);
  const res = IrisEngine.validateEyePresence(gray, w, h, pupil, iris);
  assert.strictEqual(res.ok, false, "edge-placed eye must be rejected");
});
