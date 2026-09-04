// ── CLI Test: Remove Watermark Service ──
// Tests that cleaning functions can remove all types of embedded data.
// Usage: node cli/tests/remove_watermark_test.js

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createCanvas, loadImage, ImageData } = require("canvas");

// ── Polyfills (matches cli/commands/watermark.js) ──
const mockDocument = {
  createElement: (tag) => {
    if (tag === "canvas") return createCanvas(1, 1);
    throw new Error(`createElement('${tag}') not supported`);
  },
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.document = mockDocument;
if (typeof globalThis.ImageData === "undefined")
  globalThis.ImageData = ImageData;
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => {
        const n = typeof algo === "string" ? algo : algo.name || "SHA-256";
        const h = crypto
          .createHash(n.toLowerCase().replace("-", ""))
          .update(Buffer.from(data))
          .digest();
        return h.buffer;
      },
      importKey: async (f, kd, algo, ext, us) => ({
        type: "secret",
        algorithm: algo,
        keyData: kd,
      }),
      deriveBits: async (algo, baseKey, len) => {
        const pw = Buffer.from(baseKey.keyData);
        const s = algo.salt || pw;
        const it = algo.iterations || 100000;
        const h =
          typeof algo.hash === "string"
            ? algo.hash.replace("-", "").toLowerCase()
            : "sha256";
        const d = crypto.pbkdf2Sync(pw, s, it, len / 8, h);
        return d.buffer;
      },
    },
  };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.sha256Hex === "undefined") {
  globalThis.sha256Hex = async (data) => {
    const h = crypto.createHash("sha256").update(Buffer.from(data)).digest();
    return Array.from(h)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };
}
const vm = require("vm");
globalThis.LSB_MAX_BITS = 100000;

// Load browser-side JS files into Node.js via vm
const MODULES = [
  ["../../Watermark/utils.js", "utils.js"],
  ["../../Watermark/watermark_core.js", "watermark_core.js"],
  [
    "../../Pixel_Injection/watermark_core_advanced.js",
    "watermark_core_advanced.js",
  ],
  [
    "../../Pixel_Injection/watermark_core_transforms.js",
    "watermark_core_transforms.js",
  ],
  [
    "../../Pixel_Injection/watermark_core_algorithms.js",
    "watermark_core_algorithms.js",
  ],
];
for (const [rel, name] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
}

// Create WatermarkCore instance for advanced algorithms
let watermarkCore = null;
try {
  watermarkCore = new globalThis.WatermarkCore();
} catch (e) {}

// For audio tests, load audio watermark core
const audioCorePath = path.join(
  __dirname,
  "../../Audio_Watermark/audio_watermark_core.js",
);
let audioCoreLoaded = false;
if (fs.existsSync(audioCorePath)) {
  const src = fs.readFileSync(audioCorePath, "utf8");
  try {
    vm.runInThisContext(src, { filename: audioCorePath });
    audioCoreLoaded = true;
  } catch (e) {
    console.warn("Warning: Could not load audio_watermark_core.js:", e.message);
  }
}

// ── Helper: create test image ──
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

// ── Helper: YCbCr → RGB (pure JS, no canvas needed) ──
function ycbcrToData(Y, Cb, Cr, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const y = Y[i],
      cb = Cb[i] - 128,
      cr = Cr[i] - 128;
    data[i * 4] = Math.max(0, Math.min(255, Math.round(y + 1.402 * cr)));
    data[i * 4 + 1] = Math.max(
      0,
      Math.min(255, Math.round(y - 0.3441 * cb - 0.7141 * cr)),
    );
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(y + 1.772 * cb)));
    data[i * 4 + 3] = 255;
  }
  return data;
}

// ── Helper: embed bits into DCT and write result back to imgData ──
function embedDCTAndApply(imgData, payloadBits, strength) {
  const { w, h } = imgData;
  const ycbcr = rgbToYcbcr(imgData);
  embedInDCT(ycbcr.Y, w, h, payloadBits, strength);
  const result = ycbcrToData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
  imgData.data.set(result);
}

// ── Cleaning Functions ──

// Clear LSB bits (1 or 2 bits) from all RGB channels
function cleanLSB(imgData, bits) {
  const mask = bits >= 2 ? ~3 : ~1;
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] &= mask;
    d[i + 1] &= mask;
    d[i + 2] &= mask;
  }
}

// Zero out mid-frequency DCT coefficients in Y, Cb, Cr planes
// Uses MID from watermark_core.js plus extra positions for PI DCT (u+v=7)
const MID_EXTRA = [
  [0, 4],
  [1, 3],
  [2, 2],
  [3, 1],
  [4, 0],
  [0, 5],
  [1, 4],
  [2, 3],
  [3, 2],
  [4, 1],
  [5, 0],
  [0, 6],
  [1, 5],
  [2, 4],
  [3, 3],
  [4, 2],
  [5, 1],
  [6, 0],
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
  [4, 3],
  [5, 2],
  [6, 1],
  [7, 0],
];
function cleanDCT(imgData) {
  const { w, h } = imgData;
  const ycbcr = rgbToYcbcr(imgData);
  const blocks = blockIter(w, h, 8);
  for (const plane of ["Y", "Cb", "Cr"]) {
    const P = ycbcr[plane];
    for (const [bx, by] of blocks) {
      const block = getBlock8(P, w, bx, by);
      const dct = dct8x8(block);
      for (const [u, v] of MID_EXTRA) dct[u][v] = 0;
      setBlock8(P, w, bx, by, idct8x8(dct));
    }
  }
  // Convert back to RGB
  const cleaned = ycbcrToData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
  imgData.data.set(cleaned);
}

// ── Verification: check if data is still extractable ──
function canExtractLSB(imgData) {
  const b = wm1_extract(imgData);
  if (b.length < 32) return false;
  const dlen = parseInt(b.substr(0, 32), 2);
  return dlen > 0 && dlen < 100000;
}

function canExtractType3(imgData, seed) {
  const b = wm3_extract(imgData, seed);
  if (b.length < 32) return false;
  const dlen = parseInt(b.substr(0, 32), 2);
  return dlen > 0 && dlen < 100000;
}

function canExtractType6(imgData) {
  const b = wm6_extract(imgData);
  if (b.length < 32) return false;
  const dlen = parseInt(b.substr(0, 32), 2);
  return dlen > 0 && dlen < 100000;
}

function canExtractType8(imgData, key) {
  const hash = wm8_extract(imgData, key);
  return hash !== null && /^[0-9a-f]{64}$/i.test(hash);
}

function canExtractDCT(imgData, numBits) {
  const ycbcr = rgbToYcbcr(imgData);
  const b = extractFromDCT(ycbcr.Y, imgData.w, imgData.h, numBits);
  if (b.length < 32) return false;
  const dlen = parseInt(b.substr(0, 32), 2);
  return dlen > 0 && dlen < 100000;
}

function canDetectType5(imgData) {
  const ycbcr = rgbToYcbcr(imgData);
  const sig = new TextEncoder().encode("RedoSanZeroBit");
  const b = extractFromDCT(ycbcr.Y, imgData.w, imgData.h, sig.length * 8);
  if (b.length < sig.length * 8) return false;
  const data = from_bits(b.substr(0, sig.length * 8));
  let matches = 0;
  for (let i = 0; i < data.length; i++) if (data[i] === sig[i]) matches++;
  return matches / sig.length > 0.85;
}

// ── Test Suite ──
let passed = 0,
  failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

console.log("\n=== Remove Watermark Service — CLI Test ===\n");

// ── 1. Image Watermark Tests (Core Algorithms 1-9) ──
console.log("--- Image Watermark Removal ---\n");

const img = createTestImage(64, 64);
const secretData = new TextEncoder().encode("TestSecret123!");
const password = "testpassword123";
let key = null;

(async () => {
  key = await pw_key(password);

  // Type 1: Spatial LSB
  test("Type 1 (Spatial LSB): embed → extract succeeds", () => {
    const c1 = createTestImage(64, 64);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm1_embed(c1.imgData, payloadBits);
    assert(canExtractLSB(c1.imgData), "Should extract after embed");
  });

  test("Type 1 (Spatial LSB): cleanLSB → extract fails", () => {
    const c1 = createTestImage(64, 64);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm1_embed(c1.imgData, payloadBits);
    cleanLSB(c1.imgData, 1);
    assert(!canExtractLSB(c1.imgData), "Should NOT extract after LSB clear");
  });

  // Type 2: Frequency DCT
  test("Type 2 (Frequency DCT): embed → extract succeeds", () => {
    const c2 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    assert(payloadBits.length <= cap, "Payload fits in capacity");
    embedDCTAndApply(c2.imgData, payloadBits, 25);
    assert(
      canExtractDCT(c2.imgData, payloadBits.length),
      "Should extract after DCT embed",
    );
  });

  test("Type 2 (Frequency DCT): cleanDCT → extract fails", () => {
    const c2 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    embedDCTAndApply(c2.imgData, payloadBits, 25);
    cleanDCT(c2.imgData);
    assert(
      !canExtractDCT(c2.imgData, payloadBits.length),
      "Should NOT extract after DCT clean",
    );
  });

  // Type 3: Neural SS (Seeded Shuffle LSB)
  test("Type 3 (Neural SS): embed → extract succeeds", () => {
    const c3 = createTestImage(64, 64);
    const seed = 12345;
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm3_embed(c3.imgData, payloadBits, seed);
    assert(canExtractType3(c3.imgData, seed), "Should extract after embed");
  });

  test("Type 3 (Neural SS): cleanLSB → extract fails", () => {
    const c3 = createTestImage(64, 64);
    const seed = 12345;
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm3_embed(c3.imgData, payloadBits, seed);
    cleanLSB(c3.imgData, 1);
    assert(
      !canExtractType3(c3.imgData, seed),
      "Should NOT extract after LSB clear",
    );
  });

  // Type 4: Latent DCT (redundant x3)
  test("Type 4 (Latent DCT): embed → extract succeeds", () => {
    const c4 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload).repeat(3);
    assert(payloadBits.length <= cap, "Payload fits in capacity");
    embedDCTAndApply(c4.imgData, payloadBits, 30);
    assert(
      canExtractDCT(c4.imgData, payloadBits.length),
      "Should extract after DCT embed",
    );
  });

  test("Type 4 (Latent DCT): cleanDCT → extract fails", () => {
    const c4 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload).repeat(3);
    embedDCTAndApply(c4.imgData, payloadBits, 30);
    cleanDCT(c4.imgData);
    assert(
      !canExtractDCT(c4.imgData, payloadBits.length),
      "Should NOT extract after DCT clean",
    );
  });

  // Type 5: Zero-bit
  test("Type 5 (Zero-bit): embed → detection succeeds", () => {
    const c5 = createTestImage(64, 64);
    const sig = new TextEncoder().encode("RedoSanZeroBit");
    const sigBits = bits(sig);
    embedDCTAndApply(c5.imgData, sigBits, 25);
    assert(canDetectType5(c5.imgData), "Should detect after embed");
  });

  test("Type 5 (Zero-bit): cleanDCT → detection fails", () => {
    const c5 = createTestImage(64, 64);
    const sig = new TextEncoder().encode("RedoSanZeroBit");
    const sigBits = bits(sig);
    embedDCTAndApply(c5.imgData, sigBits, 25);
    cleanDCT(c5.imgData);
    assert(!canDetectType5(c5.imgData), "Should NOT detect after DCT clean");
  });

  // Type 6: Multi-bit (2-bit LSB)
  test("Type 6 (Multi-bit 2-bit LSB): embed → extract succeeds", () => {
    const c6 = createTestImage(64, 64);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm6_embed(c6.imgData, payloadBits);
    assert(canExtractType6(c6.imgData), "Should extract after embed");
  });

  test("Type 6 (Multi-bit 2-bit LSB): cleanLSB(2) → extract fails", () => {
    const c6 = createTestImage(64, 64);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    wm6_embed(c6.imgData, payloadBits);
    cleanLSB(c6.imgData, 2);
    assert(
      !canExtractType6(c6.imgData),
      "Should NOT extract after 2-bit LSB clear",
    );
  });

  // Type 7: Forensic
  test("Type 7 (Forensic DCT): embed → extract succeeds", () => {
    const c7 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    assert(payloadBits.length <= cap, "Payload fits");
    embedDCTAndApply(c7.imgData, payloadBits, 20);
    assert(
      canExtractDCT(c7.imgData, payloadBits.length),
      "Should extract after embed",
    );
  });

  test("Type 7 (Forensic DCT): cleanDCT → extract fails", () => {
    const c7 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    embedDCTAndApply(c7.imgData, payloadBits, 20);
    cleanDCT(c7.imgData);
    assert(
      !canExtractDCT(c7.imgData, payloadBits.length),
      "Should NOT extract after DCT clean",
    );
  });

  // Type 8: Fragile (SHA-256 hash)
  test("Type 8 (Fragile SHA-256): embed → extract succeeds", async () => {
    const c8 = createTestImage(64, 64);
    await wm8_embed(c8.imgData, secretData, key);
    assert(canExtractType8(c8.imgData, key), "Should extract hash after embed");
  });

  test("Type 8 (Fragile SHA-256): cleanLSB → extract fails", async () => {
    const c8 = createTestImage(64, 64);
    await wm8_embed(c8.imgData, secretData, key);
    cleanLSB(c8.imgData, 1);
    assert(
      !canExtractType8(c8.imgData, key),
      "Should NOT extract after LSB clear",
    );
  });

  // Type 9: Imatag-style (Y + Cb chrominance)
  test("Type 9 (Imatag-style DCT): embed → extract succeeds", () => {
    const c9 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    assert(payloadBits.length <= cap, "Payload fits");
    // For type 9, embed in both Y and Cb planes
    const ycbcr1 = rgbToYcbcr(c9.imgData);
    embedInDCT(ycbcr1.Y, 64, 64, payloadBits, 15);
    const r1 = ycbcrToData(ycbcr1.Y, ycbcr1.Cb, ycbcr1.Cr, 64, 64);
    c9.imgData.data.set(r1);
    const ycbcr2 = rgbToYcbcr(c9.imgData);
    embedInDCT(ycbcr2.Cb, 64, 64, payloadBits, 10);
    const r2 = ycbcrToData(ycbcr2.Y, ycbcr2.Cb, ycbcr2.Cr, 64, 64);
    c9.imgData.data.set(r2);
    assert(
      canExtractDCT(c9.imgData, payloadBits.length),
      "Should extract after DCT embed",
    );
  });

  test("Type 9 (Imatag-style DCT): cleanDCT → extract fails", () => {
    const c9 = createTestImage(64, 64);
    const cap = maxDCTBits(64, 64, 11);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);
    embedDCTAndApply(c9.imgData, payloadBits, 15);
    // Also embed in Cb for type 9
    const ycbcr = rgbToYcbcr(c9.imgData);
    embedInDCT(ycbcr.Cb, 64, 64, payloadBits, 10);
    const r = ycbcrToData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, 64, 64);
    c9.imgData.data.set(r);
    cleanDCT(c9.imgData);
    assert(
      !canExtractDCT(c9.imgData, payloadBits.length),
      "Should NOT extract after DCT clean",
    );
  });

  // ── 2. Pixel Injection (Advanced Algorithms) Tests ──
  if (watermarkCore) {
    console.log("\n--- Pixel Injection (Advanced Algorithms) Removal ---\n");

    function piEmbed(img, algo, msg, pw, opts) {
      const result = watermarkCore.algorithms[algo](
        img,
        msg,
        pw || "",
        opts || {},
      );
      if (result && result.data) {
        img.data = new Uint8ClampedArray(result.data);
        if (result.width !== undefined) img.width = result.width;
        if (result.height !== undefined) img.height = result.height;
      }
    }

    function piExtract(img, algo, pw) {
      try {
        return watermarkCore.detection.blind_decoding(img, algo, pw || "");
      } catch (e) {
        return "";
      }
    }

    function imgDataForCore(c) {
      return {
        data: new Uint8ClampedArray(c.imgData.data),
        width: c.w,
        height: c.h,
      };
    }

    const testMsg = "TestPIEmbed123!";

    // Enhanced LSB
    test("PI enhanced_lsb: embed → extract succeeds", () => {
      const c = createTestImage(32, 32);
      const img = imgDataForCore(c);
      piEmbed(img, "enhanced_lsb", testMsg, "pass");
      const result = piExtract(img, "enhanced_lsb", "pass");
      assert(
        result && result.length > 0 && result.indexOf(testMsg) >= 0,
        "Should extract original message after embed",
      );
    });

    test("PI enhanced_lsb: cleanLSB → original message gone", () => {
      const c = createTestImage(32, 32);
      const img = imgDataForCore(c);
      piEmbed(img, "enhanced_lsb", testMsg, "pass");
      const imgObj = { data: img.data, w: img.width, h: img.height };
      cleanLSB(imgObj, 1);
      const result = piExtract(img, "enhanced_lsb", "pass");
      assert(
        !result || result.indexOf(testMsg) < 0,
        "Original message should be gone after LSB clear",
      );
    });

    // DCT
    test("PI dct: embed → extract succeeds", () => {
      const w = 256,
        h = 256;
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "gray";
      ctx.fillRect(0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const img = {
        data: new Uint8ClampedArray(imgData.data),
        width: w,
        height: h,
      };
      piEmbed(img, "dct", testMsg, "pass", { strength: 100 });
      const result = piExtract(img, "dct", "pass");
      assert(
        result && result.length > 0 && result.indexOf(testMsg) >= 0,
        "Should extract original message after DCT embed",
      );
    });

    test("PI dct: cleanDCT → original message gone", () => {
      const w = 256,
        h = 256;
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "gray";
      ctx.fillRect(0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const img = {
        data: new Uint8ClampedArray(imgData.data),
        width: w,
        height: h,
      };
      piEmbed(img, "dct", testMsg, "pass", { strength: 100 });
      const imgObj = { data: img.data, w: img.width, h: img.height };
      cleanDCT(imgObj);
      const result = piExtract(img, "dct", "pass");
      assert(
        !result || result.indexOf(testMsg) < 0,
        "Original message should be gone after DCT clean",
      );
    });

    // Multi-channel LSB
    test("PI multi_channel_lsb: embed → extract succeeds", () => {
      const c = createTestImage(32, 32);
      const img = imgDataForCore(c);
      piEmbed(img, "multi_channel_lsb", testMsg, "pass");
      const result = piExtract(img, "multi_channel_lsb", "pass");
      assert(
        result && result.length > 0 && result.indexOf(testMsg) >= 0,
        "Should extract original message after embed",
      );
    });

    test("PI multi_channel_lsb: cleanLSB → original message gone", () => {
      const c = createTestImage(32, 32);
      const img = imgDataForCore(c);
      piEmbed(img, "multi_channel_lsb", testMsg, "pass");
      const imgObj = { data: img.data, w: img.width, h: img.height };
      cleanLSB(imgObj, 1);
      const result = piExtract(img, "multi_channel_lsb", "pass");
      assert(
        !result || result.indexOf(testMsg) < 0,
        "Original message should be gone after LSB clear",
      );
    });
  } else {
    console.log(
      "\n--- Pixel Injection Tests: SKIPPED (WatermarkCore not available) ---",
    );
  }

  // ── 3. Combined Pipeline Test ──
  console.log("\n--- Combined Cleaning Pipeline ---\n");

  test("Combined: cleanLSB + cleanDCT removes all traces", () => {
    const img = createTestImage(64, 64);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xaa, 0xbb]);
    raw.set(secretData, 2);
    const xored = xor_bytes(raw, key);
    const lenBytes = [
      (xored.length >> 24) & 0xff,
      (xored.length >> 16) & 0xff,
      (xored.length >> 8) & 0xff,
      xored.length & 0xff,
    ];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    const payloadBits = bits(payload);

    // Embed type 2 (DCT) first, then type 1 (LSB)
    embedDCTAndApply(img.imgData, payloadBits, 25);
    wm1_embed(img.imgData, payloadBits);

    // Verify both extract before cleaning
    assert(canExtractLSB(img.imgData), "LSB extractable before clean");
    const ycbcr = rgbToYcbcr(img.imgData);
    const dctBits = extractFromDCT(ycbcr.Y, 64, 64, payloadBits.length);
    const dlen = parseInt(dctBits.substr(0, 32), 2);
    assert(dlen > 0 && dlen < 100000, "DCT extractable before clean");

    // Clean: LSB clear (2 bits) + DCT zero
    cleanLSB(img.imgData, 2);
    cleanDCT(img.imgData);

    // Verify none can extract
    assert(!canExtractLSB(img.imgData), "LSB not extractable after clean");
    assert(
      !canExtractType3(img.imgData, 12345),
      "Type 3 not extractable after clean",
    );
    assert(!canExtractType6(img.imgData), "Type 6 not extractable after clean");
    // DCT-based should also fail
    assert(
      !canExtractDCT(img.imgData, payloadBits.length),
      "DCT types not extractable after clean",
    );
  });

  // ── 4. Audio Watermark Tests ──
  if (audioCoreLoaded) {
    console.log("\n--- Audio Watermark Removal ---\n");

    function createTestAudio(sr, durationSec) {
      const numSamples = sr * durationSec;
      const samples = new Float64Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] =
          Math.sin((2 * Math.PI * 440 * i) / sr) * 16000 +
          Math.sin((2 * Math.PI * 880 * i) / sr) * 8000 +
          (Math.random() - 0.5) * 2000;
      }
      return samples;
    }

    const sr = 44100;
    const audioData = createTestAudio(sr, 3);
    const secretBytes = new TextEncoder().encode("TestAudioSecret!");

    // Test aw1_embed (LSB Audio)
    test("Audio Type 1 (LSB): embed → extract succeeds", () => {
      const s16 = new Int16Array(audioData);
      const payload = awFormatPayload(secretBytes, key);
      aw1_embed(s16, payload);
      // Try to extract
      const extracted = aw1_extract(s16, payload.length);
      assert(extracted.length > 32, "Should extract bits after embed");
      const dlen = parseInt(extracted.substr(0, 32), 2);
      assert(dlen > 0 && dlen < 100000, "Should have valid length prefix");
    });

    test("Audio Type 1 (LSB): clear LSB → extract fails", () => {
      const s16 = new Int16Array(audioData);
      const payload = awFormatPayload(secretBytes, key);
      aw1_embed(s16, payload);
      // Clear LSB of all samples
      for (let i = 0; i < s16.length; i++) s16[i] &= ~1;
      const extracted = aw1_extract(s16, payload.length);
      const stillHasData = (() => {
        if (extracted.length < 32) return false;
        const dlen = parseInt(extracted.substr(0, 32), 2);
        return dlen > 0 && dlen < 100000;
      })();
      assert(!stillHasData, "Should NOT extract after LSB clear");
    });

    // Test aw5_embed (Sample-Domain QIM)
    test("Audio Type 5 (QIM): embed → extract succeeds", () => {
      const s16 = new Int16Array(audioData);
      const payload = awFormatPayload(secretBytes, key);
      aw5_embed(s16, payload, sr);
      const extracted = aw5_extract(s16, sr, payload.length);
      assert(extracted.length > 32, "Should extract bits after QIM embed");
      const dlen = parseInt(extracted.substr(0, 32), 2);
      assert(dlen > 0 && dlen < 100000, "Should have valid length prefix");
    });

    test("Audio Type 5 (QIM): re-quantize → extract fails", () => {
      const s16 = new Int16Array(audioData);
      const payload = awFormatPayload(secretBytes, key);
      aw5_embed(s16, payload, sr);
      // Quantize harder (larger step size) to disrupt QIM
      const destroyStep = Math.round(sr / 20); // 5x larger than embed step
      for (let i = 0; i < s16.length; i++) {
        s16[i] = Math.round(s16[i] / destroyStep) * destroyStep;
      }
      const extracted = aw5_extract(s16, sr, payload.length);
      const stillHasData = (() => {
        if (extracted.length < 32) return false;
        const dlen = parseInt(extracted.substr(0, 32), 2);
        return dlen > 0 && dlen < 100000;
      })();
      assert(!stillHasData, "Should NOT extract after re-quantization");
    });
  } else {
    console.log("\n--- Audio Watermark Removal: SKIPPED (core not loaded) ---");
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
