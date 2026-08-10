(function () {
  if (
    typeof window !== "undefined" &&
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
// ◆◆ Internationalization ◆◆
var i18n = { lang: "en", data: {} };
var SUPPORTED = new Set(["en", "ar", "fr", "de", "es", "zh", "ja", "ko"]);

/**
 *
 * @param key
 * @param fallback
 */
function __(key, fallback) {
  if (i18n && i18n.data && i18n.data[key]) return i18n.data[key];
  var en = window.__I18N_DATA && window.__I18N_DATA.en;
  if (en && en[key]) return en[key];
  return fallback || key;
}

/**
 *
 * @param html
 */
function sanitizeHtml(html) {
  var allowed =
    /^(h[23]|p|ul|li|a|br|strong|em|b|i|code|pre|blockquote|ol|span|div)$/i;
  var prev;
  do {
    prev = html;
    html = html.replace(
      /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g,
      function (m, name) {
        if (!allowed.test(name)) return "";
        var result = "<" + name;
        var attrs =
          m.match(
            /\s+[a-zA-Z][a-zA-Z0-9-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g,
          ) || [];
        for (let i = 0; i < attrs.length; i++) {
          const a = attrs[i];
          const aname = a.match(/\s+([a-zA-Z][a-zA-Z0-9-]*)/)[1];
          if (/^on/i.test(aname)) continue;
          let val = a.replace(/^[^=]+=\s*/, "");
          const quote = val.charAt(0);
          if (quote === '"' || quote === "'") val = val.slice(1, -1);
          // Normalize before protocol check: browsers trim leading whitespace
          // and decode HTML entities before executing attribute values.
          val = val
            .replace(/&#x([0-9a-f]+);/gi, function (m, h) {
              return String.fromCodePoint(parseInt(h, 16));
            })
            .replace(/&#([0-9]+);/g, function (m, d) {
              return String.fromCodePoint(parseInt(d, 10));
            })
            .replace(/&colon;/gi, ":")
            .replace(/&tab;/gi, "\t")
            .replace(/&nbsp;/gi, " ")
            .trim();
          if (/^(javascript|data|vbscript|blob):/i.test(val)) continue;
          result += a;
        }
        result += ">";
        return result;
      },
    );
  } while (html !== prev);
  return html;
}

// Browser language fallback mapping

// Fallback language mapping for browser language
var BROWSER_LANGUAGE_MAP = {
  en: "en",
  ar: "ar",
  fr: "fr",
  de: "de",
  es: "es",
  zh: "zh",
  ja: "ja",
  ko: "ko",
  pt: "pt",
  it: "it",
  ru: "ru",
  hi: "hi",
  ur: "ur",
  bn: "bn",
  id: "id",
  ms: "ms",
  th: "th",
  vi: "vi",
  tl: "tl",
  tr: "tr",
  fa: "fa",
  he: "he",
  nl: "nl",
  sv: "sv",
  no: "no",
  da: "da",
  fi: "fi",
  pl: "pl",
  cs: "cs",
  hu: "hu",
  el: "el",
  uk: "uk",
  ro: "ro",
  bg: "bg",
  hr: "hr",
  sr: "sr",
  am: "am",
  et: "et",
};

/**
 *
 */
async function detectLang() {
  var stored = localStorage.getItem("redosan_lang");
  if (stored && SUPPORTED.has(stored)) return stored;

  var navLang = (
    navigator.language ||
    navigator.userLanguage ||
    ""
  ).toLowerCase();
  var primaryLang = navLang.substring(0, 2);

  if (SUPPORTED.has(primaryLang)) return primaryLang;

  var mappedLang = BROWSER_LANGUAGE_MAP[primaryLang];
  if (mappedLang && SUPPORTED.has(mappedLang)) return mappedLang;

  var langWithRegion = navLang.substring(0, 5);
  if (SUPPORTED.has(langWithRegion)) return langWithRegion;

  return "en";
}

/**
 *
 * @param lang
 */
function switchLang(lang) {
  if (!SUPPORTED.has(lang)) lang = "en";
  localStorage.setItem("redosan_lang", lang);
  loadLang(lang);
}

/**
 *
 * @param lang
 */
function langBtnText(lang) {
  // Return the most common alternative language for the current language
  var alternatives = {
    en: "العربية",
    ar: "English",
    fr: "English",
    de: "English",
    es: "English",
    zh: "English",
    ja: "English",
    ko: "English",
  };
  return alternatives[lang] || "English";
}

/**
 *
 * @param lang
 */
function getLanguageDisplayName(lang) {
  // Try to get localized name from current language data
  if (i18n.data && i18n.data["lang.name." + lang]) {
    return i18n.data["lang.name." + lang];
  }

  // Fallback to default names
  var names = {
    en: "English",
    ar: "العربية",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    zh: "中文",
    ja: "日本語",
    ko: "한국어",
  };
  return names[lang] || lang;
}

/**
 * Resolve the Style/ base directory for language files. Works from the SPA
 * root (Style/...), standalone MPA pages (../../), and deep 404 fallback
 * paths (absolute /Style/... under the site root).
 * @returns {string}
 */
function i18nLangBase() {
  if (document.documentElement.dataset.standalone) return "../../";
  var m = globalThis.location.pathname.match(/^(.*?\/)Style\/pages\//);
  if (m) return m[1] + "Style/";
  return "Style/";
}

/**
 *
 * @param lang
 */
async function loadLang(lang) {
  try {
    const cached = window.__I18N_DATA && window.__I18N_DATA[lang];
    if (cached && Object.keys(cached).length > 0) {
      i18n.data = cached;
      i18n.lang = lang;
      applyLang();
      return true;
    }
    const base = i18nLangBase();
    const resp = await fetch(base + "lang/" + lang + ".json");
    if (!resp.ok) throw new Error("Language file not found: " + lang);
    const data = await resp.json();
    if (!window.__I18N_DATA) window.__I18N_DATA = {};
    window.__I18N_DATA[lang] = data;
    i18n.data = data;
    i18n.lang = lang;
    // Keep English cached as a fallback for missing keys in other languages
    if (lang !== "en" && !window.__I18N_DATA.en) {
      fetch(base + "lang/en.json")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (enData) {
          if (enData) window.__I18N_DATA.en = enData;
        })
        .catch(function () {});
    }
    applyLang();
    return true;
  } catch (error) {
    console.error("i18n load error:", error);
    if (lang !== "en") {
      return loadLang("en");
    }
    return false;
  }
}

/**
 *
 */
function applyLang() {
  document.documentElement.lang = i18n.lang;
  document.documentElement.dir = i18n.lang === "ar" ? "rtl" : "ltr";

  var btn = document.getElementById("langBtn");
  if (btn) {
    let displayName = getLanguageDisplayName(i18n.lang);
    btn.textContent = displayName;
    btn.title = "Current: " + displayName + "\nClick to change language";
  }
  var sBtn = document.getElementById("simpleLangBtn");
  if (sBtn) {
    displayName = getLanguageDisplayName(i18n.lang);
    sBtn.textContent = displayName;
    sBtn.title = "Current: " + displayName + "\nClick to change language";
  }
  var mBtn = document.getElementById("modeLangBtn");
  if (mBtn) {
    displayName = getLanguageDisplayName(i18n.lang);
    mBtn.textContent = displayName;
    mBtn.title = "Current: " + displayName + "\nClick to change language";
  }

  var richHtmlKeys = new Set([
    "page.about",
    "page.privacy",
    "page.contact",
    "page.social",
  ]);
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.dataset.i18n;
    var text = i18n.data[key];
    if (text === undefined) {
      const enFallback = window.__I18N_DATA && window.__I18N_DATA.en;
      if (enFallback && enFallback[key]) text = enFallback[key];
    }
    if (text === undefined) return;
    if (richHtmlKeys.has(key)) {
      el.innerHTML = sanitizeHtml(text);
    } else {
      el.textContent = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    var key = el.dataset.i18nPlaceholder;
    var text = i18n.data[key];
    if (text === undefined) {
      const enFallback = window.__I18N_DATA && window.__I18N_DATA.en;
      if (enFallback && enFallback[key]) text = enFallback[key];
    }
    if (text !== undefined) el.placeholder = text;
  });

  // Clean up any empty heading or anchor elements that may have been generated
  var richSections = document.querySelectorAll(
    "#page-about .static-page, #page-privacy .static-page",
  );
  richSections.forEach(function (section) {
    var emptyH2 = section.querySelectorAll("h2:empty, h2:not(:empty)");
    emptyH2.forEach(function (h) {
      if (!h.textContent.trim()) h.remove();
    });
    var emptyA = section.querySelectorAll("a:not([href]):not([aria-label])");
    emptyA.forEach(function (a) {
      if (!a.textContent.trim()) a.remove();
    });
    // Also remove empty <a> with href="#" that have no text content
    var emptyLinkA = section.querySelectorAll('a[href="#"]');
    emptyLinkA.forEach(function (a) {
      if (!a.textContent.trim()) a.remove();
    });
  });

  // Handle RTL CSS for Arabic only
  var link = document.getElementById("rtl-css");
  if (i18n.lang === "ar") {
    if (!link) {
      link = document.createElement("link");
      link.id = "rtl-css";
      link.rel = "stylesheet";
      const rtlBase = document.documentElement.dataset.standalone
        ? "../../"
        : "Style/";
      link.href = rtlBase + "rtl.css";
      document.head.append(link);
    }
  } else {
    if (link) link.remove();
  }

  // Update dynamic file drop zone text
  var dzText = i18n.data["shared.drop_file"];
  if (dzText) {
    document.querySelectorAll(".dz-text").forEach(function (el) {
      el.innerHTML = sanitizeHtml(dzText);
    });
  }

  // Update language button titles
  displayName = getLanguageDisplayName(i18n.lang);
  ["langBtn", "simpleLangBtn", "modeLangBtn"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn)
      btn.title = __(
        "shared.lang_title",
        "Current: " + displayName + "\nClick to change language",
      ).replace("{lang}", displayName);
  });
}
globalThis.translatePage = applyLang;

/**
 *
 */
function toggleLangDropdown() {
  var menu = document.getElementById("langMenu");
  if (menu) menu.classList.toggle("show");
}

// Close language dropdown when clicking outside
document.addEventListener("click", function (e) {
  // Close simplified language menu
  var sMenu = document.getElementById("simpleLangMenu");
  var sDropdown = document.querySelector("#simplifiedMode .lang-dropdown");
  if (sDropdown && !sDropdown.contains(e.target) && sMenu) {
    sMenu.classList.remove("show");
  }
  // Close mode select language menu
  var mMenus = document.getElementById("modeLangMenu");
  var mDropdown = document.querySelector("#modeSelect .lang-dropdown");
  if (mDropdown && !mDropdown.contains(e.target) && mMenus) {
    mMenus.classList.remove("show");
  }
  // Close professional mode (nav) language menu
  var pMenu = document.getElementById("langMenu");
  var pDropdown = document.querySelector("nav .lang-dropdown");
  if (pDropdown && !pDropdown.contains(e.target) && pMenu) {
    pMenu.classList.remove("show");
  }
});

// Comprehensive error filtering for browser extensions
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Prevent multiple declarations
if (window.originalConsoleError === undefined) {
  window.originalConsoleError = console.error;
  window.originalConsoleWarn = console.warn;
  window.originalConsoleLog = console.log;
}

/**
 *
 * @param message
 */
function shouldFilterError(message) {
  if (!message) return false;
  const msg = message.toString().toLowerCase();

  // Filter all Chrome extension runtime errors
  return (
    // Connection errors
    (msg.includes("runtime.lasterror") &&
      msg.includes("could not establish connection")) ||
    (msg.includes("runtime.lasterror") &&
      msg.includes("receiving end does not exist")) ||
    // Message passing errors
    (msg.includes("runtime.lasterror") && msg.includes("message")) ||
    (msg.includes("runtime.lasterror") && msg.includes("tabs.sendmessage")) ||
    // Extension communication errors
    (msg.includes("runtime.lasterror") &&
      msg.includes("the message port closed")) ||
    (msg.includes("runtime.lasterror") &&
      msg.includes("extension context invalidated")) ||
    // General extension errors
    (msg.includes("runtime.lasterror") && msg.includes("access denied")) ||
    (msg.includes("runtime.lasterror") && msg.includes("not available")) ||
    // Promise rejection errors from extensions
    (msg.includes("could not establish connection") &&
      msg.includes("receiving end does not exist")) ||
    (msg.includes("uncaught (in promise)") &&
      msg.includes("could not establish connection")) ||
    // Async response / message channel closed (Chrome extension service worker)
    msg.includes("listener indicated an asynchronous response") ||
    msg.includes("message channel closed before a response") ||
    msg.includes("unchecked runtime.lasterror") ||
    (msg.includes("runtime.lasterror") && msg.includes("port closed"))
  );
}

console.error = function (...args) {
  const message = args.join(" ");
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  const message = args.join(" ");
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleWarn.apply(console, args);
};

console.log = function (...args) {
  const message = args.join(" ");
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleLog.apply(console, args);
};

// Handle uncaught promise rejections from browser extensions
window.addEventListener("unhandledrejection", function (event) {
  if (event.reason) {
    const reasonStr = event.reason.toString().toLowerCase();
    if (shouldFilterError(reasonStr)) {
      event.preventDefault(); // Prevent the error from showing in console
      return;
    }
  }
});

// Also handle regular uncaught errors
window.addEventListener("error", function (event) {
  if (event.message && shouldFilterError(event.message)) {
    event.preventDefault(); // Prevent the error from showing in console
  }
});

// Also handle console exceptions
window.addEventListener("error", function (event) {
  if (
    event.error &&
    event.error.message &&
    shouldFilterError(event.error.message)
  ) {
    event.preventDefault(); // Prevent the error from showing in console
  }
});

// Early i18n application: when loaded from <head> (window.__I18N_EARLY), translate
// nodes as the DOM is being parsed so text swaps finish before first paint (no CLS).
// The DOMContentLoaded boot below still runs as a safe idempotent fallback.
if (window.__I18N_EARLY) {
  (function () {
    var applying = false;
    /**
     *
     */
    function scheduleApply() {
      if (applying) return;
      applying = true;
      requestAnimationFrame(function () {
        if (document.body) {
          applyLang();
          // Keep the guard on until the mutation records produced by
          // applyLang (textContent/innerHTML swaps) have been delivered to
          // the observer; otherwise they re-trigger an endless translate loop.
          Promise.resolve().then(function () {
            applying = false;
          });
        } else {
          applying = false;
        }
      });
    }
    detectLang().then(function (lang) {
      loadLang(lang).then(function () {
        new MutationObserver(function (muts) {
          for (let i = 0; i < muts.length; i++) {
            if (muts[i].addedNodes.length) {
              scheduleApply();
              break;
            }
          }
        }).observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
        scheduleApply();
      });
    });
  })();
}

// Initialize language system
document.addEventListener("DOMContentLoaded", async function () {
  try {
    const lang = await detectLang();
    await loadLang(lang);
  } catch (error) {
    console.error("Language initialization failed:", error);
    // Fallback to English
    loadLang("en");
  }
});
