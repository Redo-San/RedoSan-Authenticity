/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face Anti-Spoof: MiniFASNetV2 (2.7_80x80) via onnxruntime-web ──

/**
 * Optional silent face-anti-spoofing classifier (presentation attack
 * detection, ISO/IEC 30107-3). Uses the MiniFASNetV2 ONNX export from
 * minivision-ai/Silent-Face-Anti-Spoofing (Apache-2.0, redistributed by
 * garciafido) through onnxruntime-web.
 *
 * Model: 80x80 BGR crop (2.7x margin around the face bbox), pixel/255
 * normalization, 3-class softmax [live, print-attack, replay-attack].
 * Liveness score = 1 - (p[print] + p[replay]).
 *
 * Loads lazily (runtime + ~1.7 MB model on first use). Execution providers
 * are tried in order webgpu -> wasm -> cpu. When the runtime or model cannot
 * be loaded, load() returns false and callers fall back to the heuristic
 * liveness results — the module never throws on load failures.
 *
 * Model integrity: when the default MODEL_URL is loaded (or an explicit
 * modelSha256 is given), the bytes are fetched first and verified against
 * MODEL_SHA256 via crypto.subtle.digest("SHA-256") (W3C SRI pattern) BEFORE
 * an inference session is created. A mismatch or a missing WebCrypto API
 * fails the load — no unverified model is ever executed.
 */
var FaceAntiSpoof = {
  /** Model/label stored in liveness evidence. */
  VERSION: "minifasnet-v2",
  /** Class order produced by the model softmax. */
  CLASSES: ["live", "print", "replay"],
  /** Default MiniFASNetV2 (2.7_80x80) ONNX model URL. */
  MODEL_URL:
    "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx",
  /**
   * ONNX SHA-256, verified at runtime before session creation (see load()).
   * The hash was computed from the upstream artifact (2026-08-17) and is
   * enforced whenever the default model URL is used.
   */
  MODEL_SHA256: "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b",
  /** Default onnxruntime-web UMD bundle URL. */
  RUNTIME_URL: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  /** Default model input tensor name. */
  INPUT_NAME: "input",
  /** Default model output tensor name. */
  OUTPUT_NAME: "output",
  /** Model input edge size (80x80). */
  INPUT_SIZE: 80,
  /** Face crop margin multiplier around the bbox center (upstream 2.7). */
  CROP_MARGIN_SCALE: 2.7,

  _runtime: null,
  _session: null,
  _backend: null,
  _error: null,

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
  },

  /**
   * Load the ONNX runtime (lazy) and the MiniFASNet model.
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
    ort = options.runtime || (typeof window !== "undefined" && window.ort ? window.ort : null);
    modelUrl = options.modelUrl || this.MODEL_URL;
    expected = options.modelSha256 || (modelUrl === this.MODEL_URL ? this.MODEL_SHA256 : null);
    if (expected) {
      verify = options.verifyModel === true || (options.verifyModel !== false && !options.runtime);
      if (verify) {
        try {
          buffer = await this._fetchModelBytes(modelUrl);
          if (!(await this._verifySha256(buffer, expected))) {
            this._error = "Model integrity verification failed (SHA-256 mismatch). Refusing to load the model.";
            return false;
          }
        } catch (e) {
          this._error = e.message;
          return false;
        }
      }
    }
    if (!ort) {
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
    backends = ["webgpu", "wasm", "cpu"];
    err = null;
    for (i = 0; i < backends.length; i++) {
      try {
        session = await ort.InferenceSession.create(buffer || modelUrl, { executionProviders: [backends[i]] });
        this._session = session;
        this._backend = backends[i];
        return true;
      } catch (e) {
        err = e;
      }
    }
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
    if (!res.ok) throw new Error("Model download failed: HTTP " + res.status + " for " + url);
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
    if (typeof crypto === "undefined" || !crypto.subtle || typeof crypto.subtle.digest !== "function") {
      throw new Error("Model integrity verification requires WebCrypto (secure context).");
    }
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
    hex = "";
    for (i = 0; i < digest.length; i++) {
      hex += ((digest[i] >> 4) & 15).toString(16) + (digest[i] & 15).toString(16);
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
        reject(new Error("onnxruntime-web is not available in this environment."));
        return;
      }
      script = document.createElement("script");
      script.src = url;
      script.onload = function () {
        if (window.ort) resolve(window.ort);
        else reject(new Error("window.ort was not found after loading the runtime."));
      };
      script.onerror = function () {
        reject(new Error("Failed to load onnxruntime-web from " + url));
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Crop a face region with the 2.7x margin (around the bbox center) and
   * resize it to 80x80. Falls back to the whole canvas when no box is given.
   * @param {HTMLCanvasElement} canvas
   * @param {{x:number, y:number, width:number, height:number}} [box]
   * @returns {HTMLCanvasElement|null}
   */
  cropFace: function (canvas, box) {
    var s, ctx, cx, cy, side, sx, sy, size, out;
    if (!canvas || typeof canvas.getContext !== "function") return null;
    s = this.CROP_MARGIN_SCALE;
    if (box && box.width > 0 && box.height > 0) {
      cx = box.x + box.width / 2;
      cy = box.y + box.height / 2;
      side = Math.max(box.width, box.height) * s;
    } else {
      cx = canvas.width / 2;
      cy = canvas.height / 2;
      side = Math.max(canvas.width, canvas.height);
    }
    sx = Math.max(0, Math.min(canvas.width - 1, cx - side / 2));
    sy = Math.max(0, Math.min(canvas.height - 1, cy - side / 2));
    size = Math.min(side, canvas.width - sx, canvas.height - sy);
    if (size <= 0) return null;
    try {
      out = document.createElement("canvas");
    } catch (e) {
      return null;
    }
    out.width = this.INPUT_SIZE;
    out.height = this.INPUT_SIZE;
    ctx = out.getContext("2d");
    ctx.drawImage(canvas, sx, sy, size, size, 0, 0, this.INPUT_SIZE, this.INPUT_SIZE);
    return out;
  },

  /**
   * Convert an RGB(A) canvas into an NCHW float32 BGR tensor scaled to
   * [0, 1] (pixel / 255) as required by MiniFASNetV2.
   * @param {HTMLCanvasElement} canvas80
   * @returns {Float32Array} 80x80x3 values in BGR CHW order
   */
  preprocess: function (canvas80) {
    var ctx, img, n, out, i, r, g, b;
    if (!canvas80 || typeof canvas80.getContext !== "function") {
      throw new Error("A canvas is required for preprocessing.");
    }
    ctx = canvas80.getContext("2d");
    img = ctx.getImageData(0, 0, canvas80.width, canvas80.height);
    n = canvas80.width * canvas80.height;
    out = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      r = img.data[i * 4] / 255;
      g = img.data[i * 4 + 1] / 255;
      b = img.data[i * 4 + 2] / 255;
      out[i] = b;
      out[n + i] = g;
      out[2 * n + i] = r;
    }
    return out;
  },

  /**
   * Softmax over the raw logits.
   * @param {ArrayLike<number>} logits
   * @returns {Float32Array} probabilities summing to 1
   */
  softmax: function (logits) {
    var out, max, sum, i, v;
    if (!logits || typeof logits.length !== "number" || logits.length === 0) return null;
    out = new Float32Array(logits.length);
    max = logits[0];
    for (i = 1; i < logits.length; i++) if (logits[i] > max) max = logits[i];
    sum = 0;
    for (i = 0; i < logits.length; i++) {
      v = Math.exp(logits[i] - max);
      out[i] = v;
      sum += v;
    }
    if (!isFinite(sum) || sum === 0) return null;
    for (i = 0; i < out.length; i++) out[i] /= sum;
    return out;
  },

  /**
   * Classify a face crop (or full canvas) as live / print / replay.
   * @param {HTMLCanvasElement} canvas
   * @param {{x:number, y:number, width:number, height:number}} [box]
   * @returns {Promise<{live: boolean, score: number, label: string, probabilities: Float32Array|null, classes: Array<string>}>}
   */
  predict: async function (canvas, box) {
    var crop, input, tensor, feeds, outputs, data, probs, liveScore;
    if (!this._session) throw new Error("FaceAntiSpoof is not loaded. Call load() first.");
    crop = this.cropFace(canvas, box);
    if (!crop) throw new Error("Face crop could not be produced.");
    input = this.preprocess(crop);
    tensor = new this._runtime.Tensor("float32", input, [1, 3, this.INPUT_SIZE, this.INPUT_SIZE]);
    feeds = {};
    feeds[this.INPUT_NAME] = tensor;
    outputs = await this._session.run(feeds);
    data = outputs && outputs[this.OUTPUT_NAME] ? outputs[this.OUTPUT_NAME].data : null;
    if (!data || typeof data.length !== "number" || data.length === 0) {
      throw new Error("Unexpected ONNX output shape.");
    }
    probs = this.softmax(data);
    if (!probs) throw new Error("ONNX output could not be normalized.");
    liveScore = 1 - Math.min(1, Math.max(0, probs[1] + probs[2]));
    return {
      live: liveScore >= 0.5,
      score: liveScore,
      label: probs[0] >= 0.5 ? "live" : "spoof",
      probabilities: probs,
      classes: this.CLASSES.slice(),
    };
  },
};

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceAntiSpoof = FaceAntiSpoof;
/* c8 ignore stop */