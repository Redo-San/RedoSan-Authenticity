/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
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
/* c8 ignore stop */
// ── Country code data ──

var COUNTRY_CODES = [
  { code: "SA", dial: "+966", name: "السعودية", len: 9 },
  { code: "AE", dial: "+971", name: "الإمارات", len: 9 },
  { code: "EG", dial: "+20", name: "مصر", len: 10 },
  { code: "KW", dial: "+965", name: "الكويت", len: 8 },
  { code: "QA", dial: "+974", name: "قطر", len: 8 },
  { code: "BH", dial: "+973", name: "البحرين", len: 8 },
  { code: "OM", dial: "+968", name: "عمان", len: 8 },
  { code: "IQ", dial: "+964", name: "العراق", len: 10 },
  { code: "JO", dial: "+962", name: "الأردن", len: 9 },
  { code: "LB", dial: "+961", name: "لبنان", len: 8 },
  { code: "PS", dial: "+970", name: "فلسطين", len: 9 },
  { code: "SY", dial: "+963", name: "سوريا", len: 9 },
  { code: "YE", dial: "+967", name: "اليمن", len: 9 },
  { code: "SD", dial: "+249", name: "السودان", len: 9 },
  { code: "LY", dial: "+218", name: "ليبيا", len: 9 },
  { code: "TN", dial: "+216", name: "تونس", len: 8 },
  { code: "DZ", dial: "+213", name: "الجزائر", len: 9 },
  { code: "MA", dial: "+212", name: "المغرب", len: 9 },
  { code: "TR", dial: "+90", name: "تركيا", len: 10 },
  { code: "US", dial: "+1", name: "USA", len: 10 },
  { code: "GB", dial: "+44", name: "UK", len: 10 },
  { code: "CA", dial: "+1", name: "Canada", len: 10 },
  { code: "AU", dial: "+61", name: "Australia", len: 9 },
  { code: "IN", dial: "+91", name: "India", len: 10 },
  { code: "CN", dial: "+86", name: "China", len: 11 },
  { code: "JP", dial: "+81", name: "Japan", len: 10 },
  { code: "KR", dial: "+82", name: "South Korea", len: 10 },
  { code: "FR", dial: "+33", name: "France", len: 9 },
  { code: "DE", dial: "+49", name: "Germany", len: 10 },
  { code: "IT", dial: "+39", name: "Italy", len: 10 },
  { code: "ES", dial: "+34", name: "Spain", len: 9 },
  { code: "NL", dial: "+31", name: "Netherlands", len: 9 },
  { code: "RU", dial: "+7", name: "Russia", len: 10 },
  { code: "BR", dial: "+55", name: "Brazil", len: 10 },
  { code: "PK", dial: "+92", name: "Pakistan", len: 10 },
  { code: "BD", dial: "+880", name: "Bangladesh", len: 10 },
  { code: "ID", dial: "+62", name: "Indonesia", len: 10 },
  { code: "MY", dial: "+60", name: "Malaysia", len: 9 },
  { code: "SG", dial: "+65", name: "Singapore", len: 8 },
  { code: "TH", dial: "+66", name: "Thailand", len: 9 },
  { code: "PH", dial: "+63", name: "Philippines", len: 10 },
  { code: "NG", dial: "+234", name: "Nigeria", len: 10 },
  { code: "ZA", dial: "+27", name: "South Africa", len: 9 },
  { code: "KE", dial: "+254", name: "Kenya", len: 9 },
  { code: "IR", dial: "+98", name: "Iran", len: 10 },
  { code: "AF", dial: "+93", name: "Afghanistan", len: 9 },
];

/**
 *
 */
function getCountryFromLocale() {
  // Try all Intl APIs for region code detection
  // Intl.NumberFormat usually returns the most accurate locale (OS-level)
  var locales = [];
  try {
    locales.push(Intl.NumberFormat().resolvedOptions().locale);
  } catch {}
  try {
    locales.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {}
  try {
    locales.push(Intl.Collator().resolvedOptions().locale);
  } catch {}
  for (var li = 0; li < locales.length; li++) {
    if (!locales[li]) continue;
    var parts = locales[li].split("-");
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

/**
 *
 */
function getCountryFromTimezone() {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    // Extract city name from timezone (last component)
    var parts = tz.split("/");
    var city = parts.at(-1);
    // Comprehensive IANA city → country code mapping
    // Generated from zone1970.tab — covers 300+ canonical timezones
    var tzCity = {
      Adak: "US",
      Adelaide: "AU",
      Algiers: "DZ",
      Almaty: "KZ",
      Amman: "JO",
      Anadyr: "RU",
      Anchorage: "US",
      Andorra: "AD",
      Apia: "WS",
      Aqtau: "KZ",
      Aqtobe: "KZ",
      Araguaina: "BR",
      Ashgabat: "TM",
      Astrakhan: "RU",
      Asuncion: "PY",
      Athens: "GR",
      Atyrau: "KZ",
      Auckland: "NZ",
      Azores: "PT",
      Baghdad: "IQ",
      Bahia: "BR",
      Bahia_Banderas: "MX",
      Baku: "AZ",
      Bangkok: "TH",
      Barbados: "BB",
      Barnaul: "RU",
      Beirut: "LB",
      Belem: "BR",
      Belgrade: "RS",
      Belize: "BZ",
      Berlin: "DE",
      Bermuda: "BM",
      Beulah: "US",
      Bishkek: "KG",
      Bissau: "GW",
      Boa_Vista: "BR",
      Bogota: "CO",
      Boise: "US",
      Bougainville: "PG",
      Brisbane: "AU",
      Broken_Hill: "AU",
      Brussels: "BE",
      Bucharest: "RO",
      Budapest: "HU",
      Buenos_Aires: "AR",
      Cairo: "EG",
      Cambridge_Bay: "CA",
      Campo_Grande: "BR",
      Canary: "ES",
      Cancun: "MX",
      Cape_Verde: "CV",
      Caracas: "VE",
      Casablanca: "MA",
      Catamarca: "AR",
      Cayenne: "GF",
      Center: "US",
      Ceuta: "ES",
      Chagos: "IO",
      Chatham: "NZ",
      Chicago: "US",
      Chihuahua: "MX",
      Chisinau: "MD",
      Chita: "RU",
      Ciudad_Juarez: "MX",
      Colombo: "LK",
      Cordoba: "AR",
      Costa_Rica: "CR",
      Coyhaique: "CL",
      Cuiaba: "BR",
      Damascus: "SY",
      Danmarkshavn: "GL",
      Darwin: "AU",
      Dawson: "CA",
      Dawson_Creek: "CA",
      Denver: "US",
      Detroit: "US",
      Dhaka: "BD",
      Dili: "TL",
      Dubai: "AE",
      Dublin: "IE",
      Dushanbe: "TJ",
      Easter: "CL",
      Edmonton: "CA",
      Efate: "VU",
      Eirunepe: "BR",
      El_Aaiun: "EH",
      El_Salvador: "SV",
      Eucla: "AU",
      Fakaofo: "TK",
      Famagusta: "CY",
      Faroe: "FO",
      Fiji: "FJ",
      Fort_Nelson: "CA",
      Fortaleza: "BR",
      Galapagos: "EC",
      Gambier: "PF",
      Gaza: "PS",
      Gibraltar: "GI",
      Glace_Bay: "CA",
      Goose_Bay: "CA",
      Grand_Turk: "TC",
      Guadalcanal: "SB",
      Guam: "GU",
      Guatemala: "GT",
      Guayaquil: "EC",
      Guyana: "GY",
      Halifax: "CA",
      Havana: "CU",
      Hebron: "PS",
      Helsinki: "FI",
      Hermosillo: "MX",
      Ho_Chi_Minh: "VN",
      Hobart: "AU",
      Hong_Kong: "HK",
      Honolulu: "US",
      Hovd: "MN",
      Indianapolis: "US",
      Inuvik: "CA",
      Iqaluit: "CA",
      Irkutsk: "RU",
      Istanbul: "TR",
      Jakarta: "ID",
      Jamaica: "JM",
      Jayapura: "ID",
      Jerusalem: "IL",
      Johannesburg: "ZA",
      Juba: "SS",
      Jujuy: "AR",
      Juneau: "US",
      Kabul: "AF",
      Kaliningrad: "RU",
      Kamchatka: "RU",
      Kanton: "KI",
      Karachi: "PK",
      Kathmandu: "NP",
      Khandyga: "RU",
      Khartoum: "SD",
      Kiritimati: "KI",
      Kirov: "RU",
      Knox: "US",
      Kolkata: "IN",
      Krasnoyarsk: "RU",
      Kuching: "MY",
      Kwajalein: "MH",
      Kyiv: "UA",
      La_Paz: "BO",
      La_Rioja: "AR",
      Lagos: "NG",
      Lima: "PE",
      Lindeman: "AU",
      Lisbon: "PT",
      London: "GB",
      Lord_Howe: "AU",
      Los_Angeles: "US",
      Louisville: "US",
      Macau: "MO",
      Maceio: "BR",
      Macquarie: "AU",
      Madeira: "PT",
      Madrid: "ES",
      Magadan: "RU",
      Makassar: "ID",
      Maldives: "MV",
      Malta: "MT",
      Managua: "NI",
      Manaus: "BR",
      Manila: "PH",
      Maputo: "MZ",
      Marengo: "US",
      Marquesas: "PF",
      Martinique: "MQ",
      Matamoros: "MX",
      Mauritius: "MU",
      Mazatlan: "MX",
      Melbourne: "AU",
      Mendoza: "AR",
      Menominee: "US",
      Merida: "MX",
      Metlakatla: "US",
      Mexico_City: "MX",
      Minsk: "BY",
      Miquelon: "PM",
      Moncton: "CA",
      Monrovia: "LR",
      Monterrey: "MX",
      Montevideo: "UY",
      Monticello: "US",
      Moscow: "RU",
      Nairobi: "KE",
      Nauru: "NR",
      Ndjamena: "TD",
      New_Salem: "US",
      New_York: "US",
      Nicosia: "CY",
      Niue: "NU",
      Nome: "US",
      Norfolk: "NF",
      Noronha: "BR",
      Noumea: "NC",
      Novokuznetsk: "RU",
      Novosibirsk: "RU",
      Nuuk: "GL",
      Ojinaga: "MX",
      Omsk: "RU",
      Oral: "KZ",
      Palau: "PW",
      Panama: "PA",
      Paramaribo: "SR",
      Paris: "FR",
      Perth: "AU",
      Petersburg: "US",
      Phoenix: "US",
      Pitcairn: "PN",
      Pontianak: "ID",
      Port_Moresby: "PG",
      "Port-au-Prince": "HT",
      Porto_Velho: "BR",
      Prague: "CZ",
      Puerto_Rico: "PR",
      Punta_Arenas: "CL",
      Pyongyang: "KP",
      Qatar: "QA",
      Qostanay: "KZ",
      Qyzylorda: "KZ",
      Rankin_Inlet: "CA",
      Rarotonga: "CK",
      Recife: "BR",
      Regina: "CA",
      Resolute: "CA",
      Riga: "LV",
      Rio_Branco: "BR",
      Rio_Gallegos: "AR",
      Riyadh: "SA",
      Rome: "IT",
      Sakhalin: "RU",
      Salta: "AR",
      Samara: "RU",
      Samarkand: "UZ",
      San_Juan: "AR",
      San_Luis: "AR",
      Santarem: "BR",
      Santiago: "CL",
      Santo_Domingo: "DO",
      Sao_Paulo: "BR",
      Sao_Tome: "ST",
      Saratov: "RU",
      Scoresbysund: "GL",
      Seoul: "KR",
      Shanghai: "CN",
      Simferopol: "RU",
      Singapore: "SG",
      Sitka: "US",
      Sofia: "BG",
      Srednekolymsk: "RU",
      St_Johns: "CA",
      Stanley: "FK",
      Swift_Current: "CA",
      Sydney: "AU",
      Tahiti: "PF",
      Taipei: "TW",
      Tallinn: "EE",
      Tarawa: "KI",
      Tashkent: "UZ",
      Tbilisi: "GE",
      Tegucigalpa: "HN",
      Tehran: "IR",
      Tell_City: "US",
      Thimphu: "BT",
      Thule: "GL",
      Tijuana: "MX",
      Tirane: "AL",
      Tokyo: "JP",
      Tomsk: "RU",
      Tongatapu: "TO",
      Toronto: "CA",
      Tripoli: "LY",
      Tucuman: "AR",
      Tunis: "TN",
      Ulaanbaatar: "MN",
      Ulyanovsk: "RU",
      Urumqi: "CN",
      Ushuaia: "AR",
      "Ust-Nera": "RU",
      Vancouver: "CA",
      Vevay: "US",
      Vienna: "AT",
      Vilnius: "LT",
      Vincennes: "US",
      Vladivostok: "RU",
      Volgograd: "RU",
      Warsaw: "PL",
      Whitehorse: "CA",
      Winamac: "US",
      Windhoek: "NA",
      Winnipeg: "CA",
      Yakutat: "US",
      Yakutsk: "RU",
      Yangon: "MM",
      Yekaterinburg: "RU",
      Yerevan: "AM",
      Zurich: "CH",
    };
    var code = tzCity[city];
    if (code) {
      for (var i = 0; i < COUNTRY_CODES.length; i++) {
        if (COUNTRY_CODES[i].code === code) return COUNTRY_CODES[i];
      }
    }
  } catch {}
  return null;
}

/**
 *
 */
function getDefaultPhoneCode() {
  var c;
  // 1. Try Intl APIs (NumberFormat, DateTimeFormat, Collator)
  c = getCountryFromLocale();
  if (c) return c;
  /* c8 ignore start */
  // 2. Try navigator.languages (user's ordered preference list)
  try {
    var langs = navigator.languages || [
      navigator.language || navigator.userLanguage || "",
    ];
    for (var l = 0; l < langs.length; l++) {
      var parts = langs[l].split("-");
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].length === 2 && /^[A-Za-z]{2}$/.test(parts[p])) {
          var code = parts[p].toUpperCase();
          for (var i = 0; i < COUNTRY_CODES.length; i++) {
            if (COUNTRY_CODES[i].code === code) return COUNTRY_CODES[i];
          }
        }
      }
    }
  } catch {}
  // 3. Try from timezone (300+ IANA zones mapped to country codes)
  c = getCountryFromTimezone();
  if (c) return c;
  // 4. Fallback — leave unselected, let user choose
  return null;
  /* c8 ignore stop */
}

/**
 *
 */
function updatePhoneMaxLength() {
  // Try cert fields first, fall back to simplified fields
  var el =
    document.getElementById("cert-phone") ||
    document.getElementById("sinfo-phone");
  var code =
    document.getElementById("cert-phonecode") ||
    document.getElementById("sinfo-phonecode");
  if (!el || !code) return;
  var dial = code.value;
  var maxLen = 15; // ITU max
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    if (COUNTRY_CODES[i].dial === dial) {
      maxLen = COUNTRY_CODES[i].len;
      break;
    }
  }
  el.maxLength = maxLen;
  if (el.value.length > maxLen) el.value = el.value.slice(0, maxLen);
}

/**
 *
 * @param el
 */
function validateSocialInput(el) {
  var warn = document.getElementById(el.id + "-warn");
  if (!el.value) {
    if (warn) warn.style.display = "none";
    return;
  }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? "none" : "block";
}

/**
 *
 * @param el
 */
function prefixHttps(el) {
  if (!el.value || !/^https?:\/\//i.test(el.value)) {
    el.value = "https://";
  }
  el.setSelectionRange(el.value.length, el.value.length);
}

// ── Progress bar ──
/**
 *
 */
function showProgress() {
  var el = document.getElementById("simpleProgressBar");
  if (el) el.style.display = "";
}
/**
 *
 */
function hideProgress() {
  var el = document.getElementById("simpleProgressBar");
  if (el) {
    el.style.display = "none";
  }
}

// ── Clear data ──
/**
 *
 */
function clearSimpleData() {
  if (
    !confirm(
      __(
        "simple.clear_confirm",
        "Clear all data? Your current progress will be lost.",
      ),
    )
  )
    return;
  localStorage.removeItem("simpleUserInfo");
  localStorage.removeItem("simpleFileData");
  if (simpleResults) {
    Object.keys(simpleResults).forEach(function (k) {
      if (k.indexOf("Url") > 0) {
        try {
          URL.revokeObjectURL(simpleResults[k]);
        } catch {}
      }
    });
  }
  initSimplified();
}

// ── Lightbox ──
/**
 *
 * @param src
 */
function openLightbox(src) {
  var img = document.getElementById("lightboxImg");
  var box = document.getElementById("lightbox");
  if (img && box) {
    img.src = src;
    box.style.display = "";
  }
}
/**
 *
 */
function closeLightbox() {
  var box = document.getElementById("lightbox");
  if (box) box.style.display = "none";
}

// ── C2PA link validation ──
/**
 *
 * @param el
 */
function validateC2paLink(el) {
  var warn = document.getElementById(el.id + "-warn");
  if (!el.value) {
    if (warn) warn.style.display = "none";
    return;
  }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? "none" : "block";
}

/**
 *
 * @param el
 */
function validateUrlInput(el) {
  var warn = document.getElementById(el.id + "-warn");
  if (!el.value) {
    if (warn) warn.style.display = "none";
    return;
  }
  var ok = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(el.value);
  if (warn) warn.style.display = ok ? "none" : "block";
}

/**
 *
 * @param el
 */
function validateEmailInput(el) {
  var warn = document.getElementById(el.id + "-warn");
  if (!el.value) {
    if (warn) warn.style.display = "none";
    return;
  }
  var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  if (warn) warn.style.display = ok ? "none" : "block";
}

/**
 *
 * @param el
 */
function validatePhoneInput(el) {
  var warn = document.getElementById(el.id + "-warn");
  if (/[^\d]/.test(el.value)) {
    el.value = el.value.replace(/\D/g, "");
    if (warn) warn.style.display = "block";
  } else {
    if (warn) warn.style.display = "none";
  }
  if (el.maxLength && el.value.length > el.maxLength) {
    el.value = el.value.slice(0, el.maxLength);
  }
}

/**
 *
 * @param selected
 */
function phoneCodeOptionsHtml(selected) {
  var html = "";
  // Placeholder when no country auto-detected
  if (!selected) {
    html +=
      '<option value="" disabled selected style="color:var(--text-muted)">—— ' +
      __("simple.select_country", "Select country") +
      " ——</option>";
  }
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    var c = COUNTRY_CODES[i];
    html +=
      '<option value="' +
      c.dial +
      '"' +
      (c.dial === selected ? " selected" : "") +
      ">" +
      c.code +
      " " +
      c.dial +
      "</option>";
  }
  return html;
}
