#!/usr/bin/env node
/**
 * AI-powered i18n translation helper.
 * Translates missing keys from en.json into all other language files.
 *
 * Usage:
 *   node scripts/translate-i18n.js              # dry-run: show missing keys
 *   node scripts/translate-i18n.js --apply      # apply translations via AI
 *   node scripts/translate-i18n.js --apply --dry-run  # show what would be sent to AI
 *
 * Environment variables (required for --apply):
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY, or GITHUB_TOKEN
 *
 * Fallback order: AI API (GitHub Models/OpenAI/Anthropic/Groq/Google) →
 *   Google Translate (web endpoint, no key) → MyMemory (no key) →
 *   LibreTranslate (public instances) → xnx3 (last resort)
 */

var fs = require("node:fs");
var path = require("node:path");

var LANG_DIR = path.join(__dirname, "..", "Style", "lang");
var LANGS = ["ar", "fr", "de", "es", "zh", "ja", "ko"];

var LANG_NAMES = {
  ar: "Arabic",
  fr: "French",
  de: "German",
  es: "Spanish",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

/**
 *
 * @param filePath
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 *
 * @param obj
 * @param prefix
 */
function flatten(obj, prefix) {
  var result = {};
  for (var key in obj) {
    var p = prefix ? prefix + "." + key : key;
    if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      Object.assign(result, flatten(obj[key], p));
    } else {
      result[p] = obj[key];
    }
  }
  return result;
}

/**
 *
 * @param obj
 */
function unflatten(obj) {
  var result = {};
  for (var flatKey in obj) {
    var parts = flatKey.split(".");
    var current = result;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts.at(-1)] = obj[flatKey];
  }
  return result;
}

/**
 *
 * @param source
 * @param target
 */
function findMissing(source, target) {
  var missing = {};
  for (var key in source) {
    if (!(key in target)) {
      missing[key] = source[key];
    } else if (
      typeof source[key] === "string" &&
      typeof target[key] === "string" &&
      source[key] !== target[key]
    ) {
      // Value changed in source → re-translate
      missing[key] = source[key];
    } else if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      typeof target[key] === "object" &&
      target[key] !== null
    ) {
      var nested = findMissing(source[key], target[key]);
      if (Object.keys(nested).length > 0) missing[key] = nested;
    }
  }
  return missing;
}

/**
 *
 * @param base
 * @param overlay
 */
function deepMerge(base, overlay) {
  var result = JSON.parse(JSON.stringify(base));
  for (var key in overlay) {
    result[key] = typeof overlay[key] === "object" &&
      overlay[key] !== null &&
      !Array.isArray(overlay[key]) ? deepMerge(result[key] || {}, overlay[key]) : overlay[key];
  }
  return result;
}

var XNX3_LANG_MAP = {
  ar: "arabic",
  fr: "french",
  de: "deutsch",
  es: "spanish",
  zh: "chinese_simplified",
  ja: "japanese",
  ko: "korean",
};

var XNX3_API = "https://api.translate.zvo.cn/translate.json";

/**
 *
 * @param texts
 * @param targetLang
 */
async function translateViaXnx3(texts, targetLang) {
  var keys = Object.keys(texts);
  var langId = XNX3_LANG_MAP[targetLang];
  if (!langId) throw new Error("Unsupported language: " + targetLang);

  // Batch all keys in one request; retry up to 3 times on failure
  var lastError;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var encodedText = encodeURIComponent(
        JSON.stringify(
          keys.map(function (k) {
            return texts[k];
          }),
        ),
      );
      var resp = await fetch(XNX3_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "text=" + encodedText + "&to=" + encodeURIComponent(langId),
      });
      var data = await resp.json();
      if (data.result !== 1)
        throw new Error("xnx3 translate error: " + (data.info || "unknown"));
      var translated = {};
      for (var i = 0; i < keys.length; i++) {
        translated[keys[i]] = data.text[i] || texts[keys[i]];
      }
      return translated;
    } catch (error) {
      lastError = error;
      if (attempt < 2)
        await new Promise(function (r) {
          setTimeout(r, 2000 * (attempt + 1));
        });
    }
  }
  throw lastError;
}

var LIBRETRANSLATE_LANG_MAP = {
  ar: "ar",
  fr: "fr",
  de: "de",
  es: "es",
  zh: "zh",
  ja: "ja",
  ko: "ko",
};

var LIBRETRANSLATE_INSTANCES = [
  { url: "https://translate.mstdn.social", needsKey: false },
];

var LIBRETRANSLATE_OFFICIAL = {
  url: "https://libretranslate.com",
  needsKey: true,
};

/**
 * Translate via LibreTranslate API — tries multiple public instances.
 * Falls through each instance on failure, then throws.
 * @param texts
 * @param targetLang
 */
async function translateViaLibreTranslate(texts, targetLang) {
  var langCode = LIBRETRANSLATE_LANG_MAP[targetLang];
  if (!langCode) throw new Error("Unsupported language: " + targetLang);

  var keys = Object.keys(texts);
  var values = keys.map(function (k) {
    return texts[k];
  });
  var apiKey = process.env.LIBRETRANSLATE_API_KEY;

  // Build list: official instance first if key available, then public instances
  var instances = [];
  if (apiKey) instances.push(LIBRETRANSLATE_OFFICIAL);
  instances.push.apply(instances, LIBRETRANSLATE_INSTANCES);

  for (var i = 0; i < instances.length; i++) {
    var instance = instances[i];
    var lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var body = { q: values, source: "en", target: langCode };
        if (instance.needsKey && apiKey) body.api_key = apiKey;

        var resp = await fetch(instance.url + "/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          var respText = await resp.text();
          throw new Error(
            instance.url + " HTTP " + resp.status + ": " + respText,
          );
        }

        var data = await resp.json();
        var translatedTexts = Array.isArray(data.translatedText)
          ? data.translatedText
          : [data.translatedText];
        var translated = {};
        for (var j = 0; j < keys.length; j++) {
          translated[keys[j]] = translatedTexts[j] || texts[keys[j]];
        }
        return translated;
      } catch (error) {
        lastError = error;
        if (attempt < 1)
          await new Promise(function (r) {
            setTimeout(r, 3000);
          });
      }
    }
    console.warn("  LibreTranslate " + instance.url + " failed: " + lastError.message);
  }
  throw new Error("All LibreTranslate instances failed");
}

var GOOGLE_LANG_MAP = {
  ar: "ar",
  fr: "fr",
  de: "de",
  es: "es",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
};

var GOOGLE_UA =
  "Mozilla/5.0 (compatible; RedoSan-i18n/1.0; +https://redo-san.github.io/RedoSan-Authenticity/)";

/**
 * Translate via Google Translate web endpoint (no API key required).
 * @param texts
 * @param targetLang
 */
async function translateViaGoogle(texts, targetLang) {
  var langCode = GOOGLE_LANG_MAP[targetLang];
  if (!langCode) throw new Error("Unsupported language: " + targetLang);

  var keys = Object.keys(texts);
  var translated = {};
  var failures = 0;
  var queue = keys.slice();

  /**
   *
   */
  async function worker() {
    while (queue.length > 0) {
      var key = queue.shift();
      var text = texts[key];
      var url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
        langCode +
        "&dt=t&q=" +
        encodeURIComponent(text);
      try {
        var resp = await fetch(url, {
          headers: { "User-Agent": GOOGLE_UA },
          signal: AbortSignal.timeout(15_000),
        });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        var data = await resp.json();
        var parts = Array.isArray(data[0])
          ? data[0]
              .map(function (seg) {
                return seg && seg[0] ? seg[0] : "";
              })
              .join("")
          : "";
        translated[key] = parts;
      } catch (error) {
        failures++;
        console.warn(
          "  Google translate failed for key " + key + ": " + error.message,
        );
      }
    }
  }

  var workers = [];
  for (var i = 0; i < Math.min(3, keys.length); i++) workers.push(worker());
  await Promise.all(workers);
  if (failures === keys.length)
    throw new Error("All Google translate requests failed");
  return translated;
}

var MYMEMORY_LANG_MAP = {
  ar: "ar",
  fr: "fr",
  de: "de",
  es: "es",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
};

/**
 * Translate via MyMemory API (no API key required, 5000 chars/day anonymous).
 * @param texts
 * @param targetLang
 */
async function translateViaMyMemory(texts, targetLang) {
  var langCode = MYMEMORY_LANG_MAP[targetLang];
  if (!langCode) throw new Error("Unsupported language: " + targetLang);

  var keys = Object.keys(texts);
  var translated = {};
  var failures = 0;
  var queue = keys.slice();

  /**
   *
   */
  async function worker() {
    while (queue.length > 0) {
      var key = queue.shift();
      var text = texts[key];
      if (Buffer.byteLength(text, "utf8") > 500) {
        failures++;
        continue;
      }
      var url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text) +
        "&langpair=en|" +
        langCode;
      try {
        var resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        var data = await resp.json();
        if (data.responseStatus !== 200)
          throw new Error(
            "responseStatus " + data.responseStatus + ": " + (data.responseDetails || ""),
          );
        translated[key] = data.responseData
          ? data.responseData.translatedText
          : text;
      } catch (error) {
        failures++;
        console.warn(
          "  MyMemory failed for key " + key + ": " + error.message,
        );
      }
    }
  }

  var workers = [];
  for (var i = 0; i < Math.min(2, keys.length); i++) workers.push(worker());
  await Promise.all(workers);
  if (failures === keys.length)
    throw new Error("All MyMemory requests failed");
  return translated;
}

/**
 *
 * @param texts
 * @param targetLang
 */
async function translateViaAI(texts, targetLang) {
  var apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GITHUB_TOKEN;
  var model = process.env.MODEL || "gpt-4o-mini";
  var apiBase =
    process.env.OPENAI_API_BASE || "https://models.inference.ai.azure.com";

  if (!apiKey) return translateViaLibreTranslate(texts, targetLang);

  var provider, endpoint, headers;
  if (process.env.ANTHROPIC_API_KEY) {
    provider = "anthropic";
    endpoint = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    model = model.replace("anthropic/", "");
  } else if (process.env.GROQ_API_KEY) {
    provider = "openai";
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    headers = {
      authorization: "Bearer " + apiKey,
      "content-type": "application/json",
    };
    model = model.replace("groq/", "");
  } else if (process.env.GOOGLE_API_KEY) {
    provider = "google";
    endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model.replace("gemini/", "") +
      ":generateContent?key=" +
      apiKey;
    headers = { "content-type": "application/json" };
  } else {
    provider = "openai";
    endpoint = apiBase.replace(/\/+$/, "") + "/v1/chat/completions";
    headers = {
      authorization: "Bearer " + apiKey,
      "content-type": "application/json",
    };
  }

  var lines = Object.entries(texts)
    .map(function (e) {
      return e[0] + " = " + JSON.stringify(e[1]);
    })
    .join("\n");
  var prompt =
    "Translate the following i18n keys from English to " +
    LANG_NAMES[targetLang] +
    " (" +
    targetLang +
    "). Return ONLY a JSON object with the same keys and translated values. Keep %s, {{var}}, and HTML tags unchanged.\n\n" +
    lines;

  var body, responseText;
  if (provider === "anthropic") {
    body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
  } else if (provider === "google") {
    body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  } else {
    body = JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
  }

  var resp = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: body,
  });
  responseText = await resp.text();
  if (!resp.ok) {
    if (resp.status === 429) {
      var waitMs = 30_000;
      var match = responseText.match(/(\d+(?:\.\d+)?)\s*s/);
      if (match) waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
      console.warn(
        "  Rate limited, waiting " + (waitMs / 1000).toFixed(0) + "s...",
      );
      await new Promise(function (r) {
        setTimeout(r, waitMs);
      });
      return translateViaAI(texts, targetLang);
    }
    throw new Error("API error " + resp.status + ": " + responseText);
  }

  var data = JSON.parse(responseText);
  var content;
  if (provider === "anthropic") {
    content = data.content[0].text;
  } else if (provider === "google") {
    content = data.candidates[0].content.parts[0].text;
  } else {
    content = data.choices[0].message.content;
  }

  var jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response:\n" + content);
  return JSON.parse(jsonMatch[0]);
}

/**
 *
 */
async function main() {
  var apply = process.argv.includes("--apply");
  var dryRun = process.argv.includes("--dry-run");
  var en = readJson(path.join(LANG_DIR, "en.json"));

  var allMissing = {};
  for (var i = 0; i < LANGS.length; i++) {
    var lang = LANGS[i];
    var filePath = path.join(LANG_DIR, lang + ".json");
    var target;
    try {
      target = readJson(filePath);
    } catch (error) {
      void error;
      target = {};
    }
    var missing = findMissing(en, target);
    var flatMissing = flatten(missing, "");
    var count = Object.keys(flatMissing).length;
    if (count > 0)
      allMissing[lang] = {
        file: filePath,
        target: target,
        missing: missing,
        flat: flatMissing,
        count: count,
      };
    console.log(lang + ": " + count + " missing keys");
  }

  var total = Object.values(allMissing).reduce(function (s, v) {
    return s + v.count;
  }, 0);
  console.log("Total missing: " + total);

  if (!apply || total === 0) return;

  for (lang in allMissing) {
    var info = allMissing[lang];
    if (info.count === 0) continue;
    console.log("\nTranslating " + lang + " (" + info.count + " keys)...");
    if (dryRun) {
      console.log("Would send to AI:\n" + JSON.stringify(info.flat, null, 2));
      continue;
    }
    var providers = [
      { name: "AI", fn: translateViaAI },
      { name: "Google translate", fn: translateViaGoogle },
      { name: "MyMemory", fn: translateViaMyMemory },
      { name: "LibreTranslate", fn: translateViaLibreTranslate },
      { name: "xnx3", fn: translateViaXnx3 },
    ];
    for (var p = 0; p < providers.length; p++) {
      var provider = providers[p];
      try {
        var translated = await provider.fn(info.flat, lang);
        var merged = deepMerge(info.target, unflatten(translated));
        fs.writeFileSync(info.file, JSON.stringify(merged, null, 2) + "\n");
        console.log(
          "  ✓ " +
            lang +
            " updated via " +
            provider.name +
            " (" +
            Object.keys(translated).length +
            " keys)",
        );
        break;
      } catch (error) {
        if (p === providers.length - 1) {
          console.error(
            "  ✗ " +
              lang +
              " failed (all backends exhausted): " +
              error.message,
          );
        } else {
          console.warn(
            "  " +
              provider.name +
              " failed (" +
              error.message +
              "), trying " +
              providers[p + 1].name +
              "...",
          );
        }
      }
    }
  }
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
