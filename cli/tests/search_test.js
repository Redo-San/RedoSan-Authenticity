const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

before(function () {
  globalThis.document = {
    getElementById: function (id) {
      if (id === "page-home") return null;
      if (id === "searchInput") return { value: "", trim: function () { return ""; } };
      if (id === "search-output") return { innerHTML: "" };
      return null;
    },
    addEventListener: function () {},
    querySelectorAll: function () { return []; },
    documentElement: { dataset: {} },
  };
  globalThis.window = globalThis;
  globalThis.setTimeout = setTimeout;
  globalThis.showSearchResults = function (query, results, isMpa) {
    capturedQuery = query;
    capturedResults = results;
  };
  globalThis.showPage = function () {};
  globalThis.closeSearchResults = function () {};
  globalThis.i18n = { data: {} };
  globalThis.escHtml = function (s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  globalThis.console = { log: function () {} };
  globalThis.capturedResults = null;
  globalThis.capturedQuery = null;
  var src = fs.readFileSync(path.join(__dirname, "../../Style/search.js"), "utf8");
  var modified = src.replace(
    /function showSearchResults[\s\S]*?function navigateToSearchResult/,
    "function showSearchResults(query, results, isMpa) { capturedQuery = query; capturedResults = results; }\nfunction navigateToSearchResult"
  );
  vm.runInThisContext(modified, { filename: path.resolve(__dirname, "../../Style/search.js") });
});

describe("search.js \u2014 _isMpaSearch", function () {
  it("should return true when dataset.standalone equals search", function () {
    document.documentElement.dataset.standalone = "search";
    assert.equal(_isMpaSearch(), true);
  });

  it("should return true when page-home element is missing", function () {
    document.documentElement.dataset.standalone = "";
    assert.equal(_isMpaSearch(), true);
  });

  it("should return false in normal SPA mode", function () {
    document.documentElement.dataset.standalone = "";
    document.getElementById = function (id) {
      if (id === "page-home") return { id: "page-home" };
      return null;
    };
    assert.equal(_isMpaSearch(), false);
  });
});

describe("search.js \u2014 buildSearchIndex", function () {
  it("should build index from .page elements", function () {
    SEARCH_INDEX = null;
    document.querySelectorAll = function (sel) {
      if (sel === ".page") {
        var page = {
          id: "page-watermark",
          querySelector: function (q) {
            if (q === "h2") return { textContent: "Watermark Tool", innerText: "Watermark Tool" };
            return null;
          },
          querySelectorAll: function (q) {
            if (q === ".card h3") {
              return [
                { textContent: "Embed", innerText: "Embed" },
                { textContent: "Extract", innerText: "Extract" },
              ];
            }
            return [];
          },
        };
        Object.defineProperty(page, "textContent", { value: "Watermark Tool page content embed extract" });
        Object.defineProperty(page, "innerText", { value: "Watermark Tool page content embed extract" });
        return [page];
      }
      return [];
    };
    var idx = buildSearchIndex();
    assert.equal(Array.isArray(idx), true);
    assert.equal(idx.length, 1);
    assert.equal(idx[0].id, "watermark");
    assert.equal(idx[0].title, "Watermark Tool");
    assert.deepEqual(idx[0].keywords, ["Embed", "Extract"]);
  });

  it("should return cached index on second call", function () {
    var called = false;
    var origQs = document.querySelectorAll;
    document.querySelectorAll = function () { called = true; return []; };
    var idx = buildSearchIndex();
    assert.equal(called, false);
    assert.equal(Array.isArray(idx), true);
    document.querySelectorAll = origQs;
  });
});

describe("search.js \u2014 _executeSearch", function () {
  var testIdx = [
    {
      id: "watermark",
      title: "Watermark Tool",
      text: "This is a watermark tool for embedding and extracting watermarks from images",
      keywords: ["Embed", "Extract", "LSB"],
    },
    {
      id: "fingerprint",
      title: "Fingerprint Tool",
      text: "File hashing and fingerprinting using SHA-1 SHA-256 SHA-512",
      keywords: ["SHA-1", "SHA-256"],
    },
    {
      id: "metadata",
      title: "Metadata Reader",
      text: "Read EXIF metadata from images",
      keywords: ["EXIF"],
    },
  ];

  it("should return exact title match with highest score", function () {
    _executeSearch("watermark tool", testIdx, false);
    // exact title (100) + text match (20) = 120
    assert.equal(capturedResults.length, 1);
    assert.equal(capturedResults[0].page.id, "watermark");
    assert.equal(capturedResults[0].score, 120);
  });

  it("should return partial title match", function () {
    _executeSearch("fingerprint", testIdx, false);
    assert.ok(capturedResults.length >= 1);
    assert.equal(capturedResults[0].page.id, "fingerprint");
    assert.ok(capturedResults[0].score >= 50);
  });

  it("should return keyword match results", function () {
    _executeSearch("lsb", testIdx, false);
    assert.ok(capturedResults.length >= 1);
    assert.equal(capturedResults[0].page.id, "watermark");
    assert.ok(capturedResults[0].score >= 30);
  });

  it("should return text content match results", function () {
    _executeSearch("hashing", testIdx, false);
    assert.ok(capturedResults.length >= 1);
    assert.equal(capturedResults[0].page.id, "fingerprint");
    assert.ok(capturedResults[0].score >= 20);
  });

  it("should sort results by score descending", function () {
    _executeSearch("sha", testIdx, false);
    assert.ok(capturedResults.length >= 1);
    for (var i = 1; i < capturedResults.length; i++) {
      assert.ok(capturedResults[i - 1].score >= capturedResults[i].score, "results sorted descending at index " + i);
    }
  });

  it("should return empty results for no match", function () {
    _executeSearch("xyznonexistent", testIdx, false);
    assert.equal(capturedResults.length, 0);
  });

  it("should include snippet for text match", function () {
    _executeSearch("exif", testIdx, false);
    assert.ok(capturedResults.length >= 1);
    assert.ok(capturedResults[0].snippet.length > 0);
    assert.ok(capturedResults[0].snippet.toLowerCase().includes("exif"));
  });
});

describe("search.js — _executeSearch with MPA mode", function () {
  var testIdx = [
    { id: "watermark", title: "Watermark Tool", text: "watermark tool for images", keywords: ["Embed"] },
  ];

  it("calls showSearchResults with isMpa=true", function () {
    var saved = globalThis.showSearchResults;
    var calledWith = null;
    globalThis.showSearchResults = function (q, r, m) { calledWith = { q: q, r: r, m: m }; };
    _executeSearch("watermark", testIdx, true);
    assert.equal(calledWith.q, "watermark");
    assert.equal(calledWith.m, true);
    globalThis.showSearchResults = saved;
  });
});

describe("search.js — navigateToSearchResult", function () {
  beforeEach(function () {
    document.getElementById = function (id) {
      if (id === "page-home") return { id: "page-home" };
      if (id === "searchInput") return { value: "test", trim: function () { return "test"; } };
      return null;
    };
    globalThis.showPage = function (pageName) { capturedQuery = pageName; };
    globalThis._isMpaSearch = function () { return false; };
  });

  it("navigates to page and clears search", function () {
    navigateToSearchResult("watermark");
    assert.equal(capturedQuery, "watermark");
  });

  it("returns early in MPA mode", function () {
    globalThis._isMpaSearch = function () { return true; };
    var called = false;
    globalThis.showPage = function () { called = true; };
    navigateToSearchResult("metadata");
    assert.ok(!called);
  });
});

describe("search.js — closeSearchResults", function () {
  it("clears searchResults innerHTML when element exists", function () {
    var el = { innerHTML: "content" };
    globalThis.document.getElementById = function (id) {
      if (id === "searchResults") return el;
      return null;
    };
    closeSearchResults();
    assert.equal(el.innerHTML, "");
  });

  it("handles missing searchResults element", function () {
    globalThis.document.getElementById = function () { return null; };
    closeSearchResults();
    assert.ok(true);
  });
});

describe("search.js — siteSearch SPA mode", function () {
  beforeEach(function () {
    globalThis.searchOutputEl = { innerHTML: "" };
    globalThis.document.getElementById = function (id) {
      if (id === "page-home") return { id: "page-home" };
      if (id === "searchInput") return { value: "watermark", trim: function () { return "watermark"; } };
      if (id === "search-output") return globalThis.searchOutputEl;
      return null;
    };
    globalThis._isMpaSearch = function () { return false; };
    globalThis.showPage = function () {};
    globalThis.closeSearchResults = function () {};
    capturedResults = null;
    capturedQuery = null;
    SEARCH_INDEX = [{ id: "watermark", title: "Watermark Tool", text: "watermark tool", keywords: ["Embed"] }];
  });

  it("calls _executeSearch via buildSearchIndex in SPA mode", function () {
    var origBuild = globalThis.buildSearchIndex;
    globalThis.buildSearchIndex = function () { return SEARCH_INDEX; };
    siteSearch();
    assert.ok(capturedResults !== null);
    assert.equal(capturedQuery, "watermark");
    globalThis.buildSearchIndex = origBuild;
  });

  it("returns early when query is empty", function () {
    globalThis.document.getElementById = function (id) {
      if (id === "searchInput") return { value: "", trim: function () { return ""; } };
      return null;
    };
    siteSearch();
    assert.equal(capturedResults, null);
  });
});
