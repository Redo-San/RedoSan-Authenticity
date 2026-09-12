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
// ── Voice Crypto: WebCrypto AES-GCM + PBKDF2 + SHA-256 ──
// Mirrors Face_Biometric/face_crypto.js with two deliberate hardening
// differences (decision points D6-B / D6-D, see notes/B6-*.md):
//   1. KDF_ITERATIONS = 600000 — the OWASP current minimum for
//      PBKDF2-HMAC-SHA-256 (2026 cheat sheet). The face module's 310000 was
//      the 2021 figure and is now below recommendation; legacy face
//      envelopes (which carry their own kdf.iterations) still verify.
//   2. generateSalt refuses to fall back to Math.random — salts and GCM IVs
//      MUST come from crypto.getRandomValues (a CSPRNG). Math.random is not
//      cryptographically secure and must never seed AEAD nonces.

/**
 * @typedef {Object} VoiceCryptoEnvelope
 * @property {string} alg  - "AES-GCM"
 * @property {number} version - envelope version (1)
 * @property {{name:string, hash:string, iterations:number}} kdf - KDF parameters
 * @property {string} salt - base64
 * @property {string} iv - base64
 * @property {string} cipher - base64 ciphertext (GCM tag appended)
 */

var VoiceCrypto = {
  KDF_ITERATIONS: 600000,
  VERSION: 1,
};

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
VoiceCrypto.bytesToBase64 = function (bytes) {
  var out, i, chunk, binary;
  out = "";
  for (i = 0; i < bytes.length; i += 0x8000) {
    chunk = bytes.subarray(i, i + 0x8000);
    binary = String.fromCharCode.apply(null, chunk);
    if (typeof btoa === "function") {
      out += btoa(binary);
    } else {
      out += Buffer.from(binary, "binary").toString("base64");
    }
  }
  return out;
};

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
VoiceCrypto.base64ToBytes = function (b64) {
  var binary, out, i;
  if (typeof atob === "function") {
    binary = atob(b64);
    out = new Uint8Array(binary.length);
    for (i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
};

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
VoiceCrypto.bytesToHex = function (bytes) {
  var out, i, h;
  out = "";
  for (i = 0; i < bytes.length; i++) {
    h = bytes[i].toString(16);
    if (h.length < 2) h = "0" + h;
    out += h;
  }
  return out;
};

/**
 * CSPRNG bytes via crypto.getRandomValues — throws, never Math.random.
 * @param {number} [n=16]
 * @returns {Uint8Array}
 */
VoiceCrypto.generateSalt = function (n) {
  var bytes;
  n = n || 16;
  if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
    throw new Error(
      "WebCrypto getRandomValues is not available; refusing Math.random for secrets.",
    );
  }
  bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Derive an AES-GCM 256 key from a passphrase via PBKDF2-SHA-256.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {number} [iterations]
 * @returns {Promise<CryptoKey>}
 */
VoiceCrypto.deriveKey = async function (passphrase, salt, iterations) {
  var material, key;
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is not available");
  }
  if (iterations === undefined) iterations = VoiceCrypto.KDF_ITERATIONS;
  material = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  key = await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt,
      iterations: iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return key;
};

/**
 * @param {CryptoKey} key
 * @param {Uint8Array} iv 96-bit nonce (SP 800-38D forbids IV reuse)
 * @param {object} obj
 * @returns {Promise<{iv:string, cipher:string}>}
 */
VoiceCrypto.encryptWithKey = async function (key, iv, obj) {
  var data, cipher;
  data = new TextEncoder().encode(JSON.stringify(obj));
  cipher = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    key,
    data,
  );
  return {
    iv: VoiceCrypto.bytesToBase64(iv),
    cipher: VoiceCrypto.bytesToBase64(new Uint8Array(cipher)),
  };
};

/**
 * @param {CryptoKey} key
 * @param {{iv:string, cipher:string}} envelope
 * @returns {Promise<object>}
 */
VoiceCrypto.decryptWithKey = async function (key, envelope) {
  var plain, text;
  plain = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: VoiceCrypto.base64ToBytes(envelope.iv),
      tagLength: 128,
    },
    key,
    VoiceCrypto.base64ToBytes(envelope.cipher),
  );
  text = new TextDecoder().decode(plain);
  return JSON.parse(text);
};

/**
 * Encrypt a JSON object into a portable envelope (fresh salt + IV).
 * @param {string} passphrase
 * @param {object} obj
 * @param {number} [iterations]
 * @returns {Promise<VoiceCryptoEnvelope>}
 */
VoiceCrypto.encryptJSON = async function (passphrase, obj, iterations) {
  var salt, iv, key, enc;
  if (iterations === undefined) iterations = VoiceCrypto.KDF_ITERATIONS;
  salt = VoiceCrypto.generateSalt(16);
  iv = VoiceCrypto.generateSalt(12);
  key = await VoiceCrypto.deriveKey(passphrase, salt, iterations);
  enc = await VoiceCrypto.encryptWithKey(key, iv, obj);
  return {
    alg: "AES-GCM",
    version: VoiceCrypto.VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: iterations },
    salt: VoiceCrypto.bytesToBase64(salt),
    iv: enc.iv,
    cipher: enc.cipher,
  };
};

/**
 * Decrypt an envelope produced by encryptJSON.
 * @param {string} passphrase
 * @param {VoiceCryptoEnvelope} envelope
 * @returns {Promise<object>}
 */
VoiceCrypto.decryptJSON = async function (passphrase, envelope) {
  var key;
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.cipher
  ) {
    throw new TypeError("Invalid encrypted record");
  }
  key = await VoiceCrypto.deriveKey(
    passphrase,
    VoiceCrypto.base64ToBytes(envelope.salt),
    envelope.kdf && envelope.kdf.iterations
      ? envelope.kdf.iterations
      : VoiceCrypto.KDF_ITERATIONS,
  );
  return VoiceCrypto.decryptWithKey(key, envelope);
};

/**
 * SHA-256 hex digest over raw bytes or a string.
 * @param {Uint8Array|Float32Array|ArrayBuffer|string|number[]} data
 * @returns {Promise<string>}
 */
VoiceCrypto.sha256Hex = async function (data) {
  var bytes, digest;
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is not available");
  }
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (
    data &&
    typeof data.byteLength === "number" &&
    typeof data.buffer !== "undefined"
  ) {
    bytes = new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  } else if (data && typeof data.length === "number") {
    bytes = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) bytes[i] = data[i] & 0xff;
  } else {
    throw new TypeError("Unsupported data type for SHA-256");
  }
  digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return VoiceCrypto.bytesToHex(new Uint8Array(digest));
};

/* c8 ignore start */
if (typeof window !== "undefined") {
  window.VoiceCrypto = VoiceCrypto;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VoiceCrypto;
}
/* c8 ignore stop */
