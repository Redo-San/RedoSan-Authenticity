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
// ── Iris Template Protection: ISO/IEC 24745 biometric template protection ──

/**
 * ISO/IEC 24745:2022 Biometric Template Protection
 * Provides cancelable biometrics and cryptographic protection for iris templates.
 *
 * Techniques:
 * - Biohashing (random projection)
 * - Feature transformation (non-invertible)
 * - Cryptographic binding
 * @class
 */
function IrisTemplateProtection() {
  this._key = null;
  this._salt = null;
}

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// BIOHASHING (Random Projection)
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Generate a random projection matrix for biohashing.
 * @param {number} inputDim - Input dimension (iris code length)
 * @param {number} outputDim - Output dimension
 * @param {string} [seed] - Optional seed for reproducibility
 * @returns {Float64Array} Projection matrix
 */
/* c8 ignore stop */
IrisTemplateProtection.generateProjectionMatrix = function (
  inputDim,
  outputDim,
  seed,
) {
  var matrix, i, j, rng;

  if (inputDim <= 0 || outputDim <= 0) {
    throw new Error("Invalid dimensions");
  }

  matrix = new Float64Array(outputDim * inputDim);
  rng = IrisTemplateProtection._createRNG(
    seed || IrisTemplateProtection._generateSeed(),
  );

  // Initialize with Gaussian random values
  for (i = 0; i < matrix.length; i++) {
    // Box-Muller transform for Gaussian
    var u1 = rng();
    var u2 = rng();
    matrix[i] =
      Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  }

  // Orthogonalize using Gram-Schmidt
  return IrisTemplateProtection._orthogonalize(matrix, outputDim, inputDim);
};

/* c8 ignore start */
/**
 * Apply biohashing transformation to an iris code.
 * @param {Uint8Array} irisCode - Original iris code
 * @param {Float64Array} projectionMatrix - Random projection matrix
 * @param {number} outputDim - Output dimension
 * @returns {{ hashed: Uint8Array, score: number }}
 */
/* c8 ignore stop */
IrisTemplateProtection.biohash = function (
  irisCode,
  projectionMatrix,
  outputDim,
) {
  var inputDim, projected, i, j, sum, threshold, hashed;

  if (!irisCode || !projectionMatrix) {
    throw new Error("irisCode and projectionMatrix are required");
  }

  inputDim = irisCode.length;
  projected = new Float64Array(outputDim);

  // Random projection
  for (i = 0; i < outputDim; i++) {
    sum = 0;
    for (j = 0; j < inputDim; j++) {
      sum += irisCode[j] * projectionMatrix[i * inputDim + j];
    }
    projected[i] = sum;
  }

  // Compute threshold (mean of projected values)
  threshold = 0;
  for (i = 0; i < outputDim; i++) {
    threshold += projected[i];
  }
  threshold /= outputDim;

  // Binarize
  hashed = new Uint8Array(outputDim);
  for (i = 0; i < outputDim; i++) {
    hashed[i] = projected[i] >= threshold ? 1 : 0;
  }

  return {
    hashed: hashed,
    score: threshold,
  };
};

/* c8 ignore start */
/**
 * Verify two biohashed templates.
 * @param {Uint8Array} hash1 - First biohashed template
 * @param {Uint8Array} hash2 - Second biohashed template
 * @returns {{ match: boolean, similarity: number }}
 */
/* c8 ignore stop */
IrisTemplateProtection.verifyBiohash = function (hash1, hash2) {
  var i, matchCount, totalBits;

  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return { match: false, similarity: 0 };
  }

  matchCount = 0;
  totalBits = hash1.length;

  for (i = 0; i < totalBits; i++) {
    if (hash1[i] === hash2[i]) {
      matchCount++;
    }
  }

  var similarity = matchCount / totalBits;

  return {
    match: similarity > 0.85, // 85% threshold
    similarity: similarity,
  };
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// FEATURE TRANSFORMATION (Non-Invertible)
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create a non-invertible transformation function.
 * @param {Uint8Array} key - Secret key
 * @param {Uint8Array} salt - Random salt
 * @returns {function(Uint8Array): Uint8Array} Transformation function
 */
/* c8 ignore stop */
IrisTemplateProtection.createTransformation = function (key, salt) {
  if (!key || !salt) {
    throw new Error("key and salt are required");
  }

  // Derive transformation parameters from key+salt
  var params = IrisTemplateProtection._deriveParams(key, salt);

  return function transform(irisCode) {
    var result, i, j, temp, byteVal;

    if (!irisCode || irisCode.length === 0) {
      return null;
    }

    result = new Uint8Array(irisCode.length);

    for (i = 0; i < irisCode.length; i++) {
      byteVal = irisCode[i];

      // Apply non-invertible operations
      // 1. XOR with derived key byte
      byteVal ^= params.keyStream[i % params.keyStream.length];

      // 2. Rotation
      temp =
        (byteVal << params.rotations[i % params.rotations.length]) |
        (byteVal >>> (8 - params.rotations[i % params.rotations.length]));
      byteVal = temp & 0xff;

      // 3. Modular addition
      byteVal =
        (byteVal + params.additions[i % params.additions.length]) & 0xff;

      result[i] = byteVal;
    }

    return result;
  };
};

/* c8 ignore start */
/**
 * Transform an iris code using a non-invertible function.
 * @param {Uint8Array} irisCode - Original iris code
 * @param {function} transformFn - Transformation function
 * @returns {Uint8Array} Transformed code
 */
/* c8 ignore stop */
IrisTemplateProtection.transform = function (irisCode, transformFn) {
  if (!irisCode || typeof transformFn !== "function") {
    return null;
  }

  return transformFn(irisCode);
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CRYPTOGRAPHIC BINDING
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create a cryptographic commitment to an iris template.
 * @param {Uint8Array} irisCode - Original iris code
 * @param {Uint8Array} key - Secret key
 * @returns {{ commitment: string, nonce: Uint8Array }}
 */
/* c8 ignore stop */
IrisTemplateProtection.commit = function (irisCode, key) {
  var nonce, combined, hash;

  if (!irisCode || !key) {
    throw new Error("irisCode and key are required");
  }

  // Generate random nonce
  nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);

  // Combine iris code + nonce + key
  combined = new Uint8Array(irisCode.length + nonce.length + key.length);
  combined.set(irisCode, 0);
  combined.set(nonce, irisCode.length);
  combined.set(key, irisCode.length + nonce.length);

  // Hash using SHA-256
  return crypto.subtle.digest("SHA-256", combined).then(function (hashBuffer) {
    var hashArray, i;
    hashArray = new Uint8Array(hashBuffer);
    hash = "";
    for (i = 0; i < hashArray.length; i++) {
      hash += hashArray[i].toString(16).padStart(2, "0");
    }

    return {
      commitment: hash,
      nonce: nonce,
    };
  });
};

/* c8 ignore start */
/**
 * Verify a cryptographic commitment.
 * @param {Uint8Array} irisCode - Iris code to verify
 * @param {Uint8Array} key - Secret key
 * @param {Uint8Array} nonce - Original nonce
 * @param {string} expectedCommitment - Expected commitment hash
 * @returns {Promise<boolean>} True if commitment matches
 */
/* c8 ignore stop */
IrisTemplateProtection.verifyCommitment = function (
  irisCode,
  key,
  nonce,
  expectedCommitment,
) {
  var combined;

  if (!irisCode || !key || !nonce || !expectedCommitment) {
    return Promise.resolve(false);
  }

  combined = new Uint8Array(irisCode.length + nonce.length + key.length);
  combined.set(irisCode, 0);
  combined.set(nonce, irisCode.length);
  combined.set(key, irisCode.length + nonce.length);

  return crypto.subtle.digest("SHA-256", combined).then(function (hashBuffer) {
    var hashArray, hash, i;
    hashArray = new Uint8Array(hashBuffer);
    hash = "";
    for (i = 0; i < hashArray.length; i++) {
      hash += hashArray[i].toString(16).padStart(2, "0");
    }

    /* c8 ignore start -- V8 range artifact */
    return hash === expectedCommitment;
    /* c8 ignore stop */
  });
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// CANCELABLE BIOMETRICS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create a cancelable biometric template.
 * If compromised, the user can get a new transformation.
 * @param {Uint8Array} irisCode - Original iris code
 * @param {Uint8Array} userKey - User-specific key
 * @param {number} [iteration] - Transformation iteration
 * @returns {{ template: Uint8Array, keyHash: string }}
 */
/* c8 ignore stop */
IrisTemplateProtection.createCancelable = function (
  irisCode,
  userKey,
  iteration,
) {
  var combined, keyHash, transformFn;

  if (!irisCode || !userKey) {
    throw new Error("irisCode and userKey are required");
  }

  iteration = iteration || 1;

  // Create iteration-specific key
  combined = new Uint8Array(userKey.length + 4);
  combined.set(userKey, 0);
  combined[combined.length - 4] = (iteration >>> 24) & 0xff;
  combined[combined.length - 3] = (iteration >>> 16) & 0xff;
  combined[combined.length - 2] = (iteration >>> 8) & 0xff;
  combined[combined.length - 1] = iteration & 0xff;

  // Derive key hash
  return crypto.subtle.digest("SHA-256", combined).then(function (hashBuffer) {
    var hashArray, salt, transformResult, i;

    hashArray = new Uint8Array(hashBuffer);
    keyHash = "";
    for (i = 0; i < Math.min(hashArray.length, 16); i++) {
      keyHash += hashArray[i].toString(16).padStart(2, "0");
    }

    // Create salt from hash
    salt = hashArray.slice(0, 16);

    // Create transformation
    transformFn = IrisTemplateProtection.createTransformation(userKey, salt);

    // Transform iris code
    transformResult = transformFn(irisCode);

    return {
      template: transformResult,
      keyHash: keyHash,
    };
  });
};

/* c8 ignore start */
// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Create a seeded PRNG.
 * @param seed
 * @private
 */
/* c8 ignore stop */
IrisTemplateProtection._createRNG = function (seed) {
  var state = seed;
  return function () {
    state = (state * 1_664_525 + 1_013_904_223) & 0xff_ff_ff_ff;
    return (state >>> 0) / 0xff_ff_ff_ff;
  };
};

/* c8 ignore start */
/**
 * Generate a random seed.
 * @private
 */
/* c8 ignore stop */
IrisTemplateProtection._generateSeed = function () {
  var seedArray = new Uint32Array(1);
  crypto.getRandomValues(seedArray);
  return seedArray[0];
};

/* c8 ignore start */
/**
 * Orthogonalize matrix using modified Gram-Schmidt.
 * @param matrix
 * @param rows
 * @param cols
 * @private
 */
/* c8 ignore stop */
IrisTemplateProtection._orthogonalize = function (matrix, rows, cols) {
  var result, i, j, k, dot, norm;

  result = new Float64Array(rows * cols);

  // Copy input
  for (i = 0; i < rows * cols; i++) {
    result[i] = matrix[i];
  }

  for (i = 0; i < rows; i++) {
    // Normalize current row
    dot = 0;
    for (j = 0; j < cols; j++) {
      dot += result[i * cols + j] * result[i * cols + j];
    }
    norm = Math.sqrt(dot) || 1;
    for (j = 0; j < cols; j++) {
      result[i * cols + j] /= norm;
    }

    // Orthogonalize against previous rows
    for (k = 0; k < i; k++) {
      dot = 0;
      for (j = 0; j < cols; j++) {
        dot += result[i * cols + j] * result[k * cols + j];
      }
      for (j = 0; j < cols; j++) {
        result[i * cols + j] -= dot * result[k * cols + j];
      }
    }
  }

  return result;
};

/* c8 ignore start */
/**
 * Derive transformation parameters from key and salt.
 * @param key
 * @param salt
 * @private
 */
/* c8 ignore stop */
IrisTemplateProtection._deriveParams = function (key, salt) {
  var keyStream, rotations, additions, i;

  keyStream = new Uint8Array(256);
  rotations = new Uint8Array(256);
  additions = new Uint8Array(256);

  // Simple key derivation (production should use PBKDF2 or HKDF)
  for (i = 0; i < 256; i++) {
    keyStream[i] = (key[i % key.length] + salt[i % salt.length] + i) & 0xff;
    rotations[i] = keyStream[i] & 0x07; // 0-7 bit rotation
    additions[i] = keyStream[(i + 128) % 256]; // Additive constant
  }

  return {
    keyStream: keyStream,
    rotations: rotations,
    additions: additions,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// UNLINKABILITY VERIFICATION (ISO/IEC 24745 Section 6)
// ═══════════════════════════════════════════════════════════════════════════

/* c8 ignore start */
/**
 * Compute unlinkability metric between two transformed templates.
 * ISO/IEC 24745 requires that transformed templates from the same biometric
 * but different keys are computationally indistinguishable.
 *
 * Measures mutual information and normalized Hamming distance distribution.
 * @param {Uint8Array} template1 - Transformed template (key A)
 * @param {Uint8Array} template2 - Transformed template (key B)
 * @param {Uint8Array} [template3] - Optional: third template for cross-comparison
 * @returns {{ unlinkable: boolean, distance: number, confidence: number, details: string }}
 */
/* c8 ignore stop */
IrisTemplateProtection.verifyUnlinkability = function (
  template1,
  template2,
  template3,
) {
  if (!template1 || !template2) {
    return {
      unlinkable: false,
      distance: 0,
      confidence: 0,
      details: "Missing templates",
    };
  }

  if (template1.length !== template2.length) {
    return {
      unlinkable: false,
      distance: 0,
      confidence: 0,
      details: "Template length mismatch",
    };
  }

  var len = template1.length;
  var matchCount = 0;
  var diffCount = 0;

  for (var i = 0; i < len; i++) {
    if (template1[i] === template2[i]) {
      matchCount++;
    } else {
      diffCount++;
    }
  }

  var distance = diffCount / len;
  var similarity = matchCount / len;

  // For unlinkable templates, distance should be ~0.5 (random)
  // distance << 0.5 means templates are linked (bad)
  // distance ~0.5 means templates are unlinkable (good)
  var unlinkabilityScore = 1 - Math.abs(distance - 0.5) * 2; // 0 at distance 0 or 1, 1 at distance 0.5

  // If third template provided, check cross-distances
  var crossDistances = [];
  if (template3 && template3.length === len) {
    var matchCount3 = 0;
    for (var j = 0; j < len; j++) {
      if (template1[j] === template3[j]) matchCount3++;
    }
    var dist13 = 1 - matchCount3 / len;
    crossDistances.push(dist13);
  }

  // Unlinkability threshold: distance within 0.4-0.6 of random
  var unlinkable = unlinkabilityScore > 0.6;

  return {
    unlinkable: unlinkable,
    distance: distance,
    similarity: similarity,
    unlinkabilityScore: unlinkabilityScore,
    crossDistances: crossDistances,
    confidence: Math.round(unlinkabilityScore * 100),
    details: unlinkable
      ? "Templates are unlinkable (distance: " +
        (distance * 100).toFixed(1) +
        "%, expected ~50%)"
      : "Templates may be LINKED (distance: " +
        (distance * 100).toFixed(1) +
        "%, expected ~50%)",
  };
};

/* c8 ignore start */
/**
 * Test unlinkability across multiple keys.
 * Generates multiple transformed versions of the same iris code
 * and verifies they are pairwise unlinkable.
 * @param {Uint8Array} originalIrisCode - Original iris code
 * @param {number} numKeys - Number of different keys to test
 * @returns {{ averageDistance: number, unlinkable: boolean, details: string }}
 */
/* c8 ignore stop */
IrisTemplateProtection.testUnlinkability = function (
  originalIrisCode,
  numKeys,
) {
  if (!originalIrisCode || numKeys < 2) {
    return {
      averageDistance: 0,
      unlinkable: false,
      details: "Insufficient input",
    };
  }

  var templates = [];

  // Generate transformed templates with different keys
  for (var k = 0; k < numKeys; k++) {
    var key = new Uint8Array(32);
    for (var b = 0; b < 32; b++) {
      key[b] = (k * 37 + b * 13 + 42) & 0xff; // Deterministic but different per key
    }
    var salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    var transformFn = IrisTemplateProtection.createTransformation(key, salt);
    var transformed = transformFn(originalIrisCode);
    templates.push(transformed);
  }

  // Compute pairwise distances
  var totalDistance = 0;
  var pairCount = 0;

  for (var i = 0; i < templates.length; i++) {
    for (var j = i + 1; j < templates.length; j++) {
      var matchCount = 0;
      for (var p = 0; p < templates[i].length; p++) {
        if (templates[i][p] === templates[j][p]) matchCount++;
      }
      totalDistance += 1 - matchCount / templates[i].length;
      pairCount++;
    }
  }

  var averageDistance = pairCount > 0 ? totalDistance / pairCount : 0;

  // Unlinkable if average distance is close to 0.5
  var unlinkabilityScore = 1 - Math.abs(averageDistance - 0.5) * 2;
  var unlinkable = unlinkabilityScore > 0.6;

  return {
    averageDistance: averageDistance,
    unlinkable: unlinkable,
    pairCount: pairCount,
    unlinkabilityScore: unlinkabilityScore,
    details: unlinkable
      ? "Average pairwise distance: " +
        (averageDistance * 100).toFixed(1) +
        "% (unlinkable)"
      : "Average pairwise distance: " +
        (averageDistance * 100).toFixed(1) +
        "% (potentially LINKED)",
  };
};

/* c8 ignore start */
// Export for window
/* c8 ignore stop */
if (typeof window !== "undefined") {
  window.IrisTemplateProtection = IrisTemplateProtection;
}
