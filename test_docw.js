const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── 1. Load document_watermark_core.js ──
console.log("=== Loading document_watermark_core.js ===");
const coreCode = fs.readFileSync(
  path.join(__dirname, "Document_Watermark", "document_watermark_core.js"),
  "utf8",
);
eval(coreCode);
console.log("Core module loaded.");

// ── 2. Polyfill _deflate/_inflate with Node zlib for reliability ──
// (original uses CompressionStream/DecompressionStream; on Node 20 they exist
//  but pipeThrough can behave differently; zlib is more predictable)
_deflate = async function (bytes) {
  return new Uint8Array(zlib.deflateSync(Buffer.from(bytes)));
};
_inflate = async function (bytes) {
  return new Uint8Array(zlib.inflateSync(Buffer.from(bytes)));
};
console.log("Polyfilled _deflate/_inflate with zlib.");

// ── 3. PDF text extraction (zlib-based, replicating text_extractor.js) ──
function latin1Decode(arr) {
  var s = "";
  for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}

function stringToBytes(str) {
  var buf = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xff;
  return buf;
}

async function inflatePdfData(data) {
  try {
    return new Uint8Array(zlib.inflateSync(Buffer.from(data)));
  } catch (e1) {
    /* fall through to raw */
  }
  try {
    return new Uint8Array(zlib.inflateRawSync(Buffer.from(data)));
  } catch (e2) {
    /* fall through to raw */
  }
  return data;
}

async function readPdfText(raw) {
  var arr = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  var src = latin1Decode(arr);

  var objMap = {};
  var objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  var m;
  while ((m = objRe.exec(src)) !== null) {
    objMap[m[1] + " " + m[2]] = m[3];
  }

  var cmap = {};
  for (var objId in objMap) {
    var objContent = objMap[objId];
    if (objContent.indexOf("FlateDecode") === -1) continue;
    var sm2 = objContent.match(/stream\s*\n([\s\S]*?)endstream/);
    if (!sm2) continue;
    var raw2 = sm2[1].replace(/[\r\n]+$/, "");
    var dec2;
    try {
      dec2 = await inflatePdfData(stringToBytes(raw2));
    } catch (e) {
      continue;
    }
    var data = latin1Decode(dec2);
    if (data.indexOf("begincmap") === -1) continue;

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

  var pages = [];
  var pageRe = /\/Type\s*\/Page[\s\S]*?\/Contents\s+(\d+)\s+(\d+)\s+R/g;
  var pm;
  while ((pm = pageRe.exec(src)) !== null) {
    pages.push({ contentRef: pm[1] + " " + pm[2] });
  }
  if (pages.length === 0) {
    var altRe = /\/Contents\s+(\d+)\s+(\d+)\s+R/g;
    var altM;
    while ((altM = altRe.exec(src)) !== null) {
      pages.push({ contentRef: altM[1] + " " + altM[2] });
    }
  }
  if (pages.length === 0) return "";

  function cmapChar(code) {
    if (cmap[code]) {
      try {
        return String.fromCodePoint(cmap[code]);
      } catch (e) {
        return "?";
      }
    }
    return "?";
  }
  function cmapStr(hex) {
    return cmapChar(parseInt(hex, 16));
  }

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

  function unescapePdfStr(s) {
    return s.replace(/\\([nrt])/g, " ").replace(/\\(.)/g, "$1");
  }

  var textPieces = [];
  for (var p = 0; p < pages.length; p++) {
    var contentObj = objMap[pages[p].contentRef];
    if (!contentObj) continue;

    var streamRe = /stream\s*\n([\s\S]*?)endstream/;
    var sm = streamRe.exec(contentObj);
    if (!sm) continue;

    var rawStream = sm[1].replace(/[\r\n]+$/, "");
    var decompressed;

    if (contentObj.indexOf("FlateDecode") >= 0) {
      decompressed = await inflatePdfData(stringToBytes(rawStream));
    } else {
      decompressed = stringToBytes(rawStream);
    }

    var content = latin1Decode(decompressed);

    var psRe = /\(((?:[^()\\]|\\.)*)\)\s*(Tj|'|")/g;
    var tm;
    while ((tm = psRe.exec(content)) !== null) {
      textPieces.push(decodePdfString(unescapePdfStr(tm[1])));
    }
    var hsRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
    while ((tm = hsRe.exec(content)) !== null) {
      textPieces.push(cmapStr(tm[1]));
    }
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

// ── 4. Main test ──
async function main() {
  try {
    // ── Read PDF ──
    var pdfPath = "F:\\7b8ca631-026f-4a50-84fa-c08d52bc9ae1.pdf";
    var pdfBuffer = fs.readFileSync(pdfPath);
    console.log("\n=== PDF Input ===");
    console.log("Size:", pdfBuffer.length, "bytes");

    // ── Extract text ──
    console.log("\n=== Text Extraction ===");
    var pdfText = "";
    try {
      pdfText = await readPdfText(new Uint8Array(pdfBuffer));
    } catch (err) {
      console.error("Extraction error:", err.message);
    }
    console.log("Extracted length:", pdfText.length, "characters");
    console.log("--- Text preview (first 500 chars) ---");
    console.log(pdfText.substring(0, 500));
    console.log("...");
    console.log("--- end preview ---");

    // ── Read secret file ──
    console.log("\n=== Secret File ===");
    var secretPath = "G:\\img\\raaed\\iCloud Photos\\free.jpg.fingerprint.json";
    var secretRaw = "";
    try {
      secretRaw = fs.readFileSync(secretPath, "utf8");
    } catch (err) {
      console.error("Failed to read secret file:", err.message);
    }
    var secretData = null;
    try {
      secretData = JSON.parse(secretRaw);
      var si = secretData.file_info;
      console.log(
        "File:",
        si.file_name,
        "(" + si.width + "x" + si.height + ", " + si.format + ")",
      );
      console.log("SHA-256:", secretData.hashes["SHA-256"]);
    } catch (err) {
      console.error("Failed to parse secret JSON:", err.message);
    }

    // ── Capacity ──
    var coverText =
      pdfText || "Fallback text for watermark testing purposes only.";
    console.log("\n=== Capacity Estimates ===");
    console.log("Cover text character count:", coverText.length);
    for (var id in DOCW_ALGOS) {
      var algo = DOCW_ALGOS[id];
      var cap = docwEstimateCapacity(coverText, id);
      console.log("  Algo " + id + " (" + algo.name + "): ~" + cap + " bytes");
    }

    // ── Embed/Extract: TEST123 ──
    var testMsg = "TEST123";
    console.log('\n=== Embed/Extract Tests (message: "' + testMsg + '") ===');
    for (id in DOCW_ALGOS) {
      algo = DOCW_ALGOS[id];
      console.log("\n--- " + algo.name + " (algoId=" + id + ") ---");
      try {
        console.time("  embed");
        var embedded = await docwEmbed(coverText, testMsg, id);
        console.timeEnd("  embed");
        console.log(
          "  Embedded length: " + coverText.length + " -> " + embedded.length,
        );
        console.time("  extract");
        var extracted = await docwExtract(embedded, id);
        console.timeEnd("  extract");
        console.log('  Extracted: "' + extracted + '"');
        console.log(
          "  Result: " + (extracted === testMsg ? "✓ PASS" : "✗ FAIL"),
        );
      } catch (err) {
        console.error("  FAIL with error:", err.message);
      }
    }

    // ── Embed secret file content ──
    if (secretData && coverText) {
      var secretStr = JSON.stringify(secretData);
      console.log("\n=== Embedding Secret File Content ===");
      console.log("Secret JSON length:", secretStr.length, "bytes");

      for (id in DOCW_ALGOS) {
        algo = DOCW_ALGOS[id];
        var cap = docwEstimateCapacity(coverText, id);
        console.log(
          "\n--- " + algo.name + " (capacity: " + cap + " bytes) ---",
        );

        if (cap >= secretStr.length) {
          try {
            var e1 = await docwEmbed(coverText, secretStr, id);
            var x1 = await docwExtract(e1, id);
            console.log(
              "  Full secret: " + (x1 === secretStr ? "✓ PASS" : "✗ FAIL"),
            );
          } catch (err) {
            console.log("  Full secret error: " + err.message);
          }
        } else {
          console.log(
            "  (Cover too short for full " + secretStr.length + "-byte secret)",
          );
        }

        var hashLabel = "SHA-256: " + secretData.hashes["SHA-256"];
        if (cap >= hashLabel.length) {
          try {
            var e2 = await docwEmbed(coverText, hashLabel, id);
            var x2 = await docwExtract(e2, id);
            console.log(
              "  SHA-256 label: " + (x2 === hashLabel ? "✓ PASS" : "✗ FAIL"),
            );
          } catch (err) {
            console.log("  SHA-256 label error: " + err.message);
          }
        } else {
          console.log(
            "  (Cover too short for " +
              hashLabel.length +
              "-byte SHA-256 label)",
          );
        }

        var hashVal = secretData.hashes["SHA-256"];
        if (cap >= hashVal.length) {
          try {
            var e3 = await docwEmbed(coverText, hashVal, id);
            var x3 = await docwExtract(e3, id);
            console.log(
              "  SHA-256 value: " + (x3 === hashVal ? "✓ PASS" : "✗ FAIL"),
            );
          } catch (err) {
            console.log("  SHA-256 value error: " + err.message);
          }
        } else {
          console.log(
            "  (Cover too short for " + hashVal.length + "-byte SHA-256 value)",
          );
        }
      }
    }

    // ── Full Round-Trip Test (Embed → Rebuild PDF → Extract → Verify) ──
    console.log(
      "\n=== FULL ROUND-TRIP TEST (Embed → Rebuild PDF → Extract → Verify) ===",
    );

    // Read the original PDF bytes
    var pdfBytes = new Uint8Array(
      fs.readFileSync("F:\\7b8ca631-026f-4a50-84fa-c08d52bc9ae1.pdf"),
    );
    var testMsgRT = "ROUNDTRIP_TEST_OK";
    console.log("Original text length:", pdfText.length);
    console.log("Test message:", testMsgRT);

    // 1. Embed using ZWC (algoId=1)
    var watermarkedText = await docwEmbed(pdfText, testMsgRT, 1, "");
    console.log("Watermarked text length:", watermarkedText.length);

    // Verify the watermark is in the text directly
    var verifyExtract = await docwExtract(watermarkedText, 1, "");
    console.log("Direct extract result:", verifyExtract);

    // 2. Rebuild PDF
    var rebuiltBytes = await buildWatermarkedPdfDoc(
      pdfBytes,
      pdfText,
      watermarkedText,
    );
    console.log("Rebuilt PDF size:", rebuiltBytes.length);

    // Save rebuilt PDF for inspection
    fs.writeFileSync(
      "F:\\RedoSan Authenticity\\rebuilt_test.pdf",
      Buffer.from(rebuiltBytes),
    );

    // 3. Extract text from rebuilt PDF
    var reExtractedText = await readPdfText(rebuiltBytes);
    console.log("Re-extracted text length:", reExtractedText.length);
    console.log("First 200 chars:", reExtractedText.substring(0, 200));

    // 4. Extract watermark from re-extracted text
    var roundtripResult = await docwExtract(reExtractedText, 1, "");
    console.log("Round-trip extract result:", roundtripResult);
    console.log(
      "Round-trip PASS:",
      roundtripResult === testMsgRT ? "✓ YES" : "✗ NO",
    );

    // 5. Also test Homoglyph (algoId=2) and Whitespace (algoId=3)
    for (var algoId of [2, 3]) {
      var wt2 = await docwEmbed(pdfText, testMsgRT, algoId, "");
      var rt2 = await docwExtract(wt2, algoId, "");
      console.log(
        "Algorithm " + algoId + " direct extract:",
        rt2 === testMsgRT ? "✓" : "✗",
      );
    }

    console.log("\n=== ALL TESTS COMPLETE ===");
  } catch (err) {
    console.error("\nFATAL:", err.message);
    console.error(err.stack);
  }
}

// ── PDF rebuild helpers (adapted from document_watermark.js for Node) ──

function _getWmAtPos(origFull, wmFull, segText, startPos) {
  if (origFull.length - startPos < segText.length) return null;
  for (var i = 0; i < segText.length; i++) {
    if (origFull[startPos + i] !== segText[i]) return null;
  }
  var wmIdx = 0,
    origIdx = 0;
  while (origIdx < startPos && wmIdx < wmFull.length) {
    if (wmFull[wmIdx] === origFull[origIdx]) origIdx++;
    wmIdx++;
  }
  var wmStart = wmIdx;
  while (wmStart < wmFull.length && wmFull[wmStart] !== segText[0]) wmStart++;
  wmIdx = wmStart;
  var si = 0;
  while (si < segText.length && wmIdx < wmFull.length) {
    if (wmFull[wmIdx] === segText[si]) si++;
    wmIdx++;
  }
  if (si < segText.length) return null;
  return wmFull.substring(wmStart, wmIdx);
}

function _pdfReplaceInStream(content, origFull, wmFull) {
  var segs = [];
  var reTJ = /\[([\s\S]*?)\]\s*TJ/g;
  var m;
  while ((m = reTJ.exec(content)) !== null) {
    var combined = "";
    var ci = 0,
      arr = m[1];
    while (ci < arr.length) {
      if (arr[ci] === "(") {
        var depth = 1;
        ci++;
        var cStart = ci;
        while (ci < arr.length && depth > 0) {
          if (arr[ci] === "\\") {
            ci += 2;
            continue;
          }
          if (arr[ci] === "(") depth++;
          if (arr[ci] === ")") depth--;
          ci++;
        }
        combined += arr.substring(cStart, ci - 1).replace(/\\(.)/g, "$1");
      } else {
        ci++;
      }
    }
    segs.push({
      start: m.index,
      end: m.index + m[0].length,
      text: combined,
      isTJ: true,
    });
  }
  var reTj = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  while ((m = reTj.exec(content)) !== null) {
    segs.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1].replace(/\\(.)/g, "$1"),
      isTJ: false,
    });
  }
  if (segs.length === 0) {
    var origHex = "",
      replHex = "";
    for (var j = 0; j < origFull.length; j++)
      origHex += origFull.charCodeAt(j).toString(16).toUpperCase();
    for (var k = 0; k < wmFull.length; k++)
      replHex += wmFull.charCodeAt(k).toString(16).toUpperCase();
    if (origHex) return content.split(origHex).join(replHex);
    return content;
  }

  segs.sort(function (a, b) {
    return a.start - b.start;
  });
  var streamText = "";
  for (var si = 0; si < segs.length; si++) streamText += segs[si].text;
  if (!streamText) return content;
  var streamPos = origFull.indexOf(streamText);
  if (streamPos < 0) return content;

  var remainingText = streamText.length;
  for (var si2 = segs.length - 1; si2 >= 0; si2--) {
    var segEndInStream = remainingText;
    var segStartInStream = segEndInStream - segs[si2].text.length;
    remainingText = segStartInStream;
    var wmSeg = _getWmAtPos(
      origFull,
      wmFull,
      segs[si2].text,
      streamPos + segStartInStream,
    );
    var chunk = wmSeg !== null ? wmSeg : segs[si2].text;
    var esc = chunk
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    content =
      content.substring(0, segs[si2].start) +
      "(" +
      esc +
      ") Tj" +
      content.substring(segs[si2].end);
  }

  return content;
}

async function buildWatermarkedPdfDoc(
  originalBytes,
  originalText,
  watermarkedText,
) {
  var src = "";
  for (var i = 0; i < originalBytes.length; i++)
    src += String.fromCharCode(originalBytes[i]);
  var result = "",
    lastIdx = 0;

  // Encode watermarked text as UTF-16 BE
  var wmUtf16Be = "";
  for (var ci = 0; ci < watermarkedText.length; ci++) {
    var code = watermarkedText.charCodeAt(ci);
    wmUtf16Be += String.fromCharCode((code >> 8) & 0xff);
    wmUtf16Be += String.fromCharCode(code & 0xff);
  }
  function escPdfStr(s) {
    return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
  var wmStreamSnippet =
    "\nBT\n/F0 12 Tf\n0 0 Td\n(" + escPdfStr(wmUtf16Be) + ") Tj\nET\n";

  var re = /stream([\r\n]+)([\s\S]*?)endstream/g;
  var m;
  while ((m = re.exec(src)) !== null) {
    result += src.substring(lastIdx, m.index);
    result += "stream" + m[1];
    var rawData = m[2];
    var cleanData = rawData.replace(/[\r\n]+$/, "");
    var rawBytes = new Uint8Array(cleanData.length);
    for (var di = 0; di < cleanData.length; di++)
      rawBytes[di] = cleanData.charCodeAt(di) & 0xff;
    var modified = cleanData;

    // Try decompress via polyfilled _inflate (zlib)
    var dec = null;
    try {
      dec = await _inflate(rawBytes);
    } catch (e1) {
      dec = null;
    }

    var streamModified = false;
    if (dec) {
      var decStr = "";
      for (var d2 = 0; d2 < dec.length; d2++)
        decStr += String.fromCharCode(dec[d2]);
      // Append watermarked text to the first PAGE content stream (has BT/ET/Tj/TJ)
      if (wmUtf16Be && decStr.indexOf("BT") >= 0 && decStr.indexOf("ET") >= 0) {
        var lastEt = decStr.lastIndexOf("ET");
        decStr =
          decStr.substring(0, lastEt + 2) +
          wmStreamSnippet +
          decStr.substring(lastEt + 2);
        wmUtf16Be = ""; // clear so we only append once
        streamModified = true;
      }
      // Try to do text replacement (best-effort, won't match CMap-encoded text)
      var newStr = _pdfReplaceInStream(decStr, originalText, watermarkedText);
      if (newStr !== decStr || streamModified) {
        var toCompress = newStr;
        var nBytes = new Uint8Array(toCompress.length);
        for (var nb = 0; nb < toCompress.length; nb++)
          nBytes[nb] = toCompress.charCodeAt(nb) & 0xff;
        var comp = await _deflate(nBytes);
        modified = "";
        for (var ciX = 0; ciX < comp.length; ciX++)
          modified += String.fromCharCode(comp[ciX]);
      }
    }

    var trail = rawData.substring(cleanData.length);
    result += modified + trail + "endstream";
    lastIdx = m.index + m[0].length;
  }
  result += src.substring(lastIdx);
  var out = new Uint8Array(result.length);
  for (var i2 = 0; i2 < result.length; i2++)
    out[i2] = result.charCodeAt(i2) & 0xff;
  return out;
}

main();
