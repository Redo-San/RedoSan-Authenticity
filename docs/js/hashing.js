// ── SHA-3 (Keccak) — fixed absorption (no & 7 truncation) ──
(function() {
const KECCAK_ROUNDS = 24;
const RC = [0x1,0x8082,0x8000000080008000n,0x8000000000008080n,0x8000000000008009n,0x800000000000008an,0x8000000000000088n,0x8000000000808009n,0x800000000000000en,0x800000000000008bn,0x800000000080000bn,0x800000000000808bn,0x800000008000000bn,0x800000008000800an,0x8000000000000080n,0x800000008000000fn,0x8000000080008008n,0x8000000000000093n,0x800000008000800an,0x8000000000000096n,0x8000000000808003n,0x8000000000808083n,0x8000000000000280n,0x80000000800000a5n];
const ROTC = [1,3,6,10,15,21,28,36,45,55,2,14,27,41,52,8,25,43,62,18,39,61,20,44];
function keccak(state, data, rate) {
    const r = rate >> 3, lanes = rate / 64;
    let i = 0;
    for (; i + r <= data.length; i += r) {
        for (let j = 0; j < r; j++) state[j >> 3] ^= BigInt(data[i + j]) << BigInt((j & 7) << 3);
        keccakF(state);
    }
    const rem = data.length - i;
    for (let j = 0; j < rem; j++) state[j >> 3] ^= BigInt(data[i + j]) << BigInt((j & 7) << 3);
    state[rem >> 3] ^= BigInt(0x06) << BigInt((rem & 7) << 3);
    state[lanes - 1] ^= 0x8000000000000000n;
    keccakF(state);
}
function keccakF(state) {
    for (let r = 0; r < KECCAK_ROUNDS; r++) {
        const C = [0n,0n,0n,0n,0n];
        for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        const D = [0n,0n,0n,0n,0n];
        for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ (C[(x+1)%5] << 1n | C[(x+1)%5] >> 63n);
        for (let x = 0; x < 25; x++) state[x] ^= D[x%5];
        let t = state[1];
        for (let x = 0; x < 24; x++) {
            const xs = [0,1,2,3,4,1,2,3,4,0,2,3,4,0,1,3,4,0,1,2,4,0,1,2,3][x];
            const ys = [0,1,2,3,4,3,4,0,1,2,1,2,3,4,0,4,0,1,2,3,2,3,4,0,1][x];
            const idx = xs * 5 + ys;
            state[idx] = state[idx] << BigInt(ROTC[x]) | state[idx] >> BigInt(64 - ROTC[x]);
        }
        for (let x = 0; x < 25; x++) { const t2 = state[x]; state[x] = t; t = t2; }
        for (let x = 0; x < 25; x++) state[x] = state[x] ^ (~state[(x+1)%5+Math.floor((x+1)/5)*5] & state[(x+2)%5+Math.floor((x+2)/5)*5]);
        state[0] ^= RC[r];
    }
}
function sha3(d, bits) {
    const rate = 1600 - bits * 2;
    const state = new Array(25).fill(0n);
    keccak(state, d, rate);
    const outBytes = bits >> 3;
    const result = new Uint8Array(outBytes);
    for (let i = 0; i < outBytes; i++) result[i] = Number(state[i >> 3] >> BigInt((i & 7) << 3) & 0xFFn);
    return Array.from(result).map(b => b.toString(16).padStart(2,'0')).join('');
}
window.sha3_224 = d => sha3(d, 224);
window.sha3_256 = d => sha3(d, 256);
window.sha3_384 = d => sha3(d, 384);
window.sha3_512 = d => sha3(d, 512);
})();

// ── Minimal BLAKE2b (64-byte digest) implementation ──
(function() {
const B2IV = [0x6a09e667f3bcc908n,0xbb67ae8584caa73bn,0x3c6ef372fe94f82bn,0xa54ff53a5f1d36f1n,0x510e527fade682d1n,0x9b05688c2b3e6c1fn,0x1f83d9abfb41bd6bn,0x5be0cd19137e2179n];
const B2SIG = [
  [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],
  [11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],[7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],
  [9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],[2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],
  [12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],[13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],
  [6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],[10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0]
];
function G(v,a,b,c,d,x,y) {
    v[a] = (v[a] + v[b] + x) & 0xFFFFFFFFFFFFFFFFn; v[d] = rotr64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & 0xFFFFFFFFFFFFFFFFn; v[b] = rotr64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & 0xFFFFFFFFFFFFFFFFn; v[d] = rotr64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & 0xFFFFFFFFFFFFFFFFn; v[b] = rotr64(v[b] ^ v[c], 63);
}
function rotr64(x,n) { return (x >> n) | (x << (64n - n)); }
function blake2b_compress(h,m,counter,final) {
    let v = new Array(16);
    for (let i = 0; i < 8; i++) { v[i] = h[i]; v[i+8] = B2IV[i]; }
    v[12] ^= BigInt(counter) & 0xFFFFFFFFFFFFFFFFn;
    v[13] ^= BigInt(counter >> 32) & 0xFFFFFFFFFFFFFFFFn;
    if (final) v[14] = ~v[14];
    for (let r = 0; r < 12; r++) {
        const s = B2SIG[r % 10];
        G(v,0,4,8,12,m[s[0]],m[s[1]]); G(v,1,5,9,13,m[s[2]],m[s[3]]);
        G(v,2,6,10,14,m[s[4]],m[s[5]]); G(v,3,7,11,15,m[s[6]],m[s[7]]);
        G(v,0,5,10,15,m[s[8]],m[s[9]]); G(v,1,6,11,12,m[s[10]],m[s[11]]);
        G(v,2,7,8,13,m[s[12]],m[s[13]]); G(v,3,4,9,14,m[s[14]],m[s[15]]);
    }
    for (let i = 0; i < 8; i++) h[i] = (h[i] ^ v[i] ^ v[i+8]) & 0xFFFFFFFFFFFFFFFFn;
}
window.blake2b = async function(data) {
    const outLen = 64;
    let h = B2IV.slice();
    h[0] ^= 0x01010000n ^ BigInt(outLen);
    let offset = 0, counter = 0;
    while (offset + 128 <= data.length) {
        counter += 128;
        const m = new Array(16);
        for (let i = 0; i < 16; i++)
            m[i] = BigInt(data[offset+i*8])|(BigInt(data[offset+i*8+1])<<8n)|(BigInt(data[offset+i*8+2])<<16n)|(BigInt(data[offset+i*8+3])<<24n)|
                   (BigInt(data[offset+i*8+4])<<32n)|(BigInt(data[offset+i*8+5])<<40n)|(BigInt(data[offset+i*8+6])<<48n)|(BigInt(data[offset+i*8+7])<<56n);
        blake2b_compress(h,m,counter,false);
        offset += 128;
    }
    const last = new Uint8Array(128);
    last.fill(0);
    const rem = data.length - offset;
    for (let j = 0; j < rem; j++) last[j] = data[offset + j];
    counter += rem;
    const m = new Array(16);
    for (let i = 0; i < 16; i++)
        m[i] = BigInt(last[i*8])|(BigInt(last[i*8+1])<<8n)|(BigInt(last[i*8+2])<<16n)|(BigInt(last[i*8+3])<<24n)|
               (BigInt(last[i*8+4])<<32n)|(BigInt(last[i*8+5])<<40n)|(BigInt(last[i*8+6])<<48n)|(BigInt(last[i*8+7])<<56n);
    blake2b_compress(h,m,counter,true);
    const out = new Uint8Array(outLen);
    for (let i = 0; i < outLen; i++) out[i] = Number(h[i>>3] >> BigInt((i&7)<<3) & 0xFFn);
    return Array.from(out).map(b => b.toString(16).padStart(2,'0')).join('');
};
window.blake2s = async function(data) {
    // BLAKE2s = 256-bit, use same BLAKE2b truncated to 32 bytes
    const full = await window.blake2b(data);
    return full.substring(0, 64);
};
})();

// ── Minimal MD5 implementation ──
(function() {
const md5_shift = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
const md5_sin = new Uint32Array(64);
for (let i = 0; i < 64; i++) md5_sin[i] = Math.floor(Math.abs(Math.sin(i+1)) * 0x100000000);
function md5_transform(state, block) {
    let a = state[0], b = state[1], c = state[2], d = state[3];
    const x = new Uint32Array(16);
    for (let i = 0; i < 16; i++) x[i] = block[i*4] | (block[i*4+1]<<8) | (block[i*4+2]<<16) | (block[i*4+3]<<24);
    for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5*i+1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3*i+5) % 16; }
        else { f = c ^ (b | ~d); g = (7*i) % 16; }
        f = (f + a + md5_sin[i] + x[g]) | 0;
        a = d; d = c; c = b; b = (b + ((f << md5_shift[i]) | (f >>> (32 - md5_shift[i])))) | 0;
    }
    state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0; state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
}
window.md5 = function(data) {
    const origLen = data.length * 8;
    const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
    padded.set(data);
    padded[data.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, origLen, true);
    view.setUint32(padded.length - 8, 0, true);
    const state = new Uint32Array([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]);
    for (let i = 0; i < padded.length; i += 64) md5_transform(state, padded.slice(i, i+64));
    return Array.from(new Uint8Array(new Uint32Array(state).buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
};
})();

// ── Perceptual hashing (pure JS using Canvas) ──

// ahash: Average Hash
function ahash(imgData) {
    const { data, w, h } = imgData;
    const size = 8;
    const gray = new Float64Array(size * size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
    let hash = 0n;
    for (let i = 0; i < gray.length; i++)
        if (gray[i] > avg) hash |= (1n << BigInt(i));
    return hash.toString(16).padStart(16, '0');
}

// dhash: Difference Hash
function dhash(imgData) {
    const { data, w, h } = imgData;
    const size = 9; // 9x9 to get 8x8 diffs
    const gray = new Float64Array(size * size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    let hash = 0n, idx = 0;
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size - 1; x++) {
            if (gray[y * size + x] > gray[y * size + x + 1]) hash |= (1n << BigInt(idx));
            idx++;
        }
    return hash.toString(16).padStart(16, '0');
}

// phash: Perceptual Hash (DCT-based, simplified)
function phash(imgData) {
    const { data, w, h } = imgData;
    const size = 32;
    const gray = new Float64Array(size * size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    // DCT on 32x32, take top-left 8x8
    const dct = new Float64Array(8 * 8);
    for (let u = 0; u < 8; u++)
        for (let v = 0; v < 8; v++) {
            let s = 0;
            for (let x = 0; x < size; x++)
                for (let y = 0; y < size; y++)
                    s += gray[x * size + y] * Math.cos((2*x+1)*u*Math.PI/(2*size)) * Math.cos((2*y+1)*v*Math.PI/(2*size));
            const cu = u === 0 ? 1/Math.SQRT2 : 1, cv = v === 0 ? 1/Math.SQRT2 : 1;
            dct[u * 8 + v] = s * cu * cv * 2 / size;
        }
    const avg = dct.reduce((a, b) => a + b, 0) / dct.length;
    let hash = 0n;
    for (let i = 0; i < dct.length; i++)
        if (dct[i] > avg) hash |= (1n << BigInt(i));
    return hash.toString(16).padStart(16, '0');
}

// whash: Wavelet Hash (Haar wavelet approximation)
function whash(imgData) {
    const { data, w, h } = imgData;
    const size = 32;
    const gray = new Float64Array(size * size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = (y * w + x) * 4;
            gray[y * size + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
    // One level of Haar wavelet
    const half = size / 2;
    const out = new Float64Array(size * size);
    // Horizontal
    for (let y = 0; y < size; y++)
        for (let x = 0; x < half; x++) {
            const a = gray[y * size + x*2], b = gray[y * size + x*2 + 1];
            out[y * size + x] = (a + b) / Math.SQRT2;
            out[y * size + half + x] = (a - b) / Math.SQRT2;
        }
    // Vertical
    const out2 = new Float64Array(size * size);
    for (let y = 0; y < half; y++)
        for (let x = 0; x < size; x++) {
            const a = out[y * size + x], b = out[(y + half) * size + x];
            out2[y * size + x] = (a + b) / Math.SQRT2;
            out2[(y + half) * size + x] = (a - b) / Math.SQRT2;
        }
    // Take top-left 8x8 of LL band
    let hash = 0n, idx = 0;
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
            if (out2[y * size + x] > 0) hash |= (1n << BigInt(idx));
            idx++;
        }
    return hash.toString(16).padStart(16, '0');
}

// ── Resize ImageData to target size using canvas ──
function resizeImageData(imgData, targetSize) {
    const c = document.createElement('canvas');
    c.width = imgData.w; c.height = imgData.h;
    const ctx = c.getContext('2d');
    const tmp = ctx.createImageData(imgData.w, imgData.h);
    tmp.data.set(imgData.data);
    ctx.putImageData(tmp, 0, 0);
    const c2 = document.createElement('canvas');
    c2.width = targetSize; c2.height = targetSize;
    const ctx2 = c2.getContext('2d');
    ctx2.drawImage(c, 0, 0, targetSize, targetSize);
    const r = ctx2.getImageData(0, 0, targetSize, targetSize);
    r.w = targetSize; r.h = targetSize;
    return r;
}

// ── Full fingerprint ──
async function fingerprintFile(file) {
    const buf = await file.arrayBuffer();
    const data = new Uint8Array(buf);
    const name = file.name;
    const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
    const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.tif', '.webp'];
    
    const hashes = {};
    // Web Crypto API for SHA hashes
    async function hashAlgo(algo, d) {
        const h = await crypto.subtle.digest(algo, d);
        return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    hashes['SHA-1'] = await hashAlgo('SHA-1', data);
    hashes['SHA-256'] = await hashAlgo('SHA-256', data);
    hashes['SHA-384'] = await hashAlgo('SHA-384', data);
    hashes['SHA-512'] = await hashAlgo('SHA-512', data);
    
    // SHA-224 is not supported by Web Crypto; skip
    
    // JS implementation of SHA-3 and BLAKE2 using a small embedded library
    try {
        if (typeof sha3_256 === 'function') {
            hashes['SHA-3_224'] = sha3_224(data);
            hashes['SHA-3_256'] = sha3_256(data);
            hashes['SHA-3_384'] = sha3_384(data);
            hashes['SHA-3_512'] = sha3_512(data);
        }
    } catch(e) {}
    try {
        if (typeof blake2b === 'function') {
            hashes['BLAKE2b'] = await blake2b(data);
            hashes['BLAKE2s'] = await blake2s(data);
        }
    } catch(e) {}
    
    // MD5
    try {
        if (typeof md5 === 'function') {
            hashes['MD5'] = md5(data);
        }
    } catch(e) {}
    
    const result = {
        file_info: { file_name: name, file_size_bytes: data.length },
        hashes: hashes,
        perceptual_hashes: {}
    };
    
    if (imgExts.includes(ext)) {
        try {
            const img = await loadImage(new Blob([data]));
            // Resize to 32x32 for perceptual hashing
            const small = resizeImageData(img, 32);
            result.perceptual_hashes = {
                ahash: ahash(small),
                dhash: dhash(small),
                phash: phash(small)
            };
            try { result.perceptual_hashes.whash = whash(small); } catch(e) {}
            result.file_info.width = img.w;
            result.file_info.height = img.h;
            result.file_info.format = ext.replace('.', '').toUpperCase();
        } catch(e) {
            result.file_info.image_error = e.message;
        }
    }
    
    return result;
}

// ── Metadata reading (EXIF via DataView) ──
async function readMetadata(file) {
    const buf = await file.arrayBuffer();
    const data = new Uint8Array(buf);
    const name = file.name;
    const result = { file: name, size: data.length };
    
    // SHA-256
    const h = await crypto.subtle.digest('SHA-256', data);
    result.sha256 = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Get dimensions from image
    try {
        const img = await loadImage(file);
        result.image = { width: img.w, height: img.h, mode: 'RGBA', format: name.split('.').pop().toUpperCase() };
    } catch(e) {
        result.error = e.message;
        return result;
    }
    
    // Basic JPEG EXIF parsing
    if (data[0] === 0xFF && data[1] === 0xD8) {
        const exif = parseJPEGExif(data);
        if (exif && Object.keys(exif).length > 0) result.exif = exif;
    }
    
    return result;
}

// ── Simple JPEG EXIF parser ──
function parseJPEGExif(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const exif = {};
    let offset = 2;
    
    while (offset < data.length - 1) {
        if (view.getUint16(offset) === 0xFFE1) { // APP1 marker
            const segLen = view.getUint16(offset + 2);
            if (offset + 4 + segLen <= data.length) {
                const exifStart = offset + 4;
                const exifHeader = String.fromCharCode(...data.slice(exifStart, exifStart + 6));
                if (exifHeader === 'Exif\0\0') {
                    const tiffStart = exifStart + 6;
                    const endian = view.getUint16(tiffStart);
                    const littleEndian = endian === 0x4949;
                    const get16 = (off) => littleEndian ? view.getUint16(off, true) : view.getUint16(off, false);
                    const get32 = (off) => littleEndian ? view.getUint32(off, true) : view.getUint32(off, false);
                    
                    if (get16(tiffStart + 2) !== 0x002A) break;
                    const ifd0Off = get32(tiffStart + 4);
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

const EXIF_TAGS = {
    0x010F: 'Make', 0x0110: 'Model', 0x0132: 'DateTimeOriginal',
    0x010E: 'ImageDescription', 0x010F: 'Make', 0x0112: 'Orientation',
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
    const num = get16(tiffStart + offset);
    for (let i = 0; i < num; i++) {
        const entryOff = tiffStart + offset + 2 + i * 12;
        const tag = get16(entryOff);
        const type = get16(entryOff + 2);
        const count = get32(entryOff + 4);
        const valOff = entryOff + 8;
        
        let val;
        if (type === 2 && count <= 4) {
            val = String.fromCharCode(...data.slice(valOff, valOff + count - 1));
        } else if (type === 2) {
            const strOff = get32(valOff);
            if (strOff > 0 && strOff + count <= data.length)
                val = String.fromCharCode(...data.slice(tiffStart + strOff, tiffStart + strOff + count - 1));
        } else if (type === 3) {
            val = get16(valOff);
        } else if (type === 4) {
            val = get32(valOff);
        } else if (type === 5) {
            const numOff = get32(valOff);
            if (numOff + 8 <= data.length - tiffStart) {
                val = get32(tiffStart + numOff) / get32(tiffStart + numOff + 4);
            }
        } else if (type === 7) {
            val = data.slice(valOff, valOff + Math.min(count, 32));
        }
        
        if (val !== undefined && EXIF_TAGS[tag]) {
            let s = String(val);
            if (s.length > 200) s = s.substring(0, 197) + '...';
            exif[EXIF_TAGS[tag]] = s;
        }
    }
    
    // Check for next IFD
    const nextOff = get32(tiffStart + offset + 2 + num * 12);
    if (nextOff > 0) {
        parseIFD(tiffStart, nextOff, exif, get16, get32, view, data);
    }
}
