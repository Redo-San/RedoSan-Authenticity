(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();

var CONV_IMG_EXTS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".svg",
  ".ico",
];
var CONV_AUDIO_EXTS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".flac",
  ".m4a",
  ".wma",
  ".opus",
];
var CONV_VIDEO_EXTS = [
  ".mp4",
  ".webm",
  ".avi",
  ".mov",
  ".mkv",
  ".flv",
  ".wmv",
  ".m4v",
];
var CONV_DOC_EXTS = [
  ".txt",
  ".md",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".xml",
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".odt",
];
var CONV_SUB_EXTS = [
  ".srt",
  ".vtt",
  ".ass",
  ".ssa",
  ".sub",
  ".sbv",
  ".smi",
  ".lrc",
  ".ttml",
  ".dfxp",
  ".mpl2",
  ".pjs",
  ".rt",
];

/**
 *
 * @param file
 */
function convDetectType(file) {
  var name = file.name.toLowerCase();
  for (var i = 0; i < CONV_IMG_EXTS.length; i++) {
    if (name.endsWith(CONV_IMG_EXTS[i])) return "image";
  }
  for (let i = 0; i < CONV_AUDIO_EXTS.length; i++) {
    if (name.endsWith(CONV_AUDIO_EXTS[i])) return "audio";
  }
  for (let i = 0; i < CONV_VIDEO_EXTS.length; i++) {
    if (name.endsWith(CONV_VIDEO_EXTS[i])) return "video";
  }
  for (let i = 0; i < CONV_DOC_EXTS.length; i++) {
    if (name.endsWith(CONV_DOC_EXTS[i])) return "document";
  }
  for (let i = 0; i < CONV_SUB_EXTS.length; i++) {
    if (name.endsWith(CONV_SUB_EXTS[i])) return "subtitle";
  }
  return "unknown";
}

/**
 *
 * @param type
 */
function convGetFormats(type) {
  switch (type) {
    case "image": {
      return ["png", "jpeg", "webp", "bmp", "gif"];
    }
    case "audio": {
      return convAudioFormats();
    }
    case "video": {
      return convVideoFormats();
    }
    case "document": {
      return ["txt", "html", "md", "pdf", "docx", "json", "xml", "csv"];
    }
    case "subtitle": {
      return convSubFormats();
    }
    default: {
      return [];
    }
  }
}

/**
 *
 */
function convAudioFormats() {
  return [
    "wav",
    "aiff",
    "au",
    "raw",
    "mp3",
    "ogg",
    "opus",
    "m4a",
    "aac",
    "flac",
    "amr",
  ];
}

/**
 *
 */
function convVideoFormats() {
  return [
    "wav",
    "aiff",
    "au",
    "raw",
    "mp3",
    "ogg",
    "opus",
    "m4a",
    "aac",
    "flac",
    "amr",
  ];
}

/**
 *
 */
function convSubFormats() {
  return ["srt", "vtt", "ass", "sub", "sbv", "txt", "lrc", "ttml"];
}

/**
 *
 * @param fmt
 */
function convGetFormatLabel(fmt) {
  var labels = {
    png: "PNG",
    jpeg: "JPEG",
    webp: "WebP",
    bmp: "BMP",
    gif: "GIF",
    wav: "WAV",
    aiff: "AIFF",
    au: "AU",
    raw: "RAW",
    mp3: "MP3",
    ogg: "OGG",
    opus: "OPUS",
    m4a: "M4A",
    aac: "AAC",
    flac: "FLAC",
    amr: "AMR",
    mp4: "MP4",
    webm: "WebM",
    mkv: "MKV",
    mov: "MOV",
    avi: "AVI",
    mpeg: "MPEG",
    "3gp": "3GP",
    wmv: "WMV",
    flv: "FLV",
    txt: "TXT",
    html: "HTML",
    md: "Markdown",
    pdf: "PDF",
    docx: "DOCX",
    json: "JSON",
    xml: "XML",
    csv: "CSV",
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS",
    sub: "SUB",
    sbv: "SBV",
    lrc: "LRC",
    ttml: "TTML",
  };
  return labels[fmt] || fmt.toUpperCase();
}

/**
 *
 * @param s
 */
function escAttr(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
/**
 *
 * @param s
 */
function convStripHtml(s) {
  return new DOMParser()
    .parseFromString(String(s), "text/html")
    .body.textContent.trim();
}
/**
 *
 */
function convYield() {
  return new Promise(function (r) {
    setTimeout(r, 0);
  });
}

var _convFile = null;
var _convType = "";
var _convFormats = [];

/**
 *
 * @param pct
 */
function convSetProgress(pct) {
  var bar = document.querySelector("#conv-progress");
  var fill = document.querySelector("#conv-progress-fill");
  if (!bar || !fill) return;
  if (pct < 0) {
    bar.style.display = "block";
    fill.style.width = "30%";
    fill.style.animation =
      "conv-progress-indeterminate 1.5s ease-in-out infinite";
  } else {
    fill.style.animation = "none";
    fill.style.width = Math.min(100, Math.max(0, pct)) + "%";
    bar.style.display = "block";
    if (pct >= 100) {
      setTimeout(function () {
        bar.style.display = "none";
      }, 600);
    }
  }
}

/**
 *
 */
function handleConvFile() {
  var input = document.querySelector("#conv-file");
  var opts = document.querySelector("#conv-options");
  var outDiv = document.querySelector("#conv-output");
  var dl = document.querySelector("#conv-download");
  outDiv.style.display = "none";
  dl.innerHTML = "";
  if (!input || !input.files || !input.files[0]) return;
  if (typeof validateFileInput === "function" && !validateFileInput(input))
    return;
  _convFile = input.files[0];
  _convType = convDetectType(_convFile);
  _convFormats = convGetFormats(_convType);
  var srcExt = _convFile.name.split(".").pop().toLowerCase();
  var extMap = {
    jpg: "jpeg",
    jpeg: "jpg",
    tiff: "tif",
    tif: "tiff",
    htm: "html",
    ssa: "ass",
    dfxp: "ttml",
  };
  var skip = new Set([srcExt, extMap[srcExt] || ""]);
  _convFormats = _convFormats.filter(function (f) {
    return !skip.has(f);
  });
  var typeLabel =
    {
      image: "Image",
      audio: "Audio",
      video: "Video",
      document: "Document",
      unknown: "Unknown",
    }[_convType] || "Unknown";
  document.querySelector("#conv-file-type").textContent =
    __("conv.detected", "Detected: ") + typeLabel;
  document.querySelector("#conv-file-name").textContent =
    __("conv.file", "File: ") + _convFile.name;
  if (_convType === "unknown") {
    opts.innerHTML =
      '<p style="color:var(--danger)">' +
      __(
        "conv.unknown_type",
        "Unsupported file type. Please select an image, audio, video, or document file.",
      ) +
      "</p>";
    opts.style.display = "block";
    document.querySelector("#conv-btn").style.display = "none";
    return;
  }
  var html =
    '<span style="margin-bottom:8px;display:block;font-size:0.8rem;color:var(--text-muted)">' +
    __("conv.format_label", "Convert to:") +
    "</span>";
  html +=
    '<div id="conv-format-grid" style="display:flex;flex-wrap:wrap;gap:8px">';
  for (const [i, _convFormat] of _convFormats.entries()) {
    var active = i === 0 ? " active" : "";
    html +=
      '<button type="button" class="tab-btn btn' +
      active +
      '" data-fmt="' +
      _convFormat +
      '" onclick="convSelectFormat(this)">' +
      convGetFormatLabel(_convFormat) +
      "</button>";
  }
  html += "</div>";
  opts.innerHTML = html;
  opts.style.display = "block";
  document.querySelector("#conv-btn").style.display = "inline-block";
}

/**
 *
 * @param el
 */
function convSelectFormat(el) {
  var grid = document.querySelector("#conv-format-grid");
  if (!grid) return;
  var btns = grid.querySelectorAll(".tab-btn");
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
  el.classList.add("active");
}

/**
 *
 */
function convGetSelectedFormat() {
  var grid = document.querySelector("#conv-format-grid");
  if (!grid) return "";
  var active = grid.querySelector(".tab-btn.active");
  return active ? active.dataset.fmt : "";
}

/**
 *
 */
async function handleConvConvert() {
  var btn = document.querySelector("#conv-btn");
  var spinner = document.querySelector("#conv-spinner");
  var outDiv = document.querySelector("#conv-output");
  var dl = document.querySelector("#conv-download");
  var status = document.querySelector("#conv-status");
  if (!_convFile) return;
  btn.disabled = true;
  spinner.style.display = "inline-block";
  status.textContent = __("conv.converting", "Converting...");
  convSetProgress(-1);
  outDiv.style.display = "none";
  dl.innerHTML = "";
  try {
    var format = convGetSelectedFormat();
    if (!format) {
      throw new Error("No format selected");
    }
    var result = await convRun(_convFile, _convType, format);
    convSetProgress(100);
    if (result) {
      var ext = result.ext || format;
      var outName = _convFile.name.replace(/\.[^.]+$/, "") + "." + ext;
      var a = document.createElement("a");
      a.textContent =
        __("conv.download", "Download") + " (" + escHtml(outName) + ")";
      a.className = "btn";
      a.addEventListener("click", function () {
        var blobUrl = URL.createObjectURL(result.blob);
        var tmp = document.createElement("a");
        tmp.href = blobUrl;
        tmp.download = outName;
        document.body.append(tmp);
        tmp.click();
        tmp.remove();
        setTimeout(function () {
          URL.revokeObjectURL(blobUrl);
        }, 5000);
      });
      dl.append(a);
      outDiv.style.display = "block";
      status.textContent = __("conv.success", "Conversion complete!");
    }
  } catch (error) {
    status.textContent = __("conv.error", "Error: ") + error.message;
    console.error("Convert error:", error);
  }
  spinner.style.display = "none";
  btn.disabled = false;
}

/**
 *
 * @param file
 * @param type
 * @param format
 */
async function convRun(file, type, format) {
  switch (type) {
    case "image": {
      return await convImage(file, format);
    }
    case "audio": {
      return await convAudio(file, format);
    }
    case "video": {
      return await convVideo(file, format);
    }
    case "document": {
      return await convDocument(file, format);
    }
    case "subtitle": {
      return await convSubtitle(file, format);
    }
    default: {
      throw new Error(__("conv.unsupported", "Unsupported file type"));
    }
  }
}

/**
 *
 * @param file
 */
function convLoadImage(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.addEventListener("load", function () {
      URL.revokeObjectURL(url);
      resolve(img);
    });
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 *
 * @param file
 * @param format
 */
async function convImage(file, format) {
  var img = await convLoadImage(file);
  var canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  var mimeMap = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
    bmp: "image/bmp",
    gif: "image/gif",
  };
  var mime = mimeMap[format] || "image/png";
  return new Promise(function (resolve) {
    canvas.toBlob(function (blob) {
      resolve({ blob: blob, ext: format === "jpeg" ? "jpg" : format });
    }, mime);
  });
}

/**
 *
 * @param file
 * @param format
 */
async function convAudio(file, format) {
  var buf = await file.arrayBuffer();
  var audioCtx = new (globalThis.AudioContext ||
    globalThis.webkitAudioContext)();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  var audioBuf = await audioCtx.decodeAudioData([...buf]);
  if (
    format === "wav" ||
    format === "aiff" ||
    format === "au" ||
    format === "raw"
  ) {
    var numChannels = audioBuf.numberOfChannels;
    var sampleRate = audioBuf.sampleRate;
    let buf, mime, ext;
    switch (format) {
      case "wav": {
        buf = convEncodeWav(audioBuf, numChannels, sampleRate);
        mime = "audio/wav";
        ext = "wav";
        break;
      }
      case "aiff": {
        buf = convEncodeAiff(audioBuf, numChannels, sampleRate);
        mime = "audio/aiff";
        ext = "aiff";
        break;
      }
      case "au": {
        buf = convEncodeAu(audioBuf, numChannels, sampleRate);
        mime = "audio/basic";
        ext = "au";
        break;
      }
      case "raw": {
        buf = convEncodeRaw(audioBuf, numChannels);
        mime = "audio/L8";
        ext = "raw";
        break;
      }
    }
    audioCtx.close();
    return { blob: new Blob([buf], { type: mime }), ext: ext };
  }
  var audioMimeMap = {
    ogg: [
      "audio/webm; codecs=opus",
      "audio/webm",
      "audio/ogg; codecs=opus",
      "audio/ogg",
    ],
    opus: ["audio/webm; codecs=opus", "audio/opus", "audio/ogg; codecs=opus"],
    mp3: ["audio/mpeg", "audio/mpeg; codecs=mp3", "audio/mp3"],
    m4a: ["audio/mp4; codecs=aac", "audio/mp4", "audio/aac", "audio/x-m4a"],
    aac: ["audio/aac", "audio/mp4; codecs=aac", "audio/3gpp", "audio/3gpp2"],
    flac: ["audio/flac", "audio/x-flac"],
    amr: ["audio/amr", "audio/amr-wb"],
  };
  var extMap = {
    ogg: "ogg",
    opus: "opus",
    mp3: "mp3",
    m4a: "m4a",
    aac: "aac",
    flac: "flac",
    amr: "amr",
  };
  var mimeList = audioMimeMap[format] || [];
  for (const element of mimeList) {
    try {
      return await convAudioEncode(
        audioCtx,
        audioBuf,
        element,
        extMap[format] || format,
      );
    } catch {}
  }
  if (format === "mp3" && typeof lamejs !== "undefined") {
    return await convAudioToMp3(audioCtx, audioBuf);
  }
  audioCtx.close();
  throw new Error(
    __(
      "conv.audio_limited",
      "Audio conversion is not supported in this browser. Try WAV or MP3 format.",
    ),
  );
}

/**
 *
 * @param audioCtx
 * @param audioBuf
 * @param mimeType
 * @param ext
 */
function convAudioEncode(audioCtx, audioBuf, mimeType, ext) {
  return new Promise(function (resolve, reject) {
    var source = audioCtx.createBufferSource();
    source.buffer = audioBuf;
    var dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    var chunks = [];
    var recorder = new MediaRecorder(dest.stream, { mimeType: mimeType });
    recorder.ondataavailable = function (e) {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = function () {
      var blob = new Blob(chunks, { type: mimeType });
      audioCtx.close();
      resolve({ blob: blob, ext: ext });
    };
    recorder.onerror = function () {
      audioCtx.close();
      reject(new Error("Encoding failed"));
    };
    recorder.start();
    source.start(0);
    setTimeout(
      function () {
        if (recorder.state === "recording") recorder.stop();
      },
      audioBuf.duration * 1000 + 200,
    );
  });
}

/**
 *
 * @param audioCtx
 * @param audioBuf
 */
function convAudioToMp3(audioCtx, audioBuf) {
  return new Promise(function (resolve, reject) {
    try {
      var numChannels = Math.min(audioBuf.numberOfChannels, 2);
      var sampleRate = audioBuf.sampleRate;
      var bitrate = 128;
      var mp3enc = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
      var mp3Data = [];
      var length = audioBuf.length;
      var blockSize = 1152;
      /**
       *
       * @param val
       */
      function floatToInt16(val) {
        var s = Math.max(-1, Math.min(1, val));
        return s < 0 ? s * 0x80_00 : s * 0x7f_ff;
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
        for (let i = 0; i < length; i += blockSize) {
          let end = Math.min(i + blockSize, length);
          var lChunk = new Int16Array(end - i);
          var rChunk = new Int16Array(end - i);
          for (let j = i; j < end; j++) {
            lChunk[j - i] = floatToInt16(left[j]);
            rChunk[j - i] = floatToInt16(right[j]);
          }
          let buf = mp3enc.encodeBuffer(lChunk, rChunk);
          if (buf.length > 0) mp3Data.push(buf);
        }
      }
      var lastBuf = mp3enc.flush();
      if (lastBuf.length > 0) mp3Data.push(lastBuf);
      var blob = new Blob(mp3Data, { type: "audio/mpeg" });
      audioCtx.close();
      resolve({ blob: blob, ext: "mp3" });
    } catch (error) {
      audioCtx.close();
      reject(error);
    }
  });
}

/**
 *
 * @param audioBuffer
 * @param numChannels
 * @param sampleRate
 */
function convEncodeWav(audioBuffer, numChannels, sampleRate) {
  var length = audioBuffer.length;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var dataSize = length * blockAlign;
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);
  /**
   *
   * @param offset
   * @param str
   */
  function writeString(offset, str) {
    for (var i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  var offset = 44;
  for (var i = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      sample = sample < 0 ? sample * 0x80_00 : sample * 0x7f_ff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return buffer;
}

/**
 *
 * @param val
 * @param view
 * @param off
 */
function convExtended80(val, view, off) {
  if (val === 0 || !isFinite(val)) {
    for (var i = 0; i < 10; i++) view.setUint8(off + i, 0);
    return;
  }
  var sign = val < 0 ? 1 : 0;
  val = Math.abs(val);
  var exp = Math.floor(Math.log2(val));
  var mant = val / Math.pow(2, exp);
  var biasedExp = exp + 16_383;
  view.setUint16(off, (sign << 15) | biasedExp, false);
  var frac = mant - 1;
  var scaled = frac * 2_147_483_648;
  var hi = Math.floor(scaled);
  var lo = Math.round((scaled - hi) * 4_294_967_296);
  view.setUint32(off + 2, hi, false);
  view.setUint32(off + 6, lo, false);
}

/**
 *
 * @param audioBuffer
 * @param numChannels
 * @param sampleRate
 */
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
  /**
   *
   * @param s
   */
  function wStr(s) {
    for (var i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i));
  }
  wStr("FORM");
  view.setUint32(4, totalSize - 8, false);
  pos += 4;
  wStr("AIFF");
  wStr("COMM");
  view.setUint32(pos, commSize, false);
  pos += 4;
  view.setUint16(pos, numChannels, false);
  pos += 2;
  view.setUint32(pos, length, false);
  pos += 4;
  view.setUint16(pos, sampleSize, false);
  pos += 2;
  convExtended80(sampleRate, view, pos);
  pos += 10;
  wStr("SSND");
  view.setUint32(pos, ssndSize, false);
  pos += 4;
  view.setUint32(pos, 0, false);
  pos += 4;
  view.setUint32(pos, 0, false);
  pos += 4;
  for (var i = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      sample = sample < 0 ? sample * 0x80_00 : sample * 0x7f_ff;
      view.setInt16(pos, sample, false);
      pos += 2;
    }
  }
  return buffer;
}

/**
 *
 * @param audioBuffer
 * @param numChannels
 * @param sampleRate
 */
function convEncodeAu(audioBuffer, numChannels, sampleRate) {
  var length = audioBuffer.length;
  var dataSize = length * numChannels * 2;
  var headerSize = 24;
  var buffer = new ArrayBuffer(headerSize + dataSize);
  var view = new DataView(buffer);
  view.setUint32(0, 0x2e_73_6e_64, false); // ".snd"
  view.setUint32(4, headerSize, false);
  view.setUint32(8, 0xff_ff_ff_ff, false);
  view.setUint32(12, 3, false); // 16-bit linear PCM
  view.setUint32(16, sampleRate, false);
  view.setUint32(20, numChannels, false);
  for (var i = 0, off = headerSize; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x80_00 : s * 0x7f_ff, false);
      off += 2;
    }
  }
  return buffer;
}

/**
 *
 * @param audioBuffer
 * @param numChannels
 */
function convEncodeRaw(audioBuffer, numChannels) {
  var length = audioBuffer.length;
  var dataSize = length * numChannels * 2;
  var buffer = new ArrayBuffer(dataSize);
  var view = new DataView(buffer);
  for (var i = 0, off = 0; i < length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x80_00 : s * 0x7f_ff, true);
      off += 2;
    }
  }
  return buffer;
}

/**
 *
 * @param promise
 * @param ms
 */
function convTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("Timeout"));
      }, ms);
    }),
  ]);
}

/**
 *
 * @param file
 * @param format
 */
async function convVideo(file, format) {
  var videoContainers = [
    "mp4",
    "webm",
    "avi",
    "mov",
    "mkv",
    "flv",
    "wmv",
    "m4v",
    "3gp",
    "mpeg",
    "mpg",
    "ogv",
    "ts",
    "mts",
    "m2ts",
  ];
  var ext = file.name.split(".").pop().toLowerCase();
  var isVideoExt = videoContainers.includes(ext);
  if (!isVideoExt) {
    try {
      return await convTimeout(convAudio(file, format), 5000);
    } catch {}
  }
  var status = document.querySelector("#conv-status");
  if (status)
    status.textContent = __(
      "conv.converting",
      "Extracting audio from video...",
    );
  convSetProgress(-1);
  try {
    return await convVideoToAudioCapture(file, format);
  } catch (error) {
    try {
      return await convVideoToAudioFfmpeg(file, format);
    } catch (error_) {
      if (typeof FFmpeg === "undefined") {
        throw new TypeError(
          __(
            "conv.video_limited",
            "Audio extraction unavailable in this browser. Try a desktop browser.",
          ),
        );
      }
      throw new Error(
        e.message + " | " + error.message + " | " + error_.message,
      );
    }
  }
}

/**
 *
 * @param file
 * @param format
 */
async function convVideoToAudioCapture(file, format) {
  var url = URL.createObjectURL(file);
  return new Promise(function (resolve, reject) {
    var video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadedmetadata", function () {
      try {
        var duration = video.duration || 30;
        var audioCtx = new (globalThis.AudioContext ||
          globalThis.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        var streamDest = audioCtx.createMediaStreamDestination();
        var source = audioCtx.createMediaElementSource(video);
        source.connect(streamDest);
        var stopped = false;
        /**
         *
         */
        function cleanup() {
          if (stopped) return;
          stopped = true;
          URL.revokeObjectURL(url);
          video.pause();
          video.remove();
          audioCtx.close();
        }
        var isPcm = ["wav", "aiff", "au", "raw"].includes(format);
        var prefs, extMap, pcmTarget;
        if (isPcm) {
          prefs = ["audio/wav", "audio/webm; codecs=opus", "audio/mp4"];
          pcmTarget = format;
        } else {
          var fmtPrefs = {
            mp3: ["audio/mpeg", "audio/webm; codecs=opus", "audio/mp4"],
            ogg: [
              "audio/webm; codecs=opus",
              "audio/ogg; codecs=opus",
              "audio/ogg",
            ],
            opus: ["audio/webm; codecs=opus", "audio/opus", "audio/ogg"],
            m4a: [
              "audio/mp4; codecs=aac",
              "audio/mp4",
              "audio/aac",
              "audio/x-m4a",
            ],
            aac: ["audio/aac", "audio/mp4; codecs=aac", "audio/mp4"],
            flac: ["audio/flac", "audio/webm; codecs=opus"],
            amr: ["audio/amr", "audio/webm; codecs=opus"],
          };
          prefs = fmtPrefs[format] || ["audio/webm; codecs=opus", "audio/mp4"];
        }
        /**
         *
         * @param idx
         */
        function tryMime(idx) {
          if (idx >= prefs.length) {
            cleanup();
            reject(new Error("No supported audio format"));
            return;
          }
          var mime = prefs[idx];
          var recorder;
          try {
            recorder = new MediaRecorder(streamDest.stream, { mimeType: mime });
          } catch {
            tryMime(idx + 1);
            return;
          }
          var chunks = [];
          recorder.ondataavailable = function (e) {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = function () {
            if (pcmTarget) {
              var capBlob = new Blob(chunks, { type: recorder.mimeType });
              var readCtx = new (globalThis.AudioContext ||
                globalThis.webkitAudioContext)();
              if (readCtx.state === "suspended") readCtx.resume();
              capBlob
                .arrayBuffer()
                .then(function (buf) {
                  readCtx
                    .decodeAudioData([...buf])
                    .then(function (audioBuf) {
                      cleanup();
                      readCtx.close();
                      var numCh = audioBuf.numberOfChannels,
                        sr = audioBuf.sampleRate;
                      var result;
                      switch (pcmTarget) {
                        case "wav": {
                          result = convEncodeWav(audioBuf, numCh, sr);
                          break;
                        }
                        case "aiff": {
                          result = convEncodeAiff(audioBuf, numCh, sr);
                          break;
                        }
                        case "au": {
                          result = convEncodeAu(audioBuf, numCh, sr);
                          break;
                        }
                        case "raw": {
                          result = convEncodeRaw(audioBuf, numCh);
                          break;
                        }
                      }
                      var mimeMap = {
                        wav: "audio/wav",
                        aiff: "audio/aiff",
                        au: "audio/basic",
                        raw: "audio/L8",
                      };
                      resolve({
                        blob: new Blob([result], { type: mimeMap[pcmTarget] }),
                        ext: pcmTarget,
                      });
                    })
                    .catch(function () {
                      cleanup();
                      readCtx.close();
                      resolve({ blob: capBlob, ext: pcmTarget });
                    });
                })
                .catch(function () {
                  cleanup();
                  reject(new Error("Failed to read captured audio"));
                });
            } else {
              cleanup();
              resolve({
                blob: new Blob(chunks, { type: recorder.mimeType }),
                ext: format,
              });
            }
          };
          recorder.onerror = function () {
            cleanup();
            reject(new Error("Recording failed"));
          };
          recorder.start();
          var rate = 4;
          try {
            video.playbackRate = rate;
          } catch {
            try {
              rate = 2;
              video.playbackRate = rate;
            } catch {
              rate = 1;
            }
          }
          video.play().catch(function (error) {
            cleanup();
            reject(new Error("Playback: " + error.message));
          });
          setTimeout(
            function () {
              if (recorder.state === "recording") recorder.stop();
            },
            (duration / rate) * 1000 + 1000,
          );
        }
        tryMime(0);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    });
    video.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };
    video.src = url;
    video.load();
  });
}

/**
 *
 * @param file
 * @param format
 */
async function convVideoToAudioFfmpeg(file, format) {
  var audioExtractArgs = {
    wav: { ext: "wav", args: ["-vn", "-c:a", "pcm_s16le"] },
    aiff: { ext: "aiff", args: ["-vn", "-c:a", "pcm_s16le", "-f", "aiff"] },
    au: { ext: "au", args: ["-vn", "-c:a", "pcm_s16be", "-f", "au"] },
    raw: { ext: "raw", args: ["-vn", "-c:a", "pcm_s16le", "-f", "s16le"] },
    mp3: { ext: "mp3", args: ["-vn", "-c:a", "libmp3lame", "-q:a", "2"] },
    ogg: { ext: "ogg", args: ["-vn", "-c:a", "libvorbis", "-q:a", "5"] },
    opus: { ext: "opus", args: ["-vn", "-c:a", "libopus", "-b:a", "96k"] },
    m4a: { ext: "m4a", args: ["-vn", "-c:a", "aac", "-b:a", "128k"] },
    aac: {
      ext: "aac",
      args: ["-vn", "-c:a", "aac", "-b:a", "128k", "-f", "adts"],
    },
    flac: { ext: "flac", args: ["-vn", "-c:a", "flac"] },
    amr: {
      ext: "amr",
      args: ["-vn", "-c:a", "libopencore_amrnb", "-ar", "8000", "-ac", "1"],
    },
  };
  var fmt = audioExtractArgs[format];
  if (!fmt)
    throw new Error(__("conv.audio_limited", "Audio format not supported."));
  if (typeof FFmpeg === "undefined")
    throw new Error("FFmpeg library not loaded");
  var corePath =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js";
  var ff = FFmpeg.createFFmpeg({
    corePath: corePath,
    mainName: "main",
    log: true,
  });
  ff.setProgress(function (p) {
    convSetProgress(20 + Math.round(p.ratio * 70));
  });
  var status = document.querySelector("#conv-status");
  if (status)
    status.textContent = __("conv.loading_decoder", "Loading audio decoder...");
  convSetProgress(-1);
  try {
    await convTimeout(ff.load(), 30_000);
  } catch {
    throw new Error(
      __(
        "conv.audio_limited",
        "Audio extraction unavailable in this browser. Try a desktop browser.",
      ),
    );
  }
  if (status) status.textContent = __("conv.converting", "Extracting audio...");
  convSetProgress(10);
  var ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  var inName = "input." + ext;
  var outName = "output." + fmt.ext;
  var fileData = await convReadFileAsUint8(file);
  ff.FS("writeFile", inName, fileData);
  convSetProgress(20);
  var runArgs = [...["-nostdin", "-y", "-i", inName].concat(fmt.args), outName];
  await convYield();
  try {
    await ff.run.apply(ff, runArgs);
  } catch (error) {
    ff.FS("unlink", inName);
    throw error;
  }
  convSetProgress(90);
  var files = ff.FS("readdir", "/");
  if (!files.includes(outName)) {
    ff.FS("unlink", inName);
    throw new Error(__("conv.audio_limited", "Audio extraction failed."));
  }
  var data = ff.FS("readFile", outName);
  convSetProgress(95);
  ff.FS("unlink", inName);
  ff.FS("unlink", outName);
  return {
    blob: new Blob([data.buffer], { type: "audio/" + fmt.ext }),
    ext: fmt.ext,
  };
}

/**
 *
 * @param file
 */
async function convReadFileAsUint8(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.addEventListener("load", function () {
      resolve(new Uint8Array(reader.result));
    });
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 *
 * @param file
 * @param format
 */
async function convVideoFfmpeg(file, format) {
  var ffmpegArgs = {
    mp4: {
      ext: "mp4",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "aac"],
    },
    webm: {
      ext: "webm",
      args: ["-c:v", "libvpx", "-b:v", "1M", "-c:a", "libvorbis"],
    },
    mkv: {
      ext: "mkv",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "aac"],
    },
    mov: {
      ext: "mov",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "aac"],
    },
    avi: { ext: "avi", args: ["-c:v", "mpeg4", "-q:v", "5", "-c:a", "mp3"] },
    mpeg: {
      ext: "mpg",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "mp2"],
    },
    "3gp": {
      ext: "3gp",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "aac"],
    },
    wmv: { ext: "wmv", args: ["-c:v", "mpeg4", "-q:v", "5", "-c:a", "mp3"] },
    flv: {
      ext: "flv",
      args: ["-c:v", "libx264", "-preset", "fast", "-c:a", "aac"],
    },
  };
  var fmt = ffmpegArgs[format];
  if (!fmt)
    throw new Error(__("conv.video_limited", "Video format not recognized."));
  var status = document.querySelector("#conv-status");
  if (status)
    status.textContent = __(
      "conv.loading_video_decoder",
      "Loading video decoder...",
    );
  convSetProgress(-1);

  if (typeof FFmpeg === "undefined")
    throw new Error("FFmpeg library not loaded");
  var corePath =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js";
  var ff = FFmpeg.createFFmpeg({
    corePath: corePath,
    mainName: "main",
    log: true,
  });
  ff.setProgress(function (p) {
    convSetProgress(20 + Math.round(p.ratio * 70));
  });
  try {
    await ff.load();
  } catch (error) {
    throw error;
  }
  if (status) status.textContent = __("conv.converting", "Converting...");
  convSetProgress(10);

  var ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  var inName = "input." + ext;
  var outName = "output." + fmt.ext;
  var fileData = await convReadFileAsUint8(file);
  ff.FS("writeFile", inName, fileData);
  convSetProgress(20);

  var runArgs = [...["-nostdin", "-y", "-i", inName].concat(fmt.args), outName];
  await convYield();
  try {
    await ff.run.apply(ff, runArgs);
  } catch (error) {
    ff.FS("unlink", inName);
    throw error;
  }

  convSetProgress(90);
  var files = ff.FS("readdir", "/");
  if (!files.includes(outName)) {
    ff.FS("unlink", inName);
    throw new Error(
      __(
        "conv.video_limited",
        "Video conversion failed. The codec may not be supported.",
      ),
    );
  }
  var data = ff.FS("readFile", outName);
  convSetProgress(95);
  ff.FS("unlink", inName);
  ff.FS("unlink", outName);
  return {
    blob: new Blob([data.buffer], {
      type: mimeMap[format] || "video/" + fmt.ext,
    }),
    ext: fmt.ext,
  };
}

/**
 *
 * @param file
 * @param format
 */
async function convVideoNative(file, format) {
  var videoMimeMap = {
    mp4: [
      "video/mp4; codecs=h264",
      "video/mp4; codecs=avc1",
      "video/mp4",
      "video/x-mp4",
    ],
    webm: ["video/webm; codecs=vp9", "video/webm; codecs=vp8", "video/webm"],
    mkv: [
      "video/x-matroska; codecs=vp9",
      "video/x-matroska; codecs=vp8",
      "video/x-matroska; codecs=h264",
      "video/x-matroska",
      "video/webm",
    ],
    mov: ["video/quicktime", "video/mp4", "video/x-m4v"],
    avi: ["video/x-msvideo", "video/avi"],
    mpeg: ["video/mpeg", "video/mp2t"],
    "3gp": ["video/3gpp", "video/3gpp2"],
    wmv: ["video/x-ms-wmv"],
    flv: ["video/x-flv"],
  };
  var extMap = {
    mp4: "mp4",
    webm: "webm",
    mkv: "mkv",
    mov: "mov",
    avi: "avi",
    mpeg: "mpeg",
    "3gp": "3gp",
    wmv: "wmv",
    flv: "flv",
  };
  var mimeMap = {
    mp4: "video/mp4",
    webm: "video/webm",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    avi: "video/avi",
    mpeg: "video/mpeg",
    "3gp": "video/3gpp",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
  };
  var mimeList = videoMimeMap[format] || [];
  if (mimeList.length === 0)
    throw new Error(__("conv.video_limited", "Video format not recognized."));
  var url = URL.createObjectURL(file);
  try {
    var video = await convLoadVideo(url);
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 480;
    video.play().catch(function () {});
    var stream = null;
    try {
      if (video.captureStream && typeof video.captureStream === "function") {
        stream = video.captureStream(30);
        if (
          !stream ||
          !stream.getVideoTracks ||
          stream.getVideoTracks().length === 0
        )
          stream = null;
      }
    } catch {
      stream = null;
    }
    if (!stream) {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        var drawFrame = function () {
          if (!video.paused) ctx.drawImage(video, 0, 0, w, h);
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
        stream = canvas.captureStream(30);
      } catch {
        stream = null;
      }
    }
    if (!stream) {
      video.pause();
      throw new Error("captureStream unsupported");
    }
    for (const element of mimeList) {
      try {
        var result = await convVideoEncode(
          stream,
          element,
          extMap[format],
          video.duration,
        );
        video.pause();
        return result;
      } catch {}
    }
    video.pause();
    throw new Error(
      __("conv.video_limited", "Video encoding not supported in this browser."),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 *
 * @param url
 */
function convLoadVideo(url) {
  return new Promise(function (resolve, reject) {
    var v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    var resolved = false;
    /**
     *
     */
    function done() {
      if (resolved) return;
      resolved = true;
      resolve(v);
    }
    v.addEventListener("loadedmetadata", done);
    v.addEventListener("canplay", done);
    v.onerror = function () {
      var msg = "Failed to load video";
      if (v.error) msg += " (code " + v.error.code + ")";
      reject(new Error(msg));
    };
    v.src = url;
    v.load();
  });
}

/**
 *
 * @param stream
 * @param mimeType
 * @param ext
 * @param duration
 */
function convVideoEncode(stream, mimeType, ext, duration) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch (error) {
      reject(error);
      return;
    }
    recorder.ondataavailable = function (e) {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = function () {
      resolve({ blob: new Blob(chunks, { type: mimeType }), ext: ext });
    };
    recorder.onerror = function () {
      reject(new Error("Encoding failed"));
    };
    recorder.start();
    setTimeout(
      function () {
        if (recorder.state === "recording") recorder.stop();
      },
      duration * 1000 + 500,
    );
  });
}

/**
 *
 * @param frames
 * @param delayCs
 * @param w
 * @param h
 */
function convGifEncode(frames, delayCs, w, h) {
  var data = [];
  /**
   *
   * @param b
   */
  function put(b) {
    data.push(b);
  }
  /**
   *
   * @param v
   */
  function putS(v) {
    put(v & 0xff);
    put((v >> 8) & 0xff);
  }
  /**
   *
   * @param s
   */
  function putStr(s) {
    for (var i = 0; i < s.length; i++) put(s.charCodeAt(i));
  }

  // Collect color frequencies across all frames, reduce to 5-bit
  var freq = {};
  for (var fi = 0; fi < frames.length; fi++) {
    var rgba = frames[fi];
    for (var j = 0; j < w * h; j++) {
      var ri = rgba[j * 4] >> 3,
        gi = rgba[j * 4 + 1] >> 3,
        bi = rgba[j * 4 + 2] >> 3;
      var key = ri + "," + gi + "," + bi;
      freq[key] = (freq[key] || 0) + 1;
    }
  }

  // Sort by frequency, take top 256
  var sorted = Object.keys(freq).sort(function (a, b) {
    return freq[b] - freq[a];
  });
  var maxColors = Math.min(sorted.length, 256);
  var palette = [];
  var palIndex = {};
  for (var i = 0; i < maxColors; i++) {
    var parts = sorted[i].split(",");
    let ri = +parts[0],
      gi = +parts[1],
      bi = +parts[2];
    palette.push([
      (ri << 3) | (ri >> 2),
      (gi << 3) | (gi >> 2),
      (bi << 3) | (bi >> 2),
    ]);
    palIndex[sorted[i]] = i;
  }

  // Pad palette to power of 2
  var palSize = 1;
  while (palSize < palette.length) palSize <<= 1;
  while (palette.length < palSize) palette.push([0, 0, 0]);

  var minCodeSize = 1;
  while (1 << minCodeSize < palSize) minCodeSize++;
  if (minCodeSize < 2) minCodeSize = 2;

  // Write header + logical screen descriptor + global color table
  putStr("GIF89a");
  putS(w);
  putS(h);
  put(0xf0 | ((Math.log2(palSize) - 1) & 0x07));
  put(0);
  put(0);
  for (const element of palette) {
    put(element[0]);
    put(element[1]);
    put(element[2]);
  }

  // Re-map pixels to palette indices using nearest color
  var indices = [];
  for (let fi = 0; fi < frames.length; fi++) {
    let rgba = frames[fi];
    var frameIndices = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) {
      var r = rgba[j * 4],
        g = rgba[j * 4 + 1],
        b = rgba[j * 4 + 2];
      let ri = r >> 3,
        gi = g >> 3,
        bi = b >> 3;
      let key = ri + "," + gi + "," + bi;
      var idx = palIndex[key];
      if (idx !== undefined && idx < maxColors) {
        frameIndices[j] = idx;
      } else {
        // Nearest color in palette using 8-bit values
        var best = 0,
          bestDist = Infinity;
        for (const [pi2, element] of palette.entries()) {
          var dr = r - element[0],
            dg = g - element[1],
            db = b - element[2];
          var dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            best = pi2;
          }
        }
        frameIndices[j] = best;
      }
    }
    indices.push(frameIndices);
  }

  for (let fi = 0; fi < frames.length; fi++) {
    put(0x21);
    put(0xf9);
    put(4);
    put(0x00);
    putS(delayCs);
    put(0);
    put(0x00);
    put(0x2c);
    putS(0);
    putS(0);
    putS(w);
    putS(h);
    put(0x00);
    put(minCodeSize);
    var compressed = convGifLzw(indices[fi], minCodeSize);
    putS(compressed.length);
    for (var k = 0; k < compressed.length; k++) put(compressed[k]);
    put(0x00);
  }
  put(0x3b);
  return new Uint8Array(data);
}

/**
 *
 * @param indices
 * @param minCodeSize
 */
function convGifLzw(indices, minCodeSize) {
  var clearCode = 1 << minCodeSize;
  var eoiCode = clearCode + 1;
  var codeSize = minCodeSize + 1;
  var dict = {};
  var nextCode = eoiCode + 1;
  var result = [];
  var bitBuf = 0,
    bitCount = 0;
  /**
   *
   * @param code
   */
  function outCode(code) {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      result.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  }
  outCode(clearCode);
  var s = [];
  for (var c of indices) {
    var sc = [...s, c];
    var key = sc.join(",");
    if (dict[key] !== undefined) {
      s = sc;
      continue;
    }
    outCode(s.length === 1 ? s[0] : dict[s.join(",")]);
    if (nextCode < 4096) {
      dict[key] = nextCode++;
    }
    if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
    s = [c];
  }
  if (s.length > 0) outCode(s.length === 1 ? s[0] : dict[s.join(",")]);
  outCode(eoiCode);
  if (bitCount > 0) result.push(bitBuf & 0xff);
  return result;
}

/**
 *
 * @param file
 */
function convVideoToGif(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.addEventListener("loadedmetadata", function () {
      var w = Math.min(v.videoWidth, 320),
        h = Math.min(v.videoHeight, 240);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      var dur = v.duration;
      var fps = 10;
      var totalFrames = Math.min(Math.max(Math.round(dur * fps), 1), 50);
      var interval = dur / totalFrames;
      if (dur <= 0 || !isFinite(dur)) {
        URL.revokeObjectURL(url);
        reject(new Error("Invalid video duration"));
        return;
      }
      var frames = [],
        frameNum = 0;
      /**
       *
       */
      function captureSeek() {
        if (frameNum >= totalFrames) {
          v.pause();
          URL.revokeObjectURL(url);
          convSetProgress(95);
          try {
            var gifData = convGifEncode(
              frames,
              Math.round(interval * 100),
              w,
              h,
            );
            resolve({
              blob: new Blob([gifData], { type: "image/gif" }),
              ext: "gif",
            });
          } catch (error) {
            reject(error);
          }
          return;
        }
        v.currentTime = frameNum * interval;
      }
      v.addEventListener("seeked", function () {
        requestAnimationFrame(function () {
          ctx.drawImage(v, 0, 0, w, h);
          frames.push([...ctx.getImageData(0, 0, w, h).data]);
          frameNum++;
          convSetProgress(Math.round((frameNum / totalFrames) * 90));
          captureSeek();
        });
      });
      v.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load video"));
      };
      // Start: capture first frame (video already at time 0 after load)
      requestAnimationFrame(function () {
        ctx.drawImage(v, 0, 0, w, h);
        frames.push([...ctx.getImageData(0, 0, w, h).data]);
        frameNum++;
        convSetProgress(Math.round((frameNum / totalFrames) * 90));
        captureSeek();
      });
    });
    v.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };
    v.src = url;
    v.load();
  });
}

// ── Subtitle Converter ──
/**
 *
 * @param start
 * @param end
 * @param text
 */
function convSubCue(start, end, text) {
  return { start: start, end: end, text: text };
}

/**
 *
 * @param text
 * @param ext
 */
function convSubParse(text, ext) {
  var cues = [];
  switch (ext) {
    case "srt": {
      var blocks = text.split(/\n\s*\n/);
      for (const block of blocks) {
        var lines = block.trim().split("\n");
        if (lines.length < 2) continue;
        var timeMatch = lines[1]
          ? lines[1].match(
              /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
            )
          : null;
        if (!timeMatch) {
          timeMatch = lines[0].match(
            /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
          );
          if (!timeMatch) continue;
          lines = [...lines];
        }
        var start =
          +timeMatch[1] * 3_600_000 +
          +timeMatch[2] * 60_000 +
          +timeMatch[3] * 1000 +
          +timeMatch[4];
        var end =
          +timeMatch[5] * 3_600_000 +
          +timeMatch[6] * 60_000 +
          +timeMatch[7] * 1000 +
          +timeMatch[8];
        var textIdx = timeMatch === lines[0].match ? 1 : 2;
        var txt = lines.slice(textIdx).join("\n");
        cues.push(convSubCue(start, end, txt));
      }
      break;
    }
    case "vtt": {
      var parts = text.split(/\n\s*\n/);
      for (var i = 0; i < parts.length; i++) {
        let lines = parts[i].trim().split("\n");
        if (
          lines.length < 2 ||
          lines[0] === "WEBVTT" ||
          lines[0].startsWith("NOTE")
        )
          continue;
        let timeMatch =
          lines[0].match(
            /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/,
          ) ||
          lines[0].match(
            /(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/,
          );
        if (!timeMatch) continue;
        let start, end;
        if (timeMatch.length === 9) {
          start =
            +timeMatch[1] * 3_600_000 +
            +timeMatch[2] * 60_000 +
            +timeMatch[3] * 1000 +
            +timeMatch[4];
          end =
            +timeMatch[5] * 3_600_000 +
            +timeMatch[6] * 60_000 +
            +timeMatch[7] * 1000 +
            +timeMatch[8];
        } else {
          start = +timeMatch[1] * 60_000 + +timeMatch[2] * 1000 + +timeMatch[3];
          end = +timeMatch[4] * 60_000 + +timeMatch[5] * 1000 + +timeMatch[6];
        }
        cues.push(convSubCue(start, end, lines.slice(1).join("\n")));
      }
      break;
    }
    case "ass":
    case "ssa": {
      var inEvents = false;
      var fmtLine = null;
      let lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l === "[Events]") {
          inEvents = true;
          continue;
        }
        if (l.startsWith("[")) {
          inEvents = false;
          continue;
        }
        if (inEvents && l.startsWith("Format:")) {
          fmtLine = l
            .substring(7)
            .split(",")
            .map(function (s) {
              return s.trim();
            });
        }
        if (inEvents && l.startsWith("Dialogue:")) {
          let parts = l.substring(9).split(",");
          if (!fmtLine) continue;
          var idx = {};
          for (var f = 0; f < fmtLine.length; f++)
            idx[fmtLine[f].toLowerCase()] = f;
          if (
            idx.start === undefined ||
            idx.end === undefined ||
            idx.text === undefined
          )
            continue;
          /**
           *
           * @param t
           */
          function toMs(t) {
            var m = t.match(/(\d+):(\d+):(\d+)\.(\d+)/);
            if (!m) return 0;
            return (
              +m[1] * 3_600_000 + +m[2] * 60_000 + +m[3] * 1000 + +m[4] * 10
            );
          }
          let txt = parts
            .slice(idx.text)
            .join(",")
            .replaceAll(String.raw`\N`, "\n")
            .replaceAll(/{[^}]*}/g, "");
          cues.push(
            convSubCue(toMs(parts[idx.start]), toMs(parts[idx.end]), txt),
          );
        }
      }
      break;
    }
    case "sub": {
      let lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        var m = lines[i].match(/\{(\d+)\}\{(\d+)\}(.*)/);
        if (m) {
          var fps = 23.976;
          cues.push(
            convSubCue(
              Math.round((+m[1] / fps) * 1000),
              Math.round((+m[2] / fps) * 1000),
              m[3].trim(),
            ),
          );
        }
      }
      break;
    }
    case "sbv": {
      let blocks = text.split(/\n\s*\n/);
      for (let i = 0; i < blocks.length; i++) {
        let lines = blocks[i].trim().split("\n");
        if (lines.length < 2) continue;
        var tm = lines[0].match(
          /(\d+):(\d+):(\d+)\.(\d+),(\d+):(\d+):(\d+)\.(\d+)/,
        );
        if (!tm) continue;
        cues.push(
          convSubCue(
            +tm[1] * 3_600_000 + +tm[2] * 60_000 + +tm[3] * 1000 + +tm[4],
            +tm[5] * 3_600_000 + +tm[6] * 60_000 + +tm[7] * 1000 + +tm[8],
            lines.slice(1).join("\n"),
          ),
        );
      }
      break;
    }
    case "lrc": {
      let lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        let m = lines[i].match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
        if (m) {
          let start = +m[1] * 60_000 + +m[2] * 1000 + +m[3] * 10;
          cues.push(convSubCue(start, start + 5000, m[3].trim()));
        }
      }
      break;
    }
    case "ttml":
    case "dfxp": {
      let m;
      var re =
        /<p[^>]*begin=["']([^"']+)["'][^>]*end=["']([^"']+)["'][^>]*>(.*?)<\/p>/g;
      while ((m = re.exec(text)) !== null) {
        /**
         *
         * @param t
         */
        function ttmlToMs(t) {
          if (t.includes(":")) {
            var p = t.split(":");
            if (p.length === 3)
              return (
                +p[0] * 3_600_000 +
                +p[1] * 60_000 +
                Number.parseFloat(p[2]) * 1000
              );
            return +p[0] * 60_000 + Number.parseFloat(p[1]) * 1000;
          }
          return Number.parseFloat(t.replace("s", "")) * 1000;
        }
        let txt = convStripHtml(m[3]);
        cues.push(convSubCue(ttmlToMs(m[1]), ttmlToMs(m[2]), txt));
      }
      break;
    }
    default: {
      let lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim())
          cues.push(convSubCue(i * 1000, (i + 1) * 1000, lines[i].trim()));
      }
    }
  }
  return cues;
}

/**
 *
 * @param ms
 */
function convSubFormatTime(ms) {
  var h = Math.floor(ms / 3_600_000);
  var m = Math.floor((ms % 3_600_000) / 60_000);
  var s = Math.floor((ms % 60_000) / 1000);
  var ms2 = ms % 1000;
  return (
    (h + "").padStart(2, "0") +
    ":" +
    (m + "").padStart(2, "0") +
    ":" +
    (s + "").padStart(2, "0") +
    "," +
    (ms2 + "").padStart(3, "0")
  );
}

/**
 *
 * @param ms
 */
function convSubFormatTimeVtt(ms) {
  var h = Math.floor(ms / 3_600_000);
  var m = Math.floor((ms % 3_600_000) / 60_000);
  var s = Math.floor((ms % 60_000) / 1000);
  var ms2 = ms % 1000;
  return (
    (h + "").padStart(2, "0") +
    ":" +
    (m + "").padStart(2, "0") +
    ":" +
    (s + "").padStart(2, "0") +
    "." +
    (ms2 + "").padStart(3, "0")
  );
}

/**
 *
 * @param ms
 */
function convSubFormatAss(ms) {
  var h = Math.floor(ms / 3_600_000);
  var m = Math.floor((ms % 3_600_000) / 60_000);
  var s = Math.floor((ms % 60_000) / 1000);
  var cs = Math.floor((ms % 1000) / 10);
  return (
    (h + "").padStart(1, "0") +
    ":" +
    (m + "").padStart(2, "0") +
    ":" +
    (s + "").padStart(2, "0") +
    "." +
    (cs + "").padStart(2, "0")
  );
}

/**
 *
 * @param cues
 */
function convSubWriteSrt(cues) {
  var out = "";
  for (const [i, cue] of cues.entries()) {
    out +=
      i +
      1 +
      "\n" +
      convSubFormatTime(cue.start) +
      " --> " +
      convSubFormatTime(cue.end) +
      "\n" +
      cue.text +
      "\n\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteVtt(cues) {
  var out = "WEBVTT\n\n";
  for (const cue of cues) {
    out +=
      convSubFormatTimeVtt(cue.start) +
      " --> " +
      convSubFormatTimeVtt(cue.end) +
      "\n" +
      cue.text +
      "\n\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteAss(cues) {
  var out =
    "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
  for (const cue of cues) {
    var txt = cue.text.replaceAll("\n", String.raw`\N`);
    out +=
      "Dialogue: 0," +
      convSubFormatAss(cue.start) +
      "," +
      convSubFormatAss(cue.end) +
      ",Default,,0,0,0,," +
      txt +
      "\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteSub(cues) {
  var out = "";
  var fps = 23.976;
  for (const cue of cues) {
    var startFr = Math.round((cue.start / 1000) * fps);
    var endFr = Math.round((cue.end / 1000) * fps);
    out += "{" + startFr + "}{" + endFr + "}" + cue.text + "\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteSbv(cues) {
  var out = "";
  for (const cue of cues) {
    /**
     *
     * @param ms
     */
    function sbvTime(ms) {
      var h = Math.floor(ms / 3_600_000);
      var m = Math.floor((ms % 3_600_000) / 60_000);
      var s = Math.floor((ms % 60_000) / 1000);
      var ms2 = ms % 1000;
      return (
        (h + "").padStart(2, "0") +
        ":" +
        (m + "").padStart(2, "0") +
        ":" +
        (s + "").padStart(2, "0") +
        "." +
        (ms2 + "").padStart(3, "0")
      );
    }
    out +=
      sbvTime(cue.start) + "," + sbvTime(cue.end) + "\n" + cue.text + "\n\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteLrc(cues) {
  var out = "";
  for (const cue of cues) {
    var m = Math.floor(cue.start / 60_000);
    var s = Math.floor((cue.start % 60_000) / 1000);
    var cs = Math.floor((cue.start % 1000) / 10);
    out +=
      "[" +
      (m + "").padStart(2, "0") +
      ":" +
      (s + "").padStart(2, "0") +
      "." +
      (cs + "").padStart(2, "0") +
      "]" +
      cue.text.split("\n", 1)[0] +
      "\n";
  }
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteTtml(cues) {
  var out =
    '<?xml version="1.0" encoding="UTF-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml">\n<body>\n<div>\n';
  for (const cue of cues) {
    /**
     *
     * @param ms
     */
    function ttmlTime(ms) {
      var h = Math.floor(ms / 3_600_000);
      var m = Math.floor((ms % 3_600_000) / 60_000);
      var s = (ms % 60_000) / 1000;
      return (
        (h + "").padStart(2, "0") +
        ":" +
        (m + "").padStart(2, "0") +
        ":" +
        s.toFixed(3)
      );
    }
    out +=
      '  <p begin="' +
      ttmlTime(cue.start) +
      '" end="' +
      ttmlTime(cue.end) +
      '">' +
      escXml(cue.text) +
      "</p>\n";
  }
  out += "</div>\n</body>\n</tt>";
  return out;
}

/**
 *
 * @param cues
 */
function convSubWriteTxt(cues) {
  var out = "";
  for (var i = 0; i < cues.length; i++) out += cues[i].text + "\n";
  return out;
}

/**
 *
 * @param file
 * @param format
 */
async function convSubtitle(file, format) {
  var text = await file.text();
  var ext = file.name.split(".").pop().toLowerCase();
  if (ext === "ssa") ext = "ass";
  if (ext === "dfxp") ext = "ttml";
  var cues = convSubParse(text, ext);
  var writers = {
    srt: convSubWriteSrt,
    vtt: convSubWriteVtt,
    ass: convSubWriteAss,
    sub: convSubWriteSub,
    sbv: convSubWriteSbv,
    txt: convSubWriteTxt,
    lrc: convSubWriteLrc,
    ttml: convSubWriteTtml,
  };
  var mimeMap = {
    srt: "text/plain",
    vtt: "text/vtt",
    ass: "text/plain",
    sub: "text/plain",
    sbv: "text/plain",
    txt: "text/plain",
    lrc: "text/plain",
    ttml: "application/ttml+xml",
  };
  var writer = writers[format];
  if (!writer) throw new Error("Unsupported subtitle format");
  var outText = writer(cues);
  return {
    blob: new Blob([outText], { type: mimeMap[format] || "text/plain" }),
    ext: format,
  };
}

/**
 *
 * @param file
 * @param format
 */
async function convDocument(file, format) {
  var text = await file.text();
  var name = file.name.replace(/\.[^.]+$/, "");
  var result;
  switch (format) {
    case "txt": {
      result = convDocToTxt(text, file.name);
      break;
    }
    case "html": {
      result = convDocToHtml(text, file.name);
      break;
    }
    case "md": {
      result = convDocToMd(text, file.name);
      break;
    }
    case "pdf": {
      result = await convDocToPdf(text, name);
      break;
    }
    case "docx": {
      result = await convDocToDocx(text, name);
      break;
    }
    case "json": {
      result = convDocToJson(text, file.name);
      break;
    }
    case "xml": {
      result = convDocToXml(text, file.name);
      break;
    }
    case "csv": {
      result = convDocToCsv(text, file.name);
      break;
    }
    default: {
      throw new Error("Unsupported document format: " + format);
    }
  }
  return result;
}

/**
 *
 * @param text
 */
function convDocToTxt(text) {
  var clean = text
    .replaceAll(/<\/?[^>]+(>|$)/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  return { blob: new Blob([clean], { type: "text/plain" }), ext: "txt" };
}

/**
 *
 * @param text
 * @param fileName
 */
function convDocToHtml(text, fileName) {
  var body = text
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>");
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
    escHtml(fileName) +
    "</title></head><body><pre>" +
    body +
    "</pre></body></html>";
  return { blob: new Blob([html], { type: "text/html" }), ext: "html" };
}

/**
 *
 * @param text
 * @param fileName
 */
function convDocToMd(text, fileName) {
  var md = text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  md = "# " + fileName + "\n\n" + md;
  return { blob: new Blob([md], { type: "text/markdown" }), ext: "md" };
}

/**
 *
 * @param text
 * @param name
 */
async function convDocToPdf(text, name) {
  if (typeof jspdf === "undefined")
    throw new Error("PDF library not loaded. Try TXT format instead.");
  var doc = new jspdf.jsPDF();
  var lines = doc.splitTextToSize(text || "(empty)", 180);
  var y = 20;
  doc.setFontSize(12);
  doc.text(name, 105, y, { align: "center" });
  y += 10;
  doc.setFontSize(9);
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 15, y);
    y += 5;
  }
  return { blob: doc.output("blob"), ext: "pdf" };
}

/**
 *
 * @param text
 * @param name
 */
async function convDocToDocx(text, name) {
  if (typeof docx === "undefined")
    throw new Error("DOCX library not loaded. Try TXT format instead.");
  var Paragraph = docx.Paragraph,
    TextRun = docx.TextRun,
    Document = docx.Document,
    Packer = docx.Packer;
  var lines = text.split("\n");
  var children = [];
  children.push(
    new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 24 })],
      spacing: { after: 200 },
    }),
  );
  for (const line of lines) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: line, size: 18 })] }),
    );
  }
  var doc = new Document({ sections: [{ children: children }] });
  var blob = await Packer.toBlob(doc);
  return { blob: blob, ext: "docx" };
}

/**
 *
 * @param text
 * @param fileName
 */
function convDocToJson(text, fileName) {
  try {
    var parsed = JSON.parse(text);
    return {
      blob: new Blob([JSON.stringify(parsed, null, 2)], {
        type: "application/json",
      }),
      ext: "json",
    };
  } catch {
    return {
      blob: new Blob(
        [JSON.stringify({ content: text, source: fileName }, null, 2)],
        { type: "application/json" },
      ),
      ext: "json",
    };
  }
}

/**
 *
 * @param text
 * @param fileName
 */
function convDocToXml(text, fileName) {
  var escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  var xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n  <source>' +
    escXml(fileName) +
    "</source>\n  <content>" +
    escaped +
    "</content>\n</document>";
  return { blob: new Blob([xml], { type: "application/xml" }), ext: "xml" };
}

/**
 *
 * @param s
 */
function escXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 *
 * @param text
 * @param fileName
 */
function convDocToCsv(text, fileName) {
  try {
    var parsed = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === "object"
    ) {
      var keys = Object.keys(parsed[0]);
      var csv = keys.join(",") + "\n";
      for (const element of parsed) {
        csv +=
          keys
            .map(function (k) {
              var v = element[k];
              return v == null
                ? ""
                : String(v)
                    .replaceAll("\\", "\\\\")
                    .replaceAll(",", String.raw`\,`);
            })
            .join(",") + "\n";
      }
      return { blob: new Blob([csv], { type: "text/csv" }), ext: "csv" };
    }
  } catch {}
  var lines = text.split("\n").map(function (l) {
    return l.replaceAll("\\", "\\\\").replaceAll(",", String.raw`\,`);
  });
  return {
    blob: new Blob([lines.join("\n")], { type: "text/csv" }),
    ext: "csv",
  };
}
