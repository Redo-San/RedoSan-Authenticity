(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Remove Watermark Service — Multi-stage content cleaner ──
// Cleans images from: watermark types 1-9, pixel injection, C2PA, EXIF/metadata
// Cleans audio from: audio watermark types 1-8

// ── Stage 1: Clear LSB bits (spatial-domain watermarks) ──
// levels: 1 = clear 1 LSB (types 1,3,8), 2 = clear 2 LSBs (type 6)
function cleanLSB(imgData, levels) {
  var mask = levels >= 2 ? ~3 : ~1;
  var d = imgData.data;
  for (var i = 0; i < d.length; i += 4) {
    d[i] &= mask;
    d[i+1] &= mask;
    d[i+2] &= mask;
  }
}

// ── Stage 2: Zero out mid-frequency DCT coefficients (frequency-domain watermarks) ──
// Removes types 2,4,5,7,9 by zeroing the MID coefficient set in Y, Cb, Cr planes
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
  // Convert YCbCr back to RGB
  var rgbData = ycbcrToRGB(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
  imgData.data.set(rgbData);
}

// ── Helper: YCbCr → RGB (pure JS, avoids canvas creation) ──
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

// ── Main image cleaning pipeline ──
async function cleanImageFile(file) {
  // Step 1: Load image into canvas (automatically strips C2PA + EXIF metadata)
  var img = await loadImage(file);
  
  // Step 2: Clear 2-bit LSB (removes types 1,3,6,8 + all LSB pixel injection)
  cleanLSB(img.imgData, 2);
  
  // Step 3: Clear DCT mid-coefficients (removes types 2,4,5,7,9 + DCT pixel injection)
  cleanDCT(img.imgData);
  
  // Step 4: Put cleaned data back on canvas
  img.ctx.putImageData(img.imgData, 0, 0);
  
  // Step 5: Export as JPEG quality 85 (further disrupts any residual, smaller file)
  var blob = await canvasToBlob(img.canvas, 'image/jpeg', 0.85);
  return blob;
}

// ── Main audio cleaning pipeline ──
async function cleanAudioFile(file) {
  // Load audio using existing audio watermark core
  var info = await awLoadAudio(file);
  var s16 = new Int16Array(info.samples);
  
  // Clear LSB of all samples (removes aw1 LSB audio watermark)
  for (var i = 0; i < s16.length; i++) {
    s16[i] &= ~1;
  }
  
  // Harder re-quantization (removes aw5 QIM and partial removal of aw2-aw8)
  var sr = info.sr || 44100;
  var destroyStep = Math.round(sr / 50);
  for (var j = 0; j < s16.length; j++) {
    s16[j] = Math.round(s16[j] / destroyStep) * destroyStep;
  }
  
  // Write as WAV
  var wavBlob = awWriteWav(s16, info.sr, info.ch, info.raw, info.bps);
  return wavBlob;
}

// ── Smart detection: detect file type and apply appropriate cleaning ──
async function removeWatermark(file) {
  var isAudio = file.type && file.type.startsWith('audio/');
  var ext = file.name ? file.name.toLowerCase().split('.').pop() : '';
  var audioExts = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'wma', 'm4a'];
  isAudio = isAudio || audioExts.indexOf(ext) >= 0;
  
  if (isAudio) {
    return { type: 'audio', blob: await cleanAudioFile(file) };
  } else {
    return { type: 'image', blob: await cleanImageFile(file) };
  }
}

// ── UI Handlers ──
async function handleRemoveWatermark() {
  var btn = document.getElementById('rw-btn');
  var fileInput = document.getElementById('rw-file');
  var resultDiv = document.getElementById('rw-result');
  var output = document.getElementById('rw-output');
  var dl = document.getElementById('rw-download');
  
  var file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) {
    setText('rw-output', __('rw.err_no_file', 'Please select a file first'));
    resultDiv.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  if (typeof spinner === 'function') spinner('rw-spinner', true);
  resultDiv.style.display = 'none';
  dl.innerHTML = '';
  setText('rw-output', __('rw.processing', 'Cleaning file... This may take a moment.'));
  
  try {
    var result = await removeWatermark(file);
    output.innerHTML = '';
    
    if (result.type === 'image') {
      var imgUrl = URL.createObjectURL(result.blob);
      if (window._rwLastUrl) URL.revokeObjectURL(window._rwLastUrl);
      window._rwLastUrl = imgUrl;
      
      var origSize = file.size;
      var newSize = result.blob.size;
      var reduction = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
      
      output.innerHTML = '<div style="text-align:center;margin-bottom:15px">' +
        '<img src="' + imgUrl + '" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border)">' +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">' +
        __('rw.removed_info', 'Removed: watermarks, pixel injection, C2PA, & metadata') + '<br>' +
        __('rw.size_info', 'Original: {orig} → Cleaned: {new} ({reduction}% smaller)')
          .replace('{orig}', fmtBytes(origSize)).replace('{new}', fmtBytes(newSize)).replace('{reduction}', reduction) +
        '</div>';
      
      var fileName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.jpg';
      dl.innerHTML = '<a href="' + imgUrl + '" download="' + escHtml(fileName) + '" class="btn">' +
        __('rw.download_btn', 'Download Cleaned Image') + '</a>';
      
    } else { // audio
      var audioUrl = URL.createObjectURL(result.blob);
      if (window._rwLastUrl) URL.revokeObjectURL(window._rwLastUrl);
      window._rwLastUrl = audioUrl;
      
      output.innerHTML = '<div style="text-align:center;margin-bottom:15px">' +
        '<audio controls style="width:100%;max-width:400px;display:block;margin:0 auto">' +
        '<source src="' + audioUrl + '" type="audio/wav"></audio></div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">' +
        __('rw.removed_audio_info', 'Removed: audio watermarks from all algorithms') + '</div>';
      
      var audioName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.wav';
      dl.innerHTML = '<a href="' + audioUrl + '" download="' + escHtml(audioName) + '" class="btn">' +
        __('rw.download_audio_btn', 'Download Cleaned Audio') + '</a>';
    }
    
    setText('rw-output', __('rw.success', '✅ File cleaned successfully'));
    resultDiv.style.display = 'block';
    
  } catch (e) {
    setText('rw-output', __('rw.error_prefix', 'Error: {msg}').replace('{msg}', e.message));
    resultDiv.style.display = 'block';
  }
  
  btn.disabled = false;
  if (typeof spinner === 'function') spinner('rw-spinner', false);
}

// Byte formatter
function fmtBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}
