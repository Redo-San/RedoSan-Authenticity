// ── CLI: Fingerprint Command ──
// Reuses Fingerprint/hashing.js — only replaces crypto.subtle with Node.js crypto

'use strict';

const path = require('path');
const { readFileBytes, getFileInfo, fmtSize, outputResult, loadImageData, hashNode } = require('../utils');

// ── Load existing hashing.js and patch crypto.subtle for Node.js ──
// We create a minimal browser-like environment so the existing code works as-is
const crypto = require('crypto');

// Patch global crypto object so hashing.js works unchanged
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => {
        const algoMap = {
          'SHA-1': 'sha1',
          'SHA-256': 'sha256',
          'SHA-384': 'sha384',
          'SHA-512': 'sha512',
        };
        const nodeAlgo = algoMap[algo];
        if (!nodeAlgo) throw new Error(`Unsupported algorithm: ${algo}`);
        const hash = crypto.createHash(nodeAlgo).update(Buffer.from(data)).digest();
        return hash.buffer;
      }
    }
  };
}

// Now require the existing hashing.js — it will use our patched crypto
const hashingPath = path.join(__dirname, '..', 'Fingerprint', 'hashing.js');
require(hashingPath);

// After loading, all functions are available on global scope or window-like object
// hashing.js attaches: sha3_224, sha3_256, sha3_384, sha3_512, blake2b, blake2s, sha224, md2, md4, md5, ripemd160, blake3, whirlpool, fingerprintFile, fastFingerprint, loadImage, resizeImageData, ahash, dhash, phash, whash

async function runFingerprint(filePath, opts) {
  const absPath = path.resolve(filePath);

  try {
    const data = readFileBytes(absPath);
    const info = getFileInfo(filePath);
    const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.tif', '.webp'];

    const algoMap = {
      sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512',
      sha3: 'sha3_all', blake2b: 'BLAKE2b', blake2s: 'BLAKE2s', blake3: 'BLAKE3',
      sha224: 'SHA-224', md2: 'MD2', md4: 'MD4', md5: 'MD5',
      ripemd160: 'RIPEMD-160', whirlpool: 'Whirlpool',
    };

    const hashes = {};

    // Yield between algorithms to keep process responsive
    async function yieldLoop() { await new Promise(r => setTimeout(r, 0)); }

    // Web Crypto algorithms (native Node.js crypto)
    const webAlgos = { 'SHA-1': 'SHA-1', 'SHA-256': 'SHA-256', 'SHA-384': 'SHA-384', 'SHA-512': 'SHA-512' };

    if (!opts.algo || opts.algo === 'all') {
      // Run all algorithms (same as simplified mode)
      hashes['SHA-256'] = await hashNode('sha256', data); await yieldLoop();
      hashes['SHA-512'] = await hashNode('sha512', data); await yieldLoop();
      try { hashes['BLAKE3'] = await globalThis.blake3(data); } catch(e) { console.error(`BLAKE3: ${e.message}`); }
    } else {
      const target = algoMap[opts.algo.toLowerCase()];
      if (!target) {
        console.error(`Unknown algorithm: ${opts.algo}`);
        console.error('Available: sha1, sha256, sha384, sha512, sha3, blake2b, blake2s, blake3, sha224, md2, md4, md5, ripemd160, whirlpool, all');
        process.exit(1);
      }

      if (webAlgos[target]) {
        const nodeAlgo = opts.algo.toLowerCase();
        hashes[target] = await hashNode(nodeAlgo, data);
      } else if (target === 'sha3_all') {
        hashes['SHA-3_224'] = globalThis.sha3_224(data);
        hashes['SHA-3_256'] = globalThis.sha3_256(data);
        hashes['SHA-3_384'] = globalThis.sha3_384(data);
        hashes['SHA-3_512'] = globalThis.sha3_512(data);
      } else if (globalThis[target]) {
        hashes[target] = await globalThis[target](data);
      }
    }

    // Perceptual hashes for images
    const perceptual = {};
    if (imgExts.includes(info.ext)) {
      try {
        const imgData = await loadImageData(absPath);
        const small = globalThis.resizeImageData(imgData, 32);
        perceptual.ahash = globalThis.ahash(small);
        perceptual.dhash = globalThis.dhash(small);
        perceptual.phash = globalThis.phash(small);
        try { perceptual.whash = globalThis.whash(small); } catch(e) {}
      } catch(e) {
        console.error(`Perceptual hash error: ${e.message}`);
      }
    }

    // Build result object
    const result = {
      file: {
        name: info.name,
        size: info.size,
        size_human: fmtSize(info.size),
        type: info.type,
      },
      hashes: hashes,
      perceptual_hashes: Object.keys(perceptual).length > 0 ? perceptual : undefined,
    };

    // Output
    if (opts.json) {
      const jsonOut = JSON.stringify(result, null, 2);
      outputResult(jsonOut, opts);
    } else {
      let text = `Fingerprint: ${info.name}\n`;
      text += `Size: ${fmtSize(info.size)}\n`;
      text += '─'.repeat(60) + '\n\n';

      // Group by family
      const families = {
        'SHA-2': ['SHA-256', 'SHA-384', 'SHA-512'],
        'BLAKE': ['BLAKE2b', 'BLAKE2s', 'BLAKE3'],
        'SHA-3': ['SHA-3_224', 'SHA-3_256', 'SHA-3_384', 'SHA-3_512'],
        'MD': ['MD2', 'MD4', 'MD5'],
        'Other': ['SHA-1', 'SHA-224', 'RIPEMD-160', 'Whirlpool'],
      };

      for (const [fam, keys] of Object.entries(families)) {
        const present = keys.filter(k => hashes[k]);
        if (present.length === 0) continue;
        text += `${fam}:\n`;
        for (const key of present) {
          text += `  ${key.padEnd(12)} ${hashes[key]}\n`;
        }
        text += '\n';
      }

      if (Object.keys(perceptual).length > 0) {
        text += 'Perceptual (image hashes):\n';
        for (const [key, val] of Object.entries(perceptual)) {
          text += `  ${key.padEnd(12)} ${val}\n`;
        }
        text += '\n';
      }

      outputResult(text, opts);
    }

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { runFingerprint };
