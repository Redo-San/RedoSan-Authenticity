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
// ── Iris Liveness: Presentation Attack Detection (PAD) ──
// ISO/IEC 30107-3 style liveness detection for iris biometrics.

/**
 * Liveness detection configuration.
 */
var IRIS_LIVENESS_CONFIG = {
  // Pupil dilation test
  pupilDilationFrames: 3, // number of frames to capture
  pupilDilationIntervalMs: 500, // ms between captures
  pupilDilationMinRatio: 0.15, // min dilation ratio (max_r / min_r)

  // Specular reflection
  specularMinHighlights: 2, // minimum distinct highlight points
  specularMaxSpread: 50, // max spread of highlight cluster (px)

  // Temporal consistency
  temporalMinVariance: 0.00005, // min inter-frame iris position variance (eye movement)
  temporalMaxVariance: 0.1, // max variance (too much = unstable capture)

  // Overall thresholds
  livenessScoreThreshold: 0.6, // combined score above this = live
  maxSpoofScore: 0.4, // below this = likely spoof

  // FIDO Biometrics v4.0 PAI Species Classification
  // Level A: Basic (printed photos, static images)
  // Level B: Advanced (video replay, printed-in-fake-eye)
  // Level C: Expert (3D masks, prosthetic eyes)
  PAI_SPECIES: {
    PRINTED_PHOTO: 1,
    SCREEN_DISPLAY: 2,
    VIDEO_REPLAY: 3,
    PRINTED_EYE: 4,
    PROSTHETIC_3D: 5,
    UNKNOWN: 0,
  },
  PAI_LEVEL: {
    A: 1, // Basic anti-spoofing
    B: 2, // Advanced anti-spoofing
    C: 3, // Expert anti-spoofing
  },
};

/**
 * @class
 * Iris liveness detection (anti-spoofing).
 * Uses multiple heuristic checks combined into a single liveness score.
 */
function IrisLiveness() {
  this._config = IRIS_LIVENESS_CONFIG;
  this._frameBuffer = [];
}

/**
 * Get the liveness config.
 * @returns {object}
 */
IrisLiveness.prototype.getConfig = function () {
  return this._config;
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 1: Pupil Dilation Response
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze pupil dilation across multiple frames.
 * Real pupils dilate/constrict with light changes; fake eyes have fixed pupils.
 * @param {Array<{ pupilRadius: number, irisRadius: number }>} frames
 * @returns {{ score: number, dilationRatio: number, details: string }}
 */
IrisLiveness.pupilDilationTest = function (frames) {
  if (!frames || frames.length < 2) {
    return { score: 0.5, dilationRatio: 1, details: "Insufficient frames for dilation test" };
  }

  var radii, minR, maxR, ratio, i;

  radii = [];
  for (i = 0; i < frames.length; i++) {
    if (frames[i].pupilRadius > 0) {
      radii.push(frames[i].pupilRadius);
    }
  }

  if (radii.length < 2) {
    return { score: 0.5, dilationRatio: 1, details: "Could not detect pupil in enough frames" };
  }

  minR = Math.min.apply(null, radii);
  maxR = Math.max.apply(null, radii);
  ratio = minR > 0 ? maxR / minR : 1;

  // Score: 1.0 if dilation is clearly visible, 0.0 if fixed
  var score;
  if (ratio >= IRIS_LIVENESS_CONFIG.pupilDilationMinRatio * 3) {
    score = 1;
  } else if (ratio >= IRIS_LIVENESS_CONFIG.pupilDilationMinRatio) {
    score = (ratio - 1) / (IRIS_LIVENESS_CONFIG.pupilDilationMinRatio * 2);
  } else {
    score = 0.1; // suspicious: no dilation detected
  }

  return {
    score: Math.min(1, Math.max(0, score)),
    dilationRatio: ratio,
    details:
      ratio < IRIS_LIVENESS_CONFIG.pupilDilationMinRatio
        ? "Warning: pupil size is constant (possible spoof)"
        : "Pupil dilation detected (ratio: " + ratio.toFixed(3) + ")",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 2: Specular Reflection Analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect specular reflections (highlight points) on the eye surface.
 * Real eyes have multiple specular reflections from ambient + light sources.
 * Photos/screens have flat, single reflections.
 * @param {Float64Array} grayImage - grayscale image (row-major)
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number, radius: number }} pupil
 * @returns {{ score: number, highlightCount: number, details: string }}
 */
IrisLiveness.specularReflectionTest = function (grayImage, width, height, pupil) {
  if (!grayImage || !pupil) {
    return { score: 0.5, highlightCount: 0, details: "No image or pupil data" };
  }

  // Find bright spots near the pupil/iris boundary
  var highlights, threshold, x, y, idx, val;
  var i, j, clusterCount, inCluster, minDist;

  // Threshold: top 5% brightness in the pupil region
  threshold = 200; // NIR images: specular reflections are very bright
  highlights = [];

  // Search in the region around the pupil
  var searchRadius = pupil.radius * 2.5;
  var minX = Math.max(0, Math.floor(pupil.cx - searchRadius));
  var maxX = Math.min(width - 1, Math.ceil(pupil.cx + searchRadius));
  var minY = Math.max(0, Math.floor(pupil.cy - searchRadius));
  var maxY = Math.min(height - 1, Math.ceil(pupil.cy + searchRadius));

  for (y = minY; y <= maxY; y++) {
    for (x = minX; x <= maxX; x++) {
      idx = y * width + x;
      val = grayImage[idx];
      if (val > threshold) {
        // Check if it's a local maximum (within 3px neighborhood)
        var isMax = true;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = x + dx;
            var ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && grayImage[ny * width + nx] > val) {
                isMax = false;
                break;
              }
          }
          if (!isMax) break;
        }
        if (isMax) {
          highlights.push({ x: x, y: y, val: val });
        }
      }
    }
  }

  // Cluster highlights (within minDist pixels = same reflection)
  minDist = 15;
  clusterCount = 0;
  var used = new Uint8Array(highlights.length);

  for (i = 0; i < highlights.length; i++) {
    if (used[i]) continue;
    clusterCount++;
    inCluster = [i];
    used[i] = 1;
    for (j = i + 1; j < highlights.length; j++) {
      if (used[j]) continue;
      var dist = Math.hypot(
        highlights[i].x - highlights[j].x,
        highlights[i].y - highlights[j].y,
      );
      if (dist < minDist) {
        used[j] = 1;
        inCluster.push(j);
      }
    }
  }

  // Score: more distinct highlights = more likely real
  var score;
  if (clusterCount >= IRIS_LIVENESS_CONFIG.specularMinHighlights) {
    score = Math.min(1, 0.5 + (clusterCount - 1) * 0.2);
  } else if (clusterCount === 1) {
    score = 0.3; // single highlight is suspicious
  } else {
    score = 0.1; // no highlights = very suspicious
  }

  return {
    score: score,
    highlightCount: clusterCount,
    details:
      clusterCount < IRIS_LIVENESS_CONFIG.specularMinHighlights
        ? "Warning: only " + clusterCount + " highlight(s) detected"
        : clusterCount + " distinct specular reflections detected",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 3: Temporal Consistency (Eye Movement)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze inter-frame iris position variance.
 * Real eyes have natural micro-movements; photos are static.
 * @param {Array<{ irisCx: number, irisCy: number }>} frames
 * @returns {{ score: number, variance: number, details: string }}
 */
IrisLiveness.temporalConsistencyTest = function (frames) {
  if (!frames || frames.length < 3) {
    return { score: 0.5, variance: 0, details: "Insufficient frames for temporal test" };
  }

  var cxValues, cyValues, i, meanCx, meanCy, varCx, varCy;

  cxValues = [];
  cyValues = [];
  for (i = 0; i < frames.length; i++) {
    if (frames[i].irisCx !== undefined && frames[i].irisCy !== undefined) {
      cxValues.push(frames[i].irisCx);
      cyValues.push(frames[i].irisCy);
    }
  }

  if (cxValues.length < 3) {
    return { score: 0.5, variance: 0, details: "Could not track iris position" };
  }

  // Compute mean
  meanCx = 0;
  meanCy = 0;
  for (i = 0; i < cxValues.length; i++) {
    meanCx += cxValues[i];
    meanCy += cyValues[i];
  }
  meanCx /= cxValues.length;
  meanCy /= cyValues.length;

  // Compute variance
  varCx = 0;
  varCy = 0;
  for (i = 0; i < cxValues.length; i++) {
    varCx += (cxValues[i] - meanCx) * (cxValues[i] - meanCx);
    varCy += (cyValues[i] - meanCy) * (cyValues[i] - meanCy);
  }
  varCx /= cxValues.length;
  varCy /= cyValues.length;
  var totalVariance = varCx + varCy;

  // Score
  var score;
  if (
    totalVariance >= IRIS_LIVENESS_CONFIG.temporalMinVariance &&
    totalVariance <= IRIS_LIVENESS_CONFIG.temporalMaxVariance
  ) {
    // Natural eye movement detected
    score = 0.8 + Math.min(0.2, totalVariance * 100);
  } else if (totalVariance < IRIS_LIVENESS_CONFIG.temporalMinVariance) {
    // Too static — possible photo
    score = 0.2;
  } else {
    // Too much movement — unstable capture
    score = 0.4;
  }

  return {
    score: Math.min(1, Math.max(0, score)),
    variance: totalVariance,
    details:
      totalVariance < IRIS_LIVENESS_CONFIG.temporalMinVariance
        ? "Warning: no eye movement detected (possible static image)"
        : "Natural eye movement detected",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 4: Moiré Pattern Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect moiré patterns that indicate a screen capture.
 * Screens produce distinctive interference patterns when photographed.
 * @param {Float64Array} grayImage
 * @param {number} width
 * @param {number} height
 * @returns {{ score: number, moireStrength: number, details: string }}
 */
IrisLiveness.moireDetectionTest = function (grayImage, width, height) {
  if (!grayImage) {
    return { score: 0.5, moireStrength: 0, details: "No image data" };
  }

  // Simple frequency analysis: compute FFT-like energy in specific bands
  // Moiré patterns appear as periodic patterns at specific frequencies
  var x, y, idx, val, sum, sumSq, mean, variance;

  sum = 0;
  sumSq = 0;
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      idx = y * width + x;
      val = grayImage[idx];
      sum += val;
      sumSq += val * val;
    }
  }
  mean = sum / (width * height);
  variance = sumSq / (width * height) - mean * mean;

  // High variance in a narrow band suggests moiré
  // This is a simplified heuristic; real moiré detection uses FFT
  var moireStrength = variance / (255 * 255);

  var score;
  if (moireStrength > 0.02) {
    score = 0.3; // suspicious: high-frequency patterns
  } else {
    score = 0.7; // normal
  }

  return {
    score: score,
    moireStrength: moireStrength,
    details:
      moireStrength > 0.02
        ? "Warning: possible screen pattern detected"
        : "No moiré artifacts detected",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 5: Texture Analysis (FIDO PAI Level A)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze iris texture to detect printed photos (flat, no micro-texture).
 * Real iris has complex stromal texture; printed photos lose high-frequency detail.
 * @param {Float64Array} grayImage - grayscale image
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @returns {{ score: number, textureEnergy: number, details: string }}
 */
IrisLiveness.textureAnalysisTest = function (grayImage, width, height, iris) {
  if (!grayImage || !iris) {
    return { score: 0.5, textureEnergy: 0, details: "No image or iris data" };
  }

  // Compute local binary pattern (LBP) energy in the iris region
  var sumEnergy = 0, count = 0;
  var x, y, cx, cy, r, idx, val, neighbors, lbp, energy;

  cx = iris.cx;
  cy = iris.cy;
  r = iris.radius;

  for (y = Math.max(1, Math.floor(cy - r)); y < Math.min(height - 1, Math.ceil(cy + r)); y++) {
    for (x = Math.max(1, Math.floor(cx - r)); x < Math.min(width - 1, Math.ceil(cx + r)); x++) {
      var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (dist > r * 0.9 || dist < r * 0.35) continue;

      idx = y * width + x;
      val = grayImage[idx];

      // Compute 8-neighbor LBP
      lbp = 0;
      neighbors = [
        grayImage[idx - width - 1], grayImage[idx - width], grayImage[idx - width + 1],
        grayImage[idx + 1],
        grayImage[idx + width + 1], grayImage[idx + width], grayImage[idx + width - 1],
        grayImage[idx - 1],
      ];

      for (var n = 0; n < 8; n++) {
        if (neighbors[n] >= val) lbp |= (1 << n);
      }

      // Count non-uniform patterns (indicator of texture complexity)
      energy += (lbp !== 0 && lbp !== 255) ? 1 : 0;
      count++;
    }
  }

  var textureEnergy = count > 0 ? sumEnergy / count : 0;

  // High texture energy = real iris; low = printed/flat
  var score;
  if (textureEnergy > 0.6) {
    score = 0.9; // Rich texture — likely real
  } else if (textureEnergy > 0.3) {
    score = 0.6 + (textureEnergy - 0.3) * 1; // Moderate
  } else {
    score = 0.2; // Flat texture — suspicious (printed photo)
  }

  return {
    score: Math.min(1, Math.max(0, score)),
    textureEnergy: textureEnergy,
    details:
      textureEnergy < 0.3
        ? "Warning: low iris texture energy (possible printed photo)"
        : "Iris texture analysis passed",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 6: Color Channel Analysis (FIDO PAI Level A)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze color channels to detect screen-captured iris images.
 * Screens emit RGB light patterns that differ from reflected light on real eyes.
 * @param {Uint8ClampedArray} rgbImage - RGB image data (3 or 4 channels)
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @returns {{ score: number, screenIndicator: number, details: string }}
 */
IrisLiveness.colorChannelAnalysisTest = function (rgbImage, width, height, iris) {
  if (!rgbImage || !iris) {
    return { score: 0.5, screenIndicator: 0, details: "No image or iris data" };
  }

  var rSum = 0, gSum = 0, bSum = 0, count = 0;
  var x, y, idx;

  for (y = Math.max(0, Math.floor(iris.cy - iris.radius)); y < Math.min(height, Math.ceil(iris.cy + iris.radius)); y++) {
    for (x = Math.max(0, Math.floor(iris.cx - iris.radius)); x < Math.min(width, Math.ceil(iris.cx + iris.radius)); x++) {
      idx = (y * width + x) * 4;
      if (idx + 2 < rgbImage.length) {
        rSum += rgbImage[idx];
        gSum += rgbImage[idx + 1];
        bSum += rgbImage[idx + 2];
        count++;
      }
    }
  }

  if (count === 0) return { score: 0.5, screenIndicator: 0, details: "No pixels in iris region" };

  var rMean = rSum / count;
  var gMean = gSum / count;
  var bMean = bSum / count;

  // Screens show: high blue channel, uniform RGB ratios
  // Real eyes: lower blue, more variation between channels
  var blueRatio = bMean / (rMean + gMean + bMean + 1);
  var channelSpread = Math.max(rMean, gMean, bMean) - Math.min(rMean, gMean, bMean);

  var screenIndicator = 0;
  if (blueRatio > 0.38) screenIndicator += 0.3; // High blue = screen
  if (channelSpread < 10) screenIndicator += 0.3; // Very uniform = screen
  if (rMean > 100 && gMean > 100 && bMean > 100) screenIndicator += 0.2; // All bright = screen emission

  var score = Math.max(0.1, 1 - screenIndicator);

  return {
    score: score,
    screenIndicator: screenIndicator,
    details:
      screenIndicator > 0.5
        ? "Warning: screen emission pattern detected"
        : "Color channel analysis passed",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 7: Depth Estimation Heuristic (FIDO PAI Level B)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Heuristic depth estimation using focus gradient across iris.
 * Real 3D eyes have natural depth falloff; flat images show uniform focus.
 * @param {Float64Array} grayImage - grayscale image
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @returns {{ score: number, depthVariance: number, details: string }}
 */
IrisLiveness.depthEstimationTest = function (grayImage, width, height, iris) {
  if (!grayImage || !iris) {
    return { score: 0.5, depthVariance: 0, details: "No image or iris data" };
  }

  // Sample focus at different distances from camera (proximal vs distal iris)
  var regions = [
    { name: "upper", yOff: -0.3 }, // upper eyelid area (closer to camera)
    { name: "center", yOff: 0 }, // central iris
    { name: "lower", yOff: 0.3 }, // lower area (further from camera)
  ];

  var focusValues = [];

  for (var r = 0; r < regions.length; r++) {
    var region = regions[r];
    var sampleY = Math.floor(iris.cy + iris.radius * region.yOff);
    var sampleX = iris.cx;

    // Compute local focus (Laplacian variance) in a small patch
    var patchSize = Math.max(3, Math.floor(iris.radius * 0.3));
    var lapSum = 0, lapCount = 0;

    for (var y = Math.max(1, sampleY - patchSize); y < Math.min(height - 1, sampleY + patchSize); y++) {
      for (var x = Math.max(1, sampleX - patchSize); x < Math.min(width - 1, sampleX + patchSize); x++) {
        var idx = y * width + x;
        var lap = -4 * grayImage[idx] + grayImage[idx - 1] + grayImage[idx + 1] + grayImage[idx - width] + grayImage[idx + width];
        lapSum += Math.abs(lap);
        lapCount++;
      }
    }

    focusValues.push(lapCount > 0 ? lapSum / lapCount : 0);
  }

  // Compute variance of focus across depth regions
  var mean = (focusValues[0] + focusValues[1] + focusValues[2]) / 3;
  var variance = 0;
  for (var v = 0; v < focusValues.length; v++) {
    variance += (focusValues[v] - mean) * (focusValues[v] - mean);
  }
  variance /= focusValues.length;

  // Natural depth variation → real 3D eye; no variation → flat image
  var score;
  if (variance > 50) {
    score = 0.85; // Good depth variation
  } else if (variance > 10) {
    score = 0.5 + (variance / 50) * 0.35; // Moderate
  } else {
    score = 0.3; // Suspiciously flat
  }

  return {
    score: Math.min(1, Math.max(0, score)),
    depthVariance: variance,
    details:
      variance < 10
        ? "Warning: no depth variation detected (possible flat image)"
        : "Depth estimation consistent with 3D eye",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// FIDO PAI SPECIES CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify Presentation Attack Instrument (PAI) species per FIDO Biometrics v4.0.
 * @param {object} checkResults - Results from individual checks
 * @returns {{ species: number, level: number, confidence: number, details: string }}
 */
IrisLiveness.classifyPAISpecies = function (checkResults) {
  if (!checkResults || !checkResults.checks) {
    return { species: 0, level: 0, confidence: 0, details: "No check results available" };
  }

  var checks = checkResults.checks;
  var speciesScores = {};
  var Species = IRIS_LIVENESS_CONFIG.PAI_SPECIES;
  var Level = IRIS_LIVENESS_CONFIG.PAI_LEVEL;

  // Initialize scores
  speciesScores[Species.PRINTED_PHOTO] = 0;
  speciesScores[Species.SCREEN_DISPLAY] = 0;
  speciesScores[Species.VIDEO_REPLAY] = 0;
  speciesScores[Species.PRINTED_EYE] = 0;

  for (var i = 0; i < checks.length; i++) {
    var check = checks[i];

    // Low dilation → printed photo or screen
    if (check.name === "pupilDilation" && check.score < 0.3) {
      speciesScores[Species.PRINTED_PHOTO] += 0.4;
      speciesScores[Species.SCREEN_DISPLAY] += 0.3;
    }

    // Single specular highlight → screen or printed
    if (check.name === "specularReflection" && check.score < 0.3) {
      speciesScores[Species.SCREEN_DISPLAY] += 0.3;
      speciesScores[Species.PRINTED_PHOTO] += 0.2;
    }

    // No temporal movement → printed photo
    if (check.name === "temporalConsistency" && check.score < 0.3) {
      speciesScores[Species.PRINTED_PHOTO] += 0.4;
    }

    // Moiré pattern → screen capture
    if (check.name === "moireDetection" && check.score < 0.4) {
      speciesScores[Species.SCREEN_DISPLAY] += 0.5;
    }

    // Low texture → printed photo
    if (check.name === "textureAnalysis" && check.score < 0.3) {
      speciesScores[Species.PRINTED_PHOTO] += 0.3;
    }

    // Screen color pattern → screen display
    if (check.name === "colorChannelAnalysis" && check.score < 0.4) {
      speciesScores[Species.SCREEN_DISPLAY] += 0.4;
    }

    // No depth variation → flat image (printed or screen)
    if (check.name === "depthEstimation" && check.score < 0.3) {
      speciesScores[Species.PRINTED_PHOTO] += 0.2;
      speciesScores[Species.SCREEN_DISPLAY] += 0.2;
    }
  }

  // Find highest scoring species
  var maxScore = 0;
  var classifiedSpecies = Species.UNKNOWN;
  for (var sp in speciesScores) {
    if (speciesScores[sp] > maxScore) {
      maxScore = speciesScores[sp];
      classifiedSpecies = parseInt(sp, 10);
    }
  }

  // Determine PAI Level
  var level = Level.A; // Default to Level A
  if (classifiedSpecies === Species.VIDEO_REPLAY || classifiedSpecies === Species.PRINTED_EYE) {
    level = Level.B;
  } else if (classifiedSpecies === Species.PROSTHETIC_3D) {
    level = Level.C;
  }

  // Confidence based on score separation
  var sortedScores = Object.values(speciesScores).sort(function (a, b) { return b - a; });
  var confidence = sortedScores.length >= 2
    ? Math.min(1, (sortedScores[0] - sortedScores[1]) / (sortedScores[0] + 0.001))
    : 0;

  var speciesNames = {};
  speciesNames[Species.PRINTED_PHOTO] = "Printed Photo";
  speciesNames[Species.SCREEN_DISPLAY] = "Screen Display";
  speciesNames[Species.VIDEO_REPLAY] = "Video Replay";
  speciesNames[Species.PRINTED_EYE] = "Printed Eye";
  speciesNames[Species.UNKNOWN] = "Unknown";

  return {
    species: classifiedSpecies,
    speciesName: speciesNames[classifiedSpecies] || "Unknown",
    level: level,
    confidence: Math.round(confidence * 100) / 100,
    scores: speciesScores,
    details: "PAI species: " + (speciesNames[classifiedSpecies] || "Unknown") +
      " (Level " + ["A", "B", "C"][level - 1] + ", confidence: " + Math.round(confidence * 100) + "%)",
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// APCER / BPCER / IAPAR COMPUTATION (ISO/IEC 30107-3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute Attack Presentation Classification Error Rate (APCER).
 * Percentage of attacks incorrectly classified as live.
 * @param {number} falseAccepts - Attacks accepted as live
 * @param {number} totalAttacks - Total attack presentations
 * @returns {number} APCER (0-1)
 */
IrisLiveness.computeAPCER = function (falseAccepts, totalAttacks) {
  if (totalAttacks <= 0) return 0;
  return falseAccepts / totalAttacks;
};

/**
 * Compute Bona Fide Presentation Classification Error Rate (BPCER).
 * Percentage of live presentations incorrectly classified as attacks.
 * @param {number} falseRejects - Live presentations rejected as attacks
 * @param {number} totalBonaFide - Total bona fide presentations
 * @returns {number} BPCER (0-1)
 */
IrisLiveness.computeBPCER = function (falseRejects, totalBonaFide) {
  if (totalBonaFide <= 0) return 0;
  return falseRejects / totalBonaFide;
};

/**
 * Compute Inter-Agency Presentation Analysis Rate (IAPAR).
 * FIDO metric combining APCER and BPCER across agencies.
 * @param {Array<{ agency: string, apcer: number, bpcer: number }>} agencyData
 * @returns {{ meanAPCER: number, meanBPCER: number, maxAPCER: number, maxBPCER: number, iapar: number }}
 */
IrisLiveness.computeIAPAR = function (agencyData) {
  if (!agencyData || agencyData.length === 0) {
    return { meanAPCER: 0, meanBPCER: 0, maxAPCER: 0, maxBPCER: 0, iapar: 0 };
  }

  var sumAPCER = 0, sumBPCER = 0;
  var maxAPCER = 0, maxBPCER = 0;

  for (var i = 0; i < agencyData.length; i++) {
    sumAPCER += agencyData[i].apcer;
    sumBPCER += agencyData[i].bpcer;
    maxAPCER = Math.max(maxAPCER, agencyData[i].apcer);
    maxBPCER = Math.max(maxBPCER, agencyData[i].bpcer);
  }

  var meanAPCER = sumAPCER / agencyData.length;
  var meanBPCER = sumBPCER / agencyData.length;
  var iapar = (meanAPCER + meanBPCER) / 2;

  return {
    meanAPCER: meanAPCER,
    meanBPCER: meanBPCER,
    maxAPCER: maxAPCER,
    maxBPCER: maxBPCER,
    iapar: iapar,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// BPCER10 / BPCER20 OPERATIONAL POINTS
// (official LivDet-Iris / PyPAD reporting convention)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute APCER at fixed BPCER operating points.
 * This is the official LivDet-Iris and PyPAD convention for reporting PAD
 * performance: fix the error rate on bona fide users (BPCER = 10% or 20%),
 * then report the attack success rate (APCER) at that threshold.
 * Lower APCER at a given BPCER = better PAD system.
 *
 * Scores are liveness scores where HIGHER = more likely live.
 * @param {number[]} bonaFideScores - Liveness scores of genuine live presentations
 * @param {number[]} attackScores - Liveness scores of attack presentations
 * @param {number[]} [targets] - BPCER targets
 * @returns {{ points: Array<{bpcerTarget: number, threshold: number, apcer: number}>, details: string }}
 */
IrisLiveness.computeBpcerApcerPoints = function (bonaFideScores, attackScores, targets) {
  var i, sorted, idx, threshold, attacksPassed, apcer;
  var points = [];

  targets = targets || [0.1, 0.2];

  if (!bonaFideScores || !attackScores || bonaFideScores.length === 0 || attackScores.length === 0) {
    return {
      points: [],
      details: "Insufficient scores — need both bona fide and attack score arrays",
    };
  }

  // Sort bona fide ascending: quantile gives the BPCER target threshold
  sorted = bonaFideScores.slice().sort(function (a, b) { return a - b; });

  for (i = 0; i < targets.length; i++) {
    // Threshold such that `target` fraction of genuine fall below it
    idx = Math.min(sorted.length - 1, Math.floor(targets[i] * sorted.length));
    threshold = sorted[idx];

    // APCER: fraction of attacks scoring >= threshold (classified as live)
    attacksPassed = 0;
    for (var a = 0; a < attackScores.length; a++) {
      if (attackScores[a] >= threshold) attacksPassed++;
    }
    apcer = attackScores.length > 0 ? attacksPassed / attackScores.length : 0;

    points.push({
      bpcerTarget: targets[i],
      threshold: Math.round(threshold * 10_000) / 10_000,
      apcer: Math.round(apcer * 10_000) / 10_000,
    });
  }

  var summary = points
    .map(function (p) {
      return "APCER@" + (p.bpcerTarget * 100).toFixed(0) + "%BPCER = " + (p.apcer * 100).toFixed(2) + "%";
    })
    .join(", ");

  return { points: points, details: summary };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED LIVENESS ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run all liveness checks and compute a combined score.
 * @param {object} params
 * @param {Array} [params.dilationFrames] - frames for pupil dilation test
 * @param {Float64Array} [params.grayImage] - current grayscale image
 * @param {number} [params.imageWidth]
 * @param {number} [params.imageHeight]
 * @param {{ cx: number, cy: number, radius: number }} [params.pupil]
 * @param {Array} [params.temporalFrames] - frames for temporal consistency
 * @returns {{ score: number, isLive: boolean, checks: object[], details: string }}
 */
IrisLiveness.prototype.assess = function (params) {
  var checks, totalScore, weightSum, i, check, weight;

  checks = [];
  totalScore = 0;
  weightSum = 0;

  // Check 1: Pupil dilation
  if (params.dilationFrames && params.dilationFrames.length >= 2) {
    check = IrisLiveness.pupilDilationTest(params.dilationFrames);
    weight = 0.3;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "pupilDilation", score: check.score, weight: weight, details: check.details });
  }

  // Check 2: Specular reflection
  if (params.grayImage && params.pupil) {
    check = IrisLiveness.specularReflectionTest(
      params.grayImage,
      params.imageWidth,
      params.imageHeight,
      params.pupil,
    );
    weight = 0.25;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "specularReflection", score: check.score, weight: weight, details: check.details });
  }

  // Check 3: Temporal consistency
  if (params.temporalFrames && params.temporalFrames.length >= 3) {
    check = IrisLiveness.temporalConsistencyTest(params.temporalFrames);
    weight = 0.25;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "temporalConsistency", score: check.score, weight: weight, details: check.details });
  }

  // Check 4: Moiré detection
  if (params.grayImage) {
    check = IrisLiveness.moireDetectionTest(
      params.grayImage,
      params.imageWidth,
      params.imageHeight,
    );
    weight = 0.15;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "moireDetection", score: check.score, weight: weight, details: check.details });
  }

  // Check 5: Texture analysis (FIDO PAI Level A)
  if (params.grayImage && params.pupil) {
    check = IrisLiveness.textureAnalysisTest(
      params.grayImage,
      params.imageWidth,
      params.imageHeight,
      params.pupil,
    );
    weight = 0.12;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "textureAnalysis", score: check.score, weight: weight, details: check.details });
  }

  // Check 6: Color channel analysis (FIDO PAI Level A)
  if (params.rgbImage && params.pupil) {
    check = IrisLiveness.colorChannelAnalysisTest(
      params.rgbImage,
      params.imageWidth,
      params.imageHeight,
      params.pupil,
    );
    weight = 0.1;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "colorChannelAnalysis", score: check.score, weight: weight, details: check.details });
  }

  // Check 7: Depth estimation (FIDO PAI Level B)
  if (params.grayImage && params.pupil) {
    check = IrisLiveness.depthEstimationTest(
      params.grayImage,
      params.imageWidth,
      params.imageHeight,
      params.pupil,
    );
    weight = 0.08;
    totalScore += check.score * weight;
    weightSum += weight;
    checks.push({ name: "depthEstimation", score: check.score, weight: weight, details: check.details });
  }

  // Normalize score
  var finalScore = weightSum > 0 ? totalScore / weightSum : 0.5;
  var isLive = finalScore >= IRIS_LIVENESS_CONFIG.livenessScoreThreshold;

  // Classify PAI species per FIDO Biometrics v4.0
  var paiClassification = IrisLiveness.classifyPAISpecies({ checks: checks });

  // Generate summary
  var failedChecks = [];
  for (i = 0; i < checks.length; i++) {
    if (checks[i].score < 0.5) {
      failedChecks.push(checks[i].name);
    }
  }

  var details;
  if (isLive) {
    details = "Liveness check PASSED (score: " + finalScore.toFixed(3) + ")";
  } else if (failedChecks.length > 0) {
    details = "Liveness check FAILED — suspicious: " + failedChecks.join(", ");
  } else {
    details = "Liveness check INCONCLUSIVE (score: " + finalScore.toFixed(3) + ")";
  }

  return {
    score: finalScore,
    isLive: isLive,
    checks: checks,
    paiClassification: paiClassification,
    details: details,
  };
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  window.IrisLiveness = IrisLiveness;
  window.IRIS_LIVENESS_CONFIG = IRIS_LIVENESS_CONFIG;
}
