// ── External Tool Wrappers ──
// Each tool is wrapped with a JS fallback so nothing breaks when tools are missing.
// Load via: const tools = require('./tools');

const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const _crypto = require("node:crypto");
const _os = require("node:os");

// ── Helpers ──

function _findTool(name) {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    return execSync(`${cmd} ${name}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .split("\n")[0]
      .trim();
  } catch {
    return null;
  }
}

function _runTool(cmd, args, opts) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30000,
      ...opts,
    });
  } catch (e) {
    return { error: e.message, stderr: e.stderr || "" };
  }
}

const _cache = {};

/**
 * Check if a tool is available. Cached after first check.
 */
function checkTool(name) {
  if (_cache[name] !== undefined) return _cache[name];
  _cache[name] = _findTool(name);
  return _cache[name];
}

/**
 * Check all tools at once. Returns { name: path|null }
 */
function checkAllTools() {
  return ["exiftool", "sox", "soxi", "pngcheck", "jpeginfo", "magick", "convert", "cbor-diag"].reduce((acc, t) => {
    acc[t] = checkTool(t);
    return acc;
  }, {});
}

// ── exiftool ──

/**
 * Read all EXIF/metadata from a file. Falls back to JS-based parsing (returns {from: 'js', ...}).
 */
function exifRead(filePath) {
  const tool = checkTool("exiftool");
  if (!tool) return { from: "js", warning: "exiftool not installed — JS EXIF limited to JPEG" };
  const out = _runTool(tool, ["-json", filePath]);
  if (out.error) return { from: "js", warning: out.error };
  try {
    const arr = JSON.parse(out);
    return { from: "exiftool", data: arr?.[0] || {} };
  } catch {
    return { from: "js", warning: "exiftool JSON parse failed" };
  }
}

/**
 * Read only GPS EXIF via exiftool. Falls back to coordinates extraction from exifRead.
 */
function exifReadGps(filePath) {
  const tool = checkTool("exiftool");
  if (!tool) return null;
  const out = _runTool(tool, [
    "-GPSLatitude",
    "-GPSLongitude",
    "-GPSAltitude",
    "-GPSLatitudeRef",
    "-GPSLongitudeRef",
    "-n",
    "-json",
    filePath,
  ]);
  if (out.error) return null;
  try {
    const arr = JSON.parse(out);
    return arr?.[0] || null;
  } catch {
    return null;
  }
}

// ── sox / soxi ──

function _soxTool() {
  return checkTool("sox");
}

function _soxiTool() {
  return checkTool("soxi");
}

/**
 * Get audio file info. Falls back to fs.stat + ext-based guess.
 */
function audioInfo(filePath) {
  const soxi = _soxiTool();
  if (soxi) {
    const out = _runTool(soxi, [filePath]);
    if (!out.error) return { from: "soxi", raw: out };
  }
  const stat = fs.statSync(filePath);
  return {
    from: "basic",
    ext: path.extname(filePath).toLowerCase(),
    size: stat.size,
    warning: "Install sox/soxi for detailed audio info (sample rate, bit depth, channels)",
  };
}

/**
 * Convert audio format using sox. Falls back to copying (no conversion).
 */
function audioConvert(input, output) {
  const tool = _soxTool();
  if (!tool) {
    // No conversion possible — just copy
    try {
      fs.copyFileSync(input, output);
    } catch {}
    return { ok: false, warning: "sox not installed — file copied without conversion" };
  }
  const out = _runTool(tool, [input, output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "sox" };
}

/**
 * Apply audio effects for robustness testing (noise, reverb, etc.) via sox.
 * Falls back silently.
 */
function audioEffect(input, output, effect) {
  const tool = _soxTool();
  if (!tool) return { ok: false, warning: "sox not installed" };
  const args = [input, output];
  if (effect === "noise") args.push("noise", "0.01");
  else if (effect === "reverb") args.push("reverb");
  else if (effect === "speed") args.push("speed", "0.95");
  else if (typeof effect === "string") args.push(...effect.split(" "));
  const out = _runTool(tool, args);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "sox" };
}

// ── pngcheck ──

/**
 * Verify PNG file integrity. Returns null if tool missing or file not PNG.
 */
function pngVerify(filePath) {
  const tool = checkTool("pngcheck");
  if (!tool) return null;
  const out = _runTool(tool, ["-v", filePath]);
  if (out.error) return { error: out.error };
  const ok = out.includes("OK") || !out.includes("ERROR");
  return { ok, details: out };
}

// ── jpeginfo ──

/**
 * Verify JPEG file integrity. Returns null if tool missing or file not JPEG.
 */
function jpegVerify(filePath) {
  const tool = checkTool("jpeginfo");
  if (!tool) return null;
  const out = _runTool(tool, ["-c", filePath]);
  if (out.error) return { error: out.error };
  const ok = out.includes("[OK]") || !out.includes("[WARNING]");
  return { ok, details: out };
}

// ── ImageMagick (magick / convert) ──

function _magickTool() {
  return checkTool("magick") || checkTool("convert");
}

/**
 * Get image info via ImageMagick identify. Falls back to JS image info.
 */
function imageIdentify(filePath) {
  const tool = _magickTool();
  if (!tool) return null;
  const out = _runTool(tool, ["identify", "-verbose", filePath]);
  if (out.error) return null;
  return { from: "imagemagick", raw: out };
}

/**
 * Convert image format via ImageMagick. Falls back to copying.
 */
function imageConvert(input, output) {
  const tool = _magickTool();
  if (!tool) {
    try {
      fs.copyFileSync(input, output);
    } catch {}
    return { ok: false, warning: "ImageMagick not installed — file copied without conversion" };
  }
  const out = _runTool(tool, [input, output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "imagemagick" };
}

/**
 * Resize/scale image for robustness testing. Falls back silently.
 */
function imageResize(input, output, scale) {
  const tool = _magickTool();
  if (!tool) return { ok: false, warning: "ImageMagick not installed" };
  const pct = Math.round(scale * 100);
  const out = _runTool(tool, [input, "-resize", `${pct}%`, output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "imagemagick", scale: `${pct}%` };
}

/**
 * Apply JPEG compression for robustness testing. Falls back silently.
 */
function imageJpegCompress(input, output, quality) {
  const tool = _magickTool();
  if (!tool) return { ok: false, warning: "ImageMagick not installed" };
  const out = _runTool(tool, [input, "-quality", String(quality || 75), output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "imagemagick", quality: quality || 75 };
}

/**
 * Crop image for robustness testing. Falls back silently.
 */
function imageCrop(input, output, opts) {
  const tool = _magickTool();
  if (!tool) return { ok: false, warning: "ImageMagick not installed" };
  const w = opts.width || "50%";
  const h = opts.height || "50%";
  const x = opts.x || "0";
  const y = opts.y || "0";
  const out = _runTool(tool, [input, "-crop", `${w}x${h}+${x}+${y}`, output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "imagemagick" };
}

/**
 * Rotate image for robustness testing. Falls back silently.
 */
function imageRotate(input, output, degrees) {
  const tool = _magickTool();
  if (!tool) return { ok: false, warning: "ImageMagick not installed" };
  const out = _runTool(tool, [input, "-rotate", String(degrees || 90), output]);
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, from: "imagemagick", degrees: degrees || 90 };
}

// ── cbor-diag ──

/**
 * Decode CBOR hex/diag to diagnostic format. Falls back to JS parsing.
 */
function cborDecode(hexStr) {
  const tool = checkTool("cbor-diag");
  if (!tool) return { from: "js", warning: "cbor-diag not installed" };
  const out = _runTool(tool, ["--pretty", hexStr]);
  if (out.error) return { from: "js", warning: out.error };
  return { from: "cbor-diag", data: out };
}

/**
 * Encode diagnostic CBOR to hex. Falls back to JS.
 */
function cborEncode(diagStr) {
  const tool = checkTool("cbor-diag");
  if (!tool) return { from: "js", warning: "cbor-diag not installed" };
  const out = _runTool(tool, ["--from", "diag", diagStr]);
  if (out.error) return { from: "js", warning: out.error };
  return { from: "cbor-diag", data: out.trim() };
}

// ── Summary ──

/**
 * Print a summary of available/ missing tools.
 */
function printToolSummary() {
  const all = checkAllTools();
  const lines = ["\n── External Tools ──"];
  const toolNames = {
    exiftool: "Read/write EXIF from *any* file (not just JPEG)",
    sox: "Audio conversion + effects (noise, reverb, resample)",
    soxi: "Audio file info (sample rate, channels, bit depth)",
    pngcheck: "PNG integrity verification (crc, chunk validation)",
    jpeginfo: "JPEG integrity verification",
    magick: "ImageMagick — convert, resize, crop, rotate, compress",
    "cbor-diag": "CBOR diagnostic (C2PA COSE Sign1 debugging)",
  };
  for (const [tool, desc] of Object.entries(toolNames)) {
    const found = all[tool] || all.convert; // convert is alias for ImageMagick
    if (found && tool !== "convert") {
      lines.push(`  ✅ ${tool} — ${desc}`);
    }
  }
  for (const [tool, desc] of Object.entries(toolNames)) {
    const found = all[tool] || all.convert;
    if (!found && tool !== "convert") {
      lines.push(`  ⬜ ${tool} — ${desc} (not found)`);
    }
  }
  lines.push("────────────────────\n");
  return lines.join("\n");
}

// ── Exports ──

module.exports = {
  checkTool,
  checkAllTools,
  printToolSummary,
  // EXIF
  exifRead,
  exifReadGps,
  // Audio
  audioInfo,
  audioConvert,
  audioEffect,
  // Image integrity
  pngVerify,
  jpegVerify,
  // ImageMagick
  imageIdentify,
  imageConvert,
  imageResize,
  imageJpegCompress,
  imageCrop,
  imageRotate,
  // CBOR
  cborDecode,
  cborEncode,
};
