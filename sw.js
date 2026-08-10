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
var JS_WHITELIST = new Set([
  "/RedoSan-Authenticity/sw.js",
  "/RedoSan-Authenticity/Style/shared_validation.js",
  "/RedoSan-Authenticity/Style/shared.js",
  "/RedoSan-Authenticity/Style/navigation.js",
  "/RedoSan-Authenticity/Style/i18n.js",
  "/RedoSan-Authenticity/Style/search.js",
  "/RedoSan-Authenticity/Style/loader.js",
  "/RedoSan-Authenticity/Style/mpa-router.js",
  "/RedoSan-Authenticity/Style/music-player.js",
  "/RedoSan-Authenticity/Certificate/certificate.js",
  "/RedoSan-Authenticity/Certificate/certificate_docx.js",
  "/RedoSan-Authenticity/Certificate/certificate_epub.js",
  "/RedoSan-Authenticity/Certificate/certificate_ots.js",
  "/RedoSan-Authenticity/Certificate/certificate_pdf.js",
  "/RedoSan-Authenticity/Certificate/certificate_utils.js",
  "/RedoSan-Authenticity/Watermark/watermark.js",
  "/RedoSan-Authenticity/Watermark/watermark_core.js",
  "/RedoSan-Authenticity/Watermark/utils.js",
  "/RedoSan-Authenticity/Pixel_Injection/pixel_injection.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_core_advanced.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_core_transforms.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_core_algorithms.js",
  "/RedoSan-Authenticity/Pixel_Injection/watermark_advanced_ui.js",
  "/RedoSan-Authenticity/Pixel_Injection/advanced_watermarking.js",
  "/RedoSan-Authenticity/Forensic/forensic_core.js",
  "/RedoSan-Authenticity/Forensic/forensic.js",
  "/RedoSan-Authenticity/Timestamp/timestamp.js",
  "/RedoSan-Authenticity/Decentralized_Identity_DID/did.js",
  "/RedoSan-Authenticity/Fingerprint/hashing_perceptual.js",
  "/RedoSan-Authenticity/Fingerprint/hashing.js",
  "/RedoSan-Authenticity/Fingerprint/hash_worker.js",
  "/RedoSan-Authenticity/Fingerprint/fingerprint_ui.js",
  "/RedoSan-Authenticity/C2PA/cbor.js",
  "/RedoSan-Authenticity/C2PA/c2pa.js",
  "/RedoSan-Authenticity/Metadata/metadata.js",
  "/RedoSan-Authenticity/Converter/converter.js",
  "/RedoSan-Authenticity/Converter/ffmpeg-worker.js",
  "/RedoSan-Authenticity/Converter/ffmpeg.min.js",
  "/RedoSan-Authenticity/Audio_Watermark/audio_watermark_core.js",
  "/RedoSan-Authenticity/Audio_Watermark/audio_watermark.js",
  "/RedoSan-Authenticity/Assistant/assistant_data.js",
  "/RedoSan-Authenticity/Assistant/assistant.js",
  "/RedoSan-Authenticity/Face_Biometric/face_engine.js",
  "/RedoSan-Authenticity/Face_Biometric/face_registry.js",
  "/RedoSan-Authenticity/Face_Biometric/face_ui.js",
  "/RedoSan-Authenticity/vendor/jspdf.umd.min.js",
  "/RedoSan-Authenticity/vendor/qrious.min.js",
  "/RedoSan-Authenticity/vendor/jszip.min.js",
  "/RedoSan-Authenticity/vendor/docx.umd.min.js",
  "/RedoSan-Authenticity/vendor/opentimestamps.min.js",
  "/RedoSan-Authenticity/Forensic/forensic.js",
  "/RedoSan-Authenticity/Forensic/forensic_core.js",
  "/RedoSan-Authenticity/ID_Forge/id_forge.js",
  "/RedoSan-Authenticity/Removal_Tools/removal_tools.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark_core.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark_report.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark_pdf.js",
  "/RedoSan-Authenticity/Document_Watermark/text_extractor.js",
  "/RedoSan-Authenticity/Document_Watermark/document_watermark.js",
  "/RedoSan-Authenticity/vendor/pdf-lib.min.js",
  "/RedoSan-Authenticity/scripts/fix-orphan-labels.js",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/eslint.config.mjs",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/commitlint.config.mjs",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/madge.config.js",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/workbox-config.js",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/lighthouserc.js",
  "/RedoSan-Authenticity/jsdom-test-config.js",
  "/RedoSan-Authenticity/dev-server.js",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/stryker.conf.js",
  "/RedoSan-Authenticity/sw-precache.js",
  // 10-step wizard (simplified.js)
  "/RedoSan-Authenticity/Style/simplified.js",
  "/RedoSan-Authenticity/Style/simplified_countries.js",
  "/RedoSan-Authenticity/Style/simplified_helpers.js",
  "/RedoSan-Authenticity/Style/simplified_renderers.js",
  // i18n data files (8 languages)
  "/RedoSan-Authenticity/Style/lang/i18n-data.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-ar.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-de.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-en.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-es.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-fr.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-ja.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-ko.js",
  "/RedoSan-Authenticity/Style/lang/i18n-data-zh.js",
  // Maintenance scripts
  "/RedoSan-Authenticity/scripts/build-search-index.js",
  "/RedoSan-Authenticity/scripts/e2e-coverage-guard.js",
  "/RedoSan-Authenticity/scripts/sync-i18n-json-to-js.js",
  "/RedoSan-Authenticity/scripts/translate-i18n.js",
]);

// Whitelist of legitimate CSS files served by the site.
// Any .css request not in this list is treated as a threat.
var CSS_WHITELIST = new Set([
  "/RedoSan-Authenticity/Style/style.css",
  "/RedoSan-Authenticity/Style/rtl.css",
  "/RedoSan-Authenticity/Style/responsive.css",
  "/RedoSan-Authenticity/Style/music-player.css",
  // Per-page MPA styles (style.css + responsive.css per page)
  "/RedoSan-Authenticity/Style/pages/about/css/style.css",
  "/RedoSan-Authenticity/Style/pages/about/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/audio-watermark/css/style.css",
  "/RedoSan-Authenticity/Style/pages/audio-watermark/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/c2pa/css/style.css",
  "/RedoSan-Authenticity/Style/pages/c2pa/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/certificate/css/style.css",
  "/RedoSan-Authenticity/Style/pages/certificate/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/contact/css/style.css",
  "/RedoSan-Authenticity/Style/pages/contact/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/converter/css/style.css",
  "/RedoSan-Authenticity/Style/pages/converter/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/did/css/style.css",
  "/RedoSan-Authenticity/Style/pages/did/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/document-watermark/css/style.css",
  "/RedoSan-Authenticity/Style/pages/document-watermark/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/fingerprint/css/style.css",
  "/RedoSan-Authenticity/Style/pages/fingerprint/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/forensic/css/style.css",
  "/RedoSan-Authenticity/Style/pages/forensic/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/home/css/style.css",
  "/RedoSan-Authenticity/Style/pages/home/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/id_forge/css/style.css",
  "/RedoSan-Authenticity/Style/pages/id_forge/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/metadata/css/style.css",
  "/RedoSan-Authenticity/Style/pages/metadata/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/pixel-injection/css/style.css",
  "/RedoSan-Authenticity/Style/pages/pixel-injection/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/privacy/css/style.css",
  "/RedoSan-Authenticity/Style/pages/privacy/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/removal-tools/css/style.css",
  "/RedoSan-Authenticity/Style/pages/removal-tools/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/search/css/style.css",
  "/RedoSan-Authenticity/Style/pages/search/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/social/css/style.css",
  "/RedoSan-Authenticity/Style/pages/social/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/timestamp/css/style.css",
  "/RedoSan-Authenticity/Style/pages/timestamp/css/responsive.css",
  "/RedoSan-Authenticity/Style/pages/watermark/css/style.css",
  "/RedoSan-Authenticity/Style/pages/watermark/css/responsive.css",
]);

// Whitelist of legitimate YML/YAML files (GitHub workflows, configs).
// Any .yml/.yaml request not in this list is treated as a threat.
var YML_WHITELIST = new Set([
  "/RedoSan-Authenticity/.github/workflows/deploy-pages.yml",
  "/RedoSan-Authenticity/.github/workflows/a11y-fix.yml",
  "/RedoSan-Authenticity/.github/workflows/ci.yml",
  "/RedoSan-Authenticity/.github/workflows/codeql.yml",
  "/RedoSan-Authenticity/.github/workflows/codebase-audit.yml",
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
  "/RedoSan-Authenticity/.github/workflows/gemini-analysis.yml",
  "/RedoSan-Authenticity/.github/workflows/semgrep.yml",
  "/RedoSan-Authenticity/.github/workflows/ollama-analysis.yml",
  "/RedoSan-Authenticity/.github/workflows/code-review-openrouter.yml",
  "/RedoSan-Authenticity/.github/workflows/minimal-dispatch.yml",
  "/RedoSan-Authenticity/.github/dependabot.yml",
  "/RedoSan-Authenticity/.github/labeler.yml",
  "/RedoSan-Authenticity/.github/ISSUE_TEMPLATE/bug_report.yml",
  "/RedoSan-Authenticity/.github/ISSUE_TEMPLATE/feature_request.yml",
  "/RedoSan-Authenticity/.github/workflows/madge-check.yml",
  "/RedoSan-Authenticity/.github/workflows/cspell-check.yml",
  "/RedoSan-Authenticity/.github/workflows/depcheck.yml",
  "/RedoSan-Authenticity/.github/workflows/markdownlint.yml",
  "/RedoSan-Authenticity/.github/workflows/size-limit.yml",
  "/RedoSan-Authenticity/.github/workflows/typedoc-check.yml",
  "/RedoSan-Authenticity/.github/workflows/backstop.yml",
  "/RedoSan-Authenticity/.github/ISSUE_TEMPLATE/security_vulnerability.yml",
  "/RedoSan-Authenticity/.github/workflows/a11y.yml",
  "/RedoSan-Authenticity/.github/workflows/e2e-coverage-guard.yml",
  "/RedoSan-Authenticity/.github/workflows/lint.yml",
  "/RedoSan-Authenticity/.github/workflows/openrouter-analysis.yml",
  "/RedoSan-Authenticity/.github/workflows/performance.yml",
  "/RedoSan-Authenticity/.github/workflows/security.yml",
]);

// Whitelist of legitimate HTML pages served by the site.
// Any .html request not in this list is treated as a threat.
var HTML_WHITELIST = new Set([
  "/RedoSan-Authenticity/index.html",
  "/RedoSan-Authenticity/404.html",
  "/RedoSan-Authenticity/Style/index.html",
  // Standalone MPA pages
  "/RedoSan-Authenticity/Style/pages/home/index.html",
  "/RedoSan-Authenticity/Style/pages/watermark/index.html",
  "/RedoSan-Authenticity/Style/pages/audio-watermark/index.html",
  "/RedoSan-Authenticity/Style/pages/fingerprint/index.html",
  "/RedoSan-Authenticity/Style/pages/search/index.html",
  "/RedoSan-Authenticity/Style/pages/pixel-injection/index.html",
  "/RedoSan-Authenticity/Style/pages/metadata/index.html",
  "/RedoSan-Authenticity/Style/pages/timestamp/index.html",
  "/RedoSan-Authenticity/Style/pages/did/index.html",
  "/RedoSan-Authenticity/Style/pages/c2pa/index.html",
  "/RedoSan-Authenticity/Style/pages/certificate/index.html",
  "/RedoSan-Authenticity/Style/pages/forensic/index.html",
  "/RedoSan-Authenticity/Style/pages/converter/index.html",
  "/RedoSan-Authenticity/Style/pages/removal-tools/index.html",
  "/RedoSan-Authenticity/Style/pages/id_forge/index.html",
  "/RedoSan-Authenticity/Style/pages/document-watermark/index.html",
  "/RedoSan-Authenticity/Style/pages/about/index.html",
  "/RedoSan-Authenticity/Style/pages/privacy/index.html",
  "/RedoSan-Authenticity/Style/pages/contact/index.html",
  "/RedoSan-Authenticity/Style/pages/social/index.html",
  "/RedoSan-Authenticity/Style/pages/_page_template.html",
]);

// Whitelist of legitimate JSON config files.
// Any .json request not in this list is treated as a threat.
var JSON_WHITELIST = new Set([
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/.markdownlint.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/.stylelintrc.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/backstop.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/biome.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/cspell.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/typedoc.json",
  "/RedoSan-Authenticity/package.json",
  "/RedoSan-Authenticity/package-lock.json",
  "/RedoSan-Authenticity/.tools/Developer_Toolkit/.c8rc.json",
  // i18n language packs (fetched at runtime by Style/i18n.js)
  "/RedoSan-Authenticity/Style/lang/ar.json",
  "/RedoSan-Authenticity/Style/lang/de.json",
  "/RedoSan-Authenticity/Style/lang/en.json",
  "/RedoSan-Authenticity/Style/lang/es.json",
  "/RedoSan-Authenticity/Style/lang/fr.json",
  "/RedoSan-Authenticity/Style/lang/ja.json",
  "/RedoSan-Authenticity/Style/lang/ko.json",
  "/RedoSan-Authenticity/Style/lang/zh.json",
  // Pre-built search index (fetched by Style/search.js)
  "/RedoSan-Authenticity/Style/pages/search/search-index.json",
]);

// Whitelist of legitimate Markdown files served by the site.
// Any .md request not in this list is treated as a threat.
var MD_WHITELIST = new Set([
  "/RedoSan-Authenticity/README.md",
  "/RedoSan-Authenticity/CONTRIBUTING.md",
  "/RedoSan-Authenticity/AGENTS.md",
  "/RedoSan-Authenticity/.github/PULL_REQUEST_TEMPLATE.md",
  "/RedoSan-Authenticity/.github/SECURITY.md",
]);

// Whitelist of legitimate XML files served by the site.
// Any .xml request not in this list is treated as a threat.
var XML_WHITELIST = new Set(["/RedoSan-Authenticity/sitemap.xml"]);

// Whitelist of known external libraries loaded from CDNs.
// Any cross-origin request for a script/library not in this list is blocked.
var EXT_WHITELIST = [
  // jsPDF (cdnjs + unpkg + jsdelivr)
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  // docx
  "https://cdn.jsdelivr.net/npm/docx@8.5.0",
  "https://unpkg.com/docx@8.5.0/build/index.umd.js",
  "https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/index.umd.js",
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
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return caches.delete(k);
          }),
        );
      }),
    ]),
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  var path = url.pathname;
  var lower = path.toLowerCase();
  var normalizedPath;
  var pageMatch;
  var altPath;
  var decoded;
  var decodedLower;
  var decoded2;
  var hasEmbeddedUrl;

  // Whitelist match that also accepts paths without the /RedoSan-Authenticity
  // prefix (dev/test servers serve the repo at root).
  /**
   *
   * @param list
   * @param p
   */
  function inWhitelist(list, p) {
    if (list.has(p)) return true;
    if (p.indexOf("/RedoSan-Authenticity") !== 0) {
      // Production layout: <root>/Style/<asset>
      if (list.has("/RedoSan-Authenticity" + p)) return true;
      // Dev server rewrites /style.css → Style/style.css
      return list.has("/RedoSan-Authenticity/Style" + p);
    }
    return false;
  }

  // 1. Block known dangerous extensions (same-origin only)
  var isDangerous = DANGEROUS_EXTS.some(function (ext) {
    return lower.endsWith(ext);
  });

  var isBlocked = isDangerous;

  // 2. For same-origin requests: check local whitelists (JS/CSS/HTML/YML)
  if (url.origin === self.location.origin) {
    // Unknown .js files not in JS_WHITELIST
    if (lower.endsWith(".js"))
      isBlocked = isBlocked || !inWhitelist(JS_WHITELIST, path);
    // Unknown .mjs files not in JS_WHITELIST
    if (lower.endsWith(".mjs"))
      isBlocked = isBlocked || !inWhitelist(JS_WHITELIST, path);
    // Unknown .css files not in CSS_WHITELIST
    if (lower.endsWith(".css"))
      isBlocked = isBlocked || !inWhitelist(CSS_WHITELIST, path);
    // Unknown .yml/.yaml files not in YML_WHITELIST
    if (lower.endsWith(".yml") || lower.endsWith(".yaml"))
      isBlocked = isBlocked || !inWhitelist(YML_WHITELIST, path);
    // Unknown .json files not in JSON_WHITELIST
    if (lower.endsWith(".json"))
      isBlocked = isBlocked || !inWhitelist(JSON_WHITELIST, path);
    // Unknown .md files not in MD_WHITELIST
    if (lower.endsWith(".md"))
      isBlocked = isBlocked || !inWhitelist(MD_WHITELIST, path);
    // Unknown .xml files not in XML_WHITELIST
    if (lower.endsWith(".xml"))
      isBlocked = isBlocked || !inWhitelist(XML_WHITELIST, path);
    // Unknown .html files not in HTML_WHITELIST
    if (lower.endsWith(".html")) {
      // Normalize: if path has /pages/<extra>/<service>/index.html where extra isn't a page dir,
      // rewrite to /pages/<service>/index.html before checking whitelist
      normalizedPath = path;
      pageMatch = lower.match(
        /\/pages\/[^/]+\/([a-z][a-z0-9_-]*)\/index\.html$/,
      );
      if (pageMatch && !inWhitelist(HTML_WHITELIST, path)) {
        altPath =
          "/RedoSan-Authenticity/Style/pages/" + pageMatch[1] + "/index.html";
        if (inWhitelist(HTML_WHITELIST, altPath)) {
          normalizedPath = altPath;
          // Also update path for future matching
          path = altPath;
          lower = altPath.toLowerCase();
        }
      }
      isBlocked = isBlocked || !inWhitelist(HTML_WHITELIST, normalizedPath);
    }

    // Block embedded URLs in path (same-origin only)
    decoded = decodeURIComponent(path);
    decodedLower = decoded.toLowerCase();
    try {
      decoded2 = decodeURIComponent(decodedLower);
    } catch {
      decoded2 = "";
    }
    hasEmbeddedUrl =
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
      isBlocked =
        isBlocked ||
        !EXT_WHITELIST.some(function (allowed) {
          return event.request.url.indexOf(allowed) === 0;
        });
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
    (lower.endsWith("/logo.png") ||
      lower.endsWith("/logo.webp") ||
      lower.endsWith("/logo-black.png")) &&
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

  event.respondWith(
    fetch(event.request)
      .catch(function () {
        // Transient network error — retry once for navigations to avoid a
        // white screen, then surface a clean network error.
        if (event.request.mode === "navigate") {
          return fetch(event.request);
        }
        throw new TypeError("Network request failed");
      })
      .catch(function () {
        return Response.error();
      }),
  );
});

/**
 *
 * @param filePath
 */
function threatPage(filePath) {
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>⚠️ Threat Blocked — RedoSan Authenticity</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:600px;padding:40px 20px;text-align:center}.icon{font-size:72px;margin-bottom:20px}h1{color:#ff4757;font-size:28px;margin-bottom:16px}.file-path{background:#1a1a2e;padding:12px 16px;border-radius:8px;word-break:break-all;font-family:monospace;margin:20px 0;border:1px solid #ff475740;color:#ff6b81;font-size:14px}p{color:#a0a0b0;line-height:1.6;margin-bottom:12px}.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#6C5CE7;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;border:none;cursor:pointer}.btn:hover{background:#5f4dd1}.ext-list{margin-top:20px;font-size:13px;color:#606070}.note{font-size:13px;color:#505060;margin-top:24px;padding:12px;background:#12121a;border-radius:6px;border:1px solid #2a2a3a}</style></head><body><div class="container"><div class="icon">&#x26A0;&#xFE0F;</div><h1>Security Threat Blocked</h1><p>This URL appears to be a malicious file disguised as a legitimate resource.</p><div class="file-path">' +
    escapeHtml(filePath) +
    '</div><p>&#x1F512; RedoSan Authenticity is a client-side digital authenticity tool. It does <strong>not</strong> serve executable files, scripts, or unknown JavaScript files. If you received this link from someone, it is likely a scam or phishing attempt.</p><a href="/RedoSan-Authenticity/" class="btn">Return to Safety</a><div class="ext-list">Blocked: .exe .msi .bat .ps1 .vbs .dll .jar .sh .py .elf .so .deb .rpm .lua .apk + all unknown .js / .mjs / .css / .html / .yml / .json / .md / .xml files</div><div class="note">If you believe this is a mistake, please report it on <a href="https://github.com/Redo-San/RedoSan-Authenticity/issues" style="color:#6C5CE7" target="_blank" rel="noopener">GitHub Issues</a>.</div></div></body></html>'
  );
}

/**
 *
 */
function logoBlockPage() {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Protected — RedoSan Authenticity</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:500px;padding:40px 20px;text-align:center}.icon{font-size:64px;margin-bottom:20px}h1{color:#6C5CE7;font-size:24px;margin-bottom:12px}p{color:#a0a0b0;line-height:1.6}.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#6C5CE7;color:#fff;text-decoration:none;border-radius:8px}</style></head><body><div class="container"><div class="icon">&#x1F512;</div><h1>This image is protected</h1><p>The RedoSan Authenticity logo is a protected asset. Direct downloads are blocked. Please visit the main site to view it.</p><a href="/RedoSan-Authenticity/" class="btn">Go to Home</a></div></body></html>';
}

/**
 *
 * @param str
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
