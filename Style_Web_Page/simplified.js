// ── Simplified mode: step-by-step wizard ──

var simpleFile = null;
var simpleBuf = null;
var simpleType = null;
var simpleIsAI = false;
var simpleStep = 0;
var simpleSteps = [];
var simpleResults = {};
var simpleStepDone = false;

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
  localStorage.removeItem('redosan_mode');
  location.reload();
}

function showModeSelect() {
  localStorage.removeItem('redosan_mode');
  location.reload();
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
  var s = [{ id: 'upload', label: 'Upload' }];
  if (type === 'image') {
    s.push({ id: 'ai-question', label: 'Type' });
    if (isAI) s.push({ id: 'c2pa', label: 'C2PA' });
    s.push({ id: 'watermark', label: 'Watermark' });
    s.push({ id: 'pixel-injection', label: 'Inject' });
  }
  s.push({ id: 'timestamp', label: 'Timestamp' });
  s.push({ id: 'fingerprint', label: 'Fingerprint' });
  s.push({ id: 'done', label: 'Done' });
  return s;
}

// ── Init & render ──

function initSimplified() {
  simpleFile = null; simpleBuf = null; simpleType = null;
  simpleIsAI = false; simpleStep = 0; simpleSteps = [];
  simpleResults = {};
  var steps = [{ id: 'upload', label: 'Upload' }];
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
  nextBtn.textContent = isLast ? 'Start Over' : 'Next →';
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
    'Step ' + (simpleStep + 1) + ' of ' + simpleSteps.length;
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
  body.innerHTML =
    '<div class="simple-card"><h2>Upload Your File</h2><p>Select a photo, audio, video, or document to get started.</p>' +
    '<div class="simple-upload-zone" id="simpleDropZone" onclick="document.getElementById(\'simpleFileInput\').click()">' +
    '<div class="dz-icon">📂</div>' +
    '<div class="dz-text">Click to browse or drag &amp; drop</div></div>' +
    '<input type="file" id="simpleFileInput" style="display:none" onchange="simpleFileSelected(this)">' +
    '<div id="simpleFileInfo"></div></div>';
  setupSimpleDropZone();
  // Restore file info if already selected
  if (simpleFile) restoreUploadFileInfo();
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

function restoreUploadFileInfo() {
  var dz = document.getElementById('simpleDropZone');
  var info = document.getElementById('simpleFileInfo');
  if (!dz || !info || !simpleFile) return;
  dz.classList.add('has-file');
  var icon = { image: '🖼️', audio: '🎵', video: '🎬', document: '📄', other: '📁' }[simpleType] || '📁';
  info.innerHTML = '<div class="simple-file-info"><span class="simple-file-icon">' + icon + '</span>' +
    '<div><strong>' + escapeHtml(simpleFile.name) + '</strong><br>' + formatSize(simpleFile.size) +
    ' <span class="badge badge-muted">' + simpleType + '</span></div></div>';
}

function simpleFileSelected(input) {
  var file = input.files ? input.files[0] : input;
  if (!file) return;
  simpleFile = file;
  var type = detectFileType(file);
  var dz = document.getElementById('simpleDropZone');
  var info = document.getElementById('simpleFileInfo');
  dz.classList.add('has-file');
  var icon = { image: '🖼️', audio: '🎵', video: '🎬', document: '📄', other: '📁' }[type] || '📁';
  info.innerHTML = '<div class="simple-file-info"><span class="simple-file-icon">' + icon + '</span>' +
    '<div><strong>' + escapeHtml(file.name) + '</strong><br>' + formatSize(file.size) +
    ' <span class="badge badge-muted">' + type + '</span></div></div>';
  simpleType = type;
  // Read file buffer
  var reader = new FileReader();
  reader.onload = function(e) { simpleBuf = e.target.result; };
  reader.readAsArrayBuffer(file);
  // Rebuild steps based on type
  if (type === 'image') {
    simpleSteps = [{ id: 'upload', label: 'Upload' }, { id: 'ai-question', label: 'Type' }];
  } else {
    simpleSteps = buildSteps(type, false);
  }
  // Reset step position
  simpleStep = 0;
  renderStep();
}

function renderAiQuestion(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>What kind of image is this?</h2><p>This helps us choose the right tools for your image.</p>' +
    '<div class="simple-ai-options">' +
    '<div class="simple-ai-card" onclick="chooseAi(false)"><span class="ai-icon">📸</span><h3>Regular Photo</h3><p>A normal photograph taken with a camera</p></div>' +
    '<div class="simple-ai-card" onclick="chooseAi(true)"><span class="ai-icon">🤖</span><h3>AI-Generated</h3><p>Created by AI tools like Midjourney, DALL·E, Stable Diffusion</p></div>' +
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
    '<div class="simple-card"><h2>C2PA Provenance</h2><p>Add C2PA metadata to mark this as AI-generated content.</p>' +
    '<div class="form-group"><label>Content Type</label>' +
    '<div class="c2pa-type-card" style="margin-bottom:8px">' +
    '<div class="c2pa-type-header"><input type="checkbox" id="sc2pa-ai" checked disabled>' +
    '<label for="sc2pa-ai">🤖 AI-Generated</label></div></div></div>' +
    '<div class="form-group"><label>Social Links (optional)</label>' +
    '<input class="c2pa-link" placeholder="Instagram URL" id="sc2pa-instagram">' +
    '<input class="c2pa-link" placeholder="Twitter / X URL" id="sc2pa-twitter">' +
    '<input class="c2pa-link" placeholder="Website URL" id="sc2pa-website"></div>' +
    '<button class="btn" onclick="runC2paStep()" id="sc2pa-btn">Sign C2PA &amp; Continue →</button>' +
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
  btn.disabled = true; btn.textContent = 'Signing...';
  handleC2paWrite().then(function() {
    btn.textContent = '✓ Signed!';
    simpleResults.c2pa = true;
    // Wait a moment then go next
    setTimeout(simpleNext, 1000);
  }).catch(function() {
    btn.textContent = 'Failed — try again';
    btn.disabled = false;
  });
}

function renderWatermarkStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>Digital Watermark</h2><p>Embed an invisible watermark to protect your image.</p>' +
    '<div class="form-group"><label>Algorithm</label>' +
    '<select id="swm-algo" class="c2pa-link"><option value="1">1. Spatial LSB (Fast)</option><option value="2">2. Frequency DCT (Balanced)</option><option value="6">6. Multi-bit (Robust)</option></select></div>' +
    '<div class="form-group"><label>Password</label>' +
    '<input type="text" class="c2pa-link" id="swm-password" placeholder="Enter a password" value="redosan"></div>' +
    '<button class="btn" onclick="runWatermarkStep()" id="swm-btn">Embed Watermark &amp; Continue →</button>' +
    '<div id="swm-result"></div></div>';
}

function runWatermarkStep() {
  var algo = document.getElementById('swm-algo').value;
  var pass = document.getElementById('swm-password').value || 'redosan';
  // Set file on professional mode's image input
  var imgInput = document.getElementById('wm-image');
  if (imgInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    imgInput.files = dt.files;
    var evt = new Event('change');
    imgInput.dispatchEvent(evt);
  }
  // Set algorithm type
  var typeSelect = document.getElementById('wm-type');
  if (typeSelect) { typeSelect.value = algo; typeSelect.dispatchEvent(new Event('change')); }
  // Set password
  var passInput = document.getElementById('wm-password');
  if (passInput) passInput.value = pass;
  // Use same file as secret (simplified mode always uses the image itself)
  var secretInput = document.getElementById('wm-secret');
  if (secretInput && simpleFile) {
    var dt2 = new DataTransfer();
    dt2.items.add(simpleFile);
    secretInput.files = dt2.files;
    var evt2 = new Event('change');
    secretInput.dispatchEvent(evt2);
  }
  var btn = document.getElementById('swm-btn');
  btn.disabled = true; btn.textContent = 'Embedding...';
  var origHandler = window.handleWatermarkEmbed;
  if (origHandler) {
    // Wrap to catch completion
    var orig = origHandler;
    window.handleWatermarkEmbed = function() {
      return orig.call(this).then(function(r) {
        window.handleWatermarkEmbed = orig;
        btn.textContent = '✓ Watermarked!';
        simpleResults.watermark = true;
        setTimeout(simpleNext, 1000);
        return r;
      }).catch(function(e) {
        window.handleWatermarkEmbed = orig;
        btn.textContent = 'Failed — try again';
        btn.disabled = false;
        throw e;
      });
    };
    origHandler();
  }
}

function renderPixelInjectStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>Pixel Injection</h2><p>Hide a secret message in the image pixels.</p>' +
    '<div class="form-group"><label>Category</label>' +
    '<select id="spi-cat" class="c2pa-link">' +
    '<option value="copyright">© Copyright</option>' +
    '<option value="metadata">📋 Metadata</option>' +
    '<option value="secret">🔒 Secret Message</option></select></div>' +
    '<div class="form-group"><label>Message</label>' +
    '<textarea class="c2pa-link" id="spi-msg" rows="2" placeholder="Your hidden message">Authenticated via RedoSan</textarea></div>' +
    '<div class="form-group"><label>Password</label>' +
    '<input type="text" class="c2pa-link" id="spi-pass" placeholder="Password" value="redosan"></div>' +
    '<button class="btn" onclick="runPixelInjectStep()" id="spi-btn">Inject &amp; Continue →</button>' +
    '<div id="spi-result"></div></div>';
}

function runPixelInjectStep() {
  var cat = document.getElementById('spi-cat').value;
  var msg = document.getElementById('spi-msg').value;
  var pass = document.getElementById('spi-pass').value || 'redosan';
  var fileInput = document.getElementById('pi-image');
  if (fileInput && simpleFile) {
    var dt = new DataTransfer();
    dt.items.add(simpleFile);
    fileInput.files = dt.files;
    var evt = new Event('change');
    fileInput.dispatchEvent(evt);
  }
  var catSelect = document.getElementById('pi-category');
  if (catSelect) catSelect.value = cat;
  var msgInput = document.getElementById('pi-message');
  if (msgInput) msgInput.value = msg;
  var passInput = document.getElementById('pi-password');
  if (passInput) passInput.value = pass;
  var btn = document.getElementById('spi-btn');
  btn.disabled = true; btn.textContent = 'Injecting...';
  // Switch to embed tab
  if (window.switchPiTab) window.switchPiTab('embed');
  var origHandler = window.handlePixelInject;
  if (origHandler) {
    var orig = origHandler;
    window.handlePixelInject = function() {
      return orig.call(this).then(function(r) {
        window.handlePixelInject = orig;
        btn.textContent = '✓ Injected!';
        simpleResults['pixel-injection'] = true;
        setTimeout(simpleNext, 1000);
        return r;
      }).catch(function(e) {
        window.handlePixelInject = orig;
        btn.textContent = 'Failed — try again';
        btn.disabled = false;
        throw e;
      });
    };
    origHandler();
  }
}

function renderTimestampStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>⏱️ Timestamp</h2><p>Creating an OpenTimestamp (.ots) proof for your file.</p>' +
    '<div id="sts-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p>Processing...</p></div></div>';
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
  var origHandler = window.handleOtsCreate;
  if (origHandler) {
    var orig = origHandler;
    window.handleOtsCreate = function() {
      return orig.call(this).then(function(r) {
        window.handleOtsCreate = orig;
        var resultDiv = document.getElementById('sts-result');
        if (resultDiv) {
          var text = escapeHtml((document.getElementById('ts-output') || {}).textContent || '');
          resultDiv.innerHTML = '<div class="simple-success">' + text.replace(/\n/g, '<br>') + '</div>';
        }
        simpleResults.timestamp = true;
        simpleStepDone = true;
        document.getElementById('simpleNextBtn').disabled = false;
        return r;
      }).catch(function(e) {
        window.handleOtsCreate = orig;
        var resultDiv = document.getElementById('sts-result');
        if (resultDiv) resultDiv.innerHTML = '<div class="simple-error">Timestamp failed: ' + escapeHtml(e.message) + '</div>';
        throw e;
      });
    };
    origHandler();
  }
}

function renderFingerprintStep(body) {
  body.innerHTML =
    '<div class="simple-card"><h2>🔍 Fingerprint</h2><p>Generating cryptographic fingerprints (SHA-256, BLAKE3) for your file.</p>' +
    '<div id="sfp-result"><div class="spinner" style="display:inline-block;margin:16px auto"></div><p>Processing...</p></div></div>';
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
  var origHandler = window.handleFingerprint;
  if (origHandler) {
    var orig = origHandler;
    window.handleFingerprint = function() {
      return orig.call(this).then(function(r) {
        window.handleFingerprint = orig;
        var resultDiv = document.getElementById('sfp-result');
        if (resultDiv) {
          var text = escapeHtml((document.getElementById('fp-output') || {}).textContent || '');
          resultDiv.innerHTML = '<div class="simple-success">' + text.replace(/\n/g, '<br>') + '</div>';
        }
        simpleResults.fingerprint = true;
        simpleStepDone = true;
        document.getElementById('simpleNextBtn').disabled = false;
        return r;
      }).catch(function(e) {
        window.handleFingerprint = orig;
        var resultDiv = document.getElementById('sfp-result');
        if (resultDiv) resultDiv.innerHTML = '<div class="simple-error">Fingerprint failed: ' + escapeHtml(e.message) + '</div>';
        throw e;
      });
    };
    origHandler();
  }
}

function renderDone(body) {
  var results = simpleResults;
  var parts = [];
  if (results.c2pa) parts.push('✅ C2PA Provenance');
  if (results.watermark) parts.push('✅ Digital Watermark');
  if (results['pixel-injection']) parts.push('✅ Pixel Injection');
  if (results.timestamp) parts.push('✅ OpenTimestamp (.ots)');
  if (results.fingerprint) parts.push('✅ Cryptographic Fingerprint');
  body.innerHTML =
    '<div class="simple-card simple-done"><h2>🎉 All Done!</h2>' +
    '<p>Your file has been processed through all the steps.</p>' +
    '<div class="simple-results-list">' + parts.map(function(p) {
      return '<div class="simple-result-item">' + p + '</div>';
    }).join('') + '</div>' +
    '<div class="simple-done-actions">' +
    '<button class="btn" onclick="restartSimple()">🔄 Process Another File</button>' +
    '<button class="btn" onclick="switchMode()">⚙️ Switch to Professional</button>' +
    '</div></div>';
  document.getElementById('simplePrevBtn').style.display = 'none';
  document.getElementById('simpleNextBtn').textContent = 'Start Over';
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
