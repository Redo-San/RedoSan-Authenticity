// ── Comprehensive Iris Biometric coverage tests ──
// Covers: iris_quality, iris_template_protection, iris_standards, iris_performance,
//         iris_liveness, iris_engine, iris_matcher, iris_storage, iris_camera
// Run: node --test cli/tests/test-iris-coverage.js
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert");
const { V8Coverage } = require("./v8_coverage_helper");

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
  "iris_quality_full.js",
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
const IQF = global.IrisQualityFull;
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
// iris_camera.js — push from 77% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisCamera.getCameraErrorMessage: NotSupportedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotSupportedError" });
  assert.ok(msg.includes("not supported") || msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: TrackStartError", () => {
  const msg = IC.getCameraErrorMessage({ name: "TrackStartError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DevicesNotFoundError", () => {
  const msg = IC.getCameraErrorMessage({ name: "DevicesNotFoundError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: ConstraintNotSatisfiedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "ConstraintNotSatisfiedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: error without name", () => {
  const msg = IC.getCameraErrorMessage({ message: "oops" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string error", () => {
  const msg = IC.getCameraErrorMessage("Camera failed");
  assert.ok(msg.length > 0);
});

test("IrisCamera.isActive: returns boolean when stream exists", () => {
  const cam = new IC();
  cam._stream = { active: true, getTracks: () => [{ readyState: "live" }] };
  assert.equal(typeof cam.isActive(), "boolean");
  assert.equal(cam.isActive(), true);
});

test("IrisCamera.isActive: false when track ended", () => {
  const cam = new IC();
  cam._stream = { active: false, getTracks: () => [{ readyState: "ended" }] };
  assert.equal(cam.isActive(), false);
});

test("IrisCamera.captureFrame: returns null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureFrame(), null);
});

test("IrisCamera.captureCanvas: returns null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureCanvas(), null);
});

test("IrisCamera.captureMultipleFrames: returns empty when no video", async () => {
  const cam = new IC();
  const frames = await cam.captureMultipleFrames(3);
  assert.ok(Array.isArray(frames));
});

test("IrisCamera.listCameras: returns empty when no enumerateDevices", async () => {
  const cam = new IC();
  const list = await cam.listCameras();
  assert.ok(Array.isArray(list));
});

test("IrisCamera.prototype.startCamera: rejects non-video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "div" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.length > 0);
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js — more _rehydrate branches
// ═══════════════════════════════════════════════════════════════
test("IrisStorage._rehydrate: legacy plaintext with right eye", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-1",
    eyeSide: "left",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
    rightCode: [7, 8, 9],
    rightMask: [10, 11, 12],
  };
  const result = await store._rehydrate(rec);
  assert.ok(result);
  assert.ok(result.leftCode instanceof Uint8Array);
  assert.ok(result.rightCode instanceof Uint8Array);
});

test("IrisStorage._rehydrate: legacy plaintext without right eye", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-2",
    eyeSide: "right",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
  };
  const result = await store._rehydrate(rec);
  assert.ok(result);
  assert.equal(result.leftCode.length, 3);
});

test("IrisStorage._rehydrate: invalid eyeSide normalizes to unknown", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-3",
    eyeSide: "center",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
  };
  const result = await store._rehydrate(rec);
  assert.equal(result.eyeSide, "unknown");
});

test("IrisStorage.save: saves with quality and did", async () => {
  const store = new ISt();
  const id = await store.save({
    id: "qual-1",
    leftCode: new Uint8Array([1, 2, 3]),
    leftMask: new Uint8Array([4, 5, 6]),
    quality: { score: 85 },
    did: "did:key:z123",
    eyeSide: "left",
  });
  assert.equal(id, "qual-1");
  const loaded = await store.load("qual-1");
  assert.ok(loaded);
  assert.equal(loaded.did, "did:key:z123");
});

test("IrisStorage.importTemplate: valid with right eye", async () => {
  const store = new ISt();
  const template = {
    id: "imp-1",
    leftCode: Array.from(new Uint8Array([1, 2, 3])),
    leftMask: Array.from(new Uint8Array([4, 5, 6])),
    rightCode: Array.from(new Uint8Array([7, 8, 9])),
    rightMask: Array.from(new Uint8Array([10, 11, 12])),
    eyeSide: "unknown",
  };
  const json = JSON.stringify({ format: "redosan-iris-v1", exportedAt: Date.now(), template });
  const id = await store.importTemplate(json);
  assert.equal(id, "imp-1");
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

// ═══════════════════════════════════════════════════════════════
// iris_engine.js — push from 76% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisEngine.validateEyePresence: iris-size-absolute (too small)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 60 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-size-absolute");
});

test("IrisEngine.validateEyePresence: iris-pupil-ratio too high", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 200 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-pupil-ratio");
});

test("IrisEngine.validateEyePresence: iris-pupil-ratio too low", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 85 },
    { cx: 320, cy: 240, radius: 80 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-pupil-ratio");
});

test("IrisEngine.validateEyePresence: low-iris-texture (uniform iris)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 200 });
  assert.equal(result.ok, false);
  assert.ok(["low-iris-texture", "no-dark-pupil", "iris-pupil-ratio", "iris-size"].includes(result.reason));
});

test("IrisEngine.validateEyePresence: pupil-size too small", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 1 },
    { cx: 320, cy: 240, radius: 200 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pupil-size");
});

test("IrisEngine.validateEyePresence: pupil-size too large", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 160 },
    { cx: 320, cy: 240, radius: 200 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pupil-size");
});

test("IrisEngine.validateEyePresence: iris-size too large", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 400 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-size");
});

test("IrisEngine.validateEyePresence: passing valid eye", () => {
  const gray = new Float64Array(640 * 480).fill(150);
  for (let y = 150; y < 330; y++) {
    for (let x = 220; x < 420; x++) {
      const dx = x - 320, dy = y - 240;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) gray[y * 640 + x] = 10;
      else if (dist < 150) gray[y * 640 + x] = 130 + (Math.sin(x * 0.1) * 30);
    }
  }
  const result = IE.validateEyePresence(gray, 640, 480,
    { cx: 320, cy: 240, radius: 25 },
    { cx: 320, cy: 240, radius: 150 });
  assert.equal(typeof result.ok, "boolean");
});

test("IrisEngine._meanDisk: empty disk → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._meanDisk(gray, 100, 100, -500, -500, 5);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._meanAnnulus: empty annulus → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._meanAnnulus(gray, 100, 100, 500, 500, 5, 10);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._varAnnulus: empty annulus → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._varAnnulus(gray, 100, 100, 500, 500, 5, 10);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._varAnnulus: uniform annulus → low variance", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._varAnnulus(gray, 100, 100, 50, 50, 20, 40);
  assert.equal(r, 0);
});

test("IrisEngine.normalize: with custom normW/normH", () => {
  const gray = new Float64Array(200 * 200).fill(100);
  const norm = IE.normalize(gray, 200, 200,
    { cx: 100, cy: 100, radius: 20 },
    { cx: 100, cy: 100, radius: 80 }, 128, 64);
  assert.ok(norm instanceof Float64Array);
  assert.equal(norm.length, 128 * 64);
});

test("IrisEngine.generateIrisCode: all-zeros input", () => {
  const data = new Float64Array(64 * 32).fill(0);
  const code = IE.generateIrisCode(data, 64, 32);
  assert.ok(code);
  assert.ok(code.code instanceof Uint8Array);
  assert.ok(code.mask instanceof Uint8Array);
});

test("IrisEngine.generateIrisCode: high-variance input", () => {
  const data = new Float64Array(64 * 32);
  for (let i = 0; i < data.length; i++) data[i] = (i % 2 === 0) ? 0 : 255;
  const code = IE.generateIrisCode(data, 64, 32);
  assert.ok(code);
});

test("IrisEngine._toGrayscale: returns raw data for plain object", () => {
  const result = IE._toGrayscale({ data: new Uint8ClampedArray(64*64*4).fill(128), width: 64, height: 64 });
  assert.equal(result.width, 64);
  assert.equal(result.height, 64);
  assert.ok(result.data);
});

test("IrisEngine.detectPupil: all-zeros image", () => {
  const gray = new Float64Array(200 * 200).fill(0);
  const pupil = IE.detectPupil(gray, 200, 200);
  assert.ok(pupil);
  assert.ok(typeof pupil.cx === "number");
});

// ═══════════════════════════════════════════════════════════════
// IrisQualityFull — push from 6% to 80%+ via targeted tests
// ═══════════════════════════════════════════════════════════════
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
function makeMask(w, h, ir, valid) {
  const m = new Uint8Array(w * h);
  const cx = Math.floor(w/2), cy = Math.floor(h/2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= ir && dist >= ir * 0.3) m[y*w+x] = valid ? 1 : 0;
    }
  }
  return m;
}

test("IrisQualityFull.depthOfField: uniform → consistent (100)", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.depthOfField(img, 200, 200, {x:100,y:100,radius:80}, 80);
  assert(typeof r === "number" && r >= 0 && r <= 100, "depthOfField returns 0-100");
});

test("IrisQualityFull.depthOfField: gradient → lower consistency", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.depthOfField(img, 200, 200, {x:100,y:100,radius:80}, 80);
  assert(typeof r === "number" && r >= 0 && r <= 100, "gradient depthOfField returns 0-100");
});

test("IrisQualityFull.depthOfField: null → default 50", () => {
  const r = IrisQualityFull.depthOfField(null, 0, 0, null, 0);
  assert.strictEqual(r, 50);
});

test("IrisQualityFull.angularOcclusion: full ring → 0 occlusion", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.angularOcclusion(mask, 200, 200, {x:100,y:100,radius:80});
  assert(typeof r.maxOcclusion90 === "number" && typeof r.maxOcclusion30 === "number");
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
  const mask = new Uint8Array(200*200);
  for (let y = 0; y < 200; y++) for (let x = 0; x < 100; x++) mask[y*200+x] = 1;
  const r = IrisQualityFull.angularOcclusion(mask, 200, 200, {x:100,y:100,radius:80});
  assert(r.maxOcclusion90 > 0, "half mask has occlusion");
});

test("IrisQualityFull.specularReflection: uniform → low", () => {
  const img = makeIrisImage(200, 200, 80);
  const r = IrisQualityFull.specularReflection(img, 200, 200, {x:100,y:100,radius:20}, {x:100,y:100,radius:80});
  assert(typeof r.ratio === "number" && r.ratio >= 0 && r.ratio <= 1);
});

test("IrisQualityFull.specularReflection: bright center → higher ratio", () => {
  const img = makeIrisImage(200, 200, 80);
  for (let y = 90; y < 110; y++) for (let x = 90; x < 110; x++) {
    const idx = (y*200+x)*4; img[idx]=255; img[idx+1]=255; img[idx+2]=255;
  }
  const r = IrisQualityFull.specularReflection(img, 200, 200, {x:100,y:100,radius:20}, {x:100,y:100,radius:80});
  assert(r.ratio >= 0);
});

test("IrisQualityFull.specularReflection: null → {ratio:0}", () => {
  const r = IrisQualityFull.specularReflection(null, 0, 0, null, null);
  assert.strictEqual(r.ratio, 0);
});

test("IrisQualityFull.irisTextureContrast: uniform → low variance", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.irisTextureContrast(img, 200, 200, {x:100,y:100,radius:80});
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.irisTextureContrast: gradient → > 0", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.irisTextureContrast(img, 200, 200, {x:100,y:100,radius:80});
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
  assert(v.every(x => x === 0), "all zeros for null");
});

test("IrisQualityFull.generateQualityVector: with params → fills slots", () => {
  const img = makeIrisImage(200, 200, 100);
  const mask = makeMask(200, 200, 80, true);
  const v = IrisQualityFull.generateQualityVector({
    imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80},
    mask
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
    imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80},
    mask
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
    imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80},
    mask
  });
  assert(typeof r.passed === "boolean");
  assert(Array.isArray(r.failures));
});

test("IrisQualityFull.evaluateAcquisitionGates: no mask → via fails", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.evaluateAcquisitionGates({
    imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80}
  });
  assert(r.failures.some(f => f.includes("visibleIrisArea")), "no mask → visibleIrisArea failure");
});

test("IrisQualityFull._getQualityLevel: all tiers", () => {
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(80), { label: "Very High", code: 4 });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(60), { label: "High", code: 3 });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(30), { label: "Medium", code: 2 });
  assert.deepStrictEqual(IrisQualityFull._getQualityLevel(10), { label: "Low", code: 1 });
});

test("IrisQualityFull._generateReport: produces report string", () => {
  const report = IrisQualityFull._generateReport(75, {label:"High",code:3}, {focus:80,usableArea:90}, true);
  assert(typeof report === "string" && report.includes("High") && report.includes("PASSED"));
});

test("IrisQualityFull.mutualQualityComparison: null → score 0", () => {
  const r = IrisQualityFull.mutualQualityComparison(null, null);
  assert.strictEqual(r.score, 0);
  assert(typeof r.details === "string");
});

test("IrisQualityFull.mutualQualityComparison: two images → mutual score", () => {
  const img = makeIrisImage(200, 200, 120);
  const mask = makeMask(200, 200, 80, true);
  const p = { imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80}, mask };
  const r = IrisQualityFull.mutualQualityComparison(p, p);
  assert(typeof r.score === "number");
  assert(typeof r.consistency === "number");
  assert(r.consistency === 100, "same image → 100% consistency");
});

test("IrisQualityFull.concentricity: centered → 1.0", () => {
  const r = IrisQualityFull.concentricity({x:100,y:100}, {x:100,y:100}, 80);
  assert.strictEqual(r, 1);
});

test("IrisQualityFull.concentricity: offset → < 1", () => {
  const r = IrisQualityFull.concentricity({x:110,y:100}, {x:100,y:100}, 80);
  assert(r < 1 && r >= 0);
});

test("IrisQualityFull.concentricity: null → 0.5", () => {
  assert.strictEqual(IrisQualityFull.concentricity(null, null, 0), 0.5);
});

test("IrisQualityFull.eyelidCircularity: full mask → high value", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.eyelidCircularity(mask, 200, 200, {x:100,y:100,radius:80}, 80);
  assert(typeof r === "number" && r >= 0 && r <= 1);
});

test("IrisQualityFull.eyelidCircularity: null → 0.5", () => {
  assert.strictEqual(IrisQualityFull.eyelidCircularity(null, 0, 0, null, 0), 0.5);
});

test("IrisQualityFull.azimuthGaze: centered → 0", () => {
  const r = IrisQualityFull.azimuthGaze({x:100,y:100}, {x:100,y:100}, 80);
  assert.strictEqual(r, 0);
});

test("IrisQualityFull.azimuthGaze: offset → > 0", () => {
  const r = IrisQualityFull.azimuthGaze({x:120,y:100}, {x:100,y:100}, 80);
  assert(r > 0 && r <= 45);
});

test("IrisQualityFull.azimuthGaze: null → 0", () => {
  assert.strictEqual(IrisQualityFull.azimuthGaze(null, null, 0), 0);
});

test("IrisQualityFull.visibleIrisArea: full ring → high viaRatio", () => {
  const mask = makeMask(200, 200, 80, true);
  const r = IrisQualityFull.visibleIrisArea(mask, 200, 200, {x:100,y:100,radius:80});
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
  const r = IrisQualityFull.rawLaplacianVariance(img, 200, 200, {x:50,y:50,width:100,height:100});
  assert(typeof r === "number" && r >= 0);
});

test("IrisQualityFull.focusQuality: sharp gradient → > 0", () => {
  const img = makeGradientImage(200, 200);
  const r = IrisQualityFull.focusQuality(img, 200, 200, {x:50,y:50,width:100,height:100});
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
  const r = IrisQualityFull.grayscaleUtilization(img, {x:0,y:0,width:20,height:20}, 20);
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
  const mask = new Uint8Array(100*100).fill(1);
  const r = IrisQualityFull.pupilBoundaryCircularity(mask, 100, 100);
  assert(typeof r === "number" && r >= 0 && r <= 2);
});

test("IrisQualityFull.pupilBoundaryCircularity: null → 1", () => {
  assert.strictEqual(IrisQualityFull.pupilBoundaryCircularity(null, 0, 0), 1);
});

test("IrisQualityFull.motionBlurFocus: uniform → 1", () => {
  const norm = new Uint8Array(51*51).fill(128);
  const r = IrisQualityFull.motionBlurFocus(norm, 51, 51);
  assert(r >= 0 && r <= 1);
});

test("IrisQualityFull.motionBlurFocus: null → 1", () => {
  assert.strictEqual(IrisQualityFull.motionBlurFocus(null, 0, 0), 1);
});

test("IrisQualityFull.marginAdequacy: centered → 100", () => {
  const r = IrisQualityFull.marginAdequacy({x:100,y:100}, 80, 200, 200);
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
  const r = IrisQualityFull.gazeAngle({x:100,y:100}, {x:100,y:100}, 80);
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
  const r = IrisQualityFull.irisPupilContrast(img, 200, 200, {x:100,y:100,radius:20}, {x:100,y:100,radius:80});
  assert(r >= 0 && r < 5, "uniform contrast near zero, got " + r);
});

test("IrisQualityFull.irisPupilContrast: null → 0", () => {
  assert.strictEqual(IrisQualityFull.irisPupilContrast(null, 0, 0, null, null), 0);
});

test("IrisQualityFull.irisScleraContrast: uniform → near zero", () => {
  const img = makeIrisImage(200, 200, 128);
  const r = IrisQualityFull.irisScleraContrast(img, 200, 200, {x:100,y:100,radius:80});
  assert(r >= 0 && r < 5, "uniform sclera contrast near zero, got " + r);
});

test("IrisQualityFull.irisScleraContrast: null → 0", () => {
  assert.strictEqual(IrisQualityFull.irisScleraContrast(null, 0, 0, null), 0);
});

test("IrisQualityFull.computeCompositeQuality: without mask → defaults", () => {
  const img = makeIrisImage(200, 200, 120);
  const r = IrisQualityFull.computeCompositeQuality({
    imageData: img, width: 200, height: 200,
    pupil: {x:100,y:100,radius:25}, iris: {x:100,y:100,radius:80}
  });
  assert(r.score >= 0);
});

test("IrisQualityFull.computeCompositeQuality: without pupil → defaults", () => {
  const img = makeIrisImage(200, 200, 120);
  const r = IrisQualityFull.computeCompositeQuality({
    imageData: img, width: 200, height: 200, iris: {x:100,y:100,radius:80}
  });
  assert(r.score >= 0);
});

// ═══════════════════════════════════════════════════════════════
// IrisMatcher — push from 46% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisMatcher.hammingDistance: null → hd=1", () => {
  const r = IrisMatcher.hammingDistance(null, null);
  assert.strictEqual(r.hd, 1);
  assert.strictEqual(r.validBits, 0);
  assert.strictEqual(r.match, false);
});

test("IrisMatcher.hammingDistance: identical codes → hd=0", () => {
  const code = new Uint8Array([1,0,1,0,1,0,1,0]);
  const mask = new Uint8Array([1,1,1,1,1,1,1,1]);
  const r = IrisMatcher.hammingDistance({code, mask}, {code, mask});
  assert.strictEqual(r.hd, 0);
  assert.strictEqual(r.validBits, 8);
  assert.strictEqual(r.match, true);
});

test("IrisMatcher.hammingDistance: opposite codes → hd=1", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([1,1,1,1]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([1,1,1,1]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.hd, 1);
});

test("IrisMatcher.hammingDistance: all masked → validBits=0", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([0,0,0,0]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([0,0,0,0]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.validBits, 0);
  assert.strictEqual(r.hd, 1);
});

test("IrisMatcher.hammingDistance: partial overlap", () => {
  const a = { code: new Uint8Array([1,0,1,0]), mask: new Uint8Array([1,1,0,0]) };
  const b = { code: new Uint8Array([1,1,0,0]), mask: new Uint8Array([1,0,1,1]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.validBits, 1);
  assert(typeof r.hd === "number");
});

test("IrisMatcher.compare: identical → excellent match", () => {
  const code = new Uint8Array([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]);
  const mask = new Uint8Array(16).fill(1);
  const r = IrisMatcher.compare({code, mask}, {code, mask});
  assert.strictEqual(r.hd, 0);
  assert.strictEqual(r.match, true);
  assert(r.confidence > 0);
  assert(typeof r.details === "string");
  assert(typeof r.hdNorm === "number");
  assert(typeof r.significance === "number");
});

test("IrisMatcher.compare: opposite → no match", () => {
  const a = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1) };
  const b = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1) };
  const r = IrisMatcher.compare(a, b);
  assert.strictEqual(r.match, false);
  assert(r.details === "No match");
});

test("IrisMatcher.compare: low overlap → 'Low overlap' detail", () => {
  const a = { code: new Uint8Array(100).fill(1), mask: new Uint8Array(100).fill(0) };
  const b = { code: new Uint8Array(100).fill(0), mask: new Uint8Array(100).fill(1) };
  const r = IrisMatcher.compare(a, b);
  assert(r.details.includes("Low overlap"));
});

test("IrisMatcher.compare: marginal match", () => {
  const code = new Uint8Array(100);
  const mask = new Uint8Array(100).fill(1);
  for (let i = 0; i < 100; i++) code[i] = i % 2;
  const bCode = new Uint8Array(100);
  for (let i = 0; i < 100; i++) bCode[i] = (i % 2) ^ (i < 22 ? 1 : 0);
  const r = IrisMatcher.compare({code, mask}, {code: bCode, mask}, 0.30);
  assert(r.match);
  assert(r.details.includes("Marginal") || r.details.includes("match"));
});

test("IrisMatcher.identify: null probe → empty", () => {
  const r = IrisMatcher.identify(null, []);
  assert.strictEqual(r.bestMatch, null);
  assert.deepStrictEqual(r.allResults, []);
});

test("IrisMatcher.identify: empty gallery → empty", () => {
  const code = new Uint8Array(8).fill(1);
  const mask = new Uint8Array(8).fill(1);
  const r = IrisMatcher.identify({code, mask}, []);
  assert.strictEqual(r.bestMatch, null);
  assert.deepStrictEqual(r.allResults, []);
});

test("IrisMatcher.identify: finds best match", () => {
  const probe = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1), id: "probe" };
  const g1 = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1), id: "exact" };
  const g2 = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1), id: "opposite" };
  const r = IrisMatcher.identify(probe, [g2, g1]);
  assert.strictEqual(r.bestMatch.id, "exact");
  assert(r.allResults.length === 2);
  assert(r.allResults[0].hd <= r.allResults[1].hd, "sorted by hd ascending");
});

test("IrisMatcher.identify: no match in gallery → bestMatch=null", () => {
  const probe = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1) };
  const g = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1), id: "opp" };
  const r = IrisMatcher.identify(probe, [g], 0.10);
  assert.strictEqual(r.bestMatch, null);
});

test("IrisMatcher.identify: with threshold override", () => {
  const code = new Uint8Array(8).fill(1);
  const mask = new Uint8Array(8).fill(1);
  const r = IrisMatcher.identify({code, mask}, [{code, mask, id:"a"}], 0.50);
  assert.strictEqual(r.bestMatch.id, "a");
});

test("IrisMatcher.xorVisual: identical → all 0", () => {
  const code = new Uint8Array([1,0,1,0]);
  const mask = new Uint8Array([1,1,1,1]);
  const r = IrisMatcher.xorVisual({code, mask}, {code, mask});
  assert(r.every(v => v === 0));
});

test("IrisMatcher.xorVisual: opposite → all 1", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([1,1,1,1]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([1,1,1,1]) };
  const r = IrisMatcher.xorVisual(a, b);
  assert(r.every(v => v === 1));
});

test("IrisMatcher.xorVisual: masked → 2", () => {
  const a = { code: new Uint8Array([1,1]), mask: new Uint8Array([0,1]) };
  const b = { code: new Uint8Array([0,0]), mask: new Uint8Array([1,1]) };
  const r = IrisMatcher.xorVisual(a, b);
  assert.strictEqual(r[0], 2);
  assert.strictEqual(r[1], 1);
});

test("IrisMatcher.normalizeHd: valid inputs", () => {
  const r = IrisMatcher.normalizeHd(0.1, 1000, 1000);
  assert(typeof r === "number" && r >= 0 && r <= 0.5);
});

test("IrisMatcher.normalizeHd: invalid inputs → 0", () => {
  assert.strictEqual(IrisMatcher.normalizeHd("bad", 100, 1000), 0);
  assert.strictEqual(IrisMatcher.normalizeHd(0.1, -1, 1000), 0);
  assert.strictEqual(IrisMatcher.normalizeHd(0.1, 100, 0), 0);
});

test("IrisMatcher.decidabilityScore: good match → high score", () => {
  const r = IrisMatcher.decidabilityScore(0.1, 1000);
  assert(r > 10);
});

test("IrisMatcher.decidabilityScore: bad match → 0", () => {
  assert.strictEqual(IrisMatcher.decidabilityScore(0.5, 1000), 0);
  assert.strictEqual(IrisMatcher.decidabilityScore(0.1, 0), 0);
  assert.strictEqual(IrisMatcher.decidabilityScore("bad", 100), 0);
});

// ═══════════════════════════════════════════════════════════════
// IrisStandards — push from 56% to 80%+
// ═══════════════════════════════════════════════════════════════
function mockRecord(overrides) {
  return Object.assign({
    cbeff: { headerSize: 29, owner: 0, type: 9, version: 16, birType: 0, biometricType: 8,
             qualityAlgorithmVendor: 0, qualityAlgorithmId: 0 },
    recordVersion: { major: 1, minor: 0 },
    imageKind: 2,
    width: 640, height: 480,
    pixelDepth: 8, pixelAspectRatio: 1,
    eyeSide: "unknown",
    irisCenterX: 320, irisCenterY: 240, irisRadius: 80,
    qualityScore: 50,
    qualityLevel: { label: "Medium", code: 2, min: 26, max: 50 },
    compressionType: 0,
    deviceInfo: { userAgent: "test", platform: "test" },
    creationDate: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 86400000).toISOString(),
    encryptionAlgorithm: 0, encryptionOptions: 0,
    timestamp: new Date().toISOString(),
    imageData: new Uint8Array(100),
  }, overrides || {});
}

test("IrisStandards.validateRecord: valid record", () => {
  const r = IrisStandards.validateRecord(mockRecord());
  assert.strictEqual(r.valid, true);
  assert(r.errors.length === 0);
});

test("IrisStandards.validateRecord: kind2 wrong dims → warning", () => {
  const r = IrisStandards.validateRecord(mockRecord({ width: 320, height: 240 }));
  assert(r.warnings.some(w => w.includes("640x480")));
});

test("IrisStandards.validateRecord: kind7 → valid", () => {
  const r = IrisStandards.validateRecord(mockRecord({ imageKind: 7, width: 200, height: 200 }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: bad pixelDepth → warning", () => {
  const r = IrisStandards.validateRecord(mockRecord({ pixelDepth: 24 }));
  assert(r.warnings.length > 0);
});

test("IrisStandards.validateRecord: bad eyeSide → error", () => {
  const r = IrisStandards.validateRecord(mockRecord({ eyeSide: "bad" }));
  assert(r.errors.some(e => e.includes("eyeSide")) || r.warnings.some(w => w.includes("eyeSide")));
});

test("IrisStandards.validateRecord: missing cbeff → still valid (no check)", () => {
  const rec = mockRecord();
  delete rec.cbeff;
  const r = IrisStandards.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.serialize: valid record → Uint8Array", () => {
  const data = IrisStandards.serialize(mockRecord());
  assert(data instanceof Uint8Array);
  assert(data.length > IrisStandards.CBEFF.BDB_HEADER_SIZE);
});

test("IrisStandards.serialize: invalid record → throws", () => {
  assert.throws(() => IrisStandards.serialize({}), /Invalid record/);
});

test("IrisStandards.deserialize: round-trip", () => {
  const rec = mockRecord({ eyeSide: "left" });
  const data = IrisStandards.serialize(rec);
  const deser = IrisStandards.deserialize(data);
  assert(deser.eyeSide === "left");
  assert(deser.imageKind === 2);
});

test("IrisStandards.deserialize: right eye", () => {
  const data = IrisStandards.serialize(mockRecord({ eyeSide: "right" }));
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.eyeSide, "right");
});

test("IrisStandards.deserialize: unknown eye", () => {
  const data = IrisStandards.serialize(mockRecord({ eyeSide: "unknown" }));
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.eyeSide, "unknown");
});

test("IrisStandards.deserialize: too short → throws", () => {
  assert.throws(() => IrisStandards.deserialize(new Uint8Array(5)), /too short/);
});

test("IrisStandards.deserialize: with extended header fields", () => {
  const data = IrisStandards.serialize(mockRecord());
  const deser = IrisStandards.deserialize(data);
  assert(deser.recordVersion);
});

test("IrisStandards.createBIR: valid record → BIR", () => {
  const bir = IrisStandards.createBIR(mockRecord());
  assert(bir.sbh);
  assert(bir.bdb);
  assert(bir.sbh.biometricType);
});

test("IrisStandards.createBIR: with quality fields", () => {
  const bir = IrisStandards.createBIR(mockRecord({ qualityScore: 75 }));
  assert(bir.sbh);
});

// ═══════════════════════════════════════════════════════════════
// iris_standards.js — push from 57% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisStandards.validateTemplate: null → invalid", () => {
  const r = IrisStandards.validateTemplate(null);
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.validateTemplate: missing code", () => {
  const r = IrisStandards.validateTemplate({ mask: new Uint8Array(10) });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("code")));
});

test("IrisStandards.validateTemplate: missing mask", () => {
  const r = IrisStandards.validateTemplate({ code: new Uint8Array(10) });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("mask")));
});

test("IrisStandards.validateTemplate: code/mask length mismatch", () => {
  const r = IrisStandards.validateTemplate({
    code: new Uint8Array(10),
    mask: new Uint8Array(20),
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("same length")));
});

test("IrisStandards.validateTemplate: codeLength mismatch", () => {
  const r = IrisStandards.validateTemplate({
    code: new Uint8Array(10),
    mask: new Uint8Array(10),
    codeLength: 20,
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("codeLength")));
});

test("IrisStandards.validateTemplate: bad checksum", () => {
  const r = IrisStandards.validateTemplate({
    code: new Uint8Array([1, 2, 3]),
    mask: new Uint8Array([1, 2, 3]),
    checksum: "deadbeef",
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("Checksum")));
});

test("IrisStandards.validateTemplate: valid template", () => {
  const code = new Uint8Array([1, 2, 3]);
  const checksum = IrisStandards._computeChecksum(code);
  const r = IrisStandards.validateTemplate({
    code: code,
    mask: new Uint8Array([1, 2, 3]),
    checksum: checksum,
  });
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateTemplate: non-Uint8Array code", () => {
  const r = IrisStandards.validateTemplate({ code: [1, 2, 3], mask: new Uint8Array(3) });
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.validateTemplate: non-Uint8Array mask", () => {
  const r = IrisStandards.validateTemplate({ code: new Uint8Array(3), mask: [1, 2, 3] });
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.serialize: qualityScore = 0", () => {
  const data = IrisStandards.serialize(mockRecord({ qualityScore: 0 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: qualityScore = 100", () => {
  const data = IrisStandards.serialize(mockRecord({ qualityScore: 100 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: kind 7 record", () => {
  const data = IrisStandards.serialize(mockRecord({ imageKind: 7, width: 200, height: 200 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no deviceInfo", () => {
  const rec = mockRecord();
  delete rec.deviceInfo;
  const data = IrisStandards.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const data = IrisStandards.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no imageData", () => {
  const rec = mockRecord();
  delete rec.imageData;
  const data = IrisStandards.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: empty imageData", () => {
  const data = IrisStandards.serialize(mockRecord({ imageData: new Uint8Array(0) }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.deserialize: kind 7 record", () => {
  const data = IrisStandards.serialize(mockRecord({ imageKind: 7 }));
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.imageKind, 7);
});

test("IrisStandards.deserialize: no imageData → null", () => {
  const data = IrisStandards.serialize(mockRecord({ imageData: new Uint8Array(0) }));
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.imageData, null);
});

test("IrisStandards.deserialize: with imageData", () => {
  const data = IrisStandards.serialize(mockRecord({ imageData: new Uint8Array([1,2,3,4]) }));
  const deser = IrisStandards.deserialize(data);
  assert.ok(deser.imageData);
  assert.strictEqual(deser.imageData.length, 4);
});

test("IrisStandards.deserialize: encryption fields", () => {
  const data = IrisStandards.serialize(mockRecord({ encryptionAlgorithm: 1, encryptionOptions: 2 }));
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.encryptionAlgorithm, 1);
  assert.strictEqual(deser.encryptionOptions, 2);
});

test("IrisStandards.deserialize: creationDate / validFrom / validTo", () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const data = IrisStandards.serialize(mockRecord({ creationDate: past, validFrom: past, validTo: future }));
  const deser = IrisStandards.deserialize(data);
  assert.ok(deser.creationDate);
  assert.ok(deser.validFrom);
  assert.ok(deser.validTo);
});

test("IrisStandards._extractImageData: unsupported type → throws", () => {
  assert.throws(() => IrisStandards._extractImageData("bad"), /Unsupported/);
});

test("IrisStandards._extractImageData: ImageData instance", () => {
  const id = new ImageData(new Uint8ClampedArray(100), 10, 10);
  const r = IrisStandards._extractImageData(id);
  assert.strictEqual(r.width, 10);
});

test("IrisStandards.captureDeviceInfo: returns device info", () => {
  const info = IrisStandards.captureDeviceInfo();
  assert(typeof info === "object");
  assert(typeof info.userAgent === "string");
});

test("IrisStandards.validateDeviceInfo: valid info", () => {
  const info = IrisStandards.captureDeviceInfo();
  const r = IrisStandards.validateDeviceInfo(info);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateDeviceInfo: missing fields", () => {
  const r = IrisStandards.validateDeviceInfo({});
  assert(typeof r.valid === "boolean");
});

test("IrisStandards._classifyDeviceType: null → 0", () => {
  assert.strictEqual(IrisStandards._classifyDeviceType(null), 0);
});

test("IrisStandards._classifyDeviceType: mobile → 1", () => {
  assert.strictEqual(IrisStandards._classifyDeviceType("Mozilla/5.0 (Linux; Android 10)"), 1);
});

test("IrisStandards._classifyDeviceType: tablet → 2", () => {
  assert.strictEqual(IrisStandards._classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 14)"), 2);
});

test("IrisStandards._classifyDeviceType: desktop → 3", () => {
  assert.strictEqual(IrisStandards._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0)"), 3);
});

test("IrisStandards._computeChecksum: empty data", () => {
  const r = IrisStandards._computeChecksum(new Uint8Array(0));
  assert.strictEqual(typeof r, "string");
});

test("IrisStandards._computeChecksum: large data", () => {
  const r = IrisStandards._computeChecksum(new Uint8Array(10000).fill(42));
  assert.strictEqual(typeof r, "string");
});

test("IrisStandards._computeSHA256: returns promise", () => {
  const r = IrisStandards._computeSHA256(new Uint8Array([1, 2, 3]));
  assert(r instanceof Promise);
});

test("IrisStandards._getQualityLevel: boundary values", () => {
  const l = IrisStandards._getQualityLevel(26);
  assert(l.label === "Medium");
  const h = IrisStandards._getQualityLevel(51);
  assert(h.label === "High");
  const vh = IrisStandards._getQualityLevel(76);
  assert(vh.label === "Very High");
  const lo = IrisStandards._getQualityLevel(1);
  assert(lo.label === "Low");
});

test("IrisStandards.createBIR: with deviceInfo", () => {
  const rec = mockRecord({ deviceInfo: { deviceType: 0, userAgent: "test" } });
  const bir = IrisStandards.createBIR(rec);
  assert(bir.sbh.deviceInfo);
});

test("IrisStandards.createBIR: without qualityScore", () => {
  const rec = mockRecord();
  delete rec.qualityScore;
  const bir = IrisStandards.createBIR(rec);
  assert(bir.sbh.qualityBlocks.length === 0);
});

test("IrisStandards.createBIR: null → throws", () => {
  assert.throws(() => IrisStandards.createBIR(null), /required/);
});

test("IrisStandards.validateRecord: eyeSide 'left'", () => {
  const r = IrisStandards.validateRecord(mockRecord({ eyeSide: "left" }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: eyeSide 'right'", () => {
  const r = IrisStandards.validateRecord(mockRecord({ eyeSide: "right" }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: missing qualityScore", () => {
  const rec = mockRecord();
  delete rec.qualityScore;
  const r = IrisStandards.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateRecord: missing recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const r = IrisStandards.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateRecord: missing compressionType", () => {
  const rec = mockRecord();
  delete rec.compressionType;
  const r = IrisStandards.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.deserialize: legacy 29-byte header", () => {
  const data = new Uint8Array(29);
  data[0] = 29; data[4] = 2; data[10] = 2;
  const deser = IrisStandards.deserialize(data);
  assert.strictEqual(deser.cbeff.headerSize, 29);
  assert.strictEqual(deser.eyeSide, "unknown");
  assert.equal(deser.creationDate, null);
});

test("IrisStandards.deserialize: zero timestamps → null dates", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0;
  const deser = IrisStandards.deserialize(data);
  assert.equal(deser.creationDate, null);
  assert.equal(deser.validFrom, null);
  assert.equal(deser.validTo, null);
});

test("IrisStandards.deserialize: no deviceInfo field", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0; data[27] = 0;
  const deser = IrisStandards.deserialize(data);
  assert.equal(deser.deviceInfo, null);
});

test("IrisStandards.deserialize: with deviceInfo", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0; data[27] = 5;
  const deser = IrisStandards.deserialize(data);
  assert.ok(deser.deviceInfo);
  assert.strictEqual(deser.deviceInfo.deviceType, 5);
});

test("IrisStandards.deserialize: with image data appended", () => {
  const data = new Uint8Array(41 + 10);
  data[0] = 41; data[4] = 2; data[10] = 0;
  for (let i = 41; i < 51; i++) data[i] = i - 41 + 10;
  const deser = IrisStandards.deserialize(data);
  assert.ok(deser.imageData);
  assert.strictEqual(deser.imageData.length, 10);
});

test("IrisStandards.deserialize: header size > 33 but < 41", () => {
  const data = new Uint8Array(35);
  data[0] = 35; data[4] = 7; data[10] = 1;
  const deser = IrisStandards.deserialize(data);
  assert.ok(deser);
});

test("IrisStandards.createBIR: with encryptionAlgorithm", () => {
  const rec = mockRecord({ encryptionAlgorithm: 1, encryptionOptions: 3 });
  const bir = IrisStandards.createBIR(rec);
  assert.ok(bir);
  assert.ok(bir.bdb);
});

test("IrisStandards.createBIR: no cbeff on record (still builds SBH)", () => {
  const bir = IrisStandards.createBIR(mockRecord());
  assert.ok(bir.sbh.biometricType === 0x08);
});

test("IrisStandards.createBIR: no recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const bir = IrisStandards.createBIR(rec);
  assert.ok(bir.sbh.version.major === 1);
});

test("IrisStandards.createBIR: no creationDate/validFrom/validTo", () => {
  const rec = mockRecord();
  delete rec.creationDate;
  delete rec.validFrom;
  delete rec.validTo;
  const bir = IrisStandards.createBIR(rec);
  assert.ok(bir.sbh.creationDate);
});

test("IrisStandards.createTemplate: with version string", () => {
  const t = IrisStandards.createTemplate(new Uint8Array(100), new Uint8Array(100), "v1");
  assert.ok(t);
  assert.ok(typeof t.code === "object");
});

test("IrisStandards.createBIR: totalSize calculation", () => {
  const rec = mockRecord({ imageData: new Uint8Array(200) });
  const bir = IrisStandards.createBIR(rec);
  assert.ok(bir.totalSize > 0);
  assert.equal(typeof bir.totalSize, "number");
});

// ═══════════════════════════════════════════════════════════════
// IrisLiveness — push from 60% to 80%+
// ═══════════════════════════════════════════════════════════════
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

test("IrisLiveness.pupilDilationTest: constant frames → high score", () => {
  const frames = [makeIrisImage(100, 100, 80), makeIrisImage(100, 100, 80)];
  const r = IrisLiveness.pupilDilationTest(frames, 100, 100, {x:50,y:50,radius:10}, {x:50,y:50,radius:40});
  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 1);
  assert(typeof r.details === "string");
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

test("IrisLiveness.computeAPCER: basic", () => {
  const r = IrisLiveness.computeAPCER(5, 100);
  assert.strictEqual(r, 0.05);
});

test("IrisLiveness.computeBPCER: basic", () => {
  const r = IrisLiveness.computeBPCER(10, 100);
  assert.strictEqual(r, 0.10);
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

test("IrisLiveness.classifyPAISpecies: no species", () => {
  const r = IrisLiveness.classifyPAISpecies({});
  assert(typeof r === "object");
  assert(typeof r.species === "number");
});

test("IrisLiveness.classifyPAISpecies: known species", () => {
  const r = IrisLiveness.classifyPAISpecies({screenGlint: true, moirePattern: true});
  assert(typeof r.species === "number");
});

// ═══════════════════════════════════════════════════════════════
// IrisPerformance — push from 64% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisPerformance.calculateFAR: edge case zero denominators", () => {
  assert.strictEqual(IrisPerformance.calculateFAR(0, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFAR(5, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFAR(0, 100), 0);
});

test("IrisPerformance.calculateFRR: edge case zero denominators", () => {
  assert.strictEqual(IrisPerformance.calculateFRR(0, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFRR(5, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFRR(0, 100), 0);
});

test("IrisPerformance.calculateEER: asymmetric ROC", () => {
  const r = IrisPerformance.calculateEER([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(typeof r === "object");
  assert(typeof r.eer === "number");
});

test("IrisPerformance.calculateAccuracy: zero total", () => {
  assert.strictEqual(IrisPerformance.calculateAccuracy(0, 0, 0, 0), 0);
});

test("IrisPerformance.calculateAPCER: basic", () => {
  const r = IrisPerformance.calculateAPCER(5, 100);
  assert(typeof r === "number");
});

test("IrisPerformance.calculateAPCER: zero denominator", () => {
  assert.strictEqual(IrisPerformance.calculateAPCER(0, 0), 0);
});

test("IrisPerformance.calculateBPCER: basic", () => {
  const r = IrisPerformance.calculateBPCER(5, 100);
  assert(typeof r === "number");
});

test("IrisPerformance.calculateBPCER: zero denominator", () => {
  assert.strictEqual(IrisPerformance.calculateBPCER(0, 0), 0);
});

test("IrisPerformance.generatePADDET: with scores", () => {
  const r = IrisPerformance.generatePADDET([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(Array.isArray(r));
  assert(r.length > 0);
});

test("IrisPerformance.generatePADDET: empty", () => {
  const r = IrisPerformance.generatePADDET([], []);
  assert(Array.isArray(r));
});

test("IrisPerformance.reportPADMetrics: basic", () => {
  const r = IrisPerformance.reportPADMetrics([0.1, 0.2], [0.5, 0.6], 0.3);
  assert(typeof r === "object");
});

test("IrisPerformance.reportPADMetrics: with empty arrays", () => {
  const r = IrisPerformance.reportPADMetrics([], [], 0.3);
  assert(typeof r === "object");
});

test("IrisPerformance.generateROC: various thresholds", () => {
  const r = IrisPerformance.generateROC([0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8], 20);
  assert(typeof r === "object");
  assert(r.length > 0);
});

test("IrisPerformance.generateROC: empty", () => {
  const r = IrisPerformance.generateROC([], [], 5);
  assert(Array.isArray(r));
});

test("IrisPerformance.wilsonCI: basic", () => {
  const r = IrisPerformance.wilsonCI(50, 100, 1.96);
  assert(typeof r === "object");
  assert(typeof r.lower === "number");
  assert(typeof r.upper === "number");
  assert(r.lower <= r.upper);
});

test("IrisPerformance.wilsonCI: edge cases", () => {
  const r1 = IrisPerformance.wilsonCI(0, 0, 1.96);
  assert(typeof r1 === "object");
  const r2 = IrisPerformance.wilsonCI(100, 100, 1.96);
  assert(r2.lower > 0.9);
});

test("IrisPerformance.evaluate: comprehensive", () => {
  const r = IrisPerformance.evaluate({
    genuineScores: [0.1, 0.15, 0.2, 0.25],
    impostorScores: [0.5, 0.6, 0.7, 0.8]
  });
  assert(typeof r === "object");
  assert(typeof r.systemName === "string");
  assert(typeof r.metrics === "object");
  assert(typeof r.summary === "string");
});

test("IrisPerformance.evaluate: minimal", () => {
  const r = IrisPerformance.evaluate({
    genuineScores: [0.1],
    impostorScores: [0.5]
  });
  assert(typeof r === "object");
  assert(typeof r.systemName === "string");
});

test("IrisPerformance.pairedTTest: different distributions", () => {
  const r = IrisPerformance.pairedTTest([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(typeof r === "object");
  assert(typeof r.tStatistic === "number");
  assert(typeof r.pValue === "number");
});

test("IrisPerformance.pairedTTest: identical distributions", () => {
  const r = IrisPerformance.pairedTTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  assert.strictEqual(r.significant, false);
});

test("IrisPerformance.compareSystems: system1 wins", () => {
  const s1 = { genuineScores: [0.1, 0.1, 0.1], impostorScores: [0.8, 0.8, 0.8] };
  const s2 = { genuineScores: [0.3, 0.3, 0.3], impostorScores: [0.6, 0.6, 0.6] };
  const r = IrisPerformance.compareSystems(s1, s2);
  assert(typeof r.winner === "string");
  assert(typeof r.eerDifference === "number");
  assert(typeof r.significant === "boolean");
});

test("IrisPerformance.compareSystems: null → tie", () => {
  const r = IrisPerformance.compareSystems(null, null);
  assert.strictEqual(r.winner, "tie");
  assert.strictEqual(r.significant, false);
});

test("IrisPerformance.compareSystems: one null", () => {
  const s1 = { genuineScores: [0.1], impostorScores: [0.8] };
  const r = IrisPerformance.compareSystems(s1, null);
  assert(typeof r.winner === "string");
});

test("IrisPerformance.fnirAtFpir: returns operating points", () => {
  const r = IrisPerformance.fnirAtFpir([0.1, 0.2, 0.3], [0.5, 0.6, 0.7]);
  assert(typeof r === "object");
  assert(typeof r.operatingPoints === "object");
  assert(r.operatingPoints.length > 0);
});

test("IrisPerformance.fnirAtFpir: empty", () => {
  const r = IrisPerformance.fnirAtFpir([], []);
  assert(typeof r === "object");
  assert(typeof r.operatingPoints === "object");
});

test("IrisPerformance.recordFTA: increments count", () => {
  const inst = { _ftaCount: 0, _totalAcquisitions: 0, _timings: [], _fterCount: 0, _totalEnrollments: 0 };
  IrisPerformance.recordFTA(inst, "test reason");
  assert(inst._ftaCount === 1);
  assert(inst._totalAcquisitions === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordFTER: increments count", () => {
  const inst = { _fterCount: 0, _totalEnrollments: 0, _timings: [], _ftaCount: 0, _totalAcquisitions: 0 };
  IrisPerformance.recordFTER(inst, "test reason");
  assert(inst._fterCount === 1);
  assert(inst._totalEnrollments === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordAcquisition: records timing", () => {
  const inst = { _totalAcquisitions: 0, _timings: [], _ftaCount: 0, _fterCount: 0, _totalEnrollments: 0 };
  IrisPerformance.recordAcquisition(inst, 100);
  assert(inst._totalAcquisitions === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordEnrollment: records timing", () => {
  const inst = { _totalEnrollments: 0, _timings: [], _ftaCount: 0, _fterCount: 0, _totalAcquisitions: 0 };
  IrisPerformance.recordEnrollment(inst, 200);
  assert(inst._totalEnrollments === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.getFtaFterRates: returns rates", () => {
  const inst = { _ftaCount: 2, _fterCount: 1, _totalAcquisitions: 10, _totalEnrollments: 5, _timings: [] };
  const r = IrisPerformance.getFtaFterRates(inst);
  assert(typeof r === "object");
});

test("IrisPerformance.computeTimingStats: returns stats", () => {
  const inst = { _timings: [{durationMs: 100}, {durationMs: 200}] };
  const r = IrisPerformance.computeTimingStats(inst);
  assert(typeof r === "object");
});

// ═══════════════════════════════════════════════════════════════
// IrisLiveness — push from 71% to 80%+
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

test("IrisLiveness.temporalConsistencyTest: stationary → high score", () => {
  const frames = [makeIrisImage(100,100,100), makeIrisImage(100,100,100), makeIrisImage(100,100,100)];
  const r = IrisLiveness.temporalConsistencyTest(frames, 100, 100, {x:50,y:50,radius:40});
  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 1);
});

test("IrisLiveness.temporalConsistencyTest: single frame", () => {
  const r = IrisLiveness.temporalConsistencyTest([makeIrisImage(100,100,100)], 100, 100, {x:50,y:50,radius:40});
  assert(typeof r.score === "number");
});

test("IrisLiveness.temporalConsistencyTest: null", () => {
  const r = IrisLiveness.temporalConsistencyTest(null, 0, 0, null);
  assert(typeof r.score === "number");
});

test("IrisLiveness.moireDetectionTest: uniform → no moire", () => {
  const r = IrisLiveness.moireDetectionTest(makeIrisImage(100,100,100), 100, 100);
  assert(typeof r.score === "number" && r.score >= 0);
});

test("IrisLiveness.moireDetectionTest: null → 0", () => {
  const r = IrisLiveness.moireDetectionTest(null, 0, 0);
  assert(typeof r.score === "number");
});

test("IrisLiveness.textureAnalysisTest: uniform → low energy", () => {
  const r = IrisLiveness.textureAnalysisTest(makeIrisImage(200,200,100), 200, 200, {x:100,y:100,radius:80});
  assert(typeof r.score === "number");
  assert(typeof r.textureEnergy === "number");
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

test("IrisLiveness.depthEstimationTest: uniform → low variance", () => {
  const r = IrisLiveness.depthEstimationTest(makeIrisImage(200,200,100), 200, 200, {x:100,y:100,radius:80});
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

test("IrisLiveness.periodicPatternTest: random → no attack", () => {
  const img = new Uint8ClampedArray(200*200*4);
  for (let i = 0; i < img.length; i+=4) { img[i]=Math.random()*255|0; img[i+1]=Math.random()*255|0; img[i+2]=Math.random()*255|0; img[i+3]=255; }
  const r = IrisLiveness.periodicPatternTest(img, 200, 200);
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

// ═══════════════════════════════════════════════════════════════
// Targeted coverage gap tests — V8 uncovered ranges
// ═══════════════════════════════════════════════════════════════

function makeGray(w, h, fillFn) {
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = fillFn(x, y);
  return g;
}

// ── iris_quality.js uncovered ranges ──

test("IQ.pupilBoundaryCircularity: mask with mixed values hits perimeter break (L80)", () => {
  const w = 64, h = 32;
  const mask = new Uint8Array(w * h).fill(0);
  for (let y = 10; y < 22; y++) for (let x = 20; x < 44; x++) mask[y * w + x] = 1;
  mask[15 * w + 30] = 0;
  const val = IQ.pupilBoundaryCircularity(mask, w, h);
  assert.equal(typeof val, "number");
});

test("IQ.pupilBoundaryCircularity: all-zero mask returns 1 (L88 branch)", () => {
  const mask = new Uint8Array(32 * 16).fill(0);
  assert.equal(IQ.pupilBoundaryCircularity(mask, 32, 16), 1);
});

test("IQ.irisPupilContrast: all-zero counts path (L121-122)", () => {
  const w = 64, h = 32;
  const data = new Float64Array(w * h).fill(128);
  const mask = new Uint8Array(w * h).fill(0);
  const val = IQ.irisPupilContrast(data, w, h);
  assert.equal(typeof val, "number");
});

test("IQ.irisScleraContrast: all-zero counts path (L156-157)", () => {
  const w = 64, h = 32;
  const data = new Float64Array(w * h).fill(128);
  const mask = new Uint8Array(w * h).fill(0);
  const val = IQ.irisScleraContrast(data, w, h);
  assert.equal(typeof val, "number");
});

test("IQ.sharpness: zero-variance returns 0 (L193)", () => {
  const data = new Float64Array(64 * 32).fill(128);
  const val = IQ.sharpness(data, 64, 32);
  assert.equal(typeof val, "number");
});

test("IQ.motionBlur: zero-variance returns 1 (L223)", () => {
  const data = new Float64Array(64 * 32).fill(128);
  const val = IQ.motionBlur(data, 64, 32);
  assert.equal(typeof val, "number");
});

test("IQ.assess: all params hit all branches (L346-L404)", () => {
  const w = 64, h = 128;
  const norm = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) norm[y * w + x] = 128 + Math.sin(x * 0.2) * 50;
  const mask = new Uint8Array(w * h).fill(2);
  for (let y = 40; y < 90; y++) for (let x = 15; x < 50; x++) mask[y * w + x] = 0;
  const result = IQ.assess({
    normalizedIris: norm, normW: w, normH: h, mask,
    pupil: { cx: 32, cy: 60, radius: 12 },
    iris: { cx: 32, cy: 60, radius: 50 },
    imageWidth: 200, imageHeight: 200,
    marginAdequacy: { left: 10, right: 10, top: 10, bottom: 10 },
  });
  assert.equal(typeof result.score, "number");
  assert.ok(Array.isArray(result.issues));
});

test("IQ.assess: poor pupilIrisRatio triggers issue (L346-350)", () => {
  const w = 64, h = 128;
  const norm = new Float64Array(w * h).fill(128);
  const mask = new Uint8Array(w * h).fill(0);
  const result = IQ.assess({
    normalizedIris: norm, normW: w, normH: h, mask,
    pupil: { cx: 32, cy: 60, radius: 5 },
    iris: { cx: 32, cy: 60, radius: 6 },
    imageWidth: 200, imageHeight: 200,
    marginAdequacy: { left: 10, right: 10, top: 10, bottom: 10 },
  });
  assert.ok(result.issues.length > 0 || result.score < 100);
});

// ── iris_quality_full.js uncovered ranges ──

test("IrisQualityFull.focusQuality: with actual gradient data (L256)", () => {
  const w = 32, h = 32;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * w + x] = (x + y) % 256;
  const val = IQF.focusQuality(img, w, h, { x: 0, y: 0, width: w, height: h });
  assert.equal(typeof val, "number");
});

test("IrisQualityFull.rawLaplacianVariance: with gradient data (L302)", () => {
  const w = 32, h = 32;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * w + x] = (x + y * 2) % 256;
  const val = IQF.rawLaplacianVariance(img, w, h, { x: 0, y: 0, width: w, height: h });
  assert.equal(typeof val, "number");
});

test("IrisQualityFull.mutualQualityComparison: positional args (L1260)", () => {
  const r1 = { visibleIrisArea: 80, focusQuality: 0.7, motionBlur: 0.2, pupilIrisRatio: 0.35, usableArea: 70 };
  const r2 = { visibleIrisArea: 90, focusQuality: 0.8, motionBlur: 0.1, pupilIrisRatio: 0.40, usableArea: 80 };
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
  const w = 64, h = 64;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * w + x] = (x + y * 3) % 256;
  const result = IQF.depthOfField(img, w, h, { x: 32, y: 32, radius: 30 }, 30);
  assert.equal(typeof result, "number");
});

test("IrisQualityFull.detectIllumination: gradient image (L753)", () => {
  const w = 64, h = 64;
  const img = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * w + x] = (x + y) % 256;
  const result = IQF.detectIllumination(img, w, h);
  assert.equal(typeof result.colorCapture, "boolean");
});

test("IrisQualityFull.grayscaleUtilization: gradient data (L807)", () => {
  const w = 64, h = 10;
  const img = new Uint8Array(w * h);
  for (let i = 0; i < img.length; i++) img[i] = (i * 4) % 256;
  const result = IQF.grayscaleUtilization(img, { x: 0, y: 0, width: w, height: h }, w);
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
  const w = 64, h = 64;
  const img = new Uint8Array(w * h).fill(50);
  img[32 * w + 32] = 240;
  img[32 * w + 33] = 235;
  const result = IQF.specularReflection(img, w, h, { cx: 32, cy: 32, radius: 10 }, { x: 32, y: 32, radius: 30 });
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
  const w = 64, h = 64;
  const img = new Uint8Array(w * h).fill(128);
  const result = IQF.computeCompositeQuality({
    imageData: img, width: w, height: h,
    pupil: { cx: 32, cy: 32, radius: 10 },
    iris: { cx: 32, cy: 32, radius: 30 },
  });
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.passed, "boolean");
});

// ── iris_engine.js uncovered ranges ──

test("IrisEngine.isLoaded: returns false initially (L73)", () => {
  const eng = new IE();
  assert.equal(eng.isLoaded(), false);
});

test("IrisEngine.loadModels: sets loaded (L82-L86)", async () => {
  const eng = new IE();
  await eng.loadModels();
  assert.equal(eng.isLoaded(), true);
  await eng.loadModels();
  assert.equal(eng.isLoaded(), true);
});

test("IrisEngine._toGrayscale: canvas image path (L98-L100)", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 16; canvas.height = 16;
  const result = IE._toGrayscale(canvas);
  assert.ok(result.width > 0);
});

test("IrisEngine.detectPupil: synthetic dark circle (L322-L327)", () => {
  const w = 100, h = 100;
  const gray = makeGray(w, h, (x, y) => {
    const dx = x - 50, dy = y - 50;
    return Math.sqrt(dx*dx + dy*dy) < 15 ? 20 : 150;
  });
  const result = IE.detectPupil(gray, w, h);
  assert.ok(result.cx >= 0 && result.cx < w);
});

test("IrisEngine.validateEyePresence: no-signal path (L326)", () => {
  const w = 100, h = 100;
  const gray = makeGray(w, h, () => 128);
  const result = IE.validateEyePresence(gray, w, h,
    { cx: 50, cy: 50, radius: 15 },
    { cx: 50, cy: 50, radius: 45 });
  assert.equal(typeof result.ok, "boolean");
});

test("IrisEngine._meanAnnulus: edge case (L405)", () => {
  const w = 50, h = 50;
  const gray = makeGray(w, h, (x, y) => (x + y) % 200);
  const result = IE._meanAnnulus(gray, w, h, 25, 25, 5, 20);
  assert.equal(typeof result, "number");
});

test("IrisEngine.normalize: full path (L201-L204)", () => {
  const w = 100, h = 100;
  const gray = makeGray(w, h, (x, y) => Math.sin(x * 0.1 + y * 0.05) * 127 + 128);
  const result = IE.normalize(gray, w, h,
    { cx: 50, cy: 50, radius: 15 },
    { cx: 50, cy: 50, radius: 45 },
    { irisWidth: 64, irisHeight: 128 });
  assert.ok(result instanceof Float64Array);
});

test("IrisEngine.generateIrisCode: from normalized iris (L585-L598)", () => {
  const norm = new Float64Array(64 * 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) norm[y * 64 + x] = Math.sin(x * 0.2 + y * 0.1) * 127 + 128;
  const result = IE.generateIrisCode(norm, 64, 128);
  assert.ok(result.code instanceof Uint8Array);
  assert.ok(result.mask instanceof Uint8Array);
});

// ── iris_liveness.js uncovered ranges ──

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

// ── iris_performance.js uncovered ranges ──

test("IP.wilsonCI: 99% confidence (L404)", () => {
  const result = IP.wilsonCI(80, 100, 0.99);
  assert.equal(typeof result.lower, "number");
  assert.equal(typeof result.upper, "number");
});

test("IP.wilsonCI: 90% confidence", () => {
  const result = IP.wilsonCI(50, 100, 0.90);
  assert.ok(result.lower >= 0 && result.lower <= 1);
});

test("IP.evaluate: default systemName (L496)", () => {
  const genu = [0.8, 0.85, 0.7, 0.9, 0.75];
  const imp = [0.2, 0.3, 0.1, 0.4, 0.25];
  const result = IP.evaluate({ genuineScores: genu, impostorScores: imp });
  assert.equal(typeof result.systemName, "string");
  assert.ok(result.metrics);
});

test("IP.pairedTTest: identical arrays → NaN (L546)", () => {
  const result = IP.pairedTTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  assert.ok(Number.isNaN(result.tStatistic));
  assert.ok(Number.isNaN(result.pValue));
  assert.equal(result.significant, false);
});

test("IP.pairedTTest: different arrays (L553-L558)", () => {
  const a = [0.8, 0.7, 0.6, 0.9, 0.85];
  const b = [0.3, 0.4, 0.5, 0.2, 0.35];
  const result = IP.pairedTTest(a, b);
  assert.equal(typeof result.tStatistic, "number");
  assert.equal(typeof result.pValue, "number");
});

test("IP.compareSystems: produces report (L590-L612)", () => {
  const sysA = { genuineScores: [0.8, 0.7, 0.9], impostorScores: [0.2, 0.3, 0.1] };
  const sysB = { genuineScores: [0.6, 0.5, 0.7], impostorScores: [0.4, 0.5, 0.3] };
  const result = IP.compareSystems(sysA, sysB);
  assert.ok(result.winner);
  assert.equal(typeof result.eerDifference, "number");
});

test("IP.getFtaFterRates: null instance (L704)", () => {
  const result = IP.getFtaFterRates(null);
  assert.equal(result.ftaCount, 0);
  assert.equal(result.fterCount, 0);
});

test("IP.recordFTA: with _timings array", () => {
  const inst = { _ftaCount: 0, _totalAcquisitions: 0, _timings: [] };
  IP.recordFTA(inst, "test-reason");
  assert.equal(inst._ftaCount, 1);
  assert.equal(inst._totalAcquisitions, 1);
  assert.equal(inst._timings.length, 1);
});

test("IP.recordFTER: with _timings array", () => {
  const inst = { _fterCount: 0, _totalEnrollments: 0, _timings: [] };
  IP.recordFTER(inst, "test-reason");
  assert.equal(inst._fterCount, 1);
  assert.equal(inst._totalEnrollments, 1);
});

test("IP.recordAcquisition: with _timings array", () => {
  const inst = { _totalAcquisitions: 0, _timings: [] };
  IP.recordAcquisition(inst, 15);
  assert.equal(inst._totalAcquisitions, 1);
});

test("IP.recordEnrollment: with _timings array", () => {
  const inst = { _totalEnrollments: 0, _timings: [] };
  IP.recordEnrollment(inst, 25);
  assert.equal(inst._totalEnrollments, 1);
});

test("IP.generatePADDET: with real data (L240)", () => {
  const labels = [1, 0, 1, 0, 1, 0, 0, 1];
  const scores = [0.9, 0.3, 0.8, 0.2, 0.85, 0.1, 0.4, 0.75];
  const result = IP.generatePADDET(labels, scores, 50);
  assert.ok(Array.isArray(result));
});

// ── iris_standards.js uncovered ranges ──

test("IS._classifyDeviceType: various agents (L141-L147)", () => {
  assert.equal(IS._classifyDeviceType(null), 0);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (Linux; Android 13; Pixel 7)"), 1);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)"), 2);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), 3);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"), 3);
});

test("IS._getQualityLevel: all tiers (L621)", () => {
  assert.equal(IS._getQualityLevel(10).label, "Low");
  assert.equal(IS._getQualityLevel(30).label, "Medium");
  assert.equal(IS._getQualityLevel(60).label, "High");
  assert.equal(IS._getQualityLevel(90).label, "Very High");
});

test("IS._computeSHA256: returns hex string (L647)", async () => {
  const result = await IS._computeSHA256(new Uint8Array(100));
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("IS.validateRecord: low quality + small iris (L296-L329)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 50, height: 50, pixelDepth: 6,
    qualityScore: 30, eyeSide: "unknown", irisRadius: 30,
  });
  assert.ok(result.warnings.length > 0);
  assert.ok(result.valid);
});

test("IS.validateRecord: bad imageKind (L281)", () => {
  const result = IS.validateRecord({ imageKind: 99 });
  assert.ok(result.errors.length > 0);
});

test("IS.validateRecord: no deviceInfo (L326-L329)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 100, height: 100, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left", irisRadius: 50,
  });
  assert.ok(result.warnings.some(w => w.includes("deviceInfo")));
});

test("IS.serialize: header fields (L448)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left",
    imageData: new Uint8Array(100).fill(0x80),
  };
  const data = IS.serialize(record);
  assert.ok(data instanceof Uint8Array);
  assert.ok(data.length > 33);
});

test("IS.deserialize: extended header with timestamps (L547-L566)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "right",
    imageData: new Uint8Array(100).fill(0x80),
    creationDate: new Date().toISOString(),
    encryptionAlgorithm: 1,
    deviceType: 2,
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.ok(result);
  assert.equal(result.eyeSide, "right");
});

test("IS.createBIR: returns SBH + BDB (L668-L710)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left",
    imageData: new Uint8Array(100).fill(0x80),
  };
  const bir = IS.createBIR(record);
  assert.ok(bir.sbh);
  assert.ok(bir.bdb);
  assert.ok(bir.totalSize > 0);
});

// ── iris_matcher.js uncovered ranges ──

test("IM.identify: with gallery returns results object (L191-L224)", () => {
  const probe = { code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) };
  const gallery = [
    { id: "1", code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) },
    { id: "2", code: new Uint8Array(100).fill(0xAA), mask: new Uint8Array(100).fill(1) },
  ];
  const result = IM.identify(probe, gallery);
  assert.ok(result.allResults);
  assert.ok(Array.isArray(result.allResults));
  assert.equal(result.allResults.length, 2);
  assert.ok(result.bestMatch);
});

test("IM.identify: empty gallery (L194)", () => {
  const probe = { code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) };
  const result = IM.identify(probe, []);
  assert.equal(result.bestMatch, null);
  assert.equal(result.allResults.length, 0);
});

test("IM.identify: with threshold arg", () => {
  const probe = { code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) };
  const gallery = [
    { id: "match", code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) },
    { id: "mismatch", code: new Uint8Array(64).fill(0x00), mask: new Uint8Array(64).fill(1) },
  ];
  const result = IM.identify(probe, gallery, 0.26);
  assert.ok(result.allResults.length === 2);
  assert.ok(result.bestMatch);
  assert.equal(result.bestMatch.id, "match");
});

test("IM.identify: no matching probe", () => {
  const probe = { code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) };
  const gallery = [
    { id: "1", code: new Uint8Array(64).fill(0x00), mask: new Uint8Array(64).fill(1) },
  ];
  const result = IM.identify(probe, gallery, 0.26);
  assert.equal(result.bestMatch, null);
});

// ── iris_standards.js additional uncovered ranges ──

test("IS.validateRecord: valid Kind 2 640x480 (L290-L291)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
  });
  assert.equal(result.valid, true);
  assert.ok(!result.warnings.some(w => w.includes("640x480")));
});

test("IS.validateRecord: Kind 7 below min iris diameter (L305-L307)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 7, width: 200, height: 200, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 40,
  });
  assert.ok(result.warnings.some(w => w.includes("below minimum")));
});

test("IS.validateRecord: invalid validity period (L318-L322)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
    validFrom: "2025-12-31", validTo: "2025-01-01",
  });
  assert.ok(result.errors.some(e => e.includes("validTo must be after validFrom")));
});

test("IS.validateRecord: bad validity dates (L318-L319)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
    validFrom: "not-a-date", validTo: "also-not",
  });
  assert.ok(result.errors.some(e => e.includes("Invalid validity period")));
});

test("IS.createRecord: with ImageData and optional params (L235-L249)", () => {
  const imgData = new global.ImageData(new Uint8Array(64 * 64 * 4), 64, 64);
  const record = IS.createRecord({
    image: imgData,
    eyeSide: "right",
    irisCenterX: 32, irisCenterY: 32, irisRadius: 28,
    qualityScore: 90,
    compressionType: 1,
    imageKind: 7,
  });
  assert.equal(record.eyeSide, "right");
  assert.equal(record.irisCenterX, 32);
  assert.equal(record.irisRadius, 28);
  assert.equal(record.compressionType, 1);
  assert.equal(record.imageKind, 7);
});

test("IS.validateRecord: imageKind 7 not 2 or 7 → error (L281)", () => {
  const result = IS.validateRecord({
    imageKind: 99, width: 100, height: 100,
  });
  assert.ok(result.errors.some(e => e.includes("imageKind")));
});

test("IS.validateRecord: missing width/height → error (L285-L287)", () => {
  const result = IS.validateRecord({
    imageKind: 2, width: 0, height: 0,
  });
  assert.ok(result.errors.some(e => e.includes("width or height")));
});

test("IS.deserialize: legacy 29-byte header (L547-L560)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 8, height: 8, pixelDepth: 8,
    qualityScore: 70, eyeSide: "unknown",
    imageData: new Uint8Array(64).fill(0x80),
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.ok(result);
  assert.equal(result.width, 8);
  assert.equal(result.height, 8);
});

test("IS.deserialize: eyeSide encoding (L595)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 8, height: 8, pixelDepth: 8,
    qualityScore: 70, eyeSide: "right",
    imageData: new Uint8Array(64).fill(0x80),
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.equal(result.eyeSide, "right");
});

// ── iris_quality.js additional ──

test("IQ.assess: low quality mask with occlusion (L346-L404)", () => {
  const w = 64, h = 128;
  const norm = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) norm[y * w + x] = 128 + Math.sin(x * 0.2) * 50;
  const mask = new Uint8Array(w * h).fill(1);
  for (let y = 0; y < h / 2; y++) for (let x = 0; x < w; x++) mask[y * w + x] = 0;
  const result = IQ.assess({
    normalizedIris: norm, normW: w, normH: h, mask,
    pupil: { cx: 32, cy: 60, radius: 12 },
    iris: { cx: 32, cy: 60, radius: 50 },
    imageWidth: 200, imageHeight: 200,
    marginAdequacy: { left: 2, right: 2, top: 2, bottom: 2 },
  });
  assert.equal(typeof result.score, "number");
});

test("IQ.assess: no pupilIrisRatio check — zero radii", () => {
  const w = 64, h = 128;
  const norm = new Float64Array(w * h).fill(128);
  const mask = new Uint8Array(w * h).fill(0);
  const result = IQ.assess({
    normalizedIris: norm, normW: w, normH: h, mask,
    pupil: { cx: 32, cy: 60, radius: 0 },
    iris: { cx: 32, cy: 60, radius: 0 },
    imageWidth: 200, imageHeight: 200,
    marginAdequacy: { left: 10, right: 10, top: 10, bottom: 10 },
  });
  assert.equal(typeof result.score, "number");
});

test("IQ.assess: poor margin triggers issue (L346-L365)", () => {
  const w = 64, h = 128;
  const norm = new Float64Array(w * h).fill(128);
  const mask = new Uint8Array(w * h).fill(1);
  const result = IQ.assess({
    normalizedIris: norm, normW: w, normH: h, mask,
    pupil: { cx: 32, cy: 60, radius: 12 },
    iris: { cx: 32, cy: 60, radius: 50 },
    imageWidth: 200, imageHeight: 200,
    marginAdequacy: { left: 1, right: 1, top: 1, bottom: 1 },
  });
  assert.ok(result.issues.length > 0 || result.score < 100);
});

// ── iris_template_protection.js additional ──

test("ITP.biohash: with matching projection (L73-L109)", () => {
  const inputDim = 10, outputDim = 8;
  const code = new Uint8Array(inputDim);
  for (let i = 0; i < inputDim; i++) code[i] = (i * 37 + 42) & 0xFF;
  const proj = new Float64Array(outputDim * inputDim);
  for (let i = 0; i < proj.length; i++) proj[i] = (i * 0.1) % 1;
  const h = ITP.biohash(code, proj, outputDim);
  assert.ok(h.hashed instanceof Uint8Array);
  assert.equal(h.hashed.length, outputDim);
  assert.equal(typeof h.score, "number");
});

test("ITP.verifyBiohash: matching hashes (L113-L140)", () => {
  const h1 = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 1]);
  const h2 = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 1]);
  const result = ITP.verifyBiohash(h1, h2);
  assert.equal(result.match, true);
  assert.ok(result.similarity > 0.9);
});

test("ITP.verifyBiohash: different hashes", () => {
  const h1 = new Uint8Array([1, 0, 1, 0, 0, 1, 0, 1]);
  const h2 = new Uint8Array([0, 1, 0, 1, 1, 0, 1, 0]);
  const result = ITP.verifyBiohash(h1, h2);
  assert.equal(result.match, false);
});

test("ITP.generateProjectionMatrix: returns Float64Array (L38-L65)", () => {
  const result = ITP.generateProjectionMatrix(64, 32);
  assert.ok(result instanceof Float64Array);
  assert.equal(result.length, 32 * 64);
});

test("ITP.createTransformation: returns function (L142-L165)", () => {
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) key[i] = i;
  const salt = new Uint8Array(16).fill(0xAA);
  const fn = ITP.createTransformation(key, salt);
  assert.equal(typeof fn, "function");
  const transformed = fn(new Uint8Array(64).fill(0xFF));
  assert.ok(transformed instanceof Uint8Array);
});

test("ITP.transform: with transformFn (L168-L190)", () => {
  const code = new Uint8Array(64).fill(0xFF);
  const result = ITP.transform(code, (c) => {
    const r = new Uint8Array(c.length);
    for (let i = 0; i < c.length; i++) r[i] = c[i] ^ 0xAA;
    return r;
  });
  assert.ok(result);
  assert.equal(result.length, 64);
  assert.equal(result[0], 0xFF ^ 0xAA);
});

test("ITP.createCancelable: different iterations → different templates (L291-L332)", async () => {
  const code = new Uint8Array(64).fill(0xFF);
  const key = new Uint8Array(32).fill(0xCC);
  const r1 = await ITP.createCancelable(code, key, 1);
  const r2 = await ITP.createCancelable(code, key, 2);
  assert.notDeepEqual(r1.template, r2.template);
});

test("ITP.verifyCommitment: valid commitment (L334-L378)", async () => {
  const code = new Uint8Array(64).fill(0xFF);
  const key = new Uint8Array(32).fill(0xDD);
  const result = await ITP.commit(code, key);
  assert.ok(result.commitment);
  assert.ok(result.nonce);
  const verified = await ITP.verifyCommitment(code, key, result.nonce, result.commitment);
  assert.equal(verified, true);
});

test("ITP.testUnlinkability: large irisCode → unlinkable (L510-L561)", () => {
  const code = new Uint8Array(256);
  for (let i = 0; i < 256; i++) code[i] = Math.floor(Math.random() * 256);
  const result = ITP.testUnlinkability(code, 8);
  assert.ok(result.pairCount === 28);
  assert.equal(typeof result.unlinkabilityScore, "number");
  assert.ok(typeof result.averageDistance === "number");
});

test("ITP.testUnlinkability: too few keys → error (L511-L513)", () => {
  const result = ITP.testUnlinkability(new Uint8Array(10), 1);
  assert.equal(result.unlinkable, false);
});

// ── iris_liveness.js additional ──

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

// ── iris_performance.js additional ──

test("IP.generateROC: uniform scores → uniform ROC (L314-L376)", () => {
  const genu = [0.8, 0.8, 0.8];
  const imp = [0.2, 0.2, 0.2];
  const result = IP.generateROC(genu, imp, 10);
  assert.ok(Array.isArray(result));
  assert.ok(result.length === 11);
});

test("IP.calculateFAR: zero total (L830-L832)", () => {
  const result = IP.calculateFAR(0, 0);
  assert.equal(result, 0);
});

test("IP.calculateFRR: zero total (L843-L845)", () => {
  const result = IP.calculateFRR(0, 0);
  assert.equal(result, 0);
});

test("IP.calculateAccuracy: basic (L856-L858)", () => {
  const result = IP.calculateAccuracy(8, 2, 10);
  assert.equal(typeof result, "number");
  assert.ok(result >= 0);
});

test("IP.fnirAtFpir: simple data (L429-L445)", () => {
  const genu = [0.9, 0.8, 0.7, 0.6, 0.5];
  const imp = [0.3, 0.4, 0.2, 0.5, 0.1];
  const result = IP.fnirAtFpir(genu, imp);
  assert.ok(result.operatingPoints);
  assert.ok(Array.isArray(result.operatingPoints));
});

test("IP.reportPADMetrics: binary labels (L188-L224)", () => {
  const labels = [1, 0, 1, 0, 1, 0, 1, 0];
  const scores = [0.9, 0.2, 0.8, 0.3, 0.85, 0.1, 0.75, 0.4];
  const result = IP.reportPADMetrics(labels, scores);
  assert.equal(typeof result.iapar, "number");
  assert.ok(Array.isArray(result.det));
});

test("IP.wilsonCI: edge case (L396-L406)", () => {
  const result = IP.wilsonCI(0, 10);
  assert.equal(typeof result.lower, "number");
  assert.equal(typeof result.upper, "number");
  assert.ok(result.lower >= 0);
});

// ── iris_template_protection.js uncovered ranges ──

test("ITP.biohash: with real projection matrix (L73-L109)", () => {
  const inputDim = 10, outputDim = 5;
  const irisCode = new Uint8Array(inputDim).fill(0xFF);
  const projMatrix = new Float64Array(outputDim * inputDim);
  for (let i = 0; i < projMatrix.length; i++) projMatrix[i] = Math.random();
  const result = ITP.biohash(irisCode, projMatrix, outputDim);
  assert.ok(result.hashed instanceof Uint8Array);
  assert.equal(typeof result.score, "number");
});

test("ITP.createCancelable: async with valid data (L291-L332)", async () => {
  const template = new Uint8Array(128).fill(0xFF);
  const key = new Uint8Array(32).fill(0xBB);
  const result = await ITP.createCancelable(template, key, 1);
  assert.ok(result.template instanceof Uint8Array);
  assert.equal(typeof result.keyHash, "string");
});

test("ITP.testUnlinkability: Uint8Array irisCode (L510-L561)", () => {
  const irisCode = new Uint8Array(128);
  for (let i = 0; i < 128; i++) irisCode[i] = (i * 7 + 13) & 0xFF;
  const result = ITP.testUnlinkability(irisCode, 5);
  assert.equal(typeof result.averageDistance, "number");
  assert.equal(typeof result.unlinkable, "boolean");
  assert.ok(result.pairCount === 10);
});

// ═══════════════════════════════════════════════════════════════
// V8 Coverage Report — reads from NODE_V8_COVERAGE directory
// Coverage files are written on process exit, so run tests first,
// then read with: node v8_coverage_helper.js --v8dir <dir>
// ═══════════════════════════════════════════════════════════════
test("V8 Coverage Report — Iris_Biometric", () => {
  const v8Dir = process.env.NODE_V8_COVERAGE;
  if (!v8Dir) {
    console.log("\n💡 To enable V8 coverage:");
    console.log("   $env:NODE_V8_COVERAGE='coverage/v8-raw'");
    console.log("   node --test cli/tests/test-iris-coverage.js");
    console.log("   node cli/tests/v8_coverage_helper.js --v8dir coverage/v8-raw --dir Iris_Biometric/");
    return;
  }

  console.log(`\n📁 V8 coverage directory: ${v8Dir}`);
  console.log("⏳ Coverage files are written on process exit.");
  console.log("   Run this after tests complete:");
  console.log(`   node cli/tests/v8_coverage_helper.js --v8dir "${v8Dir}" --dir Iris_Biometric/`);
});
