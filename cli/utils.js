// ── CLI Utilities ──
// Shared helpers for CLI commands — does NOT interfere with web code

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

/**
 * Read a file and return as Uint8Array
 * @param filePath
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
 * @param filePath
 */
function readFileArrayBuffer(filePath) {
  const buf = readFileBytes(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

/**
 * Read a text file and return as UTF-8 string (skip binary validation)
 * @param filePath
 */
function readFileText(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  return fs.readFileSync(absPath, "utf-8");
}

/**
 * Read a document file (TXT, DOCX, PDF) and return extracted text
 * @param filePath
 */
async function readDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt" || ext === ".json" || ext === ".csv" || ext === ".md") {
    return readFileText(filePath);
  }
  if (ext === ".docx") {
    return await readDocxText(filePath);
  }
  if (ext === ".pdf") {
    return readPdfText(filePath);
  }
  if (ext === ".doc") {
    // DOC (binary OLE): best-effort - read raw bytes, extract printable ASCII text
    const buf = readFileBytes(filePath);
    // Try to find WordDocument stream text in OLE2
    // Look for contiguous sequences of printable ASCII interspersed in binary
    let result = "";
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0x7e)) {
        result += String.fromCharCode(c);
      } else if (c === 0x00) {
        result += " ";
      }
    }
    result = result.replace(/\s+/g, " ").trim();
    return result;
  }
  // Other: best-effort UTF-8 read
  try {
    return readFileText(filePath);
  } catch {
    return "";
  }
}

/**
 *
 * @param filePath
 */
async function readDocxText(filePath) {
  const JSZip = require("jszip");
  const buf = readFileBytes(filePath);
  const zip = new JSZip();
  const z = await zip.loadAsync(buf);
  const entry = z.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml not found");
  const xml = await entry.async("string");
  // Simple XML text extraction
  let text = "";
  const wtRe = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  let m;
  const paraBreaks = xml.split("</w:p>");
  for (let p = 0; p < paraBreaks.length; p++) {
    const para = paraBreaks[p];
    const parts = [];
    while (true) {
      const m = wtRe.exec(para);
      if (m === null) break;
      parts.push(m[1]);
    }
    if (parts.length) text += `${parts.join("")}\n`;
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 *
 * @param filePath
 */
function readPdfText(filePath) {
  const buf = readFileBytes(filePath);
  const src = buf.toString("latin1");

  // Object map
  const objMap = {};
  const objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  while (true) {
    const m = objRe.exec(src);
    if (m === null) break;
    objMap[m[1]] = m[3];
  }

  // Build CMap from ToUnicode streams
  const cmap = {};
  for (const [, content] of Object.entries(objMap)) {
    if (!content.includes("FlateDecode")) continue;
    const sm = content.match(/stream\n([\s\S]*?)endstream/);
    if (!sm) continue;
    const raw = sm[1].replace(/\r?\n$/, "");
    let data;
    try {
      data = zlib.inflateSync(Buffer.from(raw, "binary")).toString("latin1");
    } catch {
      continue;
    }
    if (!data.includes("begincmap")) continue;

    const bfcharRe = /(\d+)\s+beginbfchar\n([\s\S]*?)endbfchar/g;
    while (true) {
      const bm = bfcharRe.exec(data);
      if (bm === null) break;
      const entries = bm[2].split("\n");
      for (const entry of entries) {
        const match = entry.match(/<(\w+)>\s*<(\w+)>/);
        if (match) cmap[parseInt(match[1], 16)] = parseInt(match[2], 16);
      }
    }
    const bfrangeRe = /(\d+)\s+beginbfrange\n([\s\S]*?)endbfrange/g;
    while (true) {
      const rm = bfrangeRe.exec(data);
      if (rm === null) break;
      const entries = rm[2].split("\n");
      for (const entry of entries) {
        const parts = entry.match(/<(\w+)>\s*<(\w+)>\s*<(\w+)>/);
        if (parts) {
          const start = parseInt(parts[1], 16);
          const end = parseInt(parts[2], 16);
          const baseCode = parseInt(parts[3], 16);
          for (let i = start; i <= end; i++) {
            if (!cmap[i]) cmap[i] = baseCode + (i - start);
          }
        }
      }
    }
  }

  // Find page content streams
  const pages = [];
  const pageRe = /(\d+)\s+(\d+)\s+obj[\s\S]*?\/Type\s*\/Page[\s\S]*?\/Contents\s+(\d+)\s+(\d+)\s+R/g;
  while (true) {
    const pm = pageRe.exec(src);
    if (pm === null) break;
    pages.push({ obj: `${pm[1]} ${pm[2]}`, contentRef: pm[3] });
  }

  if (pages.length === 0) return "";

  /**
   *
   * @param s
   */
  function decodePdfString(s) {
    if (s.length < 2) return s;
    var asianCount = 0;
    var testLen = Math.min(100, s.length);
    var ti;
    var b1;
    var b2;
    var out2;
    var di2;
    for (ti = 0; ti + 1 < testLen; ti += 2) {
      b1 = s.charCodeAt(ti);
      b2 = s.charCodeAt(ti + 1);
      if (b1 === 0 && b2 >= 0x20 && b2 <= 0x7e) asianCount++;
    }
    if (asianCount > 5 && asianCount / Math.floor(testLen / 2) > 0.4) {
      out2 = "";
      for (di2 = 0; di2 + 1 < s.length; di2 += 2) {
        out2 += String.fromCharCode((s.charCodeAt(di2) << 8) | s.charCodeAt(di2 + 1));
      }
      return out2;
    }
    return s;
  }

  let text = "";
  for (let p = 0; p < pages.length; p++) {
    const contentObj = objMap[pages[p].contentRef];
    if (!contentObj) continue;

    const streamRe = /stream\n([\s\S]*?)endstream/;
    const sm = streamRe.exec(contentObj);
    if (!sm) continue;

    const raw = sm[1].replace(/\r?\n$/, "").replace(/\r\n/g, "\n");
    let data;

    if (contentObj.includes("FlateDecode")) {
      try {
        data = zlib.inflateSync(Buffer.from(raw, "binary")).toString("latin1");
      } catch {
        try {
          data = zlib.inflateRawSync(Buffer.from(raw, "binary")).toString("latin1");
        } catch {
          continue;
        }
      }
    } else {
      data = raw;
    }

    const tjRe = /\(([^)]*)\)\s*Tj/g;
    let t;
    while (true) {
      t = tjRe.exec(data);
      if (t === null) break;
      text += `${decodePdfString(t[1].replace(/\\(.)/g, "$1"))} `;
    }

    // Parenthesized strings in TJ arrays: [(text) num (text)] TJ
    const tjArrayRe = /\[([^\]]*)\]\s*TJ/g;
    while (true) {
      t = tjArrayRe.exec(data);
      if (t === null) break;
      const parts = t[1].match(/\(([^)]*)\)/g);
      if (parts)
        parts.forEach((p2) => {
          text += `${decodePdfString(p2.slice(1, -1).replace(/\\(.)/g, "$1"))} `;
        });
    }

    // Hex strings: <hex> Tj (CID fonts)
    const hexTjRe = /<([\dA-Fa-f]+)>\s*Tj/g;
    while (true) {
      t = hexTjRe.exec(data);
      if (t === null) break;
      const code = parseInt(t[1], 16);
      if (cmap[code]) {
        try {
          text += String.fromCodePoint(cmap[code]);
          /* c8 ignore next 3 */
        } catch {
          text += "?";
        }
      } else text += "?";
    }

    // Hex strings in TJ arrays
    const hexTjArrayRe = /\[([^\]]*)\]\s*TJ/g;
    while (true) {
      t = hexTjArrayRe.exec(data);
      if (t === null) break;
      const hexParts = t[1].match(/<([\dA-Fa-f]+)>/g);
      if (hexParts)
        hexParts.forEach((h) => {
          const code = parseInt(h.slice(1, -1), 16);
          text += cmap[code] ? String.fromCodePoint(cmap[code]) : String.fromCodePoint(0xff_fd);
        });
    }
  }

  return text.replace(/[ \t\n\r\f\v]+/g, " ").trim();
}

/**
 * Write a text string to a file
 * @param filePath
 * @param content
 */
function writeFileText(filePath, content) {
  const absPath = path.resolve(filePath);
  fs.writeFileSync(absPath, content, "utf-8");
  return absPath;
}

/**
 * Get file info (name, size, type)
 * @param filePath
 */
function getFileInfo(filePath) {
  const absPath = path.resolve(filePath);
  const stat = fs.statSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/avi",
  };
  return {
    name: path.basename(absPath),
    size: stat.size,
    type: mimeMap[ext] || "application/octet-stream",
    ext: ext,
  };
}

/**
 * Hash using Node.js crypto (replaces crypto.subtle for CLI)
 * @param algo
 * @param data
 */
async function hashNode(algo, data) {
  const hash = crypto.createHash(algo).update(data).digest();
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Load an image and return canvas ImageData (uses `canvas` npm package)
 * @param filePath
 */
function loadImageData(filePath) {
  const { createCanvas, loadImage } = require("canvas");
  return loadImage(filePath).then((img) => {
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
  });
}

/**
 * Save an ImageData to a PNG file
 * @param imageData
 * @param outputPath
 */
function saveImageData(imageData, outputPath) {
  const { createCanvas } = require("canvas");
  const c = createCanvas(imageData.width, imageData.height);
  const ctx = c.getContext("2d");
  ctx.putImageData(imageData, 0, 0);
  const buf = c.toBuffer("image/png");
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

/**
 * Format bytes to human-readable
 * @param bytes
 */
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1_048_576).toFixed(1) + " MB";
}

/**
 * Output results — prints to console and optionally saves to file
 * @param text
 * @param opts
 */
function outputResult(text, opts) {
  if (opts.json) {
    console.log(text);
  } else {
    console.log(text);
  }
  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), typeof text === "string" ? text : JSON.stringify(text, null, 2));
    console.log(`\nResults saved to: ${opts.output}`);
  }
}

// ── File Validation (mirrors web shared.js) ──

const BLOCKED_EXTS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".ps1",
  ".psm1",
  ".psd1",
  ".py",
  ".pyc",
  ".rb",
  ".pl",
  ".sh",
  ".bash",
  ".dll",
  ".sys",
  ".ocx",
  ".app",
  ".jar",
  ".msu",
  ".msp",
  ".reg",
  ".inf",
  ".gadget",
  ".cpl",
  ".mst",
  ".hta",
  ".ws",
  ".vb",
  ".vba",
  ".swf",
  ".action",
  ".epub",
  ".xps",
  ".oxps",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  ".svg",
  ".svgz",
];

const MAGIC_BYTES = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  ],
  "image/webp": (buf) => {
    if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return false;
    if (buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50) return false;
    return true;
  },
  "image/bmp": [[0x42, 0x4d]],
  "image/tiff": [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
  "image/svg+xml": (buf) => {
    var s = "";
    for (let i = 0; i < Math.min(50, buf.length); i++) s += String.fromCharCode(buf[i]);
    s = s.toLowerCase();
    return s.includes("<svg") || s.includes("<?xml");
  },
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "audio/mpeg": [
    [0x49, 0x44, 0x33],
    [0xff, 0xfb],
    [0xff, 0xf3],
    [0xff, 0xf2],
  ],
  "audio/wav": (buf) => {
    if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return false;
    if (buf[8] !== 0x57 || buf[9] !== 0x41 || buf[10] !== 0x56 || buf[11] !== 0x45) return false;
    return true;
  },
  "audio/flac": [[0x66, 0x4c, 0x61, 0x43]],
  "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]],
  "video/mp4": (buf) => {
    if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
    return true;
  },
  "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]],
  "video/avi": (buf) => {
    if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return false;
    if (buf[8] !== 0x41 || buf[9] !== 0x56 || buf[10] !== 0x49 || buf[11] !== 0x20) return false;
    return true;
  },
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
  { pattern: /\/JavaScript[\s<]/i, label: "embedded JavaScript" },
  { pattern: /\/JS\s+\d+\s+0\s+R/i, label: "embedded JavaScript" },
  { pattern: /\/OpenAction[\s<]/i, label: "auto-execute action" },
  { pattern: /\/Launch[\s<]/i, label: "launch external app" },
];

/**
 *
 * @param fileName
 */
function isDangerousExt(fileName) {
  var name = path.basename(fileName).toLowerCase();
  var i;
  for (i = 0; i < BLOCKED_EXTS.length; i++) {
    if (name.endsWith(BLOCKED_EXTS[i])) return true;
  }
  return false;
}

/**
 *
 * @param data
 * @param mimeType
 */
function checkMagicBytes(data, mimeType) {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true;
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof expected === "function") return expected(arr);
  for (let m = 0; m < expected.length; m++) {
    const sig = expected[m];
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (arr[i] !== sig[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/**
 *
 * @param data
 */
function hasDangerousContent(data) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dec = new TextDecoder("utf-8", { fatal: false });
  const s = dec.decode(arr.slice(0, 4096));
  var i;
  for (i = 0; i < DANGEROUS_PATTERNS.length; i++) {
    if (DANGEROUS_PATTERNS[i].test(s)) return true;
  }
  return false;
}

/**
 *
 * @param data
 */
function checkDocumentThreats(data) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dec = new TextDecoder("utf-8", { fatal: false });
  const s = dec.decode(arr);
  const maxSize = 10 * 1024 * 1024;
  if (s.length > maxSize)
    return {
      safe: false,
      reason: `PDF exceeds 10MB limit (${(s.length / 1024 / 1024).toFixed(1)}MB)`,
    };
  for (let i = 0; i < DOC_THREAT_PATTERNS.length; i++) {
    if (DOC_THREAT_PATTERNS[i].pattern.test(s)) {
      return { safe: false, reason: DOC_THREAT_PATTERNS[i].label };
    }
  }
  return { safe: true };
}

/**
 *
 * @param data
 * @param ext
 */
function checkFileStructure(data, ext) {
  const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
  switch (ext) {
    case ".png": {
      if (arr.length < 12) return { safe: false, reason: "File too small to be valid PNG" };
      const iend = arr.slice(-12);
      if (iend[4] !== 0x49 || iend[5] !== 0x45 || iend[6] !== 0x4e || iend[7] !== 0x44)
        return {
          safe: false,
          reason: "Invalid PNG: missing IEND chunk (possible appended data)",
        };

      break;
    }
    case ".jpg":
    case ".jpeg": {
      if (arr.length < 2) return { safe: false, reason: "File too small" };
      if (arr.at(-2) !== 0xff || arr.at(-1) !== 0xd9)
        return {
          safe: false,
          reason: "Invalid JPEG: missing EOI marker (FF D9)",
        };

      break;
    }
    case ".gif": {
      if (arr.length < 1) return { safe: false, reason: "File too small" };
      if (arr.at(-1) !== 0x3b) return { safe: false, reason: "Invalid GIF: missing trailer (0x3B)" };

      break;
    }
    // No default
  }
  return { safe: true };
}

const DANGEROUS_MAGIC = [
  { sig: [0x4d, 0x5a], name: "PE executable (exe/dll/sys)" },
  { sig: [0x7f, 0x45, 0x4c, 0x46], name: "ELF executable" },
  { sig: [0xca, 0xfe, 0xba, 0xbe], name: "Mach-O executable" },
  { sig: [0xfe, 0xed, 0xfa, 0xce], name: "Mach-O executable" },
  { sig: [0xce, 0xfa, 0xed, 0xfe], name: "Mach-O executable" },
  { sig: [0xcf, 0xfa, 0xed, 0xfe], name: "Mach-O x86_64" },
  { sig: [0x4d, 0x53, 0x43, 0x46], name: "CAB archive" },
];

/**
 *
 * @param buf
 */
function hasDangerousMagic(buf) {
  var i;
  var sig;
  var match;
  var j;
  for (i = 0; i < DANGEROUS_MAGIC.length; i++) {
    sig = DANGEROUS_MAGIC[i].sig;
    match = true;
    for (j = 0; j < sig.length; j++) {
      if (buf[j] !== sig[j]) {
        match = false;
        break;
      }
    }
    if (match) return DANGEROUS_MAGIC[i].name;
  }
  if (buf[0] === 0x23 && buf[1] === 0x21) return "script with shebang";
  return null;
}

/**
 *
 * @param fileName
 */
function fileHasExt(fileName) {
  var dot = fileName.lastIndexOf(".");
  return dot > 0 && dot < fileName.length - 1;
}

/**
 *
 * @param filePath
 * @param options
 */
function validateFile(filePath, options) {
  const opts = options || {};
  const absPath = path.resolve(filePath);
  var raw = null;
  var magic = null;
  if (!fs.existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  const ext = path.extname(absPath).toLowerCase();
  const fileName = path.basename(absPath);

  // 1. Extension blocklist
  if (!opts.allowDangerous && isDangerousExt(fileName)) {
    throw new Error(`Blocked dangerous file type: ${ext} (${fileName}). Use --allow-dangerous to override.`);
  }

  // 1b. Check files without extension by magic bytes
  if (!opts.allowDangerous && !fileHasExt(fileName)) {
    raw = fs.readFileSync(absPath).slice(0, 64);
    magic = hasDangerousMagic(raw);
    if (magic) {
      throw new Error(
        `Blocked dangerous file type detected by magic bytes: ${magic} (${fileName}). Use --allow-dangerous to override.`,
      );
    }
  }

  const data = fs.readFileSync(absPath);
  const info = getFileInfo(filePath);

  // 2. Magic bytes check
  if (info.type !== "application/octet-stream" && !checkMagicBytes(data, info.type)) {
    throw new Error(
      `Magic bytes mismatch for ${fileName}: declared type ${info.type} doesn't match actual file content`,
    );
  }
  if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg"].includes(ext) &&
    hasDangerousContent(data)
  ) {
    throw new Error(`Dangerous content detected in ${fileName}: embedded scripts or code patterns found`);
  }

  // 4. File structure integrity
  const structResult = checkFileStructure(data, ext);
  if (!structResult.safe) {
    throw new Error(`Structure check failed for ${fileName}: ${structResult.reason}`);
  }

  return data;
}

module.exports = {
  readFileBytes,
  readFileText,
  readDocumentText,
  writeFileText,
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
 * @param buf
 */
function stripC2PA(buf) {
  if (buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return buf;
  const parts = [buf.slice(0, 8)];
  let i = 8;
  while (i <= buf.length - 12) {
    const len = buf.readUInt32BE(i);
    const name = buf.slice(i + 4, i + 8).toString("ascii");
    if (name !== "c2pa") parts.push(buf.slice(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(parts);
}
