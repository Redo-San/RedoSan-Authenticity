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
  name: '', email: '', phone: '', website: '',
  social: { tiktok: '', facebook: '', instagram: '', youtube: '' },
  isArtist: false,
  music: { spotify: '', appleMusic: '', youtubeMusic: '', soundcloud: '', bandcamp: '' }
};

function initMode() {
  var mode = localStorage.getItem('redosan_mode');
  if (mode === 'simplified') setMode('simplified');
  else if (mode === 'professional') setMode('professional');
}

function setMode(mode) {
  if (document.getElementById('rememberMode').checked)
    localStorage.setItem('redosan_mode', mode);
  document.getElementById('modeSelect').style.display = 'none';
  if (mode === 'simplified') {
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('sidebarOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('mainFooter').style.display = 'none';
    document.getElementById('simplifiedMode').style.display = '';
    initSimplified();
  }
}

function switchMode() {
  // Show mode overlay without page reload (keeps music playing)
  document.getElementById('modeSelect').style.display = '';
  document.getElementById('simplifiedMode').style.display = 'none';
  document.getElementById('mainNav').style.display = '';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('sidebarOverlay').style.display = '';
  document.getElementById('app').style.display = '';
  document.getElementById('mainFooter').style.display = '';
  localStorage.removeItem('redosan_mode');
  // Reset to home page
  showPage('home');
}

function showModeSelect() {
  // Show mode overlay without page reload (keeps music playing)
  document.getElementById('modeSelect').style.display = '';
  document.getElementById('simplifiedMode').style.display = 'none';
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('sidebarOverlay').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('mainFooter').style.display = 'none';
  localStorage.removeItem('redosan_mode');
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
    if (isAI) s.push({ id: 'c2pa', label: __('simple.step_c2pa', 'C2PA') });
    s.push({ id: 'watermark', label: __('simple.step_watermark', 'Watermark') });
    s.push({ id: 'pixel-injection', label: __('simple.step_inject', 'Inject') });
  }
  s.push({ id: 'timestamp', label: __('simple.step_timestamp', 'Timestamp') });
  s.push({ id: 'fingerprint', label: __('simple.step_fingerprint', 'Fingerprint') });
  s.push({ id: 'done', label: __('simple.step_done', 'Done') });
  return s;
}

// ── Init & render ──

function initSimplified() {
  simpleFile = null; simpleBuf = null; simpleType = null;
  simpleIsAI = false; simpleStep = 0; simpleSteps = [];
  simpleResults = {};
  simpleUserInfo = {
    name: '', email: '', phone: '', website: '',
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
  if (step.id === 'upload') saveSimpleUserInfo();
  // Timestamp/fingerprint must complete before advancing
  if ((step.id === 'timestamp' || step.id === 'fingerprint') && !simpleStepDone) return;
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

// ── Step renderers ──

function renderUpload(body) {
  var socialVal = simpleUserInfo.social || {};
  var musicVal = simpleUserInfo.music || {};
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.upload_title') + '</h2><p>' + __('simple.upload_desc') + '</p>' +
    '<div class="simple-upload-zone" id="simpleDropZone" onclick="document.getElementById(\'simpleFileInput\').click()">' +
    '<div class="dz-icon">📂</div>' +
    '<div class="dz-text">' + __('simple.drop_text') + '</div></div>' +
    '<input type="file" id="simpleFileInput" style="display:none" accept="image/*,audio/*,video/*,.pdf" onchange="simpleFileSelected(this)">' +
    '<div id="simpleFileInfo"></div>' +
    '<p style="font-size:0.72rem;color:var(--text-muted);margin:8px 0 0;padding:6px 8px;background:rgba(108,92,231,.1);border-radius:6px">' +
    __('simple.upload_size_note', '💡 For watermarking, use a large cover image (e.g. 1920×1080) so there is enough capacity to embed a secret image.') + '</p>' +
    '<div class="simple-info-section" style="margin-top:20px;text-align:left">' +
    '<h3 style="font-size:1rem;margin:0 0 12px;color:var(--text-muted)">' + __('simple.info_title', 'Owner Information (optional)') + '</h3>' +
    '<div class="form-group"><label>' + __('simple.info_name', 'Full Name') + '</label>' +
    '<input type="text" id="sinfo-name" class="simple-info-field" placeholder="' + __('simple.info_name_ph', 'e.g. John Doe') + '" value="' + escHtml(simpleUserInfo.name) + '"></div>' +
    '<div class="form-group"><label>' + __('simple.info_email', 'Email') + '</label>' +
    '<input type="email" id="sinfo-email" class="simple-info-field" placeholder="' + __('simple.info_email_ph', 'e.g. john@example.com') + '" value="' + escHtml(simpleUserInfo.email) + '"></div>' +
    '<div class="form-group"><label>' + __('simple.info_phone', 'Phone') + '</label>' +
    '<input type="tel" id="sinfo-phone" class="simple-info-field" placeholder="' + __('simple.info_phone_ph', 'e.g. +1 234 567 890') + '" value="' + escHtml(simpleUserInfo.phone) + '"></div>' +
    '<div class="form-group"><label>' + __('simple.info_website', 'Website') + '</label>' +
    '<input type="url" id="sinfo-website" class="simple-info-field" placeholder="' + __('simple.info_website_ph', 'e.g. https://example.com') + '" value="' + escHtml(simpleUserInfo.website) + '"></div>' +
    '<h4 style="font-size:0.9rem;margin:14px 0 8px;color:var(--text-muted)">' + __('simple.info_social', 'Social Links') + '</h4>' +
    '<div class="simple-social-grid">' +
    '<input type="url" id="sinfo-tiktok" placeholder="TikTok URL" value="' + escHtml(socialVal.tiktok || '') + '">' +
    '<input type="url" id="sinfo-facebook" placeholder="Facebook URL" value="' + escHtml(socialVal.facebook || '') + '">' +
    '<input type="url" id="sinfo-instagram" placeholder="Instagram URL" value="' + escHtml(socialVal.instagram || '') + '">' +
    '<input type="url" id="sinfo-youtube" placeholder="YouTube URL" value="' + escHtml(socialVal.youtube || '') + '">' +
    '</div>' +
    '<label class="simple-artist-check" style="display:flex;align-items:center;gap:8px;margin:14px 0 8px;cursor:pointer;font-size:0.9rem">' +
    '<input type="checkbox" id="sinfo-isArtist"' + (simpleUserInfo.isArtist ? ' checked' : '') + ' onchange="toggleArtistFields()"> ' +
    __('simple.info_artist', 'I am an artist / musician') +
    '</label>' +
    '<div id="sinfo-artist-fields" style="display:' + (simpleUserInfo.isArtist ? '' : 'none') + '">' +
    '<h4 style="font-size:0.9rem;margin:0 0 8px;color:var(--text-muted)">' + __('simple.info_music', 'Music Platforms') + '</h4>' +
    '<div class="simple-social-grid">' +
    '<input type="url" id="sinfo-spotify" placeholder="Spotify URL" value="' + escHtml(musicVal.spotify || '') + '">' +
    '<input type="url" id="sinfo-applemusic" placeholder="Apple Music URL" value="' + escHtml(musicVal.appleMusic || '') + '">' +
    '<input type="url" id="sinfo-ytmusic" placeholder="YouTube Music URL" value="' + escHtml(musicVal.youtubeMusic || '') + '">' +
    '<input type="url" id="sinfo-soundcloud" placeholder="SoundCloud URL" value="' + escHtml(musicVal.soundcloud || '') + '">' +
    '<input type="url" id="sinfo-bandcamp" placeholder="Bandcamp URL" value="' + escHtml(musicVal.bandcamp || '') + '">' +
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

function simpleFileSelected(input) {
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
  simpleStep = simpleSteps.findIndex(function(s) { return s.id === (isAI ? 'c2pa' : 'watermark'); });
  renderStep();
}

function renderC2paStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.c2pa_title') + '</h2><p>' + __('simple.c2pa_desc') + '</p>' +
    '<div class="form-group"><label>' + __('simple.c2pa_content_label') + '</label>' +
    '<div class="c2pa-type-card" style="margin-bottom:8px">' +
    '<div class="c2pa-type-header"><input type="checkbox" id="sc2pa-ai" checked disabled>' +
    '<label for="sc2pa-ai">' + __('simple.c2pa_ai_label') + '</label></div></div></div>' +
    '<div class="form-group"><label>' + __('simple.c2pa_social_label') + '</label>' +
    '<input class="c2pa-link" placeholder="' + __('simple.c2pa_instagram') + '" id="sc2pa-instagram">' +
    '<input class="c2pa-link" placeholder="' + __('simple.c2pa_twitter') + '" id="sc2pa-twitter">' +
    '<input class="c2pa-link" placeholder="' + __('simple.c2pa_website') + '" id="sc2pa-website"></div>' +
    '<button class="btn" onclick="runC2paStep()" id="sc2pa-btn">' + __('simple.c2pa_btn') + '</button>' +
    '<div id="sc2pa-result"></div></div>';
}

function runC2paStep() {
  if (!window.handleC2paWrite) return;
  // Populate the real C2PA write form with simplified values, then call handleC2paWrite
  // Set AI checkbox in the real C2PA write tab
  var aiCheckbox = document.querySelector('#c2pa-write input[value="c2pa.ai_generated"]');
  if (aiCheckbox) aiCheckbox.checked = true;
  var insta = document.getElementById('sc2pa-instagram');
  var twitter = document.getElementById('sc2pa-twitter');
  var website = document.getElementById('sc2pa-website');
  var realInsta = document.querySelector('.c2pa-link[placeholder*="Instagram"]');
  var realTwitter = document.querySelector('.c2pa-link[placeholder*="Twitter"]');
  var realWebsite = document.querySelector('.c2pa-link[placeholder*="Website"]');
  if (realInsta && insta.value) realInsta.value = insta.value;
  if (realTwitter && twitter.value) realTwitter.value = twitter.value;
  if (realWebsite && website.value) realWebsite.value = website.value;
  // Set the file input
  var fileInput = document.getElementById('c2pa-write-file');
  if (fileInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    fileInput.files = dt.files;
    // Trigger file drop zone update
    var evt = new Event('change');
    fileInput.dispatchEvent(evt);
  }
  var btn = document.getElementById('sc2pa-btn');
  btn.disabled = true; btn.textContent = __('simple.signing');
  handleC2paWrite().then(function() {
    btn.textContent = __('simple.signed');
    simpleResults.c2pa = true;
    // Wait a moment then go next
    setTimeout(simpleNext, 1000);
  }).catch(function() {
    btn.textContent = __('simple.failed_retry');
    btn.disabled = false;
  });
}

function renderWatermarkStep(body) {
  // Copy professional form HTML directly
  var embed = document.getElementById('wm-embed');
  var html = embed ? embed.innerHTML : '';
  // Rename IDs to avoid conflicts with hidden #app
  html = html.replace(/\bid="wm-/g, 'id="swm-');
  // Remove onchange handlers that reference old IDs
  html = html.replace(/ onchange="[^"]*"/g, '');

  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.watermark_title') + '</h2>' +
    '<p>' + __('simple.watermark_desc') + '</p>' +
    '<div class="card-form" style="text-align:left">' + html + '</div></div>';

  // Override button
  var btn = document.getElementById('swm-btn');
  if (btn) {
    btn.onclick = runWatermarkStep;
    btn.textContent = __('simple.watermark_btn');
  }

  // Use professional drop zone setup (same as shared.js)
  if (window.initDropZones) initDropZones();
  // Ensure clicking anywhere in a form-group opens the file dialog
  body.querySelectorAll('.form-group').forEach(function(g) {
    var fi = g.querySelector('input[type="file"]');
    if (fi) g.addEventListener('click', function(e) { if (e.target !== fi) fi.click(); });
  });
  // Force update drop zone display on file selection
  body.querySelectorAll('input[type="file"]').forEach(function(inp) {
    inp.addEventListener('change', function() {
      var dz = this.closest('.file-drop-zone');
      if (!dz) return;
      var fd = dz.querySelector('.dz-file');
      if (this.files && this.files.length) {
        dz.classList.add('has-file');
        if (fd) fd.textContent = '📄 ' + this.files[0].name;
      } else {
        dz.classList.remove('has-file');
        if (fd) fd.textContent = '';
      }
    });
  });
  // Restore numeric algorithm values (English only — scientific names)
  var typeSelect = document.getElementById('swm-type');
  if (typeSelect) {
    typeSelect.innerHTML =
      '<option value="1">1. Spatial LSB</option>' +
      '<option value="2">2. Frequency DCT</option>' +
      '<option value="3">3. Neural SS</option>' +
      '<option value="4">4. Latent DCT</option>' +
      '<option value="5">5. Zero-bit</option>' +
      '<option value="6">6. Multi-bit</option>' +
      '<option value="7">7. Forensic</option>' +
      '<option value="8">8. Fragile</option>' +
      '<option value="9">9. Imatag-style</option>';
  }
  // Hide cover image field (already uploaded in step 1) and show file name instead
  var imgGroup = document.getElementById('swm-image');
  if (imgGroup) {
    var group = imgGroup.closest('.form-group');
    if (group) group.style.display = 'none';
  }
  // Pre-populate cover image with the file from step 1
  if (simpleFile) {
    var imgInput = document.getElementById('swm-image');
    if (imgInput) {
      var dt = new DataTransfer();
      dt.items.add(simpleFile);
      imgInput.files = dt.files;
      imgInput.dispatchEvent(new Event('change'));
    }
    // Show file name indicator
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left';
    nameEl.textContent = __('simple.using_file').replace('{name}', simpleFile.name);
    var cardForm = body.querySelector('.card-form');
    if (cardForm) cardForm.insertBefore(nameEl, cardForm.firstChild);
  }
}

function runWatermarkStep() {
  var algo = parseInt(document.getElementById('swm-type').value);
  var pass = document.getElementById('swm-password').value || '';
  var secretFileInput = document.getElementById('swm-secret');
  var hasSecret = secretFileInput && secretFileInput.files && secretFileInput.files[0];
  // Validate: algorithms 1-4, 6-7, 9 require password + secret file
  if (algo !== 5 && algo !== 8) {
    if (!pass) { alert(__('simple.pw_required')); return; }
    if (!hasSecret) { alert(__('simple.secret_required')); return; }
  }
  var secretFile = hasSecret ? secretFileInput.files[0] : simpleFile;
  var btn = document.getElementById('swm-btn');
  btn.disabled = true; btn.textContent = __('simple.embedding');

  watermarkEmbed(algo, simpleFile, secretFile, pass).then(function(result) {
    if (result.ok) {
      btn.textContent = __('simple.watermarked');
      simpleResults.watermark = true;
      simpleResults.watermarkAlgo = algo;
      var algoNames = ['','Spatial LSB','Frequency DCT','Neural SS','Latent DCT','Zero-bit','Multi-bit','Forensic','Fragile','Imatag-style'];
      simpleResults.watermarkAlgoName = algoNames[algo] || 'Algorithm ' + algo;
      simpleResults.watermarkBlob = result.data;
      simpleResults.watermarkUrl = URL.createObjectURL(result.data);
      var wmOut = document.getElementById('wm-output');
      if (wmOut && wmOut.textContent) simpleResults.watermarkResult = wmOut.textContent;
      setTimeout(simpleNext, 1200);
    } else {
      btn.textContent = __('simple.failed_retry');
      btn.disabled = false;
      alert(result.error || __('simple.embed_failed'));
    }
  }).catch(function(e) {
    btn.textContent = __('simple.failed_retry');
    btn.disabled = false;
    alert(e.message);
  });
}

function renderPixelInjectStep(body) {
  // Copy professional pi-embed HTML directly
  var piEmbed = document.getElementById('pi-embed');
  var html = piEmbed ? piEmbed.innerHTML : '';
  html = html.replace(/\bid="pi-/g, 'id="spi-');
  html = html.replace(/ onchange="[^"]*"/g, '');
  html = html.replace(/ onclick="[^"]*"/g, '');

  body.innerHTML =
    '<div class="simple-card"><h2>' + __('simple.pi_title') + '</h2>' +
    '<p>' + __('simple.pi_desc') + '</p>' +
    '<div class="card-form" style="text-align:left">' + html + '</div>' +
    '<div id="spi-result"></div></div>';

  // Clear any default values (must start empty)
  var msgEl = document.getElementById('spi-message');
  if (msgEl) msgEl.value = '';
  var passEl = document.getElementById('spi-password');
  if (passEl) passEl.value = '';

  // Copy algorithm options from professional mode (populated dynamically)
  var srcAlgo = document.getElementById('pi-algorithm');
  var dstAlgo = document.getElementById('spi-algorithm');
  if (srcAlgo && dstAlgo) {
    dstAlgo.innerHTML = srcAlgo.innerHTML;
    // Sync category changes to keep algorithm list updated
    var srcCat = document.getElementById('pi-category');
    var dstCat = document.getElementById('spi-category');
    if (srcCat && dstCat) {
      dstCat.addEventListener('change', function() {
        srcCat.value = this.value;
        srcCat.dispatchEvent(new Event('change'));
        dstAlgo.innerHTML = srcAlgo.innerHTML;
      });
    }
  }

  // Hide advanced options button
  var advBtn = document.getElementById('spi-advanced-btn');
  if (advBtn) advBtn.style.display = 'none';
  var advOpts = document.getElementById('spi-advanced-options');
  if (advOpts) advOpts.style.display = 'none';

  // Override button
  var btn = document.getElementById('spi-btn');
  if (btn) {
    btn.onclick = runPixelInjectStep;
    btn.textContent = __('simple.pi_btn');
  }

  // Use professional drop zone setup (same as shared.js)
  if (window.initDropZones) initDropZones();
  // Ensure clicking anywhere in a form-group opens the file dialog
  body.querySelectorAll('.form-group').forEach(function(g) {
    var fi = g.querySelector('input[type="file"]');
    if (fi) g.addEventListener('click', function(e) { if (e.target !== fi) fi.click(); });
  });
  // Hide image input (already uploaded in step 1)
  var imgGroup = document.getElementById('spi-image');
  if (imgGroup) {
    var group = imgGroup.closest('.form-group');
    if (group) group.style.display = 'none';
  }
  // Pre-populate image input with the file from step 1 or watermarked result
  if (simpleFile) {
    var imgInput = document.getElementById('spi-image');
    if (imgInput) {
      var srcFile = simpleResults.watermarkBlob ? new File([simpleResults.watermarkBlob], simpleFile.name, { type: simpleFile.type }) : simpleFile;
      var dt = new DataTransfer();
      dt.items.add(srcFile);
      imgInput.files = dt.files;
      imgInput.dispatchEvent(new Event('change'));
    }
    // Show file name indicator
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'font-size:0.82rem;color:var(--success);margin:0 0 16px;text-align:left';
    nameEl.textContent = __('simple.using_file').replace('{name}', simpleFile.name) + (simpleResults.watermarkBlob ? ' (' + __('simple.watermarked', 'watermarked') + ')' : '');
    var cardForm = body.querySelector('.card-form');
    if (cardForm) cardForm.insertBefore(nameEl, cardForm.firstChild);
  }
  // Style the message field as required
  var msgField = document.getElementById('spi-message');
  if (msgField) {
    msgField.style.cssText = 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:0.85rem;resize:vertical;min-height:70px';
    msgField.required = true;
    msgField.placeholder = __('simple.pi_msg_ph', 'Enter your secret message (required)');
  }
}

function runPixelInjectStep() {
  var cat = document.getElementById('spi-category').value;
  var msg = document.getElementById('spi-message').value;
  var pass = document.getElementById('spi-password').value;

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
  // Sync algorithm selection
  var algoSelect = document.getElementById('pi-algorithm');
  var srcAlgo = document.getElementById('spi-algorithm');
  if (algoSelect && srcAlgo) algoSelect.value = srcAlgo.value;
  var msgInput = document.getElementById('pi-message');
  if (msgInput) msgInput.value = msg;
  var passInput = document.getElementById('pi-password');
  if (passInput) passInput.value = pass;

  var btn = document.getElementById('spi-btn');
  btn.disabled = true; btn.textContent = __('simple.injecting');

  if (window.switchPiTab) window.switchPiTab('embed');

  var promise = window.handlePixelInjection();
  if (promise && promise.then) {
    promise.then(function() {
      btn.textContent = __('simple.injected');
      simpleResults['pixel-injection'] = true;
      var resultDiv = document.getElementById('spi-result');
      var piOutput = document.getElementById('pi-output');
      var piDownload = document.getElementById('pi-download');
      if (piOutput) simpleResults.piResultHtml = piOutput.innerHTML;
      if (piDownload) simpleResults.piHtml = piDownload.innerHTML;
      if (piDownload) {
        var piLink = piDownload.querySelector('a');
        if (piLink) simpleResults.piFinalUrl = piLink.href;
      }
      if (resultDiv && piOutput && piOutput.innerHTML) {
        resultDiv.innerHTML = '<div class="simple-pi-result" style="text-align:left;max-height:400px;overflow-y:auto;padding:12px;background:var(--bg);border-radius:8px;margin-top:12px">' + piOutput.innerHTML + '</div>';
      }
      setTimeout(function() {
        simpleStepDone = true;
        document.getElementById('simpleNextBtn').disabled = false;
        simpleNext();
      }, 1500);
    }).catch(function() {
      btn.textContent = __('simple.failed_retry');
      btn.disabled = false;
    });
  }
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
    __('simple.fp_processing_note', '⏳ Computing multiple hash algorithms (SHA-2, SHA-3, BLAKE, MD, RIPEMD, Whirlpool) and perceptual hashes. This may take a moment for large files.') + '</p>' +
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
  var promise = window.handleFingerprint();
  if (promise && promise.then) {
    promise.then(function() {
      var resultDiv = document.getElementById('sfp-result');
      var fpOutput = document.getElementById('fp-output');
      if (resultDiv && fpOutput && fpOutput.innerHTML) {
        resultDiv.innerHTML = '<div class="simple-fp-result" style="text-align:left;max-height:400px;overflow-y:auto;padding:12px;background:var(--bg);border-radius:8px;margin-top:12px">' + fpOutput.innerHTML + '</div>';
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

function renderDone(body) {
  var results = simpleResults;
  var sections = [];

  if (results.watermark && results['pixel-injection'] && results.piFinalUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.final_image_title', 'Final Image') + '</h3>' +
      '<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">' +
      __('simple.final_image_desc', 'Watermarked + secret message injected — single download.') + '</p>' +
      '<a href="' + results.piFinalUrl + '" download="protected.png" class="btn" style="background:var(--primary);color:#fff">' +
      __('simple.final_dl_btn', '📥 Download Final Image') + '</a></div>');
  } else if (results.watermark && results.watermarkUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.watermarked_label') + '</h3>' +
      '<a href="' + results.watermarkUrl + '" download="watermarked.png" class="btn">' + __('simple.watermark_dl_btn') + '</a></div>');
  } else if (results['pixel-injection'] && results.piFinalUrl) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.pi_label') + '</h3>' +
      '<a href="' + results.piFinalUrl + '" download="injected.png" class="btn">' + __('simple.pi_dl_btn', '📥 Download Injected Image') + '</a></div>');
  }

  if (results.timestamp) {
    var tsHtml = '<div class="simple-done-section"><h3>' + __('simple.ts_label') + '</h3>';
    if (results.tsHtml) tsHtml += results.tsHtml;
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

  if (results.c2pa) {
    sections.push('<div class="simple-done-section"><h3>' + __('simple.c2pa_label') + '</h3><p>' + __('simple.c2pa_done_desc') + '</p></div>');
  }

  // Certificate download section
  var hasAnyResult = results.watermark || results['pixel-injection'] || results.timestamp || results.fingerprint;
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
