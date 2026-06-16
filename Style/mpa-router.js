(function () {
  if (!document.documentElement || !document.documentElement.dataset.standalone) return;

  var _currentPage = document.documentElement.dataset.standalone;

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href) return;
    if (link.getAttribute("target") === "_blank") return;
    if (link.hasAttribute("download")) return;
    if (href.indexOf("http") === 0 || href.indexOf("//") === 0) return;
    if (href.indexOf("#") === 0) return;
    if (href.indexOf("?") === 0) return;
    var match = href.match(/^(?:\.\.\/)+([^/]+)\/index\.html$/);
    if (!match) return;
    var pageName = match[1];
    if (pageName === _currentPage) return;
    // removal-tools: full page redirect (404 on production, blocked content)
    if (pageName === "removal-tools") return;
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
    var parts = window.location.pathname.split("/");
    var pagesIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") { pagesIdx = i; break; }
    }
    var base;
    if (pagesIdx !== -1) {
      base = parts.slice(0, pagesIdx + 1).join("/");
    } else {
      base = window.location.pathname.replace(/\/[^/]*$/, "");
    }
    navigateTo(base + "/" + encodeURIComponent(pageName) + "/index.html", pageName);
  });

  function navigateTo(url, pageName) {
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
        if (newTitle) document.title = newTitle.textContent;
        if (newStandalone) document.documentElement.dataset.standalone = newStandalone;
        history.pushState({ page: pageName }, "", url);
        _currentPage = pageName;
        if (loader) loader.classList.add("page-loader--hidden");
        updateActiveSidebar(pageName);
        if (typeof showPage === "function") showPage(pageName);
        if (typeof sanitizeRemovalTools === "function") sanitizeRemovalTools();
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  function updateActiveSidebar(pageName) {
    var links = document.querySelectorAll('.sidebar a[data-page]');
    for (var i = 0; i < links.length; i++) {
      var lp = links[i].getAttribute("data-page");
      if (lp === pageName) {
        links[i].classList.add("active");
      } else {
        links[i].classList.remove("active");
      }
    }
  }

  window.goHome = function () {
    var parts = window.location.pathname.split("/");
    var pagesIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") { pagesIdx = i; break; }
    }
    var base;
    if (pagesIdx !== -1) {
      base = parts.slice(0, pagesIdx + 1).join("/");
    } else {
      base = window.location.pathname.replace(/\/[^/]*$/, "");
    }
    var targetUrl = base + "/home/index.html";
    if (_currentPage === "home") return;
    navigateTo(targetUrl, "home");
  };
})();
