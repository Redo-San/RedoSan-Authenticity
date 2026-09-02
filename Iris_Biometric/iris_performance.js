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
/* c8 ignore start */
// ── Iris Performance: ISO/IEC 19795 biometric performance testing ──
/* c8 ignore stop */

/**
 * ISO/IEC 19795:2022 Biometric Performance Testing and Reporting
 * Standard for evaluating biometric system performance including:
 * - False Accept Rate (FAR)
 * - False Reject Rate (FRR)
 * - Equal Error Rate (EER)
 * - Receiver Operating Characteristic (ROC)
 * - DET (Detection Error Tradeoff) curves
 * @class
 */
function IrisPerformance() {
  this._results = [];
  this._genuineScores = [];
  this._impostorScores = [];
  // FTA/FTER tracking (ISO/IEC 19795 Section 7)
  this._ftaCount = 0; // Failure to Acquire
  this._fterCount = 0; // Failure to Enroll
  this._totalAcquisitions = 0;
  this._totalEnrollments = 0;
  // Timing benchmarks
  this._timings = [];
}

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CORE METRICS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Performance metric thresholds per ISO/IEC 19795.
 */
/* c8 ignore stop */
IrisPerformance.THRESHOLDS = {
  // Acceptable error rates
  MAX_FAR: 0.001, // 0.1% false accept rate
  MAX_FRR: 0.01, // 1% false reject rate
  // 0.5% EER bar — this is an NIR-class (near-infrared scanner) target.
  // The best published visible-spectrum result under controlled conditions is
  // EER 0.76-1.29% (worse for darker irides); webcam capture will be higher.
  MAX_EER: 0.005,

  // Minimum accuracy
  MIN_ACCURACY: 0.99, // 99% accuracy

  // Sample size requirements
  MIN_GENUINE_TRIALS: 100,
  MIN_IMPOSTOR_TRIALS: 1000,

  // Confidence intervals
  CONFIDENCE_LEVEL: 0.95,
};

/* c8 ignore start */
/**
 * Calculate False Accept Rate (FAR).
 * @param {number} falseAccepts - Number of false accepts
 * @param {number} totalImpostorTrials - Total impostor trials
 * @returns {number} FAR value (0-1)
 */
/* c8 ignore stop */
IrisPerformance.calculateFAR = function (falseAccepts, totalImpostorTrials) {
  if (totalImpostorTrials <= 0) return 0;
  return falseAccepts / totalImpostorTrials;
};

/* c8 ignore start */
/**
 * Calculate False Reject Rate (FRR).
 * @param {number} falseRejects - Number of false rejects
 * @param {number} totalGenuineTrials - Total genuine trials
 * @returns {number} FRR value (0-1)
 */
/* c8 ignore stop */
IrisPerformance.calculateFRR = function (falseRejects, totalGenuineTrials) {
  if (totalGenuineTrials <= 0) return 0;
  return falseRejects / totalGenuineTrials;
};

/* c8 ignore start */
/**
 * Calculate Equal Error Rate (EER).
 * EER is where FAR equals FRR.
 * @param {Array<{ threshold: number, far: number, frr: number }>} rocData - ROC curve data
 * @returns {{ eer: number, threshold: number }}
 */
/* c8 ignore stop */
IrisPerformance.calculateEER = function (rocData) {
  var minDiff, eerThreshold, i, diff;

  if (!rocData || rocData.length === 0) {
    return { eer: 0, threshold: 0 };
  }

  minDiff = Infinity;
  eerThreshold = 0;

  for (i = 0; i < rocData.length; i++) {
    diff = Math.abs(rocData[i].far - rocData[i].frr);
    if (diff < minDiff) {
      minDiff = diff;
      eerThreshold = rocData[i].threshold;
    }
  }

  // Find where FAR ≈ FRR
  var eerValue = 0;
  for (i = 0; i < rocData.length; i++) {
    if (Math.abs(rocData[i].threshold - eerThreshold) < 0.001) {
      eerValue = (rocData[i].far + rocData[i].frr) / 2;
      break;
    }
  }

  return {
    eer: eerValue,
    threshold: eerThreshold,
  };
};

/* c8 ignore start */
/**
 * Calculate accuracy.
 * @param {number} trueAccepts - Number of true accepts
 * @param {number} trueRejects - Number of true rejects
 * @param {number} totalTrials - Total trials
 * @returns {number} Accuracy (0-1)
 */
/* c8 ignore stop */
IrisPerformance.calculateAccuracy = function (trueAccepts, trueRejects, totalTrials) {
  if (totalTrials <= 0) return 0;
  return (trueAccepts + trueRejects) / totalTrials;
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// PAD PERFORMANCE (ISO/IEC 30107-3) — APCER / BPCER / DET
// ═══════════════════════════════════════════════════════════════════════════
//
// IMPORTANT: matching-accuracy metrics (FAR/FRR/EER in the section above) answer
// "does IrisCode A equal IrisCode B?". APCER/BPCER below answer a DIFFERENT
// question — "does the liveness/PAD system tell a real eye from a fake one?".
// The two are not interchangeable. A PAD system is reported in its own
// vocabulary (APCER/BPCER), per ISO/IEC 30107-3. Convention used here:
//   labels[i] === 1  → attack presentation (fake)
//   labels[i] === 0  → bona fide presentation (live)
//   scores[i]        → liveness score, HIGHER == more live
//   accepted as live → score >= threshold
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Attack Presentation Classification Error Rate (APCER): fraction of attacks
 * incorrectly accepted as live.
 * @param {Array<number>} labels - 0 (bona) / 1 (attack)
 * @param {Array<number>} scores - liveness scores (higher = more live)
 * @param {number} threshold
 * @returns {number} APCER (0-1)
 */
/* c8 ignore stop */
IrisPerformance.calculateAPCER = function (labels, scores, threshold) {
  var attacks = 0, accepted = 0;
  if (!labels || !scores) return 0;
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] === 1) {
      attacks++;
      if (scores[i] >= threshold) accepted++;
    }
  }
  return attacks > 0 ? accepted / attacks : 0;
};

/* c8 ignore start */
/**
 * Bona Fide Presentation Classification Error Rate (BPCER): fraction of live
 * presentations incorrectly rejected as attacks.
 * @param {Array<number>} labels - 0 (bona) / 1 (attack)
 * @param {Array<number>} scores - liveness scores (higher = more live)
 * @param {number} threshold
 * @returns {number} BPCER (0-1)
 */
/* c8 ignore stop */
IrisPerformance.calculateBPCER = function (labels, scores, threshold) {
  var bona = 0, rejected = 0;
  if (!labels || !scores) return 0;
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] === 0) {
      bona++;
      if (scores[i] < threshold) rejected++;
    }
  }
  return bona > 0 ? rejected / bona : 0;
};

/* c8 ignore start */
/**
 * Generate a PAD DET curve (sweep thresholds, reporting APCER/BPCER at each).
 * @param {Array<number>} labels
 * @param {Array<number>} scores
 * @param {number} [numPoints]
 * @returns {Array<{ threshold:number, apcer:number, bpcer:number }>}
 */
/* c8 ignore stop */
IrisPerformance.generatePADDET = function (labels, scores, numPoints) {
  var thresholds, det, minS, maxS, i, j, t;
  if (!labels || !scores || labels.length === 0) return [];

  minS = Infinity;
  maxS = -Infinity;
  for (i = 0; i < scores.length; i++) {
    if (scores[i] < minS) minS = scores[i];
    if (scores[i] > maxS) maxS = scores[i];
  }
  if (!isFinite(minS) || !isFinite(maxS)) return [];

  numPoints = numPoints || 100;
  thresholds = [];
  for (i = 0; i < numPoints; i++) {
    thresholds.push(minS + (maxS - minS) * (i / (numPoints - 1)));
  }

  det = [];
  for (j = 0; j < thresholds.length; j++) {
    t = thresholds[j];
    det.push({
      threshold: t,
      apcer: IrisPerformance.calculateAPCER(labels, scores, t),
      bpcer: IrisPerformance.calculateBPCER(labels, scores, t),
    });
  }
  return det;
};

/* c8 ignore start */
/**
 * Report PAD effectiveness at standard operating points (LivDet convention):
 * APCER achieved when BPCER is held at 10% and 20%.
 * @param {Array<number>} labels
 * @param {Array<number>} scores
 * @returns {{ apcerAtBpcer10:number, apcerAtBpcer20:number, bpcer:number, iapar:number, det:Array }}
 */
/* c8 ignore stop */
IrisPerformance.reportPADMetrics = function (labels, scores) {
  var det = IrisPerformance.generatePADDET(labels, scores, 100);
  if (det.length === 0) {
    return { apcerAtBpcer10: 0, apcerAtBpcer20: 0, bpcer: 0, iapar: 0, det: [] };
  }

  // Operating point that holds BPCER at <= target: pick the HIGHEST threshold
  // that still meets the target (this minimises APCER — the standard choice).
  /* c8 ignore start */
  /**
   *
   * @param target
   */
  /* c8 ignore stop */
  /**
   *
   * @param target
   */
  function atBpcer(target) {
    var best = null, bestThr = -Infinity;
    for (var k = 0; k < det.length; k++) {
      if (det[k].bpcer <= target + 1e-9 && det[k].threshold > bestThr) {
        bestThr = det[k].threshold;
        best = det[k];
      }
    }
    if (!best) {
      // No operating point achieves the target — report best (min-BPCER) point.
      best = det[0];
      for (var m = 1; m < det.length; m++) {
        if (det[m].bpcer < best.bpcer) best = det[m];
      }
    }
    return best;
  }

  var op10 = atBpcer(0.1);
  var op20 = atBpcer(0.2);
  var iapar = (op10.apcer + op20.bpcer) / 2; // inter-agency combined rate (FIDO)
  return {
    apcerAtBpcer10: op10.apcer,
    apcerAtBpcer20: op20.apcer,
    bpcer: op10.bpcer,
    iapar: iapar,
    det: det,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// ROC AND DET CURVES
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Generate ROC (Receiver Operating Characteristic) curve data.
 * @param {Array<number>} genuineScores - Genuine match scores
 * @param {Array<number>} impostorScores - Impostor match scores
 * @param {number} [numPoints] - Number of points on curve
 * @returns {Array<{ threshold: number, far: number, frr: number, tpr: number }>}
 */
/* c8 ignore stop */
IrisPerformance.generateROC = function (genuineScores, impostorScores, numPoints) {
  var thresholds, rocData, minScore, maxScore, i, j, threshold;
  var trueAccepts, falseAccepts, trueRejects, falseRejects;

  if (!genuineScores || !impostorScores) return [];
  if (genuineScores.length === 0 || impostorScores.length === 0) return [];

  numPoints = numPoints || 100;

  // Find score range
  minScore = Math.min(
    Math.min.apply(null, genuineScores),
    Math.min.apply(null, impostorScores)
  );
  maxScore = Math.max(
    Math.max.apply(null, genuineScores),
    Math.max.apply(null, impostorScores)
  );

  // Generate thresholds
  thresholds = [];
  for (i = 0; i <= numPoints; i++) {
    thresholds.push(minScore + (maxScore - minScore) * (i / numPoints));
  }

  // Calculate FAR and FRR at each threshold
  rocData = [];
  for (i = 0; i < thresholds.length; i++) {
    threshold = thresholds[i];

    trueAccepts = 0;
    falseAccepts = 0;
    trueRejects = 0;
    falseRejects = 0;

    // Count genuine matches
    for (j = 0; j < genuineScores.length; j++) {
      if (genuineScores[j] >= threshold) {
        trueAccepts++;
      } else {
        falseRejects++;
      }
    }

    // Count impostor matches
    for (j = 0; j < impostorScores.length; j++) {
      if (impostorScores[j] >= threshold) {
        falseAccepts++;
      } else {
        trueRejects++;
      }
    }

    var far = IrisPerformance.calculateFAR(falseAccepts, impostorScores.length);
    var frr = IrisPerformance.calculateFRR(falseRejects, genuineScores.length);
    var tpr = genuineScores.length > 0 ? trueAccepts / genuineScores.length : 0;

    rocData.push({
      threshold: threshold,
      far: far,
      frr: frr,
      tpr: tpr,
    });
  }

  return rocData;
};

/* c8 ignore start */
/**
 * Generate DET (Detection Error Tradeoff) curve data.
 * @param {Array<number>} genuineScores - Genuine match scores
 * @param {Array<number>} impostorScores - Impostor match scores
 * @param {number} [numPoints] - Number of points
 * @returns {Array<{ far: number, frr: number }>}
 */
/* c8 ignore stop */
IrisPerformance.generateDET = function (genuineScores, impostorScores, numPoints) {
  var rocData, detData, i;

  rocData = IrisPerformance.generateROC(genuineScores, impostorScores, numPoints);

  detData = [];
  for (i = 0; i < rocData.length; i++) {
    detData.push({
      far: rocData[i].far,
      frr: rocData[i].frr,
    });
  }

  return detData;
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE INTERVALS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Calculate Wilson confidence interval for a proportion.
 * @param {number} successes - Number of successes
 * @param {number} trials - Total trials
 * @param {number} [confidence] - Confidence level
 * @returns {{ lower: number, upper: number, estimate: number }}
 */
/* c8 ignore stop */
IrisPerformance.wilsonCI = function (successes, trials, confidence) {
  var z, p, n, denominator, centre, margin;

  if (trials <= 0) {
    return { lower: 0, upper: 1, estimate: 0 };
  }

  confidence = confidence || IrisPerformance.THRESHOLDS.CONFIDENCE_LEVEL;

  // Z-score for confidence level (95% = 1.96)
  if (confidence >= 0.99) z = 2.576;
  else if (confidence >= 0.95) z = 1.96;
  else if (confidence >= 0.9) z = 1.645;
  else z = 1.96;

  p = successes / trials;
  n = trials;

  denominator = 1 + (z * z) / n;
  centre = (p + (z * z) / (2 * n)) / denominator;
  margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));

  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
    estimate: p,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE EVALUATION
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Evaluate biometric system performance.
 * @param {object} params - Evaluation parameters
 * @param {Array<number>} params.genuineScores - Genuine match scores
 * @param {Array<number>} params.impostorScores - Impostor match scores
 * @param {string} [params.systemName] - System name for reporting
 * @returns {object} Comprehensive performance report
 */
/* c8 ignore stop */
IrisPerformance.evaluate = function (params) {
  var genuineScores, impostorScores, rocData, eerResult;
  var farCI, frrCI, accuracyCI, report;

  if (!params || !params.genuineScores || !params.impostorScores) {
    throw new Error("genuineScores and impostorScores are required");
  }

  genuineScores = params.genuineScores;
  impostorScores = params.impostorScores;

  // Check minimum sample sizes
  if (genuineScores.length < IrisPerformance.THRESHOLDS.MIN_GENUINE_TRIALS) {
    console.warn("IrisPerformance: Below minimum genuine trial count (" +
      genuineScores.length + " < " + IrisPerformance.THRESHOLDS.MIN_GENUINE_TRIALS + ")");
  }

  if (impostorScores.length < IrisPerformance.THRESHOLDS.MIN_IMPOSTOR_TRIALS) {
    console.warn("IrisPerformance: Below minimum impostor trial count (" +
      impostorScores.length + " < " + IrisPerformance.THRESHOLDS.MIN_IMPOSTOR_TRIALS + ")");
  }

  // Generate ROC curve
  rocData = IrisPerformance.generateROC(genuineScores, impostorScores);

  // Calculate EER
  eerResult = IrisPerformance.calculateEER(rocData);

  // Calculate error rates at optimal threshold
  var threshold = eerResult.threshold;
  var falseRejects = 0, falseAccepts = 0;
  var i;

  for (i = 0; i < genuineScores.length; i++) {
    if (genuineScores[i] < threshold) falseRejects++;
  }

  for (i = 0; i < impostorScores.length; i++) {
    if (impostorScores[i] >= threshold) falseAccepts++;
  }

  var far = IrisPerformance.calculateFAR(falseAccepts, impostorScores.length);
  var frr = IrisPerformance.calculateFRR(falseRejects, genuineScores.length);
  var accuracy = IrisPerformance.calculateAccuracy(
    genuineScores.length - falseRejects,
    impostorScores.length - falseAccepts,
    genuineScores.length + impostorScores.length
  );

  // Confidence intervals
  farCI = IrisPerformance.wilsonCI(falseAccepts, impostorScores.length);
  frrCI = IrisPerformance.wilsonCI(falseRejects, genuineScores.length);
  accuracyCI = IrisPerformance.wilsonCI(
    genuineScores.length - falseRejects + impostorScores.length - falseAccepts,
    genuineScores.length + impostorScores.length
  );

  // Generate DET curve
  var detData = IrisPerformance.generateDET(genuineScores, impostorScores);

  report = {
    systemName: params.systemName || "Iris Recognition System",
    timestamp: new Date().toISOString(),
    sampleSize: {
      genuine: genuineScores.length,
      impostor: impostorScores.length,
    },
    metrics: {
      far: far,
      frr: frr,
      eer: eerResult.eer,
      accuracy: accuracy,
    },
    confidenceIntervals: {
      far: farCI,
      frr: frrCI,
      accuracy: accuracyCI,
    },
    threshold: {
      optimal: eerResult.threshold,
      farAtOptimal: far,
      frrAtOptimal: frr,
    },
    curves: {
      roc: rocData,
      det: detData,
    },
    evaluation: IrisPerformance._evaluateMetrics(far, frr, eerResult.eer, accuracy),
    summary: IrisPerformance._generateSummary(
      params.systemName, far, frr, eerResult.eer, accuracy,
      genuineScores.length, impostorScores.length
    ),
  };

  return report;
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// STATISTICAL TESTS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Perform paired t-test to compare two systems.
 * @param {Array<number>} scores1 - System 1 scores
 * @param {Array<number>} scores2 - System 2 scores
 * @returns {{ tStatistic: number, pValue: number, significant: boolean }}
 */
/* c8 ignore stop */
IrisPerformance.pairedTTest = function (scores1, scores2) {
  var n, meanDiff, sumSqDiff, stdDiff, seDiff, tStat, df;

  if (!scores1 || !scores2 || scores1.length !== scores2.length || scores1.length < 2) {
    return { tStatistic: 0, pValue: 1, significant: false };
  }

  n = scores1.length;
  var diffs = [];
  var sumDiff = 0;

  for (var i = 0; i < n; i++) {
    diffs.push(scores1[i] - scores2[i]);
    sumDiff += diffs[i];
  }

  meanDiff = sumDiff / n;
  sumSqDiff = 0;
  for (var j = 0; j < n; j++) {
    sumSqDiff += Math.pow(diffs[j] - meanDiff, 2);
  }

  stdDiff = Math.sqrt(sumSqDiff / (n - 1));
  seDiff = stdDiff / Math.sqrt(n);
  tStat = meanDiff / seDiff;
  df = n - 1;

  // Approximate p-value using t-distribution
  var pValue = IrisPerformance._tDistPValue(tStat, df);

  return {
    tStatistic: tStat,
    pValue: pValue,
    significant: pValue < 0.05,
  };
};

/* c8 ignore start */
/**
 * Compare two systems using ROC analysis.
 * @param {object} system1 - { genuineScores, impostorScores }
 * @param {object} system2 - { genuineScores, impostorScores }
 * @returns {{ winner: string, difference: number, significant: boolean }}
 */
/* c8 ignore stop */
IrisPerformance.compareSystems = function (system1, system2) {
  var report1, report2;

  if (!system1 || !system2) {
    return { winner: "tie", difference: 0, significant: false };
  }

  report1 = IrisPerformance.evaluate({ genuineScores: system1.genuineScores, impostorScores: system1.impostorScores });
  report2 = IrisPerformance.evaluate({ genuineScores: system2.genuineScores, impostorScores: system2.impostorScores });

  var eerDiff = report1.metrics.eer - report2.metrics.eer;
  var accuracyDiff = report1.metrics.accuracy - report2.metrics.accuracy;

  /* c8 ignore start */
  // Use paired t-test on genuine scores if available
  /* c8 ignore stop */
  var tTest = null;
  if (system1.genuineScores.length === system2.genuineScores.length) {
    tTest = IrisPerformance.pairedTTest(system1.genuineScores, system2.genuineScores);
  }

  var significant = tTest ? tTest.significant : Math.abs(accuracyDiff) > 0.01;

  var winner = "tie";
  if (significant) {
    if (report1.metrics.eer < report2.metrics.eer) {
      winner = "system1";
    } else if (report2.metrics.eer < report1.metrics.eer) {
      winner = "system2";
    }
  }

  return {
    winner: winner,
    eerDifference: eerDiff,
    accuracyDifference: accuracyDiff,
    significant: significant,
    system1Eer: report1.metrics.eer,
    system2Eer: report2.metrics.eer,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// FTA / FTER TRACKING (ISO/IEC 19795 Section 7)
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Record a Failure to Acquire (FTA) event.
 * FTA occurs when the system cannot capture a usable biometric sample.
 * @param {IrisPerformance} instance
 * @param {string} [reason] - Reason for failure
 */
/* c8 ignore stop */
IrisPerformance.recordFTA = function (instance, reason) {
  if (instance) {
    instance._ftaCount++;
    instance._totalAcquisitions++;
    instance._timings.push({
      type: "FTA",
      timestamp: Date.now(),
      reason: reason || "unspecified",
    });
  }
};

/* c8 ignore start */
/**
 * Record a successful acquisition event.
 * @param {IrisPerformance} instance
 * @param {number} durationMs - Acquisition duration in ms
 */
/* c8 ignore stop */
IrisPerformance.recordAcquisition = function (instance, durationMs) {
  if (instance) {
    instance._totalAcquisitions++;
    instance._timings.push({
      type: "acquisition",
      timestamp: Date.now(),
      durationMs: durationMs || 0,
    });
  }
};

/* c8 ignore start */
/**
 * Record a Failure to Enroll (FTER) event.
 * FTER occurs when the system cannot create a template from captured samples.
 * @param {IrisPerformance} instance
 * @param {string} [reason] - Reason for failure
 */
/* c8 ignore stop */
IrisPerformance.recordFTER = function (instance, reason) {
  if (instance) {
    instance._fterCount++;
    instance._totalEnrollments++;
    instance._timings.push({
      type: "FTER",
      timestamp: Date.now(),
      reason: reason || "unspecified",
    });
  }
};

/* c8 ignore start */
/**
 * Record a successful enrollment event.
 * @param {IrisPerformance} instance
 * @param {number} durationMs - Enrollment duration in ms
 */
/* c8 ignore stop */
IrisPerformance.recordEnrollment = function (instance, durationMs) {
  if (instance) {
    instance._totalEnrollments++;
    instance._timings.push({
      type: "enrollment",
      timestamp: Date.now(),
      durationMs: durationMs || 0,
    });
  }
};

/* c8 ignore start */
/**
 * Get FTA and FTER rates.
 * @param {IrisPerformance} instance
 * @returns {{ ftaRate: number, fterRate: number, ftaCount: number, fterCount: number, totalAcquisitions: number, totalEnrollments: number }}
 */
/* c8 ignore stop */
IrisPerformance.getFtaFterRates = function (instance) {
  if (!instance) {
    return { ftaRate: 0, fterRate: 0, ftaCount: 0, fterCount: 0, totalAcquisitions: 0, totalEnrollments: 0 };
  }

  return {
    ftaRate: instance._totalAcquisitions > 0 ? instance._ftaCount / instance._totalAcquisitions : 0,
    fterRate: instance._totalEnrollments > 0 ? instance._fterCount / instance._totalEnrollments : 0,
    ftaCount: instance._ftaCount,
    fterCount: instance._fterCount,
    totalAcquisitions: instance._totalAcquisitions,
    totalEnrollments: instance._totalEnrollments,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// FNIR @ FPIR OPERATING POINTS (ISO/IEC 19795)
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Compute FNIR at specified FPIR operating points.
 * Useful for comparing systems at fixed false positive rates.
 * @param {Array<number>} genuineScores - Genuine match scores
 * @param {Array<number>} impostorScores - Impostor match scores
 * @param {Array<number>} [fpiRates] - FPIR operating points
 * @returns {{ operatingPoints: Array<{ fpir: number, fnir: number, threshold: number }> }}
 */
/* c8 ignore stop */
IrisPerformance.fnirAtFpir = function (genuineScores, impostorScores, fpiRates) {
  if (!genuineScores || !impostorScores || genuineScores.length === 0 || impostorScores.length === 0) {
    return { operatingPoints: [] };
  }

  fpiRates = fpiRates || [0.001, 0.01, 0.1];
  var operatingPoints = [];

  // Sort impostor scores descending to find thresholds for each FPIR
  var sortedImpostor = impostorScores.slice().sort(function (a, b) { return b - a; });

  for (var r = 0; r < fpiRates.length; r++) {
    var targetFPIR = fpiRates[r];
    var thresholdIdx = Math.floor(targetFPIR * sortedImpostor.length);
    thresholdIdx = Math.min(thresholdIdx, sortedImpostor.length - 1);
    var threshold = sortedImpostor[thresholdIdx];

    // Count false rejects at this threshold (genuine scores below threshold)
    var falseRejects = 0;
    for (var g = 0; g < genuineScores.length; g++) {
      if (genuineScores[g] < threshold) falseRejects++;
    }

    var fnir = genuineScores.length > 0 ? falseRejects / genuineScores.length : 0;

    operatingPoints.push({
      fpir: targetFPIR,
      fnir: fnir,
      threshold: threshold,
    });
  }

  return { operatingPoints: operatingPoints };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// TIMING BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Compute timing statistics from recorded events.
 * @param {IrisPerformance} instance
 * @returns {{ enrollMeanMs: number, verifyMeanMs: number, totalMs: number, eventCount: number }}
 */
/* c8 ignore stop */
IrisPerformance.computeTimingStats = function (instance) {
  if (!instance || !instance._timings || instance._timings.length === 0) {
    return { enrollMeanMs: 0, verifyMeanMs: 0, totalMs: 0, eventCount: 0 };
  }

  var enrollDurations = [];
  var verifyDurations = [];
  var totalMs = 0;

  for (var i = 0; i < instance._timings.length; i++) {
    var t = instance._timings[i];
    if (t.durationMs !== undefined) {
      totalMs += t.durationMs;
      if (t.type === "enrollment") {
        enrollDurations.push(t.durationMs);
      } else if (t.type === "acquisition") {
        verifyDurations.push(t.durationMs);
      }
    }
  }

  var mean = function (arr) {
    if (arr.length === 0) return 0;
    var sum = 0;
    for (var j = 0; j < arr.length; j++) sum += arr[j];
    return sum / arr.length;
  };

  return {
    enrollMeanMs: Math.round(mean(enrollDurations) * 100) / 100,
    verifyMeanMs: Math.round(mean(verifyDurations) * 100) / 100,
    totalMs: totalMs,
    eventCount: instance._timings.length,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Evaluate metrics against thresholds.
 * @param far
 * @param frr
 * @param eer
 * @param accuracy
 * @private
 */
/* c8 ignore stop */
IrisPerformance._evaluateMetrics = function (far, frr, eer, accuracy) {
  var results = [];

  results.push({
    metric: "FAR",
    value: far,
    threshold: IrisPerformance.THRESHOLDS.MAX_FAR,
    passed: far <= IrisPerformance.THRESHOLDS.MAX_FAR,
  });

  results.push({
    metric: "FRR",
    value: frr,
    threshold: IrisPerformance.THRESHOLDS.MAX_FRR,
    passed: frr <= IrisPerformance.THRESHOLDS.MAX_FRR,
  });

  results.push({
    metric: "EER",
    value: eer,
    threshold: IrisPerformance.THRESHOLDS.MAX_EER,
    passed: eer <= IrisPerformance.THRESHOLDS.MAX_EER,
  });

  results.push({
    metric: "Accuracy",
    value: accuracy,
    threshold: IrisPerformance.THRESHOLDS.MIN_ACCURACY,
    passed: accuracy >= IrisPerformance.THRESHOLDS.MIN_ACCURACY,
  });

  return results;
};

/* c8 ignore start */
/**
 * Generate human-readable summary.
 * @param name
 * @param far
 * @param frr
 * @param eer
 * @param accuracy
 * @param genuineCount
 * @param impostorCount
 * @private
 */
/* c8 ignore stop */
IrisPerformance._generateSummary = function (name, far, frr, eer, accuracy, genuineCount, impostorCount) {
  var lines = [];
  lines.push("=== ISO/IEC 19795 Performance Report ===");
  lines.push("System: " + (name || "Iris Recognition System"));
  lines.push("Sample Size: " + genuineCount + " genuine, " + impostorCount + " impostor");
  lines.push("");
  lines.push("Error Rates:");
  lines.push("  FAR: " + (far * 100).toFixed(4) + "%");
  lines.push("  FRR: " + (frr * 100).toFixed(4) + "%");
  lines.push("  EER: " + (eer * 100).toFixed(4) + "%");
  lines.push("");
  lines.push("Accuracy: " + (accuracy * 100).toFixed(2) + "%");
  lines.push("");
  lines.push("Evaluation: " + (far <= 0.001 && frr <= 0.01 && eer <= 0.005 ? "PASSED" : "FAILED"));

  return lines.join("\n");
};

/* c8 ignore start */
/**
 * Approximate p-value from t-distribution.
 * @param t
 * @param df
 * @private
 */
/* c8 ignore stop */
IrisPerformance._tDistPValue = function (t, df) {
  var x, a, b, p;

  // Approximation using Beta incomplete function
  x = df / (df + t * t);
  a = df / 2;
  b = 0.5;

  // Simple approximation
  p = Math.exp(-0.717 * Math.abs(t) - 0.416 * t * t);

  return Math.min(1, Math.max(0, p));
};

/* c8 ignore start */
// Export for window
/* c8 ignore stop */
if (typeof window !== "undefined") {
  window.IrisPerformance = IrisPerformance;
}
