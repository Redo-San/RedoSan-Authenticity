(function(){if(typeof window!='undefined'&&window.location&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Simplified mode: step-by-step wizard ──

var simpleFile = null;
var simpleBuf = null;
var simpleType = null;
var simpleIsAI = false;

var simpleStep = 0;
var simpleSteps = [];
var simpleResults = {};
var simpleStepDone = false;
var simpleUserInfo = {
  name: '', email: '', phone: '', phoneCode: '', website: '',
  social: { tiktok: '', facebook: '', instagram: '', youtube: '' },
  isArtist: false,
  music: { spotify: '', appleMusic: '', youtubeMusic: '', soundcloud: '', bandcamp: '' }
};

function setBodyOverflow(disable) {
  document.documentElement.style.overflow = disable ? 'hidden' : '';
}

function initMode() {
  setBodyOverflow(true);
}

function setMode(mode) {
  document.getElementById('modeSelect').style.display = 'none';
  setBodyOverflow(false);
  history.pushState({ modeSet: mode }, '', window.location.pathname.replace(/\/+$/, '') + '/');
  if (mode === 'simplified') {
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('sidebarOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('mainFooter').style.display = 'none';
    document.getElementById('simplifiedMode').style.display = '';
    initSimplified();
  } else {
    document.getElementById('simplifiedMode').style.display = 'none';
    document.getElementById('mainNav').style.display = '';
    document.getElementById('sidebar').style.display = '';
    document.getElementById('app').style.display = '';
    document.getElementById('mainFooter').style.display = '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar a[data-page]').forEach(a => a.classList.remove('active'));
    var home = document.getElementById('page-home');
    if (home) home.classList.add('active');
  }
}

function resetProfessionalForms() {
  // Clear all file inputs in professional mode
  document.querySelectorAll('#app input[type="file"]').forEach(function(el) {
    var dt = new DataTransfer();
    el.files = dt.files;
  });
  // Clear all text/password inputs and textareas
  document.querySelectorAll('#app input[type="text"], #app input[type="password"], #app input[type="search"], #app textarea').forEach(function(el) {
    el.value = '';
  });
  // Hide all result/output sections
  ['wm-result', 'pi-result', 'fp-result', 'md-result', 'ts-result', 'c2pa-read-result', 'c2pa-write-result', 'c2pa-verify-result'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function switchMode() {
  resetProfessionalForms();
  // Show mode overlay without page reload (keeps music playing)
  document.getElementById('modeSelect').style.display = '';
  setBodyOverflow(true);
  document.getElementById('simplifiedMode').style.display = 'none';
  document.getElementById('mainNav').style.display = '';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('sidebarOverlay').style.display = '';
  document.getElementById('app').style.display = '';
  document.getElementById('mainFooter').style.display = '';
  // Reset to home page
  showPage('home');
}

function showModeSelect() {
  resetProfessionalForms();
  // Show mode overlay without page reload (keeps music playing)
  document.getElementById('modeSelect').style.display = '';
  setBodyOverflow(true);
  document.getElementById('simplifiedMode').style.display = 'none';
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('sidebarOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('mainFooter').style.display = 'none';
}

// ── File type detection ──

function detectFileType(file) {
  var name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|avif|tiff?)$/.test(name)) return 'image';
  if (/\.(mp3|wav|ogg|flac|aac|wma|m4a|opus)$/.test(name)) return 'audio';
  if (/\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp)$/.test(name)) return 'video';
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|html?|xml|json|md|epub)$/.test(name)) return 'document';
  return 'other';
}

function buildSteps(type, isAI) {
  var s = [{ id: 'upload', label: __('simple.step_upload', 'Upload') }];
  if (type === 'image') {
    s.push({ id: 'ai-question', label: __('simple.step_type', 'Type') });
    s.push({ id: 'fingerprint', label: __('simple.step_fingerprint', 'Fingerprint') });
    s.push({ id: 'timestamp', label: __('simple.step_timestamp', 'Timestamp') });
    s.push({ id: 'watermark', label: __('simple.step_watermark', 'Watermark') });
    s.push({ id: 'pixel-injection', label: __('simple.step_inject', 'Inject') });
    if (isAI) s.push({ id: 'c2pa', label: __('simple.step_c2pa', 'C2PA') });
  } else {
    s.push({ id: 'fingerprint', label: __('simple.step_fingerprint', 'Fingerprint') });
    s.push({ id: 'timestamp', label: __('simple.step_timestamp', 'Timestamp') });
  }
  s.push({ id: 'done', label: __('simple.step_done', 'Done') });
  return s;
}

// ── Init & render ──

function initSimplified() {
  simpleFile = null; simpleBuf = null; simpleType = null;
  simpleIsAI = false; simpleStep = 0; simpleSteps = [];
  simpleResults = {};
  simpleUserInfo = {
    name: '', email: '', phone: '', phoneCode: '', website: '',
    social: { tiktok: '', facebook: '', instagram: '', youtube: '' },
    isArtist: false,
    music: { spotify: '', appleMusic: '', youtubeMusic: '', soundcloud: '', bandcamp: '' }
  };
  var steps = [{ id: 'upload', label: __('simple.step_upload', 'Upload') }];
  simpleSteps = steps;
  document.getElementById('simpleNav').style.display = '';
  renderStep();
}

function renderStep() {
  var step = simpleSteps[simpleStep];
  renderProgress();
  var body = document.getElementById('simpleBody');
  var nextBtn = document.getElementById('simpleNextBtn');
  var prevBtn = document.getElementById('simplePrevBtn');
  prevBtn.style.display = simpleStep === 0 ? 'none' : '';
  var isLast = simpleStep === simpleSteps.length - 1;
  nextBtn.textContent = isLast ? __('simple.start_over') : __('simple.next_btn');
  // Manage Next button: hidden for action-required steps, disabled until done for others
  simpleStepDone = false;
  if (['ai-question', 'c2pa', 'watermark', 'pixel-injection'].indexOf(step.id) >= 0) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = '';
    nextBtn.disabled = step.id === 'upload' ? !simpleFile : step.id === 'done' ? false : true;
  }
  if (step.id === 'upload') renderUpload(body);
  else if (step.id === 'ai-question') renderAiQuestion(body);
  else if (step.id === 'c2pa') renderC2paStep(body);
  else if (step.id === 'watermark') renderWatermarkStep(body);
  else if (step.id === 'pixel-injection') renderPixelInjectStep(body);
  else if (step.id === 'timestamp') renderTimestampStep(body);
  else if (step.id === 'fingerprint') renderFingerprintStep(body);
  else if (step.id === 'done') renderDone(body);
  document.getElementById('simpleStepCounter').textContent =
    __('simple.step_of', 'Step {current} of {total}').replace('{current}', simpleStep + 1).replace('{total}', simpleSteps.length);
}

function renderProgress() {
  var el = document.getElementById('simpleProgress');
  el.innerHTML = simpleSteps.map(function(s, i) {
    var cls = i === simpleStep ? 'sp-active' : i < simpleStep ? 'sp-done' : '';
    return '<div class="sp-step ' + cls + '"><div class="sp-dot"></div><span>' + s.label + '</span></div>';
  }).join('<div class="sp-line"></div>');
}

// ── Navigation ──

function simpleNext() {
  var step = simpleSteps[simpleStep];
  if (step.id === 'upload' && !simpleFile) return;
  if (step.id === 'upload') {
    saveSimpleUserInfo();
    if (!simpleUserInfo.name || !simpleUserInfo.email || !simpleUserInfo.phone || !simpleUserInfo.website) {
      var infoSection = document.querySelector('.simple-info-section');
      if (infoSection) {
        var existingErr = infoSection.querySelector('.simple-info-error');
        if (existingErr) existingErr.remove();
        var err = document.createElement('p');
        err.className = 'simple-info-error';
        err.style.cssText = 'font-size:0.8rem;color:var(--danger);margin:8px 0 0;text-align:left';
        err.textContent = __('simple.info_required', 'Please fill in all required fields: Name, Email, Phone, Website.');
        infoSection.appendChild(err);
      }
      return;
    }
    // Deeper field validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(simpleUserInfo.email)) {
      var warn = document.getElementById('sinfo-email-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
    if (simpleUserInfo.website === 'https://' || !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(simpleUserInfo.website)) {
      var warn = document.getElementById('sinfo-website-warn');
      if (warn) warn.style.display = 'block';
      return;
    }
  }
  // Auto-run steps must complete before advancing
  if ((step.id === 'timestamp' || step.id === 'fingerprint' || step.id === 'watermark' || step.id === 'pixel-injection' || step.id === 'c2pa') && !simpleStepDone) return;
  if (step.id === 'done') { restartSimple(); return; }
  simpleStep++;
  if (simpleStep >= simpleSteps.length) simpleStep = simpleSteps.length - 1;
  renderStep();
}

function simplePrev() {
  if (simpleStep <= 0) return;
  simpleStep--;
  simpleStepDone = false;
  renderStep();
}

function restartSimple() {
  initSimplified();
}

// ── Country code data ──

var COUNTRY_CODES = [
  { code: 'SA', dial: '+966', name: 'السعودية', len: 9 },
  { code: 'AE', dial: '+971', name: 'الإمارات', len: 9 },
  { code: 'EG', dial: '+20', name: 'مصر', len: 10 },
  { code: 'KW', dial: '+965', name: 'الكويت', len: 8 },
  { code: 'QA', dial: '+974', name: 'قطر', len: 8 },
  { code: 'BH', dial: '+973', name: 'البحرين', len: 8 },
  { code: 'OM', dial: '+968', name: 'عمان', len: 8 },
  { code: 'IQ', dial: '+964', name: 'العراق', len: 10 },
  { code: 'JO', dial: '+962', name: 'الأردن', len: 9 },
  { code: 'LB', dial: '+961', name: 'لبنان', len: 8 },
  { code: 'PS', dial: '+970', name: 'فلسطين', len: 9 },
  { code: 'SY', dial: '+963', name: 'سوريا', len: 9 },
  { code: 'YE', dial: '+967', name: 'اليمن', len: 9 },
  { code: 'SD', dial: '+249', name: 'السودان', len: 9 },
  { code: 'LY', dial: '+218', name: 'ليبيا', len: 9 },
  { code: 'TN', dial: '+216', name: 'تونس', len: 8 },
  { code: 'DZ', dial: '+213', name: 'الجزائر', len: 9 },
  { code: 'MA', dial: '+212', name: 'المغرب', len: 9 },
  { code: 'TR', dial: '+90', name: 'تركيا', len: 10 },
  { code: 'US', dial: '+1', name: 'USA', len: 10 },
  { code: 'GB', dial: '+44', name: 'UK', len: 10 },
  { code: 'CA', dial: '+1', name: 'Canada', len: 10 },
  { code: 'AU', dial: '+61', name: 'Australia', len: 9 },
  { code: 'IN', dial: '+91', name: 'India', len: 10 },
  { code: 'CN', dial: '+86', name: 'China', len: 11 },
  { code: 'JP', dial: '+81', name: 'Japan', len: 10 },
  { code: 'KR', dial: '+82', name: 'South Korea', len: 10 },
  { code: 'FR', dial: '+33', name: 'France', len: 9 },
  { code: 'DE', dial: '+49', name: 'Germany', len: 10 },
  { code: 'IT', dial: '+39', name: 'Italy', len: 10 },
  { code: 'ES', dial: '+34', name: 'Spain', len: 9 },
  { code: 'NL', dial: '+31', name: 'Netherlands', len: 9 },
  { code: 'RU', dial: '+7', name: 'Russia', len: 10 },
  { code: 'BR', dial: '+55', name: 'Brazil', len: 10 },
  { code: 'PK', dial: '+92', name: 'Pakistan', len: 10 },
  { code: 'BD', dial: '+880', name: 'Bangladesh', len: 10 },
  { code: 'ID', dial: '+62', name: 'Indonesia', len: 10 },
  { code: 'MY', dial: '+60', name: 'Malaysia', len: 9 },
  { code: 'SG', dial: '+65', name: 'Singapore', len: 8 },
  { code: 'TH', dial: '+66', name: 'Thailand', len: 9 },
  { code: 'PH', dial: '+63', name: 'Philippines', len: 10 },
  { code: 'NG', dial: '+234', name: 'Nigeria', len: 10 },
  { code: 'ZA', dial: '+27', name: 'South Africa', len: 9 },
  { code: 'KE', dial: '+254', name: 'Kenya', len: 9 },
  { code: 'IR', dial: '+98', name: 'Iran', len: 10 },
  { code: 'AF', dial: '+93', name: 'Afghanistan', len: 9 }
];

function getCountryFromLocale() {
  // Try all Intl APIs for region code detection
  // Intl.NumberFormat usually returns the most accurate locale (OS-level)
  var locales = [];
  try { locales.push(Intl.NumberFormat().resolvedOptions().locale); } catch(e) {}
  try { locales.push(Intl.DateTimeFormat().resolvedOptions().locale); } catch(e) {}
  try { locales.push(Intl.Collator().resolvedOptions().locale); } catch(e) {}
  for (var li = 0; li < locales.length; li++) {
    if (!locales[li]) continue;
    var parts = locales[li].split('-');
    for (var k = parts.length - 1; k >= 0; k--) {
      if (parts[k].length === 2 && /^[A-Za-z]{2}$/.test(parts[k])) {
        var code = parts[k].toUpperCase();
        for (var i = 0; i < COUNTRY_CODES.length; i++) {
          if (COUNTRY_CODES[i].code === code) return COUNTRY_CODES[i];
        }
      }
    }
  }
  return null;
}

function getCountryFromTimezone() {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    // Extract city name from timezone (last component)
    var parts = tz.split('/');
    var city = parts[parts.length - 1];
    // Comprehensive IANA city → country code mapping
    // Generated from zone1970.tab — covers 300+ canonical timezones
    var tzCity = {
      'Adak':'US','Adelaide':'AU','Algiers':'DZ','Almaty':'KZ','Amman':'JO',
      'Anadyr':'RU','Anchorage':'US','Andorra':'AD','Apia':'WS','Aqtau':'KZ',
      'Aqtobe':'KZ','Araguaina':'BR','Ashgabat':'TM','Astrakhan':'RU',
      'Asuncion':'PY','Athens':'GR','Atyrau':'KZ','Auckland':'NZ','Azores':'PT',
      'Baghdad':'IQ','Bahia':'BR','Bahia_Banderas':'MX','Baku':'AZ','Bangkok':'TH',
      'Barbados':'BB','Barnaul':'RU','Beirut':'LB','Belem':'BR','Belgrade':'RS',
      'Belize':'BZ','Berlin':'DE','Bermuda':'BM','Beulah':'US','Bishkek':'KG',
      'Bissau':'GW','Boa_Vista':'BR','Bogota':'CO','Boise':'US','Bougainville':'PG',
      'Brisbane':'AU','Broken_Hill':'AU','Brussels':'BE','Bucharest':'RO',
      'Budapest':'HU','Buenos_Aires':'AR','Cairo':'EG','Cambridge_Bay':'CA',
      'Campo_Grande':'BR','Canary':'ES','Cancun':'MX','Cape_Verde':'CV',
      'Caracas':'VE','Casablanca':'MA','Catamarca':'AR','Cayenne':'GF',
      'Center':'US','Ceuta':'ES','Chagos':'IO','Chatham':'NZ','Chicago':'US',
      'Chihuahua':'MX','Chisinau':'MD','Chita':'RU','Ciudad_Juarez':'MX',
      'Colombo':'LK','Cordoba':'AR','Costa_Rica':'CR','Coyhaique':'CL',
      'Cuiaba':'BR','Damascus':'SY','Danmarkshavn':'GL','Darwin':'AU',
      'Dawson':'CA','Dawson_Creek':'CA','Denver':'US','Detroit':'US','Dhaka':'BD',
      'Dili':'TL','Dubai':'AE','Dublin':'IE','Dushanbe':'TJ','Easter':'CL',
      'Edmonton':'CA','Efate':'VU','Eirunepe':'BR','El_Aaiun':'EH',
      'El_Salvador':'SV','Eucla':'AU','Fakaofo':'TK','Famagusta':'CY',
      'Faroe':'FO','Fiji':'FJ','Fort_Nelson':'CA','Fortaleza':'BR',
      'Galapagos':'EC','Gambier':'PF','Gaza':'PS','Gibraltar':'GI',
      'Glace_Bay':'CA','Goose_Bay':'CA','Grand_Turk':'TC','Guadalcanal':'SB',
      'Guam':'GU','Guatemala':'GT','Guayaquil':'EC','Guyana':'GY','Halifax':'CA',
      'Havana':'CU','Hebron':'PS','Helsinki':'FI','Hermosillo':'MX',
      'Ho_Chi_Minh':'VN','Hobart':'AU','Hong_Kong':'HK','Honolulu':'US',
      'Hovd':'MN','Indianapolis':'US','Inuvik':'CA','Iqaluit':'CA',
      'Irkutsk':'RU','Istanbul':'TR','Jakarta':'ID','Jamaica':'JM',
      'Jayapura':'ID','Jerusalem':'IL','Johannesburg':'ZA','Juba':'SS',
      'Jujuy':'AR','Juneau':'US','Kabul':'AF','Kaliningrad':'RU',
      'Kamchatka':'RU','Kanton':'KI','Karachi':'PK','Kathmandu':'NP',
      'Khandyga':'RU','Khartoum':'SD','Kiritimati':'KI','Kirov':'RU',
      'Knox':'US','Kolkata':'IN','Krasnoyarsk':'RU','Kuching':'MY',
      'Kwajalein':'MH','Kyiv':'UA','La_Paz':'BO','La_Rioja':'AR','Lagos':'NG',
      'Lima':'PE','Lindeman':'AU','Lisbon':'PT','London':'GB','Lord_Howe':'AU',
      'Los_Angeles':'US','Louisville':'US','Macau':'MO','Maceio':'BR',
      'Macquarie':'AU','Madeira':'PT','Madrid':'ES','Magadan':'RU',
      'Makassar':'ID','Maldives':'MV','Malta':'MT','Managua':'NI','Manaus':'BR',
      'Manila':'PH','Maputo':'MZ','Marengo':'US','Marquesas':'PF',
      'Martinique':'MQ','Matamoros':'MX','Mauritius':'MU','Mazatlan':'MX',
      'Melbourne':'AU','Mendoza':'AR','Menominee':'US','Merida':'MX',
      'Metlakatla':'US','Mexico_City':'MX','Minsk':'BY','Miquelon':'PM',
      'Moncton':'CA','Monrovia':'LR','Monterrey':'MX','Montevideo':'UY',
      'Monticello':'US','Moscow':'RU','Nairobi':'KE','Nauru':'NR',
      'Ndjamena':'TD','New_Salem':'US','New_York':'US','Nicosia':'CY',
      'Niue':'NU','Nome':'US','Norfolk':'NF','Noronha':'BR','Noumea':'NC',
      'Novokuznetsk':'RU','Novosibirsk':'RU','Nuuk':'GL','Ojinaga':'MX',
      'Omsk':'RU','Oral':'KZ','Palau':'PW','Panama':'PA','Paramaribo':'SR',
      'Paris':'FR','Perth':'AU','Petersburg':'US','Phoenix':'US','Pitcairn':'PN',
      'Pontianak':'ID','Port_Moresby':'PG','Port-au-Prince':'HT',
      'Porto_Velho':'BR','Prague':'CZ','Puerto_Rico':'PR','Punta_Arenas':'CL',
      'Pyongyang':'KP','Qatar':'QA','Qostanay':'KZ','Qyzylorda':'KZ',
      'Rankin_Inlet':'CA','Rarotonga':'CK','Recife':'BR','Regina':'CA',
      'Resolute':'CA','Riga':'LV','Rio_Branco':'BR','Rio_Gallegos':'AR',
      'Riyadh':'SA','Rome':'IT','Sakhalin':'RU','Salta':'AR','Samara':'RU',
      'Samarkand':'UZ','San_Juan':'AR','San_Luis':'AR','Santarem':'BR',
      'Santiago':'CL','Santo_Domingo':'DO','Sao_Paulo':'BR','Sao_Tome':'ST',
      'Saratov':'RU','Scoresbysund':'GL','Seoul':'KR','Shanghai':'CN',
      'Simferopol':'RU','Singapore':'SG','Sitka':'US','Sofia':'BG',
      'Srednekolymsk':'RU','St_Johns':'CA','Stanley':'FK',
      'Swift_Current':'CA','Sydney':'AU','Tahiti':'PF','Taipei':'TW',
      'Tallinn':'EE','Tarawa':'KI','Tashkent':'UZ','Tbilisi':'GE',
      'Tegucigalpa':'HN','Tehran':'IR','Tell_City':'US','Thimphu':'BT',
      'Thule':'GL','Tijuana':'MX','Tirane':'AL','Tokyo':'JP','Tomsk':'RU',
      'Tongatapu':'TO','Toronto':'CA','Tripoli':'LY','Tucuman':'AR',
      'Tunis':'TN','Ulaanbaatar':'MN','Ulyanovsk':'RU','Urumqi':'CN',
      'Ushuaia':'AR','Ust-Nera':'RU','Vancouver':'CA','Vevay':'US',
      'Vienna':'AT','Vilnius':'LT','Vincennes':'US','Vladivostok':'RU',
      'Volgograd':'RU','Warsaw':'PL','Whitehorse':'CA','Winamac':'US',
      'Windhoek':'NA','Winnipeg':'CA','Yakutat':'US','Yakutsk':'RU',
      'Yangon':'MM','Yekaterinburg':'RU','Yerevan':'AM','Zurich':'CH'
    };
    var code = tzCity[city];
    if (code) {
      for (var i = 0; i < COUNTRY_CODES.length; i++) {
        if (COUNTRY_CODES[i].code === code) return COUNTRY_CODES[i];
      }
    }
  } catch(e) {}
  return null;
}

function getDefaultPhoneCode() {
  var c;
  // 1. Try Intl APIs (NumberFormat, DateTimeFormat, Collator)
  c = getCountryFromLocale();
  if (c) return c;
  // 2. Try navigator.languages (user's ordered preference list)
  try {
    var langs = navigator.languages || [navigator.language || navigator.userLanguage || ''];
    for (var l = 0; l < langs.length; l++) {
      var parts = langs[l].split('-');
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].length === 2 && /^[A-Za-z]{2}$/.test(parts[p])) {
          var code = parts[p].toUpperCase();
          for (var i = 0; i < COUNTRY_CODES.length; i++) {
            if (COUNTRY_CODES[i].code === code) return COUNTRY_CODES[i];
          }
        }
      }
    }
  } catch(e) {}
  // 3. Try from timezone (300+ IANA zones mapped to country codes)
  c = getCountryFromTimezone();
  if (c) return c;
  // 4. Fallback — leave unselected, let user choose
  return null;
}

function updatePhoneMaxLength() {
  var el = document.getElementById('sinfo-phone');
  var code = document.getElementById('sinfo-phonecode');
  if (!el || !code) return;
  var dial = code.value;
  var maxLen = 15; // ITU max
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    if (COUNTRY_CODES[i].dial === dial) { maxLen = COUNTRY_CODES[i].len; break; }
  }
  el.maxLength = maxLen;
  if (el.value.length > maxLen) el.value = el.value.slice(0, maxLen);
}

function validateSocialInput(el) {
  var warn = document.getElementById(el.id + '-warn');
  if (!el.value) { if (warn) warn.style.display = 'none'; return; }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? 'none' : 'block';
}

function prefixHttps(el) {
  if (!el.value || el.value === 'https://') { el.value = 'https://'; }
  el.setSelectionRange(el.value.length, el.value.length);
}

// ── Progress bar ──
function showProgress() {
  var el = document.getElementById('simpleProgressBar');
  if (el) el.style.display = '';
}
function hideProgress() {
  var el = document.getElementById('simpleProgressBar');
  if (el) { el.style.display = 'none'; }
}

// ── Clear data ──
function clearSimpleData() {
  if (!confirm(__('simple.clear_confirm', 'Clear all data? Your current progress will be lost.'))) return;
  localStorage.removeItem('simpleUserInfo');
  localStorage.removeItem('simpleFileData');
  if (simpleResults) {
    Object.keys(simpleResults).forEach(function(k) {
      if (k.indexOf('Url') > 0) { try { URL.revokeObjectURL(simpleResults[k]); } catch(e) {} }
    });
  }
  initSimplified();
}

// ── Lightbox ──
function openLightbox(src) {
  var img = document.getElementById('lightboxImg');
  var box = document.getElementById('lightbox');
  if (img && box) { img.src = src; box.style.display = ''; }
}
function closeLightbox() {
  var box = document.getElementById('lightbox');
  if (box) box.style.display = 'none';
}

// ── C2PA link validation ──
function validateC2paLink(el) {
  var warn = document.getElementById(el.id + '-warn');
  if (!el.value) { if (warn) warn.style.display = 'none'; return; }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? 'none' : 'block';
}

function validateUrlInput(el) {
  var warn = document.getElementById('sinfo-website-warn');
  if (!el.value) { if (warn) warn.style.display = 'none'; return; }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? 'none' : 'block';
}

function validateEmailInput(el) {
  var warn = document.getElementById('sinfo-email-warn');
  if (!el.value) { if (warn) warn.style.display = 'none'; return; }
  // Simple but robust email regex
  var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  if (warn) warn.style.display = ok ? 'none' : 'block';
}

function validatePhoneInput(el) {
  var warn = document.getElementById('sinfo-phone-warn');
  // Remove non-digits
  if (/[^\d]/.test(el.value)) {
    el.value = el.value.replace(/\D/g, '');
    if (warn) warn.style.display = 'block';
  } else {
    if (warn) warn.style.display = 'none';
  }
  // Enforce maxlength
  if (el.maxLength && el.value.length > el.maxLength) {
    el.value = el.value.slice(0, el.maxLength);
  }
}

function phoneCodeOptionsHtml(selected) {
  var html = '';
  // Placeholder when no country auto-detected
  if (!selected) {
    html += '<option value="" disabled selected style="color:var(--text-muted)">—— ' + __('simple.select_country', 'Select country') + ' ——</option>';
  }
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    var c = COUNTRY_CODES[i];
    html += '<option value="' + c.dial + '"' + (c.dial === selected ? ' selected' : '') + '>' + c.code + ' ' + c.dial + '</option>';
  }
  return html;
}

// ── Step renderers ──

function renderUpload(body) {
  var socialVal = simpleUserInfo.social || {};
  var musicVal = simpleUserInfo.music || {};
  // Auto-detect country code on first visit
  if (!simpleUserInfo.phoneCode) {
    var detected = getDefaultPhoneCode();
    if (detected) simpleUserInfo.phoneCode = detected.dial;
  }
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.upload_title') + '</h2><p>' + __('simple.upload_desc') + '</p>' +
    '<div class="simple-upload-zone" id="simpleDropZone" onclick="document.getElementById(\'simpleFileInput\').click()">' +
    '<div class="dz-icon">📂</div>' +
    '<div class="dz-text">' + __('simple.drop_text') + '</div></div>' +
    '<input type="file" id="simpleFileInput" style="display:none" accept="image/*,audio/*,video/*,.pdf" onchange="simpleFileSelected(this)">' +
    '<div id="simpleFileInfo"></div>' +
    '<p style="font-size:0.72rem;color:var(--text-muted);margin:8px 0 0;padding:6px 8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __('simple.upload_size_note', '💡 For watermarking, use a large cover image (e.g. 1920×1080) so there is enough capacity to embed a secret image.') + '</p>' +
    '<p style="font-size:0.7rem;color:var(--danger);margin:6px 0 0;padding:4px 8px;background:rgba(220,53,69,.08);border-radius:6px">' +
    __('simple.usage_warning', '⚠️ This tool is for lawful use only. Uploading illegal or harmful content is strictly prohibited. All processing is local — nothing is stored or sent to any server.') + '</p>' +
    '<div class="simple-info-section" style="margin-top:20px;text-align:left">' +
    '<h3 style="font-size:1rem;margin:0 0 12px;color:var(--text-muted)">' + __('simple.info_title', 'Owner Information') + '</h3>' +
    '<div class="form-group"><label>' + __('simple.info_name', 'Full Name') + ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="text" id="sinfo-name" class="simple-info-field" placeholder="' + __('simple.info_name_ph', 'e.g. John Doe') + '" value="' + escHtml(simpleUserInfo.name) + '" required maxlength="25"></div>' +
    '<div class="form-group"><label>' + __('simple.info_email', 'Email') + ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="email" id="sinfo-email" class="simple-info-field" placeholder="' + __('simple.info_email_ph', 'e.g. john@example.com') + '" value="' + escHtml(simpleUserInfo.email) + '" required maxlength="20" oninput="validateEmailInput(this)">' +
    '<span id="sinfo-email-warn" class="simple-field-warn" style="display:none">' + __('simple.email_invalid', 'Please enter a valid email address') + '</span></div>' +
    '<div class="form-group"><label>' + __('simple.info_phone', 'Phone') + ' <span style="color:var(--danger)">*</span></label>' +
    '<div class="simple-phone-group">' +
    '<select id="sinfo-phonecode" onchange="updatePhoneMaxLength()">' + phoneCodeOptionsHtml(simpleUserInfo.phoneCode) + '</select>' +
    '<input type="tel" id="sinfo-phone" class="simple-info-field" maxlength="15" placeholder="' + __('simple.info_phone_ph', 'e.g. 5xx xxx xxxx') + '" value="' + escHtml(simpleUserInfo.phone) + '" required oninput="validatePhoneInput(this)">' +
    '</div>' +
    '<span id="sinfo-phone-warn" class="simple-field-warn" style="display:none">' + __('simple.phone_digits_only', 'Please enter numbers only') + '</span></div>' +
    '<div class="form-group"><label>' + __('simple.info_website', 'Website') + ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="url" id="sinfo-website" class="simple-info-field" placeholder="' + __('simple.info_website_ph', 'e.g. https://example.com') + '" value="' + escHtml(simpleUserInfo.website || 'https://') + '" required maxlength="30" oninput="validateUrlInput(this)" onfocus="prefixHttps(this)">' +
    '<span id="sinfo-website-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL (e.g. https://example.com)') + '</span></div>' +
    '<h4 style="font-size:0.9rem;margin:14px 0 8px;color:var(--text-muted)">' + __('simple.info_social', 'Social Links') + '</h4>' +
    '<div class="simple-social-grid">' +
    '<div><input type="url" id="sinfo-tiktok" placeholder="' + __('simple.ph_tiktok', 'TikTok URL') + '" value="' + escHtml(socialVal.tiktok || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-tiktok-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-facebook" placeholder="' + __('simple.ph_facebook', 'Facebook URL') + '" value="' + escHtml(socialVal.facebook || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-facebook-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-instagram" placeholder="' + __('simple.ph_instagram', 'Instagram URL') + '" value="' + escHtml(socialVal.instagram || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-instagram-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-youtube" placeholder="' + __('simple.ph_youtube', 'YouTube URL') + '" value="' + escHtml(socialVal.youtube || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-youtube-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '</div>' +
    '<label class="simple-artist-check" style="display:flex;align-items:center;gap:8px;margin:14px 0 8px;cursor:pointer;font-size:0.9rem">' +
    '<input type="checkbox" id="sinfo-isArtist"' + (simpleUserInfo.isArtist ? ' checked' : '') + ' onchange="toggleArtistFields()"> ' +
    __('simple.info_artist', 'I am an artist / musician') +
    '</label>' +
    '<div id="sinfo-artist-fields" style="display:' + (simpleUserInfo.isArtist ? '' : 'none') + '">' +
    '<h4 style="font-size:0.9rem;margin:0 0 8px;color:var(--text-muted)">' + __('simple.info_music', 'Music Platforms') + '</h4>' +
    '<div class="simple-social-grid">' +
    '<div><input type="url" id="sinfo-spotify" placeholder="' + __('simple.ph_spotify', 'Spotify URL') + '" value="' + escHtml(musicVal.spotify || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-spotify-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-applemusic" placeholder="' + __('simple.ph_applemusic', 'Apple Music URL') + '" value="' + escHtml(musicVal.appleMusic || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-applemusic-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-ytmusic" placeholder="' + __('simple.ph_ytmusic', 'YouTube Music URL') + '" value="' + escHtml(musicVal.youtubeMusic || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-ytmusic-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-soundcloud" placeholder="' + __('simple.ph_soundcloud', 'SoundCloud URL') + '" value="' + escHtml(musicVal.soundcloud || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-soundcloud-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '<div><input type="url" id="sinfo-bandcamp" placeholder="' + __('simple.ph_bandcamp', 'Bandcamp URL') + '" value="' + escHtml(musicVal.bandcamp || '') + '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-bandcamp-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '</div></div></div></div>';
  setupSimpleDropZone();
  if (simpleFile) restoreUploadFileInfo();
}

function toggleArtistFields() {
  var cb = document.getElementById('sinfo-isArtist');
  var fields = document.getElementById('sinfo-artist-fields');
  if (fields) fields.style.display = cb && cb.checked ? '' : 'none';
}

function saveSimpleUserInfo() {
  simpleUserInfo.name = (document.getElementById('sinfo-name') || {}).value || '';
  simpleUserInfo.email = (document.getElementById('sinfo-email') || {}).value || '';
  simpleUserInfo.phoneCode = (document.getElementById('sinfo-phonecode') || {}).value || '';
  simpleUserInfo.phone = (document.getElementById('sinfo-phone') || {}).value || '';
  simpleUserInfo.website = (document.getElementById('sinfo-website') || {}).value || '';
  simpleUserInfo.social = {
    tiktok: (document.getElementById('sinfo-tiktok') || {}).value || '',
    facebook: (document.getElementById('sinfo-facebook') || {}).value || '',
    instagram: (document.getElementById('sinfo-instagram') || {}).value || '',
    youtube: (document.getElementById('sinfo-youtube') || {}).value || ''
  };
  var cb = document.getElementById('sinfo-isArtist');
  simpleUserInfo.isArtist = cb ? cb.checked : false;
  simpleUserInfo.music = {
    spotify: (document.getElementById('sinfo-spotify') || {}).value || '',
    appleMusic: (document.getElementById('sinfo-applemusic') || {}).value || '',
    youtubeMusic: (document.getElementById('sinfo-ytmusic') || {}).value || '',
    soundcloud: (document.getElementById('sinfo-soundcloud') || {}).value || '',
    bandcamp: (document.getElementById('sinfo-bandcamp') || {}).value || ''
  };
}

function setupSimpleDropZone() {
  var dz = document.getElementById('simpleDropZone');
  if (!dz) return;
  dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', function() { dz.classList.remove('drag-over'); });
  dz.addEventListener('drop', function(e) {
    e.preventDefault(); dz.classList.remove('drag-over');
    if (e.dataTransfer.files.length) simpleFileSelected({ files: e.dataTransfer.files });
  });
}

function getSimpleTypeLabel(type) {
  var labels = {
    image: __('simple.type_image', 'image'),
    audio: __('simple.type_audio', 'audio'),
    video: __('simple.type_video', 'video'),
    document: __('simple.type_document', 'document'),
    other: __('simple.type_other', 'other')
  };
  return labels[type] || type;
}

function restoreUploadFileInfo() {
  var dz = document.getElementById('simpleDropZone');
  var info = document.getElementById('simpleFileInfo');
  if (!dz || !info || !simpleFile) return;
  dz.classList.add('has-file');
  var icon = { image: '🖼️', audio: '🎵', video: '🎬', document: '📄', other: '📁' }[simpleType] || '📁';
  info.innerHTML = '<div class="simple-file-info"><span class="simple-file-icon">' + icon + '</span>' +
    '<div><strong>' + escapeHtml(simpleFile.name) + '</strong><br>' + formatSize(simpleFile.size) +
    ' <span class="badge badge-muted">' + getSimpleTypeLabel(simpleType) + '</span></div></div>';
}

async function simpleFileSelected(input) {
  var file = input.files ? input.files[0] : input;
  if (!file) return;
  if (isDangerousFile(file)) {
    alert(__('shared.dangerous_file', 'This file type is not allowed for security reasons.'));
    if (input && input.tagName === 'INPUT') { input.value = ''; }
    return;
  }
  var acceptEl = document.getElementById('simpleFileInput');
  if (acceptEl && acceptEl.getAttribute('accept') && !matchesAccept(file, acceptEl.getAttribute('accept'))) {
    alert(__('shared.wrong_type', 'Please select a valid file type for this tool.'));
    if (input && input.tagName === 'INPUT') { input.value = ''; }
    return;
  }
  var magicOk = await matchesMagicBytes(file);
  if (!magicOk) {
    alert(__('shared.corrupt_file', 'This file appears to be corrupted or has an incorrect format.') || 'This file appears to be corrupted or has an incorrect format.');
    if (input && input.tagName === 'INPUT') { try { input.value = ''; } catch(e) {} }
    return;
  }
  var dangerous = await checkDangerousContent(file);
  if (dangerous) {
    alert(__('shared.dangerous_content', 'This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.') || 'This file contains potentially dangerous embedded code (scripts, event handlers) and is not allowed.');
    if (input && input.tagName === 'INPUT') { try { input.value = ''; } catch(e) {} }
    return;
  }
  var docOk = await checkDocumentThreats(file);
  if (!docOk) {
    alert(__('shared.dangerous_document', 'This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.') || 'This document contains potentially dangerous features (scripts, auto-execute actions, embedded files) and is not allowed.');
    if (input && input.tagName === 'INPUT') { try { input.value = ''; } catch(e) {} }
    return;
  }
  var structOk = await checkFileStructure(file);
  if (!structOk) {
    alert(__('shared.bad_structure', 'This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.') || 'This file appears to have suspicious data appended after its valid image content. Please re-export the file from a clean image editor.');
    if (input && input.tagName === 'INPUT') { try { input.value = ''; } catch(e) {} }
    return;
  }
  simpleFile = file;
  var type = detectFileType(file);
  var dz = document.getElementById('simpleDropZone');
  var info = document.getElementById('simpleFileInfo');
  dz.classList.add('has-file');
  var icon = { image: '🖼️', audio: '🎵', video: '🎬', document: '📄', other: '📁' }[type] || '📁';
  info.innerHTML = '<div class="simple-file-info"><span class="simple-file-icon">' + icon + '</span>' +
    '<div><strong>' + escapeHtml(file.name) + '</strong><br>' + formatSize(file.size) +
    ' <span class="badge badge-muted">' + getSimpleTypeLabel(type) + '</span></div></div>';
  simpleType = type;
  // Read file buffer
  var reader = new FileReader();
  reader.onload = function(e) { simpleBuf = e.target.result; };
  reader.readAsArrayBuffer(file);
  // Rebuild steps based on type
  if (type === 'image') {
    simpleSteps = [{ id: 'upload', label: __('simple.step_upload', 'Upload') }, { id: 'ai-question', label: __('simple.step_type', 'Type') }];
  } else {
    simpleSteps = buildSteps(type, false);
  }
  // Reset step position
  simpleStep = 0;
  renderStep();
}

function renderAiQuestion(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.ai_title') + '</h2><p>' + __('simple.ai_desc') + '</p>' +
    '<div class="simple-ai-options">' +
    '<div class="simple-ai-card" onclick="chooseAi(false)"><span class="ai-icon">📸</span><h3>' + __('simple.ai_regular') + '</h3><p>' + __('simple.ai_regular_desc') + '</p></div>' +
    '<div class="simple-ai-card" onclick="chooseAi(true)"><span class="ai-icon">🤖</span><h3>' + __('simple.ai_generated') + '</h3><p>' + __('simple.ai_generated_desc') + '</p></div>' +
    '</div></div>';
}

function chooseAi(isAI) {
  simpleIsAI = isAI;
  simpleSteps = buildSteps('image', isAI);
  simpleStep = simpleSteps.findIndex(function(s) { return s.id === 'fingerprint'; });
  renderStep();
}

function renderC2paStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.c2pa_title') + '</h2><p>' + __('simple.c2pa_desc') + '</p>' +
    '<div id="sc2pa-content" style="text-align:left">' +
    // Content type cards
    '<div class="form-group"><span>' + __('c2pa.content_type_label') + '</span>' +
    '<div id="sc2pa-write-types">' +
    '<div class="c2pa-type-card" data-form-type="create">' +
      '<label class="c2pa-type-header" for="sc2pa-create">' +
        '<input type="checkbox" id="sc2pa-create" value="create">' +
        '<span class="c2pa-type-name">' + __('c2pa.type_digital') + '</span></label>' +
      '<div class="c2pa-type-fields">' +
        '<input type="text" class="sc2pa-field" data-field="title" data-type="create" placeholder="' + __('c2pa.title_label') + '">' +
        '<input type="text" class="sc2pa-field" data-field="author" data-type="create" placeholder="' + __('c2pa.author_label') + '">' +
      '</div></div>' +
    '<div class="c2pa-type-card" data-form-type="edit">' +
      '<label class="c2pa-type-header" for="sc2pa-edit">' +
        '<input type="checkbox" id="sc2pa-edit" value="edit">' +
        '<span class="c2pa-type-name">' + __('c2pa.type_edited') + '</span></label>' +
      '<div class="c2pa-type-fields">' +
        '<input type="text" class="sc2pa-field" data-field="title" data-type="edit" placeholder="' + __('c2pa.title_label') + '">' +
        '<input type="text" class="sc2pa-field" data-field="author" data-type="edit" placeholder="' + __('c2pa.author_label') + '">' +
      '</div></div>' +
    '<div class="c2pa-type-card" data-form-type="ai" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia">' +
      '<label class="c2pa-type-header" for="sc2pa-ai">' +
        '<input type="checkbox" id="sc2pa-ai" value="ai" checked>' +
        '<span class="c2pa-type-name">' + __('c2pa.type_ai') + '</span></label>' +
      '<div class="c2pa-type-fields">' +
        '<input type="text" class="sc2pa-field" data-field="title" data-type="ai" placeholder="' + __('c2pa.title_label') + '">' +
        '<input type="text" class="sc2pa-field" data-field="author" data-type="ai" placeholder="' + __('c2pa.author_label') + '">' +
      '</div></div>' +
    '<div class="c2pa-type-card" data-form-type="capture" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture">' +
      '<label class="c2pa-type-header" for="sc2pa-capture">' +
        '<input type="checkbox" id="sc2pa-capture" value="capture">' +
        '<span class="c2pa-type-name">' + __('c2pa.type_capture') + '</span></label>' +
      '<div class="c2pa-type-fields">' +
        '<input type="text" class="sc2pa-field" data-field="title" data-type="capture" placeholder="' + __('c2pa.title_label') + '">' +
        '<input type="text" class="sc2pa-field" data-field="author" data-type="capture" placeholder="' + __('c2pa.author_label') + '">' +
      '</div></div>' +
    '<div class="c2pa-type-card" data-form-type="composite" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/composite">' +
      '<label class="c2pa-type-header" for="sc2pa-composite">' +
        '<input type="checkbox" id="sc2pa-composite" value="composite">' +
        '<span class="c2pa-type-name">' + __('c2pa.type_composite') + '</span></label>' +
      '<div class="c2pa-type-fields">' +
        '<input type="text" class="sc2pa-field" data-field="title" data-type="composite" placeholder="' + __('c2pa.title_label') + '">' +
        '<input type="text" class="sc2pa-field" data-field="author" data-type="composite" placeholder="' + __('c2pa.author_label') + '">' +
      '</div></div>' +
    '<div class="c2pa-type-card dnt-card">' +
      '<label class="c2pa-type-header" for="sc2pa-dnt">' +
        '<input type="checkbox" id="sc2pa-dnt">' +
        '<span class="c2pa-type-name">' + __('c2pa.type_dnt') + '</span></label></div>' +
    '</div></div>' +
    // Social links
    '<div class="form-group"><span>' + __('simple.c2pa_social_label') + '</span>' +
    '<div class="c2pa-links-grid">' +
      '<div><input type="url" class="sc2pa-link" data-platform="instagram" placeholder="' + __('simple.c2pa_instagram', 'Instagram URL') + '" id="sc2pa-link-instagram" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-instagram-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="twitter" placeholder="' + __('simple.c2pa_twitter', 'Twitter / X URL') + '" id="sc2pa-link-twitter" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-twitter-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="facebook" placeholder="' + __('simple.c2pa_facebook', 'Facebook URL') + '" id="sc2pa-link-facebook" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-facebook-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="tiktok" placeholder="' + __('simple.c2pa_tiktok', 'TikTok URL') + '" id="sc2pa-link-tiktok" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-tiktok-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="youtube" placeholder="' + __('simple.c2pa_youtube', 'YouTube URL') + '" id="sc2pa-link-youtube" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-youtube-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="website" placeholder="' + __('simple.c2pa_website', 'Website URL') + '" id="sc2pa-link-website" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-website-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '</div></div>' +
    // Music links
    '<div class="form-group"><span>' + __('simple.c2pa_music_label', 'Music Streaming (optional)') + '</span>' +
    '<div class="c2pa-links-grid">' +
      '<div><input type="url" class="sc2pa-link" data-platform="spotify" placeholder="' + __('simple.c2pa_spotify', 'Spotify URL') + '" id="sc2pa-link-spotify" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-spotify-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="applemusic" placeholder="' + __('simple.c2pa_applemusic', 'Apple Music URL') + '" id="sc2pa-link-applemusic" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-applemusic-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="soundcloud" placeholder="' + __('simple.c2pa_soundcloud', 'SoundCloud URL') + '" id="sc2pa-link-soundcloud" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-soundcloud-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
      '<div><input type="url" class="sc2pa-link" data-platform="bandcamp" placeholder="' + __('simple.c2pa_bandcamp', 'Bandcamp URL') + '" id="sc2pa-link-bandcamp" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-bandcamp-warn" class="simple-field-warn" style="display:none">' + __('simple.url_invalid', 'Please enter a valid URL') + '</span></div>' +
    '</div></div>' +
    '<button class="btn" onclick="runC2paStep()" id="sc2pa-btn">' + __('simple.c2pa_btn') + '</button>' +
    '<div id="sc2pa-result"></div></div>';
}

async function runC2paStep() {
  showProgress();
  var btn = document.getElementById('sc2pa-btn');
  var statusEl = document.getElementById('sc2pa-result');
  if (!window.handleC2paWrite) {
    if (statusEl) {
      statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px;margin-top:12px">' +
        __('simple.c2pa_no_module', 'C2PA module not loaded. Check internet connection and refresh.') + '</div>';
    }
    return;
  }
  // 1. Sync content type checkboxes
  var typeCards = document.querySelectorAll('#sc2pa-write-types .c2pa-type-card[data-form-type]');
  typeCards.forEach(function(card) {
    var ft = card.dataset.formType;
    var simpleCb = card.querySelector('input[type="checkbox"]');
    var profCb = document.getElementById('c2pa-write-' + ft);
    if (profCb && simpleCb) profCb.checked = simpleCb.checked;
  });
  // DNT checkbox (no data-form-type)
  var simpleDnt = document.getElementById('sc2pa-dnt');
  var profDnt = document.getElementById('c2pa-write-dnt');
  if (profDnt && simpleDnt) profDnt.checked = simpleDnt.checked;
  // 2. Sync content type fields (title/author)
  var simpleFields = document.querySelectorAll('.sc2pa-field');
  simpleFields.forEach(function(f) {
    var type = f.dataset.type;
    var fname = f.dataset.field;
    var profF = document.getElementById('c2pa-field-' + type + '-' + fname);
    if (profF) profF.value = f.value;
  });
  // 3. Sync social & music links
  var simpleLinks = document.querySelectorAll('.sc2pa-link');
  simpleLinks.forEach(function(link) {
    var platform = link.dataset.platform;
    var profLink = document.getElementById('c2pa-link-' + platform);
    if (profLink) profLink.value = link.value;
  });
  // 4. Use the PI output as the image to sign (or watermark if PI not done)
  if (simpleResults.piFinalUrl && !simpleResults.piFinalBlob) {
    try {
      simpleResults.piFinalBlob = await fetch(simpleResults.piFinalUrl).then(function(r) { return r.blob(); });
    } catch (e) {
      // blob URL expired, fall back to watermark blob
    }
  }
  var srcBlob = simpleResults.piFinalBlob || simpleResults.watermarkBlob;
  var fname = simpleFile ? simpleFile.name : 'image.png';
  var srcFile = srcBlob ? new File([srcBlob], fname, { type: 'image/png' }) : simpleFile;
  var fileInput = document.getElementById('c2pa-write-file');
  if (fileInput && srcFile) {
    var dt = new DataTransfer();
    dt.items.add(srcFile);
    fileInput.files = dt.files;
    var evt = new Event('change');
    fileInput.dispatchEvent(evt);
  }
  var btn = document.getElementById('sc2pa-btn');
  btn.disabled = true; btn.textContent = __('simple.signing');
  var statusEl = document.getElementById('sc2pa-result');
  handleC2paWrite().then(function(result) {
    if (result && result.ok) {
      btn.textContent = __('simple.signed');
      simpleResults.c2pa = true;
      simpleResults.c2paUrl = window._c2paSignedUrl || '';
      simpleStepDone = true;
      var nextBtn = document.getElementById('simpleNextBtn');
      nextBtn.disabled = false;
      nextBtn.style.display = '';
      if (statusEl) statusEl.innerHTML = '';
    } else {
      var errMsg = (result && result.error) || __('simple.c2pa_failed', 'C2PA signing failed');
      btn.textContent = __('simple.failed_retry');
      btn.disabled = false;
      if (statusEl) {
        statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px;margin-top:12px">' +
          escapeHtml(errMsg) + '</div>';
      }
    }
  });
}

function renderWatermarkStep(body) {
  var usingName = simpleFile ? simpleFile.name : '';
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.watermark_title') + '</h2><p>' + __('simple.watermark_desc') + '</p>' +
    '<p style="font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left">' +
    __('simple.using_file').replace('{name}', escapeHtml(usingName)) + '</p>' +
    '<div class="card-form" style="text-align:left">' +
    '<div class="form-group"><label>' + __('simple.wm_algo_label', 'Algorithm') + '</label>' +
    '<select id="swm-type">' +
    '  <option value="2">2. Frequency DCT</option>' +
    '  <option value="4">4. Latent DCT</option>' +
    '  <option value="7">7. Forensic</option>' +
    '  <option value="9">9. Imatag-style</option>' +
    '</select></div>' +
    '<div class="form-group"><label>' + __('simple.wm_pass_label', 'Password') + '</label>' +
    '<input type="password" id="swm-password" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)"></div>' +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin:8px 0;padding:8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __('simple.wm_fp_payload', '🔐 The fingerprint hash will be embedded as the secret message.') + '</p>' +
    '</div>' +
    '<button class="btn" onclick="runWatermarkStep()" id="swm-btn">' + __('simple.watermark_btn', 'Embed Watermark') + '</button>' +
    '<div id="swm-status"></div></div>';
}

function runWatermarkStep() {
  showProgress();
  var algo = parseInt(document.getElementById('swm-type').value);
  var pass = document.getElementById('swm-password').value || '';
  var statusEl = document.getElementById('swm-status');
  var btn = document.getElementById('swm-btn');
  if (btn) { btn.disabled = true; btn.textContent = __('simple.embedding', 'Embedding...'); }

  // Create a Blob from fingerprint result as the secret payload
  var fpText = '';
  if (simpleResults.fpResult) {
    fpText = typeof simpleResults.fpResult === 'string' ? simpleResults.fpResult : JSON.stringify(simpleResults.fpResult, null, 2);
  }
  if (fpText.length > 65536) fpText = fpText.slice(0, 65536);
  var secretBlob = new Blob([fpText], { type: 'text/plain' });
  var secretFile = new File([secretBlob], 'fingerprint.txt', { type: 'text/plain' });

  watermarkEmbed(algo, simpleFile, secretFile, pass).then(function(result) {
    if (result.ok) {
      simpleResults.watermark = true;
      simpleResults.watermarkAlgo = algo;
      simpleResults.watermarkBlob = result.data;
      simpleResults.watermarkUrl = URL.createObjectURL(result.data);
      simpleStepDone = true;
      var nextBtn = document.getElementById('simpleNextBtn');
      nextBtn.disabled = false;
      nextBtn.style.display = '';
      if (btn) { btn.textContent = '✅ ' + __('simple.watermarked_short', 'Watermarked'); }
      if (statusEl) {
        statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--success);padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
          __('simple.wm_done', '✅ Watermark embedded successfully using fingerprint hash.') + '</div>';
      }
      hideProgress();
    } else {
      hideProgress();
      if (btn) { btn.disabled = false; btn.textContent = __('simple.watermark_btn', 'Embed Watermark'); }
      if (statusEl) {
        statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px">' +
          escapeHtml(result.error || __('simple.embed_failed')) + '</div>';
      }
    }
  });
}

function runPixelInjectStep() {
  showProgress();
  var cat = document.getElementById('spi-category').value;
  var pass = document.getElementById('spi-password').value;
  var statusEl = document.getElementById('spi-status');
  var btn = document.getElementById('spi-btn');
  if (btn) { btn.disabled = true; btn.textContent = __('simple.injecting', 'Injecting...'); }

  // Use timestamp result as the message
  var tsMessage = simpleResults.tsResult || '';

  if (window.switchPiTab) window.switchPiTab('embed');

  setTimeout(function() {
    // Populate hidden professional form fields
    var fileInput = document.getElementById('pi-image');
    if (fileInput) {
      var srcFile = simpleResults.watermarkBlob ? new File([simpleResults.watermarkBlob], simpleFile.name, { type: simpleFile.type }) : simpleFile;
      if (srcFile) {
        var dt = new DataTransfer();
        dt.items.add(srcFile);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    }
    var catSelect = document.getElementById('pi-category');
    if (catSelect) { catSelect.value = cat; catSelect.dispatchEvent(new Event('change')); }
    var algoSelect = document.getElementById('pi-algorithm');
    var srcAlgo = document.getElementById('spi-algorithm');
    if (algoSelect && srcAlgo) algoSelect.value = srcAlgo.value;
    var msgInput = document.getElementById('pi-message');
    if (msgInput) msgInput.value = tsMessage;
    var passInput = document.getElementById('pi-password');
    if (passInput) passInput.value = pass;

    function cleanupPiFields() {
      if (msgInput) msgInput.value = '';
      if (passInput) passInput.value = '';
      if (fileInput) { var dt2 = new DataTransfer(); fileInput.files = dt2.files; }
    }

    var promise = window.handlePixelInjection();
    if (promise && promise.then) {
      promise.then(function() {
        simpleResults['pixel-injection'] = true;
        var piOutput = document.getElementById('pi-output');
        var piDownload = document.getElementById('pi-download');
        if (piOutput) simpleResults.piResultHtml = piOutput.innerHTML;
        if (piDownload) simpleResults.piHtml = piDownload.innerHTML;
        if (piDownload) {
          var piLink = piDownload.querySelector('a');
          if (piLink) simpleResults.piFinalUrl = piLink.href;
        }
        simpleStepDone = true;
        var nextBtn = document.getElementById('simpleNextBtn');
        nextBtn.disabled = false;
        nextBtn.style.display = '';

        if (btn) { btn.textContent = '✅ ' + __('simple.injected', 'Injected'); }
        if (statusEl) {
          statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--success);padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
            __('simple.pi_done_ts', '✅ Timestamp proof injected successfully as secret message.') + '</div>';
        }
        hideProgress();
      }).catch(function(e) {
        hideProgress();
        if (btn) { btn.disabled = false; btn.textContent = __('simple.pi_btn', 'Inject Message'); }
        if (statusEl) {
          statusEl.innerHTML = '<div style="font-size:0.85rem;color:var(--danger);padding:12px;background:rgba(220,53,69,.1);border-radius:8px">' +
            escapeHtml(e && e.message ? e.message : __('simple.pi_failed', 'Injection failed')) + '</div>';
        }
      }).then(function() {
        cleanupPiFields();
      });
    }
  }, 50);
}

function renderTimestampStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.ts_title') + '</h2><p>' + __('simple.ts_desc') + '</p>' +
    '<div id="sts-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p>' + __('simple.processing') + '</p></div></div>';
  runTimestampStep();
}

function runTimestampStep() {
  if (!window.handleOtsCreate) return;
  var fileInput = document.getElementById('ts-create-file');
  if (fileInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    fileInput.files = dt.files;
    var evt = new Event('change');
    fileInput.dispatchEvent(evt);
  }
  var promise = window.handleOtsCreate();
  if (promise && promise.then) {
    promise.then(function() {
      var resultDiv = document.getElementById('sts-result');
      if (resultDiv) {
        var text = escapeHtml((document.getElementById('ts-output') || {}).textContent || '');
        resultDiv.innerHTML = '<div class="simple-success">' + text.replace(/\n/g, '<br>') + '</div>';
      }
      simpleResults.timestamp = true;
      var tsOut = document.getElementById('ts-output');
      if (tsOut) simpleResults.tsResult = tsOut.textContent || '';
      var tsDl = document.getElementById('ts-download');
      if (tsDl) simpleResults.tsHtml = tsDl.innerHTML;
      simpleStepDone = true;
      document.getElementById('simpleNextBtn').disabled = false;
    }).catch(function(e) {
      var resultDiv = document.getElementById('sts-result');
      if (resultDiv) resultDiv.innerHTML = '<div class="simple-error">' + __('simple.ts_failed').replace('{msg}', escapeHtml(e.message)) + '</div>';
    });
  }
}

function renderFingerprintStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.fp_title') + '</h2><p>' + __('simple.fp_desc') + '</p>' +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 12px;padding:8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __('simple.fp_processing_note', '⏳ Computing multiple hash algorithms. This may take a moment for large files.') + '</p>' +
    '<div id="sfp-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p>' + __('simple.processing') + '</p></div></div>';
  runFingerprintStep();
}

function runFingerprintStep() {
  if (!window.handleFingerprint) return;
  var fileInput = document.getElementById('fp-file');
  if (fileInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    fileInput.files = dt.files;
    var evt = new Event('change');
    fileInput.dispatchEvent(evt);
  }
  // Defer to next tick so the browser renders the spinner first
  setTimeout(function() {
    // Use fast fingerprint for simplified mode (fewer algorithms, less blocking)
    if (window.fastFingerprint) {
      window.fastFingerprint(simpleFile).then(function(result) {
        var resultDiv = document.getElementById('sfp-result');
        if (resultDiv) {
          resultDiv.innerHTML = '<div class="simple-fp-result" style="font-size:0.85rem;color:var(--success);margin-top:12px;padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
            __('simple.fp_done', 'Digital fingerprint generated successfully. All hash algorithms and perceptual hashes are complete.') + '</div>';
        }
        simpleResults.fingerprint = true;
        simpleResults.fpResult = result;
        window._fpResult = result;
        simpleStepDone = true;
        document.getElementById('simpleNextBtn').disabled = false;
      }).catch(function(e) {
        var resultDiv = document.getElementById('sfp-result');
        if (resultDiv) resultDiv.innerHTML = '<div class="simple-error">' + __('simple.fp_failed').replace('{msg}', escapeHtml(e.message)) + '</div>';
      });
    } else {
      var promise = window.handleFingerprint();
      if (promise && promise.then) {
        promise.then(function() {
          var resultDiv = document.getElementById('sfp-result');
          var fpOutput = document.getElementById('fp-output');
          if (resultDiv) {
            resultDiv.innerHTML = '<div class="simple-fp-result" style="font-size:0.85rem;color:var(--success);margin-top:12px;padding:12px;background:rgba(40,167,69,.1);border-radius:8px">' +
              __('simple.fp_done', 'Digital fingerprint generated successfully. All hash algorithms and perceptual hashes are complete.') + '</div>';
          }
          simpleResults.fingerprint = true;
          if (fpOutput) {
            simpleResults.fpHtml = fpOutput.innerHTML;
            simpleResults.fpResult = window._fpResult || null;
          }
          simpleStepDone = true;
          document.getElementById('simpleNextBtn').disabled = false;
        }).catch(function(e) {
          var resultDiv = document.getElementById('sfp-result');
          if (resultDiv) resultDiv.innerHTML = '<div class="simple-error">' + __('simple.fp_failed').replace('{msg}', escapeHtml(e.message)) + '</div>';
        });
      }
    }
  }, 50);
}

function renderDone(body) {
  var results = simpleResults;
  var sections = [];

  if (results.c2pa && results.c2paUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.final_image_title', 'Final Image') + '</h3>' +
      '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
      __('simple.c2pa_final_desc', 'C2PA-signed — watermark + timestamp injected + AI provenance.') + '</p>' +
      '<img src="' + results.c2paUrl + '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
      '<a href="' + results.c2paUrl + '" download="signed.png" class="btn" style="background:var(--primary);color:#fff">' +
      __('simple.final_dl_btn', '📥 Download Final Image') + '</a></div>');
  } else if (results['pixel-injection'] && results.piFinalUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.final_image_title', 'Final Image') + '</h3>' +
      '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
      __('simple.final_image_desc', 'Watermark + secret message — one image. Use Professional mode to extract both.') + '</p>' +
      '<img src="' + results.piFinalUrl + '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
      '<a href="' + results.piFinalUrl + '" download="protected.png" class="btn" style="background:var(--primary);color:#fff">' +
      __('simple.final_dl_btn', '📥 Download Final Image') + '</a></div>');
  } else if (results.watermark && results.watermarkUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.watermarked_label') + '</h3>' +
      '<img src="' + results.watermarkUrl + '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
      '<a href="' + results.watermarkUrl + '" download="watermarked.png" class="btn">' + __('simple.watermark_dl_btn') + '</a></div>');
  }

  if (results.timestamp) {
    var tsHtml = '<div class="simple-done-section"><h3>' + __('simple.ts_label') + '</h3>';
    if (results.tsResult) tsHtml += '<pre style="white-space:pre-wrap;font-size:0.78rem;background:var(--bg);padding:8px;border-radius:6px;margin:8px 0">' + escapeHtml(results.tsResult) + '</pre>';
    if (results.tsHtml) tsHtml += '<div style="margin-top:8px">' + results.tsHtml + '</div>';
    tsHtml += '</div>';
    sections.push(tsHtml);
  }

  if (results.fingerprint) {
    var fpHtml = '<div class="simple-done-section"><h3>' + __('simple.fp_label') + '</h3>';
    fpHtml += '<div style="margin-top:12px">';
    fpHtml += '<button class="btn" onclick="setupFpDownload();showDownloadModal()">' + __('simple.fp_dl_btn') + '</button>';
    fpHtml += '</div></div>';
    sections.push(fpHtml);
  }

  if (results.c2pa && !results.c2paUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.c2pa_label') + '</h3><p>' + __('simple.c2pa_done_desc') + '</p></div>');
  }

  // Certificate download section
  var hasAnyResult = results.watermark || results['pixel-injection'] || results.timestamp || results.fingerprint || results.c2pa;
  if (hasAnyResult) {
    sections.push('<div class="simple-done-section simple-cert-section">' +
      '<h3>' + __('simple.cert_title', 'Digital Passport') + '</h3>' +
      '<p style="font-size:0.82rem;color:var(--text-muted);margin:4px 0 12px">' +
      __('simple.cert_desc', 'Download a signed document with all results, image preview, and QR verification code.') + '</p>' +
      '<div class="simple-cert-btns">' +
      '<button class="btn cert-btn" onclick="downloadCert(\'pdf\', this)" style="background:#d32f2f;color:#fff">📄 PDF</button>' +
      '<button class="btn cert-btn" onclick="downloadCert(\'docx\', this)" style="background:#2b579a;color:#fff">📝 DOCX</button>' +
      '<button class="btn cert-btn" onclick="downloadCert(\'epub\', this)" style="background:#7ab55c;color:#fff">📖 EPUB</button>' +
      '</div></div>');
  }

  var mainHtml = '<div class="simple-card simple-done"><h2>' + __('simple.done_title') + '</h2>' +
    '<p>' + __('simple.done_desc') + '</p>' +
    '<div class="simple-results-list">' + sections.join('') + '</div>' +
    '<div class="simple-done-actions">' +
    '<button class="btn" onclick="restartSimple()">' + __('simple.done_restart') + '</button>' +
    '<button class="btn" onclick="switchMode()">' + __('simple.done_switch') + '</button>' +
    '</div></div>';

  body.innerHTML = mainHtml;
  document.getElementById('simplePrevBtn').style.display = 'none';
  document.getElementById('simpleNextBtn').textContent = __('simple.start_over');
}

function setupFpDownload() {
  window._currentDownloadHandler = downloadFingerprint;
  document.getElementById('dl-modal-title').textContent = __('dl.title');
  if (!window._fpResult && simpleResults.fpResult) window._fpResult = simpleResults.fpResult;
}

function toggleSimpleLangDropdown() {
  var menu = document.getElementById('simpleLangMenu');
  if (menu) menu.classList.toggle('show');
}

function toggleModeLangDropdown() {
  var menu = document.getElementById('modeLangMenu');
  if (menu) menu.classList.toggle('show');
}

// ── Helpers ──

function escapeHtml(s) {
  var div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', initMode);
