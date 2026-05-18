// ── CLI: Watermark Command ──
// Reuses Watermark/watermark_core.js — patches Canvas API for Node.js

'use strict';

const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const { readFileBytes, getFileInfo, fmtSize } = require('../utils');

// ── Patch browser APIs for Node.js ──

// Patch document.createElement('canvas')
const mockDocument = {
  createElement: function(tag) {
    if (tag === 'canvas') {
      return createCanvas(1, 1);
    }
    throw new Error(`createElement('${tag}') not supported in CLI`);
  }
};
globalThis.document = mockDocument;

// Patch crypto.subtle for password hashing
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => {
        const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest();
        return hash.buffer;
      }
    }
  };
}

// Load existing watermark_core.js (uses patched document/crypto)
const corePath = path.join(__dirname, '..', 'Watermark', 'watermark_core.js');
require(corePath);

// Load watermark UI handler
const wmPath = path.join(__dirname, '..', 'Watermark', 'watermark.js');
require(wmPath);

// ── Algorithm map ──
const ALGO_MAP = {
  'lsb': 1, 'dct': 2, 'random_lsb': 3, 'neural_lsb': 4,
  'zero_bit': 5, 'multi_bit': 6, 'forensic': 7, 'fragile': 8, 'imatag': 9,
};

async function runWatermark(mode, opts) {
  try {
    const imageFile = opts.image;
    if (!imageFile) {
      console.error('Error: --image (-i) is required');
      process.exit(1);
    }

    const absPath = path.resolve(imageFile);
    const info = getFileInfo(imageFile);

    if (mode === 'embed') {
      // Embed watermark
      const secretFile = opts.secret;
      const outputFile = opts.output;
      if (!outputFile) {
        console.error('Error: --output (-o) is required for embed mode');
        process.exit(1);
      }

      const algoName = opts.algo || 'lsb';
      const algoNum = ALGO_MAP[algoName];
      if (!algoNum) {
        console.error(`Unknown algorithm: ${algoName}`);
        console.error('Available: lsb, dct, random_lsb, neural_lsb, zero_bit, multi_bit, forensic, fragile, imatag');
        process.exit(1);
      }

      // Load cover image
      const img = await loadImage(absPath);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);

      // Embed algorithm
      const algoFn = `wm${algoNum}_embed`;
      if (typeof globalThis[algoFn] !== 'function') {
        console.error(`Algorithm ${algoName} (type ${algoNum}) is not available`);
        process.exit(1);
      }

      // Generate payload bits from secret file
      let payloadBits;
      if (secretFile) {
        const secretData = readFileBytes(secretFile);
        payloadBits = fileToBits(secretData);
      } else {
        // Zero-bit mode (algorithm 5)
        payloadBits = [];
      }

      // Embed
      const password = opts.password || '';
      let result;
      if (algoNum === 3 || algoNum === 4) {
        // Algorithms that need a seed/password
        const seed = passwordToSeed(password);
        result = globalThis[algoFn](imgData, payloadBits, seed);
      } else {
        result = globalThis[algoFn](imgData, payloadBits, password);
      }

      // Save output
      ctx.putImageData(imgData, 0, 0);
      const outBuf = canvas.toBuffer('image/png');
      const outAbs = path.resolve(outputFile);
      fs.writeFileSync(outAbs, outBuf);

      console.log(`Watermark embedded successfully (${algoName})`);
      console.log(`Output: ${outAbs}`);
      console.log(`Payload: ${payloadBits.length} bits`);

    } else if (mode === 'extract') {
      // Extract watermark
      const outputFile = opts.output;
      const algoName = opts.algo || 'lsb';
      const algoNum = ALGO_MAP[algoName];
      if (!algoNum) {
        console.error(`Unknown algorithm: ${algoName}`);
        process.exit(1);
      }

      // Load watermarked image
      const img = await loadImage(absPath);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);

      // Extract algorithm
      const extractFn = `wm${algoNum}_extract`;
      if (typeof globalThis[extractFn] !== 'function') {
        console.error(`Extract for ${algoName} is not available`);
        process.exit(1);
      }

      const password = opts.password || '';
      let extracted;
      if (algoNum === 3 || algoNum === 4) {
        const seed = passwordToSeed(password);
        extracted = globalThis[extractFn](imgData, seed);
      } else {
        extracted = globalThis[extractFn](imgData, password);
      }

      // Output extracted data
      if (extracted && extracted.length > 0) {
        const extractedBytes = bitsToBytes(extracted);
        if (outputFile) {
          const outAbs = path.resolve(outputFile);
          fs.writeFileSync(outAbs, extractedBytes);
          console.log(`Watermark extracted and saved to: ${outAbs}`);
        } else {
          // Try to decode as text
          try {
            const text = new TextDecoder().decode(extractedBytes);
            console.log(`Extracted text: ${text}`);
          } catch(e) {
            console.log(`Extracted ${extractedBytes.length} bytes (binary data)`);
            console.log('Use --output to save to file');
          }
        }
      } else {
        console.log('No watermark found. Try a different algorithm or password.');
      }
    }

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ── Helpers ──

function fileToBits(data) {
  const bits = [];
  // First 32 bits = file length
  const len = data.length;
  for (let i = 31; i >= 0; i--) bits.push((len >> i) & 1);
  // Then file bytes
  for (let i = 0; i < data.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((data[i] >> b) & 1);
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

function passwordToSeed(pw) {
  if (!pw) return 42;
  const hash = crypto.createHash('sha256').update(pw).digest();
  return hash.readUInt32BE(0);
}

module.exports = { runWatermark };
