(function(){if(typeof window!='undefined'&&window.location&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var CONV_IMG_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.ico'];
var CONV_AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.wma', '.opus'];
var CONV_VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'];
var CONV_DOC_EXTS = ['.txt', '.md', '.html', '.htm', '.csv', '.json', '.xml', '.pdf', '.doc', '.docx', '.rtf', '.odt'];
var CONV_SUB_EXTS = ['.srt', '.vtt', '.ass', '.ssa', '.sub', '.sbv', '.smi', '.lrc', '.ttml', '.dfxp', '.mpl2', '.pjs', '.rt'];

function convDetectType(file) {
  var name = file.name.toLowerCase();
  for (var i = 0; i < CONV_IMG_EXTS.length; i++) { if (name.endsWith(CONV_IMG_EXTS[i])) return 'image'; }
  for (var i = 0; i < CONV_AUDIO_EXTS.length; i++) { if (name.endsWith(CONV_AUDIO_EXTS[i])) return 'audio'; }
  for (var i = 0; i < CONV_VIDEO_EXTS.length; i++) { if (name.endsWith(CONV_VIDEO_EXTS[i])) return 'video'; }
  for (var i = 0; i < CONV_DOC_EXTS.length; i++) { if (name.endsWith(CONV_DOC_EXTS[i])) return 'document'; }
  for (var i = 0; i < CONV_SUB_EXTS.length; i++) { if (name.endsWith(CONV_SUB_EXTS[i])) return 'subtitle'; }
  return 'unknown';
}

function convGetFormats(type) {
  switch (type) {
    case 'image': return ['png', 'jpeg', 'webp', 'bmp', 'gif'];
    case 'audio': return convAudioFormats();
    case 'video': return convVideoFormats();
    case 'document': return ['txt', 'html', 'md', 'pdf', 'docx', 'json', 'xml', 'csv'];
    case 'subtitle': return convSubFormats();
    default: return [];
  }
}

function convAudioFormats() {
  return ['wav', 'aiff', 'au', 'raw', 'mp3', 'ogg', 'opus', 'm4a', 'aac', 'flac', 'amr'];
}

function convVideoFormats() {
  return ['mp4', 'webm', 'mkv', 'mov', 'avi', 'mpeg', '3gp', 'wmv', 'flv', 'gif'];
}

function convSubFormats() {
  return ['srt', 'vtt', 'ass', 'sub', 'sbv', 'txt', 'lrc', 'ttml'];
}

function convGetFormatLabel(fmt) {
  var labels = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', bmp: 'BMP', gif: 'GIF',
    wav: 'WAV', aiff: 'AIFF', au: 'AU', raw: 'RAW', mp3: 'MP3', ogg: 'OGG', opus: 'OPUS', m4a: 'M4A', aac: 'AAC', flac: 'FLAC', amr: 'AMR',
    mp4: 'MP4', webm: 'WebM', mkv: 'MKV', mov: 'MOV', avi: 'AVI', mpeg: 'MPEG', '3gp': '3GP', wmv: 'WMV', flv: 'FLV',
    txt: 'TXT', html: 'HTML', md: 'Markdown', pdf: 'PDF', docx: 'DOCX',
    json: 'JSON', xml: 'XML', csv: 'CSV',
    srt: 'SRT', vtt: 'VTT', ass: 'ASS', sub: 'SUB', sbv: 'SBV', lrc: 'LRC', ttml: 'TTML' };
  return labels[fmt] || fmt.toUpperCase();
}

function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

var _convFile = null;
var _convType = '';
var _convFormats = [];

function convSetProgress(pct) {
  var bar = document.getElementById('conv-progress');
  var fill = document.getElementById('conv-progress-fill');
  if (!bar || !fill) return;
  if (pct < 0) {
    bar.style.display = 'block';
    fill.style.width = '30%';
    fill.style.animation = 'conv-progress-indeterminate 1.5s ease-in-out infinite';
  } else {
    fill.style.animation = 'none';
    fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    bar.style.display = 'block';
    if (pct >= 100) {
      setTimeout(function() { bar.style.display = 'none'; }, 600);
    }
  }
}

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
  var extMap = { jpg: 'jpeg', jpeg: 'jpg', tiff: 'tif', tif: 'tiff', htm: 'html', ssa: 'ass', dfxp: 'ttml' };
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
  convSetProgress(-1);
  outDiv.style.display = 'none';
  dl.innerHTML = '';
  try {
    var format = convGetSelectedFormat();
    if (!format) { throw new Error('No format selected'); }
    var result = await convRun(_convFile, _convType, format);
    convSetProgress(100);
    if (result) {
      var ext = result.ext || format;
      var outName = _convFile.name.replace(/\.[^.]+$/, '') + '.' + ext;
      var a = document.createElement('a');
      a.textContent = __('conv.download', 'Download') + ' (' + escHtml(outName) + ')';
      a.className = 'btn';
      a.onclick = function() {
        var blobUrl = URL.createObjectURL(result.blob);
        var tmp = document.createElement('a');
        tmp.href = blobUrl;
        tmp.download = outName;
        document.body.appendChild(tmp);
        tmp.click();
        document.body.removeChild(tmp);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 5000);
      };
      dl.appendChild(a);
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
    case 'subtitle': return await convSubtitle(file, format);
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

var _convFfmpeg = null;

async function convVideo(file, format) {
  if (format === 'gif') return await convVideoToGif(file);
  try {
    return await convVideoNative(file, format);
  } catch(e) {
    if (e.message.indexOf('code 4') !== -1 && typeof FFmpeg !== 'undefined') {
      return await convVideoFfmpeg(file, format);
    }
    throw e;
  }
}

async function convVideoNative(file, format) {
  var videoMimeMap = {
    mp4: ['video/mp4; codecs=h264', 'video/mp4; codecs=avc1', 'video/mp4', 'video/x-mp4'],
    webm: ['video/webm; codecs=vp9', 'video/webm; codecs=vp8', 'video/webm'],
    mkv: ['video/x-matroska; codecs=vp9', 'video/x-matroska; codecs=vp8', 'video/x-matroska; codecs=h264', 'video/x-matroska', 'video/webm'],
    mov: ['video/quicktime', 'video/mp4', 'video/x-m4v'],
    avi: ['video/x-msvideo', 'video/avi'],
    mpeg: ['video/mpeg', 'video/mp2t'],
    '3gp': ['video/3gpp', 'video/3gpp2'],
    wmv: ['video/x-ms-wmv'],
    flv: ['video/x-flv']
  };
  var extMap = { mp4: 'mp4', webm: 'webm', mkv: 'mkv', mov: 'mov', avi: 'avi', mpeg: 'mpeg', '3gp': '3gp', wmv: 'wmv', flv: 'flv' };
  var mimeList = videoMimeMap[format] || [];
  if (mimeList.length === 0) throw new Error(__('conv.video_limited', 'Video format not recognized.'));
  var url = URL.createObjectURL(file);
  try {
    var video = await convLoadVideo(url);
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 480;
    video.play().catch(function(){});
    var stream = null;
    if (typeof video.captureStream === 'function') {
      try {
        stream = video.captureStream();
        if (!stream || !stream.getVideoTracks || !stream.getVideoTracks().length)
          stream = null;
      } catch(e) { stream = null; }
    }
    if (!stream) {
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      var drawFrame = function() {
        if (!video.paused) ctx.drawImage(video, 0, 0, w, h);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();
      try { stream = canvas.captureStream(30); } catch(e) {
        video.pause();
        throw new Error(__('conv.video_limited', 'Video encoding not supported in this browser.'));
      }
      if (!stream || !stream.getVideoTracks || !stream.getVideoTracks().length) {
        video.pause();
        throw new Error(__('conv.video_limited', 'Video encoding not supported in this browser.'));
      }
    }
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

async function convVideoFfmpeg(file, format) {
  var ffmpegArgs = {
    mp4:  { ext: 'mp4',  args: ['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac'] },
    webm: { ext: 'webm', args: ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis'] },
    mkv:  { ext: 'mkv',  args: ['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac'] },
    mov:  { ext: 'mov',  args: ['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac'] },
    avi:  { ext: 'avi',  args: ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'mp3'] },
    mpeg: { ext: 'mpg',  args: ['-c:v', 'mpeg2video', '-q:v', '5', '-c:a', 'mp2'] },
    '3gp': { ext: '3gp',  args: ['-c:v', 'h263', '-b:v', '512k', '-c:a', 'amr_nb', '-ar', '8000'] },
    wmv:  { ext: 'wmv',  args: ['-c:v', 'wmv2', '-b:v', '1M', '-c:a', 'wmav2'] },
    flv:  { ext: 'flv',  args: ['-c:v', 'flv', '-b:v', '1M', '-c:a', 'mp3'] }
  };
  var fmt = ffmpegArgs[format];
  if (!fmt) throw new Error(__('conv.video_limited', 'Video format not recognized.'));
  var status = document.getElementById('conv-status');
  if (status) status.textContent = __('conv.loading_decoder', 'Loading video decoder...');
  var ff = _convFfmpeg;
  if (!ff) {
    convSetProgress(-1);
    ff = FFmpeg.createFFmpeg({
      corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
      mainName: 'main',
      log: false
    });
    await ff.load();
    _convFfmpeg = ff;
  }
  if (status) status.textContent = __('conv.converting', 'Converting...');
  convSetProgress(10);
  var ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  var inName = 'input.' + ext;
  var outName = 'output.' + fmt.ext;
  ff.FS('writeFile', inName, await FFmpeg.fetchFile(file));
  convSetProgress(20);

  // Phase 1: try stream copy (fast remux)
  var runArgs = ['-nostdin', '-y', '-i', inName, '-c', 'copy', '-map', '0', outName];
  await ff.run.apply(ff, runArgs);
  var files = ff.FS('readdir', '/');
  if (files.indexOf(outName) === -1) {
    // Phase 2: re-encode with format-specific codecs
    if (status) status.textContent = __('conv.converting', 'Converting...');
    convSetProgress(20);
    ff.FS('writeFile', inName, await FFmpeg.fetchFile(file));
    runArgs = ['-nostdin', '-y', '-i', inName].concat(fmt.args).concat([outName]);
    await ff.run.apply(ff, runArgs);
    files = ff.FS('readdir', '/');
  }

  convSetProgress(90);
  if (files.indexOf(outName) === -1) {
    ff.FS('unlink', inName);
    throw new Error(__('conv.video_limited', 'Video conversion failed. The codec may not be supported.'));
  }
  var data = ff.FS('readFile', outName);
  convSetProgress(95);
  ff.FS('unlink', inName);
  ff.FS('unlink', outName);
  return { blob: new Blob([data.buffer], { type: 'video/' + fmt.ext }), ext: fmt.ext };
}

function convLoadVideo(url) {
  return new Promise(function(resolve, reject) {
    var v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    var resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      resolve(v);
    }
    v.onloadedmetadata = done;
    v.oncanplay = done;
    v.onerror = function() {
      var msg = 'Failed to load video';
      if (v.error) msg += ' (code ' + v.error.code + ')';
      reject(new Error(msg));
    };
    v.src = url;
    v.load();
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

  // Collect color frequencies across all frames, reduce to 5-bit
  var freq = {};
  for (var fi = 0; fi < frames.length; fi++) {
    var rgba = frames[fi];
    for (var j = 0; j < w * h; j++) {
      var ri = rgba[j * 4] >> 3, gi = rgba[j * 4 + 1] >> 3, bi = rgba[j * 4 + 2] >> 3;
      var key = ri + ',' + gi + ',' + bi;
      freq[key] = (freq[key] || 0) + 1;
    }
  }

  // Sort by frequency, take top 256
  var sorted = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
  var maxColors = Math.min(sorted.length, 256);
  var palette = [];
  var palIndex = {};
  for (var i = 0; i < maxColors; i++) {
    var parts = sorted[i].split(',');
    var ri = +parts[0], gi = +parts[1], bi = +parts[2];
    palette.push([(ri << 3) | (ri >> 2), (gi << 3) | (gi >> 2), (bi << 3) | (bi >> 2)]);
    palIndex[sorted[i]] = i;
  }

  // Pad palette to power of 2
  var palSize = 1;
  while (palSize < palette.length) palSize <<= 1;
  while (palette.length < palSize) palette.push([0, 0, 0]);

  var minCodeSize = 1;
  while ((1 << minCodeSize) < palSize) minCodeSize++;
  if (minCodeSize < 2) minCodeSize = 2;

  // Write header + logical screen descriptor + global color table
  putStr('GIF89a');
  putS(w); putS(h);
  put(0xF0 | ((Math.log2(palSize) - 1) & 0x07));
  put(0); put(0);
  for (var pi = 0; pi < palette.length; pi++) {
    put(palette[pi][0]); put(palette[pi][1]); put(palette[pi][2]);
  }

  // Re-map pixels to palette indices using nearest color
  var indices = [];
  for (var fi = 0; fi < frames.length; fi++) {
    var rgba = frames[fi];
    var frameIndices = new Uint8Array(w * h);
    for (var j = 0; j < w * h; j++) {
      var r = rgba[j * 4], g = rgba[j * 4 + 1], b = rgba[j * 4 + 2];
      var ri = r >> 3, gi = g >> 3, bi = b >> 3;
      var key = ri + ',' + gi + ',' + bi;
      var idx = palIndex[key];
      if (idx !== undefined && idx < maxColors) {
        frameIndices[j] = idx;
      } else {
        // Nearest color in palette using 8-bit values
        var best = 0, bestDist = Infinity;
        for (var pi2 = 0; pi2 < palette.length; pi2++) {
          var dr = r - palette[pi2][0], dg = g - palette[pi2][1], db = b - palette[pi2][2];
          var dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) { bestDist = dist; best = pi2; }
        }
        frameIndices[j] = best;
      }
    }
    indices.push(frameIndices);
  }

  for (var fi = 0; fi < frames.length; fi++) {
    put(0x21); put(0xF9); put(4); put(0x00); putS(delayCs); put(0); put(0x00);
    put(0x2C); putS(0); putS(0); putS(w); putS(h); put(0x00);
    put(minCodeSize);
    var compressed = convGifLzw(indices[fi], minCodeSize);
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
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      var dur = v.duration;
      var fps = 10;
      var totalFrames = Math.min(Math.max(Math.round(dur * fps), 1), 50);
      var interval = dur / totalFrames;
      if (dur <= 0 || !isFinite(dur)) { URL.revokeObjectURL(url); reject(new Error('Invalid video duration')); return; }
      var frames = [], frameNum = 0;
      function captureSeek() {
        if (frameNum >= totalFrames) {
          v.pause(); URL.revokeObjectURL(url);
          convSetProgress(95);
          try {
            var gifData = convGifEncode(frames, Math.round(interval * 100), w, h);
            resolve({ blob: new Blob([gifData], { type: 'image/gif' }), ext: 'gif' });
          } catch(e) { reject(e); }
          return;
        }
        v.currentTime = frameNum * interval;
      }
      v.onseeked = function() {
        requestAnimationFrame(function() {
          ctx.drawImage(v, 0, 0, w, h);
          frames.push(ctx.getImageData(0, 0, w, h).data.slice(0));
          frameNum++;
          convSetProgress(Math.round(frameNum / totalFrames * 90));
          captureSeek();
        });
      };
      v.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
      // Start: capture first frame (video already at time 0 after load)
      requestAnimationFrame(function() {
        ctx.drawImage(v, 0, 0, w, h);
        frames.push(ctx.getImageData(0, 0, w, h).data.slice(0));
        frameNum++;
        convSetProgress(Math.round(frameNum / totalFrames * 90));
        captureSeek();
      });
    };
    v.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
    v.src = url;
    v.load();
  });
}

// ── Subtitle Converter ──
function convSubCue(start, end, text) { return { start: start, end: end, text: text }; }

function convSubParse(text, ext) {
  var cues = [];
  switch (ext) {
    case 'srt': {
      var blocks = text.split(/\n\s*\n/);
      for (var b = 0; b < blocks.length; b++) {
        var lines = blocks[b].trim().split('\n');
        if (lines.length < 2) continue;
        var timeMatch = lines[1] ? lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/) : null;
        if (!timeMatch) {
          timeMatch = lines[0].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
          if (!timeMatch) continue;
          lines = lines.slice(0);
        }
        var start = (+timeMatch[1])*3600000 + (+timeMatch[2])*60000 + (+timeMatch[3])*1000 + (+timeMatch[4]);
        var end = (+timeMatch[5])*3600000 + (+timeMatch[6])*60000 + (+timeMatch[7])*1000 + (+timeMatch[8]);
        var textIdx = timeMatch === lines[0].match ? 1 : 2;
        var txt = lines.slice(textIdx).join('\n');
        cues.push(convSubCue(start, end, txt));
      }
      break;
    }
    case 'vtt': {
      var parts = text.split(/\n\s*\n/);
      for (var i = 0; i < parts.length; i++) {
        var lines = parts[i].trim().split('\n');
        if (lines.length < 2 || lines[0] === 'WEBVTT' || lines[0].startsWith('NOTE')) continue;
        var timeMatch = lines[0].match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/) ||
          lines[0].match(/(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/);
        if (!timeMatch) continue;
        var start, end;
        if (timeMatch.length === 9) {
          start = (+timeMatch[1])*3600000 + (+timeMatch[2])*60000 + (+timeMatch[3])*1000 + (+timeMatch[4]);
          end = (+timeMatch[5])*3600000 + (+timeMatch[6])*60000 + (+timeMatch[7])*1000 + (+timeMatch[8]);
        } else {
          start = (+timeMatch[1])*60000 + (+timeMatch[2])*1000 + (+timeMatch[3]);
          end = (+timeMatch[4])*60000 + (+timeMatch[5])*1000 + (+timeMatch[6]);
        }
        cues.push(convSubCue(start, end, lines.slice(1).join('\n')));
      }
      break;
    }
    case 'ass': case 'ssa': {
      var inEvents = false;
      var fmtLine = null;
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l === '[Events]') { inEvents = true; continue; }
        if (l.startsWith('[')) { inEvents = false; continue; }
        if (inEvents && l.startsWith('Format:')) { fmtLine = l.substring(7).split(',').map(function(s) { return s.trim(); }); }
        if (inEvents && l.startsWith('Dialogue:')) {
          var parts = l.substring(9).split(',');
          if (!fmtLine) continue;
          var idx = {};
          for (var f = 0; f < fmtLine.length; f++) idx[fmtLine[f].toLowerCase()] = f;
          if (idx.start === undefined || idx.end === undefined || idx.text === undefined) continue;
          function toMs(t) {
            var m = t.match(/(\d+):(\d+):(\d+)\.(\d+)/);
            if (!m) return 0;
            return (+m[1])*3600000 + (+m[2])*60000 + (+m[3])*1000 + (+m[4])*10;
          }
          var txt = parts.slice(idx.text).join(',').replace(/\\N/g, '\n').replace(/{[^}]*}/g, '');
          cues.push(convSubCue(toMs(parts[idx.start]), toMs(parts[idx.end]), txt));
        }
      }
      break;
    }
    case 'sub': {
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/\{(\d+)\}\{(\d+)\}(.*)/);
        if (m) {
          var fps = 23.976;
          cues.push(convSubCue(Math.round(+m[1]/fps*1000), Math.round(+m[2]/fps*1000), m[3].trim()));
        }
      }
      break;
    }
    case 'sbv': {
      var blocks = text.split(/\n\s*\n/);
      for (var i = 0; i < blocks.length; i++) {
        var lines = blocks[i].trim().split('\n');
        if (lines.length < 2) continue;
        var tm = lines[0].match(/(\d+):(\d+):(\d+)\.(\d+),(\d+):(\d+):(\d+)\.(\d+)/);
        if (!tm) continue;
        cues.push(convSubCue((+tm[1])*3600000+(+tm[2])*60000+(+tm[3])*1000+(+tm[4]), (+tm[5])*3600000+(+tm[6])*60000+(+tm[7])*1000+(+tm[8]), lines.slice(1).join('\n')));
      }
      break;
    }
    case 'lrc': {
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
        if (m) {
          var start = (+m[1])*60000 + (+m[2])*1000 + (+m[3])*10;
          cues.push(convSubCue(start, start + 5000, m[3].trim()));
        }
      }
      break;
    }
    case 'ttml': case 'dfxp': {
      var m;
      var re = /<p[^>]*begin=["']([^"']+)["'][^>]*end=["']([^"']+)["'][^>]*>(.*?)<\/p>/g;
      while ((m = re.exec(text)) !== null) {
        function ttmlToMs(t) {
          if (t.indexOf(':') > -1) {
            var p = t.split(':');
            if (p.length === 3) return (+p[0])*3600000 + (+p[1])*60000 + parseFloat(p[2])*1000;
            return (+p[0])*60000 + parseFloat(p[1])*1000;
          }
          return parseFloat(t.replace('s',''))*1000;
        }
        var txt = m[3].replace(/<[^>]+>/g, '').trim();
        cues.push(convSubCue(ttmlToMs(m[1]), ttmlToMs(m[2]), txt));
      }
      break;
    }
    default: {
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim()) cues.push(convSubCue(i*1000, (i+1)*1000, lines[i].trim()));
      }
    }
  }
  return cues;
}

function convSubFormatTime(ms) {
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  var ms2 = ms % 1000;
  return (h+'').padStart(2,'0')+':'+(m+'').padStart(2,'0')+':'+(s+'').padStart(2,'0')+','+(ms2+'').padStart(3,'0');
}

function convSubFormatTimeVtt(ms) {
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  var ms2 = ms % 1000;
  return (h+'').padStart(2,'0')+':'+(m+'').padStart(2,'0')+':'+(s+'').padStart(2,'0')+'.'+(ms2+'').padStart(3,'0');
}

function convSubFormatAss(ms) {
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  var cs = Math.floor((ms % 1000) / 10);
  return (h+'').padStart(1,'0')+':'+(m+'').padStart(2,'0')+':'+(s+'').padStart(2,'0')+'.'+(cs+'').padStart(2,'0');
}

function convSubWriteSrt(cues) {
  var out = '';
  for (var i = 0; i < cues.length; i++) {
    out += (i+1)+'\n' + convSubFormatTime(cues[i].start) + ' --> ' + convSubFormatTime(cues[i].end) + '\n' + cues[i].text + '\n\n';
  }
  return out;
}

function convSubWriteVtt(cues) {
  var out = 'WEBVTT\n\n';
  for (var i = 0; i < cues.length; i++) {
    out += convSubFormatTimeVtt(cues[i].start) + ' --> ' + convSubFormatTimeVtt(cues[i].end) + '\n' + cues[i].text + '\n\n';
  }
  return out;
}

function convSubWriteAss(cues) {
  var out = '[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  for (var i = 0; i < cues.length; i++) {
    var txt = cues[i].text.replace(/\n/g, '\\N');
    out += 'Dialogue: 0,' + convSubFormatAss(cues[i].start) + ',' + convSubFormatAss(cues[i].end) + ',Default,,0,0,0,,' + txt + '\n';
  }
  return out;
}

function convSubWriteSub(cues) {
  var out = '';
  var fps = 23.976;
  for (var i = 0; i < cues.length; i++) {
    var startFr = Math.round(cues[i].start / 1000 * fps);
    var endFr = Math.round(cues[i].end / 1000 * fps);
    out += '{' + startFr + '}{' + endFr + '}' + cues[i].text + '\n';
  }
  return out;
}

function convSubWriteSbv(cues) {
  var out = '';
  for (var i = 0; i < cues.length; i++) {
    function sbvTime(ms) {
      var h = Math.floor(ms / 3600000);
      var m = Math.floor((ms % 3600000) / 60000);
      var s = Math.floor((ms % 60000) / 1000);
      var ms2 = ms % 1000;
      return (h+'').padStart(2,'0')+':'+(m+'').padStart(2,'0')+':'+(s+'').padStart(2,'0')+'.'+(ms2+'').padStart(3,'0');
    }
    out += sbvTime(cues[i].start) + ',' + sbvTime(cues[i].end) + '\n' + cues[i].text + '\n\n';
  }
  return out;
}

function convSubWriteLrc(cues) {
  var out = '';
  for (var i = 0; i < cues.length; i++) {
    var m = Math.floor(cues[i].start / 60000);
    var s = Math.floor((cues[i].start % 60000) / 1000);
    var cs = Math.floor((cues[i].start % 1000) / 10);
    out += '[' + (m+'').padStart(2,'0') + ':' + (s+'').padStart(2,'0') + '.' + (cs+'').padStart(2,'0') + ']' + cues[i].text.split('\n')[0] + '\n';
  }
  return out;
}

function convSubWriteTtml(cues) {
  var out = '<?xml version="1.0" encoding="UTF-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml">\n<body>\n<div>\n';
  for (var i = 0; i < cues.length; i++) {
    function ttmlTime(ms) {
      var h = Math.floor(ms / 3600000);
      var m = Math.floor((ms % 3600000) / 60000);
      var s = (ms % 60000) / 1000;
      return (h+'').padStart(2,'0')+':'+(m+'').padStart(2,'0')+':'+s.toFixed(3);
    }
    out += '  <p begin="' + ttmlTime(cues[i].start) + '" end="' + ttmlTime(cues[i].end) + '">' + escXml(cues[i].text) + '</p>\n';
  }
  out += '</div>\n</body>\n</tt>';
  return out;
}

function convSubWriteTxt(cues) {
  var out = '';
  for (var i = 0; i < cues.length; i++) out += cues[i].text + '\n';
  return out;
}

async function convSubtitle(file, format) {
  var text = await file.text();
  var ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'ssa') ext = 'ass';
  if (ext === 'dfxp') ext = 'ttml';
  var cues = convSubParse(text, ext);
  var writers = { srt: convSubWriteSrt, vtt: convSubWriteVtt, ass: convSubWriteAss, sub: convSubWriteSub, sbv: convSubWriteSbv, txt: convSubWriteTxt, lrc: convSubWriteLrc, ttml: convSubWriteTtml };
  var mimeMap = { srt: 'text/plain', vtt: 'text/vtt', ass: 'text/plain', sub: 'text/plain', sbv: 'text/plain', txt: 'text/plain', lrc: 'text/plain', ttml: 'application/ttml+xml' };
  var writer = writers[format];
  if (!writer) throw new Error('Unsupported subtitle format');
  var outText = writer(cues);
  return { blob: new Blob([outText], { type: mimeMap[format] || 'text/plain' }), ext: format };
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
