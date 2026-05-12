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

function downloadBlobSimple(blob, fileName) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, name, containerId) {
  const url = URL.createObjectURL(blob);
  const safe = escHtml(name);
  document.getElementById(containerId).innerHTML += '<a href="' + url + '" download="' + safe + '" class="btn" style="margin:4px">Download ' + safe + '</a> ';
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
