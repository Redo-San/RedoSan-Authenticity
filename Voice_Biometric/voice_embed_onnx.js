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
// ── Voice ONNX Embedder: SpeechBrain ECAPA-TDNN (spkrec-ecapa-voxceleb) ──

/**
 * Optional high-accuracy speaker embedder. Uses the SpeechBrain ECAPA-TDNN
 * speaker embedding model (192-d vectors) through onnxruntime-web.
 *
 * The ONNX model consumes SpeechBrain-compatible fbank features (80 mel
 * bands, sentence mean-subtracted per band) — NOT raw audio. Feed it the
 * output of `VoiceFeatures.computeLogMel()` directly:
 *
 *   var mel = VoiceFeatures.computeLogMel(pcm, fbank, 16000);
 *   await VoiceONNXEmbedder.load();
 *   var emb = await VoiceONNXEmbedder.embed(mel); // [1, 192] -> Float32Array(192)
 *
 * Loads lazily (runtime + ~83 MB model on first use). Execution providers
 * are tried in order webgpu → wasm → cpu. When the runtime or model cannot
 * be loaded, load() returns false and the caller falls back to a lighter
 * embedder — this module never throws on load failures.
 *
 * Model integrity: when the default MODEL_URL is loaded (or an explicit
 * modelSha256 is given), the bytes are fetched first and verified against
 * MODEL_SHA256 via crypto.subtle.digest("SHA-256") (W3C SRI pattern) BEFORE
 * an inference session is created. A mismatch or a missing WebCrypto API
 * fails the load — no unverified model is ever executed.
 *
 * ── Provenance & licensing (be precise; this is a third-party weight set) ──
 *   Architecture : ECAPA-TDNN (Desplanques, Thienpondt & Demuynck,
 *                  Interspeech 2020). Produces a 192-d speaker embedding,
 *                  compared by cosine similarity. Trained on VoxCeleb1+2.
 *   Source model : `model/ecapa-speaker-v1.onnx` from
 *                  vedk00/ecapa-voxceleb-speaker-embedding-onnx — a portable
 *                  ONNX conversion of the upstream SpeechBrain
 *                  `spkrec-ecapa-voxceleb` model (mirrors the frozen
 *                  SpeechBrain mel filterbank as `model/fbank-80x201-f32.bin`,
 *                  byte-identical to `Voice_Biometric/models/`). The ONNX
 *                  graph takes `features` [1, frames, 80]
 *                  (mean-normalized fbank) + `feature_lens` [1] (length
 *                  fraction; 1.0 for a full utterance) and returns
 *                  `embedding` [1, 192]. Integrity pinned by MODEL_SHA256.
 *   Upstream    : speechbrain/spkrec-ecapa-voxceleb (SpeechBrain, arXiv:
 *                  2106.04624). Weights derived from the upstream release.
 *   Model license: Apache-2.0 (upstream SpeechBrain model and the ONNX
 *                  conversion package carry an Apache-2.0 license).
 *   This file    : The wrapper/loader code in this repository is GPL-2.0.
 *                  GPL-2.0 covers OUR code, NOT the model weights —
 *                  shipping this file does not change the Apache-2.0 terms
 *                  of the `ecapa-speaker-v1.onnx` weights.
 */
var VoiceONNXEmbedder = {
  /** Embedding version label stored in the registry/report. */
  VERSION: "ecapa-tdnn",
  /** Input kind discriminator: 'waveform' feeds raw PCM, 'fbank' feeds mel. */
  INPUT_KIND: "fbank",
  /** Embedding dimensionality produced by the model. */
  DIMS: 192,
  /** Number of mel bands the model consumes (SpeechBrain fbank). */
  N_MELS: 80,
  /** Default ECAPA-TDNN ONNX model URL (vedk00 conversion, Apache-2.0). */
  MODEL_URL:
    "https://huggingface.co/vedk00/ecapa-voxceleb-speaker-embedding-onnx/resolve/main/model/ecapa-speaker-v1.onnx",
  /**
   * ONNX SHA-256, verified at runtime before session creation (see load()).
   * Measured from the upstream artifact at revision
   * a9cb9321b07b4ee5b0ea47fdd25242d9cacd824a (2026-09-08); enforced whenever
   * the default model URL is used.
   */
  MODEL_SHA256:
    "f46380bbaeddb929fb3a10ab63a4b1877a50e3d1e5fdd55a1b618d5651d3f64e",
  /** Default onnxruntime-web UMD bundle URL. */
  RUNTIME_URL:
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  /** Default model input tensor name (fbank features [1, frames, 80]). */
  INPUT_NAME: "features",
  /** Default model input tensor name (length fraction [1]; 1.0 = full). */
  INPUT_LENS_NAME: "feature_lens",
  /** Default model output tensor name. */
  OUTPUT_NAME: "embedding",

  _runtime: null,
  _session: null,
  _backend: null,
  _error: null,
  /**
   * Pre-normalization L2 magnitude of the last embedding (raw fbank-driven
   * x-vector). Set after every successful embed() and nulled by reset().
   * Consumers use it as a non-speech honesty signal alongside the waveform
   * embedder's counterpart (see VoiceWavlmEmbedder).
   */
  lastMagnitude: null,

  /** @returns {boolean} */
  isReady: function () {
    return !!this._session;
  },

  /** @returns {string|null} active execution provider ('webgpu' | 'wasm' | 'cpu') */
  getBackend: function () {
    return this._backend;
  },

  /** @returns {string|null} last load error message */
  getError: function () {
    return this._error;
  },

  /** Drop any loaded session/runtime (mainly for tests). */
  reset: function () {
    this._runtime = null;
    this._session = null;
    this._backend = null;
    this._error = null;
    this.lastMagnitude = null;
  },

  /**
   * Load the ONNX runtime (lazy) and the ECAPA-TDNN model.
   *
   * Verification rules: when the default model URL is used (or an explicit
   * `modelSha256` is provided), the model bytes are fetched and verified
   * against the expected SHA-256 before a session is created. Verification
   * is skipped only when a runtime is injected (`options.runtime`, the test
   * seam) unless `options.verifyModel: true` forces it, or when
   * `options.verifyModel: false` explicitly opts out.
   * @param {object} [options]
   * @param {object} [options.runtime] Injected ort-compatible runtime (tests)
   * @param {string} [options.runtimeUrl] Runtime bundle URL override
   * @param {string} [options.modelUrl] Model URL override
   * @param {string} [options.modelSha256] Expected SHA-256 for a custom model URL
   * @param {boolean} [options.verifyModel] Force/skip integrity verification
   * @returns {Promise<boolean>}
   */
  load: async function (options) {
    var ort, modelUrl, backends, i, err, session, expected, verify, buffer;
    if (this._session) return true;
    options = options || {};
    ort =
      options.runtime ||
      (typeof window !== "undefined" && window.ort ? window.ort : null);
    modelUrl = options.modelUrl || this.MODEL_URL;
    expected =
      options.modelSha256 ||
      (modelUrl === this.MODEL_URL ? this.MODEL_SHA256 : null);
    if (expected) {
      verify =
        options.verifyModel === true ||
        (options.verifyModel !== false && !options.runtime);
      if (verify) {
        try {
          buffer = await this._fetchModelBytes(modelUrl);
          if (!(await this._verifySha256(buffer, expected))) {
            this._error =
              "Model integrity verification failed (SHA-256 mismatch). Refusing to load the model.";
            return false;
          }
        } catch (e) {
          this._error = e.message;
          return false;
        }
      }
    }
    if (!ort) {
      /* c8 ignore next 4 -- options.runtime truthy always satisfies ort above */
      if (options.runtime) {
        this._error = "Provided runtime is unusable.";
        return false;
      }
      try {
        ort = await this._loadRuntime(options.runtimeUrl || this.RUNTIME_URL);
      } catch (e) {
        this._error = e.message;
        return false;
      }
    }
    this._runtime = ort;
    /* c8 ignore next 3 -- threading layer stalls the main thread (Atomics.wait
       in onnxruntime-web) on pages that are not cross-origin isolated. */
    if (ort && ort.env && ort.env.wasm) ort.env.wasm.numThreads = 1;
    backends = ["webgpu", "wasm", "cpu"];
    err = null;
    for (i = 0; i < backends.length; i++) {
      try {
        session = await ort.InferenceSession.create(buffer || modelUrl, {
          executionProviders: [backends[i]],
        });
        this._session = session;
        this._backend = backends[i];
        return true;
      } catch (e) {
        err = e;
      }
    }
    /* c8 ignore next -- reaching here implies every provider threw, so err is set */
    this._error = err ? err.message : "No ONNX execution provider succeeded.";
    return false;
  },

  /**
   * Download the model bytes for integrity verification.
   * @param {string} url
   * @returns {Promise<ArrayBuffer>}
   */
  _fetchModelBytes: async function (url) {
    var res;
    if (typeof fetch !== "function") {
      throw new Error("Model integrity verification requires fetch support.");
    }
    res = await fetch(url);
    if (!res.ok)
      throw new Error(
        "Model download failed: HTTP " + res.status + " for " + url,
      );
    return res.arrayBuffer();
  },

  /**
   * Verify bytes against an expected lowercase SHA-256 hex digest using
   * WebCrypto. Throws when crypto.subtle is unavailable (fail closed — an
   * unverifiable model must not run).
   * @param {ArrayBuffer} buffer
   * @param {string} expectedHex
   * @returns {Promise<boolean>}
   */
  _verifySha256: async function (buffer, expectedHex) {
    var digest, i, hex;
    if (
      typeof crypto === "undefined" ||
      !crypto.subtle ||
      typeof crypto.subtle.digest !== "function"
    ) {
      throw new Error(
        "Model integrity verification requires WebCrypto (secure context).",
      );
    }
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
    hex = "";
    for (i = 0; i < digest.length; i++) {
      hex +=
        ((digest[i] >> 4) & 15).toString(16) + (digest[i] & 15).toString(16);
    }
    return hex === expectedHex.toLowerCase();
  },

  /**
   * Inject the onnxruntime-web UMD bundle via a <script> tag.
   * @param {string} url
   * @returns {Promise<object>} window.ort
   */
  _loadRuntime: function (url) {
    return new Promise(function (resolve, reject) {
      var script;
      if (typeof document === "undefined" || !document.createElement) {
        reject(
          new Error("onnxruntime-web is not available in this environment."),
        );
        return;
      }
      script = document.createElement("script");
      script.src = url;
      script.onload = function () {
        if (window.ort) resolve(window.ort);
        else
          reject(
            new Error("window.ort was not found after loading the runtime."),
          );
      };
      script.onerror = function () {
        reject(new Error("Failed to load onnxruntime-web from " + url));
      };
      document.head.appendChild(script);
    });
  },

  /**
   * L2-normalize a descriptor array (or null on failure).
   * @param {ArrayLike<number>} arr
   * @returns {Float32Array|null}
   */
  normalize: function (arr) {
    var out, sum, i, v;
    if (!arr || typeof arr.length !== "number" || arr.length === 0) return null;
    sum = 0;
    for (i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    sum = Math.sqrt(sum);
    if (!isFinite(sum) || sum === 0) return null;
    out = new Float32Array(arr.length);
    for (i = 0; i < arr.length; i++) {
      v = arr[i] / sum;
      out[i] = v;
    }
    return out;
  },

  /**
   * Cosine similarity between two equal-length arrays. Returns a value in
   * [-1, 1], or NaN when either input is empty or zero-magnitude.
   * @param {ArrayLike<number>} a
   * @param {ArrayLike<number>} b
   * @returns {number}
   */
  cosine: function (a, b) {
    var dot = 0,
      na = 0,
      nb = 0,
      i,
      va,
      vb;
    if (!a || !b || a.length !== b.length || a.length === 0) return NaN;
    for (i = 0; i < a.length; i++) {
      va = a[i];
      vb = b[i];
      dot += va * vb;
      na += va * va;
      nb += vb * vb;
    }
    na = Math.sqrt(na);
    nb = Math.sqrt(nb);
    if (na === 0 || nb === 0 || !isFinite(dot)) return NaN;
    return dot / (na * nb);
  },

  /**
   * Embed a full utterance into a normalized 192-d speaker vector.
   *
   * `feat` is the output of `VoiceFeatures.computeLogMel()` — either the
   * returned `{ data, frames }` object (data is [frames × 80] row-major,
   * sentence mean-normalized per band) or a bare Float32Array of exactly
   * `frames × 80` values.
   * @param {{data: Float32Array, frames: number} | Float32Array} feat
   * @returns {Promise<Float32Array|null>}
   */
  embed: async function (feat) {
    var data,
      frames,
      featTensor,
      lensTensor,
      feeds,
      outputs,
      name,
      out,
      i,
      sum,
      rawMag;
    if (!this._session)
      throw new Error("VoiceONNXEmbedder is not loaded. Call load() first.");
    if (!feat) throw new Error("Fbank features are required for embedding.");
    data = feat.data || feat;
    frames = feat.frames;
    if (!(data instanceof Float32Array)) {
      throw new Error("Fbank features must be a Float32Array.");
    }
    if (!(typeof frames === "number" && frames > 0)) {
      frames = data.length / this.N_MELS;
      if (frames !== Math.floor(frames) || frames <= 0)
        throw new Error(
          "Fbank features must have a whole number of frames of " +
            this.N_MELS +
            " bands.",
        );
    }
    if (data.length !== frames * this.N_MELS)
      throw new Error(
        "Fbank features length does not match frames × " + this.N_MELS + ".",
      );
    featTensor = new this._runtime.Tensor("float32", data, [
      1,
      frames,
      this.N_MELS,
    ]);
    lensTensor = new this._runtime.Tensor(
      "float32",
      new Float32Array([1]),
      [1],
    );
    feeds = {};
    feeds[this.INPUT_NAME] = featTensor;
    feeds[this.INPUT_LENS_NAME] = lensTensor;
    outputs = await this._session.run(feeds);
    name = this._session.outputNames && this._session.outputNames[0];
    if (!outputs || !name || !outputs[name] || !outputs[name].data) {
      throw new Error("Unexpected ONNX output shape.");
    }
    if (outputs[name].data.length !== this.DIMS) {
      throw new Error("Unexpected ONNX output shape.");
    }
    rawMag = 0;
    for (i = 0; i < outputs[name].data.length; i++) {
      sum = outputs[name].data[i];
      rawMag += sum * sum;
    }
    rawMag = Math.sqrt(rawMag);
    this.lastMagnitude = isFinite(rawMag) ? rawMag : null;
    out = this.normalize(outputs[name].data);
    if (!out) throw new Error("ONNX embedding could not be normalized.");
    return out;
  },
};

/* c8 ignore start */
if (typeof window !== "undefined") window.VoiceONNXEmbedder = VoiceONNXEmbedder;
/* c8 ignore stop */
