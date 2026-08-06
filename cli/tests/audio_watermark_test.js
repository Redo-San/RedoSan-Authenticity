const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

function makeMockDoc() {
  const makeEl = () => ({
    value: "1", style: { display: "" }, files: null, textContent: "", innerHTML: "",
    classList: { remove: () => {}, add: () => {} },
  });
  function makeDiv() {
    const el = { _txt: "", _inner: "", style: {} };
    Object.defineProperty(el, "innerHTML", {
      get: function() { return this._txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
      set: function(v) { this._inner = v; },
    });
    el.append = function(v) { if (v && v.nodeType === 3) this._txt += v.textContent; };
    return el;
  }
  return {
    createElement: (tag) => tag === "div" ? makeDiv() : makeEl(),
    createTextNode: (txt) => ({ nodeType: 3, textContent: txt }),
    addEventListener: () => {},
    getElementById: () => makeEl(),
    querySelectorAll: () => [],
    querySelector: () => null,
  };
}
globalThis.document = makeMockDoc();
globalThis.URL.createObjectURL = () => "blob:test";
globalThis.URL.revokeObjectURL = () => {};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const crypto = require("crypto");
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

// ── Mock shared functions ──
globalThis._resultStore = {};
globalThis.setResult = (k, d) => { globalThis._resultStore[k] = d; };
globalThis.getResult = (k) => globalThis._resultStore[k];
globalThis.setText = () => {};
globalThis.setOutput = () => {};
globalThis.spinner = () => {};
globalThis.getVal = () => "";
globalThis.getFile = async () => null;
globalThis.validateFileInput = async () => true;
globalThis.__ = (key, fallback) => fallback || key;
globalThis.downloadBlobSimple = () => {};
globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

// ── Load modules ──
const MODULES = [
  ["../../Watermark/utils.js", "utils.js"],
  ["../../Audio_Watermark/audio_watermark_core.js", "audio_watermark_core.js"],
  ["../../Audio_Watermark/audio_watermark.js", "audio_watermark.js"],
];
for (const [rel] of MODULES) {
  const src = fs.readFileSync(path.join(__dirname, rel), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, rel) });
}

// ── Helpers ──
function makeTestWav(numSamples, sr) {
  sr = sr || 44100;
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
    v.setInt16(44 + i * 2, Math.floor(Math.sin(2 * Math.PI * 440 * i / sr) * 16000), true);
  }
  return buf;
}

function makeAudioFile(name, numSamples, sr) {
  const buf = makeTestWav(numSamples, sr);
  return {
    name: name || "test.wav",
    size: buf.byteLength,
    arrayBuffer: async () => buf,
  };
}

const KEY = "testkey123";
const MSG = "Hello!";

async function setupEmbedResult(algo, embedFn) {
  const sr = 44100;
  const payload = globalThis.awFormatPayload(new TextEncoder().encode(MSG), await globalThis.pw_key(KEY));
  const needed = algo === 1 || algo === 5 ? payload.length : algo === 3 ? payload.length * globalThis.AWM3_FRAME * 3 : algo === 4 ? payload.length * (globalThis.AWM4_FRAME >> 1) : algo === 7 ? payload.length * (globalThis.AWM7_FRAME >> 1) * 5 : algo === 6 ? payload.length * 1024 : algo === 8 ? payload.length * 1024 : algo === 2 ? payload.length * 2048 : 100000;
  const buf = makeTestWav(needed + 5000, sr);
  const info = globalThis.awReadWavRaw(buf);
  const s16 = new Int16Array(info.samples);
  return { s16, payload, sr, info };
}

// ── Tests: escapeHtml ──
describe("Audio WM — escapeHtml", () => {
  it("should escape special characters", () => {
    assert.equal(globalThis.escapeHtml("<script>"), "&lt;script&gt;");
    assert.equal(globalThis.escapeHtml('a&b "c"'), "a&amp;b &quot;c&quot;");
  });

  it("should handle plain text", () => {
    assert.equal(globalThis.escapeHtml("hello world"), "hello world");
  });
});

// ── Tests: tryExtractSingle ──
describe("Audio WM — tryExtractSingle", () => {
  it("should return null for clean audio (no watermark)", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 1, key, 44100, "LSB Audio");
    assert.equal(result, null);
  });

  it("should return null for algo 3 on clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 3, key, 44100, "Echo Hiding");
    assert.equal(result, null);
  });

  it("should return null for algo 4 on clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 4, key, 44100, "DSSS");
    assert.equal(result, null);
  });

  it("should return null for algo 6 on clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 6, key, 44100, "DWT");
    assert.equal(result, null);
  });

  it("should return null for algo 7 on clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 7, key, 44100, "Patchwork");
    assert.equal(result, null);
  });

  it("should return null for algo 8 on clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractSingle(info.samples, 8, key, 44100, "DCT");
    assert.equal(result, null);
  });
});

// ── Tests: tryExtractAuto ──
describe("Audio WM — tryExtractAuto", () => {
  it("should return null for clean audio", async () => {
    const buf = makeTestWav(44100, 44100);
    const info = globalThis.awReadWavRaw(buf);
    const key = await globalThis.pw_key(KEY);
    const result = await globalThis.tryExtractAuto(info.samples, key, 44100, [1, 2, 5]);
    assert.equal(result, null);
  });
});

// ── Tests: awmSelfTest (create synthetic audio, embed+extract all algos) ──
describe("Audio WM — awmSelfTest (simulated)", () => {
  it("should run self-test logic and pass all algorithm tests", async () => {
    const sr = 44100;
    const len = sr * 5;
    const buf = makeTestWav(len, sr);
    const info = globalThis.awReadWavRaw(buf);
    const PASS = "diagnostic";
    const MSG_ST = "SELF_TEST_OK";
    const key = await globalThis.pw_key(PASS);
    const payload = globalThis.awFormatPayload(new TextEncoder().encode(MSG_ST), key);
    const s16 = new Int16Array(info.samples);

    const algos = [
      { id: 1, name: "LSB", embed: () => globalThis.aw1_embed(new Int16Array(s16), payload),
        extract: (m) => globalThis.aw1_extract(m, m.length) },
      { id: 2, name: "FFT-QIM", embed: () => globalThis.aw2_embed(new Int16Array(s16), payload, sr),
        extract: (m) => globalThis.aw2_extract(m, sr, m.length) },
      { id: 5, name: "QIM", embed: () => globalThis.aw5_embed(new Int16Array(s16), payload, sr),
        extract: (m) => globalThis.aw5_extract(m, sr, m.length) },
      { id: 6, name: "DWT", embed: () => globalThis.aw6_embed(new Int16Array(s16), payload, sr),
        extract: (m) => globalThis.aw6_extract(m, sr, m.length) },
      { id: 8, name: "DCT", embed: () => globalThis.aw8_embed(new Int16Array(s16), payload, sr),
        extract: (m) => globalThis.aw8_extract(m, sr, m.length) },
    ];

    for (const algo of algos) {
      const maxB = algo.id === 1 || algo.id === 5 ? s16.length : Math.floor(s16.length / (algo.id === 8 ? 1024 : algo.id === 6 ? 1024 : 2048));
      if (payload.length > maxB) continue;
      const modified = algo.embed();
      const bits = algo.extract(modified);
      const r = (bits && bits.length >= 32) ? globalThis.awExtractPayload(bits, key) : null;
      const decoded = r && r !== "bad-password" ? new TextDecoder().decode(r) : null;
      assert.equal(decoded, MSG_ST, `${algo.name} should roundtrip`);
    }
  });
});

// ── Tests: toggle functions with DOM ──
describe("Audio WM — toggle functions", () => {
  it("toggleAwmPassword should handle null DOM gracefully", () => {
    globalThis.document = makeMockDoc();
    globalThis.toggleAwmPassword();
    globalThis.toggleAwmInput();
    globalThis.toggleAwmPasswordEx();
  });

  it("toggleAwmPassword should show/hide strength group", () => {
    const pwGroup = { style: { display: "" } };
    const strengthGroup = { style: { display: "" } };
    const fileGroup = { style: { display: "" } };
    const textGroup = { style: { display: "" } };
    const typeSelect = { value: "5" };
    const doc = makeMockDoc();
    doc.getElementById = (id) => {
      if (id === "awm-password-group") return pwGroup;
      if (id === "awm-strength-group") return strengthGroup;
      if (id === "awm-file-group") return fileGroup;
      if (id === "awm-text-group") return textGroup;
      if (id === "awm-type") return typeSelect;
      return null;
    };
    globalThis.document = doc;

    globalThis.toggleAwmPassword();
    assert.equal(strengthGroup.style.display, "");

    typeSelect.value = "1";
    globalThis.toggleAwmPassword();
    assert.equal(strengthGroup.style.display, "none");
  });
});
