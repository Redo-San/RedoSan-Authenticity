// ── CLI Utilities ──
// Shared helpers for CLI commands — does NOT interfere with web code

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Read a file and return as Uint8Array
 */
function readFileBytes(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  return new Uint8Array(fs.readFileSync(absPath));
}

/**
 * Read a file and return as ArrayBuffer
 */
function readFileArrayBuffer(filePath) {
  return readFileBytes(filePath).buffer;
}

/**
 * Get file info (name, size, type)
 */
function getFileInfo(filePath) {
  const absPath = path.resolve(filePath);
  const stat = fs.statSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/avi',
  };
  return {
    name: path.basename(absPath),
    size: stat.size,
    type: mimeMap[ext] || 'application/octet-stream',
    ext: ext,
  };
}

/**
 * Hash using Node.js crypto (replaces crypto.subtle for CLI)
 */
async function hashNode(algo, data) {
  const hash = crypto.createHash(algo).update(data).digest();
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Load an image and return canvas ImageData (uses `canvas` npm package)
 */
function loadImageData(filePath) {
  const { createCanvas, loadImage } = require('canvas');
  return loadImage(filePath).then(img => {
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
  });
}

/**
 * Save an ImageData to a PNG file
 */
function saveImageData(imageData, outputPath) {
  const { createCanvas } = require('canvas');
  const c = createCanvas(imageData.width, imageData.height);
  const ctx = c.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  const buf = c.toBuffer('image/png');
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

/**
 * Format bytes to human-readable
 */
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Output results — prints to console and optionally saves to file
 */
function outputResult(text, opts) {
  if (opts.json) {
    console.log(text);
  } else {
    console.log(text);
  }
  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    console.log(`\nResults saved to: ${opts.output}`);
  }
}

module.exports = {
  readFileBytes,
  readFileArrayBuffer,
  getFileInfo,
  hashNode,
  loadImageData,
  saveImageData,
  fmtSize,
  outputResult,
};
