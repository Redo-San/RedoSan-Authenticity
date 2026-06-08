// ── RedoSan Authenticity — Security Threat Blocker ──
// Intercepts requests to dangerous file types + unknown JS/CSS/YML files
// and returns a warning page.

var DANGEROUS_EXTS = [
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".pif",
  ".ps1",
  ".psm1",
  ".psd1",
  ".vbs",
  ".vbe",
  ".jse",
  ".wsf",
  ".wsh",
  ".dll",
  ".ocx",
  ".sys",
  ".drv",
  ".jar",
  ".sh",
  ".pl",
  ".py",
  ".rb",
  ".bash",
  ".app",
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
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  // Linux-specific
  ".elf",
  ".so",
  ".ko",
  ".deb",
  ".rpm",
  ".run",
  ".lua",
  ".tcl",
  ".awk",
  ".apk",
  ".flatpak",
  ".snap",
  ".appimage",
];

// Whitelist of legitimate JS files served by the site.
// Any .js request not in this list is treated as a threat.
var JS_WHITELIST = [
  "/RedoSan-Authenticity/sw.js",
  "/RedoSan-Authenticity/Style_Web_Page/shared.js",
  "/RedoSan-Authenticity/Style_Web_Page/simplified.js",
  "/RedoSan-Authenticity/Style_Web_Page/navigation.js",
  "/RedoSan-Authenticity/Style_Web_Page/i18n.js",
  "/RedoSan-Authenticity/Style_Web_Page/search.js",
  "/RedoSan-Authenticity/Certificate/certificate.js",
  "/RedoSan-Authenticity/Watermark/watermark.js",
  "/RedoSan-Authenticity/Watermark/watermark_core.js",
  "/RedoSan-Authenticity/Watermark/utils.js",
  "/RedoSan-Authenticity/Pixel_Injection/pixel_injection.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_core_advanced.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_advanced_ui.js",
  "/RedoSan-Authenticity/Pixel_Injection/advanced_watermarking.js",
  "/RedoSan-Authenticity/Forensic/forensic_core.js",
  "/RedoSan-Authenticity/Forensic/forensic.js",
  "/RedoSan-Authenticity/Timestamp/timestamp.js",
  "/RedoSan-Authenticity/Decentralized_Identity_DID/did.js",
  "/RedoSan-Authenticity/Fingerprint/hashing.js",
  "/RedoSan-Authenticity/Fingerprint/fingerprint_ui.js",
  "/RedoSan-Authenticity/C2PA/cbor.js",
  "/RedoSan-Authenticity/C2PA/c2pa.js",
  "/RedoSan-Authenticity/Metadata/metadata.js",
  "/RedoSan-Authenticity/Converter/converter.js",
  "/RedoSan-Authenticity/Converter/ffmpeg-worker.js",
  "/RedoSan-Authenticity/Converter/ffmpeg.min.js",
  "/RedoSan-Authenticity/Audio_Watermark/audio_watermark_core.js",
  "/RedoSan-Authenticity/Audio_Watermark/audio_watermark.js",
  "/RedoSan-Authenticity/Assistant/assistant.js",
  "/RedoSan-Authenticity/vendor/jspdf.umd.min.js",
  "/RedoSan-Authenticity/vendor/qrious.min.js",
  "/RedoSan-Authenticity/vendor/jszip.min.js",
  "/RedoSan-Authenticity/vendor/opentimestamps.min.js",
  "/RedoSan-Authenticity/Forensic/forensic.js",
  "/RedoSan-Authenticity/Forensic/forensic_core.js",
  "/RedoSan-Authenticity/ID_Forge/id_forge.js",
  "/RedoSan-Authenticity/Style_Web_Page/lang/i18n-data.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark_core.js",
  "/RedoSan-Authenticity/Document_Watermark/text_extractor.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark.js",
  "/RedoSan-Authenticity/vendor/pdf-lib.min.js",
  "/RedoSan-Authenticity/scripts/fix-orphan-labels.js",
];

// Whitelist of legitimate CSS files served by the site.
// Any .css request not in this list is treated as a threat.
var CSS_WHITELIST = [
  "/RedoSan-Authenticity/Style_Web_Page/style.css",
  "/RedoSan-Authenticity/Style_Web_Page/rtl.css",
  "/RedoSan-Authenticity/Style_Web_Page/responsive.css",
];

// Whitelist of legitimate YML/YAML files (GitHub workflows, configs).
// Any .yml/.yaml request not in this list is treated as a threat.
var YML_WHITELIST = [
  "/RedoSan-Authenticity/.github/workflows/deploy-pages.yml",
  "/RedoSan-Authenticity/.github/workflows/ci.yml",
  "/RedoSan-Authenticity/.github/workflows/codeql.yml",
  "/RedoSan-Authenticity/.github/workflows/scorecards.yml",
  "/RedoSan-Authenticity/.github/workflows/review.yml",
  "/RedoSan-Authenticity/.github/workflows/malware-scan.yml",
  "/RedoSan-Authenticity/.github/workflows/labeler.yml",
  "/RedoSan-Authenticity/.github/workflows/zizmor.yml",
  "/RedoSan-Authenticity/.github/workflows/npm-audit-checker.yml",
  "/RedoSan-Authenticity/.github/workflows/translate.yml",
  "/RedoSan-Authenticity/.github/workflows/pwn-hunter.yml",
  "/RedoSan-Authenticity/.github/workflows/welcome.yml",
  "/RedoSan-Authenticity/.github/workflows/abom.yml",
  "/RedoSan-Authenticity/.github/workflows/dependency-review.yml",
  "/RedoSan-Authenticity/.github/workflows/css-lint.yml",
  "/RedoSan-Authenticity/.github/workflows/dead-css.yml",
  "/RedoSan-Authenticity/.github/workflows/html-hint.yml",
  "/RedoSan-Authenticity/.github/workflows/spell-check.yml",
  "/RedoSan-Authenticity/.github/workflows/broken-links.yml",
  "/RedoSan-Authenticity/.github/workflows/todo-issues.yml",
  "/RedoSan-Authenticity/.github/workflows/console-log-detector.yml",
  "/RedoSan-Authenticity/.github/workflows/file-size-budget.yml",
  "/RedoSan-Authenticity/.github/workflows/js-syntax-check.yml",
  "/RedoSan-Authenticity/.github/workflows/cross-ref-check.yml",
  "/RedoSan-Authenticity/.github/workflows/permissions-sheriff.yml",
  "/RedoSan-Authenticity/.github/workflows/prettier-check.yml",
  "/RedoSan-Authenticity/.github/workflows/secret-scanner.yml",
  "/RedoSan-Authenticity/.github/workflows/auto-assign.yml",
  "/RedoSan-Authenticity/.github/workflows/branch-name-lint.yml",
  "/RedoSan-Authenticity/.github/workflows/issue-labeler.yml",
  "/RedoSan-Authenticity/.github/workflows/lock-closed.yml",
  "/RedoSan-Authenticity/.github/workflows/pr-size-label.yml",
  "/RedoSan-Authenticity/.github/workflows/pr-stats.yml",
  "/RedoSan-Authenticity/.github/workflows/pr-title-lint.yml",
  "/RedoSan-Authenticity/.github/workflows/pr-body-check.yml",
  "/RedoSan-Authenticity/.github/workflows/eslint-review.yml",
  "/RedoSan-Authenticity/.github/workflows/stale.yml",
  "/RedoSan-Authenticity/.github/workflows/dom-review.yml",
  "/RedoSan-Authenticity/.github/workflows/copilot-setup-steps.yml",
  "/RedoSan-Authenticity/.github/workflows/a11y-fix.yml",
  "/RedoSan-Authenticity/.github/workflows/gemini-analysis.yml",
  "/RedoSan-Authenticity/.github/workflows/semgrep.yml",
  "/RedoSan-Authenticity/.github/workflows/ollama-analysis.yml",
  "/RedoSan-Authenticity/.github/dependabot.yml",
  "/RedoSan-Authenticity/.github/labeler.yml",
  "/RedoSan-Authenticity/.github/ISSUE_TEMPLATE/bug_report.yml",
  "/RedoSan-Authenticity/.github/ISSUE_TEMPLATE/feature_request.yml",
];

// Whitelist of legitimate HTML pages served by the site.
// Any .html request not in this list is treated as a threat.
var HTML_WHITELIST = [
  "/RedoSan-Authenticity/index.html",
  "/RedoSan-Authenticity/404.html",
];

// Whitelist of known external libraries loaded from CDNs.
// Any cross-origin request for a script/library not in this list is blocked.
var EXT_WHITELIST = [
  // jsPDF (cdnjs + unpkg + jsdelivr)
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  // docx
  "https://cdn.jsdelivr.net/npm/docx@8.5.0",
  // qrious (cdnjs + unpkg + jsdelivr)
  "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js",
  "https://unpkg.com/qrious@4.0.2/dist/qrious.min.js",
  "https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js",
  // JSZip (cdnjs + unpkg + jsdelivr)
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  // LameJS
  "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.min.js",
  // FFmpeg (unpkg — version determined at runtime)
  "https://unpkg.com/@ffmpeg/core@0.11.1/dist/ffmpeg-core.js",
  "https://unpkg.com/@ffmpeg/core@0.12.1/dist/ffmpeg-core.js",
  // C2PA (jsdelivr)
  "https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.8.1/+esm",
  "https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.8.1/dist/resources/c2pa_bg.wasm",
];

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  var path = url.pathname;
  var lower = path.toLowerCase();

  // 1. Block known dangerous extensions (same-origin only)
  var isDangerous = DANGEROUS_EXTS.some(function (ext) {
    return lower.endsWith(ext);
  });

  var isBlocked = isDangerous;

  // 2. For same-origin requests: check local whitelists (JS/CSS/HTML/YML)
  if (url.origin === self.location.origin) {
    // Unknown .js files not in JS_WHITELIST
    if (lower.endsWith(".js"))
      isBlocked = isBlocked || JS_WHITELIST.indexOf(path) === -1;
    // Unknown .css files not in CSS_WHITELIST
    if (lower.endsWith(".css"))
      isBlocked = isBlocked || CSS_WHITELIST.indexOf(path) === -1;
    // Unknown .yml/.yaml files not in YML_WHITELIST
    if (lower.endsWith(".yml") || lower.endsWith(".yaml"))
      isBlocked = isBlocked || YML_WHITELIST.indexOf(path) === -1;
    // Unknown .html files not in HTML_WHITELIST
    if (lower.endsWith(".html"))
      isBlocked = isBlocked || HTML_WHITELIST.indexOf(path) === -1;

    // Block embedded URLs in path (same-origin only)
    var decoded = decodeURIComponent(path);
    var decodedLower = decoded.toLowerCase();
    var decoded2;
    try {
      decoded2 = decodeURIComponent(decodedLower);
    } catch (e) {
      decoded2 = "";
    }
    var hasEmbeddedUrl =
      decodedLower.includes("://") ||
      decoded2.includes("://") ||
      decodedLower.includes("%3a%2f%2f") ||
      decoded2.includes("%3a%2f%2f") ||
      decodedLower.includes("%2f%2f") ||
      decoded2.includes("%2f%2f") ||
      (/\/\/([a-z0-9]([a-z0-9-]*\.)+[a-z]{2,})/.test(decodedLower) &&
        !decodedLower.startsWith("//")) ||
      (/\/\/([a-z0-9]([a-z0-9-]*\.)+[a-z]{2,})/.test(decoded2) &&
        !decoded2.startsWith("//"));
    isBlocked = isBlocked || hasEmbeddedUrl;
  } else {
    // 3. For cross-origin (CDN) requests: check EXT_WHITELIST
    if (
      lower.endsWith(".js") ||
      lower.endsWith(".css") ||
      lower.endsWith(".html") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".wasm")
    ) {
      isBlocked = isBlocked || EXT_WHITELIST.indexOf(event.request.url) === -1;
    }
  }

  if (isBlocked) {
    event.respondWith(
      new Response(threatPage(path), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 403,
      }),
    );
    return;
  }

  // 4. Protect logo images from direct URL access / hotlinking
  if (
    (lower.endsWith("/logo.png") || lower.endsWith("/logo-black.png")) &&
    event.request.mode === "navigate"
  ) {
    event.respondWith(
      new Response(logoBlockPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 403,
      }),
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

function threatPage(filePath) {
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>⚠️ Threat Blocked — RedoSan Authenticity</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:600px;padding:40px 20px;text-align:center}.icon{font-size:72px;margin-bottom:20px}h1{color:#ff4757;font-size:28px;margin-bottom:16px}.file-path{background:#1a1a2e;padding:12px 16px;border-radius:8px;word-break:break-all;font-family:monospace;margin:20px 0;border:1px solid #ff475740;color:#ff6b81;font-size:14px}p{color:#a0a0b0;line-height:1.6;margin-bottom:12px}.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#6C5CE7;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;border:none;cursor:pointer}.btn:hover{background:#5f4dd1}.ext-list{margin-top:20px;font-size:13px;color:#606070}.note{font-size:13px;color:#505060;margin-top:24px;padding:12px;background:#12121a;border-radius:6px;border:1px solid #2a2a3a}</style></head><body><div class="container"><div class="icon">&#x26A0;&#xFE0F;</div><h1>Security Threat Blocked</h1><p>This URL appears to be a malicious file disguised as a legitimate resource.</p><div class="file-path">' +
    escapeHtml(filePath) +
    '</div><p>&#x1F512; RedoSan Authenticity is a client-side digital authenticity tool. It does <strong>not</strong> serve executable files, scripts, or unknown JavaScript files. If you received this link from someone, it is likely a scam or phishing attempt.</p><a href="/RedoSan-Authenticity/" class="btn">Return to Safety</a><div class="ext-list">Blocked: .exe .msi .bat .ps1 .vbs .dll .jar .sh .py .elf .so .deb .rpm .lua .apk + all unknown .js / .css / .html / .yml files</div><div class="note">If you believe this is a mistake, please report it on <a href="https://github.com/Redo-San/RedoSan-Authenticity/issues" style="color:#6C5CE7" target="_blank" rel="noopener">GitHub Issues</a>.</div></div></body></html>'
  );
}

function logoBlockPage() {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Protected — RedoSan Authenticity</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:500px;padding:40px 20px;text-align:center}.icon{font-size:64px;margin-bottom:20px}h1{color:#6C5CE7;font-size:24px;margin-bottom:12px}p{color:#a0a0b0;line-height:1.6}.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#6C5CE7;color:#fff;text-decoration:none;border-radius:8px}</style></head><body><div class="container"><div class="icon">&#x1F512;</div><h1>This image is protected</h1><p>The RedoSan Authenticity logo is a protected asset. Direct downloads are blocked. Please visit the main site to view it.</p><a href="/RedoSan-Authenticity/" class="btn">Go to Home</a></div></body></html>';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
