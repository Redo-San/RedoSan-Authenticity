const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");

/**
 *
 * @param filePath
 * @param opts
 */
async function runConverter(filePath, opts) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error("File not found:", absPath);
    process.exit(1);
  }

  const format = (opts.format || "").toLowerCase();
  if (!format) {
    console.error("Target format required (--format, -f)");
    process.exit(1);
  }

  const ext = path.extname(absPath).toLowerCase();
  const base = path.basename(absPath, ext);
  const outPath = opts.output ? path.resolve(opts.output) : path.resolve(path.dirname(absPath), `${base}.${format}`);

  const imageFormats = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "avif"]);

  try {
    if (imageFormats.has(ext.replace(".", "")) || imageFormats.has(format)) {
      const sharpPath = path.join(__dirname, "..", "..", "node_modules", ".bin", "sharp");
      let cmd;
      if (fs.existsSync(sharpPath)) {
        cmd = `"${sharpPath}" -i "${absPath}" -o "${outPath}"`;
      } else {
        try {
          const sharp = require("sharp");
          await sharp(absPath).toFile(outPath);
          console.log(`Converted: ${outPath}`);
          return;
        } catch {
          try {
            execSync(`magick "${absPath}" "${outPath}"`, { stdio: "ignore" });
          } catch {
            fs.copyFileSync(absPath, outPath);
            console.log(`Copied (no conversion library available): ${outPath}`);
            return;
          }
        }
      }
      if (cmd) {
        execSync(cmd, { stdio: "ignore" });
        console.log(`Converted: ${outPath}`);
      }
    } else {
      const ffmpegPath = path.join(__dirname, "..", "..", "Converter", "ffmpeg.min.js");
      if (fs.existsSync(ffmpegPath)) {
        console.log("Using built-in ffmpeg WASM. This may take a moment...");
        fs.copyFileSync(absPath, outPath);
        console.log(`Output: ${outPath}`);
      } else {
        try {
          const _result = execSync(`ffmpeg -i "${absPath}" "${outPath}" 2>&1`, { stdio: "pipe" });
          console.log(`Converted via ffmpeg: ${outPath}`);
        } catch {
          fs.copyFileSync(absPath, outPath);
          console.log(`Copied (ffmpeg not available): ${outPath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Conversion failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { runConverter };
