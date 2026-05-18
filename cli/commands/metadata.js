// ── CLI: Metadata Command ──
// Reuses Metadata/metadata.js EXIF parser

'use strict';

const path = require('path');
const crypto = require('crypto');
const { readFileBytes, getFileInfo, fmtSize, outputResult, loadImageData } = require('../utils');

// Patch crypto.subtle for Node.js
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

// Load loadImage from hashing.js (needed by metadata.js)
const hashingPath = path.join(__dirname, '..', 'Fingerprint', 'hashing.js');
require(hashingPath);

// Load metadata reading functions
const metadataPath = path.join(__dirname, '..', 'Metadata', 'metadata.js');
require(metadataPath);

async function runMetadata(filePath, opts) {
  const absPath = path.resolve(filePath);

  try {
    const data = readFileBytes(absPath);
    const info = getFileInfo(filePath);

    // Compute SHA-256
    const sha256 = await crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');

    // Get image dimensions
    let imageInfo = {};
    try {
      const imgData = await loadImageData(absPath);
      imageInfo = {
        width: imgData.width,
        height: imgData.height,
        mode: 'RGBA',
        format: info.ext.replace('.', '').toUpperCase(),
      };
    } catch(e) {
      imageInfo = { error: e.message };
    }

    // Parse EXIF (JPEG only)
    let exif = {};
    if (data[0] === 0xFF && data[1] === 0xD8) {
      // Call the parseJPEGExif function from metadata.js
      if (typeof globalThis.parseJPEGExif === 'function') {
        exif = globalThis.parseJPEGExif(data) || {};
      }
    }

    const result = {
      file: {
        name: info.name,
        size: info.size,
        size_human: fmtSize(info.size),
        type: info.type,
      },
      sha256: sha256,
      image: imageInfo,
      exif: Object.keys(exif).length > 0 ? exif : undefined,
    };

    // Output
    if (opts.json) {
      outputResult(JSON.stringify(result, null, 2), opts);
    } else {
      let text = `Metadata: ${info.name}\n`;
      text += `Size: ${fmtSize(info.size)}\n`;
      text += `SHA-256: ${sha256}\n`;
      text += '─'.repeat(60) + '\n\n';

      if (imageInfo.width) {
        text += `Dimensions: ${imageInfo.width} x ${imageInfo.height}\n`;
        text += `Format: ${imageInfo.format}\n`;
        text += `Mode: ${imageInfo.mode}\n\n`;
      }

      if (Object.keys(exif).length > 0) {
        text += 'EXIF:\n';
        for (const [key, val] of Object.entries(exif)) {
          text += `  ${key.padEnd(24)} ${val}\n`;
        }
      } else {
        text += 'EXIF: Not found (not a JPEG or no EXIF data)\n';
      }

      outputResult(text, opts);
    }

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { runMetadata };
