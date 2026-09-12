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
// ── Voice ONNX Embedder: WavLM Base+ (wavlm-base-plus-sv, 512-d x-vector) ──

/**
 * Optional high-accuracy speaker embedder. Uses the WavLM Base+ (SV
 * fine-tune) speaker embedding model (512-d vectors) through onnxruntime-web.
 *
 * Unlike the ECAPA embedder this model consumes the RAW mono waveform — NOT
 * mel-filterbank features. Feed it the 16 kHz Float32 PCM waveform directly
 * (samples already in the full-scale ±1.0 range), exactly as produced by
 * `decodeAudioFile()`:
 *
 *   await VoiceWavlmEmbedder.load();
 *   var emb = await VoiceWavlmEmbedder.embed(pcm); // [1, seq] -> Float32Array(512)
 *
 * The preprocessor contract is `do_normalize: false` (matches the Hugging Face
 * Wav2Vec2FeatureExtractor used to export this model): the raw PCM is fed
 * unchanged, no z-normalization and no mel conversion. This mirrors the
 * transformers.js preprocessor so embeddings match the reference x-vector.
 *
 * Loads lazily (runtime + ~102 MB model on first use). Execution providers
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
 *   Architecture : WavLM (Microsoft, Chen et al., arXiv:2110.13900, Interspeech
 *                  2022), WavLM-Base+ backbone fine-tuned for speaker
 *                  verification (`wavlm-base-plus-sv`). The ONNX export uses
 *                  the `embeddings` output: a pooled 512-d x-vector compared
 *                  by cosine similarity (the `logits` head is the Softmax
 *                  class-distribution head, not used for speaker scoring).
 *   Source model : `onnx/model_quantized.onnx` from
 *                  `D4ve-R/wavlm-base-plus-sv` — a portable ONNX conversion of
 *                  the upstream Microsoft `microsoft/wavlm-base-plus-sv`
 *                  checkpoint. Model is dynamic-axis for sequence length;
 *                  1 input `input_values` float32 [batch, seq]; outputs
 *                  `logits` [batch, 512] + `embeddings` [batch, 512].
 *   Upstream    : microsoft/wavlm-base-plus-sv (WavLM, trained on
 *                  VoxCeleb1+2 + Libri-Light + others; SV fine-tune).
 *   Model license: Apache-2.0 (Microsoft WavLM release and the conversion
 *                  package both carry an Apache-2.0 license).
 *   This file    : The wrapper/loader code in this repository is GPL-2.0.
 *                  GPL-2.0 covers OUR code, NOT the model weights —
 *                  shipping this file does not change the Apache-2.0 terms
 *                  of the `model_quantized.onnx` weights.
 */
var VoiceWavlmEmbedder = {
  /** Embedding version label stored in the registry/report. */
  VERSION: "wavlm-base-plus-sv",
  /** Embedding dimensionality produced by the model. */
  DIMS: 512,
  /** Input kind discriminator: 'waveform' feeds raw PCM, 'fbank' feeds mel. */
  INPUT_KIND: "waveform",
  /** Input sample rate expected by the model (raw waveform). */
  SAMPLE_RATE: 16000,
  /** Default WavLM Base+ SV ONNX model URL (D4ve-R conversion, Apache-2.0). */
  MODEL_URL:
    "https://huggingface.co/D4ve-R/wavlm-base-plus-sv/resolve/main/onnx/model_quantized.onnx",
  /**
   * ONNX SHA-256, verified at runtime before session creation (see load()).
   * Measured from the upstream artifact (quantized 102,129,359-byte export);
   * enforced whenever the default model URL is used.
   */
  MODEL_SHA256:
    "c491174cc96b657608a9f83922ec1ffcbf424bf4f3b8683f9558692b8c8712e3",
  /** Default onnxruntime-web UMD bundle URL (same pin as the ECAPA embedder). */
  RUNTIME_URL:
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  /** Default model input tensor name (raw waveform [batch, seq]). */
  INPUT_NAME: "input_values",
  /** Default model output tensor name holding the 512-d x-vector. */
  OUTPUT_NAME: "embeddings",
  /** Secondary output (class-distribution head) — documented, not consumed. */
  OUTPUT_LOGITS_NAME: "logits",

  _runtime: null,
  _session: null,
  _backend: null,
  _error: null,
  /**
   * Pre-normalization L2 magnitude of the last embedding (raw x-vector). Set
   * after every successful embed() and nulled by reset(). Consumers use it
   * as a non-speech honesty signal: a near-zero magnitude means the model
   * received (near-)silence even though a quality gate passed.
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
   * Load the ONNX runtime (lazy) and the WavLM Base+ SV model.
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
   * Embed a full utterance into a normalized 512-d speaker x-vector.
   *
   * `pcm` must be a mono Float32 waveform at 16 kHz in the full-scale ±1.0
   * range (Web Audio `getChannelData()` output; no z-normalization — the
   * model preprocessor uses `do_normalize: false`). The pre-normalization
   * L2 magnitude of the raw x-vector is captured in `lastMagnitude` so
   * callers can warn when an input produced a near-zero embedding.
   * @param {Float32Array} pcm
   * @returns {Promise<Float32Array|null>}
   */
  embed: async function (pcm) {
    var wavTensor, feeds, outputs, out, name, i, rawMag, sum;
    if (!this._session)
      throw new Error("VoiceWavlmEmbedder is not loaded. Call load() first.");
    if (!pcm) throw new Error("Raw waveform is required for embedding.");
    if (!(pcm instanceof Float32Array)) {
      throw new Error("Raw waveform must be a Float32Array.");
    }
    if (!(pcm.length > 0)) {
      throw new Error("Raw waveform must contain at least one sample.");
    }
    wavTensor = new this._runtime.Tensor("float32", pcm, [1, pcm.length]);
    feeds = {};
    feeds[this.INPUT_NAME] = wavTensor;
    outputs = await this._session.run(feeds);
    name = this.OUTPUT_NAME;
    if (
      !outputs ||
      !outputs[name] ||
      !outputs[name].data ||
      outputs[name].data.length !== this.DIMS
    ) {
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
if (typeof window !== "undefined")
  window.VoiceWavlmEmbedder = VoiceWavlmEmbedder;
/* c8 ignore stop */
