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
// ── Iris Quality: ISO/IEC 29794-6 iris image quality metrics ──

/**
 * Quality thresholds based on ISO/IEC 29794-6.
 */
var IRIS_QUALITY_THRESHOLDS = {
  usableAreaMin: 70, // % of iris not occluded
  irisScleraContrastMin: 5,
  irisPupilContrastMin: 30,
  grayscaleUtilisationMin: 6,
  irisRadiusMin: 40, // pixels (lowered for mobile/webcam)
  pupilIrisRatioMin: 0.15,
  pupilIrisRatioMax: 0.65,
  marginAdequacyMin: 80, // % iris within image frame
  sharpnessMin: 80, // Laplacian variance
  frontalGazeMaxOffset: 0.35, // fraction of iris radius
};

/**
 * @class
 */
function IrisQuality() {}

/**
 * Compute usable iris area (fraction not occluded by eyelids/lashes).
 * @param {Uint8Array} mask - IrisCode mask (1 = valid, 0 = occluded)
 * @returns {number} 0-100 (percentage)
 */
IrisQuality.usableArea = function (mask) {
  var total, valid, i;
  if (!mask || mask.length === 0) return 0;
  total = mask.length;
  valid = 0;
  for (i = 0; i < total; i++) {
    if (mask[i] === 1) valid++;
  }
  return (valid / total) * 100;
};

/**
 * Compute iris-pupil contrast.
 * @param {Float64Array} normalizedIris - normalized iris image
 * @param {number} normW - width
 * @param {number} normH - height
 * @returns {number} 0-100
 */
IrisQuality.irisPupilContrast = function (normalizedIris, normW, normH) {
  var pupilMean, irisMean, i, pSum, iSum, pCount, iCount, pRow, iRow;

  if (!normalizedIris) return 0;

  // Pupil region: inner 20% of radial dimension (rows 0-5)
  // Iris region: middle 40-80% (rows normH*0.4 to normH*0.8)
  pSum = 0;
  pCount = 0;
  iSum = 0;
  iCount = 0;

  for (i = 0; i < normW * normH; i++) {
    pRow = Math.floor(i / normW);
    if (pRow < normH * 0.2) {
      pSum += normalizedIris[i];
      pCount++;
    } else if (pRow >= normH * 0.4 && pRow < normH * 0.8) {
      iSum += normalizedIris[i];
      iCount++;
    }
  }

  pupilMean = pCount > 0 ? pSum / pCount : 128;
  irisMean = iCount > 0 ? iSum / iCount : 128;

  // Contrast as absolute difference, scaled to 0-100
  return Math.min(100, Math.abs(irisMean - pupilMean) * (100 / 128));
};

/**
 * Compute iris-sclera contrast (simplified).
 * @param {Float64Array} normalizedIris
 * @param {number} normW
 * @param {number} normH
 * @returns {number} 0-100
 */
IrisQuality.irisScleraContrast = function (normalizedIris, normW, normH) {
  var irisMean, scleraMean, i, irSum, irCount, scSum, scCount, row;

  if (!normalizedIris) return 0;

  irSum = 0;
  irCount = 0;
  scSum = 0;
  scCount = 0;

  for (i = 0; i < normW * normH; i++) {
    row = Math.floor(i / normW);
    if (row >= normH * 0.3 && row < normH * 0.7) {
      irSum += normalizedIris[i];
      irCount++;
    } else if (row >= normH * 0.85) {
      scSum += normalizedIris[i];
      scCount++;
    }
  }

  irisMean = irCount > 0 ? irSum / irCount : 128;
  scleraMean = scCount > 0 ? scSum / scCount : 200;

  return Math.min(100, Math.abs(scleraMean - irisMean) * (100 / 128));
};

/**
 * Compute sharpness using variance of Laplacian.
 * @param {Float64Array} normalizedIris
 * @param {number} normW
 * @param {number} normH
 * @returns {number} higher = sharper
 */
IrisQuality.sharpness = function (normalizedIris, normW, normH) {
  var lapSum, lapSqSum, count, x, y, idx, lap, a, b, c, d;

  if (!normalizedIris) return 0;

  lapSum = 0;
  lapSqSum = 0;
  count = 0;

  for (y = 1; y < normH - 1; y++) {
    for (x = 1; x < normW - 1; x++) {
      idx = y * normW + x;
      // Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
      a = normalizedIris[idx - 1]; // left
      b = normalizedIris[idx + 1]; // right
      c = normalizedIris[idx - normW]; // up
      d = normalizedIris[idx + normW]; // down
      lap = a + b + c + d - 4 * normalizedIris[idx];
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  var mean = lapSum / count;
  return lapSqSum / count - mean * mean; // variance of Laplacian
};

/**
 * Compute grayscale utilization (dynamic range).
 * @param {Float64Array} normalizedIris
 * @returns {number} 0-255 (standard deviation)
 */
IrisQuality.grayscaleUtilisation = function (normalizedIris) {
  var sum, sumSq, i, len, mean, variance;

  if (!normalizedIris) return 0;
  len = normalizedIris.length;
  sum = 0;
  sumSq = 0;

  for (i = 0; i < len; i++) {
    sum += normalizedIris[i];
    sumSq += normalizedIris[i] * normalizedIris[i];
  }

  mean = sum / len;
  variance = sumSq / len - mean * mean;
  return Math.sqrt(Math.max(0, variance));
};

/**
 * Compute pupil-iris ratio.
 * @param {number} pupilRadius
 * @param {number} irisRadius
 * @returns {number} 0-100 (percentage)
 */
IrisQuality.pupilIrisRatio = function (pupilRadius, irisRadius) {
  if (!irisRadius || irisRadius <= 0) return 0;
  return (pupilRadius / irisRadius) * 100;
};

/**
 * Compute margin adequacy (% of iris within image frame).
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {number} 0-100
 */
IrisQuality.marginAdequacy = function (iris, imageWidth, imageHeight) {
  if (!iris) return 0;
  var cx, cy, r, left, right, top, bottom, visible;

  cx = iris.cx;
  cy = iris.cy;
  r = iris.radius;

  left = Math.max(0, cx - r);
  right = Math.min(imageWidth, cx + r);
  top = Math.max(0, cy - r);
  bottom = Math.min(imageHeight, cy + r);

  visible = ((right - left) * (bottom - top)) / ((2 * r) * (2 * r));
  return Math.min(100, visible * 100);
};

/**
 * Full quality assessment.
 * @param {object} params
 * @param {Float64Array} params.normalizedIris
 * @param {number} params.normW
 * @param {number} params.normH
 * @param {Uint8Array} params.mask
 * @param {{ cx: number, cy: number, radius: number }} params.pupil
 * @param {{ cx: number, cy: number, radius: number }} params.iris
 * @param {number} params.imageWidth
 * @param {number} params.imageHeight
 * @returns {{ metrics: object, passed: boolean, score: number, issues: string[] }}
 */
IrisQuality.assess = function (params) {
  var metrics, issues, score, totalTests, passedTests, key;

  metrics = {};
  issues = [];
  score = 0;
  totalTests = 0;
  passedTests = 0;

  // 1. Usable area
  metrics.usableArea = IrisQuality.usableArea(params.mask);
  totalTests++;
  if (metrics.usableArea >= IRIS_QUALITY_THRESHOLDS.usableAreaMin) {
    passedTests++;
  } else {
    issues.push("Low usable iris area: " + metrics.usableArea.toFixed(1) + "%");
  }

  // 2. Sharpness
  metrics.sharpness = IrisQuality.sharpness(
    params.normalizedIris,
    params.normW,
    params.normH,
  );
  totalTests++;
  if (metrics.sharpness >= IRIS_QUALITY_THRESHOLDS.sharpnessMin) {
    passedTests++;
  } else {
    issues.push("Image too blurry (sharpness: " + metrics.sharpness.toFixed(1) + ")");
  }

  // 3. Iris-pupil contrast
  metrics.irisPupilContrast = IrisQuality.irisPupilContrast(
    params.normalizedIris,
    params.normW,
    params.normH,
  );
  totalTests++;
  if (metrics.irisPupilContrast >= IRIS_QUALITY_THRESHOLDS.irisPupilContrastMin) {
    passedTests++;
  } else {
    issues.push("Low iris-pupil contrast: " + metrics.irisPupilContrast.toFixed(1));
  }

  // 4. Pupil-iris ratio
  metrics.pupilIrisRatio = IrisQuality.pupilIrisRatio(
    params.pupil.radius,
    params.iris.radius,
  );
  totalTests++;
  if (
    metrics.pupilIrisRatio >= IRIS_QUALITY_THRESHOLDS.pupilIrisRatioMin &&
    metrics.pupilIrisRatio <= IRIS_QUALITY_THRESHOLDS.pupilIrisRatioMax
  ) {
    passedTests++;
  } else {
    issues.push("Abnormal pupil-iris ratio: " + metrics.pupilIrisRatio.toFixed(1) + "%");
  }

  // 5. Margin adequacy
  metrics.marginAdequacy = IrisQuality.marginAdequacy(
    params.iris,
    params.imageWidth,
    params.imageHeight,
  );
  totalTests++;
  if (metrics.marginAdequacy >= IRIS_QUALITY_THRESHOLDS.marginAdequacyMin) {
    passedTests++;
  } else {
    issues.push("Iris not fully visible: " + metrics.marginAdequacy.toFixed(1) + "%");
  }

  // 6. Grayscale utilization
  metrics.grayscaleUtilisation = IrisQuality.grayscaleUtilisation(
    params.normalizedIris,
  );
  totalTests++;
  if (metrics.grayscaleUtilisation >= IRIS_QUALITY_THRESHOLDS.grayscaleUtilisationMin) {
    passedTests++;
  } else {
    issues.push("Low contrast range (grayscale: " + metrics.grayscaleUtilisation.toFixed(1) + ")");
  }

  // Overall score (percentage of tests passed)
  score = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  return {
    metrics: metrics,
    passed: passedTests >= totalTests - 1, // allow 1 failing test
    score: score,
    issues: issues,
  };
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  window.IrisQuality = IrisQuality;
  window.IRIS_QUALITY_THRESHOLDS = IRIS_QUALITY_THRESHOLDS;
}
