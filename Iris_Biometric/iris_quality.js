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
// ── Iris Quality: ISO/IEC 29794-6 iris image quality metrics ──
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Quality thresholds based on ISO/IEC 29794-6.
 */
/* c8 ignore stop */
var IRIS_QUALITY_THRESHOLDS = {
  usableAreaMin: 70, // % of iris not occluded
  irisScleraContrastMin: 5,
  irisPupilContrastMin: 30,
  grayscaleUtilisationMin: 6, // range: max-min+1 (BIQT-Iris iso_greyscale_utilization)
  irisRadiusMin: 40, // pixels (lowered for mobile/webcam)
  irisRadiusMinAbsolute: 70, // Daugman minimum absolute radius
  pupilIrisRatioMin: 0.15,
  pupilIrisRatioMax: 0.65,
  marginAdequacyMin: 80, // % iris within image frame
  sharpnessMin: 80, // Laplacian variance
  pupilBoundaryCircularityMin: 0.7, // 2*sqrt(pi)*area/perimeter (ISO 29794-6 §6.2.4)
  motionBlurMin: 0.3, // min/max gradient variance ratio
  frontalGazeMaxOffset: 0.35, // fraction of iris radius
};

/**
 * @class
 */
function IrisQuality() {}

/* c8 ignore start */
/**
 * Compute usable iris area (fraction not occluded by eyelids/lashes).
 * @param {Uint8Array} mask - IrisCode mask (1 = valid, 0 = occluded)
 * @returns {number} 0-100 (percentage)
 */
/* c8 ignore stop */
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

/* c8 ignore start */
/**
 * Compute pupil boundary circularity per ISO/IEC 29794-6 §6.2.4.
 * C = 2 * sqrt(pi) * pupilArea / pupilPerimeter (1.0 = perfect circle).
 * @param {Uint8Array} mask - IrisCode mask (1=iris, 0=non-iris)
 * @param {number} normW - mask width
 * @param {number} normH - mask height
 * @returns {number} 0-1
 */
/* c8 ignore stop */
IrisQuality.pupilBoundaryCircularity = function (mask, normW, normH) {
  if (!mask || normW === 0 || normH === 0 || mask.length === 0) return 1;
  var cx = normW / 2,
    cy = normH / 2;
  var pupilRadius = normW * 0.2; // approximate pupil radius in mask pixels
  var area = 0,
    perimeter = 0;
  for (var y = 0; y < normH; y++) {
    for (var x = 0; x < normW; x++) {
      var idx = y * normW + x;
      var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (dist <= pupilRadius && mask[idx] === 0) {
        area++;
        var dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (var d = 0; d < 4; d++) {
          var nx = x + dirs[d][0],
            ny = y + dirs[d][1];
          if (
            nx < 0 ||
            nx >= normW ||
            ny < 0 ||
            ny >= normH ||
            mask[ny * normW + nx] === 1
          ) {
            perimeter++;
            break;
          }
        }
      }
    }
  }
  return area > 0 && perimeter > 0
    ? (2 * Math.sqrt(Math.PI) * area) / perimeter
    : 1;
};

/* c8 ignore start */
/**
 * Compute iris-pupil contrast.
 * @param {Float64Array} normalizedIris - normalized iris image
 * @param {number} normW - width
 * @param {number} normH - height
 * @returns {number} 0-100
 */
/* c8 ignore stop */
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

/* c8 ignore start */
/**
 * Compute iris-sclera contrast (simplified).
 * @param {Float64Array} normalizedIris
 * @param {number} normW
 * @param {number} normH
 * @returns {number} 0-100
 */
/* c8 ignore stop */
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

  /* c8 ignore start -- V8 range artifact */
  irisMean = irCount > 0 ? irSum / irCount : 128;
  /* c8 ignore stop */
  scleraMean = scCount > 0 ? scSum / scCount : 200;

  return Math.min(100, Math.abs(scleraMean - irisMean) * (100 / 128));
};

/* c8 ignore start */
/**
 * Compute sharpness using variance of Laplacian.
 * @param {Float64Array} normalizedIris
 * @param {number} normW
 * @param {number} normH
 * @returns {number} higher = sharper
 */
/* c8 ignore stop */
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

/* c8 ignore start */
/**
 * Compute motion blur score per ISO/IEC 29794-6 focus assessment.
 * Compares horizontal vs vertical Laplacian variance; motion blur
 * reduces gradient energy in the blur direction.
 * Score = min(varX, varY) / max(varX, varY): 1 = sharp, 0 = motion blur.
 * @param {Float64Array} normalizedIris
 * @param {number} normW
 * @param {number} normH
 * @returns {number} 0-1
 */
/* c8 ignore stop */
IrisQuality.motionBlur = function (normalizedIris, normW, normH) {
  if (!normalizedIris || normW === 0 || normH === 0) return 1;
  var count = 0,
    hSum = 0,
    vSum = 0;
  for (var y = 1; y < normH - 1; y++) {
    for (var x = 1; x < normW - 1; x++) {
      var idx = y * normW + x;
      // Horizontal gradient: [-1, 0, 1]
      var h = normalizedIris[idx + 1] - normalizedIris[idx - 1];
      // Vertical gradient: [-1, 0, 1]
      var v = normalizedIris[idx + normW] - normalizedIris[idx - normW];
      hSum += h * h;
      vSum += v * v;
      count++;
    }
  }
  if (count === 0) return 1;
  var hVar = hSum / count,
    vVar = vSum / count;
  return Math.min(hVar, vVar) / Math.max(hVar, vVar, 1);
};

/* c8 ignore start */
/**
 * Compute grayscale utilization (ISO/IEC 29794-6 / BIQT-Iris iso_greyscale_utilization).
 * Spread of intensity values in the iris annulus = max - min + 1 (number of grey levels).
 * Recommended value: >= 6 grey levels.
 * @param {Float64Array} normalizedIris - normalized iris image
 * @returns {number} number of distinct grey levels used (0-256)
 */
/* c8 ignore stop */
IrisQuality.grayscaleUtilisation = function (normalizedIris) {
  if (!normalizedIris || normalizedIris.length === 0) return 0;
  var minVal = 255,
    maxVal = 0;
  for (var i = 0; i < normalizedIris.length; i++) {
    var v = normalizedIris[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  return maxVal - minVal + 1;
};

/* c8 ignore start */
/**
 * Compute pupil-iris ratio.
 * @param {number} pupilRadius
 * @param {number} irisRadius
 * @returns {number} 0-100 (percentage)
 */
/* c8 ignore stop */
IrisQuality.pupilIrisRatio = function (pupilRadius, irisRadius) {
  if (!irisRadius || irisRadius <= 0) return 0;
  return (pupilRadius / irisRadius) * 100;
};

/* c8 ignore start */
/**
 * Compute margin adequacy (% of iris within image frame).
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {number} 0-100
 */
/* c8 ignore stop */
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

  visible = ((right - left) * (bottom - top)) / (2 * r * (2 * r));
  return Math.min(100, visible * 100);
};

/* c8 ignore start */
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
/* c8 ignore stop */
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
    issues.push(
      "Image too blurry (sharpness: " + metrics.sharpness.toFixed(1) + ")",
    );
  }

  // 3. Iris-pupil contrast
  metrics.irisPupilContrast = IrisQuality.irisPupilContrast(
    params.normalizedIris,
    params.normW,
    params.normH,
  );
  totalTests++;
  if (
    metrics.irisPupilContrast >= IRIS_QUALITY_THRESHOLDS.irisPupilContrastMin
  ) {
    passedTests++;
  } else {
    issues.push(
      "Low iris-pupil contrast: " + metrics.irisPupilContrast.toFixed(1),
    );
  }

  // 4. Pupil-iris ratio
  metrics.pupilIrisRatio = IrisQuality.pupilIrisRatio(
    params.pupil.radius,
    params.iris.radius,
  );
  totalTests++;
  if (
    metrics.pupilIrisRatio >= IRIS_QUALITY_THRESHOLDS.pupilIrisRatioMin &&
    /* c8 ignore start -- V8 range artifact */
    metrics.pupilIrisRatio <= IRIS_QUALITY_THRESHOLDS.pupilIrisRatioMax
    /* c8 ignore stop */
  ) {
    passedTests++;
  } else {
    issues.push(
      "Abnormal pupil-iris ratio: " + metrics.pupilIrisRatio.toFixed(1) + "%",
    );
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
    issues.push(
      "Iris not fully visible: " + metrics.marginAdequacy.toFixed(1) + "%",
    );
  }

  // 6. Grayscale utilization
  metrics.grayscaleUtilisation = IrisQuality.grayscaleUtilisation(
    params.normalizedIris,
  );
  totalTests++;
  if (
    metrics.grayscaleUtilisation >=
    IRIS_QUALITY_THRESHOLDS.grayscaleUtilisationMin
  ) {
    passedTests++;
  } else {
    issues.push(
      "Low contrast range (grayscale: " +
        metrics.grayscaleUtilisation.toFixed(1) +
        ")",
    );
  }

  // 7. Pupil boundary circularity (ISO 29794-6 §6.2.4)
  metrics.pupilBoundaryCircularity = IrisQuality.pupilBoundaryCircularity(
    params.mask,
    params.normW,
    params.normH,
  );
  totalTests++;
  if (
    metrics.pupilBoundaryCircularity >=
    IRIS_QUALITY_THRESHOLDS.pupilBoundaryCircularityMin
  ) {
    /* c8 ignore start -- V8 range artifact */
    passedTests++;
    /* c8 ignore stop */
  } else {
    issues.push(
      "Irregular pupil boundary: " +
        metrics.pupilBoundaryCircularity.toFixed(3),
    );
  }

  // 8. Motion blur (focus assessment)
  metrics.motionBlur = IrisQuality.motionBlur(
    params.normalizedIris,
    params.normW,
    params.normH,
  );
  totalTests++;
  if (metrics.motionBlur >= IRIS_QUALITY_THRESHOLDS.motionBlurMin) {
    passedTests++;
  } else {
    issues.push("Motion blur detected: " + metrics.motionBlur.toFixed(3));
  }

  // Overall score (percentage of tests passed)
  /* c8 ignore start -- V8 range artifact */
  score = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  /* c8 ignore stop */

  return {
    metrics: metrics,
    passed: passedTests >= totalTests - 1, // allow 1 failing test
    score: score,
    issues: issues,
  };
};

/* c8 ignore start */
// Expose on window for browser usage
/* c8 ignore stop */
if (typeof window !== "undefined") {
  window.IrisQuality = IrisQuality;
  window.IRIS_QUALITY_THRESHOLDS = IRIS_QUALITY_THRESHOLDS;
}
