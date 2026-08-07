const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.JSZip = require("jszip");

function loadDocwFile(name) {
  const src = fs.readFileSync(path.join(__dirname, "../../Document_Watermark/" + name), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Document_Watermark/" + name) });
}
loadDocwFile("document_watermark_core.js");
loadDocwFile("document_watermark_report.js");
loadDocwFile("document_watermark_pdf.js");
loadDocwFile("document_watermark.js");

// Global mocks needed by UI functions
globalThis.__ = function (key, def) { return def; };
globalThis.closeDownloadModal = function () {};
globalThis.downloadBlobSimple = function () {};
globalThis.setDownloadHandler = function () {};
globalThis.ensureLib = async (name) => {
  if (name === "QRious" && typeof globalThis.QRious === "undefined") {
    throw new Error("QRious unavailable");
  }
};
globalThis.escHtml = function (s) { return s; };
globalThis.URL.createObjectURL = function () { return "blob:test"; };
globalThis.URL.revokeObjectURL = function () {};

describe("Document Watermark UI — _formatFingerprint", () => {
  it("should format a complete fingerprint", () => {
    const parsed = {
      file_info: { file_name: "test.jpg", width: 1920, height: 1080, file_size_bytes: 12345 },
      hashes: { "SHA-256": "abc123" },
      perceptual_hashes: { dHash: "dhashval" },
    };
    const result = _formatFingerprint(parsed);
    assert.ok(result.includes("test.jpg"));
    assert.ok(result.includes("1920x1080"));
    assert.ok(result.includes("12345"));
    assert.ok(result.includes("SHA-256"));
    assert.ok(result.includes("dHash"));
  });

  it("should handle missing perceptual hashes", () => {
    const parsed = {
      file_info: { file_name: "test.jpg" },
      hashes: { MD5: "md5val" },
    };
    const result = _formatFingerprint(parsed);
    assert.ok(result.includes("test.jpg"));
    assert.ok(result.includes("MD5"));
  });

  it("should handle empty object", () => {
    const result = _formatFingerprint({});
    assert.equal(typeof result, "string");
  });

  it("should handle file_info without file_name or file_size", () => {
    const parsed = {
      file_info: { width: 1920, height: 1080 },
      hashes: { "SHA-256": "abc" },
    };
    const result = _formatFingerprint(parsed);
    assert.ok(result.includes("unknown"));
    assert.ok(result.includes("?"));
  });
});

describe("Document Watermark UI — _formatFingerprintShort", () => {
  it("should count hashes", () => {
    const parsed = {
      hashes: { "SHA-256": "a", MD5: "b" },
      perceptual_hashes: { dHash: "c", pHash: "d" },
    };
    const result = _formatFingerprintShort(parsed);
    assert.equal(result, "4 hashes");
  });

  it("should return 0 for empty", () => {
    const result = _formatFingerprintShort({});
    assert.equal(result, "0 hashes");
  });
});

describe("Document Watermark UI — _docwEscXml", () => {
  it('should escape & < > "', () => {
    assert.equal(_docwEscXml('a&b<c>d"e'), "a&amp;b&lt;c&gt;d&quot;e");
  });

  it("should return empty string for empty input", () => {
    assert.equal(_docwEscXml(""), "");
  });

  it("should leave safe strings unchanged", () => {
    assert.equal(_docwEscXml("hello world"), "hello world");
  });
});

describe("Document Watermark UI — _stringToBytes", () => {
  it("should convert string to Uint8Array", () => {
    const bytes = _stringToBytes("ABC");
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(Array.from(bytes), [0x41, 0x42, 0x43]);
  });

  it("should handle empty string", () => {
    const bytes = _stringToBytes("");
    assert.equal(bytes.length, 0);
  });
});

describe("Document Watermark UI — docwToCSV", () => {
  it("should produce CSV output with headers", () => {
    const r = {
      algo: "ZWC",
      message: "hello",
      timestamp: "2024-01-01",
      textLength: 100,
      hash: "abc",
      resultLength: 50,
    };
    const csv = docwToCSV(r);
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes('"ZWC"'));
    assert.ok(csv.includes('"hello"'));
    assert.ok(csv.includes('"100"'));
    assert.ok(csv.includes('"abc"'));
    assert.ok(csv.includes('"50"'));
  });

  it("should escape double quotes in message", () => {
    const r = { algo: "test", message: 'say "hello"', timestamp: "", textLength: 0, hash: "", resultLength: 0 };
    const csv = docwToCSV(r);
    assert.ok(csv.includes('""'));
  });
});

describe("Document Watermark UI — docwToXML", () => {
  it("should produce XML output", () => {
    const r = {
      algo: "ZWC",
      message: "test msg",
      timestamp: "2024-01-01",
      textLength: 50,
      hash: "abc",
      resultLength: 25,
    };
    const xml = docwToXML(r);
    assert.ok(xml.includes("<algo>ZWC</algo>"));
    assert.ok(xml.includes("<message>test msg</message>"));
    assert.ok(xml.includes("<textLength>50</textLength>"));
    assert.ok(xml.includes("<hash>abc</hash>"));
    assert.ok(xml.includes("<resultLength>25</resultLength>"));
  });

  it("should escape XML special chars", () => {
    const r = { algo: "test", message: "a&b<c>", timestamp: "", textLength: 0, hash: "", resultLength: 0 };
    const xml = docwToXML(r);
    assert.ok(xml.includes("a&amp;b&lt;c&gt;"));
  });
});

describe("Document Watermark UI — _docwBuildCertificateText", () => {
  it("should build certificate text with all fields", () => {
    const r = {
      algo: "ZWC",
      message: "secret",
      timestamp: "2024-06-01T00:00:00Z",
      textLength: 100,
      hash: "sha256hash",
    };
    const cert = _docwBuildCertificateText(r);
    assert.ok(cert.includes("ZWC"));
    assert.ok(cert.includes("secret"));
    assert.ok(cert.includes("100"));
    assert.ok(cert.includes("sha256hash"));
    assert.ok(cert.length > 500);
  });

  it("should include separator lines", () => {
    const r = { algo: "test", message: "msg", timestamp: "t", textLength: 1, hash: "h" };
    const cert = _docwBuildCertificateText(r);
    assert.ok(cert.includes("==="));
    assert.ok(cert.includes("---"));
  });
});

describe("Document Watermark UI — docwToTXT", () => {
  it("should delegate to _docwBuildCertificateText", () => {
    const r = { algo: "ZWC", message: "test", timestamp: "t", textLength: 5, hash: "h" };
    const txt = docwToTXT(r);
    assert.equal(txt, _docwBuildCertificateText(r));
  });
});

describe("Document Watermark UI — docwToHTML", () => {
  it("should produce HTML with result info", () => {
    const r = { algo: "ZWC", message: "test msg", timestamp: "t", textLength: 50, hash: "abc", resultLength: 25 };
    const html = docwToHTML(r);
    assert.ok(html.includes("ZWC"));
    assert.ok(html.includes("test msg"));
    assert.ok(html.includes("50"));
  });
});

describe("Document Watermark UI — _docwBuildReportHtml (branch coverage)", () => {
  it("should build extract-mode HTML", async () => {
    const r = { algo: "ZWC", message: "extracted msg", timestamp: "2024-06-01T00:00:00Z", textLength: 30 };
    const html = _docwBuildReportHtml(r, "extract");
    assert.ok(html.includes("Extracted Watermark Report"));
    assert.ok(html.includes("extracted msg"));
    assert.ok(html.includes("ZWC"));
  });

  it("should build embed-mode HTML", async () => {
    const r = { algo: "LSB", message: "secret", timestamp: "", textLength: 50, hash: "SHA-256:abc123" };
    const html = _docwBuildReportHtml(r, "embed");
    assert.ok(html.includes("Document Watermark Report"));
    assert.ok(html.includes("LSB"));
    assert.ok(html.includes("abc123"));
  });
});

describe("Document Watermark UI — _docwBuildReportDocx (branch coverage)", () => {
  it("should build extract-mode DOCX blob", async () => {
    const r = { algo: "ZWC", message: "docx extract", timestamp: "2024-06-01T00:00:00Z", textLength: 30 };
    const blob = await _docwBuildReportDocx(r, "extract");
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });

  it("should build embed-mode DOCX blob", async () => {
    const r = { algo: "LSB", message: "embedded", timestamp: "", textLength: 50, hash: "SHA-256:def456" };
    const blob = await _docwBuildReportDocx(r, "embed");
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 0);
  });
});

// ── Mock DOM helpers for UI function tests ──

function docwMakeEl(overrides) {
  var el = {
    style: { display: '', width: '', color: '' },
    value: '1',
    innerHTML: '',
    textContent: '',
    select: function () {},
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
    files: [],
    addEventListener: function () {},
    href: '',
    download: '',
    append: function () {},
    remove: function () {},
    disabled: false,
    width: 0,
    height: 0,
    toDataURL: function () { return 'data:image/png;base64,mock'; },
    getContext: function () { return null; },
    click: function () {},
  };
  if (overrides) for (var k in overrides) el[k] = overrides[k];
  return el;
}

function docwSetupDom() {
  var els = {};
  var ids = [
    'docw-embed', 'docw-extract', 'docw-embed-result',
    'docw-extract-result', 'docw-embed-buttons', 'docw-extract-buttons',
    'docw-embed-download', 'docw-loading-overlay', 'docw-loading-text',
    'docw-loading-bar-wrap', 'docw-loading-bar', 'docw-loading-pct',
    'docw-cover-warning', 'docw-algo', 'docw-capacity',
    'docw-cover-name', 'docw-secret-name', 'docw-algo-ex',
    'docw-ex-capacity', 'docw-extract-name', 'docw-password',
    'docw-password-ex', 'docw-embed-btn', 'docw-extract-btn',
    'docw-embed-output', 'docw-embed-algo-name', 'docw-extracted-msg',
    'docw-extract-algo-name',
  ];
  for (var i = 0; i < ids.length; i++) {
    els[ids[i]] = docwMakeEl();
  }

  var origDoc = globalThis.document;
  globalThis.document = {
    getElementById: function (id) { return els[id] || null; },
    querySelectorAll: function () { return [docwMakeEl()]; },
    querySelector: function () { return docwMakeEl(); },
    execCommand: function () { return true; },
    body: docwMakeEl(),
    createElement: function (tag) {
      if (tag === 'canvas') {
        var c = docwMakeEl();
        c.getContext = function () { return null; };
        c.toDataURL = function () { return 'data:image/png;base64,mock'; };
        return c;
      }
      if (tag === 'a') {
        var a = docwMakeEl();
        a.click = function () {};
        a.remove = function () {};
        return a;
      }
      return docwMakeEl();
    },
  };

  return { els: els, restore: function () { globalThis.document = origDoc; } };
}

describe("Document Watermark UI — switchDocwTab", function () {
  it("should switch to embed tab", function () {
    var dom = docwSetupDom();
    try {
      switchDocwTab("embed");
      assert.equal(dom.els["docw-embed"].style.display, "");
      assert.equal(dom.els["docw-extract"].style.display, "none");
      assert.equal(dom.els["docw-embed-result"].style.display, "none");
      assert.equal(dom.els["docw-extract-result"].style.display, "none");
      assert.equal(dom.els["docw-embed-buttons"].style.display, "none");
      assert.equal(dom.els["docw-extract-buttons"].style.display, "none");
    } finally { dom.restore(); }
  });

  it("should switch to extract tab", function () {
    var dom = docwSetupDom();
    try {
      switchDocwTab("extract");
      assert.equal(dom.els["docw-embed"].style.display, "none");
      assert.equal(dom.els["docw-extract"].style.display, "");
    } finally { dom.restore(); }
  });
});

describe("Document Watermark UI — showDocwLoading / hideDocwLoading", function () {
  it("should show loading overlay with percentage", function () {
    var dom = docwSetupDom();
    try {
      showDocwLoading("Processing...", 50);
      assert.equal(dom.els["docw-loading-overlay"].style.display, "flex");
      assert.equal(dom.els["docw-loading-text"].textContent, "Processing...");
      assert.equal(dom.els["docw-loading-bar-wrap"].style.display, "");
      assert.equal(dom.els["docw-loading-bar"].style.width, "50%");
      assert.equal(dom.els["docw-loading-pct"].textContent, "50%");
    } finally { dom.restore(); }
  });

  it("should show loading without percentage", function () {
    var dom = docwSetupDom();
    try {
      showDocwLoading("Working...");
      assert.equal(dom.els["docw-loading-overlay"].style.display, "flex");
      assert.equal(dom.els["docw-loading-bar-wrap"].style.display, "none");
      assert.equal(dom.els["docw-loading-pct"].textContent, "");
    } finally { dom.restore(); }
  });

  it("should hide loading overlay", function () {
    var dom = docwSetupDom();
    try {
      hideDocwLoading();
      assert.equal(dom.els["docw-loading-overlay"].style.display, "none");
    } finally { dom.restore(); }
  });

  it("should not throw when overlay missing", function () {
    var dom = docwSetupDom();
    try {
      dom.els["docw-loading-overlay"] = null;
      showDocwLoading("test", 10);
      hideDocwLoading();
    } finally { dom.restore(); }
  });

  it("should use default message when msg is null", function () {
    var dom = docwSetupDom();
    try {
      showDocwLoading(null, 50);
      assert.equal(dom.els["docw-loading-text"].textContent, "Processing...");
    } finally { dom.restore(); }
  });
});

describe("Document Watermark UI — _docwShowNoTextWarning", function () {
  it("should show warning for very short text", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "Short text";
      _docwShowNoTextWarning(10);
      assert.equal(dom.els["docw-cover-warning"].style.display, "");
      assert.ok(dom.els["docw-cover-warning"].innerHTML.includes("Very little text"));
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should show low capacity warning", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "A".repeat(200);
      _docwShowNoTextWarning(50);
      assert.equal(dom.els["docw-cover-warning"].style.display, "");
      assert.ok(dom.els["docw-cover-warning"].innerHTML.includes("Low capacity"));
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should hide warning when capacity sufficient", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "A".repeat(200);
      _docwShowNoTextWarning(500);
      assert.equal(dom.els["docw-cover-warning"].style.display, "none");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should hide warning when cover text empty", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "";
      _docwShowNoTextWarning(10);
      assert.equal(dom.els["docw-cover-warning"].style.display, "none");
    } finally { _docwCoverText = ""; dom.restore(); }
  });
});

describe("Document Watermark UI — docwAlgoChanged / docwExAlgoChanged", function () {
  it("should update capacity when cover text loaded", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "Hello World Test";
      dom.els["docw-algo"].value = "1";
      docwAlgoChanged();
      assert.ok(dom.els["docw-capacity"].textContent.length > 0);
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should show text too short for algorithm", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "";
      docwAlgoChanged();
      // When no cover text, the if (_docwCoverText) is false, so nothing happens
      assert.equal(dom.els["docw-capacity"].textContent, "");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("docwExAlgoChanged should update extract capacity", function () {
    var dom = docwSetupDom();
    try {
      _docwExtractText = "Extracted text here";
      dom.els["docw-algo-ex"].value = "1";
      docwExAlgoChanged();
      assert.ok(dom.els["docw-ex-capacity"].textContent.length > 0);
    } finally { _docwExtractText = ""; dom.restore(); }
  });

  it("docwExAlgoChanged should clear capacity when cap <= 0", function () {
    var dom = docwSetupDom();
    try {
      _docwExtractText = "";
      docwExAlgoChanged();
    } finally { _docwExtractText = ""; dom.restore(); }
  });

  it("docwAlgoChanged should show text too short when algo has zero capacity", function () {
    var dom = docwSetupDom();
    try {
      _docwCoverText = "text for capacity test";
      dom.els["docw-algo"].value = "99";
      docwAlgoChanged();
      assert.ok(dom.els["docw-capacity"].textContent.includes("too short"));
      assert.equal(dom.els["docw-capacity"].style.color, "#e74c3c");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("docwExAlgoChanged should clear capacity when algo has zero capacity", function () {
    var dom = docwSetupDom();
    try {
      _docwExtractText = "extract text for test";
      dom.els["docw-algo-ex"].value = "99";
      docwExAlgoChanged();
      assert.equal(dom.els["docw-ex-capacity"].textContent, "");
    } finally { _docwExtractText = ""; dom.restore(); }
  });
});

describe("Document Watermark UI — docwCopyResult", function () {
  it("should copy element content", function () {
    var dom = docwSetupDom();
    try {
      var called = false;
      dom.els["test-el"] = docwMakeEl({ select: function () { called = true; } });
      globalThis.document.getElementById = function (id) { return dom.els[id] || null; };
      docwCopyResult("test-el");
      assert.ok(called);
    } finally { dom.restore(); }
  });

  it("should not throw for missing element", function () {
    var dom = docwSetupDom();
    try {
      docwCopyResult("non-existent");
    } finally { dom.restore(); }
  });
});

describe("Document Watermark UI — docwDownloadResult", function () {
  it("should download text content", function () {
    var dom = docwSetupDom();
    try {
      var selectedEl = null;
      dom.els["test-dl"] = docwMakeEl({ value: "hello world" });
      globalThis.document.getElementById = function (id) { return id === "test-dl" ? dom.els["test-dl"] : null; };
      docwDownloadResult("test-dl", "out.txt");
      // Should not throw
    } finally { dom.restore(); }
  });

  it("should not throw for missing element", function () {
    var dom = docwSetupDom();
    try {
      docwDownloadResult("missing-id", "out.txt");
    } finally { dom.restore(); }
  });

  it("should use default filename when not provided", function () {
    var dom = docwSetupDom();
    try {
      dom.els["test-dl2"] = docwMakeEl({ value: "test content" });
      globalThis.document.getElementById = function (id) { return id === "test-dl2" ? dom.els["test-dl2"] : null; };
      docwDownloadResult("test-dl2");
      // Should not throw — uses default "document_watermarked.txt"
    } finally { dom.restore(); }
  });
});

describe("Document Watermark UI — _docwHash", function () {
  it("should compute SHA-256 hash", async function () {
    // crypto.subtle.digest is available in Node 22+
    if (typeof crypto === "undefined" || !crypto.subtle) return;
    var hash = await _docwHash("test message");
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64); // SHA-256 hex = 64 chars
  });

  it("should produce consistent hash for same input", async function () {
    if (typeof crypto === "undefined" || !crypto.subtle) return;
    var h1 = await _docwHash("hello");
    var h2 = await _docwHash("hello");
    assert.equal(h1, h2);
  });
});

describe("Document Watermark UI — _docwQrDataURL", function () {
  it("should return null when QRious is undefined", async function () {
    var origQR = globalThis.QRious;
    globalThis.QRious = undefined;
    try {
      var result = await _docwQrDataURL("test");
      assert.equal(result, null);
    } finally { globalThis.QRious = origQR; }
  });

  it("should generate QR code data URL", async function () {
    var qrCalled = false;
    var origQR = globalThis.QRious;
    globalThis.QRious = function (opts) {
      qrCalled = true;
      assert.ok(opts.element);
      assert.equal(opts.value, "qr content");
      assert.equal(opts.size, 200);
    };
    var origCreateEl = globalThis.document && globalThis.document.createElement;
    if (!globalThis.document) globalThis.document = {};
    globalThis.document.createElement = function (tag) {
      if (tag === 'canvas') {
        return { toDataURL: function () { return 'data:image/png;base64,qrcode'; } };
      }
      return {};
    };
    try {
      var result = await _docwQrDataURL("qr content");
      assert.ok(qrCalled);
      assert.equal(result, 'data:image/png;base64,qrcode');
    } finally {
      globalThis.QRious = origQR;
      globalThis.document.createElement = origCreateEl;
    }
  });
});

describe("Document Watermark UI — _docwBuildReportPdf", function () {
  before(function () {
    // Set up QRious mock so _docwQrDataURL returns a QR code
    if (!globalThis.QRious) {
      globalThis.QRious = function (opts) {
        if (opts.element && !opts.element.toDataURL) {
          opts.element.toDataURL = function () { return 'data:image/png;base64,iVBOR'; };
        }
      };
    }
    // Ensure document.createElement works for QR code canvas
    var origDoc = globalThis.document;
    if (!globalThis.document || typeof globalThis.document.createElement !== 'function') {
      globalThis.document = {
        createElement: function (tag) {
          if (tag === 'canvas') {
            return {
              toDataURL: function () { return 'data:image/png;base64,iVBOR'; },
              getContext: function () { return null; },
            };
          }
          return {};
        },
        getElementById: function () { return null; },
        querySelectorAll: function () { return []; },
        querySelector: function () { return null; },
      };
    }
  });

  it("should build extract-mode PDF blob", async function () {
    var origJspdf = globalThis.jspdf;
    var outputCalled = false;
    globalThis.jspdf = {
      jsPDF: function (opts) {
        return {
          internal: { pageSize: { getWidth: function () { return 210; }, getHeight: function () { return 297; } } },
          setFontSize: function () {},
          setTextColor: function () {},
          text: function () {},
          setDrawColor: function () {},
          line: function () {},
          splitTextToSize: function (t) { return t.split("\n"); },
          addPage: function () {},
          addImage: function () {},
          output: function (type) {
            outputCalled = true;
            return new Blob(["mock pdf report"], { type: "application/pdf" });
          },
        };
      },
    };
    try {
      var r = { algo: "ZWC", message: "extracted msg", timestamp: "2024-06-01T00:00:00Z" };
      var blob = await _docwBuildReportPdf(r, "extract");
      assert.ok(blob instanceof Blob);
      assert.ok(outputCalled);
    } finally { globalThis.jspdf = origJspdf; }
  });

  it("should build embed-mode PDF blob with hash", async function () {
    var origJspdf = globalThis.jspdf;
    var outputCalled = false;
    globalThis.jspdf = {
      jsPDF: function (opts) {
        return {
          internal: { pageSize: { getWidth: function () { return 210; }, getHeight: function () { return 297; } } },
          setFontSize: function () {},
          setTextColor: function () {},
          text: function () {},
          setDrawColor: function () {},
          line: function () {},
          splitTextToSize: function (t) { return t.split("\n"); },
          addPage: function () {},
          addImage: function () {},
          output: function (type) {
            outputCalled = true;
            return new Blob(["mock pdf embed"], { type: "application/pdf" });
          },
        };
      },
    };
    try {
      var r = { algo: "ZWC", message: "test", timestamp: "t", textLength: 10, hash: "SHA-256:abc123", watermarkedText: "wm text" };
      var blob = await _docwBuildReportPdf(r, "embed");
      assert.ok(blob instanceof Blob);
      assert.ok(outputCalled);
    } finally { globalThis.jspdf = origJspdf; }
  });

  it("should handle addImage failure gracefully", async function () {
    var origJspdf = globalThis.jspdf;
    globalThis.jspdf = {
      jsPDF: function (opts) {
        return {
          internal: { pageSize: { getWidth: function () { return 210; }, getHeight: function () { return 297; } } },
          setFontSize: function () {},
          setTextColor: function () {},
          text: function () {},
          setDrawColor: function () {},
          line: function () {},
          splitTextToSize: function (t) { return t.split("\n"); },
          addPage: function () {},
          addImage: function () { throw new Error("addImage failed"); },
          output: function (type) {
            return new Blob(["mock pdf"], { type: "application/pdf" });
          },
        };
      },
    };
    try {
      var r = { algo: "ZWC", message: "test", timestamp: "t", textLength: 10, hash: "SHA-256:abc123", watermarkedText: "wm" };
      var blob = await _docwBuildReportPdf(r, "embed");
      assert.ok(blob instanceof Blob);
    } finally { globalThis.jspdf = origJspdf; }
  });

  it("should handle page break when content exceeds page height", async function () {
    var origJspdf = globalThis.jspdf;
    var addPageCalled = false;
    globalThis.jspdf = {
      jsPDF: function (opts) {
        return {
          internal: { pageSize: { getWidth: function () { return 210; }, getHeight: function () { return 297; } } },
          setFontSize: function () {},
          setTextColor: function () {},
          text: function () {},
          setDrawColor: function () {},
          line: function () {},
          // Return 200 lines to trigger page break (y+4 > 297-15, i.e. y > 278)
          splitTextToSize: function (t) { return new Array(200).fill("line content"); },
          addPage: function () { addPageCalled = true; },
          addImage: function () {},
          output: function (type) {
            return new Blob(["mock pdf"], { type: "application/pdf" });
          },
        };
      },
    };
    try {
      var r = { algo: "ZWC", message: "test", timestamp: "t", textLength: 10, hash: "SHA-256:abc123", watermarkedText: "wm" };
      var blob = await _docwBuildReportPdf(r, "embed");
      assert.ok(blob instanceof Blob);
      assert.ok(addPageCalled, "addPage should have been called for page break");
    } finally { globalThis.jspdf = origJspdf; }
  });
});

describe("Document Watermark UI — buildWatermarkedDocx", function () {
  it("should rebuild DOCX with watermarked text", async function () {
    // Create a minimal DOCX in memory
    var zip = new JSZip();
    zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Original text</w:t></w:r></w:p></w:body></w:document>');
    var buf = await zip.generateAsync({ type: "uint8array" });

    var result = await buildWatermarkedDocx(buf, "WATERMARKED");
    assert.ok(result instanceof Blob);
    assert.ok(result.size > 0);

    // Verify the blob contains the watermarked text
    var resultBuf = await result.arrayBuffer();
    var resultZip = await JSZip.loadAsync(resultBuf);
    var xml = await resultZip.file("word/document.xml").async("string");
    assert.ok(xml.includes("WATERMARKED"), "should contain watermarked text");
    assert.ok(!xml.includes("Original text"), "should not contain original text");
  });

  it("should handle empty watermarked text", async function () {
    var zip = new JSZip();
    zip.file("word/document.xml", '<w:document><w:body><w:p><w:r><w:t>Content</w:t></w:r></w:p></w:body></w:document>');
    var buf = await zip.generateAsync({ type: "uint8array" });
    var result = await buildWatermarkedDocx(buf, "");
    assert.ok(result instanceof Blob);
  });

  it("should replace only first run, clear subsequent runs", async function () {
    var zip = new JSZip();
    zip.file("word/document.xml", '<w:document><w:body><w:p><w:r><w:t>First</w:t></w:r><w:r><w:t>Second</w:t></w:r><w:r><w:t>Third</w:t></w:r></w:p></w:body></w:document>');
    var buf = await zip.generateAsync({ type: "uint8array" });
    var result = await buildWatermarkedDocx(buf, "WATERMARKED");
    var resultBuf = await result.arrayBuffer();
    var resultZip = await JSZip.loadAsync(resultBuf);
    var xml = await resultZip.file("word/document.xml").async("string");
    // First run should have watermarked text
    assert.ok(xml.indexOf("WATERMARKED") >= 0, "should contain watermarked text in first run");
    // Subsequent runs should be empty
    var firstEnd = xml.indexOf("</w:t>");
    var rest = xml.substring(firstEnd + 6);
    assert.ok(!rest.includes("Second"), "Second run should be cleared");
    assert.ok(!rest.includes("Third"), "Third run should be cleared");
  });
});

describe("Document Watermark UI — handleDocwEmbed error paths", function () {
  it("should alert when no secret message", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwSecretMessage = "";
    _docwCoverText = "some cover text";
    dom.els["docw-password"].value = "password";
    dom.els["docw-algo"].value = "1";
    try {
      await handleDocwEmbed();
      assert.ok(alertMsg.includes("secret message"), "should alert about missing secret");
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      delete globalThis.alert;
      dom.restore();
    }
  });

  it("should alert when no cover text", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwSecretMessage = "secret";
    _docwCoverText = "";
    dom.els["docw-password"].value = "password";
    dom.els["docw-algo"].value = "1";
    try {
      await handleDocwEmbed();
      assert.ok(alertMsg.includes("cover document"), "should alert about missing cover");
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      delete globalThis.alert;
      dom.restore();
    }
  });

  it("should alert when no password", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text";
    dom.els["docw-password"].value = "";
    dom.els["docw-algo"].value = "1";
    try {
      await handleDocwEmbed();
      assert.ok(alertMsg.includes("Password"), "should alert about missing password");
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      delete globalThis.alert;
      dom.restore();
    }
  });
});

describe("Document Watermark UI — handleDocwExtract error paths", function () {
  it("should alert when no extract text", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwExtractText = "";
    dom.els["docw-password-ex"].value = "pw";
    dom.els["docw-algo-ex"].value = "1";
    try {
      await handleDocwExtract();
      assert.ok(alertMsg.includes("watermarked document"), "should alert about missing doc");
    } finally {
      _docwExtractText = "";
      delete globalThis.alert;
      dom.restore();
    }
  });

  it("should alert when no password for extract", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwExtractText = "some watermarked text";
    dom.els["docw-password-ex"].value = "";
    dom.els["docw-algo-ex"].value = "1";
    try {
      await handleDocwExtract();
      assert.ok(alertMsg.includes("Password"), "should alert about missing password");
    } finally {
      _docwExtractText = "";
      delete globalThis.alert;
      dom.restore();
    }
  });
});

describe("Document Watermark UI — handleDocwEmbed error catch", function () {
  it("should catch errors and alert", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text for embedding";
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    _docwCoverFileName = "test.txt";
    _docwCoverBytes = new TextEncoder().encode("cover text");
    // Make docwEmbed throw to trigger the outer catch
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { throw new Error("embed failed"); };
    try {
      await handleDocwEmbed();
      assert.ok(alertMsg.includes("embed failed"), "should show error message");
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      delete globalThis.alert;
      dom.restore();
    }
  });
});

describe("Document Watermark UI — handleDocwEmbed success paths", function () {
  it("should embed successfully and create download link for TXT", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "secret message";
    _docwCoverText = "cover text for embedding";
    _docwCoverFileName = "test.txt";
    _docwCoverBytes = new TextEncoder().encode("cover text for embedding");
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { return "watermarked text content"; };
    try {
      await handleDocwEmbed();
      // Verify embed output was set
      assert.ok(dom.els["docw-embed-output"].value.length > 0, "output should have certificate text");
      assert.equal(dom.els["docw-embed-result"].style.display, "");
      assert.equal(dom.els["docw-embed-buttons"].style.display, "");
      assert.equal(dom.els["docw-embed-algo-name"].textContent, "Zero-Width Characters");
      // Should have created a download link for TXT
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("Download Watermarked Document"));
      assert.equal(dom.els["docw-embed-btn"].disabled, false);
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      dom.restore();
    }
  });

  it("should handle PDF direct download with buildWatermarkedPdfDoc", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text for pdf";
    _docwCoverFileName = "doc.pdf";
    _docwCoverBytes = new TextEncoder().encode("cover text for pdf");
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { return "watermarked pdf text"; };
    try {
      await handleDocwEmbed();
      // Verify download link was created (PDF path)
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("Download Watermarked Document"));
      assert.ok(dom.els["docw-embed-btn"].disabled === false);
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      dom.restore();
    }
  });

  it("should handle DOCX direct download with buildWatermarkedDocx success", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text for docx";
    _docwCoverFileName = "doc.docx";
    _docwCoverBytes = new TextEncoder().encode("cover text for docx");
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    // Mock buildWatermarkedDocx to succeed so the DOCX success path is hit
    var origBuildDocx = globalThis.buildWatermarkedDocx;
    globalThis.buildWatermarkedDocx = async function () {
      return new Blob(["mock docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    };
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { return "watermarked docx text"; };
    try {
      await handleDocwEmbed();
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("Download Watermarked Document"));
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("DOCX"));
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      globalThis.buildWatermarkedDocx = origBuildDocx;
      dom.restore();
    }
  });

  it("should fallback to TXT when DOCX build fails", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text for docx";
    _docwCoverFileName = "invalid.docx";
    _docwCoverBytes = new Uint8Array([0, 1, 2, 3, 4]); // not a valid DOCX
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { return "watermarked docx text"; };
    try {
      await handleDocwEmbed();
      // buildWatermarkedDocx should throw on invalid bytes, landing in TXT fallback
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("Download Watermarked Document"));
      // The catch path produces TXT (not DOCX) fallback link
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes(".txt"));
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      dom.restore();
    }
  });

  it("should handle PDF build failure with TXT fallback", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "secret";
    _docwCoverText = "cover text for pdf";
    _docwCoverFileName = "doc.pdf";
    _docwCoverBytes = new TextEncoder().encode("cover text for pdf");
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "1";
    // Make buildWatermarkedPdfDoc throw to trigger the PDF catch fallback
    var origBuildPdf = globalThis.buildWatermarkedPdfDoc;
    globalThis.buildWatermarkedPdfDoc = async function () { throw new Error("PDF build failed"); };
    var origEmbed = globalThis.docwEmbed;
    globalThis.docwEmbed = async function () { return "watermarked pdf text"; };
    try {
      await handleDocwEmbed();
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("PDF rebuild failed"));
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("TXT"));
    } finally {
      _docwSecretMessage = "";
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis.docwEmbed = origEmbed;
      globalThis.buildWatermarkedPdfDoc = origBuildPdf;
      dom.restore();
    }
  });

  it("should use homoglyph payload when algo=2 and secret data has hashes", async function () {
    var dom = docwSetupDom();
    _docwSecretMessage = "fallback message";
    _docwSecretData = { hashes: { "SHA-256": "abc123" } };
    _docwCoverText = "cover text for homoglyph";
    _docwCoverFileName = "test.txt";
    _docwCoverBytes = new TextEncoder().encode("cover text for homoglyph");
    dom.els["docw-password"].value = "password123";
    dom.els["docw-algo"].value = "2";
    var origBuildPayload = globalThis._buildPayloadForHomoglyph;
    globalThis._buildPayloadForHomoglyph = async function () {
      return "homoglyph-payload-message";
    };
    var origEmbed = globalThis.docwEmbed;
    var embedCalledWith = null;
    globalThis.docwEmbed = async function (text, message, algo, pw) {
      embedCalledWith = message;
      return "watermarked: " + message;
    };
    try {
      await handleDocwEmbed();
      assert.equal(embedCalledWith, "homoglyph-payload-message");
      assert.ok(dom.els["docw-embed-download"].innerHTML.includes("Download Watermarked Document"));
    } finally {
      _docwSecretMessage = "";
      _docwSecretData = null;
      _docwCoverText = "";
      _docwCoverFileName = "";
      _docwCoverBytes = null;
      globalThis._buildPayloadForHomoglyph = origBuildPayload;
      globalThis.docwEmbed = origEmbed;
      dom.restore();
    }
  });
});

describe("Document Watermark UI — handleDocwExtract success paths", function () {
  it("should extract with auto-detect (algo=0) when found", async function () {
    var dom = docwSetupDom();
    _docwExtractText = "watermarked text content here";
    dom.els["docw-password-ex"].value = "password123";
    dom.els["docw-algo-ex"].value = "0";
    var origAutoDetect = globalThis.docwAutoDetect;
    globalThis.docwAutoDetect = async function () {
      return { message: "detected message", name: "ZWC (auto-detected)" };
    };
    try {
      await handleDocwExtract();
      assert.equal(dom.els["docw-extract-btn"].textContent, "Extract Watermark");
      assert.equal(dom.els["docw-extract-btn"].disabled, false);
      assert.equal(dom.els["docw-extract-result"].style.display, "");
      assert.equal(dom.els["docw-extract-buttons"].style.display, "");
      assert.equal(dom.els["docw-extracted-msg"].value, "detected message");
    } finally {
      _docwExtractText = "";
      globalThis.docwAutoDetect = origAutoDetect;
      dom.restore();
    }
  });

  it("should show 'No watermark found' when auto-detect returns null", async function () {
    var dom = docwSetupDom();
    _docwExtractText = "some text without watermark";
    dom.els["docw-password-ex"].value = "password123";
    dom.els["docw-algo-ex"].value = "0";
    var origAutoDetect = globalThis.docwAutoDetect;
    globalThis.docwAutoDetect = async function () { return null; };
    try {
      await handleDocwExtract();
      assert.equal(dom.els["docw-extracted-msg"].value, "");
      assert.equal(dom.els["docw-extract-algo-name"].textContent, "No watermark found");
      assert.equal(dom.els["docw-extract-result"].style.display, "");
      assert.equal(dom.els["docw-extract-buttons"].style.display, "none");
    } finally {
      _docwExtractText = "";
      globalThis.docwAutoDetect = origAutoDetect;
      dom.restore();
    }
  });

  it("should extract with specific algorithm (algo != 0)", async function () {
    var dom = docwSetupDom();
    _docwExtractText = "watermarked content";
    dom.els["docw-password-ex"].value = "mypassword";
    dom.els["docw-algo-ex"].value = "1";
    var origExtract = globalThis.docwExtract;
    globalThis.docwExtract = async function () { return "extracted message"; };
    try {
      await handleDocwExtract();
      assert.equal(dom.els["docw-extracted-msg"].value, "extracted message");
      assert.equal(dom.els["docw-extract-algo-name"].textContent, "Zero-Width Characters");
      assert.equal(dom.els["docw-extract-btn"].disabled, false);
    } finally {
      _docwExtractText = "";
      globalThis.docwExtract = origExtract;
      dom.restore();
    }
  });

  it("should try duplicate text fallback when extraction yields no result and text > 200", async function () {
    var dom = docwSetupDom();
    // Create a long text (> 200 chars) where the first half yields no result
    _docwExtractText = "A".repeat(150) + "B".repeat(150); // 300 chars
    dom.els["docw-password-ex"].value = "password";
    dom.els["docw-algo-ex"].value = "1";
    var callCount = 0;
    var origExtract = globalThis.docwExtract;
    globalThis.docwExtract = async function (text, algo, pw) {
      callCount++;
      // Return result on second call (fallback with half-length text)
      if (callCount === 2) return "fallback extracted message";
      return "";
    };
    try {
      await handleDocwExtract();
      assert.ok(callCount >= 2, "should have attempted fallback extraction");
      assert.equal(dom.els["docw-extracted-msg"].value, "fallback extracted message");
    } finally {
      _docwExtractText = "";
      globalThis.docwExtract = origExtract;
      dom.restore();
    }
  });

  it("should show 'No watermark found' when nothing found after fallback", async function () {
    var dom = docwSetupDom();
    _docwExtractText = "A".repeat(150) + "B".repeat(150);
    dom.els["docw-password-ex"].value = "password";
    dom.els["docw-algo-ex"].value = "1";
    var origExtract = globalThis.docwExtract;
    globalThis.docwExtract = async function () { return ""; };
    try {
      await handleDocwExtract();
      assert.equal(dom.els["docw-extracted-msg"].value, "No watermark found");
    } finally {
      _docwExtractText = "";
      globalThis.docwExtract = origExtract;
      dom.restore();
    }
  });

  it("should handle WRONG_PASSWORD error", async function () {
    var dom = docwSetupDom();
    _docwExtractText = "some watermarked text";
    dom.els["docw-password-ex"].value = "wrong";
    dom.els["docw-algo-ex"].value = "1";
    var origExtract = globalThis.docwExtract;
    globalThis.docwExtract = async function () { throw new Error("WRONG_PASSWORD"); };
    try {
      await handleDocwExtract();
      assert.equal(dom.els["docw-extracted-msg"].value, "");
      assert.equal(dom.els["docw-extract-algo-name"].textContent, "Password may be incorrect");
      assert.equal(dom.els["docw-extract-buttons"].style.display, "none");
      assert.equal(dom.els["docw-extract-btn"].disabled, false);
    } finally {
      _docwExtractText = "";
      globalThis.docwExtract = origExtract;
      dom.restore();
    }
  });

  it("should handle general errors with alert", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (msg) { alertMsg = msg; };
    _docwExtractText = "some watermarked text";
    dom.els["docw-password-ex"].value = "pw";
    dom.els["docw-algo-ex"].value = "1";
    var origExtract = globalThis.docwExtract;
    globalThis.docwExtract = async function () { throw new Error("generic error"); };
    try {
      await handleDocwExtract();
      assert.ok(alertMsg.includes("generic error"));
      assert.equal(dom.els["docw-extract-btn"].disabled, false);
    } finally {
      _docwExtractText = "";
      globalThis.docwExtract = origExtract;
      delete globalThis.alert;
      dom.restore();
    }
  });
});

describe("Document Watermark UI — docwExtractTextFromBuf", function () {
  before(function () {
    globalThis.DOCX_EXTRACTOR = {
      readDocx: function (buf) { return Promise.resolve("extracted docx text"); },
      readPdf: function (buf) { return Promise.resolve("extracted pdf text"); },
    };
  });

  function docwCallbackToPromise(fn) {
    return new Promise(function (resolve, reject) {
      fn(function (err, text, ext) {
        try {
          resolve({ err: err, text: text, ext: ext });
        } catch (e) { reject(e); }
      });
    });
  }

  it("should extract text from DOCX buffer", async function () {
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.docx" }, new ArrayBuffer(10), cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "extracted docx text");
    assert.equal(result.ext, "docx");
  });

  it("should extract text from PDF buffer", async function () {
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.pdf" }, new ArrayBuffer(10), cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "extracted pdf text");
    assert.equal(result.ext, "pdf");
  });

  it("should extract text from DOC buffer using ASCII extraction", async function () {
    var arr = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.doc" }, arr.buffer, cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "Hello");
    assert.equal(result.ext, "doc");
  });

  it("should handle DOC extraction returning no-readable-text fallback", async function () {
    var arr = new Uint8Array([0x00, 0x01, 0x02]); // non-printable
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.doc" }, arr.buffer, cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "No readable text found in DOC file.");
    assert.equal(result.ext, "doc");
  });

  it("should handle unknown extension with UTF-8 decode", async function () {
    var buf = new TextEncoder().encode("plain text content").buffer;
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.txt" }, buf, cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "plain text content");
    assert.equal(result.ext, "txt");
  });

  it("should report DOCX extraction error", async function () {
    globalThis.DOCX_EXTRACTOR.readDocx = function () { return Promise.reject(new Error("corrupt zip")); };
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.docx" }, new ArrayBuffer(10), cb);
    });
    assert.ok(result.err);
    assert.ok(result.err.includes("corrupt zip"));
  });

  it("should report PDF extraction error", async function () {
    globalThis.DOCX_EXTRACTOR.readPdf = function () { return Promise.reject(new Error("pdf error")); };
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.pdf" }, new ArrayBuffer(10), cb);
    });
    assert.ok(result.err);
    assert.ok(result.err.includes("PDF extraction failed"));
  });

  it("should handle PDF returning null text (empty fallback)", async function () {
    globalThis.DOCX_EXTRACTOR.readPdf = function () { return Promise.resolve(null); };
    var result = await docwCallbackToPromise(function (cb) {
      docwExtractTextFromBuf({ name: "test.pdf" }, new ArrayBuffer(10), cb);
    });
    assert.equal(result.err, null);
    assert.equal(result.text, "");
    assert.equal(result.ext, "pdf");
    globalThis.DOCX_EXTRACTOR.readPdf = function () { return Promise.resolve("extracted pdf text"); };
  });
});

describe("Document Watermark UI — downloadDocwExtract", function () {
  before(function () {
    globalThis.closeDownloadModal = function () {};
    globalThis.downloadBlobSimple = function () {};
    globalThis.__ = function (key, def) { return def; };
  });

  it("should return early when no extract result", function () {
    var orig = _docwExtractResult;
    _docwExtractResult = null;
    try {
      downloadDocwExtract("txt");
    } finally { _docwExtractResult = orig; }
  });

  it("should download as PDF", async function () {
    var result = { message: "test", algo: "ZWC", timestamp: "2024-06-01T00:00:00Z", algoId: 1 };
    _docwExtractResult = result;
    var origPdf = globalThis._docwBuildReportPdf;
    var called = false;
    globalThis._docwBuildReportPdf = async function (r, mode) {
      called = true;
      assert.equal(r, result);
      assert.equal(mode, "extract");
      return new Blob(["pdf"], { type: "application/pdf" });
    };
    try {
      await downloadDocwExtract("pdf");
      assert.ok(called);
    } finally {
      _docwExtractResult = null;
      globalThis._docwBuildReportPdf = origPdf;
    }
  });

  it("should download as DOCX", async function () {
    var result = { message: "test", algo: "ZWC", timestamp: "2024-06-01T00:00:00Z" };
    _docwExtractResult = result;
    var orig = globalThis._docwBuildReportDocx;
    var called = false;
    globalThis._docwBuildReportDocx = async function (r, mode) {
      called = true;
      assert.equal(mode, "extract");
      return new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    };
    try {
      await downloadDocwExtract("doc");
      assert.ok(called);
    } finally {
      _docwExtractResult = null;
      globalThis._docwBuildReportDocx = orig;
    }
  });

  it("should download as JSON", async function () {
    var result = { message: "hello", algo: "ZWC", timestamp: "2024-06-01T00:00:00Z", algoId: 1 };
    _docwExtractResult = result;
    try {
      await downloadDocwExtract("json");
    } finally { _docwExtractResult = null; }
  });

  it("should download as CSV", async function () {
    _docwExtractResult = { message: "test", algo: "ZWC", timestamp: "2024-06-01T00:00:00Z" };
    try {
      await downloadDocwExtract("csv");
    } finally { _docwExtractResult = null; }
  });

  it("should download as TXT", async function () {
    _docwExtractResult = { message: "plain text", algo: "ZWC", timestamp: "t" };
    try {
      await downloadDocwExtract("txt");
    } finally { _docwExtractResult = null; }
  });

  it("should download as XML", async function () {
    _docwExtractResult = { message: "xml msg", algo: "ZWC", timestamp: "t" };
    try {
      await downloadDocwExtract("xml");
    } finally { _docwExtractResult = null; }
  });

  it("should download as HTML", async function () {
    _docwExtractResult = { message: "html msg", algo: "ZWC", timestamp: "t" };
    try {
      await downloadDocwExtract("html");
    } finally { _docwExtractResult = null; }
  });

  it("should skip unknown format", async function () {
    _docwExtractResult = { message: "test", algo: "ZWC", timestamp: "t" };
    try {
      // Unknown format should not throw
      await downloadDocwExtract("unknown");
    } finally { _docwExtractResult = null; }
  });

  it("should handle null fields in CSV format", async function () {
    _docwExtractResult = { message: null, algo: null, timestamp: null };
    try {
      await downloadDocwExtract("csv");
    } finally { _docwExtractResult = null; }
  });

  it("should handle null message in TXT format", async function () {
    _docwExtractResult = { message: null, algo: null, timestamp: null };
    try {
      await downloadDocwExtract("txt");
    } finally { _docwExtractResult = null; }
  });

  it("should handle null fields in XML format", async function () {
    _docwExtractResult = { message: null, algo: null, timestamp: null };
    try {
      await downloadDocwExtract("xml");
    } finally { _docwExtractResult = null; }
  });
});

// ── loadDocwSecretFile (FileReader-based JSON/non-JSON loader) ──

describe("Document Watermark UI - loadDocwSecretFile", function () {
  afterEach(function () {
    delete globalThis.FileReader;
    delete globalThis.docwExtractText;
    delete globalThis.alert;
    _docwSecretMessage = "";
    _docwSecretData = null;
  });

  it("should load JSON fingerprint file", function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        readAsText: function () {
          fr.result = JSON.stringify({ file_info: { file_name: "fp.jpg" }, hashes: { "SHA-256": "abc123" } });
          fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwSecretFile({ target: { files: [{ name: "fp.json" }] } });
      assert.ok(_docwSecretMessage.includes("SHA-256"), "should have SHA-256");
      assert.ok(_docwSecretMessage.includes("fp.jpg"), "should have filename");
      assert.equal(dom.els["docw-secret-name"].style.color, "#2ecc71");
    } finally { dom.restore(); }
  });

  it("should load JSON string file", function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        readAsText: function () {
          fr.result = '"hello secret"';
          fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwSecretFile({ target: { files: [{ name: "msg.json" }] } });
      assert.equal(_docwSecretMessage, "hello secret");
    } finally { dom.restore(); }
  });

  it("should load JSON object file (non-fingerprint)", function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        readAsText: function () {
          fr.result = '{"key":"value","num":42}';
          fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwSecretFile({ target: { files: [{ name: "obj.json" }] } });
      assert.ok(_docwSecretMessage.includes("key"), "should stringify the object");
      assert.ok(_docwSecretMessage.includes("42"), "should include values");
      assert.equal(_docwSecretData, null);
    } finally { dom.restore(); }
  });

  it("should alert on invalid JSON file", function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (m) { alertMsg = m; };
    try {
      var fr = {
        result: null,
        onload: null,
        readAsText: function () {
          fr.result = "not json at all";
          fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwSecretFile({ target: { files: [{ name: "bad.json" }] } });
      assert.ok(alertMsg.includes("Invalid JSON"), "should show parse error");
    } finally { dom.restore(); }
  });

  it("should load non-JSON text file via docwExtractText", function () {
    var dom = docwSetupDom();
    try {
      globalThis.docwExtractText = function (file, cb) { cb(null, "extracted plain text"); };
      loadDocwSecretFile({ target: { files: [{ name: "doc.txt" }] } });
      // The callback is sync so it fires immediately
      assert.equal(_docwSecretMessage, "extracted plain text");
    } finally { dom.restore(); }
  });

  it("should alert on non-JSON extraction error", function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (m) { alertMsg = m; };
    try {
      globalThis.docwExtractText = function (file, cb) { cb("Extraction failed"); };
      loadDocwSecretFile({ target: { files: [{ name: "doc.txt" }] } });
      assert.ok(alertMsg.includes("Extraction failed"), "should report error");
    } finally { dom.restore(); }
  });

  it("should return early when no file selected", function () {
    var dom = docwSetupDom();
    try {
      loadDocwSecretFile({ target: { files: [] } });
      // No state should change
      assert.equal(_docwSecretMessage, "");
    } finally { dom.restore(); }
  });

  it("should return early when validateFileInput fails", function () {
    var dom = docwSetupDom();
    try {
      globalThis.validateFileInput = function () { return false; };
      loadDocwSecretFile({ target: { files: [{ name: "test.json" }] } });
      assert.equal(_docwSecretMessage, "", "should skip loading when validation fails");
    } finally {
      dom.restore();
      delete globalThis.validateFileInput;
    }
  });
});

// ── loadDocwCoverFile (FileReader-based cover document loader) ──

describe("Document Watermark UI - loadDocwCoverFile", function () {
  before(function () {
    globalThis.DOCX_EXTRACTOR = {
      readDocx: function (buf) { return Promise.resolve("extracted docx cover text"); },
      readPdf: function (buf) { return Promise.resolve("extracted pdf cover text"); },
    };
  });

  afterEach(function () {
    delete globalThis.FileReader;
    _docwCoverText = "";
    _docwCoverBytes = null;
    _docwCoverFileName = "";
  });

  function makeReadableBuf(text) {
    return new TextEncoder().encode(text).buffer;
  }

  it("should load a TXT cover file (default path)", async function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        onprogress: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("plain text cover");
          if (typeof fr.onprogress === 'function')
            fr.onprogress({ lengthComputable: true, loaded: 16, total: 16 });
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "cover.txt" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "plain text cover");
      assert.equal(_docwCoverFileName, "cover.txt");
      assert.ok(dom.els["docw-cover-name"].textContent.includes("cover.txt"));
      assert.equal(dom.els["docw-cover-name"].style.color, "#2ecc71");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should load a DOCX cover file", async function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        onprogress: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("docx content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo"].value = "2";
      loadDocwCoverFile({ target: { files: [{ name: "report.docx" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "extracted docx cover text");
      assert.equal(_docwCoverFileName, "report.docx");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should load a PDF cover file", async function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        onprogress: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("pdf content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "doc.pdf" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "extracted pdf cover text");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should load a DOC cover file (ASCII extraction)", async function () {
    var dom = docwSetupDom();
    try {
      var buf = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = buf.buffer;
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "old.doc" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "Hello");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should handle DOC with no readable text", async function () {
    var dom = docwSetupDom();
    try {
      var buf = new Uint8Array([0x00, 0x01, 0x02]); // non-printable
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = buf.buffer;
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "old.doc" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "No readable text found in DOC file.");
    } finally { _docwCoverText = ""; dom.restore(); }
  });

  it("should handle extraction error in cover file", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (m) { alertMsg = m; };
    try {
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("error content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      globalThis.DOCX_EXTRACTOR.readDocx = function () { return Promise.reject(new Error("corrupt")); };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "bad.docx" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(alertMsg.includes("corrupt"), "should report error");
      assert.equal(dom.els["docw-cover-name"].textContent, "");
    } finally {
      _docwCoverText = "";
      delete globalThis.alert;
      globalThis.DOCX_EXTRACTOR.readDocx = function () { return Promise.resolve("extracted docx cover text"); };
      dom.restore();
    }
  });

  it("should handle extraction error without .message property", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (m) { alertMsg = m; };
    try {
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("error content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      // Reject with a plain string (no .message property) to trigger error.message || error
      globalThis.DOCX_EXTRACTOR.readDocx = function () { return Promise.reject("raw string error"); };
      dom.els["docw-algo"].value = "1";
      loadDocwCoverFile({ target: { files: [{ name: "bad.docx" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(alertMsg.includes("raw string error"), "should use the raw error value");
    } finally {
      _docwCoverText = "";
      delete globalThis.alert;
      globalThis.DOCX_EXTRACTOR.readDocx = function () { return Promise.resolve("extracted docx cover text"); };
      dom.restore();
    }
  });

  it("should return early when no file selected", function () {
    var dom = docwSetupDom();
    try {
      loadDocwCoverFile({ target: { files: [] } });
      assert.equal(_docwCoverFileName, "");
    } finally { dom.restore(); }
  });

  it("should return early when validateFileInput fails", function () {
    var dom = docwSetupDom();
    try {
      globalThis.validateFileInput = function () { return false; };
      loadDocwCoverFile({ target: { files: [{ name: "test.txt" }] } });
      assert.equal(_docwCoverFileName, "", "should skip loading when validation fails");
    } finally {
      dom.restore();
      delete globalThis.validateFileInput;
    }
  });

  it("should handle PDF returning null text (empty fallback)", async function () {
    var dom = docwSetupDom();
    try {
      dom.els["docw-algo"].value = "1";
      globalThis.DOCX_EXTRACTOR.readPdf = function () { return Promise.resolve(null); };
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("pdf content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwCoverFile({ target: { files: [{ name: "test.pdf" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(_docwCoverText, "", "should fallback to empty string");
    } finally {
      _docwCoverText = "";
      delete globalThis.FileReader;
      globalThis.DOCX_EXTRACTOR.readPdf = function (buf) { return Promise.resolve("extracted pdf cover text"); };
      dom.restore();
    }
  });

  it("should show text too short when algo has zero capacity", async function () {
    var dom = docwSetupDom();
    try {
      dom.els["docw-algo"].value = "99";
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("some text data");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwCoverFile({ target: { files: [{ name: "test.txt" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(dom.els["docw-capacity"].textContent.includes("too short"));
      assert.equal(dom.els["docw-capacity"].style.color, "#e74c3c");
    } finally {
      _docwCoverText = "";
      delete globalThis.FileReader;
      dom.restore();
    }
  });
});

// ── loadDocwExtractFile (FileReader-based extraction loader) ──

describe("Document Watermark UI - loadDocwExtractFile", function () {
  afterEach(function () {
    delete globalThis.FileReader;
    _docwExtractText = "";
  });

  function makeReadableBuf(text) {
    return new TextEncoder().encode(text).buffer;
  }

  it("should load a TXT file for extraction", async function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        onprogress: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("watermarked text content");
          if (typeof fr.onprogress === 'function')
            fr.onprogress({ lengthComputable: true, loaded: 24, total: 24 });
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo-ex"].value = "1";
      loadDocwExtractFile({ target: { files: [{ name: "wm.txt" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(_docwExtractText.length > 0, "text should be extracted");
      assert.ok(dom.els["docw-extract-name"].textContent.includes("wm.txt"));
      assert.equal(dom.els["docw-extract-name"].style.color, "#2ecc71");
    } finally { _docwExtractText = ""; dom.restore(); }
  });

  it("should load a DOCX file for extraction", async function () {
    var dom = docwSetupDom();
    try {
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("docx content");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo-ex"].value = "1";
      loadDocwExtractFile({ target: { files: [{ name: "watermarked.docx" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(_docwExtractText.length > 0, "should extract docx text");
    } finally { _docwExtractText = ""; dom.restore(); }
  });

  it("should handle extraction error via callback", async function () {
    var dom = docwSetupDom();
    var alertMsg = "";
    globalThis.alert = function (m) { alertMsg = m; };
    try {
      // Make DOCX_EXTRACTOR.readPdf reject to trigger the error callback path
      globalThis.DOCX_EXTRACTOR.readPdf = function () { return Promise.reject(new Error("PDF extraction error")); };
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("data");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      dom.els["docw-algo-ex"].value = "1";
      loadDocwExtractFile({ target: { files: [{ name: "test.pdf" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.ok(alertMsg.includes("PDF extraction failed"), "should report PDF error");
    } finally {
      _docwExtractText = "";
      delete globalThis.alert;
      // Restore readPdf mock
      globalThis.DOCX_EXTRACTOR.readPdf = function (buf) { return Promise.resolve("extracted text"); };
      dom.restore();
    }
  });

  it("should clear capacity when algo has zero capacity", async function () {
    var dom = docwSetupDom();
    try {
      dom.els["docw-algo-ex"].value = "99";
      var fr = {
        result: null,
        onload: null,
        readAsArrayBuffer: function () {
          fr.result = makeReadableBuf("some text data");
          if (typeof fr.onload === 'function')
            fr.onload({ target: { result: fr.result } });
        }
      };
      globalThis.FileReader = function () { return fr; };
      loadDocwExtractFile({ target: { files: [{ name: "test.txt" }] } });
      await new Promise(function (r) { setTimeout(r, 100); });
      assert.equal(dom.els["docw-ex-capacity"].textContent, "");
    } finally {
      _docwExtractText = "";
      delete globalThis.FileReader;
      dom.restore();
    }
  });

  it("should return early when no file selected", function () {
    var dom = docwSetupDom();
    try {
      loadDocwExtractFile({ target: { files: [] } });
      _docwExtractText = "";
    } finally { dom.restore(); }
  });
});

// ── _buildPayloadForHomoglyph (homoglyph payload builder) ──

describe("Document Watermark UI - _buildPayloadForHomoglyph", function () {
  before(function () {
    if (typeof DOCW_HOMOGLYPH !== 'undefined') {
      DOCW_HOMOGLYPH._initReverse();
    }
  });

  // Homoglyph provides 2 bits per eligible uppercase char.
  // Each ASCII char in payload needs ~8 bits.
  // So we need ~4 eligible uppercase chars per payload char.
  function eligibleText(count) {
    // Repeat groups of uppercase letters to build capacity
    return Array(Math.ceil(count / 26)).fill("ABCDEFGHIJKLMNOPQRSTUVWXYZ").join("");
  }

  it("should build payload with fingerprint data", async function () {
    var data = {
      file_info: { file_name: "photo.jpg", width: 1920, height: 1080, file_size_bytes: 12345 },
      hashes: { "SHA-256": "abc123def456", "MD5": "md5hash" },
      perceptual_hashes: { dHash: "dhashval", pHash: "phashval" },
    };
    // ~107 payload chars * 8 bits / 2 bits-per-char = ~428 eligible uppercase needed
    var coverText = eligibleText(600);
    var result = await _buildPayloadForHomoglyph(data, "password", coverText);
    assert.ok(typeof result === "string", "payload should be a string");
    assert.ok(result.length > 0, "payload should not be empty");
    assert.ok(result.includes("photo.jpg"), "should include file info");
    assert.ok(result.includes("SHA-256"), "should include SHA-256");
    assert.ok(result.includes("MD5"), "should include MD5");
    assert.ok(result.includes("dHash"), "should include perceptual hashes");
    assert.ok(result.includes("pHash"), "should include perceptual hashes");
  });

  it("should include remaining hashes not in priority list", async function () {
    var data = {
      hashes: { "CUSTOM-HASH": "customval", "SHA-256": "abc123" },
    };
    // ~25 payload chars * 8 / 2 = ~100 eligible uppercase needed
    var coverText = eligibleText(200);
    var result = await _buildPayloadForHomoglyph(data, "", coverText);
    assert.ok(result.includes("CUSTOM-HASH"), "should include custom hash");
    assert.ok(result.includes("SHA-256"), "should include SHA-256");
  });

  it("should throw when cover text has no eligible characters", async function () {
    var data = { hashes: { "SHA-256": "abc123" } };
    var coverText = "\u0100\u0101\u0102";
    await assert.rejects(
      async function () {
        await _buildPayloadForHomoglyph(data, "pw", coverText);
      },
      /Cover text has no eligible characters/,
    );
  });

  it("should throw when first entry doesn't fit maxBits", async function () {
    var data = { hashes: { "SHA-256": "abc123" } };
    var coverText = "A";
    await assert.rejects(
      async function () {
        await _buildPayloadForHomoglyph(data, "password", coverText);
      },
      /Text too short|Cover text has no eligible characters/,
    );
  });

  it("should fall back to SHA-256 value when only hash fits", async function () {
    var data = {
      file_info: { file_name: "test.jpg" },
      hashes: { "SHA-256": "x" },
    };
    // "SHA-256: x" = 10 chars = ~80 bits → need 40 eligible uppercase
    // "File: test.jpg (? bytes)" = 22 chars = ~176 bits → need 88 eligible
    // With 45 eligible: 45*2=90 bits, enough for "x" (80 bits) but not for the file entry (176 bits)
    var coverText = eligibleText(50);
    var result = await _buildPayloadForHomoglyph(data, "", coverText);
    assert.equal(result, "x");
  });

  it("should build payload without file_info present", async function () {
    var data = {
      hashes: { "SHA-256": "abc123" },
    };
    // ~10 payload chars * 8 / 2 = ~40 eligible uppercase needed
    var coverText = eligibleText(80);
    var result = await _buildPayloadForHomoglyph(data, "", coverText);
    assert.ok(result.includes("SHA-256"), "should include SHA-256");
    assert.ok(!result.includes("File:"), "should not have file_info");
  });

  it("should build payload with perceptual hashes only", async function () {
    var data = {
      perceptual_hashes: { dHash: "abc", pHash: "def", wHash: "ghi" },
    };
    // ~32 payload chars * 8 / 2 = ~128 eligible uppercase needed (plus _msgToBits overhead)
    var coverText = eligibleText(300);
    var result = await _buildPayloadForHomoglyph(data, "", coverText);
    assert.ok(result.includes("dHash"), "should include dHash");
    assert.ok(result.includes("pHash"), "should include pHash");
    assert.ok(result.includes("wHash"), "should include wHash");
  });

  it("should handle file_info without file_name or file_size", async function () {
    var data = {
      file_info: { width: 100, height: 200 },
      hashes: { "SHA-256": "a" },
    };
    // "File: unknown 100x200 (? bytes)" = 27 chars = ~216 bits → need ~108 eligible uppercase
    var coverText = eligibleText(200);
    var result = await _buildPayloadForHomoglyph(data, "", coverText);
    assert.ok(result.includes("unknown"), "should use 'unknown' for missing file_name");
  });

  it("should handle empty password in error path", async function () {
    var data = { hashes: { "SHA-256": "abc123" } };
    var coverText = "A";
    await assert.rejects(
      async function () {
        await _buildPayloadForHomoglyph(data, "", coverText);
      },
      /Text too short/,
    );
  });
});
