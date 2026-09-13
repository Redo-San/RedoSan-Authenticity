/* c8 ignore start */
(function () {
  if (
    typeof window !== "undefined" &&
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
// -- Voice Liveness: challenge-response + signal indicators (ISO 30107) --
// B5. Research-first liveness assistant for voice_antispoof.js / the voice
// authentication flow. Research note:
//   Voice_Biometric/notes/B5-antispoof-liveness-research.md

/**
 * Voice liveness / presentation-attack context evaluator. This is a
 * HEURISTIC assessment, not a measured detector.
 *
 * - Challenge–response consistency: the caller issues a random prompt and
 *   the recognizer returns a transcript; a replay cannot (reliably) answer a
 *   fresh prompt. Matching is normalized-text equality or a ≥ MIN_COVERAGE
 *   prefix (tolerates ASR trailing truncation / trailing silence).
 * - Signal liveness indicators over a 10 ms envelope (all non-standard,
 *   heuristic-only): digital silence, constant-envelope (machine tone) and
 *   excessive DC bias are attack/artifact flags.
 *
 * Standard references (verified in the research note):
 * - ISO/IEC 30107-1:2023 Note 1: "Liveness detection methods are a subset
 *   of presentation attack detection methods." Challenge-response is a
 *   listed PAD detection category.
 * - ISO/IEC 30107-3:2023 defines APCER / BPCER as device-level metrics.
 *   This repository has NO attack corpus, so APCER/BPCER are deliberately
 *   `null` and `measured: false` — we never ship a fabricated metric.
 * - NIST SP 800-63B: presentation-attack / liveness evidence requires
 *   "additional trust in the sensor"; this module therefore never claims
 *   cryptographic proof of liveness (see `claim` field) and defaults to
 *   `inconclusive`. No verdict threshold is shipped (see voice_antispoof.js
 *   for the calibrated PAD gate); this module is the fallback when the ONNX
 *   gate is unavailable.
 *
 * `evaluate()` returns a self-describing ISO 30107-3-flavoured verdict
 * record (schema voice-liveness-verdict-v1) with all heuristics labelled
 * `standard: "none"`, `heuristic: true` — honest by construction.
 */
var VoiceLiveness = {
  /** Verdict record schema version. */
  SCHEMA: "voice-liveness-verdict-v1",
  /** Verdict vocabulary (ISO-flavoured, APCER/BPCER unmeasured). */
  VERDICTS: {
    BONAFIDE_PRESENTATION: "bonafide-presentation",
    PRESENTATION_ATTACK: "presentation-attack",
    INCONCLUSIVE: "inconclusive",
  },
  /** Minimum response-coverage fraction for a prefix match. */
  MIN_COVERAGE: 0.5,
  /** Envelope window for signal liveness indicators. */
  SIGNAL_WINDOW_MS: 10,
  /** Digital-silence floor (float32 PCM, full-scale ±1). */
  SILENCE_FLOOR: 1e-4,

  /**
   * Normalize a challenge/response string for comparison: lowercase it,
   * trim, collapse internal whitespace. Strips punctuation by default while
   * keeping all script letters/digits (\p{L}\p{N}) so non-Latin languages
   * (e.g. Arabic) are compared deterministically.
   * @param {string|*} text
   * @param {{stripPunctuation?: boolean}} [opts]
   * @returns {string}
   */
  normalizeText: function (text, opts) {
    var s, strip;
    if (typeof text !== "string") return "";
    opts = opts || {};
    strip = opts.stripPunctuation !== false;
    s = text.toLowerCase().trim().replace(/\s+/g, " ");
    if (strip) s = s.replace(/[^\p{L}\p{N}\s]/gu, "");
    return s.trim();
  },

  /**
   * Challenge–response consistency check.
   * @param {{prompt: string, response: string}} input
   * @returns {{ok: boolean, exact: boolean, prefix: boolean, coverage: number, normalizedPrompt: string, normalizedResponse: string, method: string, reason: string}}
   */
  challengeCheck: function (input) {
    var np,
      nr,
      exact = false,
      prefix = false,
      coverage = 0,
      reason = "";
    input = input || {};
    np = this.normalizeText(input.prompt);
    nr = this.normalizeText(input.response);
    if (np.length === 0) {
      return {
        ok: false,
        exact: false,
        prefix: false,
        coverage: 0,
        normalizedPrompt: np,
        normalizedResponse: nr,
        method: "challenge-response",
        reason: "prompt missing",
      };
    }
    if (nr.length === 0) {
      return {
        ok: false,
        exact: false,
        prefix: false,
        coverage: 0,
        normalizedPrompt: np,
        normalizedResponse: nr,
        method: "challenge-response",
        reason: "response missing",
      };
    }
    exact = np === nr;
    if (!exact) {
      prefix = np.startsWith(nr) && nr.length / np.length >= this.MIN_COVERAGE;
    }
    coverage = exact ? 1 : prefix ? nr.length / np.length : 0;
    if (!exact && !prefix) reason = "response does not match the challenge";
    return {
      ok: exact || prefix,
      exact: exact,
      prefix: prefix,
      coverage: coverage,
      normalizedPrompt: np,
      normalizedResponse: nr,
      method: "challenge-response",
      reason: reason,
    };
  },

  /**
   * Compute deterministic physical signal facts over a 10 ms envelope.
   * All outputs are raw measurements; `silence`, `constantEnvelope` and
   * `dcExcessive` are thresholded heuristic flags (thresholds reported).
   * @param {Float32Array} pcm mono float32 waveform
   * @param {number} sampleRate
   * @returns {object}
   */
  signalIndicators: function (pcm, sampleRate) {
    var winLen,
      nFrames,
      sumsq,
      peak,
      sum,
      env,
      i,
      j,
      fi,
      start,
      end,
      fsum,
      frms,
      mean,
      rms,
      dcBias,
      envMean,
      envVar,
      envMin,
      envMax,
      silence,
      constantEnvelope,
      dcExcessive,
      durationSec;
    if (!(pcm instanceof Float32Array) || pcm.length === 0)
      throw new Error("signalIndicators requires a non-empty Float32Array.");
    durationSec = pcm.length / sampleRate;
    winLen = Math.max(
      1,
      Math.round((sampleRate * this.SIGNAL_WINDOW_MS) / 1000),
    );
    nFrames = Math.max(1, Math.floor(pcm.length / winLen));
    sumsq = 0;
    peak = 0;
    sum = 0;
    for (i = 0; i < pcm.length; i++) {
      if (!isFinite(pcm[i]))
        throw new Error("signalIndicators requires finite samples.");
      sumsq += pcm[i] * pcm[i];
      peak = Math.max(peak, Math.abs(pcm[i]));
      sum += pcm[i];
    }
    rms = Math.sqrt(sumsq / pcm.length);
    mean = sum / pcm.length;
    dcBias = Math.abs(mean);
    env = new Float32Array(nFrames);
    for (fi = 0; fi < nFrames; fi++) {
      start = fi * winLen;
      end = Math.min(start + winLen, pcm.length);
      fsum = 0;
      for (j = start; j < end; j++) fsum += pcm[j] * pcm[j];
      frms = Math.sqrt(fsum / (end - start));
      env[fi] = frms;
    }
    envMean = 0;
    envMin = Infinity;
    envMax = -Infinity;
    for (fi = 0; fi < nFrames; fi++) {
      envMean += env[fi];
      envMin = Math.min(envMin, env[fi]);
      envMax = Math.max(envMax, env[fi]);
    }
    envMean /= nFrames;
    envVar = 0;
    for (fi = 0; fi < nFrames; fi++) {
      envVar += (env[fi] - envMean) * (env[fi] - envMean);
    }
    envVar /= nFrames;
    silence = rms < this.SILENCE_FLOOR;
    constantEnvelope =
      !silence && envMax - envMin <= 0.02 * Math.max(envMax, 1e-6);
    dcExcessive = rms > 0 && dcBias > 0.1 * rms;
    return {
      windowMs: this.SIGNAL_WINDOW_MS,
      winLen: winLen,
      signalFrames: nFrames,
      durationSec: durationSec,
      rms: rms,
      peakAbs: peak,
      dcBias: dcBias,
      envMean: envMean,
      envStd: Math.sqrt(envVar),
      envMin: envMin,
      envMax: envMax,
      silence: silence,
      silenceFloor: this.SILENCE_FLOOR,
      constantEnvelope: constantEnvelope,
      dcExcessive: dcExcessive,
    };
  },

  /**
   * Evaluate liveness evidence and return an ISO 30107-3-flavoured verdict
   * record. Conclusive answers are only ever ATTACK (challenge mismatch,
   * max-silence replay, constant-equivalent machine tone) or, on a clean
   * matched challenge + passable signal, bonafide-presentation (heuristic).
   * Anything ambiguous stays INCONCLUSIVE; APCER/BPCER are always
   * unmeasured unless a calibration manifest says otherwise.
   * @param {{prompt?: string, response?: string, pcm?: Float32Array, sampleRate?: number}} input
   * @returns {object}
   */
  evaluate: function (input) {
    var rec, challengeIssued, cr, sig, attackFlags, i;
    input = input || {};
    rec = {
      schema: this.SCHEMA,
      conclusion: this.VERDICTS.INCONCLUSIVE,
      methods: [],
      flags: [],
      checks: { challengeResponse: null, signal: null },
      metrics: {
        APCER: null,
        BPCER: null,
        measured: false,
        note: "No in-repo attack corpus; APCER/BPCER are unmeasured (honest).",
      },
      rulesets: [],
      calibrated: false,
      generatedAt: new Date().toISOString(),
      iso: {
        framing:
          "ISO/IEC 30107-1:2023 — liveness is a subset of presentation attack detection",
        metricStandard: "ISO/IEC 30107-3:2023 — APCER/BPCER",
        trustNote:
          "NIST SP 800-63B: liveness/PAD evidence needs additional trust in the sensor; signals alone are heuristic.",
      },
      claim:
        "Heuristic challenge-response and signal assessment; NOT cryptographic proof of liveness.",
    };
    challengeIssued =
      typeof input.prompt === "string" &&
      this.normalizeText(input.prompt).length > 0;
    if (challengeIssued) {
      rec.methods.push("challenge-response");
      cr = this.challengeCheck({
        prompt: input.prompt,
        response: input.response,
      });
      rec.checks.challengeResponse = cr;
      rec.rulesets.push({
        name: "challenge-response-consistency",
        standard: "none",
        heuristic: true,
        note: "replay cannot answer a fresh random prompt; prefix tolerated for ASR truncation",
      });
      if (this.normalizeText(input.response).length === 0) {
        rec.flags.push("challenge-unanswered");
      } else if (!cr.ok) {
        rec.flags.push("challenge-mismatch");
      }
    }
    if (input.pcm instanceof Float32Array) {
      sig = this.signalIndicators(input.pcm, input.sampleRate || 16000);
      rec.checks.signal = sig;
      rec.methods.push("signal-liveness");
      rec.rulesets.push({
        name: "signal-liveness",
        standard: "none",
        heuristic: true,
        note: "10 ms envelope flags: digital silence, constant-envelope tone, excessive DC",
        thresholds: {
          windowMs: this.SIGNAL_WINDOW_MS,
          silenceFloor: this.SILENCE_FLOOR,
        },
      });
      if (sig.silence) rec.flags.push("max-silence");
      if (sig.constantEnvelope) rec.flags.push("constant-envelope");
      if (sig.dcExcessive) rec.flags.push("dc-excessive");
    } else {
      rec.flags.push("signal-unavailable");
    }
    attackFlags = ["challenge-mismatch", "max-silence", "constant-envelope"];
    for (i = 0; i < attackFlags.length; i++) {
      if (rec.flags.indexOf(attackFlags[i]) !== -1) {
        rec.conclusion = this.VERDICTS.PRESENTATION_ATTACK;
        return rec;
      }
    }
    if (
      challengeIssued &&
      rec.checks.challengeResponse &&
      rec.checks.challengeResponse.ok &&
      rec.checks.signal
    ) {
      rec.conclusion = this.VERDICTS.BONAFIDE_PRESENTATION;
      return rec;
    }
    rec.conclusion = this.VERDICTS.INCONCLUSIVE;
    return rec;
  },
};

/* c8 ignore start */
if (typeof window !== "undefined") window.VoiceLiveness = VoiceLiveness;
/* c8 ignore stop */
