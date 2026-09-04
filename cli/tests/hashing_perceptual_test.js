const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("canvas");

// ── Polyfills ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.document = {
  createElement: (tag) => {
    if (tag === "canvas") {
      const c = createCanvas(1, 1);
      return c;
    }
    return { getContext: () => null };
  },
  addEventListener: () => {},
  getElementById: () => null,
};
globalThis.ImageData = class {};

const src = fs.readFileSync(
  path.join(__dirname, "../../Fingerprint/hashing_perceptual.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(__dirname, "../../Fingerprint/hashing_perceptual.js"),
});

// ── Helpers ──
function makeTestImageData(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.floor((x / w) * 255);
      const g = Math.floor((y / h) * 255);
      const b = Math.floor(128 + Math.sin(x * 0.5) * 64);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const imgData = ctx.getImageData(0, 0, w, h);
  imgData.w = w;
  imgData.h = h;
  return imgData;
}

// ── Tests: ahash ──
describe("Perceptual Hashing — ahash", () => {
  it("should return a 16-char hex string for a 64x64 image", () => {
    const imgData = makeTestImageData(64, 64);
    const hash = globalThis.ahash(imgData);
    assert.ok(
      /^[0-9a-f]{16}$/i.test(hash),
      `Expected 16-char hex, got '${hash}'`,
    );
  });

  it("should return consistent results for the same image", () => {
    const imgData = makeTestImageData(32, 32);
    const h1 = globalThis.ahash(imgData);
    const h2 = globalThis.ahash(imgData);
    assert.equal(h1, h2);
  });
});

// ── Tests: dhash ──
describe("Perceptual Hashing — dhash", () => {
  it("should return a hex string", () => {
    const imgData = makeTestImageData(64, 64);
    const hash = globalThis.dhash(imgData);
    assert.ok(/^[0-9a-f]+$/i.test(hash), `Expected hex string, got '${hash}'`);
  });

  it("should produce different hashes for different images", () => {
    const img1 = makeTestImageData(32, 32);
    const img2 = makeTestImageData(32, 32);
    const h1 = globalThis.dhash(img1);
    // Create a uniform white image
    const canvas = new (require("canvas").createCanvas)(32, 32);
    const ctx2 = canvas.getContext("2d");
    ctx2.fillStyle = "#ffffff";
    ctx2.fillRect(0, 0, 32, 32);
    const imgData2 = ctx2.getImageData(0, 0, 32, 32);
    imgData2.w = 32;
    imgData2.h = 32;
    const h2 = globalThis.dhash(imgData2);
    assert.notEqual(h1, h2);
  });
});

// ── Tests: phash ──
describe("Perceptual Hashing — phash", () => {
  it("should return a 16-char hex string", () => {
    const imgData = makeTestImageData(64, 64);
    const hash = globalThis.phash(imgData);
    assert.ok(/^[0-9a-f]{16}$/i.test(hash));
  });

  it("should be consistent", () => {
    const imgData = makeTestImageData(64, 64);
    const h1 = globalThis.phash(imgData);
    const h2 = globalThis.phash(imgData);
    assert.equal(h1, h2);
  });
});

// ── Tests: whash ──
describe("Perceptual Hashing — whash", () => {
  it("should return a 16-char hex string", () => {
    const imgData = makeTestImageData(64, 64);
    const hash = globalThis.whash(imgData);
    assert.ok(/^[0-9a-f]{16}$/i.test(hash));
  });
});

// ── Tests: resizeImageData ──
describe("Perceptual Hashing — resizeImageData", () => {
  it("should resize to the target size", () => {
    const imgData = makeTestImageData(64, 64);
    const resized = globalThis.resizeImageData(imgData, 32);
    assert.equal(resized.w, 32);
    assert.equal(resized.h, 32);
    assert.equal(resized.data.length, 32 * 32 * 4);
  });
});
