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
  a.download = fileName.replace(/[/\\]/g, '_');
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
  var container = document.getElementById(containerId);
  if (!container) return;
  var link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[/\\]/g, '_');
  link.className = 'btn';
  link.style.cssText = 'margin:4px';
  link.textContent = __("shared.download") + ' ' + name;
  container.appendChild(link);
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

// ── Theme Toggle (light/dark) ──
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

// ── Secure result storage (not on window) ──
var _resultStore = {};
function setResult(key, data) {
  _resultStore[key] = data;
}
function getResult(key) {
  return _resultStore[key];
}
function clearResult(key) {
  delete _resultStore[key];
}

// ── Download handler (single slot, not on window) ──
var _dlHandler = null;
function setDownloadHandler(fn) {
  _dlHandler = fn;
}
function getDownloadHandler() {
  return _dlHandler;
}
