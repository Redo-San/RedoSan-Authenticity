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
// ── Watermark-specific utilities ──

/**
 *
 * @param data
 */
function bits(data) {
  let s = "";
  for (let i = 0; i < data.length; i++)
    s += data[i].toString(2).padStart(8, "0");
  return s;
}
/**
 *
 * @param s
 */
function from_bits(s) {
  const len = Math.floor(s.length / 8),
    b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = parseInt(s.substr(i * 8, 8), 2);
  return b;
}
/**
 *
 * @param data
 * @param key
 */
function xor_bytes(data, key) {
  if (!key || !key.length) return data;
  const r = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) r[i] = data[i] ^ key[i % key.length];
  return r;
}
/**
 *
 * @param password
 */
async function pw_key(password) {
  if (!password) return new Uint8Array(0);
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(password),
        iterations: 100_000,
        hash: "SHA-256",
      },
      km,
      256,
    ),
  );
}
/**
 *
 * @param seed
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
/**
 *
 * @param arr
 * @param seed
 */
function seededShuffle(arr, seed) {
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/**
 *
 * @param bitsStr
 * @param key
 */
function extractData(bitsStr, key) {
  if (bitsStr.length < 32) return { data: null, reason: "no-data" };
  const dlen = parseInt(bitsStr.substr(0, 32), 2);
  if (dlen <= 0 || dlen > 100_000)
    return { data: null, reason: "invalid-length" };
  const neededBits = 32 + dlen * 8;
  if (bitsStr.length < neededBits) return { data: null, reason: "no-data" };
  let data = from_bits(bitsStr.substr(32, dlen * 8));
  if (key && key.length) data = xor_bytes(data, key);
  if (data.length >= 2 && data[0] === 0xaa && data[1] === 0xbb)
    return { data: data.slice(2), reason: "ok" };
  return { data: null, reason: "bad-password" };
}

// ── Shared lazy vendor loading (PDF/DOCX/QR/JSZip/OpenTimestamps) ──
// Defined in Style/shared.js for every page; this copy only activates when
// shared.js did not run first (isolated test/embed contexts).
/* c8 ignore start */
if (typeof ensureLib === "undefined") {
  const __ensureLibGlobals = {
    jspdf: () => typeof jspdf !== "undefined",
    QRious: () => typeof QRious !== "undefined",
    JSZip: () => typeof JSZip !== "undefined",
    docx: () => typeof docx !== "undefined",
    OpenTimestamps: () => typeof OpenTimestamps !== "undefined",
  };
  const __ensureLibUrls = {
    jspdf: [
      "vendor/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    ],
    QRious: [
      "vendor/qrious.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js",
      "https://unpkg.com/qrious@4.0.2/dist/qrious.min.js",
      "https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js",
    ],
    JSZip: [
      "vendor/jszip.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
      "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    ],
    docx: [
      "https://cdn.jsdelivr.net/npm/docx@8.5.0/dist/index.js",
      "https://unpkg.com/docx@8.5.0/build/index.js",
      "https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/index.js",
    ],
    OpenTimestamps: [
      "vendor/opentimestamps.min.js",
      "https://cdn.jsdelivr.net/npm/opentimestamps.min.js",
    ],
  };
  /**
   *
   * @param name
   */
  function ensureLib(name) {
    return new Promise(function (resolve, reject) {
      const check = __ensureLibGlobals[name];
      if (check && check()) return resolve();
      let urls = (__ensureLibUrls[name] || []).slice();
      if (!urls.length) return reject(new Error("Unknown library: " + name));
      if (name !== "docx") {
        const rel = urls[0];
        if (rel.indexOf("vendor/") === 0) {
          const vbase = document.documentElement.dataset.standalone
            ? "../../../vendor/"
            : "vendor/";
          urls[0] = vbase + rel.slice("vendor/".length);
        }
      }
      const loaded = typeof window !== "undefined" && window.__ensureLibCache;
      if (loaded && loaded[name] && check && check()) return resolve();
      if (!loaded) window.__ensureLibCache = {};
      const load = (i) => {
        if (i >= urls.length) {
          window.__ensureLibCache[name] = false;
          return reject(
            new Error(
              "Library " + name + " not available (vendor + CDNs all failed)",
            ),
          );
        }
        const s = document.createElement("script");
        s.src = urls[i];
        s.onload = () => {
          if (check && check()) {
            window.__ensureLibCache[name] = true;
            return resolve();
          }
          window.__ensureLibCache[name] = false;
          reject(
            new Error("Library " + name + " loaded but global not defined"),
          );
        };
        s.onerror = () => setTimeout(() => load(i + 1), 1000);
        document.head.append(s);
      };
      load(0);
    });
  }
}
/* c8 ignore stop */
