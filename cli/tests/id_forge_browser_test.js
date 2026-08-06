const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nodeCrypto = require("crypto");

// ===== Mock State =====
const _elements = new Map();
let _lastDownloadArgs = null;
let _clipboardText = null;
let _execCommandCalled = false;
let _globalDlHandler = null;
let _downloadModalOpen = false;

// ===== Mock Helpers =====
function mockEl(id, props = {}) {
  const el = {
    value: "",
    textContent: "",
    disabled: false,
    style: { display: "" },
    dataset: {},
    files: null,
    checked: false,
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      },
      toggle() {},
    },
    select() {},
    click() {},
    focus() {},
    append() {},
    appendChild() {},
    removeChild() {},
    insertBefore() {},
    ...props,
  };
  if (props.dataset !== undefined) el.dataset = props.dataset;
  _elements.set(id, el);
  return el;
}

function resetMocks() {
  _elements.clear();
  _lastDownloadArgs = null;
  _clipboardText = null;
  _execCommandCalled = false;
  _globalDlHandler = null;
  _downloadModalOpen = false;
  // Always provide these standard elements
  mockEl("if-type", { value: "" });
  mockEl("if-count", { value: "1" });
  mockEl("if-output", { value: "" });
  mockEl("if-result", { style: { display: "none" } });
  mockEl("if-gen-btn", { disabled: false, textContent: "Generate" });
  mockEl("if-nanoid-len", { value: "21" });
  mockEl("if-nanoid-wrapper", { style: { display: "none" } });
  mockEl("if-swhid-source-wrapper", { style: { display: "none" } });
  mockEl("if-count-wrapper", { style: { display: "block" } });
  mockEl("if-info", { style: { display: "none" } });
  mockEl("if-swhid-file-wrapper", { style: { display: "none" } });
  mockEl("if-swhid-text-wrapper", { style: { display: "none" } });
  mockEl("if-swhid-text", { value: "" });
  mockEl("if-swhid-file", { files: null });
  mockEl("if-swhid-text-warning", { style: { display: "none" } });
  mockEl("dl-modal", {
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      },
      toggle() {},
    },
  });
  mockEl("dl-modal-title", { textContent: "" });
}

// ===== Setup =====
before(() => {
  resetMocks();

  // DOM
  globalThis.document = {
    getElementById: (id) => _elements.get(id) || null,
    createElement(tag) {
      if (tag === "a")
        return {
          href: "",
          download: "",
          click() {
            _lastDownloadArgs = { name: this.download, url: this.href };
          },
          style: {},
          appendChild() {},
        };
      return {
        style: {},
        appendChild() {},
        append() {},
        classList: {
          add() {},
          remove() {},
          contains() {
            return false;
          },
        },
      };
    },
    querySelectorAll(sel) {
      if (sel === "[data-swhid-tab]") {
        return Array.from(_elements.values()).filter(
          (e) => e.dataset && e.dataset.swhidTab !== undefined,
        );
      }
      return [];
    },
    documentElement: { dataset: { theme: "light" }, getAttribute() {} },
  };

  // Navigator (use defineProperty since Node's built-in may be an accessor)
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: function (text) {
          _clipboardText = text;
          return Promise.resolve();
        },
      },
      userAgent: "Mozilla/5.0 (test)",
      vendor: "",
      plugins: [{ name: "Test" }],
      languages: ["en-US"],
    },
    configurable: true,
    writable: true,
  });

  // URL
  globalThis.URL = {
    createObjectURL: function () {
      return "blob:mock";
    },
    revokeObjectURL: function () {},
  };

  // i18n
  globalThis.i18n = { data: {} };

  // jspdf mock (must use function expression, NOT method shorthand, to be new-able)
  globalThis.jspdf = {
    jsPDF: function () {
      var self = this;
      self._lines = [];
      self._y = 20;
      self._pageCount = 1;
      self.setFontSize = function () {};
      self.setTextColor = function () {};
      self.text = function (str, x, y) {
        self._y = y || self._y;
        self._lines.push(str);
        if (self._y > 270) {
          self.addPage();
        }
      };
      self.addPage = function () {
        self._pageCount++;
        self._lines.push("---NEW PAGE---");
        self._y = 20;
      };
      self.save = function (name) {
        _lastDownloadArgs = { format: "pdf", name };
      };
    },
  };

  // shared.js helpers
  globalThis.escHtml = function (s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  globalThis.closeDownloadModal = function () {
    _downloadModalOpen = false;
  };

  globalThis.showDownloadModal = function () {
    _downloadModalOpen = true;
  };

  globalThis.setDownloadHandler = function (fn) {
    _globalDlHandler = fn;
  };

  globalThis.getDownloadHandler = function () {
    return _globalDlHandler || null;
  };

  // window
  globalThis.window = globalThis;

  // Run source
  const src = fs.readFileSync(
    path.join(__dirname, "../../ID_Forge/id_forge.js"),
    "utf8",
  );
  vm.runInThisContext(src, {
    filename: path.resolve(__dirname, "../../ID_Forge/id_forge.js"),
  });

  // Save original for explicit testing, then override to track calls
  globalThis._origDownloadBlobSimple = downloadBlobSimple;
  globalThis.downloadBlobSimple = function (blob, name) {
    _lastDownloadArgs = { blob, name };
  };
});

// ======================================================
// Existing tests (kept for compatibility)
// ======================================================

describe("ID Forge (browser) — hex", () => {
  it("should format single-digit values with padding", () => {
    assert.equal(hex(0, 2), "00");
    assert.equal(hex(1, 2), "01");
    assert.equal(hex(15, 2), "0f");
  });

  it("should format multi-digit values", () => {
    assert.equal(hex(255, 2), "ff");
    assert.equal(hex(256, 4), "0100");
    assert.equal(hex(3735928559, 8), "deadbeef");
  });

  it("should handle zero padding", () => {
    assert.equal(hex(42, 0), "2a");
  });
});

describe("ID Forge (browser) — sanitizeText", () => {
  it("should escape angle brackets", () => {
    assert.equal(sanitizeText("<script>"), "&#60;script&#62;");
  });

  it("should escape ampersand", () => {
    assert.equal(sanitizeText("a&b"), "a&#38;b");
  });

  it("should escape double quotes", () => {
    assert.equal(sanitizeText('say "hello"'), "say &#34;hello&#34;");
  });

  it("should escape single quotes and backtick", () => {
    assert.equal(sanitizeText("`it's`"), "&#96;it&#39;s&#96;");
  });

  it("should pass through safe text unchanged", () => {
    assert.equal(sanitizeText("hello world"), "hello world");
  });
});

describe("ID Forge (browser) — hexFromDigest", () => {
  it("should convert ArrayBuffer digest to hex string", () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
    assert.equal(hexFromDigest(buf), "deadbeef");
  });

  it("should handle empty buffer", () => {
    const buf = new Uint8Array([]).buffer;
    assert.equal(hexFromDigest(buf), "");
  });

  it("should pad single-byte values", () => {
    const buf = new Uint8Array([0x00, 0x01, 0x0f, 0xff]).buffer;
    assert.equal(hexFromDigest(buf), "00010fff");
  });
});

describe("ID Forge (browser) — extractHashFromOts", () => {
  function makeOtsBytes(hashHex) {
    const OTS_HEADER = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    const version = 1;
    const hashAlgo = 0x08;
    const hash = new Uint8Array(
      hashHex.match(/.{2}/g).map((b) => parseInt(b, 16)),
    );
    const buf = new Uint8Array([...OTS_HEADER, version, hashAlgo, ...hash]);
    return buf.buffer;
  }

  it("should extract SHA-256 hash from valid OTS bytes", () => {
    const hashHex =
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const buf = makeOtsBytes(hashHex);
    assert.equal(extractHashFromOts(buf), hashHex);
  });

  it("should throw on invalid magic bytes", () => {
    const buf = new Uint8Array(32).buffer;
    assert.throws(() => extractHashFromOts(buf), /bad magic/);
  });

  it("should throw on unsupported version", () => {
    const OTS_HEADER = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    const buf = new Uint8Array([...OTS_HEADER, 99, 0x08]).buffer;
    assert.throws(() => extractHashFromOts(buf), /version/);
  });

  it("should throw on unsupported hash algorithm", () => {
    const OTS_HEADER = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    const buf = new Uint8Array([...OTS_HEADER, 1, 99]).buffer;
    assert.throws(() => extractHashFromOts(buf), /hash/);
  });

  it("should throw on truncated data", () => {
    const buf = new Uint8Array(40).buffer;
    assert.throws(() => extractHashFromOts(buf));
  });

  it("should throw when OTS data has valid header but too short for hash", () => {
    // Header (31) + version (1) + algo (1) = 33 bytes, but no hash data
    const OTS_HEADER = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    const buf = new Uint8Array([...OTS_HEADER, 1, 0x08]).buffer;
    assert.throws(() => extractHashFromOts(buf), /too short/);
  });
});

describe("ID Forge (browser) — escXml", () => {
  it("should escape XML special characters", () => {
    assert.equal(
      escXml('<hello>"world" & friends'),
      "&lt;hello&gt;&quot;world&quot; &amp; friends",
    );
  });

  it("should handle empty string", () => {
    assert.equal(escXml(""), "");
  });
});

describe("ID Forge (browser) — nanoid direct", () => {
  it("should default to length 21 when called without arguments", () => {
    const id = nanoid();
    assert.equal(id.length, 21);
  });
});

// ======================================================
// New tests
// ======================================================

const UUID4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("ID Forge (browser) — validateSwhidText", () => {
  it("should flag non-English characters", () => {
    const el = mockEl("if-swhid-text", { value: "مرحبا" });
    const warn = _elements.get("if-swhid-text-warning");
    validateSwhidText(el);
    assert.equal(warn.style.display, "block");
    assert.equal(el.style.borderColor, "#e74c3c");
  });

  it("should allow English-only text", () => {
    const el = mockEl("if-swhid-text", { value: "hello world" });
    const warn = _elements.get("if-swhid-text-warning");
    validateSwhidText(el);
    assert.equal(warn.style.display, "none");
  });

  it("should handle missing warning element gracefully", () => {
    const oldWarn = _elements.get("if-swhid-text-warning");
    _elements.delete("if-swhid-text-warning");
    const el = mockEl("if-swhid-text", { value: "مرحبا" });
    validateSwhidText(el);
    // Should not throw
    _elements.set("if-swhid-text-warning", oldWarn);
  });
});

describe("ID Forge (browser) — computeSwhidFromFile", () => {
  const SWHID_RE = /^swh:1:cnt:[0-9a-f]{40}$/;

  it("should hash a regular file", async () => {
    const content = "hello world";
    const expected = nodeCrypto.createHash("sha1").update(content).digest("hex");
    const file = {
      name: "data.txt",
      arrayBuffer: async () => new TextEncoder().encode(content).buffer,
    };
    const id = await computeSwhidFromFile(file);
    assert.match(id, SWHID_RE);
    assert.equal(id, "swh:1:cnt:" + expected);
  });

  it("should handle .ots files by extracting hash", async () => {
    const hashHex =
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const OTS_HEADER = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    const hash = new Uint8Array(
      hashHex.match(/.{2}/g).map((b) => parseInt(b, 16)),
    );
    const buf = new Uint8Array([...OTS_HEADER, 1, 0x08, ...hash]);
    const file = {
      name: "proof.ots",
      arrayBuffer: async () => buf.buffer,
    };
    const id = await computeSwhidFromFile(file);
    assert.equal(id, "swh:1:cnt:" + hashHex);
  });

  it("should extract SHA-1 from fingerprint JSON", async () => {
    const json = JSON.stringify({
      hashes: { "SHA-1": "da39a3ee5e6b4b0d3255bfef95601890afd80709" },
    });
    const file = {
      name: "fingerprint.json",
      arrayBuffer: async () => new TextEncoder().encode(json).buffer,
    };
    const id = await computeSwhidFromFile(file);
    assert.equal(id, "swh:1:cnt:da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it("should extract SHA-256 from fingerprint JSON (fallback)", async () => {
    const json = JSON.stringify({
      hashes: {
        "SHA-256":
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    });
    const file = {
      name: "fingerprint.json",
      arrayBuffer: async () => new TextEncoder().encode(json).buffer,
    };
    const id = await computeSwhidFromFile(file);
    assert.equal(
      id,
      "swh:1:cnt:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("should throw on JSON without SHA-1/SHA-256", async () => {
    const json = JSON.stringify({ hashes: { MD5: "abc" } });
    const file = {
      name: "fingerprint.json",
      arrayBuffer: async () => new TextEncoder().encode(json).buffer,
    };
    await assert.rejects(
      () => computeSwhidFromFile(file),
      /No SHA-1 or SHA-256/,
    );
  });

  it("should throw on invalid JSON", async () => {
    const file = {
      name: "fingerprint.json",
      arrayBuffer: async () => new TextEncoder().encode("not json").buffer,
    };
    await assert.rejects(
      () => computeSwhidFromFile(file),
      /Invalid fingerprint JSON/,
    );
  });
});

describe("ID Forge (browser) — computeSwhidFromText", () => {
  it("should compute SHA-1 hash of text", async () => {
    const text = "hello world";
    const expected = nodeCrypto.createHash("sha1").update(text).digest("hex");
    const id = await computeSwhidFromText(text);
    assert.equal(id, "swh:1:cnt:" + expected);
  });

  it("should handle empty string", async () => {
    const id = await computeSwhidFromText("");
    const expected = nodeCrypto.createHash("sha1").update("").digest("hex");
    assert.equal(id, "swh:1:cnt:" + expected);
  });

  it("should handle Unicode text", async () => {
    const text = "héllo wörld 🌍";
    const expected = nodeCrypto.createHash("sha1").update(text).digest("hex");
    const id = await computeSwhidFromText(text);
    assert.equal(id, "swh:1:cnt:" + expected);
  });
});

describe("ID Forge (browser) — swhid dispatch", () => {
  const SWHID_RE = /^swh:1:cnt:[0-9a-f]{40}$/;

  it("should use file input when file is present", async () => {
    const content = "file content";
    mockEl("if-swhid-file", {
      files: [
        {
          name: "data.txt",
          arrayBuffer: async () => new TextEncoder().encode(content).buffer,
        },
      ],
    });
    mockEl("if-swhid-text", { value: "" });
    const id = await swhid();
    const expected = nodeCrypto.createHash("sha1").update(content).digest("hex");
    assert.match(id, SWHID_RE);
    assert.equal(id, "swh:1:cnt:" + expected);
  });

  it("should use text input when no file and text is present", async () => {
    mockEl("if-swhid-file", { files: null });
    mockEl("if-swhid-text", { value: "text content" });
    const id = await swhid();
    const expected = nodeCrypto
      .createHash("sha1")
      .update("text content")
      .digest("hex");
    assert.equal(id, "swh:1:cnt:" + expected);
  });

  it("should fall back to random bytes when no input provided", async () => {
    mockEl("if-swhid-file", { files: null });
    mockEl("if-swhid-text", { value: "" });
    const id = await swhid();
    assert.match(id, SWHID_RE);
  });
});

describe("ID Forge (browser) — handleIdForgeGenerate", () => {
  beforeEach(() => {
    resetMocks();
    delete globalThis._ifResult;
  });

  it("should generate uuidv4 (single)", async () => {
    const el = _elements.get("if-type");
    el.value = "uuidv4";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(globalThis._ifResult, "_ifResult should exist");
    assert.equal(globalThis._ifResult.type, "uuidv4");
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.match(globalThis._ifResult.ids[0], UUID4_RE);
    assert.ok(
      _elements.get("if-output").value.includes(globalThis._ifResult.ids[0]),
    );
  });

  it("should generate uuidv4 (bulk)", async () => {
    _elements.get("if-type").value = "uuidv4";
    _elements.get("if-count").value = "5";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.ids.length, 5);
    assert.ok(
      globalThis._ifResult.ids.every((id) => UUID4_RE.test(id)),
      "All ids should match UUID v4",
    );
  });

  it("should generate uuidv7 (single)", async () => {
    _elements.get("if-type").value = "uuidv7";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.type, "uuidv7");
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.equal(globalThis._ifResult.ids[0][14], "7");
  });

  it("should generate uuidv7 (bulk)", async () => {
    _elements.get("if-type").value = "uuidv7";
    _elements.get("if-count").value = "3";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.ids.length, 3);
    assert.ok(
      globalThis._ifResult.ids.every((id) => id[14] === "7"),
    );
  });

  it("should generate ulid (single)", async () => {
    _elements.get("if-type").value = "ulid";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.type, "ulid");
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.equal(globalThis._ifResult.ids[0].length, 20);
  });

  it("should generate ulid (bulk)", async () => {
    _elements.get("if-type").value = "ulid";
    _elements.get("if-count").value = "3";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.ids.length, 3);
  });

  it("should generate nanoid with default length", async () => {
    _elements.get("if-type").value = "nanoid";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.type, "nanoid");
    assert.equal(globalThis._ifResult.ids[0].length, 21);
  });

  it("should generate nanoid with custom length", async () => {
    _elements.get("if-type").value = "nanoid";
    _elements.get("if-nanoid-len").value = "8";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.ids[0].length, 8);
  });

  it("should generate nanoid (bulk)", async () => {
    _elements.get("if-type").value = "nanoid";
    _elements.get("if-count").value = "4";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.ids.length, 4);
    assert.ok(
      globalThis._ifResult.ids.every((id) => id.length === 21),
    );
  });

  it("should generate swhid via dispatch", async () => {
    _elements.get("if-type").value = "swhid";
    _elements.get("if-count").value = "1";
    // Set up text input for swhid
    const text = "test swhid content";
    mockEl("if-swhid-text", { value: text });
    mockEl("if-swhid-file", { files: null });
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(globalThis._ifResult.type, "swhid");
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.match(globalThis._ifResult.ids[0], /^swh:1:cnt:/);
  });

  it("should fall back to uuidv4 for unknown type (default case)", async () => {
    _elements.get("if-type").value = "unknown_type";
    _elements.get("if-count").value = "1";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(globalThis._ifResult, "_ifResult should exist");
    assert.equal(globalThis._ifResult.type, "unknown_type");
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.match(globalThis._ifResult.ids[0], UUID4_RE);
  });

  it("should handle errors gracefully (invalid JSON in swhid)", async () => {
    _elements.get("if-type").value = "swhid";
    _elements.get("if-count").value = "1";
    mockEl("if-swhid-file", {
      files: [
        {
          name: "data.json",
          arrayBuffer: async () =>
            new TextEncoder().encode("not valid json").buffer,
        },
      ],
    });
    mockEl("if-swhid-text", { value: "" });
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    const output = _elements.get("if-output");
    assert.ok(output.value.startsWith("Error:"), output.value);
  });

  it("should disable button during generation, re-enable after", async () => {
    _elements.get("if-type").value = "uuidv4";
    _elements.get("if-count").value = "1";
    const btn = _elements.get("if-gen-btn");
    handleIdForgeGenerate();
    // Immediately after call, button should be disabled
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, "Generating...");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(btn.disabled, false);
    assert.equal(btn.textContent, "Generate");
  });

  it("should use i18n for button texts", async () => {
    globalThis.i18n.data["id_forge.generating_btn"] = "جاري التوليد...";
    globalThis.i18n.data["id_forge.generate_btn"] = "توليد";
    _elements.get("if-type").value = "uuidv4";
    _elements.get("if-count").value = "1";
    const btn = _elements.get("if-gen-btn");
    handleIdForgeGenerate();
    assert.equal(btn.textContent, "جاري التوليد...");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(btn.textContent, "توليد");
    delete globalThis.i18n.data["id_forge.generating_btn"];
    delete globalThis.i18n.data["id_forge.generate_btn"];
  });

  it("should fall back to count=1 when count is NaN (|| 1 branch)", async () => {
    _elements.get("if-type").value = "uuidv4";
    _elements.get("if-count").value = "abc";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(globalThis._ifResult, "_ifResult should exist");
    // NaN || 1 -> count = 1
    assert.equal(globalThis._ifResult.count, 1);
    assert.equal(globalThis._ifResult.ids.length, 1);
    assert.match(globalThis._ifResult.ids[0], UUID4_RE);
  });

  it("should use default nanoid length when len is NaN (|| 21 branch)", async () => {
    _elements.get("if-type").value = "nanoid";
    _elements.get("if-count").value = "1";
    _elements.get("if-nanoid-len").value = "";
    handleIdForgeGenerate();
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(globalThis._ifResult, "_ifResult should exist");
    assert.equal(globalThis._ifResult.ids[0].length, 21);
  });
});

describe("ID Forge (browser) — idForgeCopy", () => {
  beforeEach(() => {
    resetMocks();
    _clipboardText = null;
    _execCommandCalled = false;
  });

  it("should copy to clipboard", async () => {
    const output = _elements.get("if-output");
    output.value = "test-id-123";
    const btn = { textContent: "Copy", style: { background: "", color: "" } };
    await idForgeCopy(btn);
    assert.equal(_clipboardText, "test-id-123");
    assert.equal(btn.textContent, "✓ Copied!");
    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 1600));
    assert.equal(btn.textContent, "Copy");
  });

  it("should fall back to execCommand when clipboard fails", () => {
    // Make clipboard fail
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
    const output = _elements.get("if-output");
    output.value = "fallback-id";
    // Track select/execCommand
    let selected = false;
    output.select = () => {
      selected = true;
    };
    const origExecCommand = globalThis.document.execCommand;
    globalThis.document.execCommand = (cmd) => {
      _execCommandCalled = true;
      assert.equal(cmd, "copy");
    };
    const btn = { textContent: "Copy", style: { background: "", color: "" } };
    idForgeCopy(btn);
    // The clipboard failure .catch is async, wait for it
    return new Promise((r) => setTimeout(r, 50)).then(() => {
      assert.ok(selected, "output.select() should be called");
      assert.ok(_execCommandCalled, "execCommand('copy') should be called");
      // Restore
      globalThis.document.execCommand = origExecCommand;
    });
  });

  it("should do nothing when output is empty", () => {
    _elements.get("if-output").value = "";
    const btn = { textContent: "Copy", style: { background: "", color: "" } };
    idForgeCopy(btn);
    assert.equal(_clipboardText, null);
    assert.equal(btn.textContent, "Copy");
  });
});

describe("ID Forge (browser) — idForgeDownload", () => {
  beforeEach(() => {
    resetMocks();
    _lastDownloadArgs = null;
    globalThis._ifResult = {
      ids: ["id1", "id2", "id3"],
      type: "uuidv4",
      count: 3,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
  });

  it("should do nothing when no result", () => {
    delete globalThis._ifResult;
    idForgeDownload("json");
    assert.equal(_lastDownloadArgs, null);
  });

  it("should download PDF format", () => {
    idForgeDownload("pdf");
    assert.ok(_lastDownloadArgs, "download should be triggered");
    assert.equal(_lastDownloadArgs.format, "pdf");
    assert.equal(
      _lastDownloadArgs.name,
      "id-forge-uuidv4.pdf",
    );
  });

  it("should download DOC format", () => {
    idForgeDownload("doc");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-uuidv4.doc");
    // Verify blob contains HTML
    const blob = _lastDownloadArgs.blob;
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, "application/msword");
  });

  it("should download JSON format", async () => {
    idForgeDownload("json");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-uuidv4.json");
    const text = await _lastDownloadArgs.blob.text();
    const parsed = JSON.parse(text);
    assert.equal(parsed.type, "uuidv4");
    assert.equal(parsed.count, 3);
    assert.deepEqual(parsed.ids, ["id1", "id2", "id3"]);
  });

  it("should download CSV format", async () => {
    idForgeDownload("csv");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-uuidv4.csv");
    const text = await _lastDownloadArgs.blob.text();
    assert.ok(text.startsWith("Type,Count,Timestamp,ID"));
    assert.ok(text.includes("uuidv4"));
    assert.ok(text.includes("id1"));
    assert.ok(text.includes("id2"));
    assert.ok(text.includes("id3"));
  });

  it("should download TXT format", async () => {
    idForgeDownload("txt");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-uuidv4.txt");
    const text = await _lastDownloadArgs.blob.text();
    assert.ok(text.includes("ID Forge — uuidv4"));
    assert.ok(text.includes("Generated:"));
    assert.ok(text.includes("id1\nid2\nid3"));
  });

  it("should download XML format", async () => {
    idForgeDownload("xml");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-uuidv4.xml");
    const text = await _lastDownloadArgs.blob.text();
    assert.ok(text.includes('<?xml version="1.0"'));
    assert.ok(text.includes("<id-forge>"));
    assert.ok(text.includes("<id>id1</id>"));
    assert.ok(text.includes("<type>uuidv4</type>"));
    assert.ok(text.includes("</id-forge>"));
  });

  it("should handle PDF with many IDs (triggers page break)", () => {
    const manyIds = [];
    for (let i = 0; i < 60; i++) manyIds.push("id-" + i);
    globalThis._ifResult = {
      ids: manyIds,
      type: "ulid",
      count: 60,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    idForgeDownload("pdf");
    assert.ok(_lastDownloadArgs);
    assert.equal(_lastDownloadArgs.name, "id-forge-ulid.pdf");
  });

  it("should handle unknown format gracefully", () => {
    idForgeDownload("unknown");
    assert.equal(_lastDownloadArgs, null);
  });
});

describe("ID Forge (browser) — idForgeShowInfo", () => {
  beforeEach(() => {
    resetMocks();
    globalThis.i18n.data["id_forge.info.uuidv4"] = "UUID v4 info";
    globalThis.i18n.data["id_forge.info.uuidv7"] = "UUID v7 info";
    globalThis.i18n.data["id_forge.info.ulid"] = "ULID info";
    globalThis.i18n.data["id_forge.info.nanoid"] = "NanoID info";
    globalThis.i18n.data["id_forge.info.swhid"] = "SWHID info";
  });

  it("should show info for uuidv4", () => {
    _elements.get("if-type").value = "uuidv4";
    idForgeShowInfo();
    const info = _elements.get("if-info");
    assert.equal(info.style.display, "block");
    assert.ok(info.innerHTML.includes("UUID v4 info"));
    assert.ok(info.innerHTML.includes("🎲"));
    // nano wrapper should be hidden
    assert.equal(
      _elements.get("if-nanoid-wrapper").style.display,
      "none",
    );
    assert.equal(
      _elements.get("if-swhid-source-wrapper").style.display,
      "none",
    );
    assert.equal(_elements.get("if-count-wrapper").style.display, "block");
  });

  it("should show info for uuidv7", () => {
    _elements.get("if-type").value = "uuidv7";
    idForgeShowInfo();
    assert.ok(_elements.get("if-info").innerHTML.includes("UUID v7 info"));
    assert.ok(_elements.get("if-info").innerHTML.includes("⏱️"));
  });

  it("should show info for ulid", () => {
    _elements.get("if-type").value = "ulid";
    idForgeShowInfo();
    assert.ok(_elements.get("if-info").innerHTML.includes("ULID info"));
    assert.ok(_elements.get("if-info").innerHTML.includes("🔤"));
  });

  it("should show info for nanoid and show length wrapper", () => {
    _elements.get("if-type").value = "nanoid";
    idForgeShowInfo();
    assert.ok(_elements.get("if-info").innerHTML.includes("NanoID info"));
    assert.ok(_elements.get("if-info").innerHTML.includes("🔗"));
    assert.equal(
      _elements.get("if-nanoid-wrapper").style.display,
      "block",
    );
  });

  it("should show info for swhid and show source wrapper", () => {
    _elements.get("if-type").value = "swhid";
    idForgeShowInfo();
    assert.ok(_elements.get("if-info").innerHTML.includes("SWHID info"));
    assert.ok(_elements.get("if-info").innerHTML.includes("📦"));
    assert.equal(
      _elements.get("if-swhid-source-wrapper").style.display,
      "block",
    );
    assert.equal(
      _elements.get("if-count-wrapper").style.display,
      "none",
    );
  });

  it("should hide info panel for unknown type with no i18n text", () => {
    _elements.get("if-type").value = "unknown_type";
    idForgeShowInfo();
    assert.equal(_elements.get("if-info").style.display, "none");
  });
});

describe("ID Forge (browser) — switchSwhidTab", () => {
  beforeEach(() => {
    resetMocks();
    // Add tab buttons
    mockEl("tab-file", {
      dataset: { swhidTab: "file" },
      style: { background: "", color: "" },
    });
    mockEl("tab-text", {
      dataset: { swhidTab: "text" },
      style: { background: "", color: "" },
    });
  });

  it("should switch to file tab", () => {
    switchSwhidTab("file");
    const fileTab = _elements.get("tab-file");
    const textTab = _elements.get("tab-text");
    assert.equal(fileTab.style.background, "var(--accent, #6c5ce7)");
    assert.equal(fileTab.style.color, "#fff");
    assert.equal(textTab.style.background, "var(--card, #f0f0f0)");
    assert.equal(textTab.style.color, "var(--text, #333)");
    assert.equal(
      _elements.get("if-swhid-file-wrapper").style.display,
      "block",
    );
    assert.equal(
      _elements.get("if-swhid-text-wrapper").style.display,
      "none",
    );
  });

  it("should switch to text tab", () => {
    switchSwhidTab("text");
    const fileTab = _elements.get("tab-file");
    const textTab = _elements.get("tab-text");
    assert.equal(fileTab.style.background, "var(--card, #f0f0f0)");
    assert.equal(textTab.style.background, "var(--accent, #6c5ce7)");
    assert.equal(textTab.style.color, "#fff");
    assert.equal(
      _elements.get("if-swhid-file-wrapper").style.display,
      "none",
    );
    assert.equal(
      _elements.get("if-swhid-text-wrapper").style.display,
      "block",
    );
  });

  it("should handle no tab buttons gracefully", () => {
    _elements.delete("tab-file");
    _elements.delete("tab-text");
    switchSwhidTab("file");
    // Should not throw
    assert.equal(
      _elements.get("if-swhid-file-wrapper").style.display,
      "block",
    );
  });
});

describe("ID Forge (browser) — idForgeUpdateCount", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("should keep valid value as-is", () => {
    _elements.get("if-count").value = "42";
    idForgeUpdateCount();
    // Valid values are unchanged (stay as strings from DOM)
    assert.equal(_elements.get("if-count").value, "42");
  });

  it("should clamp NaN to 1", () => {
    _elements.get("if-count").value = "abc";
    idForgeUpdateCount();
    assert.equal(_elements.get("if-count").value, 1);
  });

  it("should clamp values > 10000 to 10000", () => {
    _elements.get("if-count").value = "99999";
    idForgeUpdateCount();
    assert.equal(_elements.get("if-count").value, 10000);
  });

  it("should clamp values < 1 to 1", () => {
    _elements.get("if-count").value = "-5";
    idForgeUpdateCount();
    assert.equal(_elements.get("if-count").value, 1);
  });

  it("should clamp zero to 1", () => {
    _elements.get("if-count").value = "0";
    idForgeUpdateCount();
    assert.equal(_elements.get("if-count").value, 1);
  });

  it("should handle boundary value 10000", () => {
    _elements.get("if-count").value = "10000";
    idForgeUpdateCount();
    // Boundary value of 10000 is valid and unchanged
    assert.equal(_elements.get("if-count").value, "10000");
  });
});

describe("ID Forge (browser) — idForgeShowDownload", () => {
  beforeEach(() => {
    resetMocks();
    _globalDlHandler = null;
    _downloadModalOpen = false;
  });

  it("should open download modal when result exists", () => {
    globalThis._ifResult = {
      ids: ["test"],
      type: "uuidv4",
      count: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    idForgeShowDownload();
    assert.equal(_downloadModalOpen, true);
    assert.equal(
      _elements.get("dl-modal-title").textContent,
      "Download — ID Forge",
    );
    // Handler should be set to idForgeDownload
    assert.equal(_globalDlHandler, idForgeDownload);
  });

  it("should do nothing when no result", () => {
    delete globalThis._ifResult;
    idForgeShowDownload();
    assert.equal(_downloadModalOpen, false);
    assert.equal(_globalDlHandler, null);
  });
});

describe("ID Forge (browser) — downloadBlobSimple", () => {
  beforeEach(() => {
    _lastDownloadArgs = null;
  });

  it("should create anchor element and trigger download (original impl)", () => {
    // Use the original downloadBlobSimple from id_forge.js
    const origFn = globalThis._origDownloadBlobSimple;
    const blob = new Blob(["test content"], { type: "text/plain" });
    origFn(blob, "test.txt");
    assert.ok(_lastDownloadArgs, "download should be triggered");
    assert.equal(_lastDownloadArgs.name, "test.txt");
    // Verify URL.createObjectURL was called by checking url
    assert.ok(_lastDownloadArgs.url, "url should be set");
  });
});
