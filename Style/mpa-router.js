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
    var src = null;
    var up = 0;
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") return parts.slice(0, i + 1).join("/");
    }
    // Rewritten URLs (e.g. the test server's /watermark/) don't contain
    // "pages". Derive the base from a relative script src like
    // "../../shared.js" (two levels up from Style/pages/{name}/).
    src = document.querySelector('script[src^="../"]');
    if (src) {
      up = (src.getAttribute("src") || "").split("/").filter(function (s) {
        return s === "..";
      }).length;
      if (up > 0) return Array(up + 1).join("../") + "Style/pages";
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
    var v;
    if (_pageCache[pageName]) return _pageCache[pageName];
    try {
      v = sessionStorage.getItem("mpa_" + pageName);
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
    var lp;
    for (const link of links) {
      lp = link.dataset.page;
      link.classList.toggle("active", lp === pageName);
    }
  }

  var _preserveIds = ["bg-music", "music-btn", "music-credit"];

  /**
   *
   */
  function ensurePreserved() {
    var el;
    for (const _preserveId of _preserveIds) {
      el = document.getElementById(_preserveId);
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
    var st = null;
    if (typeof globalThis.__musicPlayerState === "function") {
      st = globalThis.__musicPlayerState();
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
      var p;
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
          p = el.play();
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

  // ── Feature script loading after content swap ──
  /**
   * Resolve a (possibly relative) script src against a base URL.
   * @param src
   * @param baseUrl
   * @returns {string}
   */
  function resolveScriptSrc(src, baseUrl) {
    try {
      return new URL(src, baseUrl).href;
    } catch (error) {
      void error;
      return src;
    }
  }

  /**
   * Collect external feature scripts declared by the freshly fetched page
   * that are not already loaded in the current document. Shared shell
   * scripts (shared.js, navigation.js, mpa-router.js, ...) are present on
   * every MPA page and must not be re-appended. Inline scripts (e.g. lazy
   * vendor loaders like loadExportLibs) are collected separately and
   * executed after all external scripts, so library globals exist before
   * the page logic runs.
   * @param {Document} doc
   * @param {string} pageUrl
   * @returns {{src: (string|null), type: string}[]}
   */
  function getMissingScripts(doc, pageUrl) {
    var present = new Set();
    document.querySelectorAll("script[src]").forEach(function (s) {
      present.add(resolveScriptSrc(s.getAttribute("src"), location.href));
    });
    var missing = [];
    doc.querySelectorAll("script").forEach(function (s) {
      var src = s.getAttribute("src");
      var abs = null;
      var scriptType;
      if (src) {
        abs = resolveScriptSrc(src, pageUrl);
        if (present.has(abs)) return;
        missing.push({ src: abs, type: s.type || "text/javascript" });
      } else {
        // Skip non-JavaScript inline blocks (e.g. application/ld+json) —
        // they are not meant to be executed and would throw a SyntaxError.
        scriptType = s.type || "text/javascript";
        // Inline ES module scripts cannot be re-executed synchronously:
        // forcing them to "text/javascript" breaks `import`/`export` and
        // their native async timing cannot be preserved, so they are
        // skipped like the other non-executable blocks.
        if (
          scriptType !== "text/javascript" &&
          scriptType !== "application/javascript"
        )
          return;
        missing.push({ src: null, type: "inline", code: s.textContent || "" });
      }
    });
    return missing;
  }

  /**
   * Load feature scripts sequentially (preserving declaration order so
   * dependencies such as hashing_perceptual.js -> hashing.js ->
   * fingerprint_ui.js are satisfied), then run page re-init once the page
   * globals are available. `type="module"` scripts (e.g. C2PA) keep their
   * module type so `import` statements resolve; inline scripts (lazy
   * vendor loaders) run last inside try/catch so one failure never blocks
   * page init.
   * @param {Document} doc
   * @param {string} pageUrl
   * @param {Function} done
   */
  function loadPageScripts(doc, pageUrl, done) {
    var missing = getMissingScripts(doc, pageUrl);
    var externals = missing.filter(function (m) {
      return m.src !== null;
    });
    var inlines = missing.filter(function (m) {
      return m.src === null;
    });
    if (externals.length === 0) {
      runInlineScripts(inlines, done);
      return;
    }
    var i = 0;
    (function next() {
      if (i >= externals.length) {
        runInlineScripts(inlines, done);
        return;
      }
      var entry = externals[i++];
      var el = document.createElement("script");
      el.src = entry.src;
      el.async = false;
      if (entry.type === "module") el.type = "module";
      el.onload = next;
      el.onerror = function () {
        // A failed optional script must not block the remaining ones.
        next();
      };
      document.body.append(el);
    })();
  }

  /**
   * Execute the fetched page's inline scripts in declaration order. Used to
   * run lazy vendor loaders (jspdf/docx/qrious/...) that external pages
   * attach as inline blocks. Failures are logged but never fatal.
   * @param {{src: (string|null), type: string}[]} inlines
   * @param {Function} done
   */
  function runInlineScripts(inlines, done) {
    var i = 0;
    (function next() {
      if (i >= inlines.length) {
        done();
        return;
      }
      var entry = inlines[i++];
      if (!entry || entry.type !== "inline") {
        next();
        return;
      }
      // Inline language loader blocks use document.write() to inject
      // i18n-data-{lang}.js + i18n.js. After parsing, document.write()
      // wipes the document, and both scripts are already present in the
      // shell page — so these blocks must be skipped entirely.
      var code = entry.code || "";
      if (/document\.write\s*\(/.test(code)) {
        next();
        return;
      }
      var el = document.createElement("script");
      el.type = "text/javascript";
      el.textContent = code;
      if (el.textContent.trim()) {
        // Inline scripts execute synchronously on append; browsers never
        // fire load events for them, so continue immediately instead of
        // waiting for onload (which would stall the chain and skip reInit).
        try {
          document.body.append(el);
        } catch (error) {
          void error;
        }
        next();
      } else {
        next();
      }
    })();
  }

  // ── Page-specific re-init after content swap ──
  /**
   *
   * @param pageName
   */
  function reInitPage(pageName) {
    var et = null;
    var ext = null;
    // Tab-based pages: reset to default tab
    if (pageName === "timestamp" && typeof switchOtsTab === "function")
      switchOtsTab("create");
    if (pageName === "watermark" && typeof switchWmTab === "function") {
      switchWmTab("embed");
      if (typeof toggleWmPassword === "function") toggleWmPassword();
      if (typeof toggleWmExtractPassword === "function")
        toggleWmExtractPassword();
      et = document.querySelector("#wm-type");
      if (et && typeof toggleWmPassword === "function")
        et.addEventListener("change", toggleWmPassword);
      ext = document.querySelector("#wm-type-ex");
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

    // Reset file inputs only; result hiding happens in loadContent before
    // the swap so stale results never flash on the incoming page.
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
      // Hide stale result/output sections on the outgoing page before the
      // swap, so results never carry over into the incoming page.
      for (const stale of oldPage.querySelectorAll(
        ".result, .result-box, .output-area, .fingerprint-result, .c2pa-result",
      )) {
        if (stale && stale.style) stale.style.display = "none";
      }
      oldPage.parentNode.replaceChild(newPage, oldPage);
    } else if (app) {
      app.append(newPage);
    }
    document.title = newTitle ? newTitle.textContent.trim() : document.title;
    var curDesc = null;
    var st;
    if (newDesc) {
      curDesc = document.querySelector('meta[name="description"]');
      if (curDesc)
        curDesc.setAttribute("content", newDesc.getAttribute("content"));
    }
    ensurePreserved();
    if (!skipPush) {
      st = history.state || {};
      st.routerPage = pageName;
      st.url = url;
      // Use clean relative URL (preserves audio across AJAX navigations)
      history.pushState(st, "", url);
    }
    _currentPage = pageName;
    _inFlight = false;
    // Keep the page loader visible and block interaction with the swapped
    // section until the feature scripts finish loading: the tool handlers
    // (e.g. handlePixelInjection) do not exist yet, so an early click would
    // silently do nothing. The section is revealed in the loadPageScripts
    // callback, after reInitPage has re-populated the page state.
    var loader = document.querySelector("#page-loader");
    if (loader) loader.classList.remove("page-loader--hidden");
    newPage.setAttribute("aria-busy", "true");
    newPage.style.pointerEvents = "none";
    updateActiveSidebar(pageName);
    if (typeof sanitizeRemovalTools === "function") sanitizeRemovalTools();

    // Feature scripts (id_forge.js, hashing.js, ...) are not present on the
    // shell page; load them from the fetched document, then re-init the page.
    var absUrl = (function () {
      try {
        return new URL(url, location.href).href;
      } catch (error) {
        void error;
        return url;
      }
    })();
    loadPageScripts(doc, absUrl, function () {
      reInitPage(pageName);
      newPage.removeAttribute("aria-busy");
      newPage.style.pointerEvents = "";
      if (loader) loader.classList.add("page-loader--hidden");
      if (_audioSave.wasPlaying) _resumeAudio(_audioSave, 5);
    });
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
    var _popAudio = null;
    var app = null;
    var oldPage = null;

    // Handle back to initial state (null state or mode overlay)
    if (!pageName) {
      if (_savedSection && document.querySelector("#app")) {
        _popAudio = _saveAudioState();

        // Restore original section without full page reload
        app = document.querySelector("#app");
        oldPage = app.querySelector("section.page");
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
