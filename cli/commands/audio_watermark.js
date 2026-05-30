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

async function runAudioWatermark(action, filePath, opts) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('File not found:', absPath);
    process.exit(1);
  }

  const wav = fs.readFileSync(absPath);
  const key = deriveKey(opts.password || '');

  if (action === 'embed') {
    const msg = opts.message || 'RedoSan';
    const msgBuf = Buffer.from(msg, 'utf-8');
    const header = Buffer.from([0xAA, 0xBB]);
    const payload = Buffer.concat([header, msgBuf]);
    const enc = xorBytes(payload, key);
    const bits = bytesToBits(enc);

    if (wav.length < 44 + bits.length) {
      console.error('Audio file too small for this message');
      process.exit(1);
    }

    const outBuf = Buffer.from(wav);
    let bitIdx = 0;
    for (let i = 44; i < outBuf.length && bitIdx < bits.length; i++) {
      outBuf[i] = (outBuf[i] & 0xFE) | parseInt(bits[bitIdx++], 10);
    }

    const outPath = opts.output ? path.resolve(opts.output) : path.resolve('output.wav');
    fs.writeFileSync(outPath, outBuf);
    console.log(`Audio watermark embedded (${msgBuf.length} bytes)`);
    console.log(`Output: ${outPath}`);

  } else if (action === 'extract') {
    const totalBits = Math.min((wav.length - 44), 200000);
    let bits = '';
    for (let i = 44; i < 44 + totalBits; i++)
      bits += (wav[i] & 1).toString();

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
    console.log('No watermark found. Try a different password.');
  }
}

module.exports = { runAudioWatermark };
