/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
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

/**
 * Voice_Biometric/voice_features.js
 *
 * Browser log-mel front end with byte-level parity to the SpeechBrain ECAPA
 * feature chain that produced cli/tests/fixtures/golden_sp{1,2}.json:
 *
 *   torch.stft(x, n_fft=400, hop_length=160, win_length=400,
 *              window=torch.hamming_window(400, periodic=True),
 *              center=True, pad_mode="constant", normalized=False,
 *              onesided=True, return_complex=True)
 *   power   = re**2 + im**2                      (spectral_magnitude power=1)
 *   mel     = power @ fbank                      (triangular, 201 x 80, frozen)
 *   db      = 10 * log10(max(mel, 1e-10))        (amplitude_to_DB, ref=1.0)
 *   floor   = max_tf(db) - 80 ; db = max(db, floor)
 *   out     = db - mean_time(db)                 (InputNormalization sentence,
 *                                                 std_norm=False)
 *
 * The shipped fbank-80x201-f32.bin is bit-identical to SpeechBrain 1.1.1's
 * frozen _triangular_filters matrix (layout k*80 + mel, HTK mel scale,
 * f_min=0, f_max=8000), so mel output reproduces the golden tensors within
 * abs 0.002 dB. The DFT is evaluated directly over the 400 fixed points with
 * precomputed e^{-j 2pi k n / 400} tables; N is small and fixed, so the
 * direct summation is both auditable and well inside the tolerance budget.
 *
 * Input contract (canonical, matching the golden fixtures "int16-pcm-16k-mono"):
 *   - Int16Array    -> samples are int16 PCM at 16 kHz, scaled by 1/32768
 *   - Float32Array  -> samples already normalized to [-1, 1] at 16 kHz
 *
 * Output: { data: Float32Array(frames * 80) in time-major layout,
 *           frames, mels: 80, mean } with data = post mean-subtraction dB.
 */
(function () {
  "use strict";

  var N_FFT = 400;
  var HOP = 160;
  var N_MELS = 80;
  var N_HALF = N_FFT / 2; // 200 (center=True zero padding each side)
  var N_BINS = N_FFT / 2 + 1; // 201 onesided frequency bins
  var SAMPLE_RATE = 16000;
  var LOG_AMIN = 1e-10;
  var TOP_DB = 80;
  var DB_MULT = 10;
  var DB_OFFSET = DB_MULT * Math.log10(1); // ref_value = 1.0 -> 0
  var INV_32768 = 1 / 32768;

  var win = new Float64Array(N_FFT);
  for (var i = 0; i < N_FFT; i += 1)
    win[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / N_FFT);

  var cosT = null;
  var sinT = null;

  function dftTables() {
    // e^{-j 2 pi k n / N} for k in [0, 200], n in [0, 399], row-major k*n.
    if (cosT) return [cosT, sinT];
    cosT = new Float64Array(N_BINS * N_FFT);
    sinT = new Float64Array(N_BINS * N_FFT);
    for (var k = 0; k < N_BINS; k += 1) {
      for (var n = 0; n < N_FFT; n += 1) {
        var a = (-2 * Math.PI * k * n) / N_FFT;
        var idx = k * N_FFT + n;
        cosT[idx] = Math.cos(a);
        sinT[idx] = Math.sin(a);
      }
    }
    return [cosT, sinT];
  }

  function framePowerSpectrum(windowed) {
    // windowed: Float64Array(N_FFT), values already rounded to float32.
    var [c, s] = dftTables();
    var pow = new Float64Array(N_BINS);
    for (var k = 0; k < N_BINS; k += 1) {
      var re = 0;
      var im = 0;
      var base = k * N_FFT;
      for (var n = 0; n < N_FFT; n += 1) {
        var x = windowed[n];
        re += x * c[base + n];
        im += x * s[base + n];
      }
      pow[k] = Math.fround(re * re + im * im);
    }
    return pow;
  }

  /**
   * Compute the log-mel tensor (post sentence mean subtraction).
   *
   * @param {Int16Array|Float32Array} pcm 16 kHz samples.
   * @param {ArrayLike<number>} fbank 201*80 row-major matrix (k*80 + mel).
   * @param {number} [sampleRate=16000] must be 16000.
   * @returns {{data: Float32Array, frames: number, mels: number, mean: number}}
   */
  function computeLogMel(pcm, fbank, sampleRate) {
    if (sampleRate === undefined) sampleRate = SAMPLE_RATE;
    if (sampleRate !== SAMPLE_RATE)
      throw new Error("VoiceFeatures: only 16 kHz input is supported");
    if (!pcm || !pcm.length)
      throw new Error("VoiceFeatures: empty input buffer");
    if (!fbank || fbank.length !== N_BINS * N_MELS)
      throw new Error(
        "VoiceFeatures: fbank must be a 201*80 (k*80+mel) matrix",
      );

    var isInt = pcm instanceof Int16Array;
    var T = pcm.length;
    var frames = Math.floor(T / HOP) + 1;
    var out = new Float32Array(frames * N_MELS);
    var windowed = new Float64Array(N_FFT);

    for (var m = 0; m < frames; m += 1) {
      var start = m * HOP;
      for (var t = 0; t < N_FFT; t += 1) {
        var oi = start + t - N_HALF;
        var x = 0;
        if (oi >= 0 && oi < T) {
          x = isInt ? pcm[oi] * INV_32768 : pcm[oi];
        }
        windowed[t] = Math.fround(x * win[t]);
      }
      var pow = framePowerSpectrum(windowed);
      var rowBase = m * N_MELS;
      for (var col = 0; col < N_MELS; col += 1) {
        var acc = 0;
        for (var k = 0; k < N_BINS; k += 1)
          acc += pow[k] * fbank[k * N_MELS + col];
        var clamped = Math.max(acc, LOG_AMIN);
        out[rowBase + col] = Math.fround(
          DB_MULT * Math.log10(clamped) - DB_OFFSET,
        );
      }
    }

    // top_db floor: per-sequence amax(-2,-1) - TOP_DB (batch of one utterance).
    var amax = -Infinity;
    for (var i0 = 0; i0 < out.length; i0 += 1)
      if (out[i0] > amax) amax = out[i0];
    var floorV = amax - TOP_DB;
    if (floorV > -Infinity) {
      for (var i1 = 0; i1 < out.length; i1 += 1)
        if (out[i1] < floorV) out[i1] = Math.fround(floorV);
    }

    // InputNormalization(norm_type="sentence", std_norm=False): the mean is
    // computed over the time dimension (length_dim=1) per mel band, then
    // subtracted; std is forced to ones.
    var bandMean = new Float64Array(N_MELS);
    for (var i2 = 0; i2 < out.length; i2 += 1) bandMean[i2 % N_MELS] += out[i2];
    for (var c = 0; c < N_MELS; c += 1) bandMean[c] /= frames;
    var bandMeans = new Float32Array(N_MELS);
    for (var c2 = 0; c2 < N_MELS; c2 += 1) bandMeans[c2] = bandMean[c2];
    for (var i3 = 0; i3 < out.length; i3 += 1)
      out[i3] = Math.fround(out[i3] - bandMean[i3 % N_MELS]);

    return {
      data: out,
      frames: frames,
      mels: N_MELS,
      bandMeans: bandMeans,
    };
  }

  var VoiceFeatures = {
    N_FFT: N_FFT,
    HOP: HOP,
    N_MELS: N_MELS,
    F_MIN: 0,
    F_MAX: SAMPLE_RATE / 2,
    SAMPLE_RATE: SAMPLE_RATE,
    LOG_MEL_ABS: 0.002,
    computeLogMel: computeLogMel,
  };

  if (typeof module !== "undefined" && module.exports)
    module.exports = VoiceFeatures;
  if (typeof window !== "undefined") window.VoiceFeatures = VoiceFeatures;
})();
