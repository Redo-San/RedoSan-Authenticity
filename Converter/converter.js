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
    case 'video': return ['mp4', 'webm'];
    case 'document': return ['txt', 'html', 'md', 'pdf', 'docx', 'json', 'xml', 'csv'];
    default: return [];
  }
}

function convAudioFormats() {
  var fmts = ['wav', 'aiff', 'mp3'];
  if (typeof MediaRecorder === 'undefined') return fmts;
  var candidates = [
    { mime: 'audio/webm; codecs=opus', ext: 'ogg' },
    { mime: 'audio/webm', ext: 'ogg' },
    { mime: 'audio/ogg; codecs=opus', ext: 'ogg' },
    { mime: 'audio/ogg', ext: 'ogg' },
    { mime: 'audio/opus', ext: 'opus' },
    { mime: 'audio/mpeg', ext: 'mp3' },
    { mime: 'audio/mpeg; codecs=mp3', ext: 'mp3' },
    { mime: 'audio/mp3', ext: 'mp3' },
    { mime: 'audio/mp4; codecs=aac', ext: 'm4a' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/aac', ext: 'm4a' },
    { mime: 'audio/x-m4a', ext: 'm4a' },
    { mime: 'audio/3gpp', ext: 'aac' },
    { mime: 'audio/3gpp2', ext: 'aac' },
    { mime: 'audio/flac', ext: 'flac' },
    { mime: 'audio/x-flac', ext: 'flac' },
    { mime: 'audio/amr', ext: 'amr' },
    { mime: 'audio/amr-wb', ext: 'amr' }
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (MediaRecorder.isTypeSupported(candidates[i].mime)) {
      var dup = false;
      for (var j = 0; j < fmts.length; j++) { if (fmts[j] === candidates[i].ext) { dup = true; break; } }
      if (!dup) fmts.push(candidates[i].ext);
    }
  }
  return fmts;
}

function convGetFormatLabel(fmt) {
  var labels = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', bmp: 'BMP', gif: 'GIF',
    wav: 'WAV', aiff: 'AIFF', mp3: 'MP3', ogg: 'OGG', opus: 'OPUS', m4a: 'M4A', aac: 'AAC', flac: 'FLAC', amr: 'AMR',
    mp4: 'MP4', webm: 'WebM',
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
  if (format === 'wav' || format === 'aiff') {
    var numChannels = audioBuf.numberOfChannels;
    var sampleRate = audioBuf.sampleRate;
    if (format === 'wav') {
      var wavBuf = convEncodeWav(audioBuf, numChannels, sampleRate);
      audioCtx.close();
      return { blob: new Blob([wavBuf], { type: 'audio/wav' }), ext: 'wav' };
    }
    var aiffBuf = convEncodeAiff(audioBuf, numChannels, sampleRate);
    audioCtx.close();
    return { blob: new Blob([aiffBuf], { type: 'audio/aiff' }), ext: 'aiff' };
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
  var mimeList = audioMimeMap[format];
  var chosenMime = '';
  if (mimeList) {
    for (var mi = 0; mi < mimeList.length; mi++) {
      if (MediaRecorder.isTypeSupported(mimeList[mi])) { chosenMime = mimeList[mi]; break; }
    }
  }
  if (chosenMime) {
    return await convAudioEncode(audioCtx, audioBuf, chosenMime, extMap[format]);
  }
  if (format === 'mp3' && typeof lamejs !== 'undefined') {
    return await convAudioToMp3(audioCtx, audioBuf);
  }
  audioCtx.close();
  throw new Error(__('conv.audio_limited', 'Audio conversion is limited in browser. Try WAV format.'));
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

async function convVideo(file, format) {
  throw new Error(__('conv.video_limited', 'Video conversion is limited in browser. Use dedicated video editing software.'));
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
