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
// ── Sanitize removal-tools on production ──
/**
 *
 */
function sanitizeRemovalTools() {
  if (globalThis.location.hostname !== "redo-san.github.io") return;
  var sel =
    '.sidebar a[data-page="removal-tools"], .card[data-page="removal-tools"], .footer-links a[data-page="removal-tools"]';
  document.querySelectorAll(sel).forEach(function (el) {
    el.remove();
  });
}
sanitizeRemovalTools();
// ── Standalone page detection ──
var isStandalone =
  document.documentElement && document.documentElement.dataset.standalone;

// ── Sidebar toggle ──
/**
 *
 */
function toggleSidebar() {
  document.querySelector("#sidebar").classList.toggle("open");
  document.querySelector("#sidebarOverlay").classList.toggle("open");
  document.body.classList.toggle("no-scroll");
}

/**
 *
 */
function closeSidebar() {
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#sidebarOverlay").classList.remove("open");
  document.body.classList.remove("no-scroll");
}

// ── Page navigation ──
if (!isStandalone) {
  document
    .querySelectorAll(
      ".nav-links a[data-page], .footer-links a[data-page], .sidebar a[data-page], .logo[data-page]",
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
}

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
  search: "Search — RedoSan Authenticity",
  about: "About — RedoSan Authenticity",
  privacy: "Privacy Policy — RedoSan Authenticity",
  contact: "Contact — RedoSan Authenticity",
  social: "Social Links — RedoSan Authenticity",
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
  search: "Search across all tools and pages. Free online tool.",
  about:
    "Learn about RedoSan Authenticity — a free, open-source digital authenticity tool.",
  privacy:
    "Privacy policy for RedoSan Authenticity — all processing is 100% client-side.",
  contact: "Contact information for RedoSan Authenticity support.",
  social: "Social links and community resources for RedoSan Authenticity.",
};

var PAGE_NAMES = new Set([
  "about",
  "audio-watermark",
  "c2pa",
  "certificate",
  "contact",
  "converter",
  "did",
  "document-watermark",
  "fingerprint",
  "forensic",
  "home",
  "id_forge",
  "metadata",
  "pixel-injection",
  "privacy",
  "removal-tools",
  "search",
  "social",
  "timestamp",
  "watermark",
]);

/**
 *
 * @param name
 */
function showPage(name) {
  // Clear any residual no-scroll from mode overlay transitions
  document.body.classList.remove("no-scroll");
  // Validate name against whitelist to prevent CSS selector / path injection
  if (name && !PAGE_NAMES.has(name)) return;
  const page = document.getElementById("page-" + name);

  // Standalone: if target page doesn't exist here, navigate to its standalone URL
  // This check runs before removing .active from the current page so that bfcache
  // captures the visible state, preventing a blank page on back-button navigation
  if (!page && document.documentElement.dataset.standalone && name) {
    var safeName = encodeURIComponent(name);
    var parts = globalThis.location.pathname.split("/");
    var pagesIdx = -1;
    for (const [i, part] of parts.entries()) {
      if (part === "pages") {
        pagesIdx = i;
        break;
      }
    }
    if (pagesIdx === -1) {
      globalThis.location.href = "./" + safeName + "/index.html";
    } else {
      parts = parts.slice(0, pagesIdx + 1);
      parts.push(safeName, "index.html");
      globalThis.location.href = parts.join("/");
    }
    return;
  }

  // Hybrid: on root page (no dataset.standalone), if page section doesn't exist,
  // delegate to mpa-router for AJAX content loading
  if (!page && !document.documentElement.dataset.standalone && name) {
    if (typeof globalThis.__mpaNavigate === "function") {
      globalThis.__mpaNavigate(name);
    } else {
      // Fallback: just show mode overlay
      var modeSelect = document.querySelector("#modeSelect");
      if (modeSelect) modeSelect.style.display = "";
    }
    return;
  }

  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar a[data-page]")
    .forEach((a) => a.classList.remove("active"));

  if (page) {
    page.classList.add("active");
    // Ensure app container is visible (page section is inside #app)
    var app = document.querySelector("#app");
    if (app && app.style.display === "none") app.style.display = "";
  }
  if (name) {
    const nav = document.querySelector('.sidebar a[data-page="' + name + '"]');
    if (nav) nav.classList.add("active");
  }
  if (name && PAGE_TITLES[name]) {
    document.title = PAGE_TITLES[name];
  }
  if (name && PAGE_DESCS[name]) {
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", PAGE_DESCS[name]);
  }
  if (name && typeof globalThis.__mpaNavigate !== "function") {
    // Only push hash state when mpa-router is NOT available
    var isProfessional =
      document.querySelector("#mainNav") &&
      document.querySelector("#mainNav").style.display !== "none";
    if (isProfessional && !document.documentElement.dataset.standalone) {
      try {
        if (name && name !== "home") {
          history.pushState({ page: name }, "", "#/" + name);
        } else {
          history.pushState(
            { page: "home" },
            "",
            globalThis.location.pathname.replace(/\/+$/, "") + "/",
          );
        }
      } catch {}
    }
  }
}

// Show a static page (about/privacy/contact/social) from the mode overlay or simplified mode
/**
 *
 * @param name
 */
function showStaticPage(name) {
  // Hide mode overlay
  var modeSelect = document.querySelector("#modeSelect");
  if (modeSelect) modeSelect.style.display = "none";
  // Hide simplified mode
  var simplifiedMode = document.querySelector("#simplifiedMode");
  if (simplifiedMode) simplifiedMode.style.display = "none";
  // Hide professional nav/app
  var mainNav = document.querySelector("#mainNav");
  if (mainNav) mainNav.style.display = "none";
  var app = document.querySelector("#app");
  if (app) app.style.display = "";
  var sidebar = document.querySelector("#sidebar");
  if (sidebar) sidebar.style.display = "none";
  var sidebarOverlay = document.querySelector("#sidebarOverlay");
  if (sidebarOverlay) sidebarOverlay.style.display = "none";
  var footer = document.querySelector("#mainFooter");
  if (footer) footer.style.display = "none";

  document.body.classList.remove("no-scroll");
  showPage(name);
  try {
    history.pushState({ staticPage: name, fromOverlay: true }, "", "#/" + name);
  } catch {}
}

/**
 *
 * @param keep
 */
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

globalThis.addEventListener("popstate", function (e) {
  // Standalone MPA pages: handled by mpa-router.js (AJAX navigation)
  if (document.documentElement.dataset.standalone) return;
  var state = e.state;
  // Hybrid mode: mpa-router handles professional mode page navigation
  // Only handle mode overlay, static page, and mode modeSet transitions here
  if (
    typeof globalThis.__mpaNavigate === "function" &&
    !document.querySelector("#page-home")
  ) {
    if (state && (state.staticPage || state.modeSet)) {
      // Handled below
    } else if (!state || state.modeOverlay) {
      // Fall through to mode overlay handler below
    } else if (state.routerPage) {
      return; // mpa-router handles this
    } else {
      return; // Unknown state — let mpa-router handle it
    }
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar a[data-page]")
    .forEach((a) => a.classList.remove("active"));

  // Static page from overlay/simplified → show the static page (don't go back to overlay)
  if (state && state.staticPage) {
    document.body.classList.remove("no-scroll");
    document.documentElement.style.overflow = "";
    var targetPage = state.staticPage;
    var el = document.getElementById("page-" + targetPage);
    if (el) {
      el.classList.add("active");
    } else {
      hideAllExcept(null);
      document.querySelector("#modeSelect").style.display = "";
      document.documentElement.style.overflow = "hidden";
    }
    return;
  }

  // Mode overlay → re-show the selection screen
  if (!state || state.modeOverlay) {
    if (typeof resetProfessionalForms === "function") resetProfessionalForms();
    document.body.classList.add("no-scroll");
    hideAllExcept("modeSelect");
    document.querySelector("#sidebarOverlay").style.display = "none";
    return;
  }

  // Within-a-mode → restore the correct mode
  if (state.modeSet) {
    document.body.classList.remove("no-scroll");
    document.querySelector("#modeSelect").style.display = "none";
    document.querySelector("#sidebarOverlay").style.display = "none";
    if (state.modeSet === "simplified") {
      hideAllExcept("simplifiedMode");
      document.querySelector("#sidebarOverlay").style.display = "none";
    } else {
      hideAllExcept("mainNav");
      document.querySelector("#app").style.display = "";
      document.querySelector("#sidebar").style.display = "";
      document.querySelector("#mainFooter").style.display = "";
      document.querySelector("#simplifiedMode").style.display = "none";
    }
    var home = document.querySelector("#page-home");
    if (home) home.classList.add("active");
    return;
  }

  // Page state (professional mode navigation)
  document.body.classList.remove("no-scroll");
  document.querySelector("#modeSelect").style.display = "none";
  document.querySelector("#simplifiedMode").style.display = "none";
  var targetPage = (state && state.page) || "home";
  var el = document.getElementById("page-" + targetPage);
  if (el) {
    el.classList.add("active");
  } else {
    // Fallback: if target page element doesn't exist, show mode overlay
    document.documentElement.style.overflow = "hidden";
    hideAllExcept("modeSelect");
    var modeSelect = document.querySelector("#modeSelect");
    if (modeSelect) modeSelect.style.display = "";
    return;
  }
  var navItem = document.querySelector(
    '.sidebar a[data-page="' + targetPage + '"]',
  );
  if (navItem) navItem.classList.add("active");
  if (
    el &&
    el.closest("#app") &&
    document.querySelector("#mainNav").style.display === "none"
  ) {
    hideAllExcept("mainNav");
    document.querySelector("#app").style.display = "";
    document.querySelector("#sidebar").style.display = "";
  }
});

// Handle hash-based navigation on load
/**
 *
 */
function handleHashNav() {
  var hash = globalThis.location.hash;
  if (hash && hash.indexOf("#/") === 0) {
    var page = hash.replace("#/", "");
    if (page) showPage(page);
  }
  // Handle ?search= query param
  var params = new URLSearchParams(globalThis.location.search);
  var sq = params.get("search");
  if (sq) {
    // Dismiss mode overlay if visible
    var modeSelect = document.querySelector("#modeSelect");
    if (modeSelect && modeSelect.style.display !== "none") {
      if (typeof setMode === "function") {
        setMode("professional");
      } else {
        modeSelect.style.display = "none";
        document.body.classList.remove("no-scroll");
      }
    }
    setTimeout(function () {
      var inp = document.querySelector("#searchInput");
      if (inp) {
        inp.value = sq;
        siteSearch();
      }
    }, 500);
  }
}
// Initialize first history state — deferred to first user gesture
/**
 *
 */
function initNav() {
  handleHashNav();
}
// Defer replaceState to first user interaction to avoid Chrome marking it skippable
document.addEventListener("DOMContentLoaded", function () {
  sanitizeRemovalTools();
  initNav();
  var deferredReplace = function () {
    if (!history.state || !history.state.modeOverlay) {
      try {
        var p = globalThis.location.pathname
          .replace(/\/+$/, "")
          .replace(/\/index\.html$/i, "");
        history.replaceState({ modeOverlay: true }, "", p + "/");
      } catch {}
    }
    document.removeEventListener("pointerdown", deferredReplace);
    document.removeEventListener("keydown", deferredReplace);
  };
  document.addEventListener("pointerdown", deferredReplace);
  document.addEventListener("keydown", deferredReplace);
});

// ── Tab switching ──
/**
 *
 * @param mode
 */
function switchWmTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-wm-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector("#wm-embed").style.display =
    mode === "embed" ? "" : "none";
  document.querySelector("#wm-extract").style.display =
    mode === "extract" ? "" : "none";
  document
    .querySelector('.tab-btn[data-wm-tab="' + mode + '"]')
    .classList.add("active");
}

/**
 *
 * @param mode
 */
function switchOtsTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-ots-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector("#ots-create").style.display =
    mode === "create" ? "" : "none";
  document.querySelector("#ots-verify").style.display =
    mode === "verify" ? "" : "none";
  document
    .querySelector('.tab-btn[data-ots-tab="' + mode + '"]')
    .classList.add("active");
}

/**
 *
 */
function showDownloadModal() {
  document.querySelector("#dl-modal").classList.add("open");
}

/**
 *
 */
function closeDownloadModal() {
  document.querySelector("#dl-modal").classList.remove("open");
}

/**
 *
 * @param format
 */
function downloadResult(format) {
  var handler = getDownloadHandler();
  if (handler) {
    handler(format);
    return;
  }
  if (typeof downloadFingerprint === "function") {
    downloadFingerprint(format);
  }
}

/**
 *
 * @param mode
 */
function switchC2paTab(mode) {
  document
    .querySelectorAll(".tab-btn[data-c2pa-tab]")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector("#c2pa-read").style.display =
    mode === "read" ? "" : "none";
  document.querySelector("#c2pa-write").style.display =
    mode === "write" ? "" : "none";
  document.querySelector("#c2pa-verify").style.display =
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

// Re-evaluate standalone status after DOMContentLoaded (data-standalone is set by MPA inline script)
document.addEventListener("DOMContentLoaded", function () {
  isStandalone =
    document.documentElement && document.documentElement.dataset.standalone;
});

// bfcache restore: re-activate page section (back/forward navigation)
window.addEventListener("pageshow", function (ev) {
  if (!ev.persisted) return;
  document.documentElement.style.overflow = "";
  document.body.classList.remove("no-scroll");
  var loader = document.querySelector("#page-loader");
  if (loader) loader.classList.add("page-loader--hidden");
  if (document.documentElement.dataset.standalone) {
    // MPA standalone: re-activate the page section if it lost .active during freeze
    var id = document.documentElement.dataset.standalone;
    var pg = document.getElementById("page-" + id);
    if (pg && !pg.classList.contains("active")) {
      pg.classList.add("active");
    }
  } else {
    // SPA: restore page section from history state
    var st = history.state;
    if (st && st.page) {
      document.querySelectorAll(".page").forEach(function (p) {
        p.classList.remove("active");
      });
      var pg2 = document.getElementById("page-" + st.page);
      if (pg2) pg2.classList.add("active");
      var nav = document.querySelector(
        '.sidebar a[data-page="' + st.page + '"]',
      );
      if (nav) nav.classList.add("active");
    } else if (st && st.staticPage) {
      document.querySelectorAll(".page").forEach(function (p) {
        p.classList.remove("active");
      });
      var pg3 = document.getElementById("page-" + st.staticPage);
      if (pg3) pg3.classList.add("active");
    } else if (!st || st.modeOverlay) {
      // Mode overlay — show it
      var modeEl = document.querySelector("#modeSelect");
      if (modeEl) modeEl.style.display = "";
    }
  }
});
