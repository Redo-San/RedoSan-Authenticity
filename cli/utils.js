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
  return fs.readFileSync(absPath);
}

/**
 * Read a file and return as ArrayBuffer
 */
function readFileArrayBuffer(filePath) {
  const buf = readFileBytes(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
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

// ── File Validation (mirrors web shared.js) ──

const BLOCKED_EXTS = ['.exe','.bat','.cmd','.com','.msi','.scr','.pif',
  '.vbs','.vbe','.js','.jse','.wsf','.wsh','.ps1','.psm1','.psd1',
  '.py','.pyc','.rb','.pl','.sh','.bash','.dll','.sys','.ocx',
  '.app','.jar','.msu','.msp','.reg','.inf','.gadget','.cpl','.mst',
  '.hta','.ws','.vb','.vba','.swf','.action','.epub','.xps','.oxps',
  '.xls','.xlsx','.ppt','.pptx','.rtf','.odt','.ods','.odp','.zip'];

const MAGIC_BYTES = {
  'image/png':       [[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]],
  'image/jpeg':      [[0xFF,0xD8,0xFF]],
  'image/gif':       [[0x47,0x49,0x46,0x38,0x39,0x61],[0x47,0x49,0x46,0x38,0x37,0x61]],
  'image/webp':      function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x57||buf[9]!==0x45||buf[10]!==0x42||buf[11]!==0x50) return false;
    return true;
  },
  'image/bmp':       [[0x42,0x4D]],
  'image/tiff':      [[0x49,0x49,0x2A,0x00],[0x4D,0x4D,0x00,0x2A]],
  'image/svg+xml':   function(buf) {
    var s = '';
    for (let i = 0; i < Math.min(50, buf.length); i++) s += String.fromCharCode(buf[i]);
    s = s.toLowerCase();
    return s.indexOf('<svg') !== -1 || s.indexOf('<?xml') !== -1;
  },
  'application/pdf': [[0x25,0x50,0x44,0x46]],
  'audio/mpeg':      [[0x49,0x44,0x33],[0xFF,0xFB],[0xFF,0xF3],[0xFF,0xF2]],
  'audio/wav':       function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x57||buf[9]!==0x41||buf[10]!==0x56||buf[11]!==0x45) return false;
    return true;
  },
  'audio/flac':      [[0x66,0x4C,0x61,0x43]],
  'audio/ogg':       [[0x4F,0x67,0x67,0x53]],
  'video/mp4':       function(buf) {
    if (buf[4]!==0x66||buf[5]!==0x74||buf[6]!==0x79||buf[7]!==0x70) return false;
    return true;
  },
  'video/webm':      [[0x1A,0x45,0xDF,0xA3]],
  'video/avi':       function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x41||buf[9]!==0x56||buf[10]!==0x49||buf[11]!==0x20) return false;
    return true;
  }
};

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /(?:^|\s)on\w+\s*=\s*["']/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<\s*foreignObject[\s>]/i,
  /<!ENTITY\s+/i,
  /<!DOCTYPE\s+\w+\s+SYSTEM/i,
  /<\s*xi:include[\s>]/i,
  /<\s*xi:fallback[\s>]/i,
];

const DOC_THREAT_PATTERNS = [
  { pattern: /\/JavaScript[\s<]/i, label: 'embedded JavaScript' },
  { pattern: /\/JS\s+\d+\s+0\s+R/i, label: 'embedded JavaScript' },
  { pattern: /\/OpenAction[\s<]/i, label: 'auto-execute action' },
  { pattern: /\/Launch[\s<]/i, label: 'launch external app' },
  { pattern: /\/EmbeddedFiles[\s<]/i, label: 'embedded file attachments' },
];

function isDangerousExt(fileName) {
  var name = path.basename(fileName).toLowerCase();
  for (var i = 0; i < BLOCKED_EXTS.length; i++) {
    if (name.endsWith(BLOCKED_EXTS[i])) return true;
  }
  return false;
}

function checkMagicBytes(data, mimeType) {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true;
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof expected === 'function') return expected(arr);
  for (let m = 0; m < expected.length; m++) {
    const sig = expected[m];
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (arr[i] !== sig[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function hasDangerousContent(data) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dec = new TextDecoder('utf-8', { fatal: false });
  const s = dec.decode(arr.slice(0, 4096));
  for (var i = 0; i < DANGEROUS_PATTERNS.length; i++) {
    if (DANGEROUS_PATTERNS[i].test(s)) return true;
  }
  return false;
}

function checkDocumentThreats(data) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dec = new TextDecoder('utf-8', { fatal: false });
  const s = dec.decode(arr);
  const maxSize = 10 * 1024 * 1024;
  if (s.length > maxSize) return { safe: false, reason: `PDF exceeds 10MB limit (${(s.length / 1024 / 1024).toFixed(1)}MB)` };
  for (let i = 0; i < DOC_THREAT_PATTERNS.length; i++) {
    if (DOC_THREAT_PATTERNS[i].pattern.test(s)) {
      return { safe: false, reason: DOC_THREAT_PATTERNS[i].label };
    }
  }
  return { safe: true };
}

function checkFileStructure(data, ext) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (ext === '.png') {
    if (arr.length < 12) return { safe: false, reason: 'File too small to be valid PNG' };
    const iend = arr.slice(arr.length - 12);
    if (iend[4] !== 0x49 || iend[5] !== 0x45 || iend[6] !== 0x4E || iend[7] !== 0x44)
      return { safe: false, reason: 'Invalid PNG: missing IEND chunk (possible appended data)' };
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (arr.length < 2) return { safe: false, reason: 'File too small' };
    if (arr[arr.length - 2] !== 0xFF || arr[arr.length - 1] !== 0xD9)
      return { safe: false, reason: 'Invalid JPEG: missing EOI marker (FF D9)' };
  } else if (ext === '.gif') {
    if (arr.length < 1) return { safe: false, reason: 'File too small' };
    if (arr[arr.length - 1] !== 0x3B)
      return { safe: false, reason: 'Invalid GIF: missing trailer (0x3B)' };
  }
  return { safe: true };
}

function validateFile(filePath, options) {
  const opts = options || {};
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  const ext = path.extname(absPath).toLowerCase();
  const fileName = path.basename(absPath);

  // 1. Extension blocklist
  if (!opts.allowDangerous && isDangerousExt(fileName)) {
    throw new Error(`Blocked dangerous file type: ${ext} (${fileName}). Use --allow-dangerous to override.`);
  }

  const data = fs.readFileSync(absPath);
  const info = getFileInfo(filePath);

  // 2. Magic bytes check
  if (info.type !== 'application/octet-stream' && !checkMagicBytes(data, info.type)) {
    throw new Error(`Magic bytes mismatch for ${fileName}: declared type ${info.type} doesn't match actual file content`);
  }

  // 3. Dangerous content scan (images, audio, video)
  if (['.png','.jpg','.jpeg','.gif','.webp','.bmp','.tiff','.tif','.svg'].includes(ext)) {
    if (hasDangerousContent(data)) {
      throw new Error(`Dangerous content detected in ${fileName}: embedded scripts or code patterns found`);
    }
  }

  // 4. Document threats (PDF)
  if (ext === '.pdf') {
    const docResult = checkDocumentThreats(data);
    if (!docResult.safe) {
      throw new Error(`PDF threat detected (${docResult.reason}) in ${fileName}`);
    }
  }

  // 5. File structure integrity
  const structResult = checkFileStructure(data, ext);
  if (!structResult.safe) {
    throw new Error(`Structure check failed for ${fileName}: ${structResult.reason}`);
  }

  return data;
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
  validateFile,
  isDangerousExt,
  checkMagicBytes,
  hasDangerousContent,
  checkDocumentThreats,
  checkFileStructure,
  stripC2PA,
};

/**
 * Strip c2pa chunks from PNG buffer (canvas native can't handle them)
 */
function stripC2PA(buf) {
  if (buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return buf;
  const parts = [buf.slice(0, 8)];
  let i = 8;
  while (i <= buf.length - 12) {
    const len = buf.readUInt32BE(i);
    const name = buf.slice(i+4, i+8).toString('ascii');
    if (name !== 'c2pa') parts.push(buf.slice(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(parts);
}
