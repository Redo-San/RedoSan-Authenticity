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

/* global simpleFile: writable, simpleType: writable, simpleBuf: writable, simpleSteps: writable, simpleStep: writable, simpleIsAI: writable, simpleUserInfo: writable */

/**
 *
 */
function toggleArtistFields() {
  var cb = document.querySelector("#sinfo-isArtist");
  var fields = document.querySelector("#sinfo-artist-fields");
  if (fields) fields.style.display = cb && cb.checked ? "" : "none";
}

/**
 *
 */
function saveSimpleUserInfo() {
  simpleUserInfo.name =
    (document.querySelector("#sinfo-name") || {}).value || "";
  simpleUserInfo.email =
    (document.querySelector("#sinfo-email") || {}).value || "";
  simpleUserInfo.phoneCode =
    (document.querySelector("#sinfo-phonecode") || {}).value || "";
  var phone = (document.querySelector("#sinfo-phone") || {}).value || "";
  simpleUserInfo.phone = phone.replaceAll(/\D/g, "").slice(0, 15);
  simpleUserInfo.website =
    (document.querySelector("#sinfo-website") || {}).value || "";
  simpleUserInfo.social = {
    tiktok: (document.querySelector("#sinfo-tiktok") || {}).value || "",
    facebook: (document.querySelector("#sinfo-facebook") || {}).value || "",
    instagram: (document.querySelector("#sinfo-instagram") || {}).value || "",
    youtube: (document.querySelector("#sinfo-youtube") || {}).value || "",
  };
  var cb = document.querySelector("#sinfo-isArtist");
  simpleUserInfo.isArtist = cb ? cb.checked : false;
  simpleUserInfo.music = {
    spotify: (document.querySelector("#sinfo-spotify") || {}).value || "",
    appleMusic: (document.querySelector("#sinfo-applemusic") || {}).value || "",
    youtubeMusic: (document.querySelector("#sinfo-ytmusic") || {}).value || "",
    soundcloud: (document.querySelector("#sinfo-soundcloud") || {}).value || "",
    bandcamp: (document.querySelector("#sinfo-bandcamp") || {}).value || "",
  };
}

/**
 *
 */
function setupSimpleDropZone() {
  var dz = document.querySelector("#simpleDropZone");
  if (!dz) return;
  dz.addEventListener("dragover", function (e) {
    e.preventDefault();
    dz.classList.add("drag-over");
  });
  dz.addEventListener("dragleave", function () {
    dz.classList.remove("drag-over");
  });
  dz.addEventListener("drop", function (e) {
    e.preventDefault();
    dz.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0)
      simpleFileSelected({ files: e.dataTransfer.files });
  });
}

/**
 *
 * @param type
 */
function getSimpleTypeLabel(type) {
  var labels = {
    image: __("simple.type_image", "image"),
    audio: __("simple.type_audio", "audio"),
    video: __("simple.type_video", "video"),
    document: __("simple.type_document", "document"),
    other: __("simple.type_other", "other"),
  };
  return labels[type] || type;
}

/**
 *
 */
function restoreUploadFileInfo() {
  var dz = document.querySelector("#simpleDropZone");
  var info = document.querySelector("#simpleFileInfo");
  if (!dz || !info || !simpleFile) return;
  dz.classList.add("has-file");
  var icon =
    { image: "🖼️", audio: "🎵", video: "🎬", document: "📄", other: "📁" }[
      simpleType
    ] || "📁";
  info.innerHTML =
    '<div class="simple-file-info"><span class="simple-file-icon">' +
    icon +
    "</span>" +
    "<div><strong>" +
    escapeHtml(simpleFile.name) +
    "</strong><br>" +
    formatSize(simpleFile.size) +
    ' <span class="badge badge-muted">' +
    getSimpleTypeLabel(simpleType) +
    "</span></div></div>";
}

/**
 *
 * @param input
 */
async function simpleFileSelected(input) {
  var file = input.files ? input.files[0] : input;
  if (!file) return;
  if (isDangerousFile(file)) {
    alert(
      __(
        "shared.dangerous_file",
        "This file type is not allowed for security reasons.",
      ),
    );
    if (input && input.tagName === "INPUT") {
      input.value = "";
    }
    return;
  }
  if (!isEnglishFilename(file.name)) {
    alert(
      __(
        "shared.english_filename",
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
      ) ||
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
    );
    if (input && input.tagName === "INPUT") {
      try {
        input.value = "";
      } catch {}
    }
    return;
  }
  var acceptEl = document.querySelector("#simpleFileInput");
  if (
    acceptEl &&
    acceptEl.getAttribute("accept") &&
    !matchesAccept(file, acceptEl.getAttribute("accept"))
  ) {
    alert(
      __("shared.wrong_type", "Please select a valid file type for this tool."),
    );
    if (input && input.tagName === "INPUT") {
      input.value = "";
    }
    return;
  }
  var magicOk = await matchesMagicBytes(file);
  if (!magicOk) {
    alert(
      __(
        "shared.corrupt_file",
        "This file appears to be corrupted or has an incorrect format.",
      ) || "This file appears to be corrupted or has an incorrect format.",
    );
    if (input && input.tagName === "INPUT") {
      try {
        input.value = "";
      } catch {}
    }
    return;
  }
  var dangerous = await checkDangerousContent(file);
  if (dangerous) {
    alert(
      __(
        "shared.dangerous_content",
        "This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.",
      ) ||
        "This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.",
    );
    if (input && input.tagName === "INPUT") {
      try {
        input.value = "";
      } catch {}
    }
    return;
  }
  var structOk = await checkFileStructure(file);
  if (!structOk) {
    alert(
      __(
        "shared.bad_structure",
        "This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.",
      ) ||
        "This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.",
    );
    if (input && input.tagName === "INPUT") {
      try {
        input.value = "";
      } catch {}
    }
    return;
  }
  simpleFile = file;
  var type = detectFileType(file);
  var dz = document.querySelector("#simpleDropZone");
  var info = document.querySelector("#simpleFileInfo");
  dz.classList.add("has-file");
  var icon =
    { image: "🖼️", audio: "🎵", video: "🎬", document: "📄", other: "📁" }[
      type
    ] || "📁";
  info.innerHTML =
    '<div class="simple-file-info"><span class="simple-file-icon">' +
    icon +
    "</span>" +
    "<div><strong>" +
    escapeHtml(file.name) +
    "</strong><br>" +
    formatSize(file.size) +
    ' <span class="badge badge-muted">' +
    getSimpleTypeLabel(type) +
    "</span></div></div>";
  simpleType = type;
  // Read file buffer
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    simpleBuf = e.target.result;
  });
  reader.readAsArrayBuffer(file);
  // Rebuild steps based on type
  simpleSteps = type === "image" ? [
      { id: "upload", label: __("simple.step_upload", "Upload") },
      { id: "ai-question", label: __("simple.step_type", "Type") },
    ] : buildSteps(type, false);
  // Reset step position
  simpleStep = 0;
  renderStep();
}

/**
 *
 * @param isAI
 */
function chooseAi(isAI) {
  simpleIsAI = isAI;
  simpleSteps = buildSteps("image", isAI);
  simpleStep = simpleSteps.findIndex(function (s) {
    return s.id === "fingerprint";
  });
  renderStep();
}

// Build combined fingerprint + DID payload, trimmed to fit maxBytes
/**
 *
 * @param fpResult
 * @param didSig
 * @param maxBytes
 */
function buildCombinedPayload(fpResult, didSig, maxBytes) {
  var didStr = "";
  if (didSig) {
    didStr = "\n---DIDSIG---\n" + JSON.stringify(didSig);
  }
  var didBytes = new TextEncoder().encode(didStr).length;
  var fpMaxBytes = maxBytes - didBytes;
  if (fpMaxBytes < 100) fpMaxBytes = 100;
  if (fpResult && typeof trimFingerprintPayload === "function") {
    var trimmed = trimFingerprintPayload(fpResult, fpMaxBytes);
    var combined = JSON.stringify(trimmed) + didStr;
    // If combined exceeds maxBytes even after trimming, drop DID
    if (new TextEncoder().encode(combined).length > maxBytes && didStr) {
      combined = JSON.stringify(trimmed);
    }
    return combined;
  }
  var fpText = "";
  if (fpResult) {
    fpText =
      typeof fpResult === "string"
        ? fpResult
        : JSON.stringify(fpResult, null, 2);
  }
  var available = maxBytes - didBytes;
  if (available < 50) available = 50;
  fpText = fpText.substring(0, available);
  combined = fpText + didStr;
  if (new TextEncoder().encode(combined).length > maxBytes && didStr) {
    combined = fpText;
  }
  return combined;
}

/**
 *
 * @param cats
 * @param cat
 */
function getPiAlgoOptions(cats, cat) {
  var algos = cats[cat] || {};
  var keys = Object.keys(algos);
  var opts = "";
  for (const key of keys) {
    var algo = algos[key];
    opts +=
      '<option value="' + key + '">' + (algo.name || key) + "</option>";
  }
  return opts;
}

/**
 *
 */
function updateSpiAlgorithms() {
  var sel = document.querySelector("#spi-category");
  var algoSel = document.querySelector("#spi-algorithm");
  if (!sel || !algoSel) return;
  var cats = globalThis.pixelInjection && globalThis.pixelInjection.algorithms;
  if (!cats) return;
  algoSel.innerHTML = getPiAlgoOptions(cats, sel.value);
}

/**
 *
 * @param dataUrl
 */
function dataUrlToBlob(dataUrl) {
  try {
    var parts = dataUrl.split(",");
    var mime = parts[0].match(/:(.*?);/)[1];
    var raw = atob(parts[1]);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 *
 */
function setupFpDownload() {
  setDownloadHandler(downloadFingerprint);
  document.querySelector("#dl-modal-title").textContent = __("dl.title");
  if (simpleResults.fpResult)
    setResult('fpResult', simpleResults.fpResult);
}

/**
 *
 */
function setupDidDownload() {
  setDownloadHandler(downloadDID);
  document.querySelector("#dl-modal-title").textContent =
    __("dl.title", "Download") + " — DID";
}

/**
 *
 */
function toggleSimpleLangDropdown() {
  var menu = document.querySelector("#simpleLangMenu");
  if (menu) menu.classList.toggle("show");
}

/**
 *
 */
function toggleModeLangDropdown() {
  var menu = document.querySelector("#modeLangMenu");
  if (menu) menu.classList.toggle("show");
}

/**
 *
 * @param s
 */
function escapeHtml(s) {
  var div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/**
 *
 * @param bytes
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1_048_576).toFixed(1) + " MB";
}
