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
// ── Iris Quality Full: ISO/IEC 29794-6 iris image quality metrics ──
/* c8 ignore stop */

/**
 * ISO/IEC 29794-6:2015 Iris Image Quality Standard
 * Defines and quantifies iris image quality components for:
 * - Single image assessment
 * - Two images being compared
 * - Acquisition device evaluation
 * @class
 */
function IrisQualityFull() {}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY METRICS (ISO/IEC 29794-6 Section 6)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quality metric definitions per ISO/IEC 29794-6.
 */
IrisQualityFull.METRICS = {
  // 1. Focus quality (sharpness)
  FOCUS: {
    id: 1,
    name: "Focus Quality",
    description: "Sharpness of the iris image",
    unit: "pixels",
    range: [0, 100],
    threshold: 80,
  },
  // 2. Iris diameter
  DIAMETER: {
    id: 2,
    name: "Iris Diameter",
    description: "Diameter of the iris in pixels",
    unit: "pixels",
    range: [150, 500],
    threshold: 150,
  },
  // 3. Usable iris area
  USABLE_AREA: {
    id: 3,
    name: "Usable Iris Area",
    description: "Percentage of iris not occluded",
    unit: "%",
    range: [0, 100],
    threshold: 70,
  },
  // 4. Iris-pupil contrast
  IRIS_PUPIL_CONTRAST: {
    id: 4,
    name: "Iris-Pupil Contrast",
    description: "Contrast between iris and pupil regions",
    unit: "dB",
    range: [0, 100],
    threshold: 30,
  },
  // 5. Iris-sclera contrast
  IRIS_SCLERA_CONTRAST: {
    id: 5,
    name: "Iris-Sclera Contrast",
    description: "Contrast between iris and sclera",
    unit: "dB",
    range: [0, 100],
    threshold: 5,
  },
  // 6. Pupil-iris ratio
  PUPIL_IRIS_RATIO: {
    id: 6,
    name: "Pupil-Iris Ratio",
    description: "Ratio of pupil diameter to iris diameter",
    unit: "ratio",
    range: [0, 1],
    threshold: 0.65,
  },
  // 7. Gaze angle
  GAZE_ANGLE: {
    id: 7,
    name: "Gaze Angle",
    description: "Deviation from frontal gaze",
    unit: "degrees",
    range: [0, 30],
    threshold: 10,
  },
  // 8. Margin adequacy
  MARGIN_ADEQUACY: {
    id: 8,
    name: "Margin Adequacy",
    description: "Iris position within image frame",
    unit: "%",
    range: [0, 100],
    threshold: 80,
  },
  // 9. Grayscale utilization
  GRAYSCALE_UTILIZATION: {
    id: 9,
    name: "Grayscale Utilization",
    description: "Dynamic range of grayscale values",
    unit: "levels",
    range: [0, 256],
    threshold: 128,
  },
  // 10. Eyelid occlusion
  EYELID_OCCLUSION: {
    id: 10,
    name: "Eyelid Occlusion",
    description: "Percentage of iris occluded by eyelids",
    unit: "%",
    range: [0, 100],
    threshold: 30,
  },
  // 11. Eyelash occlusion
  EYELASH_OCCLUSION: {
    id: 11,
    name: "Eyelash Occlusion",
    description: "Percentage of iris occluded by eyelashes",
    unit: "%",
    range: [0, 100],
    threshold: 20,
  },
  // 12. Specular reflection
  SPECULAR_REFLECTION: {
    id: 12,
    name: "Specular Reflection",
    description: "Amount of specular reflection on iris",
    unit: "%",
    range: [0, 100],
    threshold: 15,
  },
  // 13. Motion blur
  MOTION_BLUR: {
    id: 13,
    name: "Motion Blur",
    description: "Blur caused by eye or camera movement",
    unit: "pixels",
    range: [0, 50],
    threshold: 10,
  },
  // 14. Depth of field
  DEPTH_OF_FIELD: {
    id: 14,
    name: "Depth of Field",
    description: "Consistent focus across iris",
    unit: "score",
    range: [0, 100],
    threshold: 70,
  },
  // 15. Eyelid circularity (ISO/IEC 29794-6 Annex B)
  EYELID_CIRCULARITY: {
    id: 15,
    name: "Eyelid Circularity",
    description: "How well eyelid opening approximates circular iris boundary",
    unit: "ratio",
    range: [0, 1],
    threshold: 0.7,
  },
  // 16. Iris-pupil concentricity
  CONCENTRICITY: {
    id: 16,
    name: "Iris-Pupil Concentricity",
    description: "Deviation of pupil center from iris center",
    unit: "ratio",
    range: [0, 1],
    threshold: 0.85,
  },
  // 17. Azimuth gaze (horizontal + vertical components)
  AZIMUTH_GAZE: {
    id: 17,
    name: "Azimuth Gaze",
    description: "Combined horizontal and vertical gaze angle",
    unit: "degrees",
    range: [0, 45],
    threshold: 15,
  },
  // 19. Pupil boundary circularity (ISO/IEC 29794-6 §6.2.4)
  PUPIL_BOUNDARY_CIRCULARITY: {
    id: 19,
    name: "Pupil Boundary Circularity",
    description: "2*sqrt(pi)*area/perimeter; 1.0 = perfect circle",
    unit: "ratio",
    range: [0, 1],
    threshold: 0.7,
  },
  // 20. Focus score (motion blur ratio)
  FOCUS_SCORE: {
    id: 20,
    name: "Focus Score",
    description: "min(hVar,vVar)/max(hVar,vVar); 1 = sharp, 0 = motion blur",
    unit: "ratio",
    range: [0, 1],
    threshold: 0.3,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ACQUISITION GATES (empirically validated by Worldcoin open-iris)
// Thresholds calibrated over billions of real-world iris scans.
// Source: github.com/worldcoin/open-iris quality validators.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Empirically validated acquisition gates from Worldcoin open-iris.
 */
IrisQualityFull.ACQUISITION_GATES = {
  pupilIrisRatioMin: 0.1,
  pupilIrisRatioMax: 0.7,
  sharpnessLaplacianVarMin: 461,
  occlusion90DegMax: 0.25,
  occlusion30DegMax: 0.3,
  minMaskSizePx: 4096,
  // ISO/IEC 29794-6 §6 metric 12 + OSAC 2024-N-0004 §3.5: reject images with
  // excessive saturated specular glare inside the iris annulus.
  specularReflectionRatioMax: 0.15,
  // Section-0 mitigation (visible-light capture): reject captures whose iris
  // annulus is too low-texture to encode reliably. Under visible light, darker
  // irides resolve faint texture and the annulus approaches near-flat; silently
  // enrolling such a capture produces a noisy IrisCode. This is a CONSERVATIVE
  // baseline floor — it must be empirically tuned against sample captures (it is
  // intentionally low so it rejects only clearly-unusable captures, not merely
  // darker-than-average irides). See IrisQualityFull.irisTextureContrast.
  irisTextureContrastMin: 10,
  // ISO/IEC 29794-6 §6 metric 9 (margin/position): the iris must be sufficiently
  // inset from the image frame so the full annulus (and pupil) is captured.
  marginAdequacyMin: 40,
  // Daugman minimum absolute iris radius (px); images below this cannot
  // encode a reliable IrisCode regardless of relative size.
  irisRadiusMinAbsolute: 70,
};

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY ASSESSMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute focus quality (sharpness) using variance of Laplacian.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} [roi] - Region of interest {x, y, width, height}
 * @returns {number} 0-100 quality score
 */
/* c8 ignore start -- function definition V8 range artifact */
IrisQualityFull.focusQuality = function (imageData, width, height, roi) {
  /* c8 ignore stop */
  var startX, startY, endX, endY, x, y, idx, laplacian, sum, count, variance;
  var lapSum = 0,
    lapSqSum = 0;

  if (!imageData || width <= 0 || height <= 0) return 0;

  startX = roi ? roi.x : 0;
  startY = roi ? roi.y : 0;
  endX = roi ? Math.min(roi.x + roi.width, width) : width;
  endY = roi ? Math.min(roi.y + roi.height, height) : height;

  for (y = startY + 1; y < endY - 1; y++) {
    for (x = startX + 1; x < endX - 1; x++) {
      idx = y * width + x;
      // Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
      laplacian =
        -4 * imageData[idx] +
        imageData[idx - 1] +
        imageData[idx + 1] +
        imageData[idx - width] +
        imageData[idx + width];

      lapSum += Math.abs(laplacian);
      lapSqSum += laplacian * laplacian;
    }
  }

  count = (endX - startX - 1) * (endY - startY - 1);
  if (count <= 0) return 0;

  variance = lapSqSum / count - Math.pow(lapSum / count, 2);

  // Normalize to 0-100 scale (typical range 0-5000)
  return Math.min(100, Math.max(0, (variance / 50) * 100));
};

/**
 * Compute RAW Laplacian variance (uncapped) over a region.
 * Required for the Worldcoin sharpness gate (>= 461).
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {number} width
 * @param {number} height
 * @param {{x: number, y: number, width: number, height: number}} [roi] -
 *        Region of interest (e.g. iris bounding box). Whole image when omitted.
 * @returns {number} Raw Laplacian variance
 */
/* c8 ignore start -- function definition V8 range artifact */
IrisQualityFull.rawLaplacianVariance = function (
  imageData,
  width,
  height,
  roi,
) {
  /* c8 ignore stop */
  var x, y, idx, lap, lapSum, lapSqSum, count;
  var startX, startY, endX, endY;

  if (!imageData || width <= 2 || height <= 2) return 0;

  startX = Math.max(1, roi ? Math.floor(roi.x) : 1);
  startY = Math.max(1, roi ? Math.floor(roi.y) : 1);
  endX = Math.min(width - 1, roi ? Math.ceil(roi.x + roi.width) : width - 1);
  endY = Math.min(height - 1, roi ? Math.ceil(roi.y + roi.height) : height - 1);

  lapSum = 0;
  lapSqSum = 0;
  count = 0;

  for (y = startY; y < endY; y++) {
    for (x = startX; x < endX; x++) {
      idx = y * width + x;
      lap =
        -4 * imageData[idx] +
        imageData[idx - 1] +
        imageData[idx + 1] +
        imageData[idx - width] +
        imageData[idx + width];
      lapSum += Math.abs(lap);
      lapSqSum += lap * lap;
      count++;
    }
  }

  return count > 0 ? lapSqSum / count - Math.pow(lapSum / count, 2) : 0;
};

/* c8 ignore start */
/**
 * Compute Visible Iris Area (VIA).
 * Strongest single quality predictor of match reliability
 * (r = 0.774 correlation with Hamming Distance; WVU 2025 study,
 * arXiv:2510.19884). Can be computed immediately after segmentation,
 * before encoding or matching.
 * @param {Uint8Array} mask - Iris mask (1=valid, 0=occluded)
 * @param {number} width
 * @param {number} height
 * @param {{x: number, y: number, radius: number}} iris - Iris center/radius
 * @returns {{ viaPx: number, viaRatio: number, passedGate: boolean }}
 */
/* c8 ignore stop */
IrisQualityFull.visibleIrisArea = function (mask, width, height, iris) {
  var x, y, dx, dy, dist, idx, viaPx, ringPx, gates;

  gates = IrisQualityFull.ACQUISITION_GATES;
  viaPx = 0;
  ringPx = 0;

  if (!mask || !iris || !iris.radius) {
    return { viaPx: 0, viaRatio: 0, passedGate: false };
  }

  for (y = 0; y < height; y++) {
    dy = y - iris.y;
    for (x = 0; x < width; x++) {
      dx = x - iris.x;
      dist = Math.hypot(dx, dy);
      // Count only the texture ring (exclude pupil and outer boundary)
      if (dist >= iris.radius * 0.3 && dist <= iris.radius) {
        ringPx++;
        idx = y * width + x;
        if (idx < mask.length && mask[idx] === 1) {
          viaPx++;
        }
      }
    }
  }

  return {
    viaPx: viaPx,
    viaRatio: ringPx > 0 ? viaPx / ringPx : 0,
    passedGate: viaPx >= gates.minMaskSizePx,
  };
};

/**
 * Compute angular occlusion per sector.
 * Worldcoin validates occlusion at fixed angular segments:
 * 90-degree sectors must be <= 25% occluded, 30-degree <= 30%.
 * @param {Uint8Array} mask - Iris mask (1=valid)
 * @param {number} width
 * @param {number} height
 * @param {{x: number, y: number, radius: number}} iris
 * @returns {{ maxOcclusion90: number, maxOcclusion30: number, sectors30: number[] }}
 */
IrisQualityFull.angularOcclusion = function (mask, width, height, iris) {
  var x, y, dx, dy, dist, idx, angle, bin;
  var total30 = Array(12).fill(0);
  var invalid30 = Array(12).fill(0);
  var i, occ90, max90, max30, sectors;

  if (!mask || !iris || !iris.radius) {
    return { maxOcclusion90: 1, maxOcclusion30: 1, sectors30: [] };
  }

  for (y = 0; y < height; y++) {
    dy = y - iris.y;
    for (x = 0; x < width; x++) {
      dx = x - iris.x;
      dist = Math.hypot(dx, dy);
      if (dist >= iris.radius * 0.3 && dist <= iris.radius * 0.95) {
        angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;
        bin = Math.min(11, Math.floor(angle / (Math.PI / 6)));
        total30[bin]++;
        idx = y * width + x;
        if (idx >= mask.length || mask[idx] !== 1) {
          invalid30[bin]++;
        }
      }
    }
  }

  sectors30 = [];
  for (i = 0; i < 12; i++) {
    sectors30.push(total30[i] > 0 ? invalid30[i] / total30[i] : 0);
  }

  // Fixed quadrants (90 degrees each = 3 consecutive 30-degree bins)
  max90 = 0;
  for (var q = 0; q < 4; q++) {
    var invQ = invalid30[q * 3] + invalid30[q * 3 + 1] + invalid30[q * 3 + 2];
    var totQ = total30[q * 3] + total30[q * 3 + 1] + total30[q * 3 + 2];
    occ90 = totQ > 0 ? invQ / totQ : 0;
    if (occ90 > max90) max90 = occ90;
  }

  max30 = Math.max.apply(null, sectors30.concat([0]));

  return { maxOcclusion90: max90, maxOcclusion30: max30, sectors30: sectors30 };
};

/* c8 ignore start */
/**
 * Evaluate all Worldcoin acquisition gates at once.
 * Call right after segmentation — before encoding/matching.
 * @param {object} params
 * @param {Uint8ClampedArray|Uint8Array} params.imageData - Grayscale image
 * @param {number} params.width
 * @param {number} params.height
 * @param {Uint8Array} [params.mask]
 * @param {{x: number, y: number, radius: number}} params.pupil
 * @param {{x: number, y: number, radius: number}} params.iris
 * @returns {{ passed: boolean, failures: string[], metrics: object }}
 */
/* c8 ignore stop */
IrisQualityFull.evaluateAcquisitionGates = function (params) {
  var g, failures, lapVar, pir, via, ang, metrics;

  g = IrisQualityFull.ACQUISITION_GATES;
  failures = [];

  if (!params || !params.iris || !params.pupil || !params.imageData) {
    return { passed: false, failures: ["missing-parameters"], metrics: {} };
  }

  lapVar = IrisQualityFull.rawLaplacianVariance(
    params.imageData,
    params.width,
    params.height,
    params.roi,
  );
  pir = params.iris.radius > 0 ? params.pupil.radius / params.iris.radius : 0;
  via = params.mask
    ? IrisQualityFull.visibleIrisArea(
        params.mask,
        params.width,
        params.height,
        params.iris,
      )
    : { viaPx: 0, passedGate: false };
  ang = params.mask
    ? IrisQualityFull.angularOcclusion(
        params.mask,
        params.width,
        params.height,
        params.iris,
      )
    : { maxOcclusion90: 1, maxOcclusion30: 1 };

  var spec = IrisQualityFull.specularReflection(
    params.imageData,
    params.width,
    params.height,
    params.pupil,
    params.iris,
  );

  if (lapVar < g.sharpnessLaplacianVarMin) {
    failures.push(
      "sharpness(lapVar=" +
        Math.round(lapVar) +
        "<" +
        g.sharpnessLaplacianVarMin +
        ")",
    );
  }
  if (pir < g.pupilIrisRatioMin || pir > g.pupilIrisRatioMax) {
    failures.push(
      "pupilIrisRatio(" +
        pir.toFixed(3) +
        " outside " +
        g.pupilIrisRatioMin +
        "-" +
        g.pupilIrisRatioMax +
        ")",
    );
  }
  if (!via.passedGate) {
    failures.push("visibleIrisArea(" + via.viaPx + "<" + g.minMaskSizePx + ")");
  }
  if (ang.maxOcclusion90 > g.occlusion90DegMax) {
    failures.push(
      "occlusion90(" +
        (ang.maxOcclusion90 * 100).toFixed(1) +
        "%>" +
        g.occlusion90DegMax * 100 +
        "%)",
    );
  }
  if (ang.maxOcclusion30 > g.occlusion30DegMax) {
    failures.push(
      "occlusion30(" +
        (ang.maxOcclusion30 * 100).toFixed(1) +
        "%>" +
        g.occlusion30DegMax * 100 +
        "%)",
    );
  }
  if (spec.ratio > g.specularReflectionRatioMax) {
    failures.push(
      "specularReflection(" +
        (spec.ratio * 100).toFixed(1) +
        "%>" +
        g.specularReflectionRatioMax * 100 +
        "%)",
    );
  }

  // Section-0 mitigation: reject captures too low-texture to encode (dark-iris /
  // poor-lighting failure mode under visible light). Conservative floor.
  var tex = IrisQualityFull.irisTextureContrast(
    params.imageData,
    params.width,
    params.height,
    params.iris,
  );
  if (tex < g.irisTextureContrastMin) {
    failures.push(
      "irisTextureContrast(std=" +
        tex.toFixed(1) +
        "<" +
        g.irisTextureContrastMin +
        ")",
    );
  }

  var margin = IrisQualityFull.marginAdequacy(
    params.iris,
    params.iris.radius,
    params.width,
    params.height,
  );
  if (margin < g.marginAdequacyMin) {
    failures.push(
      "marginAdequacy(" + Math.round(margin) + "<" + g.marginAdequacyMin + ")",
    );
  }

  // Daugman minimum absolute iris radius
  if (params.iris.radius < g.irisRadiusMinAbsolute) {
    failures.push(
      "irisRadiusAbsolute(" +
        Math.round(params.iris.radius) +
        "<" +
        g.irisRadiusMinAbsolute +
        ")",
    );
  }

  metrics = {
    laplacianVariance: Math.round(lapVar),
    pupilIrisRatio: Math.round(pir * 1000) / 1000,
    visibleIrisAreaPx: via.viaPx,
    visibleIrisAreaRatio: Math.round(via.viaRatio * 1000) / 1000,
    maxOcclusion90Deg: Math.round(ang.maxOcclusion90 * 1000) / 1000,
    maxOcclusion30Deg: Math.round(ang.maxOcclusion30 * 1000) / 1000,
    specularReflectionRatio: Math.round(spec.ratio * 1000) / 1000,
    specularReflectionPx: spec.saturatedPx,
    irisTextureContrast: Math.round(tex * 10) / 10,
    marginAdequacy: Math.round(margin),
  };

  return {
    passed: failures.length === 0,
    failures: failures,
    metrics: metrics,
  };
};

/**
 * Compute usable iris area percentage.
 * @param {Uint8Array} mask - Iris mask (1=valid, 0=occluded)
 * @returns {number} 0-100 percentage
 */
IrisQualityFull.usableArea = function (mask) {
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
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} pupil - Pupil center and radius {x, y, radius}
 * @param {object} iris - Iris center and radius {x, y, radius}
 * @returns {number} 0-100 contrast score
 */
IrisQualityFull.irisPupilContrast = function (
  imageData,
  width,
  height,
  pupil,
  iris,
) {
  var pupilSum = 0,
    pupilCount = 0,
    irisSum = 0,
    irisCount = 0;
  var x, y, distPupil, distIris, idx;

  if (!imageData || !pupil || !iris) return 0;

  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      idx = y * width + x;

      // Distance from pupil center
      distPupil = Math.sqrt(
        Math.pow(x - pupil.x, 2) + Math.pow(y - pupil.y, 2),
      );

      // Distance from iris center
      distIris = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));

      // Pupil region: within 80% of pupil radius
      if (distPupil <= pupil.radius * 0.8) {
        pupilSum += imageData[idx];
        pupilCount++;
      }

      // Iris region: between 30% and 90% of iris radius, outside pupil
      if (
        distIris >= iris.radius * 0.3 &&
        distIris <= iris.radius * 0.9 &&
        distPupil > pupil.radius
      ) {
        irisSum += imageData[idx];
        irisCount++;
      }
    }
  }

  if (pupilCount === 0 || irisCount === 0) return 0;

  var pupilMean = pupilSum / pupilCount;
  var irisMean = irisSum / irisCount;

  // Contrast as percentage difference
  return Math.min(100, (Math.abs(irisMean - pupilMean) / 255) * 100 * 2);
};

/**
 * Compute iris-sclera contrast.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} iris - Iris center and radius {x, y, radius}
 * @returns {number} 0-100 contrast score
 */
IrisQualityFull.irisScleraContrast = function (imageData, width, height, iris) {
  var irisSum = 0,
    irisCount = 0,
    scleraSum = 0,
    scleraCount = 0;
  var x, y, dist, idx;

  if (!imageData || !iris) return 0;

  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      idx = y * width + x;
      dist = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));

      // Iris region: 40%-90% of radius
      if (dist >= iris.radius * 0.4 && dist <= iris.radius * 0.9) {
        irisSum += imageData[idx];
        irisCount++;
      }

      // Sclera region: outside iris
      if (dist > iris.radius * 1.1 && dist < iris.radius * 1.5) {
        scleraSum += imageData[idx];
        scleraCount++;
      }
    }
  }

  if (irisCount === 0 || scleraCount === 0) return 0;

  var irisMean = irisSum / irisCount;
  var scleraMean = scleraSum / scleraCount;

  return Math.min(100, (Math.abs(irisMean - scleraMean) / 255) * 100 * 2);
};

/**
 * Compute within-iris texture contrast (standard deviation of grayscale values
 * across the iris annulus). This measures how much *usable iris texture* the
 * capture actually resolved — the failure mode the visible-light/webcam path is
 * prone to for darker irides (melanin absorbs visible light, so the crypt
 * texture is faint and the annulus becomes near-flat).
 *
 * NOTE: this is deliberately NOT the iris↔sclera boundary contrast. Boundary
 * contrast is HIGHER for dark eyes (dark iris vs white sclera) and would wrongly
 * penalise light-eyed users; within-iris texture contrast is the metric that
 * drops when an iris is too poorly lit to encode.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data (0-255)
 * @param {number} width
 * @param {number} height
 * @param {object} iris - { x, y, radius }
 * @returns {number} standard deviation of annulus pixels (0-~128)
 */
IrisQualityFull.irisTextureContrast = function (
  imageData,
  width,
  height,
  iris,
) {
  var x,
    y,
    dist,
    idx,
    sum = 0,
    count = 0,
    v;
  if (!imageData || !iris) return 0;

  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      dist = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));
      // Iris texture annulus: 40%-90% of radius
      if (dist >= iris.radius * 0.4 && dist <= iris.radius * 0.9) {
        sum += imageData[y * width + x];
        count++;
      }
    }
  }
  if (count < 2) return 0;

  var mean = sum / count;
  var varSum = 0;
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      dist = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));
      if (dist >= iris.radius * 0.4 && dist <= iris.radius * 0.9) {
        v = imageData[y * width + x] - mean;
        varSum += v * v;
      }
    }
  }
  return Math.sqrt(varSum / count);
};

/**
 * Compute pupil-iris ratio.
 * @param {number} pupilRadius - Pupil radius in pixels
 * @param {number} irisRadius - Iris radius in pixels
 * @returns {number} 0-1 ratio
 */
IrisQualityFull.pupilIrisRatio = function (pupilRadius, irisRadius) {
  if (!irisRadius || irisRadius <= 0) return 0;
  return Math.min(1, pupilRadius / irisRadius);
};

/**
 * Compute gaze angle estimation.
 * @param {object} pupil - Pupil center {x, y}
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @returns {number} 0-30 degrees
 */
IrisQualityFull.gazeAngle = function (pupil, iris, irisRadius) {
  if (!pupil || !iris || !irisRadius) return 0;

  var dx = pupil.x - iris.x;
  var dy = pupil.y - iris.y;
  var offset = Math.hypot(dx, dy);
  var ratio = offset / irisRadius;

  // Convert to degrees (approximate)
  return Math.min(30, ratio * 30);
};

/**
 * Compute margin adequacy.
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @returns {number} 0-100 percentage
 */
/**
 * Heuristically classify the capture illumination from pixel statistics.
 *
 * True NIR vs visible-light discrimination is impossible from an RGB array
 * alone (a grayscale visible image is indistinguishable from an NIR image by
 * channel statistics). We therefore report a *modality* of either "monochrome"
 * (all channels near-equal — consistent with NIR or grayscale capture) or
 * "color" (strong channel separation — visible-light colour capture).
 *
 * ISO/IEC 29794-6 §6 and NIST IREX guidance recommend NIR illumination for
 * robust iris recognition, so a "color" result is surfaced as an advisory.
 * @param {Uint8ClampedArray|Uint8Array} imageData - RGBA pixel data
 * @param {number} width
 * @param {number} height
 * @returns {{ modality: string, colorCapture: boolean, meanChannelDiff: number, confidence: number }}
 */
IrisQualityFull.detectIllumination = function (imageData, width, height) {
  if (!imageData || width <= 0 || height <= 0) {
    return {
      modality: "unknown",
      colorCapture: false,
      meanChannelDiff: 0,
      confidence: 0,
    };
  }

  var n = width * height,
    rg = 0,
    gb = 0,
    rb = 0,
    i,
    p,
    d = imageData,
    count = 0;
  for (i = 0; i < n; i++) {
    p = i * 4;
    rg += Math.abs(d[p] - d[p + 1]);
    gb += Math.abs(d[p + 1] - d[p + 2]);
    rb += Math.abs(d[p] - d[p + 2]);
    count++;
  }
  var meanDiff = (rg + gb + rb) / (3 * count);
  var mono = meanDiff < 8;
  var confidence = mono
    ? Math.max(0, Math.min(1, (8 - meanDiff) / 8))
    : Math.max(0, Math.min(1, (meanDiff - 8) / 40));

  return {
    modality: mono ? "monochrome" : "color",
    colorCapture: !mono,
    meanChannelDiff: Math.round(meanDiff * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
  };
};

IrisQualityFull.marginAdequacy = function (
  iris,
  irisRadius,
  imageWidth,
  imageHeight,
) {
  if (!iris || !irisRadius) return 0;

  var margin = {
    left: iris.x - irisRadius,
    right: imageWidth - (iris.x + irisRadius),
    top: iris.y - irisRadius,
    bottom: imageHeight - (iris.y + irisRadius),
  };

  // All margins should be positive and adequate
  var minMargin = Math.min(
    margin.left,
    margin.right,
    margin.top,
    margin.bottom,
  );
  var requiredMargin = irisRadius * 0.2;

  if (minMargin >= requiredMargin) return 100;
  if (minMargin <= 0) return 0;

  return (minMargin / requiredMargin) * 100;
};

/**
 * Compute grayscale utilization.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {object} [roi] - Region of interest {x, y, width, height}
 * @param width
 * @returns {number} 0-256 levels used
 */
IrisQualityFull.grayscaleUtilization = function (imageData, roi, width) {
  var histogram, minVal, maxVal, i, idx, startX, startY, endX, endY;

  if (!imageData) return 0;

  histogram = new Uint32Array(256);
  startX = roi ? roi.x : 0;
  startY = roi ? roi.y : 0;
  endX = roi
    ? Math.min(roi.x + roi.width, width || imageData.length)
    : width || imageData.length;
  endY = roi ? roi.y + roi.height : 1;

  for (i = 0; i < imageData.length; i++) {
    histogram[imageData[i]]++;
  }

  minVal = 0;
  maxVal = 255;
  while (minVal < 255 && histogram[minVal] === 0) minVal++;
  while (maxVal > 0 && histogram[maxVal] === 0) maxVal--;

  return maxVal - minVal + 1;
};

/* c8 ignore start */
/**
 * Compute motion blur estimation.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} 0-50 blur amount
 */
/* c8 ignore stop */
IrisQualityFull.motionBlur = function (imageData, width, height) {
  var i,
    idx,
    sumX = 0,
    sumY = 0,
    countX = 0,
    countY = 0;
  var horizontalGradient, verticalGradient;

  if (!imageData || width <= 1 || height <= 1) return 0;

  // Estimate blur using gradient variance
  for (i = 1; i < width * height; i++) {
    // Horizontal gradient
    if (i % width !== 0) {
      horizontalGradient = Math.abs(imageData[i] - imageData[i - 1]);
      sumX += horizontalGradient;
      countX++;
    }

    // Vertical gradient
    if (i >= width) {
      verticalGradient = Math.abs(imageData[i] - imageData[i - width]);
      sumY += verticalGradient;
      countY++;
    }
  }

  // Low gradient variance indicates blur
  var meanGradient =
    ((countX > 0 ? sumX / countX : 0) + (countY > 0 ? sumY / countY : 0)) / 2;

  // Invert and scale: high gradient = sharp, low gradient = blurry
  return Math.max(0, Math.min(50, 50 - meanGradient));
};

/**
 * Compute pupil boundary circularity per ISO/IEC 29794-6 §6.2.4.
 * C = 2 * sqrt(pi) * pupilArea / pupilPerimeter (1.0 = perfect circle).
 * @param {Uint8Array} mask - Iris mask (1=iris, 0=non-iris)
 * @param {number} normW - mask width
 * @param {number} normH - mask height
 * @returns {number} 0-1
 */
IrisQualityFull.pupilBoundaryCircularity = function (mask, normW, normH) {
  if (!mask || normW === 0 || normH === 0 || mask.length === 0) return 1;
  var cx = normW / 2,
    cy = normH / 2;
  var pupilRadius = normW * 0.2;
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
 * Compute motion blur focus score per ISO/IEC 29794-6.
 * Compares horizontal vs vertical gradient variance; motion blur
 * reduces gradient energy in the blur direction.
 * Score = min(varX, varY) / max(varX, varY): 1 = sharp, 0 = motion blur.
 * @param {Float64Array|Uint8Array} normalizedIris - normalized iris image
 * @param {number} normW
 * @param {number} normH
 * @returns {number} 0-1
 */
/* c8 ignore stop */
IrisQualityFull.motionBlurFocus = function (normalizedIris, normW, normH) {
  if (!normalizedIris || normW === 0 || normH === 0) return 1;
  var count = 0,
    hSum = 0,
    vSum = 0;
  for (var y = 1; y < normH - 1; y++) {
    for (var x = 1; x < normW - 1; x++) {
      var idx = y * normW + x;
      var h = normalizedIris[idx + 1] - normalizedIris[idx - 1];
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
 * Compute specular reflection ratio within the iris annulus.
 *
 * Specular highlights (corneal glints / over-exposed spots) wash out iris
 * texture and degrade encoding/matching. ISO/IEC 29794-6 §6 (metric 12) and
 * OSAC 2024-N-0004 §3.5 require detecting/penalizing reflected-light spots.
 *
 * We measure the fraction of iris-annulus pixels whose grayscale value is
 * saturated (near-white, ≥ satThreshold). Lower is better; a high ratio means
 * the iris texture is obscured by glare.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image
 * @param {number} width
 * @param {number} height
 * @param {{x:number,y:number,radius:number}} pupil - Pupil center/radius
 * @param {{x:number,y:number,radius:number}} iris - Iris center/radius
 * @param {number} [satThreshold] - Grayscale level counted as saturated
 * @returns {{ ratio: number, saturatedPx: number, irisPx: number }}
 */
/* c8 ignore stop */
IrisQualityFull.specularReflection = function (
  imageData,
  width,
  height,
  pupil,
  iris,
  satThreshold,
) {
  var sat = typeof satThreshold === "number" ? satThreshold : 248;
  var x, y, dx, dy, dist, idx, irisPx, satPx;
  irisPx = 0;
  satPx = 0;

  if (!imageData || !iris || !iris.radius || width <= 0 || height <= 0) {
    return { ratio: 0, saturatedPx: 0, irisPx: 0 };
  }

  var pr = pupil && pupil.radius ? pupil.radius : 0;

  for (y = 0; y < height; y++) {
    dy = y - iris.y;
    for (x = 0; x < width; x++) {
      dx = x - iris.x;
      dist = Math.hypot(dx, dy);
      // Only the textured iris annulus (exclude pupil and outer boundary)
      if (
        dist >= Math.max(pr * 1.05, iris.radius * 0.3) &&
        dist <= iris.radius * 0.95
      ) {
        irisPx++;
        idx = y * width + x;
        if (imageData[idx] >= sat) satPx++;
      }
    }
  }

  return {
    ratio: irisPx > 0 ? satPx / irisPx : 0,
    saturatedPx: satPx,
    irisPx: irisPx,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL METRICS (ISO/IEC 29794-6 Annex B)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute iris-pupil concentricity.
 * Measures how centered the pupil is within the iris.
 * @param {object} pupil - Pupil center {x, y}
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @returns {number} 0-1 ratio (1 = perfectly concentric)
 */
IrisQualityFull.concentricity = function (pupil, iris, irisRadius) {
  if (!pupil || !iris || !irisRadius || irisRadius <= 0) return 0.5;

  var dx = pupil.x - iris.x;
  var dy = pupil.y - iris.y;
  var offset = Math.hypot(dx, dy);
  var ratio = offset / irisRadius;

  // Perfect concentricity = offset 0 → score 1
  /* c8 ignore start */
  // Pupil at iris edge → score 0
  /* c8 ignore stop */
  return Math.max(0, Math.min(1, 1 - ratio));
};

/**
 * Compute eyelid circularity.
 * Estimates how well the eyelid opening matches the circular iris boundary.
 * @param {Uint8Array} mask - Iris mask (1=valid, 0=occluded)
 * @param {number} maskWidth - Mask width
 * @param {number} maskHeight - Mask height
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @returns {number} 0-1 ratio (1 = fully open circular)
 */
IrisQualityFull.eyelidCircularity = function (
  mask,
  maskWidth,
  maskHeight,
  iris,
  irisRadius,
) {
  if (!mask || !iris || !irisRadius) return 0.5;

  var validCount = 0;
  var expectedCount = 0;
  var x, y, dist, idx;

  for (y = 0; y < maskHeight; y++) {
    for (x = 0; x < maskWidth; x++) {
      dist = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));
      // Only check the iris ring (30%-95% of radius)
      if (dist >= irisRadius * 0.3 && dist <= irisRadius * 0.95) {
        expectedCount++;
        idx = y * maskWidth + x;
        if (idx < mask.length && mask[idx] === 1) {
          validCount++;
        }
      }
    }
  }

  return expectedCount > 0 ? validCount / expectedCount : 0.5;
};

/**
 * Compute azimuth gaze (combined horizontal + vertical).
 * @param {object} pupil - Pupil center {x, y}
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @returns {number} 0-45 degrees
 */
IrisQualityFull.azimuthGaze = function (pupil, iris, irisRadius) {
  if (!pupil || !iris || !irisRadius || irisRadius <= 0) return 0;

  var dx = pupil.x - iris.x;
  var dy = pupil.y - iris.y;
  var offset = Math.hypot(dx, dy);
  var ratio = offset / irisRadius;

  // Combined angle in degrees (approximate)
  return Math.min(45, ratio * 45);
};

/**
 * Compute depth of field (focus consistency across iris).
 * Analyzes Laplacian variance at different radii from iris center.
 * @param {Uint8ClampedArray|Uint8Array} imageData - Grayscale image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} iris - Iris center {x, y}
 * @param {number} irisRadius - Iris radius
 * @returns {number} 0-100 depth of field score
 */
IrisQualityFull.depthOfField = function (
  imageData,
  width,
  height,
  iris,
  irisRadius,
) {
  if (!imageData || !iris || !irisRadius) return 50;

  // Sample Laplacian at 3 different rings
  var rings = [
    { inner: 0.4, outer: 0.6 }, // inner ring
    { inner: 0.6, outer: 0.8 }, // middle ring
    { inner: 0.8, outer: 1 }, // outer ring
  ];

  var variances = [];

  for (var r = 0; r < rings.length; r++) {
    var ring = rings[r];
    var lapSum = 0,
      lapSqSum = 0,
      count = 0;

    for (
      var y = Math.max(0, Math.floor(iris.y - irisRadius * ring.outer));
      y < Math.min(height, Math.ceil(iris.y + irisRadius * ring.outer));
      y++
    ) {
      for (
        var x = Math.max(0, Math.floor(iris.x - irisRadius * ring.outer));
        x < Math.min(width, Math.ceil(iris.x + irisRadius * ring.outer));
        x++
      ) {
        var dist = Math.sqrt(Math.pow(x - iris.x, 2) + Math.pow(y - iris.y, 2));
        if (
          dist >= irisRadius * ring.inner &&
          dist <= irisRadius * ring.outer &&
          x > 0 &&
          x < width - 1 &&
          y > 0 &&
          y < height - 1
        ) {
          var idx = y * width + x;
          var lap =
            -4 * imageData[idx] +
            imageData[idx - 1] +
            imageData[idx + 1] +
            imageData[idx - width] +
            imageData[idx + width];
          lapSum += Math.abs(lap);
          lapSqSum += lap * lap;
          count++;
        }
      }
    }

    if (count > 0) {
      var variance = lapSqSum / count - Math.pow(lapSum / count, 2);
      variances.push(variance);
    }
  }

  if (variances.length < 2) return 50;

  // Low variance across rings = consistent focus = good DOF
  var mean = 0;
  for (var i = 0; i < variances.length; i++) mean += variances[i];
  mean /= variances.length;

  var maxDev = 0;
  for (var j = 0; j < variances.length; j++) {
    maxDev = Math.max(maxDev, Math.abs(variances[j] - mean));
  }

  // Normalize: low deviation → high score
  return Math.min(100, Math.max(0, 100 - maxDev / 10));
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */
/* c8 ignore start */
/**
 * Best-effort detection of a near-infrared (NIR) capture device.
 *
 * Browsers expose no explicit "NIR" capability flag, so this is a heuristic
 * per ISO/IEC 29794-6 §6 (NIR illumination preferred): enumerate videoinput
 * devices; treat a device whose label mentions IR/NIR/infrared/depth/ToF as
 * NIR-capable; otherwise report NIR unavailable and recommend the visible
 * fallback WITH a warning (hardware NIR cannot be synthesized client-side).
 * @returns {Promise<{nirAvailable:boolean, reason:string, hasEnvironmentCamera:boolean, fallback:string}>}
 */
/* c8 ignore stop */
IrisQualityFull.detectNirCapability = async function () {
  try {
    var md =
      (typeof navigator !== "undefined" && navigator.mediaDevices) || null;
    if (!md || typeof md.enumerateDevices !== "function") {
      return {
        nirAvailable: false,
        reason: "mediaDevices-unavailable",
        hasEnvironmentCamera: false,
        fallback: "visible",
      };
    }
    var devices = await md.enumerateDevices();
    var cams = devices.filter(function (d) {
      return d.kind === "videoinput";
    });
    var nirLabel = cams.some(function (c) {
      var l = (c.label || "").toLowerCase();
      return /(\s|^)(ir|nir|infrared|depth|tof|near[\s-]?infrared)(\s|$)/i.test(
        l,
      );
    });
    var hasEnv = cams.some(function (c) {
      return (
        c.getCapabilities && c.getCapabilities().facingMode === "environment"
      );
    });
    if (nirLabel) {
      /* c8 ignore start -- browser-only detectNirCapability */
      return {
        nirAvailable: true,
        reason: "ir-device-label",
        hasEnvironmentCamera: hasEnv,
        fallback: "none",
      };
      /* c8 ignore stop */
    }
    /* c8 ignore start -- browser-only detectNirCapability */
    return {
      nirAvailable: false,
      reason: "nir-not-detectable",
      hasEnvironmentCamera: hasEnv,
      fallback: "visible",
    };
    /* c8 ignore stop */
  } catch (error) {
    return {
      nirAvailable: false,
      reason: "error:" + (error && error.message ? error.message : "unknown"),
      hasEnvironmentCamera: false,
      fallback: "visible",
    };
  }
};

/* c8 ignore start */
// FULL 64-SLOT QUALITY VECTOR (ISO/IEC 29794-6 Section 7)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate the full 64-slot quality vector per ISO/IEC 29794-6 Section 7.
 * Slots 1-17: defined metrics
 * Slots 18-48: vendor-specific / reserved
 * Slots 49-63: mutually compared quality (2-image)
 * @param {object} params - Same as computeCompositeQuality
 * @returns {Float64Array} 64-element quality vector
 */
/* c8 ignore stop */
IrisQualityFull.generateQualityVector = function (params) {
  var vector = new Float64Array(64);
  var metrics = {};

  if (!params || !params.imageData) return vector;

  // Slots 1-14: defined metrics
  metrics.focus = IrisQualityFull.focusQuality(
    params.imageData,
    params.width,
    params.height,
    params.iris
      ? {
          x: params.iris.x - params.iris.radius,
          y: params.iris.y - params.iris.radius,
          width: params.iris.radius * 2,
          height: params.iris.radius * 2,
        }
      : null,
  );
  vector[0] = metrics.focus;

  vector[1] = params.iris ? params.iris.radius * 2 : 0; // diameter

  metrics.usableArea = params.mask
    ? IrisQualityFull.usableArea(params.mask)
    : 0;
  vector[2] = metrics.usableArea;

  vector[3] =
    params.pupil && params.iris
      ? IrisQualityFull.irisPupilContrast(
          params.imageData,
          params.width,
          params.height,
          params.pupil,
          params.iris,
        )
      : 0;

  vector[4] = params.iris
    ? IrisQualityFull.irisScleraContrast(
        params.imageData,
        params.width,
        params.height,
        params.iris,
      )
    : 0;

  vector[5] =
    params.pupil && params.iris
      ? IrisQualityFull.pupilIrisRatio(params.pupil.radius, params.iris.radius)
      : 0;

  vector[6] =
    params.pupil && params.iris
      ? IrisQualityFull.gazeAngle(params.pupil, params.iris, params.iris.radius)
      : 0;

  vector[7] = params.iris
    ? IrisQualityFull.marginAdequacy(
        params.iris,
        params.iris.radius,
        params.width,
        params.height,
      )
    : 0;

  vector[8] = IrisQualityFull.grayscaleUtilization(params.imageData);

  vector[9] = 0; // eyelid occlusion — needs mask analysis (computed if mask provided)

  vector[10] = 0; // eyelash occlusion — needs mask analysis

  vector[11] =
    params.pupil && params.iris
      ? IrisQualityFull.specularReflection(
          params.imageData,
          params.width,
          params.height,
          params.pupil,
          params.iris,
        ).ratio * 100
      : 0; // specular reflection — ISO/IEC 29794-6 §6 metric 12 / OSAC 2024-N-0004 §3.5

  vector[12] = IrisQualityFull.motionBlur(
    params.imageData,
    params.width,
    params.height,
  );

  vector[13] = params.iris
    ? IrisQualityFull.depthOfField(
        params.imageData,
        params.width,
        params.height,
        params.iris,
        params.iris.radius,
      )
    : 50;

  // Slots 14-16: new metrics
  vector[14] =
    params.pupil && params.iris
      ? IrisQualityFull.concentricity(
          params.pupil,
          params.iris,
          params.iris.radius,
        )
      : 0.5;

  vector[15] =
    params.mask && params.iris
      ? IrisQualityFull.eyelidCircularity(
          params.mask,
          params.width,
          params.height,
          params.iris,
          params.iris.radius,
        )
      : 0.5;

  vector[16] =
    params.pupil && params.iris
      ? IrisQualityFull.azimuthGaze(
          params.pupil,
          params.iris,
          params.iris.radius,
        )
      : 0;

  // Slot 18 (1-based, index 17): vendor-defined specular reflection
  // (ISO/IEC 29794-6 §6 metric 12 / OSAC 2024-N-0004 §3.5). Mirrors the
  // defined-metric slot 12 (index 11) so the same signal is also exposed in
  // the vendor-reserved region of the 64-slot quality vector.
  vector[17] =
    params.pupil && params.iris
      ? IrisQualityFull.specularReflection(
          params.imageData,
          params.width,
          params.height,
          params.pupil,
          params.iris,
        ).ratio * 100
      : 0;

  // Slot 19 (1-based, index 18): Visible Iris Area (Worldcoin/WVU-validated)
  vector[18] =
    params.mask && params.iris
      ? IrisQualityFull.visibleIrisArea(
          params.mask,
          params.width,
          params.height,
          params.iris,
        ).viaRatio * 100
      : 0;

  // Slots 20-47: vendor-specific / reserved (zeros)
  // Slots 48-62: reserved for future ISO extensions
  // Slot 63: composite score
  vector[63] = 0; // Will be set by computeCompositeQuality

  return vector;
};

/**
 * Compute mutual quality comparison between two iris images.
 * ISO/IEC 29794-6 Section 8: evaluates quality consistency across captures.
 * @param {object} params1 - Quality params for image 1
 * @param {object} params2 - Quality params for image 2
 * @returns {{ score: number, consistency: number, details: string }}
 */
IrisQualityFull.mutualQualityComparison = function (params1, params2) {
  if (!params1 || !params2) {
    return { score: 0, consistency: 0, details: "Missing parameters" };
  }

  var q1 = IrisQualityFull.computeCompositeQuality(params1);
  var q2 = IrisQualityFull.computeCompositeQuality(params2);

  // Compute consistency: how similar are the quality scores
  var diff = Math.abs(q1.score - q2.score);
  var consistency = Math.max(0, 100 - diff * 2);

  // Compute mutual quality: geometric mean of both scores
  var mutualScore = Math.sqrt(q1.score * q2.score);

  // Penalize if either image is below threshold
  if (!q1.passed || !q2.passed) {
    mutualScore *= 0.5;
  }

  return {
    score: Math.round(mutualScore),
    consistency: Math.round(consistency),
    image1Score: q1.score,
    image2Score: q2.score,
    bothPassed: q1.passed && q2.passed,
    details:
      "Mutual quality: " +
      Math.round(mutualScore) +
      "/100, consistency: " +
      Math.round(consistency) +
      "%",
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE QUALITY SCORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute composite quality score per ISO/IEC 29794-6.
 * @param {object} params - Quality parameters
 * @param {Uint8ClampedArray} params.imageData - Grayscale image
 * @param {number} params.width - Image width
 * @param {number} params.height - Image height
 * @param {Uint8Array} params.mask - Iris mask
 * @param {object} params.pupil - Pupil {x, y, radius}
 * @param {object} params.iris - Iris {x, y, radius}
 * @returns {{ score: number, level: string, metrics: object, passed: boolean }}
 */
/* c8 ignore stop */
IrisQualityFull.computeCompositeQuality = function (params) {
  var metrics = {},
    weights = {},
    totalWeight = 0,
    weightedSum = 0;

  if (!params || !params.imageData) {
    return { score: 0, level: "Low", metrics: {}, passed: false };
  }

  // Compute individual metrics
  metrics.focus = IrisQualityFull.focusQuality(
    params.imageData,
    params.width,
    params.height,
    params.iris
      ? {
          x: params.iris.x - params.iris.radius,
          y: params.iris.y - params.iris.radius,
          width: params.iris.radius * 2,
          height: params.iris.radius * 2,
        }
      : null,
  );

  metrics.usableArea = params.mask
    ? IrisQualityFull.usableArea(params.mask)
    : 50;

  metrics.irisPupilContrast =
    params.pupil && params.iris
      ? IrisQualityFull.irisPupilContrast(
          params.imageData,
          params.width,
          params.height,
          params.pupil,
          params.iris,
        )
      : 50;

  metrics.irisScleraContrast = params.iris
    ? IrisQualityFull.irisScleraContrast(
        params.imageData,
        params.width,
        params.height,
        params.iris,
      )
    : 50;

  metrics.pupilIrisRatio =
    params.pupil && params.iris
      ? IrisQualityFull.pupilIrisRatio(params.pupil.radius, params.iris.radius)
      : 0.5;

  metrics.gazeAngle =
    params.pupil && params.iris
      ? IrisQualityFull.gazeAngle(params.pupil, params.iris, params.iris.radius)
      : 0;

  metrics.marginAdequacy = params.iris
    ? IrisQualityFull.marginAdequacy(
        params.iris,
        params.iris.radius,
        params.width,
        params.height,
      )
    : 50;

  metrics.grayscaleUtilization = IrisQualityFull.grayscaleUtilization(
    params.imageData,
  );

  metrics.motionBlur = IrisQualityFull.motionBlur(
    params.imageData,
    params.width,
    params.height,
  );

  metrics.depthOfField = params.iris
    ? IrisQualityFull.depthOfField(
        params.imageData,
        params.width,
        params.height,
        params.iris,
        params.iris.radius,
      )
    : 50;

  metrics.concentricity =
    params.pupil && params.iris
      ? IrisQualityFull.concentricity(
          params.pupil,
          params.iris,
          params.iris.radius,
        )
      : 0.5;

  metrics.eyelidCircularity =
    params.mask && params.iris
      ? IrisQualityFull.eyelidCircularity(
          params.mask,
          params.width,
          params.height,
          params.iris,
          params.iris.radius,
        )
      : 0.5;

  metrics.azimuthGaze =
    params.pupil && params.iris
      ? IrisQualityFull.azimuthGaze(
          params.pupil,
          params.iris,
          params.iris.radius,
        )
      : 0;

  metrics.visibleIrisArea =
    params.mask && params.iris
      ? Math.round(
          IrisQualityFull.visibleIrisArea(
            params.mask,
            params.width,
            params.height,
            params.iris,
          ).viaRatio * 1000,
        ) / 10
      : 0;

  metrics.specularReflection =
    params.pupil && params.iris
      ? Math.round(
          IrisQualityFull.specularReflection(
            params.imageData,
            params.width,
            params.height,
            params.pupil,
            params.iris,
          ).ratio * 1000,
        ) / 10
      : 0;

  // Weights per ISO/IEC 29794-6 (approximate, extended)
  weights = {
    focus: 0.18,
    usableArea: 0.13,
    irisPupilContrast: 0.13,
    irisScleraContrast: 0.09,
    pupilIrisRatio: 0.09,
    gazeAngle: 0.08,
    marginAdequacy: 0.09,
    grayscaleUtilization: 0.04,
    motionBlur: 0.04,
    depthOfField: 0.04,
    concentricity: 0.04,
    eyelidCircularity: 0.03,
    azimuthGaze: 0.02,
  };

  // Compute weighted score
  for (var key in weights) {
    if (
      Object.prototype.hasOwnProperty.call(weights, key) &&
      metrics[key] !== undefined
    ) {
      var value = metrics[key];

      // Normalize different metrics to 0-100
      switch (key) {
        case "pupilIrisRatio": {
          // Optimal ratio is 0.3-0.5, penalize extremes
          value =
            value >= 0.15 && value <= 0.65
              ? 100
              : Math.max(0, 100 - Math.abs(value - 0.4) * 200);

          break;
        }
        case "gazeAngle":
        case "azimuthGaze": {
          // Lower is better
          value = Math.max(0, 100 - value * 10);

          break;
        }
        case "motionBlur": {
          // Lower is better
          value = Math.max(0, 100 - value * 2);

          break;
        }
        case "concentricity":
        case "eyelidCircularity": {
          // 0-1 ratio, multiply by 100
          value = value * 100;

          break;
        }
        case "depthOfField": {
          // Already 0-100

          break;
        }
        // No default
      }

      weightedSum += value * weights[key];
      totalWeight += weights[key];
    }
  }

  var compositeScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  var level = IrisQualityFull._getQualityLevel(compositeScore);
  var passed = compositeScore >= 51;

  // Generate full quality vector per ISO/IEC 29794-6 Section 7
  var qualityVector = IrisQualityFull.generateQualityVector(params);
  qualityVector[63] = compositeScore; // Set composite in slot 63

  // Evaluate Worldcoin empirically-validated acquisition gates
  var gates = IrisQualityFull.evaluateAcquisitionGates(params);

  return {
    score: compositeScore,
    level: level.label,
    metrics: metrics,
    passed: passed,
    qualityVector: qualityVector,
    gates: gates,
    details: IrisQualityFull._generateReport(
      compositeScore,
      level,
      metrics,
      passed,
    ),
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Get quality level from score.
 * @param score
 * @private
 */
/* c8 ignore stop */
IrisQualityFull._getQualityLevel = function (score) {
  if (score >= 76) return { label: "Very High", code: 4 };
  if (score >= 51) return { label: "High", code: 3 };
  if (score >= 26) return { label: "Medium", code: 2 };
  return { label: "Low", code: 1 };
};

/* c8 ignore start */
/**
 * Generate human-readable quality report.
 * @param score
 * @param level
 * @param metrics
 * @param passed
 * @private
 */
/* c8 ignore stop */
IrisQualityFull._generateReport = function (score, level, metrics, passed) {
  var lines = [];
  lines.push("=== ISO/IEC 29794-6 Iris Quality Report ===");
  lines.push("Composite Score: " + score + "/100 (" + level.label + ")");
  lines.push("Status: " + (passed ? "PASSED" : "FAILED"));
  lines.push("");
  lines.push("Individual Metrics:");

  for (var key in metrics) {
    if (Object.prototype.hasOwnProperty.call(metrics, key)) {
      lines.push(
        "  " +
          key +
          ": " +
          (typeof metrics[key] === "number"
            ? metrics[key].toFixed(2)
            : metrics[key]),
      );
    }
  }

  return lines.join("\n");
};

// Export for window
if (typeof window !== "undefined") {
  window.IrisQualityFull = IrisQualityFull;
}
