// ── Internationalization ──
var i18n = { lang: 'en', data: {} };
var SUPPORTED = ['en', 'ar', 'fr', 'de', 'es', 'zh'];

// Browser language fallback mapping

// Fallback language mapping for browser language
var BROWSER_LANGUAGE_MAP = {
  'en': 'en', 'ar': 'ar', 'fr': 'fr', 'de': 'de', 'es': 'es', 'zh': 'zh',
  'pt': 'pt', 'it': 'it', 'ja': 'ja', 'ko': 'ko', 'ru': 'ru', 'hi': 'hi',
  'ur': 'ur', 'bn': 'bn', 'id': 'id', 'ms': 'ms', 'th': 'th', 'vi': 'vi',
  'tl': 'tl', 'tr': 'tr', 'fa': 'fa', 'he': 'he', 'nl': 'nl', 'sv': 'sv',
  'no': 'no', 'da': 'da', 'fi': 'fi', 'pl': 'pl', 'cs': 'cs', 'hu': 'hu',
  'el': 'el', 'uk': 'uk', 'ro': 'ro', 'bg': 'bg', 'hr': 'hr', 'sr': 'sr',
  'am': 'am', 'et': 'et'
};

async function detectLang() {
  var stored = localStorage.getItem('redosan_lang');
  if (stored && SUPPORTED.includes(stored)) return stored;

  var navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  var primaryLang = navLang.substring(0, 2);
  
  if (SUPPORTED.includes(primaryLang)) return primaryLang;
  
  var mappedLang = BROWSER_LANGUAGE_MAP[primaryLang];
  if (mappedLang && SUPPORTED.includes(mappedLang)) return mappedLang;

  var langWithRegion = navLang.substring(0, 5);
  if (SUPPORTED.includes(langWithRegion)) return langWithRegion;

  return 'en';
}

function switchLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'en';
  localStorage.setItem('redosan_lang', lang);
  loadLang(lang);
}

function langBtnText(lang) {
  // Return the most common alternative language for the current language
  var alternatives = {
    'en': 'العربية',
    'ar': 'English',
    'fr': 'English',
    'de': 'English',
    'es': 'English',
    'zh': 'English'
  };
  return alternatives[lang] || 'English';
}

function getLanguageDisplayName(lang) {
  // Try to get localized name from current language data
  if (i18n.data && i18n.data['lang.name.' + lang]) {
    return i18n.data['lang.name.' + lang];
  }
  
  // Fallback to default names
  var names = {
    'en': 'English',
    'ar': 'العربية',
    'fr': 'Français',
    'de': 'Deutsch',
    'es': 'Español',
    'zh': '中文'
  };
  return names[lang] || lang;
}

async function loadLang(lang) {
  try {
    var resp = await fetch('Style_Web_Page/lang/' + lang + '.json');
    if (!resp.ok) throw new Error('Language file not found: ' + lang);
    i18n.data = await resp.json();
    i18n.lang = lang;
    applyLang();
    return true;
  } catch(e) { 
    console.error('i18n load error:', e);
    // Fallback to English if language fails to load
    if (lang !== 'en') {
      return loadLang('en');
    }
    return false;
  }
}

function applyLang() {
  document.documentElement.lang = i18n.lang;
  document.documentElement.dir = i18n.lang === 'ar' ? 'rtl' : 'ltr';
  
  var btn = document.getElementById('langBtn');
  if (btn) {
    var displayName = getLanguageDisplayName(i18n.lang);
    btn.textContent = displayName;
    btn.title = 'Current: ' + displayName + '\nClick to change language';
  }
  var sBtn = document.getElementById('simpleLangBtn');
  if (sBtn) {
    var displayName = getLanguageDisplayName(i18n.lang);
    sBtn.textContent = displayName;
    sBtn.title = 'Current: ' + displayName + '\nClick to change language';
  }

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    var text = i18n.data[key];
    if (text === undefined) return;
    if (key.startsWith('page.') || key.startsWith('contact.') || key.startsWith('social.')) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-placeholder');
    var text = i18n.data[key];
    if (text !== undefined) el.placeholder = text;
  });

  // Handle RTL CSS for Arabic only
  var link = document.getElementById('rtl-css');
  if (i18n.lang === 'ar') {
    if (!link) {
      link = document.createElement('link');
      link.id = 'rtl-css';
      link.rel = 'stylesheet';
      link.href = 'Style_Web_Page/rtl.css';
      document.head.appendChild(link);
    }
  } else {
    if (link) link.remove();
  }
}

function toggleLangDropdown() {
  var menu = document.getElementById('langMenu');
  if (menu) menu.classList.toggle('show');
}

// Close language dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dropdown = document.querySelector('.lang-dropdown');
  var menu = document.getElementById('langMenu');
  if (dropdown && !dropdown.contains(e.target) && menu) {
    menu.classList.remove('show');
  }
  // Also close simplified language menu
  var sMenu = document.getElementById('simpleLangMenu');
  var sDropdown = document.querySelector('#simplifiedMode .lang-dropdown');
  if (sDropdown && !sDropdown.contains(e.target) && sMenu) {
    sMenu.classList.remove('show');
  }
});

// Comprehensive error filtering for browser extensions
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Prevent multiple declarations
if (typeof window.originalConsoleError === 'undefined') {
    window.originalConsoleError = console.error;
    window.originalConsoleWarn = console.warn;
    window.originalConsoleLog = console.log;
}

function shouldFilterError(message) {
  if (!message) return false;
  const msg = message.toString().toLowerCase();
  
  // Filter all Chrome extension runtime errors
  return (
    // Connection errors
    (msg.includes('runtime.lasterror') && msg.includes('could not establish connection')) ||
    (msg.includes('runtime.lasterror') && msg.includes('receiving end does not exist')) ||
    
    // Message passing errors
    (msg.includes('runtime.lasterror') && msg.includes('message')) ||
    (msg.includes('runtime.lasterror') && msg.includes('tabs.sendmessage')) ||
    
    // Extension communication errors
    (msg.includes('runtime.lasterror') && msg.includes('the message port closed')) ||
    (msg.includes('runtime.lasterror') && msg.includes('extension context invalidated')) ||
    
    // General extension errors
    (msg.includes('runtime.lasterror') && msg.includes('access denied')) ||
    (msg.includes('runtime.lasterror') && msg.includes('not available')) ||
    
    // Promise rejection errors from extensions
    (msg.includes('could not establish connection') && msg.includes('receiving end does not exist')) ||
    (msg.includes('uncaught (in promise)') && msg.includes('could not establish connection')) ||

    // Async response / message channel closed (Chrome extension service worker)
    msg.includes('listener indicated an asynchronous response') ||
    msg.includes('message channel closed before a response') ||
    msg.includes('unchecked runtime.lasterror') ||
    (msg.includes('runtime.lasterror') && msg.includes('port closed'))
  );
}

console.error = function(...args) {
  const message = args.join(' ');
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  const message = args.join(' ');
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleWarn.apply(console, args);
};

console.log = function(...args) {
  const message = args.join(' ');
  if (shouldFilterError(message)) {
    return; // Silently ignore these errors
  }
  return originalConsoleLog.apply(console, args);
};

// Handle uncaught promise rejections from browser extensions
window.addEventListener('unhandledrejection', function(event) {
  if (event.reason) {
    const reasonStr = event.reason.toString().toLowerCase();
    if (shouldFilterError(reasonStr)) {
      event.preventDefault(); // Prevent the error from showing in console
      return;
    }
  }
});

// Also handle regular uncaught errors
window.addEventListener('error', function(event) {
  if (event.message && shouldFilterError(event.message)) {
    event.preventDefault(); // Prevent the error from showing in console
  }
});

// Also handle console exceptions
window.addEventListener('error', function(event) {
  if (event.error && event.error.message && shouldFilterError(event.error.message)) {
    event.preventDefault(); // Prevent the error from showing in console
  }
});

// Initialize language system
document.addEventListener('DOMContentLoaded', async function() { 
  try {
    const lang = await detectLang();
    await loadLang(lang);
  } catch (e) {
    console.error('Language initialization failed:', e);
    // Fallback to English
    loadLang('en');
  }
});
