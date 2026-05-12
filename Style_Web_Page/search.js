// ── Site Search ──
var SEARCH_INDEX = null;

function buildSearchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  SEARCH_INDEX = [];
  document.querySelectorAll('.page').forEach(function(page) {
    var id = page.id;
    var heading = page.querySelector('h2');
    var title = heading ? heading.textContent || heading.innerText : id.replace('page-', '');
    var text = page.textContent || page.innerText || '';
    var keywords = [];
    var cards = page.querySelectorAll('.card h3');
    cards.forEach(function(c) { keywords.push(c.textContent || c.innerText); });
    SEARCH_INDEX.push({ id: id, title: title, text: text, keywords: keywords });
  });
  return SEARCH_INDEX;
}

function siteSearch() {
  var input = document.getElementById('searchInput');
  var query = input.value.trim().toLowerCase();
  if (!query) return;

  var idx = buildSearchIndex();
  var results = [];

  idx.forEach(function(page) {
    var score = 0;
    var snippet = '';
    var lowerText = page.text.toLowerCase();
    var lowerTitle = page.title.toLowerCase();

    if (lowerTitle === query) score += 100;
    else if (lowerTitle.indexOf(query) !== -1) score += 50;

    page.keywords.forEach(function(k) {
      if (k.toLowerCase().indexOf(query) !== -1) score += 30;
    });

    var pos = lowerText.indexOf(query);
    if (pos !== -1) {
      score += 20;
      var start = Math.max(0, pos - 60);
      var end = Math.min(lowerText.length, pos + query.length + 60);
      snippet = (start > 0 ? '...' : '') + page.text.substring(start, end) + (end < lowerText.length ? '...' : '');
      snippet = snippet.replace(/\s+/g, ' ').trim();
    }

    if (score > 0) results.push({ page: page, score: score, snippet: snippet });
  });

  results.sort(function(a, b) { return b.score - a.score; });

  showSearchResults(query, results);
}

function showSearchResults(query, results) {
  var output = document.getElementById('search-output');
  var lang = i18n && i18n.data ? i18n.data : {};

  var html = '';
  if (results.length === 0) {
    var msg = (lang['search.no_results'] || 'No results found for "{query}".').replace('{query}', escHtml(query));
    html += '<div class="card-form" style="text-align:center;padding:40px">';
    html += '<div style="font-size:3rem;margin-bottom:16px;opacity:0.3">🔍</div>';
    html += '<p style="color:var(--text-muted);font-size:1rem">' + msg + '</p>';
    html += '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:12px">' + (lang['search.hint'] || 'Try searching for: watermark, fingerprint, metadata, timestamp') + '</p>';
    html += '</div>';
  } else {
    var title = (lang['search.results_for'] || 'Results for "{query}":').replace('{query}', escHtml(query));
    html += '<p style="color:var(--text-muted);margin-bottom:16px;font-size:0.85rem">' + title + ' <strong>' + results.length + '</strong></p>';
    results.forEach(function(r) {
      var pageName = r.page.id.replace('page-', '');
      html += '<a href="#" data-page="' + pageName + '" class="search-result-item" onclick="navigateToSearchResult(\'' + pageName + '\');return false;">';
      html += '<div class="search-result-title">' + escHtml(r.page.title) + '</div>';
      if (r.snippet) {
        html += '<div class="search-result-snippet">' + escHtml(r.snippet) + '</div>';
      }
      html += '</a>';
    });
  }

  output.innerHTML = html;
  showPage('search');
  closeSearchResults();
}

function navigateToSearchResult(pageName) {
  showPage(pageName);
  document.getElementById('searchInput').value = '';
}

function closeSearchResults() {
  var el = document.getElementById('searchResults');
  if (el) el.innerHTML = '';
}

document.addEventListener('click', function(e) {
  var search = document.getElementById('navSearch');
  if (search && !search.contains(e.target)) {
    closeSearchResults();
  }
});
