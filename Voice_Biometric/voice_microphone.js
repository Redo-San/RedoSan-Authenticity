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
// ── Voice Microphone: getUserMedia wrapper + 16 kHz mono PCM capture ──

/**
 * Microphone capture for the voice biometric chain. Delivers exact 16 kHz
 * mono Float32 blocks over onPcm — the input contract of VoiceFeatures and
 * VoiceVAD. The capture graph is an AudioWorklet (preferred) or the
 * deprecated ScriptProcessorNode fallback; every block is resampled to
 * 16 kHz in JS so the module never depends on the browser honoring
 * `new AudioContext({sampleRate:16000})` (Firefox does not, historically).
 *
 * ── Primary sources (verified 2026-09-08) ──
 *   AudioWorklet            https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
 *   AudioWorkletNode        https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
 *   MediaTrackConstraints   https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
 *   AudioContext sampleRate caveat: mdn/browser-compat-data#16213;
 *                                   Firefox bugs 1674892 / 1725336 / 1852764.
 *   ScriptProcessorNode     https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode
 *
 * `sampleRate` in getUserMedia is requested as `{ideal:16000}` — asking for
 * `exact` throws OverconstrainedError on hardware that cannot deliver it.
 */
(function () {
  "use strict";

  var SAMPLE_RATE = 16000;
  var WORKLET_NAME = "pcm-capture";
  var WORKLET_URL = "Voice_Biometric/voice_capture_worklet.js";

  var state = {
    stream: null,
    context: null,
    worklet: null,
    mediaStreamSource: null,
    onPcm: null,
    onLevel: null,
    active: false,
    captureRate: null,
    fallback: false,
  };

  var VoiceMicrophone = {
    /** Canonical capture rate for the voice chain. */
    SAMPLE_RATE: SAMPLE_RATE,
    /** Alias kept for callers expecting a "target" label. */
    TARGET_RATE: SAMPLE_RATE,
    /** Standard audio processing flags (default on). */
    AUDIO_FLAGS: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },

    /**
     * True when the environment can access a microphone.
     * @returns {boolean}
     */
    supported: function () {
      var nav, md;
      nav = typeof navigator !== "undefined" ? navigator : null;
      md = nav && nav.mediaDevices;
      return !!(
        md &&
        typeof md.getUserMedia === "function" &&
        nav.isSecureContext !== false
      );
    },

    /**
     * Human-readable message per getUserMedia/system failure.
     * @param {Error|DOMException|string} err
     * @returns {string}
     */
    getMicrophoneErrorMessage: function (err) {
      var name;
      if (!err) return "Microphone error.";
      name =
        typeof err === "string" ? err : err.name || err.code || "UnknownError";
      switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
          return "Microphone permission denied. Allow microphone access in your browser.";
        case "NotFoundError":
        case "DevicesNotFoundError":
          return "No microphone found on this device.";
        case "NotReadableError":
        case "TrackStartError":
          return "Microphone is already in use by another application.";
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
          return "Microphone cannot satisfy the requested constraints.";
        case "AbortError":
          return "Microphone access was aborted.";
        case "NotSupportedError":
          return "Microphone is not supported in this browser or context.";
        default:
          return "Microphone error: " + name;
      }
    },

    /**
     * Request microphone permission only; returns the MediaStream so the
     * caller can attach it to a capture graph of its own.
     * @returns {Promise<MediaStream>}
     */
    requestPermission: async function () {
      var nav;
      nav = typeof navigator !== "undefined" ? navigator : null;
      if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia)
        throw new Error("Microphone capture is not supported in this context.");
      return nav.mediaDevices.getUserMedia(_audioConstraints());
    },

    /**
     * Resample a Float32 block to the canonical 16 kHz if needed.
     * - Already 16 kHz → returned unchanged (same reference).
     * - Integer downsample (e.g. 48 kHz → ×1/3): mean of each source group.
     * - Integer upsample (e.g. 8 kHz → ×2): each sample duplicated.
     * Anything else (e.g. 11025 Hz) is rejected.
     * @param {Float32Array} block
     * @param {number} fromRate
     * @returns {Float32Array|null}
     */
    resampleTo16k: function (block, fromRate) {
      var factor, out, i, k, base, acc;
      if (!block) return null;
      if (!fromRate || fromRate === SAMPLE_RATE) return block;
      if (fromRate < SAMPLE_RATE) {
        factor = SAMPLE_RATE / fromRate;
        if (factor % 1 !== 0)
          throw new Error("Cannot resample " + fromRate + " Hz to 16000 Hz.");
        out = new Float32Array(block.length * factor);
        for (i = 0; i < block.length; i += 1) {
          base = i * factor;
          for (k = 0; k < factor; k += 1) out[base + k] = block[i];
        }
        return out;
      }
      factor = fromRate / SAMPLE_RATE;
      if (factor % 1 !== 0)
        throw new Error("Cannot resample " + fromRate + " Hz to 16000 Hz.");
      out = new Float32Array(Math.floor(block.length / factor));
      for (i = 0; i < out.length; i += 1) {
        base = i * factor;
        acc = 0;
        for (k = 0; k < factor; k += 1) acc += block[base + k];
        out[i] = acc / factor;
      }
      return out;
    },

    /**
     * Start capturing the microphone. Resolves once the graph is live.
     * @param {object} opts
     * @param {function(Float32Array, number):void} opts.onPcm 16 kHz mono blocks
     * @param {function(Float32Array):void} [opts.onLevel] level-meter blocks
     * @param {string} [opts.workletUrl] overrides the bundled capture worklet
     * @param {number} [opts.bufferSize] ScriptProcessor fallback buffer (4096)
     * @returns {Promise<{sampleRate: number|null, fallback: boolean}>}
     */
    start: async function (opts) {
      var nav, stream, ctxCls, context, worklet, spNode, src, onData;
      if (!opts || typeof opts.onPcm !== "function")
        throw new Error("A callback onPcm is required for capture.");
      nav = typeof navigator !== "undefined" ? navigator : null;
      if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia)
        throw new Error("Microphone capture is not supported in this context.");

      stream = await nav.mediaDevices.getUserMedia(_audioConstraints());
      state.stream = stream;

      ctxCls =
        typeof AudioContext !== "undefined"
          ? AudioContext
          : typeof webkitAudioContext !== "undefined"
            ? webkitAudioContext
            : null;
      if (!ctxCls) {
        _stopTracks();
        throw new Error("Web Audio API is not available in this browser.");
      }
      context = new ctxCls({ sampleRate: SAMPLE_RATE });
      state.context = context;
      state.captureRate = context.sampleRate || null;
      state.active = true;
      state.onPcm = opts.onPcm;
      state.onLevel = opts.onLevel || null;

      onData = function (block) {
        var out;
        if (!state.active) return;
        out = VoiceMicrophone.resampleTo16k(block, context.sampleRate);
        if (!out) return;
        if (state.onLevel) state.onLevel(out);
        state.onPcm(out, context.sampleRate);
      };

      if (context.audioWorklet && context.audioWorklet.addModule) {
        await context.audioWorklet.addModule(opts.workletUrl || WORKLET_URL);
        worklet = new AudioWorkletNode(context, WORKLET_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          outputChannelCount: [1],
        });
        worklet.port.onmessage = function (e) {
          if (e && e.data && e.data.block) onData(e.data.block);
        };
        src = context.createMediaStreamSource(stream);
        src.connect(worklet);
        state.worklet = worklet;
        state.mediaStreamSource = src;
        state.fallback = false;
        return { sampleRate: context.sampleRate || null, fallback: false };
      }

      spNode = context.createScriptProcessor(opts.bufferSize || 4096, 1, 1);
      spNode.onaudioprocess = function (e) {
        var block = e.inputBuffer.getChannelData(0);
        if (state.active) onData(block);
      };
      src = context.createMediaStreamSource(stream);
      src.connect(spNode);
      spNode.connect(context.destination);
      state.worklet = spNode;
      state.mediaStreamSource = src;
      state.fallback = true;
      return { sampleRate: context.sampleRate || null, fallback: true };
    },

    /**
     * Stop capture, stop tracks, release the AudioContext.
     */
    stop: function () {
      state.active = false;
      if (state.worklet) {
        try {
          if (typeof state.worklet.disconnect === "function")
            state.worklet.disconnect();
        } catch (e) {
          /* ignore */
        }
        state.worklet = null;
      }
      if (state.mediaStreamSource) {
        try {
          if (typeof state.mediaStreamSource.disconnect === "function")
            state.mediaStreamSource.disconnect();
        } catch (e) {
          /* ignore */
        }
        state.mediaStreamSource = null;
      }
      if (state.context) {
        try {
          if (state.context.close) state.context.close();
        } catch (e) {
          /* ignore */
        }
        state.context = null;
      }
      _stopTracks();
      state.captureRate = null;
      state.onPcm = null;
      state.onLevel = null;
    },

    /** @returns {number|null} sampleRate of the active capture context. */
    audioCaptureSampleRate: function () {
      return state.captureRate;
    },

    /** @returns {boolean} true when the active context is 16 kHz already. */
    is16k: function () {
      return state.captureRate === SAMPLE_RATE;
    },

    /** @returns {boolean} true when the ScriptProcessor fallback is active. */
    usingFallback: function () {
      return state.fallback;
    },

    /** @returns {MediaStream|null} the active microphone stream. */
    getStream: function () {
      return state.stream;
    },
  };

  /** @private */
  function _audioConstraints() {
    var flags = VoiceMicrophone.AUDIO_FLAGS;
    return {
      audio: {
        echoCancellation: flags.echoCancellation !== false,
        noiseSuppression: flags.noiseSuppression !== false,
        autoGainControl: flags.autoGainControl !== false,
        channelCount: 1,
        sampleRate: { ideal: SAMPLE_RATE },
      },
    };
  }

  /** @private */
  function _stopTracks() {
    var tracks, i;
    if (state.stream) {
      try {
        tracks = state.stream.getTracks();
        for (i = 0; i < tracks.length; i += 1) {
          if (tracks[i] && typeof tracks[i].stop === "function")
            tracks[i].stop();
        }
      } catch (e) {
        /* ignore */
      }
      state.stream = null;
    }
  }

  if (typeof module !== "undefined" && module.exports)
    module.exports = VoiceMicrophone;
  if (typeof window !== "undefined") window.VoiceMicrophone = VoiceMicrophone;
})();
