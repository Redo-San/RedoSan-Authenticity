(function(){if(typeof window!='undefined'&&window.location&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var CONV_IMG_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.ico'];
var CONV_AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.wma', '.opus'];
var CONV_VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'];
var CONV_DOC_EXTS = ['.txt', '.md', '.html', '.htm', '.csv', '.json', '.xml', '.pdf', '.doc', '.docx', '.rtf', '.odt'];

function convDetectType(file) {
  var name = file.name.toLowerCase();
  for (var i = 0; i < CONV_IMG_EXTS.length; i++) { if (name.endsWith(CONV_IMG_EXTS[i])) return 'image'; }
  for (var i = 0; i < CONV_AUDIO_EXTS.length; i++) { if (name.endsWith(CONV_AUDIO_EXTS[i])) return 'audio'; }
  for (var i = 0; i < CONV_VIDEO_EXTS.length; i++) { if (name.endsWith(CONV_VIDEO_EXTS[i])) return 'video'; }
  for (var i = 0; i < CONV_DOC_EXTS.length; i++) { if (name.endsWith(CONV_DOC_EXTS[i])) return 'document'; }
  return 'unknown';
}

function convGetFormats(type) {
  switch (type) {
    case 'image': return ['png', 'jpeg', 'webp', 'bmp', 'gif'];
    case 'audio': return convAudioFormats();
    case 'video': return convVideoFormats();
    case 'document': return ['txt', 'html', 'md', 'pdf', 'docx', 'json', 'xml', 'csv'];
    default: return [];
  }
}

function convAudioFormats() {
  return ['wav', 'aiff', 'au', 'raw', 'mp3', 'ogg', 'opus', 'm4a', 'aac', 'flac', 'amr'];
}

function convVideoFormats() {
  return ['mp4', 'webm', 'mkv', 'mov', 'avi', 'ogg', 'mpeg', '3gp', 'wmv', 'flv', 'gif'];
}

function convGetFormatLabel(fmt) {
  var labels = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', bmp: 'BMP', gif: 'GIF',
    wav: 'WAV', aiff: 'AIFF', au: 'AU', raw: 'RAW', mp3: 'MP3', ogg: 'OGG', opus: 'OPUS', m4a: 'M4A', aac: 'AAC', flac: 'FLAC', amr: 'AMR',
    mp4: 'MP4', webm: 'WebM', mkv: 'MKV', mov: 'MOV', avi: 'AVI', mpeg: 'MPEG', '3gp': '3GP', wmv: 'WMV', flv: 'FLV',
    txt: 'TXT', html: 'HTML', md: 'Markdown', pdf: 'PDF', docx: 'DOCX',
    json: 'JSON', xml: 'XML', csv: 'CSV' };
  return labels[fmt] || fmt.toUpperCase();
}

function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

var _convFile = null;
var _convType = '';
var _convFormats = [];

function handleConvFile() {
  var input = document.getElementById('conv-file');
  var opts = document.getElementById('conv-options');
  var outDiv = document.getElementById('conv-output');
  var dl = document.getElementById('conv-download');
  outDiv.style.display = 'none';
  dl.innerHTML = '';
  if (!input || !input.files || !input.files[0]) return;
  _convFile = input.files[0];
  _convType = convDetectType(_convFile);
  _convFormats = convGetFormats(_convType);
  var srcExt = _convFile.name.split('.').pop().toLowerCase();
  var extMap = { jpg: 'jpeg', jpeg: 'jpg', tiff: 'tif', tif: 'tiff', htm: 'html' };
  var skip = [srcExt, extMap[srcExt] || ''];
  _convFormats = _convFormats.filter(function(f) { return skip.indexOf(f) === -1; });
  var typeLabel = { image: 'Image', audio: 'Audio', video: 'Video', document: 'Document', unknown: 'Unknown' }[_convType] || 'Unknown';
  document.getElementById('conv-file-type').textContent = __('conv.detected', 'Detected: ') + typeLabel;
  document.getElementById('conv-file-name').textContent = __('conv.file', 'File: ') + _convFile.name;
  if (_convType === 'unknown') {
    opts.innerHTML = '<p style="color:var(--danger)">' + __('conv.unknown_type', 'Unsupported file type. Please select an image, audio, video, or document file.') + '</p>';
    opts.style.display = 'block';
    document.getElementById('conv-btn').style.display = 'none';
    return;
  }
  var html = '<label style="margin-bottom:8px;display:block;font-size:0.8rem;color:var(--text-muted)">' + __('conv.format_label', 'Convert to:') + '</label>';
  html += '<div id="conv-format-grid" style="display:flex;flex-wrap:wrap;gap:8px">';
  for (var i = 0; i < _convFormats.length; i++) {
    var active = i === 0 ? ' active' : '';
    html += '<button type="button" class="tab-btn btn' + active + '" data-fmt="' + _convFormats[i] + '" onclick="convSelectFormat(this)">' + convGetFormatLabel(_convFormats[i]) + '</button>';
  }
  html += '</div>';
  opts.innerHTML = html;
  opts.style.display = 'block';
  document.getElementById('conv-btn').style.display = 'inline-block';
}

function convSelectFormat(el) {
  var grid = document.getElementById('conv-format-grid');
  if (!grid) return;
  var btns = grid.querySelectorAll('.tab-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  el.classList.add('active');
}

function convGetSelectedFormat() {
  var grid = document.getElementById('conv-format-grid');
  if (!grid) return '';
  var active = grid.querySelector('.tab-btn.active');
  return active ? active.getAttribute('data-fmt') : '';
}

async function handleConvConvert() {
  var btn = document.getElementById('conv-btn');
  var spinner = document.getElementById('conv-spinner');
  var outDiv = document.getElementById('conv-output');
  var dl = document.getElementById('conv-download');
  var status = document.getElementById('conv-status');
  if (!_convFile) return;
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  status.textContent = __('conv.converting', 'Converting...');
  outDiv.style.display = 'none';
  dl.innerHTML = '';
  try {
    var format = convGetSelectedFormat();
    if (!format) { throw new Error('No format selected'); }
    var result = await convRun(_convFile, _convType, format);
    if (result) {
      var ext = result.ext || format;
      var url = URL.createObjectURL(result.blob);
      var outName = _convFile.name.replace(/\.[^.]+$/, '') + '.' + ext;
      dl.innerHTML = '<a href="' + url + '" download="' + escAttr(outName) + '" class="btn">' + __('conv.download', 'Download') + ' (' + escHtml(outName) + ')</a>';
      outDiv.style.display = 'block';
      status.textContent = __('conv.success', 'Conversion complete!');
    }
  } catch (e) {
    status.textContent = __('conv.error', 'Error: ') + e.message;
    console.error('Convert error:', e);
  }
  spinner.style.display = 'none';
  btn.disabled = false;
}

async function convRun(file, type, format) {
  switch (type) {
    case 'image': return await convImage(file, format);
    case 'audio': return await convAudio(file, format);
    case 'video': return await convVideo(file, format);
    case 'document': return await convDocument(file, format);
    default: throw new Error(__('conv.unsupported', 'Unsupported file type'));
  }
}

function convLoadImage(file) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

async function convImage(file, format) {
  var img = await convLoadImage(file);
  var canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  var mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif' };
  var mime = mimeMap[format] || 'image/png';
  return new Promise(function(resolve) {
    canvas.toBlob(function(blob) {
      resolve({ blob: blob, ext: format === 'jpeg' ? 'jpg' : format });
    }, mime);
  });
}

async function convAudio(file, format) {
  var buf = await file.arrayBuffer();
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  var audioBuf = await audioCtx.decodeAudioData(buf.slice(0));
  if (format === 'wav' || format === 'aiff' || format === 'au' || format === 'raw') {
    var numChannels = audioBuf.numberOfChannels;
    var sampleRate = audioBuf.sampleRate;
    var buf, mime, ext;
    switch (format) {
      case 'wav':
        buf = convEncodeWav(audioBuf, numChannels, sampleRate);
        mime = 'audio/wav'; ext = 'wav'; break;
      case 'aiff':
        buf = convEncodeAiff(audioBuf, numChannels, sampleRate);
        mime = 'audio/aiff'; ext = 'aiff'; break;
      case 'au':
        buf = convEncodeAu(audioBuf, numChannels, sampleRate);
        mime = 'audio/basic'; ext = 'au'; break;
      case 'raw':
        buf = convEncodeRaw(audioBuf, numChannels);
        mime = 'audio/L8'; ext = 'raw'; break;
    }
    audioCtx.close();
    return { blob: new Blob([buf], { type: mime }), ext: ext };
  }
  var audioMimeMap = {
    ogg: ['audio/webm; codecs=opus', 'audio/webm', 'audio/ogg; codecs=opus', 'audio/ogg'],
    opus: ['audio/webm; codecs=opus', 'audio/opus', 'audio/ogg; codecs=opus'],
    mp3: ['audio/mpeg', 'audio/mpeg; codecs=mp3', 'audio/mp3'],
    m4a: ['audio/mp4; codecs=aac', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
    aac: ['audio/aac', 'audio/mp4; codecs=aac', 'audio/3gpp', 'audio/3gpp2'],
    flac: ['audio/flac', 'audio/x-flac'],
    amr: ['audio/amr', 'audio/amr-wb']
  };
  var extMap = { ogg: 'ogg', opus: 'opus', mp3: 'mp3', m4a: 'm4a', aac: 'aac', flac: 'flac', amr: 'amr' };
  var mimeList = audioMimeMap[format] || [];
  for (var mi = 0; mi < mimeList.length; mi++) {
    try {
      return await convAudioEncode(audioCtx, audioBuf, mimeList[mi], extMap[format] || format);
    } catch(e) {}
  }
  if (format === 'mp3' && typeof lamejs !== 'undefined') {
    return await convAudioToMp3(audioCtx, audioBuf);
  }
  audioCtx.close();
  throw new Error(__('conv.audio_limited', 'Audio conversion is not supported in this browser. Try WAV or MP3 format.'));
}

function convAudioEncode(audioCtx, audioBuf, mimeType, ext) {
  return new Promise(function(resolve, reject) {
    var source = audioCtx.createBufferSource();
    source.buffer = audioBuf;
    var dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    var chunks = [];
    var recorder = new MediaRecorder(dest.stream, { mimeType: mimeType });
    recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = function() {
      var blob = new Blob(chunks, { type: mimeType });
      audioCtx.close();
      resolve({ blob: blob, ext: ext });
    };
    recorder.onerror = function() { audioCtx.close(); reject(new Error('Encoding failed')); };
    recorder.start();
    source.start(0);
    setTimeout(function() {
      if (recorder.state === 'recording') recorder.stop();
    }, audioBuf.duration * 1000 + 200);
  });
}

function convAudioToMp3(audioCtx, audioBuf) {
  return new Promise(function(resolve, reject) {
    try {
      var numChannels = Math.min(audioBuf.numberOfChannels, 2);
      var sampleRate = audioBuf.sampleRate;
      var bitrate = 128;
      var mp3enc = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
      var mp3Data = [];
      var length = audioBuf.length;
      var blockSize = 1152;
      function floatToInt16(val) {
        var s = Math.max(-1, Math.min(1, val));
        return s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      if (numChannels === 1) {
        var samples = audioBuf.getChannelData(0);
        for (var i = 0; i < length; i += blockSize) {
          var end = Math.min(i + blockSize, length);
          var chunk = new Int16Array(end - i);
          for (var j = i; j < end; j++) chunk[j - i] = floatToInt16(samples[j]);
          var buf = mp3enc.encodeBuffer(chunk);
          if (buf.length > 0) mp3Data.push(buf);
        }
      } else {
        var left = audioBuf.getChannelData(0);
        var right = numChannels > 1 ? audioBuf.getChannelData(1) : left;
        for (var i = 0; i < length; i += blockSize) {
          var end = Math.min(i + blockSize, length);
          var lChunk = new Int16Array(end - i);
          var rChunk = new Int16Array(end - i);
          for (var j = i; j < end; j++) {
            lChunk[j - i] = floatToInt16(left[j]);
            rChunk[j - i] = floatToInt16(right[j]);
          }
          var buf = mp3enc.encodeBuffer(lChunk, rChunk);
          if (buf.length > 0) mp3Data.push(buf);
        }
      }
      var lastBuf = mp3enc.flush();
      if (lastBuf.length > 0) mp3Data.push(lastBuf);
      var blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      audioCtx.close();
      resolve({ blob: blob, ext: 'mp3' });
    } catch (e) {
      audioCtx.close();
      reject(e);
    }
  });
}

function convEncodeWav(audioBuffer, numChannels, sampleRate) {
  var length = audioBuffer.length;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var dataSize = length * blockAlign;
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);
  function writeString(offset, str) {
    for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  var offset = 44;
  for (var i = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return buffer;
}

function convExtended80(val, view, off) {
  if (val === 0 || !isFinite(val)) { for (var i = 0; i < 10; i++) view.setUint8(off + i, 0); return; }
  var sign = val < 0 ? 1 : 0;
  val = Math.abs(val);
  var exp = Math.floor(Math.log2(val));
  var mant = val / Math.pow(2, exp);
  var biasedExp = exp + 16383;
  view.setUint16(off, (sign << 15) | biasedExp, false);
  var frac = mant - 1;
  var scaled = frac * 2147483648;
  var hi = Math.floor(scaled);
  var lo = Math.round((scaled - hi) * 4294967296);
  view.setUint32(off + 2, hi, false);
  view.setUint32(off + 6, lo, false);
}

function convEncodeAiff(audioBuffer, numChannels, sampleRate) {
  var length = audioBuffer.length;
  var bytesPerSample = 2;
  var sampleSize = bytesPerSample * 8;
  var dataSize = length * numChannels * bytesPerSample;
  var commSize = 18;
  var ssndSize = 8 + dataSize;
  var totalSize = 4 + 4 + 4 + 4 + commSize + 4 + ssndSize;
  var buffer = new ArrayBuffer(totalSize);
  var view = new DataView(buffer);
  var pos = 0;
  function wStr(s) { for (var i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i)); }
  wStr('FORM');
  view.setUint32(4, totalSize - 8, false); pos += 4;
  wStr('AIFF');
  wStr('COMM');
  view.setUint32(pos, commSize, false); pos += 4;
  view.setUint16(pos, numChannels, false); pos += 2;
  view.setUint32(pos, length, false); pos += 4;
  view.setUint16(pos, sampleSize, false); pos += 2;
  convExtended80(sampleRate, view, pos); pos += 10;
  wStr('SSND');
  view.setUint32(pos, ssndSize, false); pos += 4;
  view.setUint32(pos, 0, false); pos += 4;
  view.setUint32(pos, 0, false); pos += 4;
  for (var i = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, false); pos += 2;
    }
  }
  return buffer;
}

function convEncodeAu(audioBuffer, numChannels, sampleRate) {
  var length = audioBuffer.length;
  var dataSize = length * numChannels * 2;
  var headerSize = 24;
  var buffer = new ArrayBuffer(headerSize + dataSize);
  var view = new DataView(buffer);
  view.setUint32(0, 0x2E736E64, false); // ".snd"
  view.setUint32(4, headerSize, false);
  view.setUint32(8, 0xFFFFFFFF, false);
  view.setUint32(12, 3, false); // 16-bit linear PCM
  view.setUint32(16, sampleRate, false);
  view.setUint32(20, numChannels, false);
  for (var i = 0, off = headerSize; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, false); off += 2;
    }
  }
  return buffer;
}

function convEncodeRaw(audioBuffer, numChannels) {
  var length = audioBuffer.length;
  var dataSize = length * numChannels * 2;
  var buffer = new ArrayBuffer(dataSize);
  var view = new DataView(buffer);
  for (var i = 0, off = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
  }
  return buffer;
}

async function convVideo(file, format) {
  if (format === 'gif') return await convVideoToGif(file);
  var videoMimeMap = {
    mp4: ['video/mp4; codecs=h264', 'video/mp4; codecs=avc1', 'video/mp4', 'video/x-mp4'],
    webm: ['video/webm; codecs=vp9', 'video/webm; codecs=vp8', 'video/webm'],
    mkv: ['video/x-matroska; codecs=vp9', 'video/x-matroska; codecs=vp8', 'video/x-matroska; codecs=h264', 'video/x-matroska', 'video/webm'],
    mov: ['video/quicktime', 'video/mp4', 'video/x-m4v'],
    avi: ['video/x-msvideo', 'video/avi'],
    ogg: ['video/ogg; codecs=theora', 'video/ogg'],
    mpeg: ['video/mpeg', 'video/mp2t'],
    '3gp': ['video/3gpp', 'video/3gpp2'],
    wmv: ['video/x-ms-wmv'],
    flv: ['video/x-flv']
  };
  var extMap = { mp4: 'mp4', webm: 'webm', mkv: 'mkv', mov: 'mov', avi: 'avi', ogg: 'ogg', mpeg: 'mpeg', '3gp': '3gp', wmv: 'wmv', flv: 'flv' };
  var mimeList = videoMimeMap[format] || [];
  if (mimeList.length === 0) throw new Error(__('conv.video_limited', 'Video format not recognized.'));
  var url = URL.createObjectURL(file);
  try {
    var video = await convLoadVideo(url);
    await video.play();
    var stream = video.captureStream();
    for (var mi = 0; mi < mimeList.length; mi++) {
      try {
        var result = await convVideoEncode(stream, mimeList[mi], extMap[format], video.duration);
        video.pause();
        return result;
      } catch(e) {}
    }
    video.pause();
    throw new Error(__('conv.video_limited', 'Video encoding not supported in this browser.'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function convLoadVideo(url) {
  return new Promise(function(resolve, reject) {
    var v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = function() { v.currentTime = 0; resolve(v); };
    v.onerror = function() { reject(new Error('Failed to load video')); };
    v.src = url;
  });
}

function convVideoEncode(stream, mimeType, ext, duration) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    var recorder;
    try { recorder = new MediaRecorder(stream, { mimeType: mimeType }); } catch(e) { reject(e); return; }
    recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = function() { resolve({ blob: new Blob(chunks, { type: mimeType }), ext: ext }); };
    recorder.onerror = function() { reject(new Error('Encoding failed')); };
    recorder.start();
    setTimeout(function() { if (recorder.state === 'recording') recorder.stop(); }, duration * 1000 + 500);
  });
}

function convGifEncode(frames, delayCs, w, h) {
  var data = [];
  function put(b) { data.push(b); }
  function putS(v) { put(v & 0xFF); put((v >> 8) & 0xFF); }
  function putStr(s) { for (var i = 0; i < s.length; i++) put(s.charCodeAt(i)); }
  putStr('GIF89a');
  putS(w); putS(h);
  put(0xF7); put(0); put(0);
  for (var i = 0; i < frames.length; i++) {
    put(0x21); put(0xF9); put(4); put(0x00); putS(delayCs); put(0); put(0x00);
    put(0x2C); putS(0); putS(0); putS(w); putS(h); put(0x00);
    var rgba = frames[i];
    var len = w * h;
    var indices = new Uint8Array(len);
    var minCodeSize = 8;
    for (var j = 0; j < len; j++) {
      var r = rgba[j * 4], g = rgba[j * 4 + 1], b = rgba[j * 4 + 2];
      indices[j] = (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) % 256;
    }
    put(minCodeSize);
    var compressed = convGifLzw(indices, minCodeSize);
    putS(compressed.length);
    for (var k = 0; k < compressed.length; k++) put(compressed[k]);
    put(0x00);
  }
  put(0x3B);
  return new Uint8Array(data);
}

function convGifLzw(indices, minCodeSize) {
  var clearCode = 1 << minCodeSize;
  var eoiCode = clearCode + 1;
  var codeSize = minCodeSize + 1;
  var dict = {};
  var nextCode = eoiCode + 1;
  var result = [];
  var bitBuf = 0, bitCount = 0;
  function outCode(code) {
    bitBuf |= (code << bitCount);
    bitCount += codeSize;
    while (bitCount >= 8) { result.push(bitBuf & 0xFF); bitBuf >>= 8; bitCount -= 8; }
  }
  outCode(clearCode);
  var s = [];
  for (var i = 0; i < indices.length; i++) {
    var c = indices[i];
    var sc = s.concat([c]);
    var key = sc.join(',');
    if (dict[key] !== undefined) { s = sc; continue; }
    outCode(s.length === 1 ? s[0] : dict[s.join(',')]);
    if (nextCode < 4096) { dict[key] = nextCode++; }
    if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    s = [c];
  }
  if (s.length > 0) outCode(s.length === 1 ? s[0] : dict[s.join(',')]);
  outCode(eoiCode);
  if (bitCount > 0) result.push(bitBuf & 0xFF);
  return result;
}

function convVideoToGif(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true;
    v.onloadedmetadata = function() {
      var w = Math.min(v.videoWidth, 320), h = Math.min(v.videoHeight, 240);
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      var dur = v.duration;
      var fps = 10;
      var totalFrames = Math.min(Math.round(dur * fps), 50);
      var interval = dur / totalFrames;
      var frames = [], frameNum = 0;
      function capture() {
        if (frameNum >= totalFrames) {
          v.pause(); URL.revokeObjectURL(url);
          try {
            var gifData = convGifEncode(frames, Math.round(interval * 100), w, h);
            resolve({ blob: new Blob([gifData], { type: 'image/gif' }), ext: 'gif' });
          } catch(e) { reject(e); }
          return;
        }
        v.currentTime = frameNum * interval;
      }
      v.onseeked = function() {
        ctx.drawImage(v, 0, 0, w, h);
        frames.push(ctx.getImageData(0, 0, w, h).data.slice(0));
        frameNum++;
        capture();
      };
      v.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
      capture();
    };
    v.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
    v.src = url;
    v.load();
  });
}

async function convDocument(file, format) {
  var text = await file.text();
  var name = file.name.replace(/\.[^.]+$/, '');
  var result;
  switch (format) {
    case 'txt': result = convDocToTxt(text, file.name); break;
    case 'html': result = convDocToHtml(text, file.name); break;
    case 'md': result = convDocToMd(text, file.name); break;
    case 'pdf': result = await convDocToPdf(text, name); break;
    case 'docx': result = await convDocToDocx(text, name); break;
    case 'json': result = convDocToJson(text, file.name); break;
    case 'xml': result = convDocToXml(text, file.name); break;
    case 'csv': result = convDocToCsv(text, file.name); break;
    default: throw new Error('Unsupported document format: ' + format);
  }
  return result;
}

function convDocToTxt(text) {
  var clean = text.replace(/<\/?[^>]+(>|$)/g, '').replace(/\s+/g, ' ').trim();
  return { blob: new Blob([clean], { type: 'text/plain' }), ext: 'txt' };
}

function convDocToHtml(text, fileName) {
  var body = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escHtml(fileName) + '</title></head><body><pre>' + body + '</pre></body></html>';
  return { blob: new Blob([html], { type: 'text/html' }), ext: 'html' };
}

function convDocToMd(text, fileName) {
  var md = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  md = '# ' + fileName + '\n\n' + md;
  return { blob: new Blob([md], { type: 'text/markdown' }), ext: 'md' };
}

async function convDocToPdf(text, name) {
  if (typeof jspdf === 'undefined') throw new Error('PDF library not loaded. Try TXT format instead.');
  var doc = new jspdf.jsPDF();
  var lines = doc.splitTextToSize(text || '(empty)', 180);
  var y = 20;
  doc.setFontSize(12);
  doc.text(name, 105, y, { align: 'center' }); y += 10;
  doc.setFontSize(9);
  for (var i = 0; i < lines.length; i++) {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(lines[i], 15, y); y += 5;
  }
  return { blob: doc.output('blob'), ext: 'pdf' };
}

async function convDocToDocx(text, name) {
  if (typeof docx === 'undefined') throw new Error('DOCX library not loaded. Try TXT format instead.');
  var Paragraph = docx.Paragraph, TextRun = docx.TextRun, Document = docx.Document, Packer = docx.Packer;
  var lines = text.split('\n');
  var children = [];
  children.push(new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 24 })], spacing: { after: 200 } }));
  for (var i = 0; i < lines.length; i++) {
    children.push(new Paragraph({ children: [new TextRun({ text: lines[i], size: 18 })] }));
  }
  var doc = new Document({ sections: [{ children: children }] });
  var blob = await Packer.toBlob(doc);
  return { blob: blob, ext: 'docx' };
}

function convDocToJson(text, fileName) {
  try {
    var parsed = JSON.parse(text);
    return { blob: new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' }), ext: 'json' };
  } catch(e) {
    return { blob: new Blob([JSON.stringify({ content: text, source: fileName }, null, 2)], { type: 'application/json' }), ext: 'json' };
  }
}

function convDocToXml(text, fileName) {
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n  <source>' + escXml(fileName) + '</source>\n  <content>' + escaped + '</content>\n</document>';
  return { blob: new Blob([xml], { type: 'application/xml' }), ext: 'xml' };
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function convDocToCsv(text, fileName) {
  try {
    var parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      var keys = Object.keys(parsed[0]);
      var csv = keys.join(',') + '\n';
      for (var i = 0; i < parsed.length; i++) {
        csv += keys.map(function(k) { var v = parsed[i][k]; return v != null ? String(v).replace(/\\/g, '\\\\').replace(/,/g, '\\,') : ''; }).join(',') + '\n';
      }
      return { blob: new Blob([csv], { type: 'text/csv' }), ext: 'csv' };
    }
  } catch(e) {}
  var lines = text.split('\n').map(function(l) { return l.replace(/\\/g, '\\\\').replace(/,/g, '\\,'); });
  return { blob: new Blob([lines.join('\n')], { type: 'text/csv' }), ext: 'csv' };
}
