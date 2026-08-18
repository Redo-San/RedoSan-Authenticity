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
// ── Face Crypto: WebCrypto AES-GCM + PBKDF2 + SHA-256 ──

/**
 * @typedef {Object} FaceCryptoEnvelope
 * @property {string} alg  - "AES-GCM"
 * @property {number} version - envelope version (1)
 * @property {{name:string, hash:string, iterations:number}} kdf - KDF parameters
 * @property {string} salt - base64
 * @property {string} iv - base64
 * @property {string} cipher - base64 ciphertext (GCM tag appended)
 */

var FaceCrypto = {
  KDF_ITERATIONS: 310000,
  VERSION: 1,
};

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
FaceCrypto.bytesToBase64 = function (bytes) {
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
FaceCrypto.base64ToBytes = function (b64) {
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
FaceCrypto.bytesToHex = function (bytes) {
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
 * @param {number} [n]
 * @returns {Uint8Array}
 */
FaceCrypto.generateSalt = function (n) {
  var bytes;
  n = n || 16;
  bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < n; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  return bytes;
};

/**
 * Derive an AES-GCM 256 key from a passphrase via PBKDF2-SHA-256.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {number} [iterations]
 * @returns {Promise<CryptoKey>}
 */
FaceCrypto.deriveKey = async function (passphrase, salt, iterations) {
  var material, key;
  if (!crypto || !crypto.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is not available");
  }
  if (iterations === undefined) iterations = FaceCrypto.KDF_ITERATIONS;
  material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  key = await crypto.subtle.deriveKey(
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
 * @param {Uint8Array} iv
 * @param {object} obj
 * @returns {Promise<{iv:string, cipher:string}>}
 */
FaceCrypto.encryptWithKey = async function (key, iv, obj) {
  var data, cipher;
  data = new TextEncoder().encode(JSON.stringify(obj));
  cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);
  return {
    iv: FaceCrypto.bytesToBase64(iv),
    cipher: FaceCrypto.bytesToBase64(new Uint8Array(cipher)),
  };
};

/**
 * @param {CryptoKey} key
 * @param {{iv:string, cipher:string}} envelope
 * @returns {Promise<object>}
 */
FaceCrypto.decryptWithKey = async function (key, envelope) {
  var plain, text;
  plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: FaceCrypto.base64ToBytes(envelope.iv) },
    key,
    FaceCrypto.base64ToBytes(envelope.cipher),
  );
  text = new TextDecoder().decode(plain);
  return JSON.parse(text);
};

/**
 * Encrypt a JSON object into a portable envelope (fresh salt + IV).
 * @param {string} passphrase
 * @param {object} obj
 * @param {number} [iterations]
 * @returns {Promise<FaceCryptoEnvelope>}
 */
FaceCrypto.encryptJSON = async function (passphrase, obj, iterations) {
  var salt, iv, key, enc;
  if (iterations === undefined) iterations = FaceCrypto.KDF_ITERATIONS;
  salt = FaceCrypto.generateSalt(16);
  iv = FaceCrypto.generateSalt(12);
  key = await FaceCrypto.deriveKey(passphrase, salt, iterations);
  enc = await FaceCrypto.encryptWithKey(key, iv, obj);
  return {
    alg: "AES-GCM",
    version: FaceCrypto.VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: iterations },
    salt: FaceCrypto.bytesToBase64(salt),
    iv: enc.iv,
    cipher: enc.cipher,
  };
};

/**
 * Decrypt an envelope produced by encryptJSON.
 * @param {string} passphrase
 * @param {FaceCryptoEnvelope} envelope
 * @returns {Promise<object>}
 */
FaceCrypto.decryptJSON = async function (passphrase, envelope) {
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
  key = await FaceCrypto.deriveKey(
    passphrase,
    FaceCrypto.base64ToBytes(envelope.salt),
    envelope.kdf && envelope.kdf.iterations
      ? envelope.kdf.iterations
      : FaceCrypto.KDF_ITERATIONS,
  );
  return FaceCrypto.decryptWithKey(key, envelope);
};

/**
 * SHA-256 hex digest over raw bytes or a string.
 * @param {Uint8Array|Float32Array|ArrayBuffer|string|number[]} data
 * @returns {Promise<string>}
 */
FaceCrypto.sha256Hex = async function (data) {
  var bytes, digest;
  if (!crypto || !crypto.subtle) {
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
  digest = await crypto.subtle.digest("SHA-256", bytes);
  return FaceCrypto.bytesToHex(new Uint8Array(digest));
};

/* c8 ignore start */
if (typeof window !== "undefined") {
  window.FaceCrypto = FaceCrypto;
}
/* c8 ignore stop */
