const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ── Minimal DOM polyfill so browser globals load cleanly ──
global.window = global;
// file: protocol makes the GPL domain guard pass without throwing
global.location = { protocol: "file:", href: "file:///test" };
global.document = {
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
        }),
      };
    }
    return null;
  },
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
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};
// Some modules call these during init; no-ops keep load clean.
global.localStorage = {
  _m: {},
  getItem(k) { return this._m[k] ?? null; },
  setItem(k, v) { this._m[k] = String(v); },
};

// ── Load Iris modules under test ──
const irisDir = path.join(__dirname, "..", "..", "Iris_Biometric");
for (const file of ["iris_quality_full.js", "iris_matcher.js", "iris_ui.js"]) {
  const src = fs.readFileSync(path.join(irisDir, file), "utf8");
  vm.runInThisContext(src, { filename: path.join(irisDir, file) });
}

// iris_engine.js sets the authoritative window.IRIS_ENGINE_CONFIG.
// Load it so the matcher uses the real production threshold.
try {
  const eng = fs.readFileSync(path.join(irisDir, "iris_engine.js"), "utf8");
  vm.runInThisContext(eng, { filename: path.join(irisDir, "iris_engine.js") });
} catch {
  // engine may need heavier deps; matcher falls back to literal default
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1.1 — Lossless capture enforcement (reject JPEG)
// Source: OSAC 2024-N-0004 §4.3.5 — iris image data should be
// uncompressed (PNG/BMP), never lossy JPEG.
// ═══════════════════════════════════════════════════════════════

describe("Phase1.1 irisValidateImageFile (lossless only)", () => {
  it("rejects JPEG by MIME type", () => {
    const r = irisValidateImageFile({ type: "image/jpeg", name: "eye.jpg" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "jpeg-not-allowed");
  });

  it("rejects uppercase JPEG extension with empty type", () => {
    const r = irisValidateImageFile({ type: "", name: "EYE.JPEG" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "jpeg-not-allowed");
  });

  it("rejects generic octet-stream with jpg name", () => {
    const r = irisValidateImageFile({ type: "application/octet-stream", name: "eye.jpg" });
    assert.equal(r.ok, false);
  });

  it("accepts PNG by MIME type", () => {
    const r = irisValidateImageFile({ type: "image/png", name: "eye.png" });
    assert.equal(r.ok, true);
  });

  it("accepts BMP by MIME type", () => {
    const r = irisValidateImageFile({ type: "image/bmp", name: "eye.bmp" });
    assert.equal(r.ok, true);
  });

  it("accepts PNG/BMP by extension when MIME missing", () => {
    assert.equal(irisValidateImageFile({ type: "", name: "eye.png" }).ok, true);
    assert.equal(irisValidateImageFile({ type: "", name: "eye.bmp" }).ok, true);
  });

  it("rejects unsupported formats", () => {
    const r = irisValidateImageFile({ type: "image/gif", name: "eye.gif" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unsupported-format");
  });

  it("rejects missing file", () => {
    assert.equal(irisValidateImageFile(null).ok, false);
  });
});

// ═══════════════════════════════════════════════════════════════
// PHASE 1.2 — Specular reflection detection metric
// Source: ISO/IEC 29794-6 §6 (metric 12) + OSAC 2024-N-0004 §3.5
// ═══════════════════════════════════════════════════════════════

describe("Phase1.2 IrisQualityFull.specularReflection", () => {
  /**
   *
   * @param opts
   */
  function buildIrisImage(opts) {
    const w = 200, h = 200;
    const data = new Uint8ClampedArray(w * h).fill(100);
    const cx = 100, cy = 100;
    const irisR = 60;
    if (opts && opts.specular) {
      // Paint a saturated (near-white) blob inside the iris annulus
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d >= irisR * 0.3 && d <= irisR * 0.95 && Math.hypot(x - (cx + 20), y - cy) < 8) data[y * w + x] = 255;
        }
      }
    }
    return {
      data, width: w, height: h,
      pupil: { x: cx, y: cy, radius: 20 },
      iris: { x: cx, y: cy, radius: irisR },
    };
  }

  it("returns 0 ratio when no saturated pixels", () => {
    const img = buildIrisImage({ specular: false });
    const r = IrisQualityFull.specularReflection(
      img.data, img.width, img.height, img.pupil, img.iris
    );
    assert.equal(r.ratio, 0);
    assert.equal(r.saturatedPx, 0);
    assert.ok(r.irisPx > 0);
  });

  it("detects saturated specular blob inside iris", () => {
    const img = buildIrisImage({ specular: true });
    const r = IrisQualityFull.specularReflection(
      img.data, img.width, img.height, img.pupil, img.iris
    );
    assert.ok(r.saturatedPx > 0, "should count saturated pixels");
    assert.ok(r.ratio > 0 && r.ratio < 1, "ratio in (0,1): " + r.ratio);
  });

  it("is surfaced in computeCompositeQuality metrics", () => {
    const img = buildIrisImage({ specular: true });
    const q = IrisQualityFull.computeCompositeQuality({
      imageData: img.data,
      width: img.width,
      height: img.height,
      mask: new Uint8Array(img.width * img.height).fill(1),
      pupil: img.pupil,
      iris: img.iris,
    });
    assert.ok("specularReflection" in q.metrics, "metric present");
    assert.ok(q.metrics.specularReflection >= 0);
  });

  it("is evaluated in acquisition gates", () => {
    const img = buildIrisImage({ specular: true });
    const gates = IrisQualityFull.evaluateAcquisitionGates({
      imageData: img.data,
      width: img.width,
      height: img.height,
      mask: new Uint8Array(img.width * img.height).fill(1),
      pupil: img.pupil,
      iris: img.iris,
    });
    assert.ok("specularReflectionRatio" in gates.metrics, "gate metric present");
  });
});

// ═══════════════════════════════════════════════════════════════
// PHASE 1.3 — Tighten Hamming threshold to 0.26 (Daugman FMR)
// Source: Daugman — HD threshold ~0.26 yields FMR < 10^-11
// ═══════════════════════════════════════════════════════════════

describe("Phase1.3 IrisMatcher threshold = 0.26", () => {
  /**
   *
   * @param hdTarget
   * @param len
   */
  function makeCode(hdTarget, len) {
    len = len || 512;
    const a = new Uint8Array(len).fill(0);
    const b = new Uint8Array(len).fill(0);
    const mask = new Uint8Array(len).fill(1);
    const flip = Math.round(hdTarget * len);
    for (let i = 0; i < flip; i++) b[i] = 1;
    return [{ code: a, mask }, { code: b, mask }];
  }

  it("engine config default is 0.26", () => {
    if (typeof IRIS_ENGINE_CONFIG === "undefined") {
      // matcher literal fallback
      const [a, b] = makeCode(0.3);
      const r = IrisMatcher.hammingDistance(a, b);
      assert.equal(r.match, false); // 0.30 > 0.26
    } else {
      assert.equal(IRIS_ENGINE_CONFIG.hammingThreshold, 0.26);
    }
  });

  it("HD 0.20 matches (below 0.26)", () => {
    const [a, b] = makeCode(0.2);
    const r = IrisMatcher.compare(a, b);
    assert.equal(r.match, true);
  });

  it("HD 0.30 does NOT match (above 0.26)", () => {
    const [a, b] = makeCode(0.3);
    const r = IrisMatcher.compare(a, b);
    assert.equal(r.match, false);
  });

  it("boundary HD 0.26 still matches (<=)", () => {
    const [a, b] = makeCode(0.26);
    const r = IrisMatcher.compare(a, b);
    assert.equal(r.match, true);
  });
});
