(function(root) {
  'use strict';

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function luminance(data, idx) {
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  function mean(values) {
    if (!values.length) return 0;
    var s = 0;
    for (var i = 0; i < values.length; i++) s += values[i];
    return s / values.length;
  }

  function stddev(values, avg) {
    if (!values.length) return 0;
    var s = 0;
    for (var i = 0; i < values.length; i++) {
      var d = values[i] - avg;
      s += d * d;
    }
    return Math.sqrt(s / values.length);
  }

  function percentile(values, pct) {
    if (!values.length) return 0;
    var copy = values.slice().sort(function(a, b) { return a - b; });
    var idx = Math.floor((copy.length - 1) * pct);
    return copy[clamp(idx, 0, copy.length - 1)];
  }

  function parseJpegMarkers(bytes) {
    var info = {
      is_jpeg: bytes && bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8,
      has_eoi: false,
      trailing_bytes: 0,
      app_segments: [],
      quantization_tables: 0,
      has_exif: false,
      has_xmp: false,
      has_photoshop: false,
      warnings: []
    };
    if (!info.is_jpeg) return info;

    var eoi = -1;
    for (var e = bytes.length - 2; e >= 0; e--) {
      if (bytes[e] === 0xFF && bytes[e + 1] === 0xD9) { eoi = e; break; }
    }
    info.has_eoi = eoi >= 0;
    info.trailing_bytes = eoi >= 0 ? bytes.length - (eoi + 2) : 0;
    if (!info.has_eoi) info.warnings.push('Missing JPEG EOI marker');
    if (info.trailing_bytes > 0) info.warnings.push('Bytes appended after JPEG EOI marker');

    var off = 2;
    while (off < bytes.length - 4) {
      if (bytes[off] !== 0xFF) { off++; continue; }
      while (bytes[off] === 0xFF) off++;
      var marker = bytes[off++];
      if (marker === 0xD9 || marker === 0xDA) break;
      if (marker >= 0xD0 && marker <= 0xD7) continue;
      if (off + 2 > bytes.length) break;
      var len = (bytes[off] << 8) | bytes[off + 1];
      if (len < 2 || off + len > bytes.length) {
        info.warnings.push('Invalid JPEG segment length near offset ' + (off - 2));
        break;
      }
      var payloadStart = off + 2;
      var payloadEnd = off + len;
      if (marker >= 0xE0 && marker <= 0xEF) {
        var label = 'APP' + (marker - 0xE0);
        info.app_segments.push(label);
        var text = '';
        for (var i = payloadStart; i < Math.min(payloadEnd, payloadStart + 64); i++) {
          text += String.fromCharCode(bytes[i] || 0);
        }
        if (text.indexOf('Exif') === 0) info.has_exif = true;
        if (text.indexOf('http://ns.adobe.com/xap/') >= 0 || text.indexOf('XMP') >= 0) info.has_xmp = true;
        if (text.indexOf('Photoshop') >= 0 || text.indexOf('8BIM') >= 0) info.has_photoshop = true;
      }
      if (marker === 0xDB) info.quantization_tables++;
      off += len;
    }

    if (info.quantization_tables === 0) info.warnings.push('No JPEG quantization tables found');
    if (!info.has_exif) info.warnings.push('No EXIF capture metadata found');
    if (info.has_photoshop) info.warnings.push('Photoshop/8BIM marker present');
    return info;
  }

  function analyzeNoise(imageData, opts) {
    opts = opts || {};
    var w = imageData.width || imageData.w;
    var h = imageData.height || imageData.h;
    var data = imageData.data;
    var step = opts.step || 2;
    var residuals = [];
    var tiles = [];
    var tile = opts.tile || 32;
    for (var y = 1; y < h - 1; y += step) {
      for (var x = 1; x < w - 1; x += step) {
        var idx = (y * w + x) * 4;
        var c = luminance(data, idx);
        var n = 0;
        n += luminance(data, ((y - 1) * w + x) * 4);
        n += luminance(data, ((y + 1) * w + x) * 4);
        n += luminance(data, (y * w + x - 1) * 4);
        n += luminance(data, (y * w + x + 1) * 4);
        residuals.push(Math.abs(c - n / 4));
      }
    }
    var avg = mean(residuals);
    var sd = stddev(residuals, avg);
    var high = percentile(residuals, 0.92);

    for (var ty = 0; ty < h; ty += tile) {
      for (var tx = 0; tx < w; tx += tile) {
        var vals = [];
        for (var yy = Math.max(1, ty); yy < Math.min(h - 1, ty + tile); yy += step) {
          for (var xx = Math.max(1, tx); xx < Math.min(w - 1, tx + tile); xx += step) {
            var ii = (yy * w + xx) * 4;
            var cc = luminance(data, ii);
            var nn = luminance(data, ((yy - 1) * w + xx) * 4) +
              luminance(data, ((yy + 1) * w + xx) * 4) +
              luminance(data, (yy * w + xx - 1) * 4) +
              luminance(data, (yy * w + xx + 1) * 4);
            vals.push(Math.abs(cc - nn / 4));
          }
        }
        if (vals.length) {
          var m = mean(vals);
          if (m > avg + sd * 0.9 || m > high) {
            tiles.push({ x: tx, y: ty, w: Math.min(tile, w - tx), h: Math.min(tile, h - ty), score: m });
          }
        }
      }
    }

    return {
      mean_residual: Number(avg.toFixed(3)),
      stddev_residual: Number(sd.toFixed(3)),
      high_residual: Number(high.toFixed(3)),
      suspicious_tiles: tiles.slice(0, 40),
      suspicion: clamp((sd / 18) + (tiles.length / 30), 0, 1)
    };
  }

  function blockDescriptor(data, w, x, y, size) {
    var vals = [];
    var sum = 0, rsum = 0, gsum = 0, bsum = 0;
    for (var yy = 0; yy < size; yy += 2) {
      for (var xx = 0; xx < size; xx += 2) {
        var idx = ((y + yy) * w + x + xx) * 4;
        var v = luminance(data, idx);
        vals.push(v); sum += v;
        rsum += data[idx]; gsum += data[idx + 1]; bsum += data[idx + 2];
      }
    }
    var avg = sum / vals.length;
    var sd = stddev(vals, avg);
    var bits = '';
    for (var i = 0; i < vals.length; i++) bits += vals[i] >= avg ? '1' : '0';
    var n = vals.length;
    return {
      hash: bits,
      mean: avg,
      stddev: sd,
      r: rsum / n,
      g: gsum / n,
      b: bsum / n
    };
  }

  function blockKey(desc) {
    return [
      desc.hash,
      Math.round(desc.mean / 6),
      Math.round(desc.stddev / 4),
      Math.round(desc.r / 8),
      Math.round(desc.g / 8),
      Math.round(desc.b / 8)
    ].join('|');
  }

  function descriptorsClose(a, b) {
    return Math.abs(a.mean - b.mean) <= 8 &&
      Math.abs(a.stddev - b.stddev) <= 6 &&
      Math.abs(a.r - b.r) <= 10 &&
      Math.abs(a.g - b.g) <= 10 &&
      Math.abs(a.b - b.b) <= 10;
  }

  function hamming(a, b) {
    var n = Math.min(a.length, b.length), d = Math.abs(a.length - b.length);
    for (var i = 0; i < n; i++) if (a[i] !== b[i]) d++;
    return d;
  }

  function detectCopyMove(imageData, opts) {
    opts = opts || {};
    var w = imageData.width || imageData.w;
    var h = imageData.height || imageData.h;
    var data = imageData.data;
    var size = opts.block || 16;
    var step = opts.step || 8;
    var buckets = {};
    var matches = [];
    var maxPerBucket = 24;
    for (var y = 0; y <= h - size; y += step) {
      for (var x = 0; x <= w - size; x += step) {
        var desc = blockDescriptor(data, w, x, y, size);
        var key = blockKey(desc);
        if (!buckets[key]) buckets[key] = [];
        var bucket = buckets[key];
        for (var i = 0; i < bucket.length; i++) {
          var p = bucket[i];
          var dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
          if (dist >= size * 2) {
            matches.push({ x1: p.x, y1: p.y, x2: x, y2: y, distance: Number(dist.toFixed(1)), hamming: 0 });
            if (matches.length >= 80) break;
          }
        }
        if (matches.length >= 80) break;
        if (bucket.length < maxPerBucket) bucket.push({ x: x, y: y, desc: desc });
      }
      if (matches.length >= 80) break;
    }

    if (matches.length < 4) {
      var blocks = [];
      for (var yy = 0; yy <= h - size; yy += step * 2) {
        for (var xx = 0; xx <= w - size; xx += step * 2) {
          blocks.push({ x: xx, y: yy, desc: blockDescriptor(data, w, xx, yy, size) });
        }
      }
      for (var a = 0; a < blocks.length && matches.length < 40; a++) {
        for (var b = a + 1; b < blocks.length && matches.length < 40; b++) {
          var d = Math.sqrt(Math.pow(blocks[a].x - blocks[b].x, 2) + Math.pow(blocks[a].y - blocks[b].y, 2));
          if (d >= size * 2) {
            var hd = hamming(blocks[a].desc.hash, blocks[b].desc.hash);
            if (hd <= 3 && descriptorsClose(blocks[a].desc, blocks[b].desc)) {
              matches.push({ x1: blocks[a].x, y1: blocks[a].y, x2: blocks[b].x, y2: blocks[b].y, distance: Number(d.toFixed(1)), hamming: hd });
            }
          }
        }
      }
    }

    return {
      matches: matches,
      match_count: matches.length,
      suspicion: clamp(matches.length / 18, 0, 1)
    };
  }

  function metadataSignals(bytes, imageData, fileName) {
    var ext = (fileName || '').toLowerCase().split('.').pop();
    var jpeg = parseJpegMarkers(bytes || []);
    var signals = [];
    if (jpeg.is_jpeg) {
      if (!jpeg.has_eoi) signals.push('JPEG is missing a valid end marker');
      if (jpeg.trailing_bytes > 0) signals.push('JPEG has appended bytes after the end marker');
      if (!jpeg.has_exif) signals.push('No EXIF capture metadata present');
      if (jpeg.has_photoshop) signals.push('Photoshop marker present');
      if (jpeg.quantization_tables > 2) signals.push('Multiple JPEG quantization tables detected');
    } else if (['jpg', 'jpeg'].indexOf(ext) >= 0) {
      signals.push('File extension says JPEG but magic bytes do not match');
    }
    if (imageData) {
      var w = imageData.width || imageData.w, h = imageData.height || imageData.h;
      if (w * h > 0 && w * h < 4096) signals.push('Image is unusually small for forensic analysis');
    }
    return { jpeg: jpeg, signals: signals, suspicion: clamp(signals.length / 5, 0, 1) };
  }

  function combineFindings(parts) {
    var weights = { ela: 0.30, noise: 0.25, copy_move: 0.25, metadata: 0.20 };
    var score = 0;
    if (parts.ela) score += (parts.ela.suspicion || 0) * weights.ela;
    if (parts.noise) score += (parts.noise.suspicion || 0) * weights.noise;
    if (parts.copy_move) score += (parts.copy_move.suspicion || 0) * weights.copy_move;
    if (parts.metadata) score += (parts.metadata.suspicion || 0) * weights.metadata;
    var pct = Math.round(clamp(score, 0, 1) * 100);
    return {
      risk_score: pct,
      risk_level: pct >= 70 ? 'high' : (pct >= 38 ? 'medium' : 'low')
    };
  }

  function buildSummary(parts) {
    var signals = [];
    if (parts.ela && parts.ela.suspicion > 0.45) signals.push('Localized compression inconsistency detected by ELA');
    if (parts.noise && parts.noise.suspicion > 0.45) signals.push('Noise residuals vary strongly between regions');
    if (parts.copy_move && parts.copy_move.match_count > 0) signals.push('Possible copy-move duplicated regions: ' + parts.copy_move.match_count);
    if (parts.metadata && parts.metadata.signals) signals = signals.concat(parts.metadata.signals);
    if (!signals.length) signals.push('No strong tamper signal found by lightweight forensic checks');
    return signals.slice(0, 12);
  }

  var api = {
    parseJpegMarkers: parseJpegMarkers,
    analyzeNoise: analyzeNoise,
    detectCopyMove: detectCopyMove,
    metadataSignals: metadataSignals,
    combineFindings: combineFindings,
    buildSummary: buildSummary
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RedoSanForensicCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
