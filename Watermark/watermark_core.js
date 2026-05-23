(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Algorithm implementations (pure JS, no UI) ──

// ── RGB ↔ YCbCr ──
function rgbToYcbcr(imgData) {
    const { data, w, h } = imgData;
    const Y = new Float64Array(w * h), Cb = new Float64Array(w * h), Cr = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
        Y[i] = 0.299*r + 0.587*g + 0.114*b;
        Cb[i] = -0.1687*r - 0.3313*g + 0.5*b + 128;
        Cr[i] = 0.5*r - 0.4187*g - 0.0813*b + 128;
    }
    return { Y, Cb, Cr, w, h };
}
function ycbcrToImageData(Y, Cb, Cr, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
        const y = Y[i], cb = Cb[i] - 128, cr = Cr[i] - 128;
        imgData.data[i*4] = Math.max(0, Math.min(255, y + 1.402*cr));
        imgData.data[i*4+1] = Math.max(0, Math.min(255, y - 0.3441*cb - 0.7141*cr));
        imgData.data[i*4+2] = Math.max(0, Math.min(255, y + 1.772*cb));
        imgData.data[i*4+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return { canvas, ctx, imgData };
}

// ── DCT 8×8 ──
function dct8x8(block) {
    const r = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    for (let u = 0; u < 8; u++) {
        for (let v = 0; v < 8; v++) {
            let s = 0;
            for (let x = 0; x < 8; x++)
                for (let y = 0; y < 8; y++)
                    s += block[x][y] * Math.cos((2*x+1)*u*Math.PI/16) * Math.cos((2*y+1)*v*Math.PI/16);
            const cu = u === 0 ? 1/Math.SQRT2 : 1, cv = v === 0 ? 1/Math.SQRT2 : 1;
            r[u][v] = s * cu * cv * 0.25;
        }
    }
    return r;
}
function idct8x8(dct) {
    const r = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            let s = 0;
            for (let u = 0; u < 8; u++)
                for (let v = 0; v < 8; v++) {
                    const cu = u === 0 ? 1/Math.SQRT2 : 1, cv = v === 0 ? 1/Math.SQRT2 : 1;
                    s += cu * cv * dct[u][v] * Math.cos((2*x+1)*u*Math.PI/16) * Math.cos((2*y+1)*v*Math.PI/16);
                }
            r[x][y] = Math.max(0, Math.min(255, Math.round(s * 0.25)));
        }
    }
    return r;
}

// ── Block helpers ──
const MID = [[0,4],[1,3],[2,2],[3,1],[4,0],[0,5],[1,4],[2,3],[3,2],[4,1],[5,0]];
function blockIter(w, h, bsize) {
    const blocks = [];
    for (let y = 0; y < h - h % bsize; y += bsize)
        for (let x = 0; x < w - w % bsize; x += bsize)
            blocks.push([x, y]);
    return blocks;
}
function getBlock8(arr, w, x, y) {
    const b = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    for (let dy = 0; dy < 8; dy++)
        for (let dx = 0; dx < 8; dx++)
            b[dy][dx] = arr[(y+dy)*w + (x+dx)];
    return b;
}
function setBlock8(arr, w, x, y, block) {
    for (let dy = 0; dy < 8; dy++)
        for (let dx = 0; dx < 8; dx++)
            arr[(y+dy)*w + (x+dx)] = block[dy][dx];
}

// ── DCT embed/extract ──
function embedInDCT(Y, w, h, payloadBits, strength) {
    const blocks = blockIter(w, h, 8);
    let bidx = 0;
    for (const [bx, by] of blocks) {
        if (bidx >= payloadBits.length) break;
        const block = getBlock8(Y, w, bx, by);
        const dct = dct8x8(block);
        for (const [u, v] of MID) {
            if (bidx >= payloadBits.length) break;
            const bit = parseInt(payloadBits[bidx], 2);
            dct[u][v] = bit === 1 ? Math.abs(dct[u][v]) + strength : -Math.abs(dct[u][v]) - strength;
            bidx++;
        }
        const block2 = idct8x8(dct);
        setBlock8(Y, w, bx, by, block2);
    }
    return Y;
}
function extractFromDCT(Y, w, h, numBits) {
    const blocks = blockIter(w, h, 8);
    let result = '', bidx = 0;
    for (const [bx, by] of blocks) {
        if (bidx >= numBits) break;
        const block = getBlock8(Y, w, bx, by);
        const dct = dct8x8(block);
        for (const [u, v] of MID) {
            if (bidx >= numBits) break;
            result += dct[u][v] > 0 ? '1' : '0';
            bidx++;
        }
    }
    return result;
}
function maxDCTBits(w, h, bpb) {
    const cols = Math.floor(w / 8), rows = Math.floor(h / 8);
    return cols * rows * (bpb || 11);
}

const LSB_MAX_BITS = 100000;

// ── Algorithm 1: Spatial LSB ──
function wm1_embed(imgData, payloadBits) {
    const { data, w, h } = imgData;
    let idx = 0;
    for (let y = 0; y < h && idx < payloadBits.length; y++) {
        for (let x = 0; x < w && idx < payloadBits.length; x++) {
            const i = (y * w + x) * 4;
            if (idx < payloadBits.length) { data[i] = (data[i] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
            if (idx < payloadBits.length) { data[i+1] = (data[i+1] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
            if (idx < payloadBits.length) { data[i+2] = (data[i+2] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
        }
    }
    return imgData;
}
function wm1_extract(imgData) {
    const { data, w, h } = imgData;
    let b = '';
    const maxBits = Math.min(w * h * 3, LSB_MAX_BITS);
    for (let y = 0; y < h && b.length < maxBits; y++) {
        for (let x = 0; x < w && b.length < maxBits; x++) {
            const i = (y * w + x) * 4;
            b += (data[i] & 1) + '' + (data[i+1] & 1) + '' + (data[i+2] & 1);
            if (b.length >= 32) {
                const dlen = parseInt(b.substr(0, 32), 2);
                if (dlen > 0 && dlen < w * h * 3 / 8 && dlen < 100000 && b.length >= 32 + dlen * 8) break;
            }
        }
        if (b.length >= 32) {
            const dlen = parseInt(b.substr(0, 32), 2);
            if (dlen > 0 && dlen < 100000 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}

// ── Algorithm 3: Neural SS (seeded shuffle LSB) ──
function wm3_order(w, h, seed) {
    const order = Array.from({length: w * h}, (_, i) => i);
    return seededShuffle(order, seed);
}
function wm3_embed(imgData, payloadBits, seed) {
    const { data, w, h } = imgData;
    const order = wm3_order(w, h, seed);
    let idx = 0;
    for (const pi of order) {
        if (idx >= payloadBits.length) break;
        const i = pi * 4;
        if (idx < payloadBits.length) { data[i] = (data[i] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
        if (idx < payloadBits.length) { data[i+1] = (data[i+1] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
        if (idx < payloadBits.length) { data[i+2] = (data[i+2] & ~1) | parseInt(payloadBits[idx], 2); idx++; }
    }
    return imgData;
}
function wm3_extract(imgData, seed) {
    const { data, w, h } = imgData;
    const order = wm3_order(w, h, seed);
    let b = '';
    const maxBits = Math.min(w * h * 3, LSB_MAX_BITS);
    for (const pi of order) {
        if (b.length >= maxBits) break;
        const i = pi * 4;
        b += (data[i] & 1) + '' + (data[i+1] & 1) + '' + (data[i+2] & 1);
        if (b.length >= 32) {
            const dlen = parseInt(b.substr(0, 32), 2);
            if (dlen > 0 && dlen < w * h * 3 / 8 && dlen < 100000 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}

// ── Algorithm 6: Multi-bit (2-bit LSB) ──
function wm6_embed(imgData, payloadBits) {
    const { data, w, h } = imgData;
    let idx = 0;
    for (let y = 0; y < h && idx < payloadBits.length; y++) {
        for (let x = 0; x < w && idx < payloadBits.length; x++) {
            const i = (y * w + x) * 4;
            if (idx < payloadBits.length) {
                const b1 = parseInt(payloadBits[idx], 2), b2 = idx+1 < payloadBits.length ? parseInt(payloadBits[idx+1], 2) : 0;
                data[i] = (data[i] & ~3) | (b1 << 1 | b2); idx += 2;
            }
            if (idx < payloadBits.length) {
                const b1 = parseInt(payloadBits[idx], 2), b2 = idx+1 < payloadBits.length ? parseInt(payloadBits[idx+1], 2) : 0;
                data[i+1] = (data[i+1] & ~3) | (b1 << 1 | b2); idx += 2;
            }
            if (idx < payloadBits.length) {
                const b1 = parseInt(payloadBits[idx], 2), b2 = idx+1 < payloadBits.length ? parseInt(payloadBits[idx+1], 2) : 0;
                data[i+2] = (data[i+2] & ~3) | (b1 << 1 | b2); idx += 2;
            }
        }
    }
    return imgData;
}
function wm6_extract(imgData) {
    const { data, w, h } = imgData;
    let b = '';
    const maxBits = Math.min(w * h * 3, LSB_MAX_BITS);
    for (let y = 0; y < h && b.length < maxBits; y++) {
        for (let x = 0; x < w && b.length < maxBits; x++) {
            const i = (y * w + x) * 4;
            b += ((data[i] >> 1) & 1) + '' + (data[i] & 1);
            b += ((data[i+1] >> 1) & 1) + '' + (data[i+1] & 1);
            b += ((data[i+2] >> 1) & 1) + '' + (data[i+2] & 1);
            if (b.length >= 32) {
                const dlen = parseInt(b.substr(0, 32), 2);
                if (dlen > 0 && dlen < w * h * 3 / 4 && dlen < 100000 && b.length >= 32 + dlen * 8) break;
            }
        }
        if (b.length >= 32) {
            const dlen = parseInt(b.substr(0, 32), 2);
            if (dlen > 0 && dlen < 100000 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}

// ── Algorithm 8: Fragile (SHA-256 hash embed) ──
async function wm8_embed(imgData, secretData, key) {
    const hash = await sha256Hex(secretData);
    const hashBytes = new TextEncoder().encode(hash);
    let payload;
    if (key && key.length) {
        const raw = new Uint8Array(2 + hashBytes.length);
        raw.set([0xAA, 0xBB]); raw.set(hashBytes, 2);
        payload = xor_bytes(raw, key);
    } else {
        payload = hashBytes;
    }
    const b = bits(payload);
    return wm1_embed(imgData, b);
}
function wm8_extract(imgData, key) {
    const { data, w, h } = imgData;
    const neededBits = (key && key.length) ? 528 : 512;
    let b = '';
    for (let y = 0; y < h && b.length < neededBits; y++) {
        for (let x = 0; x < w && b.length < neededBits; x++) {
            const i = (y * w + x) * 4;
            b += (data[i] & 1) + '' + (data[i+1] & 1) + '' + (data[i+2] & 1);
        }
    }
    if (b.length < neededBits) return null;
    let dec = from_bits(b.substr(0, neededBits));
    if (key && key.length) {
        dec = xor_bytes(dec, key);
        if (dec.length >= 2 && dec[0] === 0xAA && dec[1] === 0xBB)
            return new TextDecoder().decode(dec.slice(2));
        return null;
    }
    const hash = new TextDecoder().decode(dec);
    if (/^[0-9a-f]{64}$/i.test(hash)) return hash;
    return null;
}
