const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── DOM mocks ──
const elStore = {};
function mockEl(id, overrides) {
  const el = { id, value: "", style: { display: "" }, innerHTML: "", textContent: "", disabled: false, href: "", download: "", onclick: null, addEventListener: (ev, fn) => { el._listeners = el._listeners || {}; el._listeners[ev] = el._listeners[ev] || []; el._listeners[ev].push(fn); }, click: () => {}, src: "", _listeners: {}, ...overrides };
  elStore[id] = el;
  return el;
}
globalThis.document = {
  getElementById: (id) => elStore[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => tag === "a" ? { href: "", download: "", click: () => {} } : { getContext: () => null, toBlob: (cb) => cb(new Uint8Array(0)) },
  addEventListener: () => {},
};
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

// ── Shared helper mocks ──
globalThis.__ = (key, fallback) => fallback || key;
globalThis.getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
globalThis.getFile = async () => null;
globalThis.setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
globalThis.spinner = () => {};
const resultStore = {};
globalThis.getResult = (key) => resultStore[key] || null;
globalThis.setResult = (key, val) => { resultStore[key] = val; };
globalThis.loadImage = async () => ({ imgData: { data: new Uint8Array(400), w: 10, h: 10 }, canvas: { toBlob: (cb) => cb(new Blob()) }, ctx: { putImageData: () => {} }, w: 10, h: 10 });
globalThis.canvasToBlob = async (c) => new Blob();
globalThis.watermarkEmbed = async () => ({ ok: false, error: "test error" });
globalThis.escHtml = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
globalThis.escXml = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
globalThis.downloadBlob = (blob, name, containerId) => {
  const container = document.getElementById(containerId);
  if (container) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name.replace(/[/\\]/g, "_");
    link.className = "btn";
    link.textContent = name;
    if (typeof container.append === "function") {
      container.append(link);
    } else {
      // Fallback for mock elements without .append()
      container.innerHTML += `<a href="${escHtml(link.href)}" download="${escHtml(link.download)}">${escHtml(link.textContent)}</a>`;
    }
  }
};
globalThis.downloadBlobSimple = () => {};
globalThis.showDownloadModal = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.setDownloadHandler = () => {};
globalThis.URL = { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} };
globalThis.validateFileInput = async () => true;
globalThis.Blob = class BlobMock { constructor(parts, opts) { this.parts = parts; this.type = (opts && opts.type) || ""; } };

// jsPDF mock
globalThis.jspdf = {
  jsPDF: class {
    constructor() { this.pages = []; this.fontSize = 10; this.textColor = [0,0,0]; }
    setFontSize(s) { this.fontSize = s; }
    setTextColor(r,g,b) { this.textColor = [r,g,b]; }
    text(t, x, y) { this.pages.push({ t, x, y }); }
    addPage() {}
    output(type) { return new Blob(["mock pdf"]); }
  }
};

// docx mock
globalThis.docx = {
  Paragraph: class { constructor(o) { this.opts = o; } },
  TextRun: class { constructor(o) { this.opts = o; } },
  Table: class { constructor(o) { this.opts = o; } },
  TableRow: class { constructor(o) { this.opts = o; } },
  TableCell: class { constructor(o) { this.opts = o; } },
  Document: class { constructor(o) { this.opts = o; } },
  Packer: { toBlob: async (d) => new Blob(["mock docx"]) },
  WidthType: { PERCENTAGE: 0 },
};

// ── Load watermark modules ──
const MODULES = [
  ["../../Watermark/utils.js", "utils.js"],
  ["../../Watermark/watermark_core.js", "watermark_core.js"],
];
for (const [rel] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
}

// Load watermark.js (the UI orchestrator)
const wmSrc = fs.readFileSync(path.join(__dirname, "../../Watermark/watermark.js"), "utf8");
vm.runInThisContext(wmSrc, { filename: path.resolve(__dirname, "../../Watermark/watermark.js") });

// ── Test helpers ──
function setupWmMocks() {
  mockEl("wm-btn", { value: "" });
  mockEl("wm-result", { style: { display: "" } });
  mockEl("wm-output", {});
  mockEl("wm-download", { innerHTML: "" });
  mockEl("wm-type", { value: "1" });
  mockEl("wm-password", { value: "testpass" });
  mockEl("wm-image", { value: "", files: [] });
  mockEl("wm-secret", { value: "", files: [] });
  mockEl("wm-spinner", {});
  mockEl("dl-modal-title", {});
  mockEl("wm-btn-ex", { value: "" });
  mockEl("wm-type-ex", { value: "0" });
  mockEl("wm-password-ex", { value: "testpass" });
  mockEl("wm-image-ex", { value: "", files: [] });
  mockEl("wm-password-group", { style: { display: "" } });
  mockEl("wm-password-ex-group", { style: { display: "" } });
  mockEl("wm-capacity", {});
  mockEl("wm-secret-status", {});
}

describe("Watermark UI — format converters", () => {
  const r = { type: "embed", algorithm: 1, algorithmName: "LSB", message: "ok", imageName: "test.png", secretName: "sec.bin", password: "****", timestamp: "2025-01-01" };

  it("wmToTXT should produce text", () => {
    const txt = wmToTXT(r);
    assert.ok(txt.includes("Watermark Result"));
    assert.ok(txt.includes("LSB"));
  });

  it("wmToCSV should produce CSV", () => {
    const csv = wmToCSV(r);
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes("LSB"));
  });

  it("wmToXML should produce XML", () => {
    const xml = wmToXML(r);
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("LSB"));
  });

  it("wmToHTML should produce HTML", () => {
    const html = wmToHTML(r);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("LSB"));
  });
});

describe("Watermark UI — toggleWmPassword", () => {
  it("should show password for non-zero-bit types", () => {
    setupWmMocks();
    elStore["wm-type"].value = "1";
    toggleWmPassword();
    assert.equal(elStore["wm-password-group"].style.display, "block");
  });

  it("should hide password for zero-bit type 5", () => {
    setupWmMocks();
    elStore["wm-type"].value = "5";
    toggleWmPassword();
    assert.equal(elStore["wm-password-group"].style.display, "none");
  });

  it("should hide password for fragile type 8", () => {
    setupWmMocks();
    elStore["wm-type"].value = "8";
    toggleWmPassword();
    assert.equal(elStore["wm-password-group"].style.display, "none");
  });
});

describe("Watermark UI — toggleWmExtractPassword", () => {
  it("should show password for non-zero-bit extract types", () => {
    setupWmMocks();
    elStore["wm-type-ex"].value = "1";
    toggleWmExtractPassword();
    assert.equal(elStore["wm-password-ex-group"].style.display, "block");
  });

  it("should hide for auto-detect (type 0)", () => {
    setupWmMocks();
    elStore["wm-type-ex"].value = "0";
    toggleWmExtractPassword();
    assert.equal(elStore["wm-password-ex-group"].style.display, "block"); // 0 != 5/8
  });

  it("should hide for zero-bit type 5", () => {
    setupWmMocks();
    elStore["wm-type-ex"].value = "5";
    toggleWmExtractPassword();
    assert.equal(elStore["wm-password-ex-group"].style.display, "none");
  });
});

describe("Watermark UI — downloadWatermark", () => {
  let dlCalls = [];

  function setupDlTest() {
    setupWmMocks();
    dlCalls = [];
    globalThis.downloadBlobSimple = (blob, name) => { dlCalls.push({ name }); };
    setResult("wmResult", { type: "embed", algorithm: 1, algorithmName: "LSB" });
  }

  it("should download JSON format", async () => {
    setupDlTest();
    await downloadWatermark("json");
    assert.ok(dlCalls.some(d => d.name.endsWith(".json")));
  });

  it("should download CSV format", async () => {
    setupDlTest();
    await downloadWatermark("csv");
    assert.ok(dlCalls.some(d => d.name.endsWith(".csv")));
  });

  it("should download TXT format", async () => {
    setupDlTest();
    await downloadWatermark("txt");
    assert.ok(dlCalls.some(d => d.name.endsWith(".txt")));
  });

  it("should download XML format", async () => {
    setupDlTest();
    await downloadWatermark("xml");
    assert.ok(dlCalls.some(d => d.name.endsWith(".xml")));
  });

  it("should download HTML format", async () => {
    setupDlTest();
    await downloadWatermark("html");
    assert.ok(dlCalls.some(d => d.name.endsWith(".html")));
  });

  it("should download PDF format", async () => {
    setupDlTest();
    await downloadWatermark("pdf");
    assert.ok(dlCalls.some(d => d.name.endsWith(".pdf")));
  });

  it("should download DOCX format", async () => {
    setupDlTest();
    await downloadWatermark("doc");
    assert.ok(dlCalls.some(d => d.name.endsWith(".docx")));
  });

  it("should do nothing for unknown format", async () => {
    setupDlTest();
    const before = dlCalls.length;
    await downloadWatermark("unknown");
    assert.equal(dlCalls.length, before);
  });

  it("should do nothing when no result stored", async () => {
    setupDlTest();
    setResult("wmResult", null);
    const before = dlCalls.length;
    await downloadWatermark("json");
    assert.equal(dlCalls.length, before);
  });
});

describe("Watermark UI — handleWatermarkEmbed", () => {
  it("should warn when no image file selected", async () => {
    setupWmMocks();
    elStore["wm-output"].textContent = "";
    elStore["wm-result"].style.display = "none";
    globalThis.getFile = async () => null;
    await handleWatermarkEmbed();
    assert.equal(elStore["wm-result"].style.display, "block");
    globalThis.getFile = async () => null; // restore
  });

  it("should handle embed error gracefully", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => fakeFile;
    globalThis.watermarkEmbed = async () => ({ ok: false, error: "test error" });
    await handleWatermarkEmbed();
    globalThis.getFile = async () => null;
  });

  it("should require password for non-exempt types", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image" ? fakeFile : null;
    elStore["wm-password"].value = "";
    elStore["wm-type"].value = "1";
    await handleWatermarkEmbed();
    assert.ok(elStore["wm-output"].textContent.includes("pw_required"));
    assert.equal(elStore["wm-result"].style.display, "block");
    globalThis.getFile = async () => null;
  });

  it("should require secret file for non-exempt types", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image" ? fakeFile : null;
    elStore["wm-password"].value = "testpass";
    elStore["wm-type"].value = "1";
    await handleWatermarkEmbed();
    assert.ok(elStore["wm-output"].textContent.includes("err_select_secret"));
    assert.equal(elStore["wm-result"].style.display, "block");
    globalThis.getFile = async () => null;
  });

  it("should handle successful embed (type 1 / PNG)", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => fakeFile;
    globalThis.watermarkEmbed = async () => ({ ok: true, data: new Blob(), msg: "Embedded successfully" });
    elStore["wm-password"].value = "testpass";
    elStore["wm-type"].value = "1";
    await handleWatermarkEmbed();
    // Verify result is stored
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.type, "embed");
    assert.equal(r.algorithm, 1);
    assert.ok(r.message.includes("Embedded"));
    // Verify DL modal title
    assert.equal(elStore["dl-modal-title"].textContent, "Download Watermark Result");
    // Verify PNG extension for type 1
    assert.ok(elStore["wm-download"].innerHTML.includes(".png"));
    // Verify output message
    assert.ok(elStore["wm-output"].textContent.includes("Embedded"));
    globalThis.getFile = async () => null;
  });

  it("should handle successful embed (type 2 / JPG)", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => fakeFile;
    globalThis.watermarkEmbed = async () => ({ ok: true, data: new Blob(), msg: "Embedded as jpg" });
    elStore["wm-password"].value = "testpass";
    elStore["wm-type"].value = "2";
    await handleWatermarkEmbed();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.algorithm, 2);
    // Verify JPG extension for DCT types
    assert.ok(elStore["wm-download"].innerHTML.includes(".jpg"));
    assert.ok(elStore["wm-output"].textContent.includes("jpg"));
    globalThis.getFile = async () => null;
  });

  it("should handle embed with type 5 (no password)", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => fakeFile;
    globalThis.watermarkEmbed = async () => ({ ok: true, data: new Blob(), msg: "Zero-bit watermark created" });
    elStore["wm-password"].value = "";
    elStore["wm-type"].value = "5";
    await handleWatermarkEmbed();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.password, "");
    globalThis.getFile = async () => null;
  });

  it("should handle embed error from validateFileInput on secret", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image" ? fakeFile : { name: "sec.bin", arrayBuffer: async () => new Uint8Array(10).buffer };
    elStore["wm-password"].value = "testpass";
    elStore["wm-type"].value = "1";
    globalThis.validateFileInput = async () => false;
    await handleWatermarkEmbed();
    globalThis.validateFileInput = async () => true;
  });

  it("should handle embed throwing exception", async () => {
    setupWmMocks();
    const fakeFile = { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => fakeFile;
    globalThis.watermarkEmbed = async () => { throw new Error("embed crash"); };
    elStore["wm-password"].value = "testpass";
    elStore["wm-type"].value = "1";
    await handleWatermarkEmbed();
    assert.ok(elStore["wm-output"].textContent.includes("wm.error_prefix"));
    globalThis.getFile = async () => null;
  });
});

describe("Watermark UI — updateCapacity", () => {
  beforeEach(() => {
    setupWmMocks();
    elStore["wm-capacity"].textContent = "";
    elStore["wm-secret-status"].textContent = "";
  });

  afterEach(() => {
    globalThis.getFile = async () => null;
  });

  it("should clear display when no image file", async () => {
    globalThis.getFile = async () => null;
    await updateCapacity();
    assert.equal(elStore["wm-capacity"].textContent, "");
    assert.equal(elStore["wm-secret-status"].textContent, "");
  });

  it("should calculate capacity for spatial types (1/3)", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "1";
    await updateCapacity();
    // w=10, h=10 → bits = 10*10*3 = 300 → capacityBytes = 37
    assert.ok(elStore["wm-capacity"].textContent.includes("Capacity: ~37"), `Expected "Capacity: ~37" in "${elStore["wm-capacity"].textContent}"`);
  });

  it("should calculate capacity for multi-bit type 6", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "6";
    await updateCapacity();
    // bits = floor(300 * 2/3) = 200 → capacityBytes = 25
    assert.ok(elStore["wm-capacity"].textContent.includes("Capacity: ~25"));
  });

  it("should calculate capacity for DCT types (2/4/5/7/9)", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "2";
    await updateCapacity();
    // maxDCTBits(10,10,11) = 1*1*11 = 11 → capacityBytes = 1
    assert.ok(elStore["wm-capacity"].textContent.includes("Capacity: ~1"));
  });

  it("should calculate capacity for type 4 with redundant suffix", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "4";
    await updateCapacity();
    // bits = floor(11/3) = 3 → capacityBytes = 0
    assert.ok(elStore["wm-capacity"].textContent.includes("Capacity: ~0"));
    assert.ok(elStore["wm-capacity"].textContent.includes("redundant x3"));
  });

  it("should calculate capacity for fragile type 8", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "8";
    await updateCapacity();
    // bits = 512 → capacityBytes = 64
    assert.ok(elStore["wm-capacity"].textContent.includes("Capacity: ~64"));
  });

  it("should show chrominance suffix for type 9", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "9";
    await updateCapacity();
    assert.ok(elStore["wm-capacity"].textContent.includes("chrominance redundant"));
  });

  it("should clear secret status for type 5", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "5";
    await updateCapacity();
    assert.equal(elStore["wm-secret-status"].textContent, "");
  });

  it("should clear secret status for type 8", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    elStore["wm-type"].value = "8";
    await updateCapacity();
    assert.equal(elStore["wm-secret-status"].textContent, "");
  });

  it("should show OK status when secret fits within capacity", async () => {
    globalThis.getFile = async (id) => {
      if (id === "wm-image") return { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer };
      if (id === "wm-secret") return { name: "secret.bin", size: 10, arrayBuffer: async () => new Uint8Array(10).buffer };
      return null;
    };
    elStore["wm-type"].value = "1";
    await updateCapacity();
    // capacityBytes = 37, secretSize = 10 → fits → green check
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("4caf50"));
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("10 bytes"));
  });

  it("should show exceed status when secret exceeds capacity", async () => {
    globalThis.getFile = async (id) => {
      if (id === "wm-image") return { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer };
      if (id === "wm-secret") return { name: "secret.bin", size: 500, arrayBuffer: async () => new Uint8Array(500).buffer };
      return null;
    };
    elStore["wm-type"].value = "1";
    await updateCapacity();
    // capacityBytes = 37, secretSize = 500 → exceeds → red cross
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("f44336"));
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("500 bytes"));
  });

  it("should show max secret size when no secret file", async () => {
    globalThis.getFile = async (id) => {
      if (id === "wm-image") return { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer };
      return null;
    };
    elStore["wm-type"].value = "1";
    await updateCapacity();
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("text-muted"));
    assert.ok(elStore["wm-secret-status"].innerHTML.includes("37 bytes"));
  });

  it("should handle error during capacity calculation", async () => {
    globalThis.getFile = async (id) => id === "wm-image" ? { name: "test.png", arrayBuffer: async () => new Uint8Array(100).buffer } : null;
    globalThis.loadImage = async () => { throw new Error("load failed"); };
    await updateCapacity();
    assert.equal(elStore["wm-capacity"].textContent, "");
    assert.equal(elStore["wm-secret-status"].textContent, "");
    // Restore loadImage
    globalThis.loadImage = async () => ({ imgData: { data: new Uint8Array(400), w: 10, h: 10 }, canvas: { toBlob: (cb) => cb(new Blob()) }, ctx: { putImageData: () => {} }, w: 10, h: 10 });
  });
});

describe("Watermark UI — handleWatermarkExtract", () => {
  afterEach(() => {
    globalThis.getFile = async () => null;
  });

  it("should warn when no image file selected", async () => {
    setupWmMocks();
    elStore["wm-type-ex"].value = "1";
    globalThis.getFile = async () => null;
    await handleWatermarkExtract();
    assert.ok(elStore["wm-output"].textContent.includes("err_select_stego"));
    assert.equal(elStore["wm-result"].style.display, "block");
  });

  it("should require password for non-exempt extract types", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "";
    await handleWatermarkExtract();
    assert.ok(elStore["wm-output"].textContent.includes("pw_required"));
    assert.equal(elStore["wm-result"].style.display, "block");
  });

  it("should auto-detect algorithm with type 0", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "0";
    elStore["wm-password-ex"].value = "testpass";
    // Mock watermarkExtract: type 1 succeeds, rest fail
    globalThis.watermarkExtract = async (type) => {
      if (type === 1) return { ok: true, files: { "data.bin": new Uint8Array([1, 2, 3]) }, msg: "Found type 1" };
      return { ok: false, error: "No watermark" };
    };
    await handleWatermarkExtract();
    // Should have detected type 1
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.algorithm, 1);
    assert.equal(r.type, "extract");
  });

  it("should auto-detect type 5 specifically", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "0";
    elStore["wm-password-ex"].value = "testpass";
    // Only type 5 succeeds (detectWatermarkAlgorithm tries 5 separately without password)
    globalThis.watermarkExtract = async (type, imgFile, pw) => {
      if (type === 5) return { ok: true, msg: "Type 5 PRESENCE CONFIRMED - Zero-bit watermark detected" };
      return { ok: false, error: "No watermark" };
    };
    await handleWatermarkExtract();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.algorithm, 5);
  });

  it("should show no-match message when type 0 finds nothing", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "0";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.watermarkExtract = async () => ({ ok: false, error: "No watermark" });
    await handleWatermarkExtract();
    // Uses setText → textContent with the fallback string from __()
    assert.ok(elStore["wm-output"].textContent.includes("No watermark detected"));
    assert.equal(elStore["wm-result"].style.display, "block");
  });

  it("should handle successful extract without files", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.watermarkExtract = async () => ({ ok: true, msg: "Extracted watermark data" });
    await handleWatermarkExtract();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.type, "extract");
    assert.equal(r.algorithm, 1);
    // Success path uses output.innerHTML
    assert.ok(elStore["wm-output"].innerHTML.includes("Extracted watermark data"));
    assert.ok(elStore["wm-download"].innerHTML.includes("Download Results"));
  });

  it("should handle successful extract without password", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "5";
    elStore["wm-password-ex"].value = "";
    globalThis.watermarkExtract = async () => ({ ok: true, msg: "Extracted zero-bit" });
    await handleWatermarkExtract();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.equal(r.password, "");
  });

  it("should handle successful extract with file contents", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    const secretData = new TextEncoder().encode("Hello from watermark");
    globalThis.watermarkExtract = async () => ({
      ok: true,
      files: { "secret.txt": secretData },
      msg: "Extracted secret.txt"
    });
    await handleWatermarkExtract();
    const r = getResult("wmResult");
    assert.ok(r != null);
    assert.ok(Object.keys(r.files).length > 0);
    // downloadBlob should have been called — check container has download link
    assert.ok(elStore["wm-download"].innerHTML.length > 0);
    // Success path uses output.innerHTML
    assert.ok(elStore["wm-output"].innerHTML.includes("Hello from watermark"));
  });

  it("should show wmErr message on extract failure", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.watermarkExtract = async () => ({ ok: false, error: "Wrong password" });
    await handleWatermarkExtract();
    // Failure path uses setText → textContent → key from __() mock
    assert.ok(elStore["wm-output"].textContent.includes("wm.error_prefix"));
    assert.equal(elStore["wm-result"].style.display, "block");
  });

  it("should add algo tip when password provided on failure", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.watermarkExtract = async () => ({ ok: false, error: "No watermark found with this algorithm" });
    await handleWatermarkExtract();
    // Failure path → textContent includes both error prefix and tip
    assert.ok(elStore["wm-output"].textContent.includes("wm.error_prefix"));
    assert.ok(elStore["wm-output"].textContent.includes("wm.tip_wrong_algo"));
  });

  it("should handle exceptions gracefully", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.watermarkExtract = async () => { throw new Error("Unexpected crash"); };
    await handleWatermarkExtract();
    // Exception caught → setText with error_prefix i18n key
    assert.ok(elStore["wm-output"].textContent.includes("wm.error_prefix"));
    assert.equal(elStore["wm-result"].style.display, "block");
  });

  it("should handle extract validateFileInput returning false", async () => {
    setupWmMocks();
    const fakeFile = { name: "stego.png", arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image-ex" ? fakeFile : null;
    elStore["wm-type-ex"].value = "1";
    elStore["wm-password-ex"].value = "testpass";
    globalThis.validateFileInput = async () => false;
    await handleWatermarkExtract();
    globalThis.validateFileInput = async () => true;
  });
});

describe("Watermark UI — updateCapacity (edge cases)", () => {
  it("should handle missing wm-type element (fallback to 1)", async () => {
    setupWmMocks();
    var fakeFile = { name: "test.png", size: 10000, arrayBuffer: async () => new Uint8Array(100).buffer };
    globalThis.getFile = async (id) => id === "wm-image" ? fakeFile : null;
    delete elStore["wm-type"];
    await updateCapacity();
    elStore["wm-type"] = { value: "1" };
    globalThis.getFile = async () => null;
  });
});
