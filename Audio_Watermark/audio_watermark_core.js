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
            fmt = {
                fmt: v.getUint16(off+8, true),
                ch: v.getUint16(off+10, true),
                sr: v.getUint32(off+12, true),
                br: v.getUint32(off+16, true),
                ba: v.getUint16(off+20, true),
                bps: v.getUint16(off+22, true)
            };
        } else if (id === 'data') {
            dataOff = off + 8;
            dataSize = sz;
        }
        off += 8 + sz;
        if (sz % 2) off++;
    }
    if (!fmt) throw new Error('fmt chunk not found');
    if (!dataSize) throw new Error('data chunk not found');
    if (fmt.fmt !== 1 && fmt.fmt !== 0xFFFE) throw new Error('Only PCM WAV supported');
    const totalSamples = Math.floor(dataSize / (fmt.bps / 8));
    const monoLen = Math.floor(totalSamples / fmt.ch);
    const m = new Int16Array(monoLen);
    for (let i = 0; i < monoLen; i++)
        m[i] = v.getInt16(dataOff + i * fmt.ch * 2, true);
    return { samples: m, sr: fmt.sr, ch: fmt.ch, bps: fmt.bps,
             raw: new Int16Array(totalSamples), rawOff: dataOff };
}
function awReadWavRaw(buf) {
    const r = awReadWav(buf);
    const v = new DataView(buf);
    for (let i = 0; i < r.raw.length; i++)
        r.raw[i] = v.getInt16(r.rawOff + i * 2, true);
    return r;
}
function awWriteWav(mono, sr, ch, rawData, bps) {
    const bpsOut = 16;
    const ba = ch * (bpsOut / 8);
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
            if (c === 0 && i < mono.length) {
                val = mono[i];
            } else if (rawData && i * ch + c < rawData.length) {
                val = rawData[i * ch + c];
            } else if (i < mono.length) {
                val = mono[i];
            } else {
                val = 0;
            }
            v.setInt16(44 + (i * ch + c) * 2, Math.max(-32768, Math.min(32767, val||0)), true);
        }
    }
    return buf;
}

// ── Audio loading (WAV directly, others via AudioContext) ──
async function awLoadAudio(file) {
    const buf = await file.arrayBuffer();
    const h = new Uint8Array(buf, 0, 4);
    if (h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x46)
        return awReadWavRaw(buf);
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

// ── Cepstrum (power cepstrum for echo detection) ──
function awCepstrum(seg, delay0, delay1) {
    const N = seg.length;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) { re[i] = seg[i]; im[i] = 0; }
    awFft(re, im);
    for (let i = 0; i < N; i++) {
        const mag = Math.sqrt(re[i]*re[i] + im[i]*im[i]);
        re[i] = Math.log(1 + mag);
        im[i] = 0;
    }
    awIfft(re, im);
    const c0 = Math.abs(re[delay0]);
    const c1 = Math.abs(re[delay1]);
    return { c0, c1 };
}

// ── Payload helpers (reuse Watermark/utils.js global functions) ──
function awFormatPayload(secretBytes, key) {
    const marker = new Uint8Array([0xAA, 0xBB]);
    const raw = new Uint8Array(2 + secretBytes.length);
    raw.set(marker, 0);
    raw.set(secretBytes, 2);
    const encrypted = xor_bytes(raw, key);
    const lenBytes = new Uint8Array(4);
    lenBytes[0] = (encrypted.length >> 24) & 0xFF;
    lenBytes[1] = (encrypted.length >> 16) & 0xFF;
    lenBytes[2] = (encrypted.length >> 8) & 0xFF;
    lenBytes[3] = encrypted.length & 0xFF;
    const full = new Uint8Array(4 + encrypted.length);
    full.set(lenBytes, 0);
    full.set(encrypted, 4);
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
// Each 16-bit PCM sample carries 1 bit in its LSB
function aw1_embed(s16, bitsStr) {
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++)
        s16[i] = (s16[i] & ~1) | (bitsStr[i] === '1' ? 1 : 0);
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

// ── Algorithm 2: Group Mean Modulation (GMM) ──
// Each bit: split GROUP samples into two halves A and B.
// bit=1: add delta to A, subtract delta from B.
// bit=0: subtract delta from A, add delta to B.
// Extract: compare summed means of the two halves.
const AWM2_GROUP = 4096;
const AWM2_DELTA = 200;
function aw2_embed(s16, bitsStr, sr) {
    const GROUP = AWM2_GROUP, HALF = GROUP >> 1;
    const segs = Math.min(Math.floor(s16.length / GROUP), bitsStr.length);
    for (let s = 0; s < segs; s++) {
        const off = s * GROUP;
        const up = bitsStr[s] === '1' ? AWM2_DELTA : -AWM2_DELTA;
        for (let i = 0; i < HALF; i++) {
            s16[off + i] = Math.max(-32768, Math.min(32767, s16[off + i] + up));
            s16[off + HALF + i] = Math.max(-32768, Math.min(32767, s16[off + HALF + i] - up));
        }
    }
    return s16;
}
function aw2_extract(s16, sr, numBits) {
    const GROUP = AWM2_GROUP, HALF = GROUP >> 1;
    const segs = Math.min(Math.floor(s16.length / GROUP), numBits || 1000);
    let b = '';
    for (let s = 0; s < segs; s++) {
        const off = s * GROUP;
        let sumA = 0, sumB = 0;
        for (let i = 0; i < HALF; i++) {
            sumA += s16[off + i];
            sumB += s16[off + HALF + i];
        }
        b += sumA > sumB ? '1' : '0';
        if (b.length >= 32) {
            const dlen = parseInt(b.substring(0, 32), 2);
            if (dlen > 0 && dlen < 500 && b.length >= 32 + dlen * 8) break;
        }
    }
    return b;
}
function aw2_maxBits(audioLen, sr) {
    return Math.floor(audioLen / AWM2_GROUP);
}

// ── Algorithm 3: QIM (Quantization Index Modulation) ──
// Embed: quantize sample value to even/odd multiples of step S
// Extract: read parity of quantization index
function aw3_embed(s16, bitsStr, strength) {
    const S = Math.max(100, Math.min(5000, strength || 500));
    const len = Math.min(s16.length, bitsStr.length);
    for (let i = 0; i < len; i++) {
        const x = s16[i];
        let q = Math.round(x / S);
        const bit = bitsStr[i];
        if (bit === '0') { if ((q & 1) !== 0) q += q >= 0 ? 1 : -1; }
        else { if ((q & 1) === 0) q += q >= 0 ? 1 : -1; }
        s16[i] = Math.max(-32768, Math.min(32767, q * S));
    }
    return s16;
}
function aw3_extract(s16, numBits, strength) {
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
