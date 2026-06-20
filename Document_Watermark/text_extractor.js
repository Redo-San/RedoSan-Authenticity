(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();

// ── Document Text Extractor ──
// Supports: TXT, DOCX, PDF (browser + Node.js)

var DOCX_EXTRACTOR = (function () {
  /**
   *
   * @param raw
   */
  function readDocx(raw) {
    return new Promise(function (resolve, reject) {
      if (typeof JSZip === "undefined") {
        reject(
          new Error(
            "JSZip library not loaded. Please check your internet connection.",
          ),
        );
        return;
      }
      JSZip.loadAsync(raw)
        .then(function (zip) {
          var entry = zip.file("word/document.xml");
          if (!entry) {
            reject(
              new Error("Not a valid DOCX file: word/document.xml not found"),
            );
            return;
          }
          return entry.async("string");
        })
        .then(function (xml) {
          var text = extractDocxText(xml);
          resolve(text);
        })
        .catch(function (error) {
          reject(new Error("Failed to read DOCX: " + error.message));
        });
    });
  }

  /**
   *
   * @param xml
   */
  function extractDocxText(xml) {
    var text = "";
    var inPara = false;
    var i = 0;
    while (i < xml.length) {
      if (xml.substr(i, 6) === "<w:p ") inPara = true;
      if (xml.substr(i, 5) === "<w:p>") inPara = true;
      if (xml.substr(i, 6) === "</w:p>" && inPara) {
        text += "\n";
        inPara = false;
      }
      if (xml.substr(i, 5) === "<w:t " || xml.substr(i, 4) === "<w:t>") {
        var start = xml.indexOf(">", i) + 1;
        var end = xml.indexOf("</w:t>", start);
        if (start > 0 && end > start) {
          text += xml.substring(start, end);
        }
        i = end > 0 ? end + 6 : i + 1;
        continue;
      }
      i++;
    }
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  // ── Simple PDF Text Extraction (browser) ──
  // Handles uncompressed and FlateDecode PDFs

  /**
   *
   * @param data
   * @param format
   */
  async function inflateStream(data, format) {
    var stream = new ReadableStream({
      start: function (controller) {
        controller.enqueue(data);
        controller.close();
      },
    }).pipeThrough(new DecompressionStream(format));
    var reader = stream.getReader();
    var chunks = [];
    try {
      while (true) {
        var v = await reader.read();
        if (v.done) break;
        chunks.push(v.value);
      }
    } catch (error) {
      throw error;
    }
    var total = 0;
    for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
    var result = new Uint8Array(total);
    var offset = 0;
    for (var i2 = 0; i2 < chunks.length; i2++) {
      result.set(chunks[i2], offset);
      offset += chunks[i2].length;
    }
    return result;
  }

  /**
   *
   * @param data
   */
  async function inflateRaw(data) {
    // PDF FlateDecode uses zlib wrapper (RFC 1950), but some PDFs use raw deflate.
    // Try both formats
    if (typeof DecompressionStream === "undefined") {
      throw new TypeError(
        "PDF compression not supported in this browser. Try a plain text file instead.",
      );
    }
    // Try zlib format first (per PDF spec)
    try {
      return await inflateStream(data, "deflate");
    } catch (error) {
      console.warn("docw: deflate failed", error);
    }
    // Try raw deflate (some non-compliant PDF generators)
    try {
      return await inflateStream(data, "deflate-raw");
    } catch (error) {
      console.warn("docw: deflate-raw failed", error);
    }
    // Both failed — return empty instead of raw compressed data
    // (raw binary will cause regex processing to freeze the page)
    return new Uint8Array(0);
  }

  /**
   *
   */
  function _yield() {
    return new Promise(function (r) {
      setTimeout(r, 0);
    });
  }

  /**
   *
   * @param raw
   */
  async function readPdf(raw) {
    var arr = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    var src = latin1Decode(arr);

    // Build object map
    var objMap = {};
    var objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
    var m;
    while ((m = objRe.exec(src)) !== null) {
      objMap[m[1] + " " + m[2]] = m[3];
    }
    // Yield to let UI breathe after heavy regex scan
    await _yield();

    // Build CMap from ToUnicode streams
    var cmap = {};
    for (var objId in objMap) {
      var objContent = objMap[objId];
      if (!objContent.includes("FlateDecode")) continue;
      var sm2 = objContent.match(/stream\s*\n([\s\S]*?)endstream/);
      if (!sm2) continue;
      var raw2 = sm2[1].replace(/[\r\n]+$/, "");
      // Skip large streams (likely image data, not CMap)
      if (raw2.length > 100_000) continue;
      var dec2;
      try {
        dec2 = await inflateRaw(stringToBytes(raw2));
      } catch {
        continue;
      }
      var data = latin1Decode(dec2);
      if (!data.includes("begincmap")) continue;

      var bfcharRe = /(\d+)\s+beginbfchar\n([\s\S]*?)endbfchar/g;
      var bm;
      while ((bm = bfcharRe.exec(data)) !== null) {
        var entries = bm[2].split("\n");
        for (var ei = 0; ei < entries.length; ei++) {
          var match = entries[ei].match(/<(\w+)>\s*<(\w+)>/);
          if (match) cmap[parseInt(match[1], 16)] = parseInt(match[2], 16);
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
              if (!cmap[ci]) cmap[ci] = baseCode + (ci - start);
            }
          }
        }
      }
    }
    await _yield();

    // Find page content references
    var pages = [];
    var pageRe = /\/Type\s*\/Page[\s\S]*?\/Contents\s+(\d+)\s+(\d+)\s+R/g;
    var pm;
    while ((pm = pageRe.exec(src)) !== null) {
      pages.push({ contentRef: pm[1] + " " + pm[2] });
    }
    // Fallback: find any /Contents reference
    if (pages.length === 0) {
      var altRe = /\/Contents\s+(\d+)\s+(\d+)\s+R/g;
      var altM;
      while ((altM = altRe.exec(src)) !== null) {
        pages.push({ contentRef: altM[1] + " " + altM[2] });
      }
    }
    if (pages.length === 0) return "";
    await _yield();

    /**
     *
     * @param code
     */
    function cmapChar(code) {
      if (cmap[code]) {
        try {
          return String.fromCodePoint(cmap[code]);
        } catch {
          return "?";
        }
      }
      return "?";
    }
    /**
     *
     * @param hex
     */
    function cmapStr(hex) {
      var code = parseInt(hex, 16);
      return cmapChar(code);
    }

    /**
     *
     * @param s
     */
    function decodePdfString(s) {
      if (s.length < 2) return s;
      var asianCount = 0;
      var testLen = Math.min(100, s.length);
      for (var ti = 0; ti + 1 < testLen; ti += 2) {
        var b1 = s.charCodeAt(ti),
          b2 = s.charCodeAt(ti + 1);
        if (b1 === 0 && b2 >= 0x20 && b2 <= 0x7e) asianCount++;
      }
      if (asianCount > 5 && asianCount / Math.floor(testLen / 2) > 0.4) {
        var out2 = "";
        for (var di2 = 0; di2 + 1 < s.length; di2 += 2) {
          out2 += String.fromCharCode(
            (s.charCodeAt(di2) << 8) | s.charCodeAt(di2 + 1),
          );
        }
        return out2;
      }
      return s;
    }

    /**
     *
     * @param s
     */
    function unescapePdfStr(s) {
      return s.replace(/\\([nrt])/g, " ").replace(/\\(.)/g, "$1");
    }

    var textPieces = [];
    for (var p = 0; p < pages.length; p++) {
      if (p > 0 && p % 5 === 0) await _yield();

      var contentObj = objMap[pages[p].contentRef];
      if (!contentObj) continue;

      var streamRe = /stream\s*\n([\s\S]*?)endstream/;
      var sm = streamRe.exec(contentObj);
      if (!sm) continue;

      var rawStream = sm[1].replace(/[\r\n]+$/, "");
      // Skip very large streams (likely image data, not text)
      if (rawStream.length > 500_000) continue;

      var decompressed;

      decompressed = contentObj.includes("FlateDecode") ? (await inflateRaw(stringToBytes(rawStream))) : stringToBytes(rawStream);

      // Skip if decompression produced nothing
      if (!decompressed || decompressed.length === 0) continue;

      var content = latin1Decode(decompressed);

      // Parenthesized strings with Tj / ' / " operators (handles escaped parens)
      var psRe = /\(((?:[^()\\]|\\.)*)\)\s*(Tj|'|")/g;
      var tm;
      while ((tm = psRe.exec(content)) !== null) {
        textPieces.push(decodePdfString(unescapePdfStr(tm[1])));
      }
      // Hex strings with Tj (decode via CMap)
      var hsRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
      while ((tm = hsRe.exec(content)) !== null) {
        textPieces.push(cmapStr(tm[1]));
      }
      // TJ arrays
      var tjRe = /\[([^\]]*)\]\s*TJ/g;
      while ((tm = tjRe.exec(content)) !== null) {
        var arrStr = tm[1];
        var parRe = /\(((?:[^()\\]|\\.)*)\)/g;
        var pm2;
        while ((pm2 = parRe.exec(arrStr)) !== null) {
          textPieces.push(unescapePdfStr(pm2[1]));
        }
        var hxRe = /<([0-9A-Fa-f]+)>/g;
        while ((pm2 = hxRe.exec(arrStr)) !== null) {
          textPieces.push(cmapStr(pm2[1]));
        }
      }
    }

    return textPieces
      .join(" ")
      .replace(/[ \t\n\r\f\v]+/g, " ")
      .trim();
  }

  /**
   *
   * @param str
   */
  function stringToBytes(str) {
    var buf = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xff;
    return buf;
  }

  // Manual Latin-1 decoder that maps each byte to its exact Unicode code point (0-255).
  // Using TextDecoder('latin1') is unreliable because browsers may implement it as
  // Windows-1252, which maps bytes 0x80-0x9F to different code points (>255), causing
  // data corruption when round-tripping through stringToBytes.
  /**
   *
   * @param arr
   */
  function latin1Decode(arr) {
    var s = "";
    for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return s;
  }

  return {
    readDocx: readDocx,
    readPdf: readPdf,
  };
})();

// ── Main extraction dispatcher ──

/**
 *
 * @param file
 * @param callback
 */
async function docwExtractText(file, callback) {
  var ext = file.name.split(".").pop().toLowerCase();
  var reader = new FileReader();

  reader.onerror = function () {
    callback("Error reading file: " + file.name);
  };

  switch (ext) {
  case "docx": {
    reader.onload = function (e) {
      DOCX_EXTRACTOR.readDocx(e.target.result)
        .then(function (text) {
          callback(null, text, "docx");
        })
        .catch(function (error) {
          callback(error.message);
        });
    };
    reader.readAsArrayBuffer(file);
  
  break;
  }
  case "pdf": {
    reader.onload = function (e) {
      DOCX_EXTRACTOR.readPdf(new Uint8Array(e.target.result))
        .then(function (text) {
          if (text) {
            callback(null, text, "pdf");
          } else {
            callback(
              "Could not extract text from PDF. The PDF may be image-based or encrypted.",
            );
          }
        })
        .catch(function (error) {
          callback("PDF extraction failed: " + error.message);
        });
    };
    reader.readAsArrayBuffer(file);
  
  break;
  }
  case "doc": {
    // DOC (binary OLE) - best-effort: read as binary, extract printable ASCII
    reader.onload = function (e) {
      var arr = new Uint8Array(e.target.result);
      var result = "";
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if ((c >= 0x20 && c <= 0x7e) || c === 0x0a || c === 0x0d) {
          result += String.fromCharCode(c);
        }
      }
      result = result.replace(/\s+/g, " ").trim();
      callback(null, result || "No readable text found in DOC file.", "doc");
    };
    reader.readAsArrayBuffer(file);
  
  break;
  }
  default: {
    // TXT, JSON, CSV and others - read as text
    reader.onload = function (e) {
      callback(null, e.target.result, ext);
    };
    reader.readAsText(file, "UTF-8");
  }
  }
}
