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
    '\u0410':'A','\u0412':'B','\u0421':'C','\u13A0':'D','\u0415':'E',
    '\uFF26':'F','\u050C':'G','\u041D':'H','\u0406':'I','\u0408':'J',
    '\u041A':'K','\u13DE':'L','\u041C':'M','\uFF2E':'N','\u041E':'O',
    '\u0420':'P','\u051A':'Q','\u042F':'R','\u0405':'S','\u0422':'T',
    '\u0478':'U','\u0474':'V','\u051C':'W','\u0425':'X','\u04AE':'Y',
    '\u0396':'Z','\u0430':'a','\u0180':'b','\u0441':'c','\u0501':'d',
    '\u0435':'e','\u0192':'f','\u0261':'g','\u04BB':'h','\u0456':'i',
    '\u0458':'j','\u0138':'k','\u026C':'l','\u043C':'m','\u03B7':'n',
    '\u043E':'o','\u0440':'p','\u051B':'q','\u0433':'r','\u0455':'s',
    '\u0442':'t','\u03BD':'u','\u0475':'v','\u051D':'w','\u0445':'x',
    '\u0443':'y','\u03B6':'z','\uFF10':'0','\uFF11':'1','\uFF12':'2',
    '\uFF13':'3','\uFF14':'4','\uFF15':'5','\uFF16':'6','\uFF17':'7',
    '\uFF18':'8','\uFF19':'9','\u2024':'.','\u104A':',','\u2236':':',
    '\u037E':';','\u2010':'-','\u0391':'A','\u0395':'E','\u0397':'H',
    '\u039A':'K','\u039C':'M','\u039F':'O','\u03A1':'P','\u03A4':'T',
    '\u03A7':'X','\u03B1':'a','\u03B5':'e','\u03B9':'i','\u03BA':'k',
    '\u03BC':'m','\u03BF':'o','\u03C1':'p','\u03C2':'s','\u03C4':'t',
    '\u03C7':'x','\u03B3':'y','\u03F2':'c','\u03F9':'C'
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

  if (opts.watermark) {
    text = _rtCleanDocText(text);
    removed.push('doc_watermark');
  }

  if (opts.metadata) {
    removed.push('doc_metadata');
  }

  var rebuilt = await _rtRebuildDoc(file, buf, text, opts);
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

function _rtExtractDocText(file, buf) {
  return new Promise(function (resolve, reject) {
    var ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'docx' && typeof DOCX_EXTRACTOR !== 'undefined' && DOCX_EXTRACTOR.readDocx) {
      DOCX_EXTRACTOR.readDocx(buf).then(resolve).catch(function (err) {
        reject(new Error('DOCX extraction failed: ' + err.message));
      });
    } else if (ext === 'pdf' && typeof DOCX_EXTRACTOR !== 'undefined' && DOCX_EXTRACTOR.readPdf) {
      DOCX_EXTRACTOR.readPdf(new Uint8Array(buf)).then(function (txt) {
        resolve(txt || '');
      }).catch(function (err) {
        reject(new Error('PDF extraction failed: ' + err.message));
      });
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

async function _rtRebuildDoc(file, buf, text, opts) {
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

  // PDF, DOC, or unsupported: return cleaned text as TXT
  return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), ext: 'txt' };
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
