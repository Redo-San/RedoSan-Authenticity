const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_engine.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_engine.js",
  hostname: "localhost",
  origin: "null",
};

const srcDir = path.join(__dirname, "../../Voice_Biometric");
const modSrc = fs.readFileSync(path.join(srcDir, "voice_engine.js"), "utf8");
vm.runInThisContext(modSrc, {
  filename: path.resolve(srcDir, "voice_engine.js"),
});

const VoiceEngine = globalThis.VoiceEngine;

const SAMPLE_RATE = 16000;

function ones(n) {
  const a = new Float32Array(n).fill(0.001);
  return a;
}

function pcmFor(seconds) {
  return ones(Math.round(SAMPLE_RATE * seconds));
}

function descriptor(value) {
  return new Float32Array(192).fill(value);
}

/** Fake VAD: reports a fixed speech probability per frame. */
function fakeVAD(prob) {
  let seen = 0;
  return {
    _seen: () => seen,
    isReady: () => true,
    preprocess: (block) => new Float32Array(block.length + 64),
    process: () => {
      seen += 1;
      return { probability: prob, dims: [1, 1] };
    },
    isSpeech: (p) => Number.isFinite(p) && p >= 0.5,
    isSilence: (p) => Number.isFinite(p) && p < 0.5,
  };
}

/** Fake anti-spoof: returns a fixed verdict. */
function fakeAntiSpoof(verdict) {
  return {
    isReady: () => true,
    detect: async () => ({ ok: true, verdict, score: 0.9, model: "aasist-l" }),
    getModelKey: () => "aasist-l",
    VERDICTS: {
      BONAFIDE: "BONAFIDE",
      SPOOF: "SPOOF",
      INCONCLUSIVE: "INCONCLUSIVE",
    },
  };
}

/** Fake embedder: returns a fixed normalized 192-d descriptor. */
function fakeEmbedder(value) {
  let calls = 0;
  return {
    _calls: () => calls,
    isReady: () => true,
    embed: async () => {
      calls += 1;
      return descriptor(value);
    },
    normalize: (a) => a,
    cosine: () => Number.NaN,
  };
}

/** Fake features: returns a fake [1, frames, 80] tensor. */
function fakeFeatures(frames) {
  return {
    computeLogMel: () => ({
      data: new Float32Array(frames * 80),
      frames,
    }),
  };
}

/** Fake matcher: same decision contract as VoiceMatcher.decide (cal0 shape). */
function fakeMatcher(cos = 0.91) {
  return {
    _decideCalls: 0,
    cosine: () => cos,
    calibrate: (s, alpha, beta) => alpha * s + beta,
    decide: function (_cos, calibration) {
      this._decideCalls += 1;
      const alpha =
        calibration && Number.isFinite(calibration.alpha)
          ? calibration.alpha
          : 1;
      const beta =
        calibration && Number.isFinite(calibration.beta) ? calibration.beta : 0;
      const threshold =
        calibration && Number.isFinite(calibration.threshold)
          ? calibration.threshold
          : 0.86;
      const score = Number(_cos);
      const llr = Number.isFinite(score) ? alpha * score + beta : NaN;
      let decision = "INCONCLUSIVE";
      if (!Number.isFinite(llr)) decision = "INCONCLUSIVE";
      else if (llr > threshold) decision = "MATCH";
      else if (llr < threshold) decision = "NON_MATCH";
      return { decision, score, llr, threshold, alpha, beta };
    },
    VERDICTS: {
      MATCH: "MATCH",
      NON_MATCH: "NON_MATCH",
      INCONCLUSIVE: "INCONCLUSIVE",
    },
  };
}

const CALIBRATION = {
  schemaVersion: 1,
  operatingPoint: { P_TARGET: 0.01, C_MISS: 1, C_FA: 1 },
  threshold: 0.86,
  metrics: { minDCF: 0.1, Cllr: 0.2 },
  calibration: { alpha: 1, beta: 0 },
  devSet: { id: "dev1", datasetVersion: "v1" },
  model: { version: "1.0.0" },
  preprocessing: { revision: "revision-1" },
};

const FEW_SAFE_DESTS = descriptor(0.0);

describe("VoiceEngine — class structure", () => {
  it("is defined on the global scope", () => {
    assert.ok(VoiceEngine, "VoiceEngine must exist");
  });

  it("is a constructor", () => {
    const e = new VoiceEngine();
    assert.ok(e instanceof VoiceEngine);
  });

  it("exposes version, states, report type and gate order", () => {
    assert.equal(typeof VoiceEngine.VERSION, "string");
    assert.deepEqual(Object.keys(VoiceEngine.STATES).sort(), [
      "BUSY",
      "ERROR",
      "IDLE",
      "LOADING",
      "READY",
    ]);
    assert.equal(VoiceEngine.REPORT_TYPE, "redoSan.voiceBiometricReport");
    assert.deepEqual(VoiceEngine.GATES, ["quality", "pad"]);
  });

  it("exposes the public and stage methods", () => {
    const e = new VoiceEngine();
    for (const m of [
      "load",
      "isLoaded",
      "getState",
      "reset",
      "assessQuality",
      "assessPAD",
      "verify",
      "register",
      "verifyAgainstRegistry",
    ]) {
      assert.equal(typeof e[m], "function", `${m} must be a function`);
    }
  });

  it("starts IDLE and not loaded", () => {
    const e = new VoiceEngine();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
    assert.equal(e.isLoaded(), false);
  });
});

describe("VoiceEngine — state machine", () => {
  it("load() moves IDLE → LOADING → READY even with only stub deps", async () => {
    const e = new VoiceEngine({ vad: fakeVAD(0.9) });
    await e.load();
    assert.equal(e.getState(), VoiceEngine.STATES.READY);
    assert.equal(e.isLoaded(), true);
  });

  it("load() leaves deps untouched when none are injectable", async () => {
    const e = new VoiceEngine();
    await e.load();
    assert.equal(e.getState(), VoiceEngine.STATES.READY);
  });

  it("reset() returns to IDLE from READY", async () => {
    const e = new VoiceEngine();
    await e.load();
    e.reset();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
    assert.equal(e.isLoaded(), false);
  });

  it("rejects verify() before load()", async () => {
    const e = new VoiceEngine();
    await assert.rejects(
      e.verify({ pcm: pcmFor(2), enrolled: FEW_SAFE_DESTS }),
      /not loaded/,
    );
  });

  it("rejects register() before load()", async () => {
    const e = new VoiceEngine();
    await assert.rejects(e.register({ pcm: pcmFor(2) }), /not loaded/);
  });
});

describe("VoiceEngine — assessQuality (ISO/IEC 29794-1 framework, heuristic)", () => {
  it("FAILs silence (VAD speech ratio below threshold)", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.05),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(2), SAMPLE_RATE);
    assert.equal(r.gate, "FAIL");
    assert.ok(r.reasons.includes("silence"));
    assert.equal(r.standard, "ISO/IEC 29794-1 (framework)");
    assert.equal(r.heuristic, true);
  });

  it("PASSes speech (VAD speech ratio above threshold)", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.9),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(3), SAMPLE_RATE);
    assert.equal(r.gate, "PASS");
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(r.speechRatio >= 0.9);
  });

  it("FAILs short utterances on duration before touching VAD", async () => {
    const vad = fakeVAD(0.95);
    const e = new VoiceEngine({
      vad,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(0.5), SAMPLE_RATE);
    assert.equal(r.gate, "FAIL");
    assert.ok(r.reasons.includes("duration"));
    assert.equal(
      vad._seen(),
      0,
      "VAD must not be consulted after duration FAIL",
    );
  });

  it("returns INCONCLUSIVE (non-blocking) when the VAD yields no finite probability", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(Number.NaN),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(2), SAMPLE_RATE);
    assert.equal(r.gate, "INCONCLUSIVE");
    assert.ok(r.reasons.some((x) => /vad/i.test(x)));
  });

  it("uses RMS energy fallback when no VAD is injectable", async () => {
    const e = new VoiceEngine({ minSpeechSeconds: 2, minSpeechRatio: 0.5 });
    const r = await e.assessQuality(pcmFor(2), SAMPLE_RATE);
    assert.equal(typeof r.speechRatio, "number");
    assert.ok(["PASS", "FAIL"].includes(r.gate));
  });
});

describe("VoiceEngine — assessPAD (ISO/IEC 30107-3 verdict)", () => {
  it("is INCONCLUSIVE (non-blocking) when no anti-spoof is present", async () => {
    const e = new VoiceEngine();
    const r = await e.assessPAD(pcmFor(4), SAMPLE_RATE);
    assert.equal(r.gate, "INCONCLUSIVE");
    assert.equal(r.standard, "ISO/IEC 30107-3");
  });

  it("maps BONAFIDE → PASS", async () => {
    const e = new VoiceEngine({ antispoof: fakeAntiSpoof("BONAFIDE") });
    const r = await e.assessPAD(pcmFor(4), SAMPLE_RATE);
    assert.equal(r.gate, "PASS");
    assert.equal(r.verdict, "BONAFIDE");
  });

  it("maps SPOOF → FAIL", async () => {
    const e = new VoiceEngine({ antispoof: fakeAntiSpoof("SPOOF") });
    const r = await e.assessPAD(pcmFor(4), SAMPLE_RATE);
    assert.equal(r.gate, "FAIL");
    assert.equal(r.verdict, "SPOOF");
  });

  it("maps anti-spoof INCONCLUSIVE → INCONCLUSIVE (non-blocking)", async () => {
    const e = new VoiceEngine({ antispoof: fakeAntiSpoof("INCONCLUSIVE") });
    const r = await e.assessPAD(pcmFor(4), SAMPLE_RATE);
    assert.equal(r.gate, "INCONCLUSIVE");
  });
});

describe("VoiceEngine — MANDATORY gate order: low-quality / PAD-FAIL never yields MATCH", () => {
  it("quality FAIL + cosine 0.91 → INCONCLUSIVE and decide() is never called", async () => {
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.05), // silence → quality FAIL
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(2),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(report.gates.quality.gate, "FAIL");
    assert.equal(
      matcher._decideCalls,
      0,
      "decide() must not run after a gate FAIL",
    );
    assert.equal(report.score, undefined);
  });

  it("PAD-FAIL + cosine 0.91 → INCONCLUSIVE and decide() is never called", async () => {
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.95), // quality PASS
      antispoof: fakeAntiSpoof("SPOOF"), // PAD FAIL
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(report.gates.quality.gate, "PASS");
    assert.equal(report.gates.pad.gate, "FAIL");
    assert.equal(
      matcher._decideCalls,
      0,
      "decide() must not run after a gate FAIL",
    );
  });

  it("quality FAIL short-circuits even when anti-spoof would PASS", async () => {
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.05),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(2),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(matcher._decideCalls, 0);
  });

  it("high cosine 0.91 + all gates PASS + calibration → MATCH", async () => {
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "MATCH");
    assert.equal(matcher._decideCalls, 1);
    assert.equal(report.gates.quality.gate, "PASS");
    assert.equal(report.gates.pad.gate, "PASS");
  });

  it("non-blocking INCONCLUSIVE at quality AND pad still allows MATCH", async () => {
    // quality: VAD returns NaN → INCONCLUSIVE; pad: no anti-spoof → INCONCLUSIVE
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(Number.NaN),
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.gates.quality.gate, "INCONCLUSIVE");
    assert.equal(report.gates.pad.gate, "INCONCLUSIVE");
    assert.equal(
      report.verdict,
      "MATCH",
      "INCONCLUSIVE gates must not block scoring",
    );
    assert.equal(matcher._decideCalls, 1);
  });

  it("low cosine 0.30 + all gates PASS → NON_MATCH", async () => {
    const matcher = fakeMatcher(0.3);
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(-0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "NON_MATCH");
    assert.equal(matcher._decideCalls, 1);
  });

  it("report carries type + gates + calibration traceability when applied", async () => {
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.type, VoiceEngine.REPORT_TYPE);
    assert.equal(report.calibration_model_version, "1.0.0");
    assert.equal(report.calibration_dataset_version, "v1");
    assert.equal(report.operating_point.P_TARGET, 0.01);
    assert.equal(typeof report.threshold, "number");
    assert.equal(typeof report.minDCF, "number");
    assert.equal(typeof report.Cllr, "number");
    assert.equal(typeof report.llr, "number");
  });

  it("verify() uses the injectable features+fbank path when embed is non-trivial", async () => {
    const embedder = fakeEmbedder(0.5);
    const features = fakeFeatures(50);
    const matcher = fakeMatcher(0.91);
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      features,
      fbank: new Float32Array(201 * 80),
      embedder,
      matcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "MATCH");
    assert.equal(embedder._calls(), 1);
  });
});

describe("VoiceEngine — register (enrollment pipeline)", () => {
  function registryStub() {
    const calls = [];
    return {
      _calls: () => calls,
      add: async (label, template) => {
        calls.push({ label, template });
        return 1;
      },
    };
  }

  it("builds a protected template + ISO/IEC 19794-13 record when deps present", async () => {
    const templateProtection = {
      generate: () => ({
        code: new Uint8Array([1, 2, 3]),
        bits: 192,
        params: {},
        keyFingerprint: "kf1",
      }),
    };
    const standards = {
      createRecord: (params) => ({
        recordVersion: { major: 1, minor: 0 },
        audioMetaInfo: params.audioMetaInfo,
      }),
    };
    const registry = registryStub();
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      templateProtection,
      standards,
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.register({
      pcm: pcmFor(4),
      label: "speaker-a",
      audioMetaInfo: {
        channelCount: 1,
        samplingRate: 16000,
        bitsPerSample: 16,
        audioDuration: 4,
      },
    });
    assert.equal(report.mode, "register");
    assert.equal(report.ok, true);
    assert.equal(report.template.keyFingerprint, "kf1");
    assert.deepEqual(Array.from(report.template.code), [1, 2, 3]);
    assert.equal(report.record.recordVersion.major, 1);
    assert.equal(registry._calls().length, 1);
    assert.equal(registry._calls()[0].label, "speaker-a");
  });

  it("applies the quality gate at registration (no template on FAIL)", async () => {
    const registry = registryStub();
    const e = new VoiceEngine({
      vad: fakeVAD(0.05), // silence → quality FAIL
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array(1),
          bits: 8,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.register({ pcm: pcmFor(2), label: "speaker-a" });
    assert.equal(report.ok, false);
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(
      registry._calls().length,
      0,
      "no template may be stored on quality FAIL",
    );
  });

  it("never exposes the raw descriptor in the register report", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([9]),
          bits: 8,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.register({ pcm: pcmFor(4), label: "speaker-a" });
    assert.equal("descriptor" in report, false);
    assert.equal("embedding" in report, false);
  });
});

describe("VoiceEngine — verifyAgainstRegistry (protected-code path)", () => {
  it("runs the gates then delegates to registry.authenticate", async () => {
    const authenticateLog = [];
    const registry = {
      authenticate: async (query, label, threshold) => {
        authenticateLog.push({ query, label, threshold });
        return { ok: true, match: { id: 1, label }, similarity: 0.93 };
      },
    };
    const threshold = 0.86;
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry,
      threshold,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verifyAgainstRegistry({
      pcm: pcmFor(4),
      label: "speaker-a",
      threshold,
    });
    assert.equal(report.ok, true);
    assert.equal(report.verdict, "MATCH");
    assert.equal(authenticateLog.length, 1);
    assert.equal(authenticateLog[0].label, "speaker-a");
    assert.equal(authenticateLog[0].threshold, threshold);
  });

  it("never calls registry.authenticate when a gate FAILs", async () => {
    const authenticateLog = [];
    const registry = {
      authenticate: async () => {
        authenticateLog.push(1);
        return { ok: true, match: {}, similarity: 0.99 };
      },
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.05), // quality FAIL
      embedder: fakeEmbedder(0.5),
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verifyAgainstRegistry({
      pcm: pcmFor(2),
      label: "speaker-a",
    });
    assert.equal(report.ok, false);
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(authenticateLog.length, 0);
  });
});

describe("VoiceEngine — embedder selection (constructor)", () => {
  it("defaults to window.VoiceONNXEmbedder when present", () => {
    const saved = globalThis.VoiceONNXEmbedder;
    try {
      globalThis.VoiceONNXEmbedder = { marker: "ecapa" };
      const e = new VoiceEngine();
      assert.equal(e._embedder && e._embedder.marker, "ecapa");
    } finally {
      if (saved === undefined) delete globalThis.VoiceONNXEmbedder;
      else globalThis.VoiceONNXEmbedder = saved;
    }
  });

  it("honors an explicit null embedder (WavLM-off / embedderless mode)", () => {
    const e = new VoiceEngine({ embedder: null });
    assert.equal(e._embedder, null);
  });

  it("honors an explicit falsy-only embedder sentinel", () => {
    const e = new VoiceEngine({ embedder: undefined });
    assert.equal(e._embedder, null);
  });
});

describe("VoiceEngine — _waveformForEncoder", () => {
  const e = new VoiceEngine();

  it("returns a Float32Array by identity (no copy)", () => {
    const src = pcmFor(1);
    assert.strictEqual(e._waveformForEncoder(src), src);
  });

  it("converts Int16 PCM by dividing by 32768", () => {
    const src = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const out = e._waveformForEncoder(src);
    assert.ok(out instanceof Float32Array);
    assert.equal(out.length, src.length);
    assert.ok(Math.abs(out[0] - 0) < 1e-9);
    assert.ok(Math.abs(out[1] - 0.5) < 1e-9);
    assert.ok(Math.abs(out[2] + 0.5) < 1e-9);
    assert.ok(Math.abs(out[3] - 32767 / 32768) < 1e-9);
    assert.ok(Math.abs(out[4] + 1) < 1e-9);
  });
});

describe("VoiceEngine — _embed input routing", () => {
  it("feeds a waveform embedder (WavLM) the raw Float32 PCM, skipping log-mel", async () => {
    const seen = [];
    const boom = () => {
      throw new Error("computeLogMel must not be called for waveform");
    };
    const embedder = {
      INPUT_KIND: "waveform",
      embed: async (pcm) => {
        seen.push(pcm);
        return descriptor(0.5);
      },
      normalize: (a) => a,
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      features: { computeLogMel: boom },
      fbank: new Float32Array(201 * 80),
      embedder,
      matcher: fakeMatcher(),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const pcm = pcmFor(2);
    const desc = await e._embed(pcm, SAMPLE_RATE);
    assert.equal(desc.length, 192);
    assert.ok(seen.length, 1);
    assert.strictEqual(
      seen[0],
      pcm,
      "waveform embedder must receive the exact Float32Array, unchanged",
    );
  });

  it("converts Int16 PCM for a waveform embedder via _waveformForEncoder", async () => {
    const seen = [];
    const embedder = {
      INPUT_KIND: "waveform",
      embed: async (pcm) => {
        seen.push(pcm);
        return descriptor(0.5);
      },
      normalize: (a) => a,
    };
    const e = new VoiceEngine({ embedder });
    await e.load();
    const s16 = new Int16Array(32000).fill(8000);
    await e._embed(s16, SAMPLE_RATE);
    assert.ok(seen[0] instanceof Float32Array);
    assert.equal(seen[0].length, s16.length);
    assert.ok(Math.abs(seen[0][0] - 8000 / 32768) < 1e-9);
  });

  it("keeps the fbank (ECAPA) default routing when INPUT_KIND is absent", async () => {
    const embedder = {
      embed: async (pcm) => {
        assert.ok(
          pcm instanceof Float32Array,
          "ECAPA expects Float32 features",
        );
        return descriptor(0.5);
      },
      normalize: (a) => a,
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      features: fakeFeatures(50),
      fbank: new Float32Array(201 * 80),
      embedder,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const desc = await e._embed(pcmFor(2), SAMPLE_RATE);
    assert.equal(desc.length, 192);
  });

  it("throws when no embedder is available", async () => {
    const e = new VoiceEngine({ embedder: null });
    await e.load();
    await assert.rejects(
      e._embed(pcmFor(2), SAMPLE_RATE),
      /embedding stage is not available/,
    );
  });
});

/* ──────────────────────────────────────────────────────────────────
   NEW TESTS — targeting uncovered branches
   ────────────────────────────────────────────────────────────────── */

describe("VoiceEngine — _transition (illegal state)", () => {
  it("throws on illegal IDLE → READY transition", () => {
    const e = new VoiceEngine();
    assert.throws(
      () => e._transition("ready"),
      /illegal state transition.*idle.*ready/,
    );
  });

  it("throws on illegal IDLE → BUSY transition", () => {
    const e = new VoiceEngine();
    assert.throws(() => e._transition("busy"), /illegal state transition/);
  });

  it("throws on illegal IDLE → ERROR transition", () => {
    const e = new VoiceEngine();
    assert.throws(() => e._transition("error"), /illegal state transition/);
  });
});

describe("VoiceEngine — load() error path", () => {
  it("transitions to ERROR and re-throws when dep.load() fails", async () => {
    const badDep = {
      isReady: () => false,
      load: async () => {
        throw new Error("dep init failed");
      },
    };
    const e = new VoiceEngine({ vad: badDep });
    await assert.rejects(e.load(), /dep init failed/);
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
  });
});

describe("VoiceEngine — load() skips deps already ready", () => {
  it("skips dep.load() when dep.isReady() returns true", async () => {
    let loadCalled = false;
    const readyDep = {
      isReady: () => true,
      load: async () => {
        loadCalled = true;
      },
    };
    const e = new VoiceEngine({ vad: readyDep });
    await e.load();
    assert.equal(loadCalled, false);
    assert.equal(e.getState(), VoiceEngine.STATES.READY);
  });
});

describe("VoiceEngine — _require static method", () => {
  it("returns opts when opts[name] is a function", () => {
    const dep = { fallback: true };
    const opts = { myFn: () => {} };
    const result = VoiceEngine._require(dep, "myFn", opts);
    assert.strictEqual(result, opts);
  });

  it("returns dep when opts is null", () => {
    const dep = { fallback: true };
    const result = VoiceEngine._require(dep, "myFn", null);
    assert.strictEqual(result, dep);
  });

  it("returns dep when opts[name] is not a function", () => {
    const dep = { fallback: true };
    const opts = { myFn: "not a function" };
    const result = VoiceEngine._require(dep, "myFn", opts);
    assert.strictEqual(result, dep);
  });

  it("returns dep when opts has no such key", () => {
    const dep = { fallback: true };
    const opts = { other: () => {} };
    const result = VoiceEngine._require(dep, "myFn", opts);
    assert.strictEqual(result, dep);
  });
});

describe("VoiceEngine — isSpeechFn fallback (VAD without isSpeech)", () => {
  it("uses fallback (p >= 0.5) when vad.isSpeech is not a function", async () => {
    const vadNoSpeech = {
      isReady: () => true,
      preprocess: (block) => new Float32Array(block.length + 64),
      process: () => ({ probability: 0.8, dims: [1, 1] }),
      // deliberately no isSpeech method
    };
    const e = new VoiceEngine({
      vad: vadNoSpeech,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(3), SAMPLE_RATE);
    // probability 0.8 >= 0.5 → speech, ratio = 1.0 → PASS
    assert.equal(r.gate, "PASS");
  });

  it("uses fallback when vad.isSpeech is a string (not function)", async () => {
    const vadBadSpeech = {
      isReady: () => true,
      preprocess: (block) => new Float32Array(block.length + 64),
      process: () => ({ probability: 0.3, dims: [1, 1] }),
      isSpeech: "not a function",
    };
    const e = new VoiceEngine({
      vad: vadBadSpeech,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    const r = await e.assessQuality(pcmFor(3), SAMPLE_RATE);
    // probability 0.3 < 0.5 → silence via fallback → FAIL
    assert.equal(r.gate, "FAIL");
    assert.ok(r.reasons.includes("silence"));
  });
});

describe("VoiceEngine — assessPAD error path", () => {
  it("returns INCONCLUSIVE with pad-error when anti.detect() throws", async () => {
    const throwingAnti = {
      isReady: () => true,
      detect: async () => {
        throw new Error("model crash");
      },
      getModelKey: () => "broken",
      VERDICTS: { BONAFIDE: "BONAFIDE", SPOOF: "SPOOF" },
    };
    const e = new VoiceEngine({ antispoof: throwingAnti });
    const r = await e.assessPAD(pcmFor(4), SAMPLE_RATE);
    assert.equal(r.gate, "INCONCLUSIVE");
    assert.ok(r.reasons.includes("pad-error"));
    assert.equal(r.verdict, null);
  });
});

describe("VoiceEngine — _decisionCalib with costModel", () => {
  it("uses matcher.thresholdFor when costModel is present and no direct threshold", () => {
    let thresholdForCalled = false;
    const matcherWithCost = {
      thresholdFor: (cm) => {
        thresholdForCalled = true;
        return 0.92;
      },
    };
    const e = new VoiceEngine({ matcher: matcherWithCost });
    const cal = {
      costModel: { pTarget: 0.01, cMiss: 1, cFa: 1 },
      calibration: { alpha: 1.2, beta: -0.1 },
    };
    const result = e._decisionCalib(cal);
    assert.equal(thresholdForCalled, true);
    assert.equal(result.threshold, 0.92);
    assert.equal(result.alpha, 1.2);
    assert.equal(result.beta, -0.1);
  });

  it("uses direct threshold when calibration.threshold is a number", () => {
    const e = new VoiceEngine();
    const cal = {
      threshold: 0.75,
      costModel: { pTarget: 0.01 },
      calibration: { alpha: 1, beta: 0 },
    };
    const result = e._decisionCalib(cal);
    assert.equal(result.threshold, 0.75);
  });

  it("falls back to this._threshold when no calibration", () => {
    const e = new VoiceEngine();
    const result = e._decisionCalib(null);
    assert.equal(result.threshold, 0.86);
  });

  it("uses default alpha=1 and beta=0 when calibration.calibration is missing", () => {
    const e = new VoiceEngine();
    const result = e._decisionCalib({});
    assert.equal(result.alpha, 1);
    assert.equal(result.beta, 0);
  });

  it("uses default alpha when calibration.alpha is NaN", () => {
    const e = new VoiceEngine();
    const cal = { calibration: { alpha: NaN, beta: 0 } };
    const result = e._decisionCalib(cal);
    assert.equal(result.alpha, 1);
  });

  it("uses default beta when calibration.beta is Infinity", () => {
    const e = new VoiceEngine();
    const cal = { calibration: { alpha: 1, beta: Infinity } };
    const result = e._decisionCalib(cal);
    assert.equal(result.beta, 0);
  });

  it("uses costModel path only when matcher has thresholdFor", () => {
    const e = new VoiceEngine({ matcher: {} }); // no thresholdFor
    const cal = {
      costModel: { pTarget: 0.01 },
      calibration: { alpha: 1, beta: 0 },
    };
    const result = e._decisionCalib(cal);
    // falls back to this._threshold since costModel path is skipped
    assert.equal(result.threshold, 0.86);
  });
});

describe("VoiceEngine — verify() error paths", () => {
  it("rejects with TypeError when pcm is empty array", async () => {
    const e = new VoiceEngine();
    await e.load();
    await assert.rejects(
      e.verify({ pcm: new Float32Array(0), enrolled: descriptor(0.5) }),
      /pcm input is required/,
    );
  });

  it("rejects with Error when matcher is not available", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      matcher: null,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verify({ pcm: pcmFor(4), enrolled: descriptor(0.5) }),
      /matching stage is not available/,
    );
  });

  it("rejects with TypeError when enrolled is missing", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      matcher: fakeMatcher(0.9),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verify({ pcm: pcmFor(4) }),
      /enrolled descriptor is required/,
    );
  });

  it("transitions to ERROR on internal failure then back to IDLE on reset", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      matcher: fakeMatcher(0.9),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    try {
      await e.verify({ pcm: pcmFor(4) }); // no enrolled → throws
    } catch (_) {
      // expected
    }
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
    e.reset();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
  });
});

describe("VoiceEngine — register() error paths", () => {
  it("rejects with TypeError when pcm is empty", async () => {
    const e = new VoiceEngine();
    await e.load();
    await assert.rejects(
      e.register({ pcm: new Float32Array(0) }),
      /pcm input is required/,
    );
  });

  it("rejects when pcm is null", async () => {
    const e = new VoiceEngine();
    await e.load();
    await assert.rejects(e.register({ pcm: null }), /pcm input is required/);
  });

  it("creates default audioMetaInfo when input has none and no standards", async () => {
    let capturedParams = null;
    const standards = {
      createRecord: (params) => {
        capturedParams = params;
        return { recordVersion: { major: 1, minor: 0 } };
      },
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([1]),
          bits: 8,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      standards,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await e.register({
      pcm: pcmFor(4),
      label: "speaker-a",
      // no audioMetaInfo provided
    });
    // capturedParams.audioMetaInfo should be the default
    assert.equal(capturedParams.audioMetaInfo.channelCount, 1);
    assert.equal(capturedParams.audioMetaInfo.samplingRate, 16000);
    assert.equal(capturedParams.audioMetaInfo.bitsPerSample, 16);
  });

  it("transitions to ERROR on internal failure in register", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    try {
      await e.register({ pcm: null }); // null pcm → throws
    } catch (_) {
      // expected
    }
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
  });
});

describe("VoiceEngine — verifyAgainstRegistry() error paths", () => {
  it("rejects with TypeError when pcm is empty", async () => {
    const e = new VoiceEngine();
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: new Float32Array(0), label: "a" }),
      /pcm input is required/,
    );
  });

  it("rejects with TypeError when pcm is null", async () => {
    const e = new VoiceEngine();
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: null, label: "a" }),
      /pcm input is required/,
    );
  });

  it("returns INCONCLUSIVE on PAD FAIL without calling registry.authenticate", async () => {
    let authCalled = false;
    const registry = {
      authenticate: async () => {
        authCalled = true;
        return { ok: true };
      },
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("SPOOF"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verifyAgainstRegistry({
      pcm: pcmFor(4),
      label: "speaker-a",
    });
    assert.equal(report.ok, false);
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(authCalled, false);
  });

  it("rejects when template protection is missing", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: null,
      registry: { authenticate: async () => ({ ok: true }) },
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: pcmFor(4), label: "a" }),
      /template protection is required/,
    );
  });

  it("rejects when template protection has no generate method", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: { notGenerate: true },
      registry: { authenticate: async () => ({ ok: true }) },
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: pcmFor(4), label: "a" }),
      /template protection is required/,
    );
  });

  it("rejects when registry.authenticate is missing", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry: {},
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: pcmFor(4), label: "a" }),
      /registry authenticate is required/,
    );
  });

  it("rejects when registry is null", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry: null,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: pcmFor(4), label: "a" }),
      /registry authenticate is required/,
    );
  });

  it("rejects when label is missing", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry: { authenticate: async () => ({ ok: true }) },
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    await assert.rejects(
      e.verifyAgainstRegistry({ pcm: pcmFor(4) }),
      /label is required/,
    );
  });

  it("returns NON_MATCH when registry.authenticate returns no-match", async () => {
    const registry = {
      authenticate: async () => ({
        ok: false,
        reason: "no-match",
        similarity: 0.3,
      }),
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verifyAgainstRegistry({
      pcm: pcmFor(4),
      label: "speaker-a",
    });
    assert.equal(report.ok, false);
    assert.equal(report.verdict, "NON_MATCH");
    assert.equal(report.reason, "no-match");
  });

  it("transitions to ERROR on internal failure in verifyAgainstRegistry", async () => {
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry: { authenticate: async () => ({ ok: true }) },
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    try {
      await e.verifyAgainstRegistry({ pcm: pcmFor(4) }); // no label → throws
    } catch (_) {
      // expected
    }
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
  });
});

describe("VoiceEngine — error → idle recovery cycle", () => {
  it("recoverable via reset after verify error", async () => {
    const e = new VoiceEngine();
    await e.load();
    try {
      await e.verify({ pcm: null });
    } catch (_) {}
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
    e.reset();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
  });

  it("recoverable via reset after register error", async () => {
    const e = new VoiceEngine();
    await e.load();
    try {
      await e.register({ pcm: null });
    } catch (_) {}
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
    e.reset();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
  });

  it("recoverable via reset after verifyAgainstRegistry error", async () => {
    const e = new VoiceEngine();
    await e.load();
    try {
      await e.verifyAgainstRegistry({ pcm: null });
    } catch (_) {}
    assert.equal(e.getState(), VoiceEngine.STATES.ERROR);
    e.reset();
    assert.equal(e.getState(), VoiceEngine.STATES.IDLE);
  });
});

describe("VoiceEngine — assessQuality RMS fallback (no VAD) edge cases", () => {
  it("FAILs with silence when all samples are exactly zero", async () => {
    const e = new VoiceEngine({ minSpeechSeconds: 2, minSpeechRatio: 0.5 });
    const pcm = new Float32Array(SAMPLE_RATE * 3); // 3 seconds of silence
    const r = await e.assessQuality(pcm, SAMPLE_RATE);
    assert.equal(r.gate, "FAIL");
    assert.ok(r.reasons.includes("silence"));
  });

  it("PASSes with active RMS energy and no VAD", async () => {
    const pcm = pcmFor(3); // 0.001 amplitude → rms ≈ 0.001 > FLOOR
    const e = new VoiceEngine({ minSpeechSeconds: 2, minSpeechRatio: 0.5 });
    const r = await e.assessQuality(pcm, SAMPLE_RATE);
    assert.equal(r.gate, "PASS");
  });
});

describe("VoiceEngine — verifyAgainstRegistry with INCONCLUSIVE from registry", () => {
  it("returns INCONCLUSIVE when registry returns ok:false with other reason", async () => {
    const registry = {
      authenticate: async () => ({
        ok: false,
        reason: "threshold-not-met",
        similarity: 0.6,
      }),
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      antispoof: fakeAntiSpoof("BONAFIDE"),
      embedder: fakeEmbedder(0.5),
      templateProtection: {
        generate: () => ({
          code: new Uint8Array([7]),
          bits: 192,
          params: {},
          keyFingerprint: "kf",
        }),
      },
      registry,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verifyAgainstRegistry({
      pcm: pcmFor(4),
      label: "speaker-a",
    });
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.equal(report.ok, false);
  });
});

describe("VoiceEngine — _decisionCalib with non-numeric threshold", () => {
  it("falls back to this._threshold when calibration.threshold is string", () => {
    const e = new VoiceEngine();
    const cal = {
      threshold: "not-a-number",
      calibration: { alpha: 1, beta: 0 },
    };
    const result = e._decisionCalib(cal);
    assert.equal(result.threshold, 0.86);
  });
});

describe("VoiceEngine — verify() with NaN score from matcher", () => {
  it("returns verdict based on NaN score through decide", async () => {
    const nanMatcher = {
      cosine: () => Number.NaN,
      decide: function (_cos, cal) {
        return {
          decision: "INCONCLUSIVE",
          score: NaN,
          llr: NaN,
          threshold: cal.threshold,
          alpha: cal.alpha,
          beta: cal.beta,
        };
      },
    };
    const e = new VoiceEngine({
      vad: fakeVAD(0.95),
      embedder: fakeEmbedder(0.5),
      matcher: nanMatcher,
      minSpeechSeconds: 2,
      minSpeechRatio: 0.5,
    });
    await e.load();
    const report = await e.verify({
      pcm: pcmFor(4),
      enrolled: descriptor(0.5),
      calibration: CALIBRATION,
    });
    assert.equal(report.verdict, "INCONCLUSIVE");
    assert.ok(Number.isNaN(report.score));
  });
});
