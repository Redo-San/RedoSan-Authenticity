(function(){if(globalThis.window!==undefined&&globalThis.location&&globalThis.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(globalThis.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

// ── WAV I/O ──
/**
 *
 * @param buf
 */
function awReadWav(buf) {
    const v = new DataView(buf);
    if (String.fromCharCode(v.getUint8(0),v.getUint8(1),v.getUint8(2),v.getUint8(3))!=='RIFF')
        throw new Error('Not a RIFF file');
    if (String.fromCharCode(v.getUint8(8),v.getUint8(9),v.getUint8(10),v.getUint8(11))!=='WAVE')
        throw new Error('Not a WAVE file');
    let fmt = null, dataOff = 0, dataSize = 0;
    let off = 12;
    while (off < buf.byteLength) {
        const id = String.fromCharCode(v.getUint8(off),v.getUint8(off+1),v.getUint8(off+2),v.getUint8(off+3));
        const sz = v.getUint32(off+4, true);
        if (id === 'fmt ') {
            fmt = { fmt: v.getUint16(off+8, true), ch: v.getUint16(off+10, true),
                    sr: v.getUint32(off+12, true), br: v.getUint32(off+16, true),
                    ba: v.getUint16(off+20, true), bps: v.getUint16(off+22, true) };
        } else if (id === 'data') { dataOff = off + 8; dataSize = sz; }
        off += 8 + sz;
        if (sz % 2) off++;
    }
    if (!fmt) throw new Error('fmt chunk not found');
    if (!dataSize) throw new Error('data chunk not found');
    if (fmt.fmt !== 1 && fmt.fmt !== 0xFF_FE) throw new Error('Only PCM WAV supported');
    const totalSamples = Math.floor(dataSize / (fmt.bps / 8));
    const monoLen = Math.floor(totalSamples / fmt.ch);
    const m = new Int16Array(monoLen);
    for (let i = 0; i < monoLen; i++) m[i] = v.getInt16(dataOff + i * fmt.ch * 2, true);
    return { samples: m, sr: fmt.sr, ch: fmt.ch, bps: fmt.bps,
             raw: new Int16Array(totalSamples), rawOff: dataOff };
}
/**
 *
 * @param buf
 */
function awReadWavRaw(buf) {
    const r = awReadWav(buf);
    const v = new DataView(buf);
    for (let i = 0; i < r.raw.length; i++) r.raw[i] = v.getInt16(r.rawOff + i * 2, true);
    return r;
}
/**
 *
 * @param mono
 * @param sr
 * @param ch
 * @param rawData
 * @param bps
 */
function awWriteWav(mono, sr, ch, rawData, bps) {
    const bpsOut = 16, ba = ch * (bpsOut / 8);
    const isDual = Array.isArray(mono);
    const frames = isDual ? mono[0].length
        : Math.max(rawData ? Math.floor(rawData.length / ch) : mono.length, mono.length);
    const dataSize = frames * ba;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const w = (o,s) => { for (let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
    w(0,'RIFF'); v.setUint32(4,36+dataSize,true); w(8,'WAVE');
    w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22,ch,true); v.setUint32(24,sr,true);
    v.setUint32(28,sr*ba,true); v.setUint16(32,ba,true);
    v.setUint16(34,bpsOut,true); w(36,'data'); v.setUint32(40,dataSize,true);
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < ch; c++) {
            let val;
            if (isDual) {
                val = i < mono[c].length ? mono[c][i] : 0;
            } else {
                val = i < mono.length ? mono[i] : 0;
            }
            v.setInt16(44 + (i * ch + c) * 2, Math.max(-32_768, Math.min(32_767, val||0)), true);
        }
    }
    return buf;
}

/**
 *
 * @param buf
 */
function awReadRightChannel(buf) {
    const v = new DataView(buf);
    let off = 12, fmt = null, dataOff = 0, dataSize = 0;
    while (off < buf.byteLength) {
        const id = String.fromCharCode(v.getUint8(off),v.getUint8(off+1),v.getUint8(off+2),v.getUint8(off+3));
        const sz = v.getUint32(off+4, true);
        if (id === 'fmt ') { fmt = { ch: v.getUint16(off+10, true), bps: v.getUint16(off+22, true) }; }
        else if (id === 'data') { dataOff = off + 8; dataSize = sz; }
        off += 8 + sz; if (sz % 2) off++;
    }
    if (!fmt || fmt.ch < 2) return null;
    const totalSamples = Math.floor(dataSize / (fmt.bps / 8));
    const monoLen = Math.floor(totalSamples / fmt.ch);
    const r = new Int16Array(monoLen);
    for (let i = 0; i < monoLen; i++) r[i] = v.getInt16(dataOff + (i * fmt.ch + 1) * 2, true);
    return r;
}
/**
 *
 * @param file
 */
async function awLoadAudio(file) {
    const buf = await file.arrayBuffer();
    const h = new Uint8Array(buf, 0, 4);
    if (h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x46) return awReadWavRaw(buf);
    const ctx = new (globalThis.AudioContext||globalThis.webkitAudioContext)();
    const ab = await ctx.decodeAudioData(buf);
    const ch0 = ab.getChannelData(0);
    const s = new Int16Array(ch0.length);
    for (const [i, element] of ch0.entries()) {
        const v = Math.max(-1, Math.min(1, element));
        s[i] = v < 0 ? Math.round(v * 32_768) : Math.round(v * 32_767);
    }
    ctx.close();
    return { samples: s, sr: ab.sampleRate, ch: ab.numberOfChannels, bps: 16, raw: null };
}

// ── FFT (radix-2, in-place) ──
/**
 *
 * @param re
 * @param im
 */
function awFft(re, im) {
    const n = re.length;
    if (n < 2) return;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
        let k = n >> 1;
        while (k) {
            if (!(k & j)) break;
            j ^= k;
            k >>= 1;
        }
        j |= k;
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = 2 * Math.PI / len;
        const wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let tr = 1, ti = 0;
            const half = len >> 1;
            for (let j = 0; j < half; j++) {
                const ur = re[i+j], ui = im[i+j];
                const vr = re[i+j+half]*tr - im[i+j+half]*ti;
                const vi = re[i+j+half]*ti + im[i+j+half]*tr;
                re[i+j] = ur + vr; im[i+j] = ui + vi;
                re[i+j+half] = ur - vr; im[i+j+half] = ui - vi;
                const ntr = tr*wr - ti*wi;
                ti = tr*wi + ti*wr; tr = ntr;
            }
        }
    }
}
/**
 *
 * @param re
 * @param im
 */
function awIfft(re, im) {
    const n = re.length;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    awFft(re, im);
    for (let i = 0; i < n; i++) { im[i] = -im[i]; re[i] /= n; im[i] /= n; }
}

// ── Payload helpers ──
/**
 *
 * @param secretBytes
 * @param key
 */
function awFormatPayload(secretBytes, key) {
    const marker = new Uint8Array([0xAA, 0xBB]);
    const raw = new Uint8Array(2 + secretBytes.length);
    raw.set(marker, 0); raw.set(secretBytes, 2);
    const encrypted = xor_bytes(raw, key);
    const lenBytes = new Uint8Array(4);
    lenBytes[0] = (encrypted.length >> 24) & 0xFF;
    lenBytes[1] = (encrypted.length >> 16) & 0xFF;
    lenBytes[2] = (encrypted.length >> 8) & 0xFF;
    lenBytes[3] = encrypted.length & 0xFF;
    const full = new Uint8Array(4 + encrypted.length);
    full.set(lenBytes, 0); full.set(encrypted, 4);
    return bits(full);
}
/**
 *
 * @param bitsStr
 * @param key
 */
function awExtractPayload(bitsStr, key) {
    if (typeof bitsStr !== 'string' || bitsStr.length < 32) return null;
    const dlen = Number.parseInt(bitsStr.substring(0, 32), 2);
    if (!dlen || dlen < 2 || dlen > 100_000 || bitsStr.length < 32 + dlen * 8) return null;
    const data = from_bits(bitsStr.substring(0, 32 + dlen * 8));
    const enc = data.slice(4);
    const dec = xor_bytes(enc, key);
    if (dec.length < 2 || dec[0] !== 0xAA || dec[1] !== 0xBB) return 'bad-password';
    return dec.slice(2);
}

// ── Algorithm 1: LSB Audio ──
/**
 *
 * @param s16
 * @param bitsStr
 */
function aw1_embed(s16, bitsStr) {
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++) s16[i] = (s16[i] & ~1) | (bitsStr[i] === '1' ? 1 : 0);
    return s16;
}
/**
 *
 * @param s16
 * @param maxBits
 */
function aw1_extract(s16, maxBits) {
    const limit = Math.min(s16.length, maxBits || s16.length * 8, 400_032);
    const out = new Array(limit);
    let needed = 0;
    for (let i = 0; i < limit; i++) {
        out[i] = s16[i] & 1;
        if (needed) { if (i + 1 >= needed) break; continue; }
        if (i < 31) continue;
        let h = '';
        for (let k = 0; k < 32; k++) h += out[k];
        const dlen = Number.parseInt(h, 2);
        if (dlen > 0 && dlen < 50_000) needed = 32 + dlen * 8;
    }
    const end = needed || limit;
    return end === limit ? out.join('') : out.slice(0, end).join('');
}

// ── Algorithm 2: FFT-QIM (Frequency-domain magnitude QIM, replaces broken Phase Coding) ──
// QIM on FFT magnitude coefficients in mid-frequency band, non-overlapping frames
var AWM2_FRAME = 2048;
var AWM2_REPS = 5;
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw2_embed(s16, bitsStr, sr) {
    const F = AWM2_FRAME, REPS = AWM2_REPS;
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const LO = Math.floor(F * 0.1), HI = Math.floor(F * 0.3);
    const usableBins = HI - LO;
    const binsPerBit = Math.min(REPS, usableBins);
    const S = 800;
    for (let f = 0; f < effectiveBits; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = s16[off + i];
        awFft(re, im);
        const bit = bitsStr[f];
        const binStart = LO + (f * binsPerBit) % (usableBins - binsPerBit);
        for (let r = 0; r < binsPerBit; r++) {
            const bin = binStart + r;
            const mag = Math.hypot(re[bin], im[bin]);
            let q = Math.round(mag / S);
            if ((bit === '0' && (q & 1) !== 0) || (bit === '1' && (q & 1) === 0)) q += q >= 0 ? 1 : -1;
            const newMag = Math.max(0, q * S);
            if (mag > 0.001) { const s = newMag / mag; re[bin] *= s; im[bin] *= s; }
            const mirror = F - bin;
            re[mirror] = re[bin]; im[mirror] = -im[bin];
        }
        awIfft(re, im);
        for (let i = 0; i < F; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(re[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw2_extract(s16, sr, numBits) {
    const F = AWM2_FRAME, REPS = AWM2_REPS;
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const LO = Math.floor(F * 0.1), HI = Math.floor(F * 0.3);
    const usableBins = HI - LO;
    const binsPerBit = Math.min(REPS, usableBins);
    const S = 800;
    let b = '';
    for (let f = 0; f < maxBits; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = s16[off + i];
        awFft(re, im);
        const binStart = LO + (f * binsPerBit) % (usableBins - binsPerBit);
        let ones = 0;
        for (let r = 0; r < binsPerBit; r++) {
            const bin = binStart + r;
            const mag = Math.hypot(re[bin], im[bin]);
            const q = Math.round(mag / S);
            if (q & 1) ones++;
        }
        b += ones > binsPerBit / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw2_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM2_FRAME);
}

// ── Algorithm 3: Echo Hiding ──
// Based on tam17aki implementation: echo at d0/d1, control_strength=0.2, overlap-add
var AWM3_FRAME = 4096;
var AWM3_CHIPS = 32;
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw3_embed(s16, bitsStr, sr) {
    const F = AWM3_FRAME, CHIPS = AWM3_CHIPS;
    const S = Math.round((sr || 44_100) / 100);
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const LO = Math.floor(F * 0.08), HI = Math.floor(F * 0.25);
    const step = Math.max(1, Math.floor((HI - LO - CHIPS) / Math.max(1, totalFrames)));
    for (let f = 0; f < effectiveBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const bit = bitsStr[f];
        const chipStart = LO + (f * step) % (HI - LO - CHIPS);
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            let q = Math.round(dct[idx] / S);
            if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
            else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
            dct[idx] = q * S;
        }
        const reconstructed = awIdct(dct);
        for (let i = 0; i < F; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(reconstructed[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw3_extract(s16, sr, numBits) {
    const F = AWM3_FRAME, CHIPS = AWM3_CHIPS;
    const S = Math.round((sr || 44_100) / 100);
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const LO = Math.floor(F * 0.08), HI = Math.floor(F * 0.25);
    const step = Math.max(1, Math.floor((HI - LO - CHIPS) / Math.max(1, totalFrames)));
    let b = '';
    for (let f = 0; f < maxBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const chipStart = LO + (f * step) % (HI - LO - CHIPS);
        let ones = 0;
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            const q = Math.round(dct[idx] / S);
            if (q & 1) ones++;
        }
        b += ones > CHIPS / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw3_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM3_FRAME);
}

// ── Algorithm 4: Spread Spectrum (DSSS) ──
// Fixed PN sequence and chips per bit for consistent embed/extract
var AWM4_FRAME = 2048;
var AWM4_CHIPS = 256;
/**
 *
 * @param seed
 * @param len
 */
function aw4_pn(seed, len) {
    const pn = new Float64Array(len);
    let s = seed >>> 0;
    for (let i = 0; i < len; i++) {
        s = (s * 16_807) % 2_147_483_647;
        pn[i] = (s & 1) === 0 ? -1 : 1;
    }
    let sum = 0;
    for (let i = 0; i < len; i++) sum += pn[i];
    if (sum !== 0) {
        const half = len >>> 1;
        for (let i = 0; i < half; i++) pn[i] = 1;
        for (let i = half; i < len; i++) pn[i] = -1;
        for (let i = len - 1; i > 0; i--) {
            const j = s % (i + 1);
            s = (s * 16_807) % 2_147_483_647;
            const t = pn[i]; pn[i] = pn[j]; pn[j] = t;
        }
    }
    return pn;
}
// Non-overlap DSSS: one FFT frame = one bit, using a balanced PN sequence.
// Uses log-magnitude for robust detection on real audio.
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw4_embed(s16, bitsStr, sr) {
    const F = AWM4_FRAME, CHIPS = AWM4_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const lo = 50, hi = (F >> 1) - 20;
    const cap = Math.min(CHIPS, hi - lo);
    const PN = aw4_pn(12_345, CHIPS);
    const strength = Math.max(30, Math.min(1200, Math.round((sr || 44_100) / 60)));
    const step = Math.max(1, Math.floor((hi - lo - cap) / Math.max(1, totalFrames)));
    for (let f = 0; f < effectiveBits; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = s16[off + i];
        awFft(re, im);
        const bit = bitsStr[f];
        const chipStart = lo + f * step;
        for (let c = 0; c < cap; c++) {
            const bin = chipStart + c;
            const mag = Math.hypot(re[bin], im[bin]);
            const newMag = Math.max(mag * 0.3, Math.min(mag * 3, mag + (bit === '1' ? 1 : -1) * PN[c] * strength));
            const scale = newMag / (mag + 0.001);
            re[bin] *= scale; im[bin] *= scale;
            const mirror = F - bin;
            re[mirror] = re[bin]; im[mirror] = -im[bin];
        }
        awIfft(re, im);
        for (let i = 0; i < F; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(re[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw4_extract(s16, sr, numBits) {
    const F = AWM4_FRAME, CHIPS = AWM4_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const lo = 50, hi = (F >> 1) - 20;
    const cap = Math.min(CHIPS, hi - lo);
    const PN = aw4_pn(12_345, CHIPS);
    const step = Math.max(1, Math.floor((hi - lo - cap) / Math.max(1, totalFrames)));
    let b = '';
    for (let f = 0; f < maxBits; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = s16[off + i];
        awFft(re, im);
        const chipStart = lo + f * step;
        let sumLog = 0;
        for (let c = 0; c < cap; c++) { const bin = chipStart + c; sumLog += Math.log(1 + Math.hypot(re[bin], im[bin])); }
        const avgLog = sumLog / cap;
        let corr = 0;
        for (let c = 0; c < cap; c++) {
            const bin = chipStart + c;
            corr += (Math.log(1 + Math.hypot(re[bin], im[bin])) - avgLog) * PN[c];
        }
        b += corr > 0 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw4_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM4_FRAME);
}

// ── Algorithm 5: QIM (sample-domain quantization index modulation) ──
// One sample = one bit; S is derived from sample rate.
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw5_embed(s16, bitsStr, sr) {
    const S = Math.round((sr || 44_100) / 100);
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++) {
        const x = s16[i];
        let q = Math.round(x / S);
        if (bitsStr[i] === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
        else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
        s16[i] = Math.max(-32_768, Math.min(32_767, q * S));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw5_extract(s16, sr, numBits) {
    const S = Math.round((sr || 44_100) / 100);
    const maxScan = Math.min(s16.length, numBits || s16.length, 100_000);
    let b = '', h32 = '';
    for (let i = 0; i < maxScan; i++) {
        const bit = (Math.round(s16[i] / S) & 1) === 0 ? '0' : '1';
        b += bit;
        if (i < 32) h32 += bit;
        if (b.length === 32) {
            const dlen = Number.parseInt(h32, 2);
            if (dlen > 0 && dlen < 500) break;
        }
    }
    if (b.length >= 32) {
        const dlen = Number.parseInt(h32, 2);
        if (dlen > 0 && dlen < 500) {
            const need = 32 + dlen * 8;
            if (b.length < need) {
                for (let i = b.length; i < Math.min(maxScan, need); i++) {
                    const bit = (Math.round(s16[i] / S) & 1) === 0 ? '0' : '1';
                    b += bit;
                }
            }
        }
    }
    return b;
}

// ── Algorithm 6: DWT (Haar Wavelet) ──
// Haar DWT on segments, QIM on detail coefficients
/**
 *
 * @param signal
 */
function awHaarFwd(signal) {
    const n = signal.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = signal[i];
    let h = n;
    while (h > 1) {
        h >>= 1;
        const snap = [...out];
        for (let i = 0; i < h; i++) {
            const a = snap[i * 2], b = snap[i * 2 + 1];
            out[i] = (a + b) / 2;
            out[i + h] = (a - b) / 2;
        }
    }
    return out;
}
/**
 *
 * @param coeff
 * @param origLen
 */
function awHaarInv(coeff, origLen) {
    const n = coeff.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = coeff[i];
    let h = 1;
    while (h < n) {
        const snap = [...out];
        for (let i = 0; i < h; i++) {
            const avg = snap[i], diff = snap[i + h];
            out[i * 2] = avg + diff;
            out[i * 2 + 1] = avg - diff;
        }
        h <<= 1;
    }
    return out;
}
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw6_embed(s16, bitsStr, sr) {
    const S = Math.max(30, Math.min(150, Math.round((sr || 44_100) / 400)));
    const SEG = 1024;
    const segs = Math.min(Math.floor(s16.length / SEG), bitsStr.length);
    for (let seg = 0; seg < segs; seg++) {
        const off = seg * SEG;
        const coeff = awHaarFwd(s16.subarray(off, off + SEG));
        const bit = bitsStr[seg];
        const startIdx = SEG >> 1;
        const endIdx = startIdx + 64;
        for (let j = startIdx; j < endIdx; j++) {
            let q = Math.round(coeff[j] / S);
            if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
            else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
            coeff[j] = q * S;
        }
        const reconstructed = awHaarInv(coeff, SEG);
        for (let i = 0; i < SEG; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(reconstructed[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw6_extract(s16, sr, numBits) {
    const S = Math.max(30, Math.min(150, Math.round((sr || 44_100) / 400)));
    const SEG = 1024;
    const maxSegs = Math.min(Math.floor(s16.length / SEG), numBits || 1000, 5000);
    let b = '';
    for (let seg = 0; seg < maxSegs; seg++) {
        const off = seg * SEG;
        const coeff = awHaarFwd(s16.subarray(off, off + SEG));
        const startIdx = SEG >> 1;
        const endIdx = startIdx + 64;
        let sum = 0;
        for (let j = startIdx; j < endIdx; j++) {
            const q = Math.round(coeff[j] / S);
            sum += (q & 1);
        }
        b += sum > 31 ? '1' : '0';
        if (b.length === 32) {
            const dlen = Number.parseInt(b, 2);
            if (dlen > 0 && dlen < 500) break;
        }
    }
    if (b.length >= 32) {
        const dlen = Number.parseInt(b.substring(0, 32), 2);
        if (dlen > 0 && dlen < 500) {
            const need = 32 + dlen * 8;
            if (b.length < need) {
                for (let seg = b.length; seg < Math.min(maxSegs, need); seg++) {
                    const off = seg * SEG;
                    const coeff = awHaarFwd(s16.subarray(off, off + SEG));
                    const startIdx = SEG >> 1;
                    const endIdx = startIdx + 64;
                    let sum = 0;
                    for (let j = startIdx; j < endIdx; j++) {
                        const q = Math.round(coeff[j] / S);
                        sum += (q & 1);
                    }
                    b += sum > 31 ? '1' : '0';
                }
            }
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw6_maxBits(audioLen, sr) {
    return Math.floor(audioLen / 1024);
}

// ── DCT helpers (Type-II/III, orthogonal, precomputed matrix) ──
var _awDctCos = null;
/**
 *
 * @param N
 */
function awDctInit(N) {
    if (_awDctCos && _awDctCos.N === N) return;
    const T = new Float64Array(N * N);
    for (let k = 0; k < N; k++)
        for (let n = 0; n < N; n++)
            T[k * N + n] = Math.cos(Math.PI * k * (n + 0.5) / N);
    _awDctCos = { N, T, scale0: 1 / Math.sqrt(N), scale: Math.sqrt(2 / N) };
}
/**
 *
 * @param signal
 */
function awDct(signal) {
    const N = signal.length;
    const half = N >> 1;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < half; i++) {
        re[i] = signal[2 * i];
        re[N - 1 - i] = signal[2 * i + 1];
    }
    awFft(re, im);
    const X = new Float64Array(N);
    const scale0 = 1 / Math.sqrt(N), scale = Math.sqrt(2 / N);
    for (let k = 0; k < N; k++) {
        const theta = Math.PI * k / (2 * N);
        X[k] = (re[k] * Math.cos(theta) - im[k] * Math.sin(theta)) * (k === 0 ? scale0 : scale);
    }
    return X;
}
/**
 *
 * @param X
 */
function awIdct(X) {
    const N = X.length;
    awDctInit(N);
    const { T, scale0, scale } = _awDctCos;
    const x = new Float64Array(N);
    for (let n = 0; n < N; n++) {
        let sum = X[0] * scale0;
        for (let k = 1; k < N; k++) sum += X[k] * scale * T[k * N + n];
        x[n] = sum;
    }
    return x;
}

// ── Algorithm 7: DCT-domain QIM ──
// Similar to aw8 but with different frame size and chip count.
var AWM7_FRAME = 512;
var AWM7_CHIPS = 5;
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw7_embed(s16, bitsStr, sr) {
    const S = Math.round((sr || 44_100) / 80);
    const F = AWM7_FRAME, CHIPS = AWM7_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const LO = Math.floor(F * 0.1), HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    for (let f = 0; f < effectiveBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const bit = bitsStr[f];
        const chipStart = LO + (f * step) % (usable - CHIPS);
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            let q = Math.round(dct[idx] / S);
            if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
            else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
            dct[idx] = q * S;
        }
        const reconstructed = awIdct(dct);
        for (let i = 0; i < F; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(reconstructed[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw7_extract(s16, sr, numBits) {
    const S = Math.round((sr || 44_100) / 80);
    const F = AWM7_FRAME, CHIPS = AWM7_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const LO = Math.floor(F * 0.1), HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    let b = '';
    for (let f = 0; f < maxBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const chipStart = LO + (f * step) % (usable - CHIPS);
        let ones = 0;
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            const q = Math.round(dct[idx] / S);
            if (q & 1) ones++;
        }
        b += ones > CHIPS / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw7_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM7_FRAME);
}

// ── Algorithm 8: DCT-based (DCT domain, QIM on mid-frequency coefficients, non-overlapping) ──
var AWM8_FRAME = 1024;
var AWM8_CHIPS = 5;
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 */
function aw8_embed(s16, bitsStr, sr) {
    const S = Math.round((sr || 44_100) / 60);
    const F = AWM8_FRAME, CHIPS = AWM8_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const LO = Math.floor(F * 0.1);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    for (let f = 0; f < effectiveBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const bit = bitsStr[f];
        const chipStart = LO + (f * step) % (usable - CHIPS);
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            let q = Math.round(dct[idx] / S);
            if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
            else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
            dct[idx] = q * S;
        }
        const reconstructed = awIdct(dct);
        for (let i = 0; i < F; i++)
            s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(reconstructed[i])));
    }
    return s16;
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 */
function aw8_extract(s16, sr, numBits) {
    const S = Math.round((sr || 44_100) / 60);
    const F = AWM8_FRAME, CHIPS = AWM8_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const LO = Math.floor(F * 0.1);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    let b = '';
    for (let f = 0; f < maxBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const chipStart = LO + (f * step) % (usable - CHIPS);
        let ones = 0;
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            const q = Math.round(dct[idx] / S);
            if (q & 1) ones++;
        }
        b += ones > CHIPS / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
/**
 *
 * @param audioLen
 * @param sr
 */
function aw8_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM8_FRAME);
}
/**
 *
 * @param s16
 * @param bitsStr
 * @param sr
 * @param onProgress
 */
function aw8_embed_async(s16, bitsStr, sr, onProgress) {
    const S = Math.round((sr || 44_100) / 60);
    const F = AWM8_FRAME, CHIPS = AWM8_CHIPS;
    const totalFrames = Math.floor(s16.length / F);
    const effectiveBits = Math.min(bitsStr.length, totalFrames);
    const LO = Math.floor(F * 0.1);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    const BATCH = 8;
    return new Promise(function(resolve) {
        var pos = 0;
        /**
         *
         */
        function processBatch() {
            var until = Math.min(pos + BATCH, effectiveBits);
            for (var f = pos; f < until; f++) {
                var off = f * F;
                var frame = new Float64Array(F);
                for (var i = 0; i < F; i++) frame[i] = s16[off + i];
                var dct = awDct(frame);
                var bit = bitsStr[f];
                var chipStart = LO + (f * step) % (usable - CHIPS);
                for (var c = 0; c < CHIPS; c++) {
                    var idx = chipStart + c;
                    var q = Math.round(dct[idx] / S);
                    if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
                    else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
                    dct[idx] = q * S;
                }
                var reconstructed = awIdct(dct);
                for (var i = 0; i < F; i++)
                    s16[off + i] = Math.max(-32_768, Math.min(32_767, Math.round(reconstructed[i])));
            }
            pos = until;
            if (onProgress) onProgress(Math.min(1, pos / effectiveBits));
            if (pos >= effectiveBits) { resolve(s16); return; }
            requestAnimationFrame(processBatch);
        }
        requestAnimationFrame(processBatch);
    });
}
/**
 *
 * @param s16
 * @param sr
 * @param numBits
 * @param onProgress
 */
function aw8_extract_async(s16, sr, numBits, onProgress) {
    const S = Math.round((sr || 44_100) / 60);
    const F = AWM8_FRAME, CHIPS = AWM8_CHIPS;
    const LO = Math.floor(F * 0.1);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const totalFrames = Math.floor(s16.length / F);
    const maxBits = Math.min(numBits || totalFrames, totalFrames);
    const limitBits = Math.min(maxBits, 5000);
    const step = Math.max(1, Math.floor((usable - CHIPS) / Math.max(1, totalFrames)));
    if (onProgress) onProgress(0);
    let b = '';
    for (let f = 0; f < limitBits; f++) {
        const off = f * F;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const chipStart = LO + (f * step) % (usable - CHIPS);
        let ones = 0;
        for (let c = 0; c < CHIPS; c++) {
            const idx = chipStart + c;
            const q = Math.round(dct[idx] / S);
            if (q & 1) ones++;
        }
        b += ones > CHIPS / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = Number.parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    if (onProgress) onProgress(1);
    return Promise.resolve(b);
}
