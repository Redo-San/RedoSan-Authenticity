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
// ── Voice Template Protection (ISO/IEC 24745:2022) ──
// Cancellable biometric identifier for voice embeddings (ECAPA-TDNN 192-dim):
// HKDF-SHA-256 seeds a Xorshift128 PRNG, whose tokenized random-projection
// hyperplanes are combined with the descriptor and threshold-binarized.
//
// Properties (per decision point D6-A in notes/B6-*.md):
//   - irreversibility  (ISO/IEC 24745:2022 §8.2.1): projection is many-to-one,
//     the stored record never contains descriptor material and no inverse
//     function is exported.
//   - unlinkability    (§8.2.2): different secret/salt -> uncorrelated codes
//     (~50% bit disagreement); enforced by an in-test self-test gate.
//   - renewability     (§3.33): a new salt produces a brand-new code without
//     re-enrolling the voice print.
//
// The secret is a keyed transform (HKDF RFC 5869, extract-then-expand) rather
// than a raw digest: HKDF separation via `info` prevents cross-purpose key
// reuse and the salt adds extractor entropy. Residual risk per Kong et al.
// 2006 (S0031320305004280): a stolen secret still allows enrolment attacks,
// so the secret MUST be kept as private as the raw descriptor.

(function () {
  "use strict";

  var SCHEMA = "voice-template-protection-v1";
  var DEFAULT_DIM = 128;
  var DEFAULT_SALT = "redosan-voice-biohash-v1";
  var DEFAULT_INFO = "voice-template-protection:v1:keyed-transform";
  var UNLINK_SALT_PREFIX = "redosan-voice-unlinkability-self-test:v1";

  function bytesToHex(bytes) {
    var out = "",
      i,
      h;
    for (i = 0; i < bytes.length; i++) {
      h = bytes[i].toString(16);
      if (h.length < 2) h = "0" + h;
      out += h;
    }
    return out;
  }

  /**
   * xorshift128 PRNG (deterministic given a 4-word seed).
   * @param {number[]} seed 4 uint32 words (must not be all zeros)
   */
  function Xorshift128(seed) {
    this.s = [seed[0], seed[1], seed[2], seed[3]];
    /* c8 ignore start — all-zero seed is unreachable via generate() (HKDF-derived) */
    if (
      this.s[0] === 0 &&
      this.s[1] === 0 &&
      this.s[2] === 0 &&
      this.s[3] === 0
    ) {
      this.s[0] = 0x9e3779b9;
    }
    /* c8 ignore stop */
  }

  Xorshift128.prototype.next = function () {
    var t = this.s[3] >>> 0;
    var s0 = this.s[0] >>> 0;
    this.s[3] = this.s[2] >>> 0;
    this.s[2] = this.s[1] >>> 0;
    this.s[1] = s0;
    t = (t ^ ((t << 11) >>> 0)) >>> 0;
    t = (t ^ (t >>> 8)) >>> 0;
    t = (t ^ (s0 >>> 19)) >>> 0;
    this.s[0] = t;
    return t;
  };

  function wordsFromBytes(bytes) {
    var w = [],
      i;
    for (i = 0; i < 16; i += 4)
      w.push(
        ((bytes[i] << 24) |
          (bytes[i + 1] << 16) |
          (bytes[i + 2] << 8) |
          bytes[i + 3]) >>>
          0,
      );
    return w;
  }

  function requireWebCrypto() {
    if (!globalThis.crypto || !globalThis.crypto.subtle)
      throw new Error("WebCrypto (crypto.subtle) is not available");
  }

  /**
   * HKDF-SHA-256 (RFC 5869) extract-then-expand keyed transform.
   * @param {string} secret
   * @param {string} salt
   * @param {string} info
   * @returns {Promise<Uint8Array>} 128 bits = 4 × uint32 PRNG words
   */
  function hkdfSeed(secret, salt, info) {
    requireWebCrypto();
    var enc = new TextEncoder();
    var keyMaterial = enc.encode(String(secret));
    var saltBytes =
      salt && salt.length > 0 ? enc.encode(String(salt)) : new Uint8Array(0);
    var infoBytes = info ? enc.encode(String(info)) : new Uint8Array(0);
    return globalThis.crypto.subtle
      .importKey("raw", keyMaterial, "HKDF", false, ["deriveBits"])
      .then(function (ikm) {
        return globalThis.crypto.subtle.deriveBits(
          { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: infoBytes },
          ikm,
          128,
        );
      })
      .then(function (bits) {
        return new Uint8Array(bits);
      });
  }

  /**
   * SHA-256 hex digest over a UTF-8 string via WebCrypto.
   * @param {string} input
   * @returns {Promise<string>}
   */
  function sha256Hex(input) {
    requireWebCrypto();
    return globalThis.crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(String(input)))
      .then(function (d) {
        return bytesToHex(new Uint8Array(d));
      });
  }

  /**
   * Key fingerprint of (secret, salt) — stored instead of any secret material.
   * @param {string} secret
   * @param {string} [salt]
   * @returns {Promise<string>} 64-char lowercase hex
   */
  function keyFingerprint(secret, salt) {
    return sha256Hex(String(secret) + ":" + String(salt || ""));
  }

  /**
   * Generate a cancellable protected template from a voice descriptor + secret.
   * @param {Float32Array|number[]} descriptor Voice embedding (192-dim ECAPA-TDNN)
   * @param {string} secret Keyed-transform token — never stored in plaintext
   * @param {object} [opts]
   * @param {number} [opts.dim=128] Code bits (must be <= descriptor length)
   * @param {string} [opts.salt='redosan-voice-biohash-v1'] Change to renew/unlink
   * @param {string} [opts.info] HKDF info context (cross-purpose separation)
   * @returns {Promise<{schema: string, code: Uint8Array, bits: number,
   *   params: {dim: number, salt: string, info: string, kdf: string},
   *   keyFingerprint: string}>}
   */
  async function generate(descriptor, secret, opts) {
    var dim, salt, info, prng, byteLen, code, i, j, dot, sign, seedBytes, fp;
    opts = opts || {};
    dim = opts.dim || DEFAULT_DIM;
    salt = opts.salt || DEFAULT_SALT;
    info = opts.info || DEFAULT_INFO;
    if (typeof secret !== "string" || secret.length === 0)
      throw new Error("A secret is required to protect a voice template.");
    if (
      !descriptor ||
      typeof descriptor.length !== "number" ||
      descriptor.length === 0
    )
      throw new Error("A voice descriptor is required.");
    if (dim > descriptor.length)
      throw new Error(
        "VoiceTemplateProtection dim (" +
          dim +
          ") exceeds descriptor length (" +
          descriptor.length +
          ").",
      );

    seedBytes = await hkdfSeed(secret, salt, info);
    prng = new Xorshift128(wordsFromBytes(seedBytes));
    byteLen = Math.ceil(dim / 8);
    code = new Uint8Array(byteLen);
    for (i = 0; i < dim; i++) {
      dot = 0;
      for (j = 0; j < descriptor.length; j++) {
        sign = (prng.next() & 1) === 1 ? 1 : -1;
        dot += descriptor[j] * sign;
      }
      if (dot > 0) code[i >> 3] |= 1 << (7 - (i & 7));
    }
    fp = await keyFingerprint(secret, salt);
    return {
      schema: SCHEMA,
      code: code,
      bits: dim,
      params: { dim: dim, salt: salt, info: info, kdf: "HKDF-SHA-256" },
      keyFingerprint: fp,
    };
  }

  function popcnt8(x) {
    x = x - ((x >> 1) & 0x55);
    x = (x & 0x33) + ((x >> 2) & 0x33);
    return (x + (x >> 4)) & 0x0f;
  }

  /**
   * Hamming distance between two packed binary codes.
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {number} number of differing bits
   */
  function hammingDistance(a, b) {
    var n, d, i;
    if (!a || !b) return -1;
    n = Math.min(a.length, b.length);
    d = 0;
    for (i = 0; i < n; i++) d += popcnt8((a[i] ^ b[i]) & 0xff);
    return d;
  }

  /**
   * Normalized similarity in [0, 1] (1 = identical).
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {number} -1 if invalid input
   */
  function similarity(a, b) {
    var d = hammingDistance(a, b);
    if (d < 0 || !a || !b) return -1;
    var bits = Math.min(a.length, b.length) * 8;
    return bits === 0 ? 0 : 1 - d / bits;
  }

  /**
   * Find best matching protected template in a registry.
   * @param {Uint8Array} query Packed code
   * @param {Array<{code: Uint8Array, label: string}>} registry
   * @param {number} [threshold=0.7] minimum similarity to accept
   * @returns {{match: object|null, similarity: number, distance: number}}
   */
  function match(query, registry, threshold) {
    var best, bestSim, bestDist, i, sim;
    if (threshold === undefined) threshold = 0.7;
    if (!registry || registry.length === 0)
      return { match: null, similarity: 0, distance: -1 };
    best = null;
    bestSim = -1;
    bestDist = -1;
    for (i = 0; i < registry.length; i++) {
      sim = similarity(query, registry[i].code);
      if (sim > bestSim) {
        bestSim = sim;
        best = registry[i];
        bestDist = hammingDistance(query, registry[i].code);
      }
    }
    if (bestSim < threshold)
      return { match: null, similarity: bestSim, distance: bestDist };
    return { match: best, similarity: bestSim, distance: bestDist };
  }

  /**
   * Unlinkability self-test (ISO/IEC 24745:2022 §8.2.2): codes for the same
   * descriptor under different secrets must be mutually near-independent
   * (~50% bit disagreement). All inputs are deterministic, so this gate is
   * reproducible across runs.
   * @param {Float32Array|number[]} descriptor
   * @param {object} [opts]
   * @param {number} [opts.dim=128]
   * @param {number} [opts.iterations=5] distinct secrets to compare
   * @param {string} [opts.salt]
   * @returns {Promise<{pairs: number, meanDisagreement: number,
   *   minDisagreement: number, maxDisagreement: number, ok: boolean,
   *   codes: Uint8Array[]}>}
   */
  async function unlinkabilitySelfTest(descriptor, opts) {
    var codes, iterations, i, j, disagree, sum, lo, hi, dis, ok;
    opts = opts || {};
    iterations = opts.iterations || 5;
    codes = [];
    for (i = 0; i < iterations; i++) {
      codes.push(
        await generate(descriptor, UNLINK_SALT_PREFIX + ":" + i, {
          dim: opts.dim || DEFAULT_DIM,
          salt: opts.salt || DEFAULT_SALT,
          info: DEFAULT_INFO + ":unlinkability",
        }),
      );
    }
    sum = 0;
    lo = 2;
    hi = 0;
    for (i = 0; i < codes.length; i++) {
      for (j = i + 1; j < codes.length; j++) {
        disagree =
          hammingDistance(codes[i].code, codes[j].code) / codes[i].bits;
        sum += disagree;
        if (disagree < lo) lo = disagree;
        if (disagree > hi) hi = disagree;
      }
    }
    dis = sum / ((codes.length * (codes.length - 1)) / 2);
    ok = dis >= 0.48 && dis <= 0.52 && lo >= 0.4;
    return {
      pairs: (codes.length * (codes.length - 1)) / 2,
      meanDisagreement: dis,
      minDisagreement: lo,
      maxDisagreement: hi,
      ok: ok,
      codes: codes.map(function (c) {
        return c.code;
      }),
    };
  }

  var VoiceTemplateProtection = {
    VERSION: "1",
    SCHEMA: SCHEMA,
    DEFAULT_DIM: DEFAULT_DIM,
    generate: generate,
    hammingDistance: hammingDistance,
    similarity: similarity,
    match: match,
    keyFingerprint: keyFingerprint,
    unlinkabilitySelfTest: unlinkabilitySelfTest,
    bytesToHex: bytesToHex,
    /* c8 ignore next — internal seams used by tests */
    _hkdfSeed: hkdfSeed,
  };

  /* c8 ignore start */
  if (typeof window !== "undefined")
    window.VoiceTemplateProtection = VoiceTemplateProtection;
  if (typeof module !== "undefined" && module.exports)
    module.exports = VoiceTemplateProtection;
  /* c8 ignore stop */
})();
