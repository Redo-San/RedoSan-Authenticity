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

var _docwSecretMessage = "";
var _docwCoverText = "";
var _docwCoverFileName = "";
var _docwCoverBytes = null;
var _docwSecretData = null;
var _docwExtractText = "";
var _docwExtractResult = null;

/**
 *
 * @param mode
 */
function switchDocwTab(mode) {
  document.querySelectorAll(".tab-btn[data-docw-tab]").forEach(function (b) {
    b.classList.remove("active");
  });
  document.getElementById("docw-embed").style.display =
    mode === "embed" ? "" : "none";
  document.getElementById("docw-extract").style.display =
    mode === "extract" ? "" : "none";
  document.getElementById("docw-embed-result").style.display = "none";
  document.getElementById("docw-extract-result").style.display = "none";
  document.getElementById("docw-embed-buttons").style.display = "none";
  document.getElementById("docw-extract-buttons").style.display = "none";
  document.getElementById("docw-embed-download").innerHTML = "";
  document
    .querySelector('.tab-btn[data-docw-tab="' + mode + '"]')
    .classList.add("active");
}

/**
 *
 * @param msg
 * @param pct
 */
function showDocwLoading(msg, pct) {
  var ov = document.getElementById("docw-loading-overlay");
  if (!ov) return;
  ov.style.display = "flex";
  document.getElementById("docw-loading-text").textContent =
    msg || "Processing...";
  var bw = document.getElementById("docw-loading-bar-wrap");
  var bp = document.getElementById("docw-loading-pct");
  if (pct != null && pct >= 0) {
    bw.style.display = "";
    document.getElementById("docw-loading-bar").style.width = pct + "%";
    bp.textContent = pct + "%";
  } else {
    bw.style.display = "none";
    bp.textContent = "";
  }
}
/**
 *
 */
function hideDocwLoading() {
  var ov = document.getElementById("docw-loading-overlay");
  if (ov) ov.style.display = "none";
}

/**
 *
 * @param cap
 */
function _docwShowNoTextWarning(cap) {
  var w = document.getElementById("docw-cover-warning");
  if (_docwCoverText && _docwCoverText.length <= 100) {
    w.style.display = "";
    w.innerHTML =
      "<strong>⚠ Very little text detected</strong><br>This document has only <b>" +
      _docwCoverText.length +
      " characters</b> (~" +
      cap +
      ' capacity) — likely a scanned/image-based document with only form labels.<br><br>Document Watermarking works by modifying visible text. For image-based documents, use one of these instead:<br>• <b>Pixel Injection</b> — embed data in image pixels<br>• <b>Watermark</b> — image watermarking algorithms<br>• <b>Forensic</b> — forensic analysis tools<br><br><span style="font-size:0.72rem;color:var(--text-muted)">If this is a text document, try uploading a .txt or .docx version instead.</span>';
  } else if (_docwCoverText && cap <= 100) {
    w.style.display = "";
    w.innerHTML =
      "<strong>⚠ Low capacity</strong><br>The extracted text (" +
      _docwCoverText.length +
      " chars, ~" +
      cap +
      " capacity) is too short for most messages. Consider using <b>Pixel Injection</b> or <b>Watermark</b> tools for image-based documents.";
  } else {
    w.style.display = "none";
  }
}

/**
 *
 */
function docwAlgoChanged() {
  if (_docwCoverText) {
    const cap = docwEstimateCapacity(
      _docwCoverText,
      parseInt(document.getElementById("docw-algo").value),
    );
    const el = document.getElementById("docw-capacity");
    if (cap > 0) {
      el.textContent = __(
        "docw.capacity_estimate",
        "Estimated capacity: ~{bytes} bytes",
      ).replace("{bytes}", cap);
      el.style.color = "var(--text-muted)";
    } else {
      el.textContent = __(
        "docw.text_too_short",
        "Text too short for this algorithm",
      );
      el.style.color = "#e74c3c";
    }
    _docwShowNoTextWarning(cap);
  }
}

/**
 *
 */
function docwExAlgoChanged() {
  if (_docwExtractText) {
    const cap = docwEstimateCapacity(
      _docwExtractText,
      parseInt(document.getElementById("docw-algo-ex").value),
    );
    const el = document.getElementById("docw-ex-capacity");
    if (cap > 0) {
      el.textContent = __(
        "docw.capacity_estimate",
        "Estimated capacity: ~{bytes} bytes",
      ).replace("{bytes}", cap);
      el.style.color = "var(--text-muted)";
    } else {
      el.textContent = "";
    }
  }
}

/**
 *
 * @param parsed
 */
function _formatFingerprint(parsed) {
  var lines = [];
  if (parsed.file_info) {
    const fi = parsed.file_info;
    const dims = fi.width && fi.height ? " " + fi.width + "x" + fi.height : "";
    lines.push(
      "File: " +
        (fi.file_name || "unknown") +
        dims +
        " (" +
        (fi.file_size_bytes || "?") +
        " bytes)",
    );
  }
  if (parsed.hashes) {
    const hashKeys = Object.keys(parsed.hashes).sort();
    for (let i = 0; i < hashKeys.length; i++) {
      lines.push(hashKeys[i] + ": " + parsed.hashes[hashKeys[i]]);
    }
  }
  if (parsed.perceptual_hashes) {
    const phKeys = Object.keys(parsed.perceptual_hashes).sort();
    for (let j = 0; j < phKeys.length; j++) {
      lines.push(phKeys[j] + ": " + parsed.perceptual_hashes[phKeys[j]]);
    }
  }
  return lines.join("\n");
}

/**
 *
 * @param parsed
 */
function _formatFingerprintShort(parsed) {
  var count = 0;
  if (parsed.hashes) count += Object.keys(parsed.hashes).length;
  if (parsed.perceptual_hashes)
    count += Object.keys(parsed.perceptual_hashes).length;
  return count + " hashes";
}

/**
 *
 * @param event
 */
function loadDocwSecretFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (
    typeof validateFileInput === "function" &&
    !validateFileInput(event.target)
  )
    return;
  var ext = file.name.split(".").pop().toLowerCase();
  if (ext === "json") {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        _docwSecretData = parsed;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          (parsed.hashes || parsed.perceptual_hashes || parsed.file_info)
        ) {
          // Fingerprint JSON — store full formatted content
          _docwSecretMessage = _formatFingerprint(parsed);
          const shortDesc = _formatFingerprintShort(parsed);
          document.getElementById("docw-secret-name").textContent = __(
            "docw.loaded_fingerprint",
            "Loaded: {name} ({desc}, {len} chars)",
          )
            .replace("{name}", file.name)
            .replace("{desc}", shortDesc)
            .replace("{len}", _docwSecretMessage.length);
        } else if (typeof parsed === "string") {
          _docwSecretMessage = parsed;
          _docwSecretData = null;
          document.getElementById("docw-secret-name").textContent = __(
            "docw.loaded",
            "Loaded: {name} ({len} chars)",
          )
            .replace("{name}", file.name)
            .replace("{len}", parsed.length);
        } else {
          _docwSecretMessage = JSON.stringify(parsed, null, 2);
          _docwSecretData = null;
          document.getElementById("docw-secret-name").textContent = __(
            "docw.loaded",
            "Loaded: {name} ({len} chars)",
          )
            .replace("{name}", file.name)
            .replace("{len}", _docwSecretMessage.length);
        }
        document.getElementById("docw-secret-name").style.color = "#2ecc71";
      } catch (error) {
        alert("Invalid JSON file: " + error.message);
      }
    };
    reader.readAsText(file);
  } else {
    docwExtractText(file, function (err, text) {
      if (err) {
        alert(err);
        return;
      }
      _docwSecretMessage = text;
      _docwSecretData = null;
      document.getElementById("docw-secret-name").textContent = __(
        "docw.loaded",
        "Loaded: {name} ({len} chars)",
      )
        .replace("{name}", file.name)
        .replace("{len}", text.length);
      document.getElementById("docw-secret-name").style.color = "#2ecc71";
    });
  }
}

/**
 *
 * @param event
 */
function loadDocwCoverFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (
    typeof validateFileInput === "function" &&
    !validateFileInput(event.target)
  )
    return;
  _docwCoverFileName = file.name;
  var nameEl = document.getElementById("docw-cover-name");
  var capEl = document.getElementById("docw-capacity");
  document.getElementById("docw-cover-warning").style.display = "none";
  nameEl.textContent =
    file.name + " (" + __("docw.extracting", "extracting text\u2026") + ")";
  nameEl.style.color = "var(--text-muted)";
  capEl.textContent = "";
  showDocwLoading(
    __("docw.reading", "Reading {name}...").replace("{name}", file.name),
    0,
  );
  var reader = new FileReader();
  reader.onprogress = function (e) {
    if (e.lengthComputable) {
      showDocwLoading(
        __("docw.reading", "Reading {name}...").replace("{name}", file.name),
        Math.round((e.loaded / e.total) * 100),
      );
    }
  };
  reader.onload = function (e) {
    const buf = e.target.result;
    _docwCoverBytes = new Uint8Array(buf);
    showDocwLoading(
      __("docw.extracting_from", "Extracting text from {name}...").replace(
        "{name}",
        file.name,
      ),
    );
    setTimeout(function () {
      const ext = file.name.split(".").pop().toLowerCase();
      let textPromise;
      switch (ext) {
        case "docx": {
          textPromise = DOCX_EXTRACTOR.readDocx(buf);

          break;
        }
        case "pdf": {
          textPromise = DOCX_EXTRACTOR.readPdf(new Uint8Array(buf)).then(
            function (text) {
              return text || "";
            },
          );

          break;
        }
        case "doc": {
          const arr = new Uint8Array(buf);
          let result = "";
          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if (c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0x7e)) {
              result += String.fromCharCode(c);
            }
          }
          result = result.replace(/\s+/g, " ").trim();
          textPromise = Promise.resolve(
            result || "No readable text found in DOC file.",
          );

          break;
        }
        default: {
          textPromise = Promise.resolve(
            new TextDecoder("UTF-8").decode(new Uint8Array(buf)),
          );
        }
      }
      textPromise
        .then(function (text) {
          _docwCoverText = text;
          nameEl.textContent =
            file.name +
            " (" +
            text.length +
            " " +
            __("docw.chars", "chars") +
            ")";
          nameEl.style.color = "#2ecc71";
          const cap = docwEstimateCapacity(
            text,
            parseInt(document.getElementById("docw-algo").value),
          );
          if (cap > 0) {
            capEl.textContent = __(
              "docw.capacity_estimate",
              "Estimated capacity: ~{bytes} bytes",
            ).replace("{bytes}", cap);
            capEl.style.color = "var(--text-muted)";
          } else {
            capEl.textContent = __(
              "docw.text_too_short",
              "Text too short for this algorithm",
            );
            capEl.style.color = "#e74c3c";
          }
          _docwShowNoTextWarning(cap);
          hideDocwLoading();
        })
        .catch(function (error) {
          hideDocwLoading();
          alert(error.message || error);
          nameEl.textContent = "";
          capEl.textContent = "";
        });
    }, 50);
  };
  reader.readAsArrayBuffer(file);
}

/**
 *
 * @param event
 */
function loadDocwExtractFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  var nameEl = document.getElementById("docw-extract-name");
  var capEl = document.getElementById("docw-ex-capacity");
  nameEl.textContent =
    file.name + " (" + __("docw.extracting", "extracting text\u2026") + ")";
  nameEl.style.color = "var(--text-muted)";
  capEl.textContent = "";
  showDocwLoading(
    __("docw.reading", "Reading {name}...").replace("{name}", file.name),
    0,
  );
  var reader = new FileReader();
  reader.onprogress = function (e) {
    if (e.lengthComputable) {
      showDocwLoading(
        __("docw.reading", "Reading {name}...").replace("{name}", file.name),
        Math.round((e.loaded / e.total) * 100),
      );
    }
  };
  reader.onload = function (e) {
    const buf = e.target.result;
    showDocwLoading(
      __("docw.extracting_from", "Extracting text from {name}...").replace(
        "{name}",
        file.name,
      ),
    );
    setTimeout(function () {
      docwExtractTextFromBuf(file, buf, function (err, text) {
        hideDocwLoading();
        if (err) {
          alert(err);
          return;
        }
        _docwExtractText = text;
        nameEl.textContent =
          file.name +
          " (" +
          text.length +
          " " +
          __("docw.chars", "chars") +
          ")";
        nameEl.style.color = "#2ecc71";
        const cap = docwEstimateCapacity(
          text,
          parseInt(document.getElementById("docw-algo-ex").value),
        );
        if (cap > 0) {
          capEl.textContent = __(
            "docw.capacity_estimate",
            "Estimated capacity: ~{bytes} bytes",
          ).replace("{bytes}", cap);
          capEl.style.color = "var(--text-muted)";
        } else {
          capEl.textContent = "";
        }
      });
    }, 50);
  };
  reader.readAsArrayBuffer(file);
}

/**
 *
 * @param file
 * @param buf
 * @param callback
 */
function docwExtractTextFromBuf(file, buf, callback) {
  var ext = file.name.split(".").pop().toLowerCase();
  switch (ext) {
    case "docx": {
      (async () => {
        try {
          const text = await DOCX_EXTRACTOR.readDocx(buf);
          callback(null, text, "docx");
        } catch (error) {
          callback(error.message);
        }
      })();

      break;
    }
    case "pdf": {
      (async () => {
        try {
          const text = await DOCX_EXTRACTOR.readPdf(new Uint8Array(buf));
          callback(null, text || "", "pdf");
        } catch (error) {
          callback("PDF extraction failed: " + error.message);
        }
      })();

      break;
    }
    case "doc": {
      const arr = new Uint8Array(buf);
      let result = "";
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0x7e)) {
          result += String.fromCharCode(c);
        }
      }
      result = result.replace(/\s+/g, " ").trim();
      callback(null, result || "No readable text found in DOC file.", "doc");

      break;
    }
    default: {
      callback(null, new TextDecoder("UTF-8").decode(new Uint8Array(buf)), ext);
    }
  }
}

/**
 *
 * @param data
 * @param password
 * @param coverText
 */
async function _buildPayloadForHomoglyph(data, password, coverText) {
  // Build ordered list of entries from fingerprint data
  var entries = [];
  if (data.file_info) {
    const fi = data.file_info;
    const dims = fi.width && fi.height ? " " + fi.width + "x" + fi.height : "";
    entries.push(
      "File: " +
        (fi.file_name || "unknown") +
        dims +
        " (" +
        (fi.file_size_bytes || "?") +
        " bytes)",
    );
  }
  if (data.hashes) {
    const priority = [
      "SHA-256",
      "SHA-384",
      "SHA-512",
      "SHA-3_512",
      "SHA-3_384",
      "SHA-3_256",
      "SHA-3_224",
      "SHA-1",
      "SHA-224",
      "BLAKE3",
      "BLAKE2b",
      "BLAKE2s",
      "MD5",
      "RIPEMD-160",
      "Whirlpool",
      "MD2",
      "MD4",
    ];
    const added = {};
    for (let p = 0; p < priority.length; p++) {
      const name = priority[p];
      if (data.hashes[name]) {
        entries.push(name + ": " + data.hashes[name]);
        added[name] = true;
      }
    }
    // Add any remaining hashes not in priority list
    const remaining = Object.keys(data.hashes).sort();
    for (let r = 0; r < remaining.length; r++) {
      if (!added[remaining[r]]) {
        entries.push(remaining[r] + ": " + data.hashes[remaining[r]]);
      }
    }
  }
  if (data.perceptual_hashes) {
    const phKeys = Object.keys(data.perceptual_hashes).sort();
    for (let q = 0; q < phKeys.length; q++) {
      entries.push(phKeys[q] + ": " + data.perceptual_hashes[phKeys[q]]);
    }
  }

  // Calculate max bits available
  DOCW_HOMOGLYPH._initReverse();
  var maxBits = 0;
  for (let i = 0; i < coverText.length; i++) {
    const ch = coverText[i];
    if (DOCW_HOMOGLYPH.MULTI_MAP[ch] !== undefined) maxBits += 2;
    else if (DOCW_HOMOGLYPH.MAP[ch] !== undefined) maxBits += 1;
  }
  if (maxBits <= 0) {
    throw new Error(
      "Cover text has no eligible characters for Unicode Homoglyphs",
    );
  }

  // Build payload incrementally — add complete entries while bits fit
  var payload = "";
  for (let e = 0; e < entries.length; e++) {
    const candidate = payload ? payload + "\n" + entries[e] : entries[e];
    const bits = await _msgToBits(candidate, password || "");
    if (bits && bits.length <= maxBits) {
      payload = candidate;
    } else {
      break;
    }
  }

  if (!payload) {
    // Even the first entry doesn't fit — try with just SHA-256 value (compact form)
    if (data.hashes && data.hashes["SHA-256"]) {
      const shaBits = await _msgToBits(data.hashes["SHA-256"], password || "");
      if (shaBits && shaBits.length <= maxBits) {
        return data.hashes["SHA-256"];
      }
    }
    const firstEntryBits = await _msgToBits(entries[0], password || "");
    throw new Error(
      "Text too short. Need ~" +
        Math.ceil(firstEntryBits.length / 8) +
        " bytes, eligible chars provide " +
        Math.floor(maxBits / 8) +
        " bytes",
    );
  }

  return payload;
}

/**
 *
 */
async function handleDocwEmbed() {
  var algo = parseInt(document.getElementById("docw-algo").value);
  var password = document.getElementById("docw-password").value;

  if (!_docwSecretMessage) {
    alert("Please upload a secret message file.");
    return;
  }
  if (!_docwCoverText) {
    alert("Please upload a cover document.");
    return;
  }
  if (!password) {
    alert("Password is required for embedding.");
    return;
  }

  var btn = document.getElementById("docw-embed-btn");
  btn.textContent = "Processing...";
  btn.disabled = true;
  showDocwLoading("Embedding watermark\u2026");
  // Yield so the browser paints the overlay before heavy embedding starts
  await new Promise(function (r) {
    setTimeout(r, 0);
  });

  try {
    // Build payload based on algorithm
    let message;
    message =
      algo === 2 && _docwSecretData && _docwSecretData.hashes
        ? await _buildPayloadForHomoglyph(
            _docwSecretData,
            password,
            _docwCoverText,
          )
        : _docwSecretMessage;
    const result = await docwEmbed(_docwCoverText, message, algo, password);
    showDocwLoading("Building download\u2026");
    // Compute SHA-256 of the original cover text for the certificate
    let hash = "";
    try {
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const enc = new TextEncoder().encode(_docwCoverText);
        const hb = await crypto.subtle.digest("SHA-256", enc);
        const harr = new Uint8Array(hb);
        for (let hi = 0; hi < harr.length; hi++)
          hash += ("0" + harr[hi].toString(16)).slice(-2);
        hash = "SHA-256:" + hash;
      }
      /* c8 ignore next */
    } catch {
      /* fallback: hash stays empty */
    }
    const algoName = DOCW_ALGOS[String(algo)].name;
    _docwResult = {
      algo: algoName,
      algoId: algo,
      message: message,
      hash: hash,
      timestamp: new Date().toISOString(),
      textLength: _docwCoverText.length,
      resultLength: result.length,
      watermarkedText: result,
    };
    document.getElementById("docw-embed-output").value =
      _docwBuildCertificateText(_docwResult);
    document.getElementById("docw-embed-result").style.display = "";
    document.getElementById("docw-embed-buttons").style.display = "";
    document.getElementById("docw-embed-algo-name").textContent = algoName;
    setDownloadHandler(downloadDocw);

    // Direct download: actual watermarked document (rebuilt in original format)
    const dlContainer = document.getElementById("docw-embed-download");
    const ext = _docwCoverFileName.split(".").pop().toLowerCase();
    const safeDocwFileName = escHtml(_docwCoverFileName);
    const safeDocwFileNameTxt = escHtml(
      _docwCoverFileName.replace(/\.[^.]+$/, ".txt"),
    );
    if (ext === "docx") {
      try {
        const rebuiltBlob = await buildWatermarkedDocx(_docwCoverBytes, result);
        const outUrl = URL.createObjectURL(rebuiltBlob);
        dlContainer.innerHTML =
          '<a href="' +
          outUrl +
          '" download="watermarked_' +
          safeDocwFileName +
          '" class="btn">' +
          __("docw.direct_download", "Download Watermarked Document") +
          " (DOCX)</a>";
      } catch {
        const txtBlob = new Blob([result], {
          type: "text/plain;charset=utf-8",
        });
        const outUrl = URL.createObjectURL(txtBlob);
        dlContainer.innerHTML =
          '<a href="' +
          outUrl +
          '" download="watermarked_' +
          safeDocwFileNameTxt +
          '" class="btn">' +
          __("docw.direct_download", "Download Watermarked Document") +
          " (TXT)</a>";
      }
    } else if (ext === "pdf") {
      // Modify original PDF — replace extracted text with watermarked text
      try {
        const modifiedBytes = await buildWatermarkedPdfDoc(
          _docwCoverBytes,
          _docwCoverText,
          result,
        );
        const pdfBlob = new Blob([modifiedBytes], { type: "application/pdf" });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        dlContainer.innerHTML =
          '<a href="' +
          pdfUrl +
          '" download="watermarked_' +
          safeDocwFileName +
          '" class="btn">' +
          __("docw.direct_download", "Download Watermarked Document") +
          " (PDF)</a>";
      } catch {
        const txtBlob = new Blob([result], {
          type: "text/plain;charset=utf-8",
        });
        const outUrl = URL.createObjectURL(txtBlob);
        dlContainer.innerHTML =
          '<a href="' +
          outUrl +
          '" download="watermarked_' +
          safeDocwFileNameTxt +
          '" class="btn">' +
          __("docw.direct_download", "Download Watermarked Document") +
          " (TXT — " +
          __("docw.pdf_failed", "PDF rebuild failed") +
          ")</a>";
      }
    } else {
      const txtBlob = new Blob([result], { type: "text/plain;charset=utf-8" });
      const outUrl = URL.createObjectURL(txtBlob);
      dlContainer.innerHTML =
        '<a href="' +
        outUrl +
        '" download="watermarked_' +
        safeDocwFileNameTxt +
        '" class="btn">' +
        __("docw.direct_download", "Download Watermarked Document") +
        " (TXT)</a>";
    }
  } catch (error) {
    hideDocwLoading();
    alert("Error: " + error.message);
  }

  hideDocwLoading();
  btn.textContent = __("docw.embed_submit", "Embed Watermark");
  btn.disabled = false;
}

/**
 *
 */
async function handleDocwExtract() {
  var algo = parseInt(document.getElementById("docw-algo-ex").value);
  var password = document.getElementById("docw-password-ex").value;

  if (!_docwExtractText) {
    alert("Please upload a watermarked document.");
    return;
  }
  if (!password) {
    alert("Password is required for extraction.");
    return;
  }

  var btn = document.getElementById("docw-extract-btn");
  btn.textContent = "Extracting...";
  btn.disabled = true;

  try {
    let result;
    let algoName;
    if (algo === 0) {
      const detected = await docwAutoDetect(_docwExtractText, password);
      if (detected) {
        result = detected.message;
        algoName = detected.name + " (auto-detected)";
      } else {
        document.getElementById("docw-extract-result").style.display = "";
        document.getElementById("docw-extract-buttons").style.display = "none";
        document.getElementById("docw-extracted-msg").value = "";
        document.getElementById("docw-extract-algo-name").textContent =
          "No watermark found";
        btn.textContent = "Extract Watermark";
        btn.disabled = false;
        return;
      }
    } else {
      result = await docwExtract(_docwExtractText, algo, password);
      algoName = DOCW_ALGOS[String(algo)].name;
      // Fallback for PDFs with duplicate text (original + appended watermark)
      if (!result && _docwExtractText.length > 200) {
        const halfLen = Math.ceil(_docwExtractText.length / 2);
        const portions = [
          _docwExtractText.substring(0, halfLen),
          _docwExtractText.substring(_docwExtractText.length - halfLen),
        ];
        for (let pi = 0; !result && pi < portions.length; pi++) {
          try {
            result = await docwExtract(portions[pi], algo, password);
            /* c8 ignore next */
          } catch {
            /* ignore */
          }
        }
      }
    }

    document.getElementById("docw-extract-result").style.display = "";
    document.getElementById("docw-extract-buttons").style.display = "";
    document.getElementById("docw-extracted-msg").value =
      result || __("docw.no_watermark", "No watermark found");
    document.getElementById("docw-extract-algo-name").textContent = algoName;
    _docwExtractResult = {
      message: result,
      algo: algoName,
      algoId: algo,
      timestamp: new Date().toISOString(),
    };
    setDownloadHandler(downloadDocwExtract);
  } catch (error) {
    if (error.message === "WRONG_PASSWORD") {
      document.getElementById("docw-extract-result").style.display = "";
      document.getElementById("docw-extract-buttons").style.display = "none";
      document.getElementById("docw-extracted-msg").value = "";
      document.getElementById("docw-extract-algo-name").textContent = __(
        "docw.wrong_password",
        "Password may be incorrect",
      );
    } else {
      alert("Error: " + error.message);
    }
  }

  btn.textContent = __("docw.extract_submit", "Extract Watermark");
  btn.disabled = false;
}

/**
 *
 * @param id
 */
function docwCopyResult(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.select();
  document.execCommand("copy");
}

/**
 *
 * @param id
 * @param filename
 */
function docwDownloadResult(id, filename) {
  var el = document.getElementById(id);
  if (!el) return;
  var blob = new Blob([el.value], { type: "text/plain;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename || "document_watermarked.txt";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Rebuild original document with watermarked text (preserves ZWC) ──

/**
 *
 * @param originalBytes
 * @param watermarkedText
 */
async function buildWatermarkedDocx(originalBytes, watermarkedText) {
  var zip = await JSZip.loadAsync(originalBytes);
  var xml = await zip.file("word/document.xml").async("string");
  var runCount = 0;
  xml = xml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, function (match, content) {
    runCount++;
    if (runCount === 1) {
      return match.replace(content, _docwEscXml(watermarkedText));
    }
    return match.replace(content, "");
  });
  zip.file("word/document.xml", xml);
  return await zip.generateAsync({ type: "blob" });
}

// ── Multi-format download for extraction result ──

/**
 *
 * @param format
 */
async function downloadDocwExtract(format) {
  closeDownloadModal();
  var r = _docwExtractResult;
  if (!r) return;

  if (format === "pdf") {
    const blob = await _docwBuildReportPdf(r, "extract");
    downloadBlobSimple(blob, "extracted_message_report.pdf");
    return;
  }

  if (format === "doc") {
    const blob = await _docwBuildReportDocx(r, "extract");
    downloadBlobSimple(blob, "extracted_message_report.docx");
    return;
  }

  var content, ext, mime;
  switch (format) {
    case "json": {
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    }
    case "csv": {
      const escCsv = function (v) {
        return String(v || "")
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replace(/"/g, '""');
      };
      content =
        '"Key","Value"\n' +
        '"message","' +
        escCsv(r.message) +
        '"\n"algo","' +
        escCsv(r.algo) +
        '"\n"timestamp","' +
        escCsv(r.timestamp) +
        '"';
      ext = "csv";
      mime = "text/csv";
      break;
    }
    case "txt": {
      content = r.message || "";
      ext = "txt";
      mime = "text/plain";
      break;
    }
    case "xml": {
      content =
        '<?xml version="1.0"?>\n<extracted>\n  <message>' +
        _docwEscXml(r.message || "") +
        "</message>\n  <algo>" +
        _docwEscXml(r.algo || "") +
        "</algo>\n  <timestamp>" +
        _docwEscXml(r.timestamp || "") +
        "</timestamp>\n</extracted>";
      ext = "xml";
      mime = "application/xml";
      break;
    }
    case "html": {
      content = _docwBuildReportHtml(r, "extract");
      ext = "html";
      mime = "text/html";
      break;
    }
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, "extracted_message." + ext);
}
