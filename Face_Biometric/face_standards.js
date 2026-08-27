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
// ── Face Standards: ISO/IEC 19794-5 face image data interchange format ──

/**
 * ISO/IEC 19794-5:2011 Face Image Data Standard
 * Defines face image interchange formats for biometric enrolment, verification and identification.
 *
 * @constructor
 */
function FaceStandards() {}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard biometric header constants (CBEFF compliant).
 */
FaceStandards.CBEFF = {
  BDB_HEADER_SIZE: 35,
  SBH_OWNER: 0x00,
  SBH_TYPE: 0x08,
  SBH_VERSION: 0x10,
};

/**
 * Feature types defined in ISO/IEC 19794-5.
 */
FaceStandards.FEATURE_TYPE = {
  FULL_FACE: 0,
  INNER_EYE_LEFT: 1,
  INNER_EYE_RIGHT: 2,
  EYE: 3,
  NOSE: 4,
  MOUTH: 5,
  LEFT_CHEEK: 6,
  RIGHT_CHEEK: 7,
  CHIN: 8,
  FOREHEAD: 9,
  JAW: 10,
};

/**
 * Face image quality levels.
 */
FaceStandards.QUALITY_LEVEL = {
  LOW: { min: 0, max: 25, label: "Low" },
  MEDIUM: { min: 26, max: 50, label: "Medium" },
  HIGH: { min: 51, max: 75, label: "High" },
  VERY_HIGH: { min: 76, max: 100, label: "Very High" },
};

/**
 * Standard face image dimensions.
 */
FaceStandards.DIMENSIONS = {
  MIN_WIDTH: 90,
  MIN_HEIGHT: 120,
  RECOMMENDED_WIDTH: 320,
  RECOMMENDED_HEIGHT: 480,
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  PIXEL_DEPTH: 8,
  FACE_RATIO_MIN: 0.5,
  FACE_RATIO_MAX: 0.85,
};

/**
 * Compression types.
 */
FaceStandards.COMPRESSION = {
  UNCOMPRESSED: 0,
  JPEG_LOSSLESS: 1,
  JPEG_2000_LOSSLESS: 2,
  PNG: 3,
  JPEG_LOSSY: 4,
  JPEG_2000_LOSSY: 5,
};

/**
 * Pose angles.
 */
FaceStandards.POSE = {
  FRONTAL: 0,
  SLIGHT_LEFT: 1,
  SLIGHT_RIGHT: 2,
  PROFILE_LEFT: 3,
  PROFILE_RIGHT: 4,
};

// ═══════════════════════════════════════════════════════════════════════════
// FACE IMAGE RECORD FORMAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an ISO/IEC 19794-5 compliant face image record.
 *
 * @param {object} params
 * @param {ImageData|HTMLCanvasElement|HTMLVideoElement} params.image - Source image
 * @param {string} [params.gender] - "male" or "female"
 * @param {number} [params.estimatedAge] - Estimated age
 * @param {number} [params.pose] - Pose angle
 * @param {number} [params.qualityScore] - Quality 0-100
 * @param {object} [params.features] - Facial features
 * @param {object} [params.features.leftEye] - Left eye {x, y}
 * @param {object} [params.features.rightEye] - Right eye {x, y}
 * @param {object} [params.features.noseTip] - Nose tip {x, y}
 * @param {object} [params.features.mouthCenter] - Mouth center {x, y}
 * @returns {object} ISO-compliant face record
 */
FaceStandards.createRecord = function (params) {
  var record, imageData, width, height, quality;

  if (!params || !params.image) {
    throw new Error("FaceStandards.createRecord: image is required");
  }

  imageData = FaceStandards._extractImageData(params.image);
  width = imageData.width;
  height = imageData.height;
  quality = params.qualityScore !== undefined ? params.qualityScore : 50;

  record = {
    // CBEFF header
    cbeff: {
      headerSize: FaceStandards.CBEFF.BDB_HEADER_SIZE,
      owner: FaceStandards.CBEFF.SBH_OWNER,
      type: FaceStandards.CBEFF.SBH_TYPE,
      version: FaceStandards.CBEFF.SBH_VERSION,
    },
    // Image metadata
    width: width,
    height: height,
    pixelDepth: FaceStandards.DIMENSIONS.PIXEL_DEPTH,
    // Demographics
    gender: params.gender || "unknown",
    estimatedAge: params.estimatedAge || 0,
    // Pose
    pose: params.pose || FaceStandards.POSE.FRONTAL,
    // Quality
    qualityScore: Math.max(0, Math.min(100, quality)),
    qualityLevel: FaceStandards._getQualityLevel(quality),
    // Compression
    compressionType: params.compressionType || FaceStandards.COMPRESSION.UNCOMPRESSED,
    // Facial features
    features: params.features || {},
    // Timestamp
    timestamp: new Date().toISOString(),
    // Image data
    imageData: imageData.data,
  };

  return record;
};

/**
 * Validate a face record against ISO/IEC 19794-5 requirements.
 *
 * @param {object} record - Face record to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
FaceStandards.validateRecord = function (record) {
  var errors = [], warnings = [];

  if (!record) {
    return { valid: false, errors: ["Record is null or undefined"], warnings: [] };
  }

  // Check required fields
  if (!record.width || !record.height) {
    errors.push("Missing width or height");
  }

  // Check minimum dimensions
  if (record.width < FaceStandards.DIMENSIONS.MIN_WIDTH || record.height < FaceStandards.DIMENSIONS.MIN_HEIGHT) {
    errors.push("Image dimensions below minimum: " + record.width + "x" + record.height +
      " (min: " + FaceStandards.DIMENSIONS.MIN_WIDTH + "x" + FaceStandards.DIMENSIONS.MIN_HEIGHT + ")");
  }

  // Check recommended dimensions
  if (record.width < FaceStandards.DIMENSIONS.RECOMMENDED_WIDTH || record.height < FaceStandards.DIMENSIONS.RECOMMENDED_HEIGHT) {
    warnings.push("Image below recommended dimensions: " + record.width + "x" + record.height);
  }

  // Check pixel depth
  if (record.pixelDepth !== 8) {
    warnings.push("Pixel depth should be 8 bits per pixel");
  }

  // Check quality
  if (record.qualityScore < 51) {
    warnings.push("Quality score " + record.qualityScore + " is below recommended minimum (51)");
  }

  // Check pose
  if (record.pose === undefined || record.pose === null) {
    warnings.push("Pose angle not specified");
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// FACE TEMPLATE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a standards-compliant face template.
 *
 * @param {Float32Array|Float64Array} embedding - Face embedding vector
 * @param {object} [metadata] - Optional metadata
 * @returns {object} Compliant template
 */
FaceStandards.createTemplate = function (embedding, metadata) {
  if (!embedding) {
    throw new Error("FaceStandards.createTemplate: embedding is required");
  }

  return {
    version: "1.0",
    format: "ISO/IEC 19794-5 FaceEmbedding",
    embeddingLength: embedding.length,
    embedding: embedding,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
    checksum: FaceStandards._computeChecksum(embedding),
  };
};

/**
 * Validate a face template.
 *
 * @param {object} template - Template to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
FaceStandards.validateTemplate = function (template) {
  var errors = [];

  if (!template) {
    return { valid: false, errors: ["Template is null or undefined"] };
  }

  if (!template.embedding || !(template.embedding instanceof Float32Array || template.embedding instanceof Float64Array)) {
    errors.push("Invalid or missing embedding (must be Float32Array or Float64Array)");
  }

  if (template.embeddingLength && template.embedding && template.embeddingLength !== template.embedding.length) {
    errors.push("embeddingLength mismatch with actual embedding length");
  }

  // Validate checksum
  if (template.checksum && template.embedding) {
    var expected = FaceStandards._computeChecksum(template.embedding);
    if (template.checksum !== expected) {
      errors.push("Checksum mismatch - template may be corrupted");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialize a face record to binary format.
 *
 * @param {object} record - Face record
 * @returns {Uint8Array} Binary data
 */
FaceStandards.serialize = function (record) {
  var validation, header, data;

  validation = FaceStandards.validateRecord(record);
  if (!validation.valid) {
    throw new Error("Invalid record: " + validation.errors.join(", "));
  }

  // Create header
  header = new Uint8Array(FaceStandards.CBEFF.BDB_HEADER_SIZE);
  header[0] = record.cbeff.headerSize;
  header[1] = record.cbeff.owner;
  header[2] = record.cbeff.type;
  header[3] = record.cbeff.version;
  header[4] = (record.width >> 8) & 0xff;
  header[5] = record.width & 0xff;
  header[6] = (record.height >> 8) & 0xff;
  header[7] = record.height & 0xff;
  header[8] = record.pixelDepth;
  header[9] = record.gender === "male" ? 0 : record.gender === "female" ? 1 : 2;
  header[10] = record.pose;
  header[11] = record.compressionType;
  header[12] = record.qualityScore;
  header[13] = Math.min(255, Math.max(0, record.estimatedAge));

  // Combine header and image data
  data = new Uint8Array(header.length + (record.imageData ? record.imageData.length : 0));
  data.set(header);
  if (record.imageData) {
    data.set(record.imageData instanceof Uint8Array ? record.imageData : new Uint8Array(record.imageData), header.length);
  }

  return data;
};

/**
 * Deserialize binary data to a face record.
 *
 * @param {Uint8Array} data - Binary data
 * @returns {object} Face record
 */
FaceStandards.deserialize = function (data) {
  if (!data || data.length < FaceStandards.CBEFF.BDB_HEADER_SIZE) {
    throw new Error("Invalid data: too short");
  }

  var gender;
  switch (data[9]) {
    case 0: gender = "male"; break;
    case 1: gender = "female"; break;
    default: gender = "unknown";
  }

  return {
    cbeff: {
      headerSize: data[0],
      owner: data[1],
      type: data[2],
      version: data[3],
    },
    width: (data[4] << 8) | data[5],
    height: (data[6] << 8) | data[7],
    pixelDepth: data[8],
    gender: gender,
    pose: data[10],
    compressionType: data[11],
    qualityScore: data[12],
    estimatedAge: data[13],
    qualityLevel: FaceStandards._getQualityLevel(data[12]),
    imageData: data.length > FaceStandards.CBEFF.BDB_HEADER_SIZE
      ? data.slice(FaceStandards.CBEFF.BDB_HEADER_SIZE)
      : null,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract image data from various sources.
 * @private
 */
FaceStandards._extractImageData = function (input) {
  var canvas, ctx;

  if (input instanceof ImageData) {
    return { data: input.data, width: input.width, height: input.height };
  }

  canvas = document.createElement("canvas");

  if (input instanceof HTMLVideoElement) {
    canvas.width = input.videoWidth || input.width;
    canvas.height = input.videoHeight || input.height;
  } else if (input instanceof HTMLImageElement) {
    canvas.width = input.naturalWidth || input.width;
    canvas.height = input.naturalHeight || input.height;
  } else if (input instanceof HTMLCanvasElement) {
    canvas = input;
  } else {
    throw new Error("Unsupported image input type");
  }

  ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2D context");
  }

  if (!(input instanceof HTMLCanvasElement)) {
    ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Get quality level from score.
 * @private
 */
FaceStandards._getQualityLevel = function (score) {
  if (score >= 76) return FaceStandards.QUALITY_LEVEL.VERY_HIGH;
  if (score >= 51) return FaceStandards.QUALITY_LEVEL.HIGH;
  if (score >= 26) return FaceStandards.QUALITY_LEVEL.MEDIUM;
  return FaceStandards.QUALITY_LEVEL.LOW;
};

/**
 * Compute simple checksum for data integrity.
 * @private
 */
FaceStandards._computeChecksum = function (data) {
  var hash = 0, i;
  for (i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + (typeof data[i] === "number" ? data[i] : 0)) | 0;
  }
  return hash.toString(16);
};

// Export for window
if (typeof window !== "undefined") {
  window.FaceStandards = FaceStandards;
}
