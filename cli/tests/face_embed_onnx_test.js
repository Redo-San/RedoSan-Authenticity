const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("canvas");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

const onnxSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_embed_onnx.js"),
  "utf8",
);
vm.runInThisContext(onnxSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_embed_onnx.js") });

function makeCanvas112(rgb) {
  const canvas = createCanvas(112, 112);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(112, 112);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function fakeRuntime() {
  const sessions = [];
  let createCalls = 0;
  return {
    sessions,
    Tensor: function (type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    },
    InferenceSession: {
      create: async function (url, opts) {
        if (url === "fail-once" && createCalls === 0) {
          createCalls += 1;
          throw new Error("provider failed");
        }
        const session = {
          run: async function () {
            return { output: { data: new Float32Array(512).fill(0.5) } };
          },
          outputNames: ["output"],
        };
        sessions.push(session);
        return session;
      },
    },
  };
}

describe("FaceONNXEmbedder — preprocess", () => {
  it("normalizes RGB to (v − 127.5) / 127.5 in CHW order", () => {
    const t = FaceONNXEmbedder.preprocess(makeCanvas112([127, 255, 0]));
    const n = 112 * 112;
    assert.ok(Math.abs(t[0] - (127 - 127.5) / 127.5) < 1e-6, "red channel");
    assert.ok(Math.abs(t[n] - (255 - 127.5) / 127.5) < 1e-6, "green channel");
    assert.ok(Math.abs(t[2 * n] - (0 - 127.5) / 127.5) < 1e-6, "blue channel");
  });

  it("throws when the canvas is missing", () => {
    assert.throws(() => FaceONNXEmbedder.preprocess(null), /canvas is required/);
    assert.throws(() => FaceONNXEmbedder.preprocess({}), /canvas is required/);
  });
});

describe("FaceONNXEmbedder — normalize", () => {
  it("L2-normalizes the array", () => {
    const out = FaceONNXEmbedder.normalize(new Float32Array([3, 4]));
    assert.ok(Math.abs(out[0] - 0.6) < 1e-6);
    assert.ok(Math.abs(out[1] - 0.8) < 1e-6);
  });

  it("returns null for empty or zero-magnitude arrays", () => {
    assert.equal(FaceONNXEmbedder.normalize(null), null);
    assert.equal(FaceONNXEmbedder.normalize(new Float32Array(0)), null);
    assert.equal(FaceONNXEmbedder.normalize(new Float32Array([0, 0, 0])), null);
  });
});

describe("FaceONNXEmbedder — load", () => {
  beforeEach(() => {
    FaceONNXEmbedder.reset();
  });

  afterEach(() => {
    FaceONNXEmbedder.reset();
  });

  it("loads with an injected runtime and reports a backend", async () => {
    const ok = await FaceONNXEmbedder.load({ runtime: fakeRuntime() });
    assert.equal(ok, true);
    assert.equal(FaceONNXEmbedder.isReady(), true);
    assert.equal(FaceONNXEmbedder.getBackend(), "webgpu");
    assert.equal(FaceONNXEmbedder.getError(), null);
  });

  it("is idempotent once a session exists", async () => {
    await FaceONNXEmbedder.load({ runtime: fakeRuntime() });
    const ok = await FaceONNXEmbedder.load({ runtime: fakeRuntime() });
    assert.equal(ok, true);
    assert.equal(FaceONNXEmbedder.getBackend(), "webgpu");
  });

  it("falls back to the next execution provider", async () => {
    const rt = fakeRuntime();
    const ok = await FaceONNXEmbedder.load({ runtime: rt, modelUrl: "fail-once" });
    assert.equal(ok, true);
    assert.equal(FaceONNXEmbedder.getBackend(), "wasm");
  });

  it("returns false when every provider fails", async () => {
    const rt = fakeRuntime();
    rt.InferenceSession.create = async function () {
      throw new Error("no provider");
    };
    const ok = await FaceONNXEmbedder.load({ runtime: rt });
    assert.equal(ok, false);
    assert.equal(FaceONNXEmbedder.isReady(), false);
    assert.ok(FaceONNXEmbedder.getError().includes("no provider"));
  });

  it("returns false when an unusable runtime is provided", async () => {
    const ok = await FaceONNXEmbedder.load({ runtime: { Tensor: null } });
    assert.equal(ok, false);
    assert.equal(FaceONNXEmbedder.isReady(), false);
    assert.ok(FaceONNXEmbedder.getError(), "an error message is recorded");
  });
});

describe("FaceONNXEmbedder — embed", () => {
  beforeEach(() => {
    FaceONNXEmbedder.reset();
  });

  afterEach(() => {
    FaceONNXEmbedder.reset();
  });

  it("embeds a canvas into a normalized 512-d descriptor", async () => {
    await FaceONNXEmbedder.load({ runtime: fakeRuntime() });
    const desc = await FaceONNXEmbedder.embed(makeCanvas112([127, 127, 127]));
    assert.equal(desc.length, 512);
    let sum = 0;
    for (let i = 0; i < desc.length; i++) sum += desc[i] * desc[i];
    assert.ok(Math.abs(Math.sqrt(sum) - 1) < 1e-4, "L2 length is 1");
  });

  it("throws when not loaded", async () => {
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([0, 0, 0])),
      /not loaded/,
    );
  });

  it("throws on unexpected output shape", async () => {
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt });
    rt.sessions[0].run = async function () {
      return { somethingElse: { data: new Float32Array(512) } };
    };
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([0, 0, 0])),
      /Unexpected ONNX output shape/,
    );
  });
});