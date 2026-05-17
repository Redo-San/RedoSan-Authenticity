// ── Shared utilities used by all features ──

var BLOCKED_EXTS = ['.exe','.bat','.cmd','.com','.msi','.scr','.pif',
  '.vbs','.vbe','.js','.jse','.wsf','.wsh','.ps1','.psm1','.psd1',
  '.py','.pyc','.rb','.pl','.sh','.bash','.dll','.sys','.ocx',
  '.app','.jar','.msu','.msp','.reg','.inf','.gadget','.cpl','.mst',
  '.hta','.ws','.vb','.vba','.swf','.action'];

function isDangerousFile(file) {
  var name = file.name.toLowerCase();
  for (var i = 0; i < BLOCKED_EXTS.length; i++) {
    if (name.endsWith(BLOCKED_EXTS[i])) return true;
  }
  return false;
}

var MAGIC_BYTES = {
  'image/png':       [[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]],
  'image/jpeg':      [[0xFF,0xD8,0xFF]],
  'image/gif':       [[0x47,0x49,0x46,0x38,0x39,0x61],[0x47,0x49,0x46,0x38,0x37,0x61]],
  'image/webp':      function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x57||buf[9]!==0x45||buf[10]!==0x42||buf[11]!==0x50) return false;
    return true;
  },
  'image/bmp':       [[0x42,0x4D]],
  'image/tiff':      [[0x49,0x49,0x2A,0x00],[0x4D,0x4D,0x00,0x2A]],
  'image/svg+xml':   function(buf) {
    var s = String.fromCharCode.apply(null, buf.slice(0, 50)).toLowerCase();
    return s.indexOf('<svg') !== -1 || s.indexOf('<?xml') !== -1;
  },
  'application/pdf': [[0x25,0x50,0x44,0x46]],
  'audio/mpeg':      [[0x49,0x44,0x33],[0xFF,0xFB],[0xFF,0xF3],[0xFF,0xF2]],
  'audio/wav':       function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x57||buf[9]!==0x41||buf[10]!==0x56||buf[11]!==0x45) return false;
    return true;
  },
  'audio/flac':      [[0x66,0x4C,0x61,0x43]],
  'audio/ogg':       [[0x4F,0x67,0x67,0x53]],
  'video/mp4':       function(buf) {
    if (buf[4]!==0x66||buf[5]!==0x74||buf[6]!==0x79||buf[7]!==0x70) return false;
    return true;
  },
  'video/webm':      [[0x1A,0x45,0xDF,0xA3]],
  'video/avi':       function(buf) {
    if (buf[0]!==0x52||buf[1]!==0x49||buf[2]!==0x46||buf[3]!==0x46) return false;
    if (buf[8]!==0x41||buf[9]!==0x56||buf[10]!==0x49||buf[11]!==0x20) return false;
    return true;
  }
};

function matchesMagicBytes(file) {
  return new Promise(function(resolve) {
    var mime = file.type.toLowerCase();
    var expected = MAGIC_BYTES[mime];
    if (!expected) { resolve(true); return; }
    var reader = new FileReader();
    reader.onloadend = function() {
      var arr = new Uint8Array(reader.result);
      if (typeof expected === 'function') {
        resolve(expected(arr));
        return;
      }
      for (var m = 0; m < expected.length; m++) {
        var sig = expected[m];
        var match = true;
        for (var i = 0; i < sig.length; i++) {
          if (arr[i] !== sig[i]) { match = false; break; }
        }
        if (match) { resolve(true); return; }
      }
      resolve(false);
    };
    reader.onerror = function() { resolve(true); };
    reader.readAsArrayBuffer(file.slice(0, 64));
  });
}

function matchesAccept(file, acceptAttr) {
  if (!acceptAttr) return true;
  var name = file.name.toLowerCase();
  var type = file.type.toLowerCase();
  var rules = acceptAttr.split(',');
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i].trim();
    if (r.endsWith('/*') && type.startsWith(r.split('/')[0] + '/')) return true;
    else if (r.indexOf('/') !== -1 && type === r) return true;
    else if (r.startsWith('.') && name.endsWith(r)) return true;
  }
  return false;
}

function clearInputFiles(input) {
  try { input.value = ''; } catch(e) {}
  if (input.files && input.files.length) {
    var dt = new DataTransfer();
    input.files = dt.files;
  }
}

async function validateFileInput(input) {
  if (!input || !input.files || !input.files.length) return true;
  var file = input.files[0];
  if (!file) return true;
  if (isDangerousFile(file)) {
    alert(__('shared.dangerous_file', 'This file type is not allowed for security reasons.') || 'This file type is not allowed for security reasons.');
    clearInputFiles(input);
    return false;
  }
  var accept = input.getAttribute('accept');
  if (accept && !matchesAccept(file, accept)) {
    alert(__('shared.wrong_type', 'Please select a valid file type for this tool.') || 'Please select a valid file type for this tool.');
    clearInputFiles(input);
    return false;
  }
  var magicOk = await matchesMagicBytes(file);
  if (!magicOk) {
    alert(__('shared.corrupt_file', 'This file appears to be corrupted or has an incorrect format.') || 'This file appears to be corrupted or has an incorrect format.');
    clearInputFiles(input);
    return false;
  }
  return true;
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setStatus(msg, cls) {
  const el = document.getElementById('py-status');
  if (el) { el.textContent = msg; if (cls) el.className = 'badge badge-' + cls; }
}
setStatus('Ready - JS mode', 'success');

async function getFile(id) {
  var input = document.getElementById(id);
  if (input && input.files && input.files.length) {
    var file = input.files[0];
    if (isDangerousFile(file)) {
      alert(__('shared.dangerous_file', 'This file type is not allowed for security reasons.'));
      input.value = '';
      return null;
    }
    var accept = input.getAttribute('accept');
    if (accept && !matchesAccept(file, accept)) {
      alert(__('shared.wrong_type', 'Please select a valid file type for this tool.'));
      input.value = '';
      return null;
    }
    var magicOk = await matchesMagicBytes(file);
    if (!magicOk) {
      alert(__('shared.corrupt_file', 'This file appears to be corrupted or has an incorrect format.') || 'This file appears to be corrupted or has an incorrect format.');
      input.value = '';
      return null;
    }
  }
  return input ? input.files[0] : undefined;
}
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
  // codeql[js/xss-through-dom] — url is safe, name is HTML-escaped
  document.getElementById(containerId).innerHTML += '<a href="' + url + '" download="' + attrSafe + '" class="btn" style="margin:4px">' + __('shared.download') + ' ' + safe + '</a> ';
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(__('shared.failed_load_image', 'Failed to load image'))); };
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
    async function updateFile() {
      if (input.files && input.files.length) {
        if (input.files[0] && !(await validateFileInput(input))) { clearInputFiles(input); fileDiv.textContent = ''; dz.classList.remove('has-file'); return; }
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
    dz.addEventListener('drop', async e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        const dt = new DataTransfer();
        for (const f of e.dataTransfer.files) dt.items.add(f);
        input.files = dt.files;
        if (input.files[0] && !(await validateFileInput(input))) { clearInputFiles(input); dz.classList.remove('has-file'); fileDiv.textContent = ''; return; }
        updateFile();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    if (input.files && input.files.length) updateFile();
  });
}
document.addEventListener('DOMContentLoaded', () => { initTheme(); initDropZones(); });
