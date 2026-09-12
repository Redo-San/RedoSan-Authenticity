const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_antispoof.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_antispoof.js",
  hostname: "localhost",
  origin: "null",
};

const srcDir = path.join(__dirname, "../../Voice_Biometric");
const modSrc = fs.readFileSync(path.join(srcDir, "voice_antispoof.js"), "utf8");
vm.runInThisContext(modSrc, {
  filename: path.resolve(srcDir, "voice_antispoof.js"),
});

const AntiSpoof = globalThis.VoiceAntiSpoof;

function pcm(length, fill) {
  const a = new Float32Array(length);
  a.fill(fill === undefined ? 0.01 : fill);
  return a;
}

function fakeRuntime(logits) {
  return {
    Tensor: function (type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    },
    InferenceSession: {
      create: async function () {
        return {
          outputNames: ["logits"],
          run: async function () {
            return {
              logits: {
                data:
                  logits === undefined
                    ? new Float32Array([-2.5, 1.75])
                    : logits,
              },
            };
          },
        };
      },
    },
  };
}

describe("VoiceAntiSpoof — ONNX gate contract (AASIST, opset 17)", () => {
  it("exposes the frozen AASIST window of 64600 samples @16 kHz", () => {
    assert.equal(AntiSpoof.MODEL_WINDOW, 64600);
    assert.equal(AntiSpoof.SAMPLE_RATE, 16000);
    // plan says "4 s"; verified constant is 64600/16000 = 4.0375 s
    assert.equal(
      (AntiSpoof.MODEL_WINDOW / AntiSpoof.SAMPLE_RATE).toFixed(4),
      "4.0375",
    );
  });

  it("declares the documented ONNX input/output names", () => {
    assert.equal(AntiSpoof.INPUT_NAME, "wav");
    assert.equal(AntiSpoof.OUTPUT_NAME, "logits");
    assert.equal(AntiSpoof.OPSET, 17);
  });

  it("registers both models (aasist-l default, aasist optional)", () => {
    assert.equal(AntiSpoof.DEFAULT_MODEL_KEY, "aasist-l");
    assert.deepEqual(Object.keys(AntiSpoof.MODELS).sort(), [
      "aasist",
      "aasist-l",
    ]);
    for (const key of ["aasist", "aasist-l"]) {
      const m = AntiSpoof.MODELS[key];
      assert.equal(typeof m.id, "string");
      assert.ok(m.url.endsWith(".onnx"), `${key} url is an onnx artifact`);
      assert.equal(m.fp32, true, `${key} is FP32`);
      assert.equal(m.window, 64600, `${key} uses the 64600-sample window`);
      if (key === "aasist-l") {
        // 0.085306 M params from the upstream benchmark meta.yaml
        assert.equal(m.parameters, 85306);
      } else {
        // full AASIST param count not re-measured here (honest null)
        assert.equal(m.parameters, null);
      }
    }
    assert.ok(AntiSpoof.MODELS["aasist-l"].url.endsWith("aasist-l.onnx"));
    assert.ok(AntiSpoof.MODELS["aasist"].url.endsWith("aasist.onnx"));
  });

  it("pins both model SHA-256s (measured from committed artifacts, C2)", () => {
    // Measured byte-for-byte from Voice_Biometric/models/aasist{-l,}.onnx at
    // Phase C2 (2026-09-09); enforced before session create (SRI pattern).
    for (const [key, expected] of Object.entries({
      "aasist-l":
        "f43f0a638b52846f5d0e630c0a738d10e9306325945127c6f8662d559585f218",
      aasist:
        "130e536266b7c537f9a13029e1612a9f392fd1cc827783683b6d1c062a3db5e1",
    })) {
      assert.match(AntiSpoof.MODELS[key].sha256, /^[0-9a-f]{64}$/, key);
      assert.equal(AntiSpoof.MODELS[key].sha256, expected, key);
    }
  });

  it("belongs to the browser-gate family: WASM-first execution providers", () => {
    // research §3.3: Selu is absent from the WebGPU table -> wasm first
    assert.deepEqual(AntiSpoof.DEFAULT_EXECUTION_PROVIDERS, ["wasm"]);
  });
});

describe("VoiceAntiSpoof — input spec validation (reject mel)", () => {
  it("accepts a raw float32 waveform", () => {
    const spec = AntiSpoof.validateInputSpec({
      pcm: new Float32Array(AntiSpoof.MODEL_WINDOW),
      sampleRate: 16000,
    });
    assert.equal(spec.ok, true);
  });

  it("accepts a bare Float32Array as 16 kHz raw waveform", () => {
    const spec = AntiSpoof.validateInputSpec(
      new Float32Array(AntiSpoof.MODEL_WINDOW),
    );
    assert.equal(spec.ok, true);
  });

  it("rejects the mel/spectrogram object shape ({data, frames})", () => {
    const melLike = {
      data: new Float32Array(80 * 201),
      frames: 201,
    };
    const spec = AntiSpoof.validateInputSpec(melLike);
    assert.equal(spec.ok, false);
    assert.match(spec.reason, /mel/);
    assert.throws(() => AntiSpoof.frameWaveform(melLike, 16000), /mel/);
  });

  it("rejects a multi-band spectrogram ({data, frames, nBands})", () => {
    const spec = AntiSpoof.validateInputSpec({
      data: new Float32Array(201 * 80),
      frames: 201,
      nBands: 80,
    });
    assert.equal(spec.ok, false);
    assert.match(spec.reason, /mel/);
  });

  it("rejects nested (rank-2) raw input", () => {
    const nested = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const spec = AntiSpoof.validateInputSpec(nested);
    assert.equal(spec.ok, false);
    assert.match(spec.reason, /raw waveform/);
  });

  it("rejects non-float or non-finite samples", () => {
    const spec = AntiSpoof.validateInputSpec({
      pcm: [1, 2, 3],
      sampleRate: 16000,
    });
    assert.equal(spec.ok, false);
    const bad = new Float32Array(100);
    bad[5] = NaN;
    const spec2 = AntiSpoof.validateInputSpec({ pcm: bad, sampleRate: 16000 });
    assert.equal(spec2.ok, false);
    assert.match(spec2.reason, /finite/);
  });
});

describe("VoiceAntiSpoof — resample + 64600-sample framer", () => {
  it("resamples linearly between rates", () => {
    // 8000 Hz, 4 samples, up to 16 kHz -> 8 samples, linear interp
    const out = AntiSpoof.resampleLinear(
      Float32Array.from([1, 2, 3, 4]),
      8000,
      16000,
    );
    assert.equal(out.length, 8);
    const expected = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4];
    for (let i = 0; i < expected.length; i += 1)
      assert.ok(Math.abs(out[i] - expected[i]) < 1e-6);
  });

  it("frames an exactly-window waveform unchanged", () => {
    const win = pcm(AntiSpoof.MODEL_WINDOW, 0.25);
    const out = AntiSpoof.frameWaveform(win, 16000);
    assert.equal(out.length, AntiSpoof.MODEL_WINDOW);
    assert.equal(out[0], 0.25);
    assert.equal(out[AntiSpoof.MODEL_WINDOW - 1], 0.25);
  });

  it("keeps only the FIRST 64600 samples of a longer utterance", () => {
    const long = pcm(70000, 0.5);
    const out = AntiSpoof.frameWaveform(long, 16000);
    assert.equal(out.length, AntiSpoof.MODEL_WINDOW);
    assert.equal(out[0], 0.5);
    // 70000-samples input; 64600th sample maps to input index 64599
    assert.equal(
      out[AntiSpoof.MODEL_WINDOW - 1],
      long[AntiSpoof.MODEL_WINDOW - 1],
    );
  });

  it("tile-repeats (pad_fixed parity) a shorter utterance to 64600", () => {
    // 32300 samples of [0,1] pattern at 16 kHz: 2.01875 s, tile-repeated.
    const short = new Float32Array(32300);
    for (let i = 0; i < short.length; i += 1) short[i] = i % 4;
    const out = AntiSpoof.frameWaveform(short, 16000);
    assert.equal(out.length, AntiSpoof.MODEL_WINDOW);
    // reps = floor(64600/32300)+1 = 3 tiles cropped to 64600
    assert.equal(out[0], short[0]);
    assert.equal(out[32300], short[0]);
    assert.equal(out[64600 - 1], short[64600 - 1 - 32300]); // second tile wraps
  });

  it("resamples 8 kHz input before framing (deterministic 64600)", () => {
    const half = pcm(32300, 0.125); // 4.0375 s at 8 kHz
    const out = AntiSpoof.frameWaveform(half, 8000);
    assert.equal(out.length, AntiSpoof.MODEL_WINDOW);
  });
});

describe("VoiceAntiSpoof — score extraction (logits[:,1] = bonafide)", () => {
  it("treats index 1 as the bona-fide logit (higher = bonafide)", () => {
    const s = AntiSpoof.extractScore(
      { logits: { data: new Float32Array([-0.5, 3.2]) } },
      null,
    );
    assert.ok(Math.abs(s.score - 3.2) < 1e-6);
    assert.ok(Math.abs(s.bonafideLogit - 3.2) < 1e-6);
    assert.equal(s.spoofLogit, -0.5);
  });

  it("throws when the output is not the [.,2] logits tensor", () => {
    assert.throws(
      () =>
        AntiSpoof.extractScore({ logits: { data: new Float32Array(3) } }, null),
      /output shape/,
    );
    assert.throws(() => AntiSpoof.extractScore({}, null), /output shape/);
    assert.throws(() => AntiSpoof.extractScore(null, null), /output shape/);
  });
});

describe("VoiceAntiSpoof — calibration / verdict (no hard-coded threshold)", () => {
  it("defaults to INCONCLUSIVE + calibrated:false without calibration", () => {
    const v = AntiSpoof.applyCalibration(2.5, null);
    assert.equal(v.verdict, AntiSpoof.VERDICTS.INCONCLUSIVE);
    assert.equal(v.calibrated, false);
    assert.equal(v.score, 2.5);
  });

  it("classifies above the calibrated threshold as BONAFIDE", () => {
    const cal = { alpha: 1, beta: 0, threshold: 0 };
    const v = AntiSpoof.applyCalibration(1.2, cal);
    assert.equal(v.verdict, AntiSpoof.VERDICTS.BONAFIDE);
    assert.equal(v.calibrated, true);
    assert.equal(v.llr, 1.2);
  });

  it("classifies at/below the calibrated threshold as SPOOF", () => {
    const cal = { alpha: 1, beta: 0, threshold: 0 };
    assert.equal(
      AntiSpoof.applyCalibration(-2.0, cal).verdict,
      AntiSpoof.VERDICTS.SPOOF,
    );
    assert.equal(
      AntiSpoof.applyCalibration(0.0, cal).verdict,
      AntiSpoof.VERDICTS.SPOOF,
    );
  });

  it("applies the affine LLR mapping before comparing", () => {
    const cal = { alpha: 2, beta: 1, threshold: 0 };
    // score -1 -> LLR -1 < 0 -> SPOOF; score 1 -> LLR 3 > 0 -> BONAFIDE
    assert.equal(
      AntiSpoof.applyCalibration(-1, cal).verdict,
      AntiSpoof.VERDICTS.SPOOF,
    );
    assert.equal(
      AntiSpoof.applyCalibration(1, cal).verdict,
      AntiSpoof.VERDICTS.BONAFIDE,
    );
  });

  it("never emits BONAFIDE for non-finite scores", () => {
    const cal = { alpha: 1, beta: 0, threshold: -999 };
    assert.equal(
      AntiSpoof.applyCalibration(NaN, cal).verdict,
      AntiSpoof.VERDICTS.INCONCLUSIVE,
    );
  });
});

describe("VoiceAntiSpoof — load()/detect() with an injected runtime", () => {
  beforeEach(() => {
    AntiSpoof.reset();
  });

  it("loads a model key from the registry over wasm and reports the backend", async () => {
    const ok = await AntiSpoof.load({
      runtime: fakeRuntime(),
      modelKey: "aasist-l",
      verifyModel: false,
    });
    assert.equal(ok, true);
    assert.equal(AntiSpoof.isReady(), true);
    assert.equal(AntiSpoof.getModelKey(), "aasist-l");
    assert.equal(AntiSpoof.getBackend(), "wasm");
  });

  it("loads the full AASIST variant when requested (model switcher)", async () => {
    const ok = await AntiSpoof.load({
      runtime: fakeRuntime(),
      modelKey: "aasist",
      verifyModel: false,
    });
    assert.equal(ok, true);
    assert.equal(AntiSpoof.getModelKey(), "aasist");
  });

  it("refuses unknown model keys with a descriptive error", async () => {
    const ok = await AntiSpoof.load({
      runtime: fakeRuntime(),
      modelKey: "aasist-xl",
      verifyModel: false,
    });
    assert.equal(ok, false);
    assert.match(AntiSpoof.getError(), /[Uu]nknown model/);
    assert.equal(AntiSpoof.isReady(), false);
  });

  it("detect() scores a raw waveform and reports provenance", async () => {
    await AntiSpoof.load({
      runtime: fakeRuntime(new Float32Array([-2.5, 1.75])),
      modelKey: "aasist-l",
      verifyModel: false,
    });
    const res = await AntiSpoof.detect(
      { pcm: pcm(AntiSpoof.MODEL_WINDOW, 0.3), sampleRate: 16000 },
      null,
    );
    assert.equal(res.ok, true);
    assert.equal(res.score, 1.75); // logits[:,1] = bonafide logit
    assert.equal(res.bonafideLogit, 1.75);
    assert.equal(res.spoofLogit, -2.5);
    assert.equal(res.windowSamples, AntiSpoof.MODEL_WINDOW);
    assert.equal(res.model, "aasist-l");
    assert.equal(res.backend, "wasm");
    assert.equal(res.calibrated, false);
    assert.equal(res.verdict, AntiSpoof.VERDICTS.INCONCLUSIVE);
  });

  it("detect() throws on mel-shaped input even when loaded", async () => {
    await AntiSpoof.load({
      runtime: fakeRuntime(),
      modelKey: "aasist-l",
      verifyModel: false,
    });
    await assert.rejects(
      AntiSpoof.detect({ data: new Float32Array(201 * 80), frames: 201 }),
      /mel/,
    );
  });

  it("detect() reflects the fitted calibration when supplied", async () => {
    await AntiSpoof.load({
      runtime: fakeRuntime(new Float32Array([-2.0, 0.0])),
      modelKey: "aasist-l",
      verifyModel: false,
    });
    const res = await AntiSpoof.detect(
      { pcm: pcm(AntiSpoof.MODEL_WINDOW, 0.3), sampleRate: 16000 },
      { alpha: 1, beta: 0, threshold: 0 },
    );
    assert.equal(res.calibrated, true);
    assert.equal(res.verdict, AntiSpoof.VERDICTS.SPOOF);
    assert.ok(res.threshold === 0);
  });

  it("throws when not loaded", async () => {
    AntiSpoof.reset();
    await assert.rejects(
      AntiSpoof.detect(
        { pcm: pcm(AntiSpoof.MODEL_WINDOW), sampleRate: 16000 },
        null,
      ),
      /not loaded/,
    );
  });
});

describe("VoiceAntiSpoof — branch coverage (error/edge paths)", () => {
  beforeEach(() => AntiSpoof.reset());

  it("_fetchModelBytes throws when fetch is not a function (line 464-465)", async () => {
    const savedFetch = globalThis.fetch;
    delete globalThis.fetch;
    await assert.rejects(
      () => AntiSpoof._fetchModelBytes("http://example.com/model.onnx"),
      /fetch support/,
    );
    globalThis.fetch = savedFetch;
  });

  it("_fetchModelBytes throws when fetch returns non-ok (line 468-471)", async () => {
    globalThis.fetch = async function () {
      return { ok: false, status: 500 };
    };
    await assert.rejects(
      () => AntiSpoof._fetchModelBytes("http://example.com/model.onnx"),
      /HTTP 500/,
    );
    delete globalThis.fetch;
  });

  it("_verifySha256 throws when crypto is undefined (line 484-491)", async () => {
    const savedCrypto = globalThis.crypto;
    delete globalThis.crypto;
    await assert.rejects(
      () => AntiSpoof._verifySha256(new ArrayBuffer(4), "abc"),
      /WebCrypto/,
    );
    globalThis.crypto = savedCrypto;
  });

  it("_verifySha256 returns false on hash mismatch (line 499)", async () => {
    globalThis.crypto = { subtle: require("crypto").webcrypto.subtle };
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    const result = await AntiSpoof._verifySha256(buf, "0000000000000000");
    assert.equal(result, false);
    delete globalThis.crypto;
  });

  it("_loadRuntime rejects when document is undefined (line 510-514)", async () => {
    await assert.rejects(
      () => AntiSpoof._loadRuntime("http://example.com/ort.js"),
      /not available/,
    );
  });

  it("load() returns false when all providers fail (line 219)", async () => {
    const rt = fakeRuntime(new Float32Array([-1, 1]));
    rt.InferenceSession.create = async function () {
      throw new Error("no provider works");
    };
    const ok = await AntiSpoof.load({ runtime: rt, verifyModel: false });
    assert.equal(ok, false);
    assert.ok(AntiSpoof.getError().includes("no provider works"));
  });

  it("load() with no options defaults to empty object (line 163)", async () => {
    const ok = await AntiSpoof.load();
    assert.equal(ok, false);
  });

  it("load() with runtime that is unusable (line 189-192)", async () => {
    const ok = await AntiSpoof.load({
      runtime: { Tensor: null },
      verifyModel: false,
    });
    assert.equal(ok, false);
  });
});
