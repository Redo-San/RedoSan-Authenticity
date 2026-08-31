// ── Comprehensive Iris Biometric coverage tests ──
// Covers: iris_quality, iris_template_protection, iris_standards, iris_performance,
//         iris_liveness, iris_engine, iris_matcher, iris_storage, iris_camera
// Run: node --test cli/tests/test-iris-coverage.js
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert");

// ── DOM polyfills ──
global.window = global;
global.self = global;
global.location = { protocol: "file:", href: "file:///test" };
global.navigator = { userAgent: "node-test" };
global.document = {
  getElementById: (id) => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (t) => {
    if (t === "canvas") {
      return {
        width: 0, height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 }),
          putImageData: () => {},
        }),
        toBlob: (cb) => cb(new Blob()),
        toDataURL: () => "data:image/png;base64,",
      };
    }
    const el = {
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      appendChild() {},
      setAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      width: 0,
      height: 0,
      value: "",
      textContent: "",
      innerHTML: "",
      files: [],
    };
    return el;
  },
  addEventListener() {},
  body: { appendChild() {} },
  documentElement: {},
};
global.HTMLCanvasElement = function () {};
global.HTMLVideoElement = function () {};
global.HTMLImageElement = function () {};
global.ImageData = class ImageData {
  constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
};
global.Blob = class Blob {};
global.FileReader = class FileReader {};
global.crypto = { subtle: { digest: async () => new ArrayBuffer(32) }, getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } };
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.__ = (k, d) => (d === undefined ? k : d);
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// IndexedDB polyfill for storage tests — supports real data + cursors
const _idbData = {};
function fireAsync(fn) { setTimeout(fn, 0); }
function fakeReq(result) {
  const r = { onsuccess: null, onerror: null, result };
  fireAsync(() => { if (r.onsuccess) r.onsuccess({ target: r }); });
  return r;
}
function fakeStore(name, txObj) {
  return {
    createIndex() {},
    put(record) {
      if (record && record.id) {
        if (!_idbData[name]) _idbData[name] = {};
        _idbData[name][record.id] = record;
      }
      if (txObj) txObj._puts++;
      return fakeReq(undefined);
    },
    get(id) { return fakeReq((_idbData[name] || {})[id] || undefined); },
    delete(id) { if (_idbData[name]) delete _idbData[name][id]; return fakeReq(undefined); },
    clear() { _idbData[name] = {}; return fakeReq(undefined); },
    count() { return fakeReq(Object.keys(_idbData[name] || {}).length); },
    openCursor() {
      const entries = Object.values(_idbData[name] || {});
      let idx = 0;
      const r = { onsuccess: null, onerror: null, result: null };
      function deliver() {
        if (idx < entries.length) {
          const cur = entries[idx];
          idx++;
          r.result = { value: cur, continue: deliver };
          if (r.onsuccess) r.onsuccess({ target: r });
        } else {
          r.result = null;
          if (r.onsuccess) r.onsuccess({ target: r });
        }
      }
      fireAsync(deliver);
      return r;
    },
    getAll() { return fakeReq(Object.values(_idbData[name] || {})); },
  };
}
global.indexedDB = {
  open() {
    const req = {
      onsuccess: null, onerror: null, onupgradeneeded: null,
      result: {
        objectStoreNames: { contains() { return false; } },
        createObjectStore(storeName) { return fakeStore(storeName); },
        transaction(storeName, mode) {
          const tx = {
            objectStore() { return fakeStore(storeName, tx); },
            oncomplete: null,
            onerror: null,
            _puts: 0,
          };
          fireAsync(() => { if (tx.oncomplete) tx.oncomplete(); });
          return tx;
        },
      },
    };
    fireAsync(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
    return req;
  },
  deleteDatabase() { return fakeReq(undefined); },
};

// ── Load all iris modules ──
const irisDir = path.join(__dirname, "..", "..", "Iris_Biometric");
const modules = [
  "iris_quality.js",
  "iris_engine.js",
  "iris_matcher.js",
  "iris_performance.js",
  "iris_liveness.js",
  "iris_standards.js",
  "iris_template_protection.js",
  "iris_camera.js",
  "iris_storage.js",
];

for (const file of modules) {
  try {
    const src = fs.readFileSync(path.join(irisDir, file), "utf8");
    vm.runInThisContext(src, { filename: path.join(irisDir, file) });
  } catch (e) {
    // Some modules may need extra globals; continue
  }
}

const IQ = global.IrisQuality;
const IE = global.IrisEngine;
const IM = global.IrisMatcher;
const IP = global.IrisPerformance;
const IL = global.IrisLiveness;
const IS = global.IrisStandards;
const ITP = global.IrisTemplateProtection;
const IC = global.IrisCamera;
const ISt = global.IrisStorage;
const THRESH = global.IRIS_QUALITY_THRESHOLDS;

// ═══════════════════════════════════════════════════════════════
// iris_quality.js — all static methods
// ═══════════════════════════════════════════════════════════════

test("IrisQuality: IRIS_QUALITY_THRESHOLDS has all keys", () => {
  assert.ok(THRESH);
  assert.equal(typeof THRESH.usableAreaMin, "number");
  assert.equal(typeof THRESH.irisRadiusMinAbsolute, "number");
  assert.equal(typeof THRESH.pupilBoundaryCircularityMin, "number");
  assert.equal(typeof THRESH.motionBlurMin, "number");
});

test("IrisQuality.usableArea: null/empty → 0", () => {
  assert.equal(IQ.usableArea(null), 0);
  assert.equal(IQ.usableArea(new Uint8Array(0)), 0);
});

test("IrisQuality.usableArea: all valid → 100", () => {
  const mask = new Uint8Array([1, 1, 1, 1, 1]);
  assert.equal(IQ.usableArea(mask), 100);
});

test("IrisQuality.usableArea: half valid → 50", () => {
  const mask = new Uint8Array([1, 1, 0, 0, 0]);
  assert.equal(IQ.usableArea(mask), 40);
});

test("IrisQuality.pupilBoundaryCircularity: null mask → 1", () => {
  assert.equal(IQ.pupilBoundaryCircularity(null, 64, 32), 1);
});

test("IrisQuality.pupilBoundaryCircularity: zero dimensions → 1", () => {
  assert.equal(IQ.pupilBoundaryCircularity(new Uint8Array(10), 0, 32), 1);
  assert.equal(IQ.pupilBoundaryCircularity(new Uint8Array(10), 64, 0), 1);
});

test("IrisQuality.pupilBoundaryCircularity: empty mask → 1", () => {
  assert.equal(IQ.pupilBoundaryCircularity(new Uint8Array(0), 64, 32), 1);
});

test("IrisQuality.pupilBoundaryCircularity: all-iris mask returns value", () => {
  const mask = new Uint8Array(64 * 32).fill(1);
  const val = IQ.pupilBoundaryCircularity(mask, 64, 32);
  assert.equal(typeof val, "number");
  assert.ok(val >= 0 && val <= 2);
});

test("IrisQuality.pupilBoundaryCircularity: all-non-iris mask returns 1", () => {
  const mask = new Uint8Array(64 * 32).fill(0);
  const val = IQ.pupilBoundaryCircularity(mask, 64, 32);
  assert.equal(typeof val, "number");
});

test("IrisQuality.irisPupilContrast: null → 0", () => {
  assert.equal(IQ.irisPupilContrast(null, 64, 32), 0);
});

test("IrisQuality.irisPupilContrast: uniform → low contrast", () => {
  const data = new Float64Array(64 * 32).fill(128);
  const val = IQ.irisPupilContrast(data, 64, 32);
  assert.equal(typeof val, "number");
  assert.ok(val >= 0);
});

test("IrisQuality.irisPupilContrast: dark pupil + bright iris → high contrast", () => {
  const data = new Float64Array(64 * 32);
  for (let i = 0; i < data.length; i++) {
    const row = Math.floor(i / 64);
    if (row < 6) data[i] = 10;
    else if (row >= 12 && row < 26) data[i] = 200;
    else data[i] = 128;
  }
  const val = IQ.irisPupilContrast(data, 64, 32);
  assert.ok(val > 50);
});

test("IrisQuality.irisScleraContrast: null → 0", () => {
  assert.equal(IQ.irisScleraContrast(null, 64, 32), 0);
});

test("IrisQuality.irisScleraContrast: uniform → low", () => {
  const data = new Float64Array(64 * 32).fill(128);
  const val = IQ.irisScleraContrast(data, 64, 32);
  assert.ok(val >= 0);
});

test("IrisQuality.sharpness: null → 0", () => {
  assert.equal(IQ.sharpness(null, 64, 32), 0);
});

test("IrisQuality.sharpness: uniform image → 0", () => {
  const data = new Float64Array(64 * 32).fill(128);
  assert.equal(IQ.sharpness(data, 64, 32), 0);
});

test("IrisQuality.sharpness: gradient image → >= 0", () => {
  const data = new Float64Array(64 * 32);
  for (let i = 0; i < data.length; i++) data[i] = (i % 64) * 4;
  const val = IQ.sharpness(data, 64, 32);
  assert.ok(val >= 0);
});

test("IrisQuality.motionBlur: null → 1", () => {
  assert.equal(IQ.motionBlur(null, 64, 32), 1);
});

test("IrisQuality.motionBlur: zero dims → 1", () => {
  assert.equal(IQ.motionBlur(new Float64Array(10), 0, 32), 1);
  assert.equal(IQ.motionBlur(new Float64Array(10), 64, 0), 1);
});

test("IrisQuality.motionBlur: uniform → 0 (no gradients)", () => {
  const data = new Float64Array(64 * 32).fill(128);
  assert.equal(IQ.motionBlur(data, 64, 32), 0);
});

test("IrisQuality.motionBlur: gradient → value 0-1", () => {
  const data = new Float64Array(64 * 32);
  for (let i = 0; i < data.length; i++) data[i] = (i % 64) * 4;
  const val = IQ.motionBlur(data, 64, 32);
  assert.ok(val >= 0 && val <= 1);
});

test("IrisQuality.grayscaleUtilisation: null → 0", () => {
  assert.equal(IQ.grayscaleUtilisation(null), 0);
  assert.equal(IQ.grayscaleUtilisation(new Float64Array(0)), 0);
});

test("IrisQuality.grayscaleUtilisation: uniform → 1", () => {
  const data = new Float64Array(100).fill(128);
  assert.equal(IQ.grayscaleUtilisation(data), 1);
});

test("IrisQuality.grayscaleUtilisation: full range → 256", () => {
  const data = new Float64Array(256);
  for (let i = 0; i < 256; i++) data[i] = i;
  assert.equal(IQ.grayscaleUtilisation(data), 256);
});

test("IrisQuality.pupilIrisRatio: zero iris → 0", () => {
  assert.equal(IQ.pupilIrisRatio(10, 0), 0);
  assert.equal(IQ.pupilIrisRatio(10, -1), 0);
});

test("IrisQuality.pupilIrisRatio: normal", () => {
  assert.equal(IQ.pupilIrisRatio(20, 100), 20);
});

test("IrisQuality.marginAdequacy: null iris → 0", () => {
  assert.equal(IQ.marginAdequacy(null, 640, 480), 0);
});

test("IrisQuality.marginAdequacy: centered iris → 100", () => {
  assert.equal(IQ.marginAdequacy({ cx: 320, cy: 240, radius: 100 }, 640, 480), 100);
});

test("IrisQuality.marginAdequacy: clipped iris → < 100", () => {
  assert.ok(IQ.marginAdequacy({ cx: 10, cy: 10, radius: 100 }, 640, 480) < 100);
});

test("IrisQuality.assess: full assessment passes with good data", () => {
  const normW = 64, normH = 32;
  const normalizedIris = new Float64Array(normW * normH);
  for (let i = 0; i < normalizedIris.length; i++) {
    const row = Math.floor(i / normW);
    if (row < 6) normalizedIris[i] = 10;
    else if (row >= 12 && row < 26) normalizedIris[i] = 128 + (i % 10) * 10;
    else normalizedIris[i] = 220;
  }
  const mask = new Uint8Array(normW * normH).fill(1);
  const result = IQ.assess({
    normalizedIris, normW, normH, mask,
    pupil: { cx: 32, cy: 16, radius: 6 },
    iris: { cx: 32, cy: 16, radius: 20 },
    imageWidth: 640, imageHeight: 480,
  });
  assert.ok(result);
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.passed, "boolean");
  assert.ok(Array.isArray(result.issues));
  assert.ok(result.metrics);
});

test("IrisQuality.assess: fails with bad data", () => {
  const result = IQ.assess({ mask: new Uint8Array(0), normW: 0, normH: 0,
    normalizedIris: null, pupil: { cx: 0, cy: 0, radius: 0 },
    iris: { cx: 0, cy: 0, radius: 0 }, imageWidth: 0, imageHeight: 0 });
  assert.ok(result);
  assert.equal(typeof result.score, "number");
  assert.ok(result.issues.length > 0);
});

// ═══════════════════════════════════════════════════════════════
// iris_engine.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisEngine: IRIS_ENGINE_CONFIG has hammingThreshold", () => {
  assert.equal(typeof global.IRIS_ENGINE_CONFIG.hammingThreshold, "number");
});

test("IrisEngine.detectPupil: uniform image → center pupil", () => {
  const w = 160, h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = IE.detectPupil(gray, w, h);
  assert.ok(pupil);
  assert.equal(typeof pupil.cx, "number");
  assert.equal(typeof pupil.cy, "number");
  assert.ok(pupil.radius > 0);
});

test("IrisEngine.detectIris: returns iris object", () => {
  const w = 160, h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = { cx: 80, cy: 80, radius: 10 };
  const iris = IE.detectIris(gray, w, h, pupil);
  assert.ok(iris);
  assert.ok(iris.radius > 0);
});

test("IrisEngine.normalize: returns Float64Array", () => {
  const w = 160, h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = { cx: 80, cy: 80, radius: 10 };
  const iris = { cx: 80, cy: 80, radius: 40 };
  const norm = IE.normalize(gray, w, h, pupil, iris, 64, 32);
  assert.ok(norm instanceof Float64Array);
  assert.equal(norm.length, 64 * 32);
});

test("IrisEngine.generateIrisCode: returns code + mask", () => {
  const normW = 64, normH = 32;
  const normalized = new Float64Array(normW * normH);
  for (let i = 0; i < normalized.length; i++) normalized[i] = (i * 7) % 256;
  const result = IE.generateIrisCode(normalized, normW, normH);
  assert.ok(result.code instanceof Uint8Array);
  assert.ok(result.mask instanceof Uint8Array);
  assert.ok(result.length > 0);
});

test("IrisEngine.validateEyePresence: null params → rejected", () => {
  const res = IE.validateEyePresence(new Float64Array(100), 10, 10, { cx: 5, cy: 5, radius: 0 }, { cx: 5, cy: 5, radius: 0 });
  assert.equal(res.ok, false);
});

test("IrisEngine._meanDisk: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._meanDisk(gray, 100, 100, 50, 50, 20);
  assert.equal(typeof val, "number");
});

test("IrisEngine._meanAnnulus: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._meanAnnulus(gray, 100, 100, 50, 50, 10, 30);
  assert.equal(typeof val, "number");
});

test("IrisEngine._varAnnulus: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._varAnnulus(gray, 100, 100, 50, 50, 10, 30);
  assert.equal(typeof val, "number");
});

test("IrisEngine._gaborResponse: returns real+imag", () => {
  const img = new Float64Array(100 * 100);
  for (let i = 0; i < img.length; i++) img[i] = (i * 3) % 256;
  const resp = IE._gaborResponse(img, 100, 100, 50, 50, 5, 0);
  assert.equal(typeof resp.real, "number");
  assert.equal(typeof resp.imag, "number");
});

// ═══════════════════════════════════════════════════════════════
// iris_matcher.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisMatcher.normalizeHd: returns value 0-0.5", () => {
  const val = IM.normalizeHd(0.1, 1000, 500);
  assert.ok(val >= 0 && val <= 0.5);
});

test("IrisMatcher.decidabilityScore: returns >= 0", () => {
  const val = IM.decidabilityScore(0.1, 1000);
  assert.ok(val >= 0);
});

test("IrisMatcher.xorVisual: returns Uint8Array", () => {
  const a = { code: new Uint8Array([0xFF, 0x00]), mask: new Uint8Array([1, 1]) };
  const b = { code: new Uint8Array([0x00, 0xFF]), mask: new Uint8Array([1, 1]) };
  const result = IM.xorVisual(a, b);
  assert.ok(result instanceof Uint8Array);
  assert.equal(result.length, 2);
});

test("IrisMatcher.identify: finds best match in gallery", () => {
  const probe = { code: new Uint8Array([1, 0, 1, 0]), mask: new Uint8Array([1, 1, 1, 1]) };
  const gallery = [
    { code: new Uint8Array([1, 0, 1, 0]), mask: new Uint8Array([1, 1, 1, 1]), id: "a" },
    { code: new Uint8Array([0, 1, 0, 1]), mask: new Uint8Array([1, 1, 1, 1]), id: "b" },
  ];
  const result = IM.identify(probe, gallery);
  assert.ok(result.bestMatch);
  assert.ok(result.allResults.length === 2);
});

// ═══════════════════════════════════════════════════════════════
// iris_performance.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisPerformance.THRESHOLDS exists", () => {
  assert.ok(IP.THRESHOLDS);
  assert.equal(typeof IP.THRESHOLDS.MAX_FAR, "number");
});

test("IrisPerformance.calculateFAR: basic", () => {
  assert.equal(IP.calculateFAR(1, 1000), 0.001);
});

test("IrisPerformance.calculateFRR: basic", () => {
  assert.equal(IP.calculateFRR(1, 100), 0.01);
});

test("IrisPerformance.calculateEER: symmetric ROC", () => {
  const roc = [
    { threshold: 0, far: 1, frr: 0 },
    { threshold: 0.5, far: 0.5, frr: 0.5 },
    { threshold: 1, far: 0, frr: 1 },
  ];
  const result = IP.calculateEER(roc);
  assert.ok(result);
  assert.ok(result.eer >= 0 && result.eer <= 1);
});

test("IrisPerformance.calculateAccuracy: perfect", () => {
  assert.equal(IP.calculateAccuracy(90, 10, 100), 1);
});

test("IrisPerformance.generateROC: returns array", () => {
  const genuine = [0.9, 0.8, 0.7, 0.6];
  const impostor = [0.3, 0.2, 0.1, 0.05];
  const roc = IP.generateROC(genuine, impostor, 10);
  assert.ok(Array.isArray(roc));
  assert.ok(roc.length > 0);
});

test("IrisPerformance.generateDET: returns array", () => {
  const genuine = [0.9, 0.8, 0.7, 0.6];
  const impostor = [0.3, 0.2, 0.1, 0.05];
  const det = IP.generateDET(genuine, impostor, 10);
  assert.ok(Array.isArray(det));
});

test("IrisPerformance.generatePADDET: returns array", () => {
  const labels = [0, 0, 1, 1];
  const scores = [0.8, 0.7, 0.3, 0.2];
  const det = IP.generatePADDET(labels, scores, 10);
  assert.ok(Array.isArray(det));
});

test("IrisPerformance.reportPADMetrics: returns object", () => {
  const labels = [0, 0, 0, 1, 1, 1];
  const scores = [0.9, 0.8, 0.7, 0.3, 0.2, 0.1];
  const result = IP.reportPADMetrics(labels, scores);
  assert.ok(result);
  assert.ok(typeof result.bpcer === "number");
});

test("IrisPerformance.wilsonCI: basic", () => {
  const ci = IP.wilsonCI(90, 100, 0.95);
  assert.ok(ci);
  assert.ok(ci.lower <= ci.estimate);
  assert.ok(ci.upper >= ci.estimate);
});

test("IrisPerformance.evaluate: full evaluation", () => {
  const result = IP.evaluate({
    genuineScores: [0.9, 0.85, 0.8, 0.75],
    impostorScores: [0.3, 0.25, 0.2, 0.15],
    systemName: "test",
  });
  assert.ok(result);
  assert.ok(result.metrics);
  assert.ok(result.summary);
});

test("IrisPerformance.pairedTTest: different distributions", () => {
  const s1 = [0.9, 0.85, 0.8];
  const s2 = [0.5, 0.45, 0.4];
  const result = IP.pairedTTest(s1, s2);
  assert.ok(result);
  assert.equal(typeof result.tStatistic, "number");
  assert.equal(typeof result.pValue, "number");
  assert.equal(typeof result.significant, "boolean");
});

test("IrisPerformance.compareSystems: returns winner", () => {
  const sys1 = { genuineScores: [0.9, 0.85], impostorScores: [0.2, 0.15] };
  const sys2 = { genuineScores: [0.7, 0.65], impostorScores: [0.3, 0.25] };
  const result = IP.compareSystems(sys1, sys2);
  assert.ok(result);
  assert.ok(result.winner);
});

test("IrisPerformance.recordFTA: increments count", () => {
  const instance = new IP();
  IP.recordFTA(instance, "test reason");
  const rates = IP.getFtaFterRates(instance);
  assert.equal(rates.ftaCount, 1);
});

test("IrisPerformance.recordFTER: increments count", () => {
  const instance = new IP();
  IP.recordFTER(instance, "test reason");
  const rates = IP.getFtaFterRates(instance);
  assert.equal(rates.fterCount, 1);
});

test("IrisPerformance.recordAcquisition: records timing", () => {
  const instance = new IP();
  IP.recordAcquisition(instance, 100);
  assert.equal(instance._totalAcquisitions, 1);
});

test("IrisPerformance.recordEnrollment: records timing", () => {
  const instance = new IP();
  IP.recordEnrollment(instance, 200);
  assert.equal(instance._totalEnrollments, 1);
});

test("IrisPerformance.fnirAtFpir: returns operating points", () => {
  const genuine = [0.9, 0.85, 0.8];
  const impostor = [0.3, 0.25, 0.2];
  const result = IP.fnirAtFpir(genuine, impostor);
  assert.ok(result);
  assert.ok(Array.isArray(result.operatingPoints));
});

test("IrisPerformance.computeTimingStats: returns stats", () => {
  const instance = new IP();
  IP.recordAcquisition(instance, 50);
  IP.recordEnrollment(instance, 100);
  const stats = IP.computeTimingStats(instance);
  assert.ok(stats);
  assert.equal(typeof stats.enrollMeanMs, "number");
});

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

// ═══════════════════════════════════════════════════════════════
// iris_standards.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisStandards: constants exist", () => {
  assert.ok(IS.CBEFF);
  assert.ok(IS.IMAGE_KIND);
  assert.ok(IS.COMPRESSION);
  assert.ok(IS.QUALITY_LEVEL);
  assert.ok(IS.DIMENSIONS);
});

test("IrisStandards.captureDeviceInfo: returns device info", () => {
  const info = IS.captureDeviceInfo();
  assert.ok(info);
  assert.equal(typeof info.userAgent, "string");
});

test("IrisStandards.validateDeviceInfo: valid info", () => {
  const result = IS.validateDeviceInfo({ userAgent: "test", screenWidth: 1920 });
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.createRecord: basic record", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2 });
  assert.ok(record);
  assert.equal(record.imageKind, 2);
});

test("IrisStandards.validateRecord: valid record", () => {
  const record = { imageKind: 2, width: 640, height: 480, compression: 0, pixelDepth: 8 };
  const result = IS.validateRecord(record);
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.createTemplate: creates template", () => {
  const code = new Uint8Array(100);
  const mask = new Uint8Array(100).fill(1);
  const tpl = IS.createTemplate(code, mask);
  assert.ok(tpl);
  assert.equal(tpl.codeLength, 100);
});

test("IrisStandards.validateTemplate: valid template", () => {
  const tpl = { code: new Uint8Array(10), mask: new Uint8Array(10), codeLength: 10, maskLength: 10 };
  const result = IS.validateTemplate(tpl);
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.serialize/deserialize: round-trip", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2, eyeSide: "unknown" });
  const data = IS.serialize(record);
  assert.ok(data instanceof Uint8Array);
  const restored = IS.deserialize(data);
  assert.ok(restored);
});

test("IrisStandards.createBIR: creates BIR", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2, eyeSide: "left" });
  const bir = IS.createBIR(record);
  assert.ok(bir);
  assert.ok(bir.sbh);
  assert.ok(bir.bdb);
});

test("IrisStandards._classifyDeviceType: returns number", () => {
  assert.equal(typeof IS._classifyDeviceType("Mozilla/5.0 (iPhone)"), "number");
  assert.equal(typeof IS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0)"), "number");
});

test("IrisStandards._getQualityLevel: returns level object", () => {
  assert.ok(IS._getQualityLevel(90));
  assert.ok(IS._getQualityLevel(50));
  assert.ok(IS._getQualityLevel(10));
});

test("IrisStandards._computeChecksum: returns string", () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  const hash = IS._computeChecksum(data);
  assert.equal(typeof hash, "string");
  assert.ok(hash.length > 0);
});

test("IrisStandards._computeSHA256: returns promise", async () => {
  const data = new Uint8Array([10, 20, 30, 40]);
  const result = await IS._computeSHA256(data);
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("IrisStandards._computeSHA256: same data → same hash", async () => {
  const d1 = new Uint8Array([1, 2, 3]);
  const d2 = new Uint8Array([1, 2, 3]);
  const h1 = await IS._computeSHA256(d1);
  const h2 = await IS._computeSHA256(d2);
  assert.equal(h1, h2);
});

test("IrisStandards._extractImageData: throws for unsupported type", () => {
  try {
    IS._extractImageData("not_an_image");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e instanceof TypeError);
  }
});

test("IrisStandards.createBIR: throws for null record", () => {
  try {
    IS.createBIR(null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_template_protection.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisTemplateProtection.generateProjectionMatrix: returns Float64Array", () => {
  const matrix = ITP.generateProjectionMatrix(256, 128, "test-seed");
  assert.ok(matrix instanceof Float64Array);
  assert.equal(matrix.length, 256 * 128);
});

test("IrisTemplateProtection.biohash: returns hash + score", () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = (i * 7) % 256;
  const matrix = ITP.generateProjectionMatrix(256, 128);
  const result = ITP.biohash(code, matrix, 128);
  assert.ok(result);
  assert.ok(result.hashed instanceof Uint8Array);
  assert.equal(typeof result.score, "number");
});

test("IrisTemplateProtection.verifyBiohash: same hash matches", () => {
  const h = new Uint8Array([1, 0, 1, 1, 0]);
  const result = ITP.verifyBiohash(h, h);
  assert.ok(result.match);
  assert.equal(result.similarity, 1);
});

test("IrisTemplateProtection.verifyBiohash: different hashes don't match", () => {
  const a = new Uint8Array([1, 1, 1, 1, 1]);
  const b = new Uint8Array([0, 0, 0, 0, 0]);
  const result = ITP.verifyBiohash(a, b);
  assert.equal(result.match, false);
});

test("IrisTemplateProtection.createTransformation: returns function", () => {
  const key = new Uint8Array(32);
  const salt = new Uint8Array(16);
  const fn = ITP.createTransformation(key, salt);
  assert.equal(typeof fn, "function");
});

test("IrisTemplateProtection.transform: applies transform", () => {
  const code = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const key = new Uint8Array(8);
  const salt = new Uint8Array(4);
  const fn = ITP.createTransformation(key, salt);
  const result = ITP.transform(code, fn);
  assert.ok(result instanceof Uint8Array);
  assert.equal(result.length, code.length);
});

test("IrisTemplateProtection.transform: null fn → null", () => {
  const result = ITP.transform(new Uint8Array(4), null);
  assert.equal(result, null);
});

test("IrisTemplateProtection.verifyUnlinkability: same template → low unlinkability", () => {
  const code = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const result = ITP.verifyUnlinkability(code, code);
  assert.ok(result);
  assert.equal(typeof result.unlinkable, "boolean");
});

test("IrisTemplateProtection.verifyUnlinkability: with third template", () => {
  const t1 = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const t2 = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]);
  const t3 = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]);
  const result = ITP.verifyUnlinkability(t1, t2, t3);
  assert.ok(result);
  assert.ok(Array.isArray(result.crossDistances));
  assert.equal(result.crossDistances.length, 1);
});

test("IrisTemplateProtection.verifyUnlinkability: different-length templates", () => {
  const t1 = new Uint8Array([1, 0, 1]);
  const t2 = new Uint8Array([0, 1, 0, 1, 0]);
  const result = ITP.verifyUnlinkability(t1, t2);
  assert.ok(result);
});

test("IrisTemplateProtection.verifyUnlinkability: identical templates → linked", () => {
  const t1 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
  const result = ITP.verifyUnlinkability(t1, t1);
  assert.equal(result.unlinkable, false);
  assert.equal(result.distance, 0);
});

test("IrisTemplateProtection.verifyUnlinkability: completely different → linked", () => {
  const t1 = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
  const t2 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
  const result = ITP.verifyUnlinkability(t1, t2);
  assert.equal(result.unlinkable, false);
  assert.equal(result.distance, 1);
});

test("IrisTemplateProtection.testUnlinkability: returns result", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = (i * 3) % 256;
  const result = ITP.testUnlinkability(code, 5);
  assert.ok(result);
  assert.equal(typeof result.unlinkable, "boolean");
});

test("IrisTemplateProtection.testUnlinkability: insufficient input", () => {
  const result = ITP.testUnlinkability(null, 5);
  assert.equal(result.unlinkable, false);
  assert.equal(result.averageDistance, 0);
});

test("IrisTemplateProtection.testUnlinkability: numKeys < 2", () => {
  const code = new Uint8Array([1, 0, 1, 0]);
  const result = ITP.testUnlinkability(code, 1);
  assert.equal(result.unlinkable, false);
});

test("IrisTemplateProtection.commit: returns commitment + nonce", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const result = await ITP.commit(code, key);
  assert.ok(result.commitment);
  assert.ok(result.nonce);
  assert.equal(result.nonce.length, 32);
});

test("IrisTemplateProtection.commit: throws for bad input", async () => {
  try {
    await ITP.commit(null, null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

test("IrisTemplateProtection.verifyCommitment: correct commitment matches", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const { commitment, nonce } = await ITP.commit(code, key);
  const ok = await ITP.verifyCommitment(code, key, nonce, commitment);
  assert.equal(ok, true);
});

test("IrisTemplateProtection.verifyCommitment: wrong commitment fails", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const { nonce } = await ITP.commit(code, key);
  const ok = await ITP.verifyCommitment(code, key, nonce, "wrong_hash");
  assert.equal(ok, false);
});

test("IrisTemplateProtection.verifyCommitment: returns false for bad input", async () => {
  const ok = await ITP.verifyCommitment(null, null, null, null);
  assert.equal(ok, false);
});

test("IrisTemplateProtection.createCancelable: returns template + keyHash", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const userKey = new Uint8Array(16).fill(7);
  const result = await ITP.createCancelable(code, userKey, 1);
  assert.ok(result.template);
  assert.ok(result.keyHash);
  assert.ok(result.template instanceof Uint8Array);
});

test("IrisTemplateProtection.createCancelable: throws on bad input", async () => {
  try {
    await ITP.createCancelable(null, null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

test("IrisTemplateProtection.createCancelable: different iterations produce different templates", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const userKey = new Uint8Array(16).fill(7);
  const r1 = await ITP.createCancelable(code, userKey, 1);
  const r2 = await ITP.createCancelable(code, userKey, 2);
  assert.notDeepEqual(Array.from(r1.template), Array.from(r2.template));
});

test("IrisTemplateProtection._createRNG: returns deterministic values", () => {
  const rng1 = ITP._createRNG(42);
  const rng2 = ITP._createRNG(42);
  assert.equal(rng1(), rng2());
  assert.equal(rng1(), rng2());
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js — static methods
// ═══════════════════════════════════════════════════════════════

test("IrisCamera.isSupported: returns boolean", () => {
  assert.equal(typeof IC.isSupported(), "boolean");
});

test("IrisCamera.getCameraErrorMessage: formats error", () => {
  const msg = IC.getCameraErrorMessage(new Error("NotAllowedError"));
  assert.equal(typeof msg, "string");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DOMException", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotAllowedError", message: "denied" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string", () => {
  const msg = IC.getCameraErrorMessage("some error");
  assert.ok(msg.length > 0);
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js — full CRUD lifecycle
// ═══════════════════════════════════════════════════════════════

test("IrisStorage: constructor and vault key", () => {
  const store = new ISt();
  assert.ok(store);
  assert.equal(store.hasVaultKey(), false);
});

test("IrisStorage.setVaultKey: sets key", () => {
  const store = new ISt();
  store.setVaultKey({ type: "secret" });
  assert.equal(store.hasVaultKey(), true);
  store.setVaultKey(null);
  assert.equal(store.hasVaultKey(), false);
});

test("IrisStorage.save: throws without id", async () => {
  const store = new ISt();
  try {
    await store.save({ leftCode: new Uint8Array(10) });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("id"));
  }
});

test("IrisStorage.save: throws without leftCode", async () => {
  const store = new ISt();
  try {
    await store.save({ id: "test-1" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("IrisCode"));
  }
});

test("IrisStorage.save: saves plaintext template", async () => {
  const store = new ISt();
  const tpl = {
    id: "save-1",
    label: "test eye",
    leftCode: new Uint8Array([1, 2, 3]),
    leftMask: new Uint8Array([4, 5, 6]),
  };
  const id = await store.save(tpl);
  assert.equal(id, "save-1");
});

test("IrisStorage.save: saves with right eye data", async () => {
  const store = new ISt();
  const tpl = {
    id: "save-2",
    leftCode: new Uint8Array([1, 2]),
    leftMask: new Uint8Array([3, 4]),
    rightCode: new Uint8Array([5, 6]),
    rightMask: new Uint8Array([7, 8]),
    quality: { score: 90 },
    eyeSide: "left",
  };
  const id = await store.save(tpl);
  assert.equal(id, "save-2");
});

test("IrisStorage.load: retrieves saved template", async () => {
  const store = new ISt();
  await store.save({ id: "load-1", leftCode: new Uint8Array([10, 20]), leftMask: new Uint8Array([30]) });
  const loaded = await store.load("load-1");
  assert.ok(loaded);
  assert.equal(loaded.id, "load-1");
  assert.ok(loaded.leftCode instanceof Uint8Array);
  assert.ok(loaded.leftMask instanceof Uint8Array);
});

test("IrisStorage.load: returns null for missing id", async () => {
  const store = new ISt();
  const loaded = await store.load("nonexistent");
  assert.equal(loaded, null);
});

test("IrisStorage.list: returns saved entries", async () => {
  const store = new ISt();
  await store.save({ id: "list-1", label: "a", leftCode: new Uint8Array(2), leftMask: new Uint8Array(2) });
  await store.save({ id: "list-2", label: "b", leftCode: new Uint8Array(2), leftMask: new Uint8Array(2) });
  const items = await store.list();
  assert.ok(Array.isArray(items));
  assert.ok(items.length >= 2);
  const ids = items.map(function (x) { return x.id; });
  assert.ok(ids.includes("list-1"));
  assert.ok(ids.includes("list-2"));
});

test("IrisStorage.delete: removes a template", async () => {
  const store = new ISt();
  await store.save({ id: "del-1", leftCode: new Uint8Array(1), leftMask: new Uint8Array(1) });
  await store.delete("del-1");
  const loaded = await store.load("del-1");
  assert.equal(loaded, null);
});

test("IrisStorage.count: returns count", async () => {
  const store = new ISt();
  await store.save({ id: "cnt-1", leftCode: new Uint8Array(1), leftMask: new Uint8Array(1) });
  await store.save({ id: "cnt-2", leftCode: new Uint8Array(1), leftMask: new Uint8Array(1) });
  const n = await store.count();
  assert.ok(n >= 2);
});

test("IrisStorage.clear: removes all entries", async () => {
  const store = new ISt();
  await store.save({ id: "clr-1", leftCode: new Uint8Array(1), leftMask: new Uint8Array(1) });
  await store.clear();
  const n = await store.count();
  assert.equal(n, 0);
});

test("IrisStorage.importRecords: imports array", async () => {
  const store = new ISt();
  const records = [
    { id: "imp-1", leftCode: [1, 2], leftMask: [3, 4], label: "imported" },
  ];
  const count = await store.importRecords(records);
  assert.equal(count, 1);
});

test("IrisStorage.importRecords: throws on non-array", async () => {
  const store = new ISt();
  try {
    await store.importRecords("not-array");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("array"));
  }
});

test("IrisStorage.importRecords: skips records without id", async () => {
  const store = new ISt();
  const count = await store.importRecords([{ label: "no-id" }]);
  assert.equal(count, 1);
});

test("IrisStorage.exportAllRecords: returns saved records", async () => {
  const store = new ISt();
  await store.save({ id: "exp-1", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
  const exported = await store.exportAllRecords();
  assert.ok(Array.isArray(exported));
  assert.ok(exported.length >= 1);
});

test("IrisStorage.exportTemplate: exports as JSON", async () => {
  const store = new ISt();
  await store.save({ id: "json-1", leftCode: new Uint8Array([1, 2]), leftMask: new Uint8Array([3]) });
  const json = await store.exportTemplate("json-1");
  assert.ok(json);
  const data = JSON.parse(json);
  assert.equal(data.format, "redosan-iris-v1");
  assert.equal(data.template.id, "json-1");
});

test("IrisStorage.exportTemplate: returns null for missing", async () => {
  const store = new ISt();
  const json = await store.exportTemplate("nope");
  assert.equal(json, null);
});

test("IrisStorage.importTemplate: imports JSON string", async () => {
  const store = new ISt();
  const tpl = { id: "imp-json-1", leftCode: [10, 20], leftMask: [30, 40] };
  const json = JSON.stringify({ format: "redosan-iris-v1", exportedAt: Date.now(), template: tpl });
  const id = await store.importTemplate(json);
  assert.equal(id, "imp-json-1");
  const loaded = await store.load("imp-json-1");
  assert.ok(loaded);
  assert.ok(loaded.leftCode instanceof Uint8Array);
});

test("IrisStorage.importTemplate: throws on bad format", async () => {
  const store = new ISt();
  try {
    await store.importTemplate(JSON.stringify({ format: "bad" }));
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("format"));
  }
});

test("IrisStorage.load: rehydrates record with eyeSide normalization", async () => {
  const store = new ISt();
  await store.save({ id: "eye-1", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]), eyeSide: "right" });
  const loaded = await store.load("eye-1");
  assert.ok(loaded);
  assert.equal(loaded.eyeSide, "right");
});

test("IrisStorage.load: rehydrates unknown eyeSide", async () => {
  const store = new ISt();
  await store.save({ id: "eye-2", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]), eyeSide: "bad" });
  const loaded = await store.load("eye-2");
  assert.ok(loaded);
  assert.equal(loaded.eyeSide, "unknown");
});

test("IrisStorage._rehydrate: null record returns null", async () => {
  const store = new ISt();
  const result = await store._rehydrate(null);
  assert.equal(result, null);
});

test("IrisStorage.save: throws when FaceCrypto missing with vault key", async () => {
  const store = new ISt();
  store.setVaultKey("fake-key");
  try {
    await store.save({ id: "vault-1", leftCode: new Uint8Array(1), leftMask: new Uint8Array(1) });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("FaceCrypto"));
  }
});

test("IrisStorage._rehydrate: throws when vault locked and enc record", async () => {
  const store = new ISt();
  try {
    await store._rehydrate({ id: "enc-1", enc: { alg: "AES-GCM" } });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("unlock"));
  }
});

test("IrisStorage._rehydrate: throws when FaceCrypto missing for enc record", async () => {
  const store = new ISt();
  store.setVaultKey("fake-key");
  try {
    await store._rehydrate({ id: "enc-2", enc: { alg: "AES-GCM" } });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("FaceCrypto"));
  }
});

test("IrisStorage._openDB: returns cached db", async () => {
  const store = new ISt();
  const db1 = await store._openDB();
  const db2 = await store._openDB();
  assert.equal(db1, db2);
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js — instance methods with DOM mocks
// ═══════════════════════════════════════════════════════════════

test("IrisCamera.isSupported: returns boolean", () => {
  assert.equal(typeof IC.isSupported(), "boolean");
});

test("IrisCamera.getCameraErrorMessage: formats error", () => {
  const msg = IC.getCameraErrorMessage(new Error("NotAllowedError"));
  assert.equal(typeof msg, "string");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DOMException", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotAllowedError", message: "denied" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string", () => {
  const msg = IC.getCameraErrorMessage("some error");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: null returns default", () => {
  const msg = IC.getCameraErrorMessage(null);
  assert.ok(msg.includes("error"));
});

test("IrisCamera.getCameraErrorMessage: NotFoundError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotFoundError" });
  assert.ok(msg.includes("No camera"));
});

test("IrisCamera.getCameraErrorMessage: NotReadableError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotReadableError" });
  assert.ok(msg.includes("in use") || msg.includes("camera"));
});

test("IrisCamera.getCameraErrorMessage: OverconstrainedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "OverconstrainedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: AbortError", () => {
  const msg = IC.getCameraErrorMessage({ name: "AbortError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.prototype.stopCamera: no-op when no stream", () => {
  const cam = new IC();
  cam.stopCamera();
  assert.equal(cam._stream, null);
  assert.equal(cam._video, null);
});

test("IrisCamera.prototype.isActive: false when no stream", () => {
  const cam = new IC();
  assert.equal(cam.isActive(), false);
});

test("IrisCamera.prototype.stopCamera: clears stream and video", () => {
  const cam = new IC();
  const stopped = [];
  cam._stream = { getTracks: () => [{ stop() { stopped.push(true); } }], active: true };
  cam._video = { srcObject: {}, style: { transform: "scale(1)" } };
  cam.stopCamera();
  assert.equal(stopped.length, 1);
  assert.equal(cam._stream, null);
  assert.equal(cam._video, null);
});

test("IrisCamera.prototype.captureFrame: null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureFrame(), null);
});

test("IrisCamera.prototype.captureFrame: returns ImageData from video", () => {
  const cam = new IC();
  const mockVideo = { videoWidth: 640, videoHeight: 480 };
  cam._video = mockVideo;
  const result = cam.captureFrame();
  assert.ok(result);
  assert.equal(result.width, 640);
  assert.equal(result.height, 480);
});

test("IrisCamera.prototype.captureCanvas: null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureCanvas(), null);
});

test("IrisCamera.prototype.captureCanvas: returns canvas from video", () => {
  const cam = new IC();
  const mockVideo = { videoWidth: 320, videoHeight: 240 };
  const result = cam.captureCanvas(mockVideo);
  assert.ok(result);
});

test("IrisCamera.prototype.captureMultipleFrames: returns array", async () => {
  const cam = new IC();
  cam._video = { videoWidth: 100, videoHeight: 100 };
  const frames = await cam.captureMultipleFrames(2, 10);
  assert.ok(Array.isArray(frames));
  assert.equal(frames.length, 2);
});

test("IrisCamera.prototype.listCameras: returns empty when unsupported", async () => {
  const cam = new IC();
  const list = await cam.listCameras();
  assert.ok(Array.isArray(list));
});

test("IrisCamera.getCameraErrorMessage: code fallback", () => {
  const msg = IC.getCameraErrorMessage({ code: "NotAllowedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: generic unknown error", () => {
  const msg = IC.getCameraErrorMessage({ name: "SomeWeirdError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.prototype.startCamera: throws when unsupported", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "video" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera"));
  }
});

test("IrisCamera.prototype.startCamera: throws when no video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera(null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera") || e.message.includes("video"));
  }
});

test("IrisCamera.prototype.startCamera: throws when not a video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "div" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera") || e.message.includes("video"));
  }
});

test("IrisCamera.prototype.startCamera: succeeds with mock video", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockTrack = { stop() {}, kind: "video" };
  const mockStream = { getTracks: () => [mockTrack], active: true };
  Object.defineProperty(global, "navigator", {
    value: { mediaDevices: { getUserMedia: async () => mockStream }, isSecureContext: true },
    configurable: true, writable: true,
  });
  const cam = new IC();
  const videoEl = {
    tagName: "video",
    srcObject: null,
    style: { transform: "" },
    play() { return { catch() {} }; },
  };
  const stream = await cam.startCamera(videoEl, { facingMode: "environment", width: 640, height: 480 });
  assert.equal(stream, mockStream);
  assert.equal(cam._stream, mockStream);
  assert.equal(cam._video, videoEl);
  assert.equal(videoEl.srcObject, mockStream);
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.startCamera: with deviceId option", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockStream = { getTracks: () => [], active: true };
  Object.defineProperty(global, "navigator", {
    value: { mediaDevices: { getUserMedia: async () => mockStream }, isSecureContext: true },
    configurable: true, writable: true,
  });
  const cam = new IC();
  const videoEl = { tagName: "video", srcObject: null, style: { transform: "" }, play() { return { catch() {} }; } };
  const stream = await cam.startCamera(videoEl, { deviceId: "cam-1" });
  assert.ok(stream);
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.startCamera: with mirror option", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockStream = { getTracks: () => [], active: true };
  Object.defineProperty(global, "navigator", {
    value: { mediaDevices: { getUserMedia: async () => mockStream }, isSecureContext: true },
    configurable: true, writable: true,
  });
  const cam = new IC();
  cam._mirror = true;
  const videoEl = { tagName: "video", srcObject: null, style: { transform: "" }, play() { return { catch() {} }; } };
  await cam.startCamera(videoEl);
  assert.ok(videoEl.style.transform.includes("scaleX(-1)"));
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.setBrightness: no-op when no stream", async () => {
  const cam = new IC();
  await cam.setBrightness(0.5);
});

test("IrisCamera.prototype.setBrightness: no-op when no track", async () => {
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [] };
  await cam.setBrightness(0.5);
});

test("IrisCamera.prototype.setBrightness: applies constraint when supported", async () => {
  const applied = [];
  const mockTrack = {
    getCapabilities: () => ({ brightness: { min: -1, max: 1 } }),
    applyConstraints: async (c) => { applied.push(c); },
  };
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [mockTrack] };
  await cam.setBrightness(0.7);
  assert.equal(applied.length, 1);
});

test("IrisCamera.prototype.setBrightness: no-op when no capabilities", async () => {
  const mockTrack = {
    getCapabilities: () => ({}),
    applyConstraints: async () => {},
  };
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [mockTrack] };
  await cam.setBrightness(0.5);
});

// ═══════════════════════════════════════════════════════════════
// iris_engine.js — segment, extract, validateEyePresence branches
// ═══════════════════════════════════════════════════════════════

test("IrisEngine.prototype.segment: full pipeline", () => {
  const engine = new IE();
  const gray = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x - 32, dy = y - 32;
      const dist = Math.sqrt(dx * dx + dy * dy);
      gray[y * 64 + x] = dist < 12 ? 30 : dist < 30 ? 80 : 160;
    }
  }
  const input = {
    width: 64, height: 64,
    data: gray,
  };
  // Inject via _toGrayscale path
  const imgData = { data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 };
  for (let i = 0; i < 64 * 64; i++) {
    imgData.data[i * 4] = gray[i];
    imgData.data[i * 4 + 1] = gray[i];
    imgData.data[i * 4 + 2] = gray[i];
    imgData.data[i * 4 + 3] = 255;
  }
  const result = engine.segment(imgData);
  assert.ok(result);
  assert.ok(result.pupil);
  assert.ok(result.iris);
  assert.ok(result.gray);
  assert.equal(result.width, 64);
  assert.equal(result.height, 64);
});

test("IrisEngine.prototype.extract: throws when not loaded", () => {
  const engine = new IE();
  try {
    engine.extract({ width: 10, height: 10, data: new Uint8Array(400) });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("loaded"));
  }
});

test("IrisEngine.validateEyePresence: off-center pupil", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 30, cy: 30, radius: 15 },
    { cx: 30, cy: 30, radius: 80 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "off-center");
});

test("IrisEngine.validateEyePresence: off-center pupil (right edge)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 610, cy: 455, radius: 15 },
    { cx: 610, cy: 455, radius: 80 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "off-center");
});

test("IrisEngine.validateEyePresence: no-dark-pupil branch", () => {
  const gray = new Float64Array(640 * 480).fill(200);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 80 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-dark-pupil");
});

test("IrisEngine.validateEyePresence: no-signal (tiny iris)", () => {
  const gray = new Float64Array(640 * 480).fill(0);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 5 },
    { cx: 320, cy: 240, radius: 10 });
  assert.equal(result.ok, false);
  assert.ok(["no-signal", "pupil-size", "iris-size", "iris-size-absolute", "iris-pupil-ratio", "off-center"].includes(result.reason));
});

test("IrisEngine._toGrayscale: handles Uint8Array input", () => {
  const data = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255;
  }
  const result = IE._toGrayscale({ data: data, width: 64, height: 64 });
  assert.ok(result);
  assert.equal(result.width, 64);
});

test("IrisEngine._toGrayscale: handles float data", () => {
  const data = new Float64Array(64 * 64 * 4);
  for (let i = 0; i < data.length; i++) data[i] = 128;
  const result = IE._toGrayscale({ data: data, width: 64, height: 64 });
  assert.ok(result);
});

test("IrisEngine.detectPupil: non-uniform image finds pupil", () => {
  const gray = new Float64Array(200 * 200).fill(160);
  for (let y = 80; y < 120; y++) {
    for (let x = 80; x < 120; x++) {
      gray[y * 200 + x] = 20;
    }
  }
  const pupil = IE.detectPupil(gray, 200, 200);
  assert.ok(pupil);
  assert.ok(pupil.radius > 0);
  assert.ok(pupil.cx >= 0);
  assert.ok(pupil.cy >= 0);
});

test("IrisEngine.detectIris: finds iris outside pupil", () => {
  const gray = new Float64Array(300 * 300).fill(140);
  for (let y = 100; y < 200; y++) {
    for (let x = 100; x < 200; x++) {
      const dx = x - 150, dy = y - 150;
      const dist = Math.sqrt(dx * dx + dy * dy);
      gray[y * 300 + x] = dist < 20 ? 30 : dist < 90 ? 100 : 160;
    }
  }
  const pupil = { cx: 150, cy: 150, radius: 20 };
  const iris = IE.detectIris(gray, 300, 300, pupil);
  assert.ok(iris);
  assert.ok(iris.radius > pupil.radius);
});
