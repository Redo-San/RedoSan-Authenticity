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

function getMimeForFile(file) {
  var ext = file.name ? file.name.toLowerCase().split('.').pop() : '';
  var map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
  };
  return map[ext] || file.type || 'image/jpeg';
}

function extForMime(mime) {
  var map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  return map[mime] || 'jpg';
}

async function cleanImageFile(file, opts) {
  opts = opts || {};
  var img = await loadImage(file);
  var removed = [];
  var origMime = getMimeForFile(file);

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

  var mime = origMime === 'image/jpeg' ? 'image/jpeg' : origMime;
  var quality = origMime === 'image/jpeg' ? 0.92 : undefined;
  var blob = await canvasToBlob(img.canvas, mime, quality);
  return { type: 'image', blob: blob, removed: removed, mime: mime };
}

async function cleanAudioFile(file, opts) {
  opts = opts || {};
  var info = await awLoadAudio(file);
  var s16 = new Int16Array(info.samples);
  var removed = [];

  if (opts.watermark) {
    for (var i = 0; i < s16.length; i++) s16[i] &= ~1;
    for (var j = 0; j < s16.length; j++) s16[j] = Math.round(s16[j] / 2) * 2;
    removed.push('watermark');
  }

  if (opts.metadata) removed.push('metadata');

  var wavBuf = awWriteWav(s16, info.sr, info.ch, info.raw, info.bps);
  var wavBlob = new Blob([wavBuf], { type: 'audio/wav' });
  return { type: 'audio', blob: wavBlob, removed: removed };
}

function rtDetectType(file) {
  var isAudio = file.type && file.type.startsWith('audio/');
  var ext = file.name ? file.name.toLowerCase().split('.').pop() : '';
  var audioExts = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'wma', 'm4a'];
  var docExts = ['txt', 'pdf', 'docx', 'doc', 'csv', 'json'];
  if (isAudio || audioExts.indexOf(ext) >= 0) return 'audio';
  if (docExts.indexOf(ext) >= 0) return 'document';
  return 'image';
}

function onRtFileChange() {
  var input = document.getElementById('rt-file');
  var file = input && input.files && input.files[0];
  var info = document.getElementById('rt-file-info');
  var options = document.getElementById('rt-options');
  var imgOpts = document.getElementById('rt-image-options');
  var audioOpts = document.getElementById('rt-audio-options');
  var docOpts = document.getElementById('rt-document-options');
  var resultDiv = document.getElementById('rt-result');
  var output = document.getElementById('rt-output');
  var status = document.getElementById('rt-status');

  output.style.display = 'none';
  resultDiv.style.display = 'none';
  options.style.display = 'none';
  imgOpts.style.display = 'none';
  audioOpts.style.display = 'none';
  docOpts.style.display = 'none';

  if (!file) { info.textContent = ''; status.textContent = ''; return; }

  info.textContent = file.name + ' (' + fmtBytes(file.size) + ')';
  options.style.display = 'block';

  var type = rtDetectType(file);
  if (type === 'audio') {
    audioOpts.style.display = 'block';
  } else if (type === 'document') {
    docOpts.style.display = 'block';
  } else {
    imgOpts.style.display = 'block';
  }
}

// ── Document watermark removal helpers ──

function _rtStripDocwChars(text) {
  var zwc = [
    '\u200B','\u200C','\u200D','\uFEFF','\u2060','\u2061','\u2062','\u2063',
    '\u2064','\u2066','\u2067','\u2068','\u2069','\u180E','\u034F','\u061C'
  ];
  for (var i = 0; i < zwc.length; i++) {
    text = text.split(zwc[i]).join('');
  }
  return text;
}

function _rtStripDocwSpaces(text) {
  var special = [
    '\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006',
    '\u2007','\u2008','\u2009','\u200A','\u202F','\u205F','\u3000','\u00A0'
  ];
  for (var i = 0; i < special.length; i++) {
    text = text.split(special[i]).join(' ');
  }
  return text;
}

function _rtNormalizeHomoglyphs(text) {
  var map = {
    '\u0410':'A','\u0412':'B','\u0421':'C','\u0415':'E','\u0406':'I',
    '\u0408':'J','\u041A':'K','\u041C':'M','\u041D':'H','\u041E':'O',
    '\u0420':'P','\u0422':'T','\u0425':'X','\u042F':'R','\u0405':'S',
    '\u0478':'U','\u0474':'V','\u04AE':'Y','\u050C':'G','\u051A':'Q',
    '\u051C':'W','\u04BA':'E','\u04A2':'H','\u047A':'O','\u13A0':'D',
    '\u13DE':'L','\u13AA':'A','\u13DF':'C','\u13C6':'K','\u13F4':'M',
    '\u13E2':'P','\u13BE':'T','\u13B0':'X','\u13A1':'R','\u01A6':'R',
    '\u135A':'S','\u10BD':'S',
    '\u0430':'a','\u0441':'c','\u0435':'e','\u043C':'m','\u043E':'o',
    '\u0440':'p','\u0442':'t','\u0445':'x','\u0443':'y','\u0433':'r',
    '\u0455':'s','\u0456':'i','\u0458':'j','\u0475':'v','\u04BB':'h',
    '\u0501':'d','\u051B':'q','\u051D':'w','\u04D1':'a','\u04AB':'c',
    '\u04D9':'e','\u04D7':'i','\u049F':'k','\u04CE':'m','\u04A8':'o',
    '\u04E7':'p','\u04B1':'s','\u04AD':'t','\u04B3':'x','\u04AF':'y',
    '\u0503':'d','\u04C9':'n','\u0257':'d','\u0266':'h','\u0127':'h',
    '\u0280':'r','\u027F':'r','\u057D':'u','\u222A':'u',
    '\u0180':'b','\u0192':'f','\u0261':'g','\u0138':'k','\u026C':'l',
    '\u0391':'A','\u0395':'E','\u0397':'H','\u039A':'K','\u039C':'M',
    '\u039F':'O','\u03A1':'P','\u03A4':'T','\u03A7':'X','\u0396':'Z',
    '\u03F9':'C','\u03AE':'n',
    '\u03B1':'a','\u03B5':'e','\u03B9':'i','\u03BA':'k','\u03BC':'m',
    '\u03BF':'o','\u03C1':'p','\u03C2':'s','\u03C4':'t','\u03C7':'x',
    '\u03B3':'y','\u03B7':'n','\u03BD':'u','\u03F2':'c',
    '\uFF26':'F','\uFF2E':'N','\uFF10':'0','\uFF11':'1','\uFF12':'2',
    '\uFF13':'3','\uFF14':'4','\uFF15':'5','\uFF16':'6','\uFF17':'7',
    '\uFF18':'8','\uFF19':'9',
    '\u2024':'.','\u104A':',','\u2236':':','\u037E':';','\u2010':'-',
  };
  var out = '';
  for (var i = 0; i < text.length; i++) {
    out += map[text[i]] || text[i];
  }
  return out;
}

function _rtCleanDocText(text) {
  text = _rtStripDocwChars(text);
  text = _rtStripDocwSpaces(text);
  text = _rtNormalizeHomoglyphs(text);
  return text;
}

function _rtDocxStripMeta(xml) {
  // Remove custom XML props, comments, revision marks
  var removeTags = [
    'w:comments', 'w:comment', 'w:revisionView', 'w:trackRevisions',
    'w:rsids', 'cp:', 'dc:', 'dcterms:', 'w:docPr', 'w:proofState',
    'w:customXml', 'w:customXmlPr', 'w:customXmlElement'
  ];
  for (var i = 0; i < removeTags.length; i++) {
    var re = new RegExp('<' + removeTags[i] + '[^>]*>[\\s\\S]*?<\\/' + removeTags[i] + '>', 'gi');
    xml = xml.replace(re, '');
    var reSelf = new RegExp('<' + removeTags[i] + '[^>]*\\/>', 'gi');
    xml = xml.replace(reSelf, '');
  }
  return xml;
}

async function cleanDocumentFile(file, opts) {
  var removed = [];
  var buf = await _rtReadFile(file);

  // Extract text from document
  var text = await _rtExtractDocText(file, buf);
  var originalText = text;

  if (opts.watermark) {
    text = _rtCleanDocText(text);
    removed.push('doc_watermark');
  }

  if (opts.metadata) {
    removed.push('doc_metadata');
  }

  var rebuilt = await _rtRebuildDoc(file, buf, text, opts, originalText);
  return { type: 'document', blob: rebuilt.blob, ext: rebuilt.ext, removed: removed };
}

function _rtReadFile(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) { resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Failed to read file')); };
    reader.readAsArrayBuffer(file);
  });
}

function stringToBytes(str) {
  var buf = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xff;
  return buf;
}

async function _rtDecompressBytes(data) {
  if (typeof DecompressionStream === 'undefined') return null;
  for (var fmtIdx = 0; fmtIdx < 2; fmtIdx++) {
    var fmt = fmtIdx === 0 ? 'deflate' : 'deflate-raw';
    try {
      var st = new DecompressionStream(fmt);
      var sw = st.writable.getWriter();
      var sr = st.readable.getReader();
      var sch = [];
      var srp = (async function () {
        while (true) { var v = await sr.read(); if (v.done) break; sch.push(v.value); }
      })().catch(function () {});
      await sw.write(data);
      await sw.close();
      await srp;
      var sttl = 0;
      for (var sci = 0; sci < sch.length; sci++) sttl += sch[sci].length;
      var dec = new Uint8Array(sttl);
      var soff = 0;
      for (var scj = 0; scj < sch.length; scj++) { dec.set(sch[scj], soff); soff += sch[scj].length; }
      return dec;
    } catch (e) {}
  }
  return null;
}

async function _rtExtractPdfText(buf) {
  var arr = new Uint8Array(buf);
  var src = '';
  for (var i = 0; i < arr.length; i++) src += String.fromCharCode(arr[i]);

  // Quick check: no streams → plain text
  if (!/stream\s*[\r\n]/.test(src)) {
    var raw = '';
    var ptRe = /\(([^)]*)\)\s*Tj/g;
    var pm;
    while ((pm = ptRe.exec(src)) !== null) raw += pm[1];
    return raw || '';
  }

  // Fast path: delegate to DOCX_EXTRACTOR for simple PDFs
  var streamCount = (src.match(/endstream/g) || []).length;
  if (
    typeof DOCX_EXTRACTOR !== 'undefined' &&
    typeof DOCX_EXTRACTOR.readPdf === 'function' &&
    streamCount <= 100 &&
    src.length < 5000000
  ) {
    try {
      var txt = await DOCX_EXTRACTOR.readPdf(new Uint8Array(buf));
      if (txt && txt.length > 0) return txt;
    } catch (e) {}
  }

  // ── Standalone PDF text extraction with CMap support ──

  // Build object map
  var objMap = {};
  var objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  var m;
  while ((m = objRe.exec(src)) !== null) objMap[m[1] + ' ' + m[2]] = m[3];
  await _rtYield();

  // Build CMap from ToUnicode streams
  var cmap = {};
  for (var objId in objMap) {
    var objContent = objMap[objId];
    if (objContent.indexOf('FlateDecode') === -1) continue;
    var sm2 = objContent.match(/stream\s*\n([\s\S]*?)endstream/);
    if (!sm2) continue;
    var raw2 = sm2[1].replace(/[\r\n]+$/, '');
    if (raw2.length > 100000) continue;
    var dec2 = await _rtDecompressBytes(stringToBytes(raw2));
    if (!dec2) continue;
    var data = '';
    for (var di = 0; di < dec2.length; di++) data += String.fromCharCode(dec2[di]);
    if (data.indexOf('begincmap') === -1) continue;

    var bfcharRe = /(\d+)\s+beginbfchar\n([\s\S]*?)endbfchar/g;
    var bm;
    while ((bm = bfcharRe.exec(data)) !== null) {
      var entries = bm[2].split('\n');
      for (var ei = 0; ei < entries.length; ei++) {
        var match = entries[ei].match(/<(\w+)>\s*<(\w+)>/);
        if (match) cmap[parseInt(match[1], 16)] = parseInt(match[2], 16);
      }
    }
    var bfrangeRe = /(\d+)\s+beginbfrange\n([\s\S]*?)endbfrange/g;
    var rm;
    while ((rm = bfrangeRe.exec(data)) !== null) {
      var rentries = rm[2].split('\n');
      for (var ri = 0; ri < rentries.length; ri++) {
        var parts = rentries[ri].match(/<(\w+)>\s*<(\w+)>\s*<(\w+)>/);
        if (parts) {
          var start = parseInt(parts[1], 16);
          var end = parseInt(parts[2], 16);
          var baseCode = parseInt(parts[3], 16);
          for (var ci = start; ci <= end; ci++) {
            if (!cmap[ci]) cmap[ci] = baseCode + (ci - start);
          }
        }
      }
    }
  }
  await _rtYield();

  function cmapChar(code) {
    if (cmap[code]) {
      try { return String.fromCodePoint(cmap[code]); } catch (e) { return '?'; }
    }
    if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
    return '?';
  }
  function unescapePdfStr(s) {
    return s.replace(/\\([nrt])/g, ' ').replace(/\\(.)/g, '$1');
  }

  // Find page content references
  var pages = [];
  var pageRe = /\/Contents\s+(\d+)\s+(\d+)\s+R/g;
  var pm2;
  while ((pm2 = pageRe.exec(src)) !== null) {
    pages.push(pm2[1] + ' ' + pm2[2]);
  }
  if (pages.length === 0) return '';

  var textPieces = [];
  var streamRe = /stream\s*\n([\s\S]*?)endstream/g;
  var si = 0;
  while ((sm2 = streamRe.exec(src)) !== null) {
    si++;
    if (si % 5 === 0) await _rtYield();
    var rawStream = sm2[1].replace(/[\r\n]+$/, '');
    if (rawStream.length > 500000) continue;

    var decBytes = await _rtDecompressBytes(stringToBytes(rawStream));
    if (!decBytes || decBytes.length === 0) continue;

    var content = '';
    for (var d2 = 0; d2 < decBytes.length; d2++) content += String.fromCharCode(decBytes[d2]);
    if (content.indexOf('BT') === -1 || content.indexOf('ET') === -1) continue;

    // Parenthesized strings with Tj
    var psRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    var tm;
    while ((tm = psRe.exec(content)) !== null) textPieces.push(unescapePdfStr(tm[1]));

    // Hex strings with Tj (decode via CMap)
    var hsRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
    while ((tm = hsRe.exec(content)) !== null) {
      textPieces.push(cmapChar(parseInt(tm[1], 16)));
    }

    // TJ arrays
    var tjRe = /\[([^\]]*)\]\s*TJ/g;
    while ((tm = tjRe.exec(content)) !== null) {
      var parRe = /\(((?:[^()\\]|\\.)*)\)/g;
      var pm3;
      while ((pm3 = parRe.exec(tm[1])) !== null) textPieces.push(unescapePdfStr(pm3[1]));
      var hxRe = /<([0-9A-Fa-f]+)>/g;
      while ((pm3 = hxRe.exec(tm[1])) !== null) textPieces.push(cmapChar(parseInt(pm3[1], 16)));
    }

    if (textPieces.length > 100000) await _rtYield();
  }

  return textPieces.join(' ').replace(/[ \t\n\r\f\v]+/g, ' ').trim();
}

function _rtExtractDocText(file, buf) {
  return new Promise(function (resolve, reject) {
    var ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'docx' && typeof DOCX_EXTRACTOR !== 'undefined' && DOCX_EXTRACTOR.readDocx) {
      DOCX_EXTRACTOR.readDocx(buf).then(resolve).catch(function (err) {
        reject(new Error('DOCX extraction failed: ' + err.message));
      });
    } else if (ext === 'pdf') {
      _rtExtractPdfText(buf).then(resolve).catch(function () { resolve(''); });
    } else if (ext === 'doc') {
      var arr = new Uint8Array(buf);
      var result = '';
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if ((c >= 0x20 && c <= 0x7e) || c === 0x0a || c === 0x0d) {
          result += String.fromCharCode(c);
        }
      }
      resolve(result.replace(/\s+/g, ' ').trim() || 'No readable text');
    } else {
      resolve(new TextDecoder('UTF-8').decode(new Uint8Array(buf)));
    }
  });
}

async function _rtDeflate(bytes) {
  if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream not available');
  var cs = new CompressionStream('deflate-raw');
  var writer = cs.writable.getWriter();
  var reader = cs.readable.getReader();
  var chunks = [];
  var readPromise = (async function () {
    while (true) { var v = await reader.read(); if (v.done) break; chunks.push(v.value); }
  })().catch(function () {});
  await writer.write(bytes);
  await writer.close();
  await readPromise;
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
  var result = new Uint8Array(total);
  var offset = 0;
  for (var i2 = 0; i2 < chunks.length; i2++) { result.set(chunks[i2], offset); offset += chunks[i2].length; }
  return result;
}

function _rtYield() { return new Promise(function (r) { setTimeout(r, 0); }); }

function _rtTryUtf16BeDecode(text) {
  if (text.length < 4 || text.length % 2 !== 0) return null;
  var result = "";
  for (var i = 0; i < text.length; i += 2) {
    var code = (text.charCodeAt(i) << 8) | text.charCodeAt(i + 1);
    if (code === 0) return null;
    result += String.fromCharCode(code);
  }
  return result;
}
function _rtUtf16BeEncode(text) {
  var result = "";
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    result += String.fromCharCode((code >> 8) & 0xff);
    result += String.fromCharCode(code & 0xff);
  }
  return result;
}

function _rtCleanPdfStream(content, cmap) {
  // Clean text in Tj operators: (text) Tj
  content = content.replace(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g, function (match, text) {
    var raw = text.replace(/\\(.)/g, "$1");
    // Try UTF-16 BE decode (for appended watermark text blocks)
    var utf16 = _rtTryUtf16BeDecode(raw);
    if (utf16 !== null) {
      var cleanedUtf16 = _rtCleanDocText(utf16);
      if (cleanedUtf16 !== utf16) {
        var reEncoded = _rtUtf16BeEncode(cleanedUtf16);
        return "(" + reEncoded.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ") Tj";
      }
    }
    // Fall back to literal text cleaning
    var cleaned = _rtCleanDocText(raw);
    return "(" + cleaned.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ") Tj";
  });
  // Clean text in TJ arrays: [(text) num (text) ...] TJ
  content = content.replace(/\[([^\]]*)\]\s*TJ/g, function (match, arr) {
    return "[" + arr.replace(/\(((?:[^()\\]|\\.)*)\)/g, function (inner, text) {
      var raw = text.replace(/\\(.)/g, "$1");
      var utf16 = _rtTryUtf16BeDecode(raw);
      if (utf16 !== null) {
        var cleanedUtf16 = _rtCleanDocText(utf16);
        if (cleanedUtf16 !== utf16) {
          return "(" + _rtUtf16BeEncode(cleanedUtf16).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
        }
      }
      var cleaned = _rtCleanDocText(raw);
      return "(" + cleaned.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
    }) + "] TJ";
  });
  // Clean hex-encoded Tj operators
  // If CMap is available, decode multi-byte hex via CMap, clean, re-encode
  if (cmap) {
    var hexRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
    var hm;
    while ((hm = hexRe.exec(content)) !== null) {
      var hexStr = hm[1];
      var cid = parseInt(hexStr, 16);
      if (cmap.forward[cid] !== undefined) {
        var uni = cmap.forward[cid];
        var ch;
        try { ch = String.fromCodePoint(uni); } catch (e) { continue; }
        var cleaned = _rtCleanDocText(ch);
        if (cleaned !== ch) {
          if (cleaned.length === 0) {
            content = content.substring(0, hm.index) + content.substring(hm.index + hm[0].length);
            hexRe.lastIndex = hm.index;
          } else {
            var newCid = cmap.reverse[cleaned.charCodeAt(0)];
            if (newCid !== undefined) {
              var newHex = newCid.toString(16).toUpperCase().padStart(hexStr.length, '0');
              var repl = "<" + newHex + "> Tj";
              content = content.substring(0, hm.index) + repl + content.substring(hm.index + hm[0].length);
              hexRe.lastIndex = hm.index + repl.length;
            } else {
              var esc = cleaned.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
              var repl2 = "(" + esc + ") Tj";
              content = content.substring(0, hm.index) + repl2 + content.substring(hm.index + hm[0].length);
              hexRe.lastIndex = hm.index + repl2.length;
            }
          }
        }
      } else if (hexStr.length === 2) {
        // Identity CMap fallback: single-byte hex
        var cp = parseInt(hexStr, 16);
        if (cp >= 0x20 && cp <= 0x7e) {
          var cleaned = _rtCleanDocText(String.fromCharCode(cp));
          if (cleaned !== String.fromCharCode(cp)) {
            var esc2 = cleaned.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
            var repl3 = "(" + esc2 + ") Tj";
            content = content.substring(0, hm.index) + repl3 + content.substring(hm.index + hm[0].length);
            hexRe.lastIndex = hm.index + repl3.length;
          }
        }
      }
    }
  } else {
    // No CMap: identity CMap fallback (single byte printable ASCII)
    var hexRe2 = /<([0-9A-Fa-f]+)>\s*Tj/g;
    var hm2;
    while ((hm2 = hexRe2.exec(content)) !== null) {
      var cp2 = parseInt(hm2[1], 16);
      if (cp2 >= 0x20 && cp2 <= 0x7e) {
        var cleaned2 = _rtCleanDocText(String.fromCharCode(cp2));
        if (cleaned2 !== String.fromCharCode(cp2)) {
          var esc3 = cleaned2.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
          var repl4 = "(" + esc3 + ") Tj";
          content = content.substring(0, hm2.index) + repl4 + content.substring(hm2.index + hm2[0].length);
          hexRe2.lastIndex = hm2.index + repl4.length;
        }
      }
    }
  }
  return content;
}

async function _rtBuildCMap(src) {
  var cmap = { forward: {}, reverse: {} };
  var objRe = /(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g;
  var m;
  while ((m = objRe.exec(src)) !== null) {
    var objContent = m[2];
    if (objContent.indexOf("FlateDecode") === -1) continue;
    var sm2 = objContent.match(/stream\s*\n([\s\S]*?)endstream/);
    if (!sm2) continue;
    var raw2 = sm2[1].replace(/[\r\n]+$/, "");
    if (raw2.length > 100000) continue;
    var dec2;
    try { dec2 = await _rtDecompressBytes(stringToBytes(raw2)); } catch (e) { continue; }
    if (!dec2 || dec2.length === 0) continue;
    var data = "";
    for (var di = 0; di < dec2.length; di++) data += String.fromCharCode(dec2[di]);
    if (data.indexOf("begincmap") === -1) continue;
    var bfcharRe = /(\d+)\s+beginbfchar\n([\s\S]*?)endbfchar/g;
    var bm;
    while ((bm = bfcharRe.exec(data)) !== null) {
      var entries = bm[2].split("\n");
      for (var ei = 0; ei < entries.length; ei++) {
        var match = entries[ei].match(/<(\w+)>\s*<(\w+)>/);
        if (match) {
          var cid = parseInt(match[1], 16);
          var uni = parseInt(match[2], 16);
          if (!cmap.forward[cid]) cmap.forward[cid] = uni;
          if (cmap.reverse[uni] === undefined) cmap.reverse[uni] = cid;
        }
      }
    }
    var bfrangeRe = /(\d+)\s+beginbfrange\n([\s\S]*?)endbfrange/g;
    var rm;
    while ((rm = bfrangeRe.exec(data)) !== null) {
      var rentries = rm[2].split("\n");
      for (var ri = 0; ri < rentries.length; ri++) {
        var parts = rentries[ri].match(/<(\w+)>\s*<(\w+)>\s*<(\w+)>/);
        if (parts) {
          var start = parseInt(parts[1], 16);
          var end = parseInt(parts[2], 16);
          var baseCode = parseInt(parts[3], 16);
          for (var ci = start; ci <= end; ci++) {
            var uni2 = baseCode + (ci - start);
            if (!cmap.forward[ci]) {
              cmap.forward[ci] = uni2;
              if (cmap.reverse[uni2] === undefined) cmap.reverse[uni2] = ci;
            }
          }
        }
      }
    }
  }
  return cmap;
}

async function _rtRebuildPdf(buf, originalText, cleanedText) {
  var src = '';
  var arr = new Uint8Array(buf);
  for (var i = 0; i < arr.length; i++) {
    src += String.fromCharCode(arr[i]);
    if (i > 0 && i % 500000 === 0) await _rtYield();
  }
  var cmap = null;
  try { cmap = await _rtBuildCMap(src); } catch (e) { cmap = null; }
  var result = '', lastIdx = 0;
  var re = /stream([\r\n]+)([\s\S]*?)endstream/g;
  var m;
  var streamCount = 0;
  while ((m = re.exec(src)) !== null) {
    streamCount++;
    if (streamCount % 3 === 0) await _rtYield();
    result += src.substring(lastIdx, m.index);
    result += 'stream' + m[1];
    var rawData = m[2];
    var cleanData = rawData.replace(/[\r\n]+$/, '');
    // Skip very large streams (image data) — preserves them unchanged
    if (cleanData.length > 500000) {
      result += rawData + 'endstream';
      lastIdx = m.index + m[0].length;
      continue;
    }
    var rawBytes = new Uint8Array(cleanData.length);
    for (var di = 0; di < cleanData.length; di++) rawBytes[di] = cleanData.charCodeAt(di) & 0xff;
    var modified = cleanData;
    var dec = null;
    for (var fmtIdx = 0; fmtIdx < 2 && dec === null; fmtIdx++) {
      var fmt = fmtIdx === 0 ? 'deflate' : 'deflate-raw';
      try {
        var st = new DecompressionStream(fmt);
        var sw = st.writable.getWriter();
        var sr = st.readable.getReader();
        var sch = [];
        var srp = (async function () {
          while (true) { var v = await sr.read(); if (v.done) break; sch.push(v.value); }
        })().catch(function () {});
        await sw.write(rawBytes);
        await sw.close();
        await srp;
        var sttl = 0;
        for (var si = 0; si < sch.length; si++) sttl += sch[si].length;
        dec = new Uint8Array(sttl);
        var soff = 0;
        for (var sj = 0; sj < sch.length; sj++) { dec.set(sch[sj], soff); soff += sch[sj].length; }
      } catch (e) { dec = null; }
    }
    if (dec) {
      var decStr = '';
      for (var d2 = 0; d2 < dec.length; d2++) decStr += String.fromCharCode(dec[d2]);
      if (/\(.*\)\s*Tj|\[.*\]\s*TJ|<[0-9A-Fa-f]+>\s*Tj/.test(decStr) && originalText !== cleanedText) {
        var newStr = _rtCleanPdfStream(decStr, cmap);
        if (newStr !== decStr) {
          var nBytes = new Uint8Array(newStr.length);
          for (var nb = 0; nb < newStr.length; nb++) nBytes[nb] = newStr.charCodeAt(nb) & 0xff;
          var comp = await _rtDeflate(nBytes);
          modified = '';
          for (var ciX = 0; ciX < comp.length; ciX++) modified += String.fromCharCode(comp[ciX]);
        }
      }
    }
    var trail = rawData.substring(cleanData.length);
    result += modified + trail + 'endstream';
    lastIdx = m.index + m[0].length;
  }
  result += src.substring(lastIdx);
  var out = new Uint8Array(result.length);
  for (var i2 = 0; i2 < result.length; i2++) out[i2] = result.charCodeAt(i2) & 0xff;
  return out;
}

function _rtDocToDocx(text) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not available');
  var zip = new JSZip();
  var esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>');
  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>');
  zip.file('word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>');
  var paragraphs = text.split(/\n+/);
  var bodyXml = '';
  for (var pi = 0; pi < paragraphs.length; pi++) {
    var para = paragraphs[pi].trim();
    if (para) {
      bodyXml += '<w:p><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>' + esc(para) + '</w:t></w:r></w:p>';
    }
  }
  if (!bodyXml) bodyXml = '<w:p><w:r><w:t> </w:t></w:r></w:p>';
  zip.file('word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + bodyXml + '</w:body></w:document>');
  zip.file('word/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="200" w:line="276"/></w:pPr></w:style>' +
    '</w:styles>');
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function _rtRebuildDoc(file, buf, text, opts, originalText) {
  var ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'txt') {
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), ext: 'txt' };
  }
  if (ext === 'csv') {
    return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), ext: 'csv' };
  }
  if (ext === 'json') {
    return { blob: new Blob([text], { type: 'application/json;charset=utf-8' }), ext: 'json' };
  }

  if (ext === 'docx' && typeof JSZip !== 'undefined') {
    try {
      var zip = await JSZip.loadAsync(buf);
      if (opts.watermark) {
        var docXml = await zip.file('word/document.xml').async('string');
        var runCount = 0;
        docXml = docXml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function (match, content) {
          runCount++;
          if (runCount === 1) {
            return match.replace(content, _rtCleanDocText(content));
          }
          return match.replace(content, '');
        });
        zip.file('word/document.xml', docXml);
      }
      if (opts.metadata) {
        var docPropsFiles = ['docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml'];
        for (var pi = 0; pi < docPropsFiles.length; pi++) {
          if (zip.file(docPropsFiles[pi])) zip.remove(docPropsFiles[pi]);
        }
        if (zip.file('word/comments.xml')) zip.remove('word/comments.xml');
        if (zip.file('word/commentsExtended.xml')) zip.remove('word/commentsExtended.xml');
        if (zip.file('word/people.xml')) zip.remove('word/people.xml');
      }
      var contentTypes = await zip.file('[Content_Types].xml').async('string');
      contentTypes = contentTypes.replace(/<Override PartName="\/docProps\/[^"]+"[^/]*\/>/g, '');
      contentTypes = contentTypes.replace(/<Override PartName="\/word\/comments[^"]+"[^/]*\/>/g, '');
      contentTypes = contentTypes.replace(/<Override PartName="\/word\/people\.xml"[^/]*\/>/g, '');
      zip.file('[Content_Types].xml', contentTypes);
      var newZip = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      return { blob: newZip, ext: 'docx' };
    } catch (e) {}
  }

  // PDF — rebuild with cleaned text in content streams
  if (ext === 'pdf' && opts.watermark && originalText && originalText !== text) {
    try {
      var pdfBytes = await _rtRebuildPdf(buf, originalText, text);
      return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), ext: 'pdf' };
    } catch (e) {}
  }

  // DOC — rebuild as minimal DOCX (can't modify binary .doc in browser)
  if (ext === 'doc' && typeof JSZip !== 'undefined') {
    try {
      var docxBlob = await _rtDocToDocx(text);
      return { blob: docxBlob, ext: 'docx' };
    } catch (e) {}
  }

  // Unsupported format: fall back to TXT
  return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), ext: 'txt' };
}

function showRtLoading(msg) {
  var ov = document.getElementById('rt-loading-overlay');
  if (!ov) return;
  ov.style.display = 'flex';
  var lt = document.getElementById('rt-loading-text');
  if (lt) lt.textContent = msg || 'Processing...';
}
function hideRtLoading() {
  var ov = document.getElementById('rt-loading-overlay');
  if (ov) ov.style.display = 'none';
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

  var type = rtDetectType(file);
  var isHeavy = type === 'document' || type === 'audio';
  if (isHeavy) showRtLoading(__('rt.processing', 'Processing...'));

  // Allow browser to paint the overlay before blocking
  await new Promise(function (r) { setTimeout(r, 30); });

  try {
    var opts = {};
    var result;

    if (type === 'audio') {
      opts.watermark = document.getElementById('rt-audio-wm').checked;
      opts.metadata = document.getElementById('rt-audio-meta').checked;
      result = await cleanAudioFile(file, opts);
    } else if (type === 'document') {
      opts.watermark = document.getElementById('rt-doc-wm').checked;
      opts.metadata = document.getElementById('rt-doc-meta').checked;
      result = await cleanDocumentFile(file, opts);
    } else {
      opts.watermark = document.getElementById('rt-wm').checked;
      opts.pixelInjection = document.getElementById('rt-pi').checked;
      opts.c2pa = document.getElementById('rt-c2pa').checked;
      opts.metadata = document.getElementById('rt-meta').checked;
      result = await cleanImageFile(file, opts);
    }

    if (isHeavy) hideRtLoading();

    var url = URL.createObjectURL(result.blob);
    if (window._rtLastUrl) URL.revokeObjectURL(window._rtLastUrl);
    window._rtLastUrl = url;

    var removedLabels = [];
    var labelMap = {
      watermark: __('rt.watermark_label', 'Digital Watermark'),
      pixel_injection: __('rt.pixel_injection_label', 'Pixel Injection'),
      c2pa: __('rt.c2pa_label', 'C2PA Provenance'),
      metadata: __('rt.metadata_label', 'Metadata'),
      doc_watermark: __('rt.remove_doc_wm', 'Document Watermark'),
      doc_metadata: __('rt.remove_doc_meta', 'Metadata')
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
            .replace('{orig}', escHtml(fmtBytes(origSize))).replace('{new}', escHtml(fmtBytes(newSize))).replace('{reduction}', escHtml(String(reduction)));
      }
      output.innerHTML += '</div>';
      var ext = result.mime ? extForMime(result.mime) : 'jpg';
      var fileName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
      dl.innerHTML = '<a href="' + url + '" download="' + escHtml(fileName) + '" class="btn">' +
        __('rt.download_btn', 'Download Cleaned Image') + '</a>';
    } else if (type === 'document') {
      var cleanedDocExt = result.ext || 'txt';
      var cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + cleanedDocExt;
      output.innerHTML =
        '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">' +
        __('rt.removed_label', 'Removed: {items}').replace('{items}', escHtml(removedSummary)) + '</div>';
      dl.innerHTML = '<a href="' + url + '" download="' + escHtml(cleanedName) + '" class="btn">' +
        __('rt.download_doc_btn', 'Download Cleaned Document') + '</a>';
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
    if (isHeavy) hideRtLoading();
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
