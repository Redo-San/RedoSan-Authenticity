/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */

/**
 * Voice_Biometric/voice_engine.js
 *
 * Orchestration layer for the browser voice-verification chain, mirroring
 * face_engine.js. Every algorithmic stage is behind an injectable dependency
 * (options override the window.* singletons) so the unit suite can stub all of
 * them, and the real ONNX/IndexedDB stages keep their own tool-level tests.
 *
 * Decision-gate order — MANDATORY and unit-tested (§8.2), encoded here as the
 * ordered GATES list with short-circuit on FAIL:
 *
 *   Input → Quality (ISO/IEC 29794-1 framework, heuristic) → (Anti-Spoof FAIL
 *   → INCONCLUSIVE/REJECT) → speaker score → Calibration → MATCH /
 *   INCONCLUSIVE / NON-MATCH.
 *
 * A FAIL at Quality or PAD never reaches the scorer: even a 0.91 cosine over a
 * low-quality or PAD-failed sample yields INCONCLUSIVE. A non-blocking
 * INCONCLUSIVE (e.g. anti-spoof absent) does not stop scoring — it is recorded
 * in the report and the matcher decides.
 */
function VoiceEngine(options) {
  options = options || {};
  const w = typeof window !== "undefined" ? window : globalThis;
  this._opts = options;
  this._vad = options.vad || w.VoiceVAD || null;
  this._features = options.features || w.VoiceFeatures || null;
  this._embedder =
    options.embedder === undefined
      ? w.VoiceONNXEmbedder || null
      : options.embedder;
  this._antispoof = options.antispoof || w.VoiceAntiSpoof || null;
  this._matcher = options.matcher || w.VoiceMatcher || null;
  this._registry = options.registry || w.VoiceRegistry || null;
  this._templateProtection =
    options.templateProtection || w.VoiceTemplateProtection || null;
  this._standards = options.standards || w.VoiceStandards || null;
  this._fbank = options.fbank || null;
  this._calibration = options.calibration || null;
  this._minSpeechSeconds =
    options.minSpeechSeconds === undefined ? 2 : options.minSpeechSeconds;
  this._minSpeechRatio =
    options.minSpeechRatio === undefined ? 0.5 : options.minSpeechRatio;
  this._sampleRate = options.sampleRate || 16000;
  this._threshold = options.threshold === undefined ? 0.86 : options.threshold;
  this._state = VoiceEngine.STATES.IDLE;
  this._stages = [];
}

VoiceEngine.VERSION = "1.0.0";
VoiceEngine.REPORT_TYPE = "redoSan.voiceBiometricReport";
VoiceEngine.GATES = ["quality", "pad"];
VoiceEngine.STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  BUSY: "busy",
  ERROR: "error",
});

const TRANSITIONS = {
  idle: ["loading"],
  loading: ["ready", "error"],
  ready: ["busy"],
  busy: ["ready", "error"],
  error: ["idle"],
};

VoiceEngine.prototype._transition = function (next) {
  const allowed = TRANSITIONS[this._state] || [];
  if (allowed.indexOf(next) === -1) {
    throw new Error(
      "VoiceEngine: illegal state transition " + this._state + " → " + next,
    );
  }
  this._state = next;
};

VoiceEngine.prototype.getState = function () {
  return this._state;
};

VoiceEngine.prototype.isLoaded = function () {
  return this._state === VoiceEngine.STATES.READY;
};

VoiceEngine.prototype.reset = function () {
  this._state = VoiceEngine.STATES.IDLE;
  this._stages = [];
  return this;
};

VoiceEngine.prototype.load = async function (opts) {
  this._transition("loading");
  try {
    const deps = [this._vad, this._embedder, this._antispoof];
    for (let i = 0; i < deps.length; i += 1) {
      const d = deps[i];
      if (
        d &&
        typeof d.load === "function" &&
        !(typeof d.isReady === "function" && d.isReady())
      ) {
        await d.load(opts);
      }
    }
    this._transition("ready");
  } catch (err) {
    this._transition("error");
    throw err;
  }
  return this;
};

VoiceEngine._require = function (dep, name, opts) {
  if (opts && typeof opts[name] === "function") return opts;
  return dep;
};

/**
 * Quality gate — ISO/IEC 29794-1 framework framing, deterministic heuristic.
 * Duration and VAD speech ratio (RMS energy fallback when no VAD is present).
 * @returns {{gate: string, score: number, speechRatio: number,
 *   durationMs: number, reasons: string[], standard: string, heuristic: boolean}}
 */
VoiceEngine.prototype.assessQuality = async function (pcm, sampleRate, opts) {
  sampleRate = sampleRate || this._sampleRate;
  opts = opts || {};
  const minSeconds =
    opts.minSpeechSeconds === undefined
      ? this._minSpeechSeconds
      : opts.minSpeechSeconds;
  const minRatio =
    opts.minSpeechRatio === undefined
      ? this._minSpeechRatio
      : opts.minSpeechRatio;
  const reasons = [];
  const durationMs = (pcm.length / sampleRate) * 1000;
  const base = {
    durationMs,
    standard: "ISO/IEC 29794-1 (framework)",
    heuristic: true,
  };

  if (durationMs < minSeconds * 1000) {
    reasons.push("duration");
    return Object.assign({}, base, {
      gate: "FAIL",
      score: 0,
      speechRatio: 0,
      reasons,
    });
  }

  const vad = opts.vad || this._vad;
  if (vad && typeof vad.process === "function") {
    const BLOCK = 512;
    const blocks = Math.max(1, Math.floor(pcm.length / BLOCK));
    let speech = 0;
    let seenNaN = false;
    for (let i = 0; i < blocks; i += 1) {
      const frame = pcm.subarray(i * BLOCK, (i + 1) * BLOCK);
      const res = await vad.process(frame);
      const prob = res && res.probability;
      if (!Number.isFinite(prob)) {
        seenNaN = true;
        break;
      }
      const isSpeechFn =
        typeof vad.isSpeech === "function"
          ? vad.isSpeech.bind(vad)
          : (p) => p >= 0.5;
      if (isSpeechFn(prob)) speech += 1;
    }
    if (seenNaN) {
      reasons.push("vad-unavailable");
      return Object.assign({}, base, {
        gate: "INCONCLUSIVE",
        score: 0,
        speechRatio: Number.NaN,
        reasons,
      });
    }
    const speechRatio = speech / blocks;
    if (speechRatio < minRatio) {
      reasons.push("silence");
      return Object.assign({}, base, {
        gate: "FAIL",
        score: Math.round(speechRatio * 100),
        speechRatio,
        reasons,
      });
    }
    return Object.assign({}, base, {
      gate: "PASS",
      score: Math.round(speechRatio * 100),
      speechRatio,
      reasons,
    });
  }

  const BLOCK = 512;
  const blocks = Math.max(1, Math.floor(pcm.length / BLOCK));
  const FLOOR = 1e-4;
  let active = 0;
  let peak = 0;
  for (let i = 0; i < blocks; i += 1) {
    let sum = 0;
    const end = Math.min((i + 1) * BLOCK, pcm.length);
    for (let j = i * BLOCK; j < end; j += 1) {
      const v = pcm[j];
      sum += v * v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    const rms = Math.sqrt(sum / (end - i * BLOCK));
    if (rms >= FLOOR) active += 1;
  }
  const speechRatio = active / blocks;
  if (peak === 0 || speechRatio < minRatio) {
    reasons.push("silence");
    return Object.assign({}, base, {
      gate: "FAIL",
      score: speechRatio === 0 ? 0 : Math.round(speechRatio * 100),
      speechRatio,
      reasons,
    });
  }
  return Object.assign({}, base, {
    gate: "PASS",
    score: Math.round(speechRatio * 100),
    speechRatio,
    reasons,
  });
};

/**
 * PAD gate — ISO/IEC 30107-3: verdict from the anti-spoof stage, or a
 * non-blocking INCONCLUSIVE when no stage is present.
 * @returns {Promise<{gate: string, verdict: string|null,
 *   standard: string, reasons?: string[]}>}
 */
VoiceEngine.prototype.assessPAD = async function (pcm, sampleRate, opts) {
  sampleRate = sampleRate || this._sampleRate;
  opts = opts || {};
  const anti = opts.antispoof || this._antispoof;
  const standard = "ISO/IEC 30107-3";
  if (!anti || typeof anti.detect !== "function") {
    return {
      gate: "INCONCLUSIVE",
      verdict: null,
      standard,
      reasons: ["no-anti-spoof"],
    };
  }
  try {
    const res = await anti.detect(pcm, opts.calibration || this._calibration);
    const verdict = res && res.verdict;
    const V = anti.VERDICTS || { BONAFIDE: "BONAFIDE", SPOOF: "SPOOF" };
    if (verdict === V.SPOOF) {
      return { gate: "FAIL", verdict, standard, reasons: ["spoof"] };
    }
    if (verdict === V.BONAFIDE) {
      return { gate: "PASS", verdict, standard, reasons: [] };
    }
    return {
      gate: "INCONCLUSIVE",
      verdict,
      standard,
      reasons: ["pad-inconclusive"],
    };
  } catch (err) {
    return {
      gate: "INCONCLUSIVE",
      verdict: null,
      standard,
      reasons: ["pad-error"],
    };
  }
};

VoiceEngine.prototype._embed = async function (pcm, sampleRate) {
  const features = this._features;
  const fbank = this._fbank;
  const embedder = this._embedder;
  if (!embedder || typeof embedder.embed !== "function") {
    throw new Error("VoiceEngine: embedding stage is not available");
  }
  let emb;
  if (embedder.INPUT_KIND === "waveform") {
    emb = await embedder.embed(this._waveformForEncoder(pcm));
  } else if (
    features &&
    fbank &&
    typeof features.computeLogMel === "function"
  ) {
    const mel = features.computeLogMel(
      pcm,
      fbank,
      sampleRate || this._sampleRate,
    );
    emb = await embedder.embed(mel && mel.data ? mel.data : mel);
  } else {
    emb = await embedder.embed(pcm);
  }
  if (!emb) throw new Error("VoiceEngine: embedding failed");
  if (typeof embedder.normalize === "function") emb = embedder.normalize(emb);
  return emb;
};

/**
 * Waveform encoders (WavLM et al.) consume raw Float32 PCM in the full-scale
 * ±1.0 range. Web Audio decode already produces that; an Int16Array input
 * (test/tool callers) is converted by dividing by 32768. Pass-through returns
 * the exact same object when it is already a Float32Array.
 * @param {ArrayLike<number>} pcm
 * @returns {Float32Array}
 */
VoiceEngine.prototype._waveformForEncoder = function (pcm) {
  let out, i;
  if (pcm instanceof Float32Array) return pcm;
  out = new Float32Array(pcm.length);
  for (i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
  return out;
};

/**
 * Reduce a calibration manifest (schemaVersion:1, nested calibration.*) to the
 * {alpha, beta, threshold} decision triple the matcher.decide contract expects
 * (top-level fields, mirroring VoiceMatcher's cal0 shape). Unknown pieces fall
 * back to neutral defaults so scoring never hard-crashes a consumer.
 */
VoiceEngine.prototype._decisionCalib = function (calibration) {
  const c = (calibration && calibration.calibration) || null;
  let alpha = c && Number.isFinite(c.alpha) ? c.alpha : 1;
  let beta = c && Number.isFinite(c.beta) ? c.beta : 0;
  let threshold = this._threshold;
  if (calibration) {
    if (typeof calibration.threshold === "number")
      threshold = calibration.threshold;
    else if (
      calibration.costModel &&
      this._matcher &&
      typeof this._matcher.thresholdFor === "function"
    ) {
      threshold = this._matcher.thresholdFor(calibration.costModel);
    }
  }
  return { alpha, beta, threshold };
};

VoiceEngine.prototype._applyCalibration = function (calibration) {
  const out = {};
  if (!calibration) return out;
  if (calibration.model && calibration.model.version) {
    out.calibration_model_version = calibration.model.version;
  }
  if (calibration.devSet && calibration.devSet.datasetVersion) {
    out.calibration_dataset_version = calibration.devSet.datasetVersion;
  }
  if (calibration.operatingPoint)
    out.operating_point = calibration.operatingPoint;
  if (typeof calibration.threshold === "number")
    out.threshold = calibration.threshold;
  if (calibration.metrics) {
    if (typeof calibration.metrics.minDCF === "number")
      out.minDCF = calibration.metrics.minDCF;
    if (typeof calibration.metrics.Cllr === "number")
      out.Cllr = calibration.metrics.Cllr;
  }
  return out;
};

VoiceEngine.prototype._baseReport = function (mode, gates, extra) {
  const report = Object.assign(
    {
      type: VoiceEngine.REPORT_TYPE,
      mode,
      state: this._state,
      ok: true,
      gates,
      verdict: "INCONCLUSIVE",
      generatedAt: new Date().toISOString(),
      stages: this._stages.length ? this._stages.slice() : [],
    },
    extra || {},
  );
  return report;
};

VoiceEngine.prototype._stage = function (stage, status, detail) {
  this._stages.push({ stage, status, at: new Date().toISOString(), detail });
};

VoiceEngine.prototype._requireLoaded = function () {
  if (this._state !== VoiceEngine.STATES.READY) {
    throw new Error("VoiceEngine: not loaded — call load() first");
  }
};

/**
 * Verify pipeline. Enforces the gate order; a FAIL at quality/PAD short-circuits
 * to INCONCLUSIVE and matcher.decide() is never reached.
 * @param {{pcm: ArrayLike<number>, sampleRate?: number, enrolled?: ArrayLike<number>,
 *   calibration?: object, opts?: object}} input
 * @returns {Promise<object>} redoSan.voiceBiometricReport
 */
VoiceEngine.prototype.verify = async function (input) {
  this._requireLoaded();
  this._stages = [];
  this._transition("busy");
  try {
    const pcm = input && input.pcm;
    if (!pcm || !pcm.length) {
      throw new TypeError("VoiceEngine: pcm input is required");
    }
    const sampleRate = input.sampleRate || this._sampleRate;
    const calibration = input.calibration || this._calibration;
    const matcher = this._matcher;
    this._stage("input", "ok", { samples: pcm.length, sampleRate });

    const gates = {};

    gates.quality = await this.assessQuality(pcm, sampleRate, input.opts);
    this._stage("quality", gates.quality.gate, gates.quality.reasons);
    if (gates.quality.gate === "FAIL") {
      const report = this._baseReport("verify", gates, {
        ok: false,
        verdict: "INCONCLUSIVE",
        shortCircuit: "quality",
      });
      report.gates.pad = { gate: "NOT_RUN" };
      this._transition("ready");
      return report;
    }

    gates.pad = await this.assessPAD(pcm, sampleRate, input.opts);
    this._stage("pad", gates.pad.gate, gates.pad.reasons);
    if (gates.pad.gate === "FAIL") {
      const report = this._baseReport("verify", gates, {
        ok: false,
        verdict: "INCONCLUSIVE",
        shortCircuit: "pad",
      });
      this._transition("ready");
      return report;
    }

    if (!matcher || typeof matcher.cosine !== "function") {
      throw new Error("VoiceEngine: matching stage is not available");
    }
    if (!input.enrolled) {
      throw new TypeError(
        "VoiceEngine: enrolled descriptor is required for scoring",
      );
    }

    const query = await this._embed(pcm, sampleRate);
    this._stage("embed", "ok", { samples: pcm.length });
    const score = matcher.cosine(query, input.enrolled);
    this._stage("score", "ok", { score });

    const decideResult = matcher.decide
      ? matcher.decide(score, this._decisionCalib(calibration), {
          threshold: this._threshold,
        })
      : null;
    const verdict = decideResult ? decideResult.decision : "INCONCLUSIVE";
    this._stage("calibration", "ok", {});

    const report = this._baseReport("verify", gates, {
      ok: true,
      verdict,
      score,
      llr: decideResult ? decideResult.llr : undefined,
      threshold:
        decideResult && typeof decideResult.threshold === "number"
          ? decideResult.threshold
          : this._threshold,
      alpha: decideResult ? decideResult.alpha : undefined,
      beta: decideResult ? decideResult.beta : undefined,
    });
    Object.assign(report, this._applyCalibration(calibration));
    this._transition("ready");
    return report;
  } catch (err) {
    this._transition("error");
    throw err;
  }
};

/**
 * Enrollment pipeline. Applies the quality gate; on FAIL no template is built
 * and nothing touches the registry. Never exposes the raw descriptor.
 * @param {{pcm: ArrayLike<number>, sampleRate?: number, label?: string,
 *   audioMetaInfo?: object, metadata?: object}} input
 * @returns {Promise<object>} redoSan.voiceBiometricReport
 */
VoiceEngine.prototype.register = async function (input) {
  this._requireLoaded();
  this._stages = [];
  this._transition("busy");
  try {
    const pcm = input && input.pcm;
    if (!pcm || !pcm.length) {
      throw new TypeError("VoiceEngine: pcm input is required");
    }
    const sampleRate = input.sampleRate || this._sampleRate;
    this._stage("input", "ok", { samples: pcm.length, sampleRate });

    const gates = {};
    gates.quality = await this.assessQuality(pcm, sampleRate, input.opts);
    this._stage("quality", gates.quality.gate, gates.quality.reasons);
    if (gates.quality.gate === "FAIL") {
      const report = this._baseReport("register", gates, {
        ok: false,
        verdict: "INCONCLUSIVE",
        shortCircuit: "quality",
      });
      this._transition("ready");
      return report;
    }

    const emb = await this._embed(pcm, sampleRate);
    this._stage("embed", "ok", { samples: pcm.length });

    const report = this._baseReport("register", gates, {
      ok: true,
      verdict: "READY",
      label: input.label,
    });

    if (
      this._templateProtection &&
      typeof this._templateProtection.generate === "function"
    ) {
      const template = this._templateProtection.generate(emb);
      report.template = {
        code: template.code,
        bits: template.bits,
        params: template.params || {},
        keyFingerprint: template.keyFingerprint,
      };
      this._stage("template-protection", "ok", { bits: template.bits });
    }

    if (this._standards && typeof this._standards.createRecord === "function") {
      report.record = this._standards.createRecord({
        audioMetaInfo: input.audioMetaInfo || {
          channelCount: 1,
          samplingRate: sampleRate,
          bitsPerSample: 16,
        },
        audioContent: pcm,
      });
      this._stage("record", "created", { schema: "ISO/IEC 19794-13" });
    }

    if (this._registry && report.template && input.label) {
      const id = await this._registry.add(
        input.label,
        report.template,
        input.metadata,
      );
      report.registryId = id;
      this._stage("registry", "stored", { id });
    }

    this._transition("ready");
    return report;
  } catch (err) {
    this._transition("error");
    throw err;
  }
};

/**
 * Protected-code verification against the registry (throttled, lockout-aware).
 * Runs the gates first; registry.authenticate is never reached on a gate FAIL.
 * @param {{pcm: ArrayLike<number>, sampleRate?: number, label?: string,
 *   threshold?: number, metadata?: object}} input
 * @returns {Promise<object>} redoSan.voiceBiometricReport
 */
VoiceEngine.prototype.verifyAgainstRegistry = async function (input) {
  this._requireLoaded();
  this._stages = [];
  this._transition("busy");
  try {
    const pcm = input && input.pcm;
    if (!pcm || !pcm.length) {
      throw new TypeError("VoiceEngine: pcm input is required");
    }
    const sampleRate = input.sampleRate || this._sampleRate;
    const threshold =
      input.threshold === undefined ? this._threshold : input.threshold;
    this._stage("input", "ok", { samples: pcm.length, sampleRate });

    const gates = {};
    gates.quality = await this.assessQuality(pcm, sampleRate, input.opts);
    this._stage("quality", gates.quality.gate, gates.quality.reasons);
    if (gates.quality.gate === "FAIL") {
      const report = this._baseReport("verify", gates, {
        ok: false,
        verdict: "INCONCLUSIVE",
        shortCircuit: "quality",
        mode: "verify",
      });
      this._transition("ready");
      return report;
    }

    gates.pad = await this.assessPAD(pcm, sampleRate, input.opts);
    this._stage("pad", gates.pad.gate, gates.pad.reasons);
    if (gates.pad.gate === "FAIL") {
      const report = this._baseReport("verify", gates, {
        ok: false,
        verdict: "INCONCLUSIVE",
        shortCircuit: "pad",
        mode: "verify",
      });
      this._transition("ready");
      return report;
    }

    if (
      !this._templateProtection ||
      typeof this._templateProtection.generate !== "function"
    ) {
      throw new Error(
        "VoiceEngine: template protection is required for registry verification",
      );
    }
    if (!this._registry || typeof this._registry.authenticate !== "function") {
      throw new Error(
        "VoiceEngine: registry authenticate is required for registry verification",
      );
    }
    if (!input.label) {
      throw new TypeError(
        "VoiceEngine: label is required for registry verification",
      );
    }

    const emb = await this._embed(pcm, sampleRate);
    this._stage("embed", "ok", { samples: pcm.length });
    const protectedQuery = this._templateProtection.generate(emb);
    this._stage("template-protection", "ok", {});

    const res = await this._registry.authenticate(
      protectedQuery.code,
      input.label,
      threshold,
    );
    this._stage("registry", "ok", { ok: res.ok, reason: res.reason });

    let verdict = "INCONCLUSIVE";
    if (res.ok) verdict = "MATCH";
    else if (res.reason === "no-match") verdict = "NON_MATCH";

    const report = this._baseReport("verify", gates, {
      ok: !!res.ok,
      verdict,
      similarity: res.similarity,
      reason: res.reason,
      mode: "verify",
    });
    Object.assign(report, this._applyCalibration(this._calibration));
    this._transition("ready");
    return report;
  } catch (err) {
    this._transition("error");
    throw err;
  }
};

if (typeof window !== "undefined") window.VoiceEngine = VoiceEngine;
if (typeof module !== "undefined" && module.exports)
  module.exports = VoiceEngine;
