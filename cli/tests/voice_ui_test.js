/*
 * cli/tests/voice_ui_test.js
 *
 * Unit tests for Voice_Biometric/voice_ui.js — the browser controller of the
 * voice-biometric verification chain. Mirrors the harness used by
 * cli/tests/face_ui_test.js (polyfill + vm pattern).
 *
 * The real VoiceCrypto / VoiceTemplateProtection / VoiceEngine /
 * VoiceStandards / VoiceRegistry modules are loaded through vm; the browser
 * singletons that need a browser (ONNX embedder, anti-spoof model, C2PA
 * provenance bridge, microphone) are injected as lightweight mocks.
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// ── Global helpers needed by voice_ui.js ──

// escHtml (same as shared.js)
globalThis.escHtml = function (str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

// i18n __ — mirror browser behavior for missing keys (returns fallback or undefined)
globalThis.__ = function (key, fallback) {
  return fallback === undefined ? undefined : fallback;
};

// Download modal spies
const downloads = [];
globalThis.downloadBlobSimple = function (blob, name) {
  downloads.push({ blob: blob, name: name });
};
let downloadHandler = null;
globalThis.setDownloadHandler = function (fn) {
  downloadHandler = fn;
};
let modalClosed = 0;
globalThis.closeDownloadModal = function () {
  modalClosed++;
};
globalThis.showDownloadModal = function () {};

globalThis.confirm = function () {
  return true;
};

// ensureLib default no-op; tests override to inject fake jspdf/docx
globalThis.ensureLib = async function () {
  return;
};

// DID mocks (mirror Decentralized_Identity_DID/did.js shapes)
globalThis.didGenerateKeypair = async function (algo) {
  return { did: "did:key:zTest1234567890", algorithm: algo || "Ed25519" }; // gitleaks:allow
};
globalThis.didSign = async function () {
  return new Uint8Array([1, 2, 3]);
};
globalThis.didSigToBase64 = function (sig) {
  return Buffer.from(sig).toString("base64");
};
globalThis.didGenerateDocument = function (kp) {
  return {
    id: kp.did,
    verificationMethod: [
      { id: kp.did + "#key-1", type: "Ed25519VerificationKey2020" },
    ],
  };
};
globalThis.didCreateVerifiableCredential = function (kp, subject, sig) {
  return {
    type: ["VerifiableCredential"],
    issuer: kp.did,
    credentialSubject: { descriptorHash: subject },
    proof: { signature: sig },
  };
};

// ── Injectable browser singletons (only used by VoiceEngine at construction
//    time and by the provenance/mic bridges) ──

let antiSpoofVerdict = "BONAFIDE";
let embedderThrows = false;
globalThis.VoiceONNXEmbedder = {
  embed: async function () {
    if (embedderThrows) throw new Error("mock embedder failed");
    const e = new Float32Array(192);
    for (let i = 0; i < 192; i++) e[i] = 0.05 + (i % 13) / 100;
    return e;
  },
  isReady: function () {
    return true;
  },
};
globalThis.VoiceAntiSpoof = {
  detect: async function () {
    return { verdict: antiSpoofVerdict };
  },
  VERDICTS: { BONAFIDE: "BONAFIDE", SPOOF: "SPOOF" },
};
globalThis.VoiceProvenance = {
  embedAudio: async function (opts) {
    return {
      output: new Uint8Array((opts.bytes ? opts.bytes.length : 0) + 8),
      manifest: {
        format: "wav",
        manifestLabel: "redosan.voice.ots.v1",
        signerDid: opts.keypair && opts.keypair.did,
        storeLength: 8,
        exclusionStart: 0,
        exclusionLength: 4,
      },
    };
  },
};

let micSupported = true;
let micBlocks = [];
let micStartThrows = null;
globalThis.VoiceMicrophone = {
  SAMPLE_RATE: 16000,
  supported: function () {
    return micSupported;
  },
  start: async function (opts) {
    if (micStartThrows) throw micStartThrows;
    for (let i = 0; i < micBlocks.length; i++) {
      if (opts && opts.onPcm) opts.onPcm(micBlocks[i]);
    }
    return { sampleRate: 16000, fallback: false };
  },
  stop: function () {},
  getMicrophoneErrorMessage: function (e) {
    return "Mic error: " + (e && e.message ? e.message : e);
  },
};

// ── Load real module sources (same polyfill pattern as face tests) ──

function loadReal(relative) {
  const p = path.join(__dirname, "..", "..", relative);
  const src = fs.readFileSync(p, "utf8");
  vm.runInThisContext(src, { filename: path.resolve(p) });
  return src;
}

loadReal("Voice_Biometric/voice_crypto.js");
loadReal("Voice_Biometric/voice_template_protection.js");
loadReal("Voice_Biometric/voice_engine.js");
loadReal("Voice_Biometric/voice_standards.js");

const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

loadReal("Voice_Biometric/voice_registry.js");
loadReal("Voice_Biometric/voice_ui.js");

// decodeAudioFile is a top-level function in voice_ui.js; override the global
// binding so tests can feed synthetic PCM without Web Audio.
let mockDecoded = null;
let mockDecodeError = null;
globalThis.decodeAudioFile = async function () {
  if (mockDecodeError) throw mockDecodeError;
  if (!mockDecoded) throw new Error("mockDecoded not set");
  return mockDecoded;
};

// ── PCM + File helpers ──

function sinePcm(seconds, amplitude, freq) {
  amplitude = amplitude === undefined ? 0.5 : amplitude;
  freq = freq === undefined ? 440 : freq;
  const n = Math.round(seconds * 16000);
  const p = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    p[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / 16000);
  }
  return p;
}

function silencePcm(seconds) {
  return new Float32Array(Math.round(seconds * 16000));
}

function fakeFile(overrides) {
  const f = {
    name: "sample.wav",
    type: "audio/wav",
    size: 2048,
    arrayBuffer: async function () {
      return new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    },
  };
  if (overrides) Object.assign(f, overrides);
  return f;
}

// ── DOM mocks ──

function makeClassList() {
  const cls = new Set();
  return {
    toggle(name, force) {
      const on = force !== undefined ? !!force : !cls.has(name);
      if (on) cls.add(name);
      else cls.delete(name);
      return on;
    },
    contains(name) {
      return cls.has(name);
    },
    add(name) {
      cls.add(name);
    },
    remove(name) {
      cls.delete(name);
    },
  };
}

// Mock document with every element voice_ui.js touches.
function makeVoiceDoc(overrides) {
  const mt = { textContent: "" };
  const store = {
    "voice-status": { textContent: "" },
    "voice-steps": { textContent: "", style: {} },
    "voice-preview": { style: {} },
    "voice-actions": { style: {} },
    "voice-report": { style: {}, innerHTML: "", select: function () {} },
    "voice-label": { value: "" },
    "voice-list": {
      innerHTML: "",
      append: function (el) {
        if (el && el.innerHTML) this.innerHTML += el.innerHTML;
      },
    },
    "voice-count": { textContent: "", setAttribute: function () {} },
    "voice-migration-note": { style: {} },
    "voice-spinner": { style: {} },
    "voice-audio": { files: [fakeFile()], disabled: false },
    "voice-record-start": { disabled: false },
    "voice-record-stop": { disabled: true },
    "voice-record-abort": { disabled: true },
    "voice-upload-wrapper": { style: {} },
    "voice-capture-wrapper": { style: { display: "none" } },
    "voice-antispoof-mode": { value: "off" },
    "voice-vad-status": { textContent: "" },
    "voice-embedder": { value: "ecapa" },
    "voice-embedder-hint": { textContent: "", removeAttribute: function () {} },
    "voice-run": { disabled: true },
    "voice-progress-overlay": {
      classList: makeClassList(),
      style: {},
      parentNode: { removeChild: function () {} },
      offsetWidth: 0,
    },
    "voice-progress-bar": {
      style: {},
      classList: makeClassList(),
      setAttribute: function () {},
    },
    "voice-progress-title": { textContent: "", setAttribute: function () {} },
    "voice-progress-text": { textContent: "", setAttribute: function () {} },
    "voice-progress-pct": { textContent: "", setAttribute: function () {} },
  };
  if (overrides) Object.assign(store, overrides);
  return {
    getElementById: function (id) {
      return store[id] !== undefined ? store[id] : null;
    },
    querySelector: function (sel) {
      if (sel === "#dl-modal-title") return mt;
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    createElement: function (tag) {
      return {
        id: "",
        className: "",
        innerHTML: "",
        style: {},
        textContent: "",
        append: function () {},
        appendChild: function () {},
        setAttribute: function () {},
      };
    },
    body: { appendChild: function () {} },
  };
}

// The gated (phone-style) page: consent panel + blockable inputs are present.
function makeVoiceConsentDoc(overrides) {
  return makeVoiceDoc(
    Object.assign(
      {
        "voice-consent-panel": { style: {}, scrollIntoView: function () {} },
        "voice-consent-check": { checked: false },
        "voice-consent-accept": {},
        "voice-consent-status": { style: {} },
      },
      overrides,
    ),
  );
}

async function flush() {
  await new Promise(function (r) {
    setImmediate(r);
  });
  await new Promise(function (r) {
    setImmediate(r);
  });
}

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

// Reset every piece of module state voice_ui.js keeps at global scope.
function resetGlobals() {
  globalThis._voiceReport = null;
  globalThis.window._voiceReport = null;
  globalThis._voicePendingAudio = null;
  globalThis._voicePendingBytes = null;
  globalThis._voicePendingSource = null;
  globalThis._voiceProvenanceOutput = null;
  globalThis._voiceProvenanceManifest = null;
  globalThis._voiceKeypair = null;
  globalThis._voiceTemplateSecret = null;
  globalThis._voiceRegistry = null;
  globalThis._voiceEngine = null;
  globalThis._voiceEmbedder = "ecapa";
  globalThis._voiceInputTab = "upload";
  globalThis._voiceMicActive = false;
  globalThis._voiceMicBlocks = [];
  antiSpoofVerdict = "BONAFIDE";
  embedderThrows = false;
  micSupported = true;
  micBlocks = [];
  micStartThrows = null;
  mockDecoded = null;
  mockDecodeError = null;
  globalThis.document = null;
  downloads.length = 0;
  downloadHandler = null;
  modalClosed = 0;
  if (
    typeof globalThis.sessionStorage === "object" &&
    globalThis.sessionStorage &&
    typeof globalThis.sessionStorage.removeItem === "function"
  ) {
    globalThis.sessionStorage.removeItem("redoSan.voiceConsent");
  }
  globalThis.confirm = function () {
    return true;
  };
}

/**
 * Realistic happy-path staging: consent doc + accepted consent + a 3 s sine
 * wave file staged through the onchange handler.
 */
async function stageVoiceFile(overrides) {
  globalThis.document = makeVoiceConsentDoc(
    Object.assign(
      {
        "voice-consent-check": { checked: true },
        "voice-label": { value: "Speaker A" },
        "voice-audio": { files: [fakeFile()], disabled: false },
      },
      overrides,
    ),
  );
  await globalThis.handleVoiceConsentAccept();
  mockDecoded = {
    float32: sinePcm(3),
    sampleRate: 16000,
    durationMs: 3000,
  };
  await globalThis.handleVoiceFilePicked();
}

async function runHappyPath() {
  await clearVoiceRegistry();
  await stageVoiceFile();
  await globalThis.handleVoiceRun();
}

/**
 * The registry DB name is constant ("VoiceRegistryDB"), so fake-indexeddb
 * rows accumulate across tests in this process. Wipe them before tests that
 * enroll or inspect the registry.
 */
async function clearVoiceRegistry() {
  if (globalThis._voiceRegistry) {
    try {
      await globalThis._voiceRegistry.clear();
    } catch (e) {
      // ignore — fresh DB
    }
    return;
  }
  if (typeof globalThis.VoiceRegistry === "function") {
    const r = new globalThis.VoiceRegistry();
    try {
      await r.open();
      await r.clear();
    } catch (e) {
      // ignore
    }
  }
}

async function enroll(label) {
  const rep = await (async function () {
    await clearVoiceRegistry();
    await stageVoiceFile({
      "voice-label": { value: label || "Speaker A" },
    });
    await globalThis.handleVoiceRun();
    return globalThis.window._voiceReport;
  })();
  assert.equal(
    await globalThis._voiceRegistry.getAll().then((a) => a.length),
    1,
  );
  return rep;
}

// ── GPL guard ──

describe("voice_ui — GPL origin guard", () => {
  it("throws when loaded from a non-whitelisted origin", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "Voice_Biometric", "voice_ui.js"),
      "utf8",
    );
    assert.throws(
      () =>
        vm.runInNewContext(src, {
          window: {
            location: {
              protocol: "https:",
              href: "https://evil.example/steal.js",
            },
          },
        }),
      /GPL/,
    );
  });

  it("does not throw for the file protocol (test/embedded contexts)", () => {
    // Loaded at module scope of this file under the file: polyfill already.
    assert.equal(typeof globalThis.initVoiceBiometric, "function");
  });
});

// ── Small helpers ──

describe("voice_ui — setStatus / setVoiceStep", () => {
  afterEach(() => resetGlobals());

  it("sets textContent when the element exists", () => {
    const el = { textContent: "" };
    globalThis.document = makeVoiceDoc({ "voice-status": el });
    globalThis.setStatus("voice-status", "hello");
    assert.equal(el.textContent, "hello");
  });

  it("does nothing when the element is missing", () => {
    globalThis.document = makeVoiceDoc();
    globalThis.setStatus("nonexistent", "msg");
  });

  it("setVoiceStep shows and hides the steps box", () => {
    const el = { textContent: "", style: {} };
    globalThis.document = makeVoiceDoc({ "voice-steps": el });
    globalThis.setVoiceStep("1/8 Working…");
    assert.equal(el.textContent, "1/8 Working…");
    assert.equal(el.style.display, "block");
    globalThis.setVoiceStep(null);
    assert.equal(el.textContent, "");
    assert.equal(el.style.display, "none");
  });
});

describe("voice_ui — voiceRandomToken / voiceDescriptorHash", () => {
  afterEach(() => resetGlobals());

  it("voiceRandomToken produces the requested length", () => {
    assert.equal(globalThis.voiceRandomToken(16).length, 16);
    assert.equal(globalThis.voiceRandomToken(0).length, 0);
  });

  it("voiceDescriptorHash hashes a Float32Array via VoiceCrypto", async () => {
    const emb = new Float32Array(192).fill(0.25);
    const h = await globalThis.voiceDescriptorHash(emb);
    assert.equal(typeof h, "string");
    assert.ok(h.length >= 8);
  });

  it("voiceDescriptorHash returns null for empty input", async () => {
    assert.equal(await globalThis.voiceDescriptorHash(null), null);
    assert.equal(await globalThis.voiceDescriptorHash([]), null);
  });
});

// ── Input switching / file staging ──

describe("voice_ui — switchVoiceInput", () => {
  afterEach(() => resetGlobals());

  it("warns and returns when consent is missing", async () => {
    globalThis.document = makeVoiceDoc();
    await globalThis.handleVoiceConsentAccept(); // no panel → not gated, record saved nowhere
    const doc = makeVoiceConsentDoc(); // gated page, no record
    globalThis.document = doc;
    const status = doc.getElementById("voice-status");
    await globalThis.switchVoiceInput("microphone");
    assert.match(status.textContent, /consent/i);
  });

  it("switches wrappers once consent exists, resetting staged audio", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    globalThis._voicePendingAudio = { float32: new Float32Array(8) };
    globalThis.switchVoiceInput("microphone");
    assert.equal(
      doc.getElementById("voice-upload-wrapper").style.display,
      "none",
    );
    assert.equal(
      doc.getElementById("voice-capture-wrapper").style.display,
      "block",
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("is a no-op for the same mode and for unknown modes", () => {
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    globalThis.switchVoiceInput("upload"); // already upload
    assert.equal(
      doc.getElementById("voice-upload-wrapper").style.display,
      undefined,
    );
    globalThis.switchVoiceInput("bogus");
    assert.equal(globalThis._voiceInputTab, "upload");
  });
});

describe("voice_ui — handleVoiceFilePicked", () => {
  afterEach(() => resetGlobals());

  it("stages a valid wav file through the onchange handler", async () => {
    await stageVoiceFile();
    assert.ok(globalThis._voicePendingAudio);
    assert.equal(globalThis._voicePendingSource.source, "file");
    assert.equal(globalThis._voicePendingSource.fileName, "sample.wav");
    assert.equal(globalThis._voicePendingBytes.length, 8);
  });

  it("rejects unsupported file types", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-audio": {
        files: [
          fakeFile({ name: "evil.exe", type: "application/octet-stream" }),
        ],
        disabled: false,
      },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 };
    await globalThis.handleVoiceFilePicked();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Unsupported file type/,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("rejects clips shorter than 100 ms", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = {
      float32: sinePcm(0.01),
      sampleRate: 16000,
      durationMs: 10,
    };
    await globalThis.handleVoiceFilePicked();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /too short/i,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("surfaces decode errors", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecodeError = new Error("decode boom");
    await globalThis.handleVoiceFilePicked();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Failed to load audio: decode boom/,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("warns when consent has not been granted", async () => {
    globalThis.document = makeVoiceConsentDoc(); // no record
    await globalThis.handleVoiceFilePicked();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /consent/i,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });
});

// ── Microphone capture ──

describe("voice_ui — microphone capture", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  async function consentDocDoc() {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Mic Speaker" },
    });
    await globalThis.handleVoiceConsentAccept();
    return globalThis.document;
  }

  it("starts, stages a 3 s recording with speech and enables the run button", async () => {
    const doc = await consentDocDoc();
    micBlocks = [sinePcm(3)];
    await globalThis.handleVoiceRecordStart();
    assert.equal(globalThis._voiceMicActive, true);
    assert.equal(doc.getElementById("voice-record-start").disabled, true);
    assert.equal(doc.getElementById("voice-record-stop").disabled, false);
    await globalThis.handleVoiceRecordStop();
    assert.equal(globalThis._voiceMicActive, false);
    assert.ok(globalThis._voicePendingAudio);
    assert.equal(globalThis._voicePendingSource.source, "microphone");
    assert.equal(globalThis._voicePendingBytes, null); // mic bytes not provenance-embeddable
    assert.match(
      doc.getElementById("voice-status").textContent,
      /Recording staged/,
    );
    assert.equal(doc.getElementById("voice-run").disabled, false);
  });

  it("rejects recordings shorter than 1 second", async () => {
    const doc = await consentDocDoc();
    micBlocks = [silencePcm(0.5)];
    await globalThis.handleVoiceRecordStart();
    await globalThis.handleVoiceRecordStop();
    assert.match(doc.getElementById("voice-status").textContent, /too short/i);
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("rejects 3 s of silence (speech gate)", async () => {
    const doc = await consentDocDoc();
    micBlocks = [silencePcm(3)];
    await globalThis.handleVoiceRecordStart();
    await globalThis.handleVoiceRecordStop();
    assert.match(
      doc.getElementById("voice-status").textContent,
      /Not enough speech/i,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("aborts without staging", async () => {
    const doc = await consentDocDoc();
    micBlocks = [sinePcm(3)];
    await globalThis.handleVoiceRecordStart();
    await globalThis.handleVoiceRecordAbort();
    assert.equal(globalThis._voiceMicActive, false);
    assert.equal(globalThis._voicePendingAudio, null);
    assert.match(
      doc.getElementById("voice-status").textContent,
      /Recording aborted/,
    );
  });

  it("reports mic unavailability", async () => {
    const doc = await consentDocDoc();
    micSupported = false;
    await globalThis.handleVoiceRecordStart();
    assert.match(
      doc.getElementById("voice-status").textContent,
      /not supported/i,
    );
  });

  it("reports start errors via getMicrophoneErrorMessage", async () => {
    const doc = await consentDocDoc();
    micStartThrows = new Error("permission denied");
    await globalThis.handleVoiceRecordStart();
    assert.match(
      doc.getElementById("voice-status").textContent,
      /Mic error: permission denied/,
    );
  });
});

// ── Consent (GDPR) ──

describe("voice_ui — biometric consent", () => {
  const savedSS = globalThis.sessionStorage;

  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.confirm = function () {
      return true;
    };
  });

  afterEach(() => {
    globalThis.sessionStorage = savedSS;
    resetGlobals();
  });

  it("voiceConsentGranted is true when the panel is absent (embedded contexts)", () => {
    globalThis.document = makeVoiceDoc();
    assert.equal(globalThis.voiceConsentGranted(), true);
  });

  it("voiceConsentGranted is false with a visible panel and no record", () => {
    globalThis.document = makeVoiceConsentDoc();
    assert.equal(globalThis.voiceConsentGranted(), false);
  });

  it("voiceConsentGranted is true once a valid record exists", () => {
    globalThis.document = makeVoiceConsentDoc();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    assert.equal(globalThis.voiceConsentGranted(), true);
  });

  it("a record with the wrong policy version is treated as absent", () => {
    globalThis.document = makeVoiceConsentDoc();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 99,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    assert.equal(globalThis.voiceConsentGranted(), false);
  });

  it("handleVoiceConsentAccept requires the checkbox to be ticked", async () => {
    globalThis.document = makeVoiceConsentDoc();
    await globalThis.handleVoiceConsentAccept();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /checkbox/i,
    );
    assert.equal(globalThis.voiceConsentLoad(), null);
  });

  it("handleVoiceConsentAccept saves the record and unlocks the page", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    const doc = globalThis.document;
    await globalThis.handleVoiceConsentAccept();
    const rec = globalThis.voiceConsentLoad();
    assert.ok(rec);
    assert.equal(rec.version, 1);
    assert.equal(rec.policyVersion, 1);
    assert.equal(
      doc.getElementById("voice-consent-panel").style.display,
      "none",
    );
    assert.equal(doc.getElementById("voice-audio").disabled, false);
    assert.equal(doc.getElementById("voice-record-start").disabled, false);
    assert.match(
      doc.getElementById("voice-status").textContent,
      /Consent recorded/,
    );
  });

  it("initVoiceConsent locks collection points without a record", async () => {
    globalThis.document = makeVoiceConsentDoc();
    globalThis.initVoiceConsent();
    assert.equal(
      globalThis.document.getElementById("voice-audio").disabled,
      true,
    );
    assert.equal(
      globalThis.document.getElementById("voice-record-start").disabled,
      true,
    );
    assert.equal(
      globalThis.document.getElementById("voice-run").disabled,
      true,
    );
  });

  it("handleVoiceConsentWithdraw deletes the record and wipes the registry", async () => {
    await enroll("Speaker A");
    const panel = globalThis.document.getElementById("voice-consent-panel");
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 1);
    await globalThis.handleVoiceConsentWithdraw();
    assert.equal(globalThis.voiceConsentLoad(), null);
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 0);
    assert.equal(panel.style.display, "");
    assert.equal(
      globalThis.document.getElementById("voice-audio").disabled,
      true,
    );
  });

  it("handleVoiceConsentWithdraw does nothing when the confirmation is declined", async () => {
    await enroll("Speaker A");
    globalThis.confirm = function () {
      return false;
    };
    await globalThis.handleVoiceConsentWithdraw();
    assert.ok(globalThis.voiceConsentLoad());
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 1);
  });
});

// ── Pipeline: happy path ──

describe("voice_ui — runVoicePipeline (happy path)", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("produces a complete report and enrolls one speaker", async () => {
    const r = await enroll("Speaker A");
    assert.equal(r.type, "redoSan.voiceBiometricReport");
    assert.equal(r.version, 1);
    assert.equal(r.source, "file");
    assert.equal(r.audio.fileName, "sample.wav");
    assert.equal(r.audio.sampleRate, 16000);
    assert.equal(r.audio.durationMs, 3000);
    assert.equal(r.quality.gate, "PASS");
    assert.equal(r.antiSpoof.mode, "off");
    assert.equal(r.antiSpoof.gate, "NOT_RUN");
    assert.equal(r.antiSpoof.verdict, null);
    assert.equal(r.speaker.embeddingDim, 192);
    assert.equal(r.speaker.embeddingVersion, "ecapa");
    assert.equal(r.speaker.decision, "NO_MATCH"); // first enrolment
    assert.ok(r.template.codeSha256);
    assert.equal(r.template.bits, 128);
    assert.ok(r.template.pinFingerprint);
    assert.equal(r.registry.match, null);
    assert.ok(Number.isInteger(r.registry.registeredId));
    assert.equal(r.did.did, "did:key:zTest1234567890");
    assert.equal(r.did.algorithm, "Ed25519");
    assert.equal(r.did.signature, Buffer.from([1, 2, 3]).toString("base64"));
    assert.ok(r.did.document.id);
    assert.ok(r.did.verifiableCredential.credentialSubject.descriptorHash);
    assert.equal(r.standards.recordVersion.major, 1);
    assert.equal(r.provenance.status, "complete");
    assert.ok(r.limitations.length > 0);

    // Module + window state
    assert.equal(globalThis.window._voiceReport, r);
    assert.ok(globalThis._voiceKeypair);
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 1);

    // The list was re-rendered and the download handler wired
    const listEl = globalThis.document.getElementById("voice-list");
    assert.ok(listEl.innerHTML.length > 0);
    assert.match(
      globalThis.document.getElementById("voice-count").textContent,
      /Registered voices: 1/,
    );
    assert.equal(typeof downloadHandler, "function");
    assert.equal(downloadHandler, globalThis.downloadVoiceReport);
  });

  it("matches on the second enrolment and reports MATCH", async () => {
    await enroll("Speaker A");
    await stageVoiceFile(); // same descriptor + same secret → same code
    await globalThis.handleVoiceRun();
    const r = globalThis.window._voiceReport;
    assert.equal(r.speaker.decision, "MATCH");
    assert.equal(r.registry.match.label, "Speaker A");
    assert.equal(r.registry.match.similarity, 100);
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 2);
  });

  it("mic captures produce a report without provenance", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Mic Speaker" },
    });
    await globalThis.handleVoiceConsentAccept();
    micBlocks = [sinePcm(3)];
    await globalThis.handleVoiceRecordStart();
    await globalThis.handleVoiceRecordStop();
    await globalThis.handleVoiceRun();
    const r = globalThis.window._voiceReport;
    assert.equal(r.source, "microphone");
    assert.equal(r.audio.fileName, "microphone_capture");
    assert.equal(r.provenance, null); // mic bytes are not provenance-embeddable
    assert.equal(r.registry.registeredId !== null, true);
  });
});

// ── Pipeline: rejection gates ──

describe("voice_ui — runVoicePipeline (rejection gates)", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("handleVoiceRun warns without staged audio", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    await globalThis.handleVoiceConsentAccept();
    globalThis._voicePendingAudio = null;
    await globalThis.handleVoiceRun();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /No audio loaded/,
    );
    assert.equal(globalThis.window._voiceReport, null);
  });

  it("fails short clips at the quality gate without enrolling", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Speaker A" },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = {
      float32: silencePcm(3), // 3 s but zero energy
      sampleRate: 16000,
      durationMs: 3000,
    };
    await globalThis.handleVoiceFilePicked();
    await globalThis.handleVoiceRun();
    const r = globalThis.window._voiceReport;
    assert.ok(r);
    assert.equal(r.quality.gate, "FAIL");
    assert.ok(r.quality.reasons.indexOf("silence") !== -1);
    assert.equal(r.antiSpoof.gate, "NOT_RUN");
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 0);
    assert.equal(typeof downloadHandler, "function"); // rejected report is still downloadable
  });

  it("fails a sample at the anti-spoof gate and skips enrolment", async () => {
    await clearVoiceRegistry();
    antiSpoofVerdict = "SPOOF";
    await stageVoiceFile({ "voice-antispoof-mode": { value: "aasist" } });
    await globalThis.handleVoiceRun();
    const r = globalThis.window._voiceReport;
    assert.ok(r);
    assert.equal(r.antiSpoof.mode, "aasist");
    assert.equal(r.antiSpoof.gate, "FAIL");
    assert.equal(r.antiSpoof.verdict, "SPOOF");
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 0);
    assert.equal(r.registry.match, null);
    assert.equal(r.registry.registeredId, null);
    assert.equal(r.speaker, null);
  });

  it("surfaces embedder failures without a report", async () => {
    await clearVoiceRegistry();
    embedderThrows = true;
    await stageVoiceFile();
    await globalThis.handleVoiceRun();
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 0);
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Embedding stage error/,
    );
    assert.equal(globalThis.window._voiceReport, null);
  });
});

// ── Report downloads ──

describe("voice_ui — downloadVoiceReport formats", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => {
    delete globalThis.jspdf;
    delete globalThis.docx;
    resetGlobals();
  });

  it("json download contains the full report object", async () => {
    await runHappyPath();
    await downloadHandler("json");
    assert.equal(downloads[0].name, "sample.voice_report.json");
    const text = await downloads[0].blob.text();
    const report = JSON.parse(text);
    assert.equal(report.type, "redoSan.voiceBiometricReport");
    assert.equal(report.audio.fileName, "sample.wav");
  });

  it("csv download appends the label sheet", async () => {
    await runHappyPath();
    await downloadHandler("csv");
    assert.equal(downloads[0].name, "sample.voice_report.csv");
    const text = await downloads[0].blob.text();
    assert.match(text, /redoSan\.voiceBiometricReport/);
    assert.match(text, /Registered Voice Labels/);
    assert.match(text, /Speaker A/);
  });

  it("txt download contains the report text", async () => {
    await runHappyPath();
    await downloadHandler("txt");
    assert.equal(downloads[0].name, "sample.voice_report.txt");
    const text = await downloads[0].blob.text();
    assert.match(text, /Voice Biometric Report/);
    assert.match(text, /Speaker A/);
  });

  it("xml download is well-formed", async () => {
    await runHappyPath();
    await downloadHandler("xml");
    assert.equal(downloads[0].name, "sample.voice_report.xml");
    const text = await downloads[0].blob.text();
    assert.match(text, /^<\?xml version="1\.0"/);
    assert.match(text, /<voiceBiometricReport>/);
    assert.match(text, /sample\.wav/);
  });

  it("html download is a standalone document", async () => {
    await runHappyPath();
    await downloadHandler("html");
    assert.equal(downloads[0].name, "sample.voice_report.html");
    const text = await downloads[0].blob.text();
    assert.match(text, /^<!doctype html>/i);
    assert.match(text, /RedoSan Authenticity - Voice Biometric Report/);
  });

  it("pdf download uses the injectable jspdf global", async () => {
    globalThis.jspdf = {
      jsPDF: class {
        constructor() {
          this.calls = [];
        }
        setFontSize() {}
        setTextColor() {}
        text() {}
        addPage() {}
        output() {
          return new Blob(["fake-pdf"], { type: "application/pdf" });
        }
      },
    };
    await runHappyPath();
    await downloadHandler("pdf");
    assert.equal(downloads[0].name, "sample.voice_report.pdf");
    assert.equal(downloads[0].blob.type, "application/pdf");
  });

  it("docx download uses the injectable docx global", async () => {
    globalThis.docx = {
      Paragraph: class {},
      TextRun: class {},
      Table: class {},
      TableRow: class {},
      TableCell: class {},
      WidthType: { PERCENTAGE: "pct" },
      Document: class {},
      Packer: {
        toBlob: async function () {
          return new Blob(["fake-docx"], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
        },
      },
    };
    await runHappyPath();
    await downloadHandler("doc");
    assert.equal(downloads[0].name, "sample.voice_report.docx");
    assert.equal(
      downloads[0].blob.type,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("closes the modal before downloading", async () => {
    await runHappyPath();
    modalClosed = 0;
    await downloadHandler("json");
    assert.equal(modalClosed, 1);
  });
});

// ── Registry list / lifecycle ──

describe("voice_ui — registry list and lifecycle", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("listVoiceRegistered renders an empty state", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc();
    await globalThis.initVoiceBiometric();
    const listEl = globalThis.document.getElementById("voice-list");
    assert.match(listEl.innerHTML, /No voices registered yet/);
    assert.match(
      globalThis.document.getElementById("voice-count").textContent,
      /Registered voices: 0/,
    );
  });

  it("handleVoiceDelete removes a specific voice", async () => {
    const r = await enroll("Speaker A");
    const id = r.registry.registeredId;
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 1);
    await globalThis.handleVoiceDelete(id);
    assert.equal((await globalThis._voiceRegistry.getAll()).length, 0);
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Voice deleted from registry/,
    );
  });

  it("handleVoiceRefreshList clears results and re-renders", async () => {
    await clearVoiceRegistry();
    await runHappyPath();
    assert.equal(
      globalThis.document.getElementById("voice-report").style.display,
      "block",
    );
    await globalThis.handleVoiceRefreshList();
    const size = await globalThis.listVoiceRegistered();
    const dbgStatus =
      globalThis.document.getElementById("voice-status").textContent;
    assert.equal(size, 1, "refresh size; status was: " + dbgStatus);
    assert.equal(globalThis.window._voiceReport, null);
    assert.equal(
      globalThis.document.getElementById("voice-report").style.display,
      "none",
    );
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Results cleared\. Registered voices: 1/,
    );
  });
});

// ── Initialization ──

describe("voice_ui — initVoiceBiometric", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("initializes engine + registry once and is re-entrant", async () => {
    globalThis.document = makeVoiceConsentDoc();
    await globalThis.initVoiceBiometric();
    const engine = globalThis._voiceEngine;
    const registry = globalThis._voiceRegistry;
    assert.ok(engine);
    assert.ok(registry);
    assert.ok(globalThis._voiceTemplateSecret);
    await globalThis.initVoiceBiometric();
    assert.equal(globalThis._voiceEngine, engine);
    assert.equal(globalThis._voiceRegistry, registry);
  });

  it("locks collection points when no consent record exists", async () => {
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    await globalThis.initVoiceBiometric();
    assert.equal(doc.getElementById("voice-audio").disabled, true);
    assert.equal(doc.getElementById("voice-record-start").disabled, true);
    assert.equal(doc.getElementById("voice-run").disabled, true);
  });

  it("keeps collection points open when consent is already on record", async () => {
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    await globalThis.initVoiceBiometric();
    assert.equal(
      doc.getElementById("voice-consent-panel").style.display,
      "none",
    );
    assert.equal(doc.getElementById("voice-audio").disabled, false);
    assert.equal(doc.getElementById("voice-record-start").disabled, false);
  });

  it("updates the embedder hint and VAD status lines", async () => {
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    await globalThis.initVoiceBiometric();
    assert.match(
      doc.getElementById("voice-embedder-hint").textContent,
      /ECAPA-TDNN \(192-dim\) downloads an ~83 MB ONNX model/,
    );
    // VoiceVAD is not loaded in the unit harness → RMS fallback gating
    assert.match(
      doc.getElementById("voice-vad-status").textContent,
      /VAD not loaded/,
    );
  });

  it("handleVoiceEmbedderChange stores the selection and refreshes the hint", () => {
    const doc = makeVoiceConsentDoc({ "voice-embedder": { value: "onnx" } });
    globalThis.document = doc;
    globalThis.handleVoiceEmbedderChange();
    assert.equal(globalThis._voiceEmbedder, "onnx");
    assert.match(
      doc.getElementById("voice-embedder-hint").textContent,
      /ONNX embedder loads a model on first use/,
    );
  });
});

// ── Run state gating ──

describe("voice_ui — updateVoiceRunState", () => {
  afterEach(() => resetGlobals());

  it("disables the run button without consent", () => {
    globalThis.sessionStorage = makeLocalStorage();
    const doc = makeVoiceConsentDoc({
      "voice-label": { value: "Speaker A" },
    });
    globalThis.document = doc;
    globalThis._voicePendingAudio = { float32: new Float32Array(8) };
    globalThis.updateVoiceRunState();
    assert.equal(doc.getElementById("voice-run").disabled, true);
  });

  it("enables the run button with consent, staged audio and a label", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const doc = makeVoiceConsentDoc({
      "voice-label": { value: "  Speaker A  " },
    });
    globalThis.document = doc;
    globalThis._voicePendingAudio = { float32: new Float32Array(8) };
    globalThis.updateVoiceRunState();
    assert.equal(doc.getElementById("voice-label").value, "Speaker A");
    assert.equal(doc.getElementById("voice-run").disabled, false);
  });

  it("stays disabled while the microphone is active", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const doc = makeVoiceConsentDoc({
      "voice-label": { value: "Speaker A" },
    });
    globalThis.document = doc;
    globalThis._voicePendingAudio = { float32: new Float32Array(8) };
    globalThis._voiceMicActive = true;
    globalThis.updateVoiceRunState();
    assert.equal(doc.getElementById("voice-run").disabled, true);
  });
});

// ── Anti-spoof mode select ──

describe("voice_ui — getAntiSpoofMode", () => {
  afterEach(() => resetGlobals());

  it("defaults to off", () => {
    globalThis.document = makeVoiceDoc();
    assert.equal(globalThis.getAntiSpoofMode(), "off");
  });

  it("returns the selected non-off value", () => {
    globalThis.document = makeVoiceDoc({
      "voice-antispoof-mode": { value: "aasist" },
    });
    assert.equal(globalThis.getAntiSpoofMode(), "aasist");
  });
});

// ── voiceBytesToHex ──

describe("voice_ui — voiceBytesToHex", () => {
  afterEach(() => resetGlobals());

  it("returns empty string for null/undefined input", () => {
    assert.equal(globalThis.voiceBytesToHex(null), "");
    assert.equal(globalThis.voiceBytesToHex(undefined), "");
  });

  it("converts a Uint8Array to hex string", () => {
    const bytes = new Uint8Array([0x00, 0x0a, 0xff, 0x10]);
    assert.equal(globalThis.voiceBytesToHex(bytes), "000aff10");
  });

  it("pads single-digit hex values with leading zero", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    assert.equal(globalThis.voiceBytesToHex(bytes), "0102030405");
  });

  it("returns empty string for an empty Uint8Array", () => {
    assert.equal(globalThis.voiceBytesToHex(new Uint8Array(0)), "");
  });
});

// ── voiceDescriptorBytes ──

describe("voice_ui — voiceDescriptorBytes", () => {
  afterEach(() => resetGlobals());

  it("converts a Float32Array to quantized Uint8Array", async () => {
    const emb = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const result = await globalThis.voiceDescriptorBytes(emb);
    assert.ok(result instanceof Uint8Array);
    // out buffer is emb.length * 4 bytes, but only emb.length are filled
    assert.equal(result.length, emb.length * 4);
    // 0 → round((0+1)*127.5) = 128
    assert.equal(result[0], 128);
    // 0.5 → round(1.5*127.5) = 191
    assert.equal(result[1], 191);
    // -0.5 → round(0.5*127.5) = 64
    assert.equal(result[2], 64);
    // 1.0 → round(2*127.5) = 255
    assert.equal(result[3], 255);
    // -1.0 → round(0*127.5) = 0
    assert.equal(result[4], 0);
  });

  it("handles a single-element embedding", async () => {
    const emb = new Float32Array([0.25]);
    const result = await globalThis.voiceDescriptorBytes(emb);
    assert.equal(result.length, 4); // emb.length * 4
    assert.equal(typeof result[0], "number");
  });
});

// ── voiceProgressEnsure / voiceProgressShow / voiceProgressUpdate / voiceProgressHide ──

describe("voice_ui — progress overlay lifecycle", () => {
  afterEach(() => resetGlobals());

  it("voiceProgressEnsure creates the overlay DOM when none exists", () => {
    // No pre-existing overlay elements → creates them
    globalThis.document = makeVoiceDoc(); // no progress elements in default store
    const overlay = globalThis.voiceProgressEnsure();
    // Returns the created overlay element (not from getElementById store)
    assert.ok(overlay);
  });

  it("voiceProgressEnsure returns existing overlay when already present", () => {
    globalThis.document = makeVoiceDoc();
    // First call creates it
    const first = globalThis.voiceProgressEnsure();
    assert.ok(first);
    // Second call should find it via voiceProgressRefs
    const second = globalThis.voiceProgressEnsure();
    assert.equal(second, first);
  });

  it("voiceProgressEnsure returns null when document has no getElementById", () => {
    globalThis.document = {
      createElement: function () {
        return {
          id: "",
          className: "",
          style: {},
          appendChild: function () {},
        };
      },
      body: { appendChild: function () {} },
    };
    const result = globalThis.voiceProgressEnsure();
    assert.equal(result, null);
  });

  it("voiceProgressShow calls voiceProgressEnsure when refs are null", () => {
    globalThis.document = makeVoiceDoc();
    // Show when no progress overlay exists → should call ensure and create it
    globalThis.voiceProgressShow("Test Title", "Test Text");
    // Should not throw
  });

  it("voiceProgressUpdate is a no-op when overlay is not visible", () => {
    globalThis.document = makeVoiceDoc();
    // Call update when the overlay has no is-visible class → should return early
    globalThis.voiceProgressUpdate(0.5, "halfway");
    // Should not throw
  });

  it("voiceProgressUpdate updates bar width and pct when visible", () => {
    const bar = {
      style: {},
      classList: makeClassList(),
      setAttribute: function () {},
    };
    const pctEl = { textContent: "", setAttribute: function () {} };
    const overlay = {
      classList: makeClassList(),
      offsetWidth: 100,
      style: {},
      parentNode: { removeChild: function () {} },
    };
    overlay.classList.add("is-visible");
    globalThis.document = makeVoiceDoc({
      "voice-progress-overlay": overlay,
      "voice-progress-bar": bar,
      "voice-progress-pct": pctEl,
      "voice-progress-text": { textContent: "" },
      "voice-progress-title": { textContent: "" },
    });
    globalThis.voiceProgressUpdate(0.75, "three quarters");
    assert.equal(bar.style.width, "75%");
    assert.equal(pctEl.textContent, "75%");
  });

  it("voiceProgressHide removes the is-visible class", () => {
    const overlay = {
      classList: makeClassList(),
      style: {},
      parentNode: { removeChild: function () {} },
      offsetWidth: 100,
    };
    overlay.classList.add("is-visible");
    globalThis.document = makeVoiceDoc({
      "voice-progress-overlay": overlay,
      "voice-progress-bar": {
        style: {},
        classList: makeClassList(),
        setAttribute: function () {},
      },
      "voice-progress-pct": { textContent: "", setAttribute: function () {} },
      "voice-progress-text": { textContent: "", setAttribute: function () {} },
      "voice-progress-title": { textContent: "", setAttribute: function () {} },
    });
    globalThis.voiceProgressHide();
    assert.equal(overlay.classList.contains("is-visible"), false);
  });

  it("voiceProgressHide is safe when no overlay exists", () => {
    globalThis.document = makeVoiceDoc();
    // No progress elements → should not throw
    globalThis.voiceProgressHide();
  });

  it("voiceProgressRefs returns null when document.getElementById is missing", () => {
    globalThis.document = {
      querySelector: function () {
        return null;
      },
    };
    const refs = globalThis.voiceProgressRefs();
    assert.equal(refs, null);
  });

  it("voiceProgressRefs returns null when overlay element is missing", () => {
    globalThis.document = makeVoiceDoc();
    // No voice-progress-overlay in the store → getElementById returns null
    // But makeVoiceDoc has it. Override to return null for overlay only
    globalThis.document = {
      getElementById: function (id) {
        if (id === "voice-progress-overlay") return null;
        return null;
      },
    };
    const refs = globalThis.voiceProgressRefs();
    assert.equal(refs, null);
  });
});

// ── voiceRandomToken fallback (no crypto) ──

describe("voice_ui — voiceRandomToken fallback", () => {
  afterEach(() => resetGlobals());

  it("falls back to Math.random when crypto.getRandomValues is unavailable", () => {
    const savedCrypto = globalThis.crypto;
    globalThis.crypto = {};
    const token = globalThis.voiceRandomToken(8);
    assert.equal(token.length, 8);
    globalThis.crypto = savedCrypto;
  });
});

// ── isAllowedVoiceFile edge cases ──

describe("voice_ui — isAllowedVoiceFile edge cases", () => {
  afterEach(() => resetGlobals());

  it("returns false for null input", () => {
    assert.equal(globalThis.isAllowedVoiceFile(null), false);
  });

  it("returns false for undefined input", () => {
    assert.equal(globalThis.isAllowedVoiceFile(undefined), false);
  });

  it("returns true when MIME type is in allowed list", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/wav", name: "file" }),
      true,
    );
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/mpeg", name: "file" }),
      true,
    );
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/flac", name: "file" }),
      true,
    );
  });

  it("returns false for unknown MIME types with no extension", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/unknown", name: "file" }),
      false,
    );
  });

  it("returns true when extension is valid even without MIME type", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "track.mp3" }),
      true,
    );
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "recording.webm" }),
      true,
    );
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "clip.opus" }),
      true,
    );
  });

  it("returns false when filename has no extension", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "noext" }),
      false,
    );
  });

  it("returns false when file has no name or type", () => {
    assert.equal(globalThis.isAllowedVoiceFile({}), false);
  });

  it("returns true for x-wav MIME type", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/x-wav", name: "" }),
      true,
    );
  });

  it("returns true for wave MIME type", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "audio/wave", name: "" }),
      true,
    );
  });
});

// ── voiceWarnConsentRequired with highlight=false ──

describe("voice_ui — voiceWarnConsentRequired edge cases", () => {
  afterEach(() => resetGlobals());

  it("skips scroll/highlight when highlight is false", () => {
    let scrollCalled = false;
    globalThis.document = makeVoiceDoc({
      "voice-consent-panel": {
        style: {},
        scrollIntoView: function () {
          scrollCalled = true;
        },
      },
    });
    globalThis.voiceWarnConsentRequired(false);
    assert.equal(scrollCalled, false);
  });

  it("scrolls/highlights by default", () => {
    let scrollCalled = false;
    globalThis.document = makeVoiceDoc({
      "voice-consent-panel": {
        style: {},
        scrollIntoView: function (opts) {
          scrollCalled = true;
        },
      },
    });
    globalThis.voiceWarnConsentRequired();
    assert.equal(scrollCalled, true);
  });

  it("does nothing when consent panel is absent", () => {
    globalThis.document = makeVoiceDoc();
    // No consent panel → should not throw
    globalThis.voiceWarnConsentRequired();
  });
});

// ── voiceEmbedderFor / buildVoiceEngine edge cases ──

describe("voice_ui — voiceEmbedderFor", () => {
  afterEach(() => resetGlobals());

  it("returns VoiceONNXEmbedder for ecpa mode", () => {
    const e = globalThis.voiceEmbedderFor("ecapa");
    assert.equal(e, globalThis.VoiceONNXEmbedder);
  });

  it("returns null for wavlm mode when VoiceWavlmEmbedder is not defined", () => {
    const e = globalThis.voiceEmbedderFor("wavlm");
    assert.equal(e, null);
  });

  it("returns VoiceONNXEmbedder for any unknown mode", () => {
    const e = globalThis.voiceEmbedderFor("unknown");
    assert.equal(e, globalThis.VoiceONNXEmbedder);
  });

  it("returns null when VoiceONNXEmbedder is not defined", () => {
    const saved = globalThis.VoiceONNXEmbedder;
    delete globalThis.VoiceONNXEmbedder;
    const e = globalThis.voiceEmbedderFor("ecapa");
    assert.equal(e, null);
    globalThis.VoiceONNXEmbedder = saved;
  });
});

// ── buildVoiceEngine edge cases ──

describe("voice_ui — buildVoiceEngine", () => {
  afterEach(() => resetGlobals());

  it("returns null when VoiceEngine is not a function", () => {
    const saved = globalThis.VoiceEngine;
    globalThis.VoiceEngine = "not-a-function";
    const eng = globalThis.buildVoiceEngine();
    assert.equal(eng, null);
    globalThis.VoiceEngine = saved;
  });
});

// ── voiceBaseReport edge cases ──

describe("voice_ui — voiceBaseReport", () => {
  afterEach(() => resetGlobals());

  it("returns defaults when called with no args", () => {
    const r = globalThis.voiceBaseReport();
    assert.equal(r.type, "redoSan.voiceBiometricReport");
    assert.equal(r.version, 1);
    assert.equal(r.source, "file");
    assert.equal(r.audio, null);
    assert.equal(r.quality, null);
    assert.equal(r.speaker, null);
    assert.equal(r.template, null);
  });

  it("returns defaults when called with empty object", () => {
    const r = globalThis.voiceBaseReport({});
    assert.equal(r.type, "redoSan.voiceBiometricReport");
    assert.equal(r.source, "file");
    assert.equal(r.registry.match, null);
    assert.equal(r.registry.registeredId, null);
  });

  it("uses provided opts fields", () => {
    const r = globalThis.voiceBaseReport({
      source: "microphone",
      audio: { fileName: "test.wav" },
    });
    assert.equal(r.source, "microphone");
    assert.equal(r.audio.fileName, "test.wav");
  });
});

// ── voiceLimitations edge cases ──

describe("voice_ui — voiceLimitations", () => {
  afterEach(() => resetGlobals());

  it("includes pad-off limitation when PAD gate is NOT_RUN", () => {
    const lines = globalThis.voiceLimitations(
      { gate: "PASS", speechRatio: 1, reasons: [] },
      { gate: "NOT_RUN" },
      null,
    );
    assert.ok(lines.length >= 2);
    const padOff = lines.find(function (l) {
      return l && l.indexOf("disabled") !== -1;
    });
    assert.ok(padOff, "Expected a PAD disabled limitation");
  });

  it("includes first enrolment limitation when no match", () => {
    const lines = globalThis.voiceLimitations(
      { gate: "PASS", speechRatio: 1, reasons: [] },
      { gate: "PASS", mode: "aasist" },
      null,
    );
    const firstEnrol = lines.find(function (l) {
      return l && l.indexOf("First enrolment") !== -1;
    });
    assert.ok(firstEnrol, "Expected first enrolment limitation");
  });

  it("includes low-magnitude warning when embedMagnitude is below floor", () => {
    const lines = globalThis.voiceLimitations(
      { gate: "PASS", speechRatio: 1, reasons: [] },
      { gate: "PASS", mode: "aasist" },
      null,
      0.3,
      "ecapa-tdnn",
    );
    const lowMag = lines.find(function (l) {
      return l && l.indexOf("low signal magnitude") !== -1;
    });
    assert.ok(lowMag, "Expected low magnitude limitation");
  });

  it("does not include low-magnitude warning when embedMagnitude is above floor", () => {
    const lines = globalThis.voiceLimitations(
      { gate: "PASS", speechRatio: 1, reasons: [] },
      { gate: "PASS", mode: "aasist" },
      null,
      5.0,
      "ecapa-tdnn",
    );
    const lowMag = lines.find(function (l) {
      return l && l.indexOf("low signal magnitude") !== -1;
    });
    assert.equal(lowMag, undefined);
  });

  it("does not include low-magnitude warning when modelVersion has no floor", () => {
    const lines = globalThis.voiceLimitations(
      { gate: "PASS", speechRatio: 1, reasons: [] },
      { gate: "PASS", mode: "aasist" },
      null,
      0.01,
      "unknown-model",
    );
    const lowMag = lines.find(function (l) {
      return l && l.indexOf("low signal magnitude") !== -1;
    });
    assert.equal(lowMag, undefined);
  });
});

// ── voiceProvenanceEmbed edge cases ──

describe("voice_ui — voiceProvenanceEmbed", () => {
  afterEach(() => resetGlobals());

  it("returns absent status when VoiceProvenance is undefined", async () => {
    const saved = globalThis.VoiceProvenance;
    delete globalThis.VoiceProvenance;
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2]),
      { did: "did:test" },
    );
    assert.equal(result.status, "absent");
    assert.ok(result.absentReason);
    globalThis.VoiceProvenance = saved;
  });

  it("returns partial status when embedAudio throws", async () => {
    const saved = globalThis.VoiceProvenance;
    globalThis.VoiceProvenance = {
      embedAudio: async function () {
        throw new Error("embed failed");
      },
    };
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2]),
      { did: "did:test" },
    );
    assert.equal(result.status, "partial");
    assert.equal(result.error, "embed failed");
    globalThis.VoiceProvenance = saved;
  });

  it("returns partial status when embedAudio returns null/empty", async () => {
    const saved = globalThis.VoiceProvenance;
    globalThis.VoiceProvenance = {
      embedAudio: async function () {
        return null;
      },
    };
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2]),
      { did: "did:test" },
    );
    assert.equal(result.status, "partial");
    assert.equal(result.error, "no-output");
    globalThis.VoiceProvenance = saved;
  });

  it("returns partial status when embedAudio returns object without output", async () => {
    const saved = globalThis.VoiceProvenance;
    globalThis.VoiceProvenance = {
      embedAudio: async function () {
        return { manifest: {} };
      },
    };
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2]),
      { did: "did:test" },
    );
    assert.equal(result.status, "partial");
    assert.equal(result.error, "no-output");
    globalThis.VoiceProvenance = saved;
  });

  it("returns complete status with manifest fields", async () => {
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2, 3, 4]),
      { did: "did:key:zTest" },
    );
    assert.equal(result.status, "complete");
    assert.ok(result.manifestLabel);
    assert.ok(result.format);
    assert.ok(result.signerDid);
    assert.ok(typeof result.storeLength === "number");
  });

  it("returns null exclusions when manifest has no exclusionStart", async () => {
    const saved = globalThis.VoiceProvenance;
    globalThis.VoiceProvenance = {
      embedAudio: async function () {
        return {
          output: new Uint8Array(10),
          manifest: {
            format: "wav",
            manifestLabel: "test.label",
            signerDid: "did:test",
            storeLength: 5,
          },
        };
      },
    };
    const result = await globalThis.voiceProvenanceEmbed(
      new Uint8Array([1, 2]),
      { did: "did:test" },
    );
    assert.equal(result.status, "complete");
    assert.equal(result.exclusions, null);
    globalThis.VoiceProvenance = saved;
  });
});

// ── voiceConsentLoad / voiceConsentSave / voiceConsentClear error paths ──

describe("voice_ui — consent error paths", () => {
  afterEach(() => resetGlobals());

  it("voiceConsentLoad returns null when sessionStorage throws", () => {
    globalThis.sessionStorage = {
      getItem: function () {
        throw new Error("quota exceeded");
      },
    };
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentSave does not throw when sessionStorage throws", () => {
    globalThis.sessionStorage = {
      setItem: function () {
        throw new Error("quota exceeded");
      },
    };
    // Should not throw
    globalThis.voiceConsentSave({ version: 1, policyVersion: 1 });
  });

  it("voiceConsentClear does not throw when sessionStorage throws", () => {
    const throwingSS = {
      removeItem: function () {
        throw new Error("error");
      },
      getItem: function () {
        return null;
      },
      setItem: function () {},
      clear: function () {},
    };
    const savedSS = globalThis.sessionStorage;
    globalThis.sessionStorage = throwingSS;
    try {
      // Should not throw
      globalThis.voiceConsentClear();
    } finally {
      globalThis.sessionStorage = savedSS;
    }
  });

  it("voiceConsentLoad returns null when JSON.parse fails", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.sessionStorage.setItem("redoSan.voiceConsent", "not-valid-json");
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentLoad returns null when version does not match", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.sessionStorage.setItem(
      "redoSan.voiceConsent",
      JSON.stringify({ version: 99, policyVersion: 1, accepted: true }),
    );
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentLoad returns null when policyVersion does not match", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.sessionStorage.setItem(
      "redoSan.voiceConsent",
      JSON.stringify({ version: 1, policyVersion: 99, accepted: true }),
    );
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentLoad returns null when rec is falsy", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.sessionStorage.setItem("redoSan.voiceConsent", "null");
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentLoad returns null when sessionStorage is undefined", () => {
    globalThis.sessionStorage = undefined;
    const rec = globalThis.voiceConsentLoad();
    assert.equal(rec, null);
  });

  it("voiceConsentSave does nothing when sessionStorage is undefined", () => {
    globalThis.sessionStorage = undefined;
    // Should not throw
    globalThis.voiceConsentSave({ version: 1 });
  });

  it("voiceConsentClear does nothing when sessionStorage is undefined", () => {
    globalThis.sessionStorage = undefined;
    // Should not throw
    globalThis.voiceConsentClear();
  });
});

// ── handleVoiceFilePicked file too large ──

describe("voice_ui — handleVoiceFilePicked large file", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("rejects files larger than 25 MB", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-audio": {
        files: [fakeFile({ size: 26 * 1024 * 1024 })],
        disabled: false,
      },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 };
    await globalThis.handleVoiceFilePicked();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /too large|too large/i,
    );
    assert.equal(globalThis._voicePendingAudio, null);
  });
});

// ── switchVoiceInput with mic active ──

describe("voice_ui — switchVoiceInput mic active", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("stops mic and clears blocks when switching to microphone while already active", async () => {
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    globalThis._voiceInputTab = "upload";
    globalThis._voiceMicActive = true;
    globalThis._voiceMicBlocks = [new Float32Array(100)];
    // Code at line 781: `if (mode === "microphone" && _voiceMicActive)` stops the mic
    globalThis.switchVoiceInput("microphone");
    assert.equal(globalThis._voiceMicActive, false);
    assert.equal(globalThis._voiceMicBlocks.length, 0);
    assert.equal(
      doc.getElementById("voice-upload-wrapper").style.display,
      "none",
    );
    assert.equal(
      doc.getElementById("voice-capture-wrapper").style.display,
      "block",
    );
  });
});

// ── handleVoiceRecordStart / Stop / Abort edge cases ──

describe("voice_ui — mic edge cases", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("handleVoiceRecordStart warns when consent not granted on gated page", async () => {
    globalThis.document = makeVoiceConsentDoc(); // no consent record
    await globalThis.handleVoiceRecordStart();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /consent/i,
    );
  });

  it("handleVoiceRecordStop is a no-op when mic is not active", async () => {
    globalThis.document = makeVoiceDoc();
    globalThis._voiceMicActive = false;
    await globalThis.handleVoiceRecordStop();
    // Should not throw, _voicePendingAudio should remain null
    assert.equal(globalThis._voicePendingAudio, null);
  });

  it("handleVoiceRecordAbort is a no-op when mic is not active", async () => {
    globalThis.document = makeVoiceDoc();
    globalThis._voiceMicActive = false;
    await globalThis.handleVoiceRecordAbort();
    assert.equal(globalThis._voiceMicActive, false);
  });

  it("handleVoiceRecordAbort clears staged audio and mic when active", async () => {
    const doc = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    globalThis.document = doc;
    await globalThis.handleVoiceConsentAccept();
    // Simulate mic active with staged audio
    globalThis._voiceMicActive = true;
    globalThis._voicePendingAudio = new Float32Array([1, 2, 3]);
    globalThis._voicePendingBytes = new Uint8Array([1, 2, 3]);
    globalThis._voicePendingSource = { filename: "test.wav" };
    globalThis._voiceMicBlocks = [new Float32Array([1])];
    globalThis.VoiceMicrophone.stop = function () {};
    await globalThis.handleVoiceRecordAbort();
    assert.equal(globalThis._voiceMicActive, false);
    assert.equal(globalThis._voicePendingAudio, null);
    assert.equal(globalThis._voicePendingBytes, null);
    assert.deepEqual(globalThis._voicePendingSource, {});
    assert.deepEqual(globalThis._voiceMicBlocks, []);
    // Discard button should be disabled after abort (no pending audio)
    const abortBtn = doc.getElementById("voice-record-abort");
    assert.equal(abortBtn.disabled, true);
  });

  it("resetMicButtons enables Discard when staged audio exists after stop", async () => {
    const doc = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
    });
    globalThis.document = doc;
    await globalThis.handleVoiceConsentAccept();
    // Simulate mic active with 3 s of audio (enough to pass quality gate)
    globalThis._voiceMicActive = true;
    globalThis._voiceMicBlocks = [sinePcm(3)];
    globalThis.VoiceMicrophone.stop = function () {};
    await globalThis.handleVoiceRecordStop();
    // Discard should be enabled because _voicePendingAudio is truthy
    const abortBtn = doc.getElementById("voice-record-abort");
    assert.equal(abortBtn.disabled, false);
    // Start should be re-enabled
    const startBtn = doc.getElementById("voice-record-start");
    assert.equal(startBtn.disabled, false);
    // Stop should be disabled
    const stopBtn = doc.getElementById("voice-record-stop");
    assert.equal(stopBtn.disabled, true);
  });

  it("handleVoiceRecordStart reports when mic.start returns no sampleRate", async () => {
    const doc = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Mic Speaker" },
    });
    globalThis.document = doc;
    await globalThis.handleVoiceConsentAccept();
    // Override mic to return no sampleRate
    const savedStart = globalThis.VoiceMicrophone.start;
    globalThis.VoiceMicrophone.start = async function () {
      return null;
    };
    await globalThis.handleVoiceRecordStart();
    assert.match(
      doc.getElementById("voice-status").textContent,
      /could not be started/i,
    );
    globalThis.VoiceMicrophone.start = savedStart;
  });

  it("handleVoiceRecordStop accepts manual stop with VAD error and >=1s audio", async () => {
    const doc = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Mic Speaker" },
    });
    globalThis.document = doc;
    await globalThis.handleVoiceConsentAccept();
    // Set up mic state directly
    globalThis._voiceMicActive = true;
    // Provide 3 seconds of sine audio via micBlocks (speech, not silence)
    globalThis._voiceMicBlocks = [sinePcm(3)];
    // Make VoiceVAD.isReady return true but process throws → speechSecs becomes null
    // Then the fallback path accepts the manual stop (>=1s)
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        throw new Error("VAD crash");
      },
    };
    await globalThis.handleVoiceRecordStop();
    // With VAD error and >=1s, speechSecs falls back to secs → stages
    assert.ok(globalThis._voicePendingAudio);
  });

  it("handleVoiceRecordStart reports when VoiceMicrophone.supported returns false", async () => {
    const doc = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Mic" },
    });
    globalThis.document = doc;
    await globalThis.handleVoiceConsentAccept();
    const savedSupported = globalThis.VoiceMicrophone.supported;
    globalThis.VoiceMicrophone.supported = function () {
      return false;
    };
    await globalThis.handleVoiceRecordStart();
    assert.match(
      doc.getElementById("voice-status").textContent,
      /not supported/i,
    );
    globalThis.VoiceMicrophone.supported = savedSupported;
  });
});

// ── handleVoiceRun guard paths ──

describe("voice_ui — handleVoiceRun guards", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("warns when consent is not granted on gated page", async () => {
    globalThis.document = makeVoiceConsentDoc(); // no consent record
    await globalThis.handleVoiceRun();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /consent/i,
    );
  });
});

// ── updateVoiceVadStatus with VoiceVAD defined ──

describe("voice_ui — updateVoiceVadStatus", () => {
  afterEach(() => resetGlobals());

  it("shows ready status when VoiceVAD.isReady returns true", () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
    };
    globalThis.document = makeVoiceDoc({
      "voice-vad-status": { textContent: "" },
    });
    globalThis.updateVoiceVadStatus();
    assert.match(
      globalThis.document.getElementById("voice-vad-status").textContent,
      /VAD ready/i,
    );
  });

  it("shows unavailable when VoiceVAD is not defined", () => {
    delete globalThis.VoiceVAD;
    globalThis.document = makeVoiceDoc({
      "voice-vad-status": { textContent: "" },
    });
    globalThis.updateVoiceVadStatus();
    assert.match(
      globalThis.document.getElementById("voice-vad-status").textContent,
      /VAD not loaded/i,
    );
  });

  it("is a no-op when element is missing", () => {
    globalThis.document = makeVoiceDoc();
    // No voice-vad-status in store → getElementById returns null
    globalThis.document = {
      getElementById: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.updateVoiceVadStatus();
  });
});

// ── updateVoiceEmbedderHint edge cases ──

describe("voice_ui — updateVoiceEmbedderHint", () => {
  afterEach(() => resetGlobals());

  it("shows wavlm hint when _voiceEmbedder is wavlm", () => {
    globalThis._voiceEmbedder = "wavlm";
    globalThis.document = makeVoiceDoc({
      "voice-embedder-hint": {
        textContent: "",
        removeAttribute: function () {},
      },
    });
    globalThis.updateVoiceEmbedderHint();
    assert.match(
      globalThis.document.getElementById("voice-embedder-hint").textContent,
      /WavLM/i,
    );
  });

  it("is a no-op when hint element is missing", () => {
    globalThis._voiceEmbedder = "ecapa";
    globalThis.document = {
      getElementById: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.updateVoiceEmbedderHint();
  });
});

// ── handleVoiceEmbedderChange edge cases ──

describe("voice_ui — handleVoiceEmbedderChange", () => {
  afterEach(() => resetGlobals());

  it("is a no-op when select element is missing", () => {
    globalThis.document = {
      getElementById: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.handleVoiceEmbedderChange();
  });
});

// ── voiceReportToCSV edge cases ──

describe("voice_ui — voiceReportToCSV", () => {
  afterEach(() => resetGlobals());

  it("handles a minimal report with no optional sections", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 1000 };
    r.quality = {
      gate: "PASS",
      score: 90,
      speechRatio: 0.9,
      reasons: [],
      standard: "ISO",
    };
    const csv = globalThis.voiceReportToCSV(r);
    assert.ok(csv.indexOf("redoSan.voiceBiometricReport") !== -1);
    assert.ok(csv.indexOf("test.wav") !== -1);
  });

  it("includes speaker and template fields when present", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 1000 };
    r.quality = {
      gate: "PASS",
      score: 90,
      speechRatio: 0.9,
      reasons: [],
      standard: "ISO",
    };
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc123",
      decision: "MATCH",
      embeddingVersion: "ecapa",
    };
    r.template = { bits: 128, codeSha256: "def456", pinFingerprint: "fp123" };
    r.registry = {
      match: { label: "Speaker A", similarity: 95.5 },
      registeredId: 42,
    };
    const csv = globalThis.voiceReportToCSV(r);
    assert.ok(csv.indexOf("Speaker A") !== -1);
    assert.ok(csv.indexOf("MATCH") !== -1);
  });

  it("escapes CSV cells with special characters", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = {
      fileName: 'file"with,quotes',
      sampleRate: 16000,
      durationMs: 1000,
    };
    const csv = globalThis.voiceReportToCSV(r);
    // The double-quote should be escaped
    assert.ok(csv.indexOf('""') !== -1);
  });

  it("prepends formula characters with apostrophe", () => {
    const r = globalThis.voiceBaseReport();
    r.quality = {
      gate: "=CMD",
      score: 0,
      speechRatio: 0,
      reasons: [],
      standard: "",
    };
    const csv = globalThis.voiceReportToCSV(r);
    assert.ok(csv.indexOf("'=CMD") !== -1);
  });
});

// ── voiceReportToTXT edge cases ──

describe("voice_ui — voiceReportToTXT", () => {
  afterEach(() => resetGlobals());

  it("handles report with all optional sections present", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 3000 };
    r.quality = {
      gate: "PASS",
      score: 90,
      speechRatio: 0.9,
      reasons: ["clear"],
      standard: "ISO",
    };
    r.antiSpoof = {
      mode: "aasist",
      gate: "PASS",
      verdict: "BONAFIDE",
      standard: "ISO/IEC 30107-3",
      reasons: [],
    };
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      decision: "MATCH",
      similarity: 0.95,
    };
    r.template = { bits: 128, codeSha256: "def", pinFingerprint: "fp" };
    r.registry = {
      match: { label: "Speaker A", similarity: 95 },
      registeredId: 1,
    };
    r.did = {
      did: "did:key:test",
      algorithm: "Ed25519",
      signedAt: "2026-01-01",
      signature: "sig123",
    };
    r.standards = { recordVersion: { major: 1 } };
    r.provenance = {
      status: "complete",
      manifestLabel: "label",
      signerDid: "did:test",
    };
    r.limitations = ["quality gate is heuristic"];
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("test.wav") !== -1);
    assert.ok(txt.indexOf("MATCH") !== -1);
    assert.ok(txt.indexOf("Speaker A") !== -1);
    assert.ok(txt.indexOf("did:key:test") !== -1);
    assert.ok(txt.indexOf("quality gate is heuristic") !== -1);
  });

  it("handles report with quality.speechRatio being Infinity", () => {
    const r = globalThis.voiceBaseReport();
    r.quality = {
      gate: "PASS",
      score: 0,
      speechRatio: Infinity,
      reasons: [],
      standard: "",
    };
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("n/a") !== -1);
  });

  it("handles report with anti-spoof having no verdict", () => {
    const r = globalThis.voiceBaseReport();
    r.antiSpoof = {
      mode: "off",
      gate: "NOT_RUN",
      verdict: null,
      reasons: ["disabled"],
    };
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("n/a") !== -1);
  });

  it("handles report with speaker having null similarity", () => {
    const r = globalThis.voiceBaseReport();
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      decision: "NO_MATCH",
      similarity: null,
    };
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("n/a") !== -1);
  });

  it("renders fallback text when quality/speaker/template/DID are null", () => {
    const r = globalThis.voiceBaseReport();
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("quality module unavailable") !== -1);
    assert.ok(txt.indexOf("embedding unavailable") !== -1);
    assert.ok(txt.indexOf("template module unavailable") !== -1);
    assert.ok(txt.indexOf("DID module unavailable") !== -1);
  });

  it("renders fallback text when anti-spoof is null", () => {
    const r = globalThis.voiceBaseReport();
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("not evaluated") !== -1);
  });

  it("renders standards record section when present", () => {
    const r = globalThis.voiceBaseReport();
    r.standards = { recordVersion: { major: 1 } };
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("Standards Record") !== -1);
  });

  it("renders provenance section when present", () => {
    const r = globalThis.voiceBaseReport();
    r.provenance = {
      status: "complete",
      manifestLabel: "test.manifest",
      signerDid: "did:test",
    };
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("Provenance") !== -1);
    assert.ok(txt.indexOf("test.manifest") !== -1);
  });

  it("renders registry match as 'Not found' when no match", () => {
    const r = globalThis.voiceBaseReport();
    const txt = globalThis.voiceReportToTXT(r);
    assert.ok(txt.indexOf("Not found in the registry") !== -1);
  });
});

// ── voiceReportToXML edge cases ──

describe("voice_ui — voiceReportToXML", () => {
  afterEach(() => resetGlobals());

  it("produces well-formed XML with all sections", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 3000 };
    r.quality = {
      gate: "PASS",
      score: 90,
      speechRatio: 0.9,
      reasons: ["clear"],
      standard: "ISO",
    };
    r.antiSpoof = {
      mode: "aasist",
      gate: "PASS",
      verdict: "BONAFIDE",
      standard: "ISO",
      reasons: [],
    };
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      embeddingVersion: "ecapa",
      embedMagnitude: 1.5,
      similarity: 0.95,
      decision: "MATCH",
    };
    r.template = { bits: 128, codeSha256: "def", pinFingerprint: "fp" };
    r.registry = {
      match: { label: "Speaker A", similarity: 95 },
      registeredId: 1,
    };
    r.did = {
      did: "did:key:test",
      algorithm: "Ed25519",
      signedAt: "2026-01-01",
      signature: "sig123",
    };
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf('<?xml version="1.0"') !== -1);
    assert.ok(xml.indexOf("<voiceBiometricReport>") !== -1);
    assert.ok(xml.indexOf("</voiceBiometricReport>") !== -1);
    assert.ok(xml.indexOf("<antiSpoof>") !== -1);
    assert.ok(xml.indexOf("<speaker>") !== -1);
    assert.ok(xml.indexOf("<template>") !== -1);
    assert.ok(xml.indexOf("<did>") !== -1);
  });

  it("escapes XML special characters in values", () => {
    const r = globalThis.voiceBaseReport();
    r.quality = {
      gate: "PASS&FAIL",
      score: 0,
      speechRatio: 0,
      reasons: ["a<b>c"],
      standard: "",
    };
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("&amp;") !== -1);
    assert.ok(xml.indexOf("&lt;") !== -1);
    assert.ok(xml.indexOf("&gt;") !== -1);
  });

  it("omits sections when optional fields are null", () => {
    const r = globalThis.voiceBaseReport();
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("<quality>") === -1);
    assert.ok(xml.indexOf("<antiSpoof>") === -1);
    assert.ok(xml.indexOf("<speaker>") === -1);
    assert.ok(xml.indexOf("<template>") === -1);
    assert.ok(xml.indexOf("<did>") === -1);
  });

  it("renders speaker with null embedMagnitude and similarity", () => {
    const r = globalThis.voiceBaseReport();
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      embeddingVersion: "ecapa",
      embedMagnitude: null,
      similarity: null,
      decision: "",
    };
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("<speaker>") !== -1);
  });

  it("renders template with null pinFingerprint", () => {
    const r = globalThis.voiceBaseReport();
    r.template = { bits: 0, codeSha256: "", pinFingerprint: null };
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("<template>") !== -1);
  });

  it("renders registry without match", () => {
    const r = globalThis.voiceBaseReport();
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("<registry>") !== -1);
    assert.ok(xml.indexOf("none") !== -1);
  });

  it("renders anti-spoof with null mode and verdict", () => {
    const r = globalThis.voiceBaseReport();
    r.antiSpoof = {
      mode: null,
      gate: "NOT_RUN",
      verdict: null,
      standard: null,
      reasons: [],
    };
    const xml = globalThis.voiceReportToXML(r);
    assert.ok(xml.indexOf("<antiSpoof>") !== -1);
  });
});

// ── voiceReportToHTML edge cases ──

describe("voice_ui — voiceReportToHTML", () => {
  afterEach(() => resetGlobals());

  it("produces a standalone HTML document with all sections", () => {
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 3000 };
    r.quality = {
      gate: "PASS",
      score: 90,
      speechRatio: 0.9,
      reasons: [],
      standard: "ISO",
    };
    r.antiSpoof = {
      mode: "aasist",
      gate: "PASS",
      verdict: "BONAFIDE",
      reasons: [],
    };
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      embeddingVersion: "ecapa",
      similarity: 0.95,
      decision: "MATCH",
    };
    r.template = { bits: 128, codeSha256: "def", pinFingerprint: "fp" };
    r.registry = {
      match: { label: "Speaker A", similarity: 95 },
      registeredId: 1,
    };
    r.did = {
      did: "did:key:test",
      algorithm: "Ed25519",
      signedAt: "2026-01-01",
      signature: "sig123",
    };
    r.provenance = {
      status: "complete",
      manifestLabel: "label",
      format: "wav",
      signerDid: "did:test",
    };
    r.limitations = ["test limitation"];
    const html = globalThis.voiceReportToHTML(r);
    assert.ok(html.indexOf("<!doctype html>") !== -1);
    assert.ok(html.indexOf("RedoSan Authenticity") !== -1);
    assert.ok(html.indexOf("Speaker A") !== -1);
    assert.ok(html.indexOf("test limitation") !== -1);
  });

  it("omits optional sections when fields are null", () => {
    const r = globalThis.voiceBaseReport();
    const html = globalThis.voiceReportToHTML(r);
    assert.ok(html.indexOf("Quality Gate") === -1);
    assert.ok(html.indexOf("Presentation Attack Detection") === -1);
    assert.ok(html.indexOf("Speaker Verification") === -1);
    assert.ok(html.indexOf("Protected Template") === -1);
    assert.ok(html.indexOf("DID Identity") === -1);
    assert.ok(html.indexOf("Provenance") === -1);
  });

  it("renders 'n/a' for null similarity in speaker section", () => {
    const r = globalThis.voiceBaseReport();
    r.speaker = {
      embeddingDim: 192,
      embeddingHash: "abc",
      similarity: null,
      decision: "NO_MATCH",
      embeddingVersion: "",
    };
    const html = globalThis.voiceReportToHTML(r);
    assert.ok(html.indexOf("n/a") !== -1);
  });

  it("renders 'Not found' when no registry match", () => {
    const r = globalThis.voiceBaseReport();
    const html = globalThis.voiceReportToHTML(r);
    assert.ok(html.indexOf("Not found in the registry") !== -1);
  });
});

// ── downloadVoiceReport edge cases ──

describe("voice_ui — downloadVoiceReport edge cases", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => {
    delete globalThis.jspdf;
    delete globalThis.docx;
    resetGlobals();
  });

  it("returns silently when there is no report", async () => {
    globalThis._voiceReport = null;
    await globalThis.downloadVoiceReport("json");
    assert.equal(downloads.length, 0);
  });

  it("does nothing for an unknown format", async () => {
    await runHappyPath();
    downloads.length = 0;
    await globalThis.downloadVoiceReport("unknown_format");
    assert.equal(downloads.length, 0);
  });

  it("sanitizes special characters in the filename", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Speaker A" },
      "voice-audio": {
        files: [fakeFile({ name: "C:\\Users\\test/file:name.wav" })],
        disabled: false,
      },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 };
    await globalThis.handleVoiceFilePicked();
    await globalThis.handleVoiceRun();
    downloads.length = 0;
    await globalThis.downloadVoiceReport("json");
    assert.ok(downloads.length > 0);
    // The filename should have sanitised characters
    assert.ok(downloads[0].name.indexOf("\\") === -1);
    assert.ok(
      downloads[0].name.indexOf(":") === -1 ||
        downloads[0].name.indexOf("/") === -1,
    );
  });
});

// ── voiceLabelsToSheet edge cases ──

describe("voice_ui — voiceLabelsToSheet", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("returns empty string when no registry", async () => {
    globalThis._voiceRegistry = null;
    const sheet = await globalThis.voiceLabelsToSheet("csv");
    assert.equal(sheet, "");
  });

  it("returns empty string when registry is empty", async () => {
    await clearVoiceRegistry();
    const sheet = await globalThis.voiceLabelsToSheet("csv");
    assert.equal(sheet, "");
  });

  it("returns CSV with voice labels", async () => {
    await enroll("Speaker A");
    const sheet = await globalThis.voiceLabelsToSheet("csv");
    assert.ok(sheet.indexOf("label") !== -1);
    assert.ok(sheet.indexOf("Speaker A") !== -1);
  });

  it("returns TXT with tab-separated voice labels", async () => {
    await enroll("Speaker B");
    const sheet = await globalThis.voiceLabelsToSheet("txt");
    assert.ok(sheet.indexOf("label") !== -1);
    assert.ok(sheet.indexOf("Speaker B") !== -1);
    // Tab-separated
    assert.ok(sheet.indexOf("\t") !== -1);
  });

  it("escapes CSV cells with commas and quotes", async () => {
    await enroll('Speaker, "A"');
    const sheet = await globalThis.voiceLabelsToSheet("csv");
    assert.ok(sheet.indexOf('""') !== -1);
  });
});

// ── voiceConsentWithdraw with registry error ──

describe("voice_ui — voiceConsentWithdraw error paths", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.confirm = function () {
      return true;
    };
  });
  afterEach(() => resetGlobals());

  it("does not block withdrawal when registry.clear throws", async () => {
    await enroll("Speaker A");
    // Override registry.clear to throw
    const origClear = globalThis._voiceRegistry.clear;
    globalThis._voiceRegistry.clear = async function () {
      throw new Error("db error");
    };
    await globalThis.handleVoiceConsentWithdraw();
    assert.equal(globalThis.voiceConsentLoad(), null);
    globalThis._voiceRegistry.clear = origClear;
  });
});

// ── initVoiceConsent edge cases ──

describe("voice_ui — initVoiceConsent edge cases", () => {
  afterEach(() => resetGlobals());

  it("returns early when consent panel is absent", () => {
    globalThis.document = makeVoiceDoc();
    // No consent panel → early return
    globalThis.initVoiceConsent();
  });

  it("unlocks UI when consent is already on record", async () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const doc = makeVoiceConsentDoc();
    globalThis.document = doc;
    globalThis.initVoiceConsent();
    assert.equal(
      doc.getElementById("voice-consent-panel").style.display,
      "none",
    );
    assert.equal(doc.getElementById("voice-audio").disabled, false);
    assert.equal(doc.getElementById("voice-record-start").disabled, false);
  });
});

// ── initVoiceBiometric error path ──

describe("voice_ui — initVoiceBiometric error", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("catches and surfaces registry open errors", async () => {
    globalThis.document = makeVoiceConsentDoc();
    // Override VoiceRegistry constructor to throw on open
    const savedVR = globalThis.VoiceRegistry;
    globalThis.VoiceRegistry = function () {
      return {
        open: async function () {
          throw new Error("DB locked");
        },
        clear: async function () {},
        getAll: async function () {
          return [];
        },
        findMatch: async function () {
          return null;
        },
        add: async function () {
          return 1;
        },
        remove: async function () {},
        grantConsent: async function () {},
      };
    };
    await globalThis.initVoiceBiometric();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Failed to initialize: DB locked/,
    );
    globalThis.VoiceRegistry = savedVR;
  });
});

// ── setVoiceStage ──

describe("voice_ui — setVoiceStage", () => {
  afterEach(() => resetGlobals());

  it("updates step text and progress when both exist", () => {
    const stepEl = { textContent: "", style: {} };
    const overlay = {
      classList: makeClassList(),
      offsetWidth: 100,
      style: {},
      parentNode: { removeChild: function () {} },
    };
    overlay.classList.add("is-visible");
    globalThis.document = makeVoiceDoc({
      "voice-steps": stepEl,
      "voice-progress-overlay": overlay,
      "voice-progress-bar": {
        style: {},
        classList: makeClassList(),
        setAttribute: function () {},
      },
      "voice-progress-pct": { textContent: "", setAttribute: function () {} },
      "voice-progress-text": { textContent: "", setAttribute: function () {} },
      "voice-progress-title": { textContent: "", setAttribute: function () {} },
    });
    globalThis.setVoiceStage("2/8 Testing", 0.25);
    assert.equal(stepEl.textContent, "2/8 Testing");
    assert.equal(stepEl.style.display, "block");
  });

  it("hides step when text is null", () => {
    globalThis.document = makeVoiceDoc({
      "voice-steps": { textContent: "old", style: {} },
    });
    globalThis.setVoiceStage(null, null);
    assert.equal(
      globalThis.document.getElementById("voice-steps").textContent,
      "",
    );
  });
});

// ── voiceReportToDOCX edge cases ──

describe("voice_ui — voiceReportToDOCX", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => {
    delete globalThis.docx;
    resetGlobals();
  });

  it("returns null when docx is not loaded", async () => {
    delete globalThis.docx;
    await globalThis.ensureLib("docx");
    // docx is still not defined after ensureLib
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 3000 };
    const result = await globalThis.voiceReportToDOCX(r);
    assert.equal(result, null);
  });

  it("returns null when docx.Packer is missing", async () => {
    globalThis.docx = {
      Paragraph: class {},
      TextRun: class {},
    };
    const r = globalThis.voiceBaseReport();
    r.audio = { fileName: "test.wav", sampleRate: 16000, durationMs: 3000 };
    const result = await globalThis.voiceReportToDOCX(r);
    assert.equal(result, null);
  });
});

// ── voiceCreateDocxTable ──

describe("voice_ui — voiceCreateDocxTable", () => {
  afterEach(() => resetGlobals());

  it("returns null for empty rows", () => {
    const result = globalThis.voiceCreateDocxTable({}, []);
    assert.equal(result, null);
  });

  it("returns null for null rows", () => {
    const result = globalThis.voiceCreateDocxTable({}, null);
    assert.equal(result, null);
  });
});

// ── listVoiceRegistered error path ──

describe("voice_ui — listVoiceRegistered error path", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("surfaces errors from registry.getAll", async () => {
    await enroll("Speaker A"); // ensures _voiceRegistry is initialized
    globalThis.document = makeVoiceConsentDoc();
    const origGetAll = globalThis._voiceRegistry.getAll;
    globalThis._voiceRegistry.getAll = async function () {
      throw new Error("db read error");
    };
    await globalThis.listVoiceRegistered();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /List error: db read error/,
    );
    globalThis._voiceRegistry.getAll = origGetAll;
  });

  it("returns early when _voiceRegistry is null", async () => {
    globalThis._voiceRegistry = null;
    globalThis.document = makeVoiceConsentDoc();
    await globalThis.listVoiceRegistered();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /not available/i,
    );
  });

  it("returns size when voice-list element is absent", async () => {
    await clearVoiceRegistry();
    // Ensure _voiceRegistry exists by running initVoiceBiometric
    globalThis.document = makeVoiceConsentDoc();
    await globalThis.initVoiceBiometric();
    globalThis.document = makeVoiceDoc({
      "voice-count": { textContent: "", setAttribute: function () {} },
      "voice-migration-note": { style: {} },
    });
    // Override getElementById to return null for voice-list
    const origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "voice-list") return null;
      return origGetById.call(globalThis.document, id);
    };
    const size = await globalThis.listVoiceRegistered();
    assert.equal(size, 0);
  });
});

// ── handleVoiceDelete error path ──

describe("voice_ui — handleVoiceDelete error path", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("surfaces errors from registry.remove", async () => {
    await enroll("Speaker A");
    globalThis.document = makeVoiceConsentDoc();
    const origRemove = globalThis._voiceRegistry.remove;
    globalThis._voiceRegistry.remove = async function () {
      throw new Error("delete error");
    };
    await globalThis.handleVoiceDelete(1);
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Delete error: delete error/,
    );
    globalThis._voiceRegistry.remove = origRemove;
  });

  it("returns early when _voiceRegistry is null", async () => {
    globalThis._voiceRegistry = null;
    await globalThis.handleVoiceDelete(1);
    // Should not throw
  });
});

// ── handleVoiceRefreshList edge cases ──

describe("voice_ui — handleVoiceRefreshList edge cases", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("clears report and re-renders", async () => {
    await runHappyPath();
    assert.ok(globalThis.window._voiceReport);
    await globalThis.handleVoiceRefreshList();
    assert.equal(globalThis.window._voiceReport, null);
    assert.equal(globalThis._voicePendingAudio, null);
  });
});

// ── runVoicePipeline: engine unavailable ──

describe("voice_ui — runVoicePipeline engine/unavailable paths", () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeLocalStorage();
  });
  afterEach(() => resetGlobals());

  it("returns early when engine is unavailable", async () => {
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Test" },
      "voice-audio": { files: [fakeFile()], disabled: false },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 };
    await globalThis.handleVoiceFilePicked();
    // Force _voiceEngine to null and VoiceEngine to non-function
    const savedVE = globalThis.VoiceEngine;
    globalThis._voiceEngine = null;
    globalThis.VoiceEngine = "not-a-function";
    await globalThis.handleVoiceRun();
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /not available/i,
    );
    assert.equal(globalThis.window._voiceReport, null);
    globalThis.VoiceEngine = savedVE;
  });

  it("returns early when no audio data is staged", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Test" },
      "voice-audio": { files: [fakeFile()], disabled: false },
    });
    await globalThis.handleVoiceConsentAccept();
    // Directly call runVoicePipeline with no audio
    await globalThis.runVoicePipeline(null, {});
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /No audio data/,
    );
  });

  it("catches and surfaces pipeline-level errors", async () => {
    await clearVoiceRegistry();
    globalThis.document = makeVoiceConsentDoc({
      "voice-consent-check": { checked: true },
      "voice-label": { value: "Test" },
      "voice-audio": { files: [fakeFile()], disabled: false },
    });
    await globalThis.handleVoiceConsentAccept();
    mockDecoded = { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 };
    await globalThis.handleVoiceFilePicked();
    // Make engine.assessQuality throw — this is NOT inside its own try-catch,
    // so it bubbles to the outer catch at line 1678
    const savedVE = globalThis._voiceEngine;
    globalThis._voiceEngine = {
      isLoaded: function () {
        return true;
      },
      assessQuality: async function () {
        throw new Error("quality boom");
      },
    };
    await globalThis.runVoicePipeline(
      { float32: sinePcm(3), sampleRate: 16000, durationMs: 3000 },
      { source: "file", fileName: "test.wav" },
    );
    assert.match(
      globalThis.document.getElementById("voice-status").textContent,
      /Pipeline error: quality boom/,
    );
    globalThis._voiceEngine = savedVE;
  });
});

// ── calculateVoiceSpeechSeconds with VoiceVAD ──

describe("voice_ui — calculateVoiceSpeechSeconds with VAD", () => {
  afterEach(() => resetGlobals());

  it("uses VoiceVAD.process when available and ready", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function (block) {
        // Return probability >= 0.5 for all blocks (speech detected)
        return { probability: 0.8 };
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(typeof secs === "number");
    assert.ok(secs > 0);
  });

  it("returns null when VoiceVAD.process throws", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        throw new Error("VAD crashed");
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.equal(secs, null);
  });

  it("counts low-probability blocks as non-speech", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        return { probability: 0.1 };
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.equal(secs, 0);
  });

  it("handles VAD result with isSpeech boolean", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        return { isSpeech: true };
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(secs > 0);
  });

  it("handles VAD result with isSpeech false", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        return { isSpeech: false };
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.equal(secs, 0);
  });

  it("handles VAD result with neither probability nor isSpeech", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
      process: async function () {
        return {};
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.equal(secs, 0);
  });

  it("falls back to RMS when VoiceVAD is not ready", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return false;
      },
      process: async function () {
        return { probability: 0.8 };
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(typeof secs === "number");
    assert.ok(secs > 0);
  });

  it("falls back to RMS when VoiceVAD has no isReady", async () => {
    globalThis.VoiceVAD = {};
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(typeof secs === "number");
  });

  it("falls back to RMS when VoiceVAD has no process method", async () => {
    globalThis.VoiceVAD = {
      isReady: function () {
        return true;
      },
    };
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(typeof secs === "number");
  });

  it("RMS path: detects silence correctly", async () => {
    const pcm = silencePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.equal(secs, 0);
  });

  it("RMS path: detects speech correctly", async () => {
    const pcm = sinePcm(3);
    const secs = await globalThis.calculateVoiceSpeechSeconds(pcm);
    assert.ok(secs > 0);
  });
});

// ── concatVoiceBlocks ──

describe("voice_ui — concatVoiceBlocks", () => {
  afterEach(() => resetGlobals());

  it("concatenates multiple Float32Array blocks", () => {
    const b1 = new Float32Array([1, 2, 3]);
    const b2 = new Float32Array([4, 5]);
    const result = globalThis.concatVoiceBlocks([b1, b2]);
    assert.equal(result.length, 5);
    assert.equal(result[0], 1);
    assert.equal(result[3], 4);
  });

  it("handles a single block", () => {
    const b1 = new Float32Array([1, 2]);
    const result = globalThis.concatVoiceBlocks([b1]);
    assert.equal(result.length, 2);
  });

  it("handles an empty blocks array", () => {
    const result = globalThis.concatVoiceBlocks([]);
    assert.equal(result.length, 0);
  });
});

// ── voiceDescriptorHash edge cases ──

describe("voice_ui — voiceDescriptorHash edge cases", () => {
  afterEach(() => resetGlobals());

  it("returns null for null input", async () => {
    assert.equal(await globalThis.voiceDescriptorHash(null), null);
  });

  it("returns null for empty array", async () => {
    assert.equal(await globalThis.voiceDescriptorHash([]), null);
  });

  it("returns null for zero-length typed array", async () => {
    assert.equal(
      await globalThis.voiceDescriptorHash(new Float32Array(0)),
      null,
    );
  });

  it("falls back to rolling hash when VoiceCrypto.sha256Hex throws", async () => {
    const savedCrypto = globalThis.VoiceCrypto;
    globalThis.VoiceCrypto = {
      sha256Hex: async function () {
        throw new Error("crypto fail");
      },
    };
    const emb = new Float32Array([0.1, 0.2, 0.3]);
    const h = await globalThis.voiceDescriptorHash(emb);
    assert.equal(typeof h, "string");
    assert.ok(h.length > 0);
    globalThis.VoiceCrypto = savedCrypto;
  });

  it("falls back to rolling hash when VoiceCrypto.sha256Hex is not a function", async () => {
    const savedCrypto = globalThis.VoiceCrypto;
    globalThis.VoiceCrypto = { sha256Hex: "not-a-function" };
    const emb = new Float32Array([0.1, 0.2, 0.3]);
    const h = await globalThis.voiceDescriptorHash(emb);
    assert.equal(typeof h, "string");
    globalThis.VoiceCrypto = savedCrypto;
  });

  it("returns null when VoiceCrypto is undefined", async () => {
    const savedCrypto = globalThis.VoiceCrypto;
    delete globalThis.VoiceCrypto;
    const emb = new Float32Array([0.1, 0.2]);
    const h = await globalThis.voiceDescriptorHash(emb);
    // Should fall back to rolling hash
    assert.equal(typeof h, "string");
    globalThis.VoiceCrypto = savedCrypto;
  });
});

// ── renderVoiceReport edge cases ──

describe("voice_ui — renderVoiceReport edge cases", () => {
  afterEach(() => resetGlobals());

  it("is a no-op when report element is missing", () => {
    globalThis.document = {
      getElementById: function () {
        return null;
      },
      querySelector: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.renderVoiceReport({ type: "test", audio: null, quality: null });
  });

  it("renders the modal title when dl-modal-title exists", () => {
    const modalTitle = { textContent: "" };
    const reportEl = { innerHTML: "", style: {} };
    globalThis.document = {
      getElementById: function (id) {
        if (id === "voice-report") return reportEl;
        return null;
      },
      querySelector: function (sel) {
        if (sel === "#dl-modal-title") return modalTitle;
        return null;
      },
    };
    const r = globalThis.voiceBaseReport();
    globalThis.renderVoiceReport(r);
    assert.ok(modalTitle.textContent.indexOf("Download") !== -1);
  });
});

// ── renderVoiceActions edge cases ──

describe("voice_ui — renderVoiceActions edge cases", () => {
  afterEach(() => resetGlobals());

  it("is a no-op when actions element is missing", () => {
    globalThis.document = {
      getElementById: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.renderVoiceActions(true);
    globalThis.renderVoiceActions(false);
  });

  it("sets display to flex when show=true", () => {
    const el = { style: {} };
    globalThis.document = {
      getElementById: function () {
        return el;
      },
    };
    globalThis.renderVoiceActions(true);
    assert.equal(el.style.display, "flex");
  });

  it("sets display to none when show=false", () => {
    const el = { style: { display: "flex" } };
    globalThis.document = {
      getElementById: function () {
        return el;
      },
    };
    globalThis.renderVoiceActions(false);
    assert.equal(el.style.display, "none");
  });
});

// ── updateVoiceRunState edge cases ──

describe("voice_ui — updateVoiceRunState edge cases", () => {
  afterEach(() => resetGlobals());

  it("is a no-op when run button is missing", () => {
    globalThis.document = {
      getElementById: function () {
        return null;
      },
    };
    // Should not throw
    globalThis.updateVoiceRunState();
  });

  it("trims the label value", () => {
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.voiceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
      accepted: true,
    });
    const labelEl = { value: "  Speaker  " };
    const btnEl = { disabled: true };
    globalThis.document = {
      getElementById: function (id) {
        if (id === "voice-run") return btnEl;
        if (id === "voice-label") return labelEl;
        return null;
      },
    };
    globalThis._voicePendingAudio = { float32: new Float32Array(8) };
    globalThis.updateVoiceRunState();
    assert.equal(labelEl.value, "Speaker");
  });
});

// ── isAllowedVoiceFile: extension-only match ──

describe("voice_ui — isAllowedVoiceFile extension-only", () => {
  afterEach(() => resetGlobals());

  it("matches mp3 extension with empty MIME type", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "track.mp3" }),
      true,
    );
  });

  it("matches m4a extension", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "recording.m4a" }),
      true,
    );
  });

  it("matches ogg extension", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "audio.ogg" }),
      true,
    );
  });

  it("rejects unknown extension", () => {
    assert.equal(
      globalThis.isAllowedVoiceFile({ type: "", name: "data.xyz" }),
      false,
    );
  });
});
