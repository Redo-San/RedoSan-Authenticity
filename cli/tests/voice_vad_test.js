const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_vad.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_vad.js",
  hostname: "localhost",
  origin: "null",
};

const modSrc = fs.readFileSync(
  path.join(__dirname, "../../Voice_Biometric/voice_vad.js"),
  "utf8",
);
vm.runInThisContext(modSrc, {
  filename: path.resolve(__dirname, "../../Voice_Biometric/voice_vad.js"),
});

const VoiceVAD = globalThis.VoiceVAD;

// Pinned model digest measured from the upstream artifact (2026-09-08):
// runanywhere/silero-vad-v5/silero_vad.onnx == snakers4/silero-vad master
// silero_vad.onnx (byte-identical), opset 16, 2 327 524 B.
const MODEL_PIN =
  "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3";

function fakeRuntime(speechProb) {
  const runCalls = [];
  const createCalls = [];
  let createCount = 0;
  return {
    runCalls,
    createCalls,
    Tensor: function (type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    },
    InferenceSession: {
      create: async function (url, opts) {
        createCalls.push({ url, opts });
        if (url === "fail-once" && createCount === 0) {
          createCount += 1;
          throw new Error("provider failed");
        }
        createCount += 1;
        return {
          run: async function (feeds) {
            runCalls.push(feeds);
            return {
              output: { data: new Float32Array([speechProb]) },
              stateN: { data: new Float32Array(256).fill(0.125) },
            };
          },
          outputNames: ["output"],
        };
      },
    },
  };
}

describe("VoiceVAD — contract (pinned Silero VAD artifact)", () => {
  it("pins the Silero VAD model SHA-256 (measured, lowercase hex)", () => {
    assert.match(VoiceVAD.MODEL_SHA256, /^[0-9a-f]{64}$/);
    assert.equal(VoiceVAD.MODEL_SHA256, MODEL_PIN);
  });

  it("points the default model URL at the root-level silero_vad.onnx", () => {
    assert.ok(VoiceVAD.MODEL_URL.endsWith("/silero_vad.onnx"));
  });

  it("exposes the verified ONNX graph contract", () => {
    assert.equal(VoiceVAD.SAMPLE_RATE, 16000);
    assert.equal(VoiceVAD.WINDOW, 512);
    assert.equal(VoiceVAD.CONTEXT, 64);
    assert.equal(VoiceVAD.INPUT_NAME, "input");
    assert.equal(VoiceVAD.STATE_NAME, "state");
    assert.equal(VoiceVAD.SR_NAME, "sr");
    assert.equal(VoiceVAD.OUTPUT_NAME, "output");
    assert.equal(VoiceVAD.STATE_NAME_OUT, "stateN");
    assert.equal(VoiceVAD.STATE_DIM, 128);
    assert.equal(VoiceVAD.STATE_LAYERS, 2);
    assert.equal(VoiceVAD.STATE_SHAPE.join(","), "2,1,128");
  });

  it("exposes the upstream endpointing thresholds (utils_vad.py defaults)", () => {
    assert.equal(VoiceVAD.THRESHOLD, 0.5);
    assert.equal(VoiceVAD.NEG_THRESHOLD, 0.35);
    assert.equal(VoiceVAD.MIN_SPEECH_MS, 250);
    assert.equal(VoiceVAD.MIN_SILENCE_MS, 100);
    assert.equal(VoiceVAD.SPEECH_PAD_MS, 30);
    assert.equal(VoiceVAD.MAX_UTTERANCE_S, 4);
  });
});

describe("VoiceVAD — preprocess (16 kHz, 512 + 64 context)", () => {
  it("pads the first block with 64 zero context samples to length 576", () => {
    const block = new Float32Array(512).fill(0.5);
    const fed = VoiceVAD.preprocess(block);
    assert.ok(fed instanceof Float32Array);
    assert.equal(fed.length, 512 + VoiceVAD.CONTEXT);
    for (let i = 0; i < VoiceVAD.CONTEXT; i += 1)
      assert.equal(fed[i], 0, "leading context must be zero on first block");
    for (let i = VoiceVAD.CONTEXT; i < fed.length; i += 1)
      assert.equal(fed[i], 0.5, "pcm block follows the context");
  });

  it("carries the trailing 64 samples of the previous block as context", () => {
    const first = new Float32Array(512).fill(0.5);
    VoiceVAD.preprocess(first);
    const second = new Float32Array(512).fill(0.75);
    const fed = VoiceVAD.preprocess(second);
    for (let i = 0; i < VoiceVAD.CONTEXT; i += 1)
      assert.equal(fed[i], 0.5, "context = last 64 samples of previous block");
    for (let i = VoiceVAD.CONTEXT; i < fed.length; i += 1)
      assert.equal(fed[i], 0.75, "new block follows the context");
  });

  it("rejects a block that is not exactly 512 samples", () => {
    assert.throws(
      () => VoiceVAD.preprocess(new Float32Array(511)),
      /exactly 512/,
    );
    assert.throws(
      () => VoiceVAD.preprocess(new Float32Array(513)),
      /exactly 512/,
    );
  });

  it("rejects an empty buffer", () => {
    assert.throws(() => VoiceVAD.preprocess(new Float32Array(0)), /empty/);
  });
});

describe("VoiceVAD — resetStates", () => {
  it("zeroes the internal LSTM state tensor [2,1,128]", () => {
    const s = VoiceVAD.resetStates();
    assert.ok(s instanceof Float32Array);
    assert.equal(s.length, 2 * 1 * 128);
    for (let i = 0; i < s.length; i += 1) assert.equal(s[i], 0);
  });
});

describe("VoiceVAD — process (stateful feed)", () => {
  beforeEach(() => VoiceVAD.reset());
  afterEach(() => VoiceVAD.reset());

  it("feeds input [1,576], zero state, and sr=int64(16000) to the session", async () => {
    const rt = fakeRuntime(0.9);
    await VoiceVAD.load({ runtime: rt });
    const p = await VoiceVAD.process(new Float32Array(512).fill(0.25));
    assert.equal(rt.runCalls.length, 1);
    const feeds = rt.runCalls[0];
    assert.equal(feeds[VoiceVAD.INPUT_NAME].type, "float32");
    assert.deepEqual(feeds[VoiceVAD.INPUT_NAME].dims, [1, 576]);
    assert.equal(feeds[VoiceVAD.INPUT_NAME].data.length, 576);
    assert.equal(feeds[VoiceVAD.STATE_NAME].type, "float32");
    assert.deepEqual(feeds[VoiceVAD.STATE_NAME].dims, [2, 1, 128]);
    assert.equal(feeds[VoiceVAD.SR_NAME].type, "int64");
    assert.deepEqual(feeds[VoiceVAD.SR_NAME].dims, []);
    assert.equal(Number(feeds[VoiceVAD.SR_NAME].data[0]), 16000);
    assert.deepEqual(p.dims, [1, 1]);
    assert.ok(Math.abs(p.probability - 0.9) < 1e-3, "float32 output tolerance");
  });

  it("carries stateN back as state on the next call (stateful)", async () => {
    const rt = fakeRuntime(0.7);
    await VoiceVAD.load({ runtime: rt });
    await VoiceVAD.process(new Float32Array(512).fill(0.25));
    await VoiceVAD.process(new Float32Array(512).fill(0.25));
    assert.equal(rt.runCalls.length, 2);
    const second = rt.runCalls[1];
    assert.deepEqual(second[VoiceVAD.STATE_NAME].dims, [2, 1, 128]);
    const secondState = second[VoiceVAD.STATE_NAME].data;
    assert.equal(
      secondState[0],
      0.125,
      "stateN from the first call is fed back",
    );
  });

  it("returns the probability as a plain number", async () => {
    const rt = fakeRuntime(0.42);
    await VoiceVAD.load({ runtime: rt });
    const p = await VoiceVAD.process(new Float32Array(512).fill(0.1));
    assert.ok(
      Math.abs(p.probability - 0.42) < 1e-3,
      "float32 output tolerance",
    );
    assert.equal(typeof p.probability, "number");
  });

  it("throws when the session is not loaded", async () => {
    await assert.rejects(
      () => VoiceVAD.process(new Float32Array(512)),
      /not loaded/,
    );
  });
});

describe("VoiceVAD — load", () => {
  beforeEach(() => VoiceVAD.reset());
  afterEach(() => VoiceVAD.reset());

  it("loads with an injected runtime and reports the backend", async () => {
    const rt = fakeRuntime(0.5);
    const ok = await VoiceVAD.load({ runtime: rt });
    assert.equal(ok, true);
    assert.equal(VoiceVAD.isReady(), true);
    assert.equal(VoiceVAD.getBackend(), "webgpu");
    assert.equal(VoiceVAD.getError(), null);
  });

  it("is idempotent once a session exists", async () => {
    await VoiceVAD.load({ runtime: fakeRuntime(0.5) });
    const ok = await VoiceVAD.load({ runtime: fakeRuntime(0.5) });
    assert.equal(ok, true);
  });

  it("falls back to the next execution provider", async () => {
    const rt = fakeRuntime(0.5);
    const ok = await VoiceVAD.load({ runtime: rt, modelUrl: "fail-once" });
    assert.equal(ok, true);
    assert.equal(VoiceVAD.getBackend(), "wasm");
  });

  it("returns false when every provider fails without throwing", async () => {
    const rt = fakeRuntime(0.5);
    rt.InferenceSession.create = async function () {
      throw new Error("no provider");
    };
    const ok = await VoiceVAD.load({ runtime: rt });
    assert.equal(ok, false);
    assert.equal(VoiceVAD.isReady(), false);
    assert.ok(VoiceVAD.getError().includes("no provider"));
  });

  it("returns false when an unusable runtime is provided", async () => {
    const ok = await VoiceVAD.load({ runtime: { Tensor: null } });
    assert.equal(ok, false);
    assert.equal(VoiceVAD.isReady(), false);
    assert.ok(VoiceVAD.getError(), "an error message is recorded");
  });

  it("skips verification when a runtime is injected (test seam)", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async function () {
      fetchCalls++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    try {
      const ok = await VoiceVAD.load({ runtime: fakeRuntime(0.5) });
      assert.equal(ok, true);
      assert.equal(fetchCalls, 0);
    } finally {
      delete globalThis.fetch;
    }
  });

  it("verifies model bytes via WebCrypto SHA-256 before session creation", async () => {
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
    globalThis.crypto = { subtle: require("crypto").webcrypto.subtle };
    let verifyCalls = 0;
    const rt = fakeRuntime(0.5);
    const createOrig = rt.InferenceSession.create;
    rt.InferenceSession.create = async function (url) {
      verifyCalls++;
      if (verifyCalls === 1) throw new Error("provider failed"); // let it fall to wasm
      return createOrig.call(this, url);
    };
    try {
      const ok = await VoiceVAD.load({
        runtime: rt,
        modelUrl: "custom.onnx",
        modelSha256: expected,
        verifyModel: true,
      });
      assert.equal(ok, true);
    } finally {
      delete globalThis.fetch;
      delete globalThis.crypto;
    }
  });

  it("refuses to load when verification fails (SHA-256 mismatch)", async () => {
    globalThis.fetch = async function () {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async function () {
          return new Uint8Array([1, 2, 3, 4]).buffer;
        },
      };
    };
    globalThis.crypto = { subtle: require("crypto").webcrypto.subtle };
    try {
      const ok = await VoiceVAD.load({
        runtime: fakeRuntime(0.5),
        modelUrl: "custom.onnx",
        modelSha256: crypto
          .createHash("sha256")
          .update(new Uint8Array([0, 0, 0, 0]))
          .digest("hex"),
        verifyModel: true,
      });
      assert.equal(ok, false);
      assert.equal(VoiceVAD.isReady(), false);
      assert.ok(VoiceVAD.getError().includes("integrity"));
    } finally {
      delete globalThis.fetch;
      delete globalThis.crypto;
    }
  });

  it("returns false when fetch is unavailable for verification", async () => {
    const ok = await VoiceVAD.load({
      runtime: fakeRuntime(0.5),
      modelUrl: "custom.onnx",
      modelSha256: "a".repeat(64),
      verifyModel: true,
    });
    assert.equal(ok, false);
  });
});

describe("VoiceVAD — endpointing helpers", () => {
  it("decides a speech frame with probability >= threshold", () => {
    assert.equal(VoiceVAD.isSpeech(0.5), true);
    assert.equal(VoiceVAD.isSpeech(0.9), true);
    assert.equal(VoiceVAD.isSpeech(0.49), false);
  });

  it("decides the exit (non-speech) with the negative threshold", () => {
    assert.equal(VoiceVAD.isSilence(0.34), true);
    assert.equal(VoiceVAD.isSilence(0.35), false);
    assert.equal(VoiceVAD.isSilence(0.6), false);
  });

  it("computes the exit threshold from threshold - 0.15 (upstream rule)", () => {
    assert.equal(VoiceVAD.NEG_THRESHOLD, VoiceVAD.THRESHOLD - 0.15);
  });
});

describe("VoiceVAD — branch coverage (error/edge paths)", () => {
  beforeEach(() => VoiceVAD.reset());
  afterEach(() => VoiceVAD.reset());

  it("load() with no options defaults to empty object (line 163)", async () => {
    // options = options || {} is exercised by calling load() with no argument
    // It will fail because no runtime is injectable, but we just need the branch
    const ok = await VoiceVAD.load();
    assert.equal(ok, false);
    assert.ok(VoiceVAD.getError());
  });

  it("load() with empty options and no window.ort triggers _loadRuntime fallback (line 189-198)", async () => {
    // No runtime injected, no window.ort, so it tries _loadRuntime which fails
    // in Node.js (no document). Covers the !ort -> !options.runtime -> catch path.
    delete globalThis.window;
    globalThis.window = globalThis;
    const ok = await VoiceVAD.load({});
    delete globalThis.window;
    assert.equal(ok, false);
  });

  it("load() with falsy options runtime that resolves to null (line 165)", async () => {
    const ok = await VoiceVAD.load({ runtime: null });
    assert.equal(ok, false);
  });

  it("process() throws when session output is missing (line 360-361)", async () => {
    const rt = fakeRuntime(0.5);
    rt.InferenceSession.create = async function () {
      return {
        run: async function () {
          return {}; // no output keys at all
        },
        outputNames: ["nonexistent"],
      };
    };
    await VoiceVAD.load({ runtime: rt });
    await assert.rejects(
      () => VoiceVAD.process(new Float32Array(512).fill(0.1)),
      /Unexpected VAD output/,
    );
  });

  it("process() throws when probability is non-finite (line 365)", async () => {
    const rt = fakeRuntime(0.5);
    rt.InferenceSession.create = async function () {
      return {
        run: async function () {
          return {
            output: { data: new Float32Array([NaN]) },
            stateN: { data: new Float32Array(256).fill(0) },
          };
        },
        outputNames: ["output"],
      };
    };
    await VoiceVAD.load({ runtime: rt });
    await assert.rejects(
      () => VoiceVAD.process(new Float32Array(512).fill(0.1)),
      /non-finite/,
    );
  });

  it("process() throws when stateN output is wrong length (line 371-372)", async () => {
    const rt = fakeRuntime(0.5);
    rt.InferenceSession.create = async function () {
      return {
        run: async function () {
          return {
            output: { data: new Float32Array([0.9]) },
            stateN: { data: new Float32Array(10) }, // wrong length, should be 256
          };
        },
        outputNames: ["output"],
      };
    };
    await VoiceVAD.load({ runtime: rt });
    await assert.rejects(
      () => VoiceVAD.process(new Float32Array(512).fill(0.1)),
      /Unexpected VAD state/,
    );
  });

  it("process() throws when stateN output is missing entirely (line 368-372)", async () => {
    const rt = fakeRuntime(0.5);
    rt.InferenceSession.create = async function () {
      return {
        run: async function () {
          return {
            output: { data: new Float32Array([0.9]) },
            // no stateN key
          };
        },
        outputNames: ["output"],
      };
    };
    await VoiceVAD.load({ runtime: rt });
    await assert.rejects(
      () => VoiceVAD.process(new Float32Array(512).fill(0.1)),
      /Unexpected VAD state/,
    );
  });

  it("_verifySha256 throws when crypto is undefined (line 250-255)", async () => {
    const saved = globalThis.crypto;
    delete globalThis.crypto;
    await assert.rejects(
      () => VoiceVAD._verifySha256(new ArrayBuffer(4), "abc"),
      /WebCrypto/,
    );
    globalThis.crypto = saved;
  });

  it("_fetchModelBytes throws when fetch returns non-ok (line 234-237)", async () => {
    globalThis.fetch = async function () {
      return { ok: false, status: 404 };
    };
    await assert.rejects(
      () => VoiceVAD._fetchModelBytes("http://example.com/missing.onnx"),
      /HTTP 404/,
    );
    delete globalThis.fetch;
  });

  it("_fetchModelBytes throws when fetch is not a function (line 230-231)", async () => {
    const savedFetch = globalThis.fetch;
    delete globalThis.fetch;
    await assert.rejects(
      () => VoiceVAD._fetchModelBytes("http://example.com/model.onnx"),
      /fetch support/,
    );
    globalThis.fetch = savedFetch;
  });

  it("_loadRuntime rejects when document is undefined (line 276-280)", async () => {
    await assert.rejects(
      () => VoiceVAD._loadRuntime("http://example.com/ort.js"),
      /not available/,
    );
  });

  it("process() returns probability below neg threshold (line 388)", async () => {
    const rt = fakeRuntime(0.1);
    await VoiceVAD.load({ runtime: rt });
    const p = await VoiceVAD.process(new Float32Array(512).fill(0.1));
    assert.ok(p.probability < VoiceVAD.NEG_THRESHOLD);
  });

  it("process() returns probability above threshold (line 386)", async () => {
    const rt = fakeRuntime(0.8);
    await VoiceVAD.load({ runtime: rt });
    const p = await VoiceVAD.process(new Float32Array(512).fill(0.1));
    assert.ok(p.probability >= VoiceVAD.THRESHOLD);
  });

  it("process() returns probability in hysteresis band (line 388)", async () => {
    const rt = fakeRuntime(0.4); // between 0.35 and 0.5
    await VoiceVAD.load({ runtime: rt });
    const p = await VoiceVAD.process(new Float32Array(512).fill(0.1));
    assert.ok(p.probability >= VoiceVAD.NEG_THRESHOLD);
    assert.ok(p.probability < VoiceVAD.THRESHOLD);
  });
});
