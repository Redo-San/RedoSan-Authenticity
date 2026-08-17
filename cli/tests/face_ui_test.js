const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

// ── Global helpers needed by face_ui.js ──

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

// loadImage mock
globalThis.loadImage = async function () {
  const { createCanvas } = require("canvas");
  const c = createCanvas(200, 200);
  return { canvas: c, w: 200, h: 200 };
};

// DID mocks (mirror Decentralized_Identity_DID/did.js shapes)
globalThis.didGenerateKeypair = async function (algo) {
  return { did: "did:key:zTest1234567890", algorithm: algo || "Ed25519" };
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
    verificationMethod: [{ id: kp.did + "#key-1", type: "Ed25519VerificationKey2020" }],
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

// ── Load real module sources (same polyfill pattern as other face tests) ──
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_engine.js"),
  "utf8",
);
vm.runInThisContext(engineSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_engine.js") });

const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const registrySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_registry.js"),
  "utf8",
);
vm.runInThisContext(registrySrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_registry.js") });

const biohashSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_biohash.js"),
  "utf8",
);
vm.runInThisContext(biohashSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_biohash.js") });

const fuzzySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_fuzzy.js"),
  "utf8",
);
vm.runInThisContext(fuzzySrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_fuzzy.js") });

const cryptoSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_crypto.js"),
  "utf8",
);
vm.runInThisContext(cryptoSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_crypto.js") });

const uiSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_ui.js"),
  "utf8",
);
vm.runInThisContext(uiSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_ui.js") });

// ── Fixtures ──

const { createCanvas } = require("canvas");

const DESCRIPTOR = Float32Array.from({ length: 128 }, function (_, i) {
  return (i % 7) / 10 + 0.05;
});

class MockHuman {
  constructor(config) {
    this.config = config;
  }
  async load() {
    return true;
  }
  async detect() {
    return {
      face: [
        {
          box: { x: 10, y: 20, width: 100, height: 150 },
          score: 0.95,
          landmarks: {},
          embedding: DESCRIPTOR,
        },
      ],
    };
  }
}

class NoFaceHuman extends MockHuman {
  async detect() {
    return { face: [] };
  }
}

class MeshHuman extends MockHuman {
  async detect() {
    const face = (await super.detect()).face[0];
    face.mesh = new Array(468);
    return { face: [face] };
  }
}

// Pre-mark the engine as loaded so loadModels() skips the (20s) model timeout
function makeEngine(human) {
  const e = new FaceEngine({ human: human || new MockHuman() });
  e._loaded = true;
  return e;
}

// Minimal classList mock for tab buttons
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

// Mock document with every element face_ui.js touches
function makeDoc(overrides) {
  const mt = { textContent: "" };
  const tabBtns = [
    { dataset: { faceTab: "upload" }, style: {}, classList: makeClassList() },
    { dataset: { faceTab: "camera" }, style: {}, classList: makeClassList() },
  ];
  const store = {
    "face-status": { textContent: "" },
    "face-steps": { textContent: "", style: {} },
    "face-preview": createCanvas(200, 200),
    "face-actions": { style: {} },
    "face-report": { style: {}, innerHTML: "", select: function () {} },
    "face-label": { value: "" },
    "face-list": { innerHTML: "", append: function () {} },
    "face-count": { textContent: "" },
    "face-camera": { style: {} },
    "face-liveness-mode": { value: "off" },
    "face-challenge": { textContent: "", style: {} },
    "face-image": { files: [], disabled: false },
    "face-run": { disabled: true },
    "face-cam-start": { disabled: false },
    "face-cam-stop": { disabled: true },
    "face-cam-capture": { disabled: true },
    "face-upload-wrapper": { style: {} },
    "face-capture-wrapper": { style: { display: "none" } },
    "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: {}, offsetWidth: 0 },
    "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
    "face-progress-title": { textContent: "", setAttribute: function () {} },
    "face-progress-text": { textContent: "", setAttribute: function () {} },
    "face-progress-pct": { textContent: "", setAttribute: function () {} },
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
    querySelectorAll: function (sel) {
      if (sel === "[data-face-tab]") return tabBtns;
      return [];
    },
    createElement: function (tag) {
      if (tag === "canvas") return createCanvas(200, 200);
      return { className: "", innerHTML: "", style: {}, append: function () {}, textContent: "" };
    },
    body: { appendChild: function () {} },
  };
}

async function flush() {
  await new Promise(function (r) {
    setImmediate(r);
  });
  await new Promise(function (r) {
    setImmediate(r);
  });
}

function resetGlobals() {
  globalThis.faceEngine = null;
  globalThis.faceRegistry = null;
  globalThis.faceCamera = null;
  globalThis.faceLiveness = null;
  globalThis._faceReport = null;
  globalThis._faceAutoPin = null;
  globalThis._faceKeypair = null;
  globalThis._faceLivenessEvidence = null;
  globalThis._facePendingCanvas = null;
  globalThis._facePendingSource = null;
  globalThis._faceInputTab = "upload";
  globalThis.document = null;
  downloads.length = 0;
  downloadHandler = null;
  modalClosed = 0;
}

// ── Unit tests: small helpers ──

describe("Face UI — setStatus", () => {
  it("should set textContent when element exists", () => {
    const el = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": el });
    globalThis.setStatus("face-status", "hello");
    assert.equal(el.textContent, "hello");
  });

  it("should do nothing when element does not exist", () => {
    globalThis.document = makeDoc();
    globalThis.setStatus("nonexistent", "msg"); // should not throw
  });
});

describe("Face UI — setFaceStep", () => {
  it("should show text in the steps box", () => {
    const el = { textContent: "", style: {} };
    globalThis.document = makeDoc({ "face-steps": el });
    globalThis.setFaceStep("1/6 Working...");
    assert.equal(el.textContent, "1/6 Working...");
    assert.equal(el.style.display, "block");
  });

  it("should hide the box when text is null", () => {
    const el = { textContent: "old", style: {} };
    globalThis.document = makeDoc({ "face-steps": el });
    globalThis.setFaceStep(null);
    assert.equal(el.textContent, "");
    assert.equal(el.style.display, "none");
  });

  it("should do nothing when element missing", () => {
    globalThis.document = makeDoc();
    globalThis.setFaceStep("x"); // should not throw
  });
});

describe("Face UI — faceDescriptorHash", () => {
  it("should be deterministic for the same descriptor (sha-256)", async () => {
    const h1 = await globalThis.faceDescriptorHash(DESCRIPTOR);
    const h2 = await globalThis.faceDescriptorHash(DESCRIPTOR);
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
  });

  it("should differ for a different descriptor", async () => {
    const other = Float32Array.from({ length: 128 }, function () {
      return 0;
    });
    assert.notEqual(
      await globalThis.faceDescriptorHash(other),
      await globalThis.faceDescriptorHash(DESCRIPTOR),
    );
  });

  it("should return null for missing/empty input", async () => {
    assert.equal(await globalThis.faceDescriptorHash(null), null);
    assert.equal(await globalThis.faceDescriptorHash([]), null);
  });

  it("should fall back to the legacy rolling hash without FaceCrypto", async () => {
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined; // var/function bindings cannot be deleted
    try {
      const h = await globalThis.faceDescriptorHash(DESCRIPTOR);
      assert.ok(typeof h === "string" && h.length > 0);
      assert.match(h, /^[0-9a-f]+$/);
      assert.ok(h.length < 64, "legacy hash is short");
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });
});

describe("Face UI — faceRandomToken", () => {
  it("should return the requested length of alphanumeric chars", () => {
    const t = globalThis.faceRandomToken(8);
    assert.equal(t.length, 8);
    assert.match(t, /^[a-zA-Z0-9]{8}$/);
  });

  it("should produce different tokens", () => {
    assert.notEqual(globalThis.faceRandomToken(8), globalThis.faceRandomToken(8));
  });
});

describe("Face UI — faceBytesToHex", () => {
  it("should convert bytes to lowercase hex", () => {
    assert.equal(globalThis.faceBytesToHex(new Uint8Array([0, 1, 15, 255, 16])), "00010fff10");
  });

  it("should return empty string for null", () => {
    assert.equal(globalThis.faceBytesToHex(null), "");
  });
});

// ── initFaceBiometric ──

describe("Face UI — initFaceBiometric", () => {
  beforeEach(resetGlobals);

  it("should create FaceEngine and FaceRegistry instances", async () => {
    globalThis.document = makeDoc();
    await globalThis.initFaceBiometric();
    assert.ok(globalThis.faceEngine instanceof FaceEngine);
    assert.ok(globalThis.faceRegistry instanceof FaceRegistry);
  });

  it("should handle initialization error", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    const origEngine = globalThis.FaceEngine;
    const origRegistry = globalThis.FaceRegistry;
    const origList = globalThis.listRegisteredFaces;
    globalThis.FaceEngine = function () {
      throw new Error("mock init error");
    };
    globalThis.FaceRegistry = function () {
      throw new Error("mock registry error");
    };
    globalThis.listRegisteredFaces = function () {};
    try {
      await globalThis.initFaceBiometric();
      assert.ok(statusEl.textContent.includes("mock init error"));
    } finally {
      globalThis.FaceEngine = origEngine;
      globalThis.FaceRegistry = origRegistry;
      globalThis.listRegisteredFaces = origList;
    }
  });
});

// ── handleFaceFilePicked ──

describe("Face UI — handleFaceFilePicked", () => {
  beforeEach(resetGlobals);

  it("should do nothing when no file selected", async () => {
    globalThis.document = makeDoc();
    await globalThis.handleFaceFilePicked(); // should not throw
    assert.equal(globalThis._faceReport, null);
  });

  it("should report a load error", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "x.png" }] },
    });
    const origLoad = globalThis.loadImage;
    globalThis.loadImage = async function () {
      throw new Error("boom");
    };
    await globalThis.handleFaceFilePicked();
    assert.ok(statusEl.textContent.includes("Failed to load image: boom"));
    globalThis.loadImage = origLoad;
  });

  it("should stage the photo without running the pipeline", async () => {
    globalThis.faceEngine = makeEngine();
    const runBtn = { disabled: true };
    const camStart = { disabled: false };
    const camCap = { disabled: true };
    const fileEl = { files: [{ name: "my_photo.jpg" }], disabled: false };
    globalThis.document = makeDoc({
      "face-image": fileEl,
      "face-run": runBtn,
      "face-cam-start": camStart,
      "face-cam-capture": camCap,
      "face-label": { value: "Alice" },
    });
    await globalThis.handleFaceFilePicked();
    await flush();
    assert.equal(globalThis._faceReport, null, "pipeline must not run on pick");
    assert.ok(globalThis._facePendingCanvas, "pending canvas staged");
    assert.equal(globalThis._facePendingSource.source, "file");
    assert.equal(globalThis._facePendingSource.fileName, "my_photo.jpg");
    assert.equal(runBtn.disabled, false, "run button enabled with label filled");
    assert.equal(camStart.disabled, true, "camera start disabled while a photo is picked");
    assert.equal(camCap.disabled, true, "camera capture disabled while a photo is picked");
    assert.equal(fileEl.disabled, false, "file input stays enabled in file mode");
  });

  it("should keep the run button disabled until the label is filled", async () => {
    globalThis.faceEngine = makeEngine();
    const runBtn = { disabled: true };
    globalThis.document = makeDoc({
      "face-image": { files: [{ name: "p.png" }], disabled: false },
      "face-run": runBtn,
      "face-label": { value: "   " },
    });
    await globalThis.handleFaceFilePicked();
    await flush();
    assert.ok(globalThis._facePendingCanvas, "photo staged");
    assert.equal(runBtn.disabled, true, "whitespace label must keep the button disabled");
  });
});

// ── updateFaceRunState ──

describe("Face UI — updateFaceRunState", () => {
  beforeEach(resetGlobals);

  it("should do nothing when the run button is missing", () => {
    globalThis.document = makeDoc();
    globalThis.updateFaceRunState(); // should not throw
  });

  it("should keep the button disabled without a staged photo", () => {
    const runBtn = { disabled: true };
    globalThis.document = makeDoc({ "face-run": runBtn, "face-label": { value: "Alice" } });
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, true);
  });

  it("should keep the button disabled until the label is filled", () => {
    const runBtn = { disabled: true };
    globalThis._facePendingCanvas = createCanvas(200, 200);
    globalThis.document = makeDoc({ "face-run": runBtn, "face-label": { value: "" } });
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, true);
    globalThis.document = makeDoc({ "face-run": runBtn, "face-label": { value: "   " } });
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, true);
  });

  it("should enable the button when a photo is staged and the label is filled", () => {
    const runBtn = { disabled: true };
    globalThis._facePendingCanvas = createCanvas(200, 200);
    globalThis.document = makeDoc({ "face-run": runBtn, "face-label": { value: " Alice " } });
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, false);
  });
});

// ── handleFaceRun ──

describe("Face UI — handleFaceRun", () => {
  beforeEach(resetGlobals);

  it("should warn when no photo is staged", () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.handleFaceRun();
    assert.ok(statusEl.textContent.includes("No photo loaded"));
    assert.equal(globalThis._faceReport, null);
  });

  it("should run the pipeline with the staged file photo", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis._facePendingCanvas = createCanvas(200, 200);
    globalThis._facePendingSource = { source: "file", fileName: "staged.jpg", width: 200, height: 200 };
    globalThis.document = makeDoc();
    globalThis.handleFaceRun();
    await flush();
    assert.ok(globalThis._faceReport, "report should be generated");
    assert.equal(globalThis._faceReport.source, "file");
    assert.equal(globalThis._faceReport.photo.fileName, "staged.jpg");
    assert.equal(globalThis._faceReport.registry.registeredId, null, "no auto-register when label empty");
    assert.equal(globalThis.document.getElementById("face-actions").style.display, "flex");
  });

  it("should run the pipeline with the staged camera photo and liveness evidence", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis._facePendingCanvas = createCanvas(640, 640);
    globalThis._facePendingSource = {
      source: "camera",
      fileName: "camera_capture",
      width: 640,
      height: 640,
      liveness: { live: true, mode: "passive", reasons: [] },
    };
    globalThis.document = makeDoc({ "face-label": { value: "Cam" } });
    globalThis.handleFaceRun();
    await flush();
    const r = globalThis._faceReport;
    assert.ok(r, "report should be generated");
    assert.equal(r.source, "camera");
    assert.ok(r.liveness);
    assert.equal(r.liveness.live, true);
    assert.equal(r.liveness.mode, "passive");
  });
});

// ── runFacePipeline (core automated pipeline) ──

describe("Face UI — runFacePipeline", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    delete globalThis._lastDescriptor;
    delete globalThis._lastFaceCount;
    delete globalThis._lastSource;
  });

  it("should generate DID + signature + BioHash + Fuzzy + report", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.faceRegistry = new FaceRegistry();
    await globalThis.faceRegistry.open();
    globalThis.document = makeDoc();
    const canvas = createCanvas(200, 200);
    await globalThis.runFacePipeline(canvas, { source: "file", fileName: "alice.jpg", width: 200, height: 200 });

    const r = globalThis._faceReport;
    assert.ok(r, "report should exist");
    assert.equal(r.type, "redoSan.faceBiometricReport");
    assert.equal(r.source, "file");
    assert.equal(r.photo.fileName, "alice.jpg");
    assert.equal(r.photo.width, 200);
    assert.equal(r.photo.facesDetected, 1);
    assert.equal(r.photo.confidence, 0.95);
    assert.equal(r.photo.descriptorDim, 128);
    assert.ok(r.photo.descriptorHash.length > 0);

    assert.ok(r.did, "DID section");
    assert.ok(r.did.did.startsWith("did:key:"));
    assert.equal(r.did.algorithm, "Ed25519");
    assert.equal(r.did.signature, "AQID");
    assert.ok(r.did.signedAt);
    assert.ok(r.did.document && r.did.document.id);
    assert.ok(r.did.verifiableCredential && r.did.verifiableCredential.issuer);

    assert.ok(r.biohash, "BioHash section");
    assert.equal(r.biohash.bits, 128);
    assert.equal(r.biohash.codeHex.length, 32, "16 bytes => 32 hex chars");
    assert.equal(r.biohash.pinAuto, true, "auto PIN when field empty");
    assert.equal(r.autoPin.length, 8);

    assert.ok(r.fuzzy, "Fuzzy section");
    assert.equal(r.fuzzy.bits, 128);
    assert.ok(r.fuzzy.helperHex.length > 0);
    assert.ok(r.fuzzy.key);

    assert.equal(r.registry.match, null);
    assert.equal(r.registry.registeredId, null);
    assert.equal(r.liveness, null);

    assert.equal(globalThis._faceReport, r);
    assert.equal(globalThis.window._faceReport, r);
    assert.equal(downloadHandler, globalThis.downloadFaceReport, "download handler registered");
    assert.equal(globalThis.document.getElementById("face-actions").style.display, "flex");
    assert.equal(globalThis.document.getElementById("face-status").textContent, "Done. All identifiers generated.");
    assert.equal(globalThis.document.getElementById("face-steps").style.display, "none");
    assert.equal(globalThis._lastFaceCount, 1);
    assert.equal(globalThis._lastDescriptor, DESCRIPTOR);
  });

  it("should stop early when no face is detected", async () => {
    globalThis.faceEngine = makeEngine(new NoFaceHuman());
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "n.png" });
    assert.ok(statusEl.textContent.includes("No face detected"));
    assert.equal(globalThis._faceReport, null);
    assert.equal(globalThis._lastFaceCount, 0);
  });

  it("should report when the engine cannot be initialized", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    const origEngine = globalThis.FaceEngine;
    const origRegistry = globalThis.FaceRegistry;
    globalThis.FaceEngine = undefined;
    globalThis.FaceRegistry = undefined;
    await globalThis.runFacePipeline(createCanvas(200, 200), {});
    assert.equal(statusEl.textContent, "Face Engine not initialized.");
    assert.equal(globalThis.document.getElementById("face-steps").style.display, "none");
    globalThis.FaceEngine = origEngine;
    globalThis.FaceRegistry = origRegistry;
  });

  it("should initialize engine + registry from globals when missing", async () => {
    globalThis.faceEngine = null;
    globalThis.faceRegistry = null;
    const RealEngine = globalThis.FaceEngine;
    globalThis.FaceEngine = function () {
      const e = new RealEngine({ human: new MockHuman() });
      e._loaded = true;
      return e;
    };
    globalThis.document = makeDoc();
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "x.png" });
    assert.ok(globalThis.faceEngine, "engine initialized");
    assert.ok(globalThis.faceRegistry instanceof FaceRegistry, "registry initialized");
    assert.ok(globalThis._faceReport);
    globalThis.FaceEngine = RealEngine;
  });

  it("should auto-register when a label is provided", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.faceRegistry = new FaceRegistry();
    await globalThis.faceRegistry.open();
    globalThis.document = makeDoc({ "face-label": { value: "  Bob  " } });
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "b.png" });
    const r = globalThis._faceReport;
    assert.ok(r.registry.registeredId, "registeredId should be set");
    const faces = await globalThis.faceRegistry.getAllFaces();
    assert.equal(faces.length, 1);
    assert.equal(faces[0].label, "Bob");
  });

  it("should report a registry match with similarity", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.faceRegistry = new FaceRegistry();
    await globalThis.faceRegistry.open();
    await globalThis.faceRegistry.clear();
    await globalThis.faceRegistry.addFace("Alice", DESCRIPTOR);
    globalThis.document = makeDoc();
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "m.png" });
    const r = globalThis._faceReport;
    assert.ok(r.registry.match);
    assert.equal(r.registry.match.label, "Alice");
    assert.equal(r.registry.match.similarity, 100, "identical descriptor => 100%");
    await globalThis.faceRegistry.clear();
  });

  it("should continue without DID when the DID module is absent", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.document = makeDoc();
    const orig = globalThis.didGenerateKeypair;
    delete globalThis.didGenerateKeypair;
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "d.png" });
    const r = globalThis._faceReport;
    assert.equal(r.did, null);
    assert.ok(r.biohash, "BioHash still generated");
    assert.ok(r.fuzzy, "Fuzzy still generated");
    globalThis.didGenerateKeypair = orig;
  });

  it("should continue without BioHash/Fuzzy when modules are absent", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.document = makeDoc();
    const bio = globalThis.FaceBioHash;
    const fz = globalThis.FaceFuzzy;
    delete globalThis.FaceBioHash;
    delete globalThis.FaceFuzzy;
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "x.png" });
    const r = globalThis._faceReport;
    assert.ok(r.did, "DID still generated");
    assert.equal(r.biohash, null);
    assert.equal(r.fuzzy, null);
    assert.equal(r.registry.match, null);
    globalThis.FaceBioHash = bio;
    globalThis.FaceFuzzy = fz;
  });

  it("should surface pipeline errors in the status", async () => {
    globalThis.faceEngine = makeEngine();
    globalThis.faceEngine.detectFaces = async function () {
      throw new Error("detect crash");
    };
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "e.png" });
    assert.ok(statusEl.textContent.includes("Pipeline error: detect crash"));
    assert.equal(globalThis._faceReport, null);
  });
});

// ── embedder choice ──

describe("Face UI — embedder choice", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    globalThis._faceEmbedder = "human";
  });

  it("should default to human when no select and no stored choice", () => {
    globalThis.document = makeDoc();
    assert.equal(globalThis.getFaceEmbedderChoice(), "human");
  });

  it("should read the select element when present", () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    assert.equal(globalThis.getFaceEmbedderChoice(), "arcface");
  });

  it("should fall back to the stored choice when the select is absent", () => {
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    assert.equal(globalThis.getFaceEmbedderChoice(), "arcface");
  });

  it("should store the choice on change", () => {
    globalThis._faceEmbedder = "human";
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    globalThis.handleFaceEmbedderChange();
    assert.equal(globalThis._faceEmbedder, "arcface");
  });
});

// ── faceExtractEmbedding ──

describe("Face UI — faceExtractEmbedding", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    globalThis._faceEmbedder = "human";
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
  });

  const face = {
    box: { x: 0, y: 0, width: 10, height: 10 },
    descriptor: DESCRIPTOR,
    mesh: new Array(468),
  };

  function stubArcface(embedResult) {
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }]; },
      alignFace: function () { return { canvas: createCanvas(112, 112), matrix: [1, 0, 0, 0, 1, 0], scale: 1, angle: 0 }; },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return true; },
      load: async function () { return true; },
      embed: async function () { return embedResult; },
    };
  }

  it("should return the human descriptor by default", async () => {
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, DESCRIPTOR);
    assert.equal(r.version, "human-hse");
    assert.equal(r.error, undefined);
  });

  it("should return an arcface descriptor when chosen", async () => {
    const arcDesc = new Float32Array(512).fill(0.1);
    stubArcface(arcDesc);
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, arcDesc);
    assert.equal(r.version, "arcface-mbf");
    assert.equal(r.descriptor.length, 512);
  });

  it("should fall back to human when the arcface modules are missing", async () => {
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, DESCRIPTOR);
    assert.equal(r.version, "human-hse");
    assert.equal(r.error, "arcface-unavailable");
  });

  it("should fall back to human when the model fails to load", async () => {
    globalThis.FaceAlign = { meshToLandmarks5: function () { return []; }, alignFace: function () { return null; } };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return false; },
      load: async function () { return false; },
    };
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, DESCRIPTOR);
    assert.equal(r.version, "human-hse");
    assert.equal(r.error, "arcface-load-failed");
  });

  it("should fall back to human when alignment fails", async () => {
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return null; },
      alignFace: function () { return null; },
    };
    globalThis.FaceONNXEmbedder = { isReady: function () { return true; }, load: async function () { return true; } };
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, DESCRIPTOR);
    assert.equal(r.error, "arcface-align-failed");
  });

  it("should fall back to human when embedding throws", async () => {
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [{ x: 0, y: 0 }]; },
      alignFace: function () { return { canvas: createCanvas(112, 112) }; },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return true; },
      load: async function () { return true; },
      embed: async function () { throw new Error("onnx crashed"); },
    };
    globalThis._faceEmbedder = "arcface";
    globalThis.document = makeDoc();
    const r = await globalThis.faceExtractEmbedding(createCanvas(200, 200), face);
    assert.equal(r.descriptor, DESCRIPTOR);
    assert.equal(r.version, "human-hse");
    assert.equal(r.error, "arcface-embed-error");
  });
});

// ── runFacePipeline with arcface embedder ──

describe("Face UI — runFacePipeline arcface", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    globalThis._faceEmbedder = "human";
    globalThis._lastEmbeddingVersion = "human-hse";
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
    delete globalThis._lastDescriptor;
    delete globalThis._lastFaceCount;
    delete globalThis._lastSource;
  });

  it("should embed with arcface, report 512 dims and store the version", async () => {
    const arcDesc = new Float32Array(512).fill(0.25);
    globalThis.faceEngine = makeEngine(new MeshHuman());
    globalThis.faceRegistry = new FaceRegistry();
    await globalThis.faceRegistry.open();
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" }, "face-label": { value: "Arc" } });
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }]; },
      alignFace: function () { return { canvas: createCanvas(112, 112), matrix: [1, 0, 0, 0, 1, 0], scale: 1, angle: 0 }; },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return true; },
      load: async function () { return true; },
      embed: async function () { return arcDesc; },
    };
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "a.png" });

    const r = globalThis._faceReport;
    assert.ok(r, "report should exist");
    assert.equal(r.photo.embeddingVersion, "arcface-mbf");
    assert.equal(r.photo.descriptorDim, 512);
    assert.equal(globalThis._lastEmbeddingVersion, "arcface-mbf");

    const faces = await globalThis.faceRegistry.getAllFaces();
    assert.equal(faces.length, 1);
    assert.equal(faces[0].embeddingVersion, "arcface-mbf");
    assert.equal(faces[0].label, "Arc");
  });

  it("should match a same-version registry entry when filtered", async () => {
    const arcDesc = new Float32Array(512).fill(0.25);
    globalThis.faceEngine = makeEngine(new MeshHuman());
    globalThis.faceRegistry = new FaceRegistry();
    await globalThis.faceRegistry.open();
    await globalThis.faceRegistry.clear();
    await globalThis.faceRegistry.addFace("ArcAlice", arcDesc, { embeddingVersion: "arcface-mbf" });
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [{ x: 0, y: 0 }]; },
      alignFace: function () { return { canvas: createCanvas(112, 112) }; },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return true; },
      load: async function () { return true; },
      embed: async function () { return arcDesc; },
    };
    await globalThis.runFacePipeline(createCanvas(200, 200), { source: "file", fileName: "a2.png" });
    const r = globalThis._faceReport;
    assert.ok(r.registry.match);
    assert.equal(r.registry.match.label, "ArcAlice");
    assert.equal(r.registry.match.embeddingVersion, "arcface-mbf");
    await globalThis.faceRegistry.clear();
  });
});

// ── renderFaceReport ──

describe("Face UI — renderFaceReport", () => {
  beforeEach(resetGlobals);

  function sampleReport(overrides) {
    const r = {
      type: "redoSan.faceBiometricReport",
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      generator: "RedoSan Authenticity",
      source: "file",
      photo: {
        fileName: "alice.jpg",
        width: 200,
        height: 200,
        facesDetected: 1,
        confidence: 0.95,
        descriptorDim: 128,
        descriptorHash: "abcd1234",
      },
      did: {
        did: "did:key:zTest1234567890",
        algorithm: "Ed25519",
        signature: "AQID",
        signedAt: "2026-01-01T00:00:00.000Z",
        document: { id: "did:key:zTest1234567890" },
        verifiableCredential: { issuer: "did:key:zTest1234567890" },
      },
      biohash: {
        bits: 128,
        codeHex: "00".repeat(16),
        pinFingerprint: "fp1234",
        pinAuto: true,
      },
      autoPin: "Ab3Xy9Qz",
      fuzzy: { bits: 128, helperHex: "aabb", params: {}, key: "k1" },
      registry: { match: { label: "Alice", similarity: 100 }, registeredId: 7 },
      liveness: { live: true, mode: "passive", reasons: [] },
    };
    if (overrides) Object.assign(r, overrides);
    return r;
  }

  it("should render all sections for a complete report", () => {
    const el = { style: {}, innerHTML: "" };
    globalThis.document = makeDoc({ "face-report": el });
    globalThis.renderFaceReport(sampleReport());
    const html = el.innerHTML;
    assert.ok(html.includes("Biometric Report"));
    assert.ok(html.includes("alice.jpg"));
    assert.ok(html.includes("128 dims"));
    assert.ok(html.includes("DID Identity &amp; Signature") || html.includes("DID Identity & Signature"));
    assert.ok(html.includes("did:key:zTest1234567890"));
    assert.ok(html.includes("Auto-generated PIN"));
    assert.ok(html.includes("Ab3Xy9Qz"));
    assert.ok(html.includes("Match found"));
    assert.ok(html.includes("Alice"));
    assert.ok(html.includes("100.0%"));
    assert.ok(html.includes("Registered"));
    assert.ok(html.includes("ID 7"));
    assert.ok(html.includes("&#10003;"), "liveness passed checkmark");
    assert.equal(el.style.display, "block");
  });

  it("should set the download modal title", () => {
    const el = { style: {}, innerHTML: "" };
    globalThis.document = makeDoc({ "face-report": el });
    const mt = globalThis.document.querySelector("#dl-modal-title");
    globalThis.renderFaceReport(sampleReport());
    assert.equal(mt.textContent, "Download Face Report");
  });

  it("should render no-match and skip missing sections", () => {
    const el = { style: {}, innerHTML: "" };
    globalThis.document = makeDoc({ "face-report": el });
    globalThis.renderFaceReport(
      sampleReport({
        did: null,
        biohash: null,
        fuzzy: null,
        autoPin: null,
        registry: { match: null, registeredId: null },
        liveness: null,
      }),
    );
    const html = el.innerHTML;
    assert.ok(html.includes("Not found in the registry."));
    assert.ok(!html.includes("DID Identity"));
    assert.ok(!html.includes("Auto-generated PIN"));
    assert.ok(!html.includes("&#10003;"));
  });

  it("should render failed liveness", () => {
    const el = { style: {}, innerHTML: "" };
    globalThis.document = makeDoc({ "face-report": el });
    globalThis.renderFaceReport(sampleReport({ liveness: { live: false, mode: "active", reasons: ["blink"] } }));
    assert.ok(el.innerHTML.includes("&#10007;"));
  });

  it("should do nothing when the element is missing", () => {
    globalThis.document = { getElementById: function () { return null; }, querySelector: function () { return null; } };
    globalThis.renderFaceReport(sampleReport()); // should not throw
  });
});

// ── faceAttrText formatting ──

describe("Face UI — faceAttrText", () => {
  beforeEach(resetGlobals);

  it("should format emotion array with top score", () => {
    const txt = globalThis.faceAttrText([
      { emotion: "happy", score: 0.85 },
      { emotion: "neutral", score: 0.1 },
    ]);
    assert.equal(txt, "happy (85%)");
  });

  it("should format label arrays", () => {
    const txt = globalThis.faceAttrText([{ label: "alpha" }, { label: "beta" }]);
    assert.equal(txt, "alpha, beta");
  });

  it("should format emotion entries without score", () => {
    const txt = globalThis.faceAttrText([{ emotion: "sad" }, { emotion: "angry" }]);
    assert.equal(txt, "sad, angry");
  });

  it("should format objects and scalars", () => {
    assert.equal(globalThis.faceAttrText({ a: 1 }), '{"a":1}');
    assert.equal(globalThis.faceAttrText(28.5), "28.5");
    assert.equal(globalThis.faceAttrText(null), "");
  });
});

// ── downloadFaceReport + exporters ──

describe("Face UI — downloadFaceReport", () => {
  beforeEach(resetGlobals);

  function sampleReport(overrides) {
    const r = {
      type: "redoSan.faceBiometricReport",
      generatedAt: "2026-01-01T00:00:00.000Z",
      source: "file",
      photo: {
        fileName: "alice.jpg",
        width: 200,
        height: 200,
        facesDetected: 1,
        confidence: 0.95,
        descriptorDim: 128,
        descriptorHash: "abcd",
      },
      did: {
        did: "did:key:zTest1234567890",
        algorithm: "Ed25519",
        signature: "AQID",
        signedAt: "2026-01-01T00:00:00.000Z",
        document: null,
        verifiableCredential: null,
      },
      biohash: { bits: 128, codeHex: "00".repeat(16), pinFingerprint: "fp", pinAuto: false },
      autoPin: null,
      fuzzy: { bits: 128, helperHex: "aabb", params: {}, key: "k1" },
      registry: { match: { label: "Alice", similarity: 100 }, registeredId: null },
      liveness: null,
    };
    if (overrides) Object.assign(r, overrides);
    return r;
  }

  it("should close the modal and do nothing without a report", () => {
    globalThis.document = makeDoc();
    globalThis.downloadFaceReport("json");
    assert.equal(modalClosed, 1);
    assert.equal(downloads.length, 0);
  });

  it("should download JSON with the report content", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("json");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "alice.face_report.json");
    const text = await downloads[0].blob.text();
    assert.deepEqual(JSON.parse(text), sampleReport());
  });

  it("should download CSV with formula-injection protection", async () => {
    globalThis._faceReport = sampleReport({ photo: Object.assign(sampleReport().photo, { fileName: "=evil.png" }) });
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("csv");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "=evil.face_report.csv");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes('"Key","Value"'));
    assert.ok(text.includes("'=evil.png"), "leading '=' must be neutralized");
  });

  it("should download TXT with sections", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("txt");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes("-- DID Identity & Signature --"));
    assert.ok(text.includes("-- Privacy Identifier (BioHash) --"));
    assert.ok(text.includes("-- Fuzzy Identifier --"));
    assert.ok(text.includes("Match: Alice (100.0%)"));
  });

  it("should append the labels sheet to CSV downloads", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [
          {
            id: 1,
            label: "Alice",
            created: new Date("2026-01-02T03:04:05Z"),
            descriptor: DESCRIPTOR,
            embeddingVersion: "human-hse",
          },
        ];
      },
    };
    await globalThis.downloadFaceReport("csv");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes("[Face Labels]"));
    assert.ok(text.includes("label,id,created,descriptorHash,embeddingVersion"));
    assert.match(text, /Alice,1,2026-01-02T03:04:05\.000Z,[0-9a-f]{64},human-hse/);
  });

  it("should append the labels sheet to TXT downloads without hashes for locked entries", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [
          {
            id: 2,
            label: "locked",
            created: new Date("2026-03-04T05:06:07Z"),
            encrypted: { alg: "AES-GCM" },
            embeddingVersion: "human-hse",
          },
        ];
      },
    };
    await globalThis.downloadFaceReport("txt");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes("[Face Labels]"));
    assert.ok(text.includes("locked\t2\t2026-03-04T05:06:07.000Z\t\thuman-hse"));
  });

  it("should not append a labels header when the registry is empty", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [];
      },
    };
    await globalThis.downloadFaceReport("txt");
    const text = await downloads[0].blob.text();
    assert.ok(!text.includes("[Face Labels]"));
  });

  it("should download XML with escaped values", async () => {
    globalThis._faceReport = sampleReport({ photo: Object.assign(sampleReport().photo, { fileName: "a<b&c.png" }) });
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("xml");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes("<faceBiometricReport>"));
    assert.ok(text.includes("<fileName>a&lt;b&amp;c.png</fileName>"));
  });

  it("should download an HTML table document", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("html");
    const text = await downloads[0].blob.text();
    assert.ok(text.includes("<table"));
    assert.ok(text.includes("Alice"));
  });

  it("should download PDF via jsPDF", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.ensureLib = async function (name) {
      assert.equal(name, "jspdf");
      globalThis.jspdf = {
        jsPDF: function () {
          return {
            text: function () {},
            setFontSize: function () {},
            setTextColor: function () {},
            addPage: function () {},
            output: function () {
              return new Blob(["pdf-data"], { type: "application/pdf" });
            },
          };
        },
      };
    };
    await globalThis.downloadFaceReport("pdf");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "alice.face_report.pdf");
    assert.equal(downloads[0].blob.type, "application/pdf");
  });

  it("should download DOCX via the docx library", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.ensureLib = async function (name) {
      assert.equal(name, "docx");
      globalThis.docx = {
        Document: function (c) { return c; },
        Paragraph: function (c) { return c; },
        TextRun: function (c) { return c; },
        Table: function (c) { return c; },
        TableRow: function (c) { return c; },
        TableCell: function (c) { return c; },
        WidthType: { PERCENTAGE: "pct" },
        Packer: {
          toBlob: async function () {
            return new Blob(["docx-data"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          },
        },
      };
    };
    await globalThis.downloadFaceReport("doc");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "alice.face_report.docx");
  });

  it("should ignore unknown formats", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    await globalThis.downloadFaceReport("xlsx");
    assert.equal(downloads.length, 0);
  });

  it("should reject when the PDF library fails to load", async () => {
    globalThis._faceReport = sampleReport();
    globalThis.document = makeDoc();
    globalThis.ensureLib = async function () {
      throw new Error("lib fail");
    };
    await assert.rejects(function () {
      return globalThis.downloadFaceReport("pdf");
    }, /lib fail/);
  });

  it("faceReportToPDF should return a Blob", async () => {
    globalThis.ensureLib = async function () {};
    globalThis.jspdf = {
      jsPDF: function () {
        return {
          text: function () {},
          setFontSize: function () {},
          setTextColor: function () {},
          addPage: function () {},
          output: function () {
            return new Blob(["pdf"], { type: "application/pdf" });
          },
        };
      },
    };
    const b = await globalThis.faceReportToPDF(sampleReport());
    assert.ok(b instanceof Blob);
    assert.equal(b.type, "application/pdf");
  });

  it("faceReportToDOCX should return a Blob and drop null children", async () => {
    globalThis.ensureLib = async function () {};
    globalThis.docx = {
      Document: function (c) { return c; },
      Paragraph: function (c) { return c; },
      TextRun: function (c) { return c; },
      Table: function (c) { return c; },
      TableRow: function (c) { return c; },
      TableCell: function (c) { return c; },
      WidthType: { PERCENTAGE: "pct" },
      Packer: {
        toBlob: async function () {
          return new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        },
      },
    };
    const r = sampleReport({ did: null, biohash: null, fuzzy: null });
    const b = await globalThis.faceReportToDOCX(r);
    assert.ok(b instanceof Blob);
  });
});

// ── Camera start/stop ──

describe("Face UI — handleFaceCameraStart/Stop", () => {
  beforeEach(resetGlobals);

  it("should warn when the camera module is missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    const orig = globalThis.FaceCamera;
    delete globalThis.FaceCamera;
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(statusEl.textContent, "Face Camera module not loaded.");
    globalThis.FaceCamera = orig;
  });

  it("should warn when the video element is missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-camera": undefined });
    const orig = globalThis.FaceCamera;
    globalThis.FaceCamera = function () {
      return { startCamera: async function () {} };
    };
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(statusEl.textContent, "Camera element not found.");
    globalThis.FaceCamera = orig;
  });

  it("should start the camera and show the video", async () => {
    const statusEl = { textContent: "" };
    const videoEl = { style: {} };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-camera": videoEl });
    globalThis.FaceCamera = function () {
      return { startCamera: async function () { return true; }, stopCamera: function () {} };
    };
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(statusEl.textContent, "Camera started. Capture a photo, then press Generate Identifiers.");
    assert.equal(videoEl.style.display, "block");
    assert.ok(globalThis.faceCamera, "camera instance cached");
  });

  it("should surface camera errors", async () => {
    const statusEl = { textContent: "" };
    const videoEl = { style: {} };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-camera": videoEl });
    globalThis.FaceCamera = function () {
      return {
        startCamera: async function () {
          throw new Error("denied");
        },
      };
    };
    globalThis.FaceCamera.getCameraErrorMessage = function () {
      return "cam boom";
    };
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(statusEl.textContent, "cam boom");
  });

  it("should stop the camera and hide the video", () => {
    const statusEl = { textContent: "" };
    const videoEl = { style: {} };
    let stopped = false;
    globalThis.faceCamera = { stopCamera: function () { stopped = true; } };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-camera": videoEl });
    globalThis.handleFaceCameraStop("face-camera");
    assert.ok(stopped);
    assert.equal(videoEl.style.display, "none");
    assert.equal(statusEl.textContent, "Camera stopped.");
  });
});

// ── Liveness ──

describe("Face UI — runFaceLivenessCheck", () => {
  beforeEach(resetGlobals);

  it("should skip when mode is off", async () => {
    globalThis.document = makeDoc({ "face-liveness-mode": { value: "off" } });
    const result = await globalThis.runFaceLivenessCheck();
    assert.equal(result, null);
    assert.equal(globalThis._faceLivenessEvidence, null);
  });

  it("should warn when the camera is not active", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = { isActive: function () { return false; } };
    const result = await globalThis.runFaceLivenessCheck();
    assert.equal(result, null);
    assert.ok(statusEl.textContent.includes("Camera not running"));
  });

  it("should warn when the liveness module is missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = { isActive: function () { return true; } };
    const orig = globalThis.FaceLiveness;
    delete globalThis.FaceLiveness;
    const result = await globalThis.runFaceLivenessCheck();
    assert.equal(result, null);
    assert.ok(statusEl.textContent.includes("Face Liveness module not loaded."));
    globalThis.FaceLiveness = orig;
  });

  it("should store and return evidence on success", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function () {
          return { live: true, reasons: [] };
        },
      };
    };
    const result = await globalThis.runFaceLivenessCheck();
    assert.deepEqual(result, { live: true, reasons: [] });
    assert.deepEqual(globalThis._faceLivenessEvidence, { live: true, reasons: [] });
  });

  it("should request both modes for active mode", async () => {
    let receivedMode = null;
    globalThis.document = makeDoc({ "face-liveness-mode": { value: "active" } });
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function (cam, engine, opts) {
          receivedMode = opts.mode;
          return { live: true, reasons: [] };
        },
      };
    };
    await globalThis.runFaceLivenessCheck();
    assert.equal(receivedMode, "both");
  });

  it("should handle liveness errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function () {
          throw new Error("mesh fail");
        },
      };
    };
    const result = await globalThis.runFaceLivenessCheck();
    assert.equal(result, null);
    assert.ok(statusEl.textContent.includes("Liveness error: mesh fail"));
  });
});

describe("Face UI — renderFaceChallenge / faceChallengeText", () => {
  beforeEach(resetGlobals);

  it("should show the localized challenge with progress", () => {
    const el = { textContent: "", style: {} };
    globalThis.document = makeDoc({ "face-challenge": el });
    globalThis.renderFaceChallenge({ type: "blink", index: 0, total: 2, done: false });
    assert.equal(el.textContent, "Challenge: Blink your eyes (1/2)");
    assert.equal(el.style.display, "block");
  });

  it("should hide the box for done/null challenges", () => {
    const el = { textContent: "x", style: {} };
    globalThis.document = makeDoc({ "face-challenge": el });
    globalThis.renderFaceChallenge({ type: "smile", index: 1, total: 2, done: true });
    assert.equal(el.textContent, "");
    assert.equal(el.style.display, "none");
    globalThis.renderFaceChallenge(null);
    assert.equal(el.style.display, "none");
  });

  it("should do nothing when element missing", () => {
    globalThis.document = makeDoc({ "face-challenge": undefined });
    globalThis.renderFaceChallenge({ type: "blink", index: 0, total: 1, done: false }); // should not throw
  });

  it("faceChallengeText maps known types and passes unknown through", () => {
    assert.equal(globalThis.faceChallengeText("blink"), "Blink your eyes");
    assert.equal(globalThis.faceChallengeText("turn-left"), "Turn your head to the left");
    assert.equal(globalThis.faceChallengeText("weird"), "weird");
  });
});

// ── handleFaceCameraCapture (stage frame + liveness gate) ──

function makeCamera(overrides) {
  const cam = {
    active: true,
    isActive: function () {
      return this.active;
    },
    stopCamera: function () {
      this.active = false;
    },
    captureFrame: function (size) {
      return createCanvas(size, size);
    },
  };
  if (overrides) Object.assign(cam, overrides);
  return cam;
}

describe("Face UI — handleFaceCameraCapture", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    delete globalThis._lastDescriptor;
    delete globalThis._lastFaceCount;
  });

  it("should warn when the camera is not running", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceCamera = makeCamera({ active: false });
    await globalThis.handleFaceCameraCapture();
    assert.ok(statusEl.textContent.includes("Camera not running"));
    assert.equal(globalThis._faceReport, null);
  });

  it("should abort when liveness fails", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = makeCamera();
    globalThis.faceEngine = makeEngine();
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function () {
          return { live: false, reasons: ["blink", "smile"] };
        },
      };
    };
    await globalThis.handleFaceCameraCapture();
    assert.ok(statusEl.textContent.includes("Liveness check failed: blink, smile"));
    assert.equal(globalThis._faceReport, null);
  });

  it("should warn when no frame can be captured", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
    });
    globalThis.faceCamera = makeCamera({ captureFrame: function () { return null; } });
    globalThis.faceEngine = makeEngine();
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function () {
          return { live: true, reasons: [] };
        },
      };
    };
    await globalThis.handleFaceCameraCapture();
    assert.ok(statusEl.textContent.includes("Could not capture a frame."));
    assert.equal(globalThis._faceReport, null);
  });

  it("should stage the frame with liveness evidence without running the pipeline", async () => {
    const statusEl = { textContent: "" };
    const runBtn = { disabled: true };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "passive" },
      "face-run": runBtn,
      "face-label": { value: "Cam" },
    });
    globalThis.faceCamera = makeCamera();
    globalThis.faceEngine = makeEngine();
    globalThis.FaceLiveness = function () {
      return {
        verifyLiveness: async function () {
          return { live: true, reasons: [] };
        },
      };
    };
    await globalThis.handleFaceCameraCapture();
    await flush();
    assert.equal(globalThis._faceReport, null, "pipeline must not run on capture");
    assert.ok(globalThis._facePendingCanvas, "frame staged");
    assert.equal(globalThis._facePendingSource.source, "camera");
    assert.equal(globalThis._facePendingSource.fileName, "camera_capture");
    assert.deepEqual(globalThis._facePendingSource.liveness, {
      live: true,
      mode: "passive",
      reasons: [],
    });
    assert.equal(runBtn.disabled, false, "run button enabled with label filled");
  });

  it("should initialize engine from globals when missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-liveness-mode": { value: "off" },
    });
    globalThis.faceCamera = makeCamera();
    globalThis.faceEngine = null;
    globalThis.faceRegistry = null;
    const RealEngine = globalThis.FaceEngine;
    globalThis.FaceEngine = function () {
      const e = new RealEngine({ human: new MockHuman() });
      e._loaded = true;
      return e;
    };
    await globalThis.handleFaceCameraCapture();
    await flush();
    assert.ok(globalThis.faceEngine, "engine initialized");
    assert.ok(globalThis._facePendingCanvas, "frame staged");
    assert.equal(globalThis._facePendingSource.source, "camera");
    globalThis.FaceEngine = RealEngine;
  });
});

// ── Camera buttons (mutual exclusion with photo input) ──

describe("Face UI — camera/file mutual exclusion", () => {
  beforeEach(resetGlobals);

  it("should disable the file input and manage buttons when the camera starts", async () => {
    const statusEl = { textContent: "" };
    const fileEl = { files: [], disabled: false };
    const startBtn = { disabled: false };
    const stopBtn = { disabled: true };
    const capBtn = { disabled: true };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": fileEl,
      "face-cam-start": startBtn,
      "face-cam-stop": stopBtn,
      "face-cam-capture": capBtn,
    });
    globalThis.FaceCamera = function () {
      return {
        startCamera: async function () {},
        stopCamera: function () {},
        isActive: function () {
          return true;
        },
      };
    };
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(fileEl.disabled, true, "file upload disabled while camera is active");
    assert.equal(startBtn.disabled, true);
    assert.equal(stopBtn.disabled, false);
    assert.equal(capBtn.disabled, false);
    assert.ok(statusEl.textContent.includes("Camera started"));
  });

  it("should re-enable the file input and disable capture when the camera stops", async () => {
    const fileEl = { files: [], disabled: true };
    const startBtn = { disabled: true };
    const stopBtn = { disabled: false };
    const capBtn = { disabled: false };
    globalThis.document = makeDoc({
      "face-image": fileEl,
      "face-cam-start": startBtn,
      "face-cam-stop": stopBtn,
      "face-cam-capture": capBtn,
    });
    globalThis.handleFaceCameraStop("face-camera");
    assert.equal(fileEl.disabled, false, "file upload re-enabled after camera stops");
    assert.equal(startBtn.disabled, false);
    assert.equal(stopBtn.disabled, true);
    assert.equal(capBtn.disabled, true);
  });

  it("should stop the camera and disable its buttons when a file is picked", async () => {
    const fileEl = { files: [{ name: "pick.jpg" }], disabled: false };
    const startBtn = { disabled: false };
    const capBtn = { disabled: false };
    const cam = makeCamera({ active: true });
    globalThis.document = makeDoc({
      "face-image": fileEl,
      "face-cam-start": startBtn,
      "face-cam-capture": capBtn,
      "face-label": { value: "X" },
    });
    globalThis.faceCamera = cam;
    globalThis.faceEngine = makeEngine();
    await globalThis.handleFaceFilePicked();
    await flush();
    assert.equal(cam.active, false, "camera stopped when a photo is picked");
    assert.equal(startBtn.disabled, true, "camera start disabled in file mode");
    assert.equal(capBtn.disabled, true, "camera capture disabled in file mode");
    assert.ok(globalThis._facePendingCanvas, "photo staged");
  });
});

// ── Input tabs (Upload Photo / Capture with Camera) ──

describe("Face UI — switchFaceInput", () => {
  beforeEach(resetGlobals);

  it("should show the upload wrapper by default", () => {
    const wrapU = { style: {} };
    const wrapC = { style: { display: "none" } };
    globalThis.document = makeDoc({
      "face-upload-wrapper": wrapU,
      "face-capture-wrapper": wrapC,
    });
    assert.equal(wrapU.style.display, undefined);
    assert.equal(wrapC.style.display, "none");
    assert.equal(globalThis._faceInputTab, "upload");
  });

  it("should switch to the camera tab and highlight its button", () => {
    const wrapU = { style: {} };
    const wrapC = { style: { display: "none" } };
    const startBtn = { disabled: false };
    const fileEl = { files: [], disabled: true };
    globalThis.document = makeDoc({
      "face-upload-wrapper": wrapU,
      "face-capture-wrapper": wrapC,
      "face-cam-start": startBtn,
      "face-image": fileEl,
    });
    globalThis.switchFaceInput("camera");
    assert.equal(wrapU.style.display, "none");
    assert.equal(wrapC.style.display, "block");
    assert.equal(globalThis._faceInputTab, "camera");
    const btns = globalThis.document.querySelectorAll("[data-face-tab]");
    assert.equal(btns[0].classList.contains("is-active"), false);
    assert.equal(btns[1].classList.contains("is-active"), true);
  });

  it("should re-enable the camera start button and file input on camera tab", () => {
    const startBtn = { disabled: true };
    const fileEl = { files: [], disabled: true };
    globalThis.document = makeDoc({
      "face-cam-start": startBtn,
      "face-image": fileEl,
    });
    globalThis.switchFaceInput("camera");
    assert.equal(startBtn.disabled, false);
    assert.equal(fileEl.disabled, false);
  });

  it("should discard the staged photo when switching to the camera tab", () => {
    const runBtn = { disabled: false };
    const labelEl = { value: "X" };
    const preview = createCanvas(200, 200);
    globalThis.document = makeDoc({
      "face-run": runBtn,
      "face-label": labelEl,
      "face-preview": preview,
    });
    globalThis._facePendingCanvas = createCanvas(200, 200);
    globalThis._facePendingSource = { source: "file", fileName: "a.jpg" };
    globalThis.switchFaceInput("camera");
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._facePendingSource, null);
    assert.equal(runBtn.disabled, true, "run disabled after staging is discarded");
  });

  it("should stop the camera and discard the frame when switching to upload", async () => {
    const cam = makeCamera({ active: true });
    const fileEl = { files: [], disabled: true };
    globalThis.document = makeDoc({ "face-image": fileEl });
    globalThis.faceCamera = cam;
    globalThis._faceInputTab = "camera";
    globalThis._facePendingCanvas = createCanvas(200, 200);
    globalThis._facePendingSource = { source: "camera", fileName: "camera_capture" };
    globalThis.switchFaceInput("upload");
    await flush();
    assert.equal(cam.active, false, "camera stopped on upload tab");
    assert.equal(fileEl.disabled, false, "file input re-enabled");
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._faceInputTab, "upload");
  });

  it("should ignore unknown tabs and repeated tabs", () => {
    const wrapU = { style: {} };
    const wrapC = { style: { display: "none" } };
    globalThis.document = makeDoc({
      "face-upload-wrapper": wrapU,
      "face-capture-wrapper": wrapC,
    });
    globalThis.switchFaceInput("bogus");
    assert.equal(globalThis._faceInputTab, "upload");
    globalThis._faceInputTab = "camera";
    globalThis.switchFaceInput("camera");
    assert.equal(globalThis._faceInputTab, "camera");
    assert.equal(wrapC.style.display, "none");
    assert.equal(wrapU.style.display, undefined);
  });
});

// ── Registry management UI ──

describe("Face UI — listRegisteredFaces", () => {
  beforeEach(resetGlobals);

  it("should warn if registry not initialized", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.listRegisteredFaces();
    assert.equal(statusEl.textContent, "Face Registry not initialized.");
  });

  it("should show empty message when no faces", async () => {
    const listEl = { innerHTML: "", append: function () {} };
    const countEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-list": listEl, "face-count": countEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () { return []; },
      getSize: async function () { return 0; },
    };
    await globalThis.listRegisteredFaces();
    assert.equal(countEl.textContent, "Registered faces: 0");
    assert.ok(listEl.innerHTML.includes("No faces registered"));
  });

  it("should render faces with delete buttons", async () => {
    const children = [];
    const listEl = { innerHTML: "", append: function (el) { children.push(el); } };
    const countEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-list": listEl, "face-count": countEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [
          { id: 1, label: "Alice" },
          { id: 2, label: "Bob" },
        ];
      },
      getSize: async function () { return 2; },
    };
    await globalThis.listRegisteredFaces();
    assert.equal(countEl.textContent, "Registered faces: 2");
    assert.equal(children.length, 2);
    assert.ok(children[0].innerHTML.includes("Alice"));
    assert.ok(children[1].innerHTML.includes("onclick="));
  });

  it("should show migration banner when embedding versions are mixed", async () => {
    const children = [];
    const listEl = { innerHTML: "", append: function (el) { children.push(el); } };
    const countEl = { textContent: "" };
    const noteEl = { style: { display: "" } };
    globalThis.document = makeDoc({ "face-list": listEl, "face-count": countEl, "face-migration-note": noteEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [
          { id: 1, label: "Old", embeddingVersion: "human-hse" },
          { id: 2, label: "New", embeddingVersion: "arcface-mbf" },
        ];
      },
      getSize: async function () { return 2; },
    };
    await globalThis.listRegisteredFaces();
    assert.equal(noteEl.style.display, "block");
  });

  it("should hide migration banner for a single embedding version", async () => {
    const children = [];
    const listEl = { innerHTML: "", append: function (el) { children.push(el); } };
    const countEl = { textContent: "" };
    const noteEl = { style: { display: "" } };
    globalThis.document = makeDoc({ "face-list": listEl, "face-count": countEl, "face-migration-note": noteEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [{ id: 1, label: "Only", embeddingVersion: "arcface-mbf" }];
      },
      getSize: async function () { return 1; },
    };
    await globalThis.listRegisteredFaces();
    assert.equal(noteEl.style.display, "none");
  });

  it("should handle list errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () { throw new Error("list error"); },
    };
    await globalThis.listRegisteredFaces();
    assert.ok(statusEl.textContent.includes("list error"));
  });
});

describe("Face UI — handleFaceDelete", () => {
  beforeEach(resetGlobals);

  it("should delete and refresh the list", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    let deletedId = null;
    globalThis.faceRegistry = {
      deleteFace: async function (id) {
        deletedId = id;
        return true;
      },
      getAllFaces: async function () {
        return [];
      },
      getSize: async function () {
        return 0;
      },
    };
    await globalThis.handleFaceDelete(42);
    assert.equal(deletedId, 42);
    assert.ok(statusEl.textContent.includes("deleted"));
  });

  it("should handle delete errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = {
      deleteFace: async function () { throw new Error("delete error"); },
    };
    await globalThis.handleFaceDelete(1);
    assert.ok(statusEl.textContent.includes("Delete error"));
  });
});

describe("Face UI — handleFaceClear", () => {
  beforeEach(resetGlobals);

  it("should clear all faces when confirmed", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    let cleared = false;
    globalThis.faceRegistry = { clear: async function () { cleared = true; } };
    globalThis.confirm = function () { return true; };
    await globalThis.handleFaceClear();
    assert.ok(cleared);
    assert.ok(statusEl.textContent.includes("All faces deleted"));
  });

  it("should not clear when cancelled", async () => {
    globalThis.document = makeDoc();
    let cleared = false;
    globalThis.faceRegistry = { clear: async function () { cleared = true; } };
    globalThis.confirm = function () { return false; };
    await globalThis.handleFaceClear();
    assert.equal(cleared, false);
  });

  it("should handle clear errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = { clear: async function () { throw new Error("clear error"); } };
    globalThis.confirm = function () { return true; };
    await globalThis.handleFaceClear();
    assert.ok(statusEl.textContent.includes("Clear error"));
  });
});

// ── Clipboard ──

describe("Face UI — handleFaceBioHashCopy", () => {
  beforeEach(resetGlobals);

  afterEach(() => {
    if (Object.prototype.hasOwnProperty.call(globalThis, "navigator")) {
      delete globalThis.navigator;
    }
  });

  it("should warn when no Privacy ID exists", () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis._faceReport = null;
    globalThis.handleFaceBioHashCopy();
    assert.ok(statusEl.textContent.includes("Generate a Privacy ID first"));
  });

  it("should copy the code via clipboard", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis._faceReport = { biohash: { codeHex: "00".repeat(16) } };
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: async function () { return true; } } },
      configurable: true,
    });
    globalThis.handleFaceBioHashCopy();
    await flush();
    assert.ok(statusEl.textContent.includes("copied to clipboard"));
  });

  it("should report clipboard failures", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis._faceReport = { biohash: { codeHex: "00".repeat(16) } };
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: async function () {
            throw new Error("denied");
          },
        },
      },
      configurable: true,
    });
    globalThis.handleFaceBioHashCopy();
    await flush();
    assert.ok(statusEl.textContent.includes("Copy failed"));
  });

  it("should fall back when clipboard is unavailable", () => {
    const statusEl = { textContent: "" };
    const reportEl = { select: function () {} };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-report": reportEl });
    globalThis._faceReport = { biohash: { codeHex: "00".repeat(16) } };
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    globalThis.handleFaceBioHashCopy();
    assert.ok(statusEl.textContent.includes("ready to copy"));
  });
});

// ── handleFaceExportLabels ──

describe("Face UI — handleFaceExportLabels", () => {
  beforeEach(resetGlobals);

  function makeRegistry(faces) {
    return {
      getAllFaces: async function () {
        return faces;
      },
    };
  }

  it("should warn when the registry is missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.handleFaceExportLabels("txt");
    assert.ok(statusEl.textContent.includes("not initialized"));
  });

  it("should warn when the registry is empty", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = makeRegistry([]);
    await globalThis.handleFaceExportLabels("txt");
    assert.ok(statusEl.textContent.includes("nothing to export"));
    assert.equal(downloads.length, 0);
  });

  it("should export a CSV with hashes and escaped cells", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = makeRegistry([
      {
        id: 1,
        label: "Ali, the artist",
        created: new Date("2026-01-02T03:04:05Z"),
        descriptor: DESCRIPTOR,
        embeddingVersion: "human-hse",
      },
      {
        id: 2,
        label: 'Say "hi"',
        created: null,
        descriptor: null,
        embeddingVersion: "arcface-v2",
      },
    ]);
    await globalThis.handleFaceExportLabels("csv");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "face_labels.csv");
    const text = await downloads[0].blob.text();
    const lines = text.split("\n");
    assert.equal(lines[0], "label,id,created,descriptorHash,embeddingVersion");
    assert.match(lines[1], /^"Ali, the artist",1,2026-01-02T03:04:05\.000Z,[0-9a-f]{64},human-hse$/);
    assert.match(lines[2], /^"Say ""hi""",2,,,arcface-v2$/);
    assert.ok(statusEl.textContent.includes("Exported 2 face label(s)"));
  });

  it("should export a TXT sheet without hashes for locked entries", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = makeRegistry([
      {
        id: 7,
        label: "locked face",
        created: new Date("2026-05-06T07:08:09Z"),
        encrypted: { alg: "AES-GCM" },
        embeddingVersion: "human-hse",
      },
    ]);
    await globalThis.handleFaceExportLabels("txt");
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, "face_labels.txt");
    const text = await downloads[0].blob.text();
    const lines = text.split("\n");
    assert.equal(lines[0], "label\tid\tcreated\tdescriptorHash\tembeddingVersion");
    assert.equal(lines[1], "locked face\t7\t2026-05-06T07:08:09.000Z\t\thuman-hse");
  });
});

// ── maybePromptFaceEncryption ──

describe("Face UI — maybePromptFaceEncryption", () => {
  beforeEach(resetGlobals);

  it("should stay silent when every entry is encrypted", async () => {
    const statusEl = { textContent: "" };
    const passEl = { value: "", focus: function () {}, classList: makeClassList() };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": passEl,
    });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [{ id: 1, label: "x", encrypted: { alg: "AES-GCM" } }];
      },
    };
    await globalThis.maybePromptFaceEncryption();
    assert.equal(statusEl.textContent, "");
    assert.equal(passEl.classList.contains("is-attention"), false);
  });

  it("should prompt and focus the passphrase field for plaintext entries", async () => {
    const statusEl = { textContent: "" };
    const passEl = { value: "", focusCalls: 0, focus: function () { this.focusCalls++; }, classList: makeClassList() };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": passEl,
    });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [{ id: 1, label: "x", descriptor: DESCRIPTOR }];
      },
    };
    await globalThis.maybePromptFaceEncryption();
    assert.ok(statusEl.textContent.includes("unencrypted"));
    assert.equal(passEl.focusCalls, 1);
    assert.equal(passEl.classList.contains("is-attention"), true);
  });

  it("should survive registry errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        throw new Error("idb boom");
      },
    };
    await globalThis.maybePromptFaceEncryption(); // should not throw
    assert.equal(statusEl.textContent, "");
  });
});

// ── Live detection overlay ──

describe("Face UI — face overlay", () => {
  beforeEach(resetGlobals);

  it("should not throw when the camera starts with a minimal DOM", async () => {
    const statusEl = { textContent: "" };
    const videoEl = { style: {} };
    globalThis.document = makeDoc({ "face-status": statusEl, "face-camera": videoEl });
    globalThis.FaceCamera = function () {
      return { startCamera: async function () { return true; }, stopCamera: function () {} };
    };
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(statusEl.textContent, "Camera started. Capture a photo, then press Generate Identifiers.");
    assert.equal(videoEl.style.display, "block");
    globalThis.stopFaceOverlay();
  });

  it("should stop and clean up the overlay", () => {
    const parent = { style: {}, removeChild: function () { this.removed = true; } };
    globalThis._faceOverlay = { parentNode: parent, getContext: function () {} };
    globalThis._faceOverlayRunning = true;
    globalThis._faceOverlayRAF = 123;
    globalThis.stopFaceOverlay();
    assert.equal(globalThis._faceOverlay, null);
    assert.equal(globalThis._faceOverlayRunning, false);
    assert.equal(parent.removed, true);
  });

  it("should draw boxes and mesh points when the engine is ready", async () => {
    const { createCanvas } = require("canvas");
    const overlay = createCanvas(320, 240);
    overlay.getContext("2d");
    const frame = createCanvas(640, 480);
    let detected = false;
    globalThis._faceOverlay = overlay;
    globalThis._faceOverlayRunning = true;
    globalThis.faceCamera = {
      isActive: function () { return true; },
      captureFrame: function () { return frame; },
    };
    globalThis.faceEngine = {
      _loaded: true,
      detectFaces: async function () {
        detected = true;
        const mesh = new Float32Array(468 * 3);
        mesh[0] = 120;
        mesh[1] = 90;
        return [{ box: { x: 100, y: 80, width: 200, height: 250 }, score: 0.9, mesh: mesh }];
      },
    };
    await globalThis.faceOverlayDetectAndDraw();
    assert.equal(detected, true);
  });

  it("should draw nothing when the camera is inactive", async () => {
    const { createCanvas } = require("canvas");
    globalThis._faceOverlay = createCanvas(320, 240);
    globalThis._faceOverlayRunning = true;
    globalThis.faceCamera = {
      isActive: function () { return false; },
    };
    await globalThis.faceOverlayDetectAndDraw(); // should not throw
  });
});

// ── Passkey handlers (WebAuthn second factor) ──

describe("Face UI — passkey handlers", () => {
  beforeEach(resetGlobals);

  function makePasskeyDoc() {
    const statusEl = { textContent: "" };
    const passkeyStatus = { textContent: "" };
    const regBtn = { disabled: false };
    const remBtn = { style: {} };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-passkey-status": passkeyStatus,
      "face-passkey-register-btn": regBtn,
      "face-passkey-remove-btn": remBtn,
    });
    return { statusEl, passkeyStatus, regBtn, remBtn };
  }

  function makePasskeyRegistry(meta) {
    const calls = { set: [], removed: [] };
    const registry = {
      setMeta: async function (key, value) {
        calls.set.push({ key, value });
        meta[key] = value;
      },
      getMeta: async function (key) {
        return Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : null;
      },
      removeMeta: async function (key) {
        calls.removed.push(key);
        delete meta[key];
      },
    };
    registry.calls = calls;
    return registry;
  }

  it("should warn when the WebAuthn module is missing", async () => {
    const { statusEl } = makePasskeyDoc();
    globalThis.faceRegistry = makePasskeyRegistry({});
    await globalThis.handlePasskeyRegister();
    assert.ok(statusEl.textContent.includes("module not loaded"));
  });

  it("should warn when WebAuthn is unavailable", async () => {
    const { statusEl } = makePasskeyDoc();
    globalThis.faceRegistry = makePasskeyRegistry({});
    globalThis.FaceWebauthn = { isAvailable: function () { return false; } };
    await globalThis.handlePasskeyRegister();
    assert.ok(statusEl.textContent.includes("not available"));
  });

  it("should register a passkey and store its reference", async () => {
    const { statusEl, passkeyStatus, regBtn } = makePasskeyDoc();
    const meta = {};
    globalThis.faceRegistry = makePasskeyRegistry(meta);
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      register: async function () {
        return { id: "ABCD1234abcd1234EFGH", rawId: "QUJD" };
      },
    };
    await globalThis.handlePasskeyRegister();
    assert.ok(statusEl.textContent.includes("Passkey saved"));
    assert.equal(meta.passkey.credentialId, "ABCD1234abcd1234EFGH");
    assert.ok(passkeyStatus.textContent.includes("Passkey registered:"));
    assert.equal(regBtn.disabled, true);
  });

  it("should surface registration errors", async () => {
    const { statusEl } = makePasskeyDoc();
    const meta = {};
    globalThis.faceRegistry = makePasskeyRegistry(meta);
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      register: async function () {
        throw new Error("NotAllowedError: user dismissed");
      },
    };
    await globalThis.handlePasskeyRegister();
    assert.ok(statusEl.textContent.includes("Passkey error: NotAllowedError: user dismissed"));
    assert.equal(meta.passkey, undefined);
  });

  it("should show the empty state and hide the remove button", async () => {
    const { passkeyStatus, regBtn, remBtn } = makePasskeyDoc();
    globalThis.faceRegistry = makePasskeyRegistry({});
    await globalThis.refreshPasskeyStatus();
    assert.ok(passkeyStatus.textContent.includes("No passkey registered"));
    assert.equal(regBtn.disabled, false);
    assert.equal(remBtn.style.display, "none");
  });

  it("should show the registered state and disable the register button", async () => {
    const { passkeyStatus, regBtn, remBtn } = makePasskeyDoc();
    const meta = { passkey: { credentialId: "abc123", name: "abc123…" } };
    globalThis.faceRegistry = makePasskeyRegistry(meta);
    await globalThis.refreshPasskeyStatus();
    assert.ok(passkeyStatus.textContent.includes("abc123"));
    assert.equal(regBtn.disabled, true);
    assert.equal(remBtn.style.display, "");
  });

  it("should remove the stored passkey reference", async () => {
    const { statusEl, passkeyStatus } = makePasskeyDoc();
    const meta = { passkey: { credentialId: "abc123", name: "abc123…" } };
    const registry = makePasskeyRegistry(meta);
    globalThis.faceRegistry = registry;
    await globalThis.handlePasskeyRemove();
    assert.ok(statusEl.textContent.includes("Passkey removed"));
    assert.equal(meta.passkey, undefined);
    assert.deepEqual(registry.calls.removed, ["passkey"]);
    assert.ok(passkeyStatus.textContent.includes("No passkey registered"));
  });

  it("should survive meta store errors", async () => {
    const { statusEl } = makePasskeyDoc();
    globalThis.faceRegistry = {
      getMeta: async function () {
        throw new Error("idb boom");
      },
    };
    await globalThis.handlePasskeyRemove(); // should not throw
    await globalThis.refreshPasskeyStatus();
    assert.ok(statusEl.textContent.includes("Passkey error: idb boom"));
  });
});

// ── English-only input sanitizer ──

describe("Face UI — sanitizeFaceText", () => {
  beforeEach(resetGlobals);

  it("should keep English letters, digits and safe separators", () => {
    assert.equal(globalThis.sanitizeFaceText("Artist Name-2_x.", "label"), "Artist Name-2_x.");
  });

  it("should strip Arabic and other non-English scripts from labels", () => {
    assert.equal(globalThis.sanitizeFaceText("فنان عربي Artist", "label"), "Artist");
    assert.equal(globalThis.sanitizeFaceText("Привет мир", "label"), "");
    assert.equal(globalThis.sanitizeFaceText("中文名", "label"), "");
    assert.equal(globalThis.sanitizeFaceText("Emoji😀Face", "label"), "EmojiFace");
  });

  it("should collapse consecutive spaces in labels", () => {
    assert.equal(globalThis.sanitizeFaceText("A  B   C", "label"), "A B C");
    assert.equal(globalThis.sanitizeFaceText("  lead", "label"), "lead");
  });

  it("should drop quotes and control characters from labels", () => {
    assert.equal(globalThis.sanitizeFaceText('Jo"hn<>&;', "label"), "John");
    assert.equal(globalThis.sanitizeFaceText("Tab\there", "label"), "Tabhere");
  });

  it("should keep printable ASCII for passphrases but block non-English input", () => {
    assert.equal(globalThis.sanitizeFaceText("p@ssw0rd-123!", "pass"), "p@ssw0rd-123!");
    assert.equal(globalThis.sanitizeFaceText("مفتاح-سر", "pass"), "-");
    assert.equal(globalThis.sanitizeFaceText("密钥", "pass"), "");
  });

  it("should return an empty string for non-string input", () => {
    assert.equal(globalThis.sanitizeFaceText(undefined, "label"), "");
    assert.equal(globalThis.sanitizeFaceText(null, "pass"), "");
  });
});

// ── updateFaceRunState sanitizes the label in place ──

describe("Face UI — updateFaceRunState sanitizer", () => {
  beforeEach(resetGlobals);

  it("should strip non-English characters from the label field", () => {
    const label = { value: "فنان عربي Artist" };
    globalThis.document = makeDoc({
      "face-run": { disabled: true },
      "face-label": label,
    });
    globalThis.updateFaceRunState();
    assert.equal(label.value, "Artist");
  });
});

// ── Progress overlay (blur + spinner + progress bar) ──

describe("Face UI — progress overlay", () => {
  beforeEach(resetGlobals);

  function makeOverlayDoc() {
    const overlay = { classList: makeClassList(), style: {}, parentNode: {}, offsetWidth: 0 };
    const bar = { style: {}, classList: makeClassList(), setAttribute: function () {} };
    const title = { textContent: "", setAttribute: function () {} };
    const text = { textContent: "", setAttribute: function () {} };
    const pct = { textContent: "", setAttribute: function () {} };
    globalThis.document = makeDoc({
      "face-progress-overlay": overlay,
      "face-progress-bar": bar,
      "face-progress-title": title,
      "face-progress-text": text,
      "face-progress-pct": pct,
    });
    return { overlay, bar, title, text, pct };
  }

  it("should fade the overlay in with title and stage text", () => {
    const { overlay, title, text } = makeOverlayDoc();
    globalThis.faceProgressShow("Generating Identifiers", "Detecting face...");
    assert.equal(overlay.classList.contains("is-visible"), true);
    assert.equal(title.textContent, "Generating Identifiers");
    assert.equal(text.textContent, "Detecting face...");
  });

  it("should advance the determinate bar and percentage", () => {
    const { overlay, bar, pct, text } = makeOverlayDoc();
    globalThis.faceProgressShow("t", "s");
    globalThis.faceProgressUpdate(0.45, "Signing...");
    assert.equal(bar.style.width, "45%");
    assert.equal(bar.classList.contains("is-det"), true);
    assert.equal(pct.textContent, "45%");
    assert.equal(text.textContent, "Signing...");
  });

  it("should clamp the percentage to 0..100", () => {
    const { pct, bar } = makeOverlayDoc();
    globalThis.faceProgressShow("t", "s");
    globalThis.faceProgressUpdate(1.5, null);
    assert.equal(pct.textContent, "100%");
    assert.equal(bar.style.width, "100%");
    globalThis.faceProgressUpdate(-1, null);
    assert.equal(pct.textContent, "0%");
  });

  it("should ignore updates while hidden", () => {
    const { bar } = makeOverlayDoc();
    globalThis.faceProgressUpdate(0.5, "x");
    assert.equal(bar.style.width, undefined);
  });

  it("should fade the overlay out", () => {
    const { overlay } = makeOverlayDoc();
    globalThis.faceProgressShow("t", "s");
    globalThis.faceProgressHide();
    assert.equal(overlay.classList.contains("is-visible"), false);
  });
});

// ── File validation in handleFaceFilePicked ──

describe("Face UI — file validation", () => {
  beforeEach(resetGlobals);

  it("should reject unsupported file types", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "x.gif", type: "image/gif" }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.ok(statusEl.textContent.includes("Unsupported file type"));
    assert.equal(globalThis._facePendingCanvas, null);
  });

  it("should accept PNG/JPEG even when the type is missing", async () => {
    globalThis.document = makeDoc({
      "face-image": { files: [{ name: "x.png" }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.ok(globalThis._facePendingCanvas, "photo staged");
  });

  it("should reject oversized files", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "big.png", type: "image/png", size: 30 * 1024 * 1024 }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.ok(statusEl.textContent.includes("too large"));
    assert.equal(globalThis._facePendingCanvas, null);
  });

  it("should reject oversized dimensions", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "huge.png", type: "image/png" }] },
    });
    const origLoad = globalThis.loadImage;
    globalThis.loadImage = async function () {
      return { canvas: createCanvas(10, 10), w: 6000, h: 4000 };
    };
    await globalThis.handleFaceFilePicked();
    assert.ok(statusEl.textContent.includes("dimensions too large"));
    assert.equal(globalThis._facePendingCanvas, null);
    globalThis.loadImage = origLoad;
  });
});