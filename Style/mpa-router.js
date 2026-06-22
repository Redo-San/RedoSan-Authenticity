(function () {
  var _fromRoot =
    !document.documentElement || !document.documentElement.dataset.standalone;
  var _currentPage = document.documentElement
    ? document.documentElement.dataset.standalone || ""
    : "";
  var _inFlight = false;
  var _lastUrl = null;
  var _savedSection = null;
  var _savedPageName = "";
  var _initialTitle = document.title;
  var _initialDesc = document.querySelector('meta[name="description"]');

  /**
   *
   */
  function getPagesBase() {
    var parts = globalThis.location.pathname.split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") return parts.slice(0, i + 1).join("/");
    }
    return "Style/pages";
  }

  /**
   *
   * @param name
   */
  function isValidPageName(name) {
    return /^[a-z0-9_-]+$/.test(name);
  }

  // ── Content cache (sessionStorage) ──
  var _pageCache = {};

  /**
   *
   * @param pageName
   * @param html
   */
  function cachePut(pageName, html) {
    _pageCache[pageName] = html;
    try {
      sessionStorage.setItem("mpa_" + pageName, html);
    } catch {}
  }

  /**
   *
   * @param pageName
   */
  function cacheGet(pageName) {
    if (_pageCache[pageName]) return _pageCache[pageName];
    try {
      var v = sessionStorage.getItem("mpa_" + pageName);
      if (v) _pageCache[pageName] = v;
      return v || null;
    } catch {
      return null;
    }
  }

  /**
   *
   * @param pageName
   */
  function cacheDel(pageName) {
    delete _pageCache[pageName];
    try {
      sessionStorage.removeItem("mpa_" + pageName);
    } catch {}
  }

  // ── UI helpers ──
  /**
   *
   */
  function enterProfessionalMode() {
    if (!_fromRoot) return;
    var modeSelect = document.querySelector("#modeSelect");
    if (modeSelect) modeSelect.style.display = "none";
    if (typeof globalThis.__musicInit === "function") globalThis.__musicInit();
    var simplifiedMode = document.querySelector("#simplifiedMode");
    if (simplifiedMode) simplifiedMode.style.display = "none";
    var mainNav = document.querySelector("#mainNav");
    if (mainNav) mainNav.style.display = "";
    var app = document.querySelector("#app");
    if (app) app.style.display = "";
    var sidebar = document.querySelector("#sidebar");
    if (sidebar) sidebar.style.display = "";
    var sidebarOverlay = document.querySelector("#sidebarOverlay");
    if (sidebarOverlay) sidebarOverlay.style.display = "";
    var mainFooter = document.querySelector("#mainFooter");
    if (mainFooter) mainFooter.style.display = "";
    document.documentElement.style.overflow = "";
    document.body.classList.remove("no-scroll");
    _fromRoot = false;
  }

  /**
   *
   */
  function exitProfessionalMode() {
    var modeSelect = document.querySelector("#modeSelect");
    if (modeSelect) {
      modeSelect.style.display = "";
      document.documentElement.style.overflow = "hidden";
      document.querySelector("#sidebarOverlay").style.display = "none";
    }
    var mainNav = document.querySelector("#mainNav");
    if (mainNav) mainNav.style.display = "none";
    var app = document.querySelector("#app");
    if (app) app.style.display = "none";
    var sidebar = document.querySelector("#sidebar");
    if (sidebar) sidebar.style.display = "none";
    var sidebarOverlay = document.querySelector("#sidebarOverlay");
    if (sidebarOverlay) sidebarOverlay.style.display = "none";
    var mainFooter = document.querySelector("#mainFooter");
    if (mainFooter) mainFooter.style.display = "none";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("no-scroll");
    _fromRoot = true;
  }

  /**
   *
   * @param pageName
   */
  function updateActiveSidebar(pageName) {
    var links = document.querySelectorAll(".sidebar a[data-page]");
    for (const link of links) {
      var lp = link.dataset.page;
      link.classList.toggle("active", lp === pageName);
    }
  }

  var _preserveIds = ["bg-music", "music-btn", "music-credit"];

  /**
   *
   */
  function ensurePreserved() {
    for (const _preserveId of _preserveIds) {
      var el = document.getElementById(_preserveId);
      if (el && !document.body.contains(el)) {
        document.body.append(el);
      }
    }
  }

  /**
   *
   * @returns {{ el: (HTMLAudioElement|null), wasPlaying: boolean }}
   */
  function _saveAudioState() {
    var a = document.querySelector("#bg-music");
    if (typeof globalThis.__musicSaveTime === "function")
      globalThis.__musicSaveTime();
    var wasPlaying = false;
    if (typeof globalThis.__musicPlayerState === "function") {
      var st = globalThis.__musicPlayerState();
      wasPlaying = st && st.playing === true;
    }
    if (!wasPlaying && a) wasPlaying = !a.paused;
    return { el: a, wasPlaying: wasPlaying };
  }

  /**
   *
   * @param {{ el: (HTMLAudioElement|null), wasPlaying: boolean }} state
   * @param {number} tries
   */
  function _resumeAudio(state, tries) {
    if (!state || !state.el) return;
    (function resume(el, t) {
      if (el.paused) {
        if (el.readyState < 2) {
          el.addEventListener(
            "canplay",
            function onCanPlay() {
              var p = el.play();
              if (p && typeof p.catch === "function") p.catch(function () {});
            },
            { once: true },
          );
        } else {
          var p = el.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        }
      }
      if (el.paused && t > 0) {
        setTimeout(function () {
          resume(el, t - 1);
        }, 100);
      }
    })(state.el, tries);
  }

  // ── Page-specific re-init after content swap ──
  /**
   *
   * @param pageName
   */
  function reInitPage(pageName) {
    // Tab-based pages: reset to default tab
    if (pageName === "timestamp" && typeof switchOtsTab === "function")
      switchOtsTab("create");
    if (pageName === "watermark" && typeof switchWmTab === "function") {
      switchWmTab("embed");
      if (typeof toggleWmPassword === "function") toggleWmPassword();
      if (typeof toggleWmExtractPassword === "function")
        toggleWmExtractPassword();
      var et = document.querySelector("#wm-type");
      if (et && typeof toggleWmPassword === "function")
        et.addEventListener("change", toggleWmPassword);
      var ext = document.querySelector("#wm-type-ex");
      if (ext && typeof toggleWmExtractPassword === "function")
        ext.addEventListener("change", toggleWmExtractPassword);
    }
    if (pageName === "c2pa" && typeof switchC2paTab === "function")
      switchC2paTab("read");
    if (
      pageName === "document-watermark" &&
      typeof switchDocwTab === "function"
    )
      switchDocwTab("embed");
    if (pageName === "audio-watermark" && typeof switchAwTab === "function")
      switchAwTab("embed");

    // Pixel Injection: re-populate algorithm dropdowns, re-attach event listeners, reset to embed tab
    if (pageName === "pixel-injection") {
      if (typeof globalThis.pixelInjection?.reInit === "function")
        globalThis.pixelInjection.reInit();
      if (typeof switchPiTab === "function") switchPiTab("embed");
    }

    // ID Forge: update info display
    if (pageName === "id_forge" && typeof idForgeShowInfo === "function")
      idForgeShowInfo();

    // Certificate: init phone code input
    if (pageName === "certificate" && typeof initCertPhoneCode === "function")
      initCertPhoneCode();

    // Re-translate page content
    if (typeof __ === "function" && typeof translatePage === "function")
      translatePage();

    // Re-init file drop zones for newly swapped content
    document.querySelectorAll("#app .file-drop-zone").forEach(function (dz) {
      var inp = dz.querySelector('input[type="file"]');
      if (inp) dz.parentNode.insertBefore(inp, dz);
      dz.remove();
    });
    if (typeof initDropZones === "function") initDropZones();

    // Reset result sections and file inputs
    var results = document.querySelectorAll(
      ".result, .result-box, .output-area, .fingerprint-result, .c2pa-result",
    );
    for (var r of results) {
      if (r && r.style) r.style.display = "none";
    }
    var fileInputs = document.querySelectorAll("#app input[type='file']");
    for (const fileInput of fileInputs) {
      fileInput.value = "";
    }
  }

  // ── Content loading (from raw HTML) ──
  /**
   *
   * @param html
   * @param url
   * @param pageName
   * @param skipPush
   */
  function loadContent(html, url, pageName, skipPush) {
    var _audioSave = _saveAudioState();

    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var newPage =
      doc.querySelector("#app > section.page.active") ||
      doc.querySelector("#app > section.page");
    if (!newPage) {
      // Fallback: full navigation
      _inFlight = false;
      _lastUrl = null;
      globalThis.location.href = url;
      return;
    }
    // Ensure the section has .active class after swap
    newPage.classList.add("active");
    var newTitle = doc.querySelector("title");
    var newDesc = doc.querySelector('meta[name="description"]');
    var app = document.querySelector("#app");
    var oldPage = app ? app.querySelector("section.page") : null;
    // Save original section before first navigation away from initial page
    if (
      !_savedSection &&
      oldPage &&
      _currentPage &&
      _currentPage !== pageName
    ) {
      _savedSection = oldPage.cloneNode(true);
      _savedPageName = _currentPage;
    }
    if (oldPage) {
      oldPage.classList.remove("active");
      oldPage.parentNode.replaceChild(newPage, oldPage);
    } else if (app) {
      app.append(newPage);
    }
    document.title = newTitle ? newTitle.textContent.trim() : document.title;
    if (newDesc) {
      var curDesc = document.querySelector('meta[name="description"]');
      if (curDesc)
        curDesc.setAttribute("content", newDesc.getAttribute("content"));
    }
    ensurePreserved();
    if (!skipPush) {
      var st = history.state || {};
      st.routerPage = pageName;
      st.url = url;
      // Use clean relative URL (preserves audio across AJAX navigations)
      history.pushState(st, "", url);
    }
    _currentPage = pageName;
    _inFlight = false;
    var loader = document.querySelector("#page-loader");
    if (loader) loader.classList.add("page-loader--hidden");
    updateActiveSidebar(pageName);
    if (typeof sanitizeRemovalTools === "function") sanitizeRemovalTools();
    reInitPage(pageName);

    if (_audioSave.wasPlaying) _resumeAudio(_audioSave, 5);
  }

  // ── Navigation ──
  /**
   *
   * @param url
   * @param pageName
   * @param skipPush
   */
  function navigateTo(url, pageName, skipPush) {
    if (_inFlight) return;
    if (url === _lastUrl) return;
    if (!isValidPageName(pageName)) {
      globalThis.location.href = url;
      return;
    }

    var cached = cacheGet(pageName);
    if (cached) {
      _inFlight = true;
      _lastUrl = url;
      // Use session cache — don't show loader
      loadContent(cached, url, pageName, skipPush);
      // Re-fetch in background to update cache
      fetch(url)
        .then(function (r) {
          if (r.ok) return r.text();
        })
        .then(function (html) {
          if (html) cachePut(pageName, html);
        })
        .catch(function () {});
      return;
    }

    _inFlight = true;
    _lastUrl = url;

    var loader = document.querySelector("#page-loader");
    if (loader) loader.classList.remove("page-loader--hidden");

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (html) {
        cachePut(pageName, html);
        loadContent(html, url, pageName, skipPush);
      })
      .catch(function () {
        _inFlight = false;
        _lastUrl = null;
        cacheDel(pageName);
        if (loader) loader.classList.add("page-loader--hidden");
        globalThis.location.href = url;
      });
  }

  // ── Click interception ──
  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href) return;
    var pageName = null;
    if (/^(?:\.\.\/)+([^/]+)\/index\.html$/.test(href)) {
      pageName = RegExp.$1;
    } else if (/^(?:\.\/)?Style\/pages\/([^/]+)\/index\.html$/.test(href)) {
      pageName = RegExp.$1;
    }
    if (!pageName) return;
    if (pageName === _currentPage) return;
    if (pageName === "removal-tools") return;
    if (link.getAttribute("target") === "_blank") return;
    if (link.hasAttribute("download")) return;
    e.preventDefault();
    enterProfessionalMode();
    navigateTo(href, pageName);
  });

  // ── Popstate ──
  globalThis.addEventListener("popstate", function (e) {
    var st = e.state;
    var pageName = st && st.routerPage;

    // Handle back to initial state (null state or mode overlay)
    if (!pageName) {
      if (_savedSection && document.querySelector("#app")) {
        var _popAudio = _saveAudioState();

        // Restore original section without full page reload
        var app = document.querySelector("#app");
        var oldPage = app.querySelector("section.page");
        if (oldPage) {
          oldPage.parentNode.replaceChild(_savedSection, oldPage);
          _savedSection = null;
        }
        _currentPage =
          _savedPageName || document.documentElement.dataset.standalone || "";
        _lastUrl = null;
        document.title = _initialTitle;
        if (_initialDesc)
          _initialDesc.setAttribute(
            "content",
            _initialDesc.getAttribute("content"),
          );
        updateActiveSidebar(_currentPage);
        ensurePreserved();
        if (_popAudio.wasPlaying) _resumeAudio(_popAudio, 5);
        reInitPage(_currentPage);
        return;
      }
      // No saved section — on index.html, exit professional mode
      exitProfessionalMode();
      _lastUrl = null;
      _currentPage = "";
      return;
    }

    if (pageName === "removal-tools") {
      globalThis.location.reload();
      return;
    }

    _lastUrl = null;
    enterProfessionalMode();
    navigateTo(
      getPagesBase() + "/" + encodeURIComponent(pageName) + "/index.html",
      pageName,
      true,
    );
  });

  // ── Exposed API ──
  globalThis.__mpaNavigate = function (pageName) {
    if (!isValidPageName(pageName)) return;
    if (pageName === _currentPage) return;
    if (pageName === "removal-tools") {
      globalThis.location.href = getPagesBase() + "/removal-tools/index.html";
      return;
    }
    enterProfessionalMode();
    var url =
      getPagesBase() + "/" + encodeURIComponent(pageName) + "/index.html";
    navigateTo(url, pageName);
  };

  globalThis.__mpaGoHome = function () {
    var h = getPagesBase() + "/home/index.html";
    if (globalThis.location.pathname === h) return;
    enterProfessionalMode();
    navigateTo(h, "home");
  };

  // ── Hash-based initial load ──
  (function initFromHash() {
    var hash = globalThis.location.hash;
    if (!hash) return;
    var m = hash.match(/^#\/page-([a-z0-9_-]+)$/);
    if (!m) return;
    var pageName = m[1];
    if (pageName === _currentPage) return;
    enterProfessionalMode();
    navigateTo(
      getPagesBase() + "/" + encodeURIComponent(pageName) + "/index.html",
      pageName,
    );
  })();
})();
