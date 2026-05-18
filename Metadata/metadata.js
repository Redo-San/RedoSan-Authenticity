// ── Metadata reading (EXIF via DataView) + UI handler ──

async function readMetadata(file) {
    var buf = await file.arrayBuffer();
    var data = new Uint8Array(buf);
    var name = file.name;
    var result = { file: name, size: data.length };

    var h = await crypto.subtle.digest('SHA-256', data);
    result.sha256 = Array.from(new Uint8Array(h)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    try {
        var img = await loadImage(file);
        result.image = { width: img.w, height: img.h, mode: 'RGBA', format: name.split('.').pop().toUpperCase() };
    } catch(e) {
        result.error = e.message;
        return result;
    } 

    if (data[0] === 0xFF && data[1] === 0xD8) {
        var exif = parseJPEGExif(data);
        if (exif && Object.keys(exif).length > 0) result.exif = exif;
    }

    return result;
}

// ── JPEG EXIF parser ──
function parseJPEGExif(data) {
    var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    var exif = {};
    var offset = 2;

    while (offset < data.length - 1) {
        if (view.getUint16(offset) === 0xFFE1) {
            var segLen = view.getUint16(offset + 2);
            if (offset + 4 + segLen <= data.length) {
                var exifStart = offset + 4;
                var exifHeader = String.fromCharCode.apply(null, data.slice(exifStart, exifStart + 6));
                if (exifHeader === 'Exif\0\0') {
                    var tiffStart = exifStart + 6;
                    var endian = view.getUint16(tiffStart);
                    var littleEndian = endian === 0x4949;
                    var get16 = function(off) { return littleEndian ? view.getUint16(off, true) : view.getUint16(off, false); };
                    var get32 = function(off) { return littleEndian ? view.getUint32(off, true) : view.getUint32(off, false); };

                    if (get16(tiffStart + 2) !== 0x002A) break;
                    var ifd0Off = get32(tiffStart + 4);
                    if (ifd0Off > 0 && tiffStart + ifd0Off < data.length) {
                        parseIFD(tiffStart, ifd0Off, exif, get16, get32, view, data);
                    }
                }
            }
            break;
        }
        offset++;
        if (offset >= data.length) break;
    }
    return exif;
}

var EXIF_TAGS = {
    0x010F: 'Make', 0x0110: 'Model', 0x0132: 'DateTimeOriginal',
    0x010E: 'ImageDescription', 0x0112: 'Orientation',
    0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
    0x0131: 'Software', 0x0213: 'YCbCrPositioning',
    0x8769: 'ExifOffset', 0x8825: 'GPSInfo',
    0x829A: 'ExposureTime', 0x829D: 'FNumber',
    0x8822: 'ExposureProgram', 0x8827: 'ISOSpeedRatings',
    0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
    0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue',
    0x9204: 'ExposureBiasValue', 0x9207: 'MeteringMode',
    0x9208: 'LightSource', 0x9209: 'Flash',
    0x920A: 'FocalLength', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
    0xA20E: 'FocalPlaneXResolution', 0xA20F: 'FocalPlaneYResolution',
    0xA210: 'FocalPlaneResolutionUnit',
    0xA401: 'CustomRendered', 0xA402: 'ExposureMode', 0xA403: 'WhiteBalance',
    0xA404: 'DigitalZoomRatio', 0xA405: 'FocalLengthIn35mmFilm',
    0xA406: 'SceneCaptureType', 0xA407: 'GainControl', 0xA408: 'Contrast',
    0xA409: 'Saturation', 0xA40A: 'Sharpness',
};

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
            val = String.fromCharCode.apply(null, data.slice(valOff, valOff + count - 1));
        } else if (type === 2) {
            var strOff = get32(valOff);
            if (strOff > 0 && tiffStart + strOff + count <= data.length)
                val = String.fromCharCode.apply(null, data.slice(tiffStart + strOff, tiffStart + strOff + count - 1));
        } else if (type === 3) {
            val = get16(valOff);
        } else if (type === 4) {
            val = get32(valOff);
        } else if (type === 5) {
            var numOff = get32(valOff);
            if (numOff + 8 <= data.length - tiffStart) {
                val = get32(tiffStart + numOff) / get32(tiffStart + numOff + 4);
            }
        } else if (type === 7) {
            val = data.slice(valOff, valOff + Math.min(count, 32));
        }

        if (val !== undefined && EXIF_TAGS[tag]) {
            var s = String(val);
            if (s.length > 200) s = s.substring(0, 197) + '...';
            exif[EXIF_TAGS[tag]] = s;
        }
    }

    var nextOff = get32(tiffStart + offset + 2 + num * 12);
    if (nextOff > 0 && tiffStart + nextOff < data.length && nextOff > offset) {
        parseIFD(tiffStart, nextOff, exif, get16, get32, view, data);
    }
}

// ── Metadata tab handler ──
async function handleReadMetadata() {
  const btn = document.getElementById('md-btn');
  const resultDiv = document.getElementById('md-result');
  const output = document.getElementById('md-output');
  const dl = document.getElementById('md-download');

  const file = await getFile('md-file');
  if (!file) { setText('md-output', __('md.select_image', 'Please select an image')); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('md-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('md-output', __('shared.processing', 'Processing...'));

  try {
    const result = await readMetadata(file);
    const pretty = JSON.stringify(result, null, 2);

    let html = '<table class="meta-table">';
    html += '<tr><td>' + __('md.label_file', 'File') + '</td><td>' + escHtml(result.file) + '</td></tr>';
    html += '<tr><td>' + __('md.label_size', 'Size') + '</td><td>' + (result.size / 1024).toFixed(1) + ' KB</td></tr>';
    html += '<tr><td>SHA-256</td><td><code>' + result.sha256 + '</code></td></tr>';
    if (result.image) {
      html += '<tr><td>' + __('md.label_dimensions', 'Dimensions') + '</td><td>' + result.image.width + ' x ' + result.image.height + '</td></tr>';
      html += '<tr><td>' + __('md.label_mode', 'Mode') + '</td><td>' + result.image.mode + '</td></tr>';
      html += '<tr><td>' + __('md.label_format', 'Format') + '</td><td>' + escHtml(result.image.format) + '</td></tr>';
    }
    if (result.exif) {
      html += '<tr><td colspan="2" style="font-weight:700;padding-top:12px">' + __('md.label_exif', 'EXIF') + '</td></tr>';
      for (const [k, v] of Object.entries(result.exif)) {
        if (v && v !== '0') html += '<tr><td style="padding-left:12px">' + escHtml(k) + '</td><td>' + escHtml(v) + '</td></tr>';
      }
    }
    if (result.error) {
      html += '<tr><td style="color:var(--danger)">' + __('md.label_error', 'Error') + '</td><td>' + escHtml(result.error) + '</td></tr>';
    }
    html += '</table>';
    // codeql[js/xss-through-dom] — all values are HTML-escaped via escHtml()
    output.innerHTML = html;

    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    // codeql[js/xss-through-dom] — url is a safe blob URL, fileName is escaped
    dl.innerHTML = '<a href="' + url + '" download="' + escHtml(file.name) + '.metadata.json" class="btn">' + __('md.download_json', 'Download JSON') + '</a>';
  } catch (e) { setText('md-output', __('shared.error_prefix', 'Error: ') + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('md-spinner', false);
}
