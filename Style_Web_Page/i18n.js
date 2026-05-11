// ── Internationalization ──
var i18n = { lang: 'en', data: {} };
var SUPPORTED = ['en', 'ar', 'fr', 'de', 'es', 'zh'];

// Language mapping for geographic detection
var GEO_LANGUAGE_MAP = {
  // North America
  'US': 'en', 'CA': 'en', 'MX': 'es',
  // South America
  'BR': 'pt', 'AR': 'es', 'CL': 'es', 'CO': 'es', 'PE': 'es', 'VE': 'es',
  // Europe
  'GB': 'en', 'DE': 'de', 'FR': 'fr', 'ES': 'es', 'IT': 'it', 'PT': 'pt',
  'NL': 'nl', 'BE': 'nl', 'AT': 'de', 'CH': 'de', 'SE': 'sv', 'NO': 'no',
  'DK': 'da', 'FI': 'fi', 'PL': 'pl', 'CZ': 'cs', 'HU': 'hu', 'GR': 'el',
  'RU': 'ru', 'UA': 'uk', 'RO': 'ro', 'BG': 'bg', 'HR': 'hr', 'RS': 'sr',
  // Middle East & North Africa
  'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'MA': 'ar', 'TN': 'ar', 'DZ': 'ar',
  'JO': 'ar', 'LB': 'ar', 'SY': 'ar', 'IQ': 'ar', 'YE': 'ar', 'OM': 'ar',
  // Asia
  'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'SG': 'zh', 'JP': 'ja', 'KR': 'ko',
  'IN': 'hi', 'PK': 'ur', 'BD': 'bn', 'ID': 'id', 'MY': 'ms', 'TH': 'th',
  'VN': 'vi', 'PH': 'tl', 'TR': 'tr', 'IR': 'fa', 'IL': 'he',
  // Africa
  'ZA': 'en', 'NG': 'en', 'KE': 'en', 'GH': 'en', 'ET': 'am',
  // Oceania
  'AU': 'en', 'NZ': 'en'
};

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
  // Check if language is explicitly stored
  var stored = localStorage.getItem('redosan_lang');
  if (stored && SUPPORTED.includes(stored)) return stored;

  // Try geographic detection first
  try {
    var geoLang = await detectLanguageFromLocation();
    if (geoLang && SUPPORTED.includes(geoLang)) return geoLang;
  } catch (e) {
    console.log('Geographic detection failed:', e);
  }

  // Fallback to browser language
  var navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  var primaryLang = navLang.substring(0, 2);
  
  // Check exact match first
  if (SUPPORTED.includes(primaryLang)) return primaryLang;
  
  // Check mapped languages
  var mappedLang = BROWSER_LANGUAGE_MAP[primaryLang];
  if (mappedLang && SUPPORTED.includes(mappedLang)) return mappedLang;

  // Try browser language with region
  var langWithRegion = navLang.substring(0, 5);
  if (SUPPORTED.includes(langWithRegion)) return langWithRegion;

  // Default to English
  return 'en';
}

async function detectLanguageFromLocation() {
  try {
    // Use a free IP geolocation service with timeout
    var controller = new AbortController();
    var timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    var response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      mode: 'cors'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('Geolocation service unavailable');
    
    var data = await response.json();
    var countryCode = data.country_code;
    
    if (countryCode && GEO_LANGUAGE_MAP[countryCode]) {
      var detectedLang = GEO_LANGUAGE_MAP[countryCode];
      if (SUPPORTED.includes(detectedLang)) {
        console.log('Detected language from location:', countryCode, '->', detectedLang);
        return detectedLang;
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('Geolocation request timed out');
    } else {
      console.log('Geolocation detection failed:', e.message);
    }
  }
  
  return null;
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
      console.log('Falling back to English');
      return loadLang('en');
    }
    return false;
  }
}

function applyLang() {
  console.log('Applying language:', i18n.lang);
  document.documentElement.lang = i18n.lang;
  document.documentElement.dir = i18n.lang === 'ar' ? 'rtl' : 'ltr';
  
  var btn = document.getElementById('langBtn');
  if (btn) {
    const displayName = getLanguageDisplayName(i18n.lang);
    console.log('Setting button text to:', displayName);
    btn.textContent = displayName;
    btn.title = 'Current: ' + displayName + '\nClick to change language';
  } else {
    console.error('Language button not found!');
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
  if (menu) {
    menu.classList.toggle('show');
  }
}

// Close language dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dropdown = document.querySelector('.lang-dropdown');
  var menu = document.getElementById('langMenu');
  if (dropdown && !dropdown.contains(e.target) && menu) {
    menu.classList.remove('show');
  }
});

// Initialize language system
document.addEventListener('DOMContentLoaded', async function() { 
  console.log('DOM loaded, initializing language system...');
  try {
    const lang = await detectLang();
    console.log('Detected language:', lang);
    await loadLang(lang);
    console.log('Language loaded successfully');
  } catch (e) {
    console.error('Language initialization failed:', e);
    // Fallback to English
    loadLang('en');
  }
});
