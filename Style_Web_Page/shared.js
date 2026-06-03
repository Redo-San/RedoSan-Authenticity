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
// ── Shared utilities used by all features ──

var BLOCKED_EXTS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".ps1",
  ".psm1",
  ".psd1",
  ".py",
  ".pyc",
  ".rb",
  ".pl",
  ".sh",
  ".bash",
  ".dll",
  ".sys",
  ".ocx",
  ".app",
  ".jar",
  ".msu",
  ".msp",
  ".reg",
  ".inf",
  ".gadget",
  ".cpl",
  ".mst",
  ".hta",
  ".ws",
  ".vb",
  ".vba",
  ".swf",
  ".action",
  ".epub",
  ".xps",
  ".oxps",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
];

function isDangerousFile(file) {
  var name = file.name.toLowerCase();
  for (var i = 0; i < BLOCKED_EXTS.length; i++) {
    if (name.endsWith(BLOCKED_EXTS[i])) return true;
  }
  return false;
}

var MAGIC_BYTES = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  ],
  "image/webp": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x57 ||
      buf[9] !== 0x45 ||
      buf[10] !== 0x42 ||
      buf[11] !== 0x50
    )
      return false;
    return true;
  },
  "image/bmp": [[0x42, 0x4d]],
  "image/tiff": [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
  "image/svg+xml": function (buf) {
    var s = String.fromCharCode.apply(null, buf.slice(0, 50)).toLowerCase();
    return s.indexOf("<svg") !== -1 || s.indexOf("<?xml") !== -1;
  },
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  "audio/mpeg": [
    [0x49, 0x44, 0x33],
    [0xff, 0xfb],
    [0xff, 0xf3],
    [0xff, 0xf2],
  ],
  "audio/wav": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x57 ||
      buf[9] !== 0x41 ||
      buf[10] !== 0x56 ||
      buf[11] !== 0x45
    )
      return false;
    return true;
  },
  "audio/flac": [[0x66, 0x4c, 0x61, 0x43]],
  "audio/ogg": [[0x4f, 0x67, 0x67, 0x53]],
  "video/mp4": function (buf) {
    if (
      buf[4] !== 0x66 ||
      buf[5] !== 0x74 ||
      buf[6] !== 0x79 ||
      buf[7] !== 0x70
    )
      return false;
    return true;
  },
  "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]],
  "video/avi": function (buf) {
    if (
      buf[0] !== 0x52 ||
      buf[1] !== 0x49 ||
      buf[2] !== 0x46 ||
      buf[3] !== 0x46
    )
      return false;
    if (
      buf[8] !== 0x41 ||
      buf[9] !== 0x56 ||
      buf[10] !== 0x49 ||
      buf[11] !== 0x20
    )
      return false;
    return true;
  },
};

function matchesMagicBytes(file) {
  return new Promise(function (resolve) {
    var mime = file.type.toLowerCase();
    var expected = MAGIC_BYTES[mime];
    if (!expected) {
      resolve(true);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      if (typeof expected === "function") {
        resolve(expected(arr));
        return;
      }
      for (var m = 0; m < expected.length; m++) {
        var sig = expected[m];
        var match = true;
        for (var i = 0; i < sig.length; i++) {
          if (arr[i] !== sig[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file.slice(0, 64));
  });
}

var DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /(?:^|\s)on\w+\s*=\s*["']/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<\s*foreignObject[\s>]/i,
  /<!ENTITY\s+/i,
  /<!DOCTYPE\s+\w+\s+SYSTEM/i,
  /<\s*xi:include[\s>]/i,
  /<\s*xi:fallback[\s>]/i,
];

var DOC_THREAT_PATTERNS = [
  { pattern: /\/JavaScript[\s<]/i, label: "embedded JavaScript" },
  { pattern: /\/JS\s+\d+\s+0\s+R/i, label: "embedded JavaScript" },
  { pattern: /\/OpenAction[\s<]/i, label: "auto-execute action" },
  { pattern: /\/Launch[\s<]/i, label: "launch external app" },
  { pattern: /\/EmbeddedFiles[\s<]/i, label: "embedded file attachments" },
];

function hasDangerousContent(arr) {
  var dec = new TextDecoder("utf-8", { fatal: false });
  var s = dec.decode(arr.slice(0, 4096));
  for (var i = 0; i < DANGEROUS_PATTERNS.length; i++) {
    if (DANGEROUS_PATTERNS[i].test(s)) return true;
  }
  return false;
}

function checkDangerousContent(file) {
  return new Promise(function (resolve) {
    var reader = new FileReader();
    reader.onloadend = function () {
      resolve(hasDangerousContent(new Uint8Array(reader.result)));
    };
    reader.onerror = function () {
      resolve(false);
    };
    reader.readAsArrayBuffer(file.slice(0, 4096));
  });
}

function checkDocumentThreats(file) {
  return new Promise(function (resolve) {
    if (file.type !== "application/pdf") {
      resolve(true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      resolve(true);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      var dec = new TextDecoder("utf-8", { fatal: false });
      var s = dec.decode(arr);
      for (var i = 0; i < DOC_THREAT_PATTERNS.length; i++) {
        if (DOC_THREAT_PATTERNS[i].pattern.test(s)) {
          resolve(false);
          return;
        }
      }
      resolve(true);
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file);
  });
}

function checkFileStructure(file) {
  return new Promise(function (resolve) {
    var mime = file.type.toLowerCase();
    var size = file.size;
    if (size < 20) {
      resolve(true);
      return;
    }
    var tailSize = Math.min(100, size);
    var reader = new FileReader();
    reader.onloadend = function () {
      var arr = new Uint8Array(reader.result);
      var off = size - tailSize;
      if (mime === "image/png") {
        // Last 12 bytes must be IEND chunk: 0-length, "IEND", CRC
        if (tailSize < 12) {
          resolve(false);
          return;
        }
        var i = arr.length - 12;
        if (
          arr[i] !== 0 ||
          arr[i + 1] !== 0 ||
          arr[i + 2] !== 0 ||
          arr[i + 3] !== 0
        ) {
          resolve(false);
          return;
        }
        if (
          arr[i + 4] !== 0x49 ||
          arr[i + 5] !== 0x45 ||
          arr[i + 6] !== 0x4e ||
          arr[i + 7] !== 0x44
        ) {
          resolve(false);
          return;
        }
        resolve(true);
      } else if (mime === "image/jpeg") {
        // Last 2 bytes must be EOI marker FF D9
        if (tailSize < 2) {
          resolve(false);
          return;
        }
        if (arr[arr.length - 2] !== 0xff || arr[arr.length - 1] !== 0xd9)
          resolve(false);
        else resolve(true);
      } else if (mime === "image/gif") {
        // Last byte must be GIF trailer 0x3B
        if (arr[arr.length - 1] !== 0x3b) resolve(false);
        else resolve(true);
      } else if (mime === "image/webp") {
        resolve(true);
      } else {
        resolve(true);
      }
    };
    reader.onerror = function () {
      resolve(true);
    };
    reader.readAsArrayBuffer(file.slice(-tailSize));
  });
}

function matchesAccept(file, acceptAttr) {
  if (!acceptAttr) return true;
  var name = file.name.toLowerCase();
  var type = file.type.toLowerCase();
  var rules = acceptAttr.split(",");
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i].trim();
    if (r.endsWith("/*") && type.startsWith(r.split("/")[0] + "/")) return true;
    else if (r.indexOf("/") !== -1 && type === r) return true;
    else if (r.startsWith(".") && name.endsWith(r)) return true;
  }
  return false;
}

function isEnglishFilename(filename) {
  return /^[\x20-\x7E]+$/.test(filename);
}

function clearInputFiles(input) {
  try {
    input.value = "";
  } catch (e) {}
  if (input.files && input.files.length) {
    var dt = new DataTransfer();
    input.files = dt.files;
  }
}

// Magic signatures of dangerous file types (for files without extension)
var DANGEROUS_MAGIC = [
  { sig: [0x4d, 0x5a], name: "PE executable (exe/dll/sys)" },
  { sig: [0x7f, 0x45, 0x4c, 0x46], name: "ELF executable" },
  { sig: [0xca, 0xfe, 0xba, 0xbe], name: "Mach-O executable" },
  { sig: [0xfe, 0xed, 0xfa, 0xce], name: "Mach-O executable" },
  { sig: [0xce, 0xfa, 0xed, 0xfe], name: "Mach-O executable" },
  { sig: [0xcf, 0xfa, 0xed, 0xfe], name: "Mach-O x86_64" },
  { sig: [0x4d, 0x53, 0x43, 0x46], name: "CAB archive" },
];

function hasDangerousMagic(buf) {
  for (var i = 0; i < DANGEROUS_MAGIC.length; i++) {
    var sig = DANGEROUS_MAGIC[i].sig;
    var match = true;
    for (var j = 0; j < sig.length; j++) {
      if (buf[j] !== sig[j]) {
        match = false;
        break;
      }
    }
    if (match) return DANGEROUS_MAGIC[i].name;
  }
  // Check for shebang (#!) indicating a script
  if (buf[0] === 0x23 && buf[1] === 0x21) return "script with shebang";
  return null;
}

function fileHasExtension(file) {
  var name = file.name || "";
  var dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1;
}

function detectDangerousMagic(input) {
  return new Promise(function (resolve) {
    if (!input || !input.files || !input.files.length) {
      resolve(false);
      return;
    }
    var file = input.files[0];
    if (!file) {
      resolve(false);
      return;
    }
    var reader = new FileReader();
    reader.onloadend = function () {
      resolve(hasDangerousMagic(new Uint8Array(reader.result)));
    };
    reader.onerror = function () {
      resolve(false);
    };
    reader.readAsArrayBuffer(file.slice(0, 64));
  });
}

async function validateFileInput(input) {
  if (!input || !input.files || !input.files.length) return true;
  var file = input.files[0];
  if (!file) return true;
  if (isDangerousFile(file)) {
    alert(
      __(
        "shared.dangerous_file",
        "This file type is not allowed for security reasons.",
      ) || "This file type is not allowed for security reasons.",
    );
    clearInputFiles(input);
    return false;
  }
  if (!isEnglishFilename(file.name)) {
    alert(
      __(
        "shared.english_filename",
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
      ) ||
        "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
    );
    clearInputFiles(input);
    return false;
  }
  // Detect dangerous file types by magic bytes when file has no extension
  if (!fileHasExtension(file)) {
    var dangerDetected = await detectDangerousMagic(input);
    if (dangerDetected) {
      alert(
        __(
          "shared.dangerous_file",
          "This file type is not allowed for security reasons.",
        ) || "This file type is not allowed for security reasons.",
      );
      clearInputFiles(input);
      return false;
    }
  }
  var accept = input.getAttribute("accept");
  if (accept && !matchesAccept(file, accept)) {
    alert(
      __(
        "shared.wrong_type",
        "Please select a valid file type for this tool.",
      ) || "Please select a valid file type for this tool.",
    );
    clearInputFiles(input);
    return false;
  }
  var magicOk = await matchesMagicBytes(file);
  if (!magicOk) {
    alert(
      __(
        "shared.corrupt_file",
        "This file appears to be corrupted or has an incorrect format.",
      ) || "This file appears to be corrupted or has an incorrect format.",
    );
    clearInputFiles(input);
    return false;
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
    clearInputFiles(input);
    return false;
  }
  var docOk = await checkDocumentThreats(file);
  if (!docOk) {
    alert(
      __(
        "shared.dangerous_document",
        "This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.",
      ) ||
        "This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.",
    );
    clearInputFiles(input);
    return false;
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
    clearInputFiles(input);
    return false;
  }
  return true;
}

function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(msg, cls) {
  const el = document.getElementById("py-status");
  if (el) {
    el.textContent = msg;
    if (cls) el.className = "badge badge-" + cls;
  }
}
setStatus("Ready - JS mode", "success");

async function getFile(id) {
  var input = document.getElementById(id);
  if (input && input.files && input.files.length) {
    var file = input.files[0];
    if (isDangerousFile(file)) {
      alert(
        __(
          "shared.dangerous_file",
          "This file type is not allowed for security reasons.",
        ),
      );
      input.value = "";
      return null;
    }
    if (!isEnglishFilename(file.name)) {
      alert(
        __(
          "shared.english_filename",
          "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
        ) ||
          "File name must use English characters only (A-Z, 0-9, hyphens, underscores, dots). Please rename the file and try again.",
      );
      input.value = "";
      return null;
    }
    var accept = input.getAttribute("accept");
    if (accept && !matchesAccept(file, accept)) {
      alert(
        __(
          "shared.wrong_type",
          "Please select a valid file type for this tool.",
        ),
      );
      input.value = "";
      return null;
    }
    var magicOk = await matchesMagicBytes(file);
    if (!magicOk) {
      alert(
        __(
          "shared.corrupt_file",
          "This file appears to be corrupted or has an incorrect format.",
        ) || "This file appears to be corrupted or has an incorrect format.",
      );
      input.value = "";
      return null;
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
      input.value = "";
      return null;
    }
    var docOk = await checkDocumentThreats(file);
    if (!docOk) {
      alert(
        __(
          "shared.dangerous_document",
          "This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.",
        ) ||
          "This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.",
      );
      input.value = "";
      return null;
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
      input.value = "";
      return null;
    }
  }
  return input ? input.files[0] : undefined;
}
function getVal(id) {
  return document.getElementById(id).value;
}
function spinner(id, show) {
  document.getElementById(id).style.display = show ? "block" : "none";
}
function showResult(resultId, outputId, dlId) {
  document.getElementById(resultId).style.display = "block";
}
function setOutput(id, html) {
  document.getElementById(id).innerHTML = html;
}
function setText(id, text) {
  document.getElementById(id).textContent = text;
}
function __(key, fallback) {
  return (i18n && i18n.data && i18n.data[key]) || fallback || key;
}

function downloadBlobSimple(blob, fileName) {
  var url = URL.createObjectURL(blob);
  if (isInAppBrowser()) {
    var win = window.open(url, "_blank");
    if (!win || win.closed) {
      alert(
        __(
          "dl.inapp_alert",
          'Please open this page in Safari or Chrome to download files. Tap the browser menu (⋯) and select "Open in Browser".',
        ),
      );
      window.location.href = url;
    }
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30000);
    return;
  }
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function isInAppBrowser() {
  var ua = navigator.userAgent || "";
  var vendor = navigator.vendor || "";
  if (/TikTok|musical_ly/i.test(ua)) return true;
  if (/Instagram/i.test(ua) && !/Chrome|Safari/i.test(ua)) return true;
  if (/FBAN|FBAV|Facebook/i.test(ua)) return true;
  if (/wv|WebView/i.test(ua)) return true;
  if (/Line\//i.test(ua)) return true;
  return false;
}

function downloadBlob(blob, name, containerId) {
  const url = URL.createObjectURL(blob);
  const safe = escHtml(name);
  const attrSafe = escHtml(name);
  document.getElementById(containerId).innerHTML +=
    '<a href="' +
    url +
    '" download="' +
    attrSafe +
    '" class="btn" style="margin:4px">' +
    __("shared.download") +
    " " +
    safe +
    "</a> ";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      d.w = img.width;
      d.h = img.height;
      URL.revokeObjectURL(url);
      resolve({ canvas: c, ctx, imgData: d, w: img.width, h: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(__("shared.failed_load_image", "Failed to load image")));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mime) {
  return new Promise((r) => canvas.toBlob((b) => r(b), mime || "image/png"));
}

function getRGB(imgData) {
  const r = new Uint8Array(imgData.w * imgData.h * 3);
  for (let i = 0; i < imgData.w * imgData.h; i++) {
    r[i * 3] = imgData.data[i * 4];
    r[i * 3 + 1] = imgData.data[i * 4 + 1];
    r[i * 3 + 2] = imgData.data[i * 4 + 2];
  }
  return r;
}

async function sha256Hex(data) {
  const h = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pack32(v) {
  return new Uint8Array([
    (v >> 24) & 255,
    (v >> 16) & 255,
    (v >> 8) & 255,
    v & 255,
  ]);
}
function unpack32(b) {
  return ((b[0] << 24) >>> 0) | (b[1] << 16) | (b[2] << 8) | b[3];
}

// ── Theme Toggle ──
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  localStorage.setItem("redosan_theme", theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  setTheme(cur === "light" ? "dark" : "light");
}
function initTheme() {
  const saved = localStorage.getItem("redosan_theme");
  if (saved) {
    setTheme(saved);
    return;
  }
  setTheme(
    window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
  );
}

// ── File Drop Zones ──
function initDropZones() {
  document
    .querySelectorAll('.form-group input[type="file"]')
    .forEach((input) => {
      if (input.parentElement.classList.contains("file-drop-zone")) return;
      const dz = document.createElement("div");
      dz.className = "file-drop-zone";
      input.parentNode.insertBefore(dz, input);
      dz.appendChild(input);
      const icon = document.createElement("span");
      icon.className = "dz-icon";
      icon.textContent = "📁";
      dz.appendChild(icon);
      const text = document.createElement("div");
      text.className = "dz-text";
      text.innerHTML = "Drop file here or <strong>browse</strong>";
      dz.appendChild(text);
      const fileDiv = document.createElement("div");
      fileDiv.className = "dz-file";
      dz.appendChild(fileDiv);
      dz.addEventListener("click", (e) => {
        if (
          e.target === dz ||
          e.target.classList.contains("dz-icon") ||
          e.target.classList.contains("dz-text")
        )
          input.click();
      });
      async function updateFile() {
        if (input.files && input.files.length) {
          if (input.files[0] && !(await validateFileInput(input))) {
            clearInputFiles(input);
            fileDiv.textContent = "";
            dz.classList.remove("has-file");
            return;
          }
          dz.classList.add("has-file");
          fileDiv.textContent = "📄 " + input.files[0].name;
        } else {
          dz.classList.remove("has-file");
          fileDiv.textContent = "";
        }
      }
      input.addEventListener("change", updateFile);
      ["dragenter", "dragover"].forEach((evt) =>
        dz.addEventListener(evt, (e) => {
          e.preventDefault();
          dz.classList.add("drag-over");
        }),
      );
      ["dragleave", "drop"].forEach((evt) =>
        dz.addEventListener(evt, (e) => {
          e.preventDefault();
          dz.classList.remove("drag-over");
        }),
      );
      dz.addEventListener("drop", async (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
          const dt = new DataTransfer();
          for (const f of e.dataTransfer.files) dt.items.add(f);
          input.files = dt.files;
          if (input.files[0] && !(await validateFileInput(input))) {
            clearInputFiles(input);
            dz.classList.remove("has-file");
            fileDiv.textContent = "";
            return;
          }
          updateFile();
        }
      });
      if (input.files && input.files.length) updateFile();
    });
}
// ── Bot / Automation Detection (100% client-side) ──
var REDOSAN_BOT_CHECK = null;

function checkAutomation() {
  var score = 0,
    signals = [];
  try {
    if (navigator.webdriver === true) {
      score += 35;
      signals.push("webdriver");
    }
    if (window.callPhantom || window._phantom || window.__nightmare) {
      score += 50;
      signals.push("legacy_automation");
    }
    try {
      if (document.documentElement.getAttribute("webdriver") === "true") {
        score += 35;
        signals.push("webdriver_attr");
      }
    } catch (e) {}
    if (navigator.plugins && navigator.plugins.length === 0) {
      score += 10;
      signals.push("no_plugins");
    }
    if (!navigator.languages || navigator.languages.length <= 1) {
      score += 5;
      signals.push("few_languages");
    }
    var ua = (navigator.userAgent || "").toLowerCase();
    var plat = (navigator.platform || "").toLowerCase();
    if (
      (ua.includes("windows") &&
        (plat.includes("linux") ||
          plat.includes("x11") ||
          plat.includes("mac"))) ||
      (ua.includes("mac") &&
        (plat.includes("linux") || plat.includes("win"))) ||
      (ua.includes("linux") && (plat.includes("win") || plat.includes("mac")))
    ) {
      score += 20;
      signals.push("platform_mismatch");
    }
    var sw = window.screen.width || 0,
      sh = window.screen.height || 0;
    if (sw < 640 || sh < 480 || (sw === 0 && sh === 0)) {
      score += 10;
      signals.push("bad_res:" + sw + "x" + sh);
    }
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.id === undefined
    ) {
      score += 10;
      signals.push("headless_chrome");
    }
  } catch (e) {}
  return {
    score: Math.min(Math.max(score, 0), 100),
    signals: signals,
    isAutomated: score >= 40,
  };
}

function showBotOverlay() {
  var o = document.getElementById("botBlockOverlay");
  if (!o) return;
  var lang = document.documentElement.getAttribute("lang") || "en";
  var isAr = lang === "ar";
  o.querySelector(".bot-block-icon").textContent = "🛡️";
  o.querySelector(".bot-block-title").textContent = isAr
    ? "🚫 تم رفض الوصول"
    : "🚫 Access Denied";
  o.querySelector(".bot-block-text").textContent = isAr
    ? "تم اكتشاف متصفح آلي / بدون واجهة. التطبيق مخصص للمستخدمين البشريين فقط. يرجى تعطيل أدوات الأتمتة وإعادة تحميل الصفحة."
    : "Automated / headless browser detected. Please disable automation tools and reload the page.";
  o.classList.add("active");
}

// ── Async VPN diagnostic (no blocking — client-side detection is unreliable) ──
function detectWebRTCIPs() {
  return new Promise(function (resolve) {
    var ips = [],
      done = false,
      timer = setTimeout(function () {
        if (!done) {
          done = true;
          resolve(ips);
        }
      }, 5000);
    try {
      var pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.createDataChannel("");
      pc.createOffer()
        .then(function (d) {
          return pc.setLocalDescription(d);
        })
        .catch(function () {});
      pc.onicecandidate = function (e) {
        if (!e || !e.candidate) {
          if (!done) {
            done = true;
            clearTimeout(timer);
            try {
              pc.close();
            } catch (ex) {}
            resolve(ips);
          }
          return;
        }
        if (
          e.candidate.address &&
          typeof e.candidate.address === "string" &&
          e.candidate.address.indexOf(".") !== -1
        ) {
          if (ips.indexOf(e.candidate.address) === -1)
            ips.push(e.candidate.address);
        }
        var m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
        if (m && ips.indexOf(m[1]) === -1) ips.push(m[1]);
      };
    } catch (e) {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(ips);
      }
    }
  });
}

async function startAsyncVPNDetection() {
  if (REDOSAN_BOT_CHECK && REDOSAN_BOT_CHECK.isAutomated) return;
  var ips = await detectWebRTCIPs();
  var publicIPs = [];
  for (var i = 0; i < ips.length; i++) {
    if (
      !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254)/.test(
        ips[i],
      )
    )
      publicIPs.push(ips[i]);
  }
  // Diagnostic only — WebRTC-based VPN detection is unreliable client-side
  // (false positives from CGNAT, multi-homed networks, IPv4/IPv6 dual-stack)
  if (ips.length === 0 && typeof RTCPeerConnection === "undefined") {
    REDOSAN_BOT_CHECK = {
      score: 10,
      signals: ["webrtc_unavailable"],
      isAutomated: false,
    };
  }
}

function logSecurityStatus() {
  if (!REDOSAN_BOT_CHECK) return;
  var p = REDOSAN_BOT_CHECK;
  var ok = !p.isAutomated;
  var layers = [
    "Bot/Automation  " +
      (ok ? "✓ PASS" : "✗ BLOCKED") +
      "  (score:" +
      p.score +
      ")",
  ];
  if (p.signals.length) {
    layers[0] += " [" + p.signals.join(",") + "]";
  }
  console.log(
    "%c🔐 RedoSan Security",
    "font-size:16px;font-weight:700;color:#6C5CE7",
  );
  for (var i = 0; i < layers.length; i++) {
    var c = layers[i].indexOf("✗") === -1 ? "#4CAF50" : "#FF5252";
    console.log("%c  " + layers[i], "color:" + c + ";font-size:13px");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  REDOSAN_BOT_CHECK = checkAutomation();
  if (REDOSAN_BOT_CHECK && REDOSAN_BOT_CHECK.isAutomated) showBotOverlay();
  startAsyncVPNDetection();
  logSecurityStatus();
  initTheme();
  initDropZones();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/RedoSan-Authenticity/sw.js").then(
      function (reg) {
        console.log("[SW] Registered scope:", reg.scope);
      },
      function (err) {
        console.warn("[SW] Registration failed:", err);
      },
    );
  });
}
