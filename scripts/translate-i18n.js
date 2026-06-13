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
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_API_KEY
 *
 * Default model: llama-3.3-70b-versatile (Groq - free, no credit card required)
 */

var fs = require('fs');
var path = require('path');

var LANG_DIR = path.join(__dirname, '..', 'Style', 'lang');
var SOURCE_LANG = 'en';
var LANGS = ['ar', 'fr', 'de', 'es', 'zh', 'ja', 'ko'];

var LANG_NAMES = {
  ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean'
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function flatten(obj, prefix) {
  var result = {};
  for (var key in obj) {
    var p = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flatten(obj[key], p));
    } else {
      result[p] = obj[key];
    }
  }
  return result;
}

function unflatten(obj) {
  var result = {};
  for (var flatKey in obj) {
    var parts = flatKey.split('.');
    var current = result;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = obj[flatKey];
  }
  return result;
}

function findMissing(source, target) {
  var missing = {};
  for (var key in source) {
    if (!(key in target)) {
      missing[key] = source[key];
    } else if (typeof source[key] === 'object' && source[key] !== null && typeof target[key] === 'object' && target[key] !== null) {
      var nested = findMissing(source[key], target[key]);
      if (Object.keys(nested).length > 0) missing[key] = nested;
    }
  }
  return missing;
}

function deepMerge(base, overlay) {
  var result = JSON.parse(JSON.stringify(base));
  for (var key in overlay) {
    if (typeof overlay[key] === 'object' && overlay[key] !== null && !Array.isArray(overlay[key])) {
      result[key] = deepMerge(result[key] || {}, overlay[key]);
    } else {
      result[key] = overlay[key];
    }
  }
  return result;
}

var XNX3_LANG_MAP = {
  ar: 'arabic', fr: 'french', de: 'deutsch', es: 'spanish',
  zh: 'chinese_simplified', ja: 'japanese', ko: 'korean'
};

var XNX3_API = 'https://api.translate.zvo.cn/translate.json';

async function translateViaXnx3(texts, targetLang) {
  var keys = Object.keys(texts);
  var langId = XNX3_LANG_MAP[targetLang];
  if (!langId) throw new Error('Unsupported language: ' + targetLang);

  // Batch all keys in one request; retry up to 3 times on failure
  var lastError;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var encodedText = encodeURIComponent(JSON.stringify(keys.map(function(k) { return texts[k]; })));
      var resp = await fetch(XNX3_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'text=' + encodedText + '&to=' + encodeURIComponent(langId)
      });
      var data = await resp.json();
      if (data.result !== 1) throw new Error('xnx3 translate error: ' + (data.info || 'unknown'));
      var translated = {};
      for (var i = 0; i < keys.length; i++) {
        translated[keys[i]] = data.text[i] || texts[keys[i]];
      }
      return translated;
    } catch(e) {
      lastError = e;
      if (attempt < 2) await new Promise(function(r) { setTimeout(r, 2000 * (attempt + 1)); });
    }
  }
  throw lastError;
}

async function translateViaAI(texts, targetLang) {
  var apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ||
               process.env.GROQ_API_KEY || process.env.GOOGLE_API_KEY || process.env.GITHUB_TOKEN;
  var model = process.env.MODEL || 'gpt-4o-mini';
  var apiBase = process.env.OPENAI_API_BASE || 'https://models.inference.ai.azure.com';

  if (!apiKey) return translateViaXnx3(texts, targetLang);

  var provider, endpoint, headers;
  if (process.env.ANTHROPIC_API_KEY) {
    provider = 'anthropic';
    endpoint = 'https://api.anthropic.com/v1/messages';
    headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
    model = model.replace('anthropic/', '');
  } else if (process.env.GROQ_API_KEY) {
    provider = 'openai';
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { 'authorization': 'Bearer ' + apiKey, 'content-type': 'application/json' };
    model = model.replace('groq/', '');
  } else if (process.env.GOOGLE_API_KEY) {
    provider = 'google';
    endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model.replace('gemini/', '') + ':generateContent?key=' + apiKey;
    headers = { 'content-type': 'application/json' };
  } else {
    provider = 'openai';
    endpoint = apiBase.replace(/\/+$/, '') + '/v1/chat/completions';
    headers = { 'authorization': 'Bearer ' + apiKey, 'content-type': 'application/json' };
  }

  var lines = Object.entries(texts).map(function(e) { return e[0] + ' = ' + JSON.stringify(e[1]); }).join('\n');
  var prompt = 'Translate the following i18n keys from English to ' + LANG_NAMES[targetLang] +
    ' (' + targetLang + '). Return ONLY a JSON object with the same keys and translated values. Keep %s, {{var}}, and HTML tags unchanged.\n\n' + lines;

  var body, responseText;
  if (provider === 'anthropic') {
    body = JSON.stringify({ model: model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] });
  } else if (provider === 'google') {
    body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  } else {
    body = JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }], temperature: 0.1 });
  }

  var resp = await fetch(endpoint, { method: 'POST', headers: headers, body: body });
  responseText = await resp.text();
  if (!resp.ok) {
    if (resp.status === 429) {
      var waitMs = 30000;
      var match = responseText.match(/(\d+(?:\.\d+)?)\s*s/);
      if (match) waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
      console.warn('  Rate limited, waiting ' + (waitMs / 1000).toFixed(0) + 's...');
      await new Promise(function(r) { setTimeout(r, waitMs); });
      return translateViaAI(texts, targetLang);
    }
    throw new Error('API error ' + resp.status + ': ' + responseText);
  }

  var data = JSON.parse(responseText);
  var content;
  if (provider === 'anthropic') {
    content = data.content[0].text;
  } else if (provider === 'google') {
    content = data.candidates[0].content.parts[0].text;
  } else {
    content = data.choices[0].message.content;
  }

  var jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response:\n' + content);
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  var apply = process.argv.indexOf('--apply') !== -1;
  var dryRun = process.argv.indexOf('--dry-run') !== -1;
  var en = readJson(path.join(LANG_DIR, 'en.json'));

  var allMissing = {};
  for (var i = 0; i < LANGS.length; i++) {
    var lang = LANGS[i];
    var filePath = path.join(LANG_DIR, lang + '.json');
    var target;
    try { target = readJson(filePath); } catch(e) { target = {}; }
    var missing = findMissing(en, target);
    var flatMissing = flatten(missing, '');
    var count = Object.keys(flatMissing).length;
    if (count > 0) allMissing[lang] = { file: filePath, target: target, missing: missing, flat: flatMissing, count: count };
    console.log(lang + ': ' + count + ' missing keys');
  }

  var total = Object.values(allMissing).reduce(function(s, v) { return s + v.count; }, 0);
  console.log('Total missing: ' + total);

  if (!apply || total === 0) return;

  for (lang in allMissing) {
    var info = allMissing[lang];
    if (info.count === 0) continue;
    console.log('\nTranslating ' + lang + ' (' + info.count + ' keys)...');
    if (dryRun) {
      console.log('Would send to AI:\n' + JSON.stringify(info.flat, null, 2));
      continue;
    }
    try {
      var translated = await translateViaAI(info.flat, lang);
      var merged = deepMerge(info.target, unflatten(translated));
      fs.writeFileSync(info.file, JSON.stringify(merged, null, 2) + '\n');
      console.log('  ✓ ' + lang + ' updated (' + Object.keys(translated).length + ' keys)');
    } catch(e) {
      if (process.env.GITHUB_TOKEN && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY &&
          !process.env.GROQ_API_KEY && !process.env.GOOGLE_API_KEY) {
        console.warn('  GitHub Models failed, falling back to xnx3...');
        try {
          translated = await translateViaXnx3(info.flat, lang);
          merged = deepMerge(info.target, unflatten(translated));
          fs.writeFileSync(info.file, JSON.stringify(merged, null, 2) + '\n');
          console.log('  ✓ ' + lang + ' updated via xnx3 fallback (' + Object.keys(translated).length + ' keys)');
        } catch(e2) {
          console.error('  ✗ ' + lang + ' failed (both GitHub Models and xnx3): ' + e2.message);
        }
      } else {
        console.error('  ✗ ' + lang + ' failed: ' + e.message);
      }
    }
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
