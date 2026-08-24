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
// ── Face BioHash: cancellable biometric identifier (ISO/IEC 24745:2022) ──
// Tokenized random projection + threshold binarization.
// Properties: irreversibility (projection is many-to-one), unlinkability
// (different PIN/salt → uncorrelated codes), renewability (new salt/PIN → new code).
// Security model: the PIN is the secret (tokenized biohashing); the face
// descriptor never leaves the device.

(function () {
  "use strict";

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  var H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];

  function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  /**
   * Compact SHA-256 (FIPS 180-4) over a UTF-8 string, returns lowercase hex.
   *
   * Deliberately SYNCHRONOUS, unlike FaceCrypto.sha256Hex (async WebCrypto):
   * the digest is used to seed the Xorshift128 PRNG (see seedFromSha256)
   * and is consumed synchronously by FaceFuzzy's match pipelines
   * (face_fuzzy.js). WebCrypto's subtle.digest() is promise-based, so it
   * cannot feed these call paths without an async rewrite of the whole
   * BioHash/Fuzzy stack. This implementation is equivalent to
   * crypto.subtle.digest("SHA-256") — equivalence is covered by the unit
   * tests in cli/tests/face_biohash_test.js ("equivalence with node
   * crypto SHA-256").
   * @param {string} input
   * @returns {string}
   */
  function sha256Hex(input) {
    var bytes = [],
      i,
      c,
      bitLen,
      hi,
      lo,
      H,
      off,
      t,
      idx,
      w,
      s0,
      s1;
    var a, b, d, e, f, g, h, S1, ch, t1, S0, maj, t2, out, j, word, hex;
    for (i = 0; i < input.length; i++) {
      c = input.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(
          0xe0 | (c >> 12),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f),
        );
      } else {
        // surrogate pair
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
        bytes.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 0x3f),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f),
        );
      }
    }
    bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    hi = Math.floor(bitLen / 0x100000000);
    lo = bitLen >>> 0;
    bytes.push(
      (hi >>> 24) & 255,
      (hi >>> 16) & 255,
      (hi >>> 8) & 255,
      hi & 255,
    );
    bytes.push(
      (lo >>> 24) & 255,
      (lo >>> 16) & 255,
      (lo >>> 8) & 255,
      lo & 255,
    );

    H = H0.slice();
    for (off = 0; off < bytes.length; off += 64) {
      w = new Array(64);
      for (t = 0; t < 16; t++) {
        idx = off + t * 4;
        w[t] =
          ((bytes[idx] << 24) |
            (bytes[idx + 1] << 16) |
            (bytes[idx + 2] << 8) |
            bytes[idx + 3]) >>>
          0;
      }
      for (t = 16; t < 64; t++) {
        s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      a = H[0];
      b = H[1];
      c = H[2];
      d = H[3];
      e = H[4];
      f = H[5];
      g = H[6];
      h = H[7];
      for (t = 0; t < 64; t++) {
        S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }
    out = "";
    for (j = 0; j < 8; j++) {
      word = H[j] >>> 0;
      hex = word.toString(16);
      while (hex.length < 8) hex = "0" + hex;
      out += hex;
    }
    return out;
  }

  /**
   * xorshift128 PRNG (deterministic given a 4-word seed).
   * @param {number[]} seed 4 uint32 words (must not be all zeros)
   */
  function Xorshift128(seed) {
    this.s = [seed[0], seed[1], seed[2], seed[3]];
    /* c8 ignore start — all-zero seed is unreachable via generate() (seed is SHA-256 derived) */
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

  function wordsFromHex(hex) {
    return [
      parseInt(hex.substring(0, 8), 16) >>> 0,
      parseInt(hex.substring(8, 16), 16) >>> 0,
      parseInt(hex.substring(16, 24), 16) >>> 0,
      parseInt(hex.substring(24, 32), 16) >>> 0,
    ];
  }

  /**
   * SHA-256 fingerprint of (pin + ':' + salt) — stored instead of the raw PIN.
   * @param {string} pin
   * @param {string} salt
   * @returns {string} 64-char lowercase hex
   */
  function pinFingerprint(pin, salt) {
    return sha256Hex(String(pin) + ":" + String(salt));
  }

  /**
   * Generate a cancellable binary identifier from a face descriptor + secret PIN.
   * @param {Float32Array|number[]} descriptor Face embedding (e.g. 192-dim HSE)
   * @param {string} pin User secret (token) — never stored in plaintext
   * @param {object} [opts]
   * @param {number} [opts.dim=128] Number of code bits (must be <= descriptor length)
   * @param {string} [opts.salt='redosan-biohash-v1'] Version token — change to renew/unlink
   * @returns {{code: Uint8Array, bits: number, params: {dim: number, salt: string}, pinFingerprint: string}}
   */
  function generate(descriptor, pin, opts) {
    var dim, salt, prng, byteLen, code, i, j, dot, sign;
    opts = opts || {};
    dim = opts.dim || 128;
    salt = opts.salt || "redosan-biohash-v1";
    if (typeof pin !== "string" || pin.length === 0)
      throw new Error("A PIN is required to generate a BioHash identifier.");
    if (
      !descriptor ||
      typeof descriptor.length !== "number" ||
      descriptor.length === 0
    )
      throw new Error("A face descriptor is required.");
    if (dim > descriptor.length)
      throw new Error(
        "BioHash dim (" +
          dim +
          ") exceeds descriptor length (" +
          descriptor.length +
          ").",
      );

    prng = new Xorshift128(wordsFromHex(sha256Hex(pin + ":" + salt)));
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
    return {
      code: code,
      bits: dim,
      params: { dim: dim, salt: salt },
      pinFingerprint: pinFingerprint(pin, salt),
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
   * Find best matching BioHash code in a registry.
   * @param {Uint8Array} query
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
   * Hex string for display/export of a code.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function bytesToHex(bytes) {
    var out, i, h;
    out = "";
    for (i = 0; i < bytes.length; i++) {
      h = bytes[i].toString(16);
      if (h.length < 2) h = "0" + h;
      out += h;
    }
    return out;
  }

  var FaceBioHash = {
    VERSION: "1",
    generate: generate,
    hammingDistance: hammingDistance,
    similarity: similarity,
    match: match,
    pinFingerprint: pinFingerprint,
    bytesToHex: bytesToHex,
    _sha256Hex: sha256Hex,
  };

  /* c8 ignore start */
  if (typeof window !== "undefined") window.FaceBioHash = FaceBioHash;
  if (typeof module !== "undefined" && module.exports)
    module.exports = FaceBioHash;
  /* c8 ignore stop */
})();
