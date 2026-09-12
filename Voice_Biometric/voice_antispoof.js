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
// -- Voice Anti-Spoof: AASIST / AASIST-L raw-waveform PAD gate --
// B5. Research-first gate against ISO/IEC 30107-3 presentation-attack
// detection. Research note:
//   Voice_Biometric/notes/B5-antispoof-liveness-research.md

/**
 * Optional anti-spoofing gate built on the AASIST family of presentation
 * attack detection (raw-waveform, bona-fide radar, PAD). Uses
 * onnxruntime-web to run either of two frozen ONNX exports:
 *
 *   - AASIST-L (`aasist-l.onnx`, ~766 kB):  0.085306 M params, EER 37.53 %
 *     on ASVspoof5 Track-1 test (score-file sha256 2c2accd8..., measured by
 *     the upstream benchmark, not by this repository).
 *   - AASIST (`aasist.onnx`, ~1.62 MB): EER 46.02 % on DeepVoice test
 *     (n=5053, upstream-reported).
 *
 * The gate is raw-waveform ONLY: it REJECTS mel/spectrogram-shaped input
 * ({data, frames}) because the graph's `wav` input expects monaural 16 kHz
 * float32 PCM. The frozen window is MODEL_WINDOW = 64600 samples
 * (64600 / 16000 = 4.0375 s). Preprocessing mirrors the official export
 * (`trt_aasist_l.py` / `aasist_l.py`): keep the FIRST 64600 samples of a
 * longer utterance; tile-repeat the utterance to 64600 samples (pad_fixed
 * parity, deterministic first-window at eval) when it is shorter. There is
 * NO mean/std normalization in the score path. Output is `logits` [B, 2];
 * logits[:,1] is the bona-fide logit (higher = bonafide).
 *
 * Honest-verdict policy (B4/B5): verdicts come ONLY from an externally
 * fitted calibration manifest (alpha*score+beta mapped to an LLR compared
 * against a threshold, as in voice_matcher). Without a calibration the gate
 * reports calibrated:false and verdict INCONCLUSIVE; no hard-coded
 * threshold is shipped. APCER/BPCER are NOT measured by this repository.
 *
 * Model integrity: when `modelSha256` is provided the bytes are fetched and
 * verified via WebCrypto (W3C SRI pattern) BEFORE a session is created. The
 * ONNX artifacts are NOT yet committed/digested at B5, so a default digest
 * is deliberately null; it is pinned at C2 (commit of the model assets +
 * VOICE_MODELS.md row).
 *
 * Execution providers: WASM first. The WebGPU operator table lacks `Selu`
 * (used in the AASIST LGF) and `Reshape` has no GPU kernel, so WebGPU is
 * NOT a safe default (research note §3.3); pass
 * `executionProviders: ["webgpu", "wasm"]` only with a fallback.
 *
 * Loads lazily and never throws on load failures (returns false, message in
 * getError()); the caller falls back to challenge-response liveness in
 * voice_liveness.js.
 *
 * -- Provenance & licensing (be precise; third-party weight sets) --
 *   Architecture : AASIST (Jung et al., ICASSP 2022) and AASIST-L.
 *   Source models: `aasist.onnx` / `aasist-l.onnx` exported from
 *                  SpeechAntiSpoofingBenchmarks/AASIST[-L] (Hugging Face,
 *                  org sha holds clovaai/aasist at
 *                  e4185b270ec20077c918e06a45093717a1bd5e30; AASIST-L
 *                  HF repo sha 357e022c44a1aa926097e18c1457bde3873ed8bf).
 *                  Export: opset 17, do_constant_folding=True, freeze-sinc
 *                  baked into plain Conv1d (no custom ops). SEE the
 *                  research note for full hashes and URLs.
 *   Upstream    : github.com/clovaai/aasist (MIT).
 *   Model license: MIT (upstream AASIST weights / HF export).
 *   This file    : wrapper/loader code is GPL-2.0. GPL-2.0 covers OUR
 *                  code, NOT the third-party model weights.
 */
var VoiceAntiSpoof = {
  /** Anti-spoof module family label (B5). */
  VERSION: "aasist",
  /** Frozen raw-waveform window consumed by the graph (64600 = 4.0375 s). */
  MODEL_WINDOW: 64600,
  /** Monaural sample rate the graph expects (input is NOT 16 kHz otherwise). */
  SAMPLE_RATE: 16000,
  /** Documented ONNX export opset (trt_aasist_l.py). */
  OPSET: 17,
  /** Default model input tensor name (raw float32 waveform [B, 64600]). */
  INPUT_NAME: "wav",
  /** Default model output tensor name (logits [B, 2]). */
  OUTPUT_NAME: "logits",
  /**
   * Default onnxruntime-web UMD bundle URL (same pin as voice_embed_onnx).
   */
  RUNTIME_URL:
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  /** Default model key in MODELS (AASIST-L, the smaller/faster export). */
  DEFAULT_MODEL_KEY: "aasist-l",
  /**
   * Execution-provider preference. WASM first: the WebGPU operator table
   * lacks `Selu` and `Reshape` has no GPU kernel (research note §3.3).
   */
  DEFAULT_EXECUTION_PROVIDERS: ["wasm"],
  /** Verdict vocabulary (ISO 30107-3-flavoured, no measured APCER/BPCER). */
  VERDICTS: {
    BONAFIDE: "BONAFIDE",
    SPOOF: "SPOOF",
    INCONCLUSIVE: "INCONCLUSIVE",
  },
  /**
   * Model registry (both artifacts, runtime switcher). `sha256` measured
   * byte-for-byte from the committed artifacts at C2 (2026-09-09, see
   * models/manifest.json + VOICE_MODELS.md).
   */
  MODELS: {
    "aasist-l": {
      id: "aasist-l",
      label: "AASIST-L (ASVspoof5, 0.085306 M params)",
      url: "https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST-L/resolve/main/aasist-l.onnx",
      fp32: true,
      window: 64600,
      parameters: 85306, // 0.085306 M (meta.yaml, upstream benchmark)
      sha256:
        "f43f0a638b52846f5d0e630c0a738d10e9306325945127c6f8662d559585f218",
    },
    aasist: {
      id: "aasist",
      label: "AASIST (DeepVoice, full size)",
      url: "https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST/resolve/main/aasist.onnx",
      fp32: true,
      window: 64600,
      parameters: null, // not measured/verified in this repo (honest)
      sha256:
        "130e536266b7c537f9a13029e1612a9f392fd1cc827783683b6d1c062a3db5e1",
    },
  },

  _runtime: null,
  _session: null,
  _backend: null,
  _modelKey: null,
  _error: null,

  /** @returns {boolean} */
  isReady: function () {
    return !!this._session;
  },

  /** @returns {string|null} active model key ('aasist-l' | 'aasist') */
  getModelKey: function () {
    return this._modelKey;
  },

  /** @returns {string|null} active execution provider */
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
    this._modelKey = null;
    this._error = null;
  },

  /**
   * Validate an anti-spoof input and normalize it to {pcm, sampleRate}.
   *
   * The AASIST gate is raw-waveform ONLY. Accepted shapes:
   *  - a bare Float32Array (assumed 16 kHz mono, raw PCM), or
   *  - { pcm: Float32Array, sampleRate: number }.
   * Rejected shapes:
   *  - mel/spectrogram-shaped object ({data, frames, nBands...}) — the
   *    feature path used by the embedder — and any rank-2 nesting.
   * @param {*} input
   * @returns {{ok: boolean, reason?: string, pcm?: Float32Array, sampleRate?: number}}
   */
  validateInputSpec: function (input) {
    if (input instanceof Float32Array) {
      return { ok: true, pcm: input, sampleRate: this.SAMPLE_RATE };
    }
    if (Array.isArray(input)) {
      if (input.length > 0 && Array.isArray(input[0])) {
        return {
          ok: false,
          reason:
            "VoiceAntiSpoof requires raw waveform, not rank-2 arrays (raw waveform).",
        };
      }
      return {
        ok: false,
        reason: "VoiceAntiSpoof requires a Float32Array of raw waveform.",
      };
    }
    if (!input || typeof input !== "object") {
      return {
        ok: false,
        reason: "VoiceAntiSpoof requires raw waveform (Float32Array).",
      };
    }
    if (input.data) {
      return {
        ok: false,
        reason:
          "VoiceAntiSpoof gate is raw-waveform only: mel/spectrogram-shaped input ({data, frames}) is not accepted. Feed raw PCM, not fbank features.",
      };
    }
    if (!(input.pcm instanceof Float32Array)) {
      return {
        ok: false,
        reason: "VoiceAntiSpoof requires a Float32Array of raw waveform.",
      };
    }
    if (!(typeof input.sampleRate === "number" && input.sampleRate > 0)) {
      return {
        ok: false,
        reason: "sampleRate must be a positive number.",
      };
    }
    for (var i = 0; i < input.pcm.length; i++) {
      if (!isFinite(input.pcm[i])) {
        return {
          ok: false,
          reason: "VoiceAntiSpoof requires finite samples (finite).",
        };
      }
    }
    return {
      ok: true,
      pcm: input.pcm,
      sampleRate: input.sampleRate || this.SAMPLE_RATE,
    };
  },

  /**
   * Linear-interpolation resample (deterministic; the browser-side
   * OfflineAudioContext equivalent used by the ecosystem). Output length is
   * Math.round(n * to / from); endpoints clamp. Used to lift any input rate
   * to 16 kHz before framing.
   * @param {Float32Array} arr
   * @param {number} fromRate
   * @param {number} toRate
   * @returns {Float32Array}
   */
  resampleLinear: function (arr, fromRate, toRate) {
    var outLen, out, i, pos, i0, i1, frac;
    if (!(arr instanceof Float32Array) || arr.length === 0)
      throw new Error("resampleLinear requires a non-empty Float32Array.");
    outLen = Math.max(1, Math.round((arr.length * toRate) / fromRate));
    out = new Float32Array(outLen);
    for (i = 0; i < outLen; i++) {
      pos = (i * fromRate) / toRate;
      i0 = Math.min(Math.floor(pos), arr.length - 1);
      i1 = Math.min(i0 + 1, arr.length - 1);
      frac = pos - i0;
      out[i] = arr[i0] * (1 - frac) + arr[i1] * frac;
    }
    return out;
  },

  /**
   * Frame raw audio into the frozen AASIST window (64600 samples @ 16 kHz).
   *
   * Mirrors the official eval preprocessing (research note §2.3):
   * first-window on longer inputs, pad_fixed tile-repeat on shorter inputs.
   * Also lifts non-16 kHz rates via resampleLinear first.
   * @param {*} input raw waveform (see validateInputSpec)
   * @param {number} [sampleRate] optional when input is a bare Float32Array
   * @returns {Float32Array} exactly MODEL_WINDOW samples
   */
  frameWaveform: function (input, sampleRate) {
    var spec, pcm, n, i, out;
    if (sampleRate !== undefined && input instanceof Float32Array) {
      input = { pcm: input, sampleRate: sampleRate };
    }
    spec = this.validateInputSpec(input);
    if (!spec.ok) throw new Error(spec.reason);
    pcm = spec.pcm;
    if (spec.sampleRate !== this.SAMPLE_RATE) {
      pcm = this.resampleLinear(pcm, spec.sampleRate, this.SAMPLE_RATE);
    }
    n = pcm.length;
    if (n >= this.MODEL_WINDOW) {
      return new Float32Array(pcm.subarray(0, this.MODEL_WINDOW));
    }
    out = new Float32Array(this.MODEL_WINDOW);
    for (i = 0; i < this.MODEL_WINDOW; i++) out[i] = pcm[i % n];
    return out;
  },

  /**
   * Extract the bona-fide logit from the `logits` [1, 2] ONNX output.
   * logits[:,1] is the bona-fide logit (higher = bonafide); index 0 is the
   * spoof logit. Throws on any other output shape.
   * @param {*} outputs result of session.run()
   * @param {string|null} name output tensor name override
   * @returns {{score: number, bonafideLogit: number, spoofLogit: number}}
   */
  extractScore: function (outputs, name) {
    var t;
    if (!outputs) throw new Error("Unexpected ONNX output shape.");
    name = name || this.OUTPUT_NAME;
    t = outputs[name];
    if (!t || !t.data || t.data.length !== 2) {
      throw new Error("Unexpected ONNX output shape.");
    }
    return {
      score: t.data[1],
      bonafideLogit: t.data[1],
      spoofLogit: t.data[0],
    };
  },

  /**
   * Map a raw bonafide logit to a verdict using an externally fitted
   * calibration (voice_matcher pattern: LLR = alpha*score+beta compared
   * with a threshold). Without calibration the verdict is INCONCLUSIVE and
   * calibrated is false — no hard-coded threshold is ever shipped.
   * @param {number} score
   * @param {{alpha?: number, beta?: number, threshold?: number}|null} calibration
   * @returns {{score: number, llr: number|null, threshold: number|null, verdict: string, calibrated: boolean}}
   */
  applyCalibration: function (score, calibration) {
    var alpha, beta, threshold, llr, verdict;
    calibration = calibration || null;
    alpha = calibration && isFinite(calibration.alpha) ? calibration.alpha : 1;
    beta = calibration && isFinite(calibration.beta) ? calibration.beta : 0;
    threshold =
      calibration && typeof calibration.threshold === "number"
        ? calibration.threshold
        : null;
    llr = isFinite(score) ? alpha * score + beta : NaN;
    verdict = this.VERDICTS.INCONCLUSIVE;
    if (threshold !== null) {
      if (isFinite(llr)) {
        verdict =
          llr > threshold ? this.VERDICTS.BONAFIDE : this.VERDICTS.SPOOF;
      } else {
        verdict = this.VERDICTS.INCONCLUSIVE;
      }
    }
    return {
      score: score,
      llr: isFinite(llr) ? llr : null,
      threshold: threshold,
      verdict: verdict,
      calibrated: threshold !== null,
    };
  },

  /**
   * Load the ONNX runtime (lazy) and an AASIST model.
   *
   * Verification: when `modelSha256` is given the bytes are verified with
   * WebCrypto before a session is created. The default registry digests are
   * null at B5 (artifacts pinned at C2), so the default load does NOT
   * verify yet — pass `modelSha256` explicitly when you have the digest.
   * @param {object} [options]
   * @param {object} [options.runtime] Injected ort-compatible runtime (tests)
   * @param {string} [options.runtimeUrl] Runtime bundle URL override
   * @param {string} [options.modelKey] 'aasist-l' (default) | 'aasist'
   * @param {string} [options.modelUrl] Model URL override
   * @param {string} [options.modelSha256] Expected SHA-256 (when known)
   * @param {boolean} [options.verifyModel] Force/skip integrity verification
   * @param {string[]} [options.executionProviders] Defaults to ['wasm']
   * @returns {Promise<boolean>}
   */
  load: async function (options) {
    var ort,
      modelKey,
      model,
      modelUrl,
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
    modelKey = options.modelKey || this.DEFAULT_MODEL_KEY;
    model = this.MODELS[modelKey];
    if (!model) {
      this._error = "Unknown model key '" + modelKey + "' (aasist-l | aasist).";
      this._modelKey = null;
      return false;
    }
    modelUrl = options.modelUrl || model.url;
    expected = options.modelSha256 || null;
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
    backends = options.executionProviders || this.DEFAULT_EXECUTION_PROVIDERS;
    err = null;
    for (i = 0; i < backends.length; i++) {
      try {
        session = await ort.InferenceSession.create(buffer || modelUrl, {
          executionProviders: [backends[i]],
        });
        this._session = session;
        this._backend = backends[i];
        this._modelKey = modelKey;
        this._error = null;
        return true;
      } catch (e) {
        err = e;
      }
    }
    /* c8 ignore next -- reaching here implies every provider threw, so err is set */
    this._error = err ? err.message : "No ONNX execution provider succeeded.";
    this._modelKey = null;
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
   * Run the anti-spoof gate on a raw waveform and return a structured,
   * provenance-carrying result (ISO 30107-3-flavoured; calibrated mirror of
   * voice_matcher). Throws on contract violations (mel input, not loaded);
   * load() failures never throw.
   * @param {*} input raw waveform (see validateInputSpec)
   * @param {{alpha?: number, beta?: number, threshold?: number}|null} [calibration]
   * @returns {Promise<object>}
   */
  detect: async function (input, calibration) {
    var spec, wav, feeds, outputs, name, s, v;
    if (!this._session)
      throw new Error("VoiceAntiSpoof is not loaded. Call load() first.");
    spec = this.validateInputSpec(input);
    if (!spec.ok) throw new Error(spec.reason);
    wav = this.frameWaveform(spec);
    feeds = {};
    feeds[this.INPUT_NAME] = new this._runtime.Tensor("float32", wav, [
      1,
      this.MODEL_WINDOW,
    ]);
    outputs = await this._session.run(feeds);
    name = this._session.outputNames && this._session.outputNames[0];
    s = this.extractScore(outputs, name);
    v = this.applyCalibration(s.score, calibration);
    return {
      ok: true,
      model: this._modelKey,
      modelUrl: this.MODELS[this._modelKey].url,
      backend: this._backend,
      framework: "onnxruntime-web",
      opset: this.OPSET,
      sampleRate: this.SAMPLE_RATE,
      windowSamples: this.MODEL_WINDOW,
      score: s.score,
      bonafideLogit: s.bonafideLogit,
      spoofLogit: s.spoofLogit,
      llr: v.llr,
      threshold: v.threshold,
      verdict: v.verdict,
      calibrated: v.calibrated,
    };
  },
};

/* c8 ignore start */
if (typeof window !== "undefined") window.VoiceAntiSpoof = VoiceAntiSpoof;
/* c8 ignore stop */
