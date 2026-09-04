const { describe, it, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// ── Mock localStorage ──
var mockStorage = {};
globalThis.localStorage = {
  getItem: function (k) {
    return mockStorage[k] !== undefined ? mockStorage[k] : null;
  },
  setItem: function (k, v) {
    mockStorage[k] = String(v);
  },
  removeItem: function (k) {
    delete mockStorage[k];
  },
  clear: function () {
    mockStorage = {};
  },
};

// ── Mock navigator ──
globalThis.navigator = { language: "en-US" };

// ── Minimal document stub needed before loading assistant.js (ready() is called at module level) ──
globalThis.document = {
  readyState: "complete",
  getElementById: function () {
    return null;
  },
  querySelector: function () {
    return null;
  },
  querySelectorAll: function () {
    return [];
  },
  createElement: function () {
    return {
      className: "",
      innerHTML: "",
      style: {},
      append: function () {},
      textContent: "",
    };
  },
  documentElement: {
    getAttribute: function () {
      return "en";
    },
  },
  addEventListener: function () {},
};

// ── Load assistant_data.js ──
const dataSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Assistant", "assistant_data.js"),
  "utf8",
);
vm.runInThisContext(dataSrc, {
  filename: path.resolve(__dirname, "../..", "Assistant", "assistant_data.js"),
});

// ── Load assistant.js ──
const assistantSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Assistant", "assistant.js"),
  "utf8",
);
vm.runInThisContext(assistantSrc, {
  filename: path.resolve(__dirname, "../..", "Assistant", "assistant.js"),
});

// ── Helper to create a minimal mock document ──
function createMockDocument(elements) {
  var store = elements || {};
  var createdElements = [];
  function makeEl(tag) {
    var el = {
      tagName: (tag || "").toUpperCase(),
      className: "",
      id: "",
      innerHTML: "",
      textContent: "",
      style: {},
      disabled: false,
      children: [],
      childNodes: [],
      parentNode: null,
      append: function (child) {
        if (typeof child === "string") return;
        this.children.push(child);
        this.childNodes.push(child);
        if (child.parentNode === undefined) child.parentNode = this;
      },
      appendChild: function (child) {
        this.children.push(child);
        this.childNodes.push(child);
        if (child.parentNode === undefined) child.parentNode = this;
      },
      remove: function () {
        if (this.parentNode) {
          var idx = this.parentNode.children.indexOf(this);
          if (idx !== -1) this.parentNode.children.splice(idx, 1);
          idx = this.parentNode.childNodes.indexOf(this);
          if (idx !== -1) this.parentNode.childNodes.splice(idx, 1);
        }
      },
      addEventListener: function () {},
      setAttribute: function () {},
      getAttribute: function () {
        return null;
      },
      contains: function () {
        return false;
      },
      focus: function () {},
      cloneNode: function () {
        return makeEl(tag);
      },
    };
    return el;
  }
  return {
    getElementById: function (id) {
      return store[id] !== undefined ? store[id] : null;
    },
    querySelector: function (sel) {
      var className = sel && sel.charAt(0) === "." ? sel.slice(1) : null;
      if (className && store[className] !== undefined) return store[className];
      var idName = sel && sel.charAt(0) === "#" ? sel.slice(1) : null;
      if (idName && store[idName] !== undefined) return store[idName];
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    createElement: function (tag) {
      return makeEl(tag);
    },
    createTextNode: function (text) {
      return {
        nodeType: 3,
        textContent: String(text),
        nodeValue: String(text),
      };
    },
    documentElement: {
      getAttribute: function (attr) {
        if (attr === "lang") return store.__htmlLang || "en";
        return null;
      },
    },
    readyState: "complete",
    addEventListener: function () {},
  };
}

// ── Clean up globalThis after each test ──
function defaultDocument() {
  return createMockDocument({});
}
function cleanupGlobals() {
  globalThis.document = defaultDocument();
  delete globalThis.i18n;
  delete globalThis.REDOSAN_BOT_CHECK;
}

describe("Assistant — normalizeArabic", function () {
  it("should normalize alif variations to ا", function () {
    assert.equal(normalizeArabic("أحمد"), "احمد");
    assert.equal(normalizeArabic("إحسان"), "احسان");
    assert.equal(normalizeArabic("آدم"), "ادم");
    assert.equal(normalizeArabic("أإآ"), "ااا");
  });

  it("should normalize teh marbouta to heh", function () {
    assert.equal(normalizeArabic("مدرسة"), "مدرسه");
    assert.equal(normalizeArabic("فتاة"), "فتاه");
  });

  it("should normalize alif maqsura to yeh", function () {
    assert.equal(normalizeArabic("على"), "علي");
    assert.equal(normalizeArabic("موسى"), "موسي");
  });

  it("should remove tatweel (kashida)", function () {
    assert.equal(normalizeArabic("مـــــرحبا"), "مرحبا");
  });

  it("should remove diacritics (tashkeel)", function () {
    assert.equal(normalizeArabic("مَرْحَبًا"), "مرحبا");
    assert.equal(normalizeArabic("كَيْفَ"), "كيف");
  });

  it("should handle empty string", function () {
    assert.equal(normalizeArabic(""), "");
  });

  it("should leave English text unchanged", function () {
    assert.equal(normalizeArabic("hello world"), "hello world");
  });

  it("should apply all normalizations together", function () {
    var result = normalizeArabic("أَلْعَرَبِيَّةُ");
    // Alif, remove diacritics, teh marbouta not present
    assert.equal(result, "العربيه");
  });
});

describe("Assistant — assistantTokenize", function () {
  it("should tokenize English text", function () {
    var result = assistantTokenize("Hello World");
    assert.deepEqual(result, ["hello", "world"]);
  });

  it("should tokenize Arabic text with normalization", function () {
    var result = assistantTokenize("مرحباً بك");
    assert.deepEqual(result, ["مرحبا", "بك"]);
  });

  it("should remove punctuation", function () {
    var result = assistantTokenize("Hello, World! How are you?");
    assert.deepEqual(result, ["hello", "world", "how", "are", "you"]);
  });

  it("should handle empty input", function () {
    assert.deepEqual(assistantTokenize(""), []);
  });

  it("should handle only punctuation", function () {
    assert.deepEqual(assistantTokenize("!@#$%^&*()"), []);
  });

  it("should handle mixed Arabic and English", function () {
    var result = assistantTokenize("Hello مرحبا");
    assert.equal(result.length, 2);
    assert.ok(result.includes("hello"));
    assert.ok(result.includes("مرحبا"));
  });

  it("should normalize Arabic before tokenizing", function () {
    var result = assistantTokenize("أهلاً وسهلاً");
    // Both alefs get normalized
    assert.ok(
      result.every(function (t) {
        return !t.includes("أ") && !t.includes("إ");
      }),
    );
  });

  it("should convert to lowercase", function () {
    var result = assistantTokenize("HELLO WORLD");
    assert.deepEqual(result, ["hello", "world"]);
  });
});

describe("Assistant — levenshtein", function () {
  it("should return 0 for identical strings", function () {
    assert.equal(levenshtein("hello", "hello"), 0);
  });

  it("should return length for empty string", function () {
    assert.equal(levenshtein("", "hello"), 5);
    assert.equal(levenshtein("hello", ""), 5);
    assert.equal(levenshtein("", ""), 0);
  });

  it("should compute distance for single character difference", function () {
    assert.equal(levenshtein("hello", "hallo"), 1);
  });

  it("should compute distance for insertion", function () {
    assert.equal(levenshtein("hell", "hello"), 1);
  });

  it("should compute distance for deletion", function () {
    assert.equal(levenshtein("hello", "hell"), 1);
  });

  it("should compute distance for complete difference", function () {
    assert.equal(levenshtein("abc", "xyz"), 3);
  });

  it("should handle Arabic strings", function () {
    assert.equal(levenshtein("مرحبا", "مرحبا"), 0);
    assert.equal(levenshtein("مرحبا", "مرحبة"), 1);
  });
});

describe("Assistant — getAssistantLang", function () {
  afterEach(cleanupGlobals);

  it("should return i18n.lang if available", function () {
    globalThis.i18n = { lang: "fr" };
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getAssistantLang(), "fr");
  });

  it("should fall back to html lang attribute", function () {
    delete globalThis.i18n;
    var doc = createMockDocument({ __htmlLang: "ar" });
    globalThis.document = doc;
    assert.equal(getAssistantLang(), "ar");
  });

  it("should default to 'en' when nothing set", function () {
    delete globalThis.i18n;
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getAssistantLang(), "en");
  });

  it("should handle i18n existing but missing lang", function () {
    globalThis.i18n = {};
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getAssistantLang(), "en");
  });
});

describe("Assistant — getCurrentContext", function () {
  afterEach(cleanupGlobals);

  it("should return empty string if no active page", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getCurrentContext(), "");
  });

  it("should return id without 'page-' prefix", function () {
    var active = {
      id: "page-watermark",
      classList: {
        contains: function () {
          return false;
        },
      },
    };
    var doc = createMockDocument({});
    Object.defineProperty(active, "className", {
      value: "page active",
      writable: true,
    });
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    assert.equal(getCurrentContext(), "watermark");
  });

  it("should handle context with hyphens", function () {
    var active = {
      id: "page-pixel-injection",
      classList: {
        contains: function () {
          return false;
        },
      },
    };
    var doc = createMockDocument({});
    Object.defineProperty(active, "className", {
      value: "page active",
      writable: true,
    });
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    assert.equal(getCurrentContext(), "pixel-injection");
  });

  it("should return empty string if active has no id", function () {
    var active = {
      classList: {
        contains: function () {
          return false;
        },
      },
    };
    var doc = createMockDocument({});
    Object.defineProperty(active, "className", {
      value: "page active",
      writable: true,
    });
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    assert.equal(getCurrentContext(), "");
  });
});

describe("Assistant — getResponseLang", function () {
  afterEach(cleanupGlobals);

  it("should return 'ar' for Arabic text", function () {
    assert.equal(getResponseLang("مرحبا"), "ar");
  });

  it("should return getAssistantLang() for non-Arabic text", function () {
    globalThis.i18n = { lang: "fr" };
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getResponseLang("hello"), "fr");
    delete globalThis.i18n;
  });

  it("should return 'en' for empty string", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    assert.equal(getResponseLang(""), "en");
  });

  it("should detect Arabic mixed with English", function () {
    assert.equal(getResponseLang("hello مرحبا"), "ar");
  });
});

describe("Assistant — matchAssistantIntent", function () {
  afterEach(cleanupGlobals);

  it("should match exact English phrase", function () {
    var result = matchAssistantIntent("hello");
    assert.ok(result !== null);
    assert.equal(result.id, "welcome");
  });

  it("should match exact Arabic phrase", function () {
    var result = matchAssistantIntent("مرحبا");
    assert.ok(result !== null);
    assert.equal(result.id, "welcome");
  });

  it("should match with fuzzy/typo tolerance", function () {
    var result = matchAssistantIntent("helo");
    assert.ok(result !== null);
    assert.equal(result.id, "welcome");
  });

  it("should match 'how to embed' intent", function () {
    var result = matchAssistantIntent("how to embed watermark");
    assert.ok(result !== null);
    assert.equal(result.id, "watermark_embed");
  });

  it("should match 'what is fingerprint' intent", function () {
    var result = matchAssistantIntent("what is fingerprint");
    assert.ok(result !== null);
    assert.equal(result.id, "fingerprint_what");
  });

  it("should match 'privacy' intent", function () {
    var result = matchAssistantIntent("is my data safe");
    assert.ok(result !== null);
    assert.equal(result.id, "privacy");
  });

  it("should match Arabic intent", function () {
    var result = matchAssistantIntent("كيف تعمل العلامة المائية");
    assert.ok(result !== null);
    assert.equal(result.id, "watermark_what");
  });

  it("should return null for empty input", function () {
    var result = matchAssistantIntent("");
    assert.equal(result, null);
  });

  it("should return null for gibberish", function () {
    var result = matchAssistantIntent("zzzzzz xxxxxx qqqqqqq");
    assert.equal(result, null);
  });

  it("should return null for whitespace only", function () {
    var result = matchAssistantIntent("   ");
    assert.equal(result, null);
  });

  it("should match 'thanks' intent", function () {
    var result = matchAssistantIntent("thank you");
    assert.ok(result !== null);
    assert.equal(result.id, "thanks");
  });

  it("should match abuse intent", function () {
    var result = matchAssistantIntent("shut up");
    assert.ok(result !== null);
    assert.equal(result.id, "abuse");
  });

  it("should match help intent", function () {
    var result = matchAssistantIntent("what can you help me with");
    assert.ok(result !== null);
    assert.equal(result.id, "help");
  });

  it("should match mobile support intent", function () {
    var result = matchAssistantIntent("does it work on iphone");
    assert.ok(result !== null);
    assert.equal(result.id, "mobile_support");
  });

  it("should match opensource intent", function () {
    var result = matchAssistantIntent("is this open source");
    assert.ok(result !== null);
    assert.equal(result.id, "opensource");
  });

  it("should match 'who made this' intent", function () {
    var result = matchAssistantIntent("who made this");
    assert.ok(result !== null);
    assert.equal(result.id, "who_is_redosan");
  });
});

describe("Assistant — getAssistantResponse", function () {
  afterEach(cleanupGlobals);

  it("should return English response for known intent", function () {
    var intent = { id: "welcome", response: { en: "Hello!", ar: "مرحبا!" } };
    assert.equal(getAssistantResponse(intent, "en"), "Hello!");
  });

  it("should return Arabic response for known intent", function () {
    var intent = { id: "welcome", response: { en: "Hello!", ar: "مرحبا!" } };
    assert.equal(getAssistantResponse(intent, "ar"), "مرحبا!");
  });

  it("should fallback to English if lang missing", function () {
    var intent = { id: "welcome", response: { en: "Hello!" } };
    assert.equal(getAssistantResponse(intent, "fr"), "Hello!");
  });

  it("should return fallback for null intent", function () {
    var response = getAssistantResponse(null, "en");
    assert.ok(response.includes("not sure"));
    assert.ok(response.length > 0);
  });

  it("should return Arabic fallback for null intent", function () {
    var response = getAssistantResponse(null, "ar");
    assert.ok(response.includes("متأكد"));
  });

  it("should use default lang if not provided", function () {
    globalThis.i18n = { lang: "fr" };
    var doc = createMockDocument({});
    globalThis.document = doc;
    // French is not in the KB responses, so it'll fallback to en
    var intent = { id: "welcome", response: { en: "Hello!", ar: "مرحبا!" } };
    assert.equal(getAssistantResponse(intent), "Hello!");
  });

  it("should return fallback for intent with no response", function () {
    var response = getAssistantResponse({ id: "unknown" }, "en");
    assert.ok(response.includes("not sure"));
  });
});

describe("Assistant — getAssistantSuggestions", function () {
  afterEach(cleanupGlobals);

  it("should return English suggestions for known intent", function () {
    var intent = {
      id: "welcome",
      suggestions: {
        en: ["How does watermarking work?", "What is fingerprinting?"],
        ar: ["كيف تعمل العلامة المائية؟", "ما هي البصمة الرقمية؟"],
      },
    };
    var sug = getAssistantSuggestions(intent, "en");
    assert.equal(sug.length, 2);
    assert.equal(sug[0], "How does watermarking work?");
  });

  it("should return Arabic suggestions for known intent", function () {
    var intent = {
      id: "welcome",
      suggestions: {
        en: ["How does watermarking work?"],
        ar: ["كيف تعمل العلامة المائية؟"],
      },
    };
    var sug = getAssistantSuggestions(intent, "ar");
    assert.equal(sug.length, 1);
    assert.equal(sug[0], "كيف تعمل العلامة المائية؟");
  });

  it("should fallback to English if lang missing", function () {
    var intent = {
      id: "welcome",
      suggestions: { en: ["How does watermarking work?"] },
    };
    var sug = getAssistantSuggestions(intent, "fr");
    assert.equal(sug.length, 1);
  });

  it("should return empty array for null intent", function () {
    assert.deepEqual(getAssistantSuggestions(null, "en"), []);
  });

  it("should return empty array for intent without suggestions", function () {
    assert.deepEqual(getAssistantSuggestions({ id: "unknown" }, "en"), []);
  });

  it("should use default lang if not provided", function () {
    globalThis.i18n = { lang: "fr" };
    var doc = createMockDocument({});
    globalThis.document = doc;
    var intent = {
      id: "welcome",
      suggestions: { en: ["How does watermarking work?"] },
    };
    var sug = getAssistantSuggestions(intent);
    assert.equal(sug.length, 1);
  });
});

describe("Assistant — getContextualSuggestions", function () {
  afterEach(cleanupGlobals);

  it("should return watermark suggestions on watermark page", function () {
    var active = { id: "page-watermark" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions("en");
    assert.ok(sug.length > 0);
    assert.ok(
      sug.some(function (s) {
        return s.toLowerCase().includes("embed");
      }),
    );
  });

  it("should return pixel-injection suggestions", function () {
    var active = { id: "page-pixel-injection" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions("en");
    assert.ok(sug.length > 0);
    assert.ok(
      sug.some(function (s) {
        return s.toLowerCase().includes("inject");
      }),
    );
  });

  it("should return default suggestions for unknown page", function () {
    var active = { id: "page-unknown" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions("en");
    assert.ok(sug.length > 0);
    assert.equal(sug[0], "How to watermark?");
  });

  it("should return Arabic default suggestions", function () {
    var active = { id: "page-unknown" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions("ar");
    assert.ok(sug.length > 0);
    assert.ok(
      sug.some(function (s) {
        return /كيفية/.test(s);
      }),
    );
  });

  it("should return Arabic watermark suggestions on watermark page", function () {
    var active = { id: "page-watermark" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions("ar");
    assert.ok(sug.length > 0);
    assert.ok(
      sug.some(function (s) {
        return /تضمين/.test(s);
      }),
    );
  });

  it("should use default lang if not provided", function () {
    var active = { id: "page-fingerprint" };
    var doc = createMockDocument({});
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return active;
      return null;
    };
    globalThis.document = doc;
    var sug = getContextualSuggestions();
    // Default is en
    assert.ok(sug.length > 0);
    assert.ok(sug[0].includes("fingerprint"));
  });
});

describe("Assistant — Chat History persistence", function () {
  beforeEach(function () {
    mockStorage = {};
  });

  it("saveChatHistory should store messages in localStorage", function () {
    var messages = [
      { role: "user", text: "hello" },
      { role: "bot", text: "hi there" },
    ];
    saveChatHistory(messages);
    var stored = JSON.parse(localStorage.getItem("redosan_chat"));
    assert.equal(stored.length, 2);
    assert.equal(stored[0].role, "user");
    assert.equal(stored[0].text, "hello");
  });

  it("loadChatHistory should retrieve messages", function () {
    var messages = [{ role: "user", text: "test" }];
    localStorage.setItem("redosan_chat", JSON.stringify(messages));
    var loaded = loadChatHistory();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].text, "test");
  });

  it("loadChatHistory should return empty array if nothing stored", function () {
    mockStorage = {};
    var loaded = loadChatHistory();
    assert.deepEqual(loaded, []);
  });

  it("loadChatHistory should return empty array on parse error", function () {
    localStorage.setItem("redosan_chat", "{invalid");
    var loaded = loadChatHistory();
    assert.deepEqual(loaded, []);
  });

  it("saveChatHistory should keep only last 50 messages", function () {
    var messages = [];
    for (var i = 0; i < 60; i++) {
      messages.push({ role: "user", text: "msg" + i });
    }
    saveChatHistory(messages);
    var stored = JSON.parse(localStorage.getItem("redosan_chat"));
    assert.equal(stored.length, 50);
    assert.equal(stored[0].text, "msg10");
  });

  it("clearChatHistory should remove the key", function () {
    localStorage.setItem(
      "redosan_chat",
      JSON.stringify([{ role: "user", text: "test" }]),
    );
    clearChatHistory();
    assert.equal(localStorage.getItem("redosan_chat"), null);
  });

  it("saveChatHistory should handle JSON.stringify errors silently", function () {
    // Circular reference will cause JSON.stringify to throw
    var circular = {};
    circular.self = circular;
    // Should not throw
    saveChatHistory([circular]);
  });
});

describe("Assistant — addMessage", function () {
  afterEach(cleanupGlobals);

  it("should add a bot message with avatar", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    var result = addMessage("Hello there!", "bot");
    assert.ok(result !== undefined);
    assert.equal(msgArea.children.length, 1);
    var msgDiv = msgArea.children[0];
    assert.ok(msgDiv.className.includes("ast-msg-bot"));
    // Should have avatar span
    var hasAvatar = false;
    for (var i = 0; i < msgDiv.children.length; i++) {
      if (msgDiv.children[i].className === "ast-avatar") hasAvatar = true;
    }
    assert.ok(hasAvatar);
  });

  it("should add a user message without avatar", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    addMessage("Hello!", "user");
    assert.equal(msgArea.children.length, 1);
    var msgDiv = msgArea.children[0];
    assert.ok(msgDiv.className.includes("ast-msg-user"));
  });

  it("should render bold markdown text", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    addMessage("Hello **Raido**!", "bot");
    var msgDiv = msgArea.children[0];
    var contentDiv = null;
    for (var i = 0; i < msgDiv.children.length; i++) {
      if (msgDiv.children[i].className === "ast-content")
        contentDiv = msgDiv.children[i];
    }
    assert.ok(contentDiv !== null);
    // The **Raido** should create a <strong> element
    var hasStrong = false;
    for (var j = 0; j < contentDiv.children.length; j++) {
      if (contentDiv.children[j].tagName === "STRONG") hasStrong = true;
    }
    assert.ok(hasStrong);
  });

  it("should escape HTML in text", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    addMessage("<script>alert('xss')</script>", "user");
    var msgDiv = msgArea.children[0];
    var contentDiv = null;
    for (var i = 0; i < msgDiv.children.length; i++) {
      if (msgDiv.children[i].className === "ast-content")
        contentDiv = msgDiv.children[i];
    }
    var html = contentDiv.innerHTML || "";
    assert.ok(!html.includes("<script>"));
  });

  it("should do nothing if msgArea missing", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    var result = addMessage("test", "bot");
    assert.equal(result, undefined);
  });

  it("should handle newlines in text", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    addMessage("Line1\nLine2\nLine3", "bot");
    var msgDiv = msgArea.children[0];
    var contentDiv = null;
    for (var i = 0; i < msgDiv.children.length; i++) {
      if (msgDiv.children[i].className === "ast-content")
        contentDiv = msgDiv.children[i];
    }
    // Should have <br> elements for newlines
    var brCount = 0;
    for (var j = 0; j < contentDiv.children.length; j++) {
      if (contentDiv.children[j].tagName === "BR") brCount++;
    }
    assert.equal(brCount, 2);
  });
});

describe("Assistant — showSuggestions", function () {
  afterEach(cleanupGlobals);

  it("should create suggestion buttons", function () {
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var doc = createMockDocument({ assistantSuggestions: container });
    globalThis.document = doc;
    showSuggestions(["How to watermark?", "What is fingerprint?"], "en");
    assert.equal(container.children.length, 2);
    assert.equal(container.children[0].className, "ast-chip");
    assert.equal(container.children[0].textContent, "How to watermark?");
    assert.equal(container.style.display, "flex");
  });

  it("should hide container when no suggestions", function () {
    var container = {
      children: [],
      style: { display: "flex" },
      innerHTML: "",
      append: function () {},
    };
    var doc = createMockDocument({ assistantSuggestions: container });
    globalThis.document = doc;
    showSuggestions([], "en");
    assert.equal(container.style.display, "none");
  });

  it("should hide container when suggestions is null", function () {
    var container = {
      children: [],
      style: { display: "flex" },
      innerHTML: "",
      append: function () {},
    };
    var doc = createMockDocument({ assistantSuggestions: container });
    globalThis.document = doc;
    showSuggestions(null, "en");
    assert.equal(container.style.display, "none");
  });

  it("should do nothing if container missing", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    // Should not throw
    showSuggestions(["test"], "en");
  });

  it("suggestion chip onclick should send message and respond", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "flex" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
    });
    globalThis.document = doc;
    showSuggestions(["how to embed watermark"], "en");
    assert.equal(container.children.length, 1);
    // Click the chip
    var chip = container.children[0];
    assert.equal(chip.className, "ast-chip");
    // Store original setTimeout to restore after test
    var origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function (fn) {
      fn();
      return 0;
    };
    chip.onclick();
    // After click: user message + bot response (typing removed)
    var hasUser = false;
    var hasBot = false;
    for (var i = 0; i < msgArea.children.length; i++) {
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-user")
      )
        hasUser = true;
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-bot")
      )
        hasBot = true;
    }
    assert.ok(hasUser, "Should have user message from chip click");
    assert.ok(hasBot, "Should have bot response from chip click");
    globalThis.setTimeout = origSetTimeout;
  });
});

describe("Assistant — showInitialGreeting", function () {
  afterEach(cleanupGlobals);

  it("should show bot message with greeting", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
    });
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return { id: "page-home" };
      return null;
    };
    globalThis.document = doc;
    showInitialGreeting();
    assert.equal(msgArea.children.length, 1);
    assert.ok(msgArea.children[0].className.includes("ast-msg-bot"));
  });

  it("should show contextual greeting on watermark page", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
    });
    doc.querySelector = function (sel) {
      if (sel === ".page.active") return { id: "page-watermark" };
      return null;
    };
    globalThis.document = doc;
    showInitialGreeting();
    assert.equal(msgArea.children.length, 1);
  });

  it("should show bot detection message when automated", function () {
    globalThis.REDOSAN_BOT_CHECK = { isAutomated: true };
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    showInitialGreeting();
    assert.equal(msgArea.children.length, 1);
    var contentDiv = msgArea.children[0];
    // Should contain the automated browser message somewhere
    var allText = "";
    (function collectText(node) {
      if (node.textContent) allText += node.textContent;
      if (node.children) {
        for (var i = 0; i < node.children.length; i++)
          collectText(node.children[i]);
      }
    })(contentDiv);
    assert.ok(
      allText.includes("Automated browser detected") ||
        allText.includes("تم اكتشاف متصفح آلي"),
    );
    delete globalThis.REDOSAN_BOT_CHECK;
  });

  it("should do nothing if msgArea missing", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    // Should not throw
    showInitialGreeting();
  });
});

describe("Assistant — sendAssistantMessage", function () {
  var origSetTimeout;

  beforeEach(function () {
    mockStorage = {};
    // Mock setTimeout to run immediately so async callbacks complete within test scope
    origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function (fn) {
      fn();
      return 0;
    };
  });

  afterEach(function () {
    cleanupGlobals();
    globalThis.setTimeout = origSetTimeout;
  });

  it("should skip if bot detected", function () {
    globalThis.REDOSAN_BOT_CHECK = { isAutomated: true };
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    sendAssistantMessage("hello");
    assert.equal(msgArea.children.length, 1);
    delete globalThis.REDOSAN_BOT_CHECK;
  });

  it("should add user message and bot response", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var input = {
      value: "",
      trim: function () {
        return "";
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
      assistantInput: input,
    });
    globalThis.document = doc;
    sendAssistantMessage("hello");
    // With mocked setTimeout, bot response is added immediately
    // msgArea should have user message + bot response (typing indicator removed)
    var hasUser = false;
    var hasBot = false;
    for (var i = 0; i < msgArea.children.length; i++) {
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-user")
      )
        hasUser = true;
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-bot")
      )
        hasBot = true;
    }
    assert.ok(hasUser, "Should have user message");
    assert.ok(hasBot, "Should have bot response");
    // Suggestions should be shown
    assert.equal(container.style.display, "flex");
  });

  it("should read from input if no text provided", function () {
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function () {},
    };
    var inputEl = {
      value: "  hello  ",
      trim: function () {
        return "hello";
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
      assistantInput: inputEl,
    });
    globalThis.document = doc;
    sendAssistantMessage();
    var hasUser = false;
    for (var i = 0; i < msgArea.children.length; i++) {
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-user")
      )
        hasUser = true;
    }
    assert.ok(hasUser, "Should have user message from input");
    // Input value should be cleared
    assert.equal(inputEl.value, "");
  });

  it("should do nothing if input empty", function () {
    var msgArea = {
      children: [],
      append: function () {},
      scrollTop: 0,
      scrollHeight: 100,
    };
    var doc = createMockDocument({ assistantMessages: msgArea });
    globalThis.document = doc;
    // Should not add any message
    sendAssistantMessage();
    assert.equal(msgArea.children.length, 0);
  });

  it("should save to chat history", function () {
    mockStorage = {};
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function () {},
    };
    var input = {
      value: "",
      trim: function () {
        return "";
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
      assistantInput: input,
    });
    globalThis.document = doc;
    sendAssistantMessage("test");
    var stored = JSON.parse(localStorage.getItem("redosan_chat") || "[]");
    assert.equal(stored.length, 2); // user + bot
    assert.equal(stored[0].role, "user");
    assert.equal(stored[0].text, "test");
    assert.equal(stored[1].role, "bot");
  });

  it("should handle Arabic input with Arabic response", function () {
    // Use getAssistantResponse directly to verify the Arabic response works end-to-end
    var intent = matchAssistantIntent("مرحبا");
    assert.ok(intent !== null, "Should match Arabic greeting");
    var response = getAssistantResponse(intent, "ar");
    assert.ok(
      /[\u0600-\u06FF]/.test(response),
      "Response should contain Arabic text",
    );
    assert.ok(response.length > 10, "Response should be substantial");

    // Also test the full sendAssistantMessage flow
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var input = {
      value: "",
      trim: function () {
        return "";
      },
    };
    var doc = createMockDocument({
      assistantMessages: msgArea,
      assistantSuggestions: container,
      assistantInput: input,
    });
    globalThis.document = doc;
    sendAssistantMessage("مرحبا");
    var hasBot = false;
    for (var i = 0; i < msgArea.children.length; i++) {
      if (
        msgArea.children[i].className &&
        msgArea.children[i].className.includes("ast-msg-bot")
      ) {
        hasBot = true;
      }
    }
    assert.ok(hasBot, "Should have bot response for Arabic input");
  });
});

describe("Assistant — handleAssistantKeydown", function () {
  afterEach(cleanupGlobals);

  it("should call sendAssistantMessage on Enter", function () {
    var called = false;
    var origSend = globalThis.sendAssistantMessage;
    globalThis.sendAssistantMessage = function () {
      called = true;
    };
    var e = { key: "Enter", shiftKey: false, preventDefault: mock.fn() };
    handleAssistantKeydown(e);
    assert.ok(called);
    assert.equal(e.preventDefault.mock.calls.length, 1);
    globalThis.sendAssistantMessage = origSend;
  });

  it("should NOT call sendAssistantMessage on Shift+Enter", function () {
    var called = false;
    var origSend = globalThis.sendAssistantMessage;
    globalThis.sendAssistantMessage = function () {
      called = true;
    };
    var e = { key: "Enter", shiftKey: true, preventDefault: mock.fn() };
    handleAssistantKeydown(e);
    assert.ok(!called);
    globalThis.sendAssistantMessage = origSend;
  });

  it("should ignore non-Enter keys", function () {
    var called = false;
    var origSend = globalThis.sendAssistantMessage;
    globalThis.sendAssistantMessage = function () {
      called = true;
    };
    var e = { key: "Escape", shiftKey: false, preventDefault: mock.fn() };
    handleAssistantKeydown(e);
    assert.ok(!called);
    globalThis.sendAssistantMessage = origSend;
  });
});

describe("Assistant — data integrity", function () {
  it("ASSISTANT_KB should have at least 30 intents", function () {
    assert.ok(ASSISTANT_KB.length >= 30);
  });

  it("all intents should have id, patterns, response with en and ar", function () {
    for (var i = 0; i < ASSISTANT_KB.length; i++) {
      var intent = ASSISTANT_KB[i];
      assert.ok(intent.id, "Intent " + i + " missing id");
      assert.ok(
        Array.isArray(intent.patterns),
        "Intent " + intent.id + " missing patterns",
      );
      assert.ok(
        intent.patterns.length > 0,
        "Intent " + intent.id + " has empty patterns",
      );
      assert.ok(intent.response, "Intent " + intent.id + " missing response");
      assert.ok(
        intent.response.en,
        "Intent " + intent.id + " missing en response",
      );
      assert.ok(
        intent.response.ar,
        "Intent " + intent.id + " missing ar response",
      );
    }
  });

  it("ASSISTANT_FALLBACK should have en and ar", function () {
    assert.ok(ASSISTANT_FALLBACK.en);
    assert.ok(ASSISTANT_FALLBACK.ar);
  });

  it("ASSISTANT_GREETING should have en and ar", function () {
    assert.ok(ASSISTANT_GREETING.en);
    assert.ok(ASSISTANT_GREETING.ar);
  });

  it("all suggestion arrays should have matching en/ar when present", function () {
    for (var i = 0; i < ASSISTANT_KB.length; i++) {
      var intent = ASSISTANT_KB[i];
      if (intent.suggestions) {
        assert.ok(
          Array.isArray(intent.suggestions.en),
          "Intent " + intent.id + " suggestions.en is not array",
        );
        assert.ok(
          Array.isArray(intent.suggestions.ar),
          "Intent " + intent.id + " suggestions.ar is not array",
        );
      }
    }
  });
});

describe("Assistant — toggleAssistant", function () {
  afterEach(function () {
    cleanupGlobals();
    globalThis.ASSISTANT_OPEN = false;
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
  });

  it("should do nothing if panel/bubble missing", function () {
    var doc = createMockDocument({});
    globalThis.document = doc;
    // Should not throw
    toggleAssistant();
  });

  it("should open panel and call showInitialGreeting when no messages", function () {
    var panel = { classList: { add: mock.fn(), remove: mock.fn() }, style: {} };
    var bubble = { style: { display: "" } };
    var msgArea = {
      children: [],
      append: function (el) {
        this.children.push(el);
        if (el.parentNode === undefined) el.parentNode = msgArea;
      },
      scrollTop: 0,
      scrollHeight: 100,
    };
    var container = {
      children: [],
      style: { display: "" },
      innerHTML: "",
      append: function (el) {
        this.children.push(el);
      },
    };
    var inputEl = { value: "", focus: mock.fn() };
    var doc = createMockDocument({
      assistantPanel: panel,
      assistantBubble: bubble,
      assistantMessages: msgArea,
      assistantSuggestions: container,
      assistantInput: inputEl,
    });
    globalThis.document = doc;
    globalThis.ASSISTANT_OPEN = false;
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
    toggleAssistant();
    assert.ok(globalThis.ASSISTANT_OPEN === true);
    assert.equal(panel.classList.add.mock.calls.length, 1);
    assert.equal(bubble.style.display, "none");
    // showInitialGreeting should have been called (msgArea is empty)
    assert.equal(msgArea.children.length, 1);
    // Reset lock for cleanup
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
  });

  it("should close panel", function () {
    var panel = { classList: { add: mock.fn(), remove: mock.fn() }, style: {} };
    var bubble = { style: { display: "none" } };
    var doc = createMockDocument({
      assistantPanel: panel,
      assistantBubble: bubble,
    });
    globalThis.document = doc;
    globalThis.ASSISTANT_OPEN = true;
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
    toggleAssistant();
    assert.ok(globalThis.ASSISTANT_OPEN === false);
    assert.equal(panel.classList.remove.mock.calls.length, 1);
    assert.equal(bubble.style.display, "");
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
  });

  it("should not show greeting if messages already exist", function () {
    // msgArea has children already
    var existingMsg = { className: "ast-msg" };
    var panel = { classList: { add: mock.fn(), remove: mock.fn() }, style: {} };
    var bubble = { style: { display: "" } };
    var msgArea = {
      children: [existingMsg],
      append: function () {},
      scrollTop: 0,
      scrollHeight: 100,
    };
    var inputEl = { value: "", focus: mock.fn() };
    var doc = createMockDocument({
      assistantPanel: panel,
      assistantBubble: bubble,
      assistantMessages: msgArea,
      assistantInput: inputEl,
    });
    globalThis.document = doc;
    globalThis.ASSISTANT_OPEN = false;
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
    toggleAssistant();
    assert.ok(globalThis.ASSISTANT_OPEN === true);
    // msgArea still has only the pre-existing message (no showInitialGreeting added one)
    assert.equal(msgArea.children.length, 1);
    globalThis.ASSISTANT_TOGGLE_LOCK = false;
  });
});
