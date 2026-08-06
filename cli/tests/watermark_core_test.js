const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas, ImageData } = require("canvas");

// Polyfills
globalThis.document = {
  createElement: (tag) => (tag === "canvas" ? createCanvas(1, 1) : { getContext: () => null }),
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.window = globalThis;
globalThis.ImageData = ImageData;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

const crypto = require("crypto");
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => crypto.createHash("sha256").update(Buffer.from(data)).digest(),
      importKey: async (f, kd) => ({ type: "secret", keyData: kd }),
      deriveBits: async (algo, key, len) =>
        crypto.pbkdf2Sync(
          Buffer.from(key.keyData),
          algo.salt || Buffer.from(key.keyData),
          algo.iterations || 1,
          len / 8,
          "sha256",
        ),
      generateKey: async () => ({ publicKey: {}, privateKey: {} }),
      sign: async () => new Uint8Array(64),
      verify: async () => true,
    },
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
}

// sha256Hex for wm8 tests
globalThis.sha256Hex = async (data) => {
  const h = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Load watermark modules
const MODULES = [
  ["../../Watermark/utils.js", "utils.js"],
  ["../../Watermark/watermark_core.js", "watermark_core.js"],
  ["../../Pixel_Injection/watermark_core_advanced.js", "watermark_core_advanced.js"],
  ["../../Pixel_Injection/watermark_core_transforms.js", "watermark_core_transforms.js"],
  ["../../Pixel_Injection/watermark_core_algorithms.js", "watermark_core_algorithms.js"],
];
for (const [rel, name] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
}

function createTestImage(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.floor((x / w) * 255);
      const g = Math.floor((y / h) * 255);
      const b = Math.floor(128 + Math.sin(x * 0.2) * 64);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const imgData = ctx.getImageData(0, 0, w, h);
  imgData.w = w;
  imgData.h = h;
  return { canvas, ctx, imgData, w, h };
}

function rgbToYcbcr(imgData) {
  const { data, w, h } = imgData;
  const Y = new Float64Array(w * h);
  const Cb = new Float64Array(w * h);
  const Cr = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  return { Y, Cb, Cr };
}

function ycbcrToData(Y, Cb, Cr, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const y = Y[i],
      cb = Cb[i] - 128,
      cr = Cr[i] - 128;
    data[i * 4] = Math.max(0, Math.min(255, Math.round(y + 1.402 * cr)));
    data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(y - 0.3441 * cb - 0.7141 * cr)));
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(y + 1.772 * cb)));
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("Utility functions", () => {
  it("bits should return correct bit string from Uint8Array", () => {
    const b = globalThis.bits(new Uint8Array([0x0f, 0xf0]));
    assert.equal(b, "0000111111110000");
  });
  it("from_bits should convert bit string back to Uint8Array", () => {
    const result = globalThis.from_bits("0000111111110000");
    assert.deepEqual(Array.from(result), [0x0f, 0xf0]);
  });
  it("bits/from_bits roundtrip", () => {
    const data = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
    const b = globalThis.bits(data);
    const result = globalThis.from_bits(b);
    assert.deepEqual(Array.from(result), Array.from(data));
  });
  it("xor_bytes should XOR two arrays", () => {
    const a = new Uint8Array([0xff, 0x00, 0x0f]);
    const b = new Uint8Array([0x00, 0xff, 0xf0]);
    const x = globalThis.xor_bytes(a, b);
    assert.deepEqual(x, new Uint8Array([0xff, 0xff, 0xff]));
  });
  it("xor_bytes with empty key should return input", () => {
    const a = new Uint8Array([1, 2, 3]);
    const x = globalThis.xor_bytes(a, null);
    assert.deepEqual(Array.from(x), [1, 2, 3]);
  });
});

describe("Watermark Core", () => {
  it("should embed text into a test image", () => {
    const c1 = createTestImage(64, 64);
    const secretData = new Uint8Array([0xde, 0xad]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const lenBytes = [
      (raw.length >> 24) & 0xff,
      (raw.length >> 16) & 0xff,
      (raw.length >> 8) & 0xff,
      raw.length & 0xff,
    ];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes);
    payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    globalThis.wm1_embed(c1.imgData, payloadBits);
    const extracted = globalThis.wm1_extract(c1.imgData);
    assert.ok(extracted.length >= 32);
    const dlen = parseInt(extracted.substr(0, 32), 2);
    assert.ok(dlen > 0 && dlen < 100000);
  });
  it("should embed and verify wm3 extraction", () => {
    const c3 = createTestImage(64, 64);
    const seed = 12345;
    const secretData = new Uint8Array([0xbe, 0xef]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xca, 0xfe]);
    raw.set(secretData, 2);
    const lenBytes = [
      (raw.length >> 24) & 0xff,
      (raw.length >> 16) & 0xff,
      (raw.length >> 8) & 0xff,
      raw.length & 0xff,
    ];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes);
    payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    globalThis.wm3_embed(c3.imgData, payloadBits, seed);
    const extracted = globalThis.wm3_extract(c3.imgData, seed);
    assert.ok(extracted.length >= 32);
    const dlen = parseInt(extracted.substr(0, 32), 2);
    assert.ok(dlen > 0 && dlen < 100000);
  });

  it("wm3_extract should handle maxBits limit with invalid length header", () => {
    const c = createTestImage(8, 8);
    const invalidPayload = "00000000000000000000000000000000" + "10101010".repeat(8);
    globalThis.wm3_embed(c.imgData, invalidPayload, 12345);
    const result = globalThis.wm3_extract(c.imgData, 12345);
    assert.ok(result.length > 0);
  });
});

describe("DCT Embed/Extract", () => {
  it("should embed and extract via DCT", () => {
    const c2 = createTestImage(64, 64);
    const cap = globalThis.maxDCTBits(64, 64, 11);
    const secretData = new Uint8Array([0xde, 0xad]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const lenBytes = [
      (raw.length >> 24) & 0xff,
      (raw.length >> 16) & 0xff,
      (raw.length >> 8) & 0xff,
      raw.length & 0xff,
    ];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes);
    payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    assert.ok(payloadBits.length <= cap, "Payload fits in capacity");

    const ycbcr = rgbToYcbcr(c2.imgData);
    globalThis.embedInDCT(ycbcr.Y, 64, 64, payloadBits, 25);
    const resultData = ycbcrToData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, 64, 64);
    c2.imgData.data.set(resultData);

    const ycbcr2 = rgbToYcbcr(c2.imgData);
    const b = globalThis.extractFromDCT(ycbcr2.Y, 64, 64, payloadBits.length);
    assert.ok(b.length >= 32);
    const dlen = parseInt(b.substr(0, 32), 2);
    assert.ok(dlen > 0 && dlen < 100000);
  });
});

// ── Color space functions from watermark_core.js ──
describe("Color space functions", () => {
  it("rgbToYcbcr should convert correctly", () => {
    const w = 4, h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 100; data[i * 4 + 1] = 150; data[i * 4 + 2] = 200; data[i * 4 + 3] = 255;
    }
    const result = globalThis.rgbToYcbcr({ data, w, h });
    assert.ok(result.Y instanceof Float64Array);
    assert.equal(result.Y.length, w * h);
    assert.equal(result.Cb.length, w * h);
    assert.equal(result.Cr.length, w * h);
    assert.equal(result.w, w);
    assert.equal(result.h, h);
    assert.ok(Math.abs(result.Y[0] - 140.75) < 0.01);
  });

  it("ycbcrToImageData should convert back", () => {
    const c = createTestImage(4, 4);
    const ycbcr = globalThis.rgbToYcbcr(c.imgData);
    const result = globalThis.ycbcrToImageData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, 4, 4);
    assert.ok(result.canvas, "canvas should exist");
    assert.ok(result.ctx, "ctx should exist");
    assert.ok(result.imgData, "imgData should exist");
    assert.equal(result.imgData.data.length, 4 * 4 * 4);
    const orig = c.imgData;
    for (let i = 0; i < 16; i++) {
      assert.ok(Math.abs(result.imgData.data[i * 4] - orig.data[i * 4]) <= 3);
    }
  });
});

// ── Block helper functions ──
describe("Block helpers", () => {
  it("blockIter should return correct block coordinates", () => {
    const blocks = globalThis.blockIter(16, 16, 8);
    assert.equal(blocks.length, 4);
    assert.deepEqual(blocks, [[0, 0], [8, 0], [0, 8], [8, 8]]);
  });

  it("blockIter should handle non-multiple dimensions", () => {
    const blocks = globalThis.blockIter(10, 10, 8);
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks, [[0, 0]]);
  });

  it("getBlock8 should extract 8x8 block", () => {
    const arr = new Float64Array(64);
    for (let i = 0; i < 64; i++) arr[i] = i;
    const block = globalThis.getBlock8(arr, 8, 0, 0);
    assert.equal(block.length, 8);
    assert.equal(block[0][0], 0);
    assert.equal(block[7][7], 63);
  });

  it("setBlock8 should write 8x8 block", () => {
    const arr = new Float64Array(64);
    const block = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => y * 8 + x + 100));
    globalThis.setBlock8(arr, 8, 0, 0, block);
    assert.equal(arr[0], 100);
    assert.equal(arr[63], 163);
  });

  it("dct8x8 and idct8x8 roundtrip on constant block", () => {
    const block = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 128));
    const dct = globalThis.dct8x8(block);
    const back = globalThis.idct8x8(dct);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        assert.ok(Math.abs(back[y][x] - block[y][x]) <= 1);
  });

  it("maxDCTBits should calculate correctly", () => {
    const bits = globalThis.maxDCTBits(64, 64, 11);
    assert.equal(bits, 8 * 8 * 11);
    const bitsDefault = globalThis.maxDCTBits(64, 64);
    assert.equal(bitsDefault, 8 * 8 * 11);
  });
});

// ── wm6 Multi-bit (2-bit LSB) ──
describe("wm6 Multi-bit algorithm", () => {
  it("should embed and extract correctly", () => {
    const c = createTestImage(32, 32);
    const data = new Uint8Array([0xAA, 0xBB, 0xDE, 0xAD]);
    const lenBytes = [0, 0, 0, data.length];
    const payload = new Uint8Array(4 + data.length);
    payload.set(lenBytes);
    payload.set(data, 4);
    const payloadBits = globalThis.bits(payload);

    globalThis.wm6_embed(c.imgData, payloadBits);
    const extracted = globalThis.wm6_extract(c.imgData);

    assert.ok(extracted.length >= 32);
    const dlen = parseInt(extracted.substr(0, 32), 2);
    assert.equal(dlen, data.length);
    const extractedData = globalThis.from_bits(extracted.substr(32, dlen * 8));
    assert.deepEqual(Array.from(extractedData), Array.from(data));
  });

  it("wm6_embed should handle odd bit count (trigger b2=0 ternary path)", () => {
    const c = createTestImage(16, 16);
    const bits = "10101010".repeat(8) + "1"; // 65 bits (5 mod 6)
    globalThis.wm6_embed(c.imgData, bits);
    assert.ok(c.imgData.data.some((v) => v > 0));
  });

  it("wm6_embed should handle 1-mod-6 bit count (trigger R channel b2=0)", () => {
    const c = createTestImage(16, 16);
    const bits = "1010101"; // 7 bits (1 mod 6)
    globalThis.wm6_embed(c.imgData, bits);
    assert.ok(c.imgData.data.some((v) => v > 0));
  });

  it("wm6_embed should handle 3-mod-6 bit count (trigger G channel b2=0)", () => {
    const c = createTestImage(16, 16);
    const bits = "101010101"; // 9 bits (3 mod 6)
    globalThis.wm6_embed(c.imgData, bits);
    assert.ok(c.imgData.data.some((v) => v > 0));
  });
});

// ── wm8 Fragile (SHA-256 hash embed) ──
describe("wm8 Fragile algorithm", () => {
  it("should embed and extract without key", async () => {
    const c = createTestImage(32, 32);
    const secret = new TextEncoder().encode("test-secret");
    await globalThis.wm8_embed(c.imgData, secret, null);
    const result = globalThis.wm8_extract(c.imgData, null);
    assert.ok(result, "Extraction should return a hash string");
    assert.match(result, /^[0-9a-f]{64}$/i);
  });

  it("should embed and extract with key", async () => {
    const c = createTestImage(32, 32);
    const secret = new TextEncoder().encode("test-secret");
    const key = new TextEncoder().encode("my-key");
    await globalThis.wm8_embed(c.imgData, secret, key);
    const result = globalThis.wm8_extract(c.imgData, key);
    assert.ok(result, "Extraction should return a hash string");
    assert.match(result, /^[0-9a-f]{64}$/i);
  });

  it("should return null with wrong key", async () => {
    const c = createTestImage(32, 32);
    const secret = new TextEncoder().encode("test-secret");
    await globalThis.wm8_embed(c.imgData, secret, new TextEncoder().encode("correct-key"));
    const result = globalThis.wm8_extract(c.imgData, new TextEncoder().encode("wrong-key"));
    assert.equal(result, null);
  });

  it("should return null when extracted data is corrupted", async () => {
    const c = createTestImage(32, 32);
    const secret = new TextEncoder().encode("test-secret");
    await globalThis.wm8_embed(c.imgData, secret, null);
    // Flip one bit to corrupt the embedded hash
    c.imgData.data[0] ^= 1;
    const result = globalThis.wm8_extract(c.imgData, null);
    assert.equal(result, null);
  });

  it("should return null for image too small to hold payload", async () => {
    const c = createTestImage(4, 4);
    const result = globalThis.wm8_extract(c.imgData, null);
    assert.equal(result, null);
  });
});

// ── extractData (utils.js) ──
describe("extractData utility", () => {
  it("should return no-data for short string (< 32 bits)", () => {
    const r = globalThis.extractData("0000", null);
    assert.equal(r.reason, "no-data");
    assert.equal(r.data, null);
  });

  it("should return invalid-length for zero length header", () => {
    const bits = "0000000000000000000000000000000010101010";
    const r = globalThis.extractData(bits, null);
    assert.equal(r.reason, "invalid-length");
  });

  it("should return invalid-length for >100000 length", () => {
    const dlen = 100001;
    const bits = dlen.toString(2).padStart(32, "0") + "10101010";
    const r = globalThis.extractData(bits, null);
    assert.equal(r.reason, "invalid-length");
  });

  it("should return no-data when payload too short for declared length", () => {
    const lenBits = (5).toString(2).padStart(32, "0");
    const payloadBits = "10101010".repeat(4); // only 4 bytes, need 5
    const r = globalThis.extractData(lenBits + payloadBits, null);
    assert.equal(r.reason, "no-data");
  });

  it("should return ok with magic bytes (no key)", () => {
    const payload = new Uint8Array([0xAA, 0xBB, 0xDE, 0xAD]);
    const lenBytes = [0, 0, 0, payload.length];
    const full = new Uint8Array(4 + payload.length);
    full.set(lenBytes);
    full.set(payload, 4);
    const b = globalThis.bits(full);
    const r = globalThis.extractData(b, null);
    assert.equal(r.reason, "ok");
    assert.deepEqual(Array.from(r.data), [0xDE, 0xAD]);
  });

  it("should return bad-password when no magic bytes", () => {
    const payload = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const full = new Uint8Array(8);
    full.set([0, 0, 0, 4]);
    full.set(payload, 4);
    const b = globalThis.bits(full);
    const r = globalThis.extractData(b, null);
    assert.equal(r.reason, "bad-password");
  });

  it("should return ok with magic bytes and identity key", () => {
    const payload = new Uint8Array([0xAA, 0xBB, 0xDE, 0xAD]);
    const full = new Uint8Array(8);
    full.set([0, 0, 0, payload.length]);
    full.set(payload, 4);
    const b = globalThis.bits(full);
    const r = globalThis.extractData(b, new Uint8Array([0])); // XOR with 0 = identity
    assert.equal(r.reason, "ok");
    assert.deepEqual(Array.from(r.data), [0xDE, 0xAD]);
  });
});

// ── pw_key (utils.js) ──
describe("pw_key utility", () => {
  it("should return empty array for empty password", async () => {
    const key = await globalThis.pw_key("");
    assert.ok(key instanceof Uint8Array);
    assert.equal(key.length, 0);
  });

  it("should return 32 bytes for non-empty password", async () => {
    const key = await globalThis.pw_key("test-password");
    assert.ok(key instanceof Uint8Array);
    assert.equal(key.length, 32);
  });
});

// ── PRNG utilities ──
describe("PRNG utilities", () => {
  it("mulberry32 should produce deterministic values", () => {
    const rng1 = globalThis.mulberry32(42);
    const rng2 = globalThis.mulberry32(42);
    assert.equal(rng1(), rng2());
    const v = rng1();
    assert.ok(v >= 0 && v < 1);
  });

  it("seededShuffle should produce deterministic order", () => {
    const arr1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const arr2 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = globalThis.seededShuffle(arr1, 42);
    const s2 = globalThis.seededShuffle(arr2, 42);
    assert.deepEqual(s1, s2);
    const notSame = s1.some((v, i) => v !== i);
    assert.ok(notSame, "Should be shuffled");
  });

  it("wm3_order should produce valid shuffled order", () => {
    const order = globalThis.wm3_order(8, 8, 42);
    assert.equal(order.length, 64);
    const sorted = [...order].sort((a, b) => a - b);
    assert.deepEqual(sorted, Array.from({ length: 64 }, (_, i) => i));
  });
});

// ── Edge cases ──
describe("Edge cases", () => {
  it("wm1_extract should handle unwatermarked image (return bits)", () => {
    const c = createTestImage(8, 8);
    const result = globalThis.wm1_extract(c.imgData);
    assert.ok(result.length > 0);
    assert.ok(result.length >= 32);
  });

  it("wm1_embed should handle empty payload gracefully", () => {
    const c = createTestImage(8, 8);
    const original = new Uint8Array(c.imgData.data);
    globalThis.wm1_embed(c.imgData, "");
    assert.deepEqual(Array.from(c.imgData.data), Array.from(original));
  });
});
