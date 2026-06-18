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

  function getPagesBase() {
    var parts = window.location.pathname.split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") return parts.slice(0, i + 1).join("/");
    }
    return "Style/pages";
  }

  function isValidPageName(name) {
    return /^[a-z0-9_-]+$/.test(name);
  }

  // ── Content cache (sessionStorage) ──
  var _pageCache = {};

  function cachePut(pageName, html) {
    _pageCache[pageName] = html;
    try {
      sessionStorage.setItem("mpa_" + pageName, html);
    } catch (e) {}
  }

  function cacheGet(pageName) {
    if (_pageCache[pageName]) return _pageCache[pageName];
    try {
      var v = sessionStorage.getItem("mpa_" + pageName);
      if (v) _pageCache[pageName] = v;
      return v || null;
    } catch (e) {
      return null;
    }
  }

  function cacheDel(pageName) {
    delete _pageCache[pageName];
    try {
      sessionStorage.removeItem("mpa_" + pageName);
    } catch (e) {}
  }

  // ── UI helpers ──
  function enterProfessionalMode() {
    if (!_fromRoot) return;
    var modeSelect = document.getElementById("modeSelect");
    if (modeSelect) modeSelect.style.display = "none";
    var simplifiedMode = document.getElementById("simplifiedMode");
    if (simplifiedMode) simplifiedMode.style.display = "none";
    var mainNav = document.getElementById("mainNav");
    if (mainNav) mainNav.style.display = "";
    var app = document.getElementById("app");
    if (app) app.style.display = "";
    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.style.display = "";
    var sidebarOverlay = document.getElementById("sidebarOverlay");
    if (sidebarOverlay) sidebarOverlay.style.display = "";
    var mainFooter = document.getElementById("mainFooter");
    if (mainFooter) mainFooter.style.display = "";
    document.documentElement.style.overflow = "";
    document.body.classList.remove("no-scroll");
    _fromRoot = false;
  }

  function exitProfessionalMode() {
    var modeSelect = document.getElementById("modeSelect");
    if (modeSelect) {
      modeSelect.style.display = "";
      document.documentElement.style.overflow = "hidden";
      document.getElementById("sidebarOverlay").style.display = "none";
    }
    var mainNav = document.getElementById("mainNav");
    if (mainNav) mainNav.style.display = "none";
    var app = document.getElementById("app");
    if (app) app.style.display = "none";
    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.style.display = "none";
    var sidebarOverlay = document.getElementById("sidebarOverlay");
    if (sidebarOverlay) sidebarOverlay.style.display = "none";
    var mainFooter = document.getElementById("mainFooter");
    if (mainFooter) mainFooter.style.display = "none";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("no-scroll");
    _fromRoot = true;
  }

  function updateActiveSidebar(pageName) {
    var links = document.querySelectorAll(".sidebar a[data-page]");
    for (var i = 0; i < links.length; i++) {
      var lp = links[i].getAttribute("data-page");
      if (lp === pageName) {
        links[i].classList.add("active");
      } else {
        links[i].classList.remove("active");
      }
    }
  }

  var _preserveIds = ["bg-music", "music-btn", "music-credit"];

  function ensurePreserved() {
    for (var i = 0; i < _preserveIds.length; i++) {
      var el = document.getElementById(_preserveIds[i]);
      if (el && !document.body.contains(el)) {
        document.body.appendChild(el);
      }
    }
  }

  // ── Page-specific re-init after content swap ──
  function reInitPage(pageName) {
    // Tab-based pages: reset to default tab
    if (pageName === "timestamp" && typeof switchOtsTab === "function")
      switchOtsTab("create");
    if (pageName === "watermark" && typeof switchWmTab === "function") {
      switchWmTab("embed");
      if (typeof toggleWmPassword === "function") toggleWmPassword();
      if (typeof toggleWmExtractPassword === "function")
        toggleWmExtractPassword();
      var et = document.getElementById("wm-type");
      if (et && typeof toggleWmPassword === "function")
        et.addEventListener("change", toggleWmPassword);
      var ext = document.getElementById("wm-type-ex");
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

    // ID Forge: update info display
    if (pageName === "id_forge" && typeof idForgeShowInfo === "function")
      idForgeShowInfo();

    // Certificate: init phone code input
    if (pageName === "certificate" && typeof initCertPhoneCode === "function")
      initCertPhoneCode();

    // Re-translate page content
    if (typeof __ === "function" && typeof translatePage === "function")
      translatePage();

    // Reset result sections and file inputs
    var results = document.querySelectorAll(
      ".result, .result-box, .output-area, .fingerprint-result, .c2pa-result",
    );
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      if (r && r.style) r.style.display = "none";
    }
    var fileInputs = document.querySelectorAll("#app input[type='file']");
    for (var fi = 0; fi < fileInputs.length; fi++) {
      fileInputs[fi].value = "";
    }
  }

  // ── Content loading (from raw HTML) ──
  function loadContent(html, url, pageName, skipPush) {
    // Save audio state before DOM manipulation
    if (typeof window.__musicSaveTime === "function") window.__musicSaveTime();
    var _audioSave = (function () {
      var a = document.getElementById("bg-music");
      // Use the _playing flag first; fall back to audio.paused
      var wasPlaying = false;
      if (typeof window.__musicPlayerState === "function") {
        var st = window.__musicPlayerState();
        wasPlaying = st && st.playing === true;
      }
      if (!wasPlaying && a) wasPlaying = !a.paused;
      console.warn(
        "[mpa] audioSave: wasPlaying=" +
          wasPlaying +
          " paused=" +
          (a ? a.paused : "no-el"),
      );
      return { el: a, wasPlaying: wasPlaying };
    })();

    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var newPage =
      doc.querySelector("#app > section.page.active") ||
      doc.querySelector("#app > section.page");
    if (!newPage) {
      // Fallback: full navigation
      _inFlight = false;
      _lastUrl = null;
      window.location.href = url;
      return;
    }
    // Ensure the section has .active class after swap
    newPage.classList.add("active");
    var newTitle = doc.querySelector("title");
    var newDesc = doc.querySelector('meta[name="description"]');
    var app = document.getElementById("app");
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
      app.appendChild(newPage);
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
      // Use hash-only URLs for pushState so Back triggers popstate, not full reload
      history.pushState(st, "", "#/page-" + pageName);
    }
    _currentPage = pageName;
    _inFlight = false;
    var loader = document.getElementById("page-loader");
    if (loader) loader.classList.add("page-loader--hidden");
    updateActiveSidebar(pageName);
    if (typeof sanitizeRemovalTools === "function") sanitizeRemovalTools();
    reInitPage(pageName);

    // Restore audio if it was playing before swap
    if (_audioSave.wasPlaying && _audioSave.el) {
      (function resumeAudio(el, tries) {
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
        if (el.paused && tries > 0) {
          setTimeout(function () {
            resumeAudio(el, tries - 1);
          }, 100);
        }
      })(_audioSave.el, 5);
    }
  }

  // ── Navigation ──
  function navigateTo(url, pageName, skipPush) {
    if (_inFlight) return;
    if (url === _lastUrl) return;
    if (!isValidPageName(pageName)) {
      window.location.href = url;
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

    var loader = document.getElementById("page-loader");
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
        window.location.href = url;
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
  window.addEventListener("popstate", function (e) {
    var st = e.state;
    var pageName = st && st.routerPage;

    // Handle back to initial state (null state or mode overlay)
    if (!pageName) {
      if (_savedSection && document.getElementById("app")) {
        // Restore original section without full page reload
        var app = document.getElementById("app");
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
      window.location.reload();
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
  window.__mpaNavigate = function (pageName) {
    if (!isValidPageName(pageName)) return;
    if (pageName === _currentPage) return;
    if (pageName === "removal-tools") {
      window.location.href = getPagesBase() + "/removal-tools/index.html";
      return;
    }
    enterProfessionalMode();
    var url =
      getPagesBase() + "/" + encodeURIComponent(pageName) + "/index.html";
    navigateTo(url, pageName);
  };

  window.__mpaGoHome = function () {
    var h = getPagesBase() + "/home/index.html";
    if (window.location.pathname === h) return;
    enterProfessionalMode();
    navigateTo(h, "home");
  };

  // ── Hash-based initial load ──
  (function initFromHash() {
    var hash = window.location.hash;
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
