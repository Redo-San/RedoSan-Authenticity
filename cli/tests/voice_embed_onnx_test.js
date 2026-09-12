const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_embed_onnx.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_embed_onnx.js",
  hostname: "localhost",
  origin: "null",
};

const onnxSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Voice_Biometric", "voice_embed_onnx.js"),
  "utf8",
);
vm.runInThisContext(onnxSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_embed_onnx.js",
  ),
});

const FIXTURES = path.join(__dirname, "fixtures");
const FBANK_PATH = path.join(
  __dirname,
  "../../Voice_Biometric/models/fbank-80x201-f32.bin",
);
const FBANK_SHA =
  "024e5073b7cfedee84408dc68dd6bafa02808fc786e67f1314e9c918297f5a63";
const MODEL_PIN =
  "f46380bbaeddb929fb3a10ab63a4b1877a50e3d1e5fdd55a1b618d5651d3f64e";

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
            return {
              embedding: { data: new Float32Array(192).fill(0.5) },
            };
          },
          outputNames: ["embedding"],
        };
        sessions.push(session);
        return session;
      },
    },
  };
}

function readGoldenEmbedding(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const buf = Buffer.from(j.embedding.bytes, "base64");
  const f32 = new Float32Array(buf.length / 4);
  for (let i = 0; i < f32.length; i += 1) f32[i] = buf.readFloatLE(i * 4);
  return { emb: f32, j };
}

describe("VoiceONNXEmbedder — contract (pinned artifact)", () => {
  it("pins the ECAPA-TDNN model SHA-256 (measured, lowercase hex)", () => {
    assert.match(VoiceONNXEmbedder.MODEL_SHA256, /^[0-9a-f]{64}$/);
    assert.equal(VoiceONNXEmbedder.MODEL_SHA256, MODEL_PIN);
  });

  it("points the default model URL at the pinned upstream artifact", () => {
    assert.ok(
      VoiceONNXEmbedder.MODEL_URL.endsWith("model/ecapa-speaker-v1.onnx"),
    );
  });

  it("exposes the real ONNX graph contract", () => {
    assert.equal(VoiceONNXEmbedder.DIMS, 192);
    assert.equal(VoiceONNXEmbedder.N_MELS, 80);
    assert.equal(VoiceONNXEmbedder.INPUT_NAME, "features");
    assert.equal(VoiceONNXEmbedder.INPUT_LENS_NAME, "feature_lens");
    assert.equal(VoiceONNXEmbedder.OUTPUT_NAME, "embedding");
  });

  for (const fx of [
    "golden_sp1.json",
    "golden_sp2.json",
    "golden_h1a.json",
    "golden_h1b.json",
    "golden_h2.json",
    "golden_song.json",
  ]) {
    it(`${fx}: golden embedding contract matches the model`, () => {
      const g = readGoldenEmbedding(path.join(FIXTURES, fx));
      assert.deepEqual(g.j.embedding.shape, [1, 192]);
      assert.equal(Buffer.from(g.j.embedding.bytes, "base64").length, 192 * 4);
      assert.equal(g.j.embedding.dtype, "float32_le");
      assert.equal(g.j.tolerances.embedding_cosine_min, 0.999);
      assert.equal(g.emb.length, 192);
    });
  }
});

describe("VoiceONNXEmbedder — normalize", () => {
  it("L2-normalizes the array", () => {
    const out = VoiceONNXEmbedder.normalize(new Float32Array([3, 4]));
    assert.ok(Math.abs(out[0] - 0.6) < 1e-6);
    assert.ok(Math.abs(out[1] - 0.8) < 1e-6);
  });

  it("returns null for empty or zero-magnitude arrays", () => {
    assert.equal(VoiceONNXEmbedder.normalize(null), null);
    assert.equal(VoiceONNXEmbedder.normalize(new Float32Array(0)), null);
    assert.equal(
      VoiceONNXEmbedder.normalize(new Float32Array([0, 0, 0])),
      null,
    );
    assert.equal(VoiceONNXEmbedder.normalize([NaN, 1]), null);
  });
});

describe("VoiceONNXEmbedder — cosine", () => {
  it("returns 1 for identical vectors and is magnitude-invariant", () => {
    const a = new Float32Array([1, 2, 3]);
    assert.ok(Math.abs(VoiceONNXEmbedder.cosine(a, a) - 1) < 1e-12);
    assert.ok(
      Math.abs(VoiceONNXEmbedder.cosine(new Float32Array([2, 4, 6]), a) - 1) <
        1e-12,
    );
  });

  it("returns 0 for orthogonal vectors and -1 for opposite vectors", () => {
    assert.ok(
      Math.abs(
        VoiceONNXEmbedder.cosine(
          new Float32Array([1, 0]),
          new Float32Array([0, 1]),
        ),
      ) < 1e-12,
    );
    assert.ok(
      Math.abs(
        VoiceONNXEmbedder.cosine(
          new Float32Array([1, 0]),
          new Float32Array([-1, 0]),
        ) + 1,
      ) < 1e-12,
    );
  });

  it("returns NaN for shape mismatches and empty/zero inputs", () => {
    assert.ok(
      Number.isNaN(
        VoiceONNXEmbedder.cosine(new Float32Array(2), new Float32Array(3)),
      ),
    );
    assert.ok(
      Number.isNaN(
        VoiceONNXEmbedder.cosine(new Float32Array(0), new Float32Array(0)),
      ),
    );
    assert.ok(
      Number.isNaN(VoiceONNXEmbedder.cosine(null, new Float32Array(2))),
    );
    assert.ok(
      Number.isNaN(
        VoiceONNXEmbedder.cosine(
          new Float32Array([0, 0]),
          new Float32Array([1, 1]),
        ),
      ),
    );
  });
});

describe("VoiceONNXEmbedder — load", () => {
  const embedder = VoiceONNXEmbedder;
  beforeEach(() => embedder.reset());
  afterEach(() => embedder.reset());

  it("loads with an injected runtime and reports a backend", async () => {
    const ok = await embedder.load({ runtime: fakeRuntime() });
    assert.equal(ok, true);
    assert.equal(embedder.isReady(), true);
    assert.equal(embedder.getBackend(), "webgpu");
    assert.equal(embedder.getError(), null);
  });

  it("is idempotent once a session exists", async () => {
    await embedder.load({ runtime: fakeRuntime() });
    const ok = await embedder.load({ runtime: fakeRuntime() });
    assert.equal(ok, true);
    assert.equal(embedder.getBackend(), "webgpu");
  });

  it("falls back to the next execution provider", async () => {
    const rt = fakeRuntime();
    const ok = await embedder.load({ runtime: rt, modelUrl: "fail-once" });
    assert.equal(ok, true);
    assert.equal(embedder.getBackend(), "wasm");
  });

  it("returns false when every provider fails", async () => {
    const rt = fakeRuntime();
    rt.InferenceSession.create = async function () {
      throw new Error("no provider");
    };
    const ok = await embedder.load({ runtime: rt });
    assert.equal(ok, false);
    assert.equal(embedder.isReady(), false);
    assert.ok(embedder.getError().includes("no provider"));
  });

  it("returns false when an unusable runtime is provided", async () => {
    const ok = await embedder.load({ runtime: { Tensor: null } });
    assert.equal(ok, false);
    assert.equal(embedder.isReady(), false);
    assert.ok(embedder.getError(), "an error message is recorded");
  });

  it("skips verification when a runtime is injected (test seam)", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async function () {
      fetchCalls++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    try {
      const ok = await embedder.load({ runtime: fakeRuntime() }); // default URL + pinned hash
      assert.equal(ok, true);
      assert.equal(fetchCalls, 0);
    } finally {
      delete globalThis.fetch;
    }
  });

  it("verifies the bytes and passes the verified buffer to the session", async () => {
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
          return { embedding: { data: new Float32Array(192).fill(0.5) } };
        },
        outputNames: ["embedding"],
      };
    };
    try {
      const ok = await embedder.load({
        runtime: rt,
        modelUrl: "https://models.example/ecapa-speaker-v1.onnx",
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
      const ok = await embedder.load({
        runtime: fakeRuntime(),
        modelUrl: "https://models.example/ecapa-speaker-v1.onnx",
        modelSha256: "cd".repeat(32),
        verifyModel: true,
      });
      assert.equal(ok, false);
      assert.equal(embedder.isReady(), false);
      assert.ok(embedder.getError().includes("integrity"));
    } finally {
      delete globalThis.fetch;
    }
  });
});

describe("VoiceONNXEmbedder — embed", () => {
  const embedder = VoiceONNXEmbedder;
  beforeEach(() => embedder.reset());
  afterEach(() => embedder.reset());

  it("feeds [1, frames, 80] features plus feature_lens=[1] and returns a 192-d descriptor", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    let feeds = null;
    rt.sessions[0].run = async (f) => {
      feeds = f;
      return { embedding: { data: new Float32Array(192).fill(0.5) } };
    };
    const src = new Float32Array(10 * 80).fill(0.01);
    const desc = await embedder.embed({ data: src, frames: 10 });
    assert.equal(desc.length, 192);
    let sum = 0;
    for (let i = 0; i < desc.length; i++) sum += desc[i] * desc[i];
    assert.ok(Math.abs(Math.sqrt(sum) - 1) < 1e-4, "L2 length is 1");
    assert.ok(feeds, "session was fed");
    assert.equal(feeds[embedder.INPUT_NAME].dims.join(","), "1,10,80");
    assert.equal(feeds[embedder.INPUT_NAME].type, "float32");
    assert.equal(feeds[embedder.INPUT_LENS_NAME].dims.join(","), "1");
    assert.equal(feeds[embedder.INPUT_LENS_NAME].type, "float32");
    assert.equal(feeds[embedder.INPUT_LENS_NAME].data[0], 1);
  });

  it("accepts a bare Float32Array and infers the frame count", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    let dims = null;
    rt.sessions[0].run = async (f) => {
      dims = f[embedder.INPUT_NAME].dims;
      return { embedding: { data: new Float32Array(192).fill(0.5) } };
    };
    await embedder.embed(new Float32Array(7 * 80).fill(0.01));
    assert.deepEqual(dims, [1, 7, 80]);
  });

  it("passes the source buffer through without an extra copy", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    const src = new Float32Array(5 * 80).fill(0.01);
    let seen = null;
    rt.sessions[0].run = async (f) => {
      seen = f[embedder.INPUT_NAME].data;
      return { embedding: { data: new Float32Array(192).fill(0.5) } };
    };
    await embedder.embed({ data: src, frames: 5 });
    assert.strictEqual(seen, src);
  });

  it("rejects malformed or missing feature inputs", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    await assert.rejects(() => embedder.embed(null), /required/);
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 5 + 3)),
      /whole number of frames/,
    );
    await assert.rejects(
      () => embedder.embed({ data: "nope", frames: 4 }),
      /Float32Array/,
    );
    await assert.rejects(
      () => embedder.embed({ data: new Float32Array(4 * 80), frames: 9 }),
      /length does not match/,
    );
  });

  it("throws when not loaded", async () => {
    await assert.rejects(
      () => embedder.embed(new Float32Array(80).fill(0)),
      /not loaded/,
    );
  });

  it("throws on unexpected output shape, missing name, or missing data", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      somethingElse: { data: new Float32Array(192) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 10).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].outputNames = undefined;
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 10).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].outputNames = ["embedding"];
    rt.sessions[0].run = async () => ({
      embedding: { data: new Float32Array(999) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 10).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].run = async () => ({ embedding: {} });
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 10).fill(0.01)),
      /output shape/,
    );
  });

  it("rejects when the embedding cannot be normalized", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      embedding: { data: new Float32Array(192) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(80 * 10).fill(0.01)),
      /normalized/,
    );
  });

  it("captures the pre-normalization L2 magnitude as lastMagnitude", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      embedding: { data: new Float32Array(192).fill(0.5) },
    });
    await embedder.embed({
      data: new Float32Array(10 * 80).fill(0.01),
      frames: 10,
    });
    // ||v|| for 192 values of 0.5 = sqrt(192 * 0.25) = sqrt(48)
    assert.ok(
      Math.abs(embedder.lastMagnitude - Math.sqrt(48)) < 1e-6,
      `expected sqrt(48), got ${embedder.lastMagnitude}`,
    );
    embedder.reset();
    assert.equal(embedder.lastMagnitude, null, "reset() nulls lastMagnitude");
  });
});

// ── Coverage: runtime acquisition without injection, loader internals ──

describe("VoiceONNXEmbedder — runtime discovery", () => {
  const realDoc = globalThis.document;
  const embedder = VoiceONNXEmbedder;

  beforeEach(() => embedder.reset());
  afterEach(() => {
    globalThis.document = realDoc;
    delete globalThis.ort;
    embedder.reset();
  });

  it("uses window.ort when present", async () => {
    globalThis.ort = fakeRuntime();
    const ok = await embedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, true);
  });

  it("returns false when neither an option nor window provides a runtime", async () => {
    delete globalThis.document;
    const ok = await embedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, false);
    assert.match(embedder.getError(), /onnxruntime-web is not available/);
  });

  it("supports a zero-argument defensive call", async () => {
    const savedFetch = globalThis.fetch;
    delete globalThis.document;
    globalThis.fetch = undefined;
    try {
      assert.equal(await embedder.load(), false);
      assert.match(embedder.getError(), /requires fetch support/);
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
    const ok = await embedder.load({
      modelUrl: "mock.onnx",
      verifyModel: false,
    });
    assert.equal(ok, true);
    assert.ok(embedder.isReady());
  });

  it("caches with a zero-argument second call", async () => {
    await embedder.load({ runtime: fakeRuntime() });
    assert.equal(await embedder.load(), true);
  });
});

describe("VoiceONNXEmbedder — loader internals", () => {
  const realDoc = globalThis.document;
  const embedder = VoiceONNXEmbedder;

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
      embedder._loadRuntime("u.js"),
      /not available in this environment/,
    );
  });

  it("_loadRuntime resolves with window.ort on script load", async () => {
    const stub = {};
    globalThis.ort = stub;
    globalThis.document = scriptDoc((s) => s.onload());
    assert.equal(await embedder._loadRuntime("u.js"), stub);
  });

  it("_loadRuntime rejects when window.ort is missing after the script loads", async () => {
    globalThis.document = scriptDoc((s) => s.onload());
    await assert.rejects(
      embedder._loadRuntime("u.js"),
      /window\.ort was not found/,
    );
  });

  it("_loadRuntime rejects on script error", async () => {
    globalThis.document = scriptDoc((s) => s.onerror());
    await assert.rejects(
      embedder._loadRuntime("u.js"),
      /Failed to load onnxruntime-web/,
    );
  });

  it("_fetchModelBytes throws without fetch and on HTTP errors", async () => {
    globalThis.fetch = undefined;
    await assert.rejects(embedder._fetchModelBytes("m.onnx"), /requires fetch/);
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(embedder._fetchModelBytes("m.onnx"), /HTTP 503/);
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
        embedder._verifySha256(new Uint8Array([1]).buffer, "aa"),
        /WebCrypto/,
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", saved);
    }
  });
});

// ── Opt-in real ONNX inference against the golden embeddings ──
// Runs only when REDOSAN_VOICE_ONNX_REAL=1 and onnxruntime-node is
// installed (Phase E wiring). Requires the ONNX model at
// REDOSAN_VOICE_ONNX_MODEL (local path) or the default MODEL_URL.

const REAL_ONNX = process.env.REDOSAN_VOICE_ONNX_REAL === "1";

describe(
  "VoiceONNXEmbedder — golden embedding cosine (real ONNX)",
  { skip: !REAL_ONNX },
  () => {
    for (const fx of [
      "golden_sp1",
      "golden_sp2",
      "golden_h1a",
      "golden_h1b",
      "golden_h2",
      "golden_song",
    ]) {
      it(`${fx}: browser log-mel → ONNX embedding has cosine ≥ 0.999 vs golden`, async () => {
        const ort = require("onnxruntime-node");
        const fbankSrc = fs.readFileSync(FBANK_PATH);
        assert.equal(
          crypto.createHash("sha256").update(fbankSrc).digest("hex"),
          FBANK_SHA,
        );
        const fbank = new Float32Array(
          fbankSrc.buffer.slice(
            fbankSrc.byteOffset,
            fbankSrc.byteOffset + fbankSrc.byteLength,
          ),
        );
        const pcm = readWavPcm16k(path.join(FIXTURES, `${fx}.wav`));
        const mel = VoiceFeatures.computeLogMel(pcm, fbank, 16000);
        const g = readGoldenEmbedding(path.join(FIXTURES, `${fx}.json`));
        const modelPath =
          process.env.REDOSAN_VOICE_ONNX_MODEL ||
          path.join(
            __dirname,
            "..",
            "..",
            "..",
            "tmp-models",
            "ecapa-speaker-v1.onnx",
          );
        const session = await ort.InferenceSession.create(modelPath);
        const feeds = {
          [VoiceONNXEmbedder.INPUT_NAME]: new ort.Tensor("float32", mel.data, [
            1,
            mel.frames,
            VoiceONNXEmbedder.N_MELS,
          ]),
          [VoiceONNXEmbedder.INPUT_LENS_NAME]: new ort.Tensor(
            "float32",
            new Float32Array([1]),
            [1],
          ),
        };
        const out = await session.run(feeds);
        const cos = VoiceONNXEmbedder.cosine(
          out[VoiceONNXEmbedder.OUTPUT_NAME].data,
          g.emb,
        );
        assert.ok(
          cos >= g.j.tolerances.embedding_cosine_min,
          `${fx}: cosine ${cos.toFixed(6)} < ${g.j.tolerances.embedding_cosine_min}`,
        );
      });
    }
  },
);

// Minimal PCM reader (PCM/mono/16 kHz/16-bit), consistent with
// voice_features_test.js.
function readWavPcm16k(file) {
  const buf = fs.readFileSync(file);
  assert.equal(buf.toString("latin1", 0, 4), "RIFF");
  let off = 12;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("latin1", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "data") data = buf.subarray(body, body + size);
    off = body + size + (size % 2);
  }
  assert.ok(data, "WAV has no data chunk");
  return new Int16Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
}

// VoiceFeatures is loaded on demand for the real-ONNX parity path to keep
// the deterministic suite independent of it.
const VoiceFeatures = require("../../Voice_Biometric/voice_features.js");
