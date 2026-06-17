(function () {
  if (!document.documentElement || !document.documentElement.dataset.standalone)
    return;

  var _currentPage = document.documentElement.dataset.standalone;
  var _inFlight = false;
  var _lastUrl = null;

  function getPagesBase() {
    var parts = window.location.pathname.split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") return parts.slice(0, i + 1).join("/");
    }
    return window.location.pathname.replace(/\/[^/]*$/, "");
  }

  function isValidPageName(name) {
    return /^[a-z0-9_-]+$/.test(name);
  }

  function navigateTo(url, pageName) {
    if (_inFlight) return;
    if (url === _lastUrl) return;
    if (!isValidPageName(pageName)) {
      window.location.href = url;
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
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");
        var newPage = doc.querySelector("#app > section.page.active");
        if (!newPage) throw new Error("Content not found");
        var newTitle = doc.querySelector("title");
        var newStandalone = doc.documentElement.dataset.standalone;
        var app = document.getElementById("app");
        var oldPage = app ? app.querySelector("section.page") : null;
        if (oldPage) {
          oldPage.classList.remove("active");
          oldPage.parentNode.replaceChild(newPage, oldPage);
        } else if (app) {
          app.appendChild(newPage);
        }
        document.title = newTitle
          ? newTitle.textContent.trim()
          : document.title;
        if (newStandalone)
          document.documentElement.dataset.standalone = newStandalone;
        ensurePreserved();
        var st = history.state || {};
        st.page = pageName;
        history.pushState(st, "", url);
        _currentPage = pageName;
        _inFlight = false;
        if (loader) loader.classList.add("page-loader--hidden");
        updateActiveSidebar(pageName);
        if (typeof showPage === "function") showPage(pageName);
        if (typeof sanitizeRemovalTools === "function") sanitizeRemovalTools();
      })
      .catch(function () {
        _inFlight = false;
        _lastUrl = null;
        if (loader) loader.classList.add("page-loader--hidden");
        window.location.href = url;
      });
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href) return;
    // Whitelist: only intercept relative `../page/index.html` links
    var match = href.match(/^(?:\.\.\/)+([^/]+)\/index\.html$/);
    if (!match) return;
    var pageName = match[1];
    if (pageName === _currentPage) return;
    if (pageName === "removal-tools") return;
    if (link.getAttribute("target") === "_blank") return;
    if (link.hasAttribute("download")) return;
    e.preventDefault();
    navigateTo(href, pageName);
  });

  window.addEventListener("popstate", function (e) {
    if (!document.documentElement.dataset.standalone) return;
    var st = e.state;
    if (!st || !st.page) return;
    var pageName = st.page;
    if (pageName === "removal-tools") {
      window.location.reload();
      return;
    }
    _lastUrl = null;
    navigateTo(
      getPagesBase() + "/" + encodeURIComponent(pageName) + "/index.html",
      pageName,
    );
  });

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

  window.goHome = function () {
    var targetUrl = getPagesBase() + "/home/index.html";
    if (window.location.pathname === targetUrl) return;
    navigateTo(targetUrl, "home");
  };
})();
