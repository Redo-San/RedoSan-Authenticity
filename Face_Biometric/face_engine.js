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
// ── Face Engine: detection, descriptor extraction, matching ──

/**
 * @param {object} [options]
 * @param {object} [options.human] Pre-configured Human instance
 * @param {string} [options.modelBasePath] Model base URL
 * @param {boolean} [options.tinyDetector] Use Tiny Face Detector instead of SSD
 */
function FaceEngine(options) {
  this._human = options && options.human ? options.human : null;
  this._modelBasePath =
    options && options.modelBasePath
      ? options.modelBasePath
      : "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";
  this._tinyDetector =
    options && options.tinyDetector ? options.tinyDetector : false;
  this._loaded = false;
}

/**
 * @returns {boolean}
 */
FaceEngine.prototype.isLoaded = function () {
  return this._loaded;
};

/**
 * Load @vladmandic/human models (face detection, landmarks, recognition)
 * @returns {Promise<void>}
 */
FaceEngine.prototype.loadModels = async function () {
  var humanModule, HumanCtor, backend, testCanvas, config, loaded, e2;
  if (this._loaded) return;
  humanModule =
    typeof window !== "undefined" && window.Human ? window.Human : null;
  HumanCtor = this._human
    ? this._human.constructor
    : humanModule
      ? humanModule.Human || humanModule.default || humanModule
      : null;
  if (!HumanCtor)
    throw new Error(
      "@vladmandic/human is not loaded. Include the library via script tag or pass a human instance.",
    );
  if (!this._human) {
    this._human = new HumanCtor({ modelBasePath: this._modelBasePath });
  }
  // Detect WebGL support for backend selection
  backend = "webgl";
  try {
    testCanvas = document.createElement("canvas");
    if (
      !testCanvas.getContext("webgl") &&
      !testCanvas.getContext("experimental-webgl")
    ) {
      backend = "cpu";
    }
  } catch (e) {
    backend = "cpu";
  }
  if (this._webglUnhealthy) backend = "cpu";
  config = {
    backend: backend,
    filter: { enabled: false },
    face: {
      enabled: true,
      detector: { model: "blazeface", minConfidence: 0.1, maxResults: 10 },
      mesh: { enabled: true },
      iris: { enabled: true },
      description: { enabled: true, minConfidence: 0.1 },
      emotion: { enabled: true },
      age: { enabled: true },
      gender: { enabled: true },
      gaze: { enabled: true },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
  };
  async function loadWithTimeout(human, cfg, ms) {
    return Promise.race([
      human.load(cfg),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Model loading timed out"));
        }, ms);
      }),
    ]);
  }
  loaded = false;
  if (backend === "webgl") {
    try {
      await loadWithTimeout(this._human, config, 20000);
      if (this._human.tf && typeof this._human.tf.ready === "function") {
        await this._human.tf.ready();
      }
      loaded = true;
    } catch (e) {
      backend = "cpu";
    }
  }
  if (!loaded) {
    config.backend = "cpu";
    try {
      await loadWithTimeout(this._human, config, 60000);
      loaded = true;
    } catch (e2) {
      this._loaded = false;
      throw e2;
    }
  }
  this._loaded = true;
  this._backend = backend;
};

/**
 * Detect faces and extract descriptors from an input image
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement|ImageData} input
 * @returns {Promise<Array<{box: object, score: number, landmarks: object, mesh: Float32Array|null, descriptor: Float32Array|null, embeddingVersion: string, attributes: object}>>}
 */
FaceEngine.prototype.detectFaces = async function (input) {
  var result, tfLib, canRetry, result2;
  if (!this._loaded)
    throw new Error("Models not loaded. Call loadModels() first.");
  tfLib = this._human && this._human.tf;
  canRetry =
    !!tfLib &&
    typeof tfLib.setBackend === "function" &&
    this._backend === "webgl" &&
    !this._webglUnhealthy;
  try {
    result = await this._human.detect(input);
  } catch (e) {
    if (!canRetry) throw e;
    result = null;
  }
  if (canRetry && (!result || !result.face || result.face.length === 0)) {
    try {
      await tfLib.setBackend("cpu");
      if (typeof tfLib.ready === "function") await tfLib.ready();
      this._backend = "cpu";
      result2 = await this._human.detect(input);
      if (result2 && result2.face && result2.face.length > 0) {
        this._webglUnhealthy = true;
        result = result2;
      } else {
        this._backend = "webgl";
        await tfLib.setBackend("webgl");
      }
    } catch (e2) {
      this._backend = "webgl";
    }
  }
  if (!result || !result.face) return [];
  return result.face.map(function (f) {
    return {
      box: f.box,
      score: f.score,
      landmarks: f.landmarks,
      mesh: f.mesh || null,
      descriptor: f.embedding || f.descriptor || null,
      embeddingVersion: "human-hse",
      attributes: {
        emotion: f.emotion || null,
        age: f.age || null,
        gender: f.gender || null,
        iris: f.iris || null,
        gaze: f.gaze || null,
      },
    };
  });
};

/**
 * Extract descriptor for a specific face detection
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement|ImageData} input
 * @param {object} detection Face detection result with box
 * @returns {Promise<Float32Array|null>}
 */
FaceEngine.prototype.extractDescriptor = async function (input, detection) {
  var faces, i;
  faces = await this.detectFaces(input);
  for (i = 0; i < faces.length; i++) {
    if (
      Math.abs(faces[i].box.x - detection.box.x) < 2 &&
      Math.abs(faces[i].box.y - detection.box.y) < 2
    ) {
      return faces[i].descriptor;
    }
  }
  return null;
};

/**
 * Compute Euclidean distance between two face descriptors
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
FaceEngine.compareDescriptors = function (a, b) {
  var sum, i, d;
  if (!a || !b) return Infinity;
  sum = 0;
  for (i = 0; i < a.length; i++) {
    d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

/**
 * Compute cosine similarity between two face descriptors
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
FaceEngine.cosineSimilarity = function (a, b) {
  var dot, na, nb, i, den;
  if (!a || !b) return -1;
  dot = 0;
  na = 0;
  nb = 0;
  for (i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
};

/**
 * Cosine similarity as a percentage score (0-100)
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Percentage score, 0 for invalid input
 */
FaceEngine.cosineScore = function (a, b) {
  var sim;
  if (!a || !b) return 0;
  sim = FaceEngine.cosineSimilarity(a, b);
  if (!isFinite(sim)) return 0;
  return Math.max(0, Math.min(100, sim * 100));
};

/**
 * Find the best match for a query descriptor in a registry
 * @param {Float32Array} query Query face descriptor
 * @param {Array<{descriptor: Float32Array, label: string}>} registry Array of known faces
 * @param {number} [threshold] Maximum distance threshold (default 0.6)
 * @param {string} [embeddingVersion] Only compare entries with this embedding version; entries with a different known version are skipped
 * @returns {{match: object|null, distance: number}}
 */
FaceEngine.matchInRegistry = function (
  query,
  registry,
  threshold,
  embeddingVersion,
) {
  var best, bestDist, i, dist, entryVersion;
  if (threshold === undefined) threshold = 0.6;
  if (!registry || registry.length === 0) {
    return { match: null, distance: Infinity };
  }
  best = null;
  bestDist = Infinity;
  for (i = 0; i < registry.length; i++) {
    entryVersion = registry[i].embeddingVersion || null;
    if (embeddingVersion && entryVersion && entryVersion !== embeddingVersion) {
      continue;
    }
    dist = FaceEngine.compareDescriptors(query, registry[i].descriptor);
    if (dist < bestDist) {
      bestDist = dist;
      best = registry[i];
    }
  }
  if (bestDist > threshold) {
    return { match: null, distance: bestDist };
  }
  return { match: best, distance: bestDist };
};

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceEngine = FaceEngine;
/* c8 ignore stop */
