const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

var dlCalls = [];
const elStore = {};
function mockEl(id, overrides) {
  const el = {
    id, value: "", style: { display: "", background: "", color: "", borderColor: "" },
    innerHTML: "", textContent: "", disabled: false, href: "", download: "",
    className: "", files: null, onclick: null,
    _listeners: {},
    addEventListener: (ev, fn) => { el._listeners[ev] = el._listeners[ev] || []; el._listeners[ev].push(fn); },
    click: () => {}, focus: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    dataset: {},
    ...overrides,
  };
  elStore[id] = el;
  return el;
}

globalThis.document = {
  getElementById: (id) => elStore[id] || null,
  createElement: (tag) => tag === "a" ? { href: "", download: "", click: () => {} } : { style: {} },
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
};
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.URL = { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} };
globalThis.Blob = function BlobMock(parts, opts) { this.parts = parts; this.type = (opts && opts.type) || ""; };
globalThis.i18n = { data: {} };
globalThis.escHtml = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
globalThis.showDownloadModal = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.setDownloadHandler = () => {};
globalThis.setTimeout = setTimeout;

if (typeof navigator === "object" && navigator) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async () => {} },
    writable: true, configurable: true,
  });
} else {
  globalThis.navigator = { clipboard: { writeText: async () => {} } };
}

const src = fs.readFileSync(path.resolve(__dirname, "../../ID_Forge/id_forge.js"), "utf8");
vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../ID_Forge/id_forge.js") });

globalThis.downloadBlobSimple = (blob, name) => { dlCalls.push({ blob, name }); };

describe("ID Forge UI — validateSwhidText", () => {
  beforeEach(() => {
    mockEl("if-swhid-text-warning", { style: { display: "" } });
  });

  it("should show warning for non-English chars", () => {
    const el = { value: "مرحبا", style: {} };
    validateSwhidText(el);
    assert.equal(elStore["if-swhid-text-warning"].style.display, "block");
    assert.equal(el.style.borderColor, "#e74c3c");
  });

  it("should hide warning for English-only text", () => {
    const el = { value: "hello", style: {} };
    validateSwhidText(el);
    assert.equal(elStore["if-swhid-text-warning"].style.display, "none");
    assert.equal(el.style.borderColor, "");
  });

  it("should do nothing when warning element missing", () => {
    delete elStore["if-swhid-text-warning"];
    const el = { value: "مرحبا", style: {} };
    validateSwhidText(el);
  });
});

describe("ID Forge UI — idForgeUpdateCount", () => {
  beforeEach(() => {
    mockEl("if-count", { value: "5" });
  });

  it("should clamp to min 1", () => {
    mockEl("if-count", { value: "0" });
    idForgeUpdateCount();
    assert.equal(elStore["if-count"].value, 1);
  });

  it("should clamp to max 10000", () => {
    mockEl("if-count", { value: "99999" });
    idForgeUpdateCount();
    assert.equal(elStore["if-count"].value, 10000);
  });

  it("should keep valid count unchanged", () => {
    mockEl("if-count", { value: "42" });
    idForgeUpdateCount();
    assert.equal(elStore["if-count"].value, "42");
  });
});

describe("ID Forge UI — idForgeShowInfo", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "uuidv4" });
    mockEl("if-info", { style: { display: "" }, innerHTML: "" });
    mockEl("if-nanoid-wrapper", { style: { display: "" } });
    mockEl("if-swhid-source-wrapper", { style: { display: "" } });
    mockEl("if-count-wrapper", { style: { display: "" } });
    mockEl("if-swhid-file-wrapper", { style: { display: "" } });
    mockEl("if-swhid-text-wrapper", { style: { display: "" } });
  });

  it("should show info for uuidv4", () => {
    globalThis.i18n.data["id_forge.info.uuidv4"] = "Random UUID v4";
    idForgeShowInfo();
    assert.ok(elStore["if-info"].innerHTML.includes("🎲"));
    assert.equal(elStore["if-nanoid-wrapper"].style.display, "none");
    assert.equal(elStore["if-swhid-source-wrapper"].style.display, "none");
    assert.notEqual(elStore["if-count-wrapper"].style.display, "none");
  });

  it("should show nanoID wrapper for nanoid type", () => {
    elStore["if-type"].value = "nanoid";
    idForgeShowInfo();
    assert.equal(elStore["if-nanoid-wrapper"].style.display, "block");
  });

  it("should show swhid wrapper for swhid type", () => {
    elStore["if-type"].value = "swhid";
    globalThis.document.querySelectorAll = (sel) => {
      if (sel === "[data-swhid-tab]") {
        return [
          { dataset: { swhidTab: "file" }, style: { background: "", color: "" } },
          { dataset: { swhidTab: "text" }, style: { background: "", color: "" } },
        ];
      }
      return [];
    };
    idForgeShowInfo();
    assert.equal(elStore["if-swhid-source-wrapper"].style.display, "block");
    assert.equal(elStore["if-count-wrapper"].style.display, "none");
  });

  it("should hide info when no i18n data", () => {
    delete globalThis.i18n.data["id_forge.info.uuidv4"];
    elStore["if-info"].style.display = "block";
    idForgeShowInfo();
    assert.equal(elStore["if-info"].style.display, "none");
  });
});

describe("ID Forge UI — switchSwhidTab", () => {
  beforeEach(() => {
    mockEl("if-swhid-file-wrapper", { style: { display: "" } });
    mockEl("if-swhid-text-wrapper", { style: { display: "" } });
  });

  it("should switch to file tab", () => {
    globalThis.document.querySelectorAll = (sel) => {
      if (sel === "[data-swhid-tab]") {
        return [
          { dataset: { swhidTab: "file" }, style: { background: "", color: "" } },
          { dataset: { swhidTab: "text" }, style: { background: "", color: "" } },
        ];
      }
      return [];
    };
    switchSwhidTab("file");
    assert.notEqual(elStore["if-swhid-file-wrapper"].style.display, "none");
    assert.equal(elStore["if-swhid-text-wrapper"].style.display, "none");
  });

  it("should switch to text tab", () => {
    globalThis.document.querySelectorAll = (sel) => {
      if (sel === "[data-swhid-tab]") {
        return [
          { dataset: { swhidTab: "file" }, style: { background: "", color: "" } },
          { dataset: { swhidTab: "text" }, style: { background: "", color: "" } },
        ];
      }
      return [];
    };
    switchSwhidTab("text");
    assert.notEqual(elStore["if-swhid-text-wrapper"].style.display, "none");
    assert.equal(elStore["if-swhid-file-wrapper"].style.display, "none");
  });
});

describe("ID Forge UI — idForgeShowDownload", () => {
  it("should do nothing when no result", () => {
    delete globalThis._ifResult;
    idForgeShowDownload();
  });

  it("should show download modal when result exists", () => {
    globalThis._ifResult = { ids: ["abc"], type: "uuidv4", count: 1, timestamp: "2025-01-01" };
    var modalShown = false;
    globalThis.showDownloadModal = function () { modalShown = true; };
    mockEl("dl-modal-title", { textContent: "" });
    idForgeShowDownload();
    assert.ok(modalShown);
    assert.ok(elStore["dl-modal-title"].textContent.includes("ID Forge"));
  });
});

describe("ID Forge UI — handleIdForgeGenerate", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "uuidv4" });
    mockEl("if-count", { value: "1" });
    mockEl("if-output", { value: "" });
    mockEl("if-result", { style: { display: "none" } });
    mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
    mockEl("if-nanoid-len", { value: "21" });
    mockEl("if-swhid-file", { files: null });
    mockEl("if-swhid-text", { value: "" });
    delete globalThis._ifResult;
  });

  it("should generate a single uuidv4", () => {
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(elStore["if-output"].value.length > 0);
        assert.ok(elStore["if-output"].value.includes("-"));
        assert.equal(elStore["if-result"].style.display, "block");
        assert.ok(globalThis._ifResult);
        assert.equal(globalThis._ifResult.type, "uuidv4");
        assert.equal(globalThis._ifResult.ids.length, 1);
        resolve();
      }, 100);
    });
  });

  it("should generate bulk uuidv4", () => {
    elStore["if-count"].value = "5";
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var ids = elStore["if-output"].value.split("\n");
        assert.equal(ids.length, 5);
        assert.equal(globalThis._ifResult.ids.length, 5);
        resolve();
      }, 100);
    });
  });

  it("should generate uuidv7", () => {
    elStore["if-type"].value = "uuidv7";
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.equal(elStore["if-output"].value[14], "7");
        resolve();
      }, 100);
    });
  });

  it("should generate ulid", () => {
    elStore["if-type"].value = "ulid";
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.equal(elStore["if-output"].value.length, 20);
        resolve();
      }, 100);
    });
  });

  it("should generate nanoid with custom length", () => {
    elStore["if-type"].value = "nanoid";
    elStore["if-nanoid-len"].value = "8";
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.equal(elStore["if-output"].value.length, 8);
        resolve();
      }, 100);
    });
  });

  it("should generate swhid from random bytes", () => {
    elStore["if-type"].value = "swhid";
    handleIdForgeGenerate();
    return new Promise(function (resolve, reject) {
      var deadline = Date.now() + 2000;
      (function poll() {
        if (elStore["if-output"].value) {
          try {
            assert.ok(elStore["if-output"].value.startsWith("swh:1:cnt:"));
            resolve();
          } catch (e) { reject(e); }
        } else if (Date.now() > deadline) {
          reject(new Error("swhid generation timed out"));
        } else {
          setTimeout(poll, 25);
        }
      })();
    });
  });

  it("should handle unknown type with default", () => {
    elStore["if-type"].value = "unknown";
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(elStore["if-output"].value.includes("-"));
        resolve();
      }, 100);
    });
  });
});

describe("ID Forge UI — idForgeCopy", () => {
  it("should do nothing when output is empty", () => {
    mockEl("if-output", { value: "" });
    idForgeCopy({ textContent: "Copy", style: {} });
  });

  it("should copy to clipboard", () => {
    mockEl("if-output", { value: "test-id-123" });
    var copied = "";
    navigator.clipboard.writeText = async function (t) { copied = t; };
    var el = { textContent: "Copy", style: { background: "", color: "" } };
    idForgeCopy(el);
    assert.equal(copied, "test-id-123");
    assert.equal(el.style.background, "var(--success, #00e676)");
  });
});

describe("ID Forge UI — idForgeDownload", () => {
  beforeEach(() => {
    dlCalls = [];
    globalThis._ifResult = {
      ids: ["abc-123", "def-456"], type: "uuidv4", count: 2,
      timestamp: "2025-01-01T00:00:00.000Z",
    };
    globalThis.jspdf = {
      jsPDF: function () {
        this.fontSize = 10; this.textColor = [0, 0, 0]; this.pages = 0;
      },
    };
    globalThis.jspdf.jsPDF.prototype.setFontSize = function () {};
    globalThis.jspdf.jsPDF.prototype.setTextColor = function () {};
    globalThis.jspdf.jsPDF.prototype.text = function () {};
    globalThis.jspdf.jsPDF.prototype.addPage = function () { this.pages++; };
    globalThis.jspdf.jsPDF.prototype.save = function () { dlCalls.push({ name: "id-forge-uuidv4.pdf" }); };
  });

  it("should do nothing when no result", () => {
    delete globalThis._ifResult;
    idForgeDownload("json");
    assert.equal(dlCalls.length, 0);
  });

  it("should download JSON", () => {
    idForgeDownload("json");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".json"); }));
  });

  it("should download CSV", () => {
    idForgeDownload("csv");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".csv"); }));
  });

  it("should download TXT", () => {
    idForgeDownload("txt");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".txt"); }));
  });

  it("should download XML", () => {
    idForgeDownload("xml");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".xml"); }));
  });

  it("should download PDF", () => {
    idForgeDownload("pdf");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".pdf"); }));
  });

  it("should download DOC", () => {
    idForgeDownload("doc");
    assert.ok(dlCalls.some(function (d) { return d.name.endsWith(".doc"); }));
  });

  it("should do nothing for unknown format", () => {
    var before = dlCalls.length;
    idForgeDownload("unknown");
    assert.equal(dlCalls.length, before);
  });
});

describe("ID Forge — computeSwhidFromFile", () => {
  it("should compute SWHID from .txt file", async () => {
    var file = { name: "test.txt", arrayBuffer: async () => new TextEncoder().encode("hello").buffer };
    var result = await computeSwhidFromFile(file);
    assert.ok(result.startsWith("swh:1:cnt:"));
    assert.equal(result.length, 50);
  });

  it("should extract hash from .ots file", async () => {
    var OTS_HEADER = [0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94];
    var hashBytes = new Uint8Array(32);
    for (var i = 0; i < 32; i++) hashBytes[i] = 0xab;
    var buf = new Uint8Array([...OTS_HEADER, 0x01, 0x08, ...hashBytes]).buffer;
    var file = { name: "file.ots", arrayBuffer: async () => buf };
    var result = await computeSwhidFromFile(file);
    assert.equal(result, "swh:1:cnt:" + "ab".repeat(32));
  });

  it("should extract SHA-1 from fingerprint .json file", async () => {
    var json = JSON.stringify({ hashes: { "SHA-1": "da39a3ee5e6b4b0d3255bfef95601890afd80709" } });
    var file = { name: "fingerprint.json", arrayBuffer: async () => new TextEncoder().encode(json).buffer };
    var result = await computeSwhidFromFile(file);
    assert.equal(result, "swh:1:cnt:da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it("should extract SHA-256 from fingerprint .json file", async () => {
    var json = JSON.stringify({ hashes: { "SHA-256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" } });
    var file = { name: "fp.json", arrayBuffer: async () => new TextEncoder().encode(json).buffer };
    var result = await computeSwhidFromFile(file);
    assert.equal(result, "swh:1:cnt:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should throw on invalid fingerprint JSON", async () => {
    var file = { name: "fp.json", arrayBuffer: async () => new TextEncoder().encode("not-json").buffer };
    await assert.rejects(function () { return computeSwhidFromFile(file); });
  });

  it("should throw on JSON without SHA hashes", async () => {
    var json = JSON.stringify({ hashes: { "MD5": "d41d8cd98f00b204e9800998ecf8427e" } });
    var file = { name: "fp.json", arrayBuffer: async () => new TextEncoder().encode(json).buffer };
    await assert.rejects(function () { return computeSwhidFromFile(file); });
  });
});

describe("ID Forge — handleIdForgeGenerate with swhid file", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "swhid" });
    mockEl("if-count", { value: "1" });
    mockEl("if-output", { value: "" });
    mockEl("if-result", { style: { display: "none" } });
    mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
    mockEl("if-nanoid-len", { value: "21" });
    delete globalThis._ifResult;
    mockEl("if-swhid-text", { value: "" });
  });

  it("should generate swhid from file", () => {
    mockEl("if-swhid-file", { files: [{ name: "test.txt", arrayBuffer: async () => new TextEncoder().encode("hello").buffer }] });
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(elStore["if-output"].value.startsWith("swh:1:cnt:"));
        resolve();
      }, 200);
    });
  });
});

describe("ID Forge — clipboard fallback", () => {
  it("should fallback to execCommand when clipboard fails", async () => {
    mockEl("if-output", { value: "test-id-123", select: function () {} });
    navigator.clipboard.writeText = async function () { throw new Error("denied"); };
    globalThis.document.execCommand = function () {};
    var el = { textContent: "Copy", style: { background: "", color: "" } };
    idForgeCopy(el);
    await new Promise(function (r) { setTimeout(r, 50); });
  });
});

describe("ID Forge — PDF page break with many IDs", () => {
  it("should trigger addPage when many IDs", () => {
    dlCalls = [];
    var manyIds = [];
    for (var i = 0; i < 100; i++) manyIds.push("id-" + i);
    globalThis._ifResult = { ids: manyIds, type: "uuidv4", count: 100, timestamp: "2025-01-01T00:00:00.000Z" };
    globalThis.jspdf = {
      jsPDF: function () {
        this.fontSize = 10; this.textColor = [0, 0, 0]; this.pages = 0;
      },
    };
    globalThis.jspdf.jsPDF.prototype.setFontSize = function () {};
    globalThis.jspdf.jsPDF.prototype.setTextColor = function () {};
    globalThis.jspdf.jsPDF.prototype.text = function () {};
    var addPageCalled = false;
    globalThis.jspdf.jsPDF.prototype.addPage = function () { addPageCalled = true; };
    globalThis.jspdf.jsPDF.prototype.save = function () { dlCalls.push({ name: "test.pdf" }); };
    idForgeDownload("pdf");
    assert.ok(addPageCalled);
  });
});

describe("ID Forge — buldIdForgeGenerate with bulk ulid", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "ulid" });
    mockEl("if-count", { value: "3" });
    mockEl("if-output", { value: "" });
    mockEl("if-result", { style: { display: "none" } });
    mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
    mockEl("if-nanoid-len", { value: "21" });
    mockEl("if-swhid-file", { files: null });
    mockEl("if-swhid-text", { value: "" });
    delete globalThis._ifResult;
  });

  it("should generate bulk ulid", () => {
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var ids = elStore["if-output"].value.split("\n");
        assert.equal(ids.length, 3);
        resolve();
      }, 200);
    });
  });
});

describe("ID Forge — handleIdForgeGenerate with bulk nanoid", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "nanoid" });
    mockEl("if-count", { value: "3" });
    mockEl("if-output", { value: "" });
    mockEl("if-result", { style: { display: "none" } });
    mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
    mockEl("if-nanoid-len", { value: "21" });
    mockEl("if-swhid-file", { files: null });
    mockEl("if-swhid-text", { value: "" });
    delete globalThis._ifResult;
  });

  it("should generate bulk nanoid", () => {
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        var ids = elStore["if-output"].value.split("\n");
        assert.equal(ids.length, 3);
        resolve();
      }, 200);
    });
  });
});

describe("ID Forge — handleIdForgeGenerate error catch", () => {
  beforeEach(() => {
    mockEl("if-type", { value: "swhid" });
    mockEl("if-count", { value: "1" });
    mockEl("if-output", { value: "" });
    mockEl("if-result", { style: { display: "none" } });
    mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
    mockEl("if-nanoid-len", { value: "21" });
    mockEl("if-swhid-text", { value: "" });
    delete globalThis._ifResult;
  });

  it("should catch error when file arrayBuffer rejects", () => {
    mockEl("if-swhid-file", { files: [{ name: "bad.ots", arrayBuffer: async function () { throw new Error("corrupt"); } }] });
    handleIdForgeGenerate();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(elStore["if-output"].value.includes("Error"));
        resolve();
      }, 200);
    });
  });
});
