const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const canvasLib = require("canvas");
const { createCanvas, ImageData } = canvasLib;

// ── Polyfills ──
globalThis.pack32 = (v) => new Uint8Array([(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
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
        crypto.pbkdf2Sync(Buffer.from(key.keyData), algo.salt || Buffer.from(key.keyData), algo.iterations || 1, len / 8, "sha256"),
      generateKey: async () => ({ publicKey: {}, privateKey: {} }),
      sign: async () => new Uint8Array(64),
      verify: async () => true,
    },
    getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
  };
}

globalThis.sha256Hex = async (buf) => {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// ── Mock shared.js functions ──
globalThis._resultStore = {};
globalThis.setResult = (k, d) => { globalThis._resultStore[k] = d; };
globalThis.getResult = (k) => globalThis._resultStore[k];
globalThis._dlHandler = null;
globalThis.setDownloadHandler = (fn) => { globalThis._dlHandler = fn; };
globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
globalThis.escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
globalThis.getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
globalThis.setText = (id, text) => { /* noop in test */ };
globalThis.setOutput = (id, html) => { /* noop */ };
globalThis.spinner = (id, show) => { /* noop */ };
globalThis.showResult = () => { /* noop */ };
globalThis.showDownloadModal = () => { /* noop */ };
globalThis.closeDownloadModal = () => { /* noop */ };
globalThis.getFile = async (id) => { const el = document.getElementById(id); return el && el.files && el.files.length ? el.files[0] : null; };
globalThis.validateFileInput = async () => true;
globalThis.__ = (key, fallback) => fallback || key;
globalThis.downloadBlobSimple = (blob, fileName) => { /* noop */ };
globalThis.downloadBlob = (blob, name, containerId) => { /* noop */ };
globalThis.URL.createObjectURL = (b) => "blob:test/" + Math.random();
globalThis.URL.revokeObjectURL = () => {};

// Mock loadImage: create a canvas with test image data
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

const _testImageCache = {};
globalThis.loadImage = async (file) => {
  if (_testImageCache[file.name]) return _testImageCache[file.name];
  try {
    const buf = await file.arrayBuffer();
    const img = await canvasLib.loadImage(Buffer.from(buf));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height);
    d.w = img.width;
    d.h = img.height;
    const result = { canvas: c, ctx, imgData: d, w: img.width, h: img.height };
    _testImageCache[file.name] = result;
    return result;
  } catch {
    const img = createTestImage(128, 128);
    _testImageCache[file.name || "default"] = img;
    return img;
  }
};

// Mock canvasToBlob: use node-canvas toBuffer
globalThis.canvasToBlob = (canvas, mime) => {
  return new Promise((resolve) => {
    const buf = canvas.toBuffer(mime === "image/jpeg" ? "image/jpeg" : "image/png");
    resolve(new Blob([buf], { type: mime || "image/png" }));
  });
};

// ── Load required modules ──
const MODULES = [
  ["../../Watermark/utils.js", "utils.js"],
  ["../../Watermark/watermark_core.js", "watermark_core.js"],
  ["../../Watermark/watermark.js", "watermark.js"],
];
for (const [rel] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
}

// ── Helpers ──
function makeFile(name, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return {
    name: name || "test.bin",
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    slice: (start, end) => buf.slice(start, end),
  };
}

function makeImageFile(name) {
  const img = createTestImage(128, 128);
  _testImageCache[name] = img;
  const buf = img.canvas.toBuffer("image/png");
  return {
    name: name || "test.png",
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

function makeTinyImageFile(name, w, h) {
  w = w || 4; h = h || 4;
  const canvas = createCanvas(w, h);
  const buf = canvas.toBuffer("image/png");
  const imgData = canvas.getContext("2d").getImageData(0, 0, w, h);
  imgData.w = w; imgData.h = h;
  _testImageCache[name] = { canvas, ctx: canvas.getContext("2d"), imgData, w, h };
  return {
    name: name || "tiny.png",
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

// ── Tests: Format Converters ──
describe("Watermark — wmToTXT", () => {
  it("should produce key: value lines", () => {
    const r = { algorithm: 1, message: "hello", type: "embed" };
    const txt = globalThis.wmToTXT(r);
    assert.ok(txt.includes("algorithm: 1"));
    assert.ok(txt.includes("message: hello"));
    assert.ok(txt.includes("type: embed"));
    assert.ok(txt.includes("RedoSan Authenticity"));
  });

  it("should handle empty object", () => {
    const txt = globalThis.wmToTXT({});
    assert.ok(txt.includes("RedoSan Authenticity"));
  });
});

describe("Watermark — wmToCSV", () => {
  it("should produce CSV with header", () => {
    const r = { algorithm: 2, message: "test,value" };
    const csv = globalThis.wmToCSV(r);
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes('"algorithm"'));
    assert.ok(csv.includes('"2"'));
    assert.ok(csv.includes('"test,value"'));
  });
});

describe("Watermark — wmToXML", () => {
  it("should produce XML document", () => {
    const r = { algorithm: 3, message: "<test>" };
    const xml = globalThis.wmToXML(r);
    assert.ok(xml.includes('<?xml version="1.0"?>'));
    assert.ok(xml.includes("<algorithm>3</algorithm>"));
    assert.ok(xml.includes("&lt;test&gt;"));
  });
});

describe("Watermark — wmToHTML", () => {
  it("should produce HTML table", () => {
    const r = { algorithm: 4, message: "hello & world" };
    const html = globalThis.wmToHTML(r);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("<table>"));
    assert.ok(html.includes("hello &amp; world"));
  });
});

// ── Tests: watermarkEmbed ──
describe("Watermark — watermarkEmbed", () => {
  it("should return error for missing password (type 1)", async () => {
    const img = makeImageFile("embed1.png");
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(1, img, secret, "");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Password"));
  });

  it("should embed type 1 (LSB) successfully", async () => {
    const img = makeImageFile("embed1_ok.png");
    const secret = makeFile("secret.bin", [0xde, 0xad]);
    const r = await globalThis.watermarkEmbed(1, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
    assert.ok(r.msg.includes("hidden"));
  });

  it("should embed type 2 (DCT) successfully", async () => {
    const img = makeImageFile("embed2.png");
    const secret = makeFile("secret.bin", [0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(2, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should embed type 3 (Neural SS) successfully", async () => {
    const img = makeImageFile("embed3.png");
    const secret = makeFile("secret.bin", [0xca, 0xfe]);
    const r = await globalThis.watermarkEmbed(3, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should embed type 4 (Latent DCT) successfully", async () => {
    const img = makeImageFile("embed4.png");
    const secret = makeFile("secret.bin", [0x01, 0x02]);
    const r = await globalThis.watermarkEmbed(4, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should embed type 5 (Zero-bit) without password", async () => {
    const img = makeImageFile("embed5.png");
    const secret = makeFile("secret.bin", []);
    const r = await globalThis.watermarkEmbed(5, img, secret, "");
    assert.ok(r.ok);
    assert.ok(r.msg.includes("Presence"));
  });

  it("should embed type 6 (Multi-bit) successfully", async () => {
    const img = makeImageFile("embed6.png");
    const secret = makeFile("secret.bin", [0xaa, 0xbb]);
    const r = await globalThis.watermarkEmbed(6, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should embed type 7 (Forensic DCT) successfully", async () => {
    const img = makeImageFile("embed7.png");
    const secret = makeFile("secret.bin", [0x11, 0x22]);
    const r = await globalThis.watermarkEmbed(7, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should embed type 8 (Fragile) without password", async () => {
    const img = makeImageFile("embed8.png");
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(8, img, secret, "");
    assert.ok(r.ok);
    assert.ok(r.msg.includes("SHA-256"));
  });

  it("should embed type 9 (Imatag) successfully", async () => {
    const img = makeImageFile("embed9.png");
    const secret = makeFile("secret.bin", [0x33, 0x44]);
    const r = await globalThis.watermarkEmbed(9, img, secret, "testpw");
    assert.ok(r.ok);
    assert.ok(r.data instanceof Blob);
  });

  it("should return error for unknown type", async () => {
    const img = makeImageFile("embed_unknown.png");
    const secret = makeFile("secret.bin", [0x00]);
    const r = await globalThis.watermarkEmbed(99, img, secret, "testpw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Unknown"));
  });

  it("should return error for wrong password on type 2 extract", async () => {
    const img = makeImageFile("extract_wrongpw.png");
    const secret = makeFile("sec.bin", [0xbe, 0xef]);
    const emb = await globalThis.watermarkEmbed(2, img, secret, "correctpw");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego_wrongpw.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(2, stegoFile, "wrongpw");
    assert.equal(ext.ok, false);
  });

  it("should return capacity error for type 1 on tiny image", async () => {
    const img = makeTinyImageFile("tiny_1.png", 4, 4);
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
    const r = await globalThis.watermarkEmbed(1, img, secret, "pw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Image too small"));
  });

  it("should return capacity error for type 3 on tiny image", async () => {
    const img = makeTinyImageFile("tiny_3.png", 4, 4);
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(3, img, secret, "pw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Image too small"));
  });

  it("should return capacity error for type 6 on tiny image", async () => {
    const img = makeTinyImageFile("tiny_6.png", 4, 4);
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
    const r = await globalThis.watermarkEmbed(6, img, secret, "pw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Image too small"));
  });

  it("should return capacity error for type 8 on tiny image", async () => {
    const img = makeTinyImageFile("tiny_8.png", 8, 8);
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(8, img, secret, "pw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Image too small"));
  });

  it("should return capacity error for type 4 on tiny image", async () => {
    const img = makeTinyImageFile("tiny_4.png", 8, 8);
    const secret = makeFile("secret.bin", [0xde, 0xad, 0xbe, 0xef]);
    const r = await globalThis.watermarkEmbed(4, img, secret, "pw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Secret too large") || r.error.includes("too large"));
  });
});

// ── Tests: watermarkExtract ──
describe("Watermark — watermarkExtract", () => {
  it("should return error for unknown type", async () => {
    const img = makeImageFile("extract_unknown.png");
    const r = await globalThis.watermarkExtract(99, img, "testpw");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("Unknown"));
  });

  it("should extract type 5 (Zero-bit) from clean image (no watermark)", async () => {
    const img = makeImageFile("extract5_clean.png");
    const r = await globalThis.watermarkExtract(5, img, "");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("No watermark") || r.error.includes("No zero-bit"));
  });

  it("should extract type 8 from clean image (no watermark)", async () => {
    const img = makeImageFile("extract8_clean.png");
    const r = await globalThis.watermarkExtract(8, img, "");
    assert.equal(r.ok, false);
    assert.ok(r.error.includes("hash") || r.error.includes("No hash"));
  });

  it("should roundtrip embed+extract type 1", async () => {
    const img = makeImageFile("rt1.png");
    const secret = makeFile("sec.bin", [0xde, 0xad]);
    const emb = await globalThis.watermarkEmbed(1, img, secret, "pw1");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(1, stegoFile, "pw1");
    assert.ok(ext.ok);
    assert.ok(ext.files);
    assert.ok(Object.keys(ext.files).length > 0);
  });

  it("should roundtrip embed+extract type 2", async () => {
    const img = makeImageFile("rt2.png");
    const secret = makeFile("sec.bin", [0xbe, 0xef]);
    const emb = await globalThis.watermarkEmbed(2, img, secret, "pw2");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego2.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(2, stegoFile, "pw2");
    assert.ok(ext.ok);
  });

  it("should roundtrip embed+extract type 3", async () => {
    const img = makeImageFile("rt3.png");
    const secret = makeFile("sec.bin", [0xca, 0xfe]);
    const emb = await globalThis.watermarkEmbed(3, img, secret, "pw3");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego3.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(3, stegoFile, "pw3");
    assert.ok(ext.ok);
  });

  it("should roundtrip embed+extract type 6", async () => {
    const img = makeImageFile("rt6.png");
    const secret = makeFile("sec.bin", [0xaa, 0xbb]);
    const emb = await globalThis.watermarkEmbed(6, img, secret, "pw6");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego6.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(6, stegoFile, "pw6");
    assert.ok(ext.ok);
  });

  it("should roundtrip embed+extract type 7", async () => {
    const img = makeImageFile("rt7.png");
    const secret = makeFile("sec.bin", [0x11, 0x22]);
    const emb = await globalThis.watermarkEmbed(7, img, secret, "pw7");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego7.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(7, stegoFile, "pw7");
    assert.ok(ext.ok);
  });

  it("should roundtrip embed+extract type 8", async () => {
    const img = makeImageFile("rt8.png");
    const secret = makeFile("sec.bin", [0xde, 0xad, 0xbe, 0xef]);
    const emb = await globalThis.watermarkEmbed(8, img, secret, "");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego8.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(8, stegoFile, "");
    assert.ok(ext.ok);
  });

  it("should roundtrip embed+extract type 4 (majority voting)", async () => {
    const img = makeImageFile("rt4.png");
    const secret = makeFile("sec.bin", [0xca, 0xfe, 0xba, 0xbe]);
    const emb = await globalThis.watermarkEmbed(4, img, secret, "pw4");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego4.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(4, stegoFile, "pw4");
    assert.ok(ext.ok);
    assert.ok(ext.files);
    assert.ok(Object.keys(ext.files).length > 0);
  });

  it("should roundtrip embed+extract type 9 (chrominance)", async () => {
    const img = makeImageFile("rt9.png");
    const secret = makeFile("sec.bin", [0x33, 0x44]);
    const emb = await globalThis.watermarkEmbed(9, img, secret, "pw9");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego9.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(9, stegoFile, "pw9");
    assert.ok(ext.ok);
  });

  it("should fail extract type 1 with wrong password", async () => {
    const img = makeImageFile("rt1_wp.png");
    const secret = makeFile("sec.bin", [0xde, 0xad]);
    const emb = await globalThis.watermarkEmbed(1, img, secret, "pw1");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego1_wp.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(1, stegoFile, "wrongpw");
    assert.equal(ext.ok, false);
  });

  it("should fail extract type 6 with wrong password", async () => {
    const img = makeImageFile("rt6_wp.png");
    const secret = makeFile("sec.bin", [0xaa, 0xbb]);
    const emb = await globalThis.watermarkEmbed(6, img, secret, "pw6");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego6_wp.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const ext = await globalThis.watermarkExtract(6, stegoFile, "wrongpw");
    assert.equal(ext.ok, false);
  });
});

// ── Tests: detectWatermarkAlgorithm ──
describe("Watermark — detectWatermarkAlgorithm", () => {
  it("should return empty array for clean image", async () => {
    const img = makeImageFile("detect_clean.png");
    const results = await globalThis.detectWatermarkAlgorithm(img, "");
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  it("should detect algorithm from watermarked image", async () => {
    const img = makeImageFile("detect_wm.png");
    const secret = makeFile("sec.bin", [0xde, 0xad]);
    const emb = await globalThis.watermarkEmbed(1, img, secret, "detectpw");
    assert.ok(emb.ok);
    const stegoFile = { name: "stego_detect.png", arrayBuffer: async () => { const b = await emb.data.arrayBuffer(); return b; } };
    const results = await globalThis.detectWatermarkAlgorithm(stegoFile, "detectpw");
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.type === 1));
  });
});

// ── Tests: downloadWatermark ──
function setupWmResult(result) {
  globalThis._resultStore = {};
  globalThis.setResult("wmResult", result);
}

describe("Watermark — downloadWatermark", () => {
  it("should do nothing when no result stored", async () => {
    globalThis._resultStore = {};
    await globalThis.downloadWatermark("txt");
  });

  it("should generate TXT download", async () => {
    setupWmResult({ algorithm: 1, type: "embed", message: "test" });
    let capturedBlob = null;
    globalThis.downloadBlobSimple = (blob, name) => { capturedBlob = { blob, name }; };
    await globalThis.downloadWatermark("txt");
    assert.ok(capturedBlob);
    assert.ok(capturedBlob.name.endsWith(".txt"));
  });

  it("should generate CSV download", async () => {
    setupWmResult({ algorithm: 2, type: "embed", message: "csv" });
    let capturedBlob = null;
    globalThis.downloadBlobSimple = (blob, name) => { capturedBlob = { blob, name }; };
    await globalThis.downloadWatermark("csv");
    assert.ok(capturedBlob);
    assert.ok(capturedBlob.name.endsWith(".csv"));
  });

  it("should generate JSON download", async () => {
    setupWmResult({ algorithm: 3, type: "extract", message: "json" });
    let capturedBlob = null;
    globalThis.downloadBlobSimple = (blob, name) => { capturedBlob = { blob, name }; };
    await globalThis.downloadWatermark("json");
    assert.ok(capturedBlob);
    assert.ok(capturedBlob.name.endsWith(".json"));
  });

  it("should generate XML download", async () => {
    setupWmResult({ algorithm: 4, type: "embed", message: "xml" });
    let capturedBlob = null;
    globalThis.downloadBlobSimple = (blob, name) => { capturedBlob = { blob, name }; };
    await globalThis.downloadWatermark("xml");
    assert.ok(capturedBlob);
    assert.ok(capturedBlob.name.endsWith(".xml"));
  });

  it("should generate HTML download", async () => {
    setupWmResult({ algorithm: 5, type: "extract", message: "html" });
    let capturedBlob = null;
    globalThis.downloadBlobSimple = (blob, name) => { capturedBlob = { blob, name }; };
    await globalThis.downloadWatermark("html");
    assert.ok(capturedBlob);
    assert.ok(capturedBlob.name.endsWith(".html"));
  });
});

// ── Tests: Password toggles ──
describe("Watermark — toggleWmPassword", () => {
  it("should hide password group for type 5 and 8, show for others", () => {
    const pwGroup = { style: { display: "" } };
    const typeSelect = { value: "5" };

    const origGetElementById = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) => {
      if (id === "wm-password-group") return pwGroup;
      if (id === "wm-type") return typeSelect;
      return null;
    };

    globalThis.toggleWmPassword();
    assert.equal(pwGroup.style.display, "none");

    typeSelect.value = "1";
    globalThis.toggleWmPassword();
    assert.equal(pwGroup.style.display, "block");

    globalThis.document.getElementById = origGetElementById;
  });

  it("should handle missing DOM elements gracefully", () => {
    globalThis.document.getElementById = () => null;
    globalThis.toggleWmPassword();
    globalThis.toggleWmExtractPassword();
    // Should not throw
  });
});
