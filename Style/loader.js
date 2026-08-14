/**
 * RedoSan lazy script loader
 * Loads per-section feature scripts + vendor libraries on demand
 * so the SPA shell stays light at startup.
 */
(function () {
  "use strict";

  var LIB_SRC = {
    jspdf: "vendor/jspdf.umd.min.js",
    qrious: "vendor/qrious.min.js",
    jszip: "vendor/jszip.min.js",
    opentimestamps: "vendor/opentimestamps.min.js",
    docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0",
    human: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js",
    lamejs: "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.min.js",
  };

  var CERT_STACK = [
    "Certificate/certificate_ots.js",
    "Certificate/certificate_utils.js",
    "Certificate/certificate_pdf.js",
    "Certificate/certificate_docx.js",
    "Certificate/certificate_epub.js",
    "Certificate/certificate.js",
    "opentimestamps",
    "jspdf",
    "qrious",
    "jszip",
    "docx",
  ];

  var SECTION_SCRIPTS = {
    watermark: [
      "Watermark/utils.js?v=2",
      "Watermark/watermark_core.js",
      "Watermark/watermark.js",
      "jspdf",
      "docx",
    ],
    "audio-watermark": [
      "Watermark/utils.js?v=2",
      "Audio_Watermark/audio_watermark_core.js?v=7",
      "Audio_Watermark/audio_watermark.js?v=3",
      "lamejs",
    ],
    "pixel-injection": [
      "Pixel_Injection/watermark_core_advanced.js",
      "Pixel_Injection/watermark_core_transforms.js",
      "Pixel_Injection/watermark_core_algorithms.js",
      "Pixel_Injection/watermark_advanced_ui.js",
      "Pixel_Injection/pixel_injection.js",
      "jspdf",
      "docx",
    ],
    forensic: ["Forensic/forensic_core.js", "Forensic/forensic.js"],
    id_forge: ["ID_Forge/id_forge.js", "jspdf"],
    "document-watermark": [
      "Document_Watermark/document_watermark_core.js?v=3",
      "Document_Watermark/document_watermark_report.js?v=1",
      "Document_Watermark/document_watermark_pdf.js?v=1",
      "Document_Watermark/text_extractor.js?v=5",
      "Document_Watermark/document_watermark.js?v=3",
      "jspdf",
      "qrious",
      "jszip",
    ],
    fingerprint: [
      "Fingerprint/hashing_perceptual.js",
      "Fingerprint/hashing.js",
      "Fingerprint/fingerprint_ui.js",
      "jspdf",
      "docx",
    ],
    metadata: ["Metadata/metadata.js", "jspdf", "docx"],
    timestamp: ["Timestamp/timestamp.js"],
    did: ["Decentralized_Identity_DID/did.js", "jspdf", "docx"],
    "face-biometric": [
      "Face_Biometric/face_engine.js",
      "Face_Biometric/face_registry.js",
      "Face_Biometric/face_ui.js",
      "Face_Biometric/face_biohash.js",
      "Face_Biometric/face_fuzzy.js",
      "Face_Biometric/face_camera.js",
      "Face_Biometric/face_liveness.js",
      "human",
    ].concat(CERT_STACK),
    certificate: CERT_STACK.slice(),
    converter: [
      "Converter/ffmpeg.min.js",
      "Converter/converter.js",
      "jspdf",
      "docx",
      "lamejs",
    ],
    c2pa: ["jspdf", "docx", "__c2pa_module__"],
  };

  var LOADED = {};
  var LOADING = {};

  /**
   *
   * @param src
   */
  function loadOne(src) {
    if (LOADED[src]) return Promise.resolve();
    if (LOADING[src]) return LOADING[src];
    LOADING[src] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        LOADED[src] = true;
        delete LOADING[src];
        resolve();
      };
      s.onerror = function () {
        delete LOADING[src];
        reject(new Error("Failed to load " + src));
      };
      document.head.append(s);
    });
    return LOADING[src];
  }

  /**
   *
   * @param libs
   */
  function loadLibs(libs) {
    var chain = Promise.resolve();
    (libs || []).forEach(function (lib) {
      chain = chain.then(function () {
        return loadOne(LIB_SRC[lib]);
      });
    });
    return chain;
  }

  /**
   *
   */
  function loadC2paModule() {
    if (LOADED.__c2pa_module__) return Promise.resolve();
    if (LOADING.__c2pa_module__) return LOADING.__c2pa_module__;
    LOADING.__c2pa_module__ = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.type = "module";
      s.src = "C2PA/c2pa.js";
      s.onload = function () {
        LOADED.__c2pa_module__ = true;
        delete LOADING.__c2pa_module__;
        resolve();
      };
      s.onerror = function () {
        delete LOADING.__c2pa_module__;
        reject(new Error("Failed to load C2PA module"));
      };
      document.head.append(s);
    });
    return LOADING.__c2pa_module__;
  }

  /**
   *
   * @param name
   */
  function loadSection(name) {
    var deps = SECTION_SCRIPTS[name];
    if (!deps || !deps.length) return Promise.resolve();
    if (LOADED["section:" + name]) return LOADED["section:" + name];
    var chain = Promise.resolve();
    deps.forEach(function (dep) {
      chain = chain.then(function () {
        if (dep === "__c2pa_module__") return loadC2paModule();
        if (LIB_SRC[dep]) return loadOne(LIB_SRC[dep]);
        return loadOne(dep);
      });
    });
    LOADED["section:" + name] = chain;
    return chain;
  }

  window.RedoSanLoader = {
    loadSection: loadSection,
    loadLibs: loadLibs,
    isLoaded: function (key) {
      return !!LOADED[key] || !!LOADED["section:" + key];
    },
  };
})();
