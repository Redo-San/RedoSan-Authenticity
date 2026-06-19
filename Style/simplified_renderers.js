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

/**
 *
 * @param body
 */
function renderUpload(body) {
  var socialVal = simpleUserInfo.social || {};
  var musicVal = simpleUserInfo.music || {};
  // Auto-detect country code on first visit
  if (!simpleUserInfo.phoneCode) {
    var detected = getDefaultPhoneCode();
    if (detected) simpleUserInfo.phoneCode = detected.dial;
  }
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.upload_title") +
    "</h2><p>" +
    __("simple.upload_desc") +
    "</p>" +
    '<div class="simple-upload-zone" id="simpleDropZone" onclick="document.getElementById(\'simpleFileInput\').click()">' +
    '<div class="dz-icon">📂</div>' +
    '<div class="dz-text">' +
    __("simple.drop_text") +
    "</div></div>" +
    '<input type="file" id="simpleFileInput" style="display:none" accept="image/*,video/*,.pdf,.mp3,.wav,.ogg,.aac,.wma,.flac,.m4a,.opus,.webm,.aiff,.au,.amr,.mid,.midi" onchange="simpleFileSelected(this)">' +
    '<div id="simpleFileInfo"></div>' +
    '<p style="font-size:0.72rem;color:var(--text-muted);margin:8px 0 0;padding:6px 8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __(
      "simple.upload_size_note",
      "💡 For watermarking, use a large cover image (e.g. 1920×1080) so there is enough capacity to embed a secret image.",
    ) +
    "</p>" +
    '<p style="font-size:0.7rem;color:var(--danger);margin:6px 0 0;padding:4px 8px;background:rgba(220,53,69,.08);border-radius:6px">' +
    __(
      "simple.usage_warning",
      "⚠️ This tool is for lawful use only. Uploading illegal or harmful content is strictly prohibited. All processing is local — nothing is stored or sent to any server.",
    ) +
    "</p>" +
    '<div class="simple-info-section" style="margin-top:20px;text-align:left">' +
    '<h3 style="font-size:1rem;margin:0 0 12px;color:var(--text-muted)">' +
    __("simple.info_title", "Owner Information") +
    "</h3>" +
    '<div class="form-group"><label for="sinfo-name">' +
    __("simple.info_name", "Full Name") +
    ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="text" id="sinfo-name" class="simple-info-field" placeholder="' +
    __("simple.info_name_ph", "e.g. John Doe") +
    '" value="' +
    escHtml(simpleUserInfo.name) +
    '" required maxlength="25"></div>' +
    '<div class="form-group"><label for="sinfo-email">' +
    __("simple.info_email", "Email") +
    ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="email" id="sinfo-email" class="simple-info-field" placeholder="' +
    __("simple.info_email_ph", "e.g. john@example.com") +
    '" value="' +
    escHtml(simpleUserInfo.email) +
    '" required maxlength="20" oninput="validateEmailInput(this)">' +
    '<span id="sinfo-email-warn" class="simple-field-warn" style="display:none">' +
    __("simple.email_invalid", "Please enter a valid email address") +
    "</span></div>" +
    '<div class="form-group"><label for="sinfo-phone">' +
    __("simple.info_phone", "Phone") +
    ' <span style="color:var(--danger)">*</span></label>' +
    '<div class="simple-phone-group">' +
    '<select id="sinfo-phonecode" onchange="updatePhoneMaxLength()">' +
    phoneCodeOptionsHtml(simpleUserInfo.phoneCode) +
    "</select>" +
    '<input type="tel" id="sinfo-phone" class="simple-info-field" maxlength="15" placeholder="' +
    __("simple.info_phone_ph", "e.g. 5xx xxx xxxx") +
    '" value="' +
    escHtml(simpleUserInfo.phone) +
    '" required oninput="validatePhoneInput(this)">' +
    "</div>" +
    '<span id="sinfo-phone-warn" class="simple-field-warn" style="display:none">' +
    __("simple.phone_digits_only", "Please enter numbers only") +
    "</span></div>" +
    '<div class="form-group"><label for="sinfo-website">' +
    __("simple.info_website", "Website") +
    ' <span style="color:var(--danger)">*</span></label>' +
    '<input type="url" id="sinfo-website" class="simple-info-field" placeholder="' +
    __("simple.info_website_ph", "e.g. https://example.com") +
    '" value="' +
    escHtml(simpleUserInfo.website || "https://") +
    '" required maxlength="30" oninput="validateUrlInput(this)" onfocus="prefixHttps(this)">' +
    '<span id="sinfo-website-warn" class="simple-field-warn" style="display:none">' +
    __(
      "simple.url_invalid",
      "Please enter a valid URL (e.g. https://example.com)",
    ) +
    "</span></div>" +
    '<h4 style="font-size:0.9rem;margin:14px 0 8px;color:var(--text-muted)">' +
    __("simple.info_social", "Social Links") +
    "</h4>" +
    '<div class="simple-social-grid">' +
    '<div><input type="url" id="sinfo-tiktok" placeholder="' +
    __("simple.ph_tiktok", "TikTok URL") +
    '" value="' +
    escHtml(socialVal.tiktok || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-tiktok-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-facebook" placeholder="' +
    __("simple.ph_facebook", "Facebook URL") +
    '" value="' +
    escHtml(socialVal.facebook || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-facebook-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-instagram" placeholder="' +
    __("simple.ph_instagram", "Instagram URL") +
    '" value="' +
    escHtml(socialVal.instagram || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-instagram-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-youtube" placeholder="' +
    __("simple.ph_youtube", "YouTube URL") +
    '" value="' +
    escHtml(socialVal.youtube || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-youtube-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    "</div>" +
    '<label class="simple-artist-check" style="display:flex;align-items:center;gap:8px;margin:14px 0 8px;cursor:pointer;font-size:0.9rem">' +
    '<input type="checkbox" id="sinfo-isArtist"' +
    (simpleUserInfo.isArtist ? " checked" : "") +
    ' onchange="toggleArtistFields()"> ' +
    __("simple.info_artist", "I am an artist / musician") +
    "</label>" +
    '<div id="sinfo-artist-fields" style="display:' +
    (simpleUserInfo.isArtist ? "" : "none") +
    '">' +
    '<h4 style="font-size:0.9rem;margin:0 0 8px;color:var(--text-muted)">' +
    __("simple.info_music", "Music Platforms") +
    "</h4>" +
    '<div class="simple-social-grid">' +
    '<div><input type="url" id="sinfo-spotify" placeholder="' +
    __("simple.ph_spotify", "Spotify URL") +
    '" value="' +
    escHtml(musicVal.spotify || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-spotify-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-applemusic" placeholder="' +
    __("simple.ph_applemusic", "Apple Music URL") +
    '" value="' +
    escHtml(musicVal.appleMusic || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-applemusic-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-ytmusic" placeholder="' +
    __("simple.ph_ytmusic", "YouTube Music URL") +
    '" value="' +
    escHtml(musicVal.youtubeMusic || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-ytmusic-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-soundcloud" placeholder="' +
    __("simple.ph_soundcloud", "SoundCloud URL") +
    '" value="' +
    escHtml(musicVal.soundcloud || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-soundcloud-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" id="sinfo-bandcamp" placeholder="' +
    __("simple.ph_bandcamp", "Bandcamp URL") +
    '" value="' +
    escHtml(musicVal.bandcamp || "") +
    '" maxlength="80" oninput="validateSocialInput(this)"><span id="sinfo-bandcamp-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    "</div></div></div></div>";
  setupSimpleDropZone();
  if (simpleFile) restoreUploadFileInfo();
}

/**
 *
 * @param body
 */
function renderAiQuestion(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.ai_title") +
    "</h2><p>" +
    __("simple.ai_desc") +
    "</p>" +
    '<div class="simple-ai-options">' +
    '<div class="simple-ai-card" onclick="chooseAi(false)"><span class="ai-icon">📸</span><h3>' +
    __("simple.ai_regular") +
    "</h3><p>" +
    __("simple.ai_regular_desc") +
    "</p></div>" +
    '<div class="simple-ai-card" onclick="chooseAi(true)"><span class="ai-icon">🤖</span><h3>' +
    __("simple.ai_generated") +
    "</h3><p>" +
    __("simple.ai_generated_desc") +
    "</p></div>" +
    "</div></div>";
}

/**
 *
 * @param body
 */
function renderC2paStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.c2pa_title") +
    "</h2><p>" +
    __("simple.c2pa_desc") +
    "</p>" +
    '<div id="sc2pa-content" style="text-align:left">' +
    // Content type cards
    '<div class="form-group"><span>' +
    __("c2pa.content_type_label") +
    "</span>" +
    '<div id="sc2pa-write-types">' +
    '<div class="c2pa-type-card" data-form-type="create">' +
    '<label class="c2pa-type-header" for="sc2pa-create">' +
    '<input type="checkbox" id="sc2pa-create" value="create">' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_digital") +
    "</span></label>" +
    '<div class="c2pa-type-fields">' +
    '<input type="text" class="sc2pa-field" data-field="title" data-type="create" placeholder="' +
    __("c2pa.title_label") +
    '">' +
    '<input type="text" class="sc2pa-field" data-field="author" data-type="create" placeholder="' +
    __("c2pa.author_label") +
    '">' +
    "</div></div>" +
    '<div class="c2pa-type-card" data-form-type="edit">' +
    '<label class="c2pa-type-header" for="sc2pa-edit">' +
    '<input type="checkbox" id="sc2pa-edit" value="edit">' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_edited") +
    "</span></label>" +
    '<div class="c2pa-type-fields">' +
    '<input type="text" class="sc2pa-field" data-field="title" data-type="edit" placeholder="' +
    __("c2pa.title_label") +
    '">' +
    '<input type="text" class="sc2pa-field" data-field="author" data-type="edit" placeholder="' +
    __("c2pa.author_label") +
    '">' +
    "</div></div>" +
    '<div class="c2pa-type-card" data-form-type="ai" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia">' +
    '<label class="c2pa-type-header" for="sc2pa-ai">' +
    '<input type="checkbox" id="sc2pa-ai" value="ai" checked>' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_ai") +
    "</span></label>" +
    '<div class="c2pa-type-fields">' +
    '<input type="text" class="sc2pa-field" data-field="title" data-type="ai" placeholder="' +
    __("c2pa.title_label") +
    '">' +
    '<input type="text" class="sc2pa-field" data-field="author" data-type="ai" placeholder="' +
    __("c2pa.author_label") +
    '">' +
    "</div></div>" +
    '<div class="c2pa-type-card" data-form-type="capture" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture">' +
    '<label class="c2pa-type-header" for="sc2pa-capture">' +
    '<input type="checkbox" id="sc2pa-capture" value="capture">' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_capture") +
    "</span></label>" +
    '<div class="c2pa-type-fields">' +
    '<input type="text" class="sc2pa-field" data-field="title" data-type="capture" placeholder="' +
    __("c2pa.title_label") +
    '">' +
    '<input type="text" class="sc2pa-field" data-field="author" data-type="capture" placeholder="' +
    __("c2pa.author_label") +
    '">' +
    "</div></div>" +
    '<div class="c2pa-type-card" data-form-type="composite" data-c2pa-src="http://cv.iptc.org/newscodes/digitalsourcetype/composite">' +
    '<label class="c2pa-type-header" for="sc2pa-composite">' +
    '<input type="checkbox" id="sc2pa-composite" value="composite">' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_composite") +
    "</span></label>" +
    '<div class="c2pa-type-fields">' +
    '<input type="text" class="sc2pa-field" data-field="title" data-type="composite" placeholder="' +
    __("c2pa.title_label") +
    '">' +
    '<input type="text" class="sc2pa-field" data-field="author" data-type="composite" placeholder="' +
    __("c2pa.author_label") +
    '">' +
    "</div></div>" +
    '<div class="c2pa-type-card dnt-card">' +
    '<label class="c2pa-type-header" for="sc2pa-dnt">' +
    '<input type="checkbox" id="sc2pa-dnt">' +
    '<span class="c2pa-type-name">' +
    __("c2pa.type_dnt") +
    "</span></label></div>" +
    "</div></div>" +
    // Social links
    '<div class="form-group"><span>' +
    __("simple.c2pa_social_label") +
    "</span>" +
    '<div class="c2pa-links-grid">' +
    '<div><input type="url" class="sc2pa-link" data-platform="instagram" placeholder="' +
    __("simple.c2pa_instagram", "Instagram URL") +
    '" id="sc2pa-link-instagram" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-instagram-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="twitter" placeholder="' +
    __("simple.c2pa_twitter", "Twitter / X URL") +
    '" id="sc2pa-link-twitter" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-twitter-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="facebook" placeholder="' +
    __("simple.c2pa_facebook", "Facebook URL") +
    '" id="sc2pa-link-facebook" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-facebook-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="tiktok" placeholder="' +
    __("simple.c2pa_tiktok", "TikTok URL") +
    '" id="sc2pa-link-tiktok" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-tiktok-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="youtube" placeholder="' +
    __("simple.c2pa_youtube", "YouTube URL") +
    '" id="sc2pa-link-youtube" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-youtube-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="website" placeholder="' +
    __("simple.c2pa_website", "Website URL") +
    '" id="sc2pa-link-website" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-website-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    "</div></div>" +
    // Music links
    '<div class="form-group"><span>' +
    __("simple.c2pa_music_label", "Music Streaming (optional)") +
    "</span>" +
    '<div class="c2pa-links-grid">' +
    '<div><input type="url" class="sc2pa-link" data-platform="spotify" placeholder="' +
    __("simple.c2pa_spotify", "Spotify URL") +
    '" id="sc2pa-link-spotify" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-spotify-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="applemusic" placeholder="' +
    __("simple.c2pa_applemusic", "Apple Music URL") +
    '" id="sc2pa-link-applemusic" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-applemusic-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="soundcloud" placeholder="' +
    __("simple.c2pa_soundcloud", "SoundCloud URL") +
    '" id="sc2pa-link-soundcloud" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-soundcloud-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    '<div><input type="url" class="sc2pa-link" data-platform="bandcamp" placeholder="' +
    __("simple.c2pa_bandcamp", "Bandcamp URL") +
    '" id="sc2pa-link-bandcamp" maxlength="80" oninput="validateC2paLink(this)"><span id="sc2pa-link-bandcamp-warn" class="simple-field-warn" style="display:none">' +
    __("simple.url_invalid", "Please enter a valid URL") +
    "</span></div>" +
    "</div></div>" +
    '<button class="btn" onclick="runC2paStep()" id="sc2pa-btn">' +
    __("simple.c2pa_btn") +
    "</button>" +
    '<div id="sc2pa-result"></div></div>';
}

/**
 *
 * @param body
 */
function renderWatermarkStep(body) {
  var usingName = simpleFile ? simpleFile.name : "";
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.watermark_title") +
    "</h2><p>" +
    __("simple.watermark_desc") +
    "</p>" +
    '<p style="font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left">' +
    __("simple.using_file").replace("{name}", escapeHtml(usingName)) +
    "</p>" +
    '<div class="card-form" style="text-align:left">' +
    '<div class="form-group"><label for="swm-type">' +
    __("simple.wm_algo_label", "Algorithm") +
    "</label>" +
    '<select id="swm-type">' +
    '  <option value="2">2. Frequency DCT</option>' +
    '  <option value="4">4. Latent DCT</option>' +
    '  <option value="7">7. Forensic</option>' +
    '  <option value="9">9. Imatag-style</option>' +
    "</select></div>" +
    '<div class="form-group"><label for="swm-password">' +
    __("simple.wm_pass_label", "Password") +
    "</label>" +
    '<input type="password" id="swm-password" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)"></div>' +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin:8px 0;padding:8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __(
      "simple.wm_fp_payload",
      "🔐 The fingerprint hash will be embedded as the secret message.",
    ) +
    "</p>" +
    "</div>" +
    '<button class="btn" onclick="runWatermarkStep()" id="swm-btn">' +
    __("simple.watermark_btn", "Embed Watermark") +
    "</button>" +
    '<div id="swm-status"></div></div>';
}

/**
 *
 * @param body
 */
function renderAudioWatermarkStep(body) {
  var usingName = simpleFile ? simpleFile.name : "";
  var fpSummary = "";
  if (simpleResults.fpResult && simpleResults.fpResult.hashes) {
    var h = simpleResults.fpResult.hashes;
    var hashKeys = Object.keys(h);
    var hashCount = hashKeys.length;
    fpSummary = hashCount + " hashes (";
    var shortList = ["SHA-256", "SHA-512", "BLAKE3", "SHA-1"];
    for (const element of shortList) {
      if (h[element]) {
        fpSummary +=
          element + ": " + h[element].substring(0, 8) + "… ";
      }
    }
    fpSummary = fpSummary.trim() + ")";
  }
  var tsSummary = simpleResults.tsResult
    ? simpleResults.tsResult.substring(0, 100).replaceAll('\n', " ")
    : "";
  body.innerHTML =
    '<div class="simple-card"><h2>Audio Watermarking</h2><p>Embed both the fingerprint and DID signature as hidden watermarks in your audio. Choose one algorithm for each.</p>' +
    '<p style="font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left">Using: ' +
    escapeHtml(usingName) +
    "</p>" +
    '<div class="card-form" style="text-align:left">' +
    '<div class="form-group"><label for="sawm-fp-type">Algorithm for Fingerprint <span style="font-size:0.72rem;color:var(--text-muted)">(high capacity)</span></label>' +
    '<select id="sawm-fp-type">' +
    '  <option value="1">1. LSB Audio</option>' +
    '  <option value="2">2. FFT-QIM</option>' +
    '  <option value="5">3. QIM</option>' +
    '  <option value="6">4. DWT (Haar Wavelet)</option>' +
    '  <option value="8" selected>5. DCT-based (Recommended)</option>' +
    "</select></div>" +
    '<div class="form-group"><label for="sawm-ts-type">Algorithm for DID Signature (right channel)</label>' +
    '<select id="sawm-ts-type">' +
    '  <option value="2">1. FFT-QIM</option>' +
    '  <option value="6">2. DWT (Haar Wavelet)</option>' +
    '  <option value="8" selected>3. DCT-based (Recommended)</option>' +
    "</select></div>" +
    '<div class="form-group"><label for="sawm-password">Password</label>' +
    '<input type="password" id="sawm-password" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)"></div>' +
    '<div class="form-group" id="sawm-strength-group">' +
    '<label for="sawm-strength">Strength <span id="sawm-strength-val">400</span></label>' +
    '<input type="range" id="sawm-strength" min="100" max="3000" value="400" step="100" oninput="document.getElementById(\'sawm-strength-val\').textContent=this.value"></div>' +
    '<div style="font-size:0.78rem;color:var(--text-muted);margin:8px 0;padding:8px;background:rgba(108,92,231,.1);border-radius:6px;text-align:left">' +
    '<p><strong>🔐 Fingerprint payload:</strong><br><span style="word-break:break-all">' +
    escapeHtml(fpSummary) +
    "</span></p>" +
    '<p style="margin-top:6px"><strong>🕒 Timestamp payload:</strong><br><span style="word-break:break-all">' +
    escapeHtml(tsSummary) +
    "</span></p>" +
    '<p style="margin-top:6px">Your audio will be watermarked with both layers simultaneously.</p></div>' +
    "</div>" +
    '<button class="btn" onclick="runAudioWatermarkStep()" id="sawm-btn">Embed Both Watermarks</button>' +
    '<div id="sawm-status"></div>' +
    '<div id="sawm-progress" style="display:none;margin-top:12px">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
    '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">' +
    '<div id="sawm-progress-fill" style="height:100%;width:0%;background:var(--primary);border-radius:3px;transition:width .15s ease"></div></div>' +
    '<span id="sawm-progress-text" style="font-size:0.75rem;color:var(--text-muted);min-width:3em;text-align:right">0%</span></div></div></div>';
}

/**
 *
 * @param body
 */
function renderPixelInjectStep(body) {
  var usingName = simpleFile ? simpleFile.name : "";
  var catOpts = "";
  var cats =
    globalThis.pixelInjection && globalThis.pixelInjection.algorithms
      ? globalThis.pixelInjection.algorithms
      : { spatial: { enhanced_lsb: { name: "Enhanced LSB" } } };
  var catKeys = Object.keys(cats);
  for (const catKey of catKeys) {
    if (catKey === "detection") continue;
    var label =
      catKey.charAt(0).toUpperCase() +
      catKey.slice(1).replaceAll('_', " ");
    catOpts += '<option value="' + catKey + '">' + label + "</option>";
  }
  var defaultCat =
    catKeys[0] === "detection" ? catKeys[1] || catKeys[0] : catKeys[0];
  var algoOpts = getPiAlgoOptions(cats, defaultCat);

  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.pi_title") +
    "</h2><p>" +
    __("simple.pi_desc") +
    "</p>" +
    '<p style="font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left">' +
    __("simple.using_file").replace("{name}", escapeHtml(usingName)) +
    "</p>" +
    '<div class="card-form" style="text-align:left">' +
    '<div class="form-group"><label for="spi-category">' +
    __("simple.pi_category_label", "Category") +
    "</label>" +
    '<select id="spi-category" onchange="updateSpiAlgorithms()">' +
    catOpts +
    "</select></div>" +
    '<div class="form-group"><label for="spi-algorithm">' +
    __("simple.pi_algo_label", "Algorithm") +
    "</label>" +
    '<select id="spi-algorithm">' +
    algoOpts +
    "</select></div>" +
    '<div class="form-group"><label for="spi-password">' +
    __("simple.wm_pass_label", "Password") +
    "</label>" +
    '<input type="password" id="spi-password" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)"></div>' +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin:8px 0;padding:8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __(
      "simple.pi_did_info",
      "🆔 The DID signature will be injected as the secret message.",
    ) +
    "</p>" +
    "</div>" +
    '<button class="btn" onclick="runPixelInjectStep()" id="spi-btn">' +
    __("simple.pi_btn", "Inject Message") +
    "</button>" +
    '<div id="spi-status"></div></div>';
}

/**
 *
 * @param body
 */
function renderTimestampStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.ts_title") +
    "</h2><p>" +
    __("simple.ts_desc") +
    "</p>" +
    '<div id="sts-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p>' +
    __("simple.processing") +
    "</p></div></div>";
  runTimestampStep();
}

/**
 *
 * @param body
 */
function renderFingerprintStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.fp_title") +
    "</h2><p>" +
    __("simple.fp_desc") +
    "</p>" +
    '<p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 12px;padding:8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __(
      "simple.fp_processing_note",
      "⏳ Computing multiple hash algorithms. This may take a moment for large files.",
    ) +
    "</p>" +
    '<div id="sfp-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p id="sfp-status">' +
    __("simple.processing") +
    "</p></div></div>";
  runFingerprintStep();
}

/**
 *
 * @param body
 */
function renderDIDStep(body) {
  var hasKeys = didLoadKeys() !== null;
  var algos = didGetAlgorithmList();
  var algoOpts = "";
  for (var label of algos) {
    switch (label) {
    case "Ed25519": {
    label += " (fast, 64-byte sig)";
    break;
    }
    case "P-256": {
    label += " (widely compatible)";
    break;
    }
    case "RSA-2048": {
    label += " (256-byte sig)";
    break;
    }
    case "RSA-4096": { {
    label += " (512-byte sig)";
    // No default
    }
    break;
    }
    }
    algoOpts += '<option value="' + label + '">' + label + "</option>";
  }
  body.innerHTML =
    '<div class="simple-card"><h2>' +
    __("simple.did_title", "Decentralized Identity") +
    "</h2><p>" +
    __(
      "simple.did_desc",
      "Sign your file fingerprint with a Decentralized Identifier (DID). This cryptographically proves you created this content.",
    ) +
    "</p>" +
    '<div style="text-align:left">' +
    '<div id="sdid-status-area">' +
    (hasKeys
      ? '<p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">' +
        __(
          "simple.did_keys_exist",
          "Existing DID identity found. You can Sign or Generate a new one.",
        ) +
        "</p>"
      : '<p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">' +
        __(
          "simple.did_no_keys",
          "No DID identity found. Generate a new one below.",
        ) +
        "</p>") +
    "</div>" +
    '<div style="display:flex;align-items:center;gap:8px;margin:10px 0;flex-wrap:wrap">' +
    '<label for="sdid-algo-select" style="font-size:0.82rem;font-weight:600">' +
    __("did.algo_label", "Algorithm:") +
    "</label>" +
    '<select id="sdid-algo-select">' +
    algoOpts +
    "</select></div>" +
    '<button class="btn" onclick="runDIDStepGenerate()" id="sdid-gen-btn" style="margin-right:8px">' +
    __("simple.did_gen_btn", "🔑 Generate DID Identity") +
    "</button>" +
    '<button class="btn" onclick="runDIDStepSign()" id="sdid-sign-btn"' +
    (hasKeys ? "" : " disabled") +
    ">" +
    __("simple.did_sign_btn", "✍️ Sign &amp; Verify") +
    "</button>" +
    '<div id="sdid-result" style="margin-top:12px"></div>' +
    '<div id="sdid-status" style="margin-top:8px;font-size:0.82rem;color:var(--text-muted)"></div>' +
    "</div></div>";
}

/**
 *
 * @param body
 */
function renderDone(body) {
  var results = simpleResults;
  var sections = [];

  if (results.c2pa && results.c2paUrl) {
    sections.push(
      '<div class="simple-done-section"><h3>' +
        __("simple.final_image_title", "Final Image") +
        "</h3>" +
        '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
        __(
          "simple.c2pa_final_desc",
          "C2PA-signed — watermark + timestamp injected + AI provenance.",
        ) +
        "</p>" +
        '<img src="' +
        results.c2paUrl +
        '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
        '<a href="' +
        results.c2paUrl +
        '" download="signed.png" class="btn" style="background:var(--primary);color:#fff">' +
        __("simple.final_dl_btn", "📥 Download Final Image") +
        "</a></div>",
    );
  } else if (results["pixel-injection"] && results.piFinalUrl) {
    sections.push(
      '<div class="simple-done-section"><h3>' +
        __("simple.final_image_title", "Final Image") +
        "</h3>" +
        '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
        __(
          "simple.final_image_desc",
          "Watermark + secret message — one image. Use Professional mode to extract both.",
        ) +
        "</p>" +
        '<img src="' +
        results.piFinalUrl +
        '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
        '<a href="' +
        results.piFinalUrl +
        '" download="protected.png" class="btn" style="background:var(--primary);color:#fff">' +
        __("simple.final_dl_btn", "📥 Download Final Image") +
        "</a></div>",
    );
  } else if (results.watermark && results.watermarkUrl) {
    sections.push(
      '<div class="simple-done-section"><h3>' +
        __("simple.watermarked_label") +
        "</h3>" +
        '<img src="' +
        results.watermarkUrl +
        '" onclick="openLightbox(this.src)" style="max-width:100%;max-height:240px;border-radius:6px;cursor:zoom-in;margin-bottom:10px;display:block">' +
        '<a href="' +
        results.watermarkUrl +
        '" download="watermarked.jpg" class="btn">' +
        __("simple.watermark_dl_btn") +
        "</a></div>",
    );
  }

  if (results.audioWatermark && results.audioWatermarkUrl) {
    var algoNames = {
      1: "LSB Audio",
      2: "FFT-QIM",
      3: "Echo Hiding",
      4: "DSSS",
      5: "QIM",
      6: "DWT",
      7: "Patchwork",
      8: "DCT-based",
    };
    var fpName =
      algoNames[results.audioWatermarkFpAlgo] ||
      "Algo " + results.audioWatermarkFpAlgo;
    var tsName =
      algoNames[results.audioWatermarkTsAlgo] ||
      "Algo " + results.audioWatermarkTsAlgo;
    sections.push(
      '<div class="simple-done-section"><h3>Protected Audio</h3>' +
        '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
        "Fingerprint: <strong>" +
        fpName +
        "</strong> &nbsp;|&nbsp; Timestamp: <strong>" +
        tsName +
        "</strong></p>" +
        '<audio controls style="width:100%;max-width:400px;display:block;margin-bottom:10px">' +
        '<source src="' +
        results.audioWatermarkUrl +
        '" type="audio/wav"></audio>' +
        '<a href="' +
        results.audioWatermarkUrl +
        '" download="' +
        escapeHtml(results.audioWatermarkFilename || "protected_audio.wav") +
        '" class="btn" style="background:var(--primary);color:#fff">📥 Download Protected Audio</a></div>',
    );
  }

  if (results.timestamp) {
    var tsHtml =
      '<div class="simple-done-section"><h3>' + __("simple.ts_label") + "</h3>";
    if (results.tsResult)
      tsHtml +=
        '<pre style="white-space:pre-wrap;word-break:break-all;font-size:0.78rem;background:var(--bg);padding:8px;border-radius:6px;margin:8px 0">' +
        escapeHtml(results.tsResult) +
        "</pre>";
    if (results.tsHtml)
      tsHtml += '<div style="margin-top:8px">' + results.tsHtml + "</div>";
    tsHtml += "</div>";
    sections.push(tsHtml);
  }

  if (results.fingerprint) {
    var fpHtml =
      '<div class="simple-done-section"><h3>' + __("simple.fp_label") + "</h3>";
    fpHtml += '<div style="margin-top:12px">';
    fpHtml +=
      '<button class="btn" onclick="setupFpDownload();showDownloadModal()">' +
      __("simple.fp_dl_btn") +
      "</button>";
    fpHtml += "</div></div>";
    sections.push(fpHtml);
  }

  if (results.c2pa && !results.c2paUrl) {
    sections.push(
      '<div class="simple-done-section"><h3>' +
        __("simple.c2pa_label") +
        "</h3><p>" +
        __("simple.c2pa_done_desc") +
        "</p></div>",
    );
  }

  if (results.didSig || results.didIdentity) {
    var didHtml =
      '<div class="simple-done-section"><h3>' +
      __("simple.did_title", "Decentralized Identity") +
      "</h3>";
    if (results.didSig) {
      didHtml +=
        '<pre style="white-space:pre-wrap;word-break:break-all;font-size:0.75rem;background:var(--bg);padding:8px;border-radius:6px;margin:8px 0">' +
        "DID: " +
        escapeHtml(results.didSig.did) +
        "\n" +
        "Algorithm: " +
        escapeHtml(results.didSig.algorithm || "Ed25519") +
        "\n" +
        "Signed: " +
        escapeHtml(
          (results.didSig.timestamp || "").replace("T", " ").substring(0, 19),
        ) +
        "</pre>";
    } else if (results.didIdentity) {
      didHtml +=
        '<pre style="white-space:pre-wrap;word-break:break-all;font-size:0.75rem;background:var(--bg);padding:8px;border-radius:6px;margin:8px 0">' +
        "DID: " +
        escapeHtml(results.didIdentity) +
        "</pre>";
    }
    didHtml += '<div style="margin-top:12px">';
    didHtml +=
      '<button class="btn" onclick="setupDidDownload();showDownloadModal()">' +
      __("simple.did_dl_btn", "📥 Download DID") +
      "</button>";
    didHtml += "</div></div>";
    sections.push(didHtml);
  }

  // Certificate download section
  var hasAnyResult =
    results.watermark ||
    results["pixel-injection"] ||
    results.audioWatermark ||
    results.timestamp ||
    results.fingerprint ||
    results.c2pa ||
    results.didSig;
  if (hasAnyResult) {
    var certType = simpleType || "other";
    var certDescKey = "simple.cert_desc_" + certType;
    var certDescFallback = {
      image:
        "Download a signed document with all results, image preview, and QR verification code.",
      audio:
        "Download a signed document with all results, audio player preview, and QR verification code.",
      video:
        "Download a signed document with all results, video preview, and QR verification code.",
      other:
        "Download a signed document with all results and QR verification code.",
    }[certType];
    sections.push(
      '<div class="simple-done-section simple-cert-section">' +
        "<h3>" +
        __("simple.cert_title", "Digital Passport") +
        "</h3>" +
        '<p style="font-size:0.82rem;color:var(--text-muted);margin:4px 0 12px">' +
        __(certDescKey, certDescFallback) +
        "</p>" +
        '<div class="simple-cert-btns">' +
        '<button class="btn cert-btn" onclick="downloadCert(\'pdf\', this)" style="background:#d32f2f;color:#fff">📄 PDF</button>' +
        '<button class="btn cert-btn" onclick="downloadCert(\'docx\', this)" style="background:#2b579a;color:#fff">📝 DOCX</button>' +
        '<button class="btn cert-btn" onclick="downloadCert(\'epub\', this)" style="background:#7ab55c;color:#fff">📖 EPUB</button>' +
        '<button class="btn cert-btn" id="cert-ots-dl-btn" onclick="downloadCertOtsProof()" style="background:#666;color:#fff;display:none;margin-top:8px">🛡️ Certificate .OTS Proof</button>' +
        "</div></div>",
    );
  }

  var mainHtml =
    '<div class="simple-card simple-done"><h2>' +
    __("simple.done_title") +
    "</h2>" +
    "<p>" +
    __("simple.done_desc") +
    "</p>" +
    '<div class="simple-results-list">' +
    sections.join("") +
    "</div>" +
    '<div class="simple-done-actions">' +
    '<button class="btn" onclick="restartSimple()">' +
    __("simple.done_restart") +
    "</button>" +
    '<button class="btn" onclick="switchMode()">' +
    __("simple.done_switch") +
    "</button>" +
    "</div></div>";

  body.innerHTML = mainHtml;
  document.querySelector("#simplePrevBtn").style.display = "none";
  document.querySelector("#simpleNextBtn").textContent =
    __("simple.start_over");
}
