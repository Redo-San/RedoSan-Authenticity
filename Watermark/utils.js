(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
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
  for (let i = 0; i < len; i++) b[i] = Number.parseInt(s.substr(i * 8, 8), 2);
  return b;
}
/**
 *
 * @param data
 * @param key
 */
function xor_bytes(data, key) {
  if (!key || key.length === 0) return data;
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
  var s = seed | 0;
  return function () {
    s = (s + 0x9E_37_79_B9) | 0;
    var z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85_EB_CA_6B);
    z = Math.imul(z ^ (z >>> 13), 0xC2_B2_AE_35);
    z = z ^ (z >>> 16);
    return (z >>> 0) / 4_294_967_296;
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
  const dlen = Number.parseInt(bitsStr.substr(0, 32), 2);
  if (dlen <= 0 || dlen > 100_000)
    return { data: null, reason: "invalid-length" };
  const neededBits = 32 + dlen * 8;
  if (bitsStr.length < neededBits) return { data: null, reason: "no-data" };
  let data = from_bits(bitsStr.substr(32, dlen * 8));
  if (key && key.length > 0) data = xor_bytes(data, key);
  if (data.length >= 2 && data[0] === 0xAA && data[1] === 0xBB)
    return { data: data.slice(2), reason: "ok" };
  return { data: null, reason: "bad-password" };
}
