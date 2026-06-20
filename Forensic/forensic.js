(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
// ── Forensic Analyzer UI ──

var forensicLastResult = null;

/**
 *
 * @param imgData
 */
function forensicCanvasFromImageData(imgData) {
  var canvas = document.createElement("canvas");
  canvas.width = imgData.width || imgData.w;
  canvas.height = imgData.height || imgData.h;
  var ctx = canvas.getContext("2d");
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 *
 * @param canvas
 * @param mime
 * @param quality
 */
function forensicBlobFromCanvas(canvas, mime, quality) {
  return new Promise(function (resolve) {
    canvas.toBlob(
      function (blob) {
        resolve(blob);
      },
      mime || "image/jpeg",
      quality == null ? 0.86 : quality,
    );
  });
}

/**
 *
 * @param blob
 */
async function forensicLoadBlobImage(blob) {
  var file = new File([blob], "forensic-recompressed.jpg", {
    type: blob.type || "image/jpeg",
  });
  return await loadImage(file);
}

/**
 *
 * @param a
 * @param b
 */
function forensicDiffImageData(a, b) {
  var w = a.width || a.w,
    h = a.height || a.h;
  var out = new ImageData(w, h);
  var scores = [];
  var max = 1;
  for (var i = 0; i < a.data.length; i += 4) {
    var d =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
    scores.push(d / 3);
    if (d / 3 > max) max = d / 3;
  }
  var avg =
    scores.reduce(function (s, v) {
      return s + v;
    }, 0) / Math.max(1, scores.length);
  var hot = 0;
  for (var p = 0; p < scores.length; p++)
    if (scores[p] > avg * 2.2 && scores[p] > 8) hot++;

  for (var j = 0; j < scores.length; j++) {
    var v = Math.min(255, Math.round((scores[j] / max) * 255 * 2.6));
    var idx = j * 4;
    out.data[idx] = v;
    out.data[idx + 1] = Math.round(v * 0.35);
    out.data[idx + 2] = 255 - v;
    out.data[idx + 3] = 255;
  }
  return {
    imageData: out,
    mean_difference: Number(avg.toFixed(3)),
    max_difference: Number(max.toFixed(3)),
    hot_pixel_ratio: Number((hot / Math.max(1, scores.length)).toFixed(4)),
    suspicion: Math.max(
      0,
      Math.min(1, avg / 24 + (hot / Math.max(1, scores.length)) * 3),
    ),
  };
}

/**
 *
 * @param imgData
 * @param noise
 */
function forensicNoiseHeatmap(imgData, noise) {
  var w = imgData.width || imgData.w,
    h = imgData.height || imgData.h;
  var out = new ImageData(w, h);
  for (var i = 0; i < out.data.length; i += 4) {
    out.data[i] = 18;
    out.data[i + 1] = 22;
    out.data[i + 2] = 30;
    out.data[i + 3] = 255;
  }
  var tiles = noise.suspicious_tiles || [];
  var max = Math.max(1, noise.high_residual || 1);
  for (var t = 0; t < tiles.length; t++) {
    var tile = tiles[t];
    var v = Math.min(255, Math.round((tile.score / max) * 255));
    for (var y = tile.y; y < tile.y + tile.h; y++) {
      for (var x = tile.x; x < tile.x + tile.w; x++) {
        var idx = (y * w + x) * 4;
        out.data[idx] = v;
        out.data[idx + 1] = Math.round(v * 0.75);
        out.data[idx + 2] = 40;
      }
    }
  }
  return out;
}

/**
 *
 * @param canvas
 * @param matches
 */
function forensicDrawMatches(canvas, matches) {
  var ctx = canvas.getContext("2d");
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 71, 87, .95)";
  ctx.fillStyle = "rgba(255, 71, 87, .12)";
  var block = 16;
  for (var i = 0; i < Math.min(matches.length, 28); i++) {
    var m = matches[i];
    ctx.strokeRect(m.x1, m.y1, block, block);
    ctx.fillRect(m.x1, m.y1, block, block);
    ctx.strokeRect(m.x2, m.y2, block, block);
    ctx.fillRect(m.x2, m.y2, block, block);
    ctx.beginPath();
    ctx.moveTo(m.x1 + block / 2, m.y1 + block / 2);
    ctx.lineTo(m.x2 + block / 2, m.y2 + block / 2);
    ctx.stroke();
  }
}

var FORENSIC_MAX_DIMENSION = 4000;

/**
 *
 * @param file
 */
async function analyzeForensics(file) {
  var img = await loadImage(file);
  if (img.w > FORENSIC_MAX_DIMENSION || img.h > FORENSIC_MAX_DIMENSION) {
    throw new Error(
      "Image dimensions (" +
        img.w +
        "x" +
        img.h +
        ") exceed maximum allowed (" +
        FORENSIC_MAX_DIMENSION +
        "px). Please use a smaller image.",
    );
  }
  var bytes = new Uint8Array(await file.arrayBuffer());
  var canvas = forensicCanvasFromImageData(img.imgData);
  var recompressedBlob = await forensicBlobFromCanvas(
    canvas,
    "image/jpeg",
    0.86,
  );
  var recompressed = await forensicLoadBlobImage(recompressedBlob);
  var ela = forensicDiffImageData(img.imgData, recompressed.imgData);
  var noise = RedoSanForensicCore.analyzeNoise(img.imgData);
  var copyMove = RedoSanForensicCore.detectCopyMove(img.imgData);
  var metadata = RedoSanForensicCore.metadataSignals(
    bytes,
    img.imgData,
    file.name,
  );
  var combined = RedoSanForensicCore.combineFindings({
    ela: ela,
    noise: noise,
    copy_move: copyMove,
    metadata: metadata,
  });
  var signals = RedoSanForensicCore.buildSummary({
    ela: ela,
    noise: noise,
    copy_move: copyMove,
    metadata: metadata,
  });

  return {
    file: { name: file.name, size: file.size, type: file.type || "unknown" },
    image: { width: img.w, height: img.h },
    risk_score: combined.risk_score,
    risk_level: combined.risk_level,
    signals: signals,
    ela: {
      mean_difference: ela.mean_difference,
      max_difference: ela.max_difference,
      hot_pixel_ratio: ela.hot_pixel_ratio,
      suspicion: Number(ela.suspicion.toFixed(3)),
    },
    noise: noise,
    copy_move: copyMove,
    metadata: metadata,
    _visuals: {
      source: img.imgData,
      ela: ela.imageData,
      noise: forensicNoiseHeatmap(img.imgData, noise),
    },
  };
}

/**
 *
 * @param level
 * @param score
 */
function forensicRiskBadge(level, score) {
  var cls = level === "high" ? "danger" : level === "medium" ? "warn" : "ok";
  var color =
    cls === "danger"
      ? "var(--danger)"
      : cls === "warn"
      ? "#f6a623"
      : "var(--success)";
  return (
    '<span style="display:inline-block;padding:6px 10px;border-radius:6px;background:' +
    color +
    "22;color:" +
    color +
    ';font-weight:700">' +
    escHtml(level.toUpperCase()) +
    " · " +
    score +
    "/100</span>"
  );
}

/**
 *
 * @param target
 * @param imgData
 * @param label
 */
function forensicRenderCanvas(target, imgData, label) {
  var wrap = document.getElementById(target);
  if (!wrap) return;
  wrap.innerHTML = "";
  var title = document.createElement("div");
  title.textContent = label;
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  var canvas = forensicCanvasFromImageData(imgData);
  canvas.style.maxWidth = "100%";
  canvas.style.border = "1px solid var(--border)";
  canvas.style.borderRadius = "8px";
  wrap.append(title);
  wrap.append(canvas);
}

/**
 *
 * @param result
 */
function renderForensicResult(result) {
  var output = document.getElementById("forensic-output");
  var dl = document.getElementById("forensic-download");
  var cmCanvas = forensicCanvasFromImageData(result._visuals.source);
  forensicDrawMatches(cmCanvas, result.copy_move.matches || []);

  var html =
    '<div class="result-success">' +
    "<strong>Forensic Risk</strong><br>" +
    forensicRiskBadge(result.risk_level, result.risk_score) +
    "</div>";
  html += '<table class="meta-table" style="margin-top:12px">';
  html += "<tr><td>File</td><td>" + escHtml(result.file.name) + "</td></tr>";
  html +=
    "<tr><td>Dimensions</td><td>" +
    result.image.width +
    " x " +
    result.image.height +
    "</td></tr>";
  html +=
    "<tr><td>ELA mean</td><td>" + result.ela.mean_difference + "</td></tr>";
  html +=
    "<tr><td>Noise residual</td><td>" +
    result.noise.mean_residual +
    " ± " +
    result.noise.stddev_residual +
    "</td></tr>";
  html +=
    "<tr><td>Copy-move matches</td><td>" +
    result.copy_move.match_count +
    "</td></tr>";
  html +=
    "<tr><td>JPEG markers</td><td>" +
    (result.metadata.jpeg && result.metadata.jpeg.is_jpeg
      ? "JPEG, APP: " +
        escHtml(result.metadata.jpeg.app_segments.join(", ") || "none")
      : "Not JPEG") +
    "</td></tr>";
  html += "</table>";
  html +=
    '<div style="margin-top:12px"><strong>Signals</strong><ul style="margin:8px 0 0 18px">';
  for (var i = 0; i < result.signals.length; i++)
    html += "<li>" + escHtml(result.signals[i]) + "</li>";
  html += "</ul></div>";
  output.innerHTML = html;

  forensicRenderCanvas("forensic-ela-map", result._visuals.ela, "ELA heatmap");
  forensicRenderCanvas(
    "forensic-noise-map",
    result._visuals.noise,
    "Noise inconsistency map",
  );
  var cmWrap = document.getElementById("forensic-copy-map");
  cmWrap.innerHTML =
    '<div style="font-weight:700;margin-bottom:8px">Copy-move regions</div>';
  cmCanvas.style.maxWidth = "100%";
  cmCanvas.style.border = "1px solid var(--border)";
  cmCanvas.style.borderRadius = "8px";
  cmWrap.append(cmCanvas);

  var publicResult = JSON.parse(JSON.stringify(result));
  delete publicResult._visuals;
  var blob = new Blob([JSON.stringify(publicResult, null, 2)], {
    type: "application/json",
  });
  var url = URL.createObjectURL(blob);
  if (getResult('forensicLastUrl')) URL.revokeObjectURL(getResult('forensicLastUrl'));
  setResult('forensicLastUrl', url);
  dl.innerHTML =
    '<a href="' +
    url +
    '" download="' +
    escHtml(result.file.name) +
    '.forensic.json" class="btn">Download JSON Report</a>';
}

/**
 *
 */
async function handleForensicAnalyze() {
  var btn = document.getElementById("forensic-btn");
  var file = await getFile("forensic-file");
  var resultDiv = document.getElementById("forensic-result");
  var output = document.getElementById("forensic-output");
  var dl = document.getElementById("forensic-download");
  if (!file) {
    resultDiv.style.display = "block";
    setText("forensic-output", "Please select an image first");
    return;
  }
  btn.disabled = true;
  spinner("forensic-spinner", true);
  resultDiv.style.display = "block";
  output.textContent =
    "Analyzing image for compression, noise, duplicated regions, and metadata inconsistencies...";
  dl.innerHTML = "";
  ["forensic-ela-map", "forensic-noise-map", "forensic-copy-map"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = "";
    },
  );
  try {
    forensicLastResult = await analyzeForensics(file);
    renderForensicResult(forensicLastResult);
  } catch (error) {
    output.innerHTML =
      '<div class="result-error">Error: ' + escHtml(error.message) + "</div>";
  } finally {
    btn.disabled = false;
    spinner("forensic-spinner", false);
  }
}
