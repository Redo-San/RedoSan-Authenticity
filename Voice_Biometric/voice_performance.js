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
 * Voice_Biometric/voice_performance.js
 *
 * Module README — trial-level evaluation of the browser voice verification
 * chain, filling the gaps identified in the Iris_Biometric performance review:
 *
 *   - presentation-attack detection metrics APCER / BPCER per
 *     ISO/IEC 30107-3 (plus the classical FAR / FRR conventions);
 *   - verifier accuracy reporting EER, minDCF, actDCF and C_llr as computed by
 *     the matcher (values are identical to re-running VoiceMatcher directly);
 *   - latency recorded as a plain number of milliseconds (never a string);
 *   - testing conventions follow ISO/IEC 19795-1 (biometric sample size and
 *     threshold claims gated by MIN_SAMPLES and configured cost thresholds).
 *
 * Every report built through stampReport() carries the §4 calibration-manifest
 * contract: calibration_model_version, calibration_dataset_version,
 * operating_point, threshold, minDCF and Cllr, so a threshold claim can always
 * be traced back to the dev set and model revision that produced it.
 */

const PERFORMANCE_VERSION = "0.1.0";
const THRESHOLDS = Object.freeze({
  MAX_APCER: 0.005,
  MAX_BPCER: 0.05,
  MAX_EER: 0.005,
  MAX_MIN_DCF: 0.01,
  MIN_SAMPLES: 10,
  CONFIDENCE_LEVEL: 0.95,
});

const LABELS = Object.freeze({
  GENUINE: "genuine",
  IMPOSTOR: "impostor",
  ATTACK: "attack",
});

function matcherFor() {
  const m = (typeof window !== "undefined" && window.VoiceMatcher) || null;
  if (!m || !m.eer || !m.actualDcf) {
    throw new Error(
      "VoicePerformance requires VoiceMatcher to be loaded first",
    );
  }
  return m;
}

/**
 * Trial accumulator for one verification evaluation. Each record is
 * {label, decision, score, latencyMs} where score is the cosine similarity and
 * decision one of the VoiceMatcher verdicts. Malformed records throw so a
 * report can never silently mix classes.
 */
function VoicePerformance(opts) {
  this._records = [];
  this._costModel = (opts && opts.costModel) || matcherFor().SRE24_COST;
}

VoicePerformance.VERSION = PERFORMANCE_VERSION;
VoicePerformance.THRESHOLDS = THRESHOLDS;
VoicePerformance.LABELS = LABELS;

VoicePerformance.prototype.reset = function () {
  this._records = [];
  return this;
};

VoicePerformance.prototype.addTrial = function (record) {
  const label = record && record.label;
  const decision = record && record.decision;
  const score = record && record.score;
  const latency = record && record.latencyMs;

  if (
    label !== LABELS.GENUINE &&
    label !== LABELS.IMPOSTOR &&
    label !== LABELS.ATTACK
  ) {
    throw new TypeError("VoicePerformance: bad trial label");
  }
  const verdicts = matcherFor().VERDICTS;
  if (
    decision !== verdicts.MATCH &&
    decision !== verdicts.NON_MATCH &&
    decision !== verdicts.INCONCLUSIVE
  ) {
    throw new TypeError("VoicePerformance: bad trial decision");
  }
  if (!Number.isFinite(score)) {
    throw new TypeError("VoicePerformance: trial score must be finite");
  }
  if (!Number.isFinite(latency) || latency < 0) {
    throw new TypeError(
      "VoicePerformance: latencyMs must be a non-negative number",
    );
  }
  this._records.push({
    label,
    decision,
    score,
    latencyMs: latency,
  });
  return this;
};

VoicePerformance.prototype.evaluate = function () {
  const records = this._records;
  let nGenuine = 0;
  let nImpostor = 0;
  let nAttack = 0;
  let nInconclusive = 0;
  let attackMatch = 0;
  let genuineNonMatch = 0;
  let impostorMatch = 0;
  let latencySum = 0;
  const genuineScores = [];
  const impostorScores = [];

  for (const r of records) {
    latencySum += r.latencyMs;
    if (r.label === LABELS.GENUINE) {
      nGenuine += 1;
      genuineScores.push(r.score);
      if (r.decision === "NON-MATCH") genuineNonMatch += 1;
    } else if (r.label === LABELS.IMPOSTOR) {
      nImpostor += 1;
      impostorScores.push(r.score);
      if (r.decision === "MATCH") impostorMatch += 1;
    } else {
      nAttack += 1;
      if (r.decision === "MATCH") attackMatch += 1;
    }
    if (r.decision === "INCONCLUSIVE") nInconclusive += 1;
  }

  const apcer = nAttack === 0 ? 0 : attackMatch / nAttack;
  const bpcer = nGenuine === 0 ? 0 : genuineNonMatch / nGenuine;
  const far = nImpostor === 0 ? 0 : impostorMatch / nImpostor;
  const frr = bpcer;

  const m = matcherFor();
  let eer = null;
  let minDCF = null;
  let actDCF = null;
  let Cllr = null;
  if (nGenuine >= 1 && nImpostor >= 1) {
    eer = m.eer(genuineScores, impostorScores).eer;
    minDCF = m.minDcf(genuineScores, impostorScores, this._costModel).minDCF;
    actDCF = m.actualDcf(genuineScores, impostorScores, this._costModel).actDCF;
    Cllr = m.cllr(genuineScores, impostorScores);
  }

  const latencyMs = records.length === 0 ? 0 : latencySum / records.length;
  const totalTrials = records.length;
  const sampleSizeSufficient = totalTrials >= THRESHOLDS.MIN_SAMPLES;
  const t = THRESHOLDS;

  return {
    apcer,
    bpcer,
    far,
    frr,
    eer,
    minDCF,
    actDCF,
    Cllr,
    latencyMs,
    nGenuine,
    nImpostor,
    nAttack,
    nInconclusive,
    totalTrials,
    apcerPass: apcer <= t.MAX_APCER,
    bpcerPass: bpcer <= t.MAX_BPCER,
    eerPass: eer === null ? false : eer <= t.MAX_EER,
    minDCFPass: minDCF === null ? false : minDCF <= t.MAX_MIN_DCF,
    sampleSizeSufficient,
  };
};

/**
 * Build the full redoSan.voiceBiometricReport: evaluation metrics stamped with
 * the calibration-manifest contract fields (see VoiceMatcher.applyManifest).
 */
VoicePerformance.prototype.stampReport = function (manifest) {
  return matcherFor().applyManifest(this.evaluate(), manifest);
};

function buildPerformance(opts) {
  return new VoicePerformance(opts);
}

const VoicePerformanceNS = {
  VoicePerformance,
  buildPerformance,
  VERSION: PERFORMANCE_VERSION,
  THRESHOLDS,
  LABELS,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VoicePerformanceNS;
}
if (typeof window !== "undefined") {
  window.VoicePerformance = VoicePerformance;
}
