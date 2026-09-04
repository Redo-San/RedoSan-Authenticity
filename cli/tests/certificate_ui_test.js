const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.devicePixelRatio = 1;
globalThis.URL.createObjectURL =
  globalThis.URL.createObjectURL || (() => "blob:stub");
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {});
globalThis.getResult =
  globalThis.getResult ||
  function () {
    return null;
  };
globalThis.setResult = globalThis.setResult || function () {};

var elMap = {};
var elStore = {};
globalThis.document = {
  getElementById: function (id) {
    if (!elStore[id]) {
      elStore[id] = {
        value: "",
        style: {},
        checked: false,
        display: "",
        files: null,
        disabled: false,
        textContent: "",
        maxLength: -1,
        onclick: null,
        classList: { add: function () {}, remove: function () {} },
      };
    }
    return elStore[id];
  },
  readyState: "complete",
  createElement: function (t) {
    if (t === "div") {
      var d = {
        _text: "",
        get textContent() {
          return this._text;
        },
        set textContent(v) {
          this._text = v;
          this.innerHTML = String(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        },
        innerHTML: "",
        style: {},
        remove: function () {},
      };
      return d;
    }
    if (t === "canvas") {
      var ctx = {
        _font: "",
        get font() {
          return this._font;
        },
        set font(v) {
          this._font = v;
        },
        measureText: function (t) {
          return { width: t.length * 10 };
        },
        fillStyle: "",
        textBaseline: "",
        fillText: function () {},
        scale: function () {},
      };
      return {
        getContext: function () {
          return ctx;
        },
        toDataURL: function () {
          return "data:image/png;base64,iVBORw0KGgo=";
        },
        width: 0,
        height: 0,
      };
    }
    if (t === "script") {
      return { src: "", onload: null, onerror: null };
    }
    if (t === "select") {
      var sel = { value: "", innerHTML: "", style: {} };
      elStore["cert-phonecode"] = sel;
      return sel;
    }
    if (t === "option") {
      return { value: "", text: "", selected: false, style: {} };
    }
    if (t === "a") {
      return {
        href: "",
        download: "",
        style: {},
        click: function () {},
        remove: function () {},
      };
    }
    if (t === "style") {
      var s = { id: "", textContent: "" };
      return s;
    }
    if (t === "span") {
      return { style: {} };
    }
    return {};
  },
  head: { append: function () {} },
  body: { append: function () {} },
  addEventListener: function () {},
};

globalThis.__ =
  globalThis.__ ||
  function (k, d) {
    return d || k;
  };
globalThis.COUNTRY_CODES = [
  { code: "US", dial: "+1", name: "USA", len: 10 },
  { code: "GB", dial: "+44", name: "UK", len: 10 },
  { code: "SA", dial: "+966", name: "السعودية", len: 9 },
];

globalThis.TextEncoder = globalThis.TextEncoder || require("util").TextEncoder;

var mockJspdfDoc = {
  _pages: 1,
  _font: undefined,
  _fontSize: 9,
  setFontSize: function (s) {
    this._fontSize = s;
  },
  setFont: function (_, b) {
    this._font = b;
  },
  text: function () {},
  addImage: function () {},
  addPage: function () {
    this._pages++;
  },
  splitTextToSize: function (t) {
    return [t];
  },
  output: function () {
    return new Blob(["pdf"]);
  },
};
globalThis.jspdf = {
  jsPDF: function () {
    return Object.create(mockJspdfDoc);
  },
};

var mockQRious = function (opts) {
  if (opts && opts.element && opts.element.toDataURL) {
    opts.element.toDataURL = function () {
      return "data:image/png;base64,cXJjb2Rl";
    };
  }
};
globalThis.QRious = mockQRious;

globalThis.docx = {
  Paragraph: function (opts) {
    this.opts = opts || {};
  },
  TextRun: function (opts) {
    this.opts = opts || {};
  },
  ImageRun: function (opts) {
    this.opts = opts || {};
  },
  Document: function (opts) {
    this.opts = opts;
  },
  Packer: {
    toBlob: async function () {
      return new Blob(["docx"]);
    },
  },
};

var mockZipInstance = {
  file: function () {
    return this;
  },
  folder: function () {
    var f = {
      file: function () {
        return mockZipInstance;
      },
      folder: function () {
        return f;
      },
    };
    return f;
  },
  generateAsync: async function () {
    return new Blob(["epub"]);
  },
};
globalThis.JSZip = function () {
  return Object.create(mockZipInstance);
};

var mockOtsOps = {
  OpSHA256: function () {},
  OpAppend: function (d) {
    this.data = d;
  },
};
var mockOts = {
  DetachedTimestampFile: {
    fromHash: function (op, hash) {
      return {
        timestamp: {
          add: function (op) {
            var t = {
              add: function (op2) {
                return { attestations: [] };
              },
            };
            return t;
          },
        },
        serializeToBytes: function () {
          return new Uint8Array([1, 2, 3]);
        },
      };
    },
  },
  Ops: mockOtsOps,
  Utils: {
    randBytes: function (n) {
      return new Uint8Array(n);
    },
    arrayToBytes: function (a) {
      return a;
    },
  },
  Notary: {
    PendingAttestation: function (url) {
      this.url = url;
    },
  },
};
globalThis.OpenTimestamps = mockOts;

var loadCount = 0;
var srcPaths = [
  "../../Certificate/certificate_utils.js",
  "../../Certificate/certificate_ots.js",
  "../../Certificate/certificate_pdf.js",
  "../../Certificate/certificate_docx.js",
  "../../Certificate/certificate_epub.js",
  "../../Certificate/certificate.js",
];
srcPaths.forEach(function (rel) {
  var src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  var clean = src.replace(
    /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
    "",
  );
  vm.runInThisContext(clean, {
    filename: path.resolve(
      __dirname,
      "../../Certificate/" + path.basename(rel),
    ),
  });
});

function resetEls() {
  Object.keys(elStore).forEach(function (k) {
    var el = elStore[k];
    el.value = "";
    el.style = {};
    el.checked = false;
    el.display = "";
    el.files = null;
    el.disabled = false;
    el.textContent = "";
    el.maxLength = -1;
  });
}

// ── Tests ──

describe("Certificate UI — initCertPhoneCode", function () {
  before(function () {
    resetEls();
  });

  it("should build select options when element exists", function () {
    var sel = document.getElementById("cert-phonecode");
    sel.innerHTML = "";
    initCertPhoneCode();
    assert.ok(sel.innerHTML.length > 0);
    assert.ok(sel.innerHTML.includes("US"));
    assert.ok(sel.innerHTML.includes("+1"));
  });

  it("should do nothing when select element missing", function () {
    var orig = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    try {
      initCertPhoneCode();
    } finally {
      document.getElementById = orig;
    }
  });

  it("should call getDefaultPhoneCode when available", function () {
    var called = false;
    globalThis.getDefaultPhoneCode = function () {
      called = true;
      return { dial: "+1" };
    };
    globalThis.updatePhoneMaxLength = function () {};
    var sel = document.getElementById("cert-phonecode");
    sel.innerHTML = "";
    initCertPhoneCode();
    assert.ok(called);
    delete globalThis.getDefaultPhoneCode;
    delete globalThis.updatePhoneMaxLength;
  });
});

describe("Certificate UI — toggleCertMusicFields", function () {
  before(function () {
    resetEls();
  });

  it("should show music fields when checkbox checked", function () {
    var cb = document.getElementById("cert-show-music");
    cb.checked = true;
    var fields = document.getElementById("cert-music-fields");
    fields.style.display = "none";
    toggleCertMusicFields();
    assert.equal(fields.style.display, "");
  });

  it("should hide music fields when checkbox unchecked", function () {
    var cb = document.getElementById("cert-show-music");
    cb.checked = false;
    var fields = document.getElementById("cert-music-fields");
    fields.style.display = "";
    toggleCertMusicFields();
    assert.equal(fields.style.display, "none");
  });

  it("should do nothing when fields element missing", function () {
    var origGet = document.getElementById;
    var origCb = elStore["cert-show-music"];
    document.getElementById = function (id) {
      if (id === "cert-music-fields") return null;
      return origCb;
    };
    try {
      toggleCertMusicFields();
    } finally {
      document.getElementById = origGet;
    }
  });

  it("should do nothing when checkbox element missing", function () {
    var origGet = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    try {
      toggleCertMusicFields();
    } finally {
      document.getElementById = origGet;
    }
  });
});

describe("Certificate UI — resetProfessionalCert", function () {
  before(function () {
    resetEls();
  });

  it("should reset all form fields", function () {
    var ids = [
      "cert-file",
      "cert-name",
      "cert-phone",
      "cert-website",
      "cert-social-tiktok",
      "cert-show-music",
      "cert-music-fields",
      "cert-download-section",
      "cert-status",
      "cert-phonecode",
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (id === "cert-show-music") {
        el.checked = true;
      } else if (id === "cert-music-fields") {
        el.style.display = "";
      } else if (id === "cert-download-section") {
        el.style.display = "";
      } else if (id === "cert-status") {
        el.textContent = "some text";
      } else if (id === "cert-phonecode") {
        el.value = "+1";
      } else {
        el.value = "some value";
      }
    });
    resetProfessionalCert();
    assert.equal(document.getElementById("cert-name").value, "");
    assert.equal(document.getElementById("cert-show-music").checked, false);
    assert.equal(
      document.getElementById("cert-music-fields").style.display,
      "none",
    );
    assert.equal(
      document.getElementById("cert-download-section").style.display,
      "none",
    );
    assert.equal(document.getElementById("cert-status").textContent, "");
    assert.equal(document.getElementById("cert-phonecode").value, "");
    assert.strictEqual(globalThis._certData, null);
  });

  it("should handle missing elements gracefully", function () {
    var origGet = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    try {
      resetProfessionalCert();
    } finally {
      document.getElementById = origGet;
    }
  });

  it("should handle missing status element", function () {
    var origGet = document.getElementById;
    var els = elStore;
    document.getElementById = function (id) {
      if (id === "cert-status") return null;
      return els[id] || null;
    };
    try {
      resetProfessionalCert();
    } finally {
      document.getElementById = origGet;
    }
  });
});

describe("Certificate — generatePendingOts", function () {
  it("should return null when OpenTimestamps is not available", function () {
    var orig = globalThis.OpenTimestamps;
    delete globalThis.OpenTimestamps;
    try {
      var result = generatePendingOts("abc");
      assert.strictEqual(result, null);
    } finally {
      globalThis.OpenTimestamps = orig;
    }
  });

  it("should produce a base64 string when OTS is available", function () {
    var result = generatePendingOts("aabbccdd");
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
  });

  it("should return null on error", function () {
    var origFromHash = globalThis.OpenTimestamps.DetachedTimestampFile.fromHash;
    globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = function () {
      throw new Error("fail");
    };
    try {
      var result = generatePendingOts("aabbccdd");
      assert.strictEqual(result, null);
    } finally {
      globalThis.OpenTimestamps.DetachedTimestampFile.fromHash = origFromHash;
    }
  });
});

describe("Certificate — submitCertTransparency", function () {
  var origFetch;
  before(function () {
    origFetch = globalThis.fetch;
    resetEls();
  });

  after(function () {
    globalThis.fetch = origFetch;
  });

  it("should return pending OTS when all aggregators fail", async function () {
    globalThis.fetch = async function () {
      throw new Error("Failed to fetch");
    };
    var el = document.getElementById("cert-phonecode"); // dummy
    var result = await submitCertTransparency(new Uint8Array([1, 2, 3]));
    assert.ok(result.submitted);
    assert.ok(result.pending);
    assert.ok(result.otsProof);
  });

  it("should return pending OTS when file: protocol and all aggregators fail", async function () {
    var origOts = globalThis.OpenTimestamps;
    delete globalThis.OpenTimestamps;
    globalThis.fetch = async function () {
      throw new Error("Failed to fetch");
    };
    globalThis.location.protocol = "file:";
    try {
      var result = await submitCertTransparency(new Uint8Array([1, 2, 3]));
      assert.equal(result.submitted, false);
      assert.ok(result.error.includes("CORS"));
    } finally {
      globalThis.OpenTimestamps = origOts;
      globalThis.location.protocol = "file:";
    }
  });

  it("should return error with network-unreachable message when OTS unavailable", async function () {
    var origOts = globalThis.OpenTimestamps;
    delete globalThis.OpenTimestamps;
    globalThis.fetch = async function () {
      throw new TypeError("Failed to fetch");
    };
    globalThis.location.protocol = "http:";
    try {
      var result = await submitCertTransparency(new Uint8Array([1, 2, 3]));
      assert.equal(result.submitted, false);
      assert.ok(result.error.includes("unreachable"));
    } finally {
      globalThis.OpenTimestamps = origOts;
      globalThis.location.protocol = "file:";
    }
  });

  it("should succeed when an aggregator responds", async function () {
    globalThis.AbortController = function () {
      var ctrl = { signal: {}, abort: function () {} };
      return ctrl;
    };
    globalThis.fetch = async function (url) {
      return {
        ok: true,
        arrayBuffer: async function () {
          return new Uint8Array([10, 20, 30]).buffer;
        },
      };
    };
    var result = await submitCertTransparency(new Uint8Array([1, 2, 3]));
    assert.ok(result.submitted);
    assert.equal(result.pending, undefined);
    assert.ok(result.otsProof);
    assert.ok(result.aggregator);
    assert.ok(result.hash);
  });

  it("should try next aggregator on HTTP error", async function () {
    var callCount = 0;
    globalThis.fetch = async function (url) {
      callCount++;
      if (callCount === 1)
        return {
          ok: false,
          status: 500,
          arrayBuffer: async function () {
            return new Uint8Array();
          },
        };
      return {
        ok: true,
        arrayBuffer: async function () {
          return new Uint8Array([10, 20, 30]).buffer;
        },
      };
    };
    var result = await submitCertTransparency(new Uint8Array([1, 2, 3]));
    assert.ok(result.submitted);
    assert.equal(callCount, 2);
  });
});

describe("Certificate — getValOrEmpty", function () {
  before(function () {
    resetEls();
  });

  it("should return trimmed value when element exists", function () {
    var el = document.getElementById("cert-name");
    el.value = "  John  ";
    assert.equal(getValOrEmpty("cert-name"), "John");
  });

  it("should return empty string when element missing", function () {
    assert.equal(getValOrEmpty("non-existent"), "");
  });
});

describe("Certificate — downloadProfessionalCert", function () {
  before(function () {
    resetEls();
  });

  it("should alert when no cert data", function () {
    globalThis._certData = null;
    var msgs = [];
    globalThis.alert = function (m) {
      msgs.push(m);
    };
    downloadProfessionalCert("pdf");
    assert.ok(msgs.length > 0);
    assert.ok(msgs[0].includes("generate"));
  });

  it("should generate PDF when _certData exists", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {
        name: "Tester",
        email: "t@t.com",
        phone: "+1234567890",
        website: "https://test.com",
      },
      file: {
        name: "test.jpg",
        size: 1024,
        type: "image/jpeg",
        width: 100,
        height: 100,
        dataUrl: "data:image/jpeg;base64,/9j/",
        hash: "abc123",
      },
      ct: {
        submitted: true,
        hash: "cthash123",
        timestamp: "2024-01-01T00:00:00.000Z",
        aggregator: "https://a.pool.opentimestamps.org/digest",
      },
      watermark: false,
      watermarkAlgo: "",
      watermarkResult: "",
      pixelInjection: false,
      piResultHtml: "",
      documentWatermark: false,
      documentWatermarkFileName: "",
      documentWatermarkResult: "",
      timestamp: false,
      tsResult: "",
      fingerprint: false,
      fpFileName: "",
      fpResult: null,
      didSig: null,
      didIdentity: "",
      faceBiometric: null,
    };
    var status = document.getElementById("cert-status");
    await downloadProfessionalCert("pdf");
  });

  it("should generate DOCX when _certData exists", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: { name: "Tester", email: "t@t.com" },
      file: {
        name: "test.jpg",
        size: 1024,
        type: "image/jpeg",
        width: 100,
        height: 100,
        dataUrl: "data:image/jpeg;base64,/9j/",
      },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    var status = document.getElementById("cert-status");
    await downloadProfessionalCert("docx");
  });

  it("should generate EPUB when _certData exists", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: { name: "Tester", email: "t@t.com" },
      file: {
        name: "test.jpg",
        size: 1024,
        type: "image/jpeg",
        dataUrl: "data:image/jpeg;base64,/9j/",
      },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    var status = document.getElementById("cert-status");
    await downloadProfessionalCert("epub");
  });

  it("should generate PDF with all features enabled", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {
        name: "Tester",
        email: "t@t.com",
        phone: "+123",
        website: "https://test.com",
      },
      file: {
        name: "test.png",
        size: 2048,
        type: "image/png",
        width: 200,
        height: 100,
        dataUrl: "data:image/png;base64,iVBOR",
        hash: "hash123",
      },
      watermark: true,
      watermarkAlgo: "DCT",
      watermarkResult: "Watermark embedded successfully",
      pixelInjection: true,
      piResultHtml: "Pixel injection result data",
      timestamp: true,
      tsResult: "Timestamp file created",
      fingerprint: true,
      fpResult: {
        hashes: {
          "SHA-256": "abc",
          "SHA-1": "def",
          BLAKE3: "ghi",
          MD5: "jkl",
          "SHA-3_256": "mno",
        },
        perceptual_hashes: { dhash: "phash_val" },
      },
      fpFileName: "test_fp.json",
      documentWatermark: true,
      documentWatermarkFileName: "docw.txt",
      documentWatermarkResult: "Document watermark text content",
      didSig: {
        did: "did:key:z6MkhaXgBZDjot9W7K6ZoPwTyRnTqPZuLbSZNqJqRZpLJiTn",
        algorithm: "Ed25519",
        timestamp: "2024-01-01T00:00:00.000Z",
        signature:
          "sigval123456789012345678901234567890123456789012345678901234567890",
      },
      didIdentity: "",
      faceBiometric: {
        detected: true,
        faceCount: 1,
        matchLabel: "John Doe",
        didSigned: true,
        did: "did:key:z6Mk",
        exportedAt: "2024-01-01T00:00:00.000Z",
      },
      ct: {
        submitted: true,
        pending: false,
        hash: "cthash",
        timestamp: "2024-01-01T00:00:00.000Z",
        aggregator: "https://a.pool.opentimestamps.org/digest",
      },
    };
    await downloadProfessionalCert("pdf");
  });

  it("should generate PDF with ct.pending and minimal user", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: {
        name: "doc.png",
        size: 512,
        type: "image/png",
        dataUrl: "data:image/png;base64,iVBOR",
      },
      ct: {
        submitted: true,
        pending: true,
        hash: "pendhash",
        timestamp: "2024-01-01T00:00:00.000Z",
      },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("pdf");
  });

  it("should generate PDF with ct only (no submitted/hash)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "doc.png", size: 512, type: "image/png" },
      ct: { submitted: false, error: "offline" },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("pdf");
  });

  it("should generate PDF with didIdentity (no sig)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "doc.png", size: 512, type: "image/png" },
      ct: { submitted: false },
      didIdentity: "did:key:z6Mktest123",
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("pdf");
  });

  it("should generate DOCX with all features", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: { name: "Alice", email: "a@b.com" },
      file: {
        name: "photo.png",
        size: 1024,
        type: "image/png",
        width: 400,
        height: 300,
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
      watermark: true,
      watermarkAlgo: "LSB",
      watermarkResult: "OK",
      pixelInjection: true,
      piResultHtml: "<p>PI done</p>",
      documentWatermark: true,
      documentWatermarkFileName: "docw.txt",
      documentWatermarkResult: "DocWM",
      timestamp: true,
      tsResult: "TS created",
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc", "SHA-1": "def" },
        perceptual_hashes: { dhash: "val" },
      },
      didSig: {
        did: "did:key:z6Mk123",
        algorithm: "Ed25519",
        timestamp: "2024-01-01T00:00:00.000Z",
        signature:
          "sig1234567890123456789012345678901234567890123456789012345678901234567890",
      },
      faceBiometric: {
        detected: true,
        faceCount: 2,
        matchLabel: "Face match",
        didSigned: true,
        did: "did:key:z6Mk",
        exportedAt: "2024-01-01T00:00:00.000Z",
      },
      ct: {
        submitted: true,
        hash: "cthash123",
        timestamp: "2024-01-01T00:00:00.000Z",
        aggregator: "https://a.pool.opentimestamps.org/digest",
      },
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate EPUB with all features", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: { name: "Bob", email: "b@c.com" },
      file: {
        name: "pic.jpg",
        size: 2048,
        type: "image/jpeg",
        width: 800,
        height: 600,
        dataUrl: "data:image/jpeg;base64,/9j/4AAQ",
      },
      watermark: true,
      watermarkAlgo: "DCT",
      watermarkResult: "Watermarked",
      pixelInjection: true,
      piResultHtml: "Injected",
      documentWatermark: true,
      documentWatermarkFileName: "docw.txt",
      documentWatermarkResult: "Doc watermark",
      timestamp: true,
      tsResult: "Timestamp created",
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc", "SHA-384": "def" },
        perceptual_hashes: { phash: "val" },
      },
      didSig: {
        did: "did:key:z6Mk456",
        algorithm: "P-256",
        timestamp: "2024-01-01T00:00:00.000Z",
        signature:
          "sig123456789012345678901234567890123456789012345678901234567890",
      },
      faceBiometric: {
        detected: true,
        faceCount: 3,
        didSigned: false,
        exportedAt: "2024-01-01T00:00:00.000Z",
      },
      ct: { submitted: true, pending: true, hash: "cthash456" },
    };
    await downloadProfessionalCert("epub");
  });

  it("should generate EPUB with didIdentity and ct.false", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "a.jpg", size: 100, type: "image/jpeg" },
      didIdentity: "did:key:z6Mk789",
      ct: { submitted: false, error: "offline" },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("epub");
  });
});

describe("Certificate — downloadOtsProof", function () {
  before(function () {
    resetEls();
  });

  it("should do nothing when no CT result", function () {
    globalThis.getResult = function () {
      return null;
    };
    downloadOtsProof();
  });
});

describe("Certificate — downloadCertOtsProof", function () {
  before(function () {
    resetEls();
  });

  it("should do nothing when no CT result", function () {
    globalThis.getResult = function () {
      return null;
    };
    downloadCertOtsProof();
  });
});

describe("Certificate — showCertOverlay / hideCertOverlay", function () {
  before(function () {
    resetEls();
  });

  it("should show and hide overlay", function () {
    showCertOverlay();
    hideCertOverlay();
    assert.strictEqual(globalThis._certOverlay, null);
  });

  it("should not show duplicate overlay", function () {
    showCertOverlay();
    showCertOverlay();
    hideCertOverlay();
    assert.strictEqual(globalThis._certOverlay, null);
  });
});

// ── certificate_utils.js uncovered paths: addTextSafe truncation (L95-98) ──

describe("Certificate Utils — addTextSafe truncation", function () {
  before(function () {
    resetEls();
  });

  it("should truncate wide non-Latin text", function () {
    var doc = {
      text: function () {},
      addImage: function () {
        this._addImageCalled = true;
      },
      _addImageCalled: false,
    };
    // Override createElement to give a small measureText so truncation kicks in
    var origCreate = document.createElement;
    document.createElement = function (t) {
      if (t === "canvas") {
        var textWidth = 500; // larger than maxW = 20*3.78 = 75.6
        return {
          getContext: function () {
            return {
              font: "",
              measureText: function () {
                return { width: textWidth };
              },
              fillStyle: "",
              textBaseline: "",
              fillText: function () {},
              scale: function () {},
            };
          },
          toDataURL: function () {
            return "data:image/png;base64,iVBORw0KGgo=";
          },
          width: 0,
          height: 0,
        };
      }
      return origCreate.call(this, t);
    };
    try {
      addTextSafe(doc, "مرحبا بالعالم", 10, 10, 20, 9);
      assert.ok(doc._addImageCalled);
    } finally {
      document.createElement = origCreate;
    }
  });
});

// ── certificate_utils.js uncovered paths: makeUUID fallback (L220-224) ──

describe("Certificate Utils — makeUUID fallback via undefined", function () {
  it("should use regex fallback when randomUUID is undefined", function () {
    var origDesc = Object.getOwnPropertyDescriptor(
      globalThis.crypto,
      "randomUUID",
    );
    try {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      var id = makeUUID();
      assert.equal(id.length, 36);
      assert.equal(id[14], "4");
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      if (origDesc)
        Object.defineProperty(globalThis.crypto, "randomUUID", origDesc);
    }
  });
});

// ── certificate_pdf.js uncovered paths: timestamp else branch (L222-225) ──

describe("Certificate PDF — timestamp without tsResult", function () {
  before(function () {
    resetEls();
  });

  it("should render default text when tsResult is empty", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "test.jpg", size: 1024, type: "image/jpeg" },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: true,
      tsResult: "",
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("pdf");
  });
});

// ── certificate_epub.js uncovered paths: file.hash, face details, CT not pending ──

describe("Certificate EPUB — full branch coverage", function () {
  before(function () {
    resetEls();
  });

  it("should generate EPUB with all branches", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {
        name: "Bob",
        email: "b@c.com",
        phone: "+123",
        website: "https://test.com",
      },
      file: {
        name: "pic.jpg",
        size: 2048,
        type: "image/jpeg",
        width: 800,
        height: 600,
        dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        hash: "abc123def456",
      },
      watermark: true,
      watermarkAlgo: "DCT",
      watermarkResult: "Watermarked",
      pixelInjection: true,
      piResultHtml: "Injected",
      documentWatermark: true,
      documentWatermarkFileName: "docw.txt",
      documentWatermarkResult: "Doc watermark",
      timestamp: true,
      tsResult: "Timestamp created",
      fingerprint: true,
      fpResult: {
        hashes: { "SHA-256": "abc", "SHA-384": "def" },
        perceptual_hashes: { phash: "val" },
      },
      didSig: {
        did: "did:key:z6Mk456",
        algorithm: "P-256",
        timestamp: "2024-01-01T00:00:00.000Z",
        signature:
          "sig123456789012345678901234567890123456789012345678901234567890",
      },
      faceBiometric: {
        detected: true,
        faceCount: 3,
        matchLabel: "Known Person",
        did: "did:key:z6Mkface",
        didSigned: false,
        exportedAt: "2024-01-01T00:00:00.000Z",
      },
      ct: {
        submitted: true,
        pending: false,
        hash: "cthash456",
        timestamp: "2024-01-01T00:00:00.000Z",
        aggregator: "https://a.pool.opentimestamps.org/digest",
      },
    };
    await downloadProfessionalCert("epub");
  });

  it("should generate EPUB with didIdentity and ct.false", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "a.jpg", size: 100, type: "image/jpeg", hash: "" },
      didIdentity: "did:key:z6Mk789",
      ct: { submitted: false, error: "offline" },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("epub");
  });
});

// ── certificate.js uncovered paths: getUrlOrEmpty ──

describe("Certificate — getUrlOrEmpty", function () {
  before(function () {
    resetEls();
  });

  it("should return trimmed URL when element exists", function () {
    var el = document.getElementById("cert-website");
    el.value = "  https://example.com  ";
    assert.equal(getUrlOrEmpty("cert-website"), "https://example.com");
  });

  it("should return empty string when element is missing", function () {
    assert.equal(getUrlOrEmpty("non-existent"), "");
  });

  it("should return empty for empty string", function () {
    var el = document.getElementById("cert-website");
    el.value = "";
    assert.equal(getUrlOrEmpty("cert-website"), "");
  });
});

// ── certificate.js uncovered paths: stampCertFile with setResult mock ──

describe("Certificate — stampCertFile", function () {
  before(function () {
    resetEls();
  });

  it("should stamp the certificate file when setResult is available", async function () {
    var setResultCalled = false;
    var setResultKey = "";
    globalThis.setResult = function (key, val) {
      setResultCalled = true;
      setResultKey = key;
    };
    var otsBtn = document.getElementById("cert-ots-dl-btn");
    otsBtn.style.display = "none";

    var blob = new Blob(["test cert data"]);
    await stampCertFile(blob, "pdf");

    assert.ok(setResultCalled);
    assert.equal(setResultKey, "certCtResult");
    assert.equal(otsBtn.style.display, "inline-block");

    globalThis.setResult = function () {};
  });
});

// ── certificate_docx.js remaining uncovered branches ──

describe("Certificate DOCX — remaining branches", function () {
  before(function () {
    resetEls();
  });

  it("should generate DOCX with GIF image (imageTypeFromMime gif)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: {
        name: "anim.gif",
        size: 512,
        type: "image/gif",
        width: 100,
        height: 100,
        dataUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate DOCX with BMP image (imageTypeFromMime bmp)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: {
        name: "img.bmp",
        size: 512,
        type: "image/bmp",
        width: 100,
        height: 100,
        dataUrl: "data:image/bmp;base64,Qk1CAAAAADYAAAAoAAAABAA",
      },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate DOCX with timestamp but no tsResult", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "doc.png", size: 512, type: "image/png" },
      ct: { submitted: false },
      timestamp: true,
      tsResult: "",
      watermark: false,
      pixelInjection: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate DOCX with didIdentity only (no didSig)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "doc.png", size: 512, type: "image/png" },
      didIdentity: "did:key:z6Mkonlyidentity",
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate DOCX with ct pending", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: { name: "doc.png", size: 512, type: "image/png" },
      ct: { submitted: true, pending: true, hash: "pendhash123" },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });

  it("should generate DOCX with unknown image type (default png)", async function () {
    globalThis._certData = {
      generatedAt: "2024-01-01T00:00:00.000Z",
      generator: "Test",
      user: {},
      file: {
        name: "img.webp",
        size: 512,
        type: "image/webp",
        width: 100,
        height: 100,
        dataUrl: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4TBcAAAAv",
      },
      ct: { submitted: false },
      watermark: false,
      pixelInjection: false,
      timestamp: false,
      fingerprint: false,
      documentWatermark: false,
    };
    await downloadProfessionalCert("docx");
  });
});
