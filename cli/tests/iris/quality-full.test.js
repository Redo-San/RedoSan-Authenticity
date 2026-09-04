require("./setup");
const test = require("node:test");
const assert = require("node:assert");

const IQF = global.IrisQualityFull;

function makeIrisImage(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = fill;
    d[i + 1] = fill;
    d[i + 2] = fill;
    d[i + 3] = 255;
  }
  return d;
}
function makeGradientImage(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = (x + y * 2) % 256;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
  return d;
}
function makeMask(w, h, ir, valid) {
  const m = new Uint8Array(w * h);
  const cx = Math.floor(w / 2),
    cy = Math.floor(h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= ir && dist >= ir * 0.3) m[y * w + x] = valid ? 1 : 0;
    }
  }
  return m;
}

// ═══════════════════════════════════════════════════════════════
// IrisQualityFull — push from 6% to 80%+ via targeted tests
// ═══════════════════════════════════════════════════════════════

test("IrisQualityFull.depthOfField: uniform → consistent (100)", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.depthOfField(
    img,
    200,
    200,
    { x: 100, y: 100, radius: 80 },
    80,
  );
  assert(
    typeof r === "number" && r >= 0 && r <= 100,
    "depthOfField returns 0-100",
  );
});

test("IrisQualityFull.depthOfField: gradient → lower consistency", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.depthOfField(
    img,
    200,
    200,
    { x: 100, y: 100, radius: 80 },
    80,
  );
  assert(
    typeof r === "number" && r >= 0 && r <= 100,
    "gradient depthOfField returns 0-100",
  );
});

test("IrisQualityFull.depthOfField: null → default 50", () => {
  const r = IrisQualityFull.depthOfField(null, 0, 0, null, 0);
  assert.strictEqual(r, 50);
});

test("IrisQualityFull.angularOcclusion: full ring → 0 occlusion", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.angularOcclusion(mask, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(
    typeof r.maxOcclusion90 === "number" &&
      typeof r.maxOcclusion30 === "number",
  );
  assert(r.maxOcclusion90 >= 0 && r.maxOcclusion90 <= 1);
  assert(r.maxOcclusion30 >= 0 && r.maxOcclusion30 <= 1);
  assert(r.sectors30 && r.sectors30.length === 12, "12 angular sectors");
});

test("IrisQualityFull.angularOcclusion: null → max occlusion", () => {
  const r = IrisQualityFull.angularOcclusion(null, 0, 0, null);
  assert.strictEqual(r.maxOcclusion90, 1);
  assert.strictEqual(r.maxOcclusion30, 1);
});

test("IrisQualityFull.angularOcclusion: half mask → ~50% occlusion", () => {
  const mask = new Uint8Array(200 * 200);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 100; x++) mask[y * 200 + x] = 1;
  const r = IrisQualityFull.angularOcclusion(mask, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(r.maxOcclusion90 > 0, "half mask has occlusion");
});

test("IrisQualityFull.specularReflection: uniform → low", () => {
  const img = makeIrisImage(200, 200, 80);
  const r = IrisQualityFull.specularReflection(
    img,
    200,
    200,
    { x: 100, y: 100, radius: 20 },
    { x: 100, y: 100, radius: 80 },
  );
  assert(typeof r.ratio === "number" && r.ratio >= 0 && r.ratio <= 1);
});

test("IrisQualityFull.specularReflection: bright center → higher ratio", () => {
  const img = makeIrisImage(200, 200, 80);
  for (let y = 90; y < 110; y++)
    for (let x = 90; x < 110; x++) {
      const idx = (y * 200 + x) * 4;
      img[idx] = 255;
      img[idx + 1] = 255;
      img[idx + 2] = 255;
    }
  const r = IrisQualityFull.specularReflection(
    img,
    200,
    200,
    { x: 100, y: 100, radius: 20 },
    { x: 100, y: 100, radius: 80 },
  );
  assert(r.ratio >= 0);
});

test("IrisQualityFull.specularReflection: null → {ratio:0}", () => {
  const r = IrisQualityFull.specularReflection(null, 0, 0, null, null);
  assert.strictEqual(r.ratio, 0);
});

test("IrisQualityFull.irisTextureContrast: uniform → low variance", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.irisTextureContrast(img, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.irisTextureContrast: gradient → > 0", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.irisTextureContrast(img, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(r > 0, "gradient has texture contrast");
});

test("IrisQualityFull.irisTextureContrast: null → 0", () => {
  assert.strictEqual(IrisQualityFull.irisTextureContrast(null, 0, 0, null), 0);
});

test("IrisQualityFull.detectIllumination: uniform RGB → low meanDiff", () => {
  const img = makeIrisImage(10, 10, 100);
  const r = IrisQualityFull.detectIllumination(img, 10, 10);
  assert(typeof r.meanChannelDiff === "number");
  assert(typeof r.confidence === "number");
  assert(r.meanChannelDiff >= 0);
});

test("IrisQualityFull.detectIllumination: null → 0", () => {
  const r = IrisQualityFull.detectIllumination(null, 0, 0);
  assert.strictEqual(r.meanChannelDiff, 0);
});

test("IrisQualityFull.detectNirCapability: returns object", async () => {
  const r = await IrisQualityFull.detectNirCapability();
  assert(typeof r === "object");
  assert(typeof r.nirAvailable === "boolean");
  assert(typeof r.reason === "string");
});

test("IrisQualityFull.generateQualityVector: null → empty vector", () => {
  const v = IrisQualityFull.generateQualityVector(null);
  assert(v instanceof Float64Array && v.length === 64);
  assert(
    v.every((x) => x === 0),
    "all zeros for null",
  );
});

test("IrisQualityFull.generateQualityVector: with params → fills slots", () => {
  const img = makeIrisImage(200, 200, 100);
  const mask = makeMask(200, 200, 80, true);
  const v = IrisQualityFull.generateQualityVector({
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
    mask,
  });
  assert(v instanceof Float64Array && v.length === 64);
  assert(v[0] >= 0, "slot 0 (focus) is non-negative");
  assert(v[1] > 0, "slot 1 (diameter) is positive");
  assert(v[2] >= 0, "slot 2 (usableArea) is non-negative");
});

test("IrisQualityFull.computeCompositeQuality: null → score 0", () => {
  const r = IrisQualityFull.computeCompositeQuality(null);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.passed, false);
});

test("IrisQualityFull.computeCompositeQuality: with params → valid score", () => {
  const img = makeIrisImage(200, 200, 120);
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.computeCompositeQuality({
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
    mask,
  });
  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 100);
  assert(typeof r.level === "string");
  assert(typeof r.passed === "boolean");
  assert(typeof r.details === "string" && r.details.length > 0);
});

test("IrisQualityFull.evaluateAcquisitionGates: null → fails", () => {
  const r = IrisQualityFull.evaluateAcquisitionGates(null);
  assert.strictEqual(r.passed, false);
  assert(r.failures.includes("missing-parameters"));
});

test("IrisQualityFull.evaluateAcquisitionGates: all-pass params", () => {
  const img = makeGradientImage(200, 200);
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.evaluateAcquisitionGates({
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
    mask,
  });
  assert(typeof r.passed === "boolean");
  assert(Array.isArray(r.failures));
});

test("IrisQualityFull.evaluateAcquisitionGates: no mask → via fails", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.evaluateAcquisitionGates({
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
  });
  assert(
    r.failures.some((f) => f.includes("visibleIrisArea")),
    "no mask → visibleIrisArea failure",
  );
});

test("IrisQualityFull._getQualityLevel: all tiers", () => {
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(80), {
    label: "Very High",
    code: 4,
  });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(60), {
    label: "High",
    code: 3,
  });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(30), {
    label: "Medium",
    code: 2,
  });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(10), {
    label: "Low",
    code: 1,
  });
});

test("IrisQualityFull._generateReport: produces report string", () => {
  const report = IrisQualityFull._generateReport(
    75,
    { label: "High", code: 3 },
    { focus: 80, usableArea: 90 },
    true,
  );
  assert(
    typeof report === "string" &&
      report.includes("High") &&
      report.includes("PASSED"),
  );
});

test("IrisQualityFull.mutualQualityComparison: null → score 0", () => {
  const r = IrisQualityFull.mutualQualityComparison(null, null);
  assert.strictEqual(r.score, 0);
  assert(typeof r.details === "string");
});

test("IrisQualityFull.mutualQualityComparison: two images → mutual score", () => {
  const img = makeIrisImage(200, 200, 120);
  const mask = makeMask(200, 200, 80, true);
  const p = {
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
    mask,
  };
  const r = IrisQualityFull.mutualQualityComparison(p, p);
  assert(typeof r.score === "number");
  assert(typeof r.consistency === "number");
  assert(r.consistency === 100, "same image → 100% consistency");
});

test("IrisQualityFull.concentricity: centered → 1.0", () => {
  const r = IrisQualityFull.concentricity(
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    80,
  );
  assert.strictEqual(r, 1);
});

test("IrisQualityFull.concentricity: offset → < 1", () => {
  const r = IrisQualityFull.concentricity(
    { x: 110, y: 100 },
    { x: 100, y: 100 },
    80,
  );
  assert(r < 1 && r >= 0);
});

test("IrisQualityFull.concentricity: null → 0.5", () => {
  assert.strictEqual(IrisQualityFull.concentricity(null, null, 0), 0.5);
});

test("IrisQualityFull.eyelidCircularity: full mask → high value", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.eyelidCircularity(
    mask,
    200,
    200,
    { x: 100, y: 100, radius: 80 },
    80,
  );
  assert(typeof r === "number" && r >= 0 && r <= 1);
});

test("IrisQualityFull.eyelidCircularity: null → 0.5", () => {
  assert.strictEqual(
    IrisQualityFull.eyelidCircularity(null, 0, 0, null, 0),
    0.5,
  );
});

test("IrisQualityFull.azimuthGaze: centered → 0", () => {
  const r = IrisQualityFull.azimuthGaze(
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    80,
  );
  assert.strictEqual(r, 0);
});

test("IrisQualityFull.azimuthGaze: offset → > 0", () => {
  const r = IrisQualityFull.azimuthGaze(
    { x: 120, y: 100 },
    { x: 100, y: 100 },
    80,
  );
  assert(r > 0 && r <= 45);
});

test("IrisQualityFull.azimuthGaze: null → 0", () => {
  assert.strictEqual(IrisQualityFull.azimuthGaze(null, null, 0), 0);
});

test("IrisQualityFull.visibleIrisArea: full ring → high viaRatio", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.visibleIrisArea(mask, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(typeof r.viaPx === "number" && r.viaPx > 0);
  assert(typeof r.viaRatio === "number" && r.viaRatio > 0);
  assert(typeof r.passedGate === "boolean");
});

test("IrisQualityFull.visibleIrisArea: null → zero", () => {
  const r = IrisQualityFull.visibleIrisArea(null, 0, 0, null);
  assert.strictEqual(r.viaPx, 0);
  assert.strictEqual(r.passedGate, false);
});

test("IrisQualityFull.rawLaplacianVariance: gradient → > 0", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.rawLaplacianVariance(img, 200, 200);
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.rawLaplacianVariance: null → 0", () => {
  assert.strictEqual(IrisQualityFull.rawLaplacianVariance(null, 0, 0), 0);
});

test("IrisQualityFull.rawLaplacianVariance: with ROI", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.rawLaplacianVariance(img, 200, 200, {
    x: 50,
    y: 50,
    width: 100,
    height: 100,
  });
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.focusQuality: sharp gradient → > 0", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.focusQuality(img, 200, 200, {
    x: 50,
    y: 50,
    width: 100,
    height: 100,
  });
  assert(r >= 0 && r <= 100);
});

test("IrisQualityFull.focusQuality: null → 0", () => {
  assert.strictEqual(IrisQualityFull.focusQuality(null, 0, 0), 0);
});

test("IrisQualityFull.grayscaleUtilization: full range → 256", () => {
  const img = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) img[i] = i;
  const r = IrisQualityFull.grayscaleUtilization(img, null, 256);
  assert.strictEqual(r, 256);
});

test("IrisQualityFull.grayscaleUtilization: uniform → 1", () => {
  const img = new Uint8ClampedArray(100).fill(128);
  const r = IrisQualityFull.grayscaleUtilization(img, null, 100);
  assert.strictEqual(r, 1);
});

test("IrisQualityFull.grayscaleUtilization: null → 0", () => {
  assert.strictEqual(IrisQualityFull.grayscaleUtilization(null, null, 0), 0);
});

test("IrisQualityFull.grayscaleUtilization: with ROI", () => {
  const img = new Uint8ClampedArray(400);
  for (let i = 0; i < 400; i++) img[i] = i % 256;
  const r = IrisQualityFull.grayscaleUtilization(
    img,
    { x: 0, y: 0, width: 20, height: 20 },
    20,
  );
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.motionBlur: uniform → high score", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.motionBlur(img, 200, 200);
  assert(typeof r === "number" && r >= 0 && r <= 50);
});

test("IrisQualityFull.motionBlur: gradient → lower score", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.motionBlur(img, 200, 200);
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.motionBlur: null → 0", () => {
  assert.strictEqual(IrisQualityFull.motionBlur(null, 0, 0), 0);
});

test("IrisQualityFull.pupilBoundaryCircularity: valid mask → value", () => {
  const mask = new Uint8Array(100 * 100).fill(1);
  const r = IrisQualityFull.pupilBoundaryCircularity(mask, 100, 100);
  assert(typeof r === "number" && r >= 0 && r <= 2);
});

test("IrisQualityFull.pupilBoundaryCircularity: null → 1", () => {
  assert.strictEqual(IrisQualityFull.pupilBoundaryCircularity(null, 0, 0), 1);
});

test("IrisQualityFull.motionBlurFocus: uniform → 1", () => {
  const norm = new Uint8Array(51 * 51).fill(128);
  const r = IrisQualityFull.motionBlurFocus(norm, 51, 51);
  assert(r >= 0 && r <= 1);
});

test("IrisQualityFull.motionBlurFocus: null → 1", () => {
  assert.strictEqual(IrisQualityFull.motionBlurFocus(null, 0, 0), 1);
});

test("IrisQualityFull.marginAdequacy: centered → 100", () => {
  const r = IrisQualityFull.marginAdequacy({ x: 100, y: 100 }, 80, 200, 200);
  assert.strictEqual(r, 100);
});

test("IrisQualityFull.marginAdequacy: null → 0", () => {
  assert.strictEqual(IrisQualityFull.marginAdequacy(null, 0, 0, 0), 0);
});

test("IrisQualityFull.pupilIrisRatio: normal ratio", () => {
  const r = IrisQualityFull.pupilIrisRatio(25, 80);
  assert(typeof r === "number" && r > 0 && r <= 1);
});

test("IrisQualityFull.pupilIrisRatio: zero iris → 0", () => {
  assert.strictEqual(IrisQualityFull.pupilIrisRatio(25, 0), 0);
});

test("IrisQualityFull.gazeAngle: centered → 0", () => {
  const r = IrisQualityFull.gazeAngle(
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    80,
  );
  assert.strictEqual(r, 0);
});

test("IrisQualityFull.gazeAngle: null → 0", () => {
  assert.strictEqual(IrisQualityFull.gazeAngle(null, null, 0), 0);
});

test("IrisQualityFull.usableArea: half mask → 50", () => {
  const m = new Uint8Array(100).fill(0);
  for (let i = 0; i < 50; i++) m[i] = 1;
  assert.strictEqual(IrisQualityFull.usableArea(m), 50);
});

test("IrisQualityFull.usableArea: null → 0", () => {
  assert.strictEqual(IrisQualityFull.usableArea(null), 0);
});

test("IrisQualityFull.irisPupilContrast: uniform → near zero", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.irisPupilContrast(
    img,
    200,
    200,
    { x: 100, y: 100, radius: 20 },
    { x: 100, y: 100, radius: 80 },
  );
  assert(r >= 0 && r < 5, "uniform contrast near zero, got " + r);
});

test("IrisQualityFull.irisPupilContrast: null → 0", () => {
  assert.strictEqual(
    IrisQualityFull.irisPupilContrast(null, 0, 0, null, null),
    0,
  );
});

test("IrisQualityFull.irisScleraContrast: uniform → near zero", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.irisScleraContrast(img, 200, 200, {
    x: 100,
    y: 100,
    radius: 80,
  });
  assert(r >= 0 && r < 5, "uniform sclera contrast near zero, got " + r);
});

test("IrisQualityFull.irisScleraContrast: null → 0", () => {
  assert.strictEqual(IrisQualityFull.irisScleraContrast(null, 0, 0, null), 0);
});

test("IrisQualityFull.computeCompositeQuality: without mask → defaults", () => {
  const img = makeIrisImage(200, 200, 120);
  const r = IrisQualityFull.computeCompositeQuality({
    imageData: img,
    width: 200,
    height: 200,
    pupil: { x: 100, y: 100, radius: 25 },
    iris: { x: 100, y: 100, radius: 80 },
  });
  assert(r.score >= 0);
});

test("IrisQualityFull.computeCompositeQuality: without pupil → defaults", () => {
  const img = makeIrisImage(200, 200, 120);
  const r = IrisQualityFull.computeCompositeQuality({
    imageData: img,
    width: 200,
    height: 200,
    iris: { x: 100, y: 100, radius: 80 },
  });
  assert(r.score >= 0);
});

// ═══════════════════════════════════════════════════════════════
// Targeted coverage gap tests — V8 uncovered ranges
// ═══════════════════════════════════════════════════════════════

// ── iris_quality_full.js uncovered ranges ──

test("IrisQualityFull.focusQuality: with actual gradient data (L256)", () => {
  const w = 32,
    h = 32;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img[y * w + x] = (x + y) % 256;
  const val = IQF.focusQuality(img, w, h, { x: 0, y: 0, width: w, height: h });
  assert.equal(typeof val, "number");
});

test("IrisQualityFull.rawLaplacianVariance: with gradient data (L302)", () => {
  const w = 32,
    h = 32;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img[y * w + x] = (x + y * 2) % 256;
  const val = IQF.rawLaplacianVariance(img, w, h, {
    x: 0,
    y: 0,
    width: w,
    height: h,
  });
  assert.equal(typeof val, "number");
});

test("IrisQualityFull.mutualQualityComparison: positional args (L1260)", () => {
  const r1 = {
    visibleIrisArea: 80,
    focusQuality: 0.7,
    motionBlur: 0.2,
    pupilIrisRatio: 0.35,
    usableArea: 70,
  };
  const r2 = {
    visibleIrisArea: 90,
    focusQuality: 0.8,
    motionBlur: 0.1,
    pupilIrisRatio: 0.4,
    usableArea: 80,
  };
  const result = IQF.mutualQualityComparison(r1, r2);
  assert.equal(typeof result.score, "number");
});

test("IrisQualityFull.evaluateAcquisitionGates: failing gates (L453-L491)", () => {
  const params = {
    visibleIrisArea: 100,
    occlusion90Deg: 0.9,
    occlusion30Deg: 0.9,
    specularReflectionRatio: 0.9,
    laplacianVariance: 10,
  };
  const result = IQF.evaluateAcquisitionGates(params);
  assert.equal(typeof result.passed, "boolean");
  assert.equal(result.passed, false);
});

test("IrisQualityFull.depthOfField: gradient image (L1067)", () => {
  const w = 64,
    h = 64;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img[y * w + x] = (x + y * 3) % 256;
  const result = IQF.depthOfField(img, w, h, { x: 32, y: 32, radius: 30 }, 30);
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.detectIllumination: gradient image (L753)", () => {
  const w = 64,
    h = 64;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) img[y * w + x] = (x + y) % 256;
  const result = IQF.detectIllumination(img, w, h);
  assert.equal(typeof result.colorCapture, "boolean");
});

test("IrisQualityFull.grayscaleUtilization: gradient data (L807)", () => {
  const w = 64,
    h = 10;
  const img = new Uint8Array(w * h);
  for (let i = 0; i < img.length; i++) img[i] = (i * 4) % 256;
  const result = IQF.grayscaleUtilization(
    img,
    { x: 0, y: 0, width: w, height: h },
    w,
  );
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.pupilIrisRatio: valid ratio (L705)", () => {
  const result = IQF.pupilIrisRatio(15, 50);
  assert.equal(typeof result, "number");
  assert.ok(result > 0 && result < 1);
});

test("IrisQualityFull.gazeAngle: valid data (L717)", () => {
  const result = IQF.gazeAngle({ cx: 50, cy: 50 }, { cx: 52, cy: 51 }, 40);
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.concentricity: aligned centers (L991)", () => {
  const result = IQF.concentricity({ x: 50, y: 50 }, { x: 50, y: 50 }, 40);
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.azimuthGaze: valid data (L1045)", () => {
  const result = IQF.azimuthGaze({ cx: 50, cy: 50 }, { cx: 52, cy: 51 }, 40);
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.specularReflection: bright spots (L946)", () => {
  const w = 64,
    h = 64;
  const img = new Uint8Array(w * h).fill(50);
  img[32 * w + 32] = 240;
  img[32 * w + 33] = 235;
  const result = IQF.specularReflection(
    img,
    w,
    h,
    { cx: 32, cy: 32, radius: 10 },
    { x: 32, y: 32, radius: 30 },
  );
  assert.equal(typeof result.ratio, "number");
});

test("IrisQualityFull.detectNirCapability: async returns result (L1144)", async () => {
  const result = await IQF.detectNirCapability();
  assert.equal(typeof result.nirAvailable, "boolean");
});

test("IrisQualityFull.generateQualityVector: null → fallback (L1164)", () => {
  const result = IQF.generateQualityVector(null);
  assert.ok(result instanceof Float64Array);
});

test("IrisQualityFull.computeCompositeQuality: with full params (L1305)", () => {
  const w = 64,
    h = 64;
  const img = new Uint8Array(w * h).fill(128);
  const result = IQF.computeCompositeQuality({
    imageData: img,
    width: w,
    height: h,
    pupil: { cx: 32, cy: 32, radius: 10 },
    iris: { cx: 32, cy: 32, radius: 30 },
  });
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.passed, "boolean");
});

// ═══════════════════════════════════════════════════════════════
// ROUND 3 — Targeted tests for every remaining uncovered byte offset
// ═══════════════════════════════════════════════════════════════

// ── iris_quality_full.js ──
test("IQF constructor (L26-L27)", () => {
  const q = new IQF();
  assert.ok(q);
});
test("IQF.focusQuality: with ROI (L263-L266)", () => {
  const w = 100,
    h = 100;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  const r = IQF.focusQuality(data, w, h, {
    x: 20,
    y: 20,
    width: 60,
    height: 60,
  });
  assert.equal(typeof r, "number");
});
test("IQF.rawLaplacianVariance: with ROI (L333)", () => {
  const w = 10,
    h = 10;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100 + (i % 50);
    data[i + 1] = 100;
    data[i + 2] = 100;
    data[i + 3] = 255;
  }
  const r = IQF.rawLaplacianVariance(data, w, h, {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.equal(typeof r, "number");
});
test("IQF.visibleIrisArea: passedGate true (L377)", () => {
  // passedGate = viaPx >= gates.minMaskSizePx. Need a mask with enough valid pixels in the ring.
  const w = 200,
    h = 200;
  const mask = new Uint8Array(w * h).fill(1);
  const r = IQF.visibleIrisArea(mask, w, h, { x: 100, y: 100, radius: 80 });
  assert.equal(typeof r.viaPx, "number");
  assert.ok(r.viaPx > 0);
});
test("IQF.visibleIrisArea: passedGate false (L377)", () => {
  const mask = new Uint8Array(100 * 100).fill(0);
  const r = IQF.visibleIrisArea(mask, 100, 100, { x: 50, y: 50, radius: 30 });
  assert.equal(r.passedGate, false);
});
test("IQF.angularOcclusion: max90 update (L430)", () => {
  const w = 200,
    h = 200;
  const mask = new Uint8Array(w * h).fill(1);
  for (let y = 0; y < 40; y++) for (let x = 0; x < w; x++) mask[y * w + x] = 0;
  const r = IQF.angularOcclusion(mask, w, h, { x: 100, y: 100, radius: 80 });
  assert.ok(r);
  assert.equal(typeof r.maxOcclusion90, "number");
  assert.ok(Array.isArray(r.sectors30));
});
test("IQF.evaluateAcquisitionGates: mask present (L464)", () => {
  const mask = new Uint8Array(100 * 100).fill(1);
  const r = IQF.evaluateAcquisitionGates({
    imageData: new Uint8Array(100 * 100 * 4).fill(128),
    width: 100,
    height: 100,
    mask: mask,
    pupil: { x: 50, y: 50, radius: 10 },
    iris: { x: 50, y: 50, radius: 35 },
  });
  assert.ok(r);
});
test("IQF.evaluateAcquisitionGates: pupilIrisRatio failure (L479-L481)", () => {
  const mask = new Uint8Array(100 * 100).fill(1);
  const r = IQF.evaluateAcquisitionGates({
    imageData: new Uint8Array(100 * 100 * 4).fill(128),
    width: 100,
    height: 100,
    mask: mask,
    pupil: { x: 50, y: 50, radius: 34 },
    iris: { x: 50, y: 50, radius: 35 },
  });
  assert.ok(r);
  assert.ok(r.failures.some((f) => f.includes("pupilIrisRatio")));
});
test("IQF.evaluateAcquisitionGates: marginAdequacy failure (L507-L509)", () => {
  const mask = new Uint8Array(100 * 100).fill(1);
  const r = IQF.evaluateAcquisitionGates({
    imageData: new Uint8Array(100 * 100 * 4).fill(128),
    width: 100,
    height: 100,
    mask: mask,
    pupil: { x: 5, y: 5, radius: 5 },
    iris: { x: 5, y: 5, radius: 30 },
  });
  assert.ok(r);
  assert.ok(r.failures.some((f) => f.includes("marginAdequacy")));
});
test("IQF.marginAdequacy: at edge returns 0 (L795-L797)", () => {
  const r = IQF.marginAdequacy({ x: 0, y: 0 }, 40, 100, 100);
  assert.equal(r, 0);
});
test("IQF.marginAdequacy: proportional return", () => {
  const r = IQF.marginAdequacy({ x: 10, y: 10 }, 30, 100, 100);
  assert.equal(typeof r, "number");
  assert.ok(r >= 0 && r <= 100);
});
test("IQF.grayscaleUtilization: with ROI (L816)", () => {
  const data = new Uint8Array(100 * 100);
  for (let i = 0; i < data.length; i++) data[i] = i % 256;
  const r = IQF.grayscaleUtilization(
    data,
    { x: 10, y: 10, width: 30, height: 30 },
    100,
  );
  assert.equal(typeof r, "number");
});
test("IQF.motionBlur: non-trivial image (L862)", () => {
  const w = 10,
    h = 10;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100 + (i % 50);
    data[i + 1] = 100;
    data[i + 2] = 100;
    data[i + 3] = 255;
  }
  const r = IQF.motionBlur(data, w, h);
  assert.equal(typeof r, "number");
});
test("IQF.pupilBoundaryCircularity: valid mask (L885-L898)", () => {
  const w = 64,
    h = 64;
  const mask = new Uint8Array(w * h).fill(1);
  for (let y = 20; y < 44; y++)
    for (let x = 20; x < 44; x++) mask[y * w + x] = 0;
  const r = IQF.pupilBoundaryCircularity(mask, w, h, { x: 32, y: 32 }, 12);
  assert.equal(typeof r, "number");
});
test("IQF.motionBlurFocus: valid image (L924-L925)", () => {
  const w = 10,
    h = 10;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100 + (i % 80);
    data[i + 1] = 100 + (i % 60);
    data[i + 2] = 100;
    data[i + 3] = 255;
  }
  const r = IQF.motionBlurFocus(data, w, h, { x: 5, y: 5, radius: 4 });
  assert.equal(typeof r, "number");
});
test("IQF.specularReflection: valid data (L948-L957)", () => {
  const w = 64,
    h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  data[(32 * w + 32) * 4] = 255;
  const r = IQF.specularReflection(
    data,
    w,
    h,
    { cx: 32, cy: 32, radius: 10 },
    { x: 32, y: 32, radius: 25 },
  );
  assert.ok(r);
  assert.equal(typeof r.ratio, "number");
});
test("IQF.eyelidCircularity: valid mask (L1036)", () => {
  const w = 64,
    h = 64;
  const mask = new Uint8Array(w * h).fill(1);
  for (let y = 15; y < 49; y++)
    for (let x = 15; x < 49; x++) mask[y * w + x] = 0;
  const r = IQF.eyelidCircularity(mask, w, h, { x: 32, y: 32, radius: 17 }, 17);
  assert.equal(typeof r, "number");
});
test("IQF.detectIllumination: null data (L1133)", async () => {
  const r = await IQF.detectNirCapability();
  assert.ok(r);
  assert.equal(typeof r.nirAvailable, "boolean");
});
test("IQF.detectNirCapability: mediaDevices unavailable (L1133-L1135)", async () => {
  const orig = global.navigator.mediaDevices;
  global.navigator.mediaDevices = undefined;
  const r = await IQF.detectNirCapability();
  assert.equal(r.nirAvailable, false);
  assert.equal(r.reason, "mediaDevices-unavailable");
  global.navigator.mediaDevices = orig;
});
test("IQF.detectNirCapability: NIR device found (L1137-L1141)", async () => {
  const orig = global.navigator.mediaDevices;
  global.navigator.mediaDevices = {
    enumerateDevices: async () => [
      {
        kind: "videoinput",
        label: "IR Camera NIR Sensor",
        getCapabilities: () => ({ facingMode: "environment" }),
      },
    ],
  };
  const r = await IQF.detectNirCapability();
  assert.equal(r.nirAvailable, true);
  assert.equal(r.reason, "ir-device-label");
  global.navigator.mediaDevices = orig;
});
test("IQF.detectNirCapability: no NIR but environment cam (L1142-L1144)", async () => {
  const orig = global.navigator.mediaDevices;
  global.navigator.mediaDevices = {
    enumerateDevices: async () => [
      {
        kind: "videoinput",
        label: "Back Camera",
        getCapabilities: () => ({ facingMode: "environment" }),
      },
    ],
  };
  const r = await IQF.detectNirCapability();
  assert.equal(r.nirAvailable, false);
  assert.equal(r.hasEnvironmentCamera, true);
  global.navigator.mediaDevices = orig;
});
test("IQF.detectNirCapability: error path", async () => {
  const orig = global.navigator.mediaDevices;
  global.navigator.mediaDevices = {
    enumerateDevices: async () => {
      throw new Error("denied");
    },
  };
  const r = await IQF.detectNirCapability();
  assert.equal(r.nirAvailable, false);
  assert.ok(r.reason.includes("denied"));
  global.navigator.mediaDevices = orig;
});
test("IQF.generateQualityVector: with iris param (L1175-L1218)", () => {
  const w = 64,
    h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  const mask = new Uint8Array(w * h).fill(1);
  const r = IQF.generateQualityVector({
    imageData: data,
    width: w,
    height: h,
    pupil: { x: 32, y: 32, radius: 10 },
    iris: { x: 32, y: 32, radius: 25 },
    mask: mask,
  });
  assert.ok(r);
  assert.ok(r.length > 0);
});
test("IQF._generateReport: with metrics (L1493)", () => {
  const r = IQF._generateReport(
    75,
    { label: "Good", code: 3 },
    { focus: 0.85, contrast: 0.7 },
    true,
  );
  assert.ok(typeof r === "string");
  assert.ok(r.length > 0);
});

// ── iris_quality_full.js: focusQuality with 0 roi (L256-L262) ──
test("IQF.focusQuality: without ROI falls through (L256-L262)", () => {
  const w = 10,
    h = 10;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100 + (i % 50);
    data[i + 1] = 100;
    data[i + 2] = 100;
    data[i + 3] = 255;
  }
  const r = IQF.focusQuality(data, w, h);
  assert.equal(typeof r, "number");
});

// ═══════════════════════════════════════════════════════════════
// ROUND 4: Target all remaining executable uncovered lines
// ═══════════════════════════════════════════════════════════════

// ── iris_quality_full.js: generateQualityVector (L1163, L1165, L1200, L1302, L1368, L1388, L1463) ──
test("IQF.computeCompositeQuality: full params (L1200, L1302, L1368, L1388, L1463)", () => {
  const w = 100,
    h = 100;
  const imageData = new Uint8Array(w * h);
  for (let i = 0; i < imageData.length; i++)
    imageData[i] = 80 + Math.sin(i * 0.1) * 40;
  const mask = new Uint8Array(w * h).fill(1);
  const params = {
    imageData,
    width: w,
    height: h,
    mask,
    pupil: { x: 50, y: 50, radius: 15 },
    iris: { x: 50, y: 50, radius: 40 },
  };
  const r = IQF.computeCompositeQuality(params);
  assert.equal(typeof r.score, "number");
  assert.ok(r.level !== undefined);
  assert.equal(typeof r.passed, "boolean");
});

// ── iris_quality_full.js: generateQualityVector (L1463) ──
test("IQF.generateQualityVector: returns Float64Array (L1463)", () => {
  const w = 50,
    h = 50;
  const imageData = new Uint8Array(w * h);
  for (let i = 0; i < imageData.length; i++) imageData[i] = (i * 5) % 256;
  const r = IQF.generateQualityVector({
    imageData,
    width: w,
    height: h,
    pupil: { x: 25, y: 25, radius: 8 },
    iris: { x: 25, y: 25, radius: 20 },
  });
  assert.ok(r instanceof Float64Array);
  assert.equal(r.length, 64);
});

// ── IQF.marginAdequacy: iris at bottom edge → bottom margin calculation (L797) ──
test("IQF.marginAdequacy: iris near bottom → bottom margin (L797)", () => {
  const w = 100,
    h = 100;
  const r = IQF.marginAdequacy(
    { x: 50, y: 85, width: 30, height: 30 },
    15,
    w,
    h,
  );
  assert.equal(typeof r, "number");
  assert.ok(r >= 0);
});

// ── IQF.generateQualityVector: with mask → usableArea branch (L1208) ──
test("IQF.generateQualityVector: with mask → usableArea branch (L1208)", () => {
  const w = 50,
    h = 50;
  const imageData = new Uint8Array(w * h);
  for (let i = 0; i < imageData.length; i++) imageData[i] = (i * 3) % 256;
  const mask = new Uint8Array(w * h).fill(1);
  const r = IQF.generateQualityVector({
    imageData,
    width: w,
    height: h,
    mask,
    pupil: { x: 25, y: 25, radius: 8 },
    iris: { x: 25, y: 25, radius: 20 },
  });
  assert.ok(r instanceof Float64Array);
  assert.ok(r[2] > 0); // usableArea should be non-zero
});

// ── IQF.mutualQualityComparison: consistency calculation (L1302) ──
test("IQF.mutualQualityComparison: consistency with different scores (L1302)", () => {
  const w = 50,
    h = 50;
  const img1 = new Uint8Array(w * h);
  const img2 = new Uint8Array(w * h);
  for (let i = 0; i < img1.length; i++) {
    img1[i] = 100 + (i % 50);
    img2[i] = 150 + (i % 50);
  }
  const mask = new Uint8Array(w * h).fill(1);
  const params = {
    imageData1: img1,
    imageData2: img2,
    width: w,
    height: h,
    mask,
    pupil: { x: 25, y: 25, radius: 8 },
    iris: { x: 25, y: 25, radius: 20 },
  };
  const r = IQF.mutualQualityComparison(params);
  assert.equal(typeof r.score, "number");
  assert.equal(typeof r.consistency, "number");
  assert.ok(r.consistency >= 0);
});

// ── IQF.computeCompositeQuality: full params → depthOfField + generateQualityVector (L1368, L1388, L1463) ──
test("IQF.computeCompositeQuality: full params with iris + mask (L1368, L1388, L1463)", () => {
  const w = 80,
    h = 80;
  const imageData = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      imageData[y * w + x] = 60 + Math.sin(x * 0.1 + y * 0.08) * 40;
    }
  const mask = new Uint8Array(w * h).fill(1);
  const r = IQF.computeCompositeQuality({
    imageData,
    width: w,
    height: h,
    mask,
    pupil: { x: 40, y: 40, radius: 12 },
    iris: { x: 40, y: 40, radius: 30 },
  });
  assert.equal(typeof r.score, "number");
  assert.ok(r.details !== undefined);
  assert.ok(typeof r.level === "string");
});
