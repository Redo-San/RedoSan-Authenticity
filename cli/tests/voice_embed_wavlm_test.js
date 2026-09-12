const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_embed_wavlm.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_embed_wavlm.js",
  hostname: "localhost",
  origin: "null",
};

const wavlmSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Voice_Biometric", "voice_embed_wavlm.js"),
  "utf8",
);
vm.runInThisContext(wavlmSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_embed_wavlm.js",
  ),
});

const MODEL_PIN =
  "c491174cc96b657608a9f83922ec1ffcbf424bf4f3b8683f9558692b8c8712e3";

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
              embeddings: { data: new Float32Array(512).fill(0.5) },
            };
          },
          outputNames: ["embeddings", "logits"],
        };
        sessions.push(session);
        return session;
      },
    },
  };
}

describe("VoiceWavlmEmbedder — contract (pinned artifact)", () => {
  it("pins the WavLM Base+ SV model SHA-256 (measured, lowercase hex)", () => {
    assert.match(VoiceWavlmEmbedder.MODEL_SHA256, /^[0-9a-f]{64}$/);
    assert.equal(VoiceWavlmEmbedder.MODEL_SHA256, MODEL_PIN);
  });

  it("points the default model URL at the pinned upstream artifact", () => {
    assert.ok(
      VoiceWavlmEmbedder.MODEL_URL.endsWith(
        "D4ve-R/wavlm-base-plus-sv/resolve/main/onnx/model_quantized.onnx",
      ),
    );
  });

  it("exposes the real ONNX graph contract", () => {
    assert.equal(VoiceWavlmEmbedder.DIMS, 512);
    assert.equal(VoiceWavlmEmbedder.INPUT_KIND, "waveform");
    assert.equal(VoiceWavlmEmbedder.SAMPLE_RATE, 16000);
    assert.equal(VoiceWavlmEmbedder.VERSION, "wavlm-base-plus-sv");
    assert.equal(VoiceWavlmEmbedder.INPUT_NAME, "input_values");
    assert.equal(VoiceWavlmEmbedder.OUTPUT_NAME, "embeddings");
    assert.equal(VoiceWavlmEmbedder.OUTPUT_LOGITS_NAME, "logits");
  });
});

describe("VoiceWavlmEmbedder — normalize", () => {
  it("L2-normalizes the array", () => {
    const out = VoiceWavlmEmbedder.normalize(new Float32Array([3, 4]));
    assert.ok(Math.abs(out[0] - 0.6) < 1e-6);
    assert.ok(Math.abs(out[1] - 0.8) < 1e-6);
  });

  it("returns null for empty or zero-magnitude arrays", () => {
    assert.equal(VoiceWavlmEmbedder.normalize(null), null);
    assert.equal(VoiceWavlmEmbedder.normalize(new Float32Array(0)), null);
    assert.equal(
      VoiceWavlmEmbedder.normalize(new Float32Array([0, 0, 0])),
      null,
    );
    assert.equal(VoiceWavlmEmbedder.normalize([NaN, 1]), null);
  });
});

describe("VoiceWavlmEmbedder — cosine", () => {
  it("returns 1 for identical vectors and is magnitude-invariant", () => {
    const a = new Float32Array([1, 2, 3]);
    assert.ok(Math.abs(VoiceWavlmEmbedder.cosine(a, a) - 1) < 1e-12);
    assert.ok(
      Math.abs(VoiceWavlmEmbedder.cosine(new Float32Array([2, 4, 6]), a) - 1) <
        1e-12,
    );
  });

  it("returns 0 for orthogonal vectors and -1 for opposite vectors", () => {
    assert.ok(
      Math.abs(
        VoiceWavlmEmbedder.cosine(
          new Float32Array([1, 0]),
          new Float32Array([0, 1]),
        ),
      ) < 1e-12,
    );
    assert.ok(
      Math.abs(
        VoiceWavlmEmbedder.cosine(
          new Float32Array([1, 0]),
          new Float32Array([-1, 0]),
        ) + 1,
      ) < 1e-12,
    );
  });

  it("returns NaN for shape mismatches and empty/zero inputs", () => {
    assert.ok(
      Number.isNaN(
        VoiceWavlmEmbedder.cosine(new Float32Array(2), new Float32Array(3)),
      ),
    );
    assert.ok(
      Number.isNaN(
        VoiceWavlmEmbedder.cosine(new Float32Array(0), new Float32Array(0)),
      ),
    );
    assert.ok(
      Number.isNaN(VoiceWavlmEmbedder.cosine(null, new Float32Array(2))),
    );
    assert.ok(
      Number.isNaN(
        VoiceWavlmEmbedder.cosine(
          new Float32Array([0, 0]),
          new Float32Array([1, 1]),
        ),
      ),
    );
  });
});

describe("VoiceWavlmEmbedder — load", () => {
  const embedder = VoiceWavlmEmbedder;
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
          return {
            embeddings: { data: new Float32Array(512).fill(0.5) },
          };
        },
        outputNames: ["embeddings"],
      };
    };
    try {
      const ok = await embedder.load({
        runtime: rt,
        modelUrl: "https://models.example/wavlm/model_quantized.onnx",
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
        modelUrl: "https://models.example/wavlm/model_quantized.onnx",
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

describe("VoiceWavlmEmbedder — embed (raw waveform → 512-d x-vector)", () => {
  const embedder = VoiceWavlmEmbedder;
  beforeEach(() => embedder.reset());
  afterEach(() => embedder.reset());

  it("feeds [1, seq] input_values and returns a 512-d normalized descriptor", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    let feeds = null;
    rt.sessions[0].run = async (f) => {
      feeds = f;
      return { embeddings: { data: new Float32Array(512).fill(0.5) } };
    };
    const src = new Float32Array(16000).fill(0.01);
    const desc = await embedder.embed(src);
    assert.equal(desc.length, 512);
    let sum = 0;
    for (let i = 0; i < desc.length; i++) sum += desc[i] * desc[i];
    assert.ok(Math.abs(Math.sqrt(sum) - 1) < 1e-4, "L2 length is 1");
    assert.ok(feeds, "session was fed");
    assert.deepEqual(feeds[embedder.INPUT_NAME].dims, [1, src.length]);
    assert.equal(feeds[embedder.INPUT_NAME].type, "float32");
    assert.deepEqual(
      Object.keys(feeds),
      ["input_values"],
      "only the waveform tensor is fed (no lens/secondary inputs)",
    );
  });

  it("feeds the source buffer through without an extra copy", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    const src = new Float32Array(16000).fill(0.01);
    let seen = null;
    rt.sessions[0].run = async (f) => {
      seen = f[embedder.INPUT_NAME].data;
      return { embeddings: { data: new Float32Array(512).fill(0.5) } };
    };
    await embedder.embed(src);
    assert.strictEqual(
      seen,
      src,
      "the waveform must be passed through without a copy",
    );
  });

  it("captures the pre-normalization L2 magnitude as lastMagnitude", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      embeddings: { data: new Float32Array(512).fill(0.5) },
    });
    await embedder.embed(new Float32Array(16000).fill(0.01));
    // ||v|| for 512 values of 0.5 = sqrt(512 * 0.25) = sqrt(128)
    assert.ok(
      Math.abs(embedder.lastMagnitude - Math.sqrt(128)) < 1e-6,
      `expected sqrt(128), got ${embedder.lastMagnitude}`,
    );
    embedder.reset();
    assert.equal(embedder.lastMagnitude, null, "reset() nulls lastMagnitude");
  });

  it("rejects malformed or missing waveform inputs", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    await assert.rejects(() => embedder.embed(null), /required/);
    await assert.rejects(
      () => embedder.embed(new Int16Array(4)),
      /Float32Array/,
    );
    await assert.rejects(
      () => embedder.embed(new Float32Array(0)),
      /one sample/,
    );
  });

  it("throws when not loaded", async () => {
    await assert.rejects(
      () => embedder.embed(new Float32Array(160).fill(0)),
      /not loaded/,
    );
  });

  it("throws on unexpected output shape, missing name, or missing data", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      somethingElse: { data: new Float32Array(512) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(1600).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].outputNames = undefined;
    await assert.rejects(
      () => embedder.embed(new Float32Array(1600).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].outputNames = ["embeddings"];
    rt.sessions[0].run = async () => ({
      embeddings: { data: new Float32Array(999) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(1600).fill(0.01)),
      /output shape/,
    );
    rt.sessions[0].run = async () => ({ embeddings: {} });
    await assert.rejects(
      () => embedder.embed(new Float32Array(1600).fill(0.01)),
      /output shape/,
    );
  });

  it("rejects when the embedding cannot be normalized (and nulls lastMagnitude)", async () => {
    const rt = fakeRuntime();
    await embedder.load({ runtime: rt });
    rt.sessions[0].run = async () => ({
      embeddings: { data: new Float32Array(512) },
    });
    await assert.rejects(
      () => embedder.embed(new Float32Array(1600).fill(0.01)),
      /normalized/,
    );
    assert.equal(embedder.lastMagnitude, 0, "zero-magnitude is captured as 0");
  });
});

// ── Coverage: runtime acquisition without injection, loader internals ──

describe("VoiceWavlmEmbedder — runtime discovery", () => {
  const realDoc = globalThis.document;
  const embedder = VoiceWavlmEmbedder;

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

describe("VoiceWavlmEmbedder — loader internals", () => {
  const realDoc = globalThis.document;
  const embedder = VoiceWavlmEmbedder;

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

// ── Opt-in real ONNX inference against the golden utterances ──
// Runs only when REDOSAN_VOICE_WAVLM_REAL=1 and onnxruntime-node is
// installed. Requires the WavLM Base+ SV model at REDOSAN_VOICE_WAVLM_MODEL
// (local path). Self-consistency assertions: the same-speaker utterances
// (h1a ↔ h1b) must rise above 0.7, a different speaker (h2) and non-speech
// audio (song) must stay below 0.5 against h1a under the raw-waveform path.

const REAL_WAVLM = process.env.REDOSAN_VOICE_WAVLM_REAL === "1";

describe(
  "VoiceWavlmEmbedder — golden self-consistency (real ONNX)",
  { skip: !REAL_WAVLM },
  () => {
    it("h1a↔h1b MATCH, h1↔h2 and h1↔song stay below the false-accept band", async () => {
      const FIXTURES = path.join(__dirname, "fixtures");
      const modelPath = process.env.REDOSAN_VOICE_WAVLM_MODEL;
      assert.ok(
        modelPath,
        "REDOSAN_VOICE_WAVLM_MODEL must point at the ONNX model",
      );
      assert.equal(
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(modelPath))
          .digest("hex"),
        MODEL_PIN,
        "model bytes must match the pinned SHA-256",
      );
      const rt = require("onnxruntime-node");
      await VoiceWavlmEmbedder.load({ runtime: rt });
      const pcm = (name) => {
        const buf = fs.readFileSync(path.join(FIXTURES, `${name}.wav`));
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
        assert.ok(data, `${name}.wav has no data chunk`);
        const s16 = new Int16Array(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        );
        const f32 = new Float32Array(s16.length);
        for (let i = 0; i < s16.length; i++) f32[i] = s16[i] / 32768;
        return f32;
      };
      const h1a = await VoiceWavlmEmbedder.embed(pcm("golden_h1a"));
      const h1b = await VoiceWavlmEmbedder.embed(pcm("golden_h1b"));
      const h2 = await VoiceWavlmEmbedder.embed(pcm("golden_h2"));
      const song = await VoiceWavlmEmbedder.embed(pcm("golden_song"));
      const sameSpeaker = VoiceWavlmEmbedder.cosine(h1a, h1b);
      const otherSpeaker = VoiceWavlmEmbedder.cosine(h1a, h2);
      const nonSpeech = VoiceWavlmEmbedder.cosine(h1a, song);
      assert.ok(
        sameSpeaker >= 0.7,
        `h1a↔h1b cosine ${sameSpeaker.toFixed(6)} < 0.7`,
      );
      assert.ok(
        otherSpeaker < 0.5,
        `h1a↔h2 cosine ${otherSpeaker.toFixed(6)} ≥ 0.5`,
      );
      assert.ok(
        nonSpeech < 0.5,
        `h1a↔song cosine ${nonSpeech.toFixed(6)} ≥ 0.5`,
      );
    });
  },
);
