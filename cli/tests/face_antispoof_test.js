const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

const { createCanvas } = require("canvas");
globalThis.document = {
  createElement: function (t) {
    return t === "canvas" ? createCanvas(1, 1) : null;
  },
};

// ── Load module sources ──
const antispoofSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_antispoof.js"),
  "utf8",
);
vm.runInThisContext(antispoofSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_antispoof.js") });

const livenessSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_liveness.js"),
  "utf8",
);
vm.runInThisContext(livenessSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_liveness.js") });

const FaceAntiSpoof = globalThis.FaceAntiSpoof;

// ── Fake onnxruntime ──
function makeFakeOrt(logits) {
  return {
    Tensor: function (type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    },
    InferenceSession: {
      create: async function (url, opts) {
        return {
          run: async function (feeds) {
            return { output: { data: logits } };
          },
        };
      },
    },
  };
}

// ── Canvas helpers ──
function solidCanvas(w, h, rgb) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function patternCanvas() {
  const c = createCanvas(80, 80);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(80, 80);
  // pixel (0,0) = rgb(10, 20, 30); everything else black
  img.data[0] = 10;
  img.data[1] = 20;
  img.data[2] = 30;
  img.data[3] = 255;
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── FaceLiveness synthetic meshes (same shapes as face_liveness_test.js) ──
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const NOSE = 1;
const EYE_L_INNER = 133;
const EYE_R_INNER = 362;

function emptyMesh() {
  return new Float32Array(468 * 3);
}

function placeEye(mesh, indices, cx, cy, eyeHeight, eyeWidth) {
  const [outer, upL, upR, inner, downR, downL] = indices;
  mesh[outer * 3] = cx - eyeWidth / 2;
  mesh[outer * 3 + 1] = cy;
  mesh[inner * 3] = cx + eyeWidth / 2;
  mesh[inner * 3 + 1] = cy;
  mesh[upL * 3] = cx - eyeWidth / 4;
  mesh[upL * 3 + 1] = cy - eyeHeight;
  mesh[upR * 3] = cx + eyeWidth / 4;
  mesh[upR * 3 + 1] = cy - eyeHeight;
  mesh[downR * 3] = cx + eyeWidth / 4;
  mesh[downR * 3 + 1] = cy + eyeHeight;
  mesh[downL * 3] = cx - eyeWidth / 4;
  mesh[downL * 3 + 1] = cy + eyeHeight;
}

function faceWithEyes(eyeHeightL, eyeHeightR, noseOffsetX) {
  const mesh = emptyMesh();
  placeEye(mesh, LEFT_EYE, 250, 200, eyeHeightL === undefined ? 8 : eyeHeightL, 60);
  placeEye(mesh, RIGHT_EYE, 390, 200, eyeHeightR === undefined ? 8 : eyeHeightR, 60);
  mesh[NOSE * 3] = 320 + (noseOffsetX || 0);
  mesh[NOSE * 3 + 1] = 260;
  mesh[EYE_L_INNER * 3] = 280;
  mesh[EYE_R_INNER * 3] = 360;
  mesh[EYE_L_INNER * 3 + 1] = 200;
  mesh[EYE_R_INNER * 3 + 1] = 200;
  return mesh;
}

function makeFrameCanvas() {
  const c = createCanvas(640, 480);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(640, 480);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (i / 7) % 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── Module shape ──

describe("FaceAntiSpoof — constants", () => {
  it("exposes the MiniFASNet model provenance", () => {
    assert.equal(FaceAntiSpoof.VERSION, "minifasnet-v2");
    assert.equal(FaceAntiSpoof.INPUT_SIZE, 80);
    assert.equal(FaceAntiSpoof.CROP_MARGIN_SCALE, 2.7);
    assert.equal(FaceAntiSpoof.INPUT_NAME, "input");
    assert.equal(FaceAntiSpoof.OUTPUT_NAME, "output");
    assert.equal(FaceAntiSpoof.MODEL_SHA256, "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b");
    assert.ok(FaceAntiSpoof.MODEL_URL.includes("minifasnet_v2.onnx"));
    assert.deepEqual(FaceAntiSpoof.CLASSES, ["live", "print", "replay"]);
  });

  it("starts unloaded with no backend or error", () => {
    FaceAntiSpoof.reset();
    assert.equal(FaceAntiSpoof.isReady(), false);
    assert.equal(FaceAntiSpoof.getBackend(), null);
    assert.equal(FaceAntiSpoof.getError(), null);
  });
});

describe("FaceAntiSpoof — softmax", () => {
  it("normalizes logits to probabilities summing to 1", () => {
    const p = FaceAntiSpoof.softmax([1, 1, 1]);
    assert.ok(Math.abs(p[0] + p[1] + p[2] - 1) < 1e-6);
    assert.ok(Math.abs(p[0] - 1 / 3) < 1e-6);
  });

  it("is monotonic in the logit order", () => {
    const p = FaceAntiSpoof.softmax([2, 1, 0.5]);
    assert.ok(p[0] > p[1] && p[1] > p[2]);
  });

  it("handles large logits without overflow (max-subtraction)", () => {
    const p = FaceAntiSpoof.softmax([1000, 0, -1000]);
    assert.ok(Math.abs(p[0] - 1) < 1e-6);
  });

  it("returns null for empty input", () => {
    assert.equal(FaceAntiSpoof.softmax([]), null);
    assert.equal(FaceAntiSpoof.softmax(null), null);
  });
});

describe("FaceAntiSpoof — preprocess", () => {
  it("converts RGB to BGR CHW and scales pixels to [0, 1]", () => {
    const out = FaceAntiSpoof.preprocess(patternCanvas());
    const n = 80 * 80;
    // pixel (0,0) = rgb(10, 20, 30) → BGR (30, 20, 10) / 255
    assert.ok(Math.abs(out[0] - 30 / 255) < 1e-6, "first channel must be B");
    assert.ok(Math.abs(out[n] - 20 / 255) < 1e-6, "second channel must be G");
    assert.ok(Math.abs(out[2 * n] - 10 / 255) < 1e-6, "third channel must be R");
    // elsewhere (black) → all zeros
    assert.equal(out[1], 0);
  });

  it("throws without a canvas", () => {
    assert.throws(() => FaceAntiSpoof.preprocess(null), /canvas is required/);
  });
});

describe("FaceAntiSpoof — cropFace", () => {
  it("crops around the bbox center with the 2.7x margin", () => {
    const c = solidCanvas(640, 480, [100, 150, 200]);
    const box = { x: 200, y: 100, width: 100, height: 150 };
    const crop = FaceAntiSpoof.cropFace(c, box);
    assert.ok(crop);
    assert.equal(crop.width, 80);
    assert.equal(crop.height, 80);
    const ctx = crop.getContext("2d");
    const px = ctx.getImageData(0, 0, 1, 1).data;
    assert.equal(px[0], 100);
    assert.equal(px[1], 150);
    assert.equal(px[2], 200);
  });

  it("falls back to the full canvas without a box", () => {
    const c = solidCanvas(100, 60, [5, 6, 7]);
    const crop = FaceAntiSpoof.cropFace(c, null);
    assert.ok(crop);
    assert.equal(crop.width, 80);
    assert.equal(crop.height, 80);
    const px = crop.getContext("2d").getImageData(0, 0, 1, 1).data;
    assert.equal(px[0], 5);
  });

  it("returns null for invalid input", () => {
    assert.equal(FaceAntiSpoof.cropFace(null, null), null);
  });
});

describe("FaceAntiSpoof — load/predict with injected runtime", () => {
  beforeEach(() => FaceAntiSpoof.reset());

  it("loads via an injected runtime and reports the backend", async () => {
    const ok = await FaceAntiSpoof.load({ runtime: makeFakeOrt([1, 1, 1]), modelUrl: "mock.onnx" });
    assert.equal(ok, true);
    assert.equal(FaceAntiSpoof.isReady(), true);
    assert.equal(FaceAntiSpoof.getError(), null);
  });

  it("predicts live when the live logit dominates", async () => {
    await FaceAntiSpoof.load({ runtime: makeFakeOrt([2, 1, 0.5]), modelUrl: "mock.onnx" });
    const res = await FaceAntiSpoof.predict(solidCanvas(640, 480, [128, 128, 128]), { x: 200, y: 100, width: 100, height: 150 });
    assert.equal(res.live, true);
    assert.equal(res.label, "live");
    // score = 1 - (p[print] + p[replay])
    const p0 = Math.exp(2) / (Math.exp(2) + Math.exp(1) + Math.exp(0.5));
    assert.ok(Math.abs(res.score - p0) < 1e-6);
    assert.deepEqual(res.classes, ["live", "print", "replay"]);
  });

  it("predicts spoof when print/replay dominate", async () => {
    await FaceAntiSpoof.load({ runtime: makeFakeOrt([0.2, 2, 1.5]), modelUrl: "mock.onnx" });
    const res = await FaceAntiSpoof.predict(solidCanvas(640, 480, [128, 128, 128]), null);
    assert.equal(res.live, false);
    assert.equal(res.label, "spoof");
  });

  it("runs the session with an NCHW 1x3x80x80 BGR float32 input under 'input'", async () => {
    let seenFeeds = null;
    let seenDims = null;
    const ort = {
      Tensor: function (type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
        seenDims = dims;
      },
      InferenceSession: {
        create: async function () {
          return {
            run: async function (feeds) {
              seenFeeds = feeds;
              return { output: { data: new Float32Array([1, 1, 1]) } };
            },
          };
        },
      },
    };
    await FaceAntiSpoof.load({ runtime: ort, modelUrl: "mock.onnx" });
    await FaceAntiSpoof.predict(solidCanvas(640, 480, [128, 128, 128]), { x: 200, y: 100, width: 100, height: 150 });
    assert.ok(seenFeeds && seenFeeds.input, "feeds must key the input tensor as 'input'");
    assert.deepEqual(seenDims, [1, 3, 80, 80]);
  });

  it("throws when predicting without loading", async () => {
    await assert.rejects(FaceAntiSpoof.predict(solidCanvas(10, 10, [1, 1, 1]), null), /not loaded/);
  });

  it("returns false with an error when no execution provider succeeds", async () => {
    const badOrt = {
      InferenceSession: {
        create: async function () {
          throw new Error("provider boom");
        },
      },
    };
    const ok = await FaceAntiSpoof.load({ runtime: badOrt, modelUrl: "mock.onnx" });
    assert.equal(ok, false);
    assert.equal(FaceAntiSpoof.isReady(), false);
    assert.ok(FaceAntiSpoof.getError().includes("provider boom"));
  });

  it("returns false for an unusable injected runtime", async () => {
    const ok = await FaceAntiSpoof.load({ runtime: {}, modelUrl: "mock.onnx" });
    assert.equal(ok, false);
    assert.ok(FaceAntiSpoof.getError(), "an error must be recorded");
  });
});

// ── Liveness integration (PAD stage) ──

describe("FaceLiveness — antiSpoof integration", () => {
  let liveness;
  const REAL_AS = globalThis.FaceAntiSpoof;
  const stub = {
    VERSION: "minifasnet-v2",
    live: true,
    isReady: () => true,
    load: async () => true,
    getBackend: () => "wasm",
    predict: async () => ({
      live: stub.live,
      score: stub.live ? 0.91 : 0.12,
      label: stub.live ? "live" : "spoof",
      probabilities: stub.live ? [0.91, 0.05, 0.04] : [0.1, 0.6, 0.3],
    }),
  };

  beforeEach(() => {
    liveness = new globalThis.FaceLiveness();
    globalThis.FaceAntiSpoof = stub;
  });

  afterEach(() => {
    globalThis.FaceAntiSpoof = REAL_AS;
  });

  function blinkingSetup() {
    const open1 = faceWithEyes(8, 8);
    const open2 = faceWithEyes(8, 8);
    open2[NOSE * 3] += 3;
    const open3 = faceWithEyes(8, 8);
    open3[NOSE * 3] += 6;
    const blink = faceWithEyes(2, 2);
    const frames = [open1, blink, open2, open3];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        const canvas = makeFrameCanvas();
        camera._lastMesh = frames[idx % frames.length];
        idx++;
        return canvas;
      },
    };
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: camera._lastMesh }];
      },
    };
    return { camera, engine };
  }

  it("keeps the heuristic pass when the PAD model says live", async () => {
    stub.live = true;
    const { camera, engine } = blinkingSetup();
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4 });
    assert.equal(r.live, true);
    assert.ok(r.antiSpoof, "evidence must include the PAD stage");
    assert.equal(r.antiSpoof.ready, true);
    assert.equal(r.antiSpoof.live, true);
    assert.equal(r.antiSpoof.model, "minifasnet-v2");
    assert.equal(r.antiSpoof.backend, "wasm");
    assert.deepEqual(r.antiSpoof.probabilities, [0.91, 0.05, 0.04]);
    assert.ok(!r.reasons.includes("anti_spoof"));
  });

  it("overrides the heuristic pass when the PAD model says spoof", async () => {
    stub.live = false;
    const { camera, engine } = blinkingSetup();
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4 });
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("anti_spoof"));
    assert.equal(r.antiSpoof.live, false);
    assert.equal(r.antiSpoof.score, 0.12);
  });

  it("skips the PAD stage entirely when antiSpoof: false", async () => {
    stub.live = false;
    const { camera, engine } = blinkingSetup();
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4, antiSpoof: false });
    assert.equal(r.live, true);
    assert.equal(r.antiSpoof, undefined);
  });

  it("keeps the heuristic result when the PAD model fails to load", async () => {
    stub.live = false;
    stub.isReady = () => false;
    stub.load = async () => false;
    stub.getError = () => "mock load failure";
    const { camera, engine } = blinkingSetup();
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4 });
    assert.equal(r.live, true, "heuristics must survive a PAD load failure");
    assert.equal(r.antiSpoof.ready, false);
    assert.equal(r.antiSpoof.error, "mock load failure");
    assert.ok(!r.reasons.includes("anti_spoof"));
  });

  it("skips PAD evidence when the module is absent entirely", async () => {
    globalThis.FaceAntiSpoof = undefined;
    const { camera, engine } = blinkingSetup();
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4 });
    assert.equal(r.live, true);
    assert.equal(r.antiSpoof, undefined);
  });
});

describe("FaceLiveness — antiSpoofCheck", () => {
  const REAL_AS = globalThis.FaceAntiSpoof;

  afterEach(() => {
    globalThis.FaceAntiSpoof = REAL_AS;
  });

  it("returns null when the module is unavailable", async () => {
    globalThis.FaceAntiSpoof = undefined;
    assert.equal(await globalThis.FaceLiveness.antiSpoofCheck(makeFrameCanvas(), null), null);
  });

  it("returns an error chunk when loading fails", async () => {
    globalThis.FaceAntiSpoof = {
      isReady: () => false,
      load: async () => false,
      getError: () => "boom",
    };
    const res = await globalThis.FaceLiveness.antiSpoofCheck(makeFrameCanvas(), null);
    assert.equal(res.ready, false);
    assert.equal(res.error, "boom");
  });

  it("surfaces a predict error as a ready:false chunk", async () => {
    globalThis.FaceAntiSpoof = {
      isReady: () => true,
      load: async () => true,
      getBackend: () => null,
      predict: async () => {
        throw new Error("inference exploded");
      },
    };
    const res = await globalThis.FaceLiveness.antiSpoofCheck(makeFrameCanvas(), null);
    assert.equal(res.ready, false);
    assert.equal(res.error, "inference exploded");
  });
});
