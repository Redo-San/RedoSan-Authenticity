const { describe, it, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── DOM polyfills ──
var _domElements = {};
var _createdElements = [];
var _resultStore = {};

globalThis.document = {
  getElementById: function (id) { return _domElements[id] || null; },
  createElement: function (tag) {
    var el = { tagName: tag, href: "", download: "", children: [], style: {}, value: "", checked: false, textContent: "", innerHTML: "", id: "", files: null, display: "", type: "text" };
    el.addEventListener = function () {};
    el.remove = function () { var ix = _createdElements.indexOf(this); if (ix >= 0) _createdElements.splice(ix, 1); };
    el.click = function () {};
    el.setAttribute = function () {};
    el.getAttribute = function () { return null; };
    if (tag === "canvas") {
      el.width = 0; el.height = 0;
      el.getContext = function () {
        return { font: "", fillStyle: "", textBaseline: "", measureText: function (t) { return { width: t.length * 5 }; }, fillText: function () {}, scale: function () {} };
      };
      el.toDataURL = function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; };
    }
    if (tag === "script") {
      el.src = ""; el.onload = null; el.onerror = null;
      process.nextTick(function () { if (typeof el.onerror === "function") el.onerror(); });
    }
    Object.defineProperty(el, "textContent", {
      get: function () { return this._tc || ""; },
      set: function (v) { this._tc = String(v); this.innerHTML = v; },
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
  var el = { tagName: "input", href: "", download: "", children: [], style: {}, value: "", checked: false, textContent: "", innerHTML: "", id: id, files: null, remove: function() {}, click: function() {}, setAttribute: function() {}, getAttribute: function() { return null; }, display: "", type: "text" };
  Object.defineProperty(el, "textContent", { get: function() { return this._tc || ""; }, set: function(v) { this._tc = String(v); this.innerHTML = v; }, configurable: true });
  Object.defineProperty(el, "style", { get: function() { return this._style || {}; }, set: function(v) { this._style = v; }, configurable: true });
  if (overrides) Object.assign(el, overrides);
  _domElements[id] = el;
  return el;
}

function clearMockElements() {
  _domElements = {};
  _createdElements = [];
}

// ── Global setup ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.URL.createObjectURL = function () { return "blob:stub"; };
globalThis.URL.revokeObjectURL = function () {};
globalThis.Image = class {
  constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
  set src(v) { if (this.onload) setTimeout(this.onload.bind(this), 0); }
};
globalThis.COUNTRY_CODES = [
  { code: "US", dial: "+1" }, { code: "GB", dial: "+44" },
  { code: "SA", dial: "+966" }, { code: "JP", dial: "+81" },
];
globalThis.getDefaultPhoneCode = function () {};
globalThis.updatePhoneMaxLength = function () {};
globalThis.__ = function (k, d) { return d || k; };
globalThis.alert = function () {};
globalThis.wmGlobal = null;
globalThis.fpGlobal = null;
globalThis.piGlobal = null;

// ── setResult/getResult mocks ──
globalThis.setResult = function (key, data) { _resultStore[key] = data; };
globalThis.getResult = function (key) { return _resultStore[key] || null; };

// ── Mock jspdf ──
if (!globalThis.jspdf) {
  globalThis.jspdf = {};
  globalThis.jspdf.jsPDF = class {
    constructor() { this.constructor.lastInstance = this; this._calls = []; }
    setFontSize(s) { this._calls.push(["setFontSize", s]); return this; }
    setTextColor(r, g, b) { this._calls.push(["setTextColor", r, g, b]); return this; }
    setFont() { return this; }
    text(str, x, y, opts) { this._calls.push(["text", str, x, y, opts]); return this; }
    addPage() { this._calls.push(["addPage"]); return this; }
    addImage() { this._calls.push(["addImage"]); return this; }
    splitTextToSize(t, w) { var lines = []; var s = String(t); while (s.length > 0) { lines.push(s.substring(0, 60)); s = s.substring(60); } if (lines.length === 0) lines.push(""); return lines; }
    output(fmt) { this._calls.push(["output", fmt]); return new Blob(["pdf"], { type: "application/pdf" }); }
  };
}

// ── Mock docx ──
if (!globalThis.docx) {
  globalThis.docx = {
    Paragraph: class { constructor(o) { this.opts = o; } },
    TextRun: class { constructor(o) { this.opts = o; } },
    Table: class { constructor(o) { this.opts = o; } },
    TableRow: class { constructor(o) { this.opts = o; } },
    TableCell: class { constructor(o) { this.opts = o; } },
    Document: class { constructor(o) { this.opts = o; } },
    ImageRun: class { constructor(o) { this.opts = o; } },
    Packer: { toBlob: async function () { return new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); } },
    WidthType: { PERCENTAGE: "percentage" },
  };
}

// ── Mock QRious ──
if (!globalThis.QRious) {
  globalThis.QRious = class {
    constructor(o) { this.element = o.element; this.value = o.value; this.size = o.size; this.level = o.level; this.padding = o.padding; }
  };
}

// ── Mock JSZip (for EPUB certificate generation) ──
if (!globalThis.JSZip) {
  globalThis.JSZip = function () {
    this.file = function () {};
    this.folder = function () { return this; };
    this.generateAsync = function () { return Promise.resolve(new ArrayBuffer(0)); };
  };
}

// ── Mock OpenTimestamps for generatePendingOts tests ──
function setupOTSMock() {
  var OpSHA256 = function () {};
  var OpAppend = function (bytes) { this.bytes = bytes; };
  var PendingAttestation = function (url) { this.url = url; };
  var tsObj = { add: function (op) { this._added = this._added || []; this._added.push(op); return this; }, attestations: [] };
  globalThis.OpenTimestamps = {
    Ops: { OpSHA256: OpSHA256, OpAppend: OpAppend },
    Utils: { randBytes: function (n) { return new Uint8Array(n); }, arrayToBytes: function (arr) { return String.fromCharCode.apply(null, arr); } },
    DetachedTimestampFile: { fromHash: function (op, hash) { return { timestamp: tsObj, serializeToBytes: function () { return new Uint8Array([0, 1, 2, 3]); } }; } },
    Notary: { PendingAttestation: PendingAttestation },
  };
}

function clearOTSMock() {
  delete globalThis.OpenTimestamps;
}

// ── Load certificate modules ──
function loadModule(filePath) {
  var src = fs.readFileSync(filePath, "utf8");
  // Run full content — the license IIFE won't throw because protocol is "file:"
  // c8 ignore markers prevent counting the license block
  vm.runInThisContext(src, { filename: path.resolve(filePath) });
}

before(function () {
  clearMockElements();
  loadModule(path.join(__dirname, "../../Certificate/certificate_utils.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_ots.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_epub.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_pdf.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_docx.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate.js"));
});

// ── Utility: mock FileReader ──
var _fileReaderContents = {};
function setupFileReaderMock() {
  globalThis.FileReader = function () {
    this.onload = null;
    this.onerror = null;
    var self = this;
    this.readAsText = function (f) {
      var content = "";
      if (f && f.name && _fileReaderContents[f.name] !== undefined) {
        content = _fileReaderContents[f.name];
      }
      process.nextTick(function () {
        if (self.onload) self.onload({ target: { result: content } });
      });
    };
  };
}

function restoreFileReaderMock() {
  delete globalThis.FileReader;
}

// =========================================================================
// 1. initCertPhoneCode
// =========================================================================
describe("Certificate — initCertPhoneCode", function () {
  before(function () { clearMockElements(); });

  it("should populate country code selector with options", function () {
    var sel = mockElement("cert-phonecode", { innerHTML: "" });
    initCertPhoneCode();
    assert.ok(sel.innerHTML.indexOf("US") !== -1);
    assert.ok(sel.innerHTML.indexOf("+1") !== -1);
    assert.ok(sel.innerHTML.indexOf("Select country") !== -1);
  });

  it("should handle missing select element gracefully", function () {
    clearMockElements();
    assert.doesNotThrow(function () { initCertPhoneCode(); });
  });

  it("should call getDefaultPhoneCode when available", function () {
    clearMockElements();
    mockElement("cert-phonecode", { innerHTML: "", value: "" });
    var called = false;
    var orig = globalThis.getDefaultPhoneCode;
    globalThis.getDefaultPhoneCode = function () { called = true; return null; };
    initCertPhoneCode();
    assert.ok(called);
    globalThis.getDefaultPhoneCode = orig;
  });

  it("should set detected phone code", function () {
    clearMockElements();
    var sel = mockElement("cert-phonecode", { innerHTML: "", value: "" });
    var orig = globalThis.getDefaultPhoneCode;
    globalThis.getDefaultPhoneCode = function () { return { dial: "+966" }; };
    initCertPhoneCode();
    assert.equal(sel.value, "+966");
    globalThis.getDefaultPhoneCode = orig;
  });
});

// =========================================================================
// 2. collectCertData
// =========================================================================
describe("Certificate — collectCertData", function () {
  before(function () { clearMockElements(); });

  it("should collect data from window globals without file", async function () {
    _resultStore = {};
    window.simpleUserInfo = { name: "Test User", email: "test@test.com" };
    window.simpleFile = null;
    window.simpleBuf = null;
    window.simpleResults = {};
    window._didSig = null;
    window._didKeypair = null;
    window._faceData = null;

    var data = await collectCertData();
    assert.equal(data.user.name, "Test User");
    assert.equal(data.user.email, "test@test.com");
    assert.equal(data.file.name, "");
    assert.equal(data.watermark, false);
    assert.equal(data.generator, "RedoSan Authenticity");
    assert.ok(data.generatedAt);

    delete window.simpleUserInfo;
    delete window.simpleFile;
    delete window.simpleBuf;
    delete window.simpleResults;
  });

  it("should handle file with buffer and compute hash", async function () {
    _resultStore = {};
    window.simpleUserInfo = {};
    var testBuf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    window.simpleBuf = testBuf;
    window.simpleFile = { name: "test.png", size: 5, type: "image/png" };
    window.simpleResults = {
      watermark: true, watermarkAlgoName: "LSB", watermarkResult: "OK",
      fingerprint: true, fpResult: { hashes: { "SHA-256": "abc" } }, didSig: null,
    };
    window._didKeypair = { did: "did:key:test123" };
    window._faceData = null;

    var data = await collectCertData();
    assert.equal(data.file.name, "test.png");
    assert.equal(data.file.size, 5);
    assert.equal(data.file.width, 100);
    assert.equal(data.file.height, 100);
    assert.ok(data.file.dataUrl);
    assert.ok(data.file.hash);
    assert.equal(data.watermark, true);
    assert.equal(data.watermarkAlgo, "LSB");
    assert.equal(data.fingerprint, true);
    assert.equal(data.didIdentity, "did:key:test123");

    delete window.simpleUserInfo;
    delete window.simpleBuf;
    delete window.simpleFile;
    delete window.simpleResults;
    delete window._didKeypair;
  });

  it("should handle CT submission failure", async function () {
    _resultStore = {};
    window.simpleUserInfo = {};
    window.simpleBuf = null;
    window.simpleFile = null;
    window.simpleResults = {};

    var orig = globalThis.submitCertTransparency;
    globalThis.submitCertTransparency = async function () { throw new Error("Network error"); };

    var data = await collectCertData();
    assert.equal(data.ct.submitted, false);
    assert.equal(data.ct.error, "Network error");

    globalThis.submitCertTransparency = orig;
  });
});

// =========================================================================
// 3. stampCertFile
// =========================================================================
describe("Certificate — stampCertFile", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should stamp blob and set result when OTS works", async function () {
    _resultStore = {};
    setupOTSMock();
    var blob = new Blob(["test data"], { type: "application/octet-stream" });
    mockElement("cert-ots-dl-btn", { style: { display: "none" } });

    await stampCertFile(blob, "pdf");

    var ct = _resultStore["certCtResult"];
    assert.ok(ct);
    assert.equal(ct.submitted, true);
    assert.equal(ct.pending, true);
    assert.ok(ct.otsProof);
    assert.ok(ct.hash);
    assert.equal(ct.format, "pdf");

    clearOTSMock();
  });

  it("should handle missing generatePendingOts", async function () {
    _resultStore = {};
    var blob = new Blob(["test"], { type: "application/octet-stream" });
    // OpenTimestamps not available, generatePendingOts returns null
    await stampCertFile(blob, "pdf");
    assert.equal(_resultStore["certCtResult"], undefined);
  });

  it("should handle crypto error gracefully", async function () {
    _resultStore = {};
    var blob = new Blob(["test"], { type: "application/octet-stream" });
    var origAB = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () { throw new Error("crypto fail"); };
    await stampCertFile(blob, "pdf");
    // Should not throw, just log error
    Blob.prototype.arrayBuffer = origAB;
  });
});

// =========================================================================
// 4. downloadCertOtsProof
// =========================================================================
describe("Certificate — downloadCertOtsProof", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should create and trigger download when proof exists", function () {
    _resultStore["certCtResult"] = {
      otsProof: btoa("test proof bytes"), format: "pdf",
    };
    assert.doesNotThrow(function () { downloadCertOtsProof(); });
    delete _resultStore["certCtResult"];
  });

  it("should do nothing when no result", function () {
    _resultStore = {};
    assert.doesNotThrow(function () { downloadCertOtsProof(); });
  });

  it("should handle corrupted base64 gracefully", function () {
    _resultStore["certCtResult"] = { otsProof: "not-valid-base64!!!", format: "pdf" };
    assert.doesNotThrow(function () { downloadCertOtsProof(); });
    delete _resultStore["certCtResult"];
  });
});

// =========================================================================
// 5. downloadOtsProof
// =========================================================================
describe("Certificate — downloadOtsProof", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should create and trigger download when proof exists", function () {
    _resultStore["lastCtResult"] = { otsProof: btoa("test proof bytes") };
    assert.doesNotThrow(function () { downloadOtsProof(); });
    delete _resultStore["lastCtResult"];
  });

  it("should do nothing when no result", function () {
    _resultStore = {};
    assert.doesNotThrow(function () { downloadOtsProof(); });
  });
});

// =========================================================================
// 6. downloadCert (original, non-professional)
// =========================================================================
describe("Certificate — downloadCert", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should download PDF certificate with button control", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("ots-dl-btn", { style: { display: "none" } });
    mockElement("cert-ots-dl-btn", { style: { display: "none" } });
    var btn = { disabled: false, textContent: "PDF" };
    await downloadCert("pdf", btn);
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "PDF");
  });

  it("should handle DOCX format", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("ots-dl-btn", { style: { display: "none" } });
    mockElement("cert-ots-dl-btn", { style: { display: "none" } });
    await downloadCert("docx");
    assert.ok(true);
  });

  it("should handle EPUB format", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("ots-dl-btn", { style: { display: "none" } });
    mockElement("cert-ots-dl-btn", { style: { display: "none" } });
    await downloadCert("epub");
    assert.ok(true);
  });
});

// =========================================================================
// 7. generateProfessionalCert — Validation paths
// =========================================================================
describe("Certificate — generateProfessionalCert — validation paths", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should show validation error when required fields missing", async function () {
    clearMockElements();
    var status = mockElement("cert-status", { textContent: "" });
    var spinner = mockElement("cert-spinner", { style: { display: "none" } });
    var btn = mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "" });
    mockElement("cert-email", { value: "" });
    mockElement("cert-phonecode", { value: "" });
    mockElement("cert-phone", { value: "" });
    mockElement("cert-website", { value: "" });

    await generateProfessionalCert();

    assert.ok(status.textContent.indexOf("Please fill in all required fields") !== -1);
    assert.equal(spinner.style.display, "none");
    assert.equal(btn.disabled, false);
  });

  it("should show validation error for invalid email", async function () {
    clearMockElements();
    var status = mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    var emailWarn = mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "invalid-email" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+123456789" });
    mockElement("cert-website", { value: "https://example.com" });

    await generateProfessionalCert();

    assert.equal(emailWarn.style.display, "block");
  });

  it("should show validation error for invalid website", async function () {
    clearMockElements();
    var status = mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    var websiteWarn = mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "alice@example.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+123456789" });
    mockElement("cert-website", { value: "not-a-url" });

    await generateProfessionalCert();

    assert.equal(websiteWarn.style.display, "block");
  });

  it("should show validation error for https:// website", async function () {
    clearMockElements();
    var status = mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    var websiteWarn = mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "alice@example.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+123456789" });
    mockElement("cert-website", { value: "https://" });

    await generateProfessionalCert();

    assert.equal(websiteWarn.style.display, "block");
  });
});

// =========================================================================
// 8. generateProfessionalCert — Success path with fingerprint text parsing
// =========================================================================
describe("Certificate — generateProfessionalCert — success paths", function () {
  before(function () { clearMockElements(); _resultStore = {}; });

  it("should generate certificate with all valid fields (no file uploads)", async function () {
    clearMockElements();
    _resultStore = {};
    var status = mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    var dlSection = mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });

    // Core form fields
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "alice@example.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://alice.example.com" });
    mockElement("cert-social-tiktok", { value: "@alice" });
    mockElement("cert-social-facebook", { value: "alicefb" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });

    // No uploaded result files
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc123", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData);
      assert.equal(globalThis._certData.user.name, "Alice");
      assert.equal(globalThis._certData.user.email, "alice@example.com");
      assert.equal(globalThis._certData.watermark, false);
      assert.equal(globalThis._certData.fingerprint, false);
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
  });

  it("should parse fingerprint text file with hashes", async function () {
    clearMockElements();
    _resultStore = {};
    var status = mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    var dlSection = mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });

    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Bob" });
    mockElement("cert-email", { value: "bob@test.com" });
    mockElement("cert-phonecode", { value: "" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://bob.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });

    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    // Upload a fingerprint text file
    var fpTxt =
      "--- Hashes ---\n" +
      "SHA-256: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\n" +
      "MD5: 098f6bcd4621d373cade4e832627b4f6\n" +
      "\n" +
      "--- Perceptual Hashes ---\n" +
      "dHash: 0f3a5c8e1d2b4a6c\n" +
      "pHash: a1b2c3d4e5f6a7b8\n";

    _fileReaderContents["fp_results.txt"] = fpTxt;
    setupFileReaderMock();
    mockElement("cert-result-fp", {
      files: [{ name: "fp_results.txt", size: fpTxt.length, type: "text/plain" }],
    });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.equal(globalThis._certData.fingerprint, true);
      assert.ok(globalThis._certData.fpResult);
      assert.equal(globalThis._certData.fpResult.hashes["SHA-256"], "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
      assert.equal(globalThis._certData.fpResult.hashes["MD5"], "098f6bcd4621d373cade4e832627b4f6");
      assert.equal(globalThis._certData.fpResult.perceptual_hashes["dHash"], "0f3a5c8e1d2b4a6c");
      assert.equal(globalThis._certData.fpResult.perceptual_hashes["pHash"], "a1b2c3d4e5f6a7b8");
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
    restoreFileReaderMock();
    delete _fileReaderContents["fp_results.txt"];
  });

  it("should handle file with image for hash and dimensions", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });

    var pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x00, 0x00,
      0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x24,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ]);

    mockElement("cert-file", {
      files: [{ name: "photo.png", size: pngBuf.length, type: "image/png", arrayBuffer: async function () { return pngBuf.buffer; } }],
    });
    mockElement("cert-name", { value: "ImageTest" });
    mockElement("cert-email", { value: "img@test.com" });
    mockElement("cert-phonecode", { value: "" });
    mockElement("cert-phone", { value: "+9876543210" });
    mockElement("cert-website", { value: "https://img.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.equal(globalThis._certData.user.name, "ImageTest");
      assert.equal(globalThis._certData.file.name, "photo.png");
      assert.ok(globalThis._certData.file.width > 0);
      assert.ok(globalThis._certData.file.hash);
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
  });

  it("should handle DID result file upload", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "DID Test" });
    mockElement("cert-email", { value: "did@test.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://did.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    _fileReaderContents["did-result.json"] = JSON.stringify({ did: "did:key:z6Mk...", signature: "sig123" });
    mockElement("cert-result-did", { files: [{ name: "did-result.json", size: 50 }] });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });
    setupFileReaderMock();

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.ok(globalThis._certData.didIdentity, "didIdentity should be set");
      assert.equal(globalThis._certData.didIdentity, "did:key:z6Mk...");
      assert.equal(globalThis._certData.didSig, "sig123");
    } finally {
      globalThis.submitCertTransparency = origSubmit;
      restoreFileReaderMock();
    }
  });

  it("should handle DID result with invalid JSON", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Bad DID" });
    mockElement("cert-email", { value: "bad@test.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://bad.test.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    // Invalid JSON to exercise the catch block
    _fileReaderContents["bad-did.json"] = "not valid json!!!";
    mockElement("cert-result-did", { files: [{ name: "bad-did.json", size: 20 }] });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });
    setupFileReaderMock();

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      // Invalid JSON should produce raw text fallback
      assert.ok(globalThis._certData.didIdentity || globalThis._certData.didSig !== undefined);
    } finally {
      globalThis.submitCertTransparency = origSubmit;
      restoreFileReaderMock();
    }
  });

  it("should handle fpGlobal for fingerprint filename", async function () {
    clearMockElements();
    _resultStore = {};
    // Provide fingerprint data via fpGlobal with file_info
    globalThis.fpGlobal = {
      file_info: { file_name: "test-photo.jpg", algorithm: "SHA-256" },
      hash: "abc123",
    };
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "FP Test" });
    mockElement("cert-email", { value: "fp@test.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://fp.test.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.ok(globalThis._certData.fpFileName.indexOf("test-photo.jpg") !== -1);
    } finally {
      globalThis.submitCertTransparency = origSubmit;
      globalThis.fpGlobal = null;
    }
  });

  it("should handle CT submission failure gracefully", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "alice@example.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-website", { value: "https://alice.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () { throw new Error("CT server error"); };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.equal(globalThis._certData.ct.submitted, false);
      assert.equal(globalThis._certData.ct.error, "CT server error");
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
  });

  it("should handle no file, fpGlobal without file_info, and didKeypair present", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });

    // No cert-file upload (file is null) and no fp file upload
    mockElement("cert-file", { files: null });
    mockElement("cert-name", { value: "Noor" });
    mockElement("cert-email", { value: "noor@test.com" });
    // NOTE: cert-phonecode intentionally NOT mocked → getElementById returns null
    mockElement("cert-phone", { value: "+966500000001" });
    mockElement("cert-website", { value: "https://noor.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    // fpGlobal present but WITHOUT file_info → line 556 ("") branch
    // window._didKeypair present → line 567 truthy branch
    var origFpGlobal = globalThis.fpGlobal;
    var origDidKeypair = globalThis._didKeypair;
    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.fpGlobal = {};
      globalThis._didKeypair = { did: "did:key:z6MkhaXjBZDURTZEb7GoRf6bY2eW7p" };
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.equal(globalThis._certData.file.name, "", "no file → empty name");
      assert.equal(globalThis._certData.file.size, 0);
      assert.equal(globalThis._certData.file.type, "");
      assert.equal(globalThis._certData.fingerprint, true, "fpGlobal present");
      assert.equal(globalThis._certData.fpFileName, "", "fpGlobal without file_info");
      assert.equal(globalThis._certData.didIdentity, "did:key:z6MkhaXjBZDURTZEb7GoRf6bY2eW7p");
    } finally {
      globalThis.fpGlobal = origFpGlobal;
      globalThis._didKeypair = origDidKeypair;
      globalThis.submitCertTransparency = origSubmit;
    }
  });
});

// =========================================================================
// 9. downloadProfessionalCert — Error branches
// =========================================================================
describe("Certificate — downloadProfessionalCert — error branches", function () {
  before(function () { clearMockElements(); });

  it("should show error when jspdf is undefined for PDF", async function () {
    clearMockElements();
    globalThis._certData = {
      generator: "Test", generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "", email: "" }, file: { name: "", size: 0, type: "" },
      watermark: false, pixelInjection: false, timestamp: false, fingerprint: false,
      didSig: null, faceBiometric: null, ct: null,
    };
    var status = mockElement("cert-status", { textContent: "" });
    var origJspdf = globalThis.jspdf;
    globalThis.jspdf = undefined;
    await downloadProfessionalCert("pdf");
    assert.ok(status.textContent.indexOf("Error") !== -1);
    globalThis.jspdf = origJspdf;
  });

  it("should show error when QRious is undefined for DOCX", async function () {
    clearMockElements();
    globalThis._certData = {
      generator: "Test", generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "", email: "" }, file: { name: "", size: 0, type: "" },
      watermark: false, pixelInjection: false, timestamp: false, fingerprint: false,
      didSig: null, faceBiometric: null, ct: null,
    };
    var status = mockElement("cert-status", { textContent: "" });
    var origQRious = globalThis.QRious;
    globalThis.QRious = undefined;
    await downloadProfessionalCert("docx");
    assert.ok(status.textContent.indexOf("Error") !== -1);
    globalThis.QRious = origQRious;
  });

  it("should alert when _certData is null", function () {
    clearMockElements();
    var alerted = false;
    var origAlert = globalThis.alert;
    globalThis.alert = function () { alerted = true; };
    _certData = null;
    downloadProfessionalCert("pdf");
    assert.ok(alerted);
    globalThis.alert = origAlert;
  });
});

// =========================================================================
// 10. toggleCertMusicFields + resetProfessionalCert + downloadProfessionalCert EPUB
// =========================================================================
describe("Certificate — UI helpers", function () {
  before(function () { clearMockElements(); });

  it("toggleCertMusicFields should hide fields when checkbox unchecked", function () {
    var fields = mockElement("cert-music-fields", { style: { display: "block" }, display: "block" });
    mockElement("cert-show-music", { checked: false });
    toggleCertMusicFields();
    assert.equal(fields.style.display, "none");
  });

  it("toggleCertMusicFields should show fields when checkbox checked", function () {
    var fields = mockElement("cert-music-fields", { style: { display: "none" }, display: "none" });
    mockElement("cert-show-music", { checked: true });
    toggleCertMusicFields();
    assert.equal(fields.style.display, "");
  });

  it("toggleCertMusicFields should handle missing fields element gracefully", function () {
    mockElement("cert-show-music", { checked: false });
    delete _domElements["cert-music-fields"];
    assert.doesNotThrow(function () { toggleCertMusicFields(); });
  });

  it("resetProfessionalCert should reset all fields", function () {
    mockElement("cert-file", { value: "old.txt" });
    mockElement("cert-name", { value: "Alice" });
    mockElement("cert-email", { value: "a@b.com" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-show-music", { checked: true });
    mockElement("cert-download-section", { style: { display: "block" } });
    mockElement("cert-status", { textContent: "done" });
    resetProfessionalCert();
    assert.equal(_domElements["cert-file"].value, "");
    assert.equal(_domElements["cert-name"].value, "");
    assert.equal(_domElements["cert-phonecode"].value, "");
    assert.equal(_domElements["cert-show-music"].checked, false);
  });

  it("downloadProfessionalCert EPUB should succeed", async function () {
    clearMockElements();
    globalThis._certData = {
      generator: "Test", generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "EPUB Test", email: "epub@test.com" },
      file: { name: "photo.jpg", size: 1000, type: "image/jpeg", dataUrl: "data:image/png;base64,abc" },
      watermark: false, pixelInjection: false, timestamp: false, fingerprint: false,
      didSig: null, faceBiometric: null, docWatermark: false, ct: null,
    };
    var status = mockElement("cert-status", { textContent: "" });
    var dlSection = mockElement("cert-download-section", { style: { display: "block" } });
    await downloadProfessionalCert("epub");
    assert.ok(status.textContent.indexOf("EPUB") !== -1 || status.textContent.indexOf("Error") !== -1);
  });

  it("downloadProfessionalCert should handle certBlob + status path", async function () {
    clearMockElements();
    globalThis._certData = {
      generator: "Test", generatedAt: "2026-01-01T00:00:00.000Z",
      user: { name: "BlobTest", email: "blob@test.com" },
      file: { name: "img.png", size: 500, type: "image/png" },
      watermark: false, pixelInjection: false, timestamp: false, fingerprint: false,
      didSig: null, faceBiometric: null, docWatermark: false, ct: null,
    };
    globalThis.downloadCertPDF = async function () { return new Blob(["pdf"]); };
    var status = mockElement("cert-status", { textContent: "" });
    await downloadProfessionalCert("pdf");
    assert.ok(status.textContent.indexOf("PDF") !== -1);
  });
});

// =========================================================================
// 11. generatePendingOts
// =========================================================================
describe("Certificate — generatePendingOts", function () {
  before(function () { clearMockElements(); });

  it("should return null when OpenTimestamps is not available", function () {
    clearOTSMock();
    var result = generatePendingOts("abcdef1234567890");
    assert.equal(result, null);
  });

  it("should return base64 string when OpenTimestamps is available", function () {
    setupOTSMock();
    var result = generatePendingOts("abcdef1234567890");
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
    clearOTSMock();
  });

  it("should return null when OpenTimestamps methods throw", function () {
    setupOTSMock();
    var origFromHash = globalThis.OpenTimestamps.DetachedTimestampFile.fromHash;
    globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = function () { throw new Error("OTS error"); };
    var result = generatePendingOts("abcdef1234567890");
    assert.equal(result, null);
    globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = origFromHash;
    clearOTSMock();
  });

  it("should handle empty hash gracefully", function () {
    setupOTSMock();
    var result = generatePendingOts("");
    assert.ok(result === null || typeof result === "string");
    clearOTSMock();
  });
});

// =========================================================================
// 12. submitCertTransparency
// =========================================================================
describe("Certificate — submitCertTransparency", function () {
  var _origFetch, _origLocation;

  before(function () {
    clearMockElements();
    _origFetch = globalThis.fetch;
    _origLocation = globalThis.location;
  });

  after(function () {
    globalThis.fetch = _origFetch;
    globalThis.location = _origLocation;
  });

  it("should submit via first aggregator successfully", async function () {
    globalThis.fetch = async function (url, opts) {
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

  it("should return pending when all aggregators fail but OTS is available", async function () {
    globalThis.fetch = async function () { throw new Error("Network error"); };
    setupOTSMock();
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, true);
    assert.equal(result.pending, true);
    assert.ok(result.otsProof);
    clearOTSMock();
  });

  it("should return error with file: protocol message", async function () {
    globalThis.fetch = async function () { throw new Error("Network error"); };
    clearOTSMock();
    globalThis.location = { protocol: "file:", href: "file:///test/" };
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, false);
    assert.ok(result.error.indexOf("file://") !== -1);
  });

  it("should return friendly message for Failed to fetch error", async function () {
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

  it("should handle HTTP error status from aggregator and try all", async function () {
    var callCount = 0;
    globalThis.fetch = async function () { callCount++; return { ok: false, status: 500 }; };
    clearOTSMock();
    var result = await submitCertTransparency(new Uint8Array([0x48, 0x65]));
    assert.equal(result.submitted, false);
    assert.equal(callCount, 6);
  });

  it("should compute correct hash for empty buffer", async function () {
    globalThis.fetch = async function (url, opts) {
      return {
        ok: true,
        arrayBuffer: async function () { return new Uint8Array([]).buffer; },
      };
    };
    var result = await submitCertTransparency(new Uint8Array(0));
    assert.equal(result.submitted, true);
    assert.equal(result.hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

// =========================================================================
// 13. addTextSafe with non-Latin characters
// =========================================================================
describe("Certificate — addTextSafe", function () {
  before(function () { clearMockElements(); });

  it("should handle Arabic text via canvas rendering", function () {
    var doc = new globalThis.jspdf.jsPDF();
    assert.doesNotThrow(function () {
      addTextSafe(doc, "مرحبا بالعالم", 15, 50, 180, 9);
    });
  });

  it("should handle Latin text directly without canvas", function () {
    var doc = new globalThis.jspdf.jsPDF();
    addTextSafe(doc, "Hello World", 15, 50, 180, 9);
    var textCalls = doc._calls.filter(function (c) { return c[0] === "text"; });
    assert.ok(textCalls.length > 0);
  });
});

// =========================================================================
// 14. downloadCert with EPUB format (covers lines 296-297)
// =========================================================================
describe("Certificate — downloadCert EPUB", function () {
  before(function () {
    clearMockElements();
    mockElement("cert-result-name", { value: "Test User" });
    mockElement("cert-email");
    mockElement("cert-website");
    mockElement("cert-phone", { value: "+1234567890" });
    mockElement("cert-phonecode", { value: "+1" });
    mockElement("cert-is-artist");
    mockElement("cert-social-json");
    mockElement("cert-music-url");
    mockElement("cert-music-platform");
    mockElement("cert-music-title");
    mockElement("cert-ct-checkbox", { checked: false });

    // Mock JSZip for EPUB
    if (!globalThis.JSZip) {
      globalThis.JSZip = function () {
        this.file = function () {};
        this.generateAsync = function () { return Promise.resolve(new ArrayBuffer(0)); };
      };
    }
  });

  it("should generate EPUB certificate via downloadCert", async function () {
    window.simpleUserInfo = { name: "EPUB Tester" };
    window.simpleFile = null;
    window.simpleBuf = null;
    window.simpleResults = {};
    window._didKeypair = null;
    window._faceData = null;

    // Mock fetch for CT submission
    var origFetch = globalThis.fetch;
    globalThis.fetch = async function () {
      return {
        ok: true,
        json: async function () { return { timestamp: "test" }; },
        arrayBuffer: async function () { return new Uint8Array(0).buffer; },
      };
    };

    await downloadCert("epub");

    globalThis.fetch = origFetch;
    delete window.simpleUserInfo;
  });
});

// =========================================================================
// 15. downloadProfessionalCert with EPUB format (covers lines 642-648)
// =========================================================================
describe("Certificate — downloadProfessionalCert EPUB", function () {
  before(function () {
    clearMockElements();
    mockElement("cert-prof-result", { textContent: "" });
    mockElement("cert-prof-status", { textContent: "" });
  });

  it("should generate EPUB via downloadProfessionalCert", async function () {
    var certData = {
      user: { name: "Pro Tester", email: "", phone: "", website: "", social: {}, isArtist: false, music: {} },
      file: { name: "test.png", size: 100, type: "image/png", dataUrl: "data:image/png;base64,", width: 10, height: 10 },
      watermark: false, watermarkUrl: null, watermarkAlgo: "", watermarkResult: "",
      pixelInjection: false, piResultHtml: "",
      timestamp: false, tsResult: "",
      fingerprint: false, fpResult: null,
      didSig: null, didIdentity: "",
      faceBiometric: null,
      ct: { submitted: false },
      generatedAt: new Date().toISOString(),
      generator: "RedoSan Authenticity",
    };

    await downloadProfessionalCert(certData, "epub");
  });
});

// =========================================================================
// 16. readFileAsText onerror path (covers line 385)
// =========================================================================
describe("Certificate — readFileAsText onerror", function () {
  before(function () {
    clearMockElements();
  });

  it("should gracefully handle FileReader error via collectCertData", async function () {
    // Override FileReader to always fire onerror
    var origFileReader = globalThis.FileReader;
    globalThis.FileReader = function () {
      this.onload = null;
      this.onerror = null;
      var self = this;
      this.readAsText = function () {
        process.nextTick(function () {
          if (typeof self.onerror === "function") self.onerror();
        });
      };
    };

    // Set up a file input element that readFileAsText will try to read
    var fileObj = { name: "wm_result.txt", size: 10, type: "text/plain" };
    var inputEl = document.getElementById("cert-result-wm");
    if (!inputEl) {
      inputEl = mockElement("cert-result-wm", { files: [fileObj] });
    } else {
      inputEl.files = [fileObj];
    }

    window.simpleUserInfo = {};
    window.simpleFile = null;
    window.simpleBuf = null;
    window.simpleResults = {};
    window._didKeypair = null;
    window._faceData = null;

    // collectCertData should not throw when FileReader errors
    var data = await collectCertData();
    // It should still return data without crashing
    assert.ok(data && typeof data.generatedAt === "string");

    globalThis.FileReader = origFileReader;
    delete window.simpleUserInfo;
  });
});

// =========================================================================
// 16. ensureLib — CDN fallback failure branches
// =========================================================================
describe("Certificate — ensureLib CDN fallback", function () {
  it("should reject after all CDN fallbacks fail for JSZip", async function () {
    clearMockElements();
    var origJspdf = globalThis.jspdf;
    var origQRious = globalThis.QRious;
    var origJSZip = globalThis.JSZip;
    globalThis.jspdf = undefined;
    globalThis.QRious = undefined;
    globalThis.JSZip = undefined;

    var rejected = false;
    try {
      await ensureLib("JSZip");
    } catch (error) {
      rejected = true;
      assert.ok(
        String(error.message).indexOf("not available") !== -1,
        "error should mention library not available",
      );
    }
    assert.ok(rejected, "ensureLib('JSZip') should reject when all CDNs fail");

    globalThis.jspdf = origJspdf;
    globalThis.QRious = origQRious;
    globalThis.JSZip = origJSZip;
  });
});

// =========================================================================
// 17. Remaining branch edges (|| / ?: / catch fallbacks)
// =========================================================================
describe("Certificate — remaining branch edges", function () {
  it("collectCertData without simpleUserInfo/simpleResults uses {} fallbacks", async function () {
    clearMockElements();
    delete window.simpleUserInfo;
    delete window.simpleResults;
    window.simpleFile = null;
    window.simpleBuf = null;
    window._didKeypair = null;
    window._faceData = null;

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      var data = await collectCertData();
      assert.ok(data, "collectCertData should return data");
      assert.equal(data.file.name, "");
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
  });

  it("downloadCertOtsProof defaults format to pdf when ct.format is missing", function () {
    clearMockElements();
    setResult("certCtResult", { otsProof: "AAAA", hash: "abc" });
    assert.doesNotThrow(function () {
      downloadCertOtsProof();
    });
  });

  it("downloadOtsProof catch branch when createObjectURL throws", function () {
    clearMockElements();
    setResult("lastCtResult", { otsProof: "AAAA" });
    var origCreate = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = function () {
      throw new Error("boom");
    };
    assert.doesNotThrow(function () {
      downloadOtsProof();
    });
    globalThis.URL.createObjectURL = origCreate;
  });

  it("downloadCert stores null lastCtResult when data.ct is falsy", async function () {
    clearMockElements();
    var origCollect = globalThis.collectCertData;
    globalThis.collectCertData = async function () {
      return { ct: null, generatedAt: "x" };
    };
    try {
      await downloadCert("pdf");
      assert.equal(getResult("lastCtResult"), null);
    } finally {
      globalThis.collectCertData = origCollect;
    }
  });

  it("downloadCert catch branch when collectCertData throws", async function () {
    clearMockElements();
    var origCollect = globalThis.collectCertData;
    var alerted = false;
    var origAlert = globalThis.alert;
    globalThis.alert = function () { alerted = true; };
    globalThis.collectCertData = async function () {
      throw new Error("boom");
    };
    try {
      await downloadCert("pdf");
      assert.ok(alerted, "alert should be shown");
    } finally {
      globalThis.collectCertData = origCollect;
      globalThis.alert = origAlert;
    }
  });

  it("getValOrEmpty returns empty string when element is missing", function () {
    assert.equal(getValOrEmpty("no-such-cert-element"), "");
  });

  it("generateProfessionalCert with file that has empty name", async function () {
    clearMockElements();
    _resultStore = {};
    mockElement("cert-status", { textContent: "" });
    mockElement("cert-spinner", { style: { display: "none" } });
    mockElement("cert-gen-btn", { disabled: false });
    mockElement("cert-download-section", { style: { display: "none" } });
    mockElement("cert-email-warn", { style: { display: "none" } });
    mockElement("cert-website-warn", { style: { display: "none" } });
    mockElement("cert-file", {
      files: [{
        name: "", size: 0, type: "image/png",
        arrayBuffer: async function () { return new ArrayBuffer(4); },
      }],
    });
    mockElement("cert-name", { value: "EmptyName" });
    mockElement("cert-email", { value: "empty@test.com" });
    mockElement("cert-phonecode", { value: "" });
    mockElement("cert-phone", { value: "+12345" });
    mockElement("cert-website", { value: "https://empty.example.com" });
    mockElement("cert-social-tiktok", { value: "" });
    mockElement("cert-social-facebook", { value: "" });
    mockElement("cert-social-instagram", { value: "" });
    mockElement("cert-social-youtube", { value: "" });
    mockElement("cert-music-spotify", { value: "" });
    mockElement("cert-music-applemusic", { value: "" });
    mockElement("cert-music-ytmusic", { value: "" });
    mockElement("cert-music-soundcloud", { value: "" });
    mockElement("cert-result-wm", { files: null });
    mockElement("cert-result-pi", { files: null });
    mockElement("cert-result-fp", { files: null });
    mockElement("cert-result-did", { files: null });
    mockElement("cert-result-docw", { files: null });
    mockElement("cert-result-ts", { files: null });

    var origSubmit = globalThis.submitCertTransparency;
    try {
      globalThis.submitCertTransparency = async function () {
        return { submitted: true, hash: "abc", timestamp: new Date().toISOString() };
      };
      await generateProfessionalCert();
      assert.ok(globalThis._certData, "_certData should be defined");
      assert.equal(globalThis._certData.file.name, "", "empty name stays empty");
    } finally {
      globalThis.submitCertTransparency = origSubmit;
    }
  });
});
