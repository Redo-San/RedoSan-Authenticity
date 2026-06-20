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
// ── Digital Passport / Certificate Generator ──
// Generates PDF, DOCX, EPUB with all results + QR verification



/**
 *
 */
async function collectCertData() {
  await new Promise(function (r) {
    setTimeout(r, 30);
  });
  var info = window.simpleUserInfo || {};
  var file = window.simpleFile;
  var buf = window.simpleBuf;
  var results = window.simpleResults || {};
  var data = {
    generatedAt: new Date().toISOString(),
    generator: "RedoSan Authenticity",
    user: {
      name: info.name || "",
      email: info.email || "",
      phone: info.phone || "",
      website: info.website || "",
      social: info.social || {},
      isArtist: !!info.isArtist,
      music: info.music || {},
    },
    file: {
      name: file ? file.name : "",
      size: file ? file.size : 0,
      type: file ? file.type : "",
    },
    watermark: !!results.watermark,
    watermarkUrl: results.watermarkUrl || null,
    watermarkAlgo: results.watermarkAlgoName || "",
    watermarkResult: results.watermarkResult || "",
    pixelInjection: !!results["pixel-injection"],
    piResultHtml: stripHtml(results.piResultHtml || ""),
    timestamp: !!results.timestamp,
    tsResult: results.tsResult || "",
    fingerprint: !!results.fingerprint,
    fpResult: results.fpResult || null,
    didSig: results.didSig || window._didSig || null,
    didIdentity:
      results.didIdentity || (window._didKeypair ? window._didKeypair.did : ""),
    ct: { submitted: false },
  };
  if (buf && file) {
    var dataUrl = bufToDataURL(buf, file.type);
    var dims = await loadImageDimensions(dataUrl);
    data.file.width = dims.width;
    data.file.height = dims.height;
    data.file.dataUrl = dataUrl;
    data.file.hash = await getFileHashSha256(buf);
  }
  // Submit ORIGINAL FILE to transparency log (fire-and-forget with 10s timeout)
  try {
    var fileData = buf || new Uint8Array();
    var ctPromise = submitCertTransparency(fileData);
    var timeoutPromise = new Promise(function (_, rej) {
      setTimeout(function () {
        rej(new Error("CT submission timed out"));
      }, 10_000);
    });
    var ctResult = await Promise.race([ctPromise, timeoutPromise]);
    ctResult.originalFileHash = data.file.hash || "";
    data.ct = ctResult;
  } catch (error) {
    data.ct = {
      submitted: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
  return data;
}



/**
 *
 * @param blob
 * @param format
 */
async function stampCertFile(blob, format) {
  try {
    var buf = await blob.arrayBuffer();
    var hashBuf = await crypto.subtle.digest("SHA-256", buf);
    var hashBytes = new Uint8Array(hashBuf);
    var hashHex = Array.from(hashBytes)
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
    var pendingB64 = generatePendingOts(hashHex);
    if (pendingB64) {
      setResult('certCtResult', {
        submitted: true,
        pending: true,
        otsProof: pendingB64,
        hash: hashHex,
        format: format,
        timestamp: new Date().toISOString(),
      });
      var certOtsBtn = document.getElementById("cert-ots-dl-btn");
      if (certOtsBtn) certOtsBtn.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Failed to stamp certificate file:", error);
  }
}

// ── Main download dispatcher ──

/**
 *
 * @param name
 */
function ensureLib(name) {
  return new Promise(function (resolve, reject) {
    if (name === "jspdf" && typeof jspdf !== "undefined") return resolve();
    if (name === "QRious" && typeof QRious !== "undefined") return resolve();
    if (name === "JSZip" && typeof JSZip !== "undefined") return resolve();
    // Static vendor script didn't load — try CDN fallbacks
    var urls;
    if (name === "jspdf")
      urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      ];
    else if (name === "QRious")
      urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js",
        "https://unpkg.com/qrious@4.0.2/dist/qrious.min.js",
        "https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js",
      ];
    else
      urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
        "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
      ];
    var idx = 0;
    /**
     *
     */
    function tryNext() {
      if (idx >= urls.length)
        return reject(
          new Error(
            "Library " +
              name +
              " not available (vendor + " +
              urls.length +
              " CDNs all failed)",
          ),
        );
      var s = document.createElement("script");
      s.src = urls[idx++];
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        setTimeout(tryNext, 1000);
      };
      document.head.append(s);
    }
    tryNext();
  });
}

// ── Loading overlay (CSS spinner survives sync freeze) ──
var _certOverlay = null;
/**
 *
 */
function showCertOverlay() {
  if (_certOverlay) return;
  var o = document.createElement("div");
  o.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999";
  o.innerHTML =
    '<div class="cert-spinner" style="border:5px solid rgba(255,255,255,0.2);border-top:5px solid #d32f2f;border-radius:50%;width:50px;height:50px;animation:certSpin 0.9s linear infinite"></div>' +
    '<div style="color:#fff;font:18px/1.4 sans-serif;margin-top:16px">Generating certificate…</div>' +
    '<div style="color:rgba(255,255,255,0.65);font:13px/1.4 sans-serif;margin-top:6px">Please wait, this may take up to 30 seconds</div>';
  document.body.append(o);
  _certOverlay = o;
  if (!document.getElementById("cert-spin-style")) {
    var s = document.createElement("style");
    s.id = "cert-spin-style";
    s.textContent = "@keyframes certSpin{to{transform:rotate(360deg)}}";
    document.head.append(s);
  }
}
/**
 *
 */
function hideCertOverlay() {
  if (_certOverlay) {
    _certOverlay.remove();
    _certOverlay = null;
  }
}

/**
 *
 */
function downloadCertOtsProof() {
  var ct = getResult('certCtResult');
  if (!ct || !ct.otsProof) return;
  try {
    var bytes = Uint8Array.from(atob(ct.otsProof), function (c) {
      return c.charCodeAt(0);
    });
    var blob = new Blob([bytes], { type: "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "RedoSan_Digital_Passport." + (ct.format || "pdf") + ".ots";
    document.body.append(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error("Failed to download cert .ots proof:", error);
  }
}

/**
 *
 */
function downloadOtsProof() {
  var ct = getResult('lastCtResult');
  if (!ct || !ct.otsProof) return;
  try {
    var bytes = Uint8Array.from(atob(ct.otsProof), function (c) {
      return c.charCodeAt(0);
    });
    var blob = new Blob([bytes], { type: "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "RedoSan_Digital_Passport.ots";
    document.body.append(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error("Failed to download .ots proof:", error);
  }
}

/**
 *
 * @param format
 * @param btn
 */
async function downloadCert(format, btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating...";
  }
  await new Promise(function (r) {
    setTimeout(r, 30);
  });
  showCertOverlay();
  try {
    var data = await collectCertData();
    var certBlob;
    if (format === "pdf") {
      await ensureLib("jspdf");
      certBlob = await downloadCertPDF(data);
    } else if (format === "docx" || format === "epub") {
      await ensureLib("QRious");
      if (format === "docx") certBlob = await downloadCertDOCX(data);
      else {
        await ensureLib("JSZip");
        certBlob = await downloadCertEPUB(data);
      }
    }
    // Stamp the certificate file itself
    if (certBlob) {
      stampCertFile(certBlob, format);
    }
    setResult('lastCtResult', (data && data.ct) ? data.ct : null);
    if (data.ct && data.ct.otsProof) {
      var otsBtn = document.getElementById("ots-dl-btn");
      if (otsBtn) otsBtn.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Certificate generation failed:", error);
    alert("Failed to generate certificate: " + error.message);
  }
  hideCertOverlay();
  if (btn) {
    btn.disabled = false;
    btn.textContent = format.toUpperCase();
  }
}

// ── Professional Mode Certificate ──

var _certData = null;

/**
 *
 * @param id
 */
function getValOrEmpty(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

/**
 *
 * @param id
 */
function getUrlOrEmpty(id) {
  var val = getValOrEmpty(id);
  return val || "";
}

/**
 *
 */
async function generateProfessionalCert() {
  var btn = document.getElementById("cert-gen-btn");
  var spinner = document.getElementById("cert-spinner");
  var status = document.getElementById("cert-status");
  var dlSection = document.getElementById("cert-download-section");
  if (spinner) spinner.style.display = "block";
  if (status) status.textContent = "Generating certificate...";
  if (btn) btn.disabled = true;

  try {
    var fileInput = document.getElementById("cert-file");
    var file =
      fileInput && fileInput.files && fileInput.files[0]
        ? fileInput.files[0]
        : null;
    var buf = null;
    if (file) {
      buf = await file.arrayBuffer();
    }

    /**
     *
     * @param id
     */
    function getFileFrom(id) {
      var el = document.getElementById(id);
      return el && el.files && el.files[0] ? el.files[0] : null;
    }

    /**
     *
     * @param f
     */
    async function readFileAsText(f) {
      if (!f) return "";
      return new Promise(function (resolve) {
        var r = new FileReader();
        r.onload = function (e) {
          resolve(e.target.result);
        };
        r.onerror = function () {
          resolve("");
        };
        r.readAsText(f);
      });
    }

    // Watermark: uploaded file only
    var wmFile = getFileFrom("cert-result-wm");
    var wmText = wmFile ? await readFileAsText(wmFile) : "";
    var wmFileName = wmFile ? wmFile.name : "";

    // PI: uploaded file only
    var piFile = getFileFrom("cert-result-pi");
    var piText = piFile ? await readFileAsText(piFile) : "";
    var piFileName = piFile ? piFile.name : "";

    // Fingerprint: uploaded file only
    var fpFile = getFileFrom("cert-result-fp");
    var fpText = fpFile ? await readFileAsText(fpFile) : "";
    var fpResultData = null;
    if (fpText) {
      try {
        fpResultData = JSON.parse(fpText);
      } catch {
        fpResultData = { hashes: {}, perceptual_hashes: {}, raw: fpText };
        var fpLines = fpText.split("\n");
        var curSection = "";
        for (var fli = 0; fli < fpLines.length; fli++) {
          var line = fpLines[fli].trim();
          if (line.includes("--- Hashes ---")) {
            curSection = "hashes";
            continue;
          }
          if (line.includes("--- Perceptual Hashes ---")) {
            curSection = "phash";
            continue;
          }
          if (curSection === "hashes") {
            var hc = line.indexOf(":");
            if (hc > 0) {
              var hk = line.substring(0, hc).trim();
              var hv = line.substring(hc + 1).trim();
              if (hk && hv) fpResultData.hashes[hk] = hv;
            }
          }
          if (curSection === "phash") {
            var pc = line.indexOf(":");
            if (pc > 0) {
              var pk = line.substring(0, pc).trim();
              var pv = line.substring(pc + 1).trim();
              if (pk && pv) fpResultData.perceptual_hashes[pk] = pv;
            }
          }
        }
      }
    }

    // DID Identity: uploaded file only
    var didFile = getFileFrom("cert-result-did");
    var didText = didFile ? await readFileAsText(didFile) : "";
    var didUploadData = null;
    if (didText) {
      try {
        didUploadData = JSON.parse(didText);
      } catch {
        didUploadData = { raw: didText };
      }
    }

    // Document Watermark: uploaded file only
    var docwFile = getFileFrom("cert-result-docw");
    var docwText = docwFile ? await readFileAsText(docwFile) : "";
    var docwFileName = docwFile ? docwFile.name : "";

    // Timestamp: uploaded file only
    var tsFile = getFileFrom("cert-result-ts");
    var tsName = tsFile ? tsFile.name : "";
    var tsSize = tsFile ? tsFile.size : 0;

    // Validate required fields
    var cname = getValOrEmpty("cert-name");
    var cemail = getValOrEmpty("cert-email");
    var cphoneCode =
      (document.getElementById("cert-phonecode") || {}).value || "";
    var cphoneRaw = getValOrEmpty("cert-phone");
    var cphone = cphoneRaw.replace(/\D/g, "").slice(0, 15);
    var cwebsite = getValOrEmpty("cert-website");

    if (!cname || !cemail || !cphone || !cwebsite) {
      if (status)
        status.textContent =
          "Please fill in all required fields: Name, Email, Phone, Website.";
      if (spinner) spinner.style.display = "none";
      if (btn) btn.disabled = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
      var ew = document.getElementById("cert-email-warn");
      if (ew) ew.style.display = "block";
      if (status) status.textContent = "";
      if (spinner) spinner.style.display = "none";
      if (btn) btn.disabled = false;
      return;
    }
    if (
      cwebsite === "https://" ||
      !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(cwebsite)
    ) {
      var ww = document.getElementById("cert-website-warn");
      if (ww) ww.style.display = "block";
      if (status) status.textContent = "";
      if (spinner) spinner.style.display = "none";
      if (btn) btn.disabled = false;
      return;
    }

    _certData = {
      generatedAt: new Date().toISOString(),
      generator: "RedoSan Authenticity",
      user: {
        name: cname,
        email: cemail,
        phoneCode: cphoneCode,
        phone: cphone,
        website: cwebsite,
        social: {
          tiktok: getUrlOrEmpty("cert-social-tiktok"),
          facebook: getUrlOrEmpty("cert-social-facebook"),
          instagram: getUrlOrEmpty("cert-social-instagram"),
          youtube: getUrlOrEmpty("cert-social-youtube"),
        },
        isArtist: false,
        music: {
          spotify: getUrlOrEmpty("cert-music-spotify"),
          appleMusic: getUrlOrEmpty("cert-music-applemusic"),
          youtubeMusic: getUrlOrEmpty("cert-music-ytmusic"),
          soundcloud: getUrlOrEmpty("cert-music-soundcloud"),
        },
      },
      file: {
        name: file ? file.name || "" : "",
        size: file ? file.size : 0,
        type: file ? file.type : "",
        width: 0,
        height: 0,
        dataUrl: null,
        hash: "",
      },
      watermark: !!(wmFile || wmGlobal),
      watermarkUrl: null,
      watermarkAlgo: wmFileName,
      watermarkResult: stripHtml(wmText),
      pixelInjection: !!(piFile || piGlobal),
      piResultHtml: stripHtml(piText),
      piFileDataUrl: null,
      timestamp: !!tsFile,
      tsResult: tsFile
        ? "Timestamp file: " + tsName + " (" + fmtSize(tsSize) + ")"
        : "",
      fingerprint: !!(fpFile || fpGlobal),
      fpResult: fpResultData,
      fpFileName: fpFile
        ? fpFile.name
        : fpGlobal
        ? fpGlobal.file_info
          ? fpGlobal.file_info.file_name
          : ""
        : "",
      documentWatermark: !!docwFile,
      documentWatermarkFileName: docwFileName,
      documentWatermarkResult: stripHtml(docwText),
      didSig:
        window._didSig ||
        (didUploadData && didUploadData.signature
          ? didUploadData.signature
          : null),
      didIdentity:
        (window._didKeypair ? window._didKeypair.did : "") ||
        (didUploadData ? didUploadData.did : ""),
      ct: { submitted: false },
    };
    // Submit ORIGINAL FILE to transparency log
    try {
      var fileData = buf || new Uint8Array();
      var ctPromise = submitCertTransparency(fileData);
      var ctTimeout = new Promise(function (_, rej) {
        setTimeout(function () {
          rej(new Error("CT submission timed out"));
        }, 10_000);
      });
      var ctResult = await Promise.race([ctPromise, ctTimeout]);
      ctResult.originalFileHash = _certData.file.hash || "";
      _certData.ct = ctResult;
    } catch (error) {
      _certData.ct = {
        submitted: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    // Main image dimensions + hash
    if (buf && file) {
      var dataUrl = bufToDataURL(buf, file.type);
      var dims = await loadImageDimensions(dataUrl);
      _certData.file.width = dims.width;
      _certData.file.height = dims.height;
      _certData.file.dataUrl = dataUrl;
      _certData.file.hash = await getFileHashSha256(buf);
    }

    if (status) status.textContent = "Certificate generated successfully!";
    if (dlSection) dlSection.style.display = "block";
  } catch (error) {
    console.error("Certificate generation failed:", error);
    if (status) status.textContent = "Error: " + error.message;
    alert("Failed to generate certificate: " + error.message);
  }

  if (spinner) spinner.style.display = "none";
  if (btn) btn.disabled = false;
}

/**
 *
 * @param format
 */
async function downloadProfessionalCert(format) {
  if (!_certData) {
    alert("Please generate the certificate first.");
    return;
  }
  var status = document.getElementById("cert-status");
  if (status) status.textContent = "Generating " + format.toUpperCase() + "...";
  var certBlob;
  try {
    switch (format) {
    case "pdf": {
      if (typeof jspdf === "undefined")
        throw new Error(
          "PDF library (jspdf) did not load. Try disabling ad blockers or check your internet connection.",
        );
      certBlob = await downloadCertPDF(_certData);
    
    break;
    }
    case "docx": {
      if (typeof QRious === "undefined")
        throw new Error(
          "QR library (QRious) did not load. Try disabling ad blockers or check your internet connection.",
        );
      certBlob = await downloadCertDOCX(_certData);
    
    break;
    }
    case "epub": { {
    certBlob = await downloadCertEPUB(_certData);
    // No default
    }
    break;
    }
    }
    if (certBlob) stampCertFile(certBlob, format);
    if (status)
      status.textContent = format.toUpperCase() + " downloaded successfully.";
  } catch (error) {
    console.error("Download failed:", error);
    if (status) status.textContent = "Error: " + error.message;
    alert("Failed to download: " + error.message);
  }
}

/**
 *
 */
function initCertPhoneCode() {
  var sel = document.getElementById("cert-phonecode");
  if (!sel) return;
  // Build options — same format as simplified mode (country code + dial)
  var html =
    '<option value="">—— ' +
    __("simple.select_country", "Select country") +
    " ——</option>";
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    var c = COUNTRY_CODES[i];
    html +=
      '<option value="' + c.dial + '">' + c.code + " " + c.dial + "</option>";
  }
  sel.innerHTML = html;
  // Auto-detect
  if (typeof getDefaultPhoneCode === "function") {
    var detected = getDefaultPhoneCode();
    if (detected) {
      sel.value = detected.dial;
    }
  }
  if (typeof updatePhoneMaxLength === "function") updatePhoneMaxLength();
}

/**
 *
 */
function toggleCertMusicFields() {
  var cb = document.getElementById("cert-show-music");
  var fields = document.getElementById("cert-music-fields");
  if (fields) fields.style.display = cb && cb.checked ? "" : "none";
}

/**
 *
 */
function resetProfessionalCert() {
  _certData = null;
  var ids = [
    "cert-file",
    "cert-name",
    "cert-email",
    "cert-phone",
    "cert-website",
    "cert-social-tiktok",
    "cert-social-facebook",
    "cert-social-instagram",
    "cert-social-youtube",
    "cert-music-spotify",
    "cert-music-applemusic",
    "cert-music-ytmusic",
    "cert-music-soundcloud",
    "cert-result-wm",
    "cert-result-pi",
    "cert-result-fp",
    "cert-result-ts",
    "cert-result-did",
    "cert-result-docw",
  ];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = "";
    }
  });
  var phonecode = document.getElementById("cert-phonecode");
  if (phonecode) {
    phonecode.value = "";
  }
  var showMusic = document.getElementById("cert-show-music");
  if (showMusic) {
    showMusic.checked = false;
  }
  var musicFields = document.getElementById("cert-music-fields");
  if (musicFields) musicFields.style.display = "none";
  var dlSection = document.getElementById("cert-download-section");
  if (dlSection) dlSection.style.display = "none";
  var status = document.getElementById("cert-status");
  if (status) status.textContent = "";
  // Re-init phone code detection
  initCertPhoneCode();
}

// Init phone code on DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCertPhoneCode);
  } else {
    initCertPhoneCode();
  }
}
