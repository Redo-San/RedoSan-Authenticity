var path = require("path");
var helpers = require("./mpa_helpers.js");
var test = require("node:test");
var { prepareForC8 } = require("./e2e_coverage");
test.after(function () {
  helpers.stopServer();
  prepareForC8();
});
var files = [
  "mpa/mpa_home_test.js",
  "mpa/mpa_about_test.js",
  "mpa/mpa_privacy_test.js",
  "mpa/mpa_contact_test.js",
  "mpa/mpa_social_test.js",
  "mpa/mpa_search_test.js",
  "mpa/mpa_watermark_test.js",
  "mpa/mpa_audio_watermark_test.js",
  "mpa/mpa_fingerprint_test.js",
  "mpa/mpa_pixel_injection_test.js",
  "mpa/mpa_metadata_test.js",
  "mpa/mpa_timestamp_test.js",
  "mpa/mpa_did_test.js",
  "mpa/mpa_c2pa_test.js",
  "mpa/mpa_certificate_test.js",
  "mpa/mpa_forensic_test.js",
  "mpa/mpa_converter_test.js",
  "mpa/mpa_id_forge_test.js",
  "mpa/mpa_document_watermark_test.js",
  "mpa/mpa_face_test.js",
  "mpa/mpa_face_ui_test.js",
  "mpa/mpa_face_pipeline_test.js"
];
files.forEach(function(f) {
  require(path.resolve(__dirname, f));
});
