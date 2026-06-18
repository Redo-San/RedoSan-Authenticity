(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();

// Data has been moved to assistant_data.js
/**
 *
 */
function getAssistantLang() {
  try {
    if (typeof i18n !== "undefined" && i18n && i18n.lang) return i18n.lang;
  } catch {}
  var html = document.documentElement;
  return html.getAttribute("lang") || "en";
}

/**
 *
 */
function getCurrentContext() {
  var active = document.querySelector(".page.active");
  if (!active) return "";
  var id = active.id || "";
  return id.replace("page-", "");
}

// ── Arabic text normalization ──
/**
 *
 * @param t
 */
function normalizeArabic(t) {
  return t
    .replaceAll(/[أإآ]/g, "ا")
    .replaceAll(/[ة]/g, "ه")
    .replaceAll(/[ى]/g, "ي")
    .replaceAll(/[ـ]/g, "")
    .replaceAll(/[\u064B-\u0652]/g, "");
}

// ── Levenshtein distance (typo tolerance) ──
/**
 *
 * @param a
 * @param b
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var m = [];
  for (var i = 0; i <= b.length; i++) m[i] = [i];
  for (var j = 0; j <= a.length; j++) m[0][j] = j;
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      var cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + cost,
      );
    }
  }
  return m[b.length][a.length];
}

// ── Tokenizer with Arabic normalization ──
/**
 *
 * @param t
 */
function assistantTokenize(t) {
  return normalizeArabic(t.toLowerCase())
    .replaceAll(/[^\w\s\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// ── Intelligent intent matcher ──
/**
 *
 * @param input
 */
function matchAssistantIntent(input) {
  var tokens = assistantTokenize(input);
  if (tokens.length === 0) return null;
  var normalized = normalizeArabic(input.toLowerCase());
  var FUZZY_THRESHOLD = 0.72;

  var bestScore = 0;
  var bestMatch = null;

  for (var intent of ASSISTANT_KB) {
    for (var j = 0; j < intent.patterns.length; j++) {
      var normPattern = normalizeArabic(intent.patterns[j].toLowerCase());
      var patternTokens = normPattern.split(/\s+/);
      if (patternTokens.length === 0) continue;

      // Exact phrase match → 100% confidence
      if (normalized === normPattern) {
        return intent;
      }

      // Token-level matching
      var exactMatches = 0;
      var fuzzyMatches = 0;
      var union = {};
      var inTokens = {};

      for (var k = 0; k < tokens.length; k++) union[tokens[k]] = true;
      for (var k = 0; k < patternTokens.length; k++)
        union[patternTokens[k]] = true;
      for (var k = 0; k < tokens.length; k++) inTokens[tokens[k]] = true;

      for (var k = 0; k < patternTokens.length; k++) {
        if (inTokens[patternTokens[k]]) {
          exactMatches++;
        } else {
          for (const token of tokens) {
            var maxL = Math.max(patternTokens[k].length, token.length);
            if (maxL === 0) continue;
            if (
              1 - levenshtein(patternTokens[k], token) / maxL >=
              FUZZY_THRESHOLD
            ) {
              fuzzyMatches++;
              break;
            }
          }
        }
      }

      var matchedTokens = exactMatches + fuzzyMatches;
      var unionSize = Object.keys(union).length;
      var jaccard = unionSize > 0 ? matchedTokens / unionSize : 0;
      var coverage =
        patternTokens.length > 0 ? matchedTokens / patternTokens.length : 0;
      var score = jaccard * 0.3 + coverage * 0.7;

      // Substring bonus
      if (normalized.includes(normPattern)) {
        score = Math.max(
          score,
          0.5 + (normPattern.length / Math.max(normalized.length, 1)) * 0.4,
        );
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    }
  }
  return bestScore >= 0.28 ? bestMatch : null;
}

/**
 *
 * @param inputText
 */
function getResponseLang(inputText) {
  return inputText && /[\u0600-\u06FF]/.test(inputText)
    ? "ar"
    : getAssistantLang();
}

/**
 *
 * @param intent
 * @param lang
 */
function getAssistantResponse(intent, lang) {
  if (!lang) lang = getAssistantLang();
  if (intent && intent.response) {
    return intent.response[lang] || intent.response.en || "";
  }
  return ASSISTANT_FALLBACK[lang] || ASSISTANT_FALLBACK.en;
}

/**
 *
 * @param intent
 * @param lang
 */
function getAssistantSuggestions(intent, lang) {
  if (!lang) lang = getAssistantLang();
  if (intent && intent.suggestions) {
    return intent.suggestions[lang] || intent.suggestions.en || [];
  }
  return [];
}

/**
 *
 * @param lang
 */
function getContextualSuggestions(lang) {
  if (!lang) lang = getAssistantLang();
  var ctx = getCurrentContext();

  var defaults = {
    en: ["How to watermark?", "What is fingerprint?", "Privacy & Security"],
    ar: ["كيفية العلامة المائية؟", "ما هي البصمة؟", "الخصوصية والأمان"],
  };

  var contextMap = {
    watermark: {
      en: ["How to embed?", "How to extract?", "What algorithm to use?"],
      ar: ["كيفية التضمين؟", "كيفية الاستخراج؟", "ما الخوارزمية المناسبة؟"],
    },
    "pixel-injection": {
      en: [
        "What is pixel injection?",
        "How to inject?",
        "Algorithm categories",
      ],
      ar: ["ما هو حقن البكسل؟", "كيفية الحقن؟", "فئات الخوارزميات"],
    },
    fingerprint: {
      en: ["What is fingerprint?", "What algorithms?", "What is it used for?"],
      ar: ["ما هي البصمة؟", "ما الخوارزميات؟", "ما فائدتها؟"],
    },
    metadata: {
      en: ["What is metadata?", "What info is stored?", "How to read?"],
      ar: [
        "ما هي البيانات الوصفية؟",
        "ما المعلومات المخزنة؟",
        "كيفية القراءة؟",
      ],
    },
    timestamp: {
      en: ["How to create?", "How to verify?", "What is OTS?"],
      ar: ["كيفية الإنشاء؟", "كيفية التحقق؟", "ما هو OTS؟"],
    },
    c2pa: {
      en: ["What is C2PA?", "How to sign?", "How to read?"],
      ar: ["ما هو C2PA؟", "كيفية التوقيع؟", "كيفية القراءة؟"],
    },
    certificate: {
      en: [
        "What is Digital Passport?",
        "How to generate?",
        "Supported formats?",
      ],
      ar: ["ما هو جواز السفر الرقمي؟", "كيفية الإنشاء؟", "الصيغ المدعومة؟"],
    },
    converter: {
      en: ["What formats?", "How to convert?", "Image conversion"],
      ar: ["ما الصيغ؟", "كيفية التحويل؟", "تحويل الصور"],
    },
  };

  return contextMap[ctx]
    ? contextMap[ctx][lang] || contextMap[ctx].en
    : defaults[lang] || defaults.en;
}

// ── Chat History ──
/**
 *
 */
function loadChatHistory() {
  try {
    var h = localStorage.getItem("redosan_chat");
    return h ? JSON.parse(h) : [];
  } catch {
    return [];
  }
}

/**
 *
 * @param messages
 */
function saveChatHistory(messages) {
  try {
    localStorage.setItem("redosan_chat", JSON.stringify(messages.slice(-50)));
  } catch {}
}

/**
 *
 */
function clearChatHistory() {
  try {
    localStorage.removeItem("redosan_chat");
  } catch {}
}

// ── UI ──
var ASSISTANT_OPEN = false;
var ASSISTANT_TOGGLE_LOCK = false;

/**
 *
 */
function toggleAssistant() {
  if (ASSISTANT_TOGGLE_LOCK) return;
  ASSISTANT_TOGGLE_LOCK = true;
  setTimeout(function () {
    ASSISTANT_TOGGLE_LOCK = false;
  }, 300);
  var panel = document.querySelector("#assistantPanel");
  var bubble = document.querySelector("#assistantBubble");
  if (!panel || !bubble) return;
  ASSISTANT_OPEN = !ASSISTANT_OPEN;
  if (ASSISTANT_OPEN) {
    panel.classList.add("open");
    bubble.style.display = "none";
    var msgArea = document.querySelector("#assistantMessages");
    if (msgArea && msgArea.children.length === 0) {
      showInitialGreeting();
    }
    var input = document.querySelector("#assistantInput");
    if (input)
      setTimeout(function () {
        input.focus();
      }, 300);
  } else {
    panel.classList.remove("open");
    bubble.style.display = "";
  }
}

/**
 *
 */
function showInitialGreeting() {
  var msgArea = document.querySelector("#assistantMessages");
  if (!msgArea) return;
  var lang = getAssistantLang();
  if (
    typeof REDOSAN_BOT_CHECK !== "undefined" &&
    REDOSAN_BOT_CHECK &&
    REDOSAN_BOT_CHECK.isAutomated
  ) {
    var botLang = getAssistantLang();
    addMessage(
      botLang === "ar"
        ? "⚠️ **تم اكتشاف متصفح آلي.** تطبيق RedoSan Authenticity مخصص للمستخدمين البشريين فقط. يرجى تعطيل أدوات الأتمتة."
        : "⚠️ **Automated browser detected.** RedoSan Authenticity is intended for human users only. Please disable automation tools.",
      "bot",
    );
    return;
  }
  var ctx = getCurrentContext();
  var initialMsg = ctx
    ? {
        en:
          "👋 Hi! I see you're on the **" +
          ctx.replace("-", " ") +
          "** page. Need help with it?",
        ar:
          "👋 مرحباً! أراك في صفحة **" +
          (ctx === "pixel-injection"
            ? "حقن البكسل"
            : ctx === "watermark"
            ? "العلامة المائية"
            : ctx === "fingerprint"
            ? "البصمة"
            : ctx === "metadata"
            ? "البيانات الوصفية"
            : ctx === "timestamp"
            ? "الطابع الزمني"
            : ctx === "c2pa"
            ? "C2PA"
            : ctx === "certificate"
            ? "جواز السفر الرقمي"
            : ctx === "converter"
            ? "محول الملفات"
            : ctx) +
          "**. هل تحتاج مساعدة بها؟",
      }
    : ASSISTANT_GREETING;

  addMessage(initialMsg[lang] || initialMsg.en, "bot");
  var suggestions = ctx
    ? getContextualSuggestions(lang)
    : getAssistantSuggestions(ASSISTANT_KB[0], lang);
  showSuggestions(suggestions, lang);
}

/**
 *
 * @param suggestions
 * @param lang
 */
function showSuggestions(suggestions, lang) {
  var container = document.querySelector("#assistantSuggestions");
  if (!container) return;
  container.innerHTML = "";
  if (!suggestions || suggestions.length === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";
  for (const suggestion of suggestions) {
    var chip = document.createElement("button");
    chip.className = "ast-chip";
    chip.textContent = suggestion;
    chip.addEventListener('click', (function (s, l) {
      return function () {
        document.querySelector("#assistantSuggestions").style.display = "none";
        addMessage(s, "user");
        var matched = matchAssistantIntent(s);
        setTimeout(function () {
          addMessage(getAssistantResponse(matched, l), "bot");
          var sug = matched
            ? getAssistantSuggestions(matched, l)
            : getContextualSuggestions(l);
          showSuggestions(
            sug.length > 0 ? sug : getContextualSuggestions(l),
            l,
          );
        }, 300);
      };
    })(suggestion, lang || getAssistantLang()));
    container.append(chip);
  }
}

/**
 *
 * @param text
 * @param role
 */
function addMessage(text, role) {
  var msgArea = document.querySelector("#assistantMessages");
  if (!msgArea) return;
  var div = document.createElement("div");
  div.className = "ast-msg ast-msg-" + role;
  var isBot = role === "bot";
  if (isBot) {
    var avatar = document.createElement("span");
    avatar.className = "ast-avatar";
    div.append(avatar);
  }
  var content = document.createElement("div");
  content.className = "ast-content";
  content.textContent = "";
  var formatted = text
    .replaceAll('&', "&amp;")
    .replaceAll('<', "&lt;")
    .replaceAll('>', "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll('\'', "&#039;");
  formatted = formatted
    .replaceAll(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replaceAll('\n', "<br>");
  content.innerHTML = formatted;
  div.append(content);
  msgArea.append(div);
  msgArea.scrollTop = msgArea.scrollHeight;
  return div;
}

/**
 *
 * @param text
 */
function sendAssistantMessage(text) {
  if (
    typeof REDOSAN_BOT_CHECK !== "undefined" &&
    REDOSAN_BOT_CHECK &&
    REDOSAN_BOT_CHECK.isAutomated
  ) {
    var botLang = getAssistantLang();
    addMessage(
      botLang === "ar"
        ? "⚠️ **تم اكتشاف متصفح آلي.** تطبيق RedoSan Authenticity مخصص للمستخدمين البشريين فقط. يرجى تعطيل أدوات الأتمتة."
        : "⚠️ **Automated browser detected.** RedoSan Authenticity is intended for human users only. Please disable automation tools.",
      "bot",
    );
    return;
  }
  var input = document.querySelector("#assistantInput");
  if (!text || text.trim() === "") {
    text = input ? input.value.trim() : "";
    if (!text) return;
    if (input) input.value = "";
  }

  addMessage(text, "user");
  var history = loadChatHistory();
  history.push({ role: "user", text: text });
  saveChatHistory(history);

  document.querySelector("#assistantSuggestions").style.display = "none";

  // Show typing indicator
  var typing = document.createElement("div");
  typing.className = "ast-msg ast-msg-bot ast-typing";
  typing.innerHTML =
    '<div class="ast-typing-dots"><span></span><span></span><span></span></div>';
  var msgArea = document.querySelector("#assistantMessages");
  msgArea.append(typing);
  msgArea.scrollTop = msgArea.scrollHeight;

  // Simulate processing delay
  setTimeout(
    function () {
      if (typing.parentNode) typing.remove();
      var respLang = getResponseLang(text);
      var matched = matchAssistantIntent(text);
      var response = getAssistantResponse(matched, respLang);
      addMessage(response, "bot");
      var suggestions = matched
        ? getAssistantSuggestions(matched, respLang)
        : getContextualSuggestions(respLang);
      showSuggestions(
        suggestions.length > 0
          ? suggestions
          : getContextualSuggestions(respLang),
        respLang,
      );
      history.push({ role: "bot", text: response });
      saveChatHistory(history);
    },
    400 + Math.random() * 400,
  );
}

/**
 *
 * @param e
 */
function handleAssistantKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAssistantMessage();
  }
}

/**
 *
 */
function initAssistant() {
  var lang = getAssistantLang();

  // Update i18n labels
  var title = document.querySelector(".ast-title");
  if (title)
    title.textContent = lang === "ar" ? "🤖 رايدو (Raido)" : "🤖 Raido";

  var input = document.querySelector("#assistantInput");
  if (input)
    input.placeholder =
      lang === "ar" ? "اكتب سؤالك هنا..." : "Type your question...";

  var clearBtn = document.querySelector(".ast-clear-btn");
  if (clearBtn) {
    clearBtn.title = lang === "ar" ? "مسح المحادثة" : "Clear chat";
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelector("#assistantMessages").innerHTML = "";
      clearChatHistory();
      document.querySelector("#assistantSuggestions").style.display = "none";
    });
  }

  var closeBtn = document.querySelector(".ast-close-btn");
  if (closeBtn) {
    closeBtn.title = lang === "ar" ? "إغلاق" : "Close";
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleAssistant();
    });
  }

  var bubble = document.querySelector("#assistantBubble");
  if (bubble) {
    bubble.setAttribute(
      "aria-label",
      lang === "ar" ? "فتح المساعد" : "Open assistant",
    );
    bubble.addEventListener("touchend", function (e) {
      e.preventDefault();
      toggleAssistant();
    });
  }

  var sendBtn = document.querySelector(".ast-send-btn");
  if (sendBtn) sendBtn.addEventListener("click", sendAssistantMessage);

  if (input) {
    input.addEventListener("keydown", handleAssistantKeydown);
    input.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 80) + "px";
    });
  }

  // Show greeting after short delay
  setTimeout(showInitialGreeting, 1000);
}

// Auto-init
/**
 *
 * @param fn
 */
function ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}
ready(initAssistant);
