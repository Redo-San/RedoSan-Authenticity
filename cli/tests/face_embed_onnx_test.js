const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("canvas");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

const onnxSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_embed_onnx.js"),
  "utf8",
);
vm.runInThisContext(onnxSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_embed_onnx.js",
  ),
});

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
    assert.throws(
      () => FaceONNXEmbedder.preprocess(null),
      /canvas is required/,
    );
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
    const ok = await FaceONNXEmbedder.load({
      runtime: rt,
      modelUrl: "fail-once",
    });
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

  it("pins the ArcFace model SHA-256 for runtime verification", () => {
    assert.match(FaceONNXEmbedder.MODEL_SHA256, /^[0-9a-f]{64}$/);
  });

  it("skips verification when a runtime is injected (test seam)", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async function () {
      fetchCalls++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    try {
      const ok = await FaceONNXEmbedder.load({ runtime: fakeRuntime() }); // default URL + pinned hash
      assert.equal(ok, true);
      assert.equal(fetchCalls, 0);
    } finally {
      delete globalThis.fetch;
    }
  });

  it("verifies the bytes and passes the verified buffer to the session", async () => {
    const crypto = require("crypto");
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const expected = crypto.createHash("sha256").update(bytes).digest("hex");
    globalThis.fetch = async function () {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async function () {
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      };
    };
    let seenArg = null;
    const rt = fakeRuntime();
    rt.InferenceSession.create = async function (arg) {
      seenArg = arg;
      return {
        run: async function () {
          return { output: { data: new Float32Array(512).fill(0.5) } };
        },
        outputNames: ["output"],
      };
    };
    try {
      const ok = await FaceONNXEmbedder.load({
        runtime: rt,
        modelUrl: "https://models.example/w600k_mbf.onnx",
        modelSha256: expected,
        verifyModel: true,
      });
      assert.equal(ok, true);
      assert.ok(
        seenArg instanceof ArrayBuffer,
        "session must receive the verified ArrayBuffer",
      );
    } finally {
      delete globalThis.fetch;
    }
  });

  it("refuses to load on SHA-256 mismatch", async () => {
    globalThis.fetch = async function () {
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([7, 7, 7]).buffer,
      };
    };
    try {
      const ok = await FaceONNXEmbedder.load({
        runtime: fakeRuntime(),
        modelUrl: "https://models.example/w600k_mbf.onnx",
        modelSha256: "cd".repeat(32),
        verifyModel: true,
      });
      assert.equal(ok, false);
      assert.equal(FaceONNXEmbedder.isReady(), false);
      assert.ok(FaceONNXEmbedder.getError().includes("integrity"));
    } finally {
      delete globalThis.fetch;
    }
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

  it("guards against a missing session output name", async () => {
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt });
    rt.sessions[0].outputNames = undefined;
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([1, 2, 3])),
      /output shape/,
    );
  });

  it("guards against a missing outputs object", async () => {
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt });
    rt.sessions[0].run = async () => null;
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([1, 2, 3])),
      /output shape/,
    );
  });

  it("guards against absent output data", async () => {
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({ output: {} });
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([1, 2, 3])),
      /output shape/,
    );
  });

  it("rejects when the embedding cannot be normalized", async () => {
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      output: { data: new Float32Array(512) },
    });
    await assert.rejects(
      () => FaceONNXEmbedder.embed(makeCanvas112([1, 2, 3])),
      /normalized/,
    );
  });

  it("keys the feed with a custom inputName override", async () => {
    let seenKey = null;
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt, inputName: "pixels" });
    rt.sessions[0].run = async (feeds) => {
      seenKey = Object.keys(feeds)[0];
      return { output: { data: new Float32Array(512).fill(0.5) } };
    };
    await FaceONNXEmbedder.embed(makeCanvas112([9, 9, 9]));
    assert.equal(seenKey, "pixels");
  });

  it("falls back to the default input name when none was recorded", async () => {
    let seenKey = null;
    const rt = fakeRuntime();
    await FaceONNXEmbedder.load({ runtime: rt, inputName: "pixels" });
    FaceONNXEmbedder._inputName = null;
    rt.sessions[0].run = async (feeds) => {
      seenKey = Object.keys(feeds)[0];
      return { output: { data: new Float32Array(512).fill(0.5) } };
    };
    await FaceONNXEmbedder.embed(makeCanvas112([9, 9, 9]));
    assert.equal(seenKey, FaceONNXEmbedder.INPUT_NAME);
  });
});

// ── Coverage: runtime acquisition without injection, loader internals ──

describe("FaceONNXEmbedder — runtime discovery", () => {
  const realDoc = globalThis.document;

  beforeEach(() => FaceONNXEmbedder.reset());
  afterEach(() => {
    globalThis.document = realDoc;
    delete globalThis.ort;
    FaceONNXEmbedder.reset();
  });

  it("uses window.ort when present", async () => {
    globalThis.ort = fakeRuntime();
    const ok = await FaceONNXEmbedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, true);
  });

  it("returns false when neither an option nor window provides a runtime", async () => {
    delete globalThis.document;
    const ok = await FaceONNXEmbedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, false);
    assert.match(
      FaceONNXEmbedder.getError(),
      /onnxruntime-web is not available/,
    );
  });

  it("supports a zero-argument defensive call", async () => {
    const savedFetch = globalThis.fetch;
    delete globalThis.document;
    globalThis.fetch = undefined;
    try {
      assert.equal(await FaceONNXEmbedder.load(), false);
      assert.match(FaceONNXEmbedder.getError(), /requires fetch support/);
    } finally {
      globalThis.document = realDoc;
      if (savedFetch === undefined) delete globalThis.fetch;
      else globalThis.fetch = savedFetch;
    }
  });

  it("loads the runtime script on demand and creates a session", async () => {
    delete globalThis.ort;
    globalThis.document = {
      createElement: function () {
        return {};
      },
      head: {
        appendChild: function (s) {
          globalThis.ort = fakeRuntime();
          s.onload();
        },
      },
    };
    const ok = await FaceONNXEmbedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, true);
    assert.ok(FaceONNXEmbedder.isReady());
  });

  it("caches with a zero-argument second call", async () => {
    await FaceONNXEmbedder.load({ runtime: fakeRuntime() });
    assert.equal(await FaceONNXEmbedder.load(), true);
  });
});

describe("FaceONNXEmbedder — loader internals", () => {
  const realDoc = globalThis.document;

  afterEach(() => {
    globalThis.document = realDoc;
    delete globalThis.ort;
  });

  function scriptDoc(fire) {
    return {
      createElement: function () {
        return {};
      },
      head: {
        appendChild: function (s) {
          fire(s);
        },
      },
    };
  }

  it("_loadRuntime rejects without a DOM", async () => {
    delete globalThis.document;
    await assert.rejects(
      FaceONNXEmbedder._loadRuntime("u.js"),
      /not available in this environment/,
    );
  });

  it("_loadRuntime resolves with window.ort on script load", async () => {
    const stub = {};
    globalThis.ort = stub;
    globalThis.document = scriptDoc((s) => s.onload());
    assert.equal(await FaceONNXEmbedder._loadRuntime("u.js"), stub);
  });

  it("_loadRuntime rejects when window.ort is missing after the script loads", async () => {
    globalThis.document = scriptDoc((s) => s.onload());
    await assert.rejects(
      FaceONNXEmbedder._loadRuntime("u.js"),
      /window\.ort was not found/,
    );
  });

  it("_loadRuntime rejects on script error", async () => {
    globalThis.document = scriptDoc((s) => s.onerror());
    await assert.rejects(
      FaceONNXEmbedder._loadRuntime("u.js"),
      /Failed to load onnxruntime-web/,
    );
  });

  it("_fetchModelBytes throws without fetch and on HTTP errors", async () => {
    globalThis.fetch = undefined;
    await assert.rejects(
      FaceONNXEmbedder._fetchModelBytes("m.onnx"),
      /requires fetch/,
    );
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(
      FaceONNXEmbedder._fetchModelBytes("m.onnx"),
      /HTTP 503/,
    );
  });

  it("_verifySha256 fails closed without WebCrypto", async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: { subtle: null },
        configurable: true,
        writable: true,
      });
      await assert.rejects(
        FaceONNXEmbedder._verifySha256(new Uint8Array([1]).buffer, "aa"),
        /WebCrypto/,
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", saved);
    }
  });

  it("normalize rejects non-finite magnitudes", () => {
    assert.equal(FaceONNXEmbedder.normalize([NaN, 1]), null);
  });
});
