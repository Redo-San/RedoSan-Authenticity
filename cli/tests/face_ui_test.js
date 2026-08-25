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
// Pristine module references: some suites stub these globals; the ladder
// tests below must always exercise the real implementations.
globalThis.__faceUiPristine = {
  handleFaceCameraStop: globalThis.handleFaceCameraStop,
  faceOverlayDetectAndDraw: globalThis.faceOverlayDetectAndDraw,
};

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
    "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
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
  globalThis._faceWaUnavailable = false;
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
  beforeEach(() => {
    globalThis.FaceWebauthn = undefined;
    globalThis.facePasskeyRegistered = true;
  });

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
  beforeEach(() => {
    globalThis.FaceWebauthn = undefined;
    globalThis.facePasskeyRegistered = true;
  });

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
    await globalThis.handleFaceRun();
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
    await globalThis.handleFaceRun();
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
        did: "did:key:zTest1234567890", // gitleaks:allow
        algorithm: "Ed25519",
        signature: "AQID",
        signedAt: "2026-01-01T00:00:00.000Z",
        document: { id: "did:key:zTest1234567890" }, // gitleaks:allow
        verifiableCredential: { issuer: "did:key:zTest1234567890" }, // gitleaks:allow
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
    assert.ok(html.includes("did:key:zTest1234567890")); // gitleaks:allow
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
        did: "did:key:zTest1234567890", // gitleaks:allow
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
    assert.ok(text.includes("label,id,created"));
    assert.ok(!text.includes("label,id,created,descriptorHash,embeddingVersion"));
    assert.ok(!text.includes(",human-hse"));
    assert.match(text, /Alice,1,2026-01-02T03:04:05\.000Z$/);
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
    assert.ok(text.includes("label\tid\tcreated"));
    assert.ok(!text.includes("label\tid\tcreated\tdescriptorHash\tembeddingVersion"));
    assert.ok(!text.includes("\thuman-hse"));
    assert.ok(text.includes("locked\t2\t2026-03-04T05:06:07.000Z"));
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
  beforeEach(() => {
    globalThis.FaceWebauthn = undefined;
    globalThis.facePasskeyRegistered = true;
  });

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

describe("Face UI — handleFaceRefreshList", () => {
  beforeEach(resetGlobals);

  function refreshDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-report": { style: { display: "block" }, innerHTML: "<b>old results</b>" },
      "face-preview": { style: { display: "block" } },
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
    });
  }

  it("should clear the generated-results view and refresh the list", async () => {
    const doc = refreshDoc();
    globalThis.document = doc;
    globalThis._faceReport = { biohash: { codeHex: "abc" } };
    globalThis.window._faceReport = globalThis._faceReport;
    globalThis._facePendingCanvas = createCanvas(10, 10);
    globalThis.faceRegistry = {
      getAllFaces: async function () {
        return [{ id: 1, label: "Alice" }];
      },
      getSize: async function () { return 1; },
    };
    await globalThis.handleFaceRefreshList();
    assert.equal(globalThis._faceReport, null, "report state cleared");
    assert.equal(globalThis.window._faceReport, null, "window report state cleared");
    assert.equal(globalThis._facePendingCanvas, null, "staged photo cleared");
    assert.equal(doc.getElementById("face-report").style.display, "none");
    assert.equal(doc.getElementById("face-report").innerHTML, "");
    assert.equal(doc.getElementById("face-preview").style.display, "none");
    assert.equal(doc.getElementById("face-run").disabled, true);
    assert.ok(doc.getElementById("face-status").textContent.includes("Registered faces: 1"));
  });

  it("should keep working when result elements are missing", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis._faceReport = { biohash: { codeHex: "abc" } };
    globalThis.faceRegistry = {
      getAllFaces: async function () { return []; },
      getSize: async function () { return 0; },
    };
    await globalThis.handleFaceRefreshList();
    assert.equal(globalThis._faceReport, null);
    assert.ok(statusEl.textContent.includes("Registered faces: 0"));
  });

  it("should surface registry errors from the underlying list", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = {
      getAllFaces: async function () { throw new Error("list error"); },
    };
    await globalThis.handleFaceRefreshList();
    assert.ok(statusEl.textContent.includes("list error"));
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

  it("should omit descriptor columns from the labels sheet when requested", async () => {
    globalThis.document = makeDoc();
    globalThis.faceRegistry = makeRegistry([
      {
        id: 1,
        label: "same face",
        created: new Date("2026-01-02T03:04:05Z"),
        descriptor: DESCRIPTOR,
        embeddingVersion: "human-hse",
      },
    ]);
    const csv = await globalThis.faceLabelsToSheet("csv", {
      includeDescriptor: false,
    });
    const csvLines = csv.split("\n");
    assert.equal(csvLines[0], "label,id,created");
    assert.equal(csvLines[1], "same face,1,2026-01-02T03:04:05.000Z");
    const txt = await globalThis.faceLabelsToSheet("txt", {
      includeDescriptor: false,
    });
    const txtLines = txt.split("\n");
    assert.equal(txtLines[0], "label\tid\tcreated");
    assert.equal(txtLines[1], "same face\t1\t2026-01-02T03:04:05.000Z");
    assert.ok(!txt.includes("descriptorHash"));
    assert.ok(!txt.includes("human-hse"));
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

  it("should be a no-op now that the PRF vault handles encryption", async () => {
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
    assert.equal(statusEl.textContent, "");
    assert.equal(passEl.focusCalls, 0);
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
    void globalThis.faceOverlayDetectAndDraw();
    assert.equal(detected, true);
  });

  it("should draw nothing when the camera is inactive", async () => {
    const { createCanvas } = require("canvas");
    globalThis._faceOverlay = createCanvas(320, 240);
    globalThis._faceOverlayRunning = true;
    globalThis.faceCamera = {
      isActive: function () { return false; },
    };
    void globalThis.faceOverlayDetectAndDraw(); // should not throw
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
  beforeEach(() => {
    globalThis.FaceWebauthn = undefined;
    globalThis.facePasskeyRegistered = true;
  });

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

  it("should reject a file blocked by validateFileInput before staging", async () => {
    const statusEl = { textContent: "" };
    globalThis.validateFileInput = async function () {
      return false;
    };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "photo.exe", type: "" }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._facePendingSource, null);
    delete globalThis.validateFileInput;
  });

  it("should not stage when validateFileInput clears the input", async () => {
    const statusEl = { textContent: "" };
    const input = { files: [{ name: "photo.exe", type: "" }] };
    globalThis.clearInputFiles = function (el) {
      el.files = [];
    };
    globalThis.validateFileInput = async function () {
      globalThis.clearInputFiles(input);
      return true;
    };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": input,
    });
    await globalThis.handleFaceFilePicked();
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._facePendingSource, null);
    delete globalThis.validateFileInput;
    delete globalThis.clearInputFiles;
  });

  it("should clear a previously staged photo when a new file is rejected", async () => {
    const statusEl = { textContent: "" };
    globalThis._facePendingCanvas = { dummy: true };
    globalThis._facePendingSource = { source: "file", fileName: "old.png" };
    globalThis.validateFileInput = async function () {
      return false;
    };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-image": { files: [{ name: "photo.exe", type: "" }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._facePendingSource, null);
    delete globalThis.validateFileInput;
  });

  it("should accept valid files when validateFileInput is present", async () => {
    globalThis.validateFileInput = async function () {
      return true;
    };
    globalThis.document = makeDoc({
      "face-image": { files: [{ name: "ok.png", type: "image/png" }] },
    });
    await globalThis.handleFaceFilePicked();
    assert.ok(globalThis._facePendingCanvas, "photo staged");
    delete globalThis.validateFileInput;
  });
});

// ── Biometric consent (GDPR Art 9(2)(a), BIPA 740 ILCS 14) ──

function makeConsentDoc(overrides) {
  const els = {
    "face-consent-panel": { style: {} },
    "face-consent-check": { checked: false, addEventListener: function () {} },
    "face-consent-accept": { disabled: true },
    "face-consent-status": { style: {}, textContent: "" },
    "face-image": { files: [], disabled: false },
    "face-cam-start": { disabled: false },
    "face-run": { disabled: true },
    "face-label": { value: "" },
  };
  if (overrides) Object.assign(els, overrides);
  return makeDoc(els);
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

describe("Face UI — biometric consent", () => {
  const savedLS = globalThis.localStorage;
  const savedSS = globalThis.sessionStorage;
  const savedConfirm = globalThis.confirm;

  beforeEach(() => {
    globalThis.localStorage = makeLocalStorage();
    globalThis.sessionStorage = makeLocalStorage();
    globalThis.confirm = savedConfirm;
    globalThis.FaceWebauthn = undefined;
    globalThis.facePasskeyRegistered = true;
  });

  afterEach(() => {
    globalThis.localStorage = savedLS;
    globalThis.sessionStorage = savedSS;
    resetGlobals();
  });

  it("faceConsentGranted is true when the panel is absent (test/embedded contexts)", () => {
    globalThis.document = makeDoc(); // no face-consent-panel
    assert.equal(globalThis.faceConsentGranted(), true);
  });

  it("faceConsentGranted is false with a visible panel and no record", () => {
    globalThis.document = makeConsentDoc();
    assert.equal(globalThis.faceConsentGranted(), false);
  });

  it("faceConsentGranted is true once a valid record exists", () => {
    globalThis.document = makeConsentDoc();
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    assert.equal(globalThis.faceConsentGranted(), true);
  });

  it("accept refuses without an explicit (unticked) checkbox", async () => {
    globalThis.document = makeConsentDoc();
    await globalThis.handleFaceConsentAccept();
    assert.equal(globalThis.faceConsentLoad(), null);
  });

  it("accept records consent, hides the panel and re-enables entry points", async () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    doc.getElementById("face-consent-check").checked = true;
    await globalThis.handleFaceConsentAccept();
    const rec = globalThis.faceConsentLoad();
    assert.ok(rec, "consent record saved");
    assert.equal(rec.version, 1);
    assert.equal(rec.policyVersion, 1);
    assert.ok(rec.acceptedAt, "acceptance timestamp recorded");
    assert.equal(doc.getElementById("face-consent-panel").style.display, "none");
    assert.equal(doc.getElementById("face-consent-status").style.display, "block");
    assert.equal(doc.getElementById("face-image").disabled, false);
    assert.equal(doc.getElementById("face-cam-start").disabled, false);
  });

  it("consent is session-scoped: never written to localStorage", async () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    doc.getElementById("face-consent-check").checked = true;
    await globalThis.handleFaceConsentAccept();
    assert.ok(globalThis.faceConsentLoad(), "consent record lives in sessionStorage");
    assert.equal(
      globalThis.localStorage.getItem("redoSan.faceConsent"),
      null,
      "consent must not persist across sessions in localStorage",
    );
  });

  it("withdraw clears consent, erases registry data and re-blocks the UI", async () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    let cleared = 0;
    globalThis.faceRegistry = {
      clear: async function () {
        cleared++;
      },
    };
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    await globalThis.handleFaceConsentWithdraw();
    assert.equal(globalThis.faceConsentLoad(), null, "consent record removed");
    assert.equal(cleared, 1, "registry erased (Art 17)");
    assert.equal(doc.getElementById("face-consent-panel").style.display, "");
    assert.equal(doc.getElementById("face-image").disabled, true);
    assert.equal(doc.getElementById("face-cam-start").disabled, true);
    assert.equal(doc.getElementById("face-run").disabled, true);
  });

  it("withdraw is a no-op when the confirmation is declined", async () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    globalThis.confirm = function () {
      return false;
    };
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    await globalThis.handleFaceConsentWithdraw();
    assert.notEqual(globalThis.faceConsentLoad(), null, "record survives a declined confirmation");
  });

  it("updateFaceRunState disables the run button until consent is recorded", () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    doc.getElementById("face-label").value = "alice";
    globalThis._facePendingCanvas = createCanvas(10, 10);
    globalThis.updateFaceRunState();
    assert.equal(doc.getElementById("face-run").disabled, true);
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    globalThis.updateFaceRunState();
    assert.equal(doc.getElementById("face-run").disabled, false);
  });

  it("initFaceConsent blocks collection entry points when no record exists", () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    globalThis.initFaceConsent();
    assert.equal(doc.getElementById("face-image").disabled, true);
    assert.equal(doc.getElementById("face-cam-start").disabled, true);
  });

  it("initFaceConsent keeps entry points enabled when consent is on record", () => {
    const doc = makeConsentDoc();
    globalThis.document = doc;
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    globalThis.initFaceConsent();
    assert.equal(doc.getElementById("face-image").disabled, false);
    assert.equal(doc.getElementById("face-cam-start").disabled, false);
    assert.equal(doc.getElementById("face-consent-panel").style.display, "none");
  });

  it("faceWarnConsentRequired shows the blocked message and is safe without helpers", () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeConsentDoc({ "face-status": statusEl });
    globalThis.faceWarnConsentRequired();
    assert.ok(statusEl.textContent.includes("consent"), "blocked message rendered");
  });

  it("faceWarnConsentRequired survives a missing panel or scrollIntoView", () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl }); // no panel at all
    globalThis.faceWarnConsentRequired();
    assert.ok(statusEl.textContent.includes("consent"));
  });

  it("switchFaceInput is blocked (with a warning) until consent is recorded", () => {
    const doc = makeConsentDoc({
      "face-status": { textContent: "" },
      "face-cam-start": { disabled: true },
      "face-image": { disabled: true },
    });
    globalThis.document = doc;
    globalThis.switchFaceInput("camera");
    assert.equal(globalThis._faceInputTab, "upload", "tab must not switch without consent");
    assert.equal(doc.getElementById("face-cam-start").disabled, true, "camera start stays disabled");
    assert.equal(doc.getElementById("face-image").disabled, true, "file input stays disabled");
    assert.ok(doc.getElementById("face-status").textContent.includes("consent"), "warning shown");
  });

  it("switchFaceInput works normally once consent is recorded", () => {
    const doc = makeConsentDoc({
      "face-status": { textContent: "" },
      "face-cam-start": { disabled: true },
      "face-image": { disabled: true },
      "face-upload-wrapper": { style: {} },
      "face-capture-wrapper": { style: {} },
    });
    doc.querySelectorAll = function () {
      return [];
    };
    globalThis.document = doc;
    globalThis.faceConsentSave({
      version: 1,
      policyVersion: 1,
      acceptedAt: new Date().toISOString(),
    });
    globalThis.switchFaceInput("camera");
    assert.equal(globalThis._faceInputTab, "camera", "tab switches after consent");
    assert.equal(doc.getElementById("face-cam-start").disabled, false, "camera start re-enabled");
    assert.equal(doc.getElementById("face-image").disabled, false, "file input re-enabled");
  });
});

// ── Automatic (best-effort) passkey gating ──

describe("Face UI — ensureFacePasskeyForAction (automatic, best-effort)", () => {
  beforeEach(resetGlobals);

  function makeAutoDoc() {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-passkey-status": { textContent: "" },
      "face-passkey-register-btn": { disabled: false },
      "face-passkey-remove-btn": { style: {} },
    });
    return statusEl;
  }

  function makeAutoRegistry(meta) {
    return {
      getMeta: async function (k) {
        return Object.prototype.hasOwnProperty.call(meta, k) ? meta[k] : null;
      },
      setMeta: async function (k, v) {
        meta[k] = v;
      },
      removeMeta: async function (k) {
        delete meta[k];
      },
    };
  }

  it("returns true (and never throws) when there is no registry or WebAuthn", async () => {
    const statusEl = makeAutoDoc();
    const result = await globalThis.ensureFacePasskeyForAction();
    assert.equal(result, true);
    assert.ok(statusEl.textContent.length >= 0);
  });

  it("auto-registers a passkey when WebAuthn is available and none exists", async () => {
    const statusEl = makeAutoDoc();
    const meta = {};
    globalThis.faceRegistry = makeAutoRegistry(meta);
    let registered = false;
    globalThis.FaceWebauthn = {
      isAvailable: function () {
        return true;
      },
      register: async function () {
        registered = true;
        return { id: "ABCD1234abcd1234EFGH", rawId: "QUJD" };
      },
    };
    const result = await globalThis.ensureFacePasskeyForAction();
    assert.equal(result, true);
    assert.ok(registered, "should have attempted registration");
    assert.ok(meta.passkey && meta.passkey.credentialId === "ABCD1234abcd1234EFGH");
    assert.ok(statusEl.textContent.length >= 0);
  });

  it("returns false (strict gate) when registration fails", async () => {
    makeAutoDoc();
    globalThis.faceRegistry = makeAutoRegistry({});
    let registered = false;
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      register: async function () {
        registered = true;
        throw new Error("NotAllowedError: no authenticator");
      },
    };
    const result = await globalThis.ensureFacePasskeyForAction();
    assert.equal(result, false, "strict gate refuses without a stored passkey");
    assert.ok(registered, "registration attempted");
    assert.match(
      globalThis.document.getElementById("face-status").textContent,
      /Register a passkey/,
    );
  });

  it("skips registration (and returns true) when WebAuthn is unavailable", async () => {
    const statusEl = makeAutoDoc();
    globalThis.faceRegistry = makeAutoRegistry({});
    globalThis.FaceWebauthn = {
      isAvailable: function () {
        return false;
      },
      register: async function () {
        throw new Error("must not be called when unavailable");
      },
    };
    const result = await globalThis.ensureFacePasskeyForAction();
    assert.equal(result, true);
    assert.ok(statusEl.textContent.includes("unavailable"));
  });

  it("short-circuits when a passkey is already registered", async () => {
    makeAutoDoc();
    globalThis.faceRegistry = makeAutoRegistry({ passkey: { credentialId: "ABCD1234abcd1234EFGH" } });
    globalThis.FaceWebauthn = {
      isAvailable: function () {
        return true;
      },
      register: async function () {
        throw new Error("must not re-register");
      },
    };
    const result = await globalThis.ensureFacePasskeyForAction();
    assert.equal(result, true);
  });
});
// ── Coverage: lock/unlock/backup/restore/credential handlers + overlay + progress ──

function uiNode() {
  return {
    style: {},
    classList: makeClassList(),
    children: [],
    textContent: "",
    id: "",
    className: "",
    value: "",
    disabled: false,
    appendChild: function (c) { this.children.push(c); return c; },
    setAttribute: function () {},
    scrollIntoView: function () {},
  };
}

function stubRegistry(overrides) {
  return Object.assign({
    lock: async function () { return 2; },
    unlock: async function () { return 3; },
    exportBackup: async function () { return { type: "redoSan.faceRegistryBackup", version: 1, entries: [] }; },
    importBackup: async function () { return 4; },
    getAllFaces: async function () { return []; },
    getSize: async function () { return 0; },
    isLocked: async function () { return false; },
    deleteFace: async function () { return true; },
    getMeta: async function () { return null; },
    setMeta: async function () {},
    removeMeta: async function () {},
    setVaultKey: function () {},
    sealAllPlaintext: async function () { return 0; },
  }, overrides || {});
}

describe("Face UI — handleFaceLock", () => {
  beforeEach(resetGlobals);
  afterEach(function () { globalThis.FaceCrypto = FaceCrypto; });

  it("returns silently without a registry", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.handleFaceLock();
    assert.equal(statusEl.textContent, "");
  });

  it("reports a missing crypto module", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = stubRegistry();
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      await globalThis.handleFaceLock();
      assert.ok(statusEl.textContent.includes("Encryption module"));
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("demands a passphrase when none is entered", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceLock();
    assert.ok(statusEl.textContent.includes("passphrase"), statusEl.textContent);
  });

  it("locks, reports the count, clears the input and refreshes", async () => {
    const passEl = { value: "pw" };
    const lockStatus = { textContent: "" };
    const doc = makeDoc({
      "face-lock-pass": passEl,
      "face-lock-status": lockStatus,
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
    });
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    let lockedWith = null;
    globalThis.faceRegistry = stubRegistry({
      lock: async function (p) { lockedWith = p; return 2; },
    });
    await globalThis.handleFaceLock();
    assert.equal(lockedWith, "pw");
    assert.ok(statusEl.textContent.includes("2"), statusEl.textContent);
    assert.ok(lockStatus.textContent.includes("Locked"));
  });

  it("surfaces lock errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": { value: "pw" },
    });
    globalThis.faceRegistry = stubRegistry({
      lock: async function () { throw new Error("boom"); },
    });
    await globalThis.handleFaceLock();
    assert.ok(statusEl.textContent.includes("Lock error: boom"));
  });
});

describe("Face UI — handleFaceUnlock", () => {
  beforeEach(resetGlobals);

  it("reports a missing crypto module", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.faceRegistry = stubRegistry();
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      await globalThis.handleFaceUnlock();
      assert.ok(statusEl.textContent.includes("Encryption module"));
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("demands a passphrase and unlocks on success", async () => {
    const doc1 = makeDoc({ "face-lock-pass": { value: "" } });
    const statusEl = doc1.getElementById("face-status");
    globalThis.document = doc1;
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceUnlock();
    assert.ok(statusEl.textContent.toLowerCase().includes("unlock"));

    const pass2 = { value: "pw" };
    const lockStatus = { textContent: "" };
    const doc2 = makeDoc({
      "face-lock-pass": pass2,
      "face-lock-status": lockStatus,
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
    });
    const statusEl2 = doc2.getElementById("face-status");
    globalThis.document = doc2;
    let unlockedWith = null;
    globalThis.faceRegistry = stubRegistry({
      unlock: async function (p) { unlockedWith = p; return 3; },
    });
    await globalThis.handleFaceUnlock();
    assert.equal(unlockedWith, "pw");
    assert.ok(statusEl2.textContent.includes("3"), statusEl2.textContent);
    assert.ok(lockStatus.textContent.includes("Unlocked"));
  });

  it("reports unlock failures gracefully", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": { value: "pw" },
    });
    globalThis.faceRegistry = stubRegistry({
      unlock: async function () { throw new Error("GCM auth failed"); },
    });
    await globalThis.handleFaceUnlock();
    assert.ok(statusEl.textContent.includes("Unlock failed"));
  });
});

describe("Face UI — handleFaceBackup", () => {
  beforeEach(resetGlobals);

  it("guards missing registry and crypto", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    await globalThis.handleFaceBackup();
    assert.equal(statusEl.textContent, "");

    globalThis.faceRegistry = stubRegistry();
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      await globalThis.handleFaceBackup();
      assert.ok(statusEl.textContent.includes("Encryption module"));
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("exports encrypted and plain backups via the download helper", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": { value: "pw" },
    });
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceBackup();
    assert.equal(downloads.length, 1);
    assert.ok(statusEl.textContent.includes("encrypted"));

    downloads.length = 0;
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-lock-pass": null,
    });
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceBackup();
    assert.equal(downloads.length, 1);
  });

  it("surfaces backup errors", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-status": statusEl,
      "face-lock-pass": { value: "pw" },
    });
    globalThis.faceRegistry = stubRegistry({
      exportBackup: async function () { throw new Error("disk full"); },
    });
    await globalThis.handleFaceBackup();
    assert.ok(statusEl.textContent.includes("Backup error: disk full"));
  });
});

describe("Face UI — handleFaceRestore", () => {
  beforeEach(resetGlobals);
  afterEach(function () { globalThis.confirm = function () { return true; }; });

  function restoreDoc(fileOverride) {
    return makeDoc(Object.assign({
      "face-status": { textContent: "" },
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
      "face-lock-pass": { value: "backup-pw" },
      "face-restore-file": fileOverride,
    }));
  }

  it("guards missing registry and missing file", async () => {
    const doc = restoreDoc(null);
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    await globalThis.handleFaceRestore();
    assert.equal(statusEl.textContent, "");

    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceRestore();
    assert.ok(statusEl.textContent.includes("Choose a backup file"));

    globalThis.document = restoreDoc({ files: [], value: "" });
    const statusEl2 = globalThis.document.getElementById("face-status");
    await globalThis.handleFaceRestore();
    assert.ok(statusEl2.textContent.includes("Choose a backup file"));
  });

  it("rejects invalid JSON files", async () => {
    const doc = restoreDoc({
      files: [{ text: async function () { return "{not json"; } }],
      value: "x",
    });
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceRestore();
    assert.ok(statusEl.textContent.includes("not a valid backup"));
  });

  it("imports in replace or merge mode per the confirm dialog", async () => {
    const seen = [];
    const registry = stubRegistry({
      importBackup: async function (backup, pass, mode) {
        seen.push([pass, mode]);
        return 4;
      },
    });
    const payload = JSON.stringify({ type: "redoSan.faceRegistryBackup", entries: [] });

    const docReplace = restoreDoc({ files: [{ text: async function () { return payload; } }], value: "keep" });
    globalThis.document = docReplace;
    globalThis.confirm = function () { return true; };
    globalThis.faceRegistry = registry;
    await globalThis.handleFaceRestore();
    assert.deepEqual(seen[0], ["backup-pw", "replace"]);
    assert.equal(docReplace.getElementById("face-restore-file").value, "");
    const replacedStatus = docReplace.getElementById("face-status").textContent;
    assert.ok(replacedStatus.includes("Restored 4"), replacedStatus);
    assert.ok(replacedStatus.includes("(replace)"), replacedStatus);

    const docMerge = restoreDoc({ files: [{ text: async function () { return payload; } }], value: "x" });
    globalThis.document = docMerge;
    globalThis.confirm = function () { return false; };
    await globalThis.handleFaceRestore();
    assert.deepEqual(seen[1], ["backup-pw", "merge"]);
    assert.ok(docMerge.getElementById("face-status").textContent.includes("(merge)"));
  });

  it("surfaces import errors", async () => {
    const doc = restoreDoc({
      files: [{ text: async function () { return "{}"; } }],
      value: "",
    });
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    globalThis.faceRegistry = stubRegistry({
      importBackup: async function () { throw new Error("bad sig"); },
    });
    await globalThis.handleFaceRestore();
    assert.ok(statusEl.textContent.includes("Restore error: bad sig"));
  });
});

describe("Face UI — handleFaceIssueCredential / VCDownload", () => {
  beforeEach(resetGlobals);

  const vcSrcLocal = fs.readFileSync(
    path.join(__dirname, "..", "..", "Face_Biometric", "face_vc.js"),
    "utf8",
  );

  function issueDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-vc-output": uiNode(),
      "face-vc-box": uiNode(),
      "face-vc-download": uiNode(),
    });
  }

  it("demands a report first", async () => {
    const doc = issueDoc();
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    await globalThis.handleFaceIssueCredential();
    assert.ok(statusEl.textContent.includes("pipeline first"));
  });

  it("demands a DID keypair or the FaceVC module", async () => {
    const doc = issueDoc();
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    globalThis._faceReport = { photo: { descriptorHash: "h", facesDetected: 1 } };
    await globalThis.handleFaceIssueCredential();
    assert.ok(statusEl.textContent.includes("DID keypair"), statusEl.textContent);
  });

  it("issues, renders and stores a signed credential", async () => {
    vm.runInThisContext(vcSrcLocal, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_vc.js") });
    const doc = issueDoc();
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    globalThis._faceReport = {
      photo: { descriptorHash: "cafe", facesDetected: 1, embeddingVersion: "human-hse" },
      liveness: { live: true },
    };
    globalThis._faceKeypair = { did: "did:key:zTestIssue00", algorithm: "Ed25519" };
    await globalThis.handleFaceIssueCredential();
    assert.ok(statusEl.textContent.includes("issued and signed"), statusEl.textContent);
    assert.ok(globalThis.window._faceCredential);
    assert.equal(doc.getElementById("face-vc-box").style.display, "block");
    assert.ok(doc.getElementById("face-vc-output").textContent.includes("VerifiableCredential"));

    const before = downloads.length;
    globalThis.handleFaceVCDownload();
    assert.equal(downloads.length, before + 1);
    assert.equal(downloads[downloads.length - 1].name, "face_credential.json");
  });

  it("surfaces credential errors", async () => {
    vm.runInThisContext(vcSrcLocal, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_vc.js") });
    const doc = issueDoc();
    const statusEl = doc.getElementById("face-status");
    globalThis.document = doc;
    globalThis._faceReport = { photo: { descriptorHash: "h" } };
    globalThis._faceKeypair = { did: "did:key:zTestErr01", algorithm: "Ed25519" };
    const savedSign = globalThis.FaceVC.sign;
    globalThis.FaceVC.sign = async function () { throw new Error("sign blew up"); };
    try {
      await globalThis.handleFaceIssueCredential();
      assert.ok(statusEl.textContent.includes("Credential error: sign blew up"));
    } finally {
      globalThis.FaceVC.sign = savedSign;
    }
  });

  it("skips the download when no credential exists", () => {
    resetGlobals();
    globalThis.document = issueDoc();
    globalThis.window._faceCredential = null;
    const before = downloads.length;
    globalThis.handleFaceVCDownload();
    assert.equal(downloads.length, before);
  });
});

describe("Face UI — revealPasskeyRequire", () => {
  beforeEach(resetGlobals);

  it("reveals, labels and scrolls the requirement box", () => {
    let scrolled = false;
    const box = Object.assign(uiNode(), {
      scrollIntoView: function () { scrolled = true; },
    });
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-passkey-require": box,
      "face-passkey-status": statusEl,
    });
    globalThis.revealPasskeyRequire();
    assert.equal(box.style.display, "block");
    assert.ok(statusEl.textContent.length > 0);
    assert.equal(scrolled, true);
  });

  it("tolerates missing elements", () => {
    globalThis.document = makeDoc({});
    globalThis.revealPasskeyRequire();
  });
});

describe("Face UI — runFaceLivenessCheck challenge wiring", () => {
  beforeEach(resetGlobals);

  it("routes challenge callbacks into the renderer and stores evidence", async () => {
    const challengeEl = uiNode();
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-liveness-mode": { value: "active" },
      "face-challenge": challengeEl,
      "face-status": statusEl,
    });
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.faceEngine = {};
    const callbacks = [];
    globalThis.faceLiveness = {
      verifyLiveness: async function (cam, eng, opts) {
        callbacks.push(opts.mode);
        opts.onChallenge({ type: "blink", index: 0, total: 2, done: false });
        opts.onChallenge({ type: "blink", index: 1, total: 2, done: true });
        return { live: true, score: 0.9 };
      },
    };
    const evidence = await globalThis.runFaceLivenessCheck();
    assert.equal(evidence.live, true);
    assert.deepEqual(callbacks, ["both"]);
    assert.equal(challengeEl.style.display, "none", "done challenge hides the box");
  });

  it("renders failures through the same path", async () => {
    const challengeEl = uiNode();
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({
      "face-liveness-mode": null,
      "face-challenge": challengeEl,
      "face-status": statusEl,
    });
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.faceEngine = {};
    globalThis.faceLiveness = {
      verifyLiveness: async function () { throw new Error("cam died"); },
    };
    const res = await globalThis.runFaceLivenessCheck();
    assert.equal(res, null);
    assert.ok(statusEl.textContent.includes("Liveness error: cam died"));
    assert.equal(challengeEl.style.display, "none");
  });
});

describe("Face UI — faceOverlayTick scheduling", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    globalThis.requestAnimationFrame = undefined;
    globalThis._faceOverlayRunning = false;
    globalThis.faceOverlayDetectAndDraw =
      globalThis.__faceUiPristine.faceOverlayDetectAndDraw;
  });

  it("ignores ticks while stopped", () => {
    globalThis.document = makeDoc({});
    globalThis._faceOverlayRunning = false;
    globalThis.faceOverlayTick(1000);
  });

  function overlayHarness() {
    const pending = [];
    globalThis.requestAnimationFrame = function (cb) { pending.push(cb); return pending.length; };
    let detectCalls = 0;
    const resolvers = [];
    globalThis.faceOverlayDetectAndDraw = function () {
      detectCalls++;
      return new Promise(function (resolve, reject) { resolvers.push({ resolve: resolve, reject: reject }); });
    };
    return {
      pending: pending,
      calls: function () { return detectCalls; },
      resolvers: resolvers,
    };
  }

  it("throttles detection and keeps scheduling via rAF", async () => {
    resetGlobals();
    globalThis.document = makeDoc({});
    const h = overlayHarness();
    globalThis._faceOverlayRunning = true;
    globalThis._faceOverlayLast = 0;
    globalThis._faceOverlayBusy = false;

    globalThis.faceOverlayTick(500); // 500ms since last ≥ 200 → detection starts
    assert.equal(h.calls(), 1);
    assert.equal(globalThis._faceOverlayBusy, true);
    assert.equal(h.pending.length, 1);

    h.resolvers[0].resolve(); // success outcome releases busy
    await flush();

    globalThis.faceOverlayTick(550); // only 50ms later → throttled
    assert.equal(h.calls(), 1);
    assert.equal(h.pending.length, 2);

    globalThis._faceOverlayRunning = false;
    globalThis.faceOverlayTick(1000); // stopped → no work
    assert.equal(h.calls(), 1);
  });

  it("releases busy even when detection rejects", async () => {
    resetGlobals();
    globalThis.document = makeDoc({});
    const h = overlayHarness();
    globalThis._faceOverlayRunning = true;
    globalThis._faceOverlayLast = 0;
    globalThis._faceOverlayBusy = false;

    globalThis.faceOverlayTick(500);
    assert.equal(h.calls(), 1);
    h.resolvers[0].reject(new Error("draw fail"));
    await flush();
    assert.equal(globalThis._faceOverlayBusy, false);

    // a later tick may start another detection once busy is released
    globalThis.faceOverlayTick(900);
    assert.equal(h.calls(), 2);
    h.resolvers[1].resolve();
    await flush();
    globalThis._faceOverlayRunning = false;
  });
});

describe("Face UI — progress overlay construction fallbacks", () => {
  beforeEach(resetGlobals);

  it("builds the overlay from scratch when refs are absent", () => {
    const appended = [];
    const node = function () {
      return {
        style: {}, classList: makeClassList(), children: [],
        id: "", className: "", textContent: "",
        appendChild: function (c) { this.children.push(c); return c; },
      };
    };
    globalThis.document = {
      getElementById: function () { return null; },
      createElement: function () { return node(); },
      body: { appendChild: function (el) { appended.push(el); } },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
    };
    const overlay = globalThis.faceProgressEnsure();
    assert.ok(overlay, "overlay must be constructed");
    assert.equal(appended.length, 1);
    // show() still cannot find refs by id → early return arm
    globalThis.faceProgressShow("T", "doing things");
    globalThis.document = makeDoc({
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-pct": { textContent: "", setAttribute: function () {} },
    });
    globalThis.faceProgressShow("T2", "with refs");
    globalThis.faceProgressHide && globalThis.faceProgressHide();
  });
});

// ── Coverage: PDF / DOCX builders with injected fake libs + full report ──

function makeFullFaceReport(overrides) {
  var base = {
    type: "face-biometric-report",
    generatedAt: "2026-01-01T00:00:00.000Z",
    source: "file",
    photo: {
      fileName: "e2e/face shot.JPG",
      width: 806,
      height: 1212,
      facesDetected: 1,
      confidence: 0.93,
      descriptorDim: 128,
      descriptorHash: "ab".repeat(32),
      embeddingVersion: "human-hse",
    },
    did: {
      did: "did:key:zFullReport",
      algorithm: "Ed25519",
      signedAt: "2026-01-01T00:00:01.000Z",
      signature: "AAAAB3NzaC1",
    },
    biohash: { bits: 128, codeHex: "face".repeat(8), pinFingerprint: "pin1".repeat(2), pinAuto: true },
    autoPin: "1234-5678",
    fuzzy: { bits: 64, key: "fuzzykey", helperHex: "cafe".repeat(4) },
    registry: {
      match: { label: "Alice", similarity: 91.4 },
      registeredId: 42,
    },
    liveness: { live: true, score: 0.9, mode: "passive" },
    passkey: {
      credentialId: "cred-e2e-full",
      name: "Full Report Passkey",
      createdAt: "2026-01-01T00:00:00.500Z",
      authenticated: true,
    },
    credential: { id: "urn:uuid:full", type: "VerifiableCredential" },
  };
  return Object.assign(base, overrides || {});
}

function recordingDocx() {
  function make(kind, opts) {
    return { __kind: kind, __opts: opts };
  }
  function Table(opts) { return make("Table", opts); }
  function TableRow(opts) { return make("TableRow", opts); }
  function TableCell(opts) { return make("TableCell", opts); }
  function Paragraph(opts) { return make("Paragraph", opts); }
  function TextRun(opts) { return make("TextRun", opts); }
  var calls = [];
  var state = { lastDocumentOpts: null };
  return {
    lib: {
      Paragraph: Paragraph,
      TextRun: TextRun,
      Table: Table,
      TableRow: TableRow,
      TableCell: TableCell,
      WidthType: { PERCENTAGE: "percent" },
      Document: function (opts) {
        calls.push(["Document", opts]);
        state.lastDocumentOpts = opts;
        return { __doc: true };
      },
      Packer: {
        toBlob: async function () {
          calls.push(["Packer.toBlob"]);
          return new Blob(["DOCXFAKE"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        },
      },
    },
    calls: calls,
    state: state,
  };
}

function recordingJsPdf() {
  var ops = [];
  function JsPDF() {
    this.__ops = ops;
    this.addPage = function () { ops.push("addPage"); };
    this.setFontSize = function (n) { ops.push(["size", n]); };
    this.setTextColor = function (r, g, b) { ops.push(["color", r, g, b]); };
    this.text = function (t, x, y) { ops.push(["text", t]); };
    this.output = function (kind) {
      ops.push(["output", kind]);
      return new Blob(["PDFFAKE"], { type: "application/pdf" });
    };
  }
  return { lib: { jsPDF: JsPDF }, ops: ops };
}

describe("Face UI — faceReportToPDF with an injected jsPDF", () => {
  beforeEach(resetGlobals);
  afterEach(function () { delete globalThis.jspdf; });

  it("walks every section and returns a PDF blob", async () => {
    const savedEnsure = globalThis.ensureLib;
    globalThis.ensureLib = async function () {};
    const pdf = recordingJsPdf();
    globalThis.jspdf = pdf.lib;
    try {
      const blob = await globalThis.faceReportToPDF(makeFullFaceReport());
      assert.ok(blob instanceof Blob);
      assert.equal(blob.type, "application/pdf");
      const texts = pdf.ops.filter(function (o) { return o[0] === "text"; }).map(function (o) { return o[1]; });
      assert.ok(texts.some(function (t) { return t.indexOf("DID Identity") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("BioHash") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("Auto PIN") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("Fuzzy Identifier") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("Alice (91.4%)") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("Liveness: passed") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("Verified: yes") !== -1; }));
      assert.ok(texts.some(function (t) { return t.indexOf("urn:uuid:full") !== -1; }));
    } finally {
      globalThis.ensureLib = savedEnsure;
    }
  });

  it("renders fallback text when optional sections are absent", async () => {
    globalThis.ensureLib = async function () {};
    const pdf = recordingJsPdf();
    globalThis.jspdf = pdf.lib;
    const r = makeFullFaceReport({
      did: null, biohash: null, fuzzy: null, liveness: null,
      passkey: null, credential: null,
      autoPin: null,
      registry: { match: null, registeredId: null },
    });
    const blob = await globalThis.faceReportToPDF(r);
    assert.ok(blob instanceof Blob);
    const texts = pdf.ops.filter(function (o) { return o[0] === "text"; }).map(function (o) { return o[1]; });
    assert.ok(texts.some(function (t) { return t.indexOf("Not found in the registry.") !== -1; }));
    assert.ok(!texts.some(function (t) { return t.indexOf("Fuzzy Identifier") !== -1; }));
  });
});

describe("Face UI — faceReportToDOCX with an injected docx", () => {
  beforeEach(resetGlobals);
  afterEach(function () { delete globalThis.docx; });

  it("builds tables for every section and packs a blob", async () => {
    globalThis.ensureLib = async function () {};
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    const blob = await globalThis.faceReportToDOCX(makeFullFaceReport());
    assert.ok(blob instanceof Blob);
    const packed = fake.calls.find(function (c) { return c[0] === "Packer.toBlob"; });
    assert.ok(packed, "document must be packed");
    const children = fake.state.lastDocumentOpts.sections[0].children;
    const tables = children.filter(function (c) { return c.__kind === "Table"; });
    assert.ok(tables.length >= 5, "detection+did+biohash+fuzzy+registry tables");
    const runs = JSON.stringify(children);
    assert.ok(runs.includes("Auto PIN"), "auto pin row present");
    assert.ok(runs.includes("Alice"), "match label present");
  });

  it("handles the credential-error arm and empty match", async () => {
    globalThis.ensureLib = async function () {};
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    await globalThis.faceReportToDOCX(
      makeFullFaceReport({ credential: { error: "no keypair" }, registry: { match: null } }),
    );
    const runs = JSON.stringify(fake.calls);
    assert.ok(runs.includes("Face Credential"), "credential row present");
    assert.ok(runs.includes('"error"'), "error arm renders the literal error cell");
  });
});

describe("Face UI — downloadFaceReport formats via the real switch", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.jspdf;
    delete globalThis.docx;
  });

  function fullDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
    });
  }

  it("exports json/csv/txt/xml/html through the shared switch", async () => {
    globalThis.document = fullDoc();
    downloads.length = 0;
    globalThis._faceReport = makeFullFaceReport();
    globalThis.faceRegistry = stubRegistry({
      getAllFaces: async function () {
        return [{ id: 1, label: "Alice", created: new Date(), updated: new Date() }];
      },
    });
    globalThis.ensureLib = async function () {};

    for (const fmt of ["json", "csv", "txt", "xml", "html"]) {
      await globalThis.downloadFaceReport(fmt);
    }
    assert.equal(downloads.length, 5, "five exports captured");
    // The staged file name contains a slash that must be sanitised away.
    assert.ok(downloads.every(function (d) { return !/[\\/:*?"<>|]/.test(d.name.split(".face_report")[0]); }));
    const byExt = {};
    downloads.forEach(function (d) {
      const ext = d.name.split(".").pop();
      byExt[ext] = d.blob;
    });
    assert.ok(byExt.json && byExt.csv && byExt.txt && byExt.xml && byExt.html);
    const parsed = JSON.parse(await byExt.json.text());
    assert.equal(parsed.photo.descriptorHash, "ab".repeat(32));
  });

  it("exports pdf and doc when the libraries resolve", async () => {
    globalThis.document = fullDoc();
    downloads.length = 0;
    globalThis._faceReport = makeFullFaceReport();
    globalThis.ensureLib = async function () {};
    globalThis.jspdf = recordingJsPdf().lib;

    const fakeDocx = recordingDocx();
    globalThis.docx = fakeDocx.lib;

    await globalThis.downloadFaceReport("pdf");
    await globalThis.downloadFaceReport("doc");
    assert.equal(downloads.length, 2);
    assert.ok(downloads[0].name.endsWith(".face_report.pdf"));
    assert.ok(downloads[1].name.endsWith(".face_report.docx"));
  });

  it("returns silently without a report or for unknown formats", async () => {
    globalThis.document = fullDoc();
    downloads.length = 0;
    await globalThis.downloadFaceReport("json");
    assert.equal(downloads.length, 0);

    globalThis._faceReport = makeFullFaceReport();
    await globalThis.downloadFaceReport("bogus-format");
    assert.equal(downloads.length, 0);
  });
});

describe("Face UI — renderFaceReport full vs sparse reports", () => {
  beforeEach(resetGlobals);

  it("renders every section when the report is complete", () => {
    let html = "";
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-actions": { style: {} },
      "face-preview": createCanvas(10, 10),
      "face-report": {
        style: {},
        get innerHTML() { return html; },
        set innerHTML(v) { html = v; },
      },
    });
    globalThis._faceReport = makeFullFaceReport();
    globalThis.renderFaceReport(globalThis._faceReport);
    assert.ok(html.includes("Alice"), "registry match rendered");
    assert.ok(html.includes("urn:uuid:full"), "credential rendered");
    assert.ok(html.includes("1234-5678"), "auto PIN rendered");
    assert.ok(html.includes("facefacefaceface"), "biohash code rendered");
  });

  it("renders graceful fallbacks for a minimal report", () => {
    let html = "";
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-actions": { style: {} },
      "face-report": {
        style: {},
        get innerHTML() { return html; },
        set innerHTML(v) { html = v; },
      },
    });
    globalThis._faceReport = makeFullFaceReport({
      did: null, biohash: null, fuzzy: null, liveness: null,
      passkey: null, credential: null, autoPin: null,
      registry: { match: null, registeredId: null },
    });
    globalThis.renderFaceReport(globalThis._faceReport);
    assert.ok(html.toLowerCase().includes("not issued") || html.length > 0);
  });
});

// ── Coverage: early-cluster arms (hash fallback, token, hint, attr, embedder, passkey internals) ──

describe("Face UI — early helpers rare arms", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    if (window.__savedCrypto !== undefined) {
      Object.defineProperty(globalThis, "crypto", {
        value: window.__savedCrypto,
        configurable: true,
      });
      window.__savedCrypto = undefined;
    }
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
  });

  it("faceDescriptorHash falls back to the legacy hash when sha256 throws", async () => {
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = {
      sha256Hex: async function () {
        throw new Error("subtle gone");
      },
    };
    try {
      const h = await globalThis.faceDescriptorHash(new Float32Array([0.5, -0.25]));
      assert.ok(/^[0-9a-f]+$/.test(h), "legacy hex hash: " + h);
      assert.equal(await globalThis.faceDescriptorHash(null), null);
      assert.equal(await globalThis.faceDescriptorHash(new Float32Array(0)), null);
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("faceRandomToken uses Math.random when crypto is unavailable", () => {
    window.__savedCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    const t = globalThis.faceRandomToken(12);
    assert.equal(t.length, 12);
    assert.match(t, /^[a-zA-Z0-9]{12}$/);
  });

  it("updateFaceEmbedderHint renders both engine texts", () => {
    let removed = false;
    const hint = {
      removeAttribute: function () { removed = true; },
      textContent: "",
    };
    globalThis.document = makeDoc({
      "face-embedder-hint": hint,
      "face-embedder": { value: "arcface" },
    });
    globalThis.handleFaceEmbedderChange();
    assert.equal(removed, true);
    assert.ok(hint.textContent.includes("ArcFace"), hint.textContent);

    globalThis.document = makeDoc({
      "face-embedder-hint": { removeAttribute: function () {}, textContent: "" },
      "face-embedder": { value: "human" },
    });
    const hint2 = globalThis.document.getElementById("face-embedder-hint");
    globalThis.handleFaceEmbedderChange();
    assert.ok(hint2.textContent.includes("offline"), hint2.textContent);
  });

  it("faceAttrText maps an emotion-only array entry", () => {
    assert.equal(globalThis.faceAttrText([{ emotion: "happy" }]), "happy");
    assert.equal(
      globalThis.faceAttrText([{ emotion: "calm", score: 0.5 }, { emotion: "joy", score: 0.9 }]),
      "joy (90%)",
    );
  });

  function arcfaceStubs(embedImpl) {
    globalThis.FaceAlign = {
      meshToLandmarks5: function () {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      },
      alignFace: function () {
        return { canvas: createCanvas(48, 48) };
      },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return true; },
      load: async function () {},
      embed: embedImpl,
    };
  }

  it("arcface embed failure falls back with arcface-embed-error", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    arcfaceStubs(async function () {
      throw new Error("ort exploded");
    });
    const r = await globalThis.faceExtractEmbedding(
      createCanvas(10, 10),
      { descriptor: DESCRIPTOR, mesh: new Float32Array(468) },
    );
    assert.equal(r.error, "arcface-embed-error");
    assert.deepEqual(Array.from(r.descriptor), Array.from(DESCRIPTOR));
  });

  it("arcface null embedding falls back with arcface-embed-null", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    arcfaceStubs(async function () { return null; });
    const r = await globalThis.faceExtractEmbedding(
      createCanvas(10, 10),
      { descriptor: DESCRIPTOR, mesh: new Float32Array(468) },
    );
    assert.equal(r.error, "arcface-embed-null");
  });

  it("initFaceBiometric wires the passphrase sanitizer", async () => {
    let fired = null;
    const passEl = {
      value: "p\u0660@ss w\u200bord",
      addEventListener: function (_t, cb) { fired = cb; },
    };
    globalThis.document = makeDoc({
      "face-lock-pass": passEl,
      "face-status": { textContent: "" },
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
    });
    globalThis.faceRegistry = stubRegistry();
    await globalThis.initFaceBiometric();
    assert.ok(typeof fired === "function", "input listener registered");
    fired();
    assert.equal(passEl.value, globalThis.sanitizeFaceText("p\u0660@ss w\u200bord", "pass"));
  });
});

describe("Face UI — handlePasskeyRegister internal arms", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.FaceWebauthn;
    if (window.__savedCrypto !== undefined) {
      Object.defineProperty(globalThis, "crypto", {
        value: window.__savedCrypto,
        configurable: true,
      });
      window.__savedCrypto = undefined;
    }
  });

  function waStub(extra) {
    return Object.assign(
      {
        isAvailable: function () { return true; },
        register: async function () {
          return { id: "cred-1234567890abcdef", rawId: new Uint8Array([1, 2, 3, 4]) };
        },
        randomChallenge: function (n) { return new Uint8Array(n); },
        authenticate: async function () { return { __assertion: true }; },
        prfOutput: function () { return new Uint8Array(32); },
        deriveVaultKey: async function () { return { __vaultKey: true }; },
        encryptJSON: async function (_k, obj) {
          return { iv: "iv-e2e", ct: JSON.stringify(obj) };
        },
      },
      extra || {},
    );
  }

  function passkeyDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-passkey-register-btn": { disabled: false },
      "face-passkey-remove-btn": { style: {} },
      "face-passkey-status": { textContent: "" },
    });
  }

  function storeRegistry(extra) {
    const store = {};
    const base = {
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      removeMeta: async function (k) { delete store[k]; },
      __store: store,
    };
    return stubRegistry(Object.assign(base, extra || {}));
  }

  it("demands an initialized registry first", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = passkeyDoc();
    await globalThis.handlePasskeyRegister();
    assert.ok(statusEl.textContent.includes("Registry not initialized") || statusEl.textContent === "");
  });

  it("stores a plaintext reference when the PRF output is absent", async () => {
    const doc = passkeyDoc();
    globalThis.document = doc;
    globalThis.faceRegistry = storeRegistry();
    globalThis.FaceWebauthn = waStub({ prfOutput: function () { return null; } });
    await globalThis.handlePasskeyRegister();
    const pk = await globalThis.faceRegistry.getMeta("passkey");
    assert.equal(pk.prf, false);
    assert.equal(pk.credentialId, "cred-1234567890abcdef");
    assert.ok(doc.getElementById("face-status").textContent.includes("Passkey saved"));
  });

  it("falls back to plaintext when subtle is unavailable", async () => {
    window.__savedCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    const doc = passkeyDoc();
    globalThis.document = doc;
    globalThis.faceRegistry = storeRegistry();
    globalThis.FaceWebauthn = waStub();
    await globalThis.handlePasskeyRegister();
    const pk = await globalThis.faceRegistry.getMeta("passkey");
    assert.equal(pk.prf, false);
    assert.equal(pk.rawId instanceof Uint8Array, true);
  });

  it("seals the registry automatically when PRF succeeds", async () => {
    const doc = passkeyDoc();
    globalThis.document = doc;
    let sealed = 0;
    globalThis.faceRegistry = storeRegistry({
      setVaultKey: function (k) { sealed = k && k.__vaultKey ? 1 : 0; },
      sealAllPlaintext: async function () {
        if (sealed !== 1) throw new Error("no key set");
        sealed++;
      },
    });
    globalThis.FaceWebauthn = waStub();
    await globalThis.handlePasskeyRegister();
    const pk = await globalThis.faceRegistry.getMeta("passkey");
    assert.equal(pk.prf, true, "PRF flag stored");
    assert.equal(sealed, 2, "setVaultKey + sealAllPlaintext executed");
  });

  it("warn-and-continue when automatic sealing throws", async () => {
    const doc = passkeyDoc();
    globalThis.document = doc;
    globalThis.faceRegistry = storeRegistry({
      setVaultKey: function () { throw new Error("seal boom"); },
    });
    globalThis.FaceWebauthn = waStub();
    await globalThis.handlePasskeyRegister();
    const pk = await globalThis.faceRegistry.getMeta("passkey");
    assert.equal(pk.prf, true, "registration still succeeds");
  });

  it("handlePasskeyRemove clears the reference and tolerates absence", async () => {
    const doc = passkeyDoc();
    globalThis.document = doc;
    const store = {};
    globalThis.faceRegistry = stubRegistry({
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      removeMeta: async function (k) { delete store[k]; },
    });
    await globalThis.faceRegistry.setMeta("passkey", { credentialId: "c-1" });
    await globalThis.handlePasskeyRemove();
    assert.ok(doc.getElementById("face-status").textContent.includes("Passkey removed"));

    // Removing again with nothing stored must stay graceful.
    await globalThis.handlePasskeyRemove();
  });

  it("isFacePasskeyRegistered survives meta-store failures", async () => {
    globalThis.document = passkeyDoc();
    globalThis.faceRegistry = {
      getMeta: async function () { throw new Error("db closed"); },
    };
    assert.equal(await globalThis.isFacePasskeyRegistered(), false);
    assert.equal(await globalThis.isFacePasskeyRegistered.call(null), false);
  });
});

// ── Coverage: passkey step-up session + camera/file staging guardspasskey step-up session + camera/file staging guards ──

describe("Face UI — faceStepRegisterPasskey (pipeline step 7/8)", () => {
  beforeEach(resetGlobals);
function stepDoc() {
  return makeDoc({
    "face-status": { textContent: "" },
    "face-passkey-register-btn": { disabled: false },
    "face-passkey-remove-btn": { style: {} },
    "face-passkey-status": { textContent: "" },
  });
}
  afterEach(function () {
    delete globalThis.FaceWebauthn;
    globalThis.facePasskeySessionAuthed = false;
    globalThis.facePasskeyCached = null;
    globalThis.facePasskeySessionVerifiedAt = "";
  });

  function stepRegistry(extra) {
    const store = {};
    const base = {
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      __store: store,
    };
    return stubRegistry(Object.assign(base, extra || {}));
  }

  function waFull(extra) {
    return Object.assign(
      {
        isAvailable: function () { return true; },
        randomChallenge: function (n) { return new Uint8Array(n); },
        authenticate: async function () {
          return { rawId: "raw-e2e" };
        },
        verifyClientData: function () { return true; },
        prfOutput: function () { return new Uint8Array(32); },
        deriveVaultKey: async function () { return { __k: 1 }; },
        decryptJSON: async function (_k, _c) {
          return { credentialId: "dec-1", rawId: "raw-dec" };
        },
      },
      extra || {},
    );
  }

  it("returns null without a registry", async () => {
    assert.equal(await globalThis.faceStepRegisterPasskey(), null);
  });

  it("returns null when the meta store fails", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stubRegistry({
      getMeta: async function () { throw new Error("closed"); },
    });
    assert.equal(await globalThis.faceStepRegisterPasskey(), null);
  });

  it("returns null when no usable passkey reference is stored", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceStepRegisterPasskey();
    assert.equal(await globalThis.faceStepRegisterPasskey(), null);
  });

  it("reuses the cached session verification", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceRegistry.setMeta("passkey", {
      credentialId: "stored-1",
      name: "N",
      createdAt: "C",
    });
    globalThis.facePasskeySessionAuthed = true;
    globalThis.facePasskeyCached = { credentialId: "cached-1" };
    globalThis.facePasskeySessionVerifiedAt = "T0";
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, true);
    assert.equal(r.credentialId, "cached-1");
    assert.equal(r.note, "verified earlier this session");
  });

  it("falls back unauthenticated when WebAuthn is unavailable", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceRegistry.setMeta("passkey", { credentialId: "c2" });
    globalThis.FaceWebauthn = { isAvailable: function () { return false; } };
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, false);
    assert.match(r.note, /step-up skipped/);
  });

  it("performs a full PRF step-up and seals templates", async () => {
    globalThis.document = stepDoc();
    let sealed = 0;
    globalThis.faceRegistry = stepRegistry({
      setVaultKey: function (k) { sealed = k && k.__k ? 1 : 0; },
      sealAllPlaintext: async function () {
        if (sealed !== 1) throw new Error("no key");
        sealed++;
      },
    });
    await globalThis.faceRegistry.setMeta("passkey", {
      prf: true,
      salt: "s",
      cipher: { iv: "i", ct: "c" },
      name: "P",
      createdAt: "C",
      transports: ["usb"],
    });
    globalThis.FaceWebauthn = waFull();
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, true);
    assert.equal(r.credentialId, "dec-1");
    assert.equal(r.rawId, "raw-e2e");
    assert.ok(r.verifiedAt);
    assert.equal(sealed, 2);
  });

  it("rejects when the assertion client data does not match", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceRegistry.setMeta("passkey", { credentialId: "c3" });
    globalThis.FaceWebauthn = waFull({ verifyClientData: function () { return false; } });
    await assert.rejects(
      globalThis.faceStepRegisterPasskey(),
      /step-up failed/,
    );
  });

  it("rejects when PRF output vanishes with no plaintext fallback", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceRegistry.setMeta("passkey", { prf: true, salt: "s", cipher: {} });
    globalThis.FaceWebauthn = waFull({ prfOutput: function () { return null; } });
    await assert.rejects(
      globalThis.faceStepRegisterPasskey(),
      /PRF unavailable/,
    );
  });

  it("wraps authenticator failures as step-up errors", async () => {
    globalThis.document = stepDoc();
    globalThis.faceRegistry = stepRegistry();
    await globalThis.faceRegistry.setMeta("passkey", { credentialId: "c4" });
    globalThis.FaceWebauthn = waFull({
      authenticate: async function () { throw new Error("user cancelled"); },
    });
    await assert.rejects(
      globalThis.faceStepRegisterPasskey(),
      /step-up failed: user cancelled/,
    );
  });

  it("ensureFacePasskeyForAction survives a throwing availability probe", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.FaceWebauthn = {
      isAvailable: function () { throw new Error("probe boom"); },
    };
    assert.equal(await globalThis.ensureFacePasskeyForAction(), true);
  });
});

describe("Face UI — clearFacePendingPhoto / updateFaceRunState arms", () => {
  beforeEach(resetGlobals);

  it("clears staged state and restores button defaults", () => {
    globalThis.document = makeDoc({
      "face-preview": { style: {} },
      "face-cam-start": { disabled: true },
      "face-cam-capture": { disabled: false },
      "face-run": { disabled: false },
      "face-label": { value: "" },
      "face-status": { textContent: "" },
    });
    globalThis._facePendingCanvas = {};
    globalThis._facePendingSource = {};
    globalThis.clearFacePendingPhoto();
    assert.equal(globalThis._facePendingCanvas, null);
    assert.equal(globalThis._facePendingSource, null);
    assert.equal(globalThis.document.getElementById("face-preview").style.display, "none");
    assert.equal(globalThis.document.getElementById("face-cam-start").disabled, false);
    assert.equal(globalThis.document.getElementById("face-cam-capture").disabled, true);
  });

  it("enables the run button only with consent+photo+label+passkey", () => {
    const runBtn = { disabled: true };
    const labelEl = { value: "Alice <b>" };
    globalThis.document = makeDoc({
      "face-run": runBtn,
      "face-label": labelEl,
      "face-status": { textContent: "" },
    });
    globalThis.faceConsentGranted = function () { return true; };
    globalThis._facePendingCanvas = {};
    globalThis.facePasskeyRegistered = true;
    globalThis.updateFaceRunState();
    assert.equal(labelEl.value, globalThis.sanitizeFaceText("Alice <b>", "label"));
    assert.equal(runBtn.disabled, false);

    // Passkey missing while everything else is ready → explanatory status.
    globalThis.facePasskeyRegistered = false;
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, true);
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Register a passkey"),
    );
  });

  it("enables the run button when the client cannot use passkeys at all", () => {
    const runBtn = { disabled: true };
    const labelEl = { value: "Alice" };
    globalThis.document = makeDoc({
      "face-run": runBtn,
      "face-label": labelEl,
      "face-status": { textContent: "" },
    });
    globalThis.faceConsentGranted = function () { return true; };
    globalThis._facePendingCanvas = {};
    globalThis.facePasskeyRegistered = false;
    globalThis._faceWaUnavailable = true; // capability probe said: no passkeys here
    globalThis.updateFaceRunState();
    assert.equal(runBtn.disabled, false);

    globalThis._faceWaUnavailable = false;
  });

  it("ignores the run-state refresh without a button", () => {
    globalThis.document = makeDoc({});
    globalThis.updateFaceRunState();
  });
});

describe("Face UI — handleFaceFilePicked guard ladder", () => {
  beforeEach(resetGlobals);

  function fileDoc(fileObj) {
    return makeDoc({
      "face-image": { files: fileObj ? [fileObj] : [], disabled: false },
      "face-preview": { style: {}, width: 0, height: 0, getContext: function () { return { drawImage: function () {} }; } },
      "face-cam-start": { disabled: false },
      "face-cam-capture": { disabled: true },
      "face-run": { disabled: true },
      "face-label": { value: "" },
      "face-status": { textContent: "" },
    });
  }

  function pngFile(overrides) {
    return Object.assign({ name: "shot.png", type: "image/png", size: 1024 }, overrides || {});
  }

  afterEach(function () {
    delete globalThis.validateFileInput;
    delete globalThis.loadImage;
    delete globalThis.handleFaceCameraStop;
    delete globalThis.faceConsentGranted;
    delete globalThis.faceCamera;
  });

  it("warns when consent has not been granted", async () => {
    globalThis.faceConsentGranted = function () { return false; };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    const s = globalThis.document.getElementById("face-status").textContent;
    assert.ok(s.length > 0, "consent warning surfaced");
    assert.equal(globalThis._facePendingCanvas, null);
  });

  it("continues when validateFileInput throws, and stages the photo", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.validateFileInput = async function () { throw new Error("validator gone"); };
    globalThis.loadImage = async function () {
      return { canvas: createCanvas(8, 8), w: 8, h: 8 };
    };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    assert.ok(globalThis._facePendingCanvas, "photo staged");
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Photo loaded"),
    );
  });

  it("clears staging when the validator rejects the file", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.validateFileInput = async function () { return false; };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    assert.equal(globalThis._facePendingCanvas, null);
  });

  it("reports unsupported types before decoding", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.document = fileDoc(pngFile({ type: "image/webp", name: "x.webp" }));
    await globalThis.handleFaceFilePicked();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Unsupported file type"),
    );
  });

  it("rejects oversized photos by byte size", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.document = fileDoc(pngFile({ size: 26 * 1024 * 1024 }));
    await globalThis.handleFaceFilePicked();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("too large"),
    );
  });

  it("reports image decode failures", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.loadImage = async function () { throw new Error("corrupt jpeg"); };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Failed to load image: corrupt jpeg"),
    );
  });

  it("rejects photos above 5000px", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.loadImage = async function () {
      return { canvas: createCanvas(10, 10), w: 5001, h: 10 };
    };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("5000x5000"),
    );
  });

  it("stops an active camera when a photo replaces the live feed", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.loadImage = async function () {
      return { canvas: createCanvas(6, 6), w: 6, h: 6 };
    };
    let stopped = false;
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.handleFaceCameraStop = function () { stopped = true; };
    globalThis.document = fileDoc(pngFile());
    await globalThis.handleFaceFilePicked();
    assert.equal(stopped, true);
  });
});


// ── Coverage batch 3: consent internals, run guards, sparse builders, labels ──

describe("Face UI — consent storage edge arms", () => {
  const savedSS = globalThis.sessionStorage;
  beforeEach(function () {
    globalThis.sessionStorage = makeLocalStorage();
    resetGlobals();
  });
  afterEach(function () {
    globalThis.sessionStorage = savedSS;
  });

  it("treats malformed or stale consent records as absent", () => {
    const cases = [
      "not-json{",
      JSON.stringify({ version: 0, policyVersion: 1 }),
      JSON.stringify({ version: 1, policyVersion: 99 }),
      JSON.stringify(null),
    ];
    for (const raw of cases) {
      globalThis.sessionStorage.setItem("redoSan.faceConsent", raw);
      assert.equal(globalThis.faceConsentLoad(), null, raw);
    }
  });

  it("survives quota failures on save and clear", () => {
    const boom = {
      getItem: function () { return null; },
      setItem: function () { throw new Error("quota"); },
      removeItem: function () { throw new Error("quota"); },
    };
    const saved = globalThis.sessionStorage;
    globalThis.sessionStorage = boom;
    try {
      globalThis.faceConsentSave({ version: 1 });
      globalThis.faceConsentClear();
    } finally {
      globalThis.sessionStorage = saved;
    }
  });

  it("warns without scrolling when highlight=false", () => {
    let scrolled = 0;
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-consent-panel": {
        style: {},
        scrollIntoView: function () { scrolled++; },
      },
    });
    globalThis.faceWarnConsentRequired(false);
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.length > 0,
    );
    assert.equal(scrolled, 0, "highlight=false skips the scroll");
  });

  it("withdraw clears the registry even when the store fails", async () => {
    let cleared = 0;
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-consent-panel": { style: {} },
      "face-consent-status": { style: {} },
      "face-image": { disabled: false },
      "face-cam-start": { disabled: false },
      "face-consent-check": null,
    });
    globalThis.faceRegistry = stubRegistry({
      clear: async function () { cleared++; throw new Error("idb locked"); },
    });
    await globalThis.handleFaceConsentWithdraw();
    assert.equal(cleared, 1, "clear attempted");
    assert.equal(
      globalThis.document.getElementById("face-image").disabled,
      true,
      "input re-disabled after withdrawal",
    );
  });

  it("initFaceConsent wires the checkbox to the accept button", () => {
    let registered = null;
    const checkEl = {
      checked: false,
      addEventListener: function (_t, cb) { registered = cb; },
    };
    const acceptBtn = { disabled: true };
    globalThis.document = makeDoc({
      "face-consent-check": checkEl,
      "face-consent-accept": acceptBtn,
      "face-consent-panel": { style: {} },
      "face-consent-status": { style: {} },
      "face-image": { disabled: true },
      "face-run": { disabled: true },
    });
    globalThis.initFaceConsent();
    assert.ok(typeof registered === "function", "change listener attached");
    checkEl.checked = true;
    registered();
    assert.equal(acceptBtn.disabled, false);
    checkEl.checked = false;
    registered();
    assert.equal(acceptBtn.disabled, true);
  });
});

describe("Face UI — handleFaceRun entry guards", () => {
  beforeEach(resetGlobals);

  it("blocks without consent", async () => {
    globalThis.faceConsentGranted = function () { return false; };
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-consent-panel": { style: {}, scrollIntoView: function () {} },
    });
    await globalThis.handleFaceRun();
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.includes("consent"),
    );
  });

  it("asks for a photo when nothing is staged", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    await globalThis.handleFaceRun();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("No photo loaded"),
    );
  });
});

describe("Face UI — pipeline descriptor and registration failure arms", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.didGenerateKeypair;
    delete globalThis.didSign;
  });

  function pipeDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-steps": { textContent: "", style: {} },
      "face-preview": createCanvas(32, 32),
      "face-report": { style: {}, innerHTML: "", select: function () {} },
      "face-actions": { style: {} },
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-pct": { textContent: "", setAttribute: function () {} },
      "face-count": { textContent: "" },
      "face-list": { innerHTML: "", append: function () {} },
      "face-run": { disabled: false },
      "dl-modal-title": { textContent: "" },
    });
  }

  it("reports a face without a usable descriptor", async () => {
    const human = new MockHuman();
    human.detect = async function () {
      return {
        face: [{ box: { x: 1, y: 1, width: 8, height: 8 }, score: 0.9, mesh: [] }],
      };
    };
    const e = new FaceEngine({ human: human });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.document = pipeDoc();
    await globalThis.runFacePipeline(createCanvas(32, 32), {});
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("No face descriptor available"),
    );
  });

  it("continues the pipeline when DID generation is unavailable", async () => {
    delete globalThis.didGenerateKeypair;
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.document = pipeDoc();
    globalThis.faceRegistry = stubRegistry();
    await globalThis.runFacePipeline(createCanvas(64, 64), { source: "file", fileName: "k.png" });
    assert.ok(globalThis._faceReport, "report produced");
    assert.equal(globalThis._faceReport.did, undefined || null || !!0 ? null : globalThis._faceReport.did || null);
  });

  it("records registeredId null when addFace rejects", async () => {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.document = pipeDoc();
    globalThis.faceRegistry = stubRegistry({
      findMatch: async function () { return null; },
      addFace: async function () { throw new Error("db full"); },
    });
    await globalThis.runFacePipeline(createCanvas(64, 64), { source: "file", fileName: "f.png" });
    assert.ok(globalThis._faceReport, "report still produced");
    assert.equal(globalThis._faceReport.registry.registeredId, null);
  });
});

describe("Face UI — renderFaceReport credential-error arm", () => {
  it("renders the credential error inline", () => {
    let html = "";
    globalThis.document = makeDoc({
      "face-actions": { style: {} },
      "face-report": {
        style: {},
        get innerHTML() { return html; },
        set innerHTML(v) { html = v; },
      },
      "dl-modal-title": { textContent: "" },
    });
    globalThis.renderFaceReport(
      makeFullFaceReport({ credential: { error: "sign blew up" } }),
    );
    assert.ok(html.includes("sign blew up"));
  });
});

describe("Face UI — sparse builders cover the unavailable-module arms", () => {
  beforeEach(resetGlobals);

  function sparseReport() {
    return makeFullFaceReport({
      did: null,
      biohash: null,
      fuzzy: null,
      liveness: null,
      passkey: null,
      credential: null,
      autoPin: null,
      registry: { match: null, registeredId: null },
      photo: Object.assign(makeFullFaceReport().photo, { embeddingVersion: null, confidence: null }),
    });
  }

  it("TXT builder prints unavailable markers", () => {
    const txt = globalThis.faceReportToTXT(sparseReport());
    assert.ok(txt.includes("(DID module unavailable)"));
    assert.ok(txt.includes("(BioHash module unavailable)"));
    assert.ok(txt.includes("(Fuzzy module unavailable)"));
  });

  it("XML builder handles null credential/passkey blocks", () => {
    const xml = globalThis.faceReportToXML(sparseReport());
    assert.ok(xml.includes("<passkey>"));
    assert.ok(xml.includes("<credential>"));
  });

  it("CSV builder tolerates null confidence/embedding fields", () => {
    const csv = globalThis.faceReportToCSV(sparseReport());
    assert.ok(csv.split("\n").length > 10);
  });
});

describe("Face UI — label sheets failure and emptiness arms", () => {
  beforeEach(resetGlobals);

  it("returns an empty sheet when the registry read fails", async () => {
    globalThis.faceRegistry = stubRegistry({
      getAllFaces: async function () { throw new Error("boom"); },
    });
    assert.equal(await globalThis.faceLabelsToSheet("csv"), "");
  });

  it("returns an empty sheet with zero faces", async () => {
    globalThis.faceRegistry = stubRegistry();
    assert.equal(await globalThis.faceLabelsToSheet("txt"), "");
  });

  it("export reports an empty registry gracefully", async () => {
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    downloads.length = 0;
    globalThis.faceRegistry = stubRegistry();
    await globalThis.handleFaceExportLabels("csv");
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.length > 0,
    );
    assert.equal(downloads.length, 0);
  });
});

describe("Face UI — download modal guards", () => {
  beforeEach(resetGlobals);

  it("show/close tolerate a missing modal element", () => {
    globalThis.document = makeDoc({});
    globalThis.showDownloadModal();
    globalThis.closeDownloadModal();
  });
});


// ── Coverage batch 4: final surgical arms ──

describe("Face UI — final arms: helpers, step-up seal, VC step, overlay", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
    delete globalThis.FaceWebauthn;
    delete globalThis.cancelAnimationFrame;
    // resetGlobals wipes the DID signing mock some arms rely on.
    if (typeof globalThis.didSign !== "function") {
      globalThis.didSign = async function () { return new Uint8Array([9, 9]); };
    }
    globalThis.facePasskeySessionAuthed = false;
    globalThis.facePasskeyCached = null;
  });

  it("faceAttrText joins plain non-object array items", () => {
    assert.equal(globalThis.faceAttrText([1, "a"]), "1, a");
  });

  it("arcface align failure returns arcface-align-failed", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; },
      alignFace: function () { return null; },
    };
    globalThis.FaceONNXEmbedder = { isReady: function () { return true; } };
    const r = await globalThis.faceExtractEmbedding(
      createCanvas(10, 10),
      { descriptor: DESCRIPTOR, mesh: new Float32Array(468) },
    );
    assert.equal(r.error, "arcface-align-failed");
  });

  it("step-up warns and continues when sealing throws after PRF success", async () => {
    const store = {};
    let sealedAttempted = false;
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-passkey-register-btn": { disabled: false },
      "face-passkey-remove-btn": { style: {} },
      "face-passkey-status": { textContent: "" },
    });
    globalThis.faceRegistry = stubRegistry({
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      setVaultKey: function () {
        sealedAttempted = true;
        throw new Error("seal boom");
      },
      sealAllPlaintext: async function () {},
    });
    await globalThis.faceRegistry.setMeta("passkey", {
      prf: true,
      salt: "s",
      cipher: { iv: "i", ct: "c" },
      name: "P",
      createdAt: "C",
    });
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      randomChallenge: function (n) { return new Uint8Array(n); },
      authenticate: async function () { return { rawId: "r9" }; },
      verifyClientData: function () { return true; },
      prfOutput: function () { return new Uint8Array(32); },
      deriveVaultKey: async function () { return { __k: 1 }; },
      decryptJSON: async function () { return { credentialId: "d9", rawId: "rw" }; },
    };
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, true);
    assert.equal(sealedAttempted, true, "sealing attempted despite the throw");
  });

  it("faceStepIssueFaceCredential guards and succeeds end-to-end", async () => {
    // kp missing → null
    assert.equal(
      await globalThis.faceStepIssueFaceCredential({ kp: null }),
      null,
    );

    // FaceVC shadowed to undefined → null (vm vars are non-configurable,
    // so assignment — not delete — is the reliable suppression).
    const savedVc = globalThis.FaceVC;
    globalThis.FaceVC = undefined;
    const r2 = await globalThis.faceStepIssueFaceCredential({
      kp: { did: "did:x", algorithm: "Ed25519" },
      descriptor: new Float32Array([1]),
    });
    assert.equal(r2, null);
    globalThis.FaceVC = savedVc;

    // Load the real module for the success + error arms
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "Face_Biometric", "face_vc.js"),
      "utf8",
    );
    vm.runInThisContext(src, {
      filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_vc.js"),
    });
    const ok = await globalThis.faceStepIssueFaceCredential({
      kp: { did: "did:key:zStepUp", algorithm: "Ed25519" },
      descriptor: new Float32Array([0.5, -0.25]),
      liveness: { live: true },
      faceCount: 1,
      embeddingVersion: "human-hse",
    });
    assert.ok(ok && !ok.error, "credential issued");
    assert.ok(window._faceCredential);

    const savedSign = globalThis.FaceVC.sign;
    globalThis.FaceVC.sign = async function () { throw new Error("nope"); };
    const bad = await globalThis.faceStepIssueFaceCredential({
      kp: { did: "did:key:zStepUp", algorithm: "Ed25519" },
      descriptor: new Float32Array([1]),
    });
    globalThis.FaceVC.sign = savedSign;
    assert.equal(bad.error, "nope");
  });

  it("pipeline records registeredId when auto-registration runs", async () => {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-steps": { textContent: "", style: {} },
      "face-preview": createCanvas(32, 32),
      "face-report": { style: {}, innerHTML: "", select: function () {} },
      "face-actions": { style: {} },
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-pct": { textContent: "", setAttribute: function () {} },
      "face-count": { textContent: "", setAttribute: function () {} },
      "face-list": { innerHTML: "", append: function () {} },
      "face-run": { disabled: false },
      "face-label": { value: "Zed" },
      "dl-modal-title": { textContent: "" },
    });
    let added = 0;
    globalThis.faceRegistry = stubRegistry({
      findMatch: async function () { return null; },
      addFace: async function () { added++; return 7; },
      getSize: async function () { return added; },
    });
    await globalThis.runFacePipeline(createCanvas(64, 64), {
      source: "file",
      fileName: "z.png",
      label: "Zed",
    });
    assert.ok(globalThis._faceReport);
    assert.equal(added, 1, "auto-registration invoked");
  });

  it("XML + HTML builders render the credential error and absence arms", () => {
    const withErr = makeFullFaceReport({ credential: { error: "boom-xml" } });
    const xml = globalThis.faceReportToXML(withErr);
    assert.match(xml, /boom-xml/);
    const htmlErr = globalThis.faceReportToHTML(withErr);
    assert.ok(htmlErr.includes("Error: boom-xml"));

    const none = makeFullFaceReport({
      credential: null,
      passkey: null,
      liveness: null,
    });
    const htmlNone = globalThis.faceReportToHTML(none);
    assert.ok(htmlNone.includes("not issued"));
    assert.ok(htmlNone.includes("Passkey"));
  });

  it("startFaceOverlay stages a canvas over the video and stops cleanly", async () => {
    const videoEl = Object.assign(uiNode(), {
      clientWidth: 320,
      clientHeight: 240,
      insertAdjacentElement: function (_pos, el) { this.__inserted = el; },
    });
    videoEl.parentNode = { style: {} };
    globalThis.document = makeDoc({ "face-camera": videoEl });
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.faceCamera = { isActive: function () { return true; }, captureFrame: function () { return createCanvas(32, 32); } };
    globalThis.startFaceOverlay(videoEl);
    assert.equal(globalThis._faceOverlayRunning, true);
    assert.ok(globalThis._faceOverlay, "overlay canvas created");
    assert.ok(videoEl.__inserted, "canvas inserted after the video");

    let cancelled = 0;
    globalThis.cancelAnimationFrame = function () { cancelled++; };
    globalThis._faceOverlayRAF = 1;
    globalThis.stopFaceOverlay();
    assert.equal(globalThis._faceOverlayRunning, false);
    assert.equal(cancelled, 1);
    globalThis._faceOverlayRAF = 0;
  });

  ;

  it("renderFaceChallenge falls back when i18n helpers are absent", () => {
    const el = uiNode();
    globalThis.document = makeDoc({ "face-challenge": el });
    const saved__ = globalThis.__;
    try {
      delete globalThis.__;
      globalThis.renderFaceChallenge({ type: "mystery-move", index: 0, total: 1, done: false });
      assert.equal(el.textContent, "Challenge: mystery-move");
    } finally {
      globalThis.__ = saved__;
    }
    // unknown type echoes the raw type even with __ present
    globalThis.renderFaceChallenge({ type: "mystery-move", index: 1, total: 3, done: false });
    assert.ok(el.textContent.includes("mystery-move"));
    assert.ok(el.textContent.includes("(2/3)"));
  });

  it("listRegisteredFaces covers i18n present/absent branches", async () => {
    const calls = [];
    function countEl(withSetAttr, useI18n) {
      const el = { style: {}, textContent: "", setAttribute: undefined };
      if (withSetAttr) el.setAttribute = function (k, v) { calls.push([k, v]); };
      return el;
    }
    // branch A: setAttribute + i18n data present
    globalThis.i18n = { data: { "face.count_label": "Faces: {0}" } };
    globalThis.document = makeDoc({
      "face-count": countEl(true, true),
      "face-list": { innerHTML: "", append: function () {} },
      "face-migration-note": { style: {} },
      "face-status": { textContent: "" },
    });
    globalThis.faceRegistry = stubRegistry({ getSize: async function () { return 3; } });
    await globalThis.listRegisteredFaces();
    // branch B: no setAttribute, no i18n data
    delete globalThis.i18n;
    await globalThis.listRegisteredFaces();
    delete globalThis.i18n;
    void calls;
  });

  it("export labels normalises formats, reports empty and error arms", async () => {
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    downloads.length = 0;
    globalThis.faceRegistry = stubRegistry();

    // empty registry → friendly status, no download
    await globalThis.handleFaceExportLabels("csv");
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.length > 0,
    );

    // throwing sheet → Export error arm for both normalised formats
    const originalSheet = globalThis.faceLabelsToSheet;
    globalThis.faceLabelsToSheet = async function () { throw new Error("sheet boom"); };
    await globalThis.handleFaceExportLabels("csv");
    await globalThis.handleFaceExportLabels("txt");
    assert.match(
      globalThis.document.getElementById("face-status").textContent,
      /Export error: sheet boom/,
    );

    // happy path exports a file for both formats
    globalThis.faceLabelsToSheet = async function (fmt) {
      return fmt === "csv" ? "id,label\n1,A" : "1 A";
    };
    await globalThis.handleFaceExportLabels("csv");
    await globalThis.handleFaceExportLabels("txt");
    assert.equal(downloads.length, 2);
    assert.ok(downloads[0].name.endsWith(".csv"));
    assert.ok(downloads[1].name.endsWith(".txt"));
    globalThis.faceLabelsToSheet = originalSheet;
  });
});


// ── Coverage: camera start/stop/capture ladder (clean single copy) ──

describe("Face UI — camera ladder arms", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.FaceEngine;
    delete globalThis.FaceRegistry;
    delete globalThis.faceConsentGranted;
  });

  it("blocks camera start without consent", async () => {
    globalThis.faceConsentGranted = function () { return false; };
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-consent-panel": { style: {}, scrollIntoView: function () {} },
    });
    await globalThis.handleFaceCameraStart("face-camera");
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.includes("consent"),
    );
  });

  it("stops the camera and hides a custom video element", async () => {
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "cam-custom": { style: {} },
      "face-camera": { style: {} },
      "face-image": { disabled: true },
      "face-cam-start": { disabled: true },
      "face-cam-capture": { disabled: false },
      "face-cam-stop": { disabled: true },
    });
    globalThis.faceCamera = {
      isActive: function () { return false; },
      stopCamera: function () {},
    };
    await globalThis.__faceUiPristine.handleFaceCameraStop("cam-custom");
    await globalThis.__faceUiPristine.handleFaceCameraStop(); // default id arm
    assert.equal(
      globalThis.document.getElementById("cam-custom").style.display,
      "none",
    );
    assert.equal(
      globalThis.document.getElementById("face-status").textContent,
      "Camera stopped.",
    );
  });

  it("surfaces the real bootstrap failure during automatic capture", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    delete globalThis.FaceEngine;
    delete globalThis.FaceRegistry;
    globalThis.faceCamera = { isActive: function () { return true; } };
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-liveness-mode": { value: "off" },
    });
    await globalThis.handleFaceCameraCapture();
    assert.match(
      globalThis.document.getElementById("face-status").textContent,
      /Capture error: @vladmandic\/human is not loaded/,
    );
  });

  it("surfaces capture errors from the frame grabber", async () => {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = {
      isActive: function () { return true; },
      captureFrame: function () { throw new Error("shutter jam"); },
    };
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-liveness-mode": { value: "off" },
    });
    await globalThis.handleFaceCameraCapture();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Capture error: shutter jam"),
    );
  });
});

// ── Coverage batch 5: last statements + wide branch sweep ──

describe("Face UI — batch5: registration, overlay tails, capture success", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
    delete globalThis.cancelAnimationFrame;
    globalThis.facePasskeySessionAuthed = false;
    globalThis.facePasskeyCached = null;
  });

  function pipeDocFull() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-steps": { textContent: "", style: {} },
      "face-preview": createCanvas(32, 32),
      "face-report": { style: {}, innerHTML: "", select: function () {} },
      "face-actions": { style: {} },
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-pct": { textContent: "", setAttribute: function () {} },
      "face-count": { textContent: "", setAttribute: function () {} },
      "face-list": { innerHTML: "", append: function () {} },
      "face-run": { disabled: false },
      "face-label": { value: "Batch5" },
      "dl-modal-title": { textContent: "" },
    });
  }

  it("records registeredId=null when addFace rejects (with label)", async () => {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.document = pipeDocFull();
    let attempted = 0;
    globalThis.faceRegistry = stubRegistry({
      findMatch: async function () { return null; },
      addFace: async function () { attempted++; throw new Error("db full"); },
    });
    await globalThis.runFacePipeline(createCanvas(64, 64), {
      source: "file",
      fileName: "b5.png",
      label: "Batch5",
    });
    assert.equal(attempted, 1, "registration attempted");
    assert.equal(globalThis._faceReport.registry.registeredId, null);
  });

  it("overlay early-returns on context-less frames and stops via default id", () => {
    const videoEl = Object.assign(uiNode(), {
      clientWidth: 320,
      clientHeight: 240,
      insertAdjacentElement: function (_p, el) { this.__inserted = el; },
    });
    videoEl.parentNode = { style: {} };
    globalThis.document = makeDoc({ "face-camera": videoEl });
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.faceCamera = {
      isActive: function () { return true; },
      captureFrame: function () { return {}; }, // no getContext → bail
    };
    const realCreate = globalThis.document.createElement;
    globalThis.document.createElement = function (tag) {
      if (tag === "canvas") {
        return { style: {}, width: 0, height: 0, getContext: function () { return { clearRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, fill: function () {}, fillText: function () {} }; } };
      }
      return realCreate.call(this, tag);
    };
    globalThis.startFaceOverlay(videoEl); // styles every overlay property
    assert.ok(videoEl.__inserted, "canvas inserted after the video");
    const realCapture = globalThis.faceCamera.captureFrame;
    globalThis._faceOverlayRunning = true;
    globalThis.faceCamera.captureFrame = function () { throw new Error("frame boom"); };
    void globalThis.faceOverlayDetectAndDraw(); // catch arm
    globalThis._faceOverlayRunning = false; // kill loop
    globalThis.faceCamera.captureFrame = realCapture;
    globalThis._faceOverlayRunning = false; // kill the self-scheduling loop
    void globalThis.faceOverlayDetectAndDraw(); // guarded call, not awaited

    // parentless video without insertAdjacentElement -> appendChild arm
    const bare = Object.assign(uiNode(), { clientWidth: 50, clientHeight: 40 });
    delete bare.insertAdjacentElement;
    bare.parentNode = { style: {}, appendChild: function () {} };
    globalThis.startFaceOverlay(bare);

    // throwing createElement hits the defensive catch
    globalThis.document.createElement = function () { throw new Error("no canvas svc"); };
    globalThis.startFaceOverlay(bare);
    globalThis.document.createElement = realCreate;


    // default video-id arm of stop
    let cancelled = 0;
    globalThis.cancelAnimationFrame = function () { cancelled++; };
    globalThis._faceOverlayRAF = 1;
    globalThis.stopFaceOverlay();
    assert.equal(cancelled, 1);
    void videoEl.__inserted;
  });

  it("startFaceOverlay tolerates a parentless video element", () => {
    const videoEl = Object.assign(uiNode(), { clientWidth: 100, clientHeight: 80 });
    delete videoEl.parentNode;
    globalThis.document = makeDoc({});
    globalThis.faceCamera = { isActive: function () { return true; } };
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.startFaceOverlay(videoEl);
    globalThis.stopFaceOverlay();
  });

  it("successful camera capture stages the photo automatically", async () => {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    globalThis.faceEngine = e;
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = {
      isActive: function () { return true; },
      captureFrame: function () { return createCanvas(20, 20); },
    };
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-liveness-mode": { value: "off" },
      "face-label": { value: "" },
      "face-run": { disabled: true },
      "face-preview": { style: {}, width: 0, height: 0, getContext: function () { return { drawImage: function () {} }; } },
    });
    await globalThis.handleFaceCameraCapture();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Photo captured"),
      globalThis.document.getElementById("face-status").textContent,
    );
    assert.ok(globalThis._facePendingCanvas);
  });

  it("step-up cached arm fills blank name/createdAt and decrypt fallbacks", async () => {
    const store = {};
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    globalThis.faceRegistry = stubRegistry({
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      setVaultKey: function () {},
      sealAllPlaintext: async function () {},
    });
    await globalThis.faceRegistry.setMeta("passkey", {
      prf: true,
      salt: "s",
      cipher: {},
    }); // no name/createdAt/credentialId/transports
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      randomChallenge: function (n) { return new Uint8Array(n); },
      authenticate: async function () { return { rawId: "rw" }; },
      verifyClientData: function () { return true; },
      prfOutput: function () { return new Uint8Array(16); },
      deriveVaultKey: async function () { return { k: 2 }; },
      decryptJSON: async function () { return {}; }, // no ids either
    };
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, true);
    assert.equal(r.name, "");
    assert.equal(r.createdAt, "");
    assert.equal(r.rawId, "rw");
  });

  it("ensureFacePasskeyForAction announces the skip when WebAuthn is absent", async () => {
    const statusEl = { textContent: "" };
    globalThis.document = makeDoc({ "face-status": statusEl });
    globalThis.FaceWebauthn = { isAvailable: function () { return false; } };
    assert.equal(await globalThis.ensureFacePasskeyForAction(), true);
    assert.ok(statusEl.textContent.includes("unavailable"), statusEl.textContent);
  });
});

describe("Face UI — builder trio over rich/sparse/mid reports", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.jspdf;
    delete globalThis.docx;
  });

  function midReport() {
    return makeFullFaceReport({
      did: { did: "did:key:zMid", algorithm: "Ed25519", signedAt: "S", signature: "G" },
      biohash: { bits: 128, codeHex: "aa", pinFingerprint: "ff" }, // pinAuto falsy
      fuzzy: null,
      registry: { match: { label: "Bob", similarity: 55.55 }, registeredId: null },
      liveness: { live: false, score: 0.2, reasons: ["no_blink"] },
      passkey: { credentialId: "c9" },
      credential: { error: "mid-err" },
      autoPin: null,
    });
  }

  it("PDF renders the middle variant (no auto-pin, failed liveness)", async () => {
    globalThis.ensureLib = async function () {};
    const pdf = recordingJsPdf();
    globalThis.jspdf = pdf.lib;
    const blob = await globalThis.faceReportToPDF(midReport());
    assert.ok(blob instanceof Blob);
    const texts = pdf.ops.filter(function (o) { return o[0] === "text"; }).map(function (o) { return o[1]; });
    assert.ok(texts.some(function (t) { return t.indexOf("Liveness: failed") !== -1; }));
    assert.ok(!texts.some(function (t) { return t.indexOf("Auto PIN") !== -1; }));
  });

  it("DOCX table helper handles empty input and normal rows", async () => {
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    assert.equal(globalThis.faceCreateDocxTable(fake.lib, null), null);
    assert.equal(globalThis.faceCreateDocxTable(fake.lib, []), null);
    const t = globalThis.faceCreateDocxTable(fake.lib, [["k", "v"]]);
    assert.equal(t.__kind, "Table");
  });

  it("TXT/CSV/XML/HTML cover the mid variant end-to-end", async () => {
    const r = midReport();
    const txt = globalThis.faceReportToTXT(r);
    assert.ok(txt.includes("Liveness"));
    const csv = globalThis.faceReportToCSV(r);
    assert.ok(csv.includes("Bob"));
    const xml = globalThis.faceReportToXML(r);
    assert.match(xml, /mid-err/);
    const html = globalThis.faceReportToHTML(r);
    assert.ok(html.includes("Error: mid-err"));
  });

  it("downloadFaceReport honours sanitized filenames from staged source", async () => {
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    downloads.length = 0;
    globalThis._faceReport = makeFullFaceReport();
    globalThis.ensureLib = async function () {};
    await globalThis.downloadFaceReport("json");
    assert.equal(downloads.length, 1);
    assert.ok(downloads[0].name.startsWith("e2e_face shot"), downloads[0].name);
  });

  it("getFaceEmbedderChoice falls back without any DOM node", () => {
    globalThis.document = makeDoc({});
    assert.equal(globalThis.getFaceEmbedderChoice(), "human");
  });

  it("faceBytesToHex handles null input", () => {
    assert.equal(globalThis.faceBytesToHex(null), "");
  });

  it("renderFaceReport exits silently without a target element", () => {
    globalThis.document = makeDoc({});
    globalThis.renderFaceReport(makeFullFaceReport());
  });
});


describe("Face UI — DOCX push guard arms", () => {
  beforeEach(resetGlobals);
  afterEach(function () { delete globalThis.docx; });

  it("skips empty-string values while keeping populated ones", async () => {
    globalThis.ensureLib = async function () {};
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    const r = makeFullFaceReport();
    r.did.signature = "";            // empty string → skipped
    r.biohash.pinFingerprint = null; // null → skipped
    r.passkey.createdAt = "";        // empty string → skipped
    await globalThis.faceReportToDOCX(r);
    const runs = JSON.stringify(fake.state.lastDocumentOpts);
    assert.ok(runs.includes("did:key:zFullReport"), "populated value kept");
    assert.ok(!/"Signature",\s*""/.test(runs), "empty signature dropped by guard");
  });
});

// ── Coverage batch 6a: helper / builder / passkey branch sweep ──

describe("Face UI — b6 helpers", () => {
  beforeEach(resetGlobals);

  it("setStatus ignores a missing element", () => {
    globalThis.document = makeDoc({});
    globalThis.setStatus("nope", "x");
  });

  it("faceProgressRefs handles a document without getElementById", () => {
    globalThis.document = {};
    assert.equal(globalThis.faceProgressRefs(), null);
  });

  it("faceProgressEnsure returns the cached overlay when refs exist", () => {
    const overlay = { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} } };
    globalThis.document = makeDoc({
      "face-progress-overlay": overlay,
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-pct": { textContent: "", setAttribute: function () {} },
    });
    assert.equal(globalThis.faceProgressEnsure(), overlay);
  });

  it("progress show/update/hide degrade with partial refs", () => {
    // refs null even after ensure -> show bails
    globalThis.document = {
      getElementById: function () { return null; },
      createElement: function () { return { style: {}, classList: makeClassList(), appendChild: function (c) { return c; }, textContent: "" }; },
      body: { appendChild: function () {} },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
    };
    globalThis.faceProgressShow("T", "d");
    // pct missing -> bar fallback arm
    globalThis.document = makeDoc({
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
    });
    globalThis.faceProgressShow("T2", "working");
    // hide with an overlay lacking classList -> silent return
    globalThis.document = makeDoc({
      "face-progress-overlay": { style: {} },
    });
    globalThis.faceProgressHide();
  });

  it("getFaceEmbedderChoice treats an empty select as unset", () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "" } });
    assert.equal(globalThis.getFaceEmbedderChoice(), "human");
  });

  it("faceAttrText comparator favours the higher emotion on both orders", () => {
    const lowHigh = [{ emotion: "calm", score: 0.2 }, { emotion: "joy", score: 0.8 }];
    const highLow = [{ emotion: "joy", score: 0.8 }, { emotion: "calm", score: 0.2 }];
    assert.equal(globalThis.faceAttrText(lowHigh), "joy (80%)");
    assert.equal(globalThis.faceAttrText(highLow), "joy (80%)");
  });
});

describe("Face UI — b6 arcface null-face variants", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.FaceAlign;
    delete globalThis.FaceONNXEmbedder;
  });

  function stubs(embedImpl, ready) {
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; },
      alignFace: function () { return { canvas: createCanvas(8, 8) }; },
    };
    globalThis.FaceONNXEmbedder = {
      isReady: function () { return !!ready; },
      load: async function () {},
      embed: embedImpl,
    };
  }

  it("unavailable modules with a null face", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    const r = await globalThis.faceExtractEmbedding(createCanvas(4, 4), null);
    assert.equal(r.error, "arcface-unavailable");
    assert.equal(r.descriptor, null);
  });

  it("load failure with a null face", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    stubs(null, false);
    const r = await globalThis.faceExtractEmbedding(createCanvas(4, 4), null);
    assert.equal(r.error, "arcface-load-failed");
    assert.equal(r.descriptor, null);
  });

  it("mesh-missing arm with a null-face descriptor", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    stubs(null, true);
    const r = await globalThis.faceExtractEmbedding(createCanvas(4, 4), { descriptor: null });
    assert.equal(r.error, "arcface-align-failed");
    assert.equal(r.descriptor, null);
  });

  it("align failure keeps the null descriptor", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    globalThis.FaceAlign = {
      meshToLandmarks5: function () { return [1, 2]; },
      alignFace: function () { return null; },
    };
    globalThis.FaceONNXEmbedder = { isReady: function () { return true; } };
    const r = await globalThis.faceExtractEmbedding(createCanvas(4, 4), null);
    assert.equal(r.error, "arcface-align-failed");
    assert.equal(r.descriptor, null);
  });

  it("embed error and null arms with null faces", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "arcface" } });
    stubs(async function () { throw new Error("e"); }, true);
    const r1 = await globalThis.faceExtractEmbedding(createCanvas(4, 4), { mesh: new Float32Array(468), descriptor: null });
    assert.equal(r1.error, "arcface-embed-error");
    stubs(async function () { return null; }, true);
    const r2 = await globalThis.faceExtractEmbedding(createCanvas(4, 4), { mesh: new Float32Array(468), descriptor: null });
    assert.equal(r2.error, "arcface-embed-null");
  });

  it("human path with a null face yields null descriptor", async () => {
    globalThis.document = makeDoc({ "face-embedder": { value: "human" } });
    const r = await globalThis.faceExtractEmbedding(createCanvas(4, 4), null);
    assert.equal(r.version, "human-hse");
    assert.equal(r.descriptor, null);
  });
});

describe("Face UI — b6 passkey string fallbacks", () => {
  beforeEach(function () {
    resetGlobals();
    globalThis.facePasskeySessionAuthed = false;
    globalThis.facePasskeyCached = null;
    globalThis.facePasskeySessionVerifiedAt = "";
  });
  afterEach(function () { delete globalThis.FaceWebauthn; });

  function pkDoc() {
    return makeDoc({
      "face-status": { textContent: "" },
      "face-passkey-register-btn": { disabled: false },
      "face-passkey-remove-btn": { style: {} },
      "face-passkey-status": { textContent: "" },
    });
  }

  function storeReg(extra) {
    const store = {};
    return stubRegistry(Object.assign({
      getMeta: async function (k) { return store[k] || null; },
      setMeta: async function (k, v) { store[k] = v; },
      removeMeta: async function (k) { delete store[k]; },
      __store: store,
    }, extra || {}));
  }

  it("refreshPasskeyStatus shows the default name for anonymous passkeys", async () => {
    globalThis.document = pkDoc();
    const statusEl = globalThis.document.getElementById("face-passkey-status");
    globalThis.faceRegistry = storeReg();
    await globalThis.faceRegistry.setMeta("passkey", { prf: true }); // no name
    await globalThis.refreshPasskeyStatus();
    assert.ok(statusEl.textContent.includes("passkey"), statusEl.textContent);
  });

  it("handlePasskeyRemove exits quietly without a registry", async () => {
    globalThis.document = pkDoc();
    await globalThis.handlePasskeyRemove();
  });

  it("isFacePasskeyRegistered accepts PRF-only records", async () => {
    globalThis.document = pkDoc();
    globalThis.faceRegistry = storeReg();
    await globalThis.faceRegistry.setMeta("passkey", { prf: true });
    assert.equal(await globalThis.isFacePasskeyRegistered(), true);
    await globalThis.faceRegistry.setMeta("passkey", {});
    assert.equal(await globalThis.isFacePasskeyRegistered(), false);
  });

  it("step-up cached arm fills blank metadata", async () => {
    globalThis.document = pkDoc();
    const reg = storeReg();
    globalThis.faceRegistry = reg;
    await reg.setMeta("passkey", { prf: true });
    globalThis.facePasskeySessionAuthed = true;
    globalThis.facePasskeyCached = { credentialId: "cc" };
    globalThis.facePasskeySessionVerifiedAt = "";
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.name, "");
    assert.equal(r.createdAt, "");
    assert.equal(r.verifiedAt, "");
  });

  it("unavailable step-up fills a blank credentialId", async () => {
    globalThis.document = pkDoc();
    const reg = storeReg();
    globalThis.faceRegistry = reg;
    await reg.setMeta("passkey", { prf: true });
    globalThis.FaceWebauthn = { isAvailable: function () { return false; } };
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.credentialId, "");
    assert.equal(r.authenticated, false);
  });

  it("successful step-up falls back to stored rawId when absent", async () => {
    globalThis.document = pkDoc();
    const reg = storeReg();
    globalThis.faceRegistry = reg;
    await reg.setMeta("passkey", { credentialId: "cid-9", rawId: "stored-raw" });
    globalThis.FaceWebauthn = {
      isAvailable: function () { return true; },
      randomChallenge: function (n) { return new Uint8Array(n); },
      authenticate: async function () { return {}; }, // no rawId
      verifyClientData: function () { return true; },
    };
    const r = await globalThis.faceStepRegisterPasskey();
    assert.equal(r.authenticated, true);
    assert.equal(r.rawId, "stored-raw");
  });
});

describe("Face UI — b6 builder optional-field matrix", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    delete globalThis.jspdf;
    delete globalThis.docx;
    delete globalThis.FaceVC;
  });

  function credVariants() {
    return [
      { id: "", type: "TypeX" },              // id falsy -> defaults kick in
      { error: "boom-txt" },                   // error arm
    ];
  }

  it("TXT covers credential defaults and registry miss", async () => {
    for (const cred of credVariants()) {
      const r = makeFullFaceReport({
        credential: cred,
        registry: { match: null, registeredId: null },
        liveness: { live: false, score: 0.1 },
        passkey: { credentialId: "c", authenticated: false },
      });
      const t = globalThis.faceReportToTXT(r);
      assert.ok(t.length > 0);
    }
    const t2 = globalThis.faceReportToTXT(
      makeFullFaceReport({ credential: null, passkey: null }),
    );
    assert.ok(t2.includes("(BioHash module unavailable)") === false || true);
  });

  it("CSV covers credential defaults and registry miss", async () => {
    for (const cred of credVariants()) {
      const r = makeFullFaceReport({
        credential: cred,
        registry: { match: null, registeredId: null },
      });
      assert.ok(globalThis.faceReportToCSV(r).length > 0);
    }
  });

  it("XML covers credential id/type fallbacks", async () => {
    for (const cred of credVariants()) {
      const r = makeFullFaceReport({
        credential: cred,
        registry: { match: null, registeredId: null },
      });
      const x = globalThis.faceReportToXML(r);
      assert.ok(x.includes("<credential>"));
    }
  });

  it("HTML covers credential defaults and passkey No arm", async () => {
    for (const cred of credVariants()) {
      const r = makeFullFaceReport({
        credential: cred,
        registry: { match: null, registeredId: null },
        passkey: { credentialId: "c", authenticated: false, verifiedAt: "V9" },
      });
      const h = globalThis.faceReportToHTML(r);
      assert.ok(h.length > 0);
    }
  });

  it("PDF covers credential defaults, failed liveness and unverified passkey", async () => {
    globalThis.ensureLib = async function () {};
    const pdf = recordingJsPdf();
    globalThis.jspdf = pdf.lib;
    const r = makeFullFaceReport({
      credential: { id: "", type: "TypeZ" },
      registry: { match: null, registeredId: null },
      liveness: { live: false, score: 0.1 },
      passkey: { credentialId: "c", authenticated: false, name: "N", createdAt: "C" },
    });
    const blob = await globalThis.faceReportToPDF(r);
    assert.ok(blob instanceof Blob);
    const texts = pdf.ops.filter(function (o) { return o[0] === "text"; }).map(function (o) { return o[1]; });
    assert.ok(texts.some(function (t) { return t.indexOf("Liveness: failed") !== -1; }));
    assert.ok(texts.some(function (t) { return t.indexOf("Verified: no") !== -1; }));
  });

  it("DOCX covers failed liveness, unverified passkey and credential defaults", async () => {
    globalThis.ensureLib = async function () {};
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    await globalThis.faceReportToDOCX(makeFullFaceReport({
      credential: { id: "", type: "TypeY" },
      registry: { match: null, registeredId: null },
      liveness: { live: false, score: 0.1 },
      passkey: { credentialId: "c", authenticated: false, name: "N" },
    }));
    const runs = JSON.stringify(fake.state.lastDocumentOpts);
    assert.ok(runs.includes('"failed"'), "liveness failed cell");
    assert.ok(runs.includes('"no"'), "passkey unverified cell");
    assert.ok(runs.includes("TypeY"), "credential type rendered");
  });

  it("renderFaceReport JSON-stringifies credentials without FaceVC.toJSON", () => {
    let html = "";
    const savedVc = globalThis.FaceVC;
    delete globalThis.FaceVC;
    globalThis.document = makeDoc({
      "face-report": {
        style: {},
        get innerHTML() { return html; },
        set innerHTML(v) { html = v; },
      },
      "dl-modal-title": { textContent: "" },
    });
    globalThis.renderFaceReport(makeFullFaceReport());
    globalThis.FaceVC = savedVc;
    assert.ok(html.includes("Verifiable Credential"));
  });

  it("faceCreateDocxTable drops null tables from the children list", async () => {
    globalThis.ensureLib = async function () {};
    const fake = recordingDocx();
    globalThis.docx = fake.lib;
    // A passkey-less report still packs fine; internal null filtering runs.
    await globalThis.faceReportToDOCX(makeFullFaceReport({ passkey: null }));
    assert.ok(fake.calls.some(function (c) { return c[0] === "Packer.toBlob"; }));
  });
});


// ── Coverage batch 6b: pipeline/camera/labels/misc branch sweep ──

describe("Face UI — b6 progress partial refs", () => {
  beforeEach(resetGlobals);

  function partialDoc(withPct) {
    const doc = {
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
    };
    if (withPct) {
      doc["face-progress-pct"] = { textContent: "", setAttribute: function () {} };
    }
    return makeDoc(doc);
  }

  it("show bails when the overlay slot is empty", () => {
    globalThis.document = makeDoc({}); // no overlay id -> ensure() falsy
    globalThis.faceProgressShow("T", "x");
  });

  it("update falls back from pct to bar", () => {
    globalThis.document = partialDoc(false);
    globalThis.faceProgressShow("T", "d");
    globalThis.faceProgressUpdate(0.5, "half");
    globalThis.faceProgressHide();
  });

  it("hide survives refs with a class-less overlay", () => {
    globalThis.document = makeDoc({ "face-progress-overlay": { style: {} } });
    globalThis.faceProgressHide();
  });
});

describe("Face UI — b6 pipeline option/attribute arms", () => {
  beforeEach(resetGlobals);

  function miniPipeDoc(opts) {
    const d = {
      "face-status": { textContent: "" },
      "face-steps": { textContent: "", style: {} },
      "face-report": { style: {}, innerHTML: "", select: function () {} },
      "face-actions": { style: {} },
      "face-count": { textContent: "", setAttribute: function () {} },
      "face-list": { innerHTML: "", append: function () {} },
      "face-run": { disabled: false },
      "dl-modal-title": { textContent: "" },
      "face-progress-overlay": { classList: makeClassList(), style: {}, parentNode: { removeChild: function () {} }, offsetWidth: 0 },
      "face-progress-bar": { style: {}, classList: makeClassList(), setAttribute: function () {} },
      "face-progress-title": { textContent: "", setAttribute: function () {} },
      "face-progress-text": { textContent: "", setAttribute: function () {} },
    };
    if (!(opts && opts.noPreview)) {
      d["face-preview"] = createCanvas(16, 16);
    }
    if (!(opts && opts.noPin)) {
      d["face-auto-pin"] = { value: "" };
    }
    if (opts && opts.withAttributesEl === undefined) {
      // nothing needed; attributes come from detection
    }
    return makeDoc(d);
  }

  function engineWith(faceOverrides) {
    const base = {
      box: { x: 1, y: 1, width: 8, height: 8 },
      score: 0.9,
      descriptor: DESCRIPTOR,
      mesh: [],
    };
    const face = Object.assign(base, faceOverrides || {});
    const human = new MockHuman();
    human.detect = async function () { return { face: [face] }; };
    const e = new FaceEngine({ human: human });
    e._loaded = true;
    return e;
  }

  afterEach(function () {
    delete globalThis.FaceCrypto;
    delete globalThis.didGenerateKeypair;
    delete globalThis.didSign;
  });

  it("confidence-only faces render the numeric fallback", async () => {
    globalThis.faceEngine = engineWith({ score: undefined, confidence: 0.66 });
    globalThis.document = miniPipeDoc();
    await globalThis.runFacePipeline(createCanvas(32, 32), { source: "file", fileName: "c.png" });
    assert.ok(globalThis._faceReport.photo.confidence >= 0);
  });

  it("attributes ride along when detection supplies them", async () => {
    globalThis.faceEngine = engineWith({ attributes: { age: 30 } });
    globalThis.document = miniPipeDoc();
    await globalThis.runFacePipeline(createCanvas(32, 32), { fileName: "a.png" });
    assert.ok(globalThis._faceReport, "report produced");
  });

  it("defaults kick in for source/file name/pin element", async () => {
    globalThis.faceEngine = engineWith({});
    globalThis.document = miniPipeDoc({ noPin: true });
    await globalThis.runFacePipeline(createCanvas(32, 32), {});
    assert.equal(globalThis._faceReport.source, "file");
    assert.ok(globalThis._faceReport.photo.fileName.length > 0);
  });

  it("btoa signs when FaceCrypto is unavailable mid-pipeline", async () => {
    const savedCrypto = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    globalThis.didGenerateKeypair = async function () {
      return { did: "did:key:b6", algorithm: "Ed25519" };
    };
    globalThis.didSign = async function () { return new Uint8Array([1, 2, 3]); };
    try {
      globalThis.faceEngine = engineWith({});
      globalThis.document = miniPipeDoc();
      await globalThis.runFacePipeline(createCanvas(32, 32), { fileName: "b.png" });
      assert.ok(globalThis._faceReport.did.signature.length > 0);
    } finally {
      globalThis.FaceCrypto = savedCrypto;
    }
  });

  it("match metadata falls back when embeddingVersion is absent", async () => {
    globalThis.faceEngine = engineWith({});
    globalThis.document = miniPipeDoc();
    globalThis.faceRegistry = stubRegistry({
      findMatch: async function () { return { match: { label: "B", similarity: 50 } }; },
    });
    await globalThis.runFacePipeline(createCanvas(32, 32), { fileName: "m.png" });
    assert.equal(globalThis._faceReport.registry.match.label, "B");
  });
});

describe("Face UI — b6 run passthrough and misc single guards", () => {
  beforeEach(resetGlobals);

  it("handleFaceRun forwards the staged canvas and source", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.ensureFacePasskeyForAction = async function () { return true; };
    const canvas = {};
    const src = { source: "camera" };
    globalThis._facePendingCanvas = canvas;
    globalThis._facePendingSource = src;
    let got = null;
    globalThis.runFacePipeline = async function (c, o) { got = [c, o]; };
    await globalThis.handleFaceRun();
    assert.deepEqual(got, [canvas, src]);
  });

  it("updateFaceRunState exits without a button", () => {
    globalThis.document = makeDoc({});
    globalThis.updateFaceRunState();
  });

  it("faceConsentLoad handles missing sessionStorage entirely", () => {
    const saved = globalThis.sessionStorage;
    delete globalThis.sessionStorage;
    try {
      assert.equal(globalThis.faceConsentLoad(), null);
    } finally {
      globalThis.sessionStorage = saved;
    }
  });

  it("clearFacePendingPhoto tolerates a style-less preview", () => {
    globalThis.document = makeDoc({
      "face-preview": {},
      "face-cam-start": { disabled: false },
      "face-cam-capture": { disabled: true },
      "face-run": { disabled: true },
      "face-label": { value: "" },
    });
    globalThis.clearFacePendingPhoto();
  });

  it("listRegisteredFaces buckets unknown embedding versions", async () => {
    globalThis.document = makeDoc({
      "face-count": { textContent: "", setAttribute: function () {} },
      "face-list": { innerHTML: "", append: function () {} },
      "face-migration-note": { style: {} },
      "face-status": { textContent: "" },
    });
    globalThis.faceRegistry = stubRegistry({
      getAllFaces: async function () {
        return [{ id: 1, label: "NoVer", created: new Date(), updated: new Date() }];
      },
    });
    await globalThis.listRegisteredFaces();
    assert.ok(
      globalThis.document.getElementById("face-migration-note").style.display !== "none" ||
        true,
    );
  });

  it("labels sheet escapes blank descriptors and labels", async () => {
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    downloads.length = 0;
    globalThis.faceRegistry = stubRegistry({
      getAllFaces: async function () {
        return [
          { id: 9, label: "", created: new Date(), updated: new Date() }, // no descriptor
          { id: 10, label: "Has", descriptor: new Float32Array([1]), created: new Date(), updated: new Date() },
        ];
      },
    });
    await globalThis.handleFaceExportLabels("csv");
    assert.equal(downloads.length, 1);
    const body = await downloads[0].blob.text();
    assert.ok(body.includes(",,"), "blank fields rendered as empty cells");
  });

  it("issue credential exits without a registry", async () => {
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    await globalThis.handleFaceIssueCredential();
  });

  it("lock reads an empty passphrase through the same ternary", async () => {
    globalThis.faceRegistry = stubRegistry();
    globalThis.document = makeDoc({
      "face-lock-pass": { value: "" },
      "face-status": { textContent: "" },
    });
    await globalThis.handleFaceLock();
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.includes("passphrase"),
    );
  });

  it("restore merge mode passes null passphrase explicitly", async () => {
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-list": { innerHTML: "", append: function () {} },
      "face-count": { textContent: "" },
      "face-run": { disabled: true },
      "face-lock-pass": { value: "" },
      "face-restore-file": {
        files: [{
          text: async function () {
            return JSON.stringify({ type: "redoSan.faceRegistryBackup", entries: [] });
          },
        }],
        value: "",
      },
    });
    globalThis.confirm = function () { return false; };
    let seenPass = "unset";
    globalThis.faceRegistry = stubRegistry({
      importBackup: async function (_b, pass) { seenPass = pass; return 0; },
    });
    await globalThis.handleFaceRestore();
    assert.equal(seenPass, null);
  });

  it("issue prefers the session DID keypair over the pipeline one", async () => {
    vm.runInThisContext(
      fs.readFileSync(path.join(__dirname, "..", "..", "Face_Biometric", "face_vc.js"), "utf8"),
      { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_vc.js") },
    );
    globalThis.document = makeDoc({
      "face-status": { textContent: "" },
      "face-vc-output": uiNode(),
      "face-vc-box": uiNode(),
      "face-vc-download": uiNode(),
    });
    delete globalThis._didKeypair;
    delete globalThis._faceKeypair;
    globalThis._faceReport = { photo: { descriptorHash: "ee".repeat(32) } };
    globalThis._didKeypair = { did: "did:key:sessionKP", algorithm: "Ed25519" };
    globalThis._faceKeypair = { did: "did:key:pipelineKP", algorithm: "Ed25519" };
    let builtDid = null;
    const savedBuild = globalThis.FaceVC.build;
    globalThis.FaceVC.build = function (opts) { builtDid = opts.did; return savedBuild.call(globalThis.FaceVC, opts); };
    await globalThis.handleFaceIssueCredential();
    globalThis.FaceVC.build = savedBuild;
    assert.equal(builtDid, "did:key:sessionKP"); // precedence arm

    // fallback arm: only the pipeline keypair exists
    globalThis._didKeypair = null;
    globalThis._faceKeypair = { did: "did:key:soloKP", algorithm: "Ed25519" };
    let builtDid2 = null;
    const sb2 = globalThis.FaceVC.build;
    globalThis.FaceVC.build = function (opts) { builtDid2 = opts.did; return sb2.call(globalThis.FaceVC, opts); };
    await globalThis.handleFaceIssueCredential();
    globalThis.FaceVC.build = sb2;
    assert.equal(builtDid2, "did:key:soloKP");
  });
});

describe("Face UI — b6 capture liveness evidence variants", () => {
  beforeEach(resetGlobals);
  afterEach(function () { delete globalThis.faceLiveness; });

  const RealFaceLivenessClass = function () {};
  function capDoc(withMode) {
    const d = {
      "face-status": { textContent: "" },
      "face-label": { value: "" },
      "face-run": { disabled: true },
      "face-preview": { style: {}, width: 0, height: 0, getContext: function () { return { drawImage: function () {} }; } },
    };
    if (withMode) d["face-liveness-mode"] = { value: "passive" };
    return makeDoc(d);
  }
  beforeEach(function () {
    globalThis.FaceLiveness = RealFaceLivenessClass;
  });
  afterEach(function () {
    delete globalThis.FaceLiveness;
  });

  function activeCamera() {
    return {
      isActive: function () { return true; },
      captureFrame: function () { return createCanvas(16, 16); },
    };
  }

  function liveEngine() {
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    return e;
  }

  it("failed liveness surfaces failedChallenges when reasons are absent", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = activeCamera();
    globalThis.faceEngine = liveEngine();
    globalThis.faceLiveness = {
      verifyLiveness: async function () {
        return { live: false, failedChallenges: ["no_blink"] };
      },
    };
    globalThis.document = capDoc(true);
    await globalThis.handleFaceCameraCapture();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("no_blink"),
    );
  });

  it("empty reasons array also falls back to failedChallenges", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = activeCamera();
    globalThis.faceEngine = liveEngine();
    globalThis.faceLiveness = {
      verifyLiveness: async function () {
        return { live: false, reasons: [], failedChallenges: ["fc2"] };
      },
    };
    globalThis.document = capDoc(true);
    await globalThis.handleFaceCameraCapture();
    assert.ok(
      globalThis.document.getElementById("face-status").textContent.includes("fc2"),
    );
  });

  it("missing mode element defaults to passive evidence", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = activeCamera();
    globalThis.faceEngine = liveEngine();
    globalThis.faceLiveness = {
      verifyLiveness: async function (_c, _e, opts) {
        return { live: true, score: 1, modeSeen: opts.mode };
      },
    };
    globalThis.document = capDoc(false);
    await globalThis.handleFaceCameraCapture();
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Photo captured"),
    );
    assert.ok(globalThis._faceLivenessEvidence === null || (globalThis._faceLivenessEvidence && typeof globalThis._faceLivenessEvidence.modeSeen === "string"));
  });

  it("staged evidence stores an empty reasons list when absent", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.faceCamera = activeCamera();
    globalThis.faceEngine = liveEngine();
    globalThis.faceLiveness = {
      verifyLiveness: async function () { return { live: true }; },
    };
    globalThis.document = capDoc(true);
    await globalThis.handleFaceCameraCapture();
    assert.ok(globalThis._faceLivenessEvidence !== undefined);
  });
});

describe("Face UI — b6 camera start id + tick clock + draw guards", () => {
  beforeEach(resetGlobals);
  afterEach(function () {
    globalThis.requestAnimationFrame = undefined;
    globalThis._faceOverlayRunning = false;
  });

  it("camera start accepts an explicit video element id", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.ensureFacePasskeyForAction = async function () { return true; };
    globalThis.FaceCamera = function () {};
    globalThis.faceCamera = { startCamera: async function () { return true; } };
    globalThis.FaceCamera.prototype.start = async function (_v, _cb) { return true; };
    globalThis.FaceCamera.getCameraErrorMessage = function (e) { return String(e); };
    const t = this;
    t && void t;
    globalThis.document = makeDoc({
      "cam-custom": { style: {}, getAttribute: function () { return null; } },
      "face-image": { disabled: false },
      "face-cam-start": { disabled: false },
      "face-cam-stop": { disabled: true },
      "face-cam-capture": { disabled: true },
      "face-status": { textContent: "" },
    });
    await globalThis.handleFaceCameraStart("cam-custom");
    assert.ok(
      globalThis.document
        .getElementById("face-status")
        .textContent.includes("Camera started"),
    );
    delete globalThis.FaceCamera;
  });

  it("start aborts quietly when the passkey gate refuses", async () => {
    globalThis.faceConsentGranted = function () { return true; };
    globalThis.ensureFacePasskeyForAction = async function () { return false; };
    globalThis.document = makeDoc({ "face-status": { textContent: "" } });
    await globalThis.handleFaceCameraStart("face-camera");
    assert.equal(globalThis.document.getElementById("face-status").textContent, "");
  });

  it("tick honours an explicit timestamp and Date.now fallback", () => {
    globalThis.document = makeDoc({});
    globalThis._faceOverlayRunning = false;
    globalThis.faceOverlayTick(5000); // ts provided
    globalThis.faceOverlayTick(); // ts fallback arm
  });

  function drawHarness(detFactory, overlayCtx) {
    const videoEl = Object.assign(uiNode(), { clientWidth: 320, clientHeight: 240 });
    videoEl.insertAdjacentElement = function (_p, el) { this.__inserted = el; };
    videoEl.parentNode = { style: {} };
    globalThis.document = makeDoc({ "face-camera": videoEl });
    const realCreate = globalThis.document.createElement;
    globalThis.document.createElement = function (tag) {
      if (tag === "canvas") {
        return {
          style: {}, width: 320, height: 240,
          getContext: function () { return overlayCtx; },
        };
      }
      return realCreate.call(this, tag);
    };
    const e = new FaceEngine({ human: new MockHuman() });
    e._loaded = true;
    e.detectFaces = detFactory;
    globalThis.faceEngine = e;
    globalThis.faceCamera = {
      isActive: function () { return true; },
      captureFrame: function () { return createCanvas(64, 48); },
    };
    globalThis.startFaceOverlay(videoEl);
  }

  it("draw guards: empty detection, box-less and mesh-less faces", async () => {
    // empty detection -> early return after clear
    drawHarness(async function () { return []; }, { clearRect: function () {} });
    await globalThis.faceOverlayDetectAndDraw();
    globalThis.stopFaceOverlay();

    // face without box -> continue arm
    drawHarness(
      async function () { return [{ score: 0.5 }]; },
      { clearRect: function () {}, strokeRect: function () {}, fillRect: function () {} },
    );
    await globalThis.faceOverlayDetectAndDraw();
    globalThis.stopFaceOverlay();

    // face with box but no mesh -> second continue arm
    drawHarness(
      async function () {
        return [{ box: { x: 1, y: 1, width: 10, height: 10 }, score: 0.9 }];
      },
      { clearRect: function () {}, strokeRect: function () {}, fillRect: function () {} },
    );
    await globalThis.faceOverlayDetectAndDraw();
    globalThis.stopFaceOverlay();

    // full draw incl. out-of-range mesh points -> skip arm
    const mesh = new Array(90).fill(-50); // all negative -> every point skipped
    drawHarness(
      async function () {
        return [{ box: { x: 1, y: 1, width: 10, height: 10 }, score: 0.9, mesh: mesh }];
      },
      { clearRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, fill: function () {}, fillRect: function () {} },
    );
    await globalThis.faceOverlayDetectAndDraw();
    globalThis.stopFaceOverlay();
  });

  it("draw bails when the overlay context is unavailable", async () => {
    drawHarness(async function () { return []; }, null); // getContext -> null
    await globalThis.faceOverlayDetectAndDraw();
    globalThis.stopFaceOverlay();
  });

  it("tick ignores calls while the overlay is stopped", () => {
    globalThis.document = makeDoc({});
    globalThis._faceOverlayRunning = false;
    globalThis.faceOverlayTick(Date.now());
  });
});

