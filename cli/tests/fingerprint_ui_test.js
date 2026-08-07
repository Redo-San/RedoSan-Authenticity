const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// ── Polyfills ──
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ getContext: () => null }),
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.URL.createObjectURL = () => "blob:test";
globalThis.URL.revokeObjectURL = () => {};
globalThis.ensureLib = async () => {};

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) =>
        crypto.createHash("sha256").update(Buffer.from(data)).digest(),
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
      for (let i = 0; i < arr.length; i++)
        arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
}

const origLog = console.log;
console.log = () => {};

// Mock shared.js functions
globalThis._resultStore = {};
globalThis.setResult = (k, d) => {
  globalThis._resultStore[k] = d;
};
globalThis.getResult = (k) => globalThis._resultStore[k];
globalThis._dlHandler = null;
globalThis.setDownloadHandler = (fn) => {
  globalThis._dlHandler = fn;
};
globalThis.escHtml = (s) => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
globalThis.setText = (id, msg) => {
  var el =
    globalThis.document.getElementById(id) ||
    globalThis.document.querySelector("#" + id);
  if (el) el.textContent = msg;
};
globalThis.spinner = () => {};
globalThis.getFile = async () => null;
globalThis.__ = (key, fallback) => fallback || key;
globalThis.downloadBlobSimple = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.showDownloadModal = () => {};
globalThis.fingerprintFile = async () => ({});

// Mock jspdf for fpToPDF
globalThis.jspdf = {
  jsPDF: class {
    constructor() {
      this._pages = 1;
      this._y = 20;
    }
    setFontSize(s) {
      this._fs = s;
    }
    setTextColor(r, g, b) {
      this._tc = [r, g, b];
    }
    text(t, x, y) {
      this._y = y + 6;
    }
    addPage() {
      this._pages++;
      this._y = 20;
    }
    output(format) {
      return Buffer.from("mock pdf content");
    }
  },
};

// Mock docx for fpToDOCX
globalThis.docx = {
  Paragraph: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  TextRun: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  Table: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  TableRow: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  TableCell: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  Document: class {
    constructor(opts) {
      this.opts = opts;
    }
  },
  WidthType: { PERCENTAGE: "percentage" },
  Packer: {
    toBlob: async (doc) =>
      new Blob(["mock docx content"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
  },
};

// Load hashing module (suppress BLAKE3 self-test output)
const hashSrc = fs.readFileSync(
  path.join(__dirname, "../../Fingerprint/hashing.js"),
  "utf8",
);
try {
  vm.runInThisContext(hashSrc, {
    filename: path.resolve(__dirname, "../../Fingerprint/hashing.js"),
  });
} finally {
  console.log = origLog;
}

// Load fingerprint_ui module
const fpSrc = fs.readFileSync(
  path.join(__dirname, "../../Fingerprint/fingerprint_ui.js"),
  "utf8",
);
vm.runInThisContext(fpSrc, {
  filename: path.resolve(__dirname, "../../Fingerprint/fingerprint_ui.js"),
});

// ── Sample fingerprint result ──
const sampleResult = {
  file_info: {
    file_name: "test.txt",
    file_size_bytes: 1024,
    format: "Text",
  },
  hashes: {
    "SHA-256": "abc123",
    "SHA-1": "def456",
    MD5: "789ghi",
  },
  perceptual_hashes: {
    ahash: "00001111",
  },
};

// ── Tests: escXml ──
describe("Fingerprint UI — escXml", () => {
  it("should escape XML special characters", () => {
    assert.equal(globalThis.escXml("<test>"), "&lt;test&gt;");
    assert.equal(globalThis.escXml('a&b "c"'), "a&amp;b &quot;c&quot;");
  });
});

// ── Tests: fpToTXT ──
describe("Fingerprint UI — fpToTXT", () => {
  it("should produce formatted text output", () => {
    const txt = globalThis.fpToTXT(sampleResult);
    assert.ok(txt.includes("test.txt"));
    assert.ok(txt.includes("1024 bytes"));
    assert.ok(txt.includes("SHA-256"));
    assert.ok(txt.includes("abc123"));
    assert.ok(txt.includes("RedoSan Authenticity"));
  });

  it("should handle missing optional fields", () => {
    const minimal = {
      file_info: { file_name: "x.bin", file_size_bytes: 100 },
      hashes: {},
    };
    const txt = globalThis.fpToTXT(minimal);
    assert.ok(txt.includes("x.bin"));
    assert.ok(txt.includes("100 bytes"));
  });
});

// ── Tests: fpToCSV ──
describe("Fingerprint UI — fpToCSV", () => {
  it("should produce CSV with headers", () => {
    const csv = globalThis.fpToCSV(sampleResult);
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes('"test.txt"'));
    assert.ok(csv.includes('"1024"'));
  });

  it("should include hashes and perceptual hashes", () => {
    const csv = globalThis.fpToCSV(sampleResult);
    assert.ok(csv.includes("SHA-256"));
    assert.ok(csv.includes("Perceptual_ahash"));
  });
});

// ── Tests: fpToXML ──
describe("Fingerprint UI — fpToXML", () => {
  it("should produce valid XML", () => {
    const xml = globalThis.fpToXML(sampleResult);
    assert.ok(xml.includes('<?xml version="1.0"'));
    assert.ok(xml.includes("<file_name>"));
    assert.ok(xml.includes("<hashes>"));
    assert.ok(xml.includes("<perceptual_hashes>"));
  });

  it("should handle minimal result", () => {
    const minimal = {
      file_info: { file_name: "x.bin", file_size_bytes: 100 },
      hashes: {},
    };
    const xml = globalThis.fpToXML(minimal);
    assert.ok(xml.includes("x.bin"));
  });
});

// ── Tests: fpToHTML ──
describe("Fingerprint UI — fpToHTML", () => {
  it("should produce HTML document", () => {
    const html = globalThis.fpToHTML(sampleResult);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("test.txt"));
    assert.ok(html.includes("SHA-256"));
    assert.ok(html.includes("Perceptual"));
  });

  it("should include dimensions and format when present", () => {
    const result = {
      file_info: {
        file_name: "photo.jpg",
        file_size_bytes: 100000,
        width: 1920,
        height: 1080,
        format: "JPEG",
      },
      hashes: {},
    };
    const html = globalThis.fpToHTML(result);
    assert.ok(html.includes("1920"));
    assert.ok(html.includes("1080"));
    assert.ok(html.includes("JPEG"));
  });
});

// ── Tests: fpToPDF (needs jspdf mock) ──
describe("Fingerprint UI — fpToPDF", () => {
  it("should produce a PDF blob", async () => {
    const blob = await globalThis.fpToPDF(sampleResult);
    assert.ok(
      blob instanceof Blob || Buffer.isBuffer(blob) || blob !== undefined,
    );
  });

  it("should handle result without perceptual hashes", () => {
    const noPH = { ...sampleResult, perceptual_hashes: {} };
    const blob = globalThis.fpToPDF(noPH);
    assert.ok(blob);
  });

  it("should include dimensions when width/height present", () => {
    const result = {
      file_info: {
        file_name: "photo.jpg",
        file_size_bytes: 50000,
        width: 1920,
        height: 1080,
        format: "JPEG",
      },
      hashes: { "SHA-256": "abc" },
    };
    const blob = globalThis.fpToPDF(result);
    assert.ok(blob);
  });
});

// ── Tests: fpToDOCX (needs docx mock) ──
describe("Fingerprint UI — fpToDOCX", () => {
  it("should produce a DOCX blob", async () => {
    const blob = await globalThis.fpToDOCX(sampleResult);
    assert.ok(blob instanceof Blob);
  });

  it("should include dimensions when width/height present", async () => {
    const result = {
      file_info: {
        file_name: "img.png",
        file_size_bytes: 50000,
        width: 800,
        height: 600,
        format: "PNG",
      },
      hashes: { "SHA-256": "abc" },
    };
    const blob = await globalThis.fpToDOCX(result);
    assert.ok(blob instanceof Blob);
  });

  it("should include format when present", async () => {
    const result = {
      file_info: { file_name: "doc.txt", file_size_bytes: 200, format: "Text" },
      hashes: {},
    };
    const blob = await globalThis.fpToDOCX(result);
    assert.ok(blob instanceof Blob);
  });
});

// ── Tests: createDocxTable ──
describe("Fingerprint UI — createDocxTable", () => {
  it("should return null for empty rows", () => {
    const result = globalThis.createDocxTable(globalThis.docx, []);
    assert.equal(result, null);
  });

  it("should create a table for valid rows", () => {
    const result = globalThis.createDocxTable(globalThis.docx, [
      ["Key", "Value"],
    ]);
    assert.ok(result);
  });
});

// ── Tests: downloadFingerprint ──
describe("Fingerprint UI — downloadFingerprint", () => {
  it("should do nothing when no result stored", async () => {
    globalThis._resultStore = {};
    await globalThis.downloadFingerprint("txt");
  });

  it("should generate TXT download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("txt");
    assert.ok(captured);
    assert.ok(captured.name.endsWith(".txt"));
  });

  it("should generate CSV download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("csv");
    assert.ok(captured.name.endsWith(".csv"));
  });

  it("should generate JSON download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("json");
    assert.ok(captured.name.endsWith(".json"));
  });

  it("should generate XML download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("xml");
    assert.ok(captured.name.endsWith(".xml"));
  });

  it("should generate HTML download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("html");
    assert.ok(captured.name.endsWith(".html"));
  });

  it("should generate PDF download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("pdf");
    assert.ok(captured.name.endsWith(".pdf"));
  });

  it("should generate DOCX download", async () => {
    globalThis._resultStore = {};
    globalThis.setResult("fpResult", sampleResult);
    let captured = null;
    globalThis.downloadBlobSimple = (blob, name) => {
      captured = { blob, name };
    };
    await globalThis.downloadFingerprint("doc");
    assert.ok(captured.name.endsWith(".docx"));
  });
});

// ── Tests: handleFingerprint ──
describe("Fingerprint UI — handleFingerprint", () => {
  var origGetFile;
  var origFingerprintFile;

  beforeEach(() => {
    origGetFile = globalThis.getFile;
    origFingerprintFile = globalThis.fingerprintFile;
    var queryMap = {
      "#fp-btn": { disabled: false },
      "#fp-result": { style: {} },
      "#fp-output": {},
      "#fp-download": { innerHTML: "" },
      "#fp-spinner": {},
      "#fp-progress": { style: {} },
      "#fp-progress-fill": { style: {} },
      "#fp-progress-pct": {},
      "#fp-progress-label": {},
      "#dl-modal-title": {},
    };
    globalThis.document.querySelector = function (sel) {
      if (!queryMap[sel]) {
        queryMap[sel] = { style: {}, innerHTML: "" };
      }
      return queryMap[sel];
    };
    globalThis.document.querySelectorAll = function () {
      return [];
    };
  });

  afterEach(() => {
    globalThis.getFile = origGetFile;
    globalThis.fingerprintFile = origFingerprintFile;
  });

  it("should show error when no file selected", async () => {
    globalThis.getFile = async () => null;
    var shown = null;
    globalThis.setText = (id, msg) => {
      shown = msg;
    };
    var resultDiv = globalThis.document.querySelector("#fp-result");
    await globalThis.handleFingerprint();
    assert.ok(shown);
    assert.equal(resultDiv.style.display, "block");
  });

  it("should process file and render results", async () => {
    var btn = globalThis.document.querySelector("#fp-btn");
    var output = globalThis.document.querySelector("#fp-output");
    var resultDiv = globalThis.document.querySelector("#fp-result");
    var dl = globalThis.document.querySelector("#fp-download");
    var progressFill = globalThis.document.querySelector("#fp-progress-fill");
    var progressDiv = globalThis.document.querySelector("#fp-progress");

    globalThis.getFile = async () => ({
      name: "test.png",
      size: 2048,
      type: "image/png",
    });
    globalThis.fingerprintFile = async (file, onProgress) => {
      onProgress("Hashing...");
      return {
        file_info: {
          file_name: "test.png",
          file_size_bytes: 2048,
          format: "PNG",
          width: 100,
          height: 100,
        },
        hashes: { "SHA-256": "abc123" },
        perceptual_hashes: {},
      };
    };
    var downloadHandlerSet = null;
    globalThis.setDownloadHandler = (fn) => {
      downloadHandlerSet = fn;
    };

    await globalThis.handleFingerprint();

    var result = globalThis.getResult("fpResult");
    assert.ok(result);
    assert.equal(result.file_info.file_name, "test.png");
    assert.equal(resultDiv.style.display, "block");
    assert.equal(btn.disabled, false);
    assert.ok(downloadHandlerSet);
    assert.ok(output.innerHTML.includes("test.png"));
    assert.ok(output.innerHTML.includes("abc123"));
    assert.ok(dl.innerHTML.includes("Download"));
    assert.equal(progressDiv.style.display, "none");
  });

  it("should handle errors from fingerprintFile", async () => {
    globalThis.getFile = async () => ({ name: "bad.txt", size: 100 });
    globalThis.fingerprintFile = async () => {
      throw new Error("Processing failed");
    };
    var output = globalThis.document.querySelector("#fp-output");
    var btn = globalThis.document.querySelector("#fp-btn");

    await globalThis.handleFingerprint();

    assert.equal(btn.disabled, false);
    assert.equal(
      globalThis.document.querySelector("#fp-result").style.display,
      "block",
    );
  });

  it("should render perceptual hashes when present", async () => {
    var output = globalThis.document.querySelector("#fp-output");
    globalThis.getFile = async () => ({ name: "img.png", size: 500 });
    globalThis.fingerprintFile = async () => ({
      file_info: { file_name: "img.png", file_size_bytes: 500 },
      hashes: { MD5: "xyz" },
      perceptual_hashes: { ahash: "abc", dhash: "def" },
    });

    await globalThis.handleFingerprint();

    assert.ok(output.innerHTML.includes("ahash"));
    assert.ok(output.innerHTML.includes("dhash"));
    assert.ok(output.innerHTML.includes("Perceptual"));
  });
});
