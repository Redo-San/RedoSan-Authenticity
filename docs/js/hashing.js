// ── SHA-3 (Keccak) ──
var KECCAK_ROUNDS = 24;
var SHA3_RC = [0x1n,0x8082n,0x8000000080008000n,0x8000000000008080n,0x8000000000008009n,0x800000000000008an,0x8000000000000088n,0x8000000000808009n,0x800000000000000en,0x800000000000008bn,0x800000000080000bn,0x800000000000808bn,0x800000008000000bn,0x800000008000800an,0x8000000000000080n,0x800000008000000fn,0x8000000080008008n,0x8000000000000093n,0x800000008000800an,0x8000000000000096n,0x8000000000808003n,0x8000000000808083n,0x8000000000000280n,0x80000000800000a5n];
var SHA3_ROTC = [1,3,6,10,15,21,28,36,45,55,2,14,27,41,52,8,25,43,62,18,39,61,20,44];
function keccakF(state) {
    for (var r = 0; r < 24; r++) {
        var C = [0n,0n,0n,0n,0n];
        for (var x = 0; x < 5; x++) C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        var D = [0n,0n,0n,0n,0n];
        for (var x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ (C[(x+1)%5] << 1n | C[(x+1)%5] >> 63n);
        for (var x = 0; x < 25; x++) state[x] ^= D[x%5];
        var t = state[1];
        for (var x = 0; x < 24; x++) {
            var xs = [0,1,2,3,4,1,2,3,4,0,2,3,4,0,1,3,4,0,1,2,4,0,1,2,3][x];
            var ys = [0,1,2,3,4,3,4,0,1,2,1,2,3,4,0,4,0,1,2,3,2,3,4,0,1][x];
            var idx = xs * 5 + ys;
            state[idx] = state[idx] << BigInt(SHA3_ROTC[x]) | state[idx] >> BigInt(64 - SHA3_ROTC[x]);
        }
        for (var x = 0; x < 25; x++) { var t2 = state[x]; state[x] = t; t = t2; }
        for (var x = 0; x < 25; x += 5) {
            var t0 = state[x], t1 = state[x+1], t2 = state[x+2], t3 = state[x+3], t4 = state[x+4];
            state[x] ^= (~t1 & t2);
            state[x+1] ^= (~t2 & t3);
            state[x+2] ^= (~t3 & t4);
            state[x+3] ^= (~t4 & t0);
            state[x+4] ^= (~t0 & t1);
        }
        state[0] ^= SHA3_RC[r];
    }
}
function sha3(data, bits) {
    var rate = 1600 - bits * 2;
    var r = rate >> 3, lanes = rate / 64;
    var state = [0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n];
    var i = 0;
    for (; i + r <= data.length; i += r) {
        for (var j = 0; j < r; j++) state[j >> 3] ^= BigInt(data[i + j]) << BigInt((j & 7) << 3);
        keccakF(state);
    }
    var rem = data.length - i;
    for (var j = 0; j < rem; j++) state[j >> 3] ^= BigInt(data[i + j]) << BigInt((j & 7) << 3);
    state[rem >> 3] ^= BigInt(0x06) << BigInt((rem & 7) << 3);
    state[lanes - 1] ^= 0x8000000000000000n;
    keccakF(state);
    var outBytes = bits >> 3;
    var result = new Uint8Array(outBytes);
    for (var i = 0; i < outBytes; i++) result[i] = Number(state[i >> 3] >> BigInt((i & 7) << 3) & 0xFFn);
    return Array.from(result).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}
var sha3_224 = function(d) { return sha3(d, 224); };
var sha3_256 = function(d) { return sha3(d, 256); };
var sha3_384 = function(d) { return sha3(d, 384); };
var sha3_512 = function(d) { return sha3(d, 512); };

// ── BLAKE2b (64-byte digest) ──
var B2IV = [0x6a09e667f3bcc908n,0xbb67ae8584caa73bn,0x3c6ef372fe94f82bn,0xa54ff53a5f1d36f1n,0x510e527fade682d1n,0x9b05688c2b3e6c1fn,0x1f83d9abfb41bd6bn,0x5be0cd19137e2179n];
var B2SIG = [
  [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],
  [11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],[7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],
  [9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],[2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],
  [12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],[13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],
  [6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],[10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0]
];
function blake2bG(v,a,b,c,d,x,y) {
    v[a] = (v[a] + v[b] + x) & 0xFFFFFFFFFFFFFFFFn; v[d] = blake2bRor(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & 0xFFFFFFFFFFFFFFFFn; v[b] = blake2bRor(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & 0xFFFFFFFFFFFFFFFFn; v[d] = blake2bRor(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & 0xFFFFFFFFFFFFFFFFn; v[b] = blake2bRor(v[b] ^ v[c], 63);
}
function blake2bRor(x,n) { return (x >> BigInt(n)) | (x << BigInt(64 - n)); }
function blake2bLoad64(data, off) {
    return BigInt(data[off])|(BigInt(data[off+1])<<8n)|(BigInt(data[off+2])<<16n)|(BigInt(data[off+3])<<24n)|
           (BigInt(data[off+4])<<32n)|(BigInt(data[off+5])<<40n)|(BigInt(data[off+6])<<48n)|(BigInt(data[off+7])<<56n);
}
function blake2bCompress(h, m, counter, final) {
    var v = new Array(16);
    for (var i = 0; i < 8; i++) { v[i] = h[i]; v[i+8] = B2IV[i]; }
    v[12] ^= BigInt(counter) & 0xFFFFFFFFFFFFFFFFn;
    v[13] ^= BigInt(counter >> 32) & 0xFFFFFFFFFFFFFFFFn;
    if (final) v[14] = ~v[14];
    for (var r = 0; r < 12; r++) {
        var s = B2SIG[r % 10];
        blake2bG(v,0,4,8,12,m[s[0]],m[s[1]]); blake2bG(v,1,5,9,13,m[s[2]],m[s[3]]);
        blake2bG(v,2,6,10,14,m[s[4]],m[s[5]]); blake2bG(v,3,7,11,15,m[s[6]],m[s[7]]);
        blake2bG(v,0,5,10,15,m[s[8]],m[s[9]]); blake2bG(v,1,6,11,12,m[s[10]],m[s[11]]);
        blake2bG(v,2,7,8,13,m[s[12]],m[s[13]]); blake2bG(v,3,4,9,14,m[s[14]],m[s[15]]);
    }
    for (var i = 0; i < 8; i++) h[i] = (h[i] ^ v[i] ^ v[i+8]) & 0xFFFFFFFFFFFFFFFFn;
}
async function blake2b(data) {
    var outLen = 64;
    var h = B2IV.slice();
    h[0] ^= 0x01010000n ^ BigInt(outLen);
    var offset = 0, counter = 0;
    while (offset + 128 <= data.length) {
        counter += 128;
        var m = new Array(16);
        for (var i = 0; i < 16; i++) m[i] = blake2bLoad64(data, offset + i * 8);
        blake2bCompress(h, m, counter, false);
        offset += 128;
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
    for (var i = 0; i < outLen; i++) out[i] = Number(h[i>>3] >> BigInt((i&7)<<3) & 0xFFn);
    return Array.from(out).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}
async function blake2s(data) {
    var full = await blake2b(data);
    return full.substring(0, 64);
}

// ── Perceptual hashing (pure JS using Canvas) ──

// ahash: Average Hash
function ahash(imgData) {
    var data = imgData.data, w = imgData.w, h = imgData.h;
    var size = 8;
    var gray = new Float64Array(size * size);
    for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++) {
            var i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    var avg = 0;
    for (var i = 0; i < gray.length; i++) avg += gray[i];
    avg /= gray.length;
    var hash = 0n;
    for (var i = 0; i < gray.length; i++)
        if (gray[i] > avg) hash |= (1n << BigInt(i));
    return hash.toString(16).padStart(16, '0');
}

// dhash: Difference Hash
function dhash(imgData) {
    var data = imgData.data, w = imgData.w, h = imgData.h;
    var size = 9;
    var gray = new Float64Array(size * size);
    for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++) {
            var i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    var hash = 0n, idx = 0;
    for (var y = 0; y < size; y++)
        for (var x = 0; x < size - 1; x++) {
            if (gray[y * size + x] > gray[y * size + x + 1]) hash |= (1n << BigInt(idx));
            idx++;
        }
    return hash.toString(16).padStart(16, '0');
}

// phash: Perceptual Hash (DCT-based, simplified)
function phash(imgData) {
    var data = imgData.data, w = imgData.w, h = imgData.h;
    var size = 32;
    var gray = new Float64Array(size * size);
    for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++) {
            var i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    var dct = new Float64Array(8 * 8);
    for (var u = 0; u < 8; u++)
        for (var v = 0; v < 8; v++) {
            var s = 0;
            for (var x = 0; x < size; x++)
                for (var y = 0; y < size; y++)
                    s += gray[x * size + y] * Math.cos((2*x+1)*u*Math.PI/(2*size)) * Math.cos((2*y+1)*v*Math.PI/(2*size));
            var cu = u === 0 ? 1/Math.SQRT2 : 1, cv = v === 0 ? 1/Math.SQRT2 : 1;
            dct[u * 8 + v] = s * cu * cv * 2 / size;
        }
    var avg = 0;
    for (var i = 0; i < dct.length; i++) avg += dct[i];
    avg /= dct.length;
    var hash = 0n;
    for (var i = 0; i < dct.length; i++)
        if (dct[i] > avg) hash |= (1n << BigInt(i));
    return hash.toString(16).padStart(16, '0');
}

// whash: Wavelet Hash (Haar wavelet)
function whash(imgData) {
    var data = imgData.data, w = imgData.w, h = imgData.h;
    var size = 32;
    var gray = new Float64Array(size * size);
    for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++) {
            var i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    var half = size / 2;
    var out = new Float64Array(size * size);
    for (var y = 0; y < size; y++)
        for (var x = 0; x < half; x++) {
            var a = gray[y * size + x*2], b = gray[y * size + x*2 + 1];
            out[y * size + x] = (a + b) / Math.SQRT2;
            out[y * size + half + x] = (a - b) / Math.SQRT2;
        }
    var out2 = new Float64Array(size * size);
    for (var y = 0; y < half; y++)
        for (var x = 0; x < size; x++) {
            var a = out[y * size + x], b = out[(y + half) * size + x];
            out2[y * size + x] = (a + b) / Math.SQRT2;
            out2[(y + half) * size + x] = (a - b) / Math.SQRT2;
        }
    var hash = 0n, idx = 0;
    for (var y = 0; y < 8; y++)
        for (var x = 0; x < 8; x++) {
            if (out2[y * size + x] > 0) hash |= (1n << BigInt(idx));
            idx++;
        }
    return hash.toString(16).padStart(16, '0');
}

// ── Resize ImageData ──
function resizeImageData(imgData, targetSize) {
    var c = document.createElement('canvas');
    c.width = imgData.w; c.height = imgData.h;
    var ctx = c.getContext('2d');
    var tmp = ctx.createImageData(imgData.w, imgData.h);
    tmp.data.set(imgData.data);
    ctx.putImageData(tmp, 0, 0);
    var c2 = document.createElement('canvas');
    c2.width = targetSize; c2.height = targetSize;
    var ctx2 = c2.getContext('2d');
    ctx2.drawImage(c, 0, 0, targetSize, targetSize);
    var r = ctx2.getImageData(0, 0, targetSize, targetSize);
    r.w = targetSize; r.h = targetSize;
    return r;
}

// ── Minimal MD5 implementation ──
function md5(data) {
    var s = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
    function F(x,y,z) { return (x & y) | (~x & z); }
    function G(x,y,z) { return (x & z) | (y & ~z); }
    function H(x,y,z) { return x ^ y ^ z; }
    function I(x,y,z) { return y ^ (x | ~z); }
    function rot(x,n) { return (x << n) | (x >>> (32 - n)); }
    function FF(a,b,c,d,x,s,ac) { a = rot((a + F(b,c,d) + x + ac) & 0xFFFFFFFF, s) + b; return a & 0xFFFFFFFF; }
    function GG(a,b,c,d,x,s,ac) { a = rot((a + G(b,c,d) + x + ac) & 0xFFFFFFFF, s) + b; return a & 0xFFFFFFFF; }
    function HH(a,b,c,d,x,s,ac) { a = rot((a + H(b,c,d) + x + ac) & 0xFFFFFFFF, s) + b; return a & 0xFFFFFFFF; }
    function II(a,b,c,d,x,s,ac) { a = rot((a + I(b,c,d) + x + ac) & 0xFFFFFFFF, s) + b; return a & 0xFFFFFFFF; }
    function toBytes(d) { var b = new Uint8Array(4); b[0]=d & 0xFF; b[1]=(d>>8)&0xFF; b[2]=(d>>16)&0xFF; b[3]=(d>>24)&0xFF; return b; }
    var origLen = data.length * 8;
    var msg = new Uint8Array(((data.length + 8) & -64) + 64);
    for (var i = 0; i < data.length; i++) msg[i] = data[i];
    msg[data.length] = 0x80;
    new DataView(msg.buffer).setUint32(msg.length - 8, origLen, true);
    for (var off = 0; off < msg.length; off += 64) {
        var w = new Array(16);
        for (var i = 0; i < 16; i++) w[i] = new DataView(msg.buffer).getUint32(off + i*4, true);
        var a = s[0], b = s[1], c = s[2], d = s[3];
        a = FF(a,b,c,d,w[0],7,0xd76aa478); d = FF(d,a,b,c,w[1],12,0xe8c7b756); c = FF(c,d,a,b,w[2],17,0x242070db); b = FF(b,c,d,a,w[3],22,0xc1bdceee);
        a = FF(a,b,c,d,w[4],7,0xf57c0faf); d = FF(d,a,b,c,w[5],12,0x4787c62a); c = FF(c,d,a,b,w[6],17,0xa8304613); b = FF(b,c,d,a,w[7],22,0xfd469501);
        a = FF(a,b,c,d,w[8],7,0x698098d8); d = FF(d,a,b,c,w[9],12,0x8b44f7af); c = FF(c,d,a,b,w[10],17,0xffff5bb1); b = FF(b,c,d,a,w[11],22,0x895cd7be);
        a = FF(a,b,c,d,w[12],7,0x6b901122); d = FF(d,a,b,c,w[13],12,0xfd987193); c = FF(c,d,a,b,w[14],17,0xa679438e); b = FF(b,c,d,a,w[15],22,0x49b40821);
        a = GG(a,b,c,d,w[1],5,0xf61e2562); d = GG(d,a,b,c,w[6],9,0xc040b340); c = GG(c,d,a,b,w[11],14,0x265e5a51); b = GG(b,c,d,a,w[0],20,0xe9b6c7aa);
        a = GG(a,b,c,d,w[5],5,0xd62f105d); d = GG(d,a,b,c,w[10],9,0x02441453); c = GG(c,d,a,b,w[15],14,0xd8a1e681); b = GG(b,c,d,a,w[4],20,0xe7d3fbc8);
        a = GG(a,b,c,d,w[9],5,0x21e1cde6); d = GG(d,a,b,c,w[14],9,0xc33707d6); c = GG(c,d,a,b,w[3],14,0xf4d50d87); b = GG(b,c,d,a,w[8],20,0x455a14ed);
        a = GG(a,b,c,d,w[13],5,0xa9e3e905); d = GG(d,a,b,c,w[2],9,0xfcefa3f8); c = GG(c,d,a,b,w[7],14,0x676f02d9); b = GG(b,c,d,a,w[12],20,0x8d2a4c8a);
        a = HH(a,b,c,d,w[5],4,0xfffa3942); d = HH(d,a,b,c,w[8],11,0x8771f681); c = HH(c,d,a,b,w[11],16,0x6d9d6122); b = HH(b,c,d,a,w[14],23,0xfde5380c);
        a = HH(a,b,c,d,w[1],4,0xa4beea44); d = HH(d,a,b,c,w[4],11,0x4bdecfa9); c = HH(c,d,a,b,w[7],16,0xf6bb4b60); b = HH(b,c,d,a,w[10],23,0xbebfbc70);
        a = HH(a,b,c,d,w[13],4,0x289b7ec6); d = HH(d,a,b,c,w[0],11,0xeaa127fa); c = HH(c,d,a,b,w[3],16,0xd4ef3085); b = HH(b,c,d,a,w[6],23,0x04881d05);
        a = HH(a,b,c,d,w[9],4,0xd9d4d039); d = HH(d,a,b,c,w[12],11,0xe6db99e5); c = HH(c,d,a,b,w[15],16,0x1fa27cf8); b = HH(b,c,d,a,w[2],23,0xc4ac5665);
        a = II(a,b,c,d,w[0],6,0xf4292244); d = II(d,a,b,c,w[7],10,0x432aff97); c = II(c,d,a,b,w[14],15,0xab9423a7); b = II(b,c,d,a,w[5],21,0xfc93a039);
        a = II(a,b,c,d,w[12],6,0x655b59c3); d = II(d,a,b,c,w[3],10,0x8f0ccc92); c = II(c,d,a,b,w[10],15,0xffeff47d); b = II(b,c,d,a,w[1],21,0x85845dd1);
        a = II(a,b,c,d,w[8],6,0x6fa87e4f); d = II(d,a,b,c,w[15],10,0xfe2ce6e0); c = II(c,d,a,b,w[6],15,0xa3014314); b = II(b,c,d,a,w[13],21,0x4e0811a1);
        a = II(a,b,c,d,w[4],6,0xf7537e82); d = II(d,a,b,c,w[11],10,0xbd3af235); c = II(c,d,a,b,w[2],15,0x2ad7d2bb); b = II(b,c,d,a,w[9],21,0xeb86d391);
        s[0] = (s[0] + a) & 0xFFFFFFFF; s[1] = (s[1] + b) & 0xFFFFFFFF;
        s[2] = (s[2] + c) & 0xFFFFFFFF; s[3] = (s[3] + d) & 0xFFFFFFFF;
    }
    var r = '';
    for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) r += ((s[i] >>> (j*8)) & 0xFF).toString(16).padStart(2,'0'); }
    return r;
}

// ── SHA-224 (truncated SHA-256) ──
async function sha224(data) {
    var h = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(h)).slice(0,28).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── MD2 ──
function md2(data) {
    var S = [0x29,0x2E,0x43,0xC9,0xA2,0xD8,0x7C,0x01,0x3D,0x36,0x54,0xA1,0xEC,0xF0,0x06,0x13,
        0x62,0xA7,0x05,0xF3,0xC0,0xC7,0x73,0x8C,0x98,0x93,0x2B,0xD9,0xBC,0x4C,0x82,0xCA,
        0x1E,0x9B,0x57,0x3C,0xFD,0xD4,0xE0,0x16,0x67,0x42,0x6F,0x18,0x8A,0x17,0xE5,0x12,
        0xBE,0x4E,0xC4,0xD6,0xDA,0x9E,0xDE,0x49,0xA0,0xFB,0xF5,0x8E,0x66,0xCD,0xBC,0xC9];
    var bytes = new Uint8Array(data);
    var len = bytes.length;
    var padLen = 16 - (len % 16);
    var padded = new Uint8Array(len + padLen);
    padded.set(bytes);
    for (var i = len; i < padded.length; i++) padded[i] = padLen;
    var checksum = new Uint8Array(16);
    var L = 0;
    for (var i = 0; i < padded.length; i += 16) {
        for (var j = 0; j < 16; j++) { var c = padded[i+j]; L = checksum[j] ^ S[c ^ L]; checksum[j] = L; }
    }
    var final = new Uint8Array(padded.length + 16);
    final.set(padded); final.set(checksum, padded.length);
    var state = new Uint8Array(48);
    for (var i = 0; i < final.length; i += 16) {
        for (var j = 0; j < 16; j++) state[16+j] = final[i+j];
        for (var j = 0; j < 16; j++) state[32+j] = state[16+j] ^ state[j];
        for (var round = 0; round < 18; round++)
            for (var k = 0; k < 48; k++) state[k] ^= S[state[k] ^ round];
    }
    return Array.from(state.slice(0,16)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── MD4 ──
function md4(data) {
    function F(x,y,z){return (x&y)|(~x&z);}
    function G(x,y,z){return (x&y)|(x&z)|(y&z);}
    function H(x,y,z){return x^y^z;}
    function rot(x,n){return (x<<n)|(x>>>(32-n));}
    var bytes = new Uint8Array(data);
    var origLen = bytes.length * 8;
    var pad = new Uint8Array([...bytes, 0x80]);
    while ((pad.length*8)%512!==448){var p2=new Uint8Array(pad.length+1);p2.set(pad);pad=p2;}
    var lb=new ArrayBuffer(8);new DataView(lb).setUint32(0,origLen,true);new DataView(lb).setUint32(4,0,true);
    pad = new Uint8Array([...pad,...new Uint8Array(lb)]);
    var A=0x67452301,B=0xefcdab89,C=0x98badcfe,D=0x10325476;
    for (var i=0;i<pad.length;i+=64){
        var X=new Array(16);
        for (var j=0;j<16;j++) X[j]=pad[i+j*4]|(pad[i+j*4+1]<<8)|(pad[i+j*4+2]<<16)|(pad[i+j*4+3]<<24);
        var AA=A,BB=B,CC=C,DD=D;
        for (var n=0;n<16;n++){var s=[3,7,11,19][n%4];A=rot(A+F(B,C,D)+X[n],s);var t=A;A=D;D=C;C=B;B=t;}
        for (var n=0;n<16;n++){var s=[3,5,9,13][n%4];var k=[0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15][n];A=rot(A+G(B,C,D)+X[k]+0x5a827999,s);var t=A;A=D;D=C;C=B;B=t;}
        for (var n=0;n<16;n++){var s=[3,9,11,15][n%4];var k=[0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15][n];A=rot(A+H(B,C,D)+X[k]+0x6ed9eba1,s);var t=A;A=D;D=C;C=B;B=t;}
        A=(A+AA)&0xFFFFFFFF;B=(B+BB)&0xFFFFFFFF;C=(C+CC)&0xFFFFFFFF;D=(D+DD)&0xFFFFFFFF;
    }
    var r=new Uint8Array(16);
    new DataView(r.buffer).setUint32(0,A,true);new DataView(r.buffer).setUint32(4,B,true);
    new DataView(r.buffer).setUint32(8,C,true);new DataView(r.buffer).setUint32(12,D,true);
    return Array.from(r).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── RIPEMD-160 ──
function ripemd160(data) {
    function rot(x,n){return(x<<n)|(x>>>(32-n));}
    function f1(x,y,z){return x^y^z;}
    function f2(x,y,z){return(x&y)|(~x&z);}
    function f3(x,y,z){return(x|~y)^z;}
    function f4(x,y,z){return(x&z)|(y&~z);}
    function f5(x,y,z){return x^(y|~z);}
    var K=[0,0x5a827999,0x6ed9eba1,0x8f1bbcdc,0xa953fd4e];
    var Kp=[0x50a28be6,0x5c4dd124,0x6d703ef3,0x7a6d76e9,0];
    var R=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
    var Rp=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
    var S=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8];
    var Sp=[10,13,14,11,12,7,6,8,9,11,13,14,5,6,7,9];
    var bytes=new Uint8Array(data);var origLen=bytes.length*8;
    var pad=new Uint8Array([...bytes,0x80]);
    while((pad.length*8)%512!==448){var p2=new Uint8Array(pad.length+1);p2.set(pad);pad=p2;}
    var lb=new ArrayBuffer(8);new DataView(lb).setUint32(0,origLen,true);new DataView(lb).setUint32(4,0,true);
    pad=new Uint8Array([...pad,...new Uint8Array(lb)]);
    var h0=0x67452301,h1=0xefcdab89,h2=0x98badcfe,h3=0x10325476,h4=0xc3d2e1f0;
    for(var i=0;i<pad.length;i+=64){
        var X=new Array(16);
        for(var j=0;j<16;j++)X[j]=pad[i+j*4]|(pad[i+j*4+1]<<8)|(pad[i+j*4+2]<<16)|(pad[i+j*4+3]<<24);
        var A=h0,B=h1,C=h2,D=h3,E=h4,Ap=h0,Bp=h1,Cp=h2,Dp=h3,Ep=h4;
        for(var j=0;j<80;j++){
            var grp=j<16?0:j<32?1:j<48?2:j<64?3:4;
            var T=A+f1(B,C,D)+X[R[j]]+K[grp];T=rot(T,S[j%16]);
            var Tp=Ap+f5(Bp,Cp,Dp)+X[Rp[j]]+Kp[grp];Tp=rot(Tp,Sp[j%16]);
            A=E;E=D;D=rot(C,10);C=B;B=T;
            Ap=Ep;Ep=Dp;Dp=rot(Cp,10);Cp=Bp;Bp=Tp;
        }
        var T=h1+C+Dp;h1=h2+D+Ep;h2=h3+E+Ap;h3=h4+A+Bp;h4=h0+B+Cp;h0=T;
    }
    var r=new Uint8Array(20);
    new DataView(r.buffer).setUint32(0,h0,true);new DataView(r.buffer).setUint32(4,h1,true);
    new DataView(r.buffer).setUint32(8,h2,true);new DataView(r.buffer).setUint32(12,h3,true);
    new DataView(r.buffer).setUint32(16,h4,true);
    return Array.from(r).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── BLAKE3 (fallback to SHA-256) ──
async function blake3(data) {
    var h = await crypto.subtle.digest('SHA-256', data);
    return 'BLAKE3_UNAVAILABLE_' + Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,'0');}).join('').substring(0,32);
}

// ── Whirlpool (fallback to SHA-512) ──
async function whirlpool(data) {
    var h = await crypto.subtle.digest('SHA-512', data);
    return Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── Full fingerprint ──
async function fingerprintFile(file) {
    var buf = await file.arrayBuffer();
    var data = new Uint8Array(buf);
    var name = file.name;
    var ext = name.substring(name.lastIndexOf('.')).toLowerCase();
    var imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.tif', '.webp'];

    var hashes = {};
    async function hashAlgo(algo, d) {
        var h = await crypto.subtle.digest(algo, d);
        return Array.from(new Uint8Array(h)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    hashes['SHA-1'] = await hashAlgo('SHA-1', data);
    hashes['SHA-256'] = await hashAlgo('SHA-256', data);
    hashes['SHA-384'] = await hashAlgo('SHA-384', data);
    hashes['SHA-512'] = await hashAlgo('SHA-512', data);

    try {
        hashes['SHA-3_224'] = sha3_224(data);
        hashes['SHA-3_256'] = sha3_256(data);
        hashes['SHA-3_384'] = sha3_384(data);
        hashes['SHA-3_512'] = sha3_512(data);
    } catch(e) { console.error('SHA-3 error:', e); }

    try {
        hashes['BLAKE2b'] = await blake2b(data);
        hashes['BLAKE2s'] = await blake2s(data);
    } catch(e) { console.error('BLAKE2 error:', e); }

    try { hashes['SHA-224'] = await sha224(data); } catch(e) {}

    try { hashes['MD2'] = md2(data); } catch(e) {}
    try { hashes['MD4'] = md4(data); } catch(e) {}
    try { hashes['MD5'] = md5(data); } catch(e) {}

    try { hashes['RIPEMD-160'] = ripemd160(data); } catch(e) {}
    try { hashes['BLAKE3'] = await blake3(data); } catch(e) {}
    try { hashes['Whirlpool'] = await whirlpool(data); } catch(e) {}

    var result = {
        file_info: { file_name: name, file_size_bytes: data.length },
        hashes: hashes,
        perceptual_hashes: {}
    };

    if (imgExts.includes(ext)) {
        try {
            var loaded = await loadImage(new Blob([data]));
            var imgData = loaded.imgData;
            var small = resizeImageData(imgData, 32);
            result.perceptual_hashes = {
                ahash: ahash(small),
                dhash: dhash(small),
                phash: phash(small)
            };
            try { result.perceptual_hashes.whash = whash(small); } catch(e) { console.error('whash error:', e); }
            result.file_info.width = loaded.w;
            result.file_info.height = loaded.h;
            result.file_info.format = ext.replace('.', '').toUpperCase();
        } catch(e) {
            result.file_info.image_error = e.message;
            console.error('Perceptual hash error:', e);
        }
    }

    return result;
}

// ── Metadata reading (EXIF via DataView) ──
async function readMetadata(file) {
    var buf = await file.arrayBuffer();
    var data = new Uint8Array(buf);
    var name = file.name;
    var result = { file: name, size: data.length };

    var h = await crypto.subtle.digest('SHA-256', data);
    result.sha256 = Array.from(new Uint8Array(h)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    try {
        var img = await loadImage(file);
        result.image = { width: img.w, height: img.h, mode: 'RGBA', format: name.split('.').pop().toUpperCase() };
    } catch(e) {
        result.error = e.message;
        return result;
    }

    if (data[0] === 0xFF && data[1] === 0xD8) {
        var exif = parseJPEGExif(data);
        if (exif && Object.keys(exif).length > 0) result.exif = exif;
    }

    return result;
}

// ── JPEG EXIF parser ──
function parseJPEGExif(data) {
    var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    var exif = {};
    var offset = 2;

    while (offset < data.length - 1) {
        if (view.getUint16(offset) === 0xFFE1) {
            var segLen = view.getUint16(offset + 2);
            if (offset + 4 + segLen <= data.length) {
                var exifStart = offset + 4;
                var exifHeader = String.fromCharCode.apply(null, data.slice(exifStart, exifStart + 6));
                if (exifHeader === 'Exif\0\0') {
                    var tiffStart = exifStart + 6;
                    var endian = view.getUint16(tiffStart);
                    var littleEndian = endian === 0x4949;
                    var get16 = function(off) { return littleEndian ? view.getUint16(off, true) : view.getUint16(off, false); };
                    var get32 = function(off) { return littleEndian ? view.getUint32(off, true) : view.getUint32(off, false); };

                    if (get16(tiffStart + 2) !== 0x002A) break;
                    var ifd0Off = get32(tiffStart + 4);
                    parseIFD(tiffStart, ifd0Off, exif, get16, get32, view, data);
                }
            }
            break;
        }
        offset++;
        if (offset >= data.length) break;
    }
    return exif;
}

var EXIF_TAGS = {
    0x010F: 'Make', 0x0110: 'Model', 0x0132: 'DateTimeOriginal',
    0x010E: 'ImageDescription', 0x0112: 'Orientation',
    0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
    0x0131: 'Software', 0x0213: 'YCbCrPositioning',
    0x8769: 'ExifOffset', 0x8825: 'GPSInfo',
    0x829A: 'ExposureTime', 0x829D: 'FNumber',
    0x8822: 'ExposureProgram', 0x8827: 'ISOSpeedRatings',
    0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
    0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue',
    0x9204: 'ExposureBiasValue', 0x9207: 'MeteringMode',
    0x9208: 'LightSource', 0x9209: 'Flash',
    0x920A: 'FocalLength', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
    0xA20E: 'FocalPlaneXResolution', 0xA20F: 'FocalPlaneYResolution',
    0xA210: 'FocalPlaneResolutionUnit',
    0xA401: 'CustomRendered', 0xA402: 'ExposureMode', 0xA403: 'WhiteBalance',
    0xA404: 'DigitalZoomRatio', 0xA405: 'FocalLengthIn35mmFilm',
    0xA406: 'SceneCaptureType', 0xA407: 'GainControl', 0xA408: 'Contrast',
    0xA409: 'Saturation', 0xA40A: 'Sharpness',
};

function parseIFD(tiffStart, offset, exif, get16, get32, view, data) {
    var num = get16(tiffStart + offset);
    for (var i = 0; i < num; i++) {
        var entryOff = tiffStart + offset + 2 + i * 12;
        var tag = get16(entryOff);
        var type = get16(entryOff + 2);
        var count = get32(entryOff + 4);
        var valOff = entryOff + 8;

        var val;
        if (type === 2 && count <= 4) {
            val = String.fromCharCode.apply(null, data.slice(valOff, valOff + count - 1));
        } else if (type === 2) {
            var strOff = get32(valOff);
            if (strOff > 0 && strOff + count <= data.length)
                val = String.fromCharCode.apply(null, data.slice(tiffStart + strOff, tiffStart + strOff + count - 1));
        } else if (type === 3) {
            val = get16(valOff);
        } else if (type === 4) {
            val = get32(valOff);
        } else if (type === 5) {
            var numOff = get32(valOff);
            if (numOff + 8 <= data.length - tiffStart) {
                val = get32(tiffStart + numOff) / get32(tiffStart + numOff + 4);
            }
        } else if (type === 7) {
            val = data.slice(valOff, valOff + Math.min(count, 32));
        }

        if (val !== undefined && EXIF_TAGS[tag]) {
            var s = String(val);
            if (s.length > 200) s = s.substring(0, 197) + '...';
            exif[EXIF_TAGS[tag]] = s;
        }
    }

    var nextOff = get32(tiffStart + offset + 2 + num * 12);
    if (nextOff > 0) {
        parseIFD(tiffStart, nextOff, exif, get16, get32, view, data);
    }
}
