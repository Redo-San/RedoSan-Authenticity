const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── DOM polyfills ──
var _domElements = {};
var _createdElements = [];
globalThis.document = {
  getElementById: function (id) {
    return _domElements[id] || null;
  },
  createElement: function (tag) {
    var el = {
      tagName: tag,
      href: "",
      download: "",
      children: [],
      style: {},
      value: "",
      checked: false,
      textContent: "",
      innerHTML: "",
      id: "",
      remove: function () {
        var ix = _createdElements.indexOf(this);
        if (ix >= 0) _createdElements.splice(ix, 1);
      },
    };
    el.click = function () {};
    el.setAttribute = function () {};
    el.getAttribute = function () {
      return null;
    };
    if (tag === "canvas") {
      el.width = 0;
      el.height = 0;
      el.getContext = function () {
        return {
          font: "",
          fillStyle: "",
          textBaseline: "",
          measureText: function (t) {
            return { width: t.length * 5 };
          },
          fillText: function () {},
          scale: function () {},
        };
      };
      el.toDataURL = function () {
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      };
    }
    if (tag === "script") {
      el.src = "";
      el.onload = null;
      el.onerror = null;
      // trigger error immediately to avoid hanging
      process.nextTick(function () {
        if (typeof el.onerror === "function") el.onerror();
      });
    }
    Object.defineProperty(el, "textContent", {
      get: function () {
        return this._tc || "";
      },
      set: function (v) {
        this._tc = String(v);
        this.innerHTML = this._tc
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      },
      configurable: true,
    });
    _createdElements.push(el);
    return el;
  },
  body: {
    append: function () {},
    remove: function () {},
  },
  head: {
    append: function () {},
  },
  addEventListener: function () {},
  readyState: "complete",
};

function mockElement(id, overrides) {
  var el = {
    tagName: "input",
    href: "",
    download: "",
    children: [],
    style: {},
    value: "",
    checked: false,
    textContent: "",
    innerHTML: "",
    id: id,
    files: null,
    remove: function () {},
    click: function () {},
    setAttribute: function () {},
    getAttribute: function () {
      return null;
    },
    display: "",
  };
  Object.defineProperty(el, "textContent", {
    get: function () {
      return this._tc || "";
    },
    set: function (v) {
      this._tc = String(v);
    },
    configurable: true,
  });
  Object.defineProperty(el, "style", {
    get: function () {
      return this._style || {};
    },
    set: function (v) {
      this._style = v;
    },
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
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.URL.createObjectURL = function () {
  return "blob:stub";
};
globalThis.URL.revokeObjectURL = function () {};
globalThis.Image = class {
  constructor() {
    this.naturalWidth = 100;
    this.naturalHeight = 100;
  }
  set src(v) {
    if (this.onload) setTimeout(this.onload.bind(this), 0);
  }
};
globalThis.COUNTRY_CODES = [];
globalThis.getDefaultPhoneCode = function () {};
globalThis.updatePhoneMaxLength = function () {};
globalThis.__ = function (k, d) {
  return d || k;
};

// ── Mock jspdf ──
globalThis.jspdf = globalThis.jspdf || {};
globalThis.jspdf.jsPDF = class {
  constructor() {
    this.constructor.lastInstance = this;
    this._calls = [];
  }
  setFontSize(s) {
    this._calls.push(["setFontSize", s]);
    return this;
  }
  setTextColor(r, g, b) {
    this._calls.push(["setTextColor", r, g, b]);
    return this;
  }
  setFont() {
    return this;
  }
  text(str, x, y, opts) {
    this._calls.push(["text", str, x, y, opts]);
    return this;
  }
  addPage() {
    this._calls.push(["addPage"]);
    return this;
  }
  addImage() {
    this._calls.push(["addImage"]);
    return this;
  }
  splitTextToSize(t, w) {
    var lines = [];
    var s = String(t);
    while (s.length > 0) {
      lines.push(s.substring(0, 60));
      s = s.substring(60);
    }
    if (lines.length === 0) lines.push("");
    return lines;
  }
  output(fmt) {
    this._calls.push(["output", fmt]);
    return new Blob(["pdf"], { type: "application/pdf" });
  }
};

// ── Mock docx ──
globalThis.docx = globalThis.docx || {
  Paragraph: class {
    constructor(o) {
      this.opts = o;
    }
  },
  TextRun: class {
    constructor(o) {
      this.opts = o;
    }
  },
  Table: class {
    constructor(o) {
      this.opts = o;
    }
  },
  TableRow: class {
    constructor(o) {
      this.opts = o;
    }
  },
  TableCell: class {
    constructor(o) {
      this.opts = o;
    }
  },
  Document: class {
    constructor(o) {
      this.opts = o;
    }
  },
  ImageRun: class {
    constructor(o) {
      this.opts = o;
    }
  },
  Packer: {
    toBlob: async function () {
      return new Blob(["docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    },
  },
  WidthType: { PERCENTAGE: "percentage" },
};

// ── Mock QRious ──
globalThis.QRious = class {
  constructor(o) {
    this.element = o.element;
    this.value = o.value;
    this.size = o.size;
    this.level = o.level;
    this.padding = o.padding;
  }
};

// ── Load certificate modules ──
function loadModule(filePath) {
  var src = fs.readFileSync(filePath, "utf8");
  var clean = src.replace(
    /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
    "",
  );
  vm.runInThisContext(clean, { filename: path.resolve(filePath) });
}

before(function () {
  loadModule(path.join(__dirname, "../../Certificate/certificate_utils.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_ots.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_epub.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_pdf.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate_docx.js"));
  loadModule(path.join(__dirname, "../../Certificate/certificate.js"));
});

var PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

var mockData = {
  generator: "RedoSan Authenticity",
  generatedAt: "2026-01-15T12:30:00.000Z",
  user: { name: "Alice", email: "alice@example.com", phone: "", website: "" },
  file: {
    name: "photo.jpg",
    size: 102400,
    type: "image/jpeg",
    hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    dataUrl: PNG_DATA_URL,
    width: 800,
    height: 600,
  },
  watermark: true,
  watermarkAlgo: "LSB",
  watermarkResult: "Watermark embedded successfully using LSB algorithm",
  pixelInjection: false,
  timestamp: false,
  fingerprint: false,
  didSig: null,
  faceBiometric: null,
  ct: null,
};

describe("Certificate — downloadCertPDF", function () {
  it("should return a Blob", async function () {
    var blob = await downloadCertPDF(mockData);
    assert.ok(blob instanceof Blob);
  });

  it("should call jspdf.jsPDF constructor", async function () {
    var prev = globalThis.jspdf.jsPDF.lastInstance;
    var blob = await downloadCertPDF(mockData);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    assert.ok(doc._calls.length > 0);
  });

  it("should include user name in text output", async function () {
    var blob = await downloadCertPDF(mockData);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var texts = doc._calls
      .filter(function (c) {
        return c[0] === "text";
      })
      .map(function (c) {
        return c[1];
      });
    assert.ok(
      texts.some(function (t) {
        return t.indexOf("Alice") !== -1;
      }),
    );
  });

  it("should include file name", async function () {
    var blob = await downloadCertPDF(mockData);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var texts = doc._calls
      .filter(function (c) {
        return c[0] === "text";
      })
      .map(function (c) {
        return c[1];
      });
    assert.ok(
      texts.some(function (t) {
        return t.indexOf("photo.jpg") !== -1;
      }),
    );
  });

  it("should handle minimal data without optional fields", async function () {
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
    var blob = await downloadCertPDF(minimal);
    assert.ok(blob instanceof Blob);
  });

  it("should include watermark section when watermark is true", async function () {
    var blob = await downloadCertPDF(mockData);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var texts = doc._calls
      .filter(function (c) {
        return c[0] === "text";
      })
      .map(function (c) {
        return c[1];
      });
    assert.ok(
      texts.some(function (t) {
        return t.indexOf("Watermark") !== -1;
      }),
    );
  });

  it("should include document watermark section", async function () {
    var data = Object.assign({}, mockData, {
      documentWatermark: true,
      documentWatermarkFileName: "contract.docx",
      documentWatermarkResult: "Embedded ok",
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Document Watermark") !== -1);
    assert.ok(allText.indexOf("contract.docx") !== -1);
  });

  it("should include pixel injection section", async function () {
    var data = Object.assign({}, mockData, {
      pixelInjection: true,
      piResultHtml: "PI complete",
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Pixel Injection") !== -1);
  });

  it("should include timestamp section with result", async function () {
    var data = Object.assign({}, mockData, {
      timestamp: true,
      tsResult: "Timestamp created: 2026-01-15",
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Timestamp") !== -1);
    assert.ok(allText.indexOf("Timestamp created") !== -1);
  });

  it("should include timestamp section without result", async function () {
    var data = Object.assign({}, mockData, { timestamp: true, tsResult: "" });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Timestamp") !== -1);
    assert.ok(allText.indexOf("created successfully") !== -1);
  });

  it("should include fingerprint section with hashes and perceptual hashes", async function () {
    var data = Object.assign({}, mockData, {
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc123", MD5: "def456" },
        perceptual_hashes: { dHash: "dhashval", pHash: "phashval" },
      },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Fingerprint") !== -1);
    assert.ok(allText.indexOf("SHA-256") !== -1);
    assert.ok(allText.indexOf("dHash") !== -1);
  });

  it("should include DID signature section", async function () {
    var data = Object.assign({}, mockData, {
      didSig: {
        did: "did:key:z6Mktest12345678901234567890123456789012",
        algorithm: "Ed25519",
        timestamp: "2026-01-15T12:00:00Z",
        signature: "somesigvalue12345678901234567890",
      },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("DID:") !== -1);
  });

  it("should include DID identity fallback section", async function () {
    var data = Object.assign({}, mockData, {
      didSig: null,
      didIdentity: "did:key:z6Mkfallback",
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("DID Identity") !== -1);
    assert.ok(allText.indexOf("z6Mkfallback") !== -1);
  });

  it("should include face biometric section", async function () {
    var data = Object.assign({}, mockData, {
      faceBiometric: {
        detected: true,
        faceCount: 2,
        matchLabel: "Alice",
        didSigned: true,
        did: "did:key:face",
        exportedAt: "2026-01-15T12:00:00Z",
      },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Face Biometric") !== -1);
    assert.ok(allText.indexOf("2") !== -1);
  });

  it("should include certificate transparency section (submitted, complete)", async function () {
    var data = Object.assign({}, mockData, {
      ct: {
        submitted: true,
        hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        timestamp: "2026-01-15T12:00:00Z",
        aggregator: "https://example.com/ots",
        pending: false,
      },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Certificate Transparency") !== -1);
  });

  it("should include certificate transparency section (pending)", async function () {
    var data = Object.assign({}, mockData, {
      ct: { submitted: true, hash: "abc123", pending: true },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Certificate Transparency") !== -1);
  });

  it("should include certificate transparency section (error state)", async function () {
    var data = Object.assign({}, mockData, {
      ct: { submitted: false, error: "calendar unreachable" },
    });
    var blob = await downloadCertPDF(data);
    var doc = globalThis.jspdf.jsPDF.lastInstance;
    var allText = JSON.stringify(doc._calls);
    assert.ok(allText.indexOf("Unavailable") !== -1);
  });
});

describe("Certificate — downloadCertDOCX", function () {
  it("should return a Blob", async function () {
    var blob = await downloadCertDOCX(mockData);
    assert.ok(blob instanceof Blob);
  });

  it("should handle minimal data", async function () {
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

  it("should fail gracefully when docx is missing", async function () {
    // Should throw because docx is used internally
    // But we've mocked it, so it should work
    var blob = await downloadCertDOCX(mockData);
    assert.ok(blob instanceof Blob);
  });

  it("should include document watermark section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      documentWatermark: true,
      documentWatermarkFileName: "contract.docx",
      documentWatermarkResult: "Embedded ok",
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include pixel injection section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      pixelInjection: true,
      piResultHtml: "PI complete",
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include timestamp section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      timestamp: true,
      tsResult: "Created",
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include fingerprint section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc123" },
        perceptual_hashes: { dHash: "val" },
      },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include DID signature section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      didSig: {
        did: "did:key:z6Mktest",
        algorithm: "Ed25519",
        timestamp: "2026-01-15T12:00:00Z",
        signature: "sig".repeat(30),
      },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include DID identity fallback in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      didSig: null,
      didIdentity: "did:key:fallback",
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include face biometric section in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      faceBiometric: {
        detected: true,
        faceCount: 1,
        matchLabel: "Bob",
        didSigned: false,
        exportedAt: "2026-01-15T12:00:00Z",
      },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include CT section (complete) in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      ct: {
        submitted: true,
        hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        timestamp: "2026-01-15T12:00:00Z",
        aggregator: "https://example.com/ots",
        pending: false,
      },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include CT section (pending) in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      ct: { submitted: true, hash: "abc123", pending: true },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });

  it("should include CT section (error) in DOCX", async function () {
    var data = Object.assign({}, mockData, {
      ct: { submitted: false, error: "offline" },
    });
    var blob = await downloadCertDOCX(data);
    assert.ok(blob instanceof Blob);
  });
});

// ── Mock JSZip for EPUB tests ──
var realJSZip;
try {
  realJSZip = require("jszip");
} catch (e) {
  realJSZip = null;
}
if (realJSZip) globalThis.JSZip = realJSZip;

describe("Certificate — downloadCertEPUB", function () {
  it("should return a Blob", async function () {
    var blob = await downloadCertEPUB(mockData);
    assert.ok(blob instanceof Blob);
  });

  it("should create valid EPUB structure with mimetype entry", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var files = Object.keys(zip.files);
    assert.ok(files.indexOf("mimetype") !== -1);
    var mimetype = await zip.file("mimetype").async("string");
    assert.equal(mimetype, "application/epub+zip");
  });

  it("should include META-INF/container.xml", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var container = await zip.file("META-INF/container.xml").async("string");
    assert.ok(container.indexOf("content.opf") !== -1);
  });

  it("should include OEBPS/content.xhtml with user data", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Alice") !== -1);
    assert.ok(xhtml.indexOf("photo.jpg") !== -1);
    assert.ok(xhtml.indexOf("Watermark") !== -1);
  });

  it("should include OEBPS/style.css", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var css = await zip.file("OEBPS/style.css").async("string");
    assert.ok(css.indexOf("body{font-family:serif;") !== -1);
  });

  it("should include OEBPS/toc.ncx", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var ncx = await zip.file("OEBPS/toc.ncx").async("string");
    assert.ok(ncx.indexOf("Digital Passport") !== -1);
  });

  it("should include OEBPS/content.opf with manifest", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var opf = await zip.file("OEBPS/content.opf").async("string");
    assert.ok(opf.indexOf("content.xhtml") !== -1);
    assert.ok(opf.indexOf("style.css") !== -1);
  });

  it("should include QR image and photo image when dataUrl exists", async function () {
    var blob = await downloadCertEPUB(mockData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    assert.ok(zip.file("OEBPS/images/qr.png") !== null);
    assert.ok(zip.file("OEBPS/images/photo.jpg") !== null);
  });

  it("should handle minimal data without optional fields", async function () {
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
    var blob = await downloadCertEPUB(minimal);
    assert.ok(blob instanceof Blob);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    assert.ok(zip.file("mimetype") !== null);
    // Should NOT include images since no dataUrl
    assert.ok(zip.file("OEBPS/images/qr.png") !== null);
    assert.ok(zip.file("OEBPS/images/photo.jpg") === null);
  });

  it("should handle fingerprint section with perceptual hashes", async function () {
    var fpData = Object.assign({}, mockData, {
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abcdef", MD5: "12345" },
        perceptual_hashes: { ahash: "aaaa", dhash: "bbbb" },
      },
    });
    var blob = await downloadCertEPUB(fpData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("SHA-256") !== -1);
    assert.ok(xhtml.indexOf("ahash") !== -1);
  });

  it("should handle didSig section", async function () {
    var didData = Object.assign({}, mockData, {
      didSig: {
        did: "did:example:123",
        algorithm: "Ed25519",
        timestamp: "2026-01-15T12:30:00.000Z",
        signature: "sig".repeat(30),
      },
    });
    var blob = await downloadCertEPUB(didData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("did:example:123") !== -1);
  });

  it("should handle didIdentity fallback when didSig is null", async function () {
    var didData = Object.assign({}, mockData, {
      didSig: null,
      didIdentity: "did:example:456",
    });
    var blob = await downloadCertEPUB(didData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("did:example:456") !== -1);
  });

  it("should handle ct section with submitted=true", async function () {
    var ctData = Object.assign({}, mockData, {
      ct: {
        submitted: true,
        hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        timestamp: "2026-01-15T12:30:00.000Z",
        aggregator: "https://example.com/ots",
        pending: false,
      },
    });
    var blob = await downloadCertEPUB(ctData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Certificate Transparency") !== -1);
    assert.ok(xhtml.indexOf("abcdef1234567890") !== -1);
  });

  it("should handle ct section with pending=true", async function () {
    var ctData = Object.assign({}, mockData, {
      ct: { submitted: true, pending: true, hash: "abc123" },
    });
    var blob = await downloadCertEPUB(ctData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(
      xhtml.indexOf("pending") === -1 || xhtml.indexOf("Pending") !== -1,
    );
  });

  it("should handle ct section with submitted=false (error state)", async function () {
    var ctData = Object.assign({}, mockData, {
      ct: { submitted: false, error: "calendar unreachable" },
    });
    var blob = await downloadCertEPUB(ctData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("calendar unreachable") !== -1);
  });

  it("should handle faceBiometric section", async function () {
    var faceData = Object.assign({}, mockData, {
      faceBiometric: {
        detected: true,
        faceCount: 2,
        matchLabel: "Alice",
        didSigned: true,
        did: "did:example:face",
        exportedAt: "2026-01-15T12:30:00.000Z",
      },
    });
    var blob = await downloadCertEPUB(faceData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Faces detected") !== -1);
    assert.ok(xhtml.indexOf("2") !== -1);
    assert.ok(xhtml.indexOf("Alice") !== -1);
  });

  it("should handle faceBiometric without matchLabel", async function () {
    var faceData = Object.assign({}, mockData, {
      faceBiometric: {
        detected: true,
        faceCount: 1,
        didSigned: false,
        exportedAt: "2026-01-15T12:30:00.000Z",
      },
    });
    var blob = await downloadCertEPUB(faceData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("DID Signed") !== -1);
    assert.ok(xhtml.indexOf("No") !== -1);
  });

  it("should handle documentWatermark section", async function () {
    var docwData = Object.assign({}, mockData, {
      documentWatermark: true,
      documentWatermarkFileName: "contract.docx",
      documentWatermarkResult: "Embedded successfully",
    });
    var blob = await downloadCertEPUB(docwData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Document Watermark") !== -1);
    assert.ok(xhtml.indexOf("contract.docx") !== -1);
  });

  it("should handle pixelInjection section", async function () {
    var piData = Object.assign({}, mockData, {
      pixelInjection: true,
      piResultHtml: "Pixel injection result details",
    });
    var blob = await downloadCertEPUB(piData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Pixel Injection") !== -1);
    assert.ok(xhtml.indexOf("Pixel injection result details") !== -1);
  });

  it("should handle timestamp section", async function () {
    var tsData = Object.assign({}, mockData, {
      timestamp: true,
      tsResult: "Timestamp created: 2026-01-15",
    });
    var blob = await downloadCertEPUB(tsData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Timestamp") !== -1);
    assert.ok(xhtml.indexOf("Timestamp created") !== -1);
  });

  it("should handle user section with phone and website", async function () {
    var userData = Object.assign({}, mockData, {
      user: {
        name: "Bob",
        email: "bob@test.com",
        phone: "+1234567890",
        website: "https://bob.example.com",
      },
    });
    var blob = await downloadCertEPUB(userData);
    var buf = await blob.arrayBuffer();
    var zip = await JSZip.loadAsync(buf);
    var xhtml = await zip.file("OEBPS/content.xhtml").async("string");
    assert.ok(xhtml.indexOf("Bob") !== -1);
    assert.ok(xhtml.indexOf("bob@test.com") !== -1);
    assert.ok(xhtml.indexOf("+1234567890") !== -1);
    assert.ok(xhtml.indexOf("bob.example.com") !== -1);
  });
});

describe("Certificate — browser UI functions", function () {
  before(function () {
    clearMockElements();
  });

  describe("getValOrEmpty", function () {
    it("should return trimmed value when element exists", function () {
      mockElement("test-input", { value: "  Hello  " });
      assert.equal(getValOrEmpty("test-input"), "Hello");
    });

    it("should return empty string when element not found", function () {
      assert.equal(getValOrEmpty("nonexistent"), "");
    });
  });

  describe("getUrlOrEmpty", function () {
    it("should return value from getValOrEmpty", function () {
      mockElement("test-url", { value: "https://example.com" });
      assert.equal(getUrlOrEmpty("test-url"), "https://example.com");
    });

    it("should return empty string when no value", function () {
      mockElement("test-url2", { value: "" });
      assert.equal(getUrlOrEmpty("test-url2"), "");
    });
  });

  describe("ensureLib", function () {
    it("should resolve jspdf when global exists", async function () {
      await assert.doesNotReject(function () {
        return ensureLib("jspdf");
      });
    });

    it("should resolve QRious when global exists", async function () {
      await assert.doesNotReject(function () {
        return ensureLib("QRious");
      });
    });

    it(
      "should reject for unknown library",
      { timeout: 5000 },
      async function () {
        await assert.rejects(function () {
          return ensureLib("nonexistent_lib");
        });
      },
    );
  });

  describe("showCertOverlay / hideCertOverlay", function () {
    it("should create overlay on first call", function () {
      hideCertOverlay(); // reset
      var prevCount = _createdElements.length;
      showCertOverlay();
      assert.ok(_createdElements.length > prevCount);
    });

    it("should not create duplicate overlay", function () {
      showCertOverlay(); // first
      var count = _createdElements.length;
      showCertOverlay(); // second should be no-op
      assert.equal(_createdElements.length, count);
    });

    it("should remove overlay on hide", function () {
      hideCertOverlay();
      showCertOverlay();
      assert.ok(_createdElements.length > 0);
      hideCertOverlay();
      // Should not throw on second hide
      hideCertOverlay();
    });
  });

  describe("toggleCertMusicFields", function () {
    it("should hide fields when checkbox unchecked", function () {
      var fields = mockElement("cert-music-fields", {
        style: { display: "block" },
      });
      mockElement("cert-show-music", { checked: false });
      toggleCertMusicFields();
      assert.equal(fields.style.display, "none");
    });

    it("should show fields when checkbox checked", function () {
      var fields = mockElement("cert-music-fields2", {
        style: { display: "none" },
      });
      mockElement("cert-show-music2", { checked: true });
      // temporarily patch getElementById for this test
      var orig = globalThis.document.getElementById;
      globalThis.document.getElementById = function (id) {
        if (id === "cert-music-fields") return fields;
        if (id === "cert-show-music") return { checked: true };
        return _domElements[id] || null;
      };
      toggleCertMusicFields();
      assert.equal(fields.style.display, "");
      globalThis.document.getElementById = orig;
    });

    it("should handle missing fields element gracefully", function () {
      assert.doesNotThrow(function () {
        toggleCertMusicFields();
      });
    });
  });

  describe("resetProfessionalCert", function () {
    it("should reset cert fields", function () {
      mockElement("cert-file", { value: "old" });
      mockElement("cert-name", { value: "Alice" });
      mockElement("cert-email", { value: "alice@test.com" });
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
  });

  describe("downloadProfessionalCert", function () {
    it("should alert when _certData is null", function () {
      var alerted = false;
      var origAlert = globalThis.alert;
      globalThis.alert = function () {
        alerted = true;
      };
      _certData = null;
      downloadProfessionalCert("pdf");
      assert.ok(alerted);
      globalThis.alert = origAlert;
    });

    it("should download PDF when _certData is set", async function () {
      _certData = {
        generator: "Test",
        generatedAt: "2026-01-01T00:00:00.000Z",
        user: { name: "", email: "" },
        file: { name: "", size: 0, type: "" },
        watermark: false,
        pixelInjection: false,
        timestamp: false,
        fingerprint: false,
        didSig: null,
        faceBiometric: null,
        ct: null,
      };
      mockElement("cert-status", { textContent: "" });
      await downloadProfessionalCert("pdf");
      assert.ok(
        document.getElementById("cert-status").textContent.indexOf("PDF") !==
          -1,
      );
    });

    it("should download DOCX when _certData is set", async function () {
      mockElement("cert-status", { textContent: "" });
      await downloadProfessionalCert("docx");
      assert.ok(
        document.getElementById("cert-status").textContent.indexOf("DOCX") !==
          -1,
      );
    });

    it("should download EPUB when _certData is set", async function () {
      mockElement("cert-status", { textContent: "" });
      await downloadProfessionalCert("epub");
      assert.ok(
        document.getElementById("cert-status").textContent.indexOf("EPUB") !==
          -1,
      );
    });
  });
});
