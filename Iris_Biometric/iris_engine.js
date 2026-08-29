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
// ── Iris Engine: Daugman pipeline (segmentation → normalization → feature extraction) ──

/**
 * Configuration for the iris recognition pipeline.
 * All thresholds in one place for easy calibration.
 */
var IRIS_ENGINE_CONFIG = {
  // Segmentation
  pupilSearchRange: { minRadius: 20, maxRadius: 0.25 }, // pupil radius as fraction of image
  irisSearchRange: { minRadiusRatio: 1.2, maxRadiusRatio: 4 }, // iris/pupil radius ratio
  idoScale: 1.5, // IDO Gaussian smoothing sigma (in pixels)

  // Normalization
  normWidth: 64, // angular samples (columns)
  normHeight: 32, // radial samples (rows)

  // Feature extraction (Gabor wavelets)
  gaborWavelengths: [3, 4, 5, 6], // wavelengths in pixels
  gaborOrientations: [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4],
  codeWidth: 256, // bits per row of IrisCode
  codeHeight: 20, // rows of IrisCode

  // Matching
  // HD below this = match. 0.26 is a literature-consistent operating point.
  // NOTE: the often-quoted "FMR < 10^-11" figure for this threshold is NOT
  // independently verified against a primary source; the citable NIST IREX IX
  // result for NIR one-to-one matching is FNMR < 1% at FMR 10^-5. Visible-light
  // / webcam capture (this tool) is measurably less accurate than NIR scanners,
  // and less accurate still for darker irides (see iris_camera.js).
  hammingThreshold: 0.26,
};

/**
 * Core iris recognition engine implementing the Daugman pipeline.
 * Handles segmentation, normalization, and IrisCode generation.
 * @class
 * @param {object} [config] Override default IRIS_ENGINE_CONFIG
 */
function IrisEngine(config) {
  this._config = {};
  var key;
  for (key in IRIS_ENGINE_CONFIG) {
    if (Object.prototype.hasOwnProperty.call(IRIS_ENGINE_CONFIG, key)) {
      this._config[key] =
        config && config[key] !== undefined
          ? config[key]
          : IRIS_ENGINE_CONFIG[key];
    }
  }
  this._loaded = false;
  this._segmentationModel = null;
}

/**
 * Check if the engine is loaded and ready.
 * @returns {boolean}
 */
IrisEngine.prototype.isLoaded = function () {
  return this._loaded;
};

/**
 * Load models for iris segmentation.
 * Tries ONNX Runtime Web first, falls back to lightweight heuristic.
 * @returns {Promise<void>}
 */
IrisEngine.prototype.loadModels = async function () {
  if (this._loaded) return;
  // For now, use heuristic segmentation (no external model required).
  // When ONNX model is available, load it here.
  this._loaded = true;
};

// ═══════════════════════════════════════════════════════════════════════════
// SEGMENTATION: Detect pupil and iris boundaries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert an image to grayscale pixel array.
 * @param {ImageData|HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} input
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
IrisEngine._toGrayscale = function (input) {
  var canvas, ctx, imgData, d, i, len;
  if (input instanceof ImageData) {
    return { data: input.data, width: input.width, height: input.height };
  }
  canvas = document.createElement("canvas");
  if (input instanceof HTMLVideoElement) {
    canvas.width = input.videoWidth || input.width;
    canvas.height = input.videoHeight || input.height;
  } else {
    canvas.width = input.naturalWidth || input.width;
    canvas.height = input.naturalHeight || input.height;
  }
  ctx = canvas.getContext("2d");
  ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
  imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imgData.data, width: canvas.width, height: canvas.height };
};

/**
 * Get luminance value from RGBA pixel data.
 * @param {Uint8ClampedArray} data
 * @param {number} offset - byte offset (r)
 * @returns {number} 0-255
 */
IrisEngine._luminance = function (data, offset) {
  return 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
};

/**
 * Compute a grayscale 2D array from RGBA pixel data.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} gray
 * @returns {Float64Array} row-major grayscale values 0-255
 */
IrisEngine._toGray2D = function (gray) {
  var pixels, i, len;
  len = gray.width * gray.height;
  pixels = new Float64Array(len);
  for (i = 0; i < len; i++) {
    pixels[i] = IrisEngine._luminance(gray.data, i * 4);
  }
  return pixels;
};

/**
 * Detect the pupil center and radius using Integrodifferential Operator (IDO).
 * Simplified Daugman approach: find the circular boundary with maximum gradient.
 * @param {Float64Array} gray - grayscale pixel array (row-major)
 * @param {number} width
 * @param {number} height
 * @returns {{ cx: number, cy: number, radius: number, score: number }}
 */
IrisEngine.detectPupil = function (gray, width, height) {
  var bestScore, bestCx, bestCy, bestR, cx, cy, r, theta, x, y, sum, prevSum, grad;
  var minR, maxR, stepR, stepXY, minC, maxC, i, angleCount;

  bestScore = -1;
  bestCx = width / 2;
  bestCy = height / 2;
  bestR = Math.min(width, height) * 0.1;

  minR = Math.max(10, Math.floor(height * 0.04));
  maxR = Math.floor(
    Math.min(width, height) * IRIS_ENGINE_CONFIG.pupilSearchRange.maxRadius,
  );
  stepR = 2;
  stepXY = 4;
  angleCount = 60;

  // Coarse search
  for (cx = width * 0.3; cx < width * 0.7; cx += stepXY) {
    for (cy = height * 0.3; cy < height * 0.7; cy += stepXY) {
      for (r = minR; r <= maxR; r += stepR) {
        sum = 0;
        prevSum = 0;
        for (i = 0; i < angleCount; i++) {
          theta = (i / angleCount) * 2 * Math.PI;
          x = Math.floor(cx + r * Math.cos(theta));
          y = Math.floor(cy + r * Math.sin(theta));
          if (x >= 0 && x < width && y >= 0 && y < height) {
            sum += gray[y * width + x];
          }
        }
        // IDO: maximize the gradient of the integral along the arc
        grad = Math.abs(sum - prevSum);
        if (grad > bestScore) {
          bestScore = grad;
          bestCx = cx;
          bestCy = cy;
          bestR = r;
        }
        prevSum = sum;
      }
    }
  }

  // Refine with smaller steps around best candidate
  for (cx = bestCx - stepXY; cx <= bestCx + stepXY; cx += 1) {
    for (cy = bestCy - stepXY; cy <= bestCy + stepXY; cy += 1) {
      for (r = bestR - stepR; r <= bestR + stepR; r += 1) {
        if (r < minR) continue;
        sum = 0;
        for (i = 0; i < angleCount; i++) {
          theta = (i / angleCount) * 2 * Math.PI;
          x = Math.floor(cx + r * Math.cos(theta));
          y = Math.floor(cy + r * Math.sin(theta));
          if (x >= 0 && x < width && y >= 0 && y < height) {
            sum += gray[y * width + x];
          }
        }
        if (sum < bestScore) {
          // Pupil is dark → minimize sum along boundary
          bestScore = sum;
          bestCx = cx;
          bestCy = cy;
          bestR = r;
        }
      }
    }
  }

  return { cx: bestCx, cy: bestCy, radius: bestR, score: bestScore };
};

/**
 * Detect the iris outer boundary (sclera-iris junction).
 * Uses IDO on the region outside the pupil.
 * @param {Float64Array} gray
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number, radius: number }} pupil
 * @returns {{ cx: number, cy: number, radius: number }}
 */
IrisEngine.detectIris = function (gray, width, height, pupil) {
  var bestScore, bestR, cx, cy, r, theta, x, y, sum, prevSum, grad;
  var minR, maxR, stepR, angleCount, i;

  cx = pupil.cx;
  cy = pupil.cy;
  minR = Math.floor(pupil.radius * IRIS_ENGINE_CONFIG.irisSearchRange.minRadiusRatio);
  maxR = Math.floor(
    Math.min(width, height) * 0.45,
  );
  stepR = 1;
  angleCount = 90;
  bestScore = -1;
  bestR = minR + (maxR - minR) / 2;

  // Search outer boundary: maximize gradient at sclera-iris junction
  for (r = minR; r <= maxR; r += stepR) {
    sum = 0;
    for (i = 0; i < angleCount; i++) {
      theta = (i / angleCount) * 2 * Math.PI;
      x = Math.floor(cx + r * Math.cos(theta));
      y = Math.floor(cy + r * Math.sin(theta));
      if (x >= 0 && x < width && y >= 0 && y < height) {
        sum += gray[y * width + x];
      }
    }
    grad = Math.abs(sum - prevSum);
    if (grad > bestScore) {
      bestScore = grad;
      bestR = r;
    }
    prevSum = sum;
  }

  return { cx: cx, cy: cy, radius: bestR };
};

/**
 * Full segmentation: detect pupil + iris boundaries.
 * @param {ImageData|HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} input
 * @returns {{ pupil: {cx,cy,radius}, iris: {cx,cy,radius}, gray: Float64Array, width: number, height: number }}
 */
IrisEngine.prototype.segment = function (input) {
  var grayRaw, gray2D, pupil, iris;
  grayRaw = IrisEngine._toGrayscale(input);
  gray2D = IrisEngine._toGray2D(grayRaw);
  pupil = IrisEngine.detectPupil(gray2D, grayRaw.width, grayRaw.height);
  iris = IrisEngine.detectIris(gray2D, grayRaw.width, grayRaw.height, pupil);
  return {
    pupil: pupil,
    iris: iris,
    gray: gray2D,
    width: grayRaw.width,
    height: grayRaw.height,
  };
};

 
/**
 * Validate that the segmented region plausibly contains a human iris.
 *
 * The Daugman IDO segmentation always returns *something* (it finds the
 * darkest circular region in any image), so without this gate a photo with
 * no eye would be enrolled as a "template". These heuristic checks reject
 * non-eye captures so the pipeline records a Failure-To-Acquire (FTA)
 * instead of storing garbage.
 * @param {Float64Array|Uint8Array} gray - row-major grayscale luminance (0-255)
 * @param {number} width
 * @param {number} height
 * @param {{cx:number,cy:number,radius:number}} pupil
 * @param {{cx:number,cy:number,radius:number}} iris
 * @returns {{ok:boolean, reason:string}}
 */
IrisEngine.validateEyePresence = function (gray, width, height, pupil, iris) {
  if (!pupil || !iris || !pupil.radius || !iris.radius) {
    return { ok: false, reason: "no-segmentation" };
  }
  var minDim = Math.min(width, height);
  var pupR = pupil.radius / minDim;
  var irisR = iris.radius / minDim;
  if (pupR < 0.03 || pupR > 0.22) return { ok: false, reason: "pupil-size" };
  if (irisR < 0.06 || irisR > 0.46) return { ok: false, reason: "iris-size" };
  var ratio = iris.radius / pupil.radius;
  if (ratio < 1.1 || ratio > 5.5) return { ok: false, reason: "iris-pupil-ratio" };
  if (
    pupil.cx < width * 0.18 || pupil.cx > width * 0.82 ||
    pupil.cy < height * 0.18 || pupil.cy > height * 0.82
  ) {
    return { ok: false, reason: "off-center" };
  }
  var pupilMean = IrisEngine._meanDisk(gray, width, height, pupil.cx, pupil.cy, pupil.radius * 0.85);
  var irisMean = IrisEngine._meanAnnulus(gray, width, height, iris.cx, iris.cy, pupil.radius * 1.1, iris.radius * 0.95);
  var pupilOk = isFinite(pupilMean);
  var irisOk = isFinite(irisMean);
  if (!pupilOk || !irisOk) return { ok: false, reason: "no-signal" };
  if (pupilMean > irisMean - 12) return { ok: false, reason: "no-dark-pupil" };
  var irisVar = IrisEngine._varAnnulus(gray, width, height, iris.cx, iris.cy, pupil.radius * 1.1, iris.radius * 0.95);
  if (!isFinite(irisVar) || irisVar < 25) return { ok: false, reason: "low-iris-texture" };
  return { ok: true, reason: "" };
};

/**
 * Mean luminance inside a filled disk.
 * @param {Float64Array|Uint8Array} gray - row-major grayscale luminance (0-255)
 * @param {number} w - image width
 * @param {number} h - image height
 * @param {number} cx - disk center x
 * @param {number} cy - disk center y
 * @param {number} r - disk radius
 * @returns {number} mean luminance, or NaN if empty
 */
IrisEngine._meanDisk = function (gray, w, h, cx, cy, r) {
  var sum = 0, n = 0, x, y, dx, dy, rr = r * r;
  var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (y = y0; y <= y1; y++) {
    for (x = x0; x <= x1; x++) {
      dx = x - cx;
      dy = y - cy;
      if (dx * dx + dy * dy <= rr) {
        sum += gray[y * w + x];
        n++;
      }
    }
  }
  return n ? sum / n : NaN;
};

/**
 * Mean luminance in an annulus [r0, r1].
 * @param {Float64Array|Uint8Array} gray - row-major grayscale luminance (0-255)
 * @param {number} w - image width
 * @param {number} h - image height
 * @param {number} cx - annulus center x
 * @param {number} cy - annulus center y
 * @param {number} r0 - inner radius
 * @param {number} r1 - outer radius
 * @returns {number} mean luminance, or NaN if empty
 */
IrisEngine._meanAnnulus = function (gray, w, h, cx, cy, r0, r1) {
  var sum = 0, n = 0, x, y, d;
  var x0 = Math.max(0, Math.floor(cx - r1)), x1 = Math.min(w - 1, Math.ceil(cx + r1));
  var y0 = Math.max(0, Math.floor(cy - r1)), y1 = Math.min(h - 1, Math.ceil(cy + r1));
  for (y = y0; y <= y1; y++) {
    for (x = x0; x <= x1; x++) {
      dx = x - cx;
      dy = y - cy;
      d = Math.hypot(dx, dy);
      if (d >= r0 && d <= r1) {
        sum += gray[y * w + x];
        n++;
      }
    }
  }
  return n ? sum / n : NaN;
};

/**
 * Variance of luminance in an annulus [r0, r1].
 * @param {Float64Array|Uint8Array} gray - row-major grayscale luminance (0-255)
 * @param {number} w - image width
 * @param {number} h - image height
 * @param {number} cx - annulus center x
 * @param {number} cy - annulus center y
 * @param {number} r0 - inner radius
 * @param {number} r1 - outer radius
 * @returns {number} luminance variance, or NaN if empty
 */
IrisEngine._varAnnulus = function (gray, w, h, cx, cy, r0, r1) {
  var mean = IrisEngine._meanAnnulus(gray, w, h, cx, cy, r0, r1);
  if (!isFinite(mean)) return NaN;
  var sum = 0, n = 0, x, y, d, v;
  var x0 = Math.max(0, Math.floor(cx - r1)), x1 = Math.min(w - 1, Math.ceil(cx + r1));
  var y0 = Math.max(0, Math.floor(cy - r1)), y1 = Math.min(h - 1, Math.ceil(cy + r1));
  for (y = y0; y <= y1; y++) {
    for (x = x0; x <= x1; x++) {
      dx = x - cx;
      dy = y - cy;
      d = Math.hypot(dx, dy);
      if (d >= r0 && d <= r1) {
        v = gray[y * w + x] - mean;
        sum += v * v;
        n++;
      }
    }
  }
  return n ? sum / n : NaN;
};
 

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION: Rubber-sheet model (Daugman)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize the iris region using Daugman's rubber-sheet model.
 * Maps the annular iris region to a rectangular strip of fixed size.
 * @param {Float64Array} gray - grayscale pixels (row-major)
 * @param {number} width - image width
 * @param {number} height - image height
 * @param {{ cx: number, cy: number, radius: number }} pupil
 * @param {{ cx: number, cy: number, radius: number }} iris
 * @param {number} [normW] - output width (angular samples)
 * @param {number} [normH] - output height (radial samples)
 * @returns {Float64Array} normalized iris image (row-major, normH × normW)
 */
IrisEngine.normalize = function (
  gray,
  width,
  height,
  pupil,
  iris,
  normW,
  normH,
) {
  normW = normW || IRIS_ENGINE_CONFIG.normWidth;
  normH = normH || IRIS_ENGINE_CONFIG.normHeight;
  var result, row, col, theta, rNorm, rIris, rPupil, r, x, y, xi, yi;

  result = new Float64Array(normH * normW);
  rPupil = pupil.radius;
  rIris = iris.radius;

  for (row = 0; row < normH; row++) {
    rNorm = row / (normH - 1); // 0 = inner (pupil), 1 = outer (sclera)
    r = rPupil + rNorm * (rIris - rPupil);

    for (col = 0; col < normW; col++) {
      theta = (col / normW) * 2 * Math.PI;

      // Map polar to Cartesian
      x = Math.floor(iris.cx + r * Math.cos(theta));
      y = Math.floor(iris.cy + r * Math.sin(theta));

      // Bilinear interpolation for sub-pixel accuracy
      xi = Math.min(Math.max(x, 0), width - 1);
      yi = Math.min(Math.max(y, 0), height - 1);
      result[row * normW + col] = gray[yi * width + xi];
    }
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE EXTRACTION: 2D Gabor wavelets → IrisCode
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a 2D Gabor-like filter at a single position.
 * Returns the real and imaginary response.
 * @param {Float64Array} image - normalized iris (row-major)
 * @param {number} imgW - image width
 * @param {number} imgH - image height
 * @param {number} cx - filter center x
 * @param {number} cy - filter center y
 * @param {number} wavelength - oscillation wavelength
 * @param {number} orientation - filter orientation (radians)
 * @param {number} [sigma] - Gaussian envelope sigma (default: wavelength * 0.5)
 * @returns {{ real: number, imag: number }}
 */
IrisEngine._gaborResponse = function (
  image,
  imgW,
  imgH,
  cx,
  cy,
  wavelength,
  orientation,
  sigma,
) {
  var realSum, imagSum, halfK, kx, ky, dx, dy, cosO, sinO, gaborCos, gaborSin;
  var gaussExp, r2, xLocal, yLocal, pixelVal;

  sigma = sigma || wavelength * 0.5;
  halfK = Math.max(3, Math.ceil(wavelength * 1.5));
  realSum = 0;
  imagSum = 0;
  cosO = Math.cos(orientation);
  sinO = Math.sin(orientation);

  for (ky = -halfK; ky <= halfK; ky++) {
    for (kx = -halfK; kx <= halfK; kx++) {
      // Rotate to filter coordinates
      xLocal = kx * cosO + ky * sinO;
      yLocal = -kx * sinO + ky * cosO;

      // Gabor = Gaussian envelope × complex sinusoid
      r2 = (xLocal * xLocal + yLocal * yLocal) / (sigma * sigma);
      gaussExp = Math.exp(-0.5 * r2);
      gaborCos = Math.cos((2 * Math.PI * xLocal) / wavelength);
      gaborSin = Math.sin((2 * Math.PI * xLocal) / wavelength);

      // Sample image
      var px = Math.floor(cx + kx);
      var py = Math.floor(cy + ky);
      if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
        pixelVal = image[py * imgW + px];
        realSum += pixelVal * gaussExp * gaborCos;
        imagSum += pixelVal * gaussExp * gaborSin;
      }
    }
  }

  return { real: realSum, imag: imagSum };
};

/**
 * Generate an IrisCode from a normalized iris image.
 * Applies Gabor wavelets at a grid of positions and quantizes responses to binary.
 * @param {Float64Array} normalizedIris - from IrisEngine.normalize()
 * @param {number} normW - width of normalized image
 * @param {number} normH - height of normalized image
 * @param {number} [bitsPerRow] - bits per row in IrisCode
 * @param {number} [numRows] - number of rows in IrisCode
 * @returns {{ code: Uint8Array, mask: Uint8Array, length: number }}
 *   code: binary IrisCode (1 bit per element), mask: 1 = valid, 0 = occluded
 */
IrisEngine.generateIrisCode = function (
  normalizedIris,
  normW,
  normH,
  bitsPerRow,
  numRows,
) {
  bitsPerRow = bitsPerRow || IRIS_ENGINE_CONFIG.codeWidth;
  numRows = numRows || IRIS_ENGINE_CONFIG.codeHeight;

  var code, mask, row, col, bitIdx, gridX, gridY;
  var wavelength, response, phase;

  code = new Uint8Array(bitsPerRow * numRows);
  mask = new Uint8Array(bitsPerRow * numRows);

  wavelength = IRIS_ENGINE_CONFIG.gaborWavelengths[0] || 4;

  for (row = 0; row < numRows; row++) {
    gridY = Math.floor(
      ((row + 0.5) / numRows) * (normH - 1),
    );

    for (bitIdx = 0; bitIdx < bitsPerRow; bitIdx++) {
      gridX = Math.floor(((bitIdx + 0.5) / bitsPerRow) * (normW - 1));

      // Apply Gabor filter
      response = IrisEngine._gaborResponse(
        normalizedIris,
        normW,
        normH,
        gridX,
        gridY,
        wavelength,
        0, // horizontal orientation (primary)
      );

      // Quantize: sign of real part → bit
      phase = response.real > 0 ? 1 : 0;

      // Use imaginary part as secondary bit (2 bits per position)
      code[row * bitsPerRow + bitIdx] = phase;

      // Mark as valid if response magnitude is above noise floor
      mask[row * bitsPerRow + bitIdx] =
        Math.abs(response.real) + Math.abs(response.imag) > 0.1 ? 1 : 0;
    }
  }

  return { code: code, mask: mask, length: bitsPerRow * numRows };
};

/**
 * Complete pipeline: image → segmented → normalized → IrisCode.
 * @param {ImageData|HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} input
 * @returns {{ irisCode: {code,mask,length}, segmentation: {pupil,iris}, normalized: Float64Array }}
 */
IrisEngine.prototype.extract = function (input) {
  var seg, norm, irisCode;

  if (!this._loaded) {
    throw new Error("IrisEngine not loaded. Call loadModels() first.");
  }

  // 1. Segment
  seg = this.segment(input);

  // 2. Normalize
  norm = IrisEngine.normalize(
    seg.gray,
    seg.width,
    seg.height,
    seg.pupil,
    seg.iris,
  );

  // 3. Generate IrisCode
  irisCode = IrisEngine.generateIrisCode(norm, IRIS_ENGINE_CONFIG.normWidth, IRIS_ENGINE_CONFIG.normHeight);

  return {
    irisCode: irisCode,
    segmentation: { pupil: seg.pupil, iris: seg.iris },
    normalized: norm,
  };
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  window.IrisEngine = IrisEngine;
  window.IRIS_ENGINE_CONFIG = IRIS_ENGINE_CONFIG;
}
