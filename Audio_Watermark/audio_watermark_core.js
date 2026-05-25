(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

// ── WAV I/O ──
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
    if (fmt.fmt !== 1 && fmt.fmt !== 0xFFFE) throw new Error('Only PCM WAV supported');
    const totalSamples = Math.floor(dataSize / (fmt.bps / 8));
    const monoLen = Math.floor(totalSamples / fmt.ch);
    const m = new Int16Array(monoLen);
    for (let i = 0; i < monoLen; i++) m[i] = v.getInt16(dataOff + i * fmt.ch * 2, true);
    return { samples: m, sr: fmt.sr, ch: fmt.ch, bps: fmt.bps,
             raw: new Int16Array(totalSamples), rawOff: dataOff };
}
function awReadWavRaw(buf) {
    const r = awReadWav(buf);
    const v = new DataView(buf);
    for (let i = 0; i < r.raw.length; i++) r.raw[i] = v.getInt16(r.rawOff + i * 2, true);
    return r;
}
function awWriteWav(mono, sr, ch, rawData, bps) {
    const bpsOut = 16, ba = ch * (bpsOut / 8);
    const frames = Math.max(rawData ? Math.floor(rawData.length / ch) : mono.length, mono.length);
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
            if (c === 0 && i < mono.length) val = mono[i];
            else if (rawData && i * ch + c < rawData.length) val = rawData[i * ch + c];
            else if (i < mono.length) val = mono[i];
            else val = 0;
            v.setInt16(44 + (i * ch + c) * 2, Math.max(-32768, Math.min(32767, val||0)), true);
        }
    }
    return buf;
}
async function awLoadAudio(file) {
    const buf = await file.arrayBuffer();
    const h = new Uint8Array(buf, 0, 4);
    if (h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x46) return awReadWavRaw(buf);
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const ab = await ctx.decodeAudioData(buf);
    const ch0 = ab.getChannelData(0);
    const s = new Int16Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
        const v = Math.max(-1, Math.min(1, ch0[i]));
        s[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
    }
    ctx.close();
    return { samples: s, sr: ab.sampleRate, ch: ab.numberOfChannels, bps: 16, raw: null };
}

// ── FFT (radix-2, in-place) ──
function awFft(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
        let k = n >> 1;
        while (k <= j) { j -= k; k >>= 1; }
        j += k;
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
function awIfft(re, im) {
    const n = re.length;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    awFft(re, im);
    for (let i = 0; i < n; i++) { im[i] = -im[i]; re[i] /= n; im[i] /= n; }
}

// ── Payload helpers ──
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
function awExtractPayload(bitsStr, key) {
    if (bitsStr.length < 32) return null;
    const dlen = parseInt(bitsStr.substring(0, 32), 2);
    if (!dlen || dlen < 2 || dlen > 100000 || bitsStr.length < 32 + dlen * 8) return null;
    const data = from_bits(bitsStr.substring(0, 32 + dlen * 8));
    const enc = data.slice(4);
    const dec = xor_bytes(enc, key);
    if (dec.length < 2 || dec[0] !== 0xAA || dec[1] !== 0xBB) return 'bad-password';
    return dec.slice(2);
}

// ── Algorithm 1: LSB Audio ──
function aw1_embed(s16, bitsStr) {
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++) s16[i] = (s16[i] & ~1) | (bitsStr[i] === '1' ? 1 : 0);
    return s16;
}
function aw1_extract(s16, maxBits) {
    let b = '';
    const limit = Math.min(s16.length, maxBits || s16.length * 8);
    for (let i = 0; i < limit; i++) {
        b += s16[i] & 1;
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 50000 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}

// ── Algorithm 2: Phase Coding ──
// Improved Phase Coding (arxiv 2408.13277): embed bits in mid-frequency FFT phase bins
function aw2_embed(s16, bitsStr, sr) {
    const msgLen = bitsStr.length;
    const segLen = 2 * Math.pow(2, Math.ceil(Math.log2(2 * Math.max(msgLen, 8))));
    const segNum = Math.ceil(s16.length / segLen);
    const padded = new Int16Array(segNum * segLen);
    padded.set(s16, 0);
    const half = segLen >> 1;
    for (let s = 0; s < segNum; s++) {
        const off = s * segLen;
        const re = new Float64Array(segLen);
        const im = new Float64Array(segLen);
        for (let i = 0; i < segLen; i++) { re[i] = padded[off + i]; im[i] = 0; }
        awFft(re, im);
        const start = Math.floor(s * msgLen / segNum);
        const end = Math.floor((s + 1) * msgLen / segNum);
        const count = end - start;
        for (let j = 0; j < count && start + j < msgLen; j++) {
            const bin = half - count + j;
            if (bin >= 0 && bin < half) {
                const phase = bitsStr[start + j] === '1' ? Math.PI / 2 : -Math.PI / 2;
                const mag = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
                re[bin] = mag * Math.cos(phase);
                im[bin] = mag * Math.sin(phase);
                const mirror = segLen - bin;
                re[mirror] = mag * Math.cos(-phase);
                im[mirror] = mag * Math.sin(-phase);
            }
        }
        awIfft(re, im);
        for (let i = 0; i < segLen; i++) {
            padded[off + i] = Math.max(-32768, Math.min(32767, Math.round(re[i])));
        }
    }
    s16.set(padded.subarray(0, s16.length), 0);
    return s16;
}
function aw2_extract(s16, sr, numBits) {
    const msgLen = numBits || 1000;
    const segLen = 2 * Math.pow(2, Math.ceil(Math.log2(2 * Math.max(msgLen, 8))));
    const segNum = Math.ceil(s16.length / segLen);
    let b = '';
    for (let s = 0; s < segNum; s++) {
        const off = s * segLen;
        const re = new Float64Array(segLen);
        const im = new Float64Array(segLen);
        for (let i = 0; i < segLen && off + i < s16.length; i++) { re[i] = s16[off + i]; im[i] = 0; }
        awFft(re, im);
        const half = segLen >> 1;
        const start = Math.floor(s * msgLen / segNum);
        const end = Math.floor((s + 1) * msgLen / segNum);
        const count = end - start;
        for (let j = 0; j < count && start + j < msgLen; j++) {
            const bin = half - count + j;
            if (bin >= 0 && bin < half) {
                const phase = Math.atan2(im[bin], re[bin]);
                b += phase >= 0 ? '1' : '0';
            }
        }
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw2_maxBits(audioLen, sr) { return Math.floor(audioLen / 2); }

// ── Algorithm 3: Echo Hiding ──
// Based on tam17aki implementation: echo at d0/d1, control_strength=0.2, overlap-add
const AWM3_FRAME = 4096;
const AWM3_STRENGTH = 0.2;
const AWM3_REPS = 3;
function aw3_embed(s16, bitsStr, sr) {
    const d0 = Math.max(50, Math.round(2.5 * sr / 1000));
    const d1 = Math.max(60, Math.round(4.5 * sr / 1000));
    const F = AWM3_FRAME, SHIFT = F >> 1, REPS = AWM3_REPS;
    const totalFrames = Math.floor((s16.length - F) / SHIFT) + 1;
    const bitsPerFrame = Math.min(Math.floor(totalFrames / REPS), Math.ceil(bitsStr.length / REPS) * REPS);
    const effectiveBits = Math.min(bitsStr.length, Math.floor(totalFrames / REPS));
    const result = new Float64Array(s16.length);
    const window = new Float64Array(F);
    for (let i = 0; i < F; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (F - 1)));
    for (let f = 0; f < effectiveBits * REPS && f < totalFrames; f++) {
        const bitIdx = Math.floor(f / REPS);
        const bit = bitsStr[bitIdx] || '0';
        const delay = bit === '0' ? d0 : d1;
        const off = f * SHIFT;
        const frame = new Float64Array(F);
        for (let i = 0; i < F; i++) frame[i] = s16[off + i] / 32768;
        const echoed = new Float64Array(F);
        for (let i = 0; i < F; i++) {
            if (i >= delay) echoed[i] = frame[i] + AWM3_STRENGTH * frame[i - delay];
            else echoed[i] = frame[i];
        }
        for (let i = 0; i < F; i++) result[off + i] += echoed[i] * window[i];
    }
    for (let i = 0; i < s16.length; i++)
        s16[i] = Math.max(-32768, Math.min(32767, Math.round(result[i] * 32768)));
    return s16;
}
function aw3_extract(s16, sr, numBits) {
    const d0 = Math.max(50, Math.round(2.5 * sr / 1000));
    const d1 = Math.max(60, Math.round(4.5 * sr / 1000));
    const F = AWM3_FRAME, SHIFT = F >> 1, REPS = AWM3_REPS;
    const totalFrames = Math.floor((s16.length - F) / SHIFT) + 1;
    const maxPossible = Math.floor(totalFrames / REPS);
    const maxDetectBits = Math.min(numBits || maxPossible, maxPossible);
    const votes = [];
    for (let f = 0; f < totalFrames && votes.length < maxDetectBits * REPS; f++) {
        const off = f * SHIFT;
        const re = new Float64Array(F);
        const im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = s16[off + i];
        awFft(re, im);
        for (let i = 0; i < F; i++) {
            const mag = re[i]*re[i] + im[i]*im[i];
            re[i] = Math.log(1 + mag);
            im[i] = 0;
        }
        awIfft(re, im);
        const c0 = Math.abs(re[d0]);
        const c1 = Math.abs(re[d1]);
        votes.push(c0 > c1 ? '0' : '1');
    }
    let b = '';
    for (let i = 0; i < votes.length; i += REPS) {
        const chunk = votes.slice(i, i + REPS);
        const zeros = chunk.filter(x => x === '0').length;
        b += zeros >= Math.ceil(REPS / 2) ? '0' : '1';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw3_maxBits(audioLen, sr) {
    const F = AWM3_FRAME, SHIFT = F >> 1, REPS = AWM3_REPS;
    const totalFrames = Math.floor((audioLen - F) / SHIFT) + 1;
    return Math.floor(totalFrames / REPS);
}

// ── Algorithm 4: Spread Spectrum ──
// Based on dmeldrum6 approach: FFT-domain PN sequence modulation, 500-8000Hz band
const AWM4_FRAME = 2048;
function aw4_pn(seed, len) {
    const pn = new Float64Array(len);
    let s = seed >>> 0;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) >>> 0; pn[i] = (s & 1) === 0 ? -1 : 1; }
    return pn;
}
function aw4_embed(s16, bitsStr, sr, seed) {
    const F = AWM4_FRAME, SHIFT = F >> 1;
    const srVal = sr || 44100;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const bitsPerFrame = Math.ceil(bitsStr.length / totalFrames);
    const pnLen = Math.min(bitsPerFrame * 4, F >> 2);
    const pn = aw4_pn(seed || 12345, pnLen);
    const lo = Math.max(2, Math.floor(500 * F / srVal));
    const hi = Math.min((F >> 1) - 1, Math.ceil(8000 * F / srVal));
    const usable = hi - lo;
    const chipsPerBit = Math.max(1, Math.floor(usable / bitsPerFrame));
    const strength = 0.03;
    const result = new Float64Array(s16.length);
    const window = new Float64Array(F);
    for (let i = 0; i < F; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (F - 1)));
    for (let f = 0; f < totalFrames; f++) {
        const off = f * SHIFT;
        const re = new Float64Array(F);
        const im = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) re[i] = s16[off + i];
        awFft(re, im);
        const startBit = Math.floor(f * bitsStr.length / totalFrames);
        const endBit = Math.floor((f + 1) * bitsStr.length / totalFrames);
        let pnIdx = 0;
        for (let b = startBit; b < endBit && b < bitsStr.length; b++) {
            const bitVal = bitsStr[b] === '1' ? 1 : -1;
            for (let c = 0; c < chipsPerBit && pnIdx < pnLen; c++) {
                const bin = lo + pnIdx;
                if (bin < hi) {
                    const mag = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
                    const add = bitVal * pn[pnIdx] * strength * Math.max(1, mag / 1000);
                    const scale = 1 + add / (mag + 0.001);
                    re[bin] *= scale; im[bin] *= scale;
                    const mirror = F - bin;
                    re[mirror] = re[bin]; im[mirror] = -im[bin];
                }
                pnIdx++;
            }
        }
        awIfft(re, im);
        for (let i = 0; i < F && off + i < s16.length; i++)
            result[off + i] += re[i] * window[i];
    }
    for (let i = 0; i < s16.length; i++)
        s16[i] = Math.max(-32768, Math.min(32767, Math.round(result[i])));
    return s16;
}
function aw4_extract(s16, sr, numBits) {
    const F = AWM4_FRAME, SHIFT = F >> 1;
    const srVal = sr || 44100;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const maxBits = numBits || totalFrames;
    const bitsPerFrame = Math.max(1, Math.ceil(maxBits / totalFrames));
    const pnLen = Math.min(bitsPerFrame * 4, F >> 2);
    const pn = aw4_pn(12345, pnLen);
    const lo = Math.max(2, Math.floor(500 * F / srVal));
    const hi = Math.min((F >> 1) - 1, Math.ceil(8000 * F / srVal));
    const chipsPerBit = Math.max(1, Math.floor((hi - lo) / bitsPerFrame));
    let b = '';
    for (let f = 0; f < totalFrames && b.length < maxBits + 32; f++) {
        const off = f * SHIFT;
        const re = new Float64Array(F);
        const im = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) re[i] = s16[off + i];
        awFft(re, im);
        let pnIdx = 0;
        let corr = 0;
        for (let c = 0; c < bitsPerFrame * chipsPerBit && pnIdx < pnLen; c++) {
            const bin = lo + pnIdx;
            if (bin < hi) {
                const mag = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
                corr += mag * pn[pnIdx];
                pnIdx++;
            }
        }
        b += corr > 0 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw4_maxBits(audioLen, sr) {
    const F = AWM4_FRAME, SHIFT = F >> 1;
    return Math.max(1, Math.floor((audioLen - F) / SHIFT) + 1);
}

// ── Algorithm 5: QIM ──
function aw5_embed(s16, bitsStr, strength) {
    const S = Math.max(100, Math.min(5000, strength || 500));
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++) {
        const x = s16[i];
        let q = Math.round(x / S);
        if (bitsStr[i] === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
        else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
        s16[i] = Math.max(-32768, Math.min(32767, q * S));
    }
    return s16;
}
function aw5_extract(s16, numBits, strength) {
    const S = Math.max(100, Math.min(5000, strength || 500));
    const limit = Math.min(s16.length, numBits || s16.length);
    let b = '';
    for (let i = 0; i < limit; i++) {
        const q = Math.round(s16[i] / S);
        b += (q & 1) === 0 ? '0' : '1';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 50000 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}

// ── Algorithm 6: DWT (Haar Wavelet) ──
// Haar DWT on segments, QIM on detail coefficients
function awHaarFwd(signal) {
    const n = signal.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = signal[i];
    let h = n;
    while (h > 1) {
        h >>= 1;
        for (let i = 0; i < h; i++) {
            const a = out[i * 2], b = out[i * 2 + 1];
            out[i] = (a + b) / 2;
            out[i + h] = (a - b) / 2;
        }
    }
    return out;
}
function awHaarInv(coeff, origLen) {
    const n = coeff.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = coeff[i];
    let h = 1;
    while (h < n) {
        for (let i = 0; i < h; i++) {
            const avg = out[i], diff = out[i + h];
            out[i * 2] = avg + diff;
            out[i * 2 + 1] = avg - diff;
        }
        h <<= 1;
    }
    return out;
}
function aw6_embed(s16, bitsStr, strength) {
    const S = Math.max(50, Math.min(2000, strength || 300));
    const SEG = 1024;
    const segs = Math.min(Math.floor(s16.length / SEG), bitsStr.length);
    for (let seg = 0; seg < segs; seg++) {
        const off = seg * SEG;
        const coeff = awHaarFwd(s16.subarray(off, off + SEG));
        const bit = bitsStr[seg];
        const startIdx = SEG >> 2;
        for (let j = startIdx; j < SEG && (j - startIdx) < 256; j++) {
            let q = Math.round(coeff[j] / S);
            if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
            else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
            coeff[j] = q * S;
        }
        const reconstructed = awHaarInv(coeff, SEG);
        for (let i = 0; i < SEG; i++)
            s16[off + i] = Math.max(-32768, Math.min(32767, Math.round(reconstructed[i])));
    }
    return s16;
}
function aw6_extract(s16, numBits, strength) {
    const S = Math.max(50, Math.min(2000, strength || 300));
    const SEG = 1024;
    const segs = Math.min(Math.floor(s16.length / SEG), numBits || 1000);
    let b = '';
    for (let seg = 0; seg < segs; seg++) {
        const off = seg * SEG;
        const coeff = awHaarFwd(s16.subarray(off, off + SEG));
        const startIdx = SEG >> 2;
        let sum = 0;
        for (let j = startIdx; j < SEG && (j - startIdx) < 256; j++) {
            const q = Math.round(coeff[j] / S);
            sum += (q & 1);
        }
        b += sum > 128 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw6_maxBits(audioLen, sr) {
    return Math.floor(audioLen / 1024);
}

// ── DCT helpers (Type-II/III, orthogonal) ──
function awDct(signal) {
    const N = signal.length;
    const X = new Float64Array(N);
    const scale0 = 1 / Math.sqrt(N);
    const scale = Math.sqrt(2 / N);
    for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++)
            sum += signal[n] * Math.cos(Math.PI * k * (n + 0.5) / N);
        X[k] = k === 0 ? sum * scale0 : sum * scale;
    }
    return X;
}
function awIdct(X) {
    const N = X.length;
    const x = new Float64Array(N);
    const scale0 = 1 / Math.sqrt(N);
    const scale = Math.sqrt(2 / N);
    for (let n = 0; n < N; n++) {
        let sum = X[0] * scale0;
        for (let k = 1; k < N; k++)
            sum += X[k] * scale * Math.cos(Math.PI * k * (n + 0.5) / N);
        x[n] = sum;
    }
    return x;
}

// ── Algorithm 7: Patchwork (FFT-domain, statistical) ──
// Based on Steinebach/audiowmark approach: pairwise modification of FFT magnitudes
const AWM7_FRAME = 1024;
const AWM7_PAIRS = 48;
const AWM7_REPS = 5;
function aw7_seedRng(seed) {
    let s = seed >>> 0;
    return function() { s = (s * 1103515245 + 12345) >>> 0; return s; };
}
function aw7_embed(s16, bitsStr, sr) {
    const seed = 12345;
    const F = AWM7_FRAME, SHIFT = F >> 1, REPS = AWM7_REPS, PAIRS = AWM7_PAIRS;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const effectiveBits = Math.min(bitsStr.length, Math.floor(totalFrames / REPS));
    const strength = 1.5;
    const result = new Float64Array(s16.length);
    const window = new Float64Array(F);
    for (let i = 0; i < F; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (F - 1)));
    for (let f = 0; f < effectiveBits * REPS && f < totalFrames; f++) {
        const bitIdx = Math.floor(f / REPS);
        const bit = bitsStr[bitIdx];
        const off = f * SHIFT;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) re[i] = s16[off + i];
        awFft(re, im);
        const mag = new Float64Array(F >> 1);
        for (let i = 0; i < (F >> 1); i++) mag[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]);
        const rng = aw7_seedRng(seed + f);
        const half = F >> 1;
        for (let p = 0; p < PAIRS; p++) {
            const i = (rng() % (half - 2)) + 1;
            const j = (rng() % (half - 2)) + 1;
            if (i === j) continue;
            const minIdx = Math.min(i, j), maxIdx = Math.max(i, j);
            const adjust = strength;
            if (bit === '1') {
                mag[minIdx] += adjust;
                mag[maxIdx] = Math.max(0, mag[maxIdx] - adjust);
            } else {
                mag[minIdx] = Math.max(0, mag[minIdx] - adjust);
                mag[maxIdx] += adjust;
            }
        }
        for (let i = 0; i < half; i++) {
            const phase = Math.atan2(im[i], re[i]);
            re[i] = mag[i] * Math.cos(phase);
            im[i] = mag[i] * Math.sin(phase);
            if (i > 0) { re[F - i] = re[i]; im[F - i] = -im[i]; }
        }
        awIfft(re, im);
        for (let i = 0; i < F && off + i < s16.length; i++)
            result[off + i] += re[i] * window[i];
    }
    for (let i = 0; i < s16.length; i++)
        s16[i] = Math.max(-32768, Math.min(32767, Math.round(result[i])));
    return s16;
}
function aw7_extract(s16, sr, numBits) {
    const F = AWM7_FRAME, SHIFT = F >> 1, REPS = AWM7_REPS, PAIRS = AWM7_PAIRS;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const maxPossible = Math.floor(totalFrames / REPS);
    const maxDetectBits = Math.min(numBits || maxPossible, maxPossible);
    const votes = [];
    for (let f = 0; f < totalFrames && votes.length < maxDetectBits * REPS; f++) {
        const off = f * SHIFT;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) re[i] = s16[off + i];
        awFft(re, im);
        const mag = new Float64Array(F >> 1);
        for (let i = 0; i < (F >> 1); i++) mag[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]);
        const rng = aw7_seedRng(f);
        const half = F >> 1;
        let sumDiff = 0;
        for (let p = 0; p < PAIRS; p++) {
            const i = (rng() % (half - 2)) + 1;
            const j = (rng() % (half - 2)) + 1;
            if (i === j) continue;
            sumDiff += mag[Math.min(i,j)] - mag[Math.max(i,j)];
        }
        votes.push(sumDiff > 0 ? '1' : '0');
    }
    let b = '';
    for (let i = 0; i < votes.length; i += REPS) {
        const chunk = votes.slice(i, i + REPS);
        const ones = chunk.filter(x => x === '1').length;
        b += ones >= Math.ceil(REPS / 2) ? '1' : '0';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw7_maxBits(audioLen, sr) {
    const F = AWM7_FRAME, SHIFT = F >> 1, REPS = AWM7_REPS;
    return Math.max(1, Math.floor(((audioLen - F) / SHIFT + 1) / REPS));
}

// ── Algorithm 8: DCT-based (DCT domain, QIM on mid-frequency coefficients) ──
const AWM8_FRAME = 512;
function aw8_embed(s16, bitsStr, strength) {
    const S = Math.max(50, Math.min(3000, strength || 400));
    const F = AWM8_FRAME, SHIFT = F >> 1;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const bitsPerFrame = Math.max(1, Math.ceil(bitsStr.length / totalFrames));
    const LO = Math.floor(F * 0.08);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const chipsPerBit = Math.max(1, Math.floor(usable / bitsPerFrame));
    const result = new Float64Array(s16.length);
    const window = new Float64Array(F);
    for (let i = 0; i < F; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (F - 1)));
    for (let f = 0; f < totalFrames; f++) {
        const off = f * SHIFT;
        const frame = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        const startBit = Math.floor(f * bitsStr.length / totalFrames);
        const endBit = Math.floor((f + 1) * bitsStr.length / totalFrames);
        let chipIdx = 0;
        for (let b = startBit; b < endBit && b < bitsStr.length; b++) {
            for (let c = 0; c < chipsPerBit && chipIdx < usable; c++) {
                const idx = LO + chipIdx;
                if (idx < HI) {
                    let q = Math.round(dct[idx] / S);
                    if (bitsStr[b] === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
                    else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
                    dct[idx] = q * S;
                }
                chipIdx++;
            }
        }
        const reconstructed = awIdct(dct);
        for (let i = 0; i < F && off + i < s16.length; i++)
            result[off + i] += reconstructed[i] * window[i];
    }
    for (let i = 0; i < s16.length; i++)
        s16[i] = Math.max(-32768, Math.min(32767, Math.round(result[i])));
    return s16;
}
function aw8_extract(s16, numBits, strength) {
    const S = Math.max(50, Math.min(3000, strength || 400));
    const F = AWM8_FRAME, SHIFT = F >> 1;
    const totalFrames = Math.max(1, Math.floor((s16.length - F) / SHIFT) + 1);
    const maxBits = numBits || totalFrames;
    const LO = Math.floor(F * 0.08);
    const HI = Math.floor(F * 0.35);
    const usable = HI - LO;
    const bitsPerFrame = Math.max(1, Math.ceil(maxBits / totalFrames));
    const chipsPerBit = Math.max(1, Math.floor(usable / bitsPerFrame));
    let b = '';
    for (let f = 0; f < totalFrames && b.length < maxBits + 32; f++) {
        const off = f * SHIFT;
        const frame = new Float64Array(F);
        for (let i = 0; i < F && off + i < s16.length; i++) frame[i] = s16[off + i];
        const dct = awDct(frame);
        let chipIdx = 0;
        let sum = 0, count = 0;
        for (let c = 0; c < bitsPerFrame * chipsPerBit && chipIdx < usable; c++) {
            const idx = LO + chipIdx;
            if (idx < HI) {
                const q = Math.round(dct[idx] / S);
                sum += (q & 1); count++;
                chipIdx++;
            }
        }
        b += sum > count / 2 ? '1' : '0';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw8_maxBits(audioLen, sr) {
    const F = AWM8_FRAME, SHIFT = F >> 1;
    return Math.max(1, Math.floor((audioLen - F) / SHIFT) + 1);
}
