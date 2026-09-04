// ── Shared setup for iris biometric unit tests ──
// Provides: DOM polyfills, module loading, global aliases
// Usage: require('./setup') at the top of each test file
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ── DOM polyfills ──
global.window = global;
global.self = global;
global.location = { protocol: "file:", href: "file:///test" };
global.navigator = { userAgent: "node-test" };
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (t) => {
    if (t === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({
            data: new Uint8ClampedArray(640 * 480 * 4),
            width: 640,
            height: 480,
          }),
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
      getAttribute() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
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
  constructor(d, w, h) {
    this.data = d;
    this.width = w;
    this.height = h;
  }
};
global.Blob = class Blob {};
global.FileReader = class FileReader {};
global.crypto = {
  subtle: { digest: async () => new ArrayBuffer(32) },
  getRandomValues: (a) => {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  },
};
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.__ = (k, d) => (d === undefined ? k : d);
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// ── Load all iris modules ──
const irisDir = path.join(__dirname, "..", "..", "..", "Iris_Biometric");
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
  } catch (_) {
    /* extra globals may be needed */
  }
}

// ── Module aliases ──
globalThis.IQ = global.IrisQuality;
globalThis.IE = global.IrisEngine;
globalThis.IM = global.IrisMatcher;
globalThis.IP = global.IrisPerformance;
globalThis.IL = global.IrisLiveness;
globalThis.IS = global.IrisStandards;
globalThis.ITP = global.IrisTemplateProtection;
globalThis.IC = global.IrisCamera;
globalThis.ISt = global.IrisStorage;
globalThis.IQF = global.IrisQualityFull;
globalThis.THRESH = global.IRIS_QUALITY_THRESHOLDS;
