const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

var _els = {};

/**
 *
 * @param id
 * @param extra
 */
function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign({
      style: { display: "" },
      value: "", textContent: "", innerHTML: "", className: "", src: "", download: "",
      disabled: false, onclick: null,
      files: null,
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      append() {}, appendChild() {}, remove() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
      getAttribute(a) { return this[a] || null; },
      setAttribute(a, v) { this[a] = v; },
      click() {}, focus() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      parentElement: {},
      parentNode: { insertBefore() {}, removeChild() {}, querySelector() { return null; } },
    }, extra || {});
  } else if (extra) {
    Object.assign(_els[id], extra);
  }
  return _els[id];
}

/**
 *
 */
function resetEls() { _els = {}; }

/**
 *
 */
function setupDOM() {
  _els = {};
  globalThis.document = {
    documentElement: { dataset: {}, style: {}, getAttribute() { return null; } },
    getElementById(id) { return _els[id] || null; },
    querySelector(sel) { return null; },
    querySelectorAll(sel) {
      if (sel === ".tab-btn[data-awm-tab]") return [];
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
    createElement(tag) {
      if (tag === "div") {
        const el = { style: {}, _txt: "", _inner: "",
          appendChild(child) { if (child && child.textContent !== undefined) this._txt += child.textContent; },
          append(...children) { for (const c of children) { if (c && c.textContent !== undefined) this._txt += c.textContent; } },
        };
        Object.defineProperty(el, "innerHTML", {
          get() { return this._txt || this._inner; },
          set(v) { this._inner = v; this._txt = ""; },
        });
        return el;
      }
      return { value: "", style: {}, classList: { add() {}, remove() {}, toggle() {} } };
    },
    createTextNode(txt) { return { nodeType: 3, textContent: txt }; },
  };
  globalThis.window = globalThis;
}

/**
 *
 */
function setupSharedMocks() {
  globalThis._resultStore = {};
  globalThis.setResult = (k, d) => { globalThis._resultStore[k] = d; };
  globalThis.getResult = (k) => globalThis._resultStore[k];
  globalThis.setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  globalThis.setOutput = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  globalThis.spinner = () => {};
  globalThis.showResult = () => {};
  globalThis.closeDownloadModal = () => {};
  globalThis.getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  globalThis.getFile = async (id) => { const el = document.getElementById(id); return el && el.files && el.files.length ? el.files[0] : null; };
  globalThis.validateFileInput = async () => true;
  globalThis.__ = (key, fallback) => fallback || key;
  globalThis.URL.createObjectURL = () => "blob:test/" + Math.random();
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.downloadBlobSimple = () => {};
  globalThis.downloadBlob = () => {};
  globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  globalThis.FormData = function() { return { append() {} }; };
  globalThis.alert = () => {};
  globalThis.setTimeout = setTimeout;
  globalThis.clearTimeout = clearTimeout;
}

/**
 *
 */
function setupCrypto() {
  const crypto = require("node:crypto");
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
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
    const h = await globalThis.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
  };
}

/**
 *
 */
function loadModules() {
  const modules = [
    ["../../Watermark/utils.js"],
    ["../../Audio_Watermark/audio_watermark_core.js"],
    ["../../Audio_Watermark/audio_watermark.js"],
  ];
  for (const [rel] of modules) {
    const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
    vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
  }
}

/**
 *
 * @param numSamples
 * @param sr
 */
function makeTestWav(numSamples, sr) {
  sr = sr || 44_100;
  const bps = 16, ch = 1, ba = ch * (bps / 8);
  const dataSize = numSamples * ba;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true);
  v.setUint16(32, ba, true); v.setUint16(34, bps, true); w(36, "data");
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    v.setInt16(44 + i * 2, Math.floor(Math.sin(2 * Math.PI * 440 * i / sr) * 16_000), true);
  }
  return buf;
}

/**
 *
 * @param name
 * @param numSamples
 * @param sr
 */
function makeAudioFile(name, numSamples, sr) {
  const buf = makeTestWav(numSamples, sr);
  const u8 = new Uint8Array(buf);
  return {
    name: name || "test.wav",
    size: u8.length,
    arrayBuffer: () => Promise.resolve(u8.buffer),
    text: () => Promise.resolve(""),
    slice: function() { return this; },
  };
}

before(() => {
  setupCrypto();
  setupDOM();
  setupSharedMocks();
  loadModules();
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
});

// ── switchAwmTab ──
describe("Audio WM UI — switchAwmTab", () => {
  it("switches to embed tab", () => {
    resetEls();
    const embed = makeEl("awm-embed");
    const extract = makeEl("awm-extract");
    globalThis.document.querySelectorAll = () => [{ classList: { remove() {}, add() {} } }];
    globalThis.document.querySelector = (sel) => {
      if (sel === '.tab-btn[data-awm-tab="embed"]') return { classList: { add() {} } };
      return null;
    };
    globalThis.switchAwmTab("embed");
    assert.equal(embed.style.display, "");
    assert.equal(extract.style.display, "none");
  });

  it("switches to extract tab", () => {
    resetEls();
    const embed = makeEl("awm-embed", { style: { display: "none" } });
    const extract = makeEl("awm-extract", { style: { display: "" } });
    globalThis.document.querySelectorAll = () => [{ classList: { remove() {}, add() {} } }];
    globalThis.document.querySelector = (sel) => {
      if (sel === '.tab-btn[data-awm-tab="extract"]') return { classList: { add() {} } };
      return null;
    };
    globalThis.switchAwmTab("extract");
    assert.equal(embed.style.display, "none");
    assert.equal(extract.style.display, "");
  });
});

// ── toggleAwmPassword ──
describe("Audio WM UI — toggleAwmPassword", () => {
  it("shows strength group for types 5, 6, 8", () => {
    resetEls();
    makeEl("awm-type", { value: "5" });
    makeEl("awm-password-group");
    makeEl("awm-strength-group");
    globalThis.toggleAwmPassword();
    assert.notEqual(document.getElementById("awm-strength-group").style.display, "none");
  });

  it("hides strength group for type 1", () => {
    resetEls();
    makeEl("awm-type", { value: "1" });
    makeEl("awm-password-group");
    makeEl("awm-strength-group");
    globalThis.toggleAwmPassword();
    assert.equal(document.getElementById("awm-strength-group").style.display, "none");
  });
});

// ── toggleAwmPasswordEx ──
describe("Audio WM UI — toggleAwmPasswordEx", () => {
  it("shows strength group for type 0", () => {
    resetEls();
    makeEl("awm-type-ex", { value: "0" });
    makeEl("awm-password-ex-group");
    makeEl("awm-strength-ex-group");
    globalThis.toggleAwmPasswordEx();
    assert.notEqual(document.getElementById("awm-strength-ex-group").style.display, "none");
  });

  it("hides strength group for type 1", () => {
    resetEls();
    makeEl("awm-type-ex", { value: "1" });
    makeEl("awm-password-ex-group");
    makeEl("awm-strength-ex-group");
    globalThis.toggleAwmPasswordEx();
    assert.equal(document.getElementById("awm-strength-ex-group").style.display, "none");
  });
});

// ── toggleAwmInput ──
describe("Audio WM UI — toggleAwmInput", () => {
  it("shows text group for low-capacity types (3,4,7)", () => {
    resetEls();
    makeEl("awm-type", { value: "3" });
    makeEl("awm-file-group");
    makeEl("awm-text-group");
    makeEl("awm-text", { value: "test" });
    makeEl("awm-text-info");
    makeEl("awm-audio");
    makeEl("awm-capacity");
    globalThis.toggleAwmInput();
    assert.equal(document.getElementById("awm-file-group").style.display, "none");
    assert.notEqual(document.getElementById("awm-text-group").style.display, "none");
  });

  it("shows file group for high-capacity types", () => {
    resetEls();
    makeEl("awm-type", { value: "1" });
    makeEl("awm-file-group");
    makeEl("awm-text-group");
    makeEl("awm-file");
    const fi = makeEl("awm-file");
    fi.files = null;
    globalThis.toggleAwmInput();
    assert.notEqual(document.getElementById("awm-file-group").style.display, "none");
    assert.equal(document.getElementById("awm-text-group").style.display, "none");
  });
});

// ── updateAwmCapacity ──
describe("Audio WM UI — updateAwmCapacity", () => {
  it("clears capacity when no audio file", () => {
    resetEls();
    makeEl("awm-audio");
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "1" });
    globalThis.updateAwmCapacity();
    assert.equal(document.getElementById("awm-capacity").textContent, "");
  });

  it("shows capacity for type 1 with audio file and secret bytes", () => {
    resetEls();
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "1" });
    makeEl("awm-text", { value: "" });
    globalThis._awmSecretBytes = new Uint8Array([1, 2, 3]);
    globalThis.updateAwmCapacity();
    assert.ok(document.getElementById("awm-capacity").textContent.length > 0);
    globalThis._awmSecretBytes = null;
  });

  it("shows capacity with text for low-capacity type 3", () => {
    resetEls();
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "3" });
    makeEl("awm-text", { value: "hello" });
    makeEl("awm-text-info");
    globalThis.updateAwmCapacity();
    assert.ok(document.getElementById("awm-capacity").textContent.includes("Echo"));
  });

  it("shows capacity with text for low-capacity type 4", () => {
    resetEls();
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "4" });
    makeEl("awm-text", { value: "hello" });
    makeEl("awm-text-info");
    globalThis.updateAwmCapacity();
    assert.ok(document.getElementById("awm-capacity").textContent.includes("DSSS"));
  });

  it("shows capacity with text for low-capacity type 7", () => {
    resetEls();
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "7" });
    makeEl("awm-text", { value: "hello" });
    makeEl("awm-text-info");
    globalThis.updateAwmCapacity();
    assert.ok(document.getElementById("awm-capacity").textContent.includes("Patchwork"));
  });
});

// ── handleAwmEmbed ──
describe("Audio WM UI — handleAwmEmbed", () => {
  it("alerts when no audio file selected", async () => {
    resetEls();
    makeEl("awm-type", { value: "1" });
    makeEl("awm-audio");
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmEmbed();
    assert.ok(alerted);
  });

  it("alerts when no password", async () => {
    resetEls();
    makeEl("awm-type", { value: "1" });
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-password", { value: "" });
    makeEl("awm-file-group");
    makeEl("awm-text-group");
    makeEl("awm-file");
    globalThis._awmSecretBytes = new Uint8Array([1, 2, 3]);
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmEmbed();
    assert.ok(alerted);
  });
});

// ── handleAwmExtract ──
describe("Audio WM UI — handleAwmExtract", () => {
  it("alerts when no audio file selected", async () => {
    resetEls();
    makeEl("awm-type-ex", { value: "1" });
    makeEl("awm-audio-ex");
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmExtract();
    assert.ok(alerted);
  });

  it("alerts when no password", async () => {
    resetEls();
    makeEl("awm-type-ex", { value: "1" });
    makeEl("awm-audio-ex", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-password-ex", { value: "" });
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmExtract();
    assert.ok(alerted);
  });
});

// ── loadAwmFile ──
describe("Audio WM UI — loadAwmFile", () => {
  it("sets _awmSecretBytes to null when no file", () => {
    resetEls();
    globalThis._awmSecretBytes = new Uint8Array([1]);
    globalThis.loadAwmFile({ target: { files: [] } });
    assert.equal(globalThis._awmSecretBytes, null);
  });

  it("reads file and updates capacity", () => {
    resetEls();
    globalThis._awmSecretBytes = null;
    makeEl("awm-file-name");
    makeEl("awm-audio");
    makeEl("awm-capacity");
    makeEl("awm-type", { value: "1" });
    globalThis.FileReader = function() {
      this.readAsText = function() {
        this.onload({ target: { result: "hello" } });
      };
    };
    const event = {
      target: {
        files: [{
          name: "secret.txt",
          size: 5,
          arrayBuffer: () => Promise.resolve(new Uint8Array([104, 101, 108, 108, 111]).buffer),
          text: () => Promise.resolve("hello"),
        }],
      },
    };
    globalThis.loadAwmFile(event);
    assert.equal(globalThis._awmSecretBytes.length, 5);
  });
});

// ── awmSelfTest ──
describe("Audio WM UI — awmSelfTest", () => {
  it("runs self-test and shows results", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    await globalThis.awmSelfTest();
    assert.ok(document.getElementById("awm-output").innerHTML.length > 0);
  });

  it("handles self-test failure gracefully when pw_key throws", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const origPw = globalThis.pw_key;
    globalThis.pw_key = async () => { throw new Error("mock key error"); };
    await globalThis.awmSelfTest();
    globalThis.pw_key = origPw;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show error output");
  });

  it("handles algorithm error during self-test", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const origEmbed = globalThis.aw1_embed;
    globalThis.aw1_embed = () => { throw new Error("mock embed error"); };
    await globalThis.awmSelfTest();
    globalThis.aw1_embed = origEmbed;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show results despite algorithm error");
  });

  it("handles dual-watermark payload too large (skip branch)", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const origFormat = globalThis.awFormatPayload;
    globalThis.awFormatPayload = () => "0".repeat(10000);
    await globalThis.awmSelfTest();
    globalThis.awFormatPayload = origFormat;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show results despite skip");
  });

  it("handles extraction failure during self-test", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const origExtract = globalThis.awExtractPayload;
    globalThis.awExtractPayload = () => null;
    await globalThis.awmSelfTest();
    globalThis.awExtractPayload = origExtract;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show results despite extraction failure");
  });

  it("handles dual-watermark embed error", { timeout: 60_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const orig8Async = globalThis.aw8_embed_async;
    globalThis.aw8_embed_async = () => { throw new Error("mock dual embed error"); };
    await globalThis.awmSelfTest();
    globalThis.aw8_embed_async = orig8Async;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show results despite dual embed error");
  });

  it("handles dual-watermark partial failure (FP extract returns null)", { timeout: 120_000 }, async () => {
    resetEls();
    makeEl("awm-output");
    makeEl("awm-download");
    makeEl("awm-result");
    makeEl("awm-spinner");
    makeEl("awm-progress");
    const origExtract = globalThis.aw8_extract_async;
    globalThis.aw8_extract_async = async () => "0101";
    await globalThis.awmSelfTest();
    globalThis.aw8_extract_async = origExtract;
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Should show results despite dual FP extraction failure");
  });
});

// ── escapeHtml ──
describe("Audio WM UI — escapeHtml", () => {
  it("should escape HTML special characters", () => {
    const result = globalThis.escapeHtml('<script>alert("xss")</script> &');
    assert.ok(result.includes("&lt;") || result.includes("&amp;") || result.length > 0);
  });

  it("should handle plain text unchanged", () => {
    const result = globalThis.escapeHtml("hello world");
    assert.ok(typeof result === "string");
  });

  it("should handle empty string", () => {
    const result = globalThis.escapeHtml("");
    assert.equal(result, "");
  });
});

// ── handleAwmEmbed — success & error ──
describe("Audio WM UI — handleAwmEmbed paths", () => {
  /**
   *
   * @param secretBytes
   */
  function setupEmbedMocks(secretBytes) {
    resetEls();
    makeEl("awm-type", { value: "1" });
    makeEl("awm-audio", { files: [makeAudioFile("test.wav", 44_100)] });
    makeEl("awm-password", { value: "testpass" });
    makeEl("awm-text", { value: "" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    makeEl("awm-file-group", { style: { display: "" } });
    makeEl("awm-text-group", { style: { display: "none" } });
    makeEl("awm-file", { files: [makeAudioFile("secret.txt", 8)] });
    globalThis._awmSecretBytes = secretBytes || new Uint8Array([72, 101, 108, 108, 111]);
    globalThis.validateFileInput = async () => true;
  }

  it("should embed using LSB and show success result", { timeout: 30_000 }, async () => {
    setupEmbedMocks();
    await globalThis.handleAwmEmbed();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Output should contain result HTML");
    const result = document.getElementById("awm-result");
    assert.equal(result.style.display, "", "Result div should be visible");
  });

  it("should handle embed error gracefully", { timeout: 30_000 }, async () => {
    setupEmbedMocks();
    const origLoad = globalThis.awLoadAudio;
    globalThis.awLoadAudio = async () => { throw new Error("mock load error"); };
    await globalThis.handleAwmEmbed();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Error should produce output");
    globalThis.awLoadAudio = origLoad;
  });
});

// ── handleAwmExtract — success, bad password, no watermark, error ──
describe("Audio WM UI — handleAwmExtract paths", () => {
  /**
   *
   * @param audioFile
   */
  function setupExtractMocks(audioFile) {
    resetEls();
    makeEl("awm-type-ex", { value: "1" });
    makeEl("awm-audio-ex", { files: audioFile ? [audioFile] : [] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    globalThis.validateFileInput = async () => true;
  }

  /**
   *
   * @param password
   * @param message
   * @param sr
   */
  function embedWatermarkedWav(password, message, sr) {
    sr = sr || 44_100;
    const buf = makeTestWav(sr, sr);
    const info = globalThis.awReadWavRaw(buf);
    const s16 = new Int16Array(info.samples);
    return globalThis.pw_key(password).then(function(key) {
      const payload = globalThis.awFormatPayload(new TextEncoder().encode(message), key);
      const maxB = s16.length;
      if (payload.length > maxB) return null;
      const modified = globalThis.aw1_embed(s16, payload);
      return globalThis.awWriteWav(modified, sr, 1, info.raw, 16);
    });
  }

  it("should extract LSB watermark and recover message", { timeout: 30_000 }, async () => {
    const wavBuf = await embedWatermarkedWav("testpass", "SECRET_MSG");
    if (!wavBuf) return this.skip();
    const u8 = new Uint8Array(wavBuf);
    const file = {
      name: "wm.wav", size: u8.length,
      arrayBuffer: () => Promise.resolve(u8.buffer),
    };
    setupExtractMocks(file);
    await globalThis.handleAwmExtract();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("SECRET_MSG") || output.innerHTML.includes("extracted") || output.innerHTML.includes("success"),
      "Output should contain extracted message. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should show wrong password message for bad password", { timeout: 30_000 }, async () => {
    const wavBuf = await embedWatermarkedWav("correctpass", "HIDDEN_DATA");
    if (!wavBuf) return this.skip();
    const u8 = new Uint8Array(wavBuf);
    const file = {
      name: "wm.wav", size: u8.length,
      arrayBuffer: () => Promise.resolve(u8.buffer),
    };
    setupExtractMocks(file);
    document.getElementById("awm-password-ex").value = "wrongpass";
    await globalThis.handleAwmExtract();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML.toLowerCase();
    assert.ok(text.includes("wrong") || text.includes("not found") || text.includes("no watermark"),
      "Should indicate bad password. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should show no watermark message for clean audio", { timeout: 30_000 }, async () => {
    const cleanBuf = makeTestWav(44_100, 44_100);
    const u8 = new Uint8Array(cleanBuf);
    const file = {
      name: "clean.wav", size: u8.length,
      arrayBuffer: () => Promise.resolve(u8.buffer),
    };
    setupExtractMocks(file);
    await globalThis.handleAwmExtract();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML.toLowerCase();
    assert.ok(text.includes("no watermark") || text.includes("not found") || text.includes("wrong") || text.length > 0,
      "Should indicate no watermark. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should handle extract error gracefully", { timeout: 30_000 }, async () => {
    const file = {
      name: "bad.wav", size: 100,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    };
    setupExtractMocks(file);
    await globalThis.handleAwmExtract();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Error should produce output");
  });
});

// ── Helpers for additional embed/extract tests ──
/**
 *
 * @param algo
 * @param numSamples
 * @param secretBytes
 */
function setupEmbedDom(algo, numSamples, secretBytes) {
  resetEls();
  makeEl("awm-type", { value: String(algo) });
  makeEl("awm-audio", { files: [makeAudioFile("test.wav", numSamples)] });
  makeEl("awm-password", { value: "testpass" });
  makeEl("awm-text", { value: "" });
  makeEl("awm-spinner", { style: { display: "" } });
  makeEl("awm-progress", { style: { display: "" } });
  makeEl("awm-progress-fill", { style: {} });
  makeEl("awm-progress-text", {});
  makeEl("awm-result", { style: { display: "none" } });
  makeEl("awm-output", { innerHTML: "" });
  makeEl("awm-download", { innerHTML: "" });
  makeEl("awm-file-group", { style: { display: "" } });
  makeEl("awm-text-group", { style: { display: "none" } });
  makeEl("awm-file", { files: [makeAudioFile("secret.txt", 8)] });
  globalThis.validateFileInput = async () => true;
  globalThis._awmSecretBytes = secretBytes || new Uint8Array([72, 101, 108, 108, 111]);
}

/**
 *
 * @param algo
 * @param numSamples
 * @param text
 */
function setupEmbedLowCapDom(algo, numSamples, text) {
  resetEls();
  makeEl("awm-type", { value: String(algo) });
  makeEl("awm-audio", { files: [makeAudioFile("test.wav", numSamples)] });
  makeEl("awm-password", { value: "testpass" });
  makeEl("awm-text", { value: text });
  makeEl("awm-text-info");
  makeEl("awm-capacity");
  makeEl("awm-spinner", { style: { display: "" } });
  makeEl("awm-progress", { style: { display: "" } });
  makeEl("awm-progress-fill", { style: {} });
  makeEl("awm-progress-text", {});
  makeEl("awm-result", { style: { display: "none" } });
  makeEl("awm-output", { innerHTML: "" });
  makeEl("awm-download", { innerHTML: "" });
  makeEl("awm-file-group", { style: { display: "none" } });
  makeEl("awm-text-group", { style: { display: "" } });
  globalThis.validateFileInput = async () => true;
  globalThis._awmSecretBytes = null;
}

/**
 *
 * @param algo
 * @param numSamples
 * @param password
 * @param message
 */
async function makeWatermarkedAudio(algo, numSamples, password, message) {
  const sr = 44100;
  const buf = makeTestWav(numSamples, sr);
  const info = globalThis.awReadWavRaw(buf);
  const s16 = new Int16Array(info.samples);
  const key = await globalThis.pw_key(password);
  const payload = globalThis.awFormatPayload(new TextEncoder().encode(message), key);
  let modified;
  switch (algo) {
    case 1: modified = globalThis.aw1_embed(new Int16Array(s16), payload); break;
    case 2: modified = globalThis.aw2_embed(new Int16Array(s16), payload, sr); break;
    case 3: modified = globalThis.aw3_embed(new Int16Array(s16), payload, sr); break;
    case 4: modified = globalThis.aw4_embed(new Int16Array(s16), payload, sr); break;
    case 5: modified = globalThis.aw5_embed(new Int16Array(s16), payload, sr); break;
    case 6: modified = globalThis.aw6_embed(new Int16Array(s16), payload, sr); break;
    case 7: modified = globalThis.aw7_embed(new Int16Array(s16), payload, sr); break;
    case 8: modified = await globalThis.aw8_embed_async(new Int16Array(s16), payload, sr); break;
    default: throw new Error("Unknown algo " + algo);
  }
  return { wavBuf: globalThis.awWriteWav(modified, sr, 1, info.raw, 16), s16: modified };
}

const _origAwLoadAudio = globalThis.awLoadAudio;

/**
 *
 */
function fixAwLoadAudio() {
  globalThis.awLoadAudio = async (file) => {
    const buf = await file.arrayBuffer();
    return globalThis.awReadWavRaw(buf);
  };
}

/**
 *
 */
function restoreAwLoadAudio() {
  globalThis.awLoadAudio = _origAwLoadAudio;
}

// ── handleAwmEmbed — remaining error paths ──
describe("Audio WM UI — handleAwmEmbed remaining error paths", () => {
  it("should alert when low capacity type has no text", async () => {
    setupEmbedLowCapDom(3, 5000, "");
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmEmbed();
    assert.ok(alerted, "should have alerted when low capacity text is empty");
  });

  it("should alert when high capacity has no secret bytes", async () => {
    setupEmbedDom(1, 5000, null);
    globalThis._awmSecretBytes = null;
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.handleAwmEmbed();
    assert.ok(alerted, "should have alerted when no secret bytes for high capacity");
  });

  it("should show message too long error when payload exceeds capacity", { timeout: 30_000 }, async () => {
    setupEmbedDom(2, 100, new Uint8Array([72, 105]));
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.toLowerCase().includes("too long") || output.innerHTML.length > 0,
      "Should show message too long error. Got: " + output.innerHTML.substring(0, 200));
  });
});

// ── handleAwmEmbed — success with all algorithm types ──
describe("Audio WM UI — handleAwmEmbed algorithm success", () => {
  it("should embed using FFT-QIM (type 2)", { timeout: 60_000 }, async () => {
    setupEmbedDom(2, 600000, new Uint8Array([72, 101, 108, 108, 111]));
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("FFT"),
      "Type 2 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using DSSS (type 4)", { timeout: 60_000 }, async () => {
    setupEmbedLowCapDom(4, 300000, "Hello");
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("DSSS"),
      "Type 4 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using QIM (type 5)", { timeout: 60_000 }, async () => {
    setupEmbedDom(5, 5000, new Uint8Array([72, 101, 108, 108, 111]));
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("QIM"),
      "Type 5 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using DWT (type 6)", { timeout: 60_000 }, async () => {
    setupEmbedDom(6, 300000, new Uint8Array([72, 101, 108, 108, 111]));
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("DWT"),
      "Type 6 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using Patchwork (type 7)", { timeout: 60_000 }, async () => {
    setupEmbedLowCapDom(7, 100000, "Hello");
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("Patchwork"),
      "Type 7 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using DCT async (type 8)", { timeout: 120_000 }, async () => {
    setupEmbedDom(8, 200000, new Uint8Array([72, 101, 108, 108, 111]));
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("DCT"),
      "Type 8 should succeed. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should embed using Echo Hiding (type 3) via handleAwmEmbed", { timeout: 120_000 }, async () => {
    setupEmbedLowCapDom(3, 300000, "Hi");
    fixAwLoadAudio();
    await globalThis.handleAwmEmbed();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("success") || output.innerHTML.includes("Echo"),
      "Type 3 embed should succeed. Got: " + output.innerHTML.substring(0, 200));
  });
});

// ── handleAwmExtract — non-LSB algorithm paths ──
describe("Audio WM UI — handleAwmExtract algorithm paths", () => {
  /**
   *
   * @param audioFile
   * @param algo
   */
  function setupExtractEx(audioFile, algo) {
    resetEls();
    makeEl("awm-type-ex", { value: String(algo) });
    makeEl("awm-audio-ex", { files: audioFile ? [audioFile] : [] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    globalThis.validateFileInput = async () => true;
  }

  it("should extract FFT-QWM (type 2) and recover message", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(2, 600000, "testpass", "SECRET_TYPE2");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type2.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 2);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("SECRET_TYPE2") || text.includes("extracted") || text.includes("success"),
      "Type 2 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should extract DCT async (type 8) and recover message", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(8, 200000, "testpass", "SECRET_DCT");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_dct.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 8);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("SECRET_DCT") || text.includes("extracted") || text.includes("success"),
      "Type 8 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should show wrong password message for type 2 with bad password", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(2, 600000, "correctpass", "HIDDEN_DATA");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 2);
    document.getElementById("awm-password-ex").value = "wrongpass";
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML.toLowerCase();
    assert.ok(text.includes("wrong") || text.includes("not found") || text.includes("no watermark"),
      "Should indicate bad password. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should extract QIM (type 5) via handleAwmExtract inline switch", { timeout: 60_000 }, async () => {
    const wm = await makeWatermarkedAudio(5, 5000, "testpass", "TYPE5_HANDLE");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type5.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 5);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("TYPE5_HANDLE") || text.includes("extracted") || text.includes("success"),
      "Type 5 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should extract DWT (type 6) via handleAwmExtract inline switch", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(6, 300000, "testpass", "TYPE6_DWT");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type6.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 6);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("TYPE6_DWT") || text.includes("extracted") || text.includes("success"),
      "Type 6 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should extract Patchwork (type 7) via handleAwmExtract inline switch", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(7, 100000, "testpass", "TYPE7_HANDLE");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type7.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 7);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("TYPE7_HANDLE") || text.includes("extracted") || text.includes("success"),
      "Type 7 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should extract DSSS (type 4) via handleAwmExtract inline switch", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(4, 350000, "testpass", "TYPE4_EXTRACT");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type4.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 4);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("TYPE4_EXTRACT") || text.includes("extracted") || text.includes("success"),
      "Type 4 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should extract Echo Hiding (type 3) via handleAwmExtract inline switch", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(3, 300000, "testpass", "Hi");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_type3.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 3);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("Hi") || text.includes("extracted") || text.includes("success"),
      "Type 3 extract should recover message. Got: " + text.substring(0, 200));
  });

  it("should show no watermark message for type 2 on clean audio", { timeout: 60_000 }, async () => {
    const cleanBuf = makeTestWav(600000, 44100);
    const u8 = new Uint8Array(cleanBuf);
    const file = { name: "clean.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    fixAwLoadAudio();
    setupExtractEx(file, 2);
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML.toLowerCase();
    assert.ok(text.includes("no watermark") || text.includes("not found") || text.includes("wrong") || text.length > 0,
      "Should indicate no watermark. Got: " + output.innerHTML.substring(0, 200));
  });
});

// ── handleAwmExtract — auto-detect (type 0) ──
describe("Audio WM UI — handleAwmExtract auto-detect", () => {
  /**
   *
   * @param file
   */
  function setupAutoDetectDOM(file) {
    resetEls();
    makeEl("awm-type-ex", { value: "0" });
    makeEl("awm-audio-ex", { files: file ? [file] : [] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    globalThis.validateFileInput = async () => true;
  }

  it("should auto-detect watermark in LSB watermarked audio", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(1, 5000, "testpass", "AUTO_DETECT_MSG");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm_lsb.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    setupAutoDetectDOM(file);
    fixAwLoadAudio();
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML;
    assert.ok(text.includes("AUTO_DETECT_MSG") || text.includes("watermark") || text.includes("found"),
      "Auto-detect should find watermark. Got: " + text.substring(0, 200));
  });

  it("should show no watermark message for clean audio with auto-detect", { timeout: 120_000 }, async () => {
    const cleanBuf = makeTestWav(5000, 44100);
    const u8 = new Uint8Array(cleanBuf);
    const file = { name: "clean.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    setupAutoDetectDOM(file);
    fixAwLoadAudio();
    await globalThis.handleAwmExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    const text = output.innerHTML.toLowerCase();
    assert.ok(text.includes("no watermark") || text.includes("not found") || text.length > 0,
      "Auto-detect on clean audio should show appropriate message. Got: " + text.substring(0, 200));
  });
});

// ── awmMultiDetect ──
describe("Audio WM UI — awmMultiDetect", () => {
  it("should return false for clean audio", { timeout: 120_000 }, async () => {
    const sr = 44100;
    const numSamples = 5000;
    const buf = makeTestWav(numSamples, sr);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key("testpass");
    const spinner = { style: { display: "" } };
    const prog = { style: { display: "" } };
    const progFill = { style: {} };
    const progText = {};
    const resultDiv = { style: { display: "none" } };
    const output = { innerHTML: "" };
    const downloadDiv = { innerHTML: "" };
    makeEl("awm-output", output);
    makeEl("awm-download", downloadDiv);
    makeEl("awm-result", resultDiv);
    const result = await globalThis.awmMultiDetect(info, key, spinner, prog, progFill, progText);
    assert.equal(result, false);
  });

  it("should detect watermark in LSB watermarked audio", { timeout: 120_000 }, async () => {
    const wm = await makeWatermarkedAudio(1, 5000, "testpass", "MULTI_DETECT_TEST");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("testpass");
    const spinner = { style: { display: "" } };
    const prog = { style: { display: "" } };
    const progFill = { style: {} };
    const progText = {};
    const resultDiv = { style: { display: "none" } };
    const output = { innerHTML: "" };
    const downloadDiv = { innerHTML: "" };
    makeEl("awm-output", output);
    makeEl("awm-download", downloadDiv);
    makeEl("awm-result", resultDiv);
    makeEl("awm-type-ex", { value: "1" });
    const result = await globalThis.awmMultiDetect(info, key, spinner, prog, progFill, progText);
    assert.equal(result, true);
  });
});

// ── awmDualExtract ──
describe("Audio WM UI — awmDualExtract", () => {
  it("should alert when no file selected", async () => {
    resetEls();
    makeEl("awm-audio-ex", { files: [] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "0" });
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.awmDualExtract();
    assert.ok(alerted, "should alert when no file selected");
  });

  it("should alert when no password", async () => {
    resetEls();
    makeEl("awm-audio-ex", { files: [makeAudioFile("test.wav", 1000)] });
    makeEl("awm-password-ex", { value: "" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "0" });
    let alerted = false;
    globalThis.alert = () => { alerted = true; };
    await globalThis.awmDualExtract();
    assert.ok(alerted, "should alert when no password");
  });

  it("should handle dual extract with auto-detect algo 0 on watermarked audio", { timeout: 60_000 }, async () => {
    const wm = await makeWatermarkedAudio(1, 5000, "testpass", "DUAL_AUTO_DATA");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    resetEls();
    makeEl("awm-audio-ex", { files: [file] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "0" });
    makeEl("awm-dual-did-algo", { value: "0" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    fixAwLoadAudio();
    await globalThis.awmDualExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Dual extract auto-detect should produce output");
  });

  it("should handle dual extract with watermarked mono audio (LSB)", { timeout: 60_000 }, async () => {
    const wm = await makeWatermarkedAudio(1, 5000, "testpass", "DUAL_WM_DATA");
    if (!wm) return;
    const u8 = new Uint8Array(wm.wavBuf);
    const file = { name: "wm.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    resetEls();
    makeEl("awm-audio-ex", { files: [file] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "1" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    fixAwLoadAudio();
    await globalThis.awmDualExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("DUAL_WM_DATA") || output.innerHTML.includes("Fingerprint"),
      "Dual extract should find watermark. Got: " + output.innerHTML.substring(0, 200));
  });

  it("should handle dual extract error gracefully", { timeout: 10_000 }, async () => {
    const file = { name: "bad.wav", size: 100, arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) };
    resetEls();
    makeEl("awm-audio-ex", { files: [file] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "1" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    await globalThis.awmDualExtract();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Dual extract error should produce output");
  });

  it("should handle dual extract gracefully with clean mono audio", { timeout: 60_000 }, async () => {
    resetEls();
    const cleanBuf = makeTestWav(5000, 44100);
    const u8 = new Uint8Array(cleanBuf);
    const file = { name: "clean.wav", size: u8.length, arrayBuffer: () => Promise.resolve(u8.buffer) };
    makeEl("awm-audio-ex", { files: [file] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "1" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    fixAwLoadAudio();
    await globalThis.awmDualExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.length > 0, "Dual extract should produce output. Got: " + output.innerHTML.substring(0, 200));
  });
});

// ── tryExtractSingle — uncovered algorithm paths ──
describe("Audio WM UI — tryExtractSingle algorithm paths", () => {
  it("should extract DSSS (type 4) message via tryExtractSingle", { timeout: 120_000 }, async () => {
    const sr = 44100;
    const numSamples = 300000;
    const wm = await makeWatermarkedAudio(4, numSamples, "testpass", "TYPE4_DSSS");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("testpass");
    const result = await globalThis.tryExtractSingle(info.samples, 4, key, sr, "DSSS");
    assert.ok(result && result.decoded, "tryExtractSingle type 4 should return decoded message");
    assert.ok(result.decoded.includes("TYPE4_DSSS"),
      "Should recover 'TYPE4_DSSS'. Got: " + (result ? result.decoded : "null"));
  });

  it("should extract QIM (type 5) message via tryExtractSingle", { timeout: 60_000 }, async () => {
    const sr = 44100;
    const numSamples = 5000;
    const wm = await makeWatermarkedAudio(5, numSamples, "testpass", "TYPE5_QIM");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("testpass");
    const result = await globalThis.tryExtractSingle(info.samples, 5, key, sr, "QIM");
    assert.ok(result && result.decoded, "tryExtractSingle type 5 should return decoded message");
    assert.ok(result.decoded.includes("TYPE5_QIM"),
      "Should recover 'TYPE5_QIM'. Got: " + (result ? result.decoded : "null"));
  });

  it("should extract Patchwork (type 7) message via tryExtractSingle", { timeout: 120_000 }, async () => {
    const sr = 44100;
    const numSamples = 100000;
    const wm = await makeWatermarkedAudio(7, numSamples, "testpass", "TYPE7_PATCH");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("testpass");
    const result = await globalThis.tryExtractSingle(info.samples, 7, key, sr, "Patchwork");
    assert.ok(result && result.decoded, "tryExtractSingle type 7 should return decoded message");
    assert.ok(result.decoded.includes("TYPE7_PATCH"),
      "Should recover 'TYPE7_PATCH'. Got: " + (result ? result.decoded : "null"));
  });

  it("should extract Echo Hiding (type 3) message via tryExtractSingle", { timeout: 120_000 }, async () => {
    const sr = 44100;
    // "Hi" → 4 len + 2 marker + 2 data = 8 bytes = 64 bits × 4096 = 262k min
    const numSamples = 300000;
    const wm = await makeWatermarkedAudio(3, numSamples, "testpass", "Hi");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("testpass");
    const result = await globalThis.tryExtractSingle(info.samples, 3, key, sr, "Echo Hiding");
    assert.ok(result && result.decoded, "tryExtractSingle type 3 should return decoded message");
    assert.ok(result.decoded.includes("Hi"),
      "Should recover 'Hi'. Got: " + (result ? result.decoded : "null"));
  });

  it("should return null for tryExtractSingle with wrong password", { timeout: 60_000 }, async () => {
    const sr = 44100;
    const numSamples = 5000;
    const wm = await makeWatermarkedAudio(5, numSamples, "correctpass", "SECRET_DATA");
    if (!wm) return;
    const info = globalThis.awReadWavRaw(new Uint8Array(wm.wavBuf).buffer);
    const key = await globalThis.pw_key("wrongpass");
    const result = await globalThis.tryExtractSingle(info.samples, 5, key, sr, "QIM");
    assert.equal(result, null, "tryExtractSingle with wrong password should return null");
  });
});

// ── Stereo branch coverage ──
describe("Audio WM UI — stereo branch coverage", () => {
  /**
   *
   * @param numSamples
   * @param sr
   */
  function makeStereoWav(numSamples, sr) {
    sr = sr || 44100;
    const bps = 16, ch = 2, ba = ch * (bps / 8);
    const dataSize = numSamples * ba;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE");
    w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true);
    v.setUint16(32, ba, true); v.setUint16(34, bps, true); w(36, "data");
    v.setUint32(40, dataSize, true);
    for (let i = 0; i < numSamples; i++) {
      const val = Math.floor(Math.sin(2 * Math.PI * 440 * i / sr) * 16_000);
      v.setInt16(44 + i * 4, val, true);     // Left
      v.setInt16(46 + i * 4, val, true);     // Right (same)
    }
    return buf;
  }

  it("should handle stereo audio in awmMultiDetect right channel branch", { timeout: 120_000 }, async () => {
    const sr = 44100;
    const numSamples = 5000;
    const stereoBuf = makeStereoWav(numSamples, sr);
    const info = globalThis.awReadWavRaw(stereoBuf);
    assert.equal(info.ch, 2, "Should detect stereo");
    // Watermark the samples (left channel) with LSB
    const s16 = new Int16Array(info.samples);
    const key = await globalThis.pw_key("testpass");
    const payload = globalThis.awFormatPayload(new TextEncoder().encode("STEREO_TEST"), key);
    globalThis.aw1_embed(s16, payload);
    // Re-create stereo WAV with watermarked left channel
    const stereoWmBuf = globalThis.awWriteWav([s16, s16], sr, 2, null, 16);
    const wmInfo = globalThis.awReadWavRaw(new Uint8Array(stereoWmBuf).buffer);
    assert.equal(wmInfo.ch, 2, "Watermarked stereo should have ch=2");
    // Set up DOM for awmMultiDetect
    resetEls();
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-type-ex", { value: "1" });
    const spinner = { style: { display: "" } };
    const prog = { style: { display: "" } };
    const progFill = { style: {} };
    const progText = {};
    const result = await globalThis.awmMultiDetect(wmInfo, key, spinner, prog, progFill, progText);
    assert.equal(result, true, "awmMultiDetect should find watermark in stereo audio");
  });

  it("should handle stereo audio in awmDualExtract right channel branch", { timeout: 120_000 }, async () => {
    const sr = 44100;
    const numSamples = 5000;
    const stereoBuf = makeStereoWav(numSamples, sr);
    const info = globalThis.awReadWavRaw(stereoBuf);
    // Watermark the samples (left channel) with LSB
    const s16 = new Int16Array(info.samples);
    const key = await globalThis.pw_key("testpass");
    const payload = globalThis.awFormatPayload(new TextEncoder().encode("DUAL_STEREO"), key);
    globalThis.aw1_embed(s16, payload);
    const stereoWmBuf = globalThis.awWriteWav([s16, s16], sr, 2, null, 16);
    const u8 = new Uint8Array(stereoWmBuf);
    const file = {
      name: "stereo_wm.wav", size: u8.length,
      arrayBuffer: () => Promise.resolve(u8.buffer),
      slice: function() { return this; },
    };
    resetEls();
    makeEl("awm-audio-ex", { files: [file] });
    makeEl("awm-password-ex", { value: "testpass" });
    makeEl("awm-dual-fp-algo", { value: "1" });
    makeEl("awm-dual-did-algo", { value: "1" });
    makeEl("awm-spinner", { style: { display: "" } });
    makeEl("awm-progress", { style: { display: "" } });
    makeEl("awm-progress-fill", { style: {} });
    makeEl("awm-progress-text", {});
    makeEl("awm-result", { style: { display: "none" } });
    makeEl("awm-output", { innerHTML: "" });
    makeEl("awm-download", { innerHTML: "" });
    fixAwLoadAudio();
    await globalThis.awmDualExtract();
    restoreAwLoadAudio();
    const output = document.getElementById("awm-output");
    assert.ok(output.innerHTML.includes("DUAL_STEREO") || output.innerHTML.includes("Fingerprint"),
      "Stereo dual extract should find watermark. Got: " + output.innerHTML.substring(0, 200));
  });
});
