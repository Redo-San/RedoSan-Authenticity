// ── CLI: Metadata Command ──
// Reuses Metadata/metadata.js EXIF parser

const path = require("node:path");
const crypto = require("node:crypto");
const { readFileBytes, getFileInfo, fmtSize, outputResult, loadImageData, validateFile } = require("../utils");

// Patch crypto.subtle for Node.js
if (globalThis.crypto === undefined || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (_algo, data) => {
        const hash = crypto.createHash("sha256").update(Buffer.from(data)).digest();
        return hash.buffer;
      },
    },
  };
}

// Polyfill window for browser JS files
if (globalThis.window === undefined) {
  globalThis.window = globalThis;
}

// Suppress BLAKE3 self-check console.log at load time
const _origLog = console.log;
const _origWarn = console.warn;
console.log = () => {};
console.warn = () => {};
try {
  const hashingPath = path.join(__dirname, "..", "..", "Fingerprint", "hashing.js");
  require(hashingPath);

  // Load metadata reading functions
  const metadataPath = path.join(__dirname, "..", "..", "Metadata", "metadata.js");
  require(metadataPath);
} finally {
  console.log = _origLog;
  console.warn = _origWarn;
}

/**
 *
 * @param filePath
 * @param opts
 */
async function runMetadata(filePath, opts) {
  const absPath = path.resolve(filePath);
  const allowDangerous = opts.allowDangerous || process.argv.includes("--allow-dangerous");

  try {
    try {
      validateFile(absPath, { allowDangerous });
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      if (error.message.includes("Blocked dangerous file type")) console.error("Use --allow-dangerous to bypass");
      process.exit(1);
    }
    const data = readFileBytes(absPath);
    const info = getFileInfo(filePath);

    // Compute SHA-256
    const sha256 = await crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");

    // Get image dimensions
    let imageInfo = {};
    try {
      const imgData = await loadImageData(absPath);
      imageInfo = {
        width: imgData.width,
        height: imgData.height,
        mode: "RGBA",
        format: info.ext.replace(".", "").toUpperCase(),
      };
    } catch (error) {
      imageInfo = { error: error.message };
    }

    // Parse EXIF (JPEG only)
    let exif = {};
    if (
      data[0] === 0xff &&
      data[1] === 0xd8 && // Call the parseJPEGExif function from metadata.js
      typeof globalThis.parseJPEGExif === "function"
    ) {
      exif = globalThis.parseJPEGExif(data) || {};
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
      text += `${"─".repeat(60)}\n\n`;

      if (imageInfo.width) {
        text += `Dimensions: ${imageInfo.width} x ${imageInfo.height}\n`;
        text += `Format: ${imageInfo.format}\n`;
        text += `Mode: ${imageInfo.mode}\n\n`;
      }

      if (Object.keys(exif).length > 0) {
        text += "EXIF:\n";
        for (const [key, val] of Object.entries(exif)) {
          text += `  ${key.padEnd(24)} ${val}\n`;
        }
      } else {
        text += "EXIF: Not found (not a JPEG or no EXIF data)\n";
      }

      outputResult(text, opts);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { runMetadata };
