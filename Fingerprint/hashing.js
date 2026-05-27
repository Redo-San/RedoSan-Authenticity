(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Yield helper: no-op in Web Workers, setTimeout on main thread ──
function maybeYield() {
  // No yield needed in Web Worker (no DOM to paint)
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise(function(r) { setTimeout(r, 0); });
}

// ── All hashing algorithms (pure JS, no UI) ──

// ── SHA-3 (fast 32-bit pair arithmetic, no BigInt) ──
var SHA3_ROTC = [1,3,6,10,15,21,28,36,45,55,2,14,27,41,52,8,25,43,62,18,39,61,20,44];
var SHA3_RC = [
    0x00000001,0x00000000,0x00008082,0x00000000,0x80008000,0x80000000,0x00008080,0x80000000,
    0x00008009,0x80000000,0x0000008A,0x80000000,0x00000088,0x80000000,0x00808009,0x80000000,
    0x0000000E,0x80000000,0x0000008B,0x80000000,0x0080000B,0x80000000,0x0000808B,0x80000000,
    0x8000000B,0x80000000,0x8000800A,0x80000000,0x00000080,0x80000000,0x8000000F,0x80000000,
    0x80008008,0x80000000,0x00000093,0x80000000,0x8000800A,0x80000000,0x00000096,0x80000000,
    0x00808003,0x80000000,0x00808083,0x80000000,0x00000280,0x80000000,0x800000A5,0x80000000
];
function keccakF(st) {
    var C0 = [0,0,0,0,0], C1 = [0,0,0,0,0], D0, D1, x, y, i, t, xs, ys, idx, n, v0, v1;
    for (var r = 0; r < 24; r++) {
        for (x = 0; x < 5; x++) {
            i = x*2; C0[x] = st[i]^st[i+10]^st[i+20]^st[i+30]^st[i+40]; C1[x] = st[i+1]^st[i+11]^st[i+21]^st[i+31]^st[i+41];
        }
        for (x = 0; x < 5; x++) {
            var xp1 = (x+1)%5, xm1 = (x+4)%5;
            D0 = C0[xm1] ^ ((C0[xp1]<<1)|(C1[xp1]>>>31)); D1 = C1[xm1] ^ ((C1[xp1]<<1)|(C0[xp1]>>>31));
            for (y = 0; y < 5; y++) { idx = y*10 + x*2; st[idx] ^= D0; st[idx+1] ^= D1; }
        }
        t = st[2]; var th = st[3]; xs = [0,1,2,3,4,1,2,3,4,0,2,3,4,0,1,3,4,0,1,2,4,0,1,2,3]; ys = [0,1,2,3,4,3,4,0,1,2,1,2,3,4,0,4,0,1,2,3,2,3,4,0,1];
        for (x = 0; x < 24; x++) {
            idx = (xs[x]*5+ys[x])*2; v0 = st[idx]; v1 = st[idx+1]; n = SHA3_ROTC[x];
            st[idx] = n<32 ? ((v0<<n)|(v1>>>(32-n)))>>>0 : ((v1<<(n-32))|(v0>>>(64-n)))>>>0;
            st[idx+1] = n<32 ? ((v1<<n)|(v0>>>(32-n)))>>>0 : ((v0<<(n-32))|(v1>>>(64-n)))>>>0;
        }
        for (x = 0; x < 25; x++) { idx = x*2; var t2l = st[idx], t2h = st[idx+1]; st[idx] = t; st[idx+1] = th; t = t2l; th = t2h; }
        for (y = 0; y < 5; y++) for (x = 0; x < 5; x++) {
            i = y*10+x*2; var ip1 = y*10+((x+1)%5)*2, ip2 = y*10+((x+2)%5)*2;
            st[i] ^= (~st[ip1] & st[ip2]); st[i+1] ^= (~st[ip1+1] & st[ip2+1]);
        }
        st[0] ^= SHA3_RC[r*2]; st[1] ^= SHA3_RC[r*2+1];
    }
}
async function sha3(data, bits) {
    var rate = 1600 - bits*2, r = rate>>3, lanes = rate/64|0, st = new Uint32Array(50);
    var i = 0, _sc = 0;
    for (; i+r <= data.length; i += r) {
        for (var j = 0; j < r; j++) { var half = j&4?1:0; st[(j>>3)*2+half] ^= (data[i+j])<<((j&3)<<3); }
        keccakF(st);
        if (++_sc % 200 === 0) await maybeYield();
    }
    var rem = data.length - i;
    for (var j = 0; j < rem; j++) { var half = j&4?1:0; st[(j>>3)*2+half] ^= (data[i+j])<<((j&3)<<3); }
    st[(rem>>3)*2+(rem&4?1:0)] ^= 0x06 << ((rem&3)<<3);
    st[(lanes-1)*2] ^= 0x80000000; st[(lanes-1)*2+1] ^= 0x80000000;
    keccakF(st);
    var outBytes = bits>>3, result = new Uint8Array(outBytes);
    for (var j = 0; j < outBytes; j++) result[j] = (st[(j>>3)*2+(j&4?1:0)] >> ((j&3)<<3)) & 0xFF;
    return Array.from(result).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}
var sha3_224 = async function(d) { return await sha3(d, 224); };
var sha3_256 = async function(d) { return await sha3(d, 256); };
var sha3_384 = async function(d) { return await sha3(d, 384); };
var sha3_512 = async function(d) { return await sha3(d, 512); };

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
    var outLen = 64, _bi = 0;
    var h = B2IV.slice();
    h[0] ^= 0x01010000n ^ BigInt(outLen);
    var offset = 0, counter = 0;
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
    for (var i = 0; i < outLen; i++) out[i] = Number(h[i>>3] >> BigInt((i&7)<<3) & 0xFFn);
    return Array.from(out).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}
// ── BLAKE2s (32-bit version) ──
var B2S_IV = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
var B2S_SIGMA = [
  [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  [14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],
  [11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],
  [7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],
  [9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],
  [2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],
  [12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],
  [13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],
  [6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],
  [10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0]
];
function b2s_ror32(x,n){return (x>>>n)|(x<<(32-n));}
function b2s_compress(h,m,counter,final){
  var v=new Uint32Array(16),i,r,s;
  for(i=0;i<8;i++)v[i]=h[i];
  v[8]=B2S_IV[0];v[9]=B2S_IV[1];v[10]=B2S_IV[2];v[11]=B2S_IV[3];
  v[12]=B2S_IV[4]^(counter&0xFFFFFFFF);v[13]=B2S_IV[5]^((counter>>>32)&0xFFFFFFFF);
  if(final)v[14]=(~v[14])>>>0;
  function G(a,b,c,d,x,y){
    v[a]=(v[a]+v[b]+x)>>>0;v[d]=b2s_ror32(v[d]^v[a],16);
    v[c]=(v[c]+v[d])>>>0;v[b]=b2s_ror32(v[b]^v[c],12);
    v[a]=(v[a]+v[b]+y)>>>0;v[d]=b2s_ror32(v[d]^v[a],8);
    v[c]=(v[c]+v[d])>>>0;v[b]=b2s_ror32(v[b]^v[c],7);
  }
  for(r=0;r<10;r++){
    s=B2S_SIGMA[r%10];
    G(0,4,8,12,m[s[0]],m[s[1]]);G(1,5,9,13,m[s[2]],m[s[3]]);
    G(2,6,10,14,m[s[4]],m[s[5]]);G(3,7,11,15,m[s[6]],m[s[7]]);
    G(0,5,10,15,m[s[8]],m[s[9]]);G(1,6,11,12,m[s[10]],m[s[11]]);
    G(2,7,8,13,m[s[12]],m[s[13]]);G(3,4,9,14,m[s[14]],m[s[15]]);
  }
  for(i=0;i<8;i++)h[i]=(h[i]^v[i]^v[i+8])>>>0;
}
function b2s_load32(d,o){return d[o]|(d[o+1]<<8)|(d[o+2]<<16)|(d[o+3]<<24);}
async function blake2s(data){
  var outLen=32,h=B2S_IV.slice(),_ci=0;
  h[0]^=0x01010000^outLen;
  var offset=0,counter=0;
  while(offset+64<=data.length){
    counter+=64;
    var m=new Array(16);
    for(var i=0;i<16;i++)m[i]=b2s_load32(data,offset+i*4);
    b2s_compress(h,m,counter,false);
    offset+=64;
    if(++_ci%8000===0) await maybeYield();
  }
  var last=new Uint8Array(64);last.fill(0);
  var rem=data.length-offset;
  for(var j=0;j<rem;j++)last[j]=data[offset+j];
  counter+=rem;
  var m=new Array(16);
  for(var i=0;i<16;i++)m[i]=b2s_load32(last,i*4);
  b2s_compress(h,m,counter,true);
  var out=new Uint8Array(outLen);
  for(var i=0;i<outLen;i++)out[i]=(h[i>>2]>>((i&3)<<3))&0xFF;
  return Array.from(out).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── Perceptual hashing (pure JS using Canvas) ──

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
    var vals = [];
    for (var y = 0; y < 8; y++)
        for (var x = 0; x < 8; x++)
            vals.push(out2[y * size + x]);
    var sorted = vals.slice().sort(function(a,b){return a-b;});
    var median = sorted[32];
    var hash = 0n, idx = 0;
    for (var y = 0; y < 8; y++)
        for (var x = 0; x < 8; x++) {
            if (out2[y * size + x] > median) hash |= (1n << BigInt(idx));
            idx++;
        }
    return hash.toString(16).padStart(16, '0');
}

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
async function md5(data) {
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
    var _mc = 0;
    for (var off = 0; off < msg.length; off += 64) {
        if (++_mc % 4000 === 0) await maybeYield();
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

// ── SHA-224 ──
async function sha224(data) {
  var K = new Uint32Array([
    0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,
    0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,
    0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,
    0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,
    0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,
    0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,
    0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,
    0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2
  ]);
  var H = new Uint32Array([0xC1059ED8,0x367CD507,0x3070DD17,0xF70E5939,0xFFC00B31,0x68581511,0x64F98FA7,0xBEFA4FA4]);
  var len = data.length, bits = len * 8;
  var padLen = (56 - ((len + 1) % 64) + 64) % 64;
  var ml = len + 1 + padLen + 8;
  var m = new Uint8Array(ml);
  m.set(data); m[len] = 0x80;
  var dv = new DataView(m.buffer, m.byteOffset, m.byteLength);
  dv.setUint32(ml - 4, bits, false);
  var _sc224 = 0;
  for (var off = 0; off < ml; off += 64) {
    if (++_sc224 % 4000 === 0) await maybeYield();
    var W = new Uint32Array(64);
    for (var t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4, false);
    for (var t = 16; t < 64; t++) {
      var s0 = ((W[t-15]>>>7)|(W[t-15]<<25))^((W[t-15]>>>18)|(W[t-15]<<14))^(W[t-15]>>>3);
      var s1 = ((W[t-2]>>>17)|(W[t-2]<<15))^((W[t-2]>>>19)|(W[t-2]<<13))^(W[t-2]>>>10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3];
    var e = H[4], f = H[5], g = H[6], h = H[7];
    for (var t = 0; t < 64; t++) {
      var S1 = ((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      var S0 = ((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var out = new Uint8Array(28);
  for (var i = 0; i < 7; i++) {
    out[i*4] = (H[i] >>> 24) & 0xFF; out[i*4+1] = (H[i] >>> 16) & 0xFF;
    out[i*4+2] = (H[i] >>> 8) & 0xFF; out[i*4+3] = H[i] & 0xFF;
  }
  return Array.from(out).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── MD2 ──
function md2(data) {
    var S = [0x29,0x2E,0x43,0xC9,0xA2,0xD8,0x7C,0x01,0x3D,0x36,0x54,0xA1,0xEC,0xF0,0x06,0x13,
        0x62,0xA7,0x05,0xF3,0xC0,0xC7,0x73,0x8C,0x98,0x93,0x2B,0xD9,0xBC,0x4C,0x82,0xCA,
        0x1E,0x9B,0x57,0x3C,0xFD,0xD4,0xE0,0x16,0x67,0x42,0x6F,0x18,0x8A,0x17,0xE5,0x12,
        0xBE,0x4E,0xC4,0xD6,0xDA,0x9E,0xDE,0x49,0xA0,0xFB,0xF5,0x8E,0x66,0xCD,0xBC,0xC9,
        0x53,0x0E,0x02,0xB5,0x9E,0xBA,0x20,0xFE,0xF7,0x3B,0x53,0xC7,0xC4,0x24,0x19,0x96,
        0x95,0x3D,0x3A,0x12,0x44,0x12,0x64,0xBB,0x7C,0x99,0xE0,0x43,0xAD,0x12,0xE7,0x5B,
        0x04,0x20,0xD6,0x53,0x8A,0xC2,0x9E,0x32,0xDB,0x4C,0xA6,0xD5,0x0A,0x24,0xA2,0xD4,
        0x03,0x14,0xE4,0xDB,0x1C,0x57,0x09,0x72,0xD5,0x4D,0x30,0xED,0x5A,0x0A,0x35,0xAA,
        0x25,0x23,0xB0,0x87,0xDC,0xC7,0x80,0xF7,0xC3,0x7E,0x3E,0x90,0x79,0x2E,0xA9,0x06,
        0x06,0xDB,0x92,0xEC,0x77,0x0D,0x6B,0x53,0x3E,0x34,0xC0,0xAE,0x37,0xAF,0x03,0xC2,
        0xD0,0x4D,0xBB,0xD5,0x7E,0x3F,0x4A,0x2C,0x7A,0xD3,0x8B,0x93,0x1D,0xBF,0xD0,0xB5,
        0x36,0xD0,0x7B,0x76,0x3D,0x4C,0xDF,0x5A,0xB8,0x6B,0x62,0xC4,0x75,0xD4,0xE4,0x9F,
        0x09,0xF4,0x30,0xD6,0xDA,0x27,0x17,0x5D,0x4C,0x46,0x07,0xA5,0x97,0x18,0x82,0x85,
        0x8E,0xA4,0x75,0xC3,0x59,0x7B,0x27,0xBF,0x6F,0x11,0x52,0x38,0x3D,0x8C,0x65,0x40,
        0xBE,0xE8,0x2A,0xEB,0xD5,0x6A,0x1C,0x57,0x4B,0xF7,0xDC,0x6C,0x32,0x81,0xE5,0x7D,
        0x64,0xDD,0x04,0x54,0xE1,0x75,0x6D,0xD1,0x80,0xAE,0xA4,0x65,0x34,0xD7,0x46,0xDB];
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
        var t2 = 0;
        for (var round = 0; round < 18; round++) {
            for (var k = 0; k < 48; k++) { t2 = state[k] ^= S[t2]; }
            t2 = (t2 + round) & 0xFF;
        }
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
async function ripemd160(data) {
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
    var _rc = 0;
    for(var i=0;i<pad.length;i+=64){
        if (++_rc % 2000 === 0) await maybeYield();
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

// ── BLAKE3 (pure JS implementation) ──
var B3_IV = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
var B3_SIGMA = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3,11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4,7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8,9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13,2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9,12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11];
function b3_rot32(x,n){return (x>>>n)|(x<<(32-n));}
function b3_ld32(b,o){return b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24);}
function b3_st32(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255;}
function b3_compress(s,blk,off,cl,ch,bl,fl){
  var v=new Uint32Array(16),i,r,si;
  for(i=0;i<8;i++)v[i]=s[i];
  v[8]=B3_IV[0];v[9]=B3_IV[1];v[10]=B3_IV[2];v[11]=B3_IV[3];
  v[12]=B3_IV[4]^cl;v[13]=B3_IV[5]^ch;v[14]=B3_IV[6]^bl;v[15]=B3_IV[7]^fl;
  var m=[];
  for(i=0;i<16;i++){m.push(b3_ld32(blk,off+i*4));v[i] ^= m[i];}
  function G(a,b,c,d,x,y){
    v[a]=(v[a]+v[b]+x)>>>0;v[d]=b3_rot32(v[d]^v[a],16);
    v[c]=(v[c]+v[d])>>>0;v[b]=b3_rot32(v[b]^v[c],12);
    v[a]=(v[a]+v[b]+y)>>>0;v[d]=b3_rot32(v[d]^v[a],8);
    v[c]=(v[c]+v[d])>>>0;v[b]=b3_rot32(v[b]^v[c],7);
  }
  for(r=0;r<7;r++){
    si=r*16;
    G(0,4,8,12,m[B3_SIGMA[si]],m[B3_SIGMA[si+1]]);G(1,5,9,13,m[B3_SIGMA[si+2]],m[B3_SIGMA[si+3]]);
    G(2,6,10,14,m[B3_SIGMA[si+4]],m[B3_SIGMA[si+5]]);G(3,7,11,15,m[B3_SIGMA[si+6]],m[B3_SIGMA[si+7]]);
    G(0,5,10,15,m[B3_SIGMA[si+8]],m[B3_SIGMA[si+9]]);G(1,6,11,12,m[B3_SIGMA[si+10]],m[B3_SIGMA[si+11]]);
    G(2,7,8,13,m[B3_SIGMA[si+12]],m[B3_SIGMA[si+13]]);G(3,4,9,14,m[B3_SIGMA[si+14]],m[B3_SIGMA[si+15]]);
  }
  for(i=0;i<8;i++)s[i]=(s[i]^v[i]^v[i+8])>>>0;
}
function b3_xof(s,blk,off,cl,ch,bl,fl){
  var v=new Uint32Array(16),i,r,si;
  for(i=0;i<8;i++)v[i]=s[i];
  v[8]=B3_IV[0];v[9]=B3_IV[1];v[10]=B3_IV[2];v[11]=B3_IV[3];
  v[12]=B3_IV[4]^cl;v[13]=B3_IV[5]^ch;v[14]=B3_IV[6]^bl;v[15]=B3_IV[7]^fl;
  var m=[];
  for(i=0;i<16;i++){m.push(b3_ld32(blk,off+i*4));v[i] ^= m[i];}
  function G(a,b,c,d,x,y){
    v[a]=(v[a]+v[b]+x)>>>0;v[d]=b3_rot32(v[d]^v[a],16);
    v[c]=(v[c]+v[d])>>>0;v[b]=b3_rot32(v[b]^v[c],12);
    v[a]=(v[a]+v[b]+y)>>>0;v[d]=b3_rot32(v[d]^v[a],8);
    v[c]=(v[c]+v[d])>>>0;v[b]=b3_rot32(v[b]^v[c],7);
  }
  for(r=0;r<7;r++){
    si=r*16;
    G(0,4,8,12,m[B3_SIGMA[si]],m[B3_SIGMA[si+1]]);G(1,5,9,13,m[B3_SIGMA[si+2]],m[B3_SIGMA[si+3]]);
    G(2,6,10,14,m[B3_SIGMA[si+4]],m[B3_SIGMA[si+5]]);G(3,7,11,15,m[B3_SIGMA[si+6]],m[B3_SIGMA[si+7]]);
    G(0,5,10,15,m[B3_SIGMA[si+8]],m[B3_SIGMA[si+9]]);G(1,6,11,12,m[B3_SIGMA[si+10]],m[B3_SIGMA[si+11]]);
    G(2,7,8,13,m[B3_SIGMA[si+12]],m[B3_SIGMA[si+13]]);G(3,4,9,14,m[B3_SIGMA[si+14]],m[B3_SIGMA[si+15]]);
  }
  for(i=0;i<8;i++)s[i]=v[i]>>>0;
}
async function blake3(data){
  var BL=64,CH=1024,OL=32;
  if(data.length===0){
    var cv=B3_IV.slice(),blk=new Uint8Array(BL);
    b3_compress(cv,blk,0,0,0,0,1|2|8);
    var out=new Uint8Array(OL);
    for(var i=0;i<OL/4;i++)b3_st32(out,i*4,cv[i]);
    return Array.from(out).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  var nc=Math.ceil(data.length/CH),cvs=[];
  for(var c=0;c<nc;c++){
    var cs=c*CH,ce=Math.min(cs+CH,data.length),nb=Math.ceil((ce-cs)/BL);
    var cv=B3_IV.slice();
    for(var b=0;b<nb;b++){
      var bs=cs+b*BL,be=Math.min(bs+BL,data.length),bw=be-bs;
      var blk=new Uint8Array(BL);blk.set(data.subarray(bs,be));
      var fl=0;if(b===0)fl|=1;if(b===nb-1)fl|=2;
      var co=bs-cs;b3_compress(cv,blk,0,co>>>0,Math.floor(co/4294967296)>>>0,bw,fl);
    }
    cvs.push(cv.slice());
  }
  while(cvs.length>1){
    var nxt=[];
    for(var i=0;i<cvs.length;i+=2){
      if(i+1>=cvs.length){nxt.push(cvs[i]);continue;}
      var l=cvs[i],rgt=cvs[i+1],pb=new Uint8Array(BL);
      for(var j=0;j<8;j++){b3_st32(pb,j*4,l[j]);b3_st32(pb,32+j*4,rgt[j]);}
      var pc=B3_IV.slice(),isLast=nxt.length===0&&cvs.length<=2;
      b3_compress(pc,pb,0,0,0,BL,4|(isLast?8:0));
      nxt.push(pc);
    }
    cvs=nxt;
  }
  var out=new Uint8Array(OL);
  for(var i=0;i<OL/4;i++)b3_st32(out,i*4,cvs[0][i]);
  return Array.from(out).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

// ── Whirlpool (ISO/IEC 10118-3) ──
var WP_SBOX = [
  0x63,0x7C,0x77,0x7B,0xF2,0x6B,0x6F,0xC5,0x30,0x01,0x67,0x2B,0xFE,0xD7,0xAB,0x76,
  0xCA,0x82,0xC9,0x7D,0xFA,0x59,0x47,0xF0,0xAD,0xD4,0xA2,0xAF,0x9C,0xA4,0x72,0xC0,
  0xB7,0xFD,0x93,0x26,0x36,0x3F,0xF7,0xCC,0x34,0xA5,0xE5,0xF1,0x71,0xD8,0x31,0x15,
  0x04,0xC7,0x23,0xC3,0x18,0x96,0x05,0x9A,0x07,0x12,0x80,0xE2,0xEB,0x27,0xB2,0x75,
  0x09,0x83,0x2C,0x1A,0x1B,0x6E,0x5A,0xA0,0x52,0x3B,0xD6,0xB3,0x29,0xE3,0x2F,0x84,
  0x53,0xD1,0x00,0xED,0x20,0xFC,0xB1,0x5B,0x6A,0xCB,0xBE,0x39,0x4A,0x4C,0x58,0xCF,
  0xD0,0xEF,0xAA,0xFB,0x43,0x4D,0x33,0x85,0x45,0xF9,0x02,0x7F,0x50,0x3C,0x9F,0xA8,
  0x51,0xA3,0x40,0x8F,0x92,0x9D,0x38,0xF5,0xBC,0xB6,0xDA,0x21,0x10,0xFF,0xF3,0xD2,
  0xCD,0x0C,0x13,0xEC,0x5F,0x97,0x44,0x17,0xC4,0xA7,0x7E,0x3D,0x64,0x5D,0x19,0x73,
  0x60,0x81,0x4F,0xDC,0x22,0x2A,0x90,0x88,0x46,0xEE,0xB8,0x14,0xDE,0x5E,0x0B,0xDB,
  0xE0,0x32,0x3A,0x0A,0x49,0x06,0x24,0x5C,0xC2,0xD3,0xAC,0x62,0x91,0x95,0xE4,0x79,
  0xE7,0xC8,0x37,0x6D,0x8D,0xD5,0x4E,0xA9,0x6C,0x56,0xF4,0xEA,0x65,0x7A,0xAE,0x08,
  0xBA,0x78,0x25,0x2E,0x1C,0xA6,0xB4,0xC6,0xE8,0xDD,0x74,0x1F,0x4B,0xBD,0x8B,0x8A,
  0x70,0x3E,0xB5,0x66,0x48,0x03,0xF6,0x0E,0x61,0x35,0x57,0xB9,0x86,0xC1,0x1D,0x9E,
  0xE1,0xF8,0x98,0x11,0x69,0xD9,0x8E,0x94,0x9B,0x1E,0x87,0xE9,0xCE,0x55,0x28,0xDF,
  0x8C,0xA1,0x89,0x0D,0xBF,0xE6,0x42,0x68,0x41,0x99,0x2D,0x0F,0xB0,0x54,0xBB,0x16
];
var WP_MDS = [
  [0x01,0x01,0x04,0x01,0x08,0x05,0x02,0x09],
  [0x09,0x01,0x01,0x04,0x01,0x08,0x05,0x02],
  [0x02,0x09,0x01,0x01,0x04,0x01,0x08,0x05],
  [0x05,0x02,0x09,0x01,0x01,0x04,0x01,0x08],
  [0x08,0x05,0x02,0x09,0x01,0x01,0x04,0x01],
  [0x01,0x08,0x05,0x02,0x09,0x01,0x01,0x04],
  [0x04,0x01,0x08,0x05,0x02,0x09,0x01,0x01],
  [0x01,0x04,0x01,0x08,0x05,0x02,0x09,0x01]
];
function wp_gf_mul(a,b){
  var r=0;
  for(var i=0;i<8;i++){if(b&1)r^=a;var h=a&0x80;a=(a<<1)&0xFF;if(h)a^=0x11D;b>>=1;}
  return r;
}
function wp_subBytes(s){
  for(var i=0;i<64;i++)s[i]=WP_SBOX[s[i]];
}
function wp_shiftColumns(s){
  var t=new Uint8Array(64);
  for(var c=0;c<8;c++)for(var r=0;r<8;r++)t[(r+c)%8*8+c]=s[r*8+c];
  return t;
}
function wp_mixRows(s){
  var t=new Uint8Array(64);
  for(var r=0;r<8;r++)for(var c=0;c<8;c++){
    var v=0;
    for(var k=0;k<8;k++)v^=wp_gf_mul(WP_MDS[c][k],s[r*8+k]);
    t[r*8+c]=v;
  }
  return t;
}
function wp_addRoundKey(s,k){
  for(var i=0;i<64;i++)s[i]^=k[i];
}
function wp_keySchedule(k,rc){
  wp_subBytes(k);k=wp_shiftColumns(k);k=wp_mixRows(k);
  for(var i=0;i<8;i++)k[i*8+i]^=rc[i];
  return k;
}
function wp_cipher(msg,k){
  var s=new Uint8Array(msg);
  for(var r=0;r<10;r++){
    wp_subBytes(s);s=wp_shiftColumns(s);s=wp_mixRows(s);
    wp_addRoundKey(s,k);
    k=wp_keySchedule(k,WP_RC[r]);
  }
  return s;
}
var WP_RC=[];
(function(){
  for(var i=0;i<10;i++){var rc=new Uint8Array(8);for(var j=0;j<8;j++)rc[j]=WP_SBOX[(8*i+j)%256];WP_RC.push(rc);}
})();
async function whirlpool(data){
  var bits=data.length*8, _wc=0;
  var padLen=(32-((data.length+1)%64)+64)%64;
  var ml=data.length+1+padLen+32;
  var m=new Uint8Array(ml);
  m.set(data);m[data.length]=0x80;
  var lenOff=ml-32;
  for(var i=0;i<24;i++)m[lenOff+i]=0;
  m[lenOff+24]=(bits>>>56)&0xFF;m[lenOff+25]=(bits>>>48)&0xFF;
  m[lenOff+26]=(bits>>>40)&0xFF;m[lenOff+27]=(bits>>>32)&0xFF;
  m[lenOff+28]=(bits>>>24)&0xFF;m[lenOff+29]=(bits>>>16)&0xFF;
  m[lenOff+30]=(bits>>>8)&0xFF;m[lenOff+31]=bits&0xFF;
  var H=new Uint8Array(64);
  for(var off=0;off<ml;off+=64){
    if (++_wc % 4000 === 0) await maybeYield();
    var blk=m.subarray(off,off+64);
    var K=new Uint8Array(H);
    var enc=wp_cipher(blk,K);
    for(var i=0;i<64;i++)H[i]^=blk[i]^enc[i];
  }
  return Array.from(H).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
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

    // Step 1: Fast WebCrypto hashes + BLAKE3 (no freezing)
    hashes['SHA-1'] = await hashAlgo('SHA-1', data);
    hashes['SHA-256'] = await hashAlgo('SHA-256', data);
    hashes['SHA-384'] = await hashAlgo('SHA-384', data);
    hashes['SHA-512'] = await hashAlgo('SHA-512', data);
    try { hashes['BLAKE3'] = await blake3(data); } catch(e) {}
    try { hashes['MD2'] = md2(data); } catch(e) {}
    try { hashes['MD4'] = md4(data); } catch(e) {}

    var result = {
        file_info: { file_name: name, file_size_bytes: data.length },
        hashes: hashes,
        perceptual_hashes: {}
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
                phash: phash(small)
            };
            try { result.perceptual_hashes.whash = whash(small); } catch(e) {}
            result.file_info.width = loaded.w;
            result.file_info.height = loaded.h;
            result.file_info.format = ext.replace('.', '').toUpperCase();
        } catch(e) { result.file_info.image_error = e.message; }
    }

    // Step 3: Background worker for remaining hashes (SHA-3, BLAKE2, SHA-224, MD5, RIPEMD-160, Whirlpool)
    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
        try {
            var w = new Worker('data:application/javascript,' + encodeURIComponent(
                'self.importScripts("' + location.href.substring(0, location.href.lastIndexOf('/')).replace('/Style_Web_Page', '') + '/Fingerprint/hashing.js' + '");' +
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
                'self.postMessage({type:"done",hashes:h});}'
            ));
            w.postMessage({ type: 'compute-remaining', buf: buf }, [buf]);
            w.onmessage = function(ev) {
                var m = ev.data;
                if (m.type === 'done') {
                    Object.assign(result.hashes, m.hashes);
                    if (window._fpResult) Object.assign(window._fpResult.hashes, m.hashes);
                    w.terminate();
                }
            };
            w.onerror = function() { w.terminate(); };
        } catch(e) { console.warn('Background worker unavailable:', e); }
    }

    return result;
}

// ── Fast fingerprint for simplified mode (fast hashes + background worker for the rest) ──
async function fastFingerprint(file, onProgress, onRemainingHashes) {
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
    function setProg(msg) { if (onProgress) onProgress(msg); }

    // Phase 1: WebCrypto (truly async, fast, no freeze)
    setProg('SHA-1…');
    hashes['SHA-1'] = await hashAlgo('SHA-1', data);
    setProg('SHA-256…');
    hashes['SHA-256'] = await hashAlgo('SHA-256', data);
    setProg('SHA-384…');
    hashes['SHA-384'] = await hashAlgo('SHA-384', data);
    setProg('SHA-512…');
    hashes['SHA-512'] = await hashAlgo('SHA-512', data);
    setProg('BLAKE3…');
    try { hashes['BLAKE3'] = await blake3(data); } catch(e) {}

    var result = {
        file_info: { file_name: name, file_size_bytes: data.length },
        hashes: hashes,
        perceptual_hashes: {}
    };

    // Perceptual hashes for images
    if (imgExts.includes(ext)) {
        try {
            setProg('Loading image…');
            var loaded = await loadImage(new Blob([data]));
            var imgData = loaded.imgData;
            var small = resizeImageData(imgData, 32);
            await maybeYield();
            setProg('ahash…');
            result.perceptual_hashes.ahash = ahash(small); await maybeYield();
            setProg('dhash…');
            result.perceptual_hashes.dhash = dhash(small); await maybeYield();
            setProg('phash…');
            result.perceptual_hashes.phash = phash(small); await maybeYield();
            try { setProg('whash…'); result.perceptual_hashes.whash = whash(small); await maybeYield(); } catch(e) {}
            result.file_info.width = loaded.w;
            result.file_info.height = loaded.h;
            result.file_info.format = ext.replace('.', '').toUpperCase();
        } catch(e) { result.file_info.image_error = e.message; }
    }

    setProg('');

    // Phase 2: Background worker for remaining hashes (SHA-3, BLAKE2, SHA-224, MD5, RIPEMD-160, Whirlpool)
    if (typeof onRemainingHashes === 'function' && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
        window._fpWorkerPromise = new Promise(function(workerResolve) {
        try {
            var w = new Worker('data:application/javascript,' + encodeURIComponent(
                'self.importScripts("' + location.href.substring(0, location.href.lastIndexOf('/')).replace('/Style_Web_Page', '') + '/Fingerprint/hashing.js' + '");' +
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
                'self.postMessage({type:"done",hashes:h});}'
            ));
            w.postMessage({ type: 'compute-remaining', buf: buf }, [buf]);
            w.onmessage = function(ev) {
                var m = ev.data;
                if (m.type === 'p') {
                    if (onProgress) onProgress(m.key + '…');
                } else if (m.type === 'done') {
                    if (onProgress) onProgress('');
                    onRemainingHashes(m.hashes);
                    workerResolve();
                    w.terminate();
                }
            };
            w.onerror = function() { workerResolve(); w.terminate(); };
        } catch(e) { console.warn('Background worker unavailable:', e); workerResolve(); }
        });
    } else {
        window._fpWorkerPromise = Promise.resolve();
    }

    return result;
}
window.fastFingerprint = fastFingerprint;

// ── Trim fingerprint JSON payload to fit within maxBits ──
function trimFingerprintPayload(fpResult, maxBytes) {
    var orderedKeys = [
        'SHA-256', 'SHA-512', 'BLAKE3', 'SHA-1', 'SHA-384',
        'SHA-3_256', 'BLAKE2b', 'SHA-224', 'SHA-3_224', 'BLAKE2s',
        'SHA-3_384', 'SHA-3_512', 'RIPEMD-160', 'Whirlpool', 'MD5'
    ];
    var trimmed = { file_info: {}, hashes: {}, perceptual_hashes: {} };
    if (fpResult.file_info.width) trimmed.file_info.width = fpResult.file_info.width;
    if (fpResult.file_info.height) trimmed.file_info.height = fpResult.file_info.height;
    if (fpResult.file_info.format) trimmed.file_info.format = fpResult.file_info.format;
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
window.trimFingerprintPayload = trimFingerprintPayload;

// ── BLAKE3 self-verify at load time ──
(async function(){
  try {
    var tvEmpty = await blake3(new Uint8Array(0));
    var tvAbc = await blake3(new Uint8Array([0x61,0x62,0x63]));
    if(tvEmpty==='292d4e1d5ac6239c412dda791b1faa3d23a2b545e3e785029369a2a0bbd7461b' &&
       tvAbc==='56887470a385e413002515c5db4a44f41258bc6604b436aef25840d65888d895') {
      console.log('BLAKE3 self-check passed');
    } else {
      console.warn('BLAKE3 implementation deviates from expected');
      console.log('Empty input hash:', tvEmpty, '(expected 292d4e1d...)');
      console.log('ABC input hash:', tvAbc, '(expected 56887470...)');
    }
  } catch(e) {
    console.warn('BLAKE3 self-check failed:', e.message);
  }
})();
