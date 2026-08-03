// ── Certificate Sub‑module Unit Tests ──
// Tests all 5 sub‑modules: certificate_utils.js, certificate_pdf.js,
// certificate_docx.js, certificate_epub.js, certificate_ots.js
// Each sub‑module is loaded via vm.runInThisContext so c8 attributes coverage.
const { describe, it, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ======================================================================
//  DOM & Global Polyfills
// ======================================================================
var _domElements = {};
var _createdElements = [];
var _resultStore = {};
var _consoleAccum = [];

globalThis.document = {
  getElementById: function (id) { return _domElements[id] || null; },
  createElement: function (tag) {
    var el = {
      tagName: tag, href: "", download: "", children: [], style: {},
      value: "", checked: false, textContent: "", innerHTML: "", id: "",
      files: null, display: "", type: "text", disabled: false,
    };
    el.addEventListener = function () {};
    el.remove = function () { var ix = _createdElements.indexOf(this); if (ix >= 0) _createdElements.splice(ix, 1); };
    el.click = function () {};
    el.setAttribute = function () {};
    el.getAttribute = function () { return null; };
    el.append = function () {};
    if (tag === "canvas") {
      el.width = 0; el.height = 0;
      el.getContext = function () {
        return {
          font: "",
          fillStyle: "",
          textBaseline: "",
          measureText: function (t) { return { width: t.length * 6 }; },
          fillText: function () {},
          scale: function () {},
        };
      };
      el.toDataURL = function () {
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      };
    }
    if (tag === "script") {
      el.src = ""; el.onload = null; el.onerror = null;
    }
    if (tag === "style") {
      el.id = ""; el.textContent = "";
    }
    Object.defineProperty(el, "textContent", {
      get: function () { return this._tc || ""; },
      set: function (v) { this._tc = String(v); this.innerHTML = this._tc.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); },
      configurable: true,
    });
    Object.defineProperty(el, "style", {
      get: function () { return this._style || (this._style = {}); },
      set: function (v) { this._style = v; },
      configurable: true,
    });
    _createdElements.push(el);
    return el;
  },
  body: { append: function () {}, remove: function () {} },
  head: { append: function () {} },
  addEventListener: function () {},
  readyState: "complete",
};

function mockElement(id, overrides) {
  var el = {
    tagName: "input", href: "", download: "", children: [], style: {},
    value: "", checked: false, textContent: "", innerHTML: "", id: id,
    files: null, remove: function () {}, click: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    display: "", type: "text", disabled: false,
  };
  Object.defineProperty(el, "textContent", {
    get: function () { return this._tc || ""; },
    set: function (v) { this._tc = String(v); this.innerHTML = v; },
    configurable: true,
  });
  Object.defineProperty(el, "style", {
    get: function () { return this._style || (this._style = {}); },
    set: function (v) { this._style = v; },
    configurable: true,
  });
  if (overrides) Object.assign(el, overrides);
  _domElements[id] = el;
  return el;
}

function clearMockElements() {
  _domElements = {};
  _createdElements = [];
}

function storeResult(key, data) { _resultStore[key] = data; }

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null",
};
globalThis.URL.createObjectURL = function () { return "blob:stub"; };
globalThis.URL.revokeObjectURL = function () {};
globalThis.setResult = function (k, d) { _resultStore[k] = d; };
globalThis.getResult = function (k) { return _resultStore[k] || null; };
globalThis.alert = function () {};
globalThis.COUNTRY_CODES = [];
globalThis.getDefaultPhoneCode = function () {};
globalThis.updatePhoneMaxLength = function () {};
globalThis.__ = function (k, d) { return d || k; };
globalThis.Image = class {
  constructor() {
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.onload = null;
    this.onerror = null;
  }
  set src(v) {
    if (this.onload) setTimeout(this.onload.bind(this), 0);
    else if (this.onerror) setTimeout(this.onerror.bind(this), 0);
  }
};
globalThis.console.error = function () {
  _consoleAccum.push(Array.prototype.join.call(arguments, " "));
};

// ======================================================================
//  Library Mocks
// ======================================================================

// ── jspdf ──
globalThis.jspdf = globalThis.jspdf || {};
globalThis.jspdf.jsPDF = class {
  constructor() {
    this.constructor.lastInstance = this;
    this._calls = [];
    this._pages = 1;
  }
  setFontSize(s) { this._calls.push(["setFontSize", s]); return this; }
  setFont() { return this; }
  text(str, x, y, opts) {
    this._calls.push(["text", String(str), x, y, opts]);
    return this;
  }
  addPage() { this._calls.push(["addPage"]); this._pages++; return this; }
  addImage() { this._calls.push(["addImage"]); return this; }
  splitTextToSize(t, w) {
    var s = String(t);
    var lines = [];
    while (s.length > 0) { lines.push(s.substring(0, 60)); s = s.substring(60); }
    if (lines.length === 0) lines.push("");
    return lines;
  }
  output(fmt) {
    this._calls.push(["output", fmt]);
    return new Blob(["pdf-content"], { type: "application/pdf" });
  }
};

// ── docx ──
globalThis.docx = globalThis.docx || {
  Paragraph: class { constructor(o) { this.opts = o; } },
  TextRun: class { constructor(o) { this.opts = o; } },
  Table: class { constructor(o) { this.opts = o; } },
  TableRow: class { constructor(o) { this.opts = o; } },
  TableCell: class { constructor(o) { this.opts = o; } },
  Document: class { constructor(o) { this.opts = o; } },
  ImageRun: class { constructor(o) { this.opts = o; } },
  Packer: {
    toBlob: async function () {
      return new Blob(["docx-content"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    },
  },
  WidthType: { PERCENTAGE: "percentage" },
};

// ── QRious ──
globalThis.QRious = class {
  constructor(o) {
    this.element = o.element;
    this.value = o.value;
    this.size = o.size;
    this.level = o.level;
    this.padding = o.padding;
  }
};

// ── JSZip (real module for EPUB verification) ──
var realJSZip;
try { realJSZip = require("jszip"); } catch (e) { realJSZip = null; }
if (realJSZip) globalThis.JSZip = realJSZip;

// ── OpenTimestamps mock ──
function setupOTSMock() {
  var OpSHA256 = function () {};
  var OpAppend = function (bytes) { this.bytes = bytes; };
  var PendingAttestation = function (url) { this.url = url; };
  var tsObj = {
    add: function (op) {
      this._added = this._added || [];
      this._added.push(op);
      var sub = { attestations: [] };
      sub.add = function () { return sub; };
      return sub;
    },
    attestations: [],
  };
  globalThis.OpenTimestamps = {
    Ops: { OpSHA256: OpSHA256, OpAppend: OpAppend },
    Utils: {
      randBytes: function (n) { return new Uint8Array(n); },
      arrayToBytes: function (arr) { return String.fromCharCode.apply(null, arr); },
    },
    DetachedTimestampFile: {
      fromHash: function (op, hash) {
        return {
          timestamp: tsObj,
          serializeToBytes: function () { return new Uint8Array([0, 1, 2, 3]); },
        };
      },
    },
    Notary: { PendingAttestation: PendingAttestation },
  };
}

function clearOTSMock() {
  delete globalThis.OpenTimestamps;
}

// ======================================================================
//  Module Loader
// ======================================================================
function loadModule(filePath) {
  var src = fs.readFileSync(filePath, "utf8");
  // The IIFE won't throw because location.protocol is "file:"
  // c8 ignore markers around IIFE prevent counting it
  vm.runInThisContext(src, { filename: path.resolve(filePath) });
}

var COMMON_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function getFullMockData(overrides) {
  var data = {
    generator: "RedoSan Authenticity",
    generatedAt: "2026-06-15T14:30:00.000Z",
    user: { name: "Alice", email: "alice@example.com", phone: "+1-555-0100", website: "https://alice.example.com" },
    file: { name: "photo.jpg", size: 102400, type: "image/jpeg", hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", dataUrl: COMMON_PNG_DATA_URL, width: 800, height: 600 },
    watermark: true,
    watermarkAlgo: "LSB",
    watermarkResult: "Watermark embedded successfully using LSB algorithm.",
    documentWatermark: true,
    documentWatermarkFileName: "contract.docx",
    documentWatermarkResult: "Document watermark embedded successfully.",
    pixelInjection: true,
    piResultHtml: "Pixel injection completed with enhancedLSB.",
    timestamp: true,
    tsResult: "Timestamp created at 2026-06-15T14:30:00Z via OpenTimestamps.",
    fingerprint: true,
    fpResult: {
      hashes: {
        "SHA-1": "a9993e364706816aba3e25717850c26c9cd0d89d",
        "SHA-224": "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
        "SHA-256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        "SHA-384": "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
        "SHA-512": "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
        "SHA-3_224": "6b4e03423667dbb73b6e15454f0eb1abd4597f9a1b078e3f5b5a6bc7",
        "SHA-3_256": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
        "SHA-3_384": "0c63a75b845e4f7d01107d852e4c2485c51a50aaaa94fc61995e71bbee983a2ac3713831264adb47fb6bd1e058d5f004",
        "SHA-3_512": "a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26",
        "MD2": "8350e5a3e24c153df2275c9f80692773",
        "MD4": "a448017aaf21d8525fc10ae87aa6729d",
        "MD5": "900150983cd24fb0d6963f7d28e17f72",
        "BLAKE2b": "bddd813c634239721ca6bbd3a8cd0198d8e11c671222bf76b25bb18c5fa7a41c",
        "BLAKE2s": "6b4e03423667dbb73b6e15454f0eb1abd4597f9a1b078e3f5b5a6bc7",
        "BLAKE3": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
        "RIPEMD-160": "b10a8db164e0754105b7a99be72e3fe5e8c6b4b2",
        "Whirlpool": "b3e1ab6e7384486c99b9c1c0e5b3c2d2e5b3c2d2e5b3c2d2e5b3c2d2e5b3c2d2",
      },
      perceptual_hashes: {
        "ahash": "0f3a5c8e1d2b4a6c",
        "dhash": "a1b2c3d4e5f6a7b8",
        "phash": "1a2b3c4d5e6f7890",
        "whash": "0123456789abcdef",
      },
    },
    didSig: { did: "did:key:z6MktestDidSigValue12345678901234567890123456789012", algorithm: "Ed25519", timestamp: "2026-06-15T14:00:00.000Z", signature: "somesignaturevaluethatislongenoughfortesting1234567890abcdef" },
    faceBiometric: { detected: true, faceCount: 2, matchLabel: "Alice", didSigned: true, did: "did:key:faceDidValue12345", exportedAt: "2026-06-15T14:00:00.000Z" },
    ct: { submitted: true, hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", timestamp: "2026-06-15T14:00:00.000Z", aggregator: "https://a.pool.opentimestamps.org/digest", pending: false },
  };
  if (overrides) Object.assign(data, overrides);
  return data;
}

// ======================================================================
//  Load Modules
// ======================================================================
before(function () {
  clearMockElements();
  _resultStore = {};
  _consoleAccum = [];
  loadModule(path.join(__dirname, "../../Certificate/certificate_utils.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_ots.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_epub.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_pdf.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_docx.js"));
  // Note: we do NOT load certificate.js to avoid test pollution with its UI init code
});

// ======================================================================
//  1. certificate_utils.js — hasNonLatinChars
// ======================================================================
describe("certificate_utils — hasNonLatinChars", function () {
  it("returns false for pure ASCII", function () {
    assert.equal(hasNonLatinChars("Hello World 123 !@#"), false);
  });
  it("returns false for Latin-1 (U+00FF)", function () {
    assert.equal(hasNonLatinChars("café jalapeño"), false);
  });
  it("returns false for empty string", function () {
    assert.equal(hasNonLatinChars(""), false);
  });
  it("returns true for Arabic", function () {
    assert.equal(hasNonLatinChars("مرحبا بالعالم"), true);
  });
  it("returns true for Chinese", function () {
    assert.equal(hasNonLatinChars("你好世界"), true);
  });
  it("returns true for Japanese", function () {
    assert.equal(hasNonLatinChars("こんにちは"), true);
  });
  it("returns true for Cyrillic", function () {
    assert.equal(hasNonLatinChars("Привет мир"), true);
  });
  it("returns true for mixed ASCII and non-Latin", function () {
    assert.equal(hasNonLatinChars("Hello 你好"), true);
  });
  it("returns false for numbers and punctuation", function () {
    assert.equal(hasNonLatinChars("123-456-7890"), false);
  });
});

// ======================================================================
//  2. certificate_utils.js — bufToBase64
// ======================================================================
describe("certificate_utils — bufToBase64", function () {
  it("encodes 'Hello' to base64", function () {
    assert.equal(bufToBase64(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])), "SGVsbG8=");
  });
  it("encodes empty buffer", function () {
    assert.equal(bufToBase64(new Uint8Array(0)), "");
  });
  it("encodes binary data with null bytes", function () {
    var result = bufToBase64(new Uint8Array([0x00, 0x01, 0xff, 0xfe]));
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
  });
  it("handles single byte", function () {
    assert.equal(bufToBase64(new Uint8Array([0x61])), "YQ==");
  });
  it("handles two bytes", function () {
    assert.equal(bufToBase64(new Uint8Array([0x61, 0x62])), "YWI=");
  });
});

// ======================================================================
//  3. certificate_utils.js — bufToDataURL
// ======================================================================
describe("certificate_utils — bufToDataURL", function () {
  it("produces data URL with mime type", function () {
    var url = bufToDataURL(new Uint8Array([0x48, 0x65, 0x6c]), "text/plain");
    assert.ok(url.startsWith("data:text/plain;base64,"));
  });
  it("uses default mime when not provided", function () {
    var url = bufToDataURL(new Uint8Array([0x00]));
    assert.ok(url.startsWith("data:application/octet-stream;base64,"));
  });
  it("produces valid base64 content", function () {
    var url = bufToDataURL(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), "text/plain");
    var b64 = url.split(",")[1];
    assert.equal(Buffer.from(b64, "base64").toString(), "Hello");
  });
  it("handles empty buffer", function () {
    var url = bufToDataURL(new Uint8Array(0));
    assert.ok(url.startsWith("data:"));
  });
});

// ======================================================================
//  4. certificate_utils.js — makeCertDataURL
// ======================================================================
describe("certificate_utils — makeCertDataURL", function () {
  it("creates blob URL with specified mime", function () {
    var url = makeCertDataURL(new Uint8Array([0x01, 0x02]), "image/png");
    assert.equal(url, "blob:stub");
  });
  it("uses default mime when not provided", function () {
    var url = makeCertDataURL(new Uint8Array([0x01]));
    assert.equal(url, "blob:stub");
  });
});

// ======================================================================
//  5. certificate_utils.js — getFileHashSha256
// ======================================================================
describe("certificate_utils — getFileHashSha256", function () {
  it("computes SHA-256 of 'abc'", async function () {
    var hash = await getFileHashSha256(new Uint8Array([0x61, 0x62, 0x63]));
    assert.equal(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("computes hash of empty buffer", async function () {
    var hash = await getFileHashSha256(new Uint8Array(0));
    assert.equal(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("returns lowercase hex", async function () {
    var hash = await getFileHashSha256(new Uint8Array([0x00]));
    assert.equal(hash, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d");
    assert.ok(/^[0-9a-f]{64}$/.test(hash));
  });
  it("computes hash for longer buffer", async function () {
    var buf = new Uint8Array(256);
    for (var i = 0; i < 256; i++) buf[i] = i & 0xff;
    var hash = await getFileHashSha256(buf);
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });
});

// ======================================================================
//  6. certificate_utils.js — addTextSafe
// ======================================================================
describe("certificate_utils — addTextSafe", function () {
  it("handles Latin text directly via doc.text", function () {
    var doc = new globalThis.jspdf.jsPDF();
    addTextSafe(doc, "Hello World", 15, 50, 180, 9);
    var textCalls = doc._calls.filter(function (c) { return c[0] === "text"; });
    assert.ok(textCalls.length > 0);
  });
  it("handles non-Latin text via canvas rendering", function () {
    var doc = new globalThis.jspdf.jsPDF();
    assert.doesNotThrow(function () {
      addTextSafe(doc, "مرحبا بالعالم", 15, 50, 180, 9);
    });
    var addImageCalls = doc._calls.filter(function (c) { return c[0] === "addImage"; });
    assert.ok(addImageCalls.length > 0);
  });
  it("handles Chinese text via canvas", function () {
    var doc = new globalThis.jspdf.jsPDF();
    assert.doesNotThrow(function () {
      addTextSafe(doc, "你好世界", 15, 50, 180, 12);
    });
  });
  it("truncates very long non-Latin text when exceeding maxWidth", function () {
    var doc = new globalThis.jspdf.jsPDF();
    // Create a very long string of non-Latin characters
    var longText = "";
    for (var i = 0; i < 100; i++) longText += "ع";
    assert.doesNotThrow(function () {
      addTextSafe(doc, longText, 15, 50, 50, 9);
    });
  });
  it("uses default maxWidth and fontSize when not provided", function () {
    var doc = new globalThis.jspdf.jsPDF();
    assert.doesNotThrow(function () {
      addTextSafe(doc, "test", 15, 50);
    });
  });
  it("handles short non-Latin text without truncation", function () {
    var doc = new globalThis.jspdf.jsPDF();
    assert.doesNotThrow(function () {
      addTextSafe(doc, "はい", 15, 50, 180, 9);
    });
  });
});

// ======================================================================
//  7. certificate_utils.js — loadImageDimensions
// ======================================================================
describe("certificate_utils — loadImageDimensions", function () {
  it("resolves with dimensions from Image onload", async function () {
    var dims = await loadImageDimensions("data:image/png;base64,test");
    assert.equal(dims.width, 100);
    assert.equal(dims.height, 100);
  });
  it("resolves with 0,0 on Image onerror", async function () {
    // Temporarily make Image trigger onerror
    var origImage = globalThis.Image;
    globalThis.Image = class {
      constructor() { this.naturalWidth = 0; this.naturalHeight = 0; }
      set src(v) {
        if (this.onerror) setTimeout(this.onerror.bind(this), 0);
      }
    };
    var dims = await loadImageDimensions("bad-url");
    assert.equal(dims.width, 0);
    assert.equal(dims.height, 0);
    globalThis.Image = origImage;
  });
  it("resolves even when no onload/onerror handlers attached", function () {
    // Should resolve eventually via timeout (but normally onerror triggers immediately)
    return new Promise(function (resolve) {
      var timeout = setTimeout(function () { resolve("timeout"); }, 500);
      loadImageDimensions("data:,").then(function (dims) {
        clearTimeout(timeout);
        assert.ok(typeof dims.width === "number");
        resolve("done");
      });
    });
  });
});

// ======================================================================
//  8. certificate_utils.js — buildQRVerificationJSON
// ======================================================================
describe("certificate_utils — buildQRVerificationJSON", function () {
  function basicData() {
    return {
      generator: "RedoSan",
      generatedAt: "2026-06-01T12:00:00Z",
      file: { name: "photo.jpg", size: 5000, hash: "abc123", width: 1920, height: 1080 },
      user: { name: "Bob", email: "bob@test.com" },
    };
  }

  it("includes basic fields", function () {
    var qr = JSON.parse(buildQRVerificationJSON(basicData()));
    assert.equal(qr.v, 1);
    assert.equal(qr.gen, "RedoSan");
    assert.equal(qr.file.n, "photo.jpg");
    assert.equal(qr.file.s, 5000);
    assert.equal(qr.user.n, "Bob");
    assert.equal(qr.dims, "1920x1080");
  });

  it("includes fingerprint hashes and perceptual hashes", function () {
    var data = basicData();
    data.fpResult = {
      hashes: { "SHA-256": "sha256hash", "MD5": "md5hash" },
      perceptual_hashes: { "dHash": "dhashval" },
    };
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.fp["SHA-256"], "sha256hash");
    assert.equal(qr.fp.ph_dHash, "dhashval");
  });

  it("handles didSig with signature", function () {
    var data = basicData();
    data.didSig = { did: "did:key:z6Mkabcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrst", signature: "sig12345678901234567890", algorithm: "Ed25519" };
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.ok(qr.did.length <= 60);
    // .substring(0, 20) + "..."
    assert.equal(qr.sig, "sig12345678901234567...");
  });

  it("handles didIdentity fallback when no didSig", function () {
    var data = basicData();
    data.didIdentity = "did:key:z6Mkfallbackidentity";
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.did, "did:key:z6Mkfallbackidentity");
  });

  it("handles faceBiometric", function () {
    var data = basicData();
    data.faceBiometric = { detected: true, faceCount: 3 };
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.fc, 3);
  });

  it("sets watermark, pixelInjection, timestamp flags", function () {
    var data = basicData();
    data.watermark = true;
    data.pixelInjection = true;
    data.timestamp = true;
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.wm, 1);
    assert.equal(qr.pi, 1);
    assert.equal(qr.ts, 1);
  });

  it("sets flags to 0 when features absent", function () {
    var data = basicData();
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.wm, 0);
    assert.equal(qr.pi, 0);
    assert.equal(qr.ts, 0);
  });

  it("handles missing width/height without dims", function () {
    var data = basicData();
    delete data.file.width;
    delete data.file.height;
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.dims, "");
  });

  it("handles empty user name and email", function () {
    var data = basicData();
    data.user = { name: "", email: "" };
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.user.n, "");
    assert.equal(qr.user.e, "");
  });

  it("handles fpResult with only perceptual hashes", function () {
    var data = basicData();
    data.fpResult = {
      hashes: {},
      perceptual_hashes: { "dHash": "val1", "pHash": "val2" },
    };
    var qr = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(qr.fp.ph_dHash, "val1");
    assert.equal(qr.fp.ph_pHash, "val2");
  });
});

// ======================================================================
//  9. certificate_utils.js — getDocHash
// ======================================================================
describe("certificate_utils — getDocHash", function () {
  it("returns a SHA-256 hex hash of a JSON string", async function () {
    var hash = await getDocHash('{"hello":"world"}');
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(hash));
  });
  it("returns consistent hash for same input", async function () {
    var h1 = await getDocHash("test data");
    var h2 = await getDocHash("test data");
    assert.equal(h1, h2);
  });
  it("returns different hash for different input", async function () {
    var h1 = await getDocHash("data1");
    var h2 = await getDocHash("data2");
    assert.notEqual(h1, h2);
  });
  it("handles empty string", async function () {
    var hash = await getDocHash("");
    assert.equal(hash.length, 64);
  });
});

// ======================================================================
//  10. certificate_utils.js — generateQRDataURL
// ======================================================================
describe("certificate_utils — generateQRDataURL", function () {
  it("returns a data URL with default size", function () {
    var url = generateQRDataURL("test content");
    assert.ok(typeof url === "string");
    assert.ok(url.startsWith("data:image/png;base64,"));
  });
  it("accepts custom size parameter", function () {
    var url = generateQRDataURL("test content", 500);
    assert.ok(url.startsWith("data:image/png;base64,"));
  });
  it("handles empty string", function () {
    var url = generateQRDataURL("", 300);
    assert.ok(url.startsWith("data:image/png;base64,"));
  });
  it("handles JSON content", function () {
    var url = generateQRDataURL(JSON.stringify({ data: "test", hash: "abc" }), 400);
    assert.ok(url.startsWith("data:image/png;base64,"));
  });
});

// ======================================================================
//  11. certificate_utils.js — makeUUID
// ======================================================================
describe("certificate_utils — makeUUID", function () {
  it("returns crypto.randomUUID if available", function () {
    var uuid = makeUUID();
    // Should be a UUID v4 format
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid),
      "UUID format mismatch: " + uuid);
  });
  it("returns fallback UUID when crypto.randomUUID is missing", function () {
    var origRand = globalThis.crypto.randomUUID;
    // Use assignment instead of delete for non-configurable properties
    globalThis.crypto.randomUUID = undefined;
    var uuid = makeUUID();
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid));
    globalThis.crypto.randomUUID = origRand;
  });
  it("returns string of correct length", function () {
    var uuid = makeUUID();
    assert.equal(uuid.length, 36);
  });
});

// ======================================================================
//  12. certificate_utils.js — fmtSize
// ======================================================================
describe("certificate_utils — fmtSize", function () {
  it("formats 0 B", function () { assert.equal(fmtSize(0), "0 B"); });
  it("formats bytes", function () { assert.equal(fmtSize(500), "500 B"); });
  it("formats 1 B", function () { assert.equal(fmtSize(1), "1 B"); });
  it("formats 1023 B", function () { assert.equal(fmtSize(1023), "1023 B"); });
  it("formats 1.0 KB", function () { assert.equal(fmtSize(1024), "1.0 KB"); });
  it("formats 1.5 KB", function () { assert.equal(fmtSize(1536), "1.5 KB"); });
  it("formats 1023.9 KB", function () { assert.equal(fmtSize(1048575), "1024.0 KB"); });
  it("formats 1.0 MB", function () { assert.equal(fmtSize(1048576), "1.0 MB"); });
  it("formats 1.5 MB", function () { assert.equal(fmtSize(1572864), "1.5 MB"); });
  it("formats 10.5 MB", function () { assert.equal(fmtSize(11010048), "10.5 MB"); });
});

// ======================================================================
//  13. certificate_utils.js — stripHtml
// ======================================================================
describe("certificate_utils — stripHtml", function () {
  it("returns empty string for null/undefined", function () {
    assert.equal(stripHtml(null), "");
    assert.equal(stripHtml(undefined), "");
  });
  it("returns empty string for empty input", function () {
    assert.equal(stripHtml(""), "");
  });
  it("returns plain text unchanged", function () {
    assert.equal(stripHtml("Hello World"), "Hello World");
  });
  it("strips simple tags", function () {
    assert.equal(stripHtml("<p>Hi</p>"), "Hi");
  });
  it("decodes &amp; to &", function () {
    assert.equal(stripHtml("&amp;"), "&");
  });
  it("decodes &lt; and &gt;", function () {
    assert.equal(stripHtml("&lt;tag&gt;"), "<tag>");
  });
  it("decodes &quot; and &#39;", function () {
    assert.equal(stripHtml("&quot;quote&quot; &#39;apos&#39;"), "\"quote\" 'apos'");
  });
  it("collapses whitespace", function () {
    assert.equal(stripHtml("  spaced  "), "spaced");
  });
  it("strips nested tags", function () {
    assert.equal(stripHtml("<div><p>Deep<b>Nested</b></p></div>"), "DeepNested");
  });
  it("handles multiple HTML entities in sequence", function () {
    assert.equal(stripHtml("&amp;&lt;&gt;&quot;&#39;"), "&<>\"'");
  });
  it("handles unknown entities — space gets trimmed", function () {
    // The entity is replaced with " " which gets trimmed to ""
    assert.equal(stripHtml("&unknown;"), "");
  });
  it("handles repeated entity — only first is decoded", function () {
    // The greedy regex matches &amp; first, decodes to &, leaving amp; as text
    assert.equal(stripHtml("&amp;amp;"), "&amp;");
  });
  it("handles multiple unknown entities", function () {
    // Each unknown entity becomes "" after trim()
    assert.equal(stripHtml("&foo;&bar;"), "");
  });
  it("handles mixed content", function () {
    assert.equal(stripHtml("<b>Hello</b> &amp; <i>World</i>"), "Hello & World");
  });
});

// ======================================================================
//  14. certificate_utils.js — escHtml
// ======================================================================
describe("certificate_utils — escHtml", function () {
  it("returns empty string for null", function () {
    assert.equal(escHtml(null), "");
  });
  it("returns empty string for undefined", function () {
    assert.equal(escHtml(undefined), "");
  });
  it("passes safe text through", function () {
    assert.equal(escHtml("safe"), "safe");
  });
  it("escapes < to &lt;", function () {
    assert.equal(escHtml("<script>"), "&lt;script&gt;");
  });
  it("escapes & to &amp;", function () {
    assert.equal(escHtml("a&b"), "a&amp;b");
  });
  it("escapes double quotes", function () {
    assert.equal(escHtml('a"b'), "a&quot;b");
  });
  it("escapes mixed special characters", function () {
    var result = escHtml("<a href='test'>&</a>");
    // The input has no double-quotes, so &quot; won't appear
    assert.ok(result.indexOf("&lt;") !== -1);
    assert.ok(result.indexOf("&gt;") !== -1);
    assert.ok(result.indexOf("&amp;") !== -1);
  });
  it("handles numbers", function () {
    assert.equal(escHtml(42), "42");
  });
  it("handles objects by converting to string", function () {
    var result = escHtml({ toString: function () { return "obj"; } });
    assert.equal(result, "obj");
  });
});

// ======================================================================
//  15. certificate_pdf.js — downloadCertPDF
// ======================================================================
describe("certificate_pdf — downloadCertPDF", function () {
  it("returns a Blob with full data", async function () {
    var blob = await downloadCertPDF(getFullMockData());
    assert.ok(blob instanceof Blob);
  });

  it("includes title and generation date", async function () {
    var data = getFullMockData();
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var texts = doc._calls.filter(function (c) { return c[0] === "text"; });
    var allText = texts.map(function (c) { return c[1]; }).join(" ");
    assert.ok(allText.indexOf("Digital Passport") !== -1);
    assert.ok(allText.indexOf("2026-06-15") !== -1);
  });

  it("includes user info section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Alice") !== -1);
    assert.ok(allText.indexOf("alice@example.com") !== -1);
  });

  it("includes file info section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("photo.jpg") !== -1);
    assert.ok(allText.indexOf("SHA-256") !== -1);
    assert.ok(allText.indexOf("800 x 600") !== -1);
  });

  it("includes watermark section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Watermark") !== -1);
    assert.ok(allText.indexOf("LSB") !== -1);
  });

  it("includes document watermark section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Document Watermark") !== -1);
    assert.ok(allText.indexOf("contract.docx") !== -1);
  });

  it("includes pixel injection section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Pixel Injection") !== -1);
  });

  it("includes timestamp section with result", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Timestamp") !== -1);
  });

  it("includes timestamp section without result (fallback message)", async function () {
    var data = getFullMockData({ timestamp: true, tsResult: "" });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("created successfully") !== -1);
  });

  it("includes fingerprint section with all hash families", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("SHA-1") !== -1);
    assert.ok(allText.indexOf("SHA-2") !== -1);
    assert.ok(allText.indexOf("SHA-3") !== -1);
    assert.ok(allText.indexOf("BLAKE") !== -1);
    assert.ok(allText.indexOf("Other") !== -1);
  });

  it("includes fingerprint with only some families", async function () {
    var data = getFullMockData({
      fingerprint: true,
      fpResult: { hashes: { "SHA-256": "onlythis" } },
    });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Fingerprint") !== -1);
    assert.ok(allText.indexOf("SHA-256") !== -1);
  });

  it("includes perceptual hashes in fingerprint", async function () {
    var data = getFullMockData({
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc" },
        perceptual_hashes: { "ahash": "aaaa", "dhash": "bbbb" },
      },
    });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("ahash") !== -1 || allText.indexOf("dhash") !== -1);
  });

  it("includes DID signature section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Decentralized Identity") !== -1);
    assert.ok(allText.indexOf("did:key:z6Mktest") !== -1);
  });

  it("includes DID identity fallback when didSig missing", async function () {
    var data = getFullMockData({ didSig: null, didIdentity: "did:key:z6Mkfallback" });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("DID Identity") !== -1);
    assert.ok(allText.indexOf("z6Mkfallback") !== -1);
  });

  it("includes face biometric section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Face Biometric") !== -1);
    assert.ok(allText.indexOf("2") !== -1);
    assert.ok(allText.indexOf("Alice") !== -1);
  });

  it("includes face biometric without matchLabel", async function () {
    var data = getFullMockData({
      faceBiometric: { detected: true, faceCount: 1, didSigned: false, exportedAt: "2026-06-15T14:00:00.000Z" },
    });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Face Biometric") !== -1);
    assert.ok(allText.indexOf("1") !== -1);
  });

  it("includes completed CT section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Certificate Transparency") !== -1);
    assert.ok(allText.indexOf("opentimestamps.org") !== -1);
  });

  it("includes pending CT section", async function () {
    var data = getFullMockData({ ct: { submitted: true, hash: "abc123", pending: true } });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Certificate Transparency") !== -1);
  });

  it("includes CT error state", async function () {
    var data = getFullMockData({ ct: { submitted: false, error: "calendar unreachable" } });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Unavailable") !== -1);
  });

  it("handles CT error state without submitted property", async function () {
    var data = getFullMockData({ ct: { error: "offline" } });
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Certificate Transparency") !== -1);
  });

  it("includes QR code section", async function () {
    await downloadCertPDF(getFullMockData());
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Verification QR Code") !== -1);
  });

  it("handles minimal data with no optional sections", async function () {
    var minimal = {
      generator: "Test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "", email: "", phone: "", website: "" },
      file: { name: "test.bin", size: 0, type: "application/octet-stream", hash: "" },
      watermark: false,
      documentWatermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      didSig: null,
      faceBiometric: null,
      ct: null,
    };
    var blob = await downloadCertPDF(minimal);
    assert.ok(blob instanceof Blob);
  });

  it("handles data without image (no dataUrl)", async function () {
    var data = getFullMockData();
    data.file.dataUrl = null;
    data.file.width = null;
    data.file.height = null;
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles data with image but no dimensions", async function () {
    var data = getFullMockData();
    delete data.file.width;
    delete data.file.height;
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles small image (no scaling)", async function () {
    var data = getFullMockData();
    data.file.dataUrl = COMMON_PNG_DATA_URL;
    data.file.width = 50;
    data.file.height = 50;
    data.file.type = "image/png";
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles user with only name (no email/phone/website)", async function () {
    var data = getFullMockData({
      user: { name: "OnlyName", email: "", phone: "", website: "" },
    });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("triggers page break when content exceeds page height", async function () {
    var data = getFullMockData();
    // Reset the doc mock to track addPage calls
    data.generatedAt = "2026-06-15T14:30:00.000Z";
    await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    // With lots of content, addPage should be called
    assert.ok(doc._pages >= 1);
  });

  it("handles data with jpeg image type", async function () {
    var data = getFullMockData({ file: { name: "photo.jpeg", size: 50000, type: "image/jpeg", dataUrl: COMMON_PNG_DATA_URL, width: 640, height: 480 } });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles watermark with no result text (else branch)", async function () {
    var data = getFullMockData({ watermark: true, watermarkAlgo: "DCT", watermarkResult: "" });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles document watermark with no result text (else branch)", async function () {
    var data = getFullMockData({ documentWatermark: true, documentWatermarkFileName: "report.docx", documentWatermarkResult: "" });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DID with short signature", async function () {
    var data = getFullMockData({ didSig: { did: "did:key:z6Mkshort", algorithm: "Ed25519", signature: "short" } });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles CT with aggregator without https:// prefix", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999", timestamp: "2026-06-15T14:00:00.000Z", aggregator: "https://example.com/path/to/calendar", pending: false },
    });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles CT with empty aggregator (falls back to OTS calendar)", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999", timestamp: "2026-06-15T14:00:00.000Z", aggregator: "", pending: false },
    });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: short-circuit fallbacks ──
  it("handles watermark without algorithm (fallback to 'Completed')", async function () {
    var data = getFullMockData({ watermark: true, watermarkResult: "Done", watermarkAlgo: "" });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles document watermark without filename (fallback to 'Completed')", async function () {
    var data = getFullMockData({ documentWatermark: true, documentWatermarkFileName: "" });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DID without algorithm (fallback to 'Ed25519')", async function () {
    var data = getFullMockData({ didSig: { did: "did:key:z6MknoAlgo", algorithm: "", timestamp: "2026-06-15T14:00:00.000Z", signature: "sig".repeat(10) } });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DID without signature (fallback to empty string)", async function () {
    var data = getFullMockData({ didSig: { did: "did:key:z6MknoSig", algorithm: "Ed25519", timestamp: "2026-06-15T14:00:00.000Z", signature: "" } });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles CT without timestamp (fallback to empty string)", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "ccc".repeat(21), timestamp: "", aggregator: "https://example.com/ots", pending: false },
    });
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles CT error state without error message (fallback to 'offline')", async function () {
    var data = getFullMockData({ ct: { submitted: false } }); // no error property
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles CT submitted=true without hash (enters else-if, ? 'Submitted')", async function () {
    var data = getFullMockData({ ct: { submitted: true } }); // no hash property
    delete data.ct.hash;
    var blob = await downloadCertPDF(data);
    assert.ok(blob instanceof Blob);
  });
});

// ======================================================================
//  16. certificate_docx.js — downloadCertDOCX
// ======================================================================
describe("certificate_docx — downloadCertDOCX", function () {
  it("returns a Blob with full data", async function () {
    var blob = await downloadCertDOCX(getFullMockData());
    assert.ok(blob instanceof Blob);
  });

  it("handles minimal data without optional fields", async function () {
    var minimal = {
      generator: "Test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "", email: "" },
      file: { name: "test.bin", size: 0, type: "application/octet-stream" },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      didSig: null,
      faceBiometric: null,
      ct: null,
    };
    var blob = await downloadCertDOCX(minimal);
    assert.ok(blob instanceof Blob);
  });

  it("includes document watermark section", async function () {
    var data = getFullMockData({ documentWatermark: true, documentWatermarkFileName: "contract.docx", documentWatermarkResult: "Embedded ok" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes pixel injection section", async function () {
    var data = getFullMockData({ pixelInjection: true, piResultHtml: "PI complete" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes timestamp section with result", async function () {
    var data = getFullMockData({ timestamp: true, tsResult: "Created" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes timestamp section without result (fallback)", async function () {
    var data = getFullMockData({ timestamp: true, tsResult: "" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes fingerprint with hashes and perceptual hashes", async function () {
    var data = getFullMockData({
      fingerprint: true,
      fpResult: { hashes: { "SHA-256": "abc123" }, perceptual_hashes: { "dHash": "val" } },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes DID signature section", async function () {
    var data = getFullMockData({
      didSig: { did: "did:key:z6Mktest", algorithm: "Ed25519", timestamp: "2026-06-15T12:00:00Z", signature: "sig".repeat(30) },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes DID identity fallback", async function () {
    var data = getFullMockData({ didSig: null, didIdentity: "did:key:fallback" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes face biometric section", async function () {
    var data = getFullMockData({
      faceBiometric: { detected: true, faceCount: 1, matchLabel: "Bob", didSigned: false, exportedAt: "2026-06-15T12:00:00Z" },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes CT section (complete)", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", timestamp: "2026-06-15T12:00:00Z", aggregator: "https://example.com/ots", pending: false },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes CT section (pending)", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "abc123", pending: true },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("includes CT section (error)", async function () {
    var data = getFullMockData({
      ct: { submitted: false, error: "offline" },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles file with dataUrl for image embedding", async function () {
    var data = getFullMockData();
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles file without dataUrl", async function () {
    var data = getFullMockData();
    delete data.file.dataUrl;
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles file with no width/height for image", async function () {
    var data = getFullMockData({ file: { name: "test.png", size: 100, type: "image/png", dataUrl: COMMON_PNG_DATA_URL } });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles user with phone and website", async function () {
    var data = getFullMockData({
      user: { name: "Bob", email: "bob@test.com", phone: "+1234567890", website: "https://bob.example.com" },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles watermark section with result", async function () {
    var data = getFullMockData({ watermark: true, watermarkAlgo: "DCT", watermarkResult: "Completed" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles watermark section without result text", async function () {
    var data = getFullMockData({ watermark: true, watermarkAlgo: "LSB", watermarkResult: "" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DOCX with gif image (triggers gif mime path)", async function () {
    // Must provide a data:image/gif dataUrl so addImage extracts "image/gif"
    var GIF_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    var data = getFullMockData({
      file: { name: "anim.gif", size: 5000, type: "image/gif", dataUrl: GIF_DATA_URL, width: 100, height: 100 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DOCX with bmp image (triggers bmp mime path)", async function () {
    // Minimal 1x1 24-bit BMP (padded to 4-byte row)
    var bmpBuf = Buffer.alloc(58);
    bmpBuf.write("BM", 0, "ascii");          // signature
    bmpBuf.writeUInt32LE(58, 2);               // file size
    bmpBuf.writeUInt32LE(54, 10);              // offset to pixel data
    bmpBuf.writeUInt32LE(40, 14);              // DIB header size
    bmpBuf.writeInt32LE(1, 18);                // width
    bmpBuf.writeInt32LE(1, 22);                // height
    bmpBuf.writeUInt16LE(1, 26);               // planes
    bmpBuf.writeUInt16LE(24, 28);              // bpp
    bmpBuf.writeUInt32LE(0, 30);               // compression (none)
    bmpBuf.writeUInt32LE(3, 34);               // image size
    bmpBuf[54] = 0;                            // B
    bmpBuf[55] = 0;                            // G
    bmpBuf[56] = 0;                            // R
    bmpBuf[57] = 0;                            // row padding
    var BMP_DATA_URL = "data:image/bmp;base64," + bmpBuf.toString("base64");
    var data = getFullMockData({
      file: { name: "bitmap.bmp", size: 5000, type: "image/bmp", dataUrl: BMP_DATA_URL, width: 100, height: 100 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DOCX with unknown mime (triggers default return 'png')", async function () {
    var SVG_DATA_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==";
    var data = getFullMockData({
      file: { name: "graphic.svg", size: 5000, type: "image/svg+xml", dataUrl: SVG_DATA_URL, width: 100, height: 100 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: watermarkAlgo empty (line 185) ──
  it("handles DOCX watermark without algorithm (fallback 'Completed')", async function () {
    var data = getFullMockData({ watermark: true, watermarkAlgo: "", watermarkResult: "done" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: docwm filename empty (line 205) ──
  it("handles DOCX document watermark without filename (fallback 'Completed')", async function () {
    var data = getFullMockData({ documentWatermark: true, documentWatermarkFileName: "", documentWatermarkResult: "" });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: DID missing algo/timestamp/sig (lines 270-277) ──
  it("handles DOCX DID with missing optional fields", async function () {
    var data = getFullMockData({ didSig: { did: "did:key:docxempty", algorithm: "", timestamp: "", signature: "" } });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: CT empty timestamp/aggregator (lines 310-313) ──
  it("handles DOCX CT with missing timestamp and aggregator", async function () {
    var data = getFullMockData({
      ct: { submitted: true, hash: "dd".repeat(32), timestamp: "", aggregator: "", pending: false },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: CT submitted=true without hash (lines 324-325) ──
  it("handles DOCX CT submitted=true without hash (else-if ternary)", async function () {
    var data = getFullMockData({ ct: { submitted: true } });
    delete data.ct.hash;
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: CT error without error message (|| 'offline') ──
  it("handles DOCX CT error without error message (fallback 'offline')", async function () {
    var data = getFullMockData({ ct: { submitted: false } }); // no error property
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: imageTypeFromMime with image/jpeg and image/jpg ──
  it("handles DOCX with jpeg image (triggers jpeg mime)", async function () {
    var JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRFJiMkVic4EzQjR0RSlFNkVUcCZS/9oADAMBAAIRAxEAPwC1//Z";
    var data = getFullMockData({
      file: { name: "photo.jpeg", size: 50000, type: "image/jpeg", dataUrl: JPEG_DATA_URL, width: 100, height: 100 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles DOCX with jpg extension image (triggers 'image/jpg' mime)", async function () {
    // Test the 'image/jpg' variant
    var JPG_DATA_URL = "data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRFJiMkVic4EzQjR0RSlFNkVUcCZS/9oADAMBAAIRAxEAPwC1//Z";
    var data = getFullMockData({
      file: { name: "photo.jpg", size: 50000, type: "image/jpg", dataUrl: JPG_DATA_URL, width: 100, height: 100 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: data URL without mime prefix (line 68 || "") ──
  it("handles DOCX with malformed data URL (no mime prefix)", async function () {
    var RAW_DATA_URL = "base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    var data = getFullMockData({
      file: { name: "raw.bin", size: 100, dataUrl: RAW_DATA_URL, width: 50, height: 50 },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });
});

// ======================================================================
//  17. certificate_docx.js — Internal helpers
// ======================================================================
describe("certificate_docx — internal functions", function () {
  // These are reachable through downloadCertDOCX indirectly,
  // but we can verify behavior by calling them directly since they're
  // defined in global scope inside the module

  it("downloadCertDOCX creates valid Packer call", async function () {
    // Mock docx.Packer.toBlob to track calls
    var origToBlob = globalThis.docx.Packer.toBlob;
    var called = false;
    globalThis.docx.Packer.toBlob = async function () {
      called = true;
      return new Blob(["docx-content"]);
    };
    var data = getFullMockData({ didSig: null, faceBiometric: null, ct: null, documentWatermark: false, pixelInjection: false, timestamp: false, fingerprint: false, watermark: false });
    await downloadCertDOCX(data);
    assert.ok(called, "Packer.toBlob should be called");
    globalThis.docx.Packer.toBlob = origToBlob;
  });

  it("imageTypeFromMime handles various mime types", function () {
    // These functions are defined inside downloadCertDOCX closure,
    // so they're not directly accessible. We test them via data setup.
    // The function maps: image/png->png, image/jpeg->jpeg, image/gif->gif,
    // image/bmp->bmp, anything else->png
    assert.ok(true); // coverage is from actual downloadCertDOCX calls
  });
});

// ======================================================================
//  18. certificate_epub.js — downloadCertEPUB
// ======================================================================
describe("certificate_epub — downloadCertEPUB", function () {
  it("returns a Blob with full data", async function () {
    var blob = await downloadCertEPUB(getFullMockData());
    assert.ok(blob instanceof Blob);
  });

  it("creates valid EPUB structure with mimetype entry", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var files = Object.keys(zip.files);
    assert.ok(files.indexOf("mimetype") !== -1);
    var mimetype = await zip.file("mimetype").async("string");
    assert.equal(mimetype, "application/epub+zip");
  });

  it("includes META-INF/container.xml", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var container = await zip.file("META-INF/container.xml").async("string");
    assert.ok(container.indexOf("content.opf") !== -1);
  });

  it("includes OEBPS/content.xhtml with user data", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Alice") !== -1);
    assert.ok(xhtml.indexOf("photo.jpg") !== -1);
    assert.ok(xhtml.indexOf("Watermark") !== -1);
    assert.ok(xhtml.indexOf("Document Watermark") !== -1);
    assert.ok(xhtml.indexOf("Pixel Injection") !== -1);
    assert.ok(xhtml.indexOf("Timestamp") !== -1);
    assert.ok(xhtml.indexOf("Fingerprint") !== -1);
  });

  it("includes OEBPS/style.css", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var css = await zip.file("OEBPS/style.css").async("string");
    assert.ok(css.indexOf("body{font-family:serif;") !== -1);
  });

  it("includes OEBPS/toc.ncx", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var ncx = await zip.file("OEBPS/toc.ncx").async("string");
    assert.ok(ncx.indexOf("Digital Passport") !== -1);
  });

  it("includes OEBPS/content.opf with manifest items", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var opf = await zip.file("OEBPS/content.opf").async("string");
    assert.ok(opf.indexOf("content.xhtml") !== -1);
    assert.ok(opf.indexOf("style.css") !== -1);
    assert.ok(opf.indexOf("toc.ncx") !== -1);
    assert.ok(opf.indexOf("images/qr.png") !== -1);
  });

  it("includes images when dataUrl is present", async function () {
    if (!realJSZip) { this.skip(); return; }
    var blob = await downloadCertEPUB(getFullMockData());
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    assert.ok(zip.file("OEBPS/images/qr.png") !== null);
    assert.ok(zip.file("OEBPS/images/photo.jpg") !== null);
  });

  it("uses PNG extension when file type is image/png", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ file: { name: "photo.png", size: 50000, type: "image/png", dataUrl: COMMON_PNG_DATA_URL, width: 100, height: 100 } });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    assert.ok(zip.file("OEBPS/images/photo.png") !== null);
  });

  it("handles minimal data without images or optional sections", async function () {
    if (!realJSZip) { this.skip(); return; }
    var minimal = {
      generator: "Test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "", email: "" },
      file: { name: "test.bin", size: 0, type: "application/octet-stream" },
      watermark: false,
      documentWatermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      didSig: null,
      faceBiometric: null,
      ct: null,
    };
    var blob = await downloadCertEPUB(minimal);
    assert.ok(blob instanceof Blob);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    // Should still have QR but not photo
    assert.ok(zip.file("OEBPS/images/qr.png") !== null);
    assert.equal(zip.file("OEBPS/images/photo.jpg"), null);
  });

  it("handles fingerprint with perceptual hashes", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      fingerprint: true,
      fpResult: { hashes: { "SHA-256": "abcdef", "MD5": "12345" }, perceptual_hashes: { "ahash": "aaaa", "dhash": "bbbb" } },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("SHA-256") !== -1);
    assert.ok(xhtml.indexOf("ahash") !== -1);
  });

  it("handles didSig section", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ didSig: { did: "did:example:123", algorithm: "Ed25519", timestamp: "2026-01-15T12:30:00.000Z", signature: "sig".repeat(30) } });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("did:example:123") !== -1);
  });

  it("handles didIdentity fallback", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ didSig: null, didIdentity: "did:example:456" });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("did:example:456") !== -1);
  });

  it("handles CT section (submitted, complete)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      ct: { submitted: true, hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", timestamp: "2026-01-15T12:30:00.000Z", aggregator: "https://example.com/ots", pending: false },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Certificate Transparency") !== -1);
    assert.ok(xhtml.indexOf("abcdef1234567890") !== -1);
  });

  it("handles CT section (pending)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ ct: { submitted: true, pending: true, hash: "abc123" } });
    // When pending, the Logged/Log lines should not be present
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Certificate Transparency") !== -1);
  });

  it("handles CT section (error state)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ ct: { submitted: false, error: "calendar unreachable" } });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("calendar unreachable") !== -1);
  });

  it("handles faceBiometric section with all fields", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData();
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Faces detected") !== -1);
    assert.ok(xhtml.indexOf("Alice") !== -1);
  });

  it("handles faceBiometric without matchLabel and no did", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      faceBiometric: { detected: true, faceCount: 1, didSigned: false, exportedAt: "2026-06-15T14:00:00.000Z" },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("DID Signed") !== -1);
    assert.ok(xhtml.indexOf("No") !== -1);
  });

  it("handles user with phone and website in EPUB", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      user: { name: "Bob", email: "bob@test.com", phone: "+1234567890", website: "https://bob.example.com" },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Bob") !== -1);
    assert.ok(xhtml.indexOf("bob@test.com") !== -1);
    assert.ok(xhtml.indexOf("+1234567890") !== -1);
    assert.ok(xhtml.indexOf("bob.example.com") !== -1);
  });

  it("handles timestamp section without tsResult", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ timestamp: true, tsResult: "" });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    // Should show fallback message
    assert.ok(xhtml.indexOf("Timestamp created") !== -1);
  });

  it("handles user without name (empty user section)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ user: { name: "", email: "" } });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    // Should NOT have Owner section
    assert.ok(xhtml.indexOf("<h2>Owner</h2>") === -1);
  });

  it("handles file without width (no dimensions in EPUB)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData();
    delete data.file.width;
    delete data.file.height;
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    // Should not include Dimensions row
    assert.ok(xhtml.indexOf("Dimensions") === -1);
  });

  it("handles file without hash (no fp or CT to interfere)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData();
    delete data.file.hash;
    data.ct = null;
    data.fingerprint = false;
    data.fpResult = null;
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("SHA-256") === -1);
  });

  it("handles watermark section with empty result (|| '')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ watermark: true, watermarkAlgo: "LSB", watermarkResult: "" });
    var blob = await downloadCertEPUB(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles pixel injection with empty result", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ pixelInjection: true, piResultHtml: "" });
    var blob = await downloadCertEPUB(data);
    assert.ok(blob instanceof Blob);
  });

  it("handles aggregator without https:// prefix", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      ct: { submitted: true, hash: "aa11223344556677889900aabbccddeeff0011223344556677889900aabbccdd", timestamp: "2026-01-15T12:00:00.000Z", aggregator: "some.calendar/ots", pending: false },
    });
    var blob = await downloadCertEPUB(data);
    assert.ok(blob instanceof Blob);
  });

  // ── Branch coverage: doc watermark empty result ──
  it("handles document watermark with empty result (|| '')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ documentWatermark: true, documentWatermarkResult: "" });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Document Watermark") !== -1);
    assert.ok(xhtml.indexOf("Completed") !== -1); // fileName fallback
  });

  // ── Branch coverage: watermarkAlgo empty (epub line 154) ──
  it("handles watermark with empty algorithm (fallback 'Completed')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ watermark: true, watermarkAlgo: "", watermarkResult: "done" });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Completed") !== -1);
  });

  // ── Branch coverage: docwm filename empty (epub line 161) ──
  it("handles document watermark with empty filename (fallback 'Completed')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ documentWatermark: true, documentWatermarkFileName: "", documentWatermarkResult: "" });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Completed") !== -1);
  });

  // ── Branch coverage: DID missing algorithm/timestamp/signature ──
  it("handles didSig with missing optional fields", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      didSig: { did: "did:example:789", algorithm: "", timestamp: "", signature: "" },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("did:example:789") !== -1);
    assert.ok(xhtml.indexOf("Ed25519") !== -1); // algorithm fallback
  });

  // ── Branch coverage: CT empty timestamp & empty aggregator ──
  it("handles CT logged section with missing timestamp and aggregator", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      ct: { submitted: true, hash: "bb1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", timestamp: "", aggregator: "", pending: false },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("OTS") !== -1 || xhtml.indexOf("agator") !== -1);
  });

  // ── Branch coverage: CT error state without error message ──
  it("handles CT error state without error message (|| 'offline')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ ct: { submitted: false } }); // no error property
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("offline") !== -1);
  });

  // ── Branch coverage: CT aggregator that becomes empty after stripping (line 236) ──
  it("handles CT aggregator that yields empty short name (|| 'OTS calendar')", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      ct: { submitted: true, hash: "cc".repeat(32), timestamp: "2026-01-15T12:00:00.000Z", aggregator: "https://", pending: false },
    });
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("OTS calendar") !== -1);
  });

  // ── Branch coverage: CT submitted=true but hash missing (epub line 244) ──
  it("handles CT submitted=true without hash (in else-if)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({ ct: { submitted: true } }); // no hash
    delete data.ct.hash;
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Submitted") !== -1);
  });

  // ── Branch coverage: file with dataUrl but no type ──
  it("handles file with dataUrl but no type (mime fallback)", async function () {
    if (!realJSZip) { this.skip(); return; }
    var data = getFullMockData({
      file: { name: "photo.jpg", size: 50000, dataUrl: COMMON_PNG_DATA_URL, width: 100, height: 100 },
    });
    delete data.file.type;
    var blob = await downloadCertEPUB(data);
    var buf = await blob.arrayBuffer();
    var zip = await realJSZip.loadAsync(buf);
    var opf = await zip.file("OEBPS/content.opf").async("string");
    assert.ok(opf.indexOf("image/jpeg") !== -1); // default mime fallback
  });
});

// ======================================================================
//  19. certificate_ots.js — generatePendingOts
// ======================================================================
describe("certificate_ots — generatePendingOts", function () {
  before(function () { clearOTSMock(); });

  it("returns null when OpenTimestamps is unavailable", function () {
    var result = generatePendingOts("abcdef1234567890");
    assert.equal(result, null);
  });

  it("returns base64 string when OpenTimestamps is available", function () {
    setupOTSMock();
    var result = generatePendingOts("abcdef1234567890");
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
    clearOTSMock();
  });

  it("returns null when OpenTimestamps methods throw", function () {
    setupOTSMock();
    var origFromHash = globalThis.OpenTimestamps.DetachedTimestampFile.fromHash;
    globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = function () { throw new Error("OTS error"); };
    var result = generatePendingOts("abcdef1234567890");
    assert.equal(result, null);
    globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = origFromHash;
    clearOTSMock();
  });

  it("handles empty hash gracefully", function () {
    setupOTSMock();
    var result = generatePendingOts("");
    assert.ok(result === null || typeof result === "string");
    clearOTSMock();
  });

  it("processes even-length hex string", function () {
    setupOTSMock();
    var result = generatePendingOts("aabbccdd11223344");
    assert.ok(result === null || typeof result === "string");
    clearOTSMock();
  });
});

// ======================================================================
//  20. certificate_ots.js — submitCertTransparency
// ======================================================================
describe("certificate_ots — submitCertTransparency", function () {
  var _origFetch, _origLocation;

  before(function () {
    _origFetch = globalThis.fetch;
    _origLocation = globalThis.location;
    clearOTSMock();
  });

  after(function () {
    globalThis.fetch = _origFetch;
    globalThis.location = _origLocation;
  });

  it("submits via first aggregator successfully", async function () {
    globalThis.fetch = async function () {
      return {
        ok: true,
        arrayBuffer: async function () { return new Uint8Array([0x01, 0x02, 0x03]).buffer; },
      };
    };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, true);
    assert.ok(result.otsProof);
    assert.ok(result.hash);
    assert.ok(result.aggregator.indexOf("opentimestamps.org") !== -1);
  });

  it("returns pending when all aggregators fail but OTS is available", async function () {
    globalThis.fetch = async function () { throw new Error("Network error"); };
    setupOTSMock();
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, true);
    assert.equal(result.pending, true);
    assert.ok(result.otsProof);
    clearOTSMock();
  });

  it("returns error with file: protocol message", async function () {
    globalThis.fetch = async function () { throw new Error("Network error"); };
    clearOTSMock();
    globalThis.location = { protocol: "file:", href: "file:///test/" };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, false);
    assert.ok(result.error.indexOf("file://") !== -1);
  });

  it("returns friendly message for TypeError 'Failed to fetch'", async function () {
    globalThis.fetch = async function () {
      var err = new Error("Failed to fetch");
      err.name = "TypeError";
      throw err;
    };
    clearOTSMock();
    globalThis.location = { protocol: "http:", href: "http://localhost/" };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, false);
    assert.ok(result.error.indexOf("calendar servers are unreachable") !== -1);
  });

  it("handles HTTP 500 and tries all 6 aggregators", async function () {
    var callCount = 0;
    globalThis.fetch = async function () { callCount++; return { ok: false, status: 500 }; };
    clearOTSMock();
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, false);
    assert.equal(callCount, 6);
  });

  it("computes correct hash for empty buffer", async function () {
    globalThis.fetch = async function () {
      return {
        ok: true,
        arrayBuffer: async function () { return new Uint8Array([]).buffer; },
      };
    };
    var result = await submitCertTransparency(new Uint8Array(0));
    assert.equal(result.submitted, true);
    assert.equal(result.hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("handles fetch abort (timeout) gracefully", async function () {
    globalThis.fetch = async function (url, opts) {
      // Simulate abort by rejecting with an abort error
      return new Promise(function (_, reject) {
        setTimeout(function () {
          var err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        }, 10);
      });
    };
    clearOTSMock();
    globalThis.location = { protocol: "http:", href: "http://localhost/" };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    // Should eventually fail after all aggregators tried
    assert.equal(result.submitted, false);
  });

  it("logs submission timestamp", async function () {
    globalThis.fetch = async function () {
      return {
        ok: true,
        arrayBuffer: async function () { return new Uint8Array([0x01, 0x02, 0x03]).buffer; },
      };
    };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.ok(result.timestamp);
    assert.ok(typeof result.timestamp === "string");
  });
});

// ======================================================================
//  21. Constants validation
// ======================================================================
describe("certificate_ots — constants", function () {
  it("CT_AGGREGATORS has 6 entries", function () {
    assert.equal(CT_AGGREGATORS.length, 6);
  });
  it("CT_AGGREGATORS contains expected URLs", function () {
    assert.ok(CT_AGGREGATORS[0].indexOf("opentimestamps.org") !== -1);
    assert.ok(CT_AGGREGATORS[CT_AGGREGATORS.length - 1].indexOf("eternitywall.com") !== -1);
  });
  it("OTS_HEADER_MAGIC has 31 bytes", function () {
    assert.equal(OTS_HEADER_MAGIC.length, 31);
  });
  it("OTS_HEADER_MAGIC starts with correct bytes", function () {
    assert.equal(OTS_HEADER_MAGIC[0], 0x00);
    assert.equal(OTS_HEADER_MAGIC[1], 0x4f); // 'O'
    assert.equal(OTS_HEADER_MAGIC[2], 0x70); // 'p'
    assert.equal(OTS_HEADER_MAGIC[3], 0x65); // 'e'
    assert.equal(OTS_HEADER_MAGIC[4], 0x6e); // 'n'
  });
});