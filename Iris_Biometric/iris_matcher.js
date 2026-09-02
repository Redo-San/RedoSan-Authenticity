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
// ── Iris Matcher: normalized Hamming distance comparison ──
/* c8 ignore stop */

/**
 * @class
 */
function IrisMatcher() {}

/**
 * Compute the normalized Hamming Distance between two IrisCodes.
 * Only valid (mask=1) bit positions are compared.
 * @param {{ code: Uint8Array, mask: Uint8Array }} a - first IrisCode
 * @param {{ code: Uint8Array, mask: Uint8Array }} b - second IrisCode
 * @returns {{ hd: number, validBits: number, totalBits: number, match: boolean }}
 */
IrisMatcher.hammingDistance = function (a, b) {
  var len, validBits, diffBits, i;

  if (!a || !b || !a.code || !b.code || !a.mask || !b.mask) {
    return { hd: 1, validBits: 0, totalBits: 0, match: false };
  }

  len = Math.min(a.code.length, b.code.length, a.mask.length, b.mask.length);
  validBits = 0;
  diffBits = 0;

  for (i = 0; i < len; i++) {
    // Only compare bits where both masks are valid
    if (a.mask[i] === 1 && b.mask[i] === 1) {
      validBits++;
      if (a.code[i] !== b.code[i]) {
        diffBits++;
      }
    }
  }

  if (validBits === 0) {
    return { hd: 1, validBits: 0, totalBits: len, match: false };
  }

  var hd = diffBits / validBits;
  var threshold =
    typeof window !== "undefined" && window.IRIS_ENGINE_CONFIG
      ? window.IRIS_ENGINE_CONFIG.hammingThreshold
      : 0.26;

  return {
    hd: hd,
    validBits: validBits,
    totalBits: len,
    match: hd <= threshold,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// DAUGMAN SCORE NORMALIZATION (as used by CVRL HDBIF / IREX methods)
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Normalized Hamming Distance per the Daugman formula documented by
 * CVRL/Notre Dame for the HDBIF method:
 *
 *   HD_norm = 0.5 - (0.5 * HD_raw) * sqrt(n_bits / n_typical)
 *
 * HD_norm is a SIMILARITY score: 0.5 = perfect match, ~0.25 = chance level,
 * 0 = anti-correlated. Matches computed over fewer bits (occlusion) are
 * compressed toward chance, preventing low-overlap false confidence.
 * @param {number} hdRaw - Raw fractional Hamming distance (0-1)
 * @param {number} nBits - Number of bits actually compared
 * @param {number} nTypical - Usual number of bits compared (full overlap)
 * @returns {number} Normalized score (0-0.5)
 */
/* c8 ignore stop */
IrisMatcher.normalizeHd = function (hdRaw, nBits, nTypical) {
  if (
    typeof hdRaw !== "number" ||
    typeof nBits !== "number" ||
    !nTypical ||
    nTypical <= 0 ||
    nBits < 0
  ) {
    return 0;
  }

  var ratio = Math.min(1, Math.max(0, nBits / nTypical));
  var norm = 0.5 - 0.5 * hdRaw * Math.sqrt(ratio);

  return Math.max(0, Math.min(0.5, norm));
};

/* c8 ignore start */
/**
 * Daugman decidability significance score.
 * Measures how many standard deviations the observed HD is away from the
 * chance level (0.5), given the number of bits compared:
 *
 *   z = (0.5 - HD_raw) / (0.5 / sqrt(n_bits))
 *     = 2 * (0.5 - HD_raw) * sqrt(n_bits)
 *
 * Fewer bits -> smaller |z| -> statistically weaker evidence.
 * Typical values: genuine matches >> 10, impostors ~ 1-4.
 * @param {number} hdRaw - Raw fractional Hamming distance (0-1)
 * @param {number} nBits - Number of bits compared
 * @returns {number} Significance score in sigmas (>= 0)
 */
/* c8 ignore stop */
IrisMatcher.decidabilityScore = function (hdRaw, nBits) {
  if (
    typeof hdRaw !== "number" ||
    typeof nBits !== "number" ||
    nBits <= 0 ||
    hdRaw >= 0.5
  ) {
    return 0;
  }

  return 2 * (0.5 - hdRaw) * Math.sqrt(nBits);
};

/* c8 ignore start */
/**
 * Compare two IrisCodes and return a detailed result.
 * @param {{ code: Uint8Array, mask: Uint8Array }} a
 * @param {{ code: Uint8Array, mask: Uint8Array }} b
 * @param {number} [threshold] override default hammingThreshold
 * @returns {{ hd: number, validBits: number, match: boolean, confidence: number, details: string }}
 */
/* c8 ignore stop */
IrisMatcher.compare = function (a, b, threshold) {
  var result, hd, validBits, totalBits, confidence, hdNorm, significance;

  result = IrisMatcher.hammingDistance(a, b);
  hd = result.hd;
  validBits = result.validBits;
  totalBits = result.totalBits;

  if (typeof threshold !== "number") {
    threshold =
      typeof window !== "undefined" && window.IRIS_ENGINE_CONFIG
        ? window.IRIS_ENGINE_CONFIG.hammingThreshold
        : 0.26;
  }

  // Confidence: how far below the threshold (0 = at threshold, 1 = perfect match)
  confidence = validBits > 0 ? Math.max(0, 1 - hd / threshold) : 0;

  // Daugman-normalized score + statistical significance
  hdNorm = validBits > 0 ? IrisMatcher.normalizeHd(hd, validBits, totalBits) : 0;
  significance = validBits > 0 ? IrisMatcher.decidabilityScore(hd, validBits) : 0;

  var details = "";
  if (validBits < totalBits * 0.3) {
    details = "Low overlap: only " + validBits + " of " + totalBits + " bits valid";
  } else if (hd < 0.1) {
    details = "Excellent match quality";
  } else if (hd < 0.2) {
    details = "Good match";
  } else if (hd < threshold) {
    details = "Marginal match — consider re-capture";
  } else {
    details = "No match";
  }

  return {
    hd: hd,
    hdNorm: Math.round(hdNorm * 10_000) / 10_000,
    significance: Math.round(significance * 100) / 100,
    validBits: validBits,
    match: hd <= threshold,
    confidence: confidence,
    details: details,
  };
};

/* c8 ignore start */
/**
 * Find the best matching IrisCode from a gallery (array of templates).
 * @param {{ code: Uint8Array, mask: Uint8Array }} probe - the query IrisCode
 * @param {Array<{ code: Uint8Array, mask: Uint8Array, id: string }>} gallery - stored templates
 * @param {number} [threshold] override default threshold
 * @returns {{ bestMatch: {id: string, hd: number, match: boolean}, allResults: Array<{id: string, hd: number, match: boolean}> }}
 */
/* c8 ignore stop */
IrisMatcher.identify = function (probe, gallery, threshold) {
  var results, i, result;

  if (!probe || !gallery || gallery.length === 0) {
    return {
      bestMatch: null,
      allResults: [],
    };
  }

  results = [];
  for (i = 0; i < gallery.length; i++) {
    result = IrisMatcher.compare(probe, gallery[i], threshold);
    results.push({
      id: gallery[i].id || "template_" + i,
      hd: result.hd,
      hdNorm: result.hdNorm,
      significance: result.significance,
      validBits: result.validBits,
      match: result.match,
      confidence: result.confidence,
    });
  }

  // Sort by Hamming Distance (best match first)
  results.sort(function (a, b) {
    return a.hd - b.hd;
  });

  return {
    bestMatch: results[0].match ? results[0] : null,
    allResults: results,
  };
};

/* c8 ignore start */
/**
 * XOR two IrisCodes and return the result as a visual pattern.
 * Useful for debugging — shows which bits differ.
 * @param {{ code: Uint8Array, mask: Uint8Array }} a
 * @param {{ code: Uint8Array, mask: Uint8Array }} b
 * @returns {Uint8Array} XOR result (1 = different, 0 = same, 2 = masked)
 */
/* c8 ignore stop */
IrisMatcher.xorVisual = function (a, b) {
  var len, result, i;

  len = Math.min(a.code.length, b.code.length, a.mask.length, b.mask.length);
  result = new Uint8Array(len);

  for (i = 0; i < len; i++) {
    if (a.mask[i] !== 1 || b.mask[i] !== 1) {
      result[i] = 2; // masked
    } else {
      result[i] = a.code[i] === b.code[i] ? 0 : 1;
    }
  }

  return result;
};

/* c8 ignore start */
// Expose on window for browser usage
/* c8 ignore stop */
if (typeof window !== "undefined") {
  window.IrisMatcher = IrisMatcher;
}
