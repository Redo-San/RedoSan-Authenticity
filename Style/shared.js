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
// ── Shared utilities used by all features ──

/**
 *
 * @param s
 */
function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 *
 * @param msg
 * @param cls
 */
function setStatus(msg, cls) {
  const el = document.getElementById("py-status");
  if (el) {
    el.textContent = msg;
    if (cls) el.className = "badge badge-" + cls;
  }
}
setStatus("Ready - JS mode", "success");

/**
 *
 * @param id
 */
async function getFile(id) {
  var input = document.getElementById(id);
  if (input && input.files && input.files.length) {
    const file = input.files[0];
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
    const accept = input.getAttribute("accept");
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
    const magicOk = await matchesMagicBytes(file);
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
    const dangerous = await checkDangerousContent(file);
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
    const structOk = await checkFileStructure(file);
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
/**
 *
 * @param id
 */
function getVal(id) {
  return document.getElementById(id).value;
}
/**
 *
 * @param id
 * @param show
 */
function spinner(id, show) {
  document.getElementById(id).style.display = show ? "block" : "none";
}
/**
 *
 * @param resultId
 * @param outputId
 * @param dlId
 */
function showResult(resultId, outputId, dlId) {
  document.getElementById(resultId).style.display = "block";
}
/**
 *
 * @param id
 * @param html
 */
function setOutput(id, html) {
  document.getElementById(id).innerHTML = html;
}
/**
 *
 * @param id
 * @param text
 */
function setText(id, text) {
  document.getElementById(id).textContent = text;
}
/**
 *
 * @param key
 * @param fallback
 */
function __(key, fallback) {
  // shared.js may load after i18n.js already defined __ (identical logic);
  // keep this fallback for contexts that load shared.js without i18n.js.
  return (i18n && i18n.data && i18n.data[key]) || fallback || key;
}

/**
 *
 * @param blob
 * @param fileName
 */
function downloadBlobSimple(blob, fileName) {
  var url = URL.createObjectURL(blob);
  if (isInAppBrowser()) {
    const win = window.open(url, "_blank");
    if (!win || win.closed) {
      alert(
        __(
          "dl.inapp_alert",
          'Please open this page in Safari or Chrome to download files. Tap the browser menu (⋯) and select "Open in Browser".',
        ),
      );
      window.location.href = url;
    }
    /* c8 ignore next 3 */
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30_000);
    return;
  }
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/[/\\]/g, "_");
  a.click();
  rsRecordDownload(blob, fileName);
  // Revoke after the browser has had time to start the download — revoking
  // synchronously cancels large blobs (e.g. DOCX) before they finish reading.
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 4000);
}

/**
 *
 */
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

/**
 *
 * @param blob
 * @param name
 * @param containerId
 */
function downloadBlob(blob, name, containerId) {
  const url = URL.createObjectURL(blob);
  var container = document.getElementById(containerId);
  if (!container) return;
  var link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[/\\]/g, "_");
  link.className = "btn";
  link.style.cssText = "margin:4px";
  link.textContent = __("shared.download") + " " + name;
  if (isTauriDesktop() && typeof link.addEventListener === "function") {
    link.addEventListener("click", function () {
      rsRecordDownload(blob, name);
    });
  }
  container.append(link);
}

// ── Tauri desktop integration: external links + download manager ──
// In WebView2, target="_blank" anchors never open (links on the Social and
// Contact pages silently do nothing) and <a download> files land in
// %USERPROFILE%\Downloads with no visible feedback. The Tauri build injects
// window.__TAURI__, so there we route external links through the opener
// plugin and surface every saved file with a toast plus an in-app manager
// (list, size, time, location, reveal/copy/remove/clear). The web build
// never passes isTauriDesktop(), so its behavior is unchanged.

var RS_DLS_KEY = "rs_dl_history";
var RS_DLS_MAX = 50;
var _rsDlDir = null;
var _rsToastTimer = null;
var _rsDlOutsideHandler = null;

/**
 *
 * @returns {boolean}
 */
function isTauriDesktop() {
  try {
    return !!(
      (window.__TAURI__ &&
        window.__TAURI__.core &&
        window.__TAURI__.core.invoke) ||
      (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke)
    );
  } catch {
    return false;
  }
}

/**
 *
 * @param cmd
 * @param args
 * @returns {Promise}
 */
function tauriInvoke(cmd, args) {
  var api = window.__TAURI__;
  var invoke =
    api && api.core && api.core.invoke
      ? api.core.invoke
      : window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
  if (!invoke) return Promise.reject(new Error("not-tauri"));
  return invoke(cmd, args || {});
}

/**
 * i18n lookup with a {0} substitution that does not depend on which global
 * __ variant (2-arg in shared.js, 3-arg in i18n.js) is currently defined.
 * @param key
 * @param fallback
 * @param arg0
 * @returns {string}
 */
function rsT(key, fallback, arg0) {
  var s =
    (typeof i18n !== "undefined" && i18n && i18n.data && i18n.data[key]) ||
    fallback ||
    key;
  if (arg0 !== undefined && arg0 !== null)
    s = String(s).split("{0}").join(String(arg0));
  return s;
}

/**
 *
 * @param text
 * @param kind
 */
function rsToast(text, kind) {
  if (!text) return;
  try {
    if (
      typeof document === "undefined" ||
      typeof document.createElement !== "function" ||
      !document.body
    )
      return;
    var el = document.getElementById("rs-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "rs-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);" +
        "z-index:2000000;max-width:min(92vw,540px);padding:10px 16px;" +
        "border-radius:8px;font-size:14px;line-height:1.45;color:#fff;" +
        "background:#1f2937;box-shadow:0 4px 16px rgba(0,0,0,.3);" +
        "opacity:0;transition:opacity .25s;pointer-events:none;" +
        "text-align:center;word-break:break-word;";
      document.body.append(el);
    }
    el.style.background = kind === "err" ? "#b91c1c" : "#1f2937";
    el.textContent = text;
    el.style.opacity = "1";
    if (_rsToastTimer) clearTimeout(_rsToastTimer);
    _rsToastTimer = setTimeout(function () {
      el.style.opacity = "0";
    }, 4500);
  } catch {
    /* feedback must never break the caller */
  }
}

/**
 *
 * @returns {Array}
 */
function rsDlList() {
  try {
    var v = JSON.parse(window.localStorage.getItem(RS_DLS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 *
 * @param list
 */
function rsDlSave(list) {
  try {
    window.localStorage.setItem(
      RS_DLS_KEY,
      JSON.stringify(list.slice(0, RS_DLS_MAX)),
    );
  } catch {
    /* storage unavailable — history is best-effort */
  }
}

/**
 * Resolve %USERPROFILE%\Downloads once via core:path resolve_directory
 * (BaseDirectory::Download serializes as its repr(u16) code, Download = 7).
 * @returns {Promise}
 */
function rsDlDir() {
  if (_rsDlDir) return Promise.resolve(_rsDlDir);
  return tauriInvoke("plugin:path|resolve_directory", {
    directory: 7,
    path: null,
  }).then(function (d) {
    _rsDlDir = d;
    return d;
  });
}

/**
 *
 * @param entry
 * @returns {string}
 */
function rsDlFullPath(entry) {
  if (entry.path) return entry.path;
  if (!entry.dir) return entry.name;
  var sep = "";
  if (!/[/\\]$/.test(entry.dir)) {
    sep = entry.dir.includes("\\") ? "\\" : "/";
  }
  return entry.dir + sep + entry.name;
}

/**
 *
 * @param n
 * @returns {string}
 */
function rsDlSize(n) {
  if (typeof n !== "number" || !isFinite(n)) return "";
  if (n < 1024) return n + " B";
  if (n < 1_048_576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1_073_741_824) return (n / 1_048_576).toFixed(1) + " MB";
  return (n / 1_073_741_824).toFixed(2) + " GB";
}

/**
 *
 * @param ts
 * @returns {string}
 */
function rsDlTime(ts) {
  if (typeof ts !== "number") return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

/**
 * Record a file that WebView2 just saved: persist it to history, paint the
 * badge/panel, toast the destination path. Desktop-only, best-effort.
 * @param blob
 * @param fileName
 */
function rsRecordDownload(blob, fileName) {
  if (!isTauriDesktop()) return;
  var name = String(fileName || "download").replace(/[/\\]/g, "_");
  var entry = {
    name: name,
    size: blob && typeof blob.size === "number" ? blob.size : 0,
    time: Date.now(),
    dir: "",
    path: "",
  };
  var list = rsDlList();
  list.unshift(entry);
  rsDlSave(list);
  rsDlPaint();
  rsDlDir()
    .then(function (dir) {
      entry.dir = dir;
      entry.path = rsDlFullPath(entry);
      rsDlSave(list);
      rsDlPaint();
      rsToast(rsT("dlmgr.saved", "Download saved: {0}", rsDlFullPath(entry)));
    })
    .catch(function () {
      rsToast(rsT("dlmgr.saved_generic", "Download saved"));
    });
}

/**
 *
 * @param text
 */
async function rsDlCopy(text) {
  var copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false; // clipboard blocked — execCommand fallback below
  }
  if (!copied) copied = rsDlCopyFallback(text);
  if (copied) rsToast(rsT("dlmgr.copied", "Path copied to clipboard"));
  else rsToast(rsT("dlmgr.copy_failed", "Could not copy the path"), "err");
}

/**
 * execCommand-based clipboard fallback for when the async Clipboard API is
 * blocked. Returns whether the copy succeeded.
 * @param text
 * @returns {boolean}
 */
function rsDlCopyFallback(text) {
  try {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
    document.body.append(ta);
    ta.select();
    var ok = !!(document.execCommand && document.execCommand("copy"));
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 *
 * @param entry
 */
function rsDlReveal(entry) {
  var full = rsDlFullPath(entry);
  tauriInvoke("plugin:opener|reveal_item_in_dir", { path: full })
    .catch(function () {
      // The file may have been deleted outside the app — reveal its folder.
      if (entry.dir && entry.dir !== full)
        return tauriInvoke("plugin:opener|reveal_item_in_dir", {
          path: entry.dir,
        });
      throw new Error("reveal-failed");
    })
    .catch(function () {
      rsToast(rsT("dlmgr.open_failed", "Could not open the folder"), "err");
    });
}

/**
 *
 * @param open
 */
function rsDlToggle(open) {
  var panel = document.getElementById("rs-dl-panel");
  var btn = document.getElementById("rs-dl-btn");
  if (!panel || !btn) return;
  if (open === undefined) open = panel.hasAttribute("hidden");
  if (open) {
    rsDlPaint();
    panel.removeAttribute("hidden");
    btn.setAttribute("aria-expanded", "true");
    if (!_rsDlOutsideHandler) {
      _rsDlOutsideHandler = function (e) {
        var t = e.target;
        if (
          t &&
          t.closest &&
          (t.closest("#rs-dl-panel") || t.closest("#rs-dl-btn"))
        )
          return;
        rsDlToggle(false);
      };
      document.addEventListener("click", _rsDlOutsideHandler);
    }
  } else {
    panel.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", "false");
    if (_rsDlOutsideHandler) {
      document.removeEventListener("click", _rsDlOutsideHandler);
      _rsDlOutsideHandler = null;
    }
  }
}

/**
 * Render badge count, header labels and the item list from current history.
 */
function rsDlPaint() {
  var list = rsDlList();
  var badge = document.getElementById("rs-dl-badge");
  if (badge) {
    badge.textContent = list.length > 99 ? "99+" : String(list.length);
    badge.style.display = list.length ? "flex" : "none";
  }
  var title = document.getElementById("rs-dl-title");
  if (title) title.textContent = rsT("dlmgr.title", "Downloads");
  var clearBtn = document.getElementById("rs-dl-clear");
  if (clearBtn) clearBtn.textContent = rsT("dlmgr.clear", "Clear all");
  var box = document.getElementById("rs-dl-items");
  if (!box) return;
  if (!list.length) {
    box.innerHTML =
      '<div class="rs-dl-empty">' +
      escHtml(rsT("dlmgr.empty", "No downloads yet")) +
      "</div>";
    return;
  }
  var html = "";
  list.forEach(function (e, i) {
    var meta = [];
    if (e.size) meta.push(escHtml(rsDlSize(e.size)));
    if (e.time) meta.push(escHtml(rsDlTime(e.time)));
    if (e.dir) meta.push(escHtml(e.dir));
    html +=
      '<div class="rs-dl-item">' +
      '<div class="rs-dl-name" title="' +
      escHtml(e.name) +
      '">' +
      escHtml(e.name) +
      "</div>" +
      (meta.length
        ? '<div class="rs-dl-meta">' + meta.join(" &middot; ") + "</div>"
        : "") +
      '<div class="rs-dl-acts">' +
      '<button type="button" data-act="reveal" data-idx="' +
      i +
      '">' +
      escHtml(rsT("dlmgr.reveal", "Show in folder")) +
      "</button>" +
      '<button type="button" data-act="copy" data-idx="' +
      i +
      '">' +
      escHtml(rsT("dlmgr.copy", "Copy path")) +
      "</button>" +
      '<button type="button" data-act="remove" data-idx="' +
      i +
      '">' +
      escHtml(rsT("dlmgr.remove", "Remove")) +
      "</button>" +
      "</div></div>";
  });
  box.innerHTML = html;
}

/**
 *
 * @param e
 */
function rsDlPanelClick(e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var act = t.closest("button[data-act]");
  if (!act) return;
  var idx = parseInt(act.dataset.idx, 10);
  if (Number.isNaN(idx)) return;
  var list = rsDlList();
  var entry = list[idx];
  if (!entry) return;
  switch (act.dataset.act) {
    case "reveal": {
      rsDlReveal(entry);
      break;
    }
    case "copy": {
      rsDlCopy(rsDlFullPath(entry));
      break;
    }
    case "remove": {
      list.splice(idx, 1);
      rsDlSave(list);
      rsDlPaint();
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Copy the page's style nonce so this injected stylesheet is not blocked.
 * Tauri injects a nonce token on every <style> of the bundled HTML (MPA
 * pages), replaces it with a fresh random value per request, and appends it
 * to the style-src header only when such a token exists. The SPA root ships
 * no page <style>, its header carries no nonce, and this returns "".
 * @returns {string}
 */
function rsStyleNonce() {
  try {
    var styles = document.querySelectorAll("style");
    for (var i = 0; i < styles.length; i++) {
      if (styles[i].nonce) return styles[i].nonce;
    }
  } catch {
    /* best effort: fall back to an unsigned stylesheet */
  }
  return "";
}

/**
 * Build the floating manager button + panel (once) and wire its handlers.
 */
function rsDlBuildUI() {
  if (document.getElementById("rs-dl-btn")) return;
  var style = document.createElement("style");
  style.id = "rs-dl-style";
  var styleNonce = rsStyleNonce();
  if (styleNonce) style.nonce = styleNonce;
  style.textContent =
    "#rs-dl-btn{position:fixed;right:88px;bottom:24px;width:46px;height:46px;" +
    "border:none;border-radius:50%;background:var(--primary,#6c5ce7);color:#fff;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;" +
    "z-index:9999999;box-shadow:0 4px 14px rgba(0,0,0,.32);transition:transform .2s;" +
    "touch-action:manipulation;padding:0}" +
    "#rs-dl-btn:hover{transform:scale(1.08)}" +
    "#rs-dl-btn svg{width:22px;height:22px;pointer-events:none}" +
    "#rs-dl-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;" +
    "padding:0 4px;border-radius:9px;background:#ef4444;color:#fff;font-size:11px;" +
    "font-weight:700;align-items:center;justify-content:center;line-height:1;" +
    "display:none;border:2px solid var(--bg,#0f0f1a)}" +
    "#rs-dl-panel{position:fixed;right:88px;bottom:80px;" +
    "width:min(340px,calc(100vw - 40px));max-height:min(420px,52vh);" +
    "display:flex;flex-direction:column;background:var(--card,#1a1a2e);" +
    "color:var(--text,#e8e8f0);border:1px solid var(--border,#2a2a45);" +
    "border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.35);" +
    "z-index:9999998;overflow:hidden}" +
    "#rs-dl-panel[hidden]{display:none}" +
    ".rs-dl-head{display:flex;align-items:center;justify-content:space-between;" +
    "gap:8px;padding:10px 12px;border-bottom:1px solid var(--border,#2a2a45);" +
    "font-weight:700;font-size:14px}" +
    ".rs-dl-head button{border:1px solid var(--border,#2a2a45);" +
    "background:transparent;color:var(--text-muted,#9b9bb5);border-radius:6px;" +
    "padding:4px 8px;font-size:12px;cursor:pointer}" +
    ".rs-dl-head button:hover{border-color:var(--danger,#ff5252);color:var(--danger,#ff5252)}" +
    "#rs-dl-items{overflow-y:auto;padding:6px}" +
    ".rs-dl-item{padding:8px;border-radius:8px}" +
    ".rs-dl-item:hover{background:var(--card-hover,#252540)}" +
    ".rs-dl-name{font-size:13px;font-weight:600;direction:ltr;text-align:left;" +
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".rs-dl-meta{font-size:11px;color:var(--text-muted,#9b9bb5);direction:ltr;" +
    "text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
    "margin-top:2px}" +
    ".rs-dl-acts{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}" +
    ".rs-dl-acts button{border:1px solid var(--border,#2a2a45);" +
    "background:transparent;color:inherit;border-radius:6px;padding:3px 8px;" +
    "font-size:11px;cursor:pointer}" +
    ".rs-dl-acts button:hover{border-color:var(--primary,#6c5ce7);" +
    "color:var(--primary-text,#8a7bf0)}" +
    ".rs-dl-empty{padding:18px 8px;text-align:center;font-size:13px;" +
    "color:var(--text-muted,#9b9bb5)}";
  document.head.append(style);

  var btn = document.createElement("button");
  btn.id = "rs-dl-btn";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", rsT("dlmgr.title", "Downloads"));
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>' +
    '<path d="M4 19h16"/></svg><span id="rs-dl-badge"></span>';
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    rsDlToggle();
  });

  var panel = document.createElement("div");
  panel.id = "rs-dl-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", rsT("dlmgr.title", "Downloads"));
  panel.setAttribute("hidden", "");
  panel.innerHTML =
    '<div class="rs-dl-head"><span id="rs-dl-title"></span>' +
    '<button type="button" id="rs-dl-clear"></button></div>' +
    '<div id="rs-dl-items"></div>';
  panel.addEventListener("click", rsDlPanelClick);
  panel.querySelector("#rs-dl-clear").addEventListener("click", function () {
    rsDlSave([]);
    rsDlPaint();
    rsToast(rsT("dlmgr.cleared", "Download list cleared"));
  });

  document.body.append(btn);
  document.body.append(panel);
  rsDlPaint();
}

/**
 * Capture-phase interceptor: in the Tauri window every cross-origin
 * http(s)/mailto/tel link opens through the opener plugin (WebView2 would
 * otherwise swallow target="_blank" silently, and same-tab navigation would
 * replace the whole app). Same-origin links stay native.
 * @param e
 */
function rsInterceptExternalLink(e) {
  if (!isTauriDesktop()) return;
  if (!e || e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var el = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!el) return;
  var raw = el.getAttribute("href") || "";
  if (!/^(https?:|mailto:|tel:)/i.test(raw)) return;
  try {
    var u = new URL(raw, window.location.href);
    if (/^https?:$/i.test(u.protocol) && u.origin === window.location.origin)
      return;
  } catch {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  tauriInvoke("plugin:opener|open_url", { url: raw }).catch(function () {
    rsToast(rsT("dlmgr.link_failed", "Could not open the link"), "err");
  });
}

/**
 *
 */
function rsInitTauriUI() {
  if (!isTauriDesktop()) return;
  try {
    rsDlBuildUI();
  } catch {
    /* UI is progressive enhancement */
  }
}

if (
  typeof document !== "undefined" &&
  typeof document.addEventListener === "function"
) {
  document.addEventListener("click", rsInterceptExternalLink, {
    capture: true,
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rsInitTauriUI);
  } else {
    rsInitTauriUI();
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") rsDlToggle(false);
  });
}

/**
 *
 * @param file
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      d.w = img.width;
      d.h = img.height;
      URL.revokeObjectURL(url);
      resolve({ canvas: c, ctx, imgData: d, w: img.width, h: img.height });
    };
    /* c8 ignore next 3 */
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(__("shared.failed_load_image", "Failed to load image")));
    };
    img.src = url;
  });
}

/**
 *
 * @param canvas
 * @param mime
 */
function canvasToBlob(canvas, mime) {
  return new Promise((r) => canvas.toBlob((b) => r(b), mime || "image/png"));
}

/**
 *
 * @param imgData
 */
function getRGB(imgData) {
  const r = new Uint8Array(imgData.w * imgData.h * 3);
  for (let i = 0; i < imgData.w * imgData.h; i++) {
    r[i * 3] = imgData.data[i * 4];
    r[i * 3 + 1] = imgData.data[i * 4 + 1];
    r[i * 3 + 2] = imgData.data[i * 4 + 2];
  }
  return r;
}

/**
 *
 * @param data
 */
async function sha256Hex(data) {
  const h = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 *
 * @param v
 */
function pack32(v) {
  return new Uint8Array([
    (v >> 24) & 255,
    (v >> 16) & 255,
    (v >> 8) & 255,
    v & 255,
  ]);
}
/**
 *
 * @param b
 */
function unpack32(b) {
  return ((b[0] << 24) >>> 0) | (b[1] << 16) | (b[2] << 8) | b[3];
}

// ── Theme Toggle (light/dark) ──
/**
 *
 * @param theme
 */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  localStorage.setItem("redosan_theme", theme);
}
/**
 *
 */
function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  setTheme(cur === "light" ? "dark" : "light");
}
/**
 *
 */
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
/**
 *
 * @param input
 * @param dz
 */
function attachDropZoneEvents(input, dz) {
  const fileDiv = dz.querySelector(".dz-file") || { textContent: "" };
  dz.addEventListener("click", (e) => {
    if (
      e.target === dz ||
      e.target.classList.contains("dz-icon") ||
      e.target.classList.contains("dz-text")
    )
      input.click();
  });
  /**
   *
   */
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
  ["dragenter", "dragover"].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
    });
  });
  /* c8 ignore start */
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
  /* c8 ignore stop */
  if (input.files && input.files.length) updateFile();
}

/**
 *
 */
function initDropZones() {
  document
    .querySelectorAll('.form-group input[type="file"]')
    .forEach((input) => {
      if (input.parentElement.classList.contains("file-drop-zone")) {
        attachDropZoneEvents(input, input.parentElement);
        return;
      }
      const dz = document.createElement("div");
      dz.className = "file-drop-zone";
      input.parentNode.insertBefore(dz, input);
      dz.append(input);
      const icon = document.createElement("span");
      icon.className = "dz-icon";
      icon.textContent = "📁";
      dz.append(icon);
      const text = document.createElement("div");
      text.className = "dz-text";
      text.innerHTML = "Drop file here or <strong>browse</strong>";
      dz.append(text);
      const fileDiv = document.createElement("div");
      fileDiv.className = "dz-file";
      dz.append(fileDiv);
      attachDropZoneEvents(input, dz);
    });
}
// ── Bot / Automation Detection (100% client-side) ──
var REDOSAN_BOT_CHECK = null;

/**
 *
 */
function checkAutomation() {
  if (window.__BACKSTOP_TEST__ || location.search.includes("backstop=1")) {
    return { score: 0, signals: ["backstop"], isAutomated: false };
  }
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
    } catch {}
    if (navigator.plugins && navigator.plugins.length === 0) {
      score += 10;
      signals.push("no_plugins");
    }
    if (!navigator.languages || navigator.languages.length <= 1) {
      score += 5;
      signals.push("few_languages");
    }
    const ua = (navigator.userAgent || "").toLowerCase();
    const plat = (navigator.platform || "").toLowerCase();
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
    const sw = window.screen.width || 0,
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
  } catch {}
  return {
    score: Math.min(Math.max(score, 0), 100),
    signals: signals,
    isAutomated: score >= 40,
  };
}

/**
 *
 */
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
/**
 *
 */
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
      const pc = new RTCPeerConnection({
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
            } catch {}
            resolve(ips);
          }
          return;
        }
        if (
          e.candidate.address &&
          typeof e.candidate.address === "string" &&
          e.candidate.address.includes(".") &&
          !ips.includes(e.candidate.address)
        )
          ips.push(e.candidate.address);
        var m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
        if (m && !ips.includes(m[1])) ips.push(m[1]);
      };
    } catch {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(ips);
      }
    }
  });
}

/**
 *
 */
async function startAsyncVPNDetection() {
  if (REDOSAN_BOT_CHECK && REDOSAN_BOT_CHECK.isAutomated) return;
  var ips = await detectWebRTCIPs();
  var publicIPs = [];
  for (let i = 0; i < ips.length; i++) {
    if (
      !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254)/.test(
        ips[i],
      )
    )
      publicIPs.push(ips[i]);
  }
  // Diagnostic only — WebRTC-based VPN detection is unreliable client-side
  // (false positives from CGNAT, multi-homed networks, IPv4/IPv6 dual-stack)
  if (typeof RTCPeerConnection === "undefined" && ips.length === 0) {
    REDOSAN_BOT_CHECK = {
      score: 10,
      signals: ["webrtc_unavailable"],
      isAutomated: false,
    };
  }
}

/**
 *
 */
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
  for (let i = 0; i < layers.length; i++) {
    const c = layers[i].includes("✗") ? "#FF5252" : "#4CAF50";
    console.log("%c  " + layers[i], "color:" + c + ";font-size:13px");
  }
}

/* c8 ignore start */
document.addEventListener("DOMContentLoaded", () => {
  REDOSAN_BOT_CHECK = checkAutomation();
  if (REDOSAN_BOT_CHECK && REDOSAN_BOT_CHECK.isAutomated) showBotOverlay();
  initTheme();
  initDropZones();
  logSecurityStatus();
  // WebRTC VPN diagnostic is NOT run on load: the first RTCPeerConnection
  // initializes the WebRTC stack and blocks the main thread for ~600ms,
  // destroying TBT on every page. It runs lazily on first user interaction.
  var vpnOnce = function () {
    document.removeEventListener("pointerdown", vpnOnce);
    document.removeEventListener("keydown", vpnOnce);
    startAsyncVPNDetection();
  };
  document.addEventListener("pointerdown", vpnOnce);
  document.addEventListener("keydown", vpnOnce);
});
/* c8 ignore stop */

// ── Shared lazy vendor loading (PDF/DOCX/QR/JSZip/OpenTimestamps) ──
// Exposed globally so every tool page (SPA + MPA) can lazily load vendor
// libraries before generating exports. Prefers the local vendor/ copy,
// falls back to CDNs. Mirrors the pattern in Certificate/certificate.js.
/* c8 ignore start */
if (typeof ensureLib === "undefined") {
  const __ensureLibGlobals = {
    jspdf: function () {
      return typeof jspdf !== "undefined";
    },
    QRious: function () {
      return typeof QRious !== "undefined";
    },
    JSZip: function () {
      return typeof JSZip !== "undefined";
    },
    docx: function () {
      return typeof docx !== "undefined";
    },
    OpenTimestamps: function () {
      return typeof OpenTimestamps !== "undefined";
    },
  };
  const __ensureLibUrls = {
    jspdf: [
      "vendor/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    ],
    QRious: [
      "vendor/qrious.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js",
      "https://unpkg.com/qrious@4.0.2/dist/qrious.min.js",
      "https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js",
    ],
    JSZip: [
      "vendor/jszip.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
      "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    ],
    docx: [
      "vendor/docx.umd.min.js",
      "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
      "https://unpkg.com/docx@8.5.0/build/index.umd.js",
    ],
    OpenTimestamps: ["vendor/opentimestamps.min.js"],
  };
  /**
   * Ensure a vendor library global (jspdf, docx, QRious, JSZip,
   * OpenTimestamps) is loaded before use.
   * @param {string} name
   * @returns {Promise<void>}
   */
  function ensureLib(name) {
    return new Promise(function (resolve, reject) {
      var check = __ensureLibGlobals[name];
      if (check && check()) return resolve();
      var urls = (__ensureLibUrls[name] || []).slice();
      if (!urls.length) return reject(new Error("Unknown library: " + name));
      if (urls[0].indexOf("vendor/") === 0) {
        const vbase = document.documentElement.dataset.standalone
          ? "../../../vendor/"
          : "vendor/";
        urls[0] = vbase + urls[0].slice(7);
      }
      var cache =
        typeof window === "undefined" ? null : window.__ensureLibCache;
      if (!cache) {
        window.__ensureLibCache = {};
        cache = window.__ensureLibCache;
      }
      if (check && cache[name] && check()) return resolve();
      var idx = 0;
      (function load(i) {
        if (i >= urls.length) {
          cache[name] = false;
          reject(
            new Error(
              "Library " + name + " not available (vendor + CDNs all failed)",
            ),
          );
          return;
        }
        var s = document.createElement("script");
        s.src = urls[i];
        s.onload = function () {
          if (check && check()) {
            cache[name] = true;
            resolve();
          } else {
            cache[name] = false;
            reject(new Error("Library " + name + " loaded but global missing"));
          }
        };
        s.onerror = function () {
          setTimeout(function () {
            load(i + 1);
          }, 1000);
        };
        document.head.append(s);
      })(idx);
    });
  }
  /**
   * Ensure several vendor libraries are loaded in order.
   * @param {string[]} names
   * @returns {Promise<void>}
   */
  function ensureLibs(names) {
    return names.reduce(function (p, n) {
      return p.then(function () {
        return ensureLib(n);
      });
    }, Promise.resolve());
  }

  // Expose for tool pages (SPA + MPA) that lazily load vendor libs.
  window.loadVendorLib = ensureLib;
  window.ensureLib = ensureLib;
  window.ensureLibs = ensureLibs;
}
/* c8 ignore stop */

var SW_VERSION = 4;
/* c8 ignore next 32 */
if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:" &&
  !window.__TAURI_INTERNALS__
) {
  // In-app browsers (Facebook/Instagram/TikTok/Threads webviews) isolate and
  // sometimes wipe storage, and their SW support is unreliable — registering
  // there risks serving stale or broken caches to those visitors.
  var INAPP_UA =
    /(FBAN|FBAV|FB_IAB|Instagram|Threads|Barcelona|BytedanceWebview|musical_ly|trill|Snapchat|LinkedInApp|Pinterest)/i;
  if (INAPP_UA.test(navigator.userAgent || "")) {
    console.info(
      "[SW] Registration skipped: in-app browser detected (isolated/unreliable storage).",
    );
  } else {
    window.addEventListener("load", function () {
      var swBase = document.documentElement.dataset.standalone
        ? "../../../"
        : "";
      navigator.serviceWorker
        .register(swBase + "sw.js?v=" + SW_VERSION, { updateViaCache: "none" })
        .then(function (reg) {
          console.log("[SW] Registered scope:", reg.scope);
        })
        .catch(function (error) {
          console.warn("[SW] Registration failed:", error);
        });
    });
  }
}

// ── Secure result storage (not on window) ──
var _resultStore = {};
/**
 *
 * @param key
 * @param data
 */
function setResult(key, data) {
  _resultStore[key] = data;
}
/**
 *
 * @param key
 */
function getResult(key) {
  return _resultStore[key];
}
/**
 *
 * @param key
 */
function clearResult(key) {
  delete _resultStore[key];
}

// ── Download handler (single slot, not on window) ──
var _dlHandler = null;
/**
 *
 * @param fn
 */
function setDownloadHandler(fn) {
  _dlHandler = fn;
}
/**
 *
 */
function getDownloadHandler() {
  return _dlHandler;
}

// ── Navigate to home page from any standalone page ──
var _homePath = "";
/**
 *
 */
function goHome() {
  if (!_homePath) {
    let parts = window.location.pathname.split("/");
    let pagesIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") {
        pagesIdx = i;
        break;
      }
    }
    if (pagesIdx === -1) {
      parts = ["..", "home", "index.html"];
    } else {
      parts = parts.slice(0, pagesIdx + 1);
      parts.push("home", "index.html");
    }
    let target = parts.join("/");
    // Only add a leading slash for absolute-style paths that are not relative ("..")
    if (target.indexOf("/") !== 0 && parts[0] !== "..") target = "/" + target;
    _homePath = target;
  }
  window.location.href = _homePath;
}

// ── Music player moved to Style/music-player.js ──

// Load the local-only Removal Tools script only when the server actually
// serves it as JavaScript (Removal_Tools/ is gitignored, so fresh checkouts
// would otherwise receive 404.html with HTTP 200 + text/html).
window.RedoSanLoadRemovalTools = function () {
  if (window.location.hostname === "redo-san.github.io") return;
  var REMOVAL_JS = "../../../Removal_Tools/removal_tools.js";
  var controller = new AbortController();
  var probe = function (method) {
    return fetch(REMOVAL_JS, {
      method: method,
      cache: "no-store",
      signal: controller.signal,
    }).then(function (r) {
      var ct = (r.headers.get("content-type") || "").toLowerCase();
      if (!r.ok || !ct.includes("javascript")) return null;
      return r;
    });
  };
  var inject = function () {
    var s = document.createElement("script");
    s.src = REMOVAL_JS + "?v=4";
    s.defer = !0;
    document.body.append(s);
  };
  var timer = setTimeout(function () {
    controller.abort();
  }, 5000);
  probe("HEAD")
    .catch(function () {
      return probe("GET");
    })
    .then(function (r) {
      clearTimeout(timer);
      if (r) inject();
    })
    .catch(function () {});
};
