// ── Shared utilities used by all features ──

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setStatus(msg, cls) {
  const el = document.getElementById('py-status');
  if (el) { el.textContent = msg; if (cls) el.className = 'badge badge-' + cls; }
}
setStatus('Ready - JS mode', 'success');

function getFile(id) { return document.getElementById(id).files[0]; }
function getVal(id) { return document.getElementById(id).value; }
function spinner(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }
function showResult(resultId, outputId, dlId) { document.getElementById(resultId).style.display = 'block'; }
function setOutput(id, html) { document.getElementById(id).innerHTML = html; }
function setText(id, text) { document.getElementById(id).textContent = text; }
function __(key, fallback) { return (i18n && i18n.data && i18n.data[key]) || fallback || key; }

function downloadBlobSimple(blob, fileName) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, name, containerId) {
  const url = URL.createObjectURL(blob);
  const safe = escHtml(name);
  const attrSafe = name.replace(/"/g, '&quot;');
  document.getElementById(containerId).innerHTML += '<a href="' + url + '" download="' + attrSafe + '" class="btn" style="margin:4px">Download ' + safe + '</a> ';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      d.w = img.width; d.h = img.height;
      URL.revokeObjectURL(url);
      resolve({ canvas: c, ctx, imgData: d, w: img.width, h: img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, mime) {
  return new Promise(r => canvas.toBlob(b => r(b), mime || 'image/png'));
}

function getRGB(imgData) {
  const r = new Uint8Array(imgData.w * imgData.h * 3);
  for (let i = 0; i < imgData.w * imgData.h; i++) {
    r[i*3] = imgData.data[i*4]; r[i*3+1] = imgData.data[i*4+1]; r[i*3+2] = imgData.data[i*4+2];
  }
  return r;
}

async function sha256Hex(data) {
  const h = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function pack32(v) { return new Uint8Array([(v>>24)&255,(v>>16)&255,(v>>8)&255,v&255]); }
function unpack32(b) { return (b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]; }

// ── Theme Toggle ──
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('redosan_theme', theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'light' ? 'dark' : 'light');
}
function initTheme() {
  const saved = localStorage.getItem('redosan_theme');
  if (saved) { setTheme(saved); return; }
  setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

// ── File Drop Zones ──
function initDropZones() {
  document.querySelectorAll('.form-group input[type="file"]').forEach(input => {
    if (input.parentElement.classList.contains('file-drop-zone')) return;
    const dz = document.createElement('div');
    dz.className = 'file-drop-zone';
    input.parentNode.insertBefore(dz, input);
    dz.appendChild(input);
    const icon = document.createElement('span');
    icon.className = 'dz-icon'; icon.textContent = '📁';
    dz.appendChild(icon);
    const text = document.createElement('div');
    text.className = 'dz-text';
    text.innerHTML = 'Drop file here or <strong>browse</strong>';
    dz.appendChild(text);
    const fileDiv = document.createElement('div');
    fileDiv.className = 'dz-file';
    dz.appendChild(fileDiv);
    dz.addEventListener('click', e => { if (e.target === dz || e.target.classList.contains('dz-icon') || e.target.classList.contains('dz-text')) input.click(); });
    function updateFile() {
      if (input.files && input.files.length) {
        dz.classList.add('has-file');
        fileDiv.textContent = '📄 ' + input.files[0].name;
      } else {
        dz.classList.remove('has-file');
        fileDiv.textContent = '';
      }
    }
    input.addEventListener('change', updateFile);
    ['dragenter', 'dragover'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.remove('drag-over'); }));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        const dt = new DataTransfer();
        for (const f of e.dataTransfer.files) dt.items.add(f);
        input.files = dt.files;
        updateFile();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    if (input.files && input.files.length) updateFile();
  });
}
document.addEventListener('DOMContentLoaded', () => { initTheme(); initDropZones(); });
