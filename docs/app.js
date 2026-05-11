// ── Navigation ──
document.querySelectorAll('nav a[data-page]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});
document.querySelectorAll('.card[data-page]').forEach(c => {
  c.addEventListener('click', e => { e.preventDefault(); showPage(c.dataset.page); });
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a[data-page]').forEach(a => a.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const nav = document.querySelector('nav a[data-page="' + name + '"]');
  if (nav) nav.classList.add('active');
}

function switchWmTab(mode) {
  document.querySelectorAll('.tab-btn[data-wm-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('wm-embed').style.display = mode === 'embed' ? '' : 'none';
  document.getElementById('wm-extract').style.display = mode === 'extract' ? '' : 'none';
  document.querySelector('.tab-btn[data-wm-tab="' + mode + '"]').classList.add('active');
}

function switchTsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ts-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ts-hash').style.display = mode === 'hash' ? '' : 'none';
  document.getElementById('ts-ots').style.display = mode === 'ots' ? '' : 'none';
  document.querySelector('.tab-btn[data-ts-tab="' + mode + '"]').classList.add('active');
}

function switchOtsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ots-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ots-create').style.display = mode === 'create' ? '' : 'none';
  document.getElementById('ots-verify').style.display = mode === 'verify' ? '' : 'none';
  document.querySelector('.tab-btn[data-ots-tab="' + mode + '"]').classList.add('active');
}

// ── Helper functions ──
function setStatus(msg, cls) {
  const el = document.getElementById('py-status');
  if (el) { el.textContent = msg; if (cls) el.className = 'badge badge-' + cls; }
}

function getFile(id) { return document.getElementById(id).files[0]; }
function getVal(id) { return document.getElementById(id).value; }

function spinner(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }

function showResult(resultId, outputId, dlId) {
  document.getElementById(resultId).style.display = 'block';
}

function downloadBlob(blob, name, containerId) {
  const url = URL.createObjectURL(blob);
  document.getElementById(containerId).innerHTML += '<a href="' + url + '" download="' + name + '" class="btn" style="margin:4px">Download ' + name + '</a> ';
}

function setOutput(id, html) { document.getElementById(id).innerHTML = html; }
function setText(id, text) { document.getElementById(id).textContent = text; }

// ── Status ──
setStatus('Ready - JS mode', 'success');

// ── Hash tab (pure client-side SHA-256) ──
async function timestampHash() {
  const btn = document.getElementById('ts-btn');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  const file = getFile('ts-file');
  if (!file) { setText('ts-output', 'Please select a file'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('ts-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const buf = await file.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    const sha = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
    setText('ts-output', 'SHA-256: ' + sha);
    const blob = new Blob(['SHA-256 (' + file.name + ') = ' + sha], { type: 'text/plain' });
    downloadBlob(blob, file.name + '.sha256.txt', 'ts-download');
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}

// ── OTS tab (client-side SHA-256 only, full OTS requires server) ──
async function timestampOTS() {
  const btn = document.getElementById('ts-ots-btn');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  const file = getFile('ts-ots-file');
  if (!file) { setText('ts-output', 'Please select a file'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('ts-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const buf = await file.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    const sha = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
    setText('ts-output', 'SHA-256: ' + sha + '\n\nOpenTimestamps (.ots creation) requires a server. Use the desktop app for full OTS support.');
    const blob = new Blob(['SHA-256 (' + file.name + ') = ' + sha], { type: 'text/plain' });
    downloadBlob(blob, file.name + '.sha256.txt', 'ts-download');
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}

async function verifyOTS() {
  const btn = document.getElementById('ts-verify-btn');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  const file = getFile('ts-verify-file');
  const otsFile = getFile('ts-ots-proof');
  if (!file || !otsFile) { setText('ts-output', 'Please select both a file and its .ots proof'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('ts-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const buf = await file.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    const sha = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
    setText('ts-output', 'File SHA-256: ' + sha + '\n\nOTS verification requires a server. Download the hash for manual verification.');
    const blob = new Blob(['SHA-256 (' + file.name + ') = ' + sha], { type: 'text/plain' });
    downloadBlob(blob, file.name + '.sha256.txt', 'ts-download');
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}

// ── Watermark tab ──
async function watermarkEmbed() {
  const btn = document.getElementById('wm-btn');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  const type = parseInt(getVal('wm-type'));
  const pw = getVal('wm-password') || null;
  const imgFile = getFile('wm-image');
  if (!imgFile) { setText('wm-output', 'Please select an image'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('wm-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('wm-output', 'Processing...');

  try {
    const result = await watermarkEmbed(type, imgFile, imgFile, pw);
    if (result.ok) {
      const report = JSON.stringify({ algorithm: type, message: result.msg, status: 'ok' }, null, 2);
      const reportBlob = new Blob([report], { type: 'application/json' });
      const reportUrl = URL.createObjectURL(reportBlob);
      const imgUrl = URL.createObjectURL(result.data);
      dl.innerHTML = '<a href="' + imgUrl + '" download="watermarked.png" class="btn">Download watermarked.png</a>' +
        '<a href="' + reportUrl + '" download="watermark_report.json" class="btn" style="margin-left:8px">Download Report (JSON)</a>';
      setText('wm-output', result.msg);
    } else {
      setText('wm-output', 'Error: ' + result.error);
    }
  } catch (e) { setText('wm-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('wm-spinner', false);
}

async function watermarkExtract() {
  const btn = document.getElementById('wm-btn-ex');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  const type = parseInt(getVal('wm-type-ex'));
  const pw = getVal('wm-password-ex') || null;
  const imgFile = getFile('wm-image-ex');
  if (!imgFile) { setText('wm-output', 'Please select a stego image'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('wm-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('wm-output', 'Processing...');

  try {
    const result = await watermarkExtract(type, imgFile, pw);
    if (result.ok) {
      let text = result.msg + '\n';
      const reportData = { algorithm: type, message: result.msg, status: 'ok' };
      dl.innerHTML = '';
      if (result.files) {
        for (const [name, data] of Object.entries(result.files)) {
          text += '\n  ' + name + ': extracted';
          const blob = new Blob([data], { type: 'application/octet-stream' });
          downloadBlob(blob, name, 'wm-download');
        }
      }
      const reportBlob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      downloadBlob(reportBlob, 'extract_report.json', 'wm-download');
      setText('wm-output', text);
    } else {
      setText('wm-output', 'Error: ' + result.error);
    }
  } catch (e) { setText('wm-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('wm-spinner', false);
}

// ── Fingerprint tab ──
async function fingerprintFile() {
  const btn = document.getElementById('fp-btn');
  const resultDiv = document.getElementById('fp-result');
  const output = document.getElementById('fp-output');
  const dl = document.getElementById('fp-download');

  const file = getFile('fp-file');
  if (!file) { setText('fp-output', 'Please select a file'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('fp-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('fp-output', 'Processing...');

  try {
    const result = await fingerprintFile(file);
    const pretty = JSON.stringify(result, null, 2);

    let html = '<table class="meta-table">';
    html += '<tr><td>File</td><td>' + escHtml(result.file_info.file_name) + '</td></tr>';
    html += '<tr><td>Size</td><td>' + (result.file_info.file_size_bytes / 1024).toFixed(1) + ' KB</td></tr>';
    if (result.file_info.width) {
      html += '<tr><td>Dimensions</td><td>' + result.file_info.width + ' x ' + result.file_info.height + '</td></tr>';
      html += '<tr><td>Format</td><td>' + escHtml(result.file_info.format) + '</td></tr>';
    }
    html += '</table>';

    const familyOrder = [
      { label: 'SHA-2', keys: ['SHA-1','SHA-224','SHA-256','SHA-384','SHA-512'] },
      { label: 'SHA-3', keys: ['SHA-3_224','SHA-3_256','SHA-3_384','SHA-3_512'] },
      { label: 'MD', keys: ['MD5'] },
      { label: 'BLAKE2', keys: ['BLAKE2b','BLAKE2s'] },
    ];
    for (const family of familyOrder) {
      const hasAny = family.keys.some(k => result.hashes[k]);
      if (!hasAny) continue;
      html += '<div style="margin-top:12px;font-weight:700;font-size:0.85rem">' + family.label + '</div>';
      html += '<table class="meta-table">';
      for (const key of family.keys) {
        const v = result.hashes[key];
        if (v) html += '<tr><td style="width:100px">' + key + '</td><td><code style="font-size:0.65rem">' + v + '</code></td></tr>';
      }
      html += '</table>';
    }

    if (result.perceptual_hashes && Object.keys(result.perceptual_hashes).length > 0) {
      html += '<div style="margin-top:12px;font-weight:700;font-size:0.85rem">Perceptual (image hashes)</div>';
      html += '<table class="meta-table">';
      for (const [k, v] of Object.entries(result.perceptual_hashes)) {
        html += '<tr><td style="width:100px">' + k + '</td><td><code style="font-size:0.65rem">' + v + '</code></td></tr>';
      }
      html += '</table>';
    }

    output.innerHTML = html;

    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = '<a href="' + url + '" download="' + file.name + '.fingerprint.json" class="btn">Download JSON</a>';
  } catch (e) { setText('fp-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('fp-spinner', false);
}

// ── Metadata tab ──
async function readMetadata() {
  const btn = document.getElementById('md-btn');
  const resultDiv = document.getElementById('md-result');
  const output = document.getElementById('md-output');
  const dl = document.getElementById('md-download');

  const file = getFile('md-file');
  if (!file) { setText('md-output', 'Please select an image'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('md-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('md-output', 'Processing...');

  try {
    const result = await readMetadata(file);
    const pretty = JSON.stringify(result, null, 2);

    let html = '<table class="meta-table">';
    html += '<tr><td>File</td><td>' + escHtml(result.file) + '</td></tr>';
    html += '<tr><td>Size</td><td>' + (result.size / 1024).toFixed(1) + ' KB</td></tr>';
    html += '<tr><td>SHA-256</td><td><code>' + result.sha256 + '</code></td></tr>';
    if (result.image) {
      html += '<tr><td>Dimensions</td><td>' + result.image.width + ' x ' + result.image.height + '</td></tr>';
      html += '<tr><td>Mode</td><td>' + result.image.mode + '</td></tr>';
      html += '<tr><td>Format</td><td>' + escHtml(result.image.format) + '</td></tr>';
    }
    if (result.exif) {
      html += '<tr><td colspan="2" style="font-weight:700;padding-top:12px">EXIF</td></tr>';
      for (const [k, v] of Object.entries(result.exif)) {
        if (v && v !== '0') html += '<tr><td style="padding-left:12px">' + escHtml(k) + '</td><td>' + escHtml(v) + '</td></tr>';
      }
    }
    if (result.error) {
      html += '<tr><td style="color:var(--danger)">Error</td><td>' + escHtml(result.error) + '</td></tr>';
    }
    html += '</table>';
    output.innerHTML = html;

    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = '<a href="' + url + '" download="' + file.name + '.metadata.json" class="btn">Download JSON</a>';
  } catch (e) { setText('md-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('md-spinner', false);
}
