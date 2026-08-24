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
// ── Face ONNX Embedder: MobileFaceNet (ArcFace w600k) via onnxruntime-web ──

/**
 * Optional high-accuracy face embedder. Uses the MobileFaceNet ONNX model
 * (ArcFace w600k, 512-d embeddings) through onnxruntime-web.
 *
 * Loads lazily (runtime + ~13 MB model on first use). Execution providers are
 * tried in order webgpu → wasm → cpu. When the runtime or model cannot be
 * loaded, load() returns false and the caller falls back to the Human HSE
 * embedder — the module never throws on load failures.
 *
 * Model integrity: when the default MODEL_URL is loaded (or an explicit
 * modelSha256 is given), the bytes are fetched first and verified against
 * MODEL_SHA256 via crypto.subtle.digest("SHA-256") (W3C SRI pattern) BEFORE
 * an inference session is created. A mismatch or a missing WebCrypto API
 * fails the load — no unverified model is ever executed.
 *
 * ── Provenance & licensing (be precise; this is a third-party weight set) ──
 *   Architecture : ArcFace (Deng et al., 2019) with a MobileFaceNet backbone;
 *                  produces a 512-d L2-normalised embedding, compared by cosine
 *                  similarity. Training set: WebFace600K ("w600k").
 *   Source model : `w600k_mbf.onnx` (InsightFace). Mirrored here from
 *                  HuggingFace `ykk648/face_lib` (upstream: deepghs/insightface
 *                  & the InsightFace project). Integrity pinned by MODEL_SHA256.
 *   Code license : The InsightFace *library/runtime* code is MIT (permissive,
 *                  incl. commercial use).
 *   Model license: The pre-trained *weights* are released by InsightFace for
 *                  NON-COMMERCIAL RESEARCH USE ONLY; commercial deployment
 *                  requires a separate commercial license from InsightFace.
 *   This file    : The wrapper/loader code in this repository is GPL-2.0.
 *                  GPL-2.0 covers OUR code, NOT the model weights — shipping
 *                  this file does not grant any commercial right to the
 *                  `w600k_mbf.onnx` weights.
 *   Usage here   : On-device, offline, non-commercial / personal authenticity
 *                  verification only. If you deploy commercially, obtain an
 *                  InsightFace commercial license (or substitute a
 *                  properly-licensed embedding model) before distribution.
 */
var FaceONNXEmbedder = {
  /** Embedding version label stored in the registry/report. */
  VERSION: "arcface-mbf",
  /** Embedding dimensionality produced by the model. */
  DIMS: 512,
  /** Default MobileFaceNet (ArcFace w600k) model URL. */
  MODEL_URL:
    "https://huggingface.co/ykk648/face_lib/resolve/main/face_embedding/w600k_mbf.onnx",
  /**
   * ONNX SHA-256, verified at runtime before session creation (see load()).
   * The hash was computed from the upstream artifact (2026-08-17) and is
   * enforced whenever the default model URL is used.
   */
  MODEL_SHA256:
    "9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f",
  /** Default onnxruntime-web UMD bundle URL. */
  RUNTIME_URL:
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  /** Default model input tensor name. */
  INPUT_NAME: "input.1",

  _runtime: null,
  _session: null,
  _backend: null,
  _error: null,
  _inputName: null,

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
    this._inputName = null;
  },

  /**
   * Load the ONNX runtime (lazy) and the MobileFaceNet model.
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
   * @param {string} [options.inputName] Model input tensor name override
   * @returns {Promise<boolean>}
   */
  load: async function (options) {
    var ort,
      modelUrl,
      inputName,
      backends,
      i,
      err,
      session,
      expected,
      verify,
      buffer;
    if (this._session) return true;
    options = options || {};
    ort =
      options.runtime ||
      (typeof window !== "undefined" && window.ort ? window.ort : null);
    modelUrl = options.modelUrl || this.MODEL_URL;
    inputName = options.inputName || this.INPUT_NAME;
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
    this._inputName = inputName;
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
   * Convert a 112×112 RGB(A) canvas into a CHW float32 tensor with the
   * standard ArcFace normalization ((v − 127.5) / 127.5).
   * @param {HTMLCanvasElement} canvas112
   * @returns {Float32Array} 112×112×3 values in CHW order
   */
  preprocess: function (canvas112) {
    var ctx, img, n, out, i, r, g, b;
    if (!canvas112 || typeof canvas112.getContext !== "function") {
      throw new Error("A canvas is required for preprocessing.");
    }
    ctx = canvas112.getContext("2d");
    img = ctx.getImageData(0, 0, canvas112.width, canvas112.height);
    n = canvas112.width * canvas112.height;
    out = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      r = img.data[i * 4];
      g = img.data[i * 4 + 1];
      b = img.data[i * 4 + 2];
      out[i] = (r - 127.5) / 127.5;
      out[n + i] = (g - 127.5) / 127.5;
      out[2 * n + i] = (b - 127.5) / 127.5;
    }
    return out;
  },

  /**
   * L2-normalize a descriptor array in place of its magnitude.
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
   * Embed an aligned 112×112 face canvas into a normalized 512-d descriptor.
   * @param {HTMLCanvasElement} canvas112
   * @returns {Promise<Float32Array|null>}
   */
  embed: async function (canvas112) {
    var input, tensor, feeds, outputs, name, data;
    if (!this._session)
      throw new Error("FaceONNXEmbedder is not loaded. Call load() first.");
    input = this.preprocess(canvas112);
    tensor = new this._runtime.Tensor("float32", input, [
      1,
      3,
      canvas112.width,
      canvas112.height,
    ]);
    feeds = {};
    feeds[this._inputName || this.INPUT_NAME] = tensor;
    outputs = await this._session.run(feeds);
    name = this._session.outputNames && this._session.outputNames[0];
    if (!outputs || !name || !outputs[name] || !outputs[name].data) {
      throw new Error("Unexpected ONNX output shape.");
    }
    data = this.normalize(outputs[name].data);
    if (!data) throw new Error("ONNX embedding could not be normalized.");
    return data;
  },
};

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceONNXEmbedder = FaceONNXEmbedder;
/* c8 ignore stop */
