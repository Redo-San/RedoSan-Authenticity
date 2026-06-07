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
// ── Sidebar toggle ──
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
  document.body.classList.toggle("no-scroll");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
  document.body.classList.remove("no-scroll");
}

// ── Page navigation ──
document
  .querySelectorAll(
    ".nav-links a[data-page], .footer-links a[data-page], .sidebar a[data-page]",
  )
  .forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      showPage(a.dataset.page);
      if (a.closest(".sidebar")) closeSidebar();
    });
  });
document.querySelectorAll(".simple-nav-links a[data-page]").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    showStaticPage(a.dataset.page);
  });
});
document.querySelectorAll(".card[data-page]").forEach((c) => {
  c.addEventListener("click", (e) => {
    e.preventDefault();
    showPage(c.dataset.page);
  });
});

var PAGE_TITLES = {
  home: "RedoSan Authenticity — Digital Watermark, Fingerprint &amp; Metadata Tool",
  watermark: "Digital Watermark — RedoSan Authenticity",
  "audio-watermark": "Audio Watermark — RedoSan Authenticity",
  "pixel-injection": "Pixel Injection — RedoSan Authenticity",
  forensic: "Forensic Analyzer — RedoSan Authenticity",
  fingerprint: "Fingerprint &amp; Image Hashing — RedoSan Authenticity",
  metadata: "Metadata &amp; EXIF Reader — RedoSan Authenticity",
  timestamp: "Timestamp &amp; OTS Verification — RedoSan Authenticity",
  did: "Decentralized Identity (DID) — RedoSan Authenticity",
  c2pa: "C2PA Content Provenance — RedoSan Authenticity",
  certificate: "Digital Passport Certificate — RedoSan Authenticity",
  converter: "File Converter — RedoSan Authenticity",
  id_forge: "ID Forge — RedoSan Authenticity",
  "document-watermark": "Document Watermark — RedoSan Authenticity",
};
var PAGE_DESCS = {
  home: "Free online digital authenticity tool for watermarking, fingerprinting, metadata reading, and timestamping images. 100% browser-based, nothing uploaded.",
  watermark:
    "Embed and extract digital watermarks in images using LSB, DCT, DWT, and neural-style algorithms. Free online tool.",
  "audio-watermark":
    "Embed and extract hidden messages in WAV audio files using LSB, Echo Hiding, and QIM algorithms. 100% browser-based.",
  "pixel-injection":
    "Advanced pixel injection for steganography with 20+ algorithms including enhanced LSB, DCT, and DWT. Free online tool.",
  forensic:
    "Analyze images for tamper signals with ELA, noise inconsistency, JPEG structure, and copy-move detection.",
  fingerprint:
    "Calculate cryptographic fingerprints (SHA-256, BLAKE3, MD5) and perceptual image hashes. Free online tool.",
  metadata:
    "Read EXIF metadata, dimensions, format, and color mode from images. Free online tool.",
  timestamp:
    "Create SHA-256 hashes and verify with OpenTimestamps. Free online tool.",
  did: "Generate a Decentralized Identifier (DID) and sign file fingerprints to prove content authorship. Free online tool.",
  c2pa: "Read and write C2PA content provenance metadata for images. Free online tool.",
  certificate:
    "Generate a signed Digital Passport PDF, DOCX, or EPUB with image, user info, and authenticity results. Free online tool.",
  converter:
    "Convert images, audio, and documents between formats. Free online file converter.",
  id_forge:
    "Generate UUIDs, ULIDs, Nano IDs, and SWHIDs — unique identifiers for any project. Free online tool.",
  "document-watermark":
    "Embed and extract invisible watermarks in text documents using Zero-Width Characters, Unicode Homoglyphs, and Whitespace Replacement. Free online tool.",
};

function showPage(name) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar a[data-page]")
    .forEach((a) => a.classList.remove("active"));
  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");
  const nav = document.querySelector('.sidebar a[data-page="' + name + '"]');
  if (nav) nav.classList.add("active");
  if (name && PAGE_TITLES[name]) {
    document.title = PAGE_TITLES[name];
  }
  if (name && PAGE_DESCS[name]) {
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", PAGE_DESCS[name]);
  }
  if (name === "timestamp") {
    if (typeof switchOtsTab === "function") switchOtsTab("create");
  }
  if (name === "certificate") {
    if (typeof initCertPhoneCode === "function") initCertPhoneCode();
  }
  if (name === "id_forge") {
    if (typeof idForgeShowInfo === "function") idForgeShowInfo();
  }
  var isProfessional =
    document.getElementById("mainNav") &&
    document.getElementById("mainNav").style.display !== "none";
  if (isProfessional) {
    try {
      if (name && name !== "home") {
        history.pushState({ page: name }, "", "#/" + name);
      } else {
        history.pushState(
          { page: "home" },
          "",
          window.location.pathname.replace(/\/+$/, "") + "/",
        );
      }
    } catch (e) {}
  }
}

// Show a static page (about/privacy/contact/social) from the mode overlay or simplified mode
function showStaticPage(name) {
  // Hide mode overlay
  var modeSelect = document.getElementById("modeSelect");
  if (modeSelect) modeSelect.style.display = "none";
  // Hide simplified mode
  var simplifiedMode = document.getElementById("simplifiedMode");
  if (simplifiedMode) simplifiedMode.style.display = "none";
  // Hide professional nav/app
  var mainNav = document.getElementById("mainNav");
  if (mainNav) mainNav.style.display = "none";
  var app = document.getElementById("app");
  if (app) app.style.display = "none";
  var sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.style.display = "none";
  var sidebarOverlay = document.getElementById("sidebarOverlay");
  if (sidebarOverlay) sidebarOverlay.style.display = "none";
  var footer = document.getElementById("mainFooter");
  if (footer) footer.style.display = "none";

  document.documentElement.style.overflow = "";
  showPage(name);
  try {
    history.pushState({ staticPage: name, fromOverlay: true }, "", "#/" + name);
  } catch (e) {}
}

function hideAllExcept(keep) {
  var ids = [
    "modeSelect",
    "simplifiedMode",
    "mainNav",
    "app",
    "sidebar",
    "sidebarOverlay",
    "mainFooter",
  ];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = id === keep ? "" : "none";
  });
}

window.addEventListener("popstate", function (e) {
  var state = e.state;
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar a[data-page]")
    .forEach((a) => a.classList.remove("active"));

  // Static page from overlay/simplified → restore the mode overlay
  if (state && state.staticPage) {
    hideAllExcept(null);
    document.getElementById("modeSelect").style.display = "";
    document.documentElement.style.overflow = "hidden";
    return;
  }

  // Mode overlay → re-show the selection screen
  if (!state || state.modeOverlay) {
    if (typeof resetProfessionalForms === "function") resetProfessionalForms();
    document.documentElement.style.overflow = "hidden";
    hideAllExcept("modeSelect");
    document.getElementById("sidebarOverlay").style.display = "none";
    return;
  }

  // Within-a-mode → restore the correct mode
  if (state.modeSet) {
    document.documentElement.style.overflow = "";
    document.getElementById("modeSelect").style.display = "none";
    document.getElementById("sidebarOverlay").style.display = "none";
    if (state.modeSet === "simplified") {
      hideAllExcept("simplifiedMode");
      document.getElementById("sidebarOverlay").style.display = "none";
    } else {
      hideAllExcept("mainNav");
      document.getElementById("app").style.display = "";
      document.getElementById("sidebar").style.display = "";
      document.getElementById("mainFooter").style.display = "";
      document.getElementById("simplifiedMode").style.display = "none";
    }
    var home = document.getElementById("page-home");
    if (home) home.classList.add("active");
    return;
  }

  // Page state (professional mode navigation)
  document.documentElement.style.overflow = "";
  document.getElementById("modeSelect").style.display = "none";
  document.getElementById("simplifiedMode").style.display = "none";
  var targetPage = (state && state.page) || "home";
  var el = document.getElementById("page-" + targetPage);
  if (el) el.classList.add("active");
  var navItem = document.querySelector(
    '.sidebar a[data-page="' + targetPage + '"]',
  );
  if (navItem) navItem.classList.add("active");
  if (
    el &&
    el.closest("#app") &&
    document.getElementById("mainNav").style.display === "none"
  ) {
    hideAllExcept("mainNav");
    document.getElementById("app").style.display = "";
    document.getElementById("sidebar").style.display = "";
  }
});

// Handle hash-based navigation on load
function handleHashNav() {
  var hash = window.location.hash;
  if (hash && hash.indexOf("#/") === 0) {
    var page = hash.replace("#/", "");
    if (page) showPage(page);
  }
  // Handle ?search= query param
  var params = new URLSearchParams(window.location.search);
  var sq = params.get("search");
  if (sq) {
    // Dismiss mode overlay if visible
    var modeSelect = document.getElementById("modeSelect");
    if (modeSelect && modeSelect.style.display !== "none") {
      if (typeof setMode === "function") {
        setMode("professional");
      } else {
        modeSelect.style.display = "none";
        document.body.classList.remove("no-scroll");
      }
    }
    setTimeout(function () {
      var inp = document.getElementById("searchInput");
      if (inp) {
        inp.value = sq;
        siteSearch();
      }
    }, 500);
  }
}
// Initialize first history state — deferred to first user gesture
function initNav() {
  handleHashNav();
}
// Defer replaceState to first user interaction to avoid Chrome marking it skippable
document.addEventListener("DOMContentLoaded", function () {
  var p = new Promise(function (r) { initNav(); r(); });
  var deferredReplace = function () {
    if (!history.state || !history.state.modeOverlay) {
      try {
        history.replaceState(
          { modeOverlay: true },
          "",
          window.location.pathname.replace(/\/+$/, "") + "/",
        );
      } catch (e) {}
    }
    document.removeEventListener("pointerdown", deferredReplace);
    document.removeEventListener("keydown", deferredReplace);
  };
  document.addEventListener("pointerdown", deferredReplace);
  document.addEventListener("keydown", deferredReplace);
});
if (document.readyState !== "loading") {
  initNav();
}

// ── Tab switching ──
function switchWmTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-wm-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("wm-embed").style.display =
    mode === "embed" ? "" : "none";
  document.getElementById("wm-extract").style.display =
    mode === "extract" ? "" : "none";
  document
    .querySelector('.tab-btn[data-wm-tab="' + mode + '"]')
    .classList.add("active");
}

function switchOtsTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-ots-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("ots-create").style.display =
    mode === "create" ? "" : "none";
  document.getElementById("ots-verify").style.display =
    mode === "verify" ? "" : "none";
  document
    .querySelector('.tab-btn[data-ots-tab="' + mode + '"]')
    .classList.add("active");
}

function showDownloadModal() {
  document.getElementById("dl-modal").classList.add("open");
}

function closeDownloadModal() {
  document.getElementById("dl-modal").classList.remove("open");
}

function downloadResult(format) {
  var handler = window._currentDownloadHandler;
  if (handler) {
    handler(format);
    return;
  }
  if (typeof downloadFingerprint === "function") {
    downloadFingerprint(format);
  }
}

function switchC2paTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-c2pa-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("c2pa-read").style.display =
    mode === "read" ? "" : "none";
  document.getElementById("c2pa-write").style.display =
    mode === "write" ? "" : "none";
  document.getElementById("c2pa-verify").style.display =
    mode === "verify" ? "" : "none";
  document
    .querySelector('.tab-btn[data-c2pa-tab="' + mode + '"]')
    .classList.add("active");
  // Hide all result sections when switching tabs
  ["c2pa-read-result", "c2pa-write-result", "c2pa-verify-result"].forEach(
    (id) => {
      document.getElementById(id).style.display = "none";
    },
  );
  if (mode === "write" && typeof updateC2paWriteForm === "function") {
    updateC2paWriteForm();
  }
}
