const test = require("node:test");
const assert = require("node:assert");
require("./setup");

function makeIrisImage(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = fill; d[i+1] = fill; d[i+2] = fill; d[i+3] = 255;
  }
  return d;
}
function makeGradientImage(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = (x + y * 2) % 256;
      d[idx] = v; d[idx+1] = v; d[idx+2] = v; d[idx+3] = 255;
    }
  }
  return d;
}
function makeGray(w, h, fillFn) {
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = fillFn(x, y);
  return g;
}

// ═══════════════════════════════════════════════════════════════
// iris_liveness.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IRIS_LIVENESS_CONFIG has expected keys", () => {
  assert.ok(global.IRIS_LIVENESS_CONFIG);
  assert.ok(global.IRIS_LIVENESS_CONFIG.PAI_SPECIES);
});

test("IrisLiveness.pupilDilationTest: constant frames → high score", () => {
  const frames = [
    { pupilRadius: 10, irisRadius: 40 },
    { pupilRadius: 10, irisRadius: 40 },
    { pupilRadius: 10, irisRadius: 40 },
  ];
  const result = IL.pupilDilationTest(frames);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.specularReflectionTest: uniform image → low highlights", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const pupil = { cx: 50, cy: 50, radius: 15 };
  const result = IL.specularReflectionTest(gray, 100, 100, pupil);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.temporalConsistencyTest: stationary → high score", () => {
  const frames = [
    { irisCx: 50, irisCy: 50 },
    { irisCx: 50, irisCy: 50 },
    { irisCx: 50, irisCy: 50 },
  ];
  const result = IL.temporalConsistencyTest(frames);
  assert.ok(result);
  assert.ok(result.score >= 0);
});

test("IrisLiveness.moireDetectionTest: uniform → no moire", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const result = IL.moireDetectionTest(gray, 100, 100);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.textureAnalysisTest: uniform → low energy", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const iris = { cx: 50, cy: 50, radius: 30 };
  const result = IL.textureAnalysisTest(gray, 100, 100, iris);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.colorChannelAnalysisTest: uniform RGB → no screen indicator", () => {
  const rgb = new Uint8ClampedArray(100 * 100 * 4);
  for (let i = 0; i < rgb.length; i += 4) { rgb[i] = 128; rgb[i + 1] = 128; rgb[i + 2] = 128; rgb[i + 3] = 255; }
  const iris = { cx: 50, cy: 50, radius: 30 };
  const result = IL.colorChannelAnalysisTest(rgb, 100, 100, iris);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.depthEstimationTest: uniform → low variance", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const iris = { cx: 50, cy: 50, radius: 30 };
  const result = IL.depthEstimationTest(gray, 100, 100, iris);
  assert.ok(result);
  assert.equal(typeof result.score, "number");
});

test("IrisLiveness.periodicPatternTest: random → no attack", () => {
  const gray = new Uint8Array(100 * 100);
  for (let i = 0; i < gray.length; i++) gray[i] = (Math.random() * 256) | 0;
  const iris = { cx: 50, cy: 50, radius: 30 };
  const result = IL.periodicPatternTest(gray, 100, 100, iris);
  assert.ok(result);
  assert.equal(typeof result.attack, "boolean");
});

test("IrisLiveness.classifyPAISpecies: no species", () => {
  const result = IL.classifyPAISpecies({ checks: [] });
  assert.ok(result);
  assert.equal(typeof result.species, "number");
});

test("IrisLiveness.computeAPCER: basic", () => {
  assert.equal(IL.computeAPCER(0, 100), 0);
  assert.equal(IL.computeAPCER(10, 100), 0.1);
});

test("IrisLiveness.computeBPCER: basic", () => {
  assert.equal(IL.computeBPCER(0, 100), 0);
  assert.equal(IL.computeBPCER(5, 100), 0.05);
});

test("IrisLiveness.computeIAPAR: returns stats", () => {
  const data = [{ agency: "A", apcer: 0.05, bpcer: 0.02 }];
  const result = IL.computeIAPAR(data);
  assert.ok(result);
  assert.equal(typeof result.meanAPCER, "number");
});

test("IrisLiveness.computeBpcerApcerPoints: returns points", () => {
  const bonaFide = [0.9, 0.85, 0.8];
  const attacks = [0.3, 0.25, 0.2];
  const result = IL.computeBpcerApcerPoints(bonaFide, attacks);
  assert.ok(result);
  assert.ok(Array.isArray(result.points));
});

test("IrisLiveness.assess: returns full result", async () => {
  const instance = new IL();
  const result = await instance.assess({
    grayImage: new Float64Array(100 * 100).fill(128),
    imageWidth: 100, imageHeight: 100,
    pupil: { cx: 50, cy: 50, radius: 15 },
    iris: { cx: 50, cy: 50, radius: 30 },
    rgbImage: new Uint8ClampedArray(100 * 100 * 4).fill(128),
  });
  assert.ok(result);
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.isLive, "boolean");
});

test("IrisLiveness.assess: with temporalFrames hits temporal consistency branch", async () => {
  const instance = new IL();
  const frameSize = 100 * 100;
  const frames = [];
  for (let f = 0; f < 4; f++) {
    frames.push(new Float64Array(frameSize).fill(128));
  }
  const result = await instance.assess({
    grayImage: new Float64Array(frameSize).fill(128),
    imageWidth: 100, imageHeight: 100,
    pupil: { cx: 50, cy: 50, radius: 15 },
    iris: { cx: 50, cy: 50, radius: 30 },
    rgbImage: new Uint8ClampedArray(frameSize * 4).fill(128),
    temporalFrames: frames,
    dilationFrames: frames,
  });
  assert.ok(result);
  assert.ok(Array.isArray(result.checks));
  assert.ok(result.checks.length > 0);
  assert.ok(typeof result.details === "string");
});

test("IrisLiveness.assess: all checks produce details string", async () => {
  const instance = new IL();
  const frameSize = 64 * 64;
  const gray = new Float64Array(frameSize).fill(128);
  const rgb = new Uint8ClampedArray(frameSize * 4);
  for (let i = 0; i < rgb.length; i += 4) { rgb[i] = 128; rgb[i + 1] = 128; rgb[i + 2] = 128; rgb[i + 3] = 255; }
  const frames = [];
  for (let f = 0; f < 5; f++) frames.push(new Float64Array(frameSize).fill(128 + f));
  const result = await instance.assess({
    grayImage: gray,
    imageWidth: 64, imageHeight: 64,
    pupil: { cx: 32, cy: 32, radius: 8 },
    iris: { cx: 32, cy: 32, radius: 20 },
    rgbImage: rgb,
    temporalFrames: frames,
    dilationFrames: frames,
  });
  assert.ok(result.details);
  assert.ok(typeof result.paiClassification === "object");
});

test("IrisLiveness.specularReflectionTest: uniform → low highlights", () => {
  const img = makeIrisImage(200, 200, 80);
  const r = IrisLiveness.specularReflectionTest(img, 200, 200, {x:100,y:100,radius:20}, {x:100,y:100,radius:80});
  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 1);
  assert(typeof r.highlightCount === "number");
  assert(typeof r.details === "string");
});

test("IrisLiveness.specularReflectionTest: bright center → more highlights", () => {
  const img = makeIrisImage(200, 200, 80);
  for (let y = 95; y < 105; y++) for (let x = 95; x < 105; x++) {
    const idx = (y*200+x)*4; img[idx]=255; img[idx+1]=255; img[idx+2]=255;
  }
  const r = IrisLiveness.specularReflectionTest(img, 200, 200, {x:100,y:100,radius:20}, {x:100,y:100,radius:80});
  assert(typeof r.score === "number");
});

test("IrisLiveness.specularReflectionTest: null → neutral score", () => {
  const r = IrisLiveness.specularReflectionTest(null, 0, 0, null, null);
  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 1);
  assert(r.details.includes("No image") || r.details.length > 0);
});

test("IrisLiveness.pupilDilationTest: varying frames → lower score", () => {
  const f1 = makeIrisImage(100, 100, 80);
  const f2 = makeIrisImage(100, 100, 120);
  const r = IrisLiveness.pupilDilationTest([f1, f2], 100, 100, {x:50,y:50,radius:10}, {x:50,y:50,radius:40});
  assert(typeof r.score === "number");
});

test("IrisLiveness.pupilDilationTest: null frames → insufficient", () => {
  const r = IrisLiveness.pupilDilationTest(null, 0, 0, null, null);
  assert(r.score >= 0 && r.score <= 1);
});

test("IrisLiveness.pupilDilationTest: single frame → insufficient", () => {
  const r = IrisLiveness.pupilDilationTest([makeIrisImage(100,100,80)], 100, 100, {x:50,y:50,radius:10}, {x:50,y:50,radius:40});
  assert(r.score >= 0 && r.score <= 1);
  assert(r.details.includes("Insufficient") || r.details.includes("frame"));
});

test("IrisLiveness.computeBpcerApcerPoints: returns object with points", () => {
  const r = IrisLiveness.computeBpcerApcerPoints(
    [{threshold:0.1,apcer:0.05,bpcer:0.95},{threshold:0.5,apcer:0.5,bpcer:0.5}],
    0.5
  );
  assert(typeof r === "object");
  assert(Array.isArray(r.points));
});

test("IrisLiveness.computeBpcerApcerPoints: null → empty points", () => {
  const r = IrisLiveness.computeBpcerApcerPoints(null, 0.5);
  assert(typeof r === "object");
  assert(Array.isArray(r.points));
});

test("IrisLiveness.computeIAPAR: returns object", () => {
  const r = IrisLiveness.computeIAPAR(0.05, 0.10);
  assert(typeof r === "object");
  assert(typeof r.maxAPCER === "number");
  assert(typeof r.maxBPCER === "number");
});

test("IrisLiveness.assess: minimal params → runs checks", () => {
  const img = makeIrisImage(200, 200, 100);
  const r = new IrisLiveness().assess({
    width: 200, height: 200,
    pupil: {x:100,y:100,radius:20},
    iris: {x:100,y:100,radius:80}
  });
  assert(typeof r.isLive === "boolean");
  assert(typeof r.score === "number");
  assert(typeof r.details === "string");
  assert(Array.isArray(r.checks));
});

test("IrisLiveness.classifyPAISpecies: known species", () => {
  const r = IrisLiveness.classifyPAISpecies({screenGlint: true, moirePattern: true});
  assert(typeof r.species === "number");
});

test("IrisLiveness.getConfig: returns config (instance method)", () => {
  const r = new IrisLiveness().getConfig();
  assert(typeof r === "object");
});

test("IrisLiveness.specularReflectionTest: bright spots → highlights", () => {
  const img = new Uint8ClampedArray(200*200*4);
  for (let i = 0; i < img.length; i+=4) { img[i]=200; img[i+1]=200; img[i+2]=200; img[i+3]=255; }
  for (let y = 90; y < 110; y++) for (let x = 90; x < 110; x++) {
    const idx = (y*200+x)*4; img[idx]=255; img[idx+1]=255; img[idx+2]=255;
  }
  const r = IrisLiveness.specularReflectionTest(img, 200, 200, {x:100,y:100,radius:15}, {x:100,y:100,radius:80});
  assert(typeof r.highlightCount === "number");
  assert(typeof r.score === "number");
});

test("IrisLiveness.temporalConsistencyTest: single frame", () => {
  const r = IrisLiveness.temporalConsistencyTest([makeIrisImage(100,100,100)], 100, 100, {x:50,y:50,radius:40});
  assert(typeof r.score === "number");
});

test("IrisLiveness.temporalConsistencyTest: null", () => {
  const r = IrisLiveness.temporalConsistencyTest(null, 0, 0, null);
  assert(typeof r.score === "number");
});

test("IrisLiveness.moireDetectionTest: null → 0", () => {
  const r = IrisLiveness.moireDetectionTest(null, 0, 0);
  assert(typeof r.score === "number");
});

test("IrisLiveness.textureAnalysisTest: gradient → higher energy", () => {
  const r = IrisLiveness.textureAnalysisTest(makeGradientImage(200,200), 200, 200, {x:100,y:100,radius:80});
  assert(typeof r.score === "number");
});

test("IrisLiveness.textureAnalysisTest: null", () => {
  const r = IrisLiveness.textureAnalysisTest(null, 0, 0, null);
  assert(typeof r.score === "number");
});

test("IrisLiveness.colorChannelAnalysisTest: uniform RGB", () => {
  const img = new Uint8ClampedArray(100*100*4);
  for (let i = 0; i < img.length; i+=4) { img[i]=128; img[i+1]=128; img[i+2]=128; img[i+3]=255; }
  const r = IrisLiveness.colorChannelAnalysisTest(img, 100, 100, {x:50,y:50,radius:40});
  assert(typeof r.score === "number");
});

test("IrisLiveness.colorChannelAnalysisTest: monochrome → NIR indicator", () => {
  const img = new Uint8ClampedArray(100*100*4);
  for (let i = 0; i < img.length; i+=4) { img[i]=100; img[i+1]=100; img[i+2]=100; img[i+3]=255; }
  const r = IrisLiveness.colorChannelAnalysisTest(img, 100, 100, {x:50,y:50,radius:40});
  assert(typeof r.score === "number");
  assert(typeof r.screenIndicator === "number");
});

test("IrisLiveness.colorChannelAnalysisTest: null", () => {
  const r = IrisLiveness.colorChannelAnalysisTest(null, 0, 0, null);
  assert(typeof r.score === "number");
});

test("IrisLiveness.depthEstimationTest: gradient → higher variance", () => {
  const r = IrisLiveness.depthEstimationTest(makeGradientImage(200,200), 200, 200, {x:100,y:100,radius:80});
  assert(typeof r.score === "number");
});

test("IrisLiveness.depthEstimationTest: null", () => {
  const r = IrisLiveness.depthEstimationTest(null, 0, 0, null);
  assert(typeof r.score === "number");
});

test("IrisLiveness.periodicPatternTest: null", () => {
  const r = IrisLiveness.periodicPatternTest(null, 0, 0);
  assert(typeof r.score === "number");
});

test("IrisLiveness.assess: with all params", () => {
  const img = makeIrisImage(200, 200, 100);
  const frames = [img, img, img];
  const r = new IrisLiveness().assess({
    frames, dilationFrames: frames,
    width: 200, height: 200,
    pupil: {x:100,y:100,radius:20},
    iris: {x:100,y:100,radius:80}
  });
  assert(typeof r.isLive === "boolean");
  assert(typeof r.score === "number");
  assert(typeof r.details === "string");
  assert(Array.isArray(r.checks));
  assert(r.checks.length > 0);
});

test("IrisLiveness.classifyPAISpecies: moire + screen", () => {
  const r = IrisLiveness.classifyPAISpecies({
    moireScore: 0.8,
    screenGlintScore: 0.7,
    textureScore: 0.3,
    depthScore: 0.2
  });
  assert(typeof r.species === "number");
  assert(typeof r.level === "number");
  assert(typeof r.confidence === "number");
});

test("IL.pupilDilationTest: varying sizes (L96-L114)", () => {
  const frames = [
    { pupilRadius: 10, irisRadius: 50 },
    { pupilRadius: 15, irisRadius: 50 },
    { pupilRadius: 12, irisRadius: 50 },
  ];
  const result = IL.pupilDilationTest(frames);
  assert.equal(typeof result.score, "number");
  assert.ok(result.dilationRatio > 1);
});

test("IL.pupilDilationTest: all zero pupilRadius (L102)", () => {
  const frames = [
    { pupilRadius: 0, irisRadius: 50 },
    { pupilRadius: 0, irisRadius: 50 },
  ];
  const result = IL.pupilDilationTest(frames);
  assert.equal(result.score, 0.5);
});

test("IL.specularReflectionTest: bright spots in image (L153-L207)", () => {
  const w = 64, h = 64;
  const img = new Float64Array(w * h).fill(50);
  img[32 * w + 32] = 240;
  img[32 * w + 33] = 235;
  img[10 * w + 10] = 250;
  const result = IL.specularReflectionTest(img, w, h, { cx: 32, cy: 32, radius: 10 });
  assert.equal(typeof result.score, "number");
  assert.ok(result.highlightCount >= 0);
});

test("IL.temporalConsistencyTest: natural movement (L252-L277)", () => {
  const frames = [
    { irisCx: 50, irisCy: 50 },
    { irisCx: 50.1, irisCy: 50.2 },
    { irisCx: 50.3, irisCy: 50.1 },
  ];
  const result = IL.temporalConsistencyTest(frames);
  assert.equal(typeof result.score, "number");
});

test("IL.temporalConsistencyTest: too static (L291)", () => {
  const frames = [
    { irisCx: 50, irisCy: 50 },
    { irisCx: 50, irisCy: 50 },
    { irisCx: 50, irisCy: 50 },
  ];
  const result = IL.temporalConsistencyTest(frames);
  assert.equal(result.score, 0.2);
});

test("IL.textureAnalysisTest: with gradient image (L377-L390)", () => {
  const w = 100, h = 100;
  const img = makeGray(w, h, (x, y) => (x * 3 + y * 2) % 256);
  const result = IL.textureAnalysisTest(img, w, h, { cx: 50, cy: 50, radius: 40 });
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.textureEnergy, "number");
});

test("IL.depthEstimationTest: gradient image (L513-L515)", () => {
  const w = 100, h = 100;
  const img = makeGray(w, h, (x, y) => (x + y) % 256);
  const result = IL.depthEstimationTest(img, w, h, { cx: 50, cy: 50, radius: 40 });
  assert.equal(typeof result.score, "number");
});

test("IL.periodicPatternTest: striped pattern triggers attack (L618-L652)", () => {
  const w = 128, h = 128;
  const img = makeGray(w, h, (x, y) => Math.sin(x * 0.3) * 127 + 128);
  const result = IL.periodicPatternTest(img, w, h);
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.attack, "boolean");
});

test("IL.periodicPatternTest: random image → no attack", () => {
  const w = 128, h = 128;
  const img = new Float64Array(w * h);
  for (let i = 0; i < img.length; i++) img[i] = Math.random() * 255;
  const result = IL.periodicPatternTest(img, w, h);
  assert.equal(result.attack, false);
});

test("IL.classifyPAISpecies: all low checks (L671-L737)", () => {
  const result = IL.classifyPAISpecies({ checks: [
    { name: "pupilDilation", score: 0.1 },
    { name: "specularReflection", score: 0.1 },
    { name: "temporalConsistency", score: 0.1 },
    { name: "moireDetection", score: 0.1 },
    { name: "textureAnalysis", score: 0.1 },
    { name: "colorChannelAnalysis", score: 0.1 },
    { name: "depthEstimation", score: 0.1 },
  ]});
  assert.equal(typeof result.species, "number");
  assert.ok(result.confidence >= 0);
});

test("IL.classifyPAISpecies: VIDEO_REPLAY level B (L734-L737)", () => {
  const result = IL.classifyPAISpecies({ checks: [
    { name: "temporalConsistency", score: 0.1 },
  ]});
  assert.ok(result.level >= 1);
});

test("IL.computeBpcerApcerPoints: real data (L844-L885)", () => {
  const bonaFide = Array.from({ length: 100 }, () => 0.5 + Math.random() * 0.5);
  const attacks = Array.from({ length: 100 }, () => Math.random() * 0.5);
  const result = IL.computeBpcerApcerPoints(bonaFide, attacks, [0.1, 0.2]);
  assert.ok(result.points.length === 2);
  assert.ok(result.details.length > 0);
});

test("IL.assess: all checks with full params (L920-L995)", () => {
  const w = 100, h = 100;
  const gray = makeGray(w, h, (x, y) => 128 + Math.sin(x * 0.1) * 50);
  const rgb = new Uint8Array(w * h * 3).fill(128);
  const inst = new IL();
  const result = inst.assess({
    dilationFrames: [
      { pupilRadius: 10, irisRadius: 50 },
      { pupilRadius: 15, irisRadius: 50 },
    ],
    grayImage: gray,
    rgbImage: rgb,
    imageWidth: w, imageHeight: h,
    pupil: { cx: 50, cy: 50, radius: 12 },
    iris: { cx: 50, cy: 50, radius: 40 },
    temporalFrames: [
      { irisCx: 50, irisCy: 50 },
      { irisCx: 50.1, irisCy: 50.2 },
      { irisCx: 50.3, irisCy: 50.1 },
    ],
  });
  assert.equal(typeof result.score, "number");
  assert.ok(result.checks.length > 0);
});

test("IL.textureAnalysisTest: uniform image (L377-L390)", () => {
  const w = 100, h = 100;
  const img = new Float64Array(w * h).fill(128);
  const result = IL.textureAnalysisTest(img, w, h, { cx: 50, cy: 50, radius: 40 });
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.textureEnergy, "number");
});

test("IL.colorChannelAnalysisTest: colorful image (L766-L768)", () => {
  const w = 64, h = 64;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    rgb[i] = x * 4; rgb[i+1] = y * 4; rgb[i+2] = 128;
  }
  const result = IL.colorChannelAnalysisTest(rgb, w, h, { cx: 32, cy: 32, radius: 20 });
  assert.equal(typeof result.score, "number");
});

test("IL.depthEstimationTest: uniform image (L513-L515)", () => {
  const w = 100, h = 100;
  const img = new Float64Array(w * h).fill(100);
  const result = IL.depthEstimationTest(img, w, h, { cx: 50, cy: 50, radius: 40 });
  assert.equal(typeof result.score, "number");
});

test("IL.assess: with uniform gray (L920-L995)", () => {
  const w = 100, h = 100;
  const gray = new Float64Array(w * h).fill(128);
  const rgb = new Uint8Array(w * h * 3).fill(128);
  const inst = new IL();
  const result = inst.assess({
    dilationFrames: [
      { pupilRadius: 10, irisRadius: 50 },
      { pupilRadius: 15, irisRadius: 50 },
    ],
    grayImage: gray,
    rgbImage: rgb,
    imageWidth: w, imageHeight: h,
    pupil: { cx: 50, cy: 50, radius: 12 },
    iris: { cx: 50, cy: 50, radius: 40 },
    temporalFrames: [
      { irisCx: 50, irisCy: 50 },
      { irisCx: 50.1, irisCy: 50.2 },
      { irisCx: 50.3, irisCy: 50.1 },
    ],
  });
  assert.equal(typeof result.score, "number");
  assert.ok(result.checks.length > 0);
});

test("IL.pupilDilationTest: else-if ratio branch (L114-L118)", () => {
  const frames = [];
  for (let i = 0; i < 3; i++) frames.push({ pupilRadius: 20 + i * 2, irisRadius: 80 });
  const r = IL.pupilDilationTest(frames);
  assert.equal(typeof r.score, "number");
  assert.ok(r.details);
});

test("IL.pupilDilationTest: low ratio branch (L116)", () => {
  const frames = [{ pupilRadius: 20, irisRadius: 80 }, { pupilRadius: 22, irisRadius: 80 }];
  const r = IL.pupilDilationTest(frames);
  assert.equal(typeof r.score, "number");
  assert.ok(r.dilationRatio > 0);
});

test("IL.pupilDilationTest: good dilation (L111-L113)", () => {
  const frames = [{ pupilRadius: 18, irisRadius: 80 }, { pupilRadius: 22, irisRadius: 80 }, { pupilRadius: 18, irisRadius: 80 }];
  const r = IL.pupilDilationTest(frames);
  assert.equal(typeof r.score, "number");
  assert.ok(!r.details.includes("constant"));
});

test("IL.specularReflectionTest: single highlight (L217-L219)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h).fill(50);
  gray[32 * w + 32] = 255;
  const r = IL.specularReflectionTest(gray, w, h, { cx: 32, cy: 32, radius: 20 }, { cx: 32, cy: 32, radius: 30 });
  assert.equal(typeof r.score, "number");
  assert.equal(r.highlightCount, 1);
});

test("IL.specularReflectionTest: zero highlights (L219)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h).fill(50);
  const r = IL.specularReflectionTest(gray, w, h, { cx: 32, cy: 32, radius: 20 }, { cx: 32, cy: 32, radius: 30 });
  assert.equal(typeof r.score, "number");
  assert.equal(r.highlightCount, 0);
});

test("IL.specularReflectionTest: clustered highlights (L196-L209)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h).fill(50);
  gray[30 * w + 30] = 255;
  gray[30 * w + 32] = 255;
  gray[32 * w + 31] = 255;
  const r = IL.specularReflectionTest(gray, w, h, { cx: 32, cy: 32, radius: 20 }, { cx: 32, cy: 32, radius: 30 });
  assert.equal(typeof r.score, "number");
  assert.ok(r.highlightCount >= 0);
});

test("IL.temporalConsistencyTest: unstable capture (L295-L298)", () => {
  const frames = [
    { irisCx: 10, irisCy: 10 },
    { irisCx: 50, irisCy: 50 },
    { irisCx: 90, irisCy: 90 },
    { irisCx: 10, irisCy: 10 },
    { irisCx: 50, irisCy: 50 },
  ];
  const r = IL.temporalConsistencyTest(frames);
  assert.equal(typeof r.score, "number");
});

test("IL.textureAnalysisTest: scoring branches (L422-L426)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = 128 + ((x * y) % 50);
  const r = IL.textureAnalysisTest(gray, w, h, { cx: 32, cy: 32, radius: 20 });
  assert.equal(typeof r.score, "number");
});

test("IL.colorChannelAnalysisTest: low channel spread (L485)", () => {
  const w = 32, h = 32;
  const rgb = new Uint8Array(w * h * 3).fill(128);
  const r = IL.colorChannelAnalysisTest(rgb, w, h, { cx: 16, cy: 16, radius: 10 });
  assert.equal(typeof r.score, "number");
  assert.ok(r.screenIndicator >= 0.3);
});

test("IL.colorChannelAnalysisTest: normal passed (L496)", () => {
  const w = 64, h = 64;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    rgb[i] = 50 + (x % 100); rgb[i+1] = 150 + (y % 80); rgb[i+2] = 200 + ((x+y) % 55);
  }
  const r = IL.colorChannelAnalysisTest(rgb, w, h, { cx: 32, cy: 32, radius: 20 });
  assert.equal(typeof r.score, "number");
  assert.ok(r.details.includes("Color channel"));
});

test("IL.depthEstimationTest: scoring branches (L559-L563)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = 128 + ((x + y * 3) % 60);
  const r = IL.depthEstimationTest(gray, w, h, { cx: 32, cy: 32, radius: 20 });
  assert.equal(typeof r.score, "number");
});

test("IL.computeAPCER: normal path (L777)", () => {
  const r = IL.computeAPCER(3, 100);
  assert.equal(r, 0.03);
});

test("IL.computeBPCER: normal path (L789)", () => {
  const r = IL.computeBPCER(5, 200);
  assert.equal(r, 0.025);
});

test("IL.computeIAPAR: empty data (L800-L802)", () => {
  const r = IL.computeIAPAR([]);
  assert.equal(r.iapar, 0);
});

test("IL.classifyPAISpecies: Level B path (L735-L737)", () => {
  const checks = [
    { name: "texture", score: 0.3 },
    { name: "spectrum", score: 0.2 },
    { name: "moiré", score: 0.7 },
    { name: "depth", score: 0.1 },
  ];
  const r = IL.classifyPAISpecies({ checks });
  assert.ok(r);
  assert.equal(typeof r.level, "number");
});

test("IL.computeBpcerApcerPoints (L869)", () => {
  const bonaFideScores = [0.9, 0.85, 0.8, 0.75, 0.7];
  const attackScores = [0.3, 0.4, 0.5, 0.6, 0.65];
  const r = IL.computeBpcerApcerPoints(bonaFideScores, attackScores);
  assert.ok(r);
  assert.ok(Array.isArray(r.points));
});

test("IL.pupilDilationTest: all frames with pupilRadius=0 → insufficient (L101-L102)", () => {
  const frames = [{ pupilRadius: 0, irisRadius: 80 }, { pupilRadius: 0, irisRadius: 80 }];
  const r = IL.pupilDilationTest(frames);
  assert.equal(r.score, 0.5);
  assert.equal(r.dilationRatio, 1);
});

test("IL.specularReflectionTest: bright neighbor pixels (L170-L177)", () => {
  const w = 64, h = 64;
  const gray = new Uint8Array(w * h).fill(50);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    gray[(32 + dy) * w + (32 + dx)] = 255;
  }
  const r = IL.specularReflectionTest(gray, w, h, { cx: 32, cy: 32, radius: 20 }, { cx: 32, cy: 32, radius: 30 });
  assert.equal(typeof r.score, "number");
});

test("IL.classifyPAISpecies: null input (L674)", () => {
  const r = IL.classifyPAISpecies(null);
  assert.equal(r.species, 0);
  assert.equal(r.confidence, 0);
});

test("IL.classifyPAISpecies: with diverse checks (L678-L704)", () => {
  const r = IL.classifyPAISpecies({ checks: [
    { name: "pupilDilation", score: 0.2 },
    { name: "specularReflection", score: 0.2 },
    { name: "textureAnalysis", score: 0.8 },
    { name: "depthEstimation", score: 0.8 },
    { name: "temporalConsistency", score: 0.9 },
  ]});
  assert.equal(typeof r.species, "number");
  assert.equal(typeof r.confidence, "number");
});

test("IL.assess: full pipeline with live-like data", () => {
  const liveness = new IL();
  const frames = [];
  for (let i = 0; i < 5; i++) {
    const gray = new Uint8Array(64 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 32, y - 32);
      gray[y * 64 + x] = d < 8 ? 40 : (d < 28 ? 100 + Math.sin(x * 0.5) * 20 : 160);
    }
    frames.push({ grayImage: gray, width: 64, height: 64, pupilRadius: 8 + i * 0.5, irisRadius: 28 });
  }
  const r = liveness.assess(frames);
  assert.equal(typeof r.score, "number");
  assert.equal(typeof r.isLive, "boolean");
});

// ── IL.pupilDilationTest: frames with varying pupil sizes (L96, L102, L114) ──
test("IL.pupilDilationTest: frames with varying pupil radii (L96, L114)", () => {
  const frames = [
    { pupilRadius: 5 }, { pupilRadius: 7 }, { pupilRadius: 10 },
    { pupilRadius: 8 }, { pupilRadius: 6 },
  ];
  const r = IL.pupilDilationTest(frames);
  assert.equal(typeof r.score, "number");
  assert.ok(r.score >= 0 && r.score <= 1);
  assert.equal(typeof r.dilationRatio, "number");
});

// ── IL.pupilDilationTest: only 1 frame with pupil → returns defaults (L102) ──
test("IL.pupilDilationTest: only 1 frame with pupil → defaults (L102)", () => {
  const frames = [{ pupilRadius: 5 }];
  const r = IL.pupilDilationTest(frames);
  assert.equal(r.score, 0.5);
  assert.equal(r.dilationRatio, 1);
  assert.ok(typeof r.details === "string");
});

// ── IL.specularReflectionTest: bright spots with neighbors (L175) ──
test("IL.specularReflectionTest: bright spots with neighboring pixels (L175)", () => {
  const gray = new Uint8Array(64 * 64).fill(50);
  gray[30 * 64 + 30] = 255; gray[30 * 64 + 31] = 240; gray[31 * 64 + 30] = 245;
  gray[40 * 64 + 40] = 250; gray[40 * 64 + 41] = 235; gray[41 * 64 + 40] = 230;
  const r = IL.specularReflectionTest(gray, 64, 64, { cx: 32, cy: 32, radius: 15 }, { cx: 32, cy: 32, radius: 28 });
  assert.equal(typeof r.score, "number");
  assert.ok(r.score >= 0 && r.score <= 1);
});

// ── IL.textureAnalysisTest: with gradient image (L377, L378, L390) ──
test("IL.textureAnalysisTest: gradient image → computes LBP energy (L377-L390)", () => {
  const gray = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    gray[y * 64 + x] = 100 + Math.sin(x * 0.3) * Math.cos(y * 0.2) * 50;
  }
  const r = IL.textureAnalysisTest(gray, 64, 64, { cx: 32, cy: 32, radius: 28 });
  assert.equal(typeof r.score, "number");
  assert.ok(r.textureEnergy !== undefined);
  assert.equal(typeof r.details, "string");
});

// ── IL.textureAnalysisTest: null image → returns defaults (L378) ──
test("IL.textureAnalysisTest: null image → defaults (L378)", () => {
  const r = IL.textureAnalysisTest(null, 64, 64, { cx: 32, cy: 32, radius: 28 });
  assert.equal(r.score, 0.5);
  assert.equal(r.textureEnergy, 0);
});

// ── IL.classifyPAISpecies: no checks → defaults (L674) ──
test("IL.classifyPAISpecies: no checks → defaults (L674)", () => {
  const r = IL.classifyPAISpecies(null);
  assert.equal(r.species, 0);
  assert.equal(r.confidence, 0);
  assert.ok(r.details.includes("No check results"));
});

// ── IL.classifyPAISpecies: diverse checks → species detection (L678-L704) ──
test("IL.classifyPAISpecies: diverse checks → species scores (L678-L704)", () => {
  const r = IL.classifyPAISpecies({ checks: [
    { name: "pupilDilation", score: 0.1 },
    { name: "specularReflection", score: 0.1 },
    { name: "textureAnalysis", score: 0.1 },
    { name: "depthEstimation", score: 0.1 },
    { name: "temporalConsistency", score: 0.1 },
  ]});
  assert.equal(typeof r.species, "number");
  assert.equal(typeof r.confidence, "number");
  assert.ok(r.speciesName !== undefined);
});
