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
// ── Voice VAD: Silero VAD v5 (ONNX) browser wrapper ──

/**
 * On-device speech-activity detection for the voice biometric chain. Runs the
 * Silero VAD model (opset 16) through onnxruntime-web with W3C SRI-style
 * SHA-256 verification of the model bytes before any session is created.
 *
 * ── Model contract (verified 2026-09-08 from the actual artifact) ──
 *   Artifact : `silero_vad.onnx` from runanywhere/silero-vad-v5 — byte-identical
 *              to upstream snakers4/silero-vad `silero_vad.onnx` (master).
 *              SHA-256 1a153a22…8788e3, 2 327 524 B, opset 16 (producer: spox).
 *              MIT licensed (more permissive than this repo's GPL-2.0; the
 *              weights are a separately-attributed runtime artifact, same
 *              pattern as the ECAPA-TDNN model — the wrapper here is GPL-2.0).
 *   Inputs  : `input`  float32 [?,?]  — 64 context samples + 512 pcm samples
 *                                       (= 576) per step at 16 kHz.
 *              `state`  float32 [2,?,128] — LSTM hidden/cell state [2,1,128],
 *                                       zero-initialised; MUST be carried across
 *                                       steps (this model is stateful).
 *              `sr`     int64   []     — sample rate scalar (16000).
 *   Outputs : `output`  float32 [?,1]    — per-step speech probability.
 *              `stateN` float32 [?,?,?]  — updated state; feed back as `state`.
 *   Feeding : 512 samples per step (32 ms @ 16 kHz), context of 64 samples
 *              prepended, exactly as OnnxWrapper.__call__ in the upstream
 *              silero-vad utils_vad.py.
 *
 * Endpointing thresholds mirror the upstream get_speech_timestamps defaults:
 * speech prob >= THRESHOLD (0.5) triggers; a triggered stream exits when prob
 * drops below NEG_THRESHOLD (threshold - 0.15 = 0.35); MIN_SPEECH_MS 250,
 * MIN_SILENCE_MS 100, SPEECH_PAD_MS 30; MAX_UTTERANCE_S caps the clip length.
 */
(function () {
  "use strict";

  var SAMPLE_RATE = 16000;
  var WINDOW = 512;
  var CONTEXT = 64;
  var STATE_DIM = 128;
  var STATE_LAYERS = 2;
  var STATE_SHAPE = [STATE_LAYERS, 1, STATE_DIM];

  var VoiceVAD = {
    /** Upstream-compatible model version label. */
    VERSION: "silero-vad-v5",
    /** Sample rate the model eats (16 kHz only for the voice chain). */
    SAMPLE_RATE: SAMPLE_RATE,
    /** PCM samples consumed per step (32 ms @ 16 kHz). */
    WINDOW: WINDOW,
    /** Leading context samples prepended to each step (576 fed total). */
    CONTEXT: CONTEXT,
    /** Hidden-state width of the VAD LSTM. */
    STATE_DIM: STATE_DIM,
    /** LSTM layer count of the VAD state. */
    STATE_LAYERS: STATE_LAYERS,
    /** Fed state tensor shape [layers, batch, dim]. */
    STATE_SHAPE: STATE_SHAPE,
    /** Default Silero VAD ONNX model URL (MIT, runanywhere mirror). */
    MODEL_URL:
      "https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx",
    /**
     * ONNX SHA-256, verified at runtime before session creation (see load()).
     * Measured from the upstream artifact (2026-09-08); identical to
     * snakers4/silero-vad master `silero_vad.onnx`. Enforced whenever the
     * default model URL is used.
     */
    MODEL_SHA256:
      "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3",
    /** Default onnxruntime-web UMD bundle URL (same pin as the embedder). */
    RUNTIME_URL:
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
    /** Model input tensor name (64+512 samples [1,576]). */
    INPUT_NAME: "input",
    /** Model input tensor name (LSTM state [2,1,128]). */
    STATE_NAME: "state",
    /** Model input tensor name (sample-rate scalar, int64). */
    SR_NAME: "sr",
    /** Model input tensor name for the sample-rate tensor. */
    SR_VALUE: SAMPLE_RATE,
    /** Model output tensor name (speech probability). */
    OUTPUT_NAME: "output",
    /** Model output tensor name (updated state). */
    STATE_NAME_OUT: "stateN",

    /** Speech trigger probability (upstream threshold default). */
    THRESHOLD: 0.5,
    /** Exit probability below which a triggered stream becomes silence. */
    NEG_THRESHOLD: 0.35,
    /** Minimum accumulated speech to accept an utterance (upstream default). */
    MIN_SPEECH_MS: 250,
    /** Trailing-silence window before an utterance ends (upstream default). */
    MIN_SILENCE_MS: 100,
    /** Padding added around a detected utterance (upstream default). */
    SPEECH_PAD_MS: 30,
    /** Hard cap on captured utterance length for the ECAPA chain. */
    MAX_UTTERANCE_S: 4,

    _runtime: null,
    _session: null,
    _backend: null,
    _error: null,
    _state: null,
    _context: null,

    /** @returns {boolean} */
    isReady: function () {
      return !!this._session;
    },

    /** @returns {string|null} active execution provider */
    getBackend: function () {
      return this._backend;
    },

    /** @returns {string|null} last load error message */
    getError: function () {
      return this._error;
    },

    /** Drop any loaded session/runtime/state (mainly for tests). */
    reset: function () {
      this._runtime = null;
      this._session = null;
      this._backend = null;
      this._error = null;
      this._state = null;
      this._context = null;
    },

    /**
     * Load the ONNX runtime (lazy) and the Silero VAD model.
     *
     * Same verification rules as VoiceONNXEmbedder: when the default model
     * URL is used (or an explicit modelSha256 is given), the model bytes are
     * fetched and verified against the expected SHA-256 via crypto.subtle
     * BEFORE a session is created. Verification is skipped only when a
     * runtime is injected (test seam) unless options.verifyModel is forced.
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
      /* c8 ignore next 3 -- threading layer stalls the main thread
         (Atomics.wait in onnxruntime-web) on non cross-origin-isolated pages. */
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
     * WebCrypto. Throws when crypto.subtle is unavailable (fail closed).
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
     * Prepare a 512-sample 16 kHz block for the model: prepend the trailing
     * CONTEXT (64) samples of the previous block (zero on the first call).
     * Advances the internal context ring buffer.
     * @param {Float32Array} pcmBlock exactly 512 samples at 16 kHz.
     * @returns {Float32Array} 576 samples ([context + pcm]).
     */
    preprocess: function (pcmBlock) {
      var fed, i, prev;
      if (!pcmBlock || pcmBlock.length === 0)
        throw new Error("VoiceVAD: empty input buffer");
      if (pcmBlock.length !== WINDOW)
        throw new Error(
          "VoiceVAD: expected exactly 512 samples per 16 kHz step",
        );
      prev = this._context || new Float32Array(CONTEXT);
      fed = new Float32Array(CONTEXT + WINDOW);
      for (i = 0; i < CONTEXT; i++) fed[i] = prev[i];
      fed.set(pcmBlock, CONTEXT);
      this._context = pcmBlock.slice(pcmBlock.length - CONTEXT);
      return fed;
    },

    /**
     * Zero the internal LSTM state tensor. Call between utterances so one
     * stream does not bleed into the next.
     * @returns {Float32Array} the zeroed [2,1,128] state.
     */
    resetStates: function () {
      this._state = new Float32Array(STATE_LAYERS * 1 * STATE_DIM);
      return this._state;
    },

    /**
     * Run one 512-sample step through the VAD model.
     *
     * The model is stateful: `state` is fed in and `stateN` is carried to the
     * next call. The sample-rate tensor is int64 scalar (16000).
     * @param {Float32Array} pcmBlock exactly 512 samples at 16 kHz.
     * @returns {Promise<{probability: number, dims: number[]}>}
     */
    process: async function (pcmBlock) {
      var fed, feeds, stateIn, srIn, outputs, out, prob, i, name, stateN;
      if (!this._session)
        throw new Error("VoiceVAD is not loaded. Call load() first.");
      fed = this.preprocess(pcmBlock);
      if (!this._state) this.resetStates();
      stateIn = new this._runtime.Tensor("float32", this._state, STATE_SHAPE);
      srIn = new this._runtime.Tensor(
        "int64",
        new BigInt64Array([BigInt(this.SR_VALUE)]),
        [],
      );
      feeds = {};
      feeds[this.INPUT_NAME] = new this._runtime.Tensor("float32", fed, [
        1,
        CONTEXT + WINDOW,
      ]);
      feeds[this.STATE_NAME] = stateIn;
      feeds[this.SR_NAME] = srIn;
      outputs = await this._session.run(feeds);
      name = this._session.outputNames && this._session.outputNames[0];
      if (!outputs || !name || !outputs[name] || !outputs[name].data) {
        throw new Error("Unexpected VAD output shape.");
      }
      out = outputs[name].data;
      prob = Number(out[0]);
      if (!isFinite(prob)) throw new Error("VAD returned a non-finite output.");
      stateN = outputs[this.STATE_NAME_OUT];
      if (
        !stateN ||
        !stateN.data ||
        stateN.data.length !== this._state.length
      ) {
        throw new Error("Unexpected VAD state output.");
      }
      {
        i = 0;
        for (; i < this._state.length; i++) this._state[i] = stateN.data[i];
      }
      return { probability: prob, dims: [1, 1] };
    },

    /** @returns {boolean} speech when prob >= THRESHOLD (upstream rule). */
    isSpeech: function (prob) {
      return prob >= this.THRESHOLD;
    },

    /** @returns {boolean} non-speech when prob < NEG_THRESHOLD (exit rule). */
    isSilence: function (prob) {
      return prob < this.NEG_THRESHOLD;
    },
  };

  if (typeof module !== "undefined" && module.exports)
    module.exports = VoiceVAD;
  if (typeof window !== "undefined") window.VoiceVAD = VoiceVAD;
})();
