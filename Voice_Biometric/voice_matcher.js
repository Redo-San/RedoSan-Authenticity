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
 * Voice_Biometric/voice_matcher.js
 *
 * Verification core for the browser voice biometric chain. Scores 192-d ECAPA
 * embeddings with cosine similarity, converts them into calibrated log-likelihood
 * ratios `LLR = alpha*score + beta` (affine logistic fit on a held-out dev set),
 * and reports operating metrics that are byte-for-byte consistent with the
 * published ASVspoof5 / NIST SRE24 assessment codes:
 *
 *    detCurve  - ASVspoof5 calculate_modules.py compute_det_curve (stable
 *                mergesort, push-down sentinel threshold, "accept iff score >
 *                threshold", arrays of length n + 1).
 *    eer       - compute_eer (first occurrence of min |FAR - FRR|).
 *    minDcf    - normalized detection cost Cdet / min(C_miss*P_t, C_fa*(1-P_t))
 *                minimized over the DET rows.
 *    actualDcf - actual = calibrated at the Bayes threshold theta_Bayes, from
 *                ASVspoof2019 Eq.(2) / NIST SRE24 (multi-year) evaluations.
 *    cllr      - Brümmer & du Preez (arXiv cs/0503066) C_llr in bits; the log
 *                terms are evaluated via log1p for underflow safety.
 *    fitCalibration - Newton-IRLS affine logistic fit (Ferrer's ASVspoof
 *                CalibrationTutorial, [19] in the ASVspoof5 paper); the fitted
 *                function IS the LLR, priors enter only at theta_Bayes.
 *
 * Operating point for every shipped report is first-class in the calibration
 * manifest (Voice_Biometric/calibration/calibration_manifest.json):
 * NIST SRE24 default p_target=0.01, C_Miss=C_FA=1 -> theta = +4.595. The
 * ASVspoof5 per-speaker preset (p_target=0.95, C_FA=10) is available as an
 * explicit cost-model parameter and is covered by tests.
 *
 * Verdict contract: MATCH if LLR > theta + band, NON-MATCH if LLR < theta - band,
 * INCONCLUSIVE otherwise (or for non-finite / non-192-d input). A low-quality or
 * PAD-fail trial therefore never yields MATCH.
 */

const VOICE_MATCHER_VERSION = "0.1.0";
const EMBEDDING_DIM = 192;
const CALIBRATION_METHOD = "affine-logistic-to-LLR (Newton-IRLS)";
const MAX_FIT_ITERATIONS = 100;
const FIT_GRADIENT_TOLERANCE = 1e-8;
const FIT_LOSS_TOLERANCE = 1e-14;
const DEFAULT_MANIFEST_URL =
  "Voice_Biometric/calibration/calibration_manifest.json";
const DEFAULT_VERSION_URL =
  "Voice_Biometric/calibration/calibration_version.json";

// First-class operating points (always explicit, never scattered literals).
const SRE24_COST = Object.freeze({ P_TARGET: 0.01, C_MISS: 1, C_FA: 1 }); // plan §4 default
const ASVSPOOF5_COST = Object.freeze({ P_TARGET: 0.95, C_MISS: 1, C_FA: 10 });
const VERDICTS = Object.freeze({
  MATCH: "MATCH",
  NON_MATCH: "NON-MATCH",
  INCONCLUSIVE: "INCONCLUSIVE",
});

/**
 * Cosine similarity of two equal-length numeric arrays. Semantics mirror
 * VoiceONNXEmbedder.cosine (higher = more like the enrolled speaker).
 * Returns NaN for mismatched/zero-norm/non-finite input.
 */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return NaN;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = Number(a[i]);
    const bi = Number(b[i]);
    if (!Number.isFinite(ai) || !Number.isFinite(bi)) return NaN;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return NaN;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Bayes-optimal decision threshold from a cost model:
 *   theta_Bayes = -log(C_miss*P_target / (C_fa*(1-P_target)))
 * Equivalently the ASVspoof2019 rate_fa / rate_miss threshold. Never 0, always
 * derived from the operating point (no hard-coded decision boundaries).
 */
function thresholdFor(costModel) {
  const c = costModel || SRE24_COST;
  return -Math.log((c.C_MISS * c.P_TARGET) / (c.C_FA * (1 - c.P_TARGET)));
}

/** Stable mergesort by score only; ties keep target-before-nontarget order. */
function stableMerge(scores, labels) {
  const n = scores.length;
  const pairs = Array.from({ length: n }, (_, i) => [scores[i], labels[i], i]);
  if (n <= 1) return pairs;
  const aux = Array.from({ length: n });
  function sort(lo, hi) {
    if (hi - lo < 2) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid, hi);
    for (let i = lo; i < hi; i += 1) aux[i] = pairs[i];
    let i = lo;
    let j = mid;
    let k = lo;
    while (i < mid && j < hi) {
      pairs[k++] = aux[i][0] <= aux[j][0] ? aux[i++] : aux[j++];
    }
    while (i < mid) pairs[k++] = aux[i++];
    while (j < hi) pairs[k++] = aux[j++];
  }
  sort(0, n);
  return pairs;
}

/**
 * Detection-error-tradeoff curve following ASVspoof5 compute_det_curve:
 * n+1 rows, push-down sentinel threshold (min score - 0.001), and the strict
 * "accept iff score > threshold" convention.
 */
function detCurve(genuineScores, impostorScores) {
  const target = genuineScores.length;
  const nontarget = impostorScores.length;
  const n = target + nontarget;
  const scores = Array.from({ length: n });
  const labels = Array.from({ length: n });
  let k = 0;
  for (let i = 0; i < target; i += 1) {
    scores[k] = Number(genuineScores[i]);
    labels[k] = 1;
    k += 1;
  }
  for (let i = 0; i < nontarget; i += 1) {
    scores[k] = Number(impostorScores[i]);
    labels[k] = 0;
    k += 1;
  }
  const ordered = stableMerge(scores, labels);
  const sorted = ordered.map((p) => p[0]);

  const frr = Array.from({ length: n + 1 });
  const far = Array.from({ length: n + 1 });
  const thresholds = Array.from({ length: n + 1 });
  frr[0] = 0;
  far[0] = 1;
  thresholds[0] = sorted[0] - 0.001;
  let tarCum = 0;
  for (k = 1; k <= n; k += 1) {
    tarCum += ordered[k - 1][1];
    // nontarget_trial_sums[k] = #nontarget - k + tar_trial_sums[k] (ASVspoof5
    // compute_det_curve): the running nontarget count as the combined sorted
    // row walk progresses, so far falls one row later than frr on ties.
    const nonCum = nontarget - k + tarCum;
    frr[k] = tarCum / target;
    far[k] = nonCum / nontarget;
    thresholds[k] = ordered[k - 1][0];
  }
  return { frr, far, thresholds };
}

/** Equal-error rate and its threshold (first |FAR - FRR| minimum). */
function eer(genuineScores, impostorScores) {
  const { frr, far, thresholds } = detCurve(genuineScores, impostorScores);
  let best = 0;
  let minDiff = Infinity;
  for (let i = 0; i < frr.length; i += 1) {
    const diff = Math.abs(frr[i] - far[i]);
    if (diff < minDiff) {
      minDiff = diff;
      best = i;
    }
  }
  return {
    eer: (frr[best] + far[best]) / 2,
    threshold: thresholds[best],
  };
}

/**
 * Minimum normalized detection cost over the DET rows (ASVspoof2019 Eq.(2)
 * style, normalized by the prior-scaled cost ceiling).
 */
function minDcf(genuineScores, impostorScores, costModel) {
  const c = costModel || SRE24_COST;
  const { frr, far, thresholds } = detCurve(genuineScores, impostorScores);
  const norm = Math.min(c.C_MISS * c.P_TARGET, c.C_FA * (1 - c.P_TARGET));
  let best = 0;
  let bestDcf = Infinity;
  for (let i = 0; i < frr.length; i += 1) {
    const dcf =
      (c.C_MISS * c.P_TARGET * frr[i] + c.C_FA * (1 - c.P_TARGET) * far[i]) /
      norm;
    if (dcf < bestDcf) {
      bestDcf = dcf;
      best = i;
    }
  }
  return { minDCF: bestDcf, threshold: thresholds[best], costModel: c };
}

/**
 * Actual detection cost fixed at the Bayes-optimal threshold theta_Bayes.
 *   rate_miss = P(bonafide < theta); rate_fa = P(impostor >= theta).
 */
function actualDcf(genuineScores, impostorScores, costModel) {
  const c = costModel || SRE24_COST;
  const theta = thresholdFor(c);
  const target = genuineScores.length;
  const nontarget = impostorScores.length;
  let miss = 0;
  for (let i = 0; i < target; i += 1) {
    if (Number(genuineScores[i]) < theta) miss += 1;
  }
  let fa = 0;
  for (let i = 0; i < nontarget; i += 1) {
    if (Number(impostorScores[i]) >= theta) fa += 1;
  }
  const rateMiss = miss / target;
  const rateFa = fa / nontarget;
  const norm = Math.min(c.C_MISS * c.P_TARGET, c.C_FA * (1 - c.P_TARGET));
  const act =
    (c.C_MISS * c.P_TARGET * rateMiss + c.C_FA * (1 - c.P_TARGET) * rateFa) /
    norm;
  return { actDCF: act, threshold: theta };
}

/**
 * C_llr in bits (Brümmer & du Preez). Scores are treated as log-likelihood
 * ratios; log1p keeps the terms finite for very large |LLR|.
 */
function cllr(genuineLlr, impostorLlr) {
  const target = genuineLlr.length;
  const nontarget = impostorLlr.length;
  let sumTarget = 0;
  for (let i = 0; i < target; i += 1) {
    sumTarget += Math.log1p(Math.exp(-Number(genuineLlr[i])));
  }
  let sumNontarget = 0;
  for (let i = 0; i < nontarget; i += 1) {
    sumNontarget += Math.log1p(Math.exp(Number(impostorLlr[i])));
  }
  const bits =
    (0.5 * (sumTarget / target + sumNontarget / nontarget)) / Math.LN2;
  return bits;
}

/** Cross-entropy / log-loss of an affine LLR mapping over a score set. */
function logLoss(genuineScores, impostorScores, alpha, beta) {
  const target = genuineScores.length;
  const nontarget = impostorScores.length;
  let sum = 0;
  for (let i = 0; i < target; i += 1) {
    sum += Math.log1p(Math.exp(-(alpha * Number(genuineScores[i]) + beta)));
  }
  for (let i = 0; i < nontarget; i += 1) {
    sum += Math.log1p(Math.exp(alpha * Number(impostorScores[i]) + beta));
  }
  return sum / (target + nontarget);
}

/**
 * Fit LLR = alpha*score + beta with Newton-IRLS logistic regression on a dev
 * set (genuine / impostor trial scores). The fitted output IS the LLR; class
 * priors and costs only enter later at theta_Bayes, so the fit is independent
 * of the selected operating point. Throws RangeError on empty classes; returns
 * {alpha, beta, logloss, iterations, converged, ...} on success.
 */
function fitCalibration(genuineScores, impostorScores, opts) {
  const target = genuineScores.length;
  const nontarget = impostorScores.length;
  if (target === 0 || nontarget === 0)
    throw new RangeError(
      "fitCalibration needs both genuine and impostor dev scores",
    );
  const maxIter = (opts && opts.maxIterations) || MAX_FIT_ITERATIONS;
  let alpha = 1;
  let beta = 0;
  let converged = false;
  let iterations = 0;
  let loss = logLoss(genuineScores, impostorScores, alpha, beta);

  for (let it = 0; it < maxIter; it += 1) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < target; i += 1) {
      const s = Number(genuineScores[i]);
      const l = alpha * s + beta;
      const p = 1 / (1 + Math.exp(-l));
      g0 += p - 1;
      g1 += (p - 1) * s;
      const w = p * (1 - p);
      h00 += w;
      h01 += w * s;
      h11 += w * s * s;
    }
    for (let i = 0; i < nontarget; i += 1) {
      const s = Number(impostorScores[i]);
      const l = alpha * s + beta;
      const p = 1 / (1 + Math.exp(-l));
      g0 += p;
      g1 += p * s;
      const w = p * (1 - p);
      h00 += w;
      h01 += w * s;
      h11 += w * s * s;
    }
    const gNorm = Math.hypot(g0, g1);
    if (gNorm < FIT_GRADIENT_TOLERANCE) {
      iterations = it;
      converged = true;
      break;
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-15) {
      iterations = it;
      converged = true;
      break;
    }
    const dBeta = (h11 * g0 - h01 * g1) / det;
    const dAlpha = (h00 * g1 - h01 * g0) / det;
    beta -= dBeta;
    alpha -= dAlpha;
    const nextLoss = logLoss(genuineScores, impostorScores, alpha, beta);
    if (!Number.isFinite(nextLoss) || nextLoss > loss + 1e-3) {
      alpha += dAlpha / 2;
      beta += dBeta / 2;
      const halved = logLoss(genuineScores, impostorScores, alpha, beta);
      loss = Number.isFinite(halved) ? halved : loss;
      iterations = it;
      converged = true;
      break;
    }
    if (loss - nextLoss < FIT_LOSS_TOLERANCE) {
      loss = nextLoss;
      iterations = it;
      converged = true;
      break;
    }
    loss = nextLoss;
  }

  return {
    alpha,
    beta,
    logloss: loss,
    iterations,
    converged: converged || iterations > 0,
    nGenuine: target,
    nImpostor: nontarget,
    method: CALIBRATION_METHOD,
  };
}

/** Map one score to an LLR with the calibrated affine function. */
function calibrate(score, alpha, beta) {
  return alpha * Number(score) + beta;
}

/**
 * Verdict for a single verification trial. Returns MATCH / NON-MATCH /
 * INCONCLUSIVE; low-quality or non-finite input can never yield MATCH.
 */
function decide(cosineScore, calibration, options) {
  const alpha =
    calibration && Number.isFinite(calibration.alpha) ? calibration.alpha : 1;
  const beta =
    calibration && Number.isFinite(calibration.beta) ? calibration.beta : 0;
  const threshold =
    calibration && Number.isFinite(calibration.threshold)
      ? calibration.threshold
      : thresholdFor(calibration && calibration.costModel);
  const band =
    options && Number.isFinite(options.uncertaintyBand)
      ? Math.abs(options.uncertaintyBand)
      : 0;
  const score = Number(cosineScore);
  const llr = Number.isFinite(score) ? alpha * score + beta : NaN;

  let decision;
  if (!Number.isFinite(llr)) {
    decision = VERDICTS.INCONCLUSIVE;
  } else if (llr > threshold + band) {
    decision = VERDICTS.MATCH;
  } else if (llr < threshold - band) {
    decision = VERDICTS.NON_MATCH;
  } else {
    decision = VERDICTS.INCONCLUSIVE;
  }

  return { decision, score, llr, threshold, alpha, beta };
}

/**
 * Assemble the calibration manifest (first-class artifact of §4). Pure serializer:
 * thresholds, metrics and the calibrated LLR mapping are computed by the caller
 * on a documented dev set and stored with the model/preprocessing revisions that
 * produced them, so each report can cite how its threshold was obtained.
 */
function buildManifest(opts) {
  const model = opts.model || {};
  const pre = opts.preprocessing || {};
  const dev = opts.devSet || {};
  const cal = opts.calibration || {};
  const metrics = opts.metrics || {};
  const operatingPoint = opts.operatingPoint || SRE24_COST;
  return {
    $schema: "Voice_Biometric/calibration/calibration-manifest-schema-v1",
    schemaVersion: 1,
    generatedAt: opts.generatedAt || new Date().toISOString(),
    generatedBy: opts.generatedBy,
    method: cal.method || CALIBRATION_METHOD,
    operatingPoint: {
      P_TARGET: operatingPoint.P_TARGET,
      C_MISS: operatingPoint.C_MISS,
      C_FA: operatingPoint.C_FA,
    },
    threshold: thresholdFor(operatingPoint),
    metrics: {
      EER: metrics.EER,
      minDCF: metrics.minDCF,
      actDCF: metrics.actDCF,
      Cllr: metrics.Cllr,
    },
    calibration: {
      alpha: cal.alpha,
      beta: cal.beta,
      logloss: cal.logloss,
      iterations: cal.iterations,
      converged: cal.converged,
      method: cal.method || CALIBRATION_METHOD,
    },
    devSet: {
      id: dev.id,
      datasetVersion: dev.datasetVersion,
      description: dev.description,
      source: dev.source,
      nGenuine: dev.nGenuine,
      nImpostor: dev.nImpostor,
    },
    model: {
      embedder: "speechbrain/spkrec-ecapa-voxceleb",
      version: model.version,
      sha256: model.sha256,
      dimension: EMBEDDING_DIM,
    },
    preprocessing: {
      version: pre.version,
      revision: pre.revision,
      fbankSha256: pre.fbankSha256,
      description:
        pre.description || "SpeechBrain 80-band fbank; features.js parity",
    },
  };
}

function requireField(ok, name) {
  if (!ok) throw new Error(`invalid calibration manifest: missing ${name}`);
}

/**
 * Validate an incoming manifest (object or JSON string). Throws on structural
 * or numerical corruption so a broken artifact can never silently mis-calibrate
 * a report or decision threshold.
 */
function parseManifest(json) {
  const m = typeof json === "string" ? JSON.parse(json) : json;
  requireField(m && typeof m === "object", "root object");
  requireField(m.schemaVersion === 1, "schemaVersion=1");
  requireField(
    m.operatingPoint && typeof m.operatingPoint === "object",
    "operatingPoint",
  );
  const op = m.operatingPoint;
  requireField(
    Number.isFinite(op.P_TARGET) && op.P_TARGET > 0 && op.P_TARGET < 1,
    "operatingPoint.P_TARGET",
  );
  requireField(
    Number.isFinite(op.C_MISS) && op.C_MISS > 0,
    "operatingPoint.C_MISS",
  );
  requireField(Number.isFinite(op.C_FA) && op.C_FA > 0, "operatingPoint.C_FA");
  requireField(Number.isFinite(m.threshold), "threshold");
  requireField(
    m.metrics && Number.isFinite(m.metrics.minDCF),
    "metrics.minDCF",
  );
  requireField(m.metrics && Number.isFinite(m.metrics.Cllr), "metrics.Cllr");
  requireField(
    m.calibration && Number.isFinite(m.calibration.alpha),
    "calibration.alpha",
  );
  requireField(
    m.calibration && Number.isFinite(m.calibration.beta),
    "calibration.beta",
  );
  requireField(
    m.devSet && typeof m.devSet.id === "string" && m.devSet.id.length > 0,
    "devSet.id",
  );
  requireField(
    typeof m.devSet.datasetVersion === "string",
    "devSet.datasetVersion",
  );
  requireField(m.model && typeof m.model.version === "string", "model.version");
  requireField(
    m.preprocessing && typeof m.preprocessing.revision === "string",
    "preprocessing.revision",
  );
  return m;
}

/**
 * Stamp the redoSan.voiceBiometricReport contract fields from a manifest onto
 * an evaluation report (pure; returns a copy). Report gains exactly:
 * calibration_model_version, calibration_dataset_version, operating_point,
 * threshold, minDCF, Cllr.
 */
function applyManifest(report, manifest) {
  const m = typeof manifest === "string" ? parseManifest(manifest) : manifest;
  const out = Object.assign({}, report);
  out.calibration_model_version = m.model.version;
  out.calibration_dataset_version = m.devSet.datasetVersion;
  out.operating_point = m.operatingPoint;
  out.threshold = m.threshold;
  out.minDCF = m.metrics.minDCF;
  out.Cllr = m.metrics.Cllr;
  return out;
}

/** Browser-only: fetch + validate the shipped calibration manifest. */
async function loadManifest(url) {
  const res = await fetch(url || DEFAULT_MANIFEST_URL);
  if (!res.ok)
    throw new Error(`calibration manifest fetch failed: ${res.status}`);
  return parseManifest(await res.text());
}

const VoiceMatcher = {
  VOICE_MATCHER_VERSION,
  EMBEDDING_DIM,
  CALIBRATION_METHOD,
  MAX_FIT_ITERATIONS,
  DEFAULT_MANIFEST_URL,
  DEFAULT_VERSION_URL,
  SRE24_COST,
  ASVSPOOF5_COST,
  VERDICTS,
  cosine,
  thresholdFor,
  defaultThreshold: () => thresholdFor(SRE24_COST),
  detCurve,
  eer,
  minDcf,
  actualDcf,
  cllr,
  logLoss,
  fitCalibration,
  calibrate,
  decide,
  buildManifest,
  parseManifest,
  applyManifest,
  loadManifest,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VoiceMatcher;
}
if (typeof window !== "undefined") {
  window.VoiceMatcher = VoiceMatcher;
}
