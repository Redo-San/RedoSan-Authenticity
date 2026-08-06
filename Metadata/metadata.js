/* c8 ignore next 13 */
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
// ── Metadata reading (EXIF via DataView) + UI handler ──

/**
 *
 * @param file
 */
async function readMetadata(file) {
  var buf = await file.arrayBuffer();
  var data = new Uint8Array(buf);
  var name = file.name;
  var result = { file: name, size: data.length };

  var h = await crypto.subtle.digest("SHA-256", data);
  result.sha256 = Array.from(new Uint8Array(h))
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");

  try {
    var img = await loadImage(file);
    result.image = {
      width: img.w,
      height: img.h,
      mode: "RGBA",
      format: name.split(".").pop().toUpperCase(),
    };
  } catch (error) {
    result.error = error.message;
    return result;
  }

  if (data[0] === 0xff && data[1] === 0xd8) {
    var exif = parseJPEGExif(data);
    if (exif && Object.keys(exif).length > 0) result.exif = exif;
  }

  return result;
}

// ── JPEG EXIF parser ──
/**
 *
 * @param data
 */
function parseJPEGExif(data) {
  var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  var exif = {};
  var offset = 2;

  while (offset < data.length - 1) {
    if (view.getUint16(offset) === 0xff_e1) {
      var segLen = view.getUint16(offset + 2);
      if (offset + 4 + segLen <= data.length) {
        var exifStart = offset + 4;
        var exifHeader = String.fromCharCode.apply(
          null,
          data.slice(exifStart, exifStart + 6),
        );
        if (exifHeader === "Exif\0\0") {
          var tiffStart = exifStart + 6;
          var endian = view.getUint16(tiffStart);
          var littleEndian = endian === 0x49_49;
          var get16 = function (off) {
            return littleEndian
              ? view.getUint16(off, true)
              : view.getUint16(off, false);
          };
          var get32 = function (off) {
            return littleEndian
              ? view.getUint32(off, true)
              : view.getUint32(off, false);
          };

          if (get16(tiffStart + 2) !== 0x00_2a) break;
          var ifd0Off = get32(tiffStart + 4);
          if (ifd0Off > 0 && tiffStart + ifd0Off < data.length) {
            parseIFD(tiffStart, ifd0Off, exif, get16, get32, view, data);
          }
        }
      }
      break;
    }
    offset++;
  }
  return exif;
}

var EXIF_TAGS = {
  0x01_0f: "Make",
  0x01_10: "Model",
  0x01_32: "DateTimeOriginal",
  0x01_0e: "ImageDescription",
  0x01_12: "Orientation",
  0x01_1a: "XResolution",
  0x01_1b: "YResolution",
  0x01_28: "ResolutionUnit",
  0x01_31: "Software",
  0x02_13: "YCbCrPositioning",
  0x87_69: "ExifOffset",
  0x88_25: "GPSInfo",
  0x82_9a: "ExposureTime",
  0x82_9d: "FNumber",
  0x88_22: "ExposureProgram",
  0x88_27: "ISOSpeedRatings",
  0x90_03: "DateTimeOriginal",
  0x90_04: "DateTimeDigitized",
  0x92_01: "ShutterSpeedValue",
  0x92_02: "ApertureValue",
  0x92_04: "ExposureBiasValue",
  0x92_07: "MeteringMode",
  0x92_08: "LightSource",
  0x92_09: "Flash",
  0x92_0a: "FocalLength",
  0xa0_02: "PixelXDimension",
  0xa0_03: "PixelYDimension",
  0xa2_0e: "FocalPlaneXResolution",
  0xa2_0f: "FocalPlaneYResolution",
  0xa2_10: "FocalPlaneResolutionUnit",
  0xa4_01: "CustomRendered",
  0xa4_02: "ExposureMode",
  0xa4_03: "WhiteBalance",
  0xa4_04: "DigitalZoomRatio",
  0xa4_05: "FocalLengthIn35mmFilm",
  0xa4_06: "SceneCaptureType",
  0xa4_07: "GainControl",
  0xa4_08: "Contrast",
  0xa4_09: "Saturation",
  0xa4_0a: "Sharpness",
};

/**
 *
 * @param tiffStart
 * @param offset
 * @param exif
 * @param get16
 * @param get32
 * @param view
 * @param data
 */
function parseIFD(tiffStart, offset, exif, get16, get32, view, data) {
  var num = get16(tiffStart + offset);
  for (var i = 0; i < num; i++) {
    var entryOff = tiffStart + offset + 2 + i * 12;
    var tag = get16(entryOff);
    var type = get16(entryOff + 2);
    var count = get32(entryOff + 4);
    var valOff = entryOff + 8;

    var val;
    if (type === 2 && count <= 4) {
      val = String.fromCharCode.apply(
        null,
        data.slice(valOff, valOff + count - 1),
      );
    } else
      switch (type) {
        case 2: {
          var strOff = get32(valOff);
          if (strOff > 0 && tiffStart + strOff + count <= data.length)
            val = String.fromCharCode.apply(
              null,
              data.slice(tiffStart + strOff, tiffStart + strOff + count - 1),
            );

          break;
        }
        case 3: {
          val = get16(valOff);

          break;
        }
        case 4: {
          val = get32(valOff);

          break;
        }
        case 5: {
          var numOff = get32(valOff);
          if (numOff + 8 <= data.length - tiffStart) {
            val = get32(tiffStart + numOff) / get32(tiffStart + numOff + 4);
          }

          break;
        }
        case 7: {
          val = data.slice(valOff, valOff + Math.min(count, 32));

          break;
        }
        // No default
      }

    if (val !== undefined && EXIF_TAGS[tag]) {
      var s = String(val);
      if (s.length > 200) s = s.substring(0, 197) + "...";
      exif[EXIF_TAGS[tag]] = s;
    }
  }

  var nextOff = get32(tiffStart + offset + 2 + num * 12);
  if (nextOff > 0 && tiffStart + nextOff < data.length && nextOff > offset) {
    parseIFD(tiffStart, nextOff, exif, get16, get32, view, data);
  }
}

// ── Metadata tab handler ──
/**
 *
 */
/* c8 ignore start */
/**
 *
 */
async function handleReadMetadata() {
  const btn = document.getElementById("md-btn");
  const resultDiv = document.getElementById("md-result");
  const output = document.getElementById("md-output");
  const dl = document.getElementById("md-download");

  const file = await getFile("md-file");
  if (!file) {
    setText("md-output", __("md.select_image", "Please select an image"));
    resultDiv.style.display = "block";
    return;
  }

  btn.disabled = true;
  spinner("md-spinner", true);
  resultDiv.style.display = "none";
  dl.innerHTML = "";
  setText("md-output", __("shared.processing", "Processing..."));

  try {
    const result = await readMetadata(file);

    setResult("mdResult", result);
    setDownloadHandler(downloadMetadata);

    let html = '<table class="meta-table">';
    html +=
      "<tr><td>" +
      __("md.label_file", "File") +
      "</td><td>" +
      escHtml(result.file) +
      "</td></tr>";
    html +=
      "<tr><td>" +
      __("md.label_size", "Size") +
      "</td><td>" +
      (result.size / 1024).toFixed(1) +
      " KB</td></tr>";
    html +=
      "<tr><td>SHA-256</td><td><code>" + result.sha256 + "</code></td></tr>";
    if (result.image) {
      html +=
        "<tr><td>" +
        __("md.label_dimensions", "Dimensions") +
        "</td><td>" +
        result.image.width +
        " x " +
        result.image.height +
        "</td></tr>";
      html +=
        "<tr><td>" +
        __("md.label_mode", "Mode") +
        "</td><td>" +
        result.image.mode +
        "</td></tr>";
      html +=
        "<tr><td>" +
        __("md.label_format", "Format") +
        "</td><td>" +
        escHtml(result.image.format) +
        "</td></tr>";
    }
    if (result.exif) {
      html +=
        '<tr><td colspan="2" style="font-weight:700;padding-top:12px">' +
        __("md.label_exif", "EXIF") +
        "</td></tr>";
      for (const [k, v] of Object.entries(result.exif)) {
        if (v && v !== "0")
          html +=
            '<tr><td style="padding-left:12px">' +
            escHtml(k) +
            "</td><td>" +
            escHtml(v) +
            "</td></tr>";
      }
    }
    if (result.error) {
      html +=
        '<tr><td style="color:var(--danger)">' +
        __("md.label_error", "Error") +
        "</td><td>" +
        escHtml(result.error) +
        "</td></tr>";
    }
    html += "</table>";
    // codeql[js/xss-through-dom] — all values are HTML-escaped via escHtml()
    output.innerHTML = html;

    dl.innerHTML =
      '<button class="btn" onclick="showDownloadModal()">' +
      __("md.download", "Download Report") +
      "</button>";
  } catch (error) {
    setText("md-output", __("shared.error_prefix", "Error: ") + error.message);
  }
  resultDiv.style.display = "block";
  btn.disabled = false;
  spinner("md-spinner", false);
}
/* c8 ignore stop */

// ── Multi-format download for metadata ──

/**
 *
 * @param format
 */
function downloadMetadata(format) {
  closeDownloadModal();
  var r = getResult("mdResult");
  if (!r) return;

  var name = r.file.replace(/\.[^.]+$/, "") || "metadata";

  if (format === "pdf") {
    mdToPDF(r, name);
    return;
  }
  if (format === "doc") {
    mdToDOCX(r, name);
    return;
  }

  var content, ext, mime;
  switch (format) {
    case "json": {
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    }
    case "csv": {
      content = mdToCSV(r);
      ext = "csv";
      mime = "text/csv";
      break;
    }
    case "txt": {
      content = mdToTXT(r);
      ext = "txt";
      mime = "text/plain";
      break;
    }
    case "xml": {
      content = mdToXML(r);
      ext = "xml";
      mime = "application/xml";
      break;
    }
    case "html": {
      content = mdToHTML(r);
      ext = "html";
      mime = "text/html";
      break;
    }
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, name + ".metadata." + ext);
}

/**
 *
 * @param r
 */
function mdToCSV(r) {
  var lines = ["Property,Value"];
  var add = function (k, v) {
    lines.push(k + "," + _csvEsc(v));
  };
  add("File", r.file);
  add("Size (KB)", (r.size / 1024).toFixed(1));
  add("SHA-256", r.sha256);
  if (r.image) {
    add("Dimensions", r.image.width + " x " + r.image.height);
    add("Mode", r.image.mode);
    add("Format", r.image.format);
  }
  if (r.exif) for (var k in r.exif) add(k, r.exif[k]);
  return lines.join("\n");
}

/**
 *
 * @param v
 */
function _csvEsc(v) {
  if (v == null) return "";
  v = String(v);
  return v.includes(",") || v.includes('"') || v.includes("\n")
    ? '"' + v.replace(/"/g, '""') + '"'
    : v;
}

/**
 *
 * @param r
 */
function mdToTXT(r) {
  var lines = [];
  var add = function (k, v) {
    lines.push(k + ": " + v);
  };
  add("File", r.file);
  add("Size (KB)", (r.size / 1024).toFixed(1));
  add("SHA-256", r.sha256);
  if (r.image) {
    add("Dimensions", r.image.width + " x " + r.image.height);
    add("Mode", r.image.mode);
    add("Format", r.image.format);
  }
  if (r.exif) for (var k in r.exif) add(k, r.exif[k]);
  return lines.join("\n");
}

/**
 *
 * @param r
 */
function mdToXML(r) {
  var x = '<?xml version="1.0" encoding="UTF-8"?>\n<metadata>\n';
  x += "  <file>" + _xmlEsc(r.file) + "</file>\n";
  x += "  <size_kb>" + (r.size / 1024).toFixed(1) + "</size_kb>\n";
  x += "  <sha256>" + r.sha256 + "</sha256>\n";
  if (r.image) {
    x += "  <image>\n";
    x +=
      "    <dimensions>" +
      r.image.width +
      " x " +
      r.image.height +
      "</dimensions>\n";
    x += "    <mode>" + _xmlEsc(r.image.mode) + "</mode>\n";
    x += "    <format>" + _xmlEsc(r.image.format) + "</format>\n";
    x += "  </image>\n";
  }
  if (r.exif) {
    x += "  <exif>\n";
    for (var k in r.exif)
      x +=
        '    <tag name="' + _xmlEsc(k) + '">' + _xmlEsc(r.exif[k]) + "</tag>\n";
    x += "  </exif>\n";
  }
  x += "</metadata>";
  return x;
}

/**
 *
 * @param v
 */
function _xmlEsc(v) {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 *
 * @param r
 */
function mdToHTML(r) {
  var h =
    '<!doctype html><html><head><meta charset="UTF-8"><title>Metadata Report</title>';
  h +=
    "<style>body{font-family:sans-serif;margin:2em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>";
  h += "<h1>Metadata Report</h1><table>";
  h += "<tr><th>Property</th><th>Value</th></tr>";
  var add = function (k, v) {
    h += "<tr><td>" + _xmlEsc(k) + "</td><td>" + _xmlEsc(v) + "</td></tr>";
  };
  add("File", r.file);
  add("Size (KB)", (r.size / 1024).toFixed(1));
  add("SHA-256", r.sha256);
  if (r.image) {
    add("Dimensions", r.image.width + " x " + r.image.height);
    add("Mode", r.image.mode);
    add("Format", r.image.format);
  }
  if (r.exif) for (var k in r.exif) add(k, r.exif[k]);
  h += "</table></body></html>";
  return h;
}

/**
 *
 * @param r
 * @param name
 */
function mdToPDF(r, name) {
  var doc = new jspdf.jsPDF();
  var y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text("RedoSan Authenticity - Metadata Report", 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  var add = function (k, v) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(k + ": " + String(v), 14, y);
    y += 6;
  };
  add("File", r.file);
  add("Size (KB)", (r.size / 1024).toFixed(1));
  add("SHA-256", r.sha256);
  if (r.image) {
    add("Dimensions", r.image.width + " x " + r.image.height);
    add("Mode", r.image.mode);
    add("Format", r.image.format);
  }
  if (r.exif) {
    y += 2;
    doc.setFontSize(12);
    doc.setTextColor(108, 92, 231);
    doc.text("EXIF", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    for (var k in r.exif) add(k, r.exif[k]);
  }
  var blob = doc.output("blob");
  downloadBlobSimple(blob, name + ".metadata.pdf");
}

/**
 *
 * @param r
 * @param name
 */
function mdToDOCX(r, name) {
  var doc = new docx.Document({
    sections: [
      {
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: "RedoSan Authenticity - Metadata Report",
                bold: true,
                size: 28,
                color: "6C5CE7",
              }),
            ],
          }),
          new docx.Paragraph({
            children: [new docx.TextRun({ text: "File: " + r.file, size: 20 })],
          }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: "Size (KB): " + (r.size / 1024).toFixed(1),
                size: 20,
              }),
            ],
          }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: "SHA-256: " + r.sha256, size: 20 }),
            ],
          }),
        ],
      },
    ],
  });
  if (r.image) {
    doc.sections[0].children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Dimensions: " + r.image.width + " x " + r.image.height,
            size: 20,
          }),
        ],
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Mode: " + r.image.mode, size: 20 }),
        ],
      }),
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: "Format: " + r.image.format, size: 20 }),
        ],
      }),
    );
  }
  if (r.exif) {
    doc.sections[0].children.push(
      new docx.Paragraph({
        spacing: { before: 200 },
        children: [
          new docx.TextRun({
            text: "EXIF",
            bold: true,
            size: 24,
            color: "6C5CE7",
          }),
        ],
      }),
    );
    for (var k in r.exif) {
      doc.sections[0].children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({ text: k + ": " + r.exif[k], size: 20 }),
          ],
        }),
      );
    }
  }
  docx.Packer.toBlob(doc).then(function (blob) {
    downloadBlobSimple(blob, name + ".metadata.docx");
  });
}
