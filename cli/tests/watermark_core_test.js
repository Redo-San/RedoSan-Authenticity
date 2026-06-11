'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas, ImageData } = require('canvas');

// Polyfills
globalThis.document = {
  createElement: (tag) => tag === 'canvas' ? createCanvas(1, 1) : { getContext: () => null },
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.window = globalThis;
globalThis.ImageData = ImageData;
globalThis.location = { protocol: 'file:', href: 'file:///test/', hostname: 'localhost', origin: 'null' };

const crypto = require('crypto');
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => crypto.createHash('sha256').update(Buffer.from(data)).digest(),
      importKey: async (f, kd) => ({ type: 'secret', keyData: kd }),
      deriveBits: async (algo, key, len) => crypto.pbkdf2Sync(Buffer.from(key.keyData), algo.salt || Buffer.from(key.keyData), algo.iterations || 1, len / 8, 'sha256'),
      generateKey: async () => ({ publicKey: {}, privateKey: {} }),
      sign: async () => new Uint8Array(64),
      verify: async () => true,
    },
    getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
  };
}

// Load watermark modules
const MODULES = [
  ['../../Watermark/utils.js', 'utils.js'],
  ['../../Watermark/watermark_core.js', 'watermark_core.js'],
  ['../../Pixel_Injection/watermark_core_advanced.js', 'watermark_core_advanced.js'],
  ['../../Pixel_Injection/watermark_core_transforms.js', 'watermark_core_transforms.js'],
  ['../../Pixel_Injection/watermark_core_algorithms.js', 'watermark_core_algorithms.js'],
];
for (const [rel, name] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
  vm.runInThisContext(src, { filename: name });
}

function createTestImage(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
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
  imgData.w = w; imgData.h = h;
  return { canvas, ctx, imgData, w, h };
}

function rgbToYcbcr(imgData) {
  const { data, w, h } = imgData;
  const Y = new Float64Array(w * h);
  const Cb = new Float64Array(w * h);
  const Cr = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
    Y[i]  = 0.299*r + 0.587*g + 0.114*b;
    Cb[i] = 128 - 0.168736*r - 0.331264*g + 0.5*b;
    Cr[i] = 128 + 0.5*r - 0.418688*g - 0.081312*b;
  }
  return { Y, Cb, Cr };
}

function ycbcrToData(Y, Cb, Cr, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const y = Y[i], cb = Cb[i] - 128, cr = Cr[i] - 128;
    data[i*4]   = Math.max(0, Math.min(255, Math.round(y + 1.402*cr)));
    data[i*4+1] = Math.max(0, Math.min(255, Math.round(y - 0.3441*cb - 0.7141*cr)));
    data[i*4+2] = Math.max(0, Math.min(255, Math.round(y + 1.772*cb)));
    data[i*4+3] = 255;
  }
  return data;
}

describe('Utility functions', () => {
  it('bits should return correct bit string from Uint8Array', () => {
    const b = globalThis.bits(new Uint8Array([0x0F, 0xF0]));
    assert.equal(b, '0000111111110000');
  });
  it('from_bits should convert bit string back to Uint8Array', () => {
    const result = globalThis.from_bits('0000111111110000');
    assert.deepEqual(Array.from(result), [0x0F, 0xF0]);
  });
  it('bits/from_bits roundtrip', () => {
    const data = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
    const b = globalThis.bits(data);
    const result = globalThis.from_bits(b);
    assert.deepEqual(Array.from(result), Array.from(data));
  });
  it('xor_bytes should XOR two arrays', () => {
    const a = new Uint8Array([0xFF, 0x00, 0x0F]);
    const b = new Uint8Array([0x00, 0xFF, 0xF0]);
    const x = globalThis.xor_bytes(a, b);
    assert.deepEqual(x, new Uint8Array([0xFF, 0xFF, 0xFF]));
  });
  it('xor_bytes with empty key should return input', () => {
    const a = new Uint8Array([1, 2, 3]);
    const x = globalThis.xor_bytes(a, null);
    assert.deepEqual(Array.from(x), [1, 2, 3]);
  });
});

describe('Watermark Core', () => {
  it('should embed text into a test image', () => {
    const c1 = createTestImage(64, 64);
    const secretData = new Uint8Array([0xDE, 0xAD]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xAA, 0xBB]); raw.set(secretData, 2);
    const lenBytes = [(raw.length >> 24) & 0xFF, (raw.length >> 16) & 0xFF, (raw.length >> 8) & 0xFF, raw.length & 0xFF];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes); payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    globalThis.wm1_embed(c1.imgData, payloadBits);
    const extracted = globalThis.wm1_extract(c1.imgData);
    assert.ok(extracted.length >= 32);
    const dlen = parseInt(extracted.substr(0, 32), 2);
    assert.ok(dlen > 0 && dlen < 100000);
  });
  it('should embed and verify wm3 extraction', () => {
    const c3 = createTestImage(64, 64);
    const seed = 12345;
    const secretData = new Uint8Array([0xBE, 0xEF]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xCA, 0xFE]); raw.set(secretData, 2);
    const lenBytes = [(raw.length >> 24) & 0xFF, (raw.length >> 16) & 0xFF, (raw.length >> 8) & 0xFF, raw.length & 0xFF];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes); payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    globalThis.wm3_embed(c3.imgData, payloadBits, seed);
    const extracted = globalThis.wm3_extract(c3.imgData, seed);
    assert.ok(extracted.length >= 32);
    const dlen = parseInt(extracted.substr(0, 32), 2);
    assert.ok(dlen > 0 && dlen < 100000);
  });
});

describe('DCT Embed/Extract', () => {
  it('should embed and extract via DCT', () => {
    const c2 = createTestImage(64, 64);
    const cap = globalThis.maxDCTBits(64, 64, 11);
    const secretData = new Uint8Array([0xDE, 0xAD]);
    const raw = new Uint8Array(2 + secretData.length);
    raw.set([0xAA, 0xBB]); raw.set(secretData, 2);
    const lenBytes = [(raw.length >> 24) & 0xFF, (raw.length >> 16) & 0xFF, (raw.length >> 8) & 0xFF, raw.length & 0xFF];
    const payload = new Uint8Array(4 + raw.length);
    payload.set(lenBytes); payload.set(raw, 4);
    const payloadBits = globalThis.bits(payload);
    assert.ok(payloadBits.length <= cap, 'Payload fits in capacity');

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
