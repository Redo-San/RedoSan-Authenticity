/* c8 ignore start */
(function () {
  if (
    typeof window !== "undefined" &&
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
/* c8 ignore stop */
// ── PDF rebuild — modifies original PDF, replacing text with watermarked version ──

/**
 *
 * @param origFull
 * @param wmFull
 * @param segText
 * @param startPos
 */
function _getWmAtPos(origFull, wmFull, segText, startPos) {
  // Verify segText is at startPos in origFull
  if (origFull.length - startPos < segText.length) return null;
  for (let i = 0; i < segText.length; i++) {
    if (origFull[startPos + i] !== segText[i]) return null;
  }
  // Walk wmFull matching original chars until we reach startPos
  var wmIdx = 0,
    origIdx = 0;
  while (origIdx < startPos && wmIdx < wmFull.length) {
    if (wmFull[wmIdx] === origFull[origIdx]) origIdx++;
    wmIdx++;
  }
  // Advance to first char of segText (skip any ZWC between prev char and this one)
  var wmStart = wmIdx;
  while (wmStart < wmFull.length && wmFull[wmStart] !== segText[0]) wmStart++;
  // Collect watermarked version of segText chars
  wmIdx = wmStart;
  var si = 0;
  while (si < segText.length && wmIdx < wmFull.length) {
    if (wmFull[wmIdx] === segText[si]) si++;
    wmIdx++;
  }
  if (si < segText.length) return null;
  return wmFull.substring(wmStart, wmIdx);
}

/**
 *
 * @param bytes
 */
async function _decompressRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new TypeError("DecompressionStream not available");
  }
  var ds = new DecompressionStream("deflate-raw");
  var writer = ds.writable.getWriter();
  var reader = ds.readable.getReader();
  var chunks = [];
  var readPromise = (async function () {
    while (true) {
      try {
        const v = await reader.read();
        if (v.done) break;
        chunks.push(v.value);
      } catch {
        break;
      }
    }
  })();
  readPromise.catch(function () {});
  try {
    await writer.write(bytes);
    await writer.close();
  } catch {
    /* suppress */
  }
  await readPromise;
  var total = 0;
  for (let i = 0; i < chunks.length; i++) total += chunks[i].length;
  var result = new Uint8Array(total);
  var offset = 0;
  for (let i2 = 0; i2 < chunks.length; i2++) {
    result.set(chunks[i2], offset);
    offset += chunks[i2].length;
  }
  return result;
}

/**
 *
 * @param str
 */
function _stringToBytes(str) {
  var buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xff;
  return buf;
}

/**
 *
 * @param src
 */
async function _pdfBuildCMap(src) {
  var cmap = { forward: {}, reverse: {} };
  var objRe = /(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g;
  for (let m = objRe.exec(src); m !== null; m = objRe.exec(src)) {
    const objContent = m[2];
    if (!objContent.includes("FlateDecode")) continue;
    const sm2 = objContent.match(/stream\s*\n([\s\S]*?)endstream/);
    if (!sm2) continue;
    const raw2 = sm2[1].replace(/[\r\n]+$/, "");
    if (raw2.length > 100_000) continue;
    let dec2;
    try {
      dec2 = await _decompressRaw(_stringToBytes(raw2));
    } catch {
      continue;
    }
    if (!dec2 || dec2.length === 0) continue;
    let data = "";
    for (let di = 0; di < dec2.length; di++)
      data += String.fromCharCode(dec2[di]);
    if (!data.includes("begincmap")) continue;

    const bfcharRe = /(\d+)\s+beginbfchar\n([\s\S]*?)endbfchar/g;
    for (let bm = bfcharRe.exec(data); bm !== null; bm = bfcharRe.exec(data)) {
      const entries = bm[2].split("\n");
      for (let ei = 0; ei < entries.length; ei++) {
        const match = entries[ei].match(/<(\w+)>\s*<(\w+)>/);
        if (match) {
          const cid = parseInt(match[1], 16);
          const uni = parseInt(match[2], 16);
          cmap.forward[cid] = uni;
          if (!cmap.reverse[uni]) cmap.reverse[uni] = cid;
        }
      }
    }
    const bfrangeRe = /(\d+)\s+beginbfrange\n([\s\S]*?)endbfrange/g;
    for (
      let rm = bfrangeRe.exec(data);
      rm !== null;
      rm = bfrangeRe.exec(data)
    ) {
      const rentries = rm[2].split("\n");
      for (let ri = 0; ri < rentries.length; ri++) {
        const parts = rentries[ri].match(/<(\w+)>\s*<(\w+)>\s*<(\w+)>/);
        if (parts) {
          const start = parseInt(parts[1], 16);
          const end = parseInt(parts[2], 16);
          const baseCode = parseInt(parts[3], 16);
          for (let ci = start; ci <= end; ci++) {
            const uni2 = baseCode + (ci - start);
            if (!cmap.forward[ci]) {
              cmap.forward[ci] = uni2;
              if (!cmap.reverse[uni2]) cmap.reverse[uni2] = ci;
            }
          }
        }
      }
    }
  }
  return cmap;
}

/**
 *
 * @param content
 * @param origFull
 * @param wmFull
 * @param cmap
 */
function _pdfReplaceInStream(content, origFull, wmFull, cmap) {
  // ── 1. Locate all text segments (TJ arrays + Tj operators) ──
  var segs = [];
  var reTJ = /\[([\s\S]*?)\]\s*TJ/g;
  for (let m = reTJ.exec(content); m !== null; m = reTJ.exec(content)) {
    let combined = "";
    let ci = 0,
      arr = m[1];
    while (ci < arr.length) {
      if (arr[ci] === "(") {
        let depth = 1;
        ci++;
        const cStart = ci;
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
  for (let m = reTj.exec(content); m !== null; m = reTj.exec(content)) {
    segs.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1].replace(/\\(.)/g, "$1"),
      isTJ: false,
    });
  }
  if (segs.length === 0) {
    // Try hex Tj strings (CMap-encoded)
    const hexTjRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
    const hexSegs = [];
    let hexCombined = "";
    for (
      let htm2 = hexTjRe.exec(content);
      htm2 !== null;
      htm2 = hexTjRe.exec(content)
    ) {
      const htm = htm2;
      const hex = htm[1];
      const cid = parseInt(hex, 16);
      let ch;
      if (cmap && cmap.forward[cid] !== undefined) {
        try {
          ch = String.fromCodePoint(cmap.forward[cid]);
        } catch {
          ch = "?";
        }
      } else {
        ch = String.fromCharCode(cid);
      }
      hexSegs.push({
        start: htm.index,
        end: htm.index + htm[0].length,
        hex: hex,
        cid: cid,
        ch: ch,
      });
      hexCombined += ch;
    }
    if (hexCombined && hexSegs.length > 0) {
      const hexStreamPos = origFull.indexOf(hexCombined);
      if (hexStreamPos >= 0) {
        let hexRemaining = hexCombined.length;
        for (let hi = hexSegs.length - 1; hi >= 0; hi--) {
          const segEndInStream = hexRemaining;
          const segStartInStream = segEndInStream - 1;
          hexRemaining = segStartInStream;
          const wmChar = wmFull[hexStreamPos + segStartInStream];
          if (wmChar) {
            const wmCode = wmChar.charCodeAt(0);
            let newCid;
            newCid =
              cmap && cmap.reverse[wmCode] !== undefined
                ? cmap.reverse[wmCode]
                : hexSegs[hi].cid;
            let newHex = newCid.toString(16).toUpperCase();
            while (newHex.length < 4) newHex = "0" + newHex;
            content =
              content.substring(0, hexSegs[hi].start) +
              "<" +
              newHex +
              "> Tj" +
              content.substring(hexSegs[hi].end);
          }
        }
        return content;
      }
    }
    // Fallback: hex-encode Unicode and replace (works for identity CMaps)
    let origHex = "",
      replHex = "";
    for (let j = 0; j < origFull.length; j++)
      origHex += origFull.charCodeAt(j).toString(16).toUpperCase();
    for (let k = 0; k < wmFull.length; k++)
      replHex += wmFull.charCodeAt(k).toString(16).toUpperCase();
    if (origHex) return content.split(origHex).join(replHex);
    return content;
  }

  // ── 2. Build full stream text and find it in origFull ──
  segs.sort(function (a, b) {
    return a.start - b.start;
  });
  var streamText = "";
  for (let si = 0; si < segs.length; si++) streamText += segs[si].text;
  if (!streamText) return content;
  var streamPos = origFull.indexOf(streamText);
  if (streamPos < 0) return content;

  // ── 3. Walk segments backward, replace each with per-position watermarked text ──
  var remainingText = streamText.length;
  for (let si2 = segs.length - 1; si2 >= 0; si2--) {
    const segEndInStream = remainingText;
    const segStartInStream = segEndInStream - segs[si2].text.length;
    remainingText = segStartInStream;
    const wmSeg = _getWmAtPos(
      origFull,
      wmFull,
      segs[si2].text,
      streamPos + segStartInStream,
    );
    const chunk = wmSeg === null ? segs[si2].text : wmSeg;
    const esc = chunk
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, String.raw`\(`)
      .replace(/\)/g, String.raw`\)`);
    content =
      content.substring(0, segs[si2].start) +
      "(" +
      esc +
      ") Tj" +
      content.substring(segs[si2].end);
  }

  return content;
}

/**
 *
 * @param originalBytes
 * @param originalText
 * @param watermarkedText
 */
async function buildWatermarkedPdfDoc(
  originalBytes,
  originalText,
  watermarkedText,
) {
  var src = "";
  for (let i = 0; i < originalBytes.length; i++)
    src += String.fromCharCode(originalBytes[i]);
  var result = "",
    lastIdx = 0;

  // Parse CMap from the PDF for hex Tj replacement
  var cmap = await _pdfBuildCMap(src);

  // Encode watermarked text as UTF-16 BE for PDF parenthesized string
  var wmUtf16Be = "";
  for (let ci = 0; ci < watermarkedText.length; ci++) {
    const code = watermarkedText.charCodeAt(ci);
    wmUtf16Be += String.fromCharCode((code >> 8) & 0xff);
    wmUtf16Be += String.fromCharCode(code & 0xff);
  }
  /**
   *
   * @param s
   */
  function escPdfStr(s) {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, String.raw`\(`)
      .replace(/\)/g, String.raw`\)`);
  }
  var wmStreamSnippet =
    "\nBT\n/F0 12 Tf\n0 0 Td\n(" + escPdfStr(wmUtf16Be) + ") Tj\nET\n";
  var wmAppended = false;

  // Process each stream
  var re = /stream([\r\n]+)([\s\S]*?)endstream/g;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    result += src.substring(lastIdx, m.index);
    result += "stream" + m[1];
    const rawData = m[2];
    const cleanData = rawData.replace(/[\r\n]+$/, "");
    const rawBytes = new Uint8Array(cleanData.length);
    for (let di = 0; di < cleanData.length; di++)
      rawBytes[di] = cleanData.charCodeAt(di) & 0xff;
    let modified = cleanData;

    // Try to decompress (zlib first, then raw deflate)
    let dec = null;
    for (let fmtIdx = 0; dec === null && fmtIdx < 2; fmtIdx++) {
      const fmt = fmtIdx === 0 ? "deflate" : "deflate-raw";
      try {
        const st = new DecompressionStream(fmt);
        const sw = st.writable.getWriter();
        const sr = st.readable.getReader();
        const sch = [];
        const srp = (async function () {
          try {
            while (true) {
              const v = await sr.read();
              if (v.done) break;
              sch.push(v.value);
            }
          } catch {
            /* reader error — suppress */
          }
        })();
        srp.catch(function () {});
        try {
          await sw.write(rawBytes);
          await sw.close();
        } catch {
          /* suppress */
        }
        await srp;
        let sttl = 0;
        for (let si = 0; si < sch.length; si++) sttl += sch[si].length;
        dec = new Uint8Array(sttl);
        let soff = 0;
        for (let sj = 0; sj < sch.length; sj++) {
          dec.set(sch[sj], soff);
          soff += sch[sj].length;
        }
      } catch {
        dec = null;
      }
    }

    if (dec) {
      let decStr = "";
      for (let d2 = 0; d2 < dec.length; d2++)
        decStr += String.fromCharCode(dec[d2]);
      // Try text replacement with CMap support
      const newStr = _pdfReplaceInStream(
        decStr,
        originalText,
        watermarkedText,
        cmap,
      );
      const didReplace = newStr !== decStr;
      // Only append if the CMap replacement didn't already modify the content
      const pageStream =
        !didReplace &&
        wmUtf16Be &&
        decStr.includes("BT") &&
        decStr.includes("ET");
      if (pageStream) {
        const lastEt = decStr.lastIndexOf("ET");
        decStr =
          decStr.substring(0, lastEt + 2) +
          wmStreamSnippet +
          decStr.substring(lastEt + 2);
        wmUtf16Be = "";
        wmAppended = true;
      }
      if (didReplace || pageStream) {
        const finalStr = didReplace ? newStr : decStr;
        const nBytes = new Uint8Array(finalStr.length);
        for (let nb = 0; nb < finalStr.length; nb++)
          nBytes[nb] = finalStr.charCodeAt(nb) & 0xff;
        const comp = await _deflate(nBytes);
        modified = "";
        for (let ciX = 0; ciX < comp.length; ciX++)
          modified += String.fromCharCode(comp[ciX]);
      }
    }

    const trail = rawData.substring(cleanData.length);
    result += modified + trail + "endstream";
    lastIdx = m.index + m[0].length;
  }
  result += src.substring(lastIdx);

  var out = new Uint8Array(result.length);
  for (let i2 = 0; i2 < result.length; i2++)
    out[i2] = result.charCodeAt(i2) & 0xff;
  return out;
}

/**
 *
 * @param r
 */
function _docwBuildCertificateText(r) {
  var DASHES = "------------------------------------------------------------";
  var s = "";
  s += "============================================================\n";
  s += "         WATERMARK CERTIFICATE\n";
  s += "     RedoSan Authenticity -- Document Watermark\n";
  s += "============================================================\n\n";
  s += "This document has been digitally watermarked. The embedded\n";
  s += "watermark serves as proof of authenticity and can be\n";
  s += "extracted and verified at any time.\n";
  s += DASHES + "\n";
  s += "             WATERMARK DETAILS\n";
  s += DASHES + "\n";
  s += "  Algorithm:   " + (r.algo || "--") + "\n";
  s += "  Message:     " + (r.message || "--") + "\n";
  s +=
    "  Timestamp:   " +
    (r.timestamp ? new Date(r.timestamp).toLocaleString() : "--") +
    "\n";
  s +=
    "  Doc. Length: " +
    (r.textLength ? r.textLength + " characters" : "--") +
    "\n";
  s += "  Document ID: " + (r.hash || "--") + "\n";
  s += DASHES + "\n";
  s += "             VERIFICATION\n";
  s += DASHES + "\n";
  s += "  To verify this watermark:\n";
  s += "  1. Open the Extract tab\n";
  s += '  2. Select "' + (r.algo || "same") + '" algorithm\n';
  s += "  3. Enter the password used during embedding\n";
  s += "  4. Load the watermarked document\n";
  s += "  5. The embedded message will appear\n";
  s += DASHES + "\n";
  s += "             INTEGRITY\n";
  s += DASHES + "\n";
  s += "  The watermark is embedded directly into the document\n";
  s += "  text using steganography. Any modification to the\n";
  s += "  watermarked content will invalidate the embedded\n";
  s += "  message, providing tamper-evident protection.\n";
  s += DASHES + "\n";
  s += "  Generated by RedoSan Authenticity\n";
  s += "  100% Client-Side | No Data Upload\n";
  s += "  https://redo-san.github.io/RedoSan-Authenticity/\n";
  s += "============================================================\n";
  return s;
}

/**
 *
 * @param r
 */
function docwToTXT(r) {
  return _docwBuildCertificateText(r);
}

/**
 *
 * @param r
 */
function docwToCSV(r) {
  var rows = [["Key", "Value"]];
  var keys = [
    "algo",
    "message",
    "timestamp",
    "textLength",
    "hash",
    "resultLength",
  ];
  for (let ki = 0; ki < keys.length; ki++) {
    const k = keys[ki];
    rows.push([k, r[k] === undefined ? "" : String(r[k])]);
  }
  return (
    rows
      .map(function (row) {
        return row
          .map(function (c) {
            return (
              '"' +
              String(c)
                .replace(/^[=+\-@\t\r]/, "'$&")
                .replace(/"/g, '""') +
              '"'
            );
          })
          .join(",");
      })
      .join("\n") + "\n"
  );
}

/**
 *
 * @param r
 */
function docwToXML(r) {
  var xml = '<?xml version="1.0"?>\n<document_watermark>\n';
  var keys = [
    "algo",
    "message",
    "timestamp",
    "textLength",
    "hash",
    "resultLength",
  ];
  for (let ki = 0; ki < keys.length; ki++) {
    const k = keys[ki];
    if (r[k] !== undefined)
      xml += "  <" + k + ">" + _docwEscXml(String(r[k])) + "</" + k + ">\n";
  }
  xml += "</document_watermark>";
  return xml;
}

/**
 *
 * @param r
 */
function docwToHTML(r) {
  return _docwBuildReportHtml(r, "embed");
}

/**
 *
 * @param format
 */
async function downloadDocw(format) {
  closeDownloadModal();
  var r = _docwResult;
  if (!r) return;

  if (format === "pdf") {
    const blob = await _docwBuildReportPdf(r, "embed");
    downloadBlobSimple(blob, "document_watermark_report.pdf");
    return;
  }

  if (format === "doc") {
    const blob = await _docwBuildReportDocx(r, "embed");
    downloadBlobSimple(blob, "document_watermark_report.docx");
    return;
  }

  var content, ext, mime;
  switch (format) {
    case "json": {
      content = JSON.stringify(
        {
          watermarkedText: r.watermarkedText,
          algo: r.algo,
          message: r.message || "",
          timestamp: r.timestamp,
          textLength: r.textLength,
          hash: r.hash || "",
        },
        null,
        2,
      );
      ext = "json";
      mime = "application/json";
      break;
    }
    case "csv": {
      content = docwToCSV(r);
      ext = "csv";
      mime = "text/csv";
      break;
    }
    case "txt": {
      content = docwToTXT(r);
      ext = "txt";
      mime = "text/plain";
      break;
    }
    case "xml": {
      content = docwToXML(r);
      ext = "xml";
      mime = "application/xml";
      break;
    }
    case "html": {
      content = docwToHTML(r);
      ext = "html";
      mime = "text/html";
      break;
    }
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, "document_watermark." + ext);
}
