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
// ── Face Performance: ISO/IEC 19795 biometric performance testing for face ──

/**
 * ISO/IEC 19795:2022 Biometric Performance Testing and Reporting for Face
 * Specialized performance metrics for face recognition systems including:
 * - Face Detection Rate (FDR)
 * - Face Recognition Accuracy
 * - Demographic Bias Analysis
 * - Pose/Expression Tolerance
 *
 * @constructor
 */
function FacePerformance() {
  this._results = [];
  this._genuineScores = [];
  this._impostorScores = [];
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Performance metric thresholds for face recognition.
 */
FacePerformance.THRESHOLDS = {
  // Acceptable error rates
  MAX_FAR: 0.001, // 0.1% false accept rate
  MAX_FRR: 0.01, // 1% false reject rate
  MAX_EER: 0.005, // 0.5% equal error rate

  // Face detection
  MIN_DETECTION_RATE: 0.99, // 99% detection rate
  MIN_DETECTION_CONFIDENCE: 0.5, // 50% minimum confidence

  // Minimum accuracy
  MIN_ACCURACY: 0.99, // 99% accuracy

  // Sample size requirements
  MIN_GENUINE_TRIALS: 100,
  MIN_IMPOSTOR_TRIALS: 1000,

  // Demographic fairness
  MAX_BIAS_GAP: 0.05, // Maximum 5% accuracy difference between demographics
};

/**
 * Calculate Face Detection Rate (FDR).
 *
 * @param {number} detectedFaces - Number of faces detected
 * @param {number} totalImages - Total images processed
 * @returns {number} FDR value (0-1)
 */
FacePerformance.calculateFDR = function (detectedFaces, totalImages) {
  if (totalImages <= 0) return 0;
  return detectedFaces / totalImages;
};

/**
 * Calculate False Accept Rate (FAR).
 *
 * @param {number} falseAccepts - Number of false accepts
 * @param {number} totalImpostorTrials - Total impostor trials
 * @returns {number} FAR value (0-1)
 */
FacePerformance.calculateFAR = function (falseAccepts, totalImpostorTrials) {
  if (totalImpostorTrials <= 0) return 0;
  return falseAccepts / totalImpostorTrials;
};

/**
 * Calculate False Reject Rate (FRR).
 *
 * @param {number} falseRejects - Number of false rejects
 * @param {number} totalGenuineTrials - Total genuine trials
 * @returns {number} FRR value (0-1)
 */
FacePerformance.calculateFRR = function (falseRejects, totalGenuineTrials) {
  if (totalGenuineTrials <= 0) return 0;
  return falseRejects / totalGenuineTrials;
};

/**
 * Calculate Equal Error Rate (EER).
 *
 * @param {Array<{ threshold: number, far: number, frr: number }>} rocData - ROC curve data
 * @returns {{ eer: number, threshold: number }}
 */
FacePerformance.calculateEER = function (rocData) {
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

// ═══════════════════════════════════════════════════════════════════════════
// DEMOGRAPHIC BIAS ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze demographic bias in face recognition.
 *
 * @param {object} params - Analysis parameters
 * @param {Array<{ group: string, scores: number[] }>} params.demographicGroups - Scores by demographic
 * @returns {{ biasDetected: boolean, groups: object, maxGap: number }}
 */
FacePerformance.analyzeBias = function (params) {
  var groups, groupNames, groupAccuracies, i, j, maxGap, mean, variance;

  if (!params || !params.demographicGroups || params.demographicGroups.length < 2) {
    return { biasDetected: false, groups: {}, maxGap: 0 };
  }

  groups = {};
  groupNames = [];
  groupAccuracies = [];

  // Calculate accuracy for each group
  for (i = 0; i < params.demographicGroups.length; i++) {
    var group = params.demographicGroups[i];
    if (!group.scores || group.scores.length === 0) continue;

    // Calculate mean score (similarity)
    mean = 0;
    for (j = 0; j < group.scores.length; j++) {
      mean += group.scores[j];
    }
    mean /= group.scores.length;

    // Calculate variance
    variance = 0;
    for (j = 0; j < group.scores.length; j++) {
      variance += Math.pow(group.scores[j] - mean, 2);
    }
    variance /= group.scores.length;

    groups[group.group] = {
      mean: mean,
      variance: variance,
      stdDev: Math.sqrt(variance),
      count: group.scores.length,
    };

    groupNames.push(group.group);
    groupAccuracies.push(mean);
  }

  // Find maximum gap between any two groups
  maxGap = 0;
  for (i = 0; i < groupAccuracies.length; i++) {
    for (j = i + 1; j < groupAccuracies.length; j++) {
      var gap = Math.abs(groupAccuracies[i] - groupAccuracies[j]);
      if (gap > maxGap) maxGap = gap;
    }
  }

  return {
    biasDetected: maxGap > FacePerformance.THRESHOLDS.MAX_BIAS_GAP,
    groups: groups,
    maxGap: maxGap,
    threshold: FacePerformance.THRESHOLDS.MAX_BIAS_GAP,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// POSE AND EXPRESSION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze performance across different poses.
 *
 * @param {object} params - Analysis parameters
 * @param {Array<{ pose: string, genuineScores: number[], impostorScores: number[] }>} params.poseData - Data by pose
 * @returns {{ results: object, bestPose: string, worstPose: string }}
 */
FacePerformance.analyzePose = function (params) {
  var results, bestPose, worstPose, bestEer, worstEer, i;

  if (!params || !params.poseData || params.poseData.length === 0) {
    return { results: {}, bestPose: "", worstPose: "" };
  }

  results = {};
  bestPose = "";
  worstPose = "";
  bestEer = Infinity;
  worstEer = 0;

  for (i = 0; i < params.poseData.length; i++) {
    var pose = params.poseData[i];
    if (!pose.genuineScores || !pose.impostorScores) continue;

    var rocData = FacePerformance._generateROC(pose.genuineScores, pose.impostorScores);
    var eer = FacePerformance.calculateEER(rocData);

    results[pose.pose] = {
      eer: eer.eer,
      genuineCount: pose.genuineScores.length,
      impostorCount: pose.impostorScores.length,
    };

    if (eer.eer < bestEer && pose.genuineScores.length > 0) {
      bestEer = eer.eer;
      bestPose = pose.pose;
    }

    if (eer.eer > worstEer && pose.genuineScores.length > 0) {
      worstEer = eer.eer;
      worstPose = pose.pose;
    }
  }

  return {
    results: results,
    bestPose: bestPose,
    worstPose: worstPose,
    bestEer: bestEer,
    worstEer: worstEer,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate face recognition system performance comprehensively.
 *
 * @param {object} params - Evaluation parameters
 * @param {Array<number>} params.genuineScores - Genuine match scores
 * @param {Array<number>} params.impostorScores - Impostor match scores
 * @param {Array<{ group: string, scores: number[] }>} [params.demographicGroups] - Demographic data
 * @param {Array<{ pose: string, genuineScores: number[], impostorScores: number[] }>} [params.poseData] - Pose data
 * @param {number} [params.detectionRate] - Face detection rate
 * @param {string} [params.systemName] - System name for reporting
 * @returns {object} Comprehensive performance report
 */
FacePerformance.evaluate = function (params) {
  var genuineScores, impostorScores, rocData, eerResult;
  var farCI, frrCI, accuracyCI, report;

  if (!params || !params.genuineScores || !params.impostorScores) {
    throw new Error("genuineScores and impostorScores are required");
  }

  genuineScores = params.genuineScores;
  impostorScores = params.impostorScores;

  // Check minimum sample sizes
  if (genuineScores.length < FacePerformance.THRESHOLDS.MIN_GENUINE_TRIALS) {
    console.warn("FacePerformance: Below minimum genuine trial count (" +
      genuineScores.length + " < " + FacePerformance.THRESHOLDS.MIN_GENUINE_TRIALS + ")");
  }

  if (impostorScores.length < FacePerformance.THRESHOLDS.MIN_IMPOSTOR_TRIALS) {
    console.warn("FacePerformance: Below minimum impostor trial count (" +
      impostorScores.length + " < " + FacePerformance.THRESHOLDS.MIN_IMPOSTOR_TRIALS + ")");
  }

  // Generate ROC curve
  rocData = FacePerformance._generateROC(genuineScores, impostorScores);

  // Calculate EER
  eerResult = FacePerformance.calculateEER(rocData);

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

  var far = FacePerformance.calculateFAR(falseAccepts, impostorScores.length);
  var frr = FacePerformance.calculateFRR(falseRejects, genuineScores.length);
  var accuracy = FacePerformance._calculateAccuracy(
    genuineScores.length - falseRejects,
    impostorScores.length - falseAccepts,
    genuineScores.length + impostorScores.length
  );

  // Confidence intervals
  farCI = FacePerformance._wilsonCI(falseAccepts, impostorScores.length);
  frrCI = FacePerformance._wilsonCI(falseRejects, genuineScores.length);
  accuracyCI = FacePerformance._wilsonCI(
    genuineScores.length - falseRejects + impostorScores.length - falseAccepts,
    genuineScores.length + impostorScores.length
  );

  // Generate DET curve
  var detData = FacePerformance._generateDET(genuineScores, impostorScores);

  // Demographic bias analysis
  var biasAnalysis = null;
  if (params.demographicGroups && params.demographicGroups.length >= 2) {
    biasAnalysis = FacePerformance.analyzeBias({ demographicGroups: params.demographicGroups });
  }

  // Pose analysis
  var poseAnalysis = null;
  if (params.poseData && params.poseData.length > 0) {
    poseAnalysis = FacePerformance.analyzePose({ poseData: params.poseData });
  }

  report = {
    systemName: params.systemName || "Face Recognition System",
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
      detectionRate: params.detectionRate || null,
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
    biasAnalysis: biasAnalysis,
    poseAnalysis: poseAnalysis,
    evaluation: FacePerformance._evaluateMetrics(far, frr, eerResult.eer, accuracy, params.detectionRate),
    summary: FacePerformance._generateSummary(
      params.systemName, far, frr, eerResult.eer, accuracy,
      genuineScores.length, impostorScores.length, params.detectionRate
    ),
  };

  return report;
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate ROC curve data.
 * @private
 */
FacePerformance._generateROC = function (genuineScores, impostorScores, numPoints) {
  var thresholds, rocData, minScore, maxScore, i, j, threshold;
  var trueAccepts, falseAccepts, trueRejects, falseRejects;

  if (!genuineScores || !impostorScores) return [];
  if (genuineScores.length === 0 || impostorScores.length === 0) return [];

  numPoints = numPoints || 100;

  minScore = Math.min(
    Math.min.apply(null, genuineScores),
    Math.min.apply(null, impostorScores)
  );
  maxScore = Math.max(
    Math.max.apply(null, genuineScores),
    Math.max.apply(null, impostorScores)
  );

  thresholds = [];
  for (i = 0; i <= numPoints; i++) {
    thresholds.push(minScore + (maxScore - minScore) * (i / numPoints));
  }

  rocData = [];
  for (i = 0; i < thresholds.length; i++) {
    threshold = thresholds[i];
    trueAccepts = 0;
    falseAccepts = 0;
    falseRejects = 0;

    for (j = 0; j < genuineScores.length; j++) {
      if (genuineScores[j] >= threshold) trueAccepts++;
      else falseRejects++;
    }

    for (j = 0; j < impostorScores.length; j++) {
      if (impostorScores[j] >= threshold) falseAccepts++;
    }

    var far = FacePerformance.calculateFAR(falseAccepts, impostorScores.length);
    var frr = FacePerformance.calculateFRR(falseRejects, genuineScores.length);
    var tpr = genuineScores.length > 0 ? trueAccepts / genuineScores.length : 0;

    rocData.push({ threshold: threshold, far: far, frr: frr, tpr: tpr });
  }

  return rocData;
};

/**
 * Generate DET curve data.
 * @private
 */
FacePerformance._generateDET = function (genuineScores, impostorScores, numPoints) {
  var rocData = FacePerformance._generateROC(genuineScores, impostorScores, numPoints);
  var detData = [];
  for (var i = 0; i < rocData.length; i++) {
    detData.push({ far: rocData[i].far, frr: rocData[i].frr });
  }
  return detData;
};

/**
 * Calculate accuracy.
 * @private
 */
FacePerformance._calculateAccuracy = function (trueAccepts, trueRejects, totalTrials) {
  if (totalTrials <= 0) return 0;
  return (trueAccepts + trueRejects) / totalTrials;
};

/**
 * Wilson confidence interval.
 * @private
 */
FacePerformance._wilsonCI = function (successes, trials, confidence) {
  var z, p, n, denominator, centre, margin;

  if (trials <= 0) return { lower: 0, upper: 1, estimate: 0 };

  confidence = confidence || 0.95;
  if (confidence >= 0.99) z = 2.576;
  else if (confidence >= 0.95) z = 1.96;
  else if (confidence >= 0.90) z = 1.645;
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

/**
 * Evaluate metrics against thresholds.
 * @private
 */
FacePerformance._evaluateMetrics = function (far, frr, eer, accuracy, detectionRate) {
  var results = [];

  results.push({
    metric: "FAR",
    value: far,
    threshold: FacePerformance.THRESHOLDS.MAX_FAR,
    passed: far <= FacePerformance.THRESHOLDS.MAX_FAR,
  });

  results.push({
    metric: "FRR",
    value: frr,
    threshold: FacePerformance.THRESHOLDS.MAX_FRR,
    passed: frr <= FacePerformance.THRESHOLDS.MAX_FRR,
  });

  results.push({
    metric: "EER",
    value: eer,
    threshold: FacePerformance.THRESHOLDS.MAX_EER,
    passed: eer <= FacePerformance.THRESHOLDS.MAX_EER,
  });

  results.push({
    metric: "Accuracy",
    value: accuracy,
    threshold: FacePerformance.THRESHOLDS.MIN_ACCURACY,
    passed: accuracy >= FacePerformance.THRESHOLDS.MIN_ACCURACY,
  });

  if (detectionRate !== null && detectionRate !== undefined) {
    results.push({
      metric: "Detection Rate",
      value: detectionRate,
      threshold: FacePerformance.THRESHOLDS.MIN_DETECTION_RATE,
      passed: detectionRate >= FacePerformance.THRESHOLDS.MIN_DETECTION_RATE,
    });
  }

  return results;
};

/**
 * Generate human-readable summary.
 * @private
 */
FacePerformance._generateSummary = function (name, far, frr, eer, accuracy, genuineCount, impostorCount, detectionRate) {
  var lines = [];
  lines.push("=== ISO/IEC 19795 Face Recognition Performance Report ===");
  lines.push("System: " + (name || "Face Recognition System"));
  lines.push("Sample Size: " + genuineCount + " genuine, " + impostorCount + " impostor");
  lines.push("");
  lines.push("Error Rates:");
  lines.push("  FAR: " + (far * 100).toFixed(4) + "%");
  lines.push("  FRR: " + (frr * 100).toFixed(4) + "%");
  lines.push("  EER: " + (eer * 100).toFixed(4) + "%");
  lines.push("");
  lines.push("Accuracy: " + (accuracy * 100).toFixed(2) + "%");
  if (detectionRate !== null && detectionRate !== undefined) {
    lines.push("Detection Rate: " + (detectionRate * 100).toFixed(2) + "%");
  }
  lines.push("");
  lines.push("Evaluation: " + (far <= 0.001 && frr <= 0.01 && eer <= 0.005 ? "PASSED" : "FAILED"));

  return lines.join("\n");
};

// Export for window
if (typeof window !== "undefined") {
  window.FacePerformance = FacePerformance;
}
