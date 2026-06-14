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
// ── Yield helper: no-op in Web Workers, setTimeout on main thread ──
function maybeYield() {
  // No yield needed in Web Worker (no DOM to paint)
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise(function (r) {
    setTimeout(r, 0);
  });
}

// ── All hashing algorithms (pure JS, no UI) ──

// ── SHA-3 (fast 32-bit pair arithmetic, no BigInt) ──
var SHA3_ROTC = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 52, 8, 25, 43, 62, 18, 39,
  61, 20, 44,
];
var SHA3_RC = [
  0x00000001, 0x00000000, 0x00008082, 0x00000000, 0x80008000, 0x80000000,
  0x00008080, 0x80000000, 0x00008009, 0x80000000, 0x0000008a, 0x80000000,
  0x00000088, 0x80000000, 0x00808009, 0x80000000, 0x0000000e, 0x80000000,
  0x0000008b, 0x80000000, 0x0080000b, 0x80000000, 0x0000808b, 0x80000000,
  0x8000000b, 0x80000000, 0x8000800a, 0x80000000, 0x00000080, 0x80000000,
  0x8000000f, 0x80000000, 0x80008008, 0x80000000, 0x00000093, 0x80000000,
  0x8000800a, 0x80000000, 0x00000096, 0x80000000, 0x00808003, 0x80000000,
  0x00808083, 0x80000000, 0x00000280, 0x80000000, 0x800000a5, 0x80000000,
];
function keccakF(st) {
  var C0 = [0, 0, 0, 0, 0],
    C1 = [0, 0, 0, 0, 0],
    D0,
    D1,
    x,
    y,
    i,
    t,
    xs,
    ys,
    idx,
    n,
    v0,
    v1;
  for (var r = 0; r < 24; r++) {
    for (x = 0; x < 5; x++) {
      i = x * 2;
      C0[x] = st[i] ^ st[i + 10] ^ st[i + 20] ^ st[i + 30] ^ st[i + 40];
      C1[x] = st[i + 1] ^ st[i + 11] ^ st[i + 21] ^ st[i + 31] ^ st[i + 41];
    }
    for (x = 0; x < 5; x++) {
      var xp1 = (x + 1) % 5,
        xm1 = (x + 4) % 5;
      D0 = C0[xm1] ^ ((C0[xp1] << 1) | (C1[xp1] >>> 31));
      D1 = C1[xm1] ^ ((C1[xp1] << 1) | (C0[xp1] >>> 31));
      for (y = 0; y < 5; y++) {
        idx = y * 10 + x * 2;
        st[idx] ^= D0;
        st[idx + 1] ^= D1;
      }
    }
    t = st[2];
    var th = st[3];
    xs = [
      0, 1, 2, 3, 4, 1, 2, 3, 4, 0, 2, 3, 4, 0, 1, 3, 4, 0, 1, 2, 4, 0, 1, 2, 3,
    ];
    ys = [
      0, 1, 2, 3, 4, 3, 4, 0, 1, 2, 1, 2, 3, 4, 0, 4, 0, 1, 2, 3, 2, 3, 4, 0, 1,
    ];
    for (x = 0; x < 24; x++) {
      idx = (xs[x] * 5 + ys[x]) * 2;
      v0 = st[idx];
      v1 = st[idx + 1];
      n = SHA3_ROTC[x];
      st[idx] =
        n < 32
          ? ((v0 << n) | (v1 >>> (32 - n))) >>> 0
          : ((v1 << (n - 32)) | (v0 >>> (64 - n))) >>> 0;
      st[idx + 1] =
        n < 32
          ? ((v1 << n) | (v0 >>> (32 - n))) >>> 0
          : ((v0 << (n - 32)) | (v1 >>> (64 - n))) >>> 0;
    }
    for (x = 0; x < 25; x++) {
      idx = x * 2;
      var t2l = st[idx],
        t2h = st[idx + 1];
      st[idx] = t;
      st[idx + 1] = th;
      t = t2l;
      th = t2h;
    }
    for (y = 0; y < 5; y++)
      for (x = 0; x < 5; x++) {
        i = y * 10 + x * 2;
        var ip1 = y * 10 + ((x + 1) % 5) * 2,
          ip2 = y * 10 + ((x + 2) % 5) * 2;
        st[i] ^= ~st[ip1] & st[ip2];
        st[i + 1] ^= ~st[ip1 + 1] & st[ip2 + 1];
      }
    st[0] ^= SHA3_RC[r * 2];
    st[1] ^= SHA3_RC[r * 2 + 1];
  }
}
async function sha3(data, bits) {
  var rate = 1600 - bits * 2,
    r = rate >> 3,
    lanes = (rate / 64) | 0,
    st = new Uint32Array(50);
  var i = 0,
    _sc = 0;
  for (; i + r <= data.length; i += r) {
    for (var j = 0; j < r; j++) {
      var half = j & 4 ? 1 : 0;
      st[(j >> 3) * 2 + half] ^= data[i + j] << ((j & 3) << 3);
    }
    keccakF(st);
    if (++_sc % 200 === 0) await maybeYield();
  }
  var rem = data.length - i;
  for (var j = 0; j < rem; j++) {
    var half = j & 4 ? 1 : 0;
    st[(j >> 3) * 2 + half] ^= data[i + j] << ((j & 3) << 3);
  }
  st[(rem >> 3) * 2 + (rem & 4 ? 1 : 0)] ^= 0x06 << ((rem & 3) << 3);
  st[(lanes - 1) * 2] ^= 0x80000000;
  st[(lanes - 1) * 2 + 1] ^= 0x80000000;
  keccakF(st);
  var outBytes = bits >> 3,
    result = new Uint8Array(outBytes);
  for (var j = 0; j < outBytes; j++)
    result[j] = (st[(j >> 3) * 2 + (j & 4 ? 1 : 0)] >> ((j & 3) << 3)) & 0xff;
  return Array.from(result)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}
var sha3_224 = async function (d) {
  return await sha3(d, 224);
};
var sha3_256 = async function (d) {
  return await sha3(d, 256);
};
var sha3_384 = async function (d) {
  return await sha3(d, 384);
};
var sha3_512 = async function (d) {
  return await sha3(d, 512);
};

// ── BLAKE2b (64-byte digest) ──
var B2IV = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
];
var B2SIG = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];
function blake2bG(v, a, b, c, d, x, y) {
  v[a] = (v[a] + v[b] + x) & 0xffffffffffffffffn;
  v[d] = blake2bRor(v[d] ^ v[a], 32);
  v[c] = (v[c] + v[d]) & 0xffffffffffffffffn;
  v[b] = blake2bRor(v[b] ^ v[c], 24);
  v[a] = (v[a] + v[b] + y) & 0xffffffffffffffffn;
  v[d] = blake2bRor(v[d] ^ v[a], 16);
  v[c] = (v[c] + v[d]) & 0xffffffffffffffffn;
  v[b] = blake2bRor(v[b] ^ v[c], 63);
}
function blake2bRor(x, n) {
  return (x >> BigInt(n)) | (x << BigInt(64 - n));
}
function blake2bLoad64(data, off) {
  return (
    BigInt(data[off]) |
    (BigInt(data[off + 1]) << 8n) |
    (BigInt(data[off + 2]) << 16n) |
    (BigInt(data[off + 3]) << 24n) |
    (BigInt(data[off + 4]) << 32n) |
    (BigInt(data[off + 5]) << 40n) |
    (BigInt(data[off + 6]) << 48n) |
    (BigInt(data[off + 7]) << 56n)
  );
}
function blake2bCompress(h, m, counter, final) {
  var v = new Array(16);
  for (var i = 0; i < 8; i++) {
    v[i] = h[i];
    v[i + 8] = B2IV[i];
  }
  v[12] ^= BigInt(counter) & 0xffffffffffffffffn;
  v[13] ^= BigInt(counter >> 32) & 0xffffffffffffffffn;
  if (final) v[14] = ~v[14];
  for (var r = 0; r < 12; r++) {
    var s = B2SIG[r % 10];
    blake2bG(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
    blake2bG(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
    blake2bG(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
    blake2bG(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
    blake2bG(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
    blake2bG(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
    blake2bG(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
    blake2bG(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
  }
  for (var i = 0; i < 8; i++)
    h[i] = (h[i] ^ v[i] ^ v[i + 8]) & 0xffffffffffffffffn;
}
async function blake2b(data) {
  var outLen = 64,
    _bi = 0;
  var h = B2IV.slice();
  h[0] ^= 0x01010000n ^ BigInt(outLen);
  var offset = 0,
    counter = 0;
  while (offset + 128 <= data.length) {
    counter += 128;
    var m = new Array(16);
    for (var i = 0; i < 16; i++) m[i] = blake2bLoad64(data, offset + i * 8);
    blake2bCompress(h, m, counter, false);
    offset += 128;
    if (++_bi % 4000 === 0) await maybeYield();
  }
  var last = new Uint8Array(128);
  last.fill(0);
  var rem = data.length - offset;
  for (var j = 0; j < rem; j++) last[j] = data[offset + j];
  counter += rem;
  var m = new Array(16);
  for (var i = 0; i < 16; i++) m[i] = blake2bLoad64(last, i * 8);
  blake2bCompress(h, m, counter, true);
  var out = new Uint8Array(outLen);
  for (var i = 0; i < outLen; i++)
    out[i] = Number((h[i >> 3] >> BigInt((i & 7) << 3)) & 0xffn);
  return Array.from(out)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}
// ── BLAKE2s (32-bit version) ──
var B2S_IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];
var B2S_SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];
function b2s_ror32(x, n) {
  return (x >>> n) | (x << (32 - n));
}
function b2s_compress(h, m, counter, final) {
  var v = new Uint32Array(16),
    i,
    r,
    s;
  for (i = 0; i < 8; i++) v[i] = h[i];
  v[8] = B2S_IV[0];
  v[9] = B2S_IV[1];
  v[10] = B2S_IV[2];
  v[11] = B2S_IV[3];
  v[12] = B2S_IV[4] ^ (counter & 0xffffffff);
  v[13] = B2S_IV[5] ^ ((counter >>> 32) & 0xffffffff);
  if (final) v[14] = ~v[14] >>> 0;
  function G(a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = b2s_ror32(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b2s_ror32(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = b2s_ror32(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b2s_ror32(v[b] ^ v[c], 7);
  }
  for (r = 0; r < 10; r++) {
    s = B2S_SIGMA[r % 10];
    G(0, 4, 8, 12, m[s[0]], m[s[1]]);
    G(1, 5, 9, 13, m[s[2]], m[s[3]]);
    G(2, 6, 10, 14, m[s[4]], m[s[5]]);
    G(3, 7, 11, 15, m[s[6]], m[s[7]]);
    G(0, 5, 10, 15, m[s[8]], m[s[9]]);
    G(1, 6, 11, 12, m[s[10]], m[s[11]]);
    G(2, 7, 8, 13, m[s[12]], m[s[13]]);
    G(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }
  for (i = 0; i < 8; i++) h[i] = (h[i] ^ v[i] ^ v[i + 8]) >>> 0;
}
function b2s_load32(d, o) {
  return d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24);
}
async function blake2s(data) {
  var outLen = 32,
    h = B2S_IV.slice(),
    _ci = 0;
  h[0] ^= 0x01010000 ^ outLen;
  var offset = 0,
    counter = 0;
  while (offset + 64 <= data.length) {
    counter += 64;
    var m = new Array(16);
    for (var i = 0; i < 16; i++) m[i] = b2s_load32(data, offset + i * 4);
    b2s_compress(h, m, counter, false);
    offset += 64;
    if (++_ci % 8000 === 0) await maybeYield();
  }
  var last = new Uint8Array(64);
  last.fill(0);
  var rem = data.length - offset;
  for (var j = 0; j < rem; j++) last[j] = data[offset + j];
  counter += rem;
  var m = new Array(16);
  for (var i = 0; i < 16; i++) m[i] = b2s_load32(last, i * 4);
  b2s_compress(h, m, counter, true);
  var out = new Uint8Array(outLen);
  for (var i = 0; i < outLen; i++)
    out[i] = (h[i >> 2] >> ((i & 3) << 3)) & 0xff;
  return Array.from(out)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── Minimal MD5 implementation ──
async function md5(data) {
  var s = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  function F(x, y, z) {
    return (x & y) | (~x & z);
  }
  function G(x, y, z) {
    return (x & z) | (y & ~z);
  }
  function H(x, y, z) {
    return x ^ y ^ z;
  }
  function I(x, y, z) {
    return y ^ (x | ~z);
  }
  function rot(x, n) {
    return (x << n) | (x >>> (32 - n));
  }
  function FF(a, b, c, d, x, s, ac) {
    a = rot((a + F(b, c, d) + x + ac) & 0xffffffff, s) + b;
    return a & 0xffffffff;
  }
  function GG(a, b, c, d, x, s, ac) {
    a = rot((a + G(b, c, d) + x + ac) & 0xffffffff, s) + b;
    return a & 0xffffffff;
  }
  function HH(a, b, c, d, x, s, ac) {
    a = rot((a + H(b, c, d) + x + ac) & 0xffffffff, s) + b;
    return a & 0xffffffff;
  }
  function II(a, b, c, d, x, s, ac) {
    a = rot((a + I(b, c, d) + x + ac) & 0xffffffff, s) + b;
    return a & 0xffffffff;
  }
  function toBytes(d) {
    var b = new Uint8Array(4);
    b[0] = d & 0xff;
    b[1] = (d >> 8) & 0xff;
    b[2] = (d >> 16) & 0xff;
    b[3] = (d >> 24) & 0xff;
    return b;
  }
  var origLen = data.length * 8;
  var msg = new Uint8Array(((data.length + 8) & -64) + 64);
  for (var i = 0; i < data.length; i++) msg[i] = data[i];
  msg[data.length] = 0x80;
  new DataView(msg.buffer).setUint32(msg.length - 8, origLen, true);
  var _mc = 0;
  for (var off = 0; off < msg.length; off += 64) {
    if (++_mc % 4000 === 0) await maybeYield();
    var w = new Array(16);
    for (var i = 0; i < 16; i++)
      w[i] = new DataView(msg.buffer).getUint32(off + i * 4, true);
    var a = s[0],
      b = s[1],
      c = s[2],
      d = s[3];
    a = FF(a, b, c, d, w[0], 7, 0xd76aa478);
    d = FF(d, a, b, c, w[1], 12, 0xe8c7b756);
    c = FF(c, d, a, b, w[2], 17, 0x242070db);
    b = FF(b, c, d, a, w[3], 22, 0xc1bdceee);
    a = FF(a, b, c, d, w[4], 7, 0xf57c0faf);
    d = FF(d, a, b, c, w[5], 12, 0x4787c62a);
    c = FF(c, d, a, b, w[6], 17, 0xa8304613);
    b = FF(b, c, d, a, w[7], 22, 0xfd469501);
    a = FF(a, b, c, d, w[8], 7, 0x698098d8);
    d = FF(d, a, b, c, w[9], 12, 0x8b44f7af);
    c = FF(c, d, a, b, w[10], 17, 0xffff5bb1);
    b = FF(b, c, d, a, w[11], 22, 0x895cd7be);
    a = FF(a, b, c, d, w[12], 7, 0x6b901122);
    d = FF(d, a, b, c, w[13], 12, 0xfd987193);
    c = FF(c, d, a, b, w[14], 17, 0xa679438e);
    b = FF(b, c, d, a, w[15], 22, 0x49b40821);
    a = GG(a, b, c, d, w[1], 5, 0xf61e2562);
    d = GG(d, a, b, c, w[6], 9, 0xc040b340);
    c = GG(c, d, a, b, w[11], 14, 0x265e5a51);
    b = GG(b, c, d, a, w[0], 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, w[5], 5, 0xd62f105d);
    d = GG(d, a, b, c, w[10], 9, 0x02441453);
    c = GG(c, d, a, b, w[15], 14, 0xd8a1e681);
    b = GG(b, c, d, a, w[4], 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, w[9], 5, 0x21e1cde6);
    d = GG(d, a, b, c, w[14], 9, 0xc33707d6);
    c = GG(c, d, a, b, w[3], 14, 0xf4d50d87);
    b = GG(b, c, d, a, w[8], 20, 0x455a14ed);
    a = GG(a, b, c, d, w[13], 5, 0xa9e3e905);
    d = GG(d, a, b, c, w[2], 9, 0xfcefa3f8);
    c = GG(c, d, a, b, w[7], 14, 0x676f02d9);
    b = GG(b, c, d, a, w[12], 20, 0x8d2a4c8a);
    a = HH(a, b, c, d, w[5], 4, 0xfffa3942);
    d = HH(d, a, b, c, w[8], 11, 0x8771f681);
    c = HH(c, d, a, b, w[11], 16, 0x6d9d6122);
    b = HH(b, c, d, a, w[14], 23, 0xfde5380c);
    a = HH(a, b, c, d, w[1], 4, 0xa4beea44);
    d = HH(d, a, b, c, w[4], 11, 0x4bdecfa9);
    c = HH(c, d, a, b, w[7], 16, 0xf6bb4b60);
    b = HH(b, c, d, a, w[10], 23, 0xbebfbc70);
    a = HH(a, b, c, d, w[13], 4, 0x289b7ec6);
    d = HH(d, a, b, c, w[0], 11, 0xeaa127fa);
    c = HH(c, d, a, b, w[3], 16, 0xd4ef3085);
    b = HH(b, c, d, a, w[6], 23, 0x04881d05);
    a = HH(a, b, c, d, w[9], 4, 0xd9d4d039);
    d = HH(d, a, b, c, w[12], 11, 0xe6db99e5);
    c = HH(c, d, a, b, w[15], 16, 0x1fa27cf8);
    b = HH(b, c, d, a, w[2], 23, 0xc4ac5665);
    a = II(a, b, c, d, w[0], 6, 0xf4292244);
    d = II(d, a, b, c, w[7], 10, 0x432aff97);
    c = II(c, d, a, b, w[14], 15, 0xab9423a7);
    b = II(b, c, d, a, w[5], 21, 0xfc93a039);
    a = II(a, b, c, d, w[12], 6, 0x655b59c3);
    d = II(d, a, b, c, w[3], 10, 0x8f0ccc92);
    c = II(c, d, a, b, w[10], 15, 0xffeff47d);
    b = II(b, c, d, a, w[1], 21, 0x85845dd1);
    a = II(a, b, c, d, w[8], 6, 0x6fa87e4f);
    d = II(d, a, b, c, w[15], 10, 0xfe2ce6e0);
    c = II(c, d, a, b, w[6], 15, 0xa3014314);
    b = II(b, c, d, a, w[13], 21, 0x4e0811a1);
    a = II(a, b, c, d, w[4], 6, 0xf7537e82);
    d = II(d, a, b, c, w[11], 10, 0xbd3af235);
    c = II(c, d, a, b, w[2], 15, 0x2ad7d2bb);
    b = II(b, c, d, a, w[9], 21, 0xeb86d391);
    s[0] = (s[0] + a) & 0xffffffff;
    s[1] = (s[1] + b) & 0xffffffff;
    s[2] = (s[2] + c) & 0xffffffff;
    s[3] = (s[3] + d) & 0xffffffff;
  }
  var r = "";
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++)
      r += ((s[i] >>> (j * 8)) & 0xff).toString(16).padStart(2, "0");
  }
  return r;
}

// ── SHA-224 ──
async function sha224(data) {
  var K = new Uint32Array([
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
  ]);
  var H = new Uint32Array([
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511,
    0x64f98fa7, 0xbefa4fa4,
  ]);
  var len = data.length,
    bits = len * 8;
  var padLen = (56 - ((len + 1) % 64) + 64) % 64;
  var ml = len + 1 + padLen + 8;
  var m = new Uint8Array(ml);
  m.set(data);
  m[len] = 0x80;
  var dv = new DataView(m.buffer, m.byteOffset, m.byteLength);
  dv.setUint32(ml - 4, bits, false);
  var _sc224 = 0;
  for (var off = 0; off < ml; off += 64) {
    if (++_sc224 % 4000 === 0) await maybeYield();
    var W = new Uint32Array(64);
    for (var t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4, false);
    for (var t = 16; t < 64; t++) {
      var s0 =
        ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^
        ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^
        (W[t - 15] >>> 3);
      var s1 =
        ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^
        ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^
        (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    var a = H[0],
      b = H[1],
      c = H[2],
      d = H[3];
    var e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];
    for (var t = 0; t < 64; t++) {
      var S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      var S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) >>> 0;
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
  var out = new Uint8Array(28);
  for (var i = 0; i < 7; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return Array.from(out)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── MD2 ──
function md2(data) {
  var S = [
    0x29, 0x2e, 0x43, 0xc9, 0xa2, 0xd8, 0x7c, 0x01, 0x3d, 0x36, 0x54, 0xa1,
    0xec, 0xf0, 0x06, 0x13, 0x62, 0xa7, 0x05, 0xf3, 0xc0, 0xc7, 0x73, 0x8c,
    0x98, 0x93, 0x2b, 0xd9, 0xbc, 0x4c, 0x82, 0xca, 0x1e, 0x9b, 0x57, 0x3c,
    0xfd, 0xd4, 0xe0, 0x16, 0x67, 0x42, 0x6f, 0x18, 0x8a, 0x17, 0xe5, 0x12,
    0xbe, 0x4e, 0xc4, 0xd6, 0xda, 0x9e, 0xde, 0x49, 0xa0, 0xfb, 0xf5, 0x8e,
    0x66, 0xcd, 0xbc, 0xc9, 0x53, 0x0e, 0x02, 0xb5, 0x9e, 0xba, 0x20, 0xfe,
    0xf7, 0x3b, 0x53, 0xc7, 0xc4, 0x24, 0x19, 0x96, 0x95, 0x3d, 0x3a, 0x12,
    0x44, 0x12, 0x64, 0xbb, 0x7c, 0x99, 0xe0, 0x43, 0xad, 0x12, 0xe7, 0x5b,
    0x04, 0x20, 0xd6, 0x53, 0x8a, 0xc2, 0x9e, 0x32, 0xdb, 0x4c, 0xa6, 0xd5,
    0x0a, 0x24, 0xa2, 0xd4, 0x03, 0x14, 0xe4, 0xdb, 0x1c, 0x57, 0x09, 0x72,
    0xd5, 0x4d, 0x30, 0xed, 0x5a, 0x0a, 0x35, 0xaa, 0x25, 0x23, 0xb0, 0x87,
    0xdc, 0xc7, 0x80, 0xf7, 0xc3, 0x7e, 0x3e, 0x90, 0x79, 0x2e, 0xa9, 0x06,
    0x06, 0xdb, 0x92, 0xec, 0x77, 0x0d, 0x6b, 0x53, 0x3e, 0x34, 0xc0, 0xae,
    0x37, 0xaf, 0x03, 0xc2, 0xd0, 0x4d, 0xbb, 0xd5, 0x7e, 0x3f, 0x4a, 0x2c,
    0x7a, 0xd3, 0x8b, 0x93, 0x1d, 0xbf, 0xd0, 0xb5, 0x36, 0xd0, 0x7b, 0x76,
    0x3d, 0x4c, 0xdf, 0x5a, 0xb8, 0x6b, 0x62, 0xc4, 0x75, 0xd4, 0xe4, 0x9f,
    0x09, 0xf4, 0x30, 0xd6, 0xda, 0x27, 0x17, 0x5d, 0x4c, 0x46, 0x07, 0xa5,
    0x97, 0x18, 0x82, 0x85, 0x8e, 0xa4, 0x75, 0xc3, 0x59, 0x7b, 0x27, 0xbf,
    0x6f, 0x11, 0x52, 0x38, 0x3d, 0x8c, 0x65, 0x40, 0xbe, 0xe8, 0x2a, 0xeb,
    0xd5, 0x6a, 0x1c, 0x57, 0x4b, 0xf7, 0xdc, 0x6c, 0x32, 0x81, 0xe5, 0x7d,
    0x64, 0xdd, 0x04, 0x54, 0xe1, 0x75, 0x6d, 0xd1, 0x80, 0xae, 0xa4, 0x65,
    0x34, 0xd7, 0x46, 0xdb,
  ];
  var bytes = new Uint8Array(data);
  var len = bytes.length;
  var padLen = 16 - (len % 16);
  var padded = new Uint8Array(len + padLen);
  padded.set(bytes);
  for (var i = len; i < padded.length; i++) padded[i] = padLen;
  var checksum = new Uint8Array(16);
  var L = 0;
  for (var i = 0; i < padded.length; i += 16) {
    for (var j = 0; j < 16; j++) {
      var c = padded[i + j];
      L = checksum[j] ^ S[c ^ L];
      checksum[j] = L;
    }
  }
  var final = new Uint8Array(padded.length + 16);
  final.set(padded);
  final.set(checksum, padded.length);
  var state = new Uint8Array(48);
  for (var i = 0; i < final.length; i += 16) {
    for (var j = 0; j < 16; j++) state[16 + j] = final[i + j];
    for (var j = 0; j < 16; j++) state[32 + j] = state[16 + j] ^ state[j];
    var t2 = 0;
    for (var round = 0; round < 18; round++) {
      for (var k = 0; k < 48; k++) {
        t2 = state[k] ^= S[t2];
      }
      t2 = (t2 + round) & 0xff;
    }
  }
  return Array.from(state.slice(0, 16))
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── MD4 ──
function md4(data) {
  function F(x, y, z) {
    return (x & y) | (~x & z);
  }
  function G(x, y, z) {
    return (x & y) | (x & z) | (y & z);
  }
  function H(x, y, z) {
    return x ^ y ^ z;
  }
  function rot(x, n) {
    return (x << n) | (x >>> (32 - n));
  }
  var bytes = new Uint8Array(data);
  var origLen = bytes.length * 8;
  var pad = new Uint8Array([...bytes, 0x80]);
  while ((pad.length * 8) % 512 !== 448) {
    var p2 = new Uint8Array(pad.length + 1);
    p2.set(pad);
    pad = p2;
  }
  var lb = new ArrayBuffer(8);
  new DataView(lb).setUint32(0, origLen, true);
  new DataView(lb).setUint32(4, 0, true);
  pad = new Uint8Array([...pad, ...new Uint8Array(lb)]);
  var A = 0x67452301,
    B = 0xefcdab89,
    C = 0x98badcfe,
    D = 0x10325476;
  for (var i = 0; i < pad.length; i += 64) {
    var X = new Array(16);
    for (var j = 0; j < 16; j++)
      X[j] =
        pad[i + j * 4] |
        (pad[i + j * 4 + 1] << 8) |
        (pad[i + j * 4 + 2] << 16) |
        (pad[i + j * 4 + 3] << 24);
    var AA = A,
      BB = B,
      CC = C,
      DD = D;
    for (var n = 0; n < 16; n++) {
      var s = [3, 7, 11, 19][n % 4];
      A = rot(A + F(B, C, D) + X[n], s);
      var t = A;
      A = D;
      D = C;
      C = B;
      B = t;
    }
    for (var n = 0; n < 16; n++) {
      var s = [3, 5, 9, 13][n % 4];
      var k = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15][n];
      A = rot(A + G(B, C, D) + X[k] + 0x5a827999, s);
      var t = A;
      A = D;
      D = C;
      C = B;
      B = t;
    }
    for (var n = 0; n < 16; n++) {
      var s = [3, 9, 11, 15][n % 4];
      var k = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15][n];
      A = rot(A + H(B, C, D) + X[k] + 0x6ed9eba1, s);
      var t = A;
      A = D;
      D = C;
      C = B;
      B = t;
    }
    A = (A + AA) & 0xffffffff;
    B = (B + BB) & 0xffffffff;
    C = (C + CC) & 0xffffffff;
    D = (D + DD) & 0xffffffff;
  }
  var r = new Uint8Array(16);
  new DataView(r.buffer).setUint32(0, A, true);
  new DataView(r.buffer).setUint32(4, B, true);
  new DataView(r.buffer).setUint32(8, C, true);
  new DataView(r.buffer).setUint32(12, D, true);
  return Array.from(r)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── RIPEMD-160 ──
async function ripemd160(data) {
  function rot(x, n) {
    return (x << n) | (x >>> (32 - n));
  }
  function f1(x, y, z) {
    return x ^ y ^ z;
  }
  function f2(x, y, z) {
    return (x & y) | (~x & z);
  }
  function f3(x, y, z) {
    return (x | ~y) ^ z;
  }
  function f4(x, y, z) {
    return (x & z) | (y & ~z);
  }
  function f5(x, y, z) {
    return x ^ (y | ~z);
  }
  var K = [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  var Kp = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0];
  var R = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6,
    15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13,
    11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9,
    7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
  ];
  var Rp = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5,
    10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10,
    0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10,
    4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
  ];
  var S = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8];
  var Sp = [10, 13, 14, 11, 12, 7, 6, 8, 9, 11, 13, 14, 5, 6, 7, 9];
  var bytes = new Uint8Array(data);
  var origLen = bytes.length * 8;
  var pad = new Uint8Array([...bytes, 0x80]);
  while ((pad.length * 8) % 512 !== 448) {
    var p2 = new Uint8Array(pad.length + 1);
    p2.set(pad);
    pad = p2;
  }
  var lb = new ArrayBuffer(8);
  new DataView(lb).setUint32(0, origLen, true);
  new DataView(lb).setUint32(4, 0, true);
  pad = new Uint8Array([...pad, ...new Uint8Array(lb)]);
  var h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  var _rc = 0;
  for (var i = 0; i < pad.length; i += 64) {
    if (++_rc % 2000 === 0) await maybeYield();
    var X = new Array(16);
    for (var j = 0; j < 16; j++)
      X[j] =
        pad[i + j * 4] |
        (pad[i + j * 4 + 1] << 8) |
        (pad[i + j * 4 + 2] << 16) |
        (pad[i + j * 4 + 3] << 24);
    var A = h0,
      B = h1,
      C = h2,
      D = h3,
      E = h4,
      Ap = h0,
      Bp = h1,
      Cp = h2,
      Dp = h3,
      Ep = h4;
    for (var j = 0; j < 80; j++) {
      var grp = j < 16 ? 0 : j < 32 ? 1 : j < 48 ? 2 : j < 64 ? 3 : 4;
      var T = A + f1(B, C, D) + X[R[j]] + K[grp];
      T = rot(T, S[j % 16]);
      var Tp = Ap + f5(Bp, Cp, Dp) + X[Rp[j]] + Kp[grp];
      Tp = rot(Tp, Sp[j % 16]);
      A = E;
      E = D;
      D = rot(C, 10);
      C = B;
      B = T;
      Ap = Ep;
      Ep = Dp;
      Dp = rot(Cp, 10);
      Cp = Bp;
      Bp = Tp;
    }
    var T = h1 + C + Dp;
    h1 = h2 + D + Ep;
    h2 = h3 + E + Ap;
    h3 = h4 + A + Bp;
    h4 = h0 + B + Cp;
    h0 = T;
  }
  var r = new Uint8Array(20);
  new DataView(r.buffer).setUint32(0, h0, true);
  new DataView(r.buffer).setUint32(4, h1, true);
  new DataView(r.buffer).setUint32(8, h2, true);
  new DataView(r.buffer).setUint32(12, h3, true);
  new DataView(r.buffer).setUint32(16, h4, true);
  return Array.from(r)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── BLAKE3 (pure JS implementation) ──
var B3_IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];
var B3_SIGMA = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13,
  6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1,
  9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8, 9, 0, 5, 7, 2, 4,
  10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5,
  15, 14, 1, 9, 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
];
function b3_rot32(x, n) {
  return (x >>> n) | (x << (32 - n));
}
function b3_ld32(b, o) {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
}
function b3_st32(a, o, v) {
  a[o] = v & 255;
  a[o + 1] = (v >>> 8) & 255;
  a[o + 2] = (v >>> 16) & 255;
  a[o + 3] = (v >>> 24) & 255;
}
function b3_compress(s, blk, off, cl, ch, bl, fl) {
  var v = new Uint32Array(16),
    i,
    r,
    si;
  for (i = 0; i < 8; i++) v[i] = s[i];
  v[8] = B3_IV[0];
  v[9] = B3_IV[1];
  v[10] = B3_IV[2];
  v[11] = B3_IV[3];
  v[12] = B3_IV[4] ^ cl;
  v[13] = B3_IV[5] ^ ch;
  v[14] = B3_IV[6] ^ bl;
  v[15] = B3_IV[7] ^ fl;
  var m = [];
  for (i = 0; i < 16; i++) {
    m.push(b3_ld32(blk, off + i * 4));
    v[i] ^= m[i];
  }
  function G(a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = b3_rot32(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b3_rot32(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = b3_rot32(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b3_rot32(v[b] ^ v[c], 7);
  }
  for (r = 0; r < 7; r++) {
    si = r * 16;
    G(0, 4, 8, 12, m[B3_SIGMA[si]], m[B3_SIGMA[si + 1]]);
    G(1, 5, 9, 13, m[B3_SIGMA[si + 2]], m[B3_SIGMA[si + 3]]);
    G(2, 6, 10, 14, m[B3_SIGMA[si + 4]], m[B3_SIGMA[si + 5]]);
    G(3, 7, 11, 15, m[B3_SIGMA[si + 6]], m[B3_SIGMA[si + 7]]);
    G(0, 5, 10, 15, m[B3_SIGMA[si + 8]], m[B3_SIGMA[si + 9]]);
    G(1, 6, 11, 12, m[B3_SIGMA[si + 10]], m[B3_SIGMA[si + 11]]);
    G(2, 7, 8, 13, m[B3_SIGMA[si + 12]], m[B3_SIGMA[si + 13]]);
    G(3, 4, 9, 14, m[B3_SIGMA[si + 14]], m[B3_SIGMA[si + 15]]);
  }
  for (i = 0; i < 8; i++) s[i] = (s[i] ^ v[i] ^ v[i + 8]) >>> 0;
}
function b3_xof(s, blk, off, cl, ch, bl, fl) {
  var v = new Uint32Array(16),
    i,
    r,
    si;
  for (i = 0; i < 8; i++) v[i] = s[i];
  v[8] = B3_IV[0];
  v[9] = B3_IV[1];
  v[10] = B3_IV[2];
  v[11] = B3_IV[3];
  v[12] = B3_IV[4] ^ cl;
  v[13] = B3_IV[5] ^ ch;
  v[14] = B3_IV[6] ^ bl;
  v[15] = B3_IV[7] ^ fl;
  var m = [];
  for (i = 0; i < 16; i++) {
    m.push(b3_ld32(blk, off + i * 4));
    v[i] ^= m[i];
  }
  function G(a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = b3_rot32(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b3_rot32(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = b3_rot32(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = b3_rot32(v[b] ^ v[c], 7);
  }
  for (r = 0; r < 7; r++) {
    si = r * 16;
    G(0, 4, 8, 12, m[B3_SIGMA[si]], m[B3_SIGMA[si + 1]]);
    G(1, 5, 9, 13, m[B3_SIGMA[si + 2]], m[B3_SIGMA[si + 3]]);
    G(2, 6, 10, 14, m[B3_SIGMA[si + 4]], m[B3_SIGMA[si + 5]]);
    G(3, 7, 11, 15, m[B3_SIGMA[si + 6]], m[B3_SIGMA[si + 7]]);
    G(0, 5, 10, 15, m[B3_SIGMA[si + 8]], m[B3_SIGMA[si + 9]]);
    G(1, 6, 11, 12, m[B3_SIGMA[si + 10]], m[B3_SIGMA[si + 11]]);
    G(2, 7, 8, 13, m[B3_SIGMA[si + 12]], m[B3_SIGMA[si + 13]]);
    G(3, 4, 9, 14, m[B3_SIGMA[si + 14]], m[B3_SIGMA[si + 15]]);
  }
  for (i = 0; i < 8; i++) s[i] = v[i] >>> 0;
}
async function blake3(data) {
  var BL = 64,
    CH = 1024,
    OL = 32;
  if (data.length === 0) {
    var cv = B3_IV.slice(),
      blk = new Uint8Array(BL);
    b3_compress(cv, blk, 0, 0, 0, 0, 1 | 2 | 8);
    var out = new Uint8Array(OL);
    for (var i = 0; i < OL / 4; i++) b3_st32(out, i * 4, cv[i]);
    return Array.from(out)
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }
  var nc = Math.ceil(data.length / CH),
    cvs = [];
  for (var c = 0; c < nc; c++) {
    var cs = c * CH,
      ce = Math.min(cs + CH, data.length),
      nb = Math.ceil((ce - cs) / BL);
    var cv = B3_IV.slice();
    for (var b = 0; b < nb; b++) {
      var bs = cs + b * BL,
        be = Math.min(bs + BL, data.length),
        bw = be - bs;
      var blk = new Uint8Array(BL);
      blk.set(data.subarray(bs, be));
      var fl = 0;
      if (b === 0) fl |= 1;
      if (b === nb - 1) fl |= 2;
      var co = bs - cs;
      b3_compress(
        cv,
        blk,
        0,
        co >>> 0,
        Math.floor(co / 4294967296) >>> 0,
        bw,
        fl,
      );
    }
    cvs.push(cv.slice());
  }
  while (cvs.length > 1) {
    var nxt = [];
    for (var i = 0; i < cvs.length; i += 2) {
      if (i + 1 >= cvs.length) {
        nxt.push(cvs[i]);
        continue;
      }
      var l = cvs[i],
        rgt = cvs[i + 1],
        pb = new Uint8Array(BL);
      for (var j = 0; j < 8; j++) {
        b3_st32(pb, j * 4, l[j]);
        b3_st32(pb, 32 + j * 4, rgt[j]);
      }
      var pc = B3_IV.slice(),
        isLast = nxt.length === 0 && cvs.length <= 2;
      b3_compress(pc, pb, 0, 0, 0, BL, 4 | (isLast ? 8 : 0));
      nxt.push(pc);
    }
    cvs = nxt;
  }
  var out = new Uint8Array(OL);
  for (var i = 0; i < OL / 4; i++) b3_st32(out, i * 4, cvs[0][i]);
  return Array.from(out)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── Whirlpool (ISO/IEC 10118-3) ──
var WP_SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe,
  0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4,
  0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7,
  0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3,
  0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09,
  0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3,
  0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe,
  0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85,
  0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92,
  0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c,
  0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19,
  0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14,
  0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2,
  0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5,
  0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25,
  0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86,
  0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e,
  0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42,
  0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];
var WP_MDS = [
  [0x01, 0x01, 0x04, 0x01, 0x08, 0x05, 0x02, 0x09],
  [0x09, 0x01, 0x01, 0x04, 0x01, 0x08, 0x05, 0x02],
  [0x02, 0x09, 0x01, 0x01, 0x04, 0x01, 0x08, 0x05],
  [0x05, 0x02, 0x09, 0x01, 0x01, 0x04, 0x01, 0x08],
  [0x08, 0x05, 0x02, 0x09, 0x01, 0x01, 0x04, 0x01],
  [0x01, 0x08, 0x05, 0x02, 0x09, 0x01, 0x01, 0x04],
  [0x04, 0x01, 0x08, 0x05, 0x02, 0x09, 0x01, 0x01],
  [0x01, 0x04, 0x01, 0x08, 0x05, 0x02, 0x09, 0x01],
];
function wp_gf_mul(a, b) {
  var r = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) r ^= a;
    var h = a & 0x80;
    a = (a << 1) & 0xff;
    if (h) a ^= 0x11d;
    b >>= 1;
  }
  return r;
}
function wp_subBytes(s) {
  for (var i = 0; i < 64; i++) s[i] = WP_SBOX[s[i]];
}
function wp_shiftColumns(s) {
  var t = new Uint8Array(64);
  for (var c = 0; c < 8; c++)
    for (var r = 0; r < 8; r++) t[((r + c) % 8) * 8 + c] = s[r * 8 + c];
  return t;
}
function wp_mixRows(s) {
  var t = new Uint8Array(64);
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++) {
      var v = 0;
      for (var k = 0; k < 8; k++) v ^= wp_gf_mul(WP_MDS[c][k], s[r * 8 + k]);
      t[r * 8 + c] = v;
    }
  return t;
}
function wp_addRoundKey(s, k) {
  for (var i = 0; i < 64; i++) s[i] ^= k[i];
}
function wp_keySchedule(k, rc) {
  wp_subBytes(k);
  k = wp_shiftColumns(k);
  k = wp_mixRows(k);
  for (var i = 0; i < 8; i++) k[i * 8 + i] ^= rc[i];
  return k;
}
function wp_cipher(msg, k) {
  var s = new Uint8Array(msg);
  for (var r = 0; r < 10; r++) {
    wp_subBytes(s);
    s = wp_shiftColumns(s);
    s = wp_mixRows(s);
    wp_addRoundKey(s, k);
    k = wp_keySchedule(k, WP_RC[r]);
  }
  return s;
}
var WP_RC = [];
(function () {
  for (var i = 0; i < 10; i++) {
    var rc = new Uint8Array(8);
    for (var j = 0; j < 8; j++) rc[j] = WP_SBOX[(8 * i + j) % 256];
    WP_RC.push(rc);
  }
})();
async function whirlpool(data) {
  var bits = data.length * 8,
    _wc = 0;
  var padLen = (32 - ((data.length + 1) % 64) + 64) % 64;
  var ml = data.length + 1 + padLen + 32;
  var m = new Uint8Array(ml);
  m.set(data);
  m[data.length] = 0x80;
  var lenOff = ml - 32;
  for (var i = 0; i < 24; i++) m[lenOff + i] = 0;
  m[lenOff + 24] = (bits >>> 56) & 0xff;
  m[lenOff + 25] = (bits >>> 48) & 0xff;
  m[lenOff + 26] = (bits >>> 40) & 0xff;
  m[lenOff + 27] = (bits >>> 32) & 0xff;
  m[lenOff + 28] = (bits >>> 24) & 0xff;
  m[lenOff + 29] = (bits >>> 16) & 0xff;
  m[lenOff + 30] = (bits >>> 8) & 0xff;
  m[lenOff + 31] = bits & 0xff;
  var H = new Uint8Array(64);
  for (var off = 0; off < ml; off += 64) {
    if (++_wc % 4000 === 0) await maybeYield();
    var blk = m.subarray(off, off + 64);
    var K = new Uint8Array(H);
    var enc = wp_cipher(blk, K);
    for (var i = 0; i < 64; i++) H[i] ^= blk[i] ^ enc[i];
  }
  return Array.from(H)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// ── Full fingerprint ──
async function fingerprintFile(file) {
  var buf = await file.arrayBuffer();
  var data = new Uint8Array(buf);
  var name = file.name;
  var ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  var imgExts = [
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".gif",
    ".tiff",
    ".tif",
    ".webp",
  ];

  var hashes = {};
  async function hashAlgo(algo, d) {
    var h = await crypto.subtle.digest(algo, d);
    return Array.from(new Uint8Array(h))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  // Step 1: Fast WebCrypto hashes + BLAKE3 (no freezing)
  hashes["SHA-1"] = await hashAlgo("SHA-1", data);
  hashes["SHA-256"] = await hashAlgo("SHA-256", data);
  hashes["SHA-384"] = await hashAlgo("SHA-384", data);
  hashes["SHA-512"] = await hashAlgo("SHA-512", data);
  try {
    hashes["BLAKE3"] = await blake3(data);
  } catch (e) {}
  try {
    hashes["MD2"] = md2(data);
  } catch (e) {}
  try {
    hashes["MD4"] = md4(data);
  } catch (e) {}

  var result = {
    file_info: { file_name: name, file_size_bytes: data.length },
    hashes: hashes,
    perceptual_hashes: {},
  };

  // Step 2: Perceptual hashes for images
  if (imgExts.includes(ext)) {
    try {
      var loaded = await loadImage(new Blob([data]));
      var imgData = loaded.imgData;
      var small = resizeImageData(imgData, 32);
      await maybeYield();
      result.perceptual_hashes = {
        ahash: ahash(small),
        dhash: dhash(small),
        phash: phash(small),
      };
      try {
        result.perceptual_hashes.whash = whash(small);
      } catch (e) {}
      result.file_info.width = loaded.w;
      result.file_info.height = loaded.h;
      result.file_info.format = ext.replace(".", "").toUpperCase();
    } catch (e) {
      result.file_info.image_error = e.message;
    }
  }

  // Step 3: Background worker + main thread fallback for remaining hashes (SHA-3, BLAKE2, SHA-224, MD5, RIPEMD-160, Whirlpool)
  if (typeof Worker !== "undefined" && typeof window !== "undefined") {
    startBackgroundWorker(result.hashes, buf, null, function (extraHashes) {
      var fp = getResult("fpResult");
      if (fp) Object.assign(fp.hashes, extraHashes);
    });
  }
  await computeRemainingHashes(result.hashes, buf).catch(function (e) {
    console.warn("Main-thread hash compute error:", e);
  });

  return result;
}

// ── Background worker: fetch hashing.js and create self-contained worker ──
function startBackgroundWorker(hashesObj, fileBuf, onProgress, onComplete) {
  return new Promise(function (resolve) {
    if (location.protocol === "file:") {
      resolve();
      return;
    }
    try {
      var scriptTag = document.querySelector('script[src*="hashing.js"]');
      var hashingUrl = scriptTag ? scriptTag.src : "";
      if (!hashingUrl) {
        hashingUrl =
          location.href
            .substring(0, location.href.lastIndexOf("/"))
            .replace("/Style", "") + "/Fingerprint/hashing.js";
      }
      fetch(hashingUrl)
        .then(function (resp) {
          if (!resp.ok) throw new Error("fetch failed");
          return resp.text();
        })
        .then(function (hashingCode) {
          var workerCode =
            hashingCode +
            "\n" +
            'self.onmessage=async function(e){var msg=e.data;if(msg.type!=="compute-remaining")return;var d=new Uint8Array(msg.buf);var h={};' +
            'try{h["SHA-3_224"]=await sha3_224(d);}catch(e){}self.postMessage({type:"p",key:"SHA-3_224"});' +
            'try{h["SHA-3_256"]=await sha3_256(d);}catch(e){}self.postMessage({type:"p",key:"SHA-3_256"});' +
            'try{h["SHA-3_384"]=await sha3_384(d);}catch(e){}self.postMessage({type:"p",key:"SHA-3_384"});' +
            'try{h["SHA-3_512"]=await sha3_512(d);}catch(e){}self.postMessage({type:"p",key:"SHA-3_512"});' +
            'try{h["BLAKE2b"]=await blake2b(d);}catch(e){}self.postMessage({type:"p",key:"BLAKE2b"});' +
            'try{h["BLAKE2s"]=await blake2s(d);}catch(e){}self.postMessage({type:"p",key:"BLAKE2s"});' +
            'try{h["SHA-224"]=await sha224(d);}catch(e){}self.postMessage({type:"p",key:"SHA-224"});' +
            'try{h["MD5"]=await md5(d);}catch(e){}self.postMessage({type:"p",key:"MD5"});' +
            'try{h["RIPEMD-160"]=await ripemd160(d);}catch(e){}self.postMessage({type:"p",key:"RIPEMD-160"});' +
            'try{h["Whirlpool"]=await whirlpool(d);}catch(e){}self.postMessage({type:"p",key:"Whirlpool"});' +
            'self.postMessage({type:"done",hashes:h});}';
          var blob = new Blob([workerCode], { type: "application/javascript" });
          var workerUrl = URL.createObjectURL(blob);
          var w = new Worker(workerUrl);
          w.postMessage({ type: "compute-remaining", buf: fileBuf }, [fileBuf]);
          w.onmessage = function (ev) {
            var m = ev.data;
            if (m.type === "p") {
              if (onProgress) onProgress(m.key + "…");
            } else if (m.type === "done") {
              if (onProgress) onProgress("");
              if (onComplete) onComplete(m.hashes);
              Object.assign(hashesObj, m.hashes);
              resolve();
              w.terminate();
              URL.revokeObjectURL(workerUrl);
            }
          };
          w.onerror = function () {
            resolve();
            w.terminate();
            URL.revokeObjectURL(workerUrl);
          };
        })
        .catch(function (e) {
          console.warn("Background worker init failed:", e);
          resolve();
        });
    } catch (e) {
      console.warn("Background worker unavailable:", e);
      resolve();
    }
  });
}

// ── Compute remaining hashes on main thread (fallback when Worker unavailable) ──
async function computeRemainingHashes(hashesObj, buf, onProgress, onComplete) {
  var data = new Uint8Array(buf);
  var extra = {};
  function setProg(msg) {
    if (onProgress) onProgress(msg);
  }

  var fns = [
    { key: "SHA-3_224", fn: sha3_224 },
    { key: "SHA-3_256", fn: sha3_256 },
    { key: "SHA-3_384", fn: sha3_384 },
    { key: "SHA-3_512", fn: sha3_512 },
    { key: "BLAKE2b", fn: blake2b },
    { key: "BLAKE2s", fn: blake2s },
    { key: "SHA-224", fn: sha224 },
    { key: "MD5", fn: md5 },
    { key: "RIPEMD-160", fn: ripemd160 },
    { key: "Whirlpool", fn: whirlpool },
  ];
  for (var i = 0; i < fns.length; i++) {
    setProg(fns[i].key + "…");
    try {
      extra[fns[i].key] = await fns[i].fn(data);
    } catch (e) {}
    await maybeYield();
  }
  setProg("");
  Object.assign(hashesObj, extra);
  if (typeof onComplete === "function") onComplete(extra);
  return extra;
}

// ── Fast fingerprint for simplified mode (fast hashes + background worker for the rest) ──
async function fastFingerprint(file, onProgress, onRemainingHashes) {
  var buf = await file.arrayBuffer();
  var data = new Uint8Array(buf);
  var name = file.name;
  var ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  var imgExts = [
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".gif",
    ".tiff",
    ".tif",
    ".webp",
  ];

  var hashes = {};
  async function hashAlgo(algo, d) {
    var h = await crypto.subtle.digest(algo, d);
    return Array.from(new Uint8Array(h))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }
  function setProg(msg) {
    if (onProgress) onProgress(msg);
  }

  // Phase 1: WebCrypto (truly async, fast, no freeze)
  setProg("SHA-1…");
  hashes["SHA-1"] = await hashAlgo("SHA-1", data);
  setProg("SHA-256…");
  hashes["SHA-256"] = await hashAlgo("SHA-256", data);
  setProg("SHA-384…");
  hashes["SHA-384"] = await hashAlgo("SHA-384", data);
  setProg("SHA-512…");
  hashes["SHA-512"] = await hashAlgo("SHA-512", data);
  setProg("BLAKE3…");
  try {
    hashes["BLAKE3"] = await blake3(data);
  } catch (e) {}

  var result = {
    file_info: { file_name: name, file_size_bytes: data.length },
    hashes: hashes,
    perceptual_hashes: {},
  };

  // Perceptual hashes for images
  if (imgExts.includes(ext)) {
    try {
      setProg("Loading image…");
      var loaded = await loadImage(new Blob([data]));
      var imgData = loaded.imgData;
      var small = resizeImageData(imgData, 32);
      await maybeYield();
      setProg("ahash…");
      result.perceptual_hashes.ahash = ahash(small);
      await maybeYield();
      setProg("dhash…");
      result.perceptual_hashes.dhash = dhash(small);
      await maybeYield();
      setProg("phash…");
      result.perceptual_hashes.phash = phash(small);
      await maybeYield();
      try {
        setProg("whash…");
        result.perceptual_hashes.whash = whash(small);
        await maybeYield();
      } catch (e) {}
      result.file_info.width = loaded.w;
      result.file_info.height = loaded.h;
      result.file_info.format = ext.replace(".", "").toUpperCase();
    } catch (e) {
      result.file_info.image_error = e.message;
    }
  }

  setProg("");

  // Phase 2: Start worker (fast path) AND main thread fallback (slow but guaranteed)
  window._fpWorkerPromise = Promise.resolve();
  if (typeof Worker !== "undefined" && typeof window !== "undefined") {
    window._fpWorkerPromise = startBackgroundWorker(
      result.hashes,
      buf,
      onProgress,
      onRemainingHashes,
    );
  }
  // Main thread fallback — ensures all hashes are present when returning
  await computeRemainingHashes(
    result.hashes,
    buf,
    onProgress,
    onRemainingHashes,
  ).catch(function (e) {
    console.warn("Main-thread hash compute error:", e);
  });

  return result;
}
if (typeof window !== "undefined") window.fastFingerprint = fastFingerprint;

// ── Trim fingerprint JSON payload to fit within maxBits ──
function trimFingerprintPayload(fpResult, maxBytes) {
  var orderedKeys = [
    "SHA-256",
    "SHA-512",
    "BLAKE3",
    "SHA-1",
    "SHA-384",
    "SHA-3_256",
    "BLAKE2b",
    "SHA-224",
    "SHA-3_224",
    "BLAKE2s",
    "SHA-3_384",
    "SHA-3_512",
    "RIPEMD-160",
    "Whirlpool",
    "MD5",
  ];
  var trimmed = { file_info: {}, hashes: {}, perceptual_hashes: {} };
  if (fpResult.file_info.width)
    trimmed.file_info.width = fpResult.file_info.width;
  if (fpResult.file_info.height)
    trimmed.file_info.height = fpResult.file_info.height;
  if (fpResult.file_info.format)
    trimmed.file_info.format = fpResult.file_info.format;
  for (var i = 0; i < orderedKeys.length; i++) {
    if (!fpResult.hashes[orderedKeys[i]]) continue;
    trimmed.hashes[orderedKeys[i]] = fpResult.hashes[orderedKeys[i]];
    var json = JSON.stringify(trimmed);
    if (new TextEncoder().encode(json).length > maxBytes) {
      delete trimmed.hashes[orderedKeys[i]];
      break;
    }
  }
  // Always include perceptual hashes if space
  if (fpResult.perceptual_hashes) {
    var withPerceptual = JSON.parse(JSON.stringify(trimmed));
    withPerceptual.perceptual_hashes = {};
    for (var pk in fpResult.perceptual_hashes) {
      withPerceptual.perceptual_hashes[pk] = fpResult.perceptual_hashes[pk];
      var pj = JSON.stringify(withPerceptual);
      if (new TextEncoder().encode(pj).length > maxBytes) {
        delete withPerceptual.perceptual_hashes[pk];
        break;
      }
    }
    if (Object.keys(withPerceptual.perceptual_hashes).length > 0) {
      trimmed.perceptual_hashes = withPerceptual.perceptual_hashes;
    }
  }
  return trimmed;
}
if (typeof window !== "undefined")
  window.trimFingerprintPayload = trimFingerprintPayload;

// ── BLAKE3 self-verify at load time ──
(async function () {
  try {
    var tvEmpty = await blake3(new Uint8Array(0));
    var tvAbc = await blake3(new Uint8Array([0x61, 0x62, 0x63]));
    if (
      tvEmpty ===
        "292d4e1d5ac6239c412dda791b1faa3d23a2b545e3e785029369a2a0bbd7461b" &&
      tvAbc ===
        "56887470a385e413002515c5db4a44f41258bc6604b436aef25840d65888d895"
    ) {
      console.log("BLAKE3 self-check passed");
    } else {
      console.warn("BLAKE3 implementation deviates from expected");
      console.log("Empty input hash:", tvEmpty, "(expected 292d4e1d...)");
      console.log("ABC input hash:", tvAbc, "(expected 56887470...)");
    }
  } catch (e) {
    console.warn("BLAKE3 self-check failed:", e.message);
  }
})();
