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
// ── Site Search ──
var SEARCH_INDEX = null;

// Detect whether we are in the SPA (index.html) or MPA (standalone page)
function _isMpaSearch() {
  return (
    document.documentElement.dataset.standalone === "search" ||
    !document.getElementById("page-home")
  );
}

// SPA index builder — scans all .page sections in index.html
function buildSearchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  SEARCH_INDEX = [];
  document.querySelectorAll(".page").forEach(function (page) {
    var id = page.id.replace("page-", "");
    var heading = page.querySelector("h2");
    var title = heading ? heading.textContent || heading.innerText : id;
    var text = page.textContent || page.innerText || "";
    var keywords = [];
    var cards = page.querySelectorAll(".card h3");
    cards.forEach(function (c) {
      keywords.push(c.textContent || c.innerText);
    });
    SEARCH_INDEX.push({ id: id, title: title, text: text, keywords: keywords });
  });
  return SEARCH_INDEX;
}

// MPA index loader — fetches the pre-built search-index.json
var _mpaIndexPromise = null;

function _loadMpaIndex() {
  if (_mpaIndexPromise) return _mpaIndexPromise;
  // On the MPA search page, the JSON is in the same directory
  _mpaIndexPromise = fetch("search-index.json")
    .then(function (r) {
      if (!r.ok) throw new Error("Failed to load search index");
      return r.json();
    })
    .then(function (data) {
      SEARCH_INDEX = data;
      return data;
    })
    .catch(function () {
      SEARCH_INDEX = [];
      return [];
    });
  return _mpaIndexPromise;
}

function siteSearch() {
  var input = document.getElementById("searchInput");
  var query = input.value.trim().toLowerCase();
  if (!query) return;

  var isMpa = _isMpaSearch();

  // Standalone page without #search-output → redirect
  if (!document.getElementById("search-output")) {
    var parts = window.location.pathname.split("/");
    var pagesIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") {
        pagesIdx = i;
        break;
      }
    }
    if (pagesIdx !== -1) {
      parts = parts.slice(0, pagesIdx + 1);
      parts.push("search", "index.html");
      window.location.href =
        parts.join("/") + "?q=" + encodeURIComponent(query);
    } else {
      window.location.href =
        "./search/index.html?q=" + encodeURIComponent(query);
    }
    return;
  }

  if (isMpa) {
    // MPA mode: load index from JSON, then search
    _loadMpaIndex().then(function (idx) {
      _executeSearch(query, idx, true);
    });
  } else {
    // SPA mode: use DOM-based index
    var idx = buildSearchIndex();
    _executeSearch(query, idx, false);
  }
}

function _executeSearch(query, idx, isMpa) {
  var results = [];

  idx.forEach(function (page) {
    var score = 0;
    var snippet = "";
    var lowerText = page.text.toLowerCase();
    var lowerTitle = page.title.toLowerCase();

    if (lowerTitle === query) score += 100;
    else if (lowerTitle.indexOf(query) !== -1) score += 50;

    if (page.keywords) {
      page.keywords.forEach(function (k) {
        if (k.toLowerCase().indexOf(query) !== -1) score += 30;
      });
    }

    var pos = lowerText.indexOf(query);
    if (pos !== -1) {
      score += 20;
      var start = Math.max(0, pos - 60);
      var end = Math.min(lowerText.length, pos + query.length + 60);
      snippet =
        (start > 0 ? "..." : "") +
        page.text.substring(start, end) +
        (end < lowerText.length ? "..." : "");
      snippet = snippet.replace(/\s+/g, " ").trim();
    }

    if (score > 0) results.push({ page: page, score: score, snippet: snippet });
  });

  results.sort(function (a, b) {
    return b.score - a.score;
  });

  showSearchResults(query, results, isMpa);
}

function showSearchResults(query, results, isMpa) {
  var output = document.getElementById("search-output");
  if (!output) {
    var parts = window.location.pathname.split("/");
    var pagesIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") {
        pagesIdx = i;
        break;
      }
    }
    if (pagesIdx !== -1) {
      parts = parts.slice(0, pagesIdx + 1);
      parts.push("search", "index.html");
      window.location.href =
        parts.join("/") + "?q=" + encodeURIComponent(query);
    } else {
      window.location.href =
        "./search/index.html?q=" + encodeURIComponent(query);
    }
    return;
  }
  var lang = i18n && i18n.data ? i18n.data : {};

  var html = "";
  if (results.length === 0) {
    var msg = (
      lang["search.no_results"] || 'No results found for "{query}".'
    ).replace("{query}", escHtml(query));
    html += '<div class="card-form" style="text-align:center;padding:40px">';
    html +=
      '<div style="font-size:3rem;margin-bottom:16px;opacity:0.3">🔍</div>';
    html += '<p style="color:var(--text-muted);font-size:1rem">' + msg + "</p>";
    html +=
      '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:12px">' +
      (lang["search.hint"] ||
        "Try searching for: watermark, fingerprint, metadata, timestamp") +
      "</p>";
    html += "</div>";
  } else {
    var title = (
      lang["search.results_for"] || 'Results for "{query}":'
    ).replace("{query}", escHtml(query));
    html +=
      '<p style="color:var(--text-muted);margin-bottom:16px;font-size:0.85rem">' +
      title +
      " <strong>" +
      results.length +
      "</strong></p>";
    results.forEach(function (r) {
      var pageName = r.page.id.replace("page-", "");
      var safeName = escHtml(pageName);
      if (isMpa) {
        var url = r.page.url || "../" + safeName + "/";
        html += '<a href="' + escHtml(url) + '" class="search-result-item">';
      } else {
        html +=
          '<a href="#" data-page="' +
          safeName +
          '" class="search-result-item">';
      }
      html +=
        '<div class="search-result-title">' + escHtml(r.page.title) + "</div>";
      if (r.snippet) {
        html +=
          '<div class="search-result-snippet">' + escHtml(r.snippet) + "</div>";
      }
      html += "</a>";
    });
  }

  output.innerHTML = html;
  showPage("search");
  closeSearchResults();
}

function navigateToSearchResult(pageName) {
  // In MPA mode, navigation is handled by direct <a href> — this is only for SPA
  if (_isMpaSearch()) return;
  showPage(pageName);
  document.getElementById("searchInput").value = "";
}

function closeSearchResults() {
  var el = document.getElementById("searchResults");
  if (el) el.innerHTML = "";
}

document.addEventListener("click", function (e) {
  var item = e.target.closest(".search-result-item");
  if (item) {
    // MPA links have direct href — let browser navigate naturally
    if (item.getAttribute("href") && item.getAttribute("href") !== "#") {
      return;
    }
    // SPA links use data-page
    var pageName = item.getAttribute("data-page");
    if (
      pageName &&
      Array.isArray(PAGE_NAMES) &&
      PAGE_NAMES.indexOf(pageName) !== -1
    ) {
      navigateToSearchResult(pageName);
    }
    e.preventDefault();
  }
  var search = document.getElementById("navSearch");
  if (search && !search.contains(e.target)) {
    closeSearchResults();
  }
});
