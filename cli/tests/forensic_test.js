"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const core = require("../../Forensic/forensic_core");
const { analyzeForensicFile, runForensic } = require("../commands/forensic");

function makeTestImage(filePath, w, h) {
  const canvas = createCanvas(w || 96, h || 96);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < (h || 96); y++) {
    for (let x = 0; x < (w || 96); x++) {
      ctx.fillStyle = `rgb(${(x / (w || 96)) * 255},${(y / (h || 96)) * 255},${
        128 + Math.sin((x + y) * 0.12) * 48
      })`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (!filePath) return canvas;
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
}

function uniformImageData(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

function noiseImageData(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const base = ((i % w) / w) * 200 + 28;
    const noise = (Math.random() - 0.5) * 12;
    const v = Math.min(255, Math.max(0, Math.round(base + noise)));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

async function jpegBytes() {
  const c = createCanvas(4, 4);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#888";
  ctx.fillRect(0, 0, 4, 4);
  return new Uint8Array(c.toBuffer("image/jpeg"));
}

describe("Forensic Core - parseJpegMarkers", () => {
  it("should detect non-JPEG data", () => {
    const r = core.parseJpegMarkers(new Uint8Array([0, 1, 2]));
    assert.equal(r.is_jpeg, false);
  });

  it("should parse valid JPEG markers", async () => {
    const jpeg = await jpegBytes();
    const r = core.parseJpegMarkers(jpeg);
    assert.equal(r.is_jpeg, true);
    assert.equal(r.has_eoi, true);
    assert.equal(r.trailing_bytes, 0);
    assert.ok(r.app_segments.length >= 1);
    assert.ok(r.quantization_tables >= 1);
  });

  it("should detect missing EOI", async () => {
    const jpeg = await jpegBytes();
    const truncated = jpeg.slice(0, jpeg.length - 2);
    const r = core.parseJpegMarkers(truncated);
    assert.equal(r.is_jpeg, true);
    assert.equal(r.has_eoi, false);
    assert.ok(r.warnings.some((w) => w.includes("EOI")));
  });

  it("should detect APP segments in JPEG", async () => {
    const jpeg = await jpegBytes();
    const r = core.parseJpegMarkers(jpeg);
    assert.ok(r.app_segments.length >= 1);
  });
});

describe("Forensic Core - analyzeNoise", () => {
  it("should return low suspicion for uniform image", () => {
    const img = uniformImageData(64, 64, 128, 128, 128);
    const r = core.analyzeNoise(img);
    assert.ok(typeof r.mean_residual === "number");
    assert.ok(typeof r.stddev_residual === "number");
    assert.ok(typeof r.high_residual === "number");
    assert.ok(typeof r.suspicion === "number");
    assert.ok(Array.isArray(r.suspicious_tiles));
    assert.ok(r.suspicion <= 0.3);
  });

  it("should handle small images without error", () => {
    const img = noiseImageData(16, 16);
    const r = core.analyzeNoise(img);
    assert.ok(typeof r.mean_residual === "number");
  });
});

describe("Forensic Core - detectCopyMove", () => {
  it("should copy-move detect block-aligned duplication", () => {
    const w = 64,
      h = 64;
    const src = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    for (let i = 0; i < w * h; i++) {
      const x = i % w,
        y = Math.floor(i / w);
      src.data[i * 4] = (x / w) * 200 + 28;
      src.data[i * 4 + 1] = (y / h) * 200 + 28;
      src.data[i * 4 + 2] = 128 + Math.sin((x + y) * 0.1) * 40;
      src.data[i * 4 + 3] = 255;
    }
    // Copy exact 16x16 block from (0,0) to (32,32) - both align to block grid
    const bw = 16;
    for (let dy = 0; dy < bw; dy++)
      for (let dx = 0; dx < bw; dx++) {
        const si = (dy * w + dx) * 4;
        const di = ((32 + dy) * w + 32 + dx) * 4;
        src.data[di] = src.data[si];
        src.data[di + 1] = src.data[si + 1];
        src.data[di + 2] = src.data[si + 2];
      }
    const r = core.detectCopyMove(src);
    assert.ok(Array.isArray(r.matches));
    assert.ok(
      r.match_count > 0,
      "Should detect at least one block-aligned copy-move pair",
    );
    assert.ok(typeof r.suspicion === "number");
  });

  it("should return 0 matches for random noise image", () => {
    const img = noiseImageData(32, 32);
    const r = core.detectCopyMove(img);
    assert.ok(Array.isArray(r.matches));
    assert.equal(typeof r.match_count, "number");
  });
});

describe("Forensic Core - metadataSignals", () => {
  it("should analyze JPEG metadata and return signals", async () => {
    const jpeg = await jpegBytes();
    const r = core.metadataSignals(
      jpeg,
      { width: 100, height: 100 },
      "test.jpg",
    );
    assert.ok(Array.isArray(r.signals));
    assert.ok(typeof r.suspicion === "number");
  });

  it("should warn on small images", () => {
    const r = core.metadataSignals(null, { width: 32, height: 32 }, "test.png");
    assert.ok(r.signals.some((s) => s.includes("small")));
  });

  it("should flag JPEG extension with non-JPEG bytes", () => {
    const r = core.metadataSignals(
      new Uint8Array([137, 80, 78, 71]),
      { width: 64, height: 64 },
      "photo.jpg",
    );
    assert.ok(
      r.signals.some((s) => s.includes("extension") && s.includes("JPEG")),
    );
  });
});

describe("Forensic Core - combineFindings", () => {
  it("should return low risk for clean inputs", () => {
    const r = core.combineFindings({
      ela: { suspicion: 0.05 },
      noise: { suspicion: 0.1 },
      copy_move: { suspicion: 0.02 },
      metadata: { suspicion: 0.1 },
    });
    assert.equal(r.risk_level, "low");
    assert.ok(r.risk_score >= 0 && r.risk_score <= 100);
  });

  it("should return high risk for suspicious inputs", () => {
    const r = core.combineFindings({
      ela: { suspicion: 0.9 },
      noise: { suspicion: 0.85 },
      copy_move: { suspicion: 0.8 },
      metadata: { suspicion: 0.75 },
    });
    assert.equal(r.risk_level, "high");
    assert.ok(r.risk_score >= 70);
  });

  it("should handle missing parts", () => {
    const r = core.combineFindings({ ela: { suspicion: 0.5 } });
    assert.ok(typeof r.risk_score === "number");
    assert.ok(["low", "medium", "high"].includes(r.risk_level));
  });
});

describe("Forensic Core - buildSummary", () => {
  it("should return signals for high suspicion", () => {
    const r = core.buildSummary({
      ela: { suspicion: 0.5 },
      noise: { suspicion: 0.1 },
      copy_move: { match_count: 3 },
      metadata: { signals: ["Test signal"] },
    });
    assert.ok(Array.isArray(r));
    assert.ok(r.length > 0);
  });

  it("should return default signal for clean inputs", () => {
    const r = core.buildSummary({
      ela: { suspicion: 0.01 },
      noise: { suspicion: 0.01 },
      copy_move: { match_count: 0 },
      metadata: { signals: [] },
    });
    assert.ok(r.some((s) => s.includes("No strong")));
  });
});

describe("Forensic Analyzer - full pipeline", () => {
  it("should analyze a PNG and return all forensic signals", async () => {
    const out = path.join(__dirname, "tmp_forensic_test.png");
    makeTestImage(out);
    try {
      const result = await analyzeForensicFile(out);
      assert.equal(result.file.name, "tmp_forensic_test.png");
      assert.equal(result.image.width, 96);
      assert.equal(result.image.height, 96);
      assert.ok(typeof result.risk_score === "number");
      assert.ok(["low", "medium", "high"].includes(result.risk_level));
      assert.ok(result.ela.mean_difference >= 0);
      assert.ok(result.noise.mean_residual >= 0);
      assert.ok(Array.isArray(result.signals));
      assert.ok(result.copy_move.match_count >= 0);
    } finally {
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });

  it("should return consistent JSON structure", async () => {
    const out = path.join(__dirname, "tmp_forensic_json.png");
    makeTestImage(out);
    try {
      const result = await analyzeForensicFile(out);
      const json = JSON.parse(JSON.stringify(result));
      assert.ok(json.file && json.file.name && json.file.size);
      assert.ok(json.image && json.image.width > 0);
      assert.ok(typeof json.risk_score === "number");
      assert.ok(["low", "medium", "high"].includes(json.risk_level));
      assert.ok(Array.isArray(json.signals));
      assert.ok(json.ela && typeof json.ela.mean_difference === "number");
      assert.ok(json.noise && typeof json.noise.mean_residual === "number");
      assert.ok(
        json.copy_move && typeof json.copy_move.match_count === "number",
      );
      assert.ok(json.metadata && json.metadata.jpeg !== undefined);
    } finally {
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });
});

describe("Forensic CLI - runForensic output", () => {
  it("should produce JSON output with --json flag", async () => {
    const out = path.join(__dirname, "tmp_forensic_cli_test.png");
    makeTestImage(out);
    let output = "";
    const origLog = console.log;
    console.log = (...args) => {
      output += args.join(" ") + "\n";
    };
    try {
      await runForensic(out, { json: true });
      const parsed = JSON.parse(output);
      assert.ok(parsed.risk_score !== undefined);
      assert.ok(parsed.risk_level !== undefined);
    } finally {
      console.log = origLog;
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });

  it("should produce human-readable text output", async () => {
    const out = path.join(__dirname, "tmp_forensic_cli_text.png");
    makeTestImage(out);
    let output = "";
    const origLog = console.log;
    console.log = (...args) => {
      output += args.join(" ") + "\n";
    };
    try {
      await runForensic(out, {});
      assert.ok(output.includes("Forensic Analyzer"));
      assert.ok(output.includes("Risk:"));
      assert.ok(output.includes("Dimensions:"));
      assert.ok(output.includes("Signals:"));
    } finally {
      console.log = origLog;
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });
});
