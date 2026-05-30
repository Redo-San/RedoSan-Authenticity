'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function deriveKey(password) {
  if (!password) return Buffer.alloc(0);
  return crypto.pbkdf2Sync(password, password, 100000, 32, 'sha256');
}

function bytesToBits(data) {
  let s = '';
  for (let i = 0; i < data.length; i++)
    s += data[i].toString(2).padStart(8, '0');
  return s;
}

function bitsToBytes(s) {
  const len = Math.floor(s.length / 8);
  const b = Buffer.alloc(len);
  for (let i = 0; i < len; i++)
    b[i] = parseInt(s.substring(i * 8, i * 8 + 8), 2);
  return b;
}

function xorBytes(a, b) {
  const r = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++)
    r[i] = a[i] ^ (b.length ? b[i % b.length] : 0);
  return r;
}

function pack16(v) { return [v >> 8, v & 0xFF]; }

// ── LSB Audio ──
function embedLSB(wav, bits) {
  const out = Buffer.from(wav);
  let idx = 0;
  for (let i = 44; i < out.length && idx < bits.length; i++) {
    out[i] = (out[i] & 0xFE) | parseInt(bits[idx++], 10);
  }
  return out;
}

function extractLSB(wav, bitCount) {
  let bits = '';
  const max = Math.min(wav.length - 44, bitCount);
  for (let i = 44; i < 44 + max; i++)
    bits += (wav[i] & 1).toString();
  return bits;
}

// ── Phase Coding ──
function embedPhaseCoding(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const sampleBytes = (out.length - headerSize);
  const samplesPerBit = Math.max(1, Math.floor(sampleBytes / bits.length / 2));
  for (let b = 0; b < bits.length; b++) {
    const start = headerSize + b * samplesPerBit * 2;
    for (let j = 0; j < samplesPerBit * 2 && start + j < out.length; j++) {
      out[start + j] = (out[start + j] & 0xFE) | parseInt(bits[b], 10);
    }
  }
  return out;
}

function extractPhaseCoding(wav, bitCount) {
  const headerSize = 44;
  const sampleBytes = (wav.length - headerSize);
  const samplesPerBit = Math.max(1, Math.floor(sampleBytes / bitCount / 2));
  let bits = '';
  for (let b = 0; b < bitCount; b++) {
    const start = headerSize + b * samplesPerBit * 2;
    let sum = 0, count = 0;
    for (let j = 0; j < samplesPerBit * 2 && start + j < wav.length; j++) {
      sum += (wav[start + j] & 1);
      count++;
    }
    bits += (sum > count / 2) ? '1' : '0';
  }
  return bits;
}

// ── Echo Hiding ──
function embedEchoHiding(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const sampleBytes = (out.length - headerSize);
  const segLen = Math.max(64, Math.floor(sampleBytes / bits.length / 4));
  for (let b = 0; b < bits.length; b++) {
    const start = headerSize + b * segLen * 4;
    for (let j = 0; j < segLen * 4 && start + j < out.length; j++) {
      const echo = (j >= segLen && bits[b] === '1') ? Math.floor(wav[start + j - segLen] * 0.3) : 0;
      let val = wav[start + j] + echo;
      if (val > 255) val = 255;
      if (val < 0) val = 0;
      out[start + j] = val;
    }
  }
  return out;
}

function extractEchoHiding(wav, bitCount) {
  const headerSize = 44;
  const sampleBytes = (wav.length - headerSize);
  const segLen = Math.max(64, Math.floor(sampleBytes / bitCount / 4));
  let bits = '';
  for (let b = 0; b < bitCount; b++) {
    const start = headerSize + b * segLen * 4;
    let corr1 = 0, corr2 = 0;
    for (let j = segLen; j < segLen * 2 && start + j < wav.length; j++) {
      const d = Math.abs(wav[start + j] - wav[start + j - segLen]);
      if (d > 10) corr1++;
    }
    for (let j = segLen; j < segLen * 2 && start + j + segLen < wav.length; j++) {
      if (Math.abs(wav[start + j + segLen] - wav[start + j]) > 10) corr2++;
    }
    bits += (corr1 > corr2) ? '1' : '0';
  }
  return bits;
}

// ── DSSS ──
function embedDSSS(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const chipLen = 32;
  const rng = crypto.createHash('sha256').update('dsss_seed').digest();
  const pattern = [];
  for (let i = 0; i < chipLen; i++) pattern.push(rng[i % rng.length] > 127 ? 1 : -1);
  let idx = 0;
  for (let b = 0; b < bits.length; b++) {
    const bit = parseInt(bits[b], 10);
    for (let c = 0; c < chipLen && headerSize + idx < out.length; c++) {
      const val = out[headerSize + idx] + pattern[c] * (bit === 1 ? 5 : -5);
      out[headerSize + idx] = Math.max(0, Math.min(255, val));
      idx++;
    }
  }
  return out;
}

function extractDSSS(wav, bitCount) {
  const headerSize = 44;
  const chipLen = 32;
  const rng = crypto.createHash('sha256').update('dsss_seed').digest();
  const pattern = [];
  for (let i = 0; i < chipLen; i++) pattern.push(rng[i % rng.length] > 127 ? 1 : -1);
  let bits = '', idx = 0;
  for (let b = 0; b < bitCount; b++) {
    let sum = 0;
    for (let c = 0; c < chipLen && headerSize + idx < wav.length; c++) {
      sum += wav[headerSize + idx] * pattern[c];
      idx++;
    }
    bits += (sum > 0) ? '1' : '0';
  }
  return bits;
}

// ── QIM ──
function embedQIM(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const step = 8;
  let idx = 0;
  for (let b = 0; b < bits.length; b++) {
    const bit = parseInt(bits[b], 10);
    const s = headerSize + idx;
    if (s >= out.length) break;
    const q = Math.round(out[s] / step) * step;
    out[s] = Math.max(0, Math.min(255, q + (bit === 1 ? step / 2 : 0)));
    idx++;
  }
  return out;
}

function extractQIM(wav, bitCount) {
  const headerSize = 44;
  const step = 8;
  let bits = '', idx = 0;
  for (let b = 0; b < bitCount; b++) {
    const s = headerSize + idx;
    if (s >= wav.length) break;
    const q = Math.round(wav[s] / step) * step;
    bits += (Math.abs(wav[s] - q) >= step / 4) ? '1' : '0';
    idx++;
  }
  return bits;
}

// ── DWT (Haar) ──
function embedDWT(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const segLen = Math.max(8, Math.floor((wav.length - headerSize) / bits.length / 2));
  let idx = 0;
  for (let b = 0; b < bits.length; b++) {
    const bit = parseInt(bits[b], 10);
    for (let j = 0; j < segLen && headerSize + idx + 1 < out.length; j += 2) {
      const avg = Math.floor((out[headerSize + idx] + out[headerSize + idx + 1]) / 2);
      const diff = out[headerSize + idx] - out[headerSize + idx + 1];
      const newDiff = bit === 1 ? Math.abs(diff) + 2 : 0;
      out[headerSize + idx] = Math.max(0, Math.min(255, avg + newDiff / 2));
      out[headerSize + idx + 1] = Math.max(0, Math.min(255, avg - newDiff / 2));
      idx += 2;
    }
  }
  return out;
}

function extractDWT(wav, bitCount) {
  const headerSize = 44;
  const segLen = Math.max(8, Math.floor((wav.length - headerSize) / bitCount / 2));
  let bits = '', idx = 0;
  for (let b = 0; b < bitCount; b++) {
    let sumDiff = 0, count = 0;
    for (let j = 0; j < segLen && headerSize + idx + 1 < wav.length; j += 2) {
      sumDiff += Math.abs(wav[headerSize + idx] - wav[headerSize + idx + 1]);
      count++;
      idx += 2;
    }
    bits += (sumDiff / Math.max(1, count) > 1) ? '1' : '0';
  }
  return bits;
}

// ── Patchwork ──
function embedPatchwork(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const pairs = 64;
  let idx = 0;
  for (let b = 0; b < bits.length; b++) {
    const bit = parseInt(bits[b], 10);
    if (bit === 1) {
      for (let p = 0; p < pairs && headerSize + idx + 1 < out.length; p++) {
        if (out[headerSize + idx] < 255) out[headerSize + idx]++;
        if (out[headerSize + idx + 1] > 0) out[headerSize + idx + 1]--;
        idx += 2;
      }
    } else {
      idx += pairs * 2;
    }
  }
  return out;
}

function extractPatchwork(wav, bitCount) {
  const headerSize = 44;
  const pairs = 64;
  let bits = '', idx = 0;
  for (let b = 0; b < bitCount; b++) {
    let sumDiff = 0;
    for (let p = 0; p < pairs && headerSize + idx + 1 < wav.length; p++) {
      sumDiff += wav[headerSize + idx] - wav[headerSize + idx + 1];
      idx += 2;
    }
    bits += (sumDiff > 0) ? '1' : '0';
  }
  return bits;
}

// ── DCT-based ──
function embedDCT(wav, bits) {
  const out = Buffer.from(wav);
  const headerSize = 44;
  const blockLen = 16;
  let idx = 0;
  for (let b = 0; b < bits.length; b++) {
    const bit = parseInt(bits[b], 10);
    for (let j = 0; j < blockLen && headerSize + idx + 1 < out.length; j += 2) {
      const avg = Math.floor((out[headerSize + idx] + out[headerSize + idx + 1]) / 2);
      const bias = bit === 1 ? 3 : -3;
      out[headerSize + idx] = Math.max(0, Math.min(255, avg + bias));
      out[headerSize + idx + 1] = Math.max(0, Math.min(255, avg - bias));
      idx += 2;
    }
  }
  return out;
}

function extractDCT(wav, bitCount) {
  const headerSize = 44;
  const blockLen = 16;
  let bits = '', idx = 0;
  for (let b = 0; b < bitCount; b++) {
    let sum = 0, count = 0;
    for (let j = 0; j < blockLen && headerSize + idx + 1 < wav.length; j += 2) {
      sum += wav[headerSize + idx] - wav[headerSize + idx + 1];
      count++;
      idx += 2;
    }
    bits += (sum > 0) ? '1' : '0';
  }
  return bits;
}

// ── Main ──
async function runAudioWatermark(action, filePath, opts) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('File not found:', absPath);
    process.exit(1);
  }

  const wav = fs.readFileSync(absPath);
  const key = deriveKey(opts.password || '');
  const algo = (opts.algo || 'lsb').toLowerCase();
  const algos = {
    lsb: { embed: embedLSB, extract: extractLSB },
    phase_coding: { embed: embedPhaseCoding, extract: extractPhaseCoding },
    echo_hiding: { embed: embedEchoHiding, extract: extractEchoHiding },
    dsss: { embed: embedDSSS, extract: extractDSSS },
    qim: { embed: embedQIM, extract: extractQIM },
    dwt: { embed: embedDWT, extract: extractDWT },
    patchwork: { embed: embedPatchwork, extract: extractPatchwork },
    dct: { embed: embedDCT, extract: extractDCT },
  };

  const impl = algos[algo];
  if (!impl) {
    console.error('Unknown algorithm. Supported: ' + Object.keys(algos).join(', '));
    process.exit(1);
  }

  if (action === 'embed') {
    const msg = opts.message || 'RedoSan';
    const msgBuf = Buffer.from(msg, 'utf-8');
    const header = Buffer.from([0xAA, 0xBB]);
    const payload = Buffer.concat([header, msgBuf]);
    const enc = xorBytes(payload, key);
    const bits = bytesToBits(enc);

    const outBuf = impl.embed(wav, bits);
    const outPath = opts.output ? path.resolve(opts.output) : path.resolve('output.wav');
    fs.writeFileSync(outPath, outBuf);
    console.log(`Audio watermark embedded (algorithm: ${algo}, ${msgBuf.length} bytes)`);
    console.log(`Output: ${outPath}`);

  } else if (action === 'extract') {
    const maxBits = Math.min((wav.length - 44) * 8, 200000);
    const bits = impl.extract(wav, maxBits);

    for (let offset = 0; offset + 16 < bits.length; offset += 8) {
      const dlen = parseInt(bits.substring(offset, offset + 16), 2);
      if (isNaN(dlen) || dlen <= 0 || dlen > 5000) continue;
      const totalLen = dlen * 8 + offset;
      if (bits.length < totalLen) continue;
      const enc = bitsToBytes(bits.substring(offset, totalLen));
      const dec = xorBytes(enc, key);
      if (dec.length >= 2 && dec[0] === 0xAA && dec[1] === 0xBB) {
        const msg = dec.slice(2).toString('utf-8').replace(/\0+$/, '');
        if (opts.output) {
          fs.writeFileSync(path.resolve(opts.output), msg);
          console.log(`Extracted message saved to: ${path.resolve(opts.output)}`);
        } else {
          console.log(`Extracted message: ${msg}`);
        }
        return;
      }
    }
    console.log('No watermark found. Try a different algorithm or password.');
  }
}

module.exports = { runAudioWatermark };
