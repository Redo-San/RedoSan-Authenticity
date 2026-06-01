(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

function cleanLSB(imgData, levels) {
  var mask = levels >= 2 ? ~3 : ~1;
  var d = imgData.data;
  for (var i = 0; i < d.length; i += 4) {
    d[i] &= mask;
    d[i+1] &= mask;
    d[i+2] &= mask;
  }
}

function cleanDCT(imgData) {
  var w = imgData.w || imgData.width;
  var h = imgData.h || imgData.height;
  var ycbcr = rgbToYcbcr(imgData);
  var blocks = blockIter(w, h, 8);
  ['Y','Cb','Cr'].forEach(function(plane) {
    var P = ycbcr[plane];
    for (var bi = 0; bi < blocks.length; bi++) {
      var bx = blocks[bi][0], by = blocks[bi][1];
      var block = getBlock8(P, w, bx, by);
      var dct = dct8x8(block);
      for (var mi = 0; mi < MID.length; mi++) {
        var u = MID[mi][0], v = MID[mi][1];
        dct[u][v] = 0;
      }
      setBlock8(P, w, bx, by, idct8x8(dct));
    }
  });
  var rgbData = ycbcrToRGB(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
  imgData.data.set(rgbData);
}

function ycbcrToRGB(Y, Cb, Cr, w, h) {
  var d = new Uint8ClampedArray(w * h * 4);
  for (var i = 0; i < w * h; i++) {
    var y = Y[i], cb = Cb[i] - 128, cr = Cr[i] - 128;
    d[i*4]   = Math.max(0, Math.min(255, Math.round(y + 1.402 * cr)));
    d[i*4+1] = Math.max(0, Math.min(255, Math.round(y - 0.3441 * cb - 0.7141 * cr)));
    d[i*4+2] = Math.max(0, Math.min(255, Math.round(y + 1.772 * cb)));
    d[i*4+3] = 255;
  }
  return d;
}

async function cleanImageFile(file, opts) {
  opts = opts || {};
  var img = await loadImage(file);
  var removed = [];

  if (opts.watermark) {
    cleanLSB(img.imgData, 2);
    cleanDCT(img.imgData);
    removed.push('watermark');
  }
  if (opts.pixelInjection) {
    cleanLSB(img.imgData, 2);
    removed.push('pixel_injection');
  }

  img.ctx.putImageData(img.imgData, 0, 0);

  if (opts.c2pa) removed.push('c2pa');
  if (opts.metadata) removed.push('metadata');

  var blob = await canvasToBlob(img.canvas, 'image/jpeg', 0.85);
  return { type: 'image', blob: blob, removed: removed };
}

async function cleanAudioFile(file, opts) {
  opts = opts || {};
  var info = await awLoadAudio(file);
  var s16 = new Int16Array(info.samples);
  var removed = [];

  if (opts.watermark) {
    for (var i = 0; i < s16.length; i++) s16[i] &= ~1;
    var sr = info.sr || 44100;
    var destroyStep = Math.round(sr / 50);
    for (var j = 0; j < s16.length; j++) s16[j] = Math.round(s16[j] / destroyStep) * destroyStep;
    removed.push('watermark');
  }

  if (opts.metadata) removed.push('metadata');

  var wavBlob = awWriteWav(s16, info.sr, info.ch, info.raw, info.bps);
  return { type: 'audio', blob: wavBlob, removed: removed };
}

function rtDetectType(file) {
  var isAudio = file.type && file.type.startsWith('audio/');
  var ext = file.name ? file.name.toLowerCase().split('.').pop() : '';
  var audioExts = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'wma', 'm4a'];
  return isAudio || audioExts.indexOf(ext) >= 0 ? 'audio' : 'image';
}

function onRtFileChange() {
  var input = document.getElementById('rt-file');
  var file = input && input.files && input.files[0];
  var info = document.getElementById('rt-file-info');
  var options = document.getElementById('rt-options');
  var imgOpts = document.getElementById('rt-image-options');
  var audioOpts = document.getElementById('rt-audio-options');
  var resultDiv = document.getElementById('rt-result');
  var output = document.getElementById('rt-output');
  var status = document.getElementById('rt-status');

  output.style.display = 'none';
  resultDiv.style.display = 'none';
  options.style.display = 'none';
  imgOpts.style.display = 'none';
  audioOpts.style.display = 'none';

  if (!file) { info.textContent = ''; status.textContent = ''; return; }

  info.textContent = file.name + ' (' + fmtBytes(file.size) + ')';
  options.style.display = 'block';

  if (rtDetectType(file) === 'audio') {
    imgOpts.style.display = 'none';
    audioOpts.style.display = 'block';
  } else {
    imgOpts.style.display = 'block';
    audioOpts.style.display = 'none';
  }
}

async function handleRtRemove() {
  var btn = document.getElementById('rt-btn');
  var input = document.getElementById('rt-file');
  var file = input && input.files && input.files[0];
  var resultDiv = document.getElementById('rt-result');
  var dl = document.getElementById('rt-download');
  var output = document.getElementById('rt-output');

  if (!file) {
    setText('rt-status', __('rt.err_no_file', 'Please select a file first'));
    resultDiv.style.display = 'block';
    return;
  }

  btn.disabled = true;
  if (typeof spinner === 'function') spinner('rt-spinner', true);
  resultDiv.style.display = 'none';
  output.style.display = 'none';
  dl.innerHTML = '';
  setText('rt-status', __('rt.processing', 'Processing...'));

  try {
    var opts = {};
    var result;
    var type = rtDetectType(file);

    if (type === 'audio') {
      opts.watermark = document.getElementById('rt-audio-wm').checked;
      opts.metadata = document.getElementById('rt-audio-meta').checked;
      result = await cleanAudioFile(file, opts);
    } else {
      opts.watermark = document.getElementById('rt-wm').checked;
      opts.pixelInjection = document.getElementById('rt-pi').checked;
      opts.c2pa = document.getElementById('rt-c2pa').checked;
      opts.metadata = document.getElementById('rt-meta').checked;
      result = await cleanImageFile(file, opts);
    }

    var url = URL.createObjectURL(result.blob);
    if (window._rtLastUrl) URL.revokeObjectURL(window._rtLastUrl);
    window._rtLastUrl = url;

    var removedLabels = [];
    var labelMap = {
      watermark: __('rt.watermark_label', 'Digital Watermark'),
      pixel_injection: __('rt.pixel_injection_label', 'Pixel Injection'),
      c2pa: __('rt.c2pa_label', 'C2PA Provenance'),
      metadata: __('rt.metadata_label', 'Metadata')
    };
    for (var k = 0; k < result.removed.length; k++) {
      if (labelMap[result.removed[k]]) removedLabels.push(labelMap[result.removed[k]]);
    }
    var removedSummary = removedLabels.length ? removedLabels.join(' · ') : __('rt.none', 'None');

    if (type === 'image') {
      output.innerHTML =
        '<div style="text-align:center;margin-bottom:15px">' +
        '<img src="' + url + '" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border)">' +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">' +
        __('rt.removed_label', 'Removed: {items}').replace('{items}', escHtml(removedSummary)) + '<br>';
      if (opts.watermark || opts.pixelInjection) {
        var origSize = file.size;
        var newSize = result.blob.size;
        var reduction = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
        output.innerHTML +=
          __('rt.size_info', 'Original: {orig} → Result: {new} ({reduction}% smaller)')
            .replace('{orig}', fmtBytes(origSize)).replace('{new}', fmtBytes(newSize)).replace('{reduction}', reduction);
      }
      output.innerHTML += '</div>';
      var fileName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.jpg';
      dl.innerHTML = '<a href="' + url + '" download="' + escHtml(fileName) + '" class="btn">' +
        __('rt.download_btn', 'Download Cleaned Image') + '</a>';
    } else {
      output.innerHTML =
        '<div style="text-align:center;margin-bottom:15px">' +
        '<audio controls style="width:100%;max-width:400px;display:block;margin:0 auto">' +
        '<source src="' + url + '" type="audio/wav"></audio></div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">' +
        __('rt.removed_label', 'Removed: {items}').replace('{items}', escHtml(removedSummary)) + '</div>';
      var audioName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.wav';
      dl.innerHTML = '<a href="' + url + '" download="' + escHtml(audioName) + '" class="btn">' +
        __('rt.download_audio_btn', 'Download Cleaned Audio') + '</a>';
    }

    setText('rt-status', __('rt.success', '✅ File processed successfully'));
    resultDiv.style.display = 'block';
    output.style.display = 'block';
  } catch (e) {
    setText('rt-status', __('rt.error_prefix', 'Error: {msg}').replace('{msg}', e.message));
    resultDiv.style.display = 'block';
  }

  btn.disabled = false;
  if (typeof spinner === 'function') spinner('rt-spinner', false);
}

function fmtBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}
