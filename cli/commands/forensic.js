// ── CLI: Forensic Analyzer Command ──

"use strict";

const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const {
  readFileBytes,
  getFileInfo,
  fmtSize,
  outputResult,
  validateFile,
} = require("../utils");
const core = require("../../Forensic/forensic_core");

async function loadCanvasImage(filePath) {
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return {
    canvas,
    ctx,
    imageData: ctx.getImageData(0, 0, img.width, img.height),
  };
}

function elaDiff(original, recompressed) {
  const scores = [];
  let max = 1;
  for (let i = 0; i < original.data.length; i += 4) {
    const d =
      (Math.abs(original.data[i] - recompressed.data[i]) +
        Math.abs(original.data[i + 1] - recompressed.data[i + 1]) +
        Math.abs(original.data[i + 2] - recompressed.data[i + 2])) /
      3;
    scores.push(d);
    if (d > max) max = d;
  }
  const avg = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length);
  let hot = 0;
  for (const s of scores) if (s > avg * 2.2 && s > 8) hot++;
  const hotRatio = hot / Math.max(1, scores.length);
  return {
    mean_difference: Number(avg.toFixed(3)),
    max_difference: Number(max.toFixed(3)),
    hot_pixel_ratio: Number(hotRatio.toFixed(4)),
    suspicion: Math.max(0, Math.min(1, avg / 24 + hotRatio * 3)),
  };
}

const FORENSIC_MAX_DIMENSION = 4000;

async function analyzeForensicFile(absPath) {
  const info = getFileInfo(absPath);
  const bytes = readFileBytes(absPath);
  const loaded = await loadCanvasImage(absPath);
  if (
    loaded.imageData.width > FORENSIC_MAX_DIMENSION ||
    loaded.imageData.height > FORENSIC_MAX_DIMENSION
  ) {
    throw new Error(
      "Image dimensions (" +
        loaded.imageData.width +
        "x" +
        loaded.imageData.height +
        ") exceed maximum allowed (" +
        FORENSIC_MAX_DIMENSION +
        "px)",
    );
  }
  const jpegBuf = loaded.canvas.toBuffer("image/jpeg", { quality: 0.86 });
  const reloaded = await loadImage(jpegBuf);
  const rc = createCanvas(reloaded.width, reloaded.height);
  const rctx = rc.getContext("2d");
  rctx.drawImage(reloaded, 0, 0);
  const recompressed = rctx.getImageData(0, 0, reloaded.width, reloaded.height);

  const ela = elaDiff(loaded.imageData, recompressed);
  const noise = core.analyzeNoise(loaded.imageData);
  const copyMove = core.detectCopyMove(loaded.imageData);
  const metadata = core.metadataSignals(bytes, loaded.imageData, info.name);
  const combined = core.combineFindings({
    ela,
    noise,
    copy_move: copyMove,
    metadata,
  });
  const signals = core.buildSummary({
    ela,
    noise,
    copy_move: copyMove,
    metadata,
  });

  return {
    file: {
      name: info.name,
      size: info.size,
      size_human: fmtSize(info.size),
      type: info.type,
    },
    image: { width: loaded.imageData.width, height: loaded.imageData.height },
    risk_score: combined.risk_score,
    risk_level: combined.risk_level,
    signals,
    ela: {
      mean_difference: ela.mean_difference,
      max_difference: ela.max_difference,
      hot_pixel_ratio: ela.hot_pixel_ratio,
      suspicion: Number(ela.suspicion.toFixed(3)),
    },
    noise,
    copy_move: copyMove,
    metadata,
  };
}

async function runForensic(filePath, opts) {
  const absPath = path.resolve(filePath);
  const allowDangerous =
    opts.allowDangerous || process.argv.includes("--allow-dangerous");
  try {
    try {
      validateFile(absPath, { allowDangerous });
    } catch (e) {
      console.error(`Validation failed: ${e.message}`);
      if (e.message.includes("Blocked dangerous file type"))
        console.error("Use --allow-dangerous to bypass");
      process.exit(1);
    }
    const result = await analyzeForensicFile(absPath);
    if (opts.json) {
      outputResult(JSON.stringify(result, null, 2), opts);
      return;
    }
    let text = `Forensic Analyzer: ${result.file.name}\n`;
    text += `Risk: ${result.risk_level.toUpperCase()} (${
      result.risk_score
    }/100)\n`;
    text += `Dimensions: ${result.image.width} x ${result.image.height}\n`;
    text += `ELA mean difference: ${result.ela.mean_difference}\n`;
    text += `Noise residual: ${result.noise.mean_residual} ± ${result.noise.stddev_residual}\n`;
    text += `Copy-move matches: ${result.copy_move.match_count}\n`;
    text += "Signals:\n";
    for (const s of result.signals) text += `  - ${s}\n`;
    outputResult(text, opts);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { runForensic, analyzeForensicFile };
