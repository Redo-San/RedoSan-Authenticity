let pyodide = null;
let ready = false;

async function init() {
  const status = document.getElementById('py-status');
  status.textContent = 'Loading Pyodide...';
  try {
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/' });
    status.textContent = 'Installing packages...';
    await pyodide.loadPackage('micropip');
    const micropip = pyodide.pyimport('micropip');
    await micropip.install('Pillow');
    await micropip.install('imagehash');
    status.textContent = 'Loading modules...';

    const base = document.location.href.includes('localhost')
      ? '/py/' : '/RedoSan-Authenticity/py/';

    const modules = [
      'wtype_common.py', 'wtype1.py', 'wtype2.py', 'wtype3.py',
      'wtype4.py', 'wtype5.py', 'wtype6.py', 'wtype7.py',
      'wtype8.py', 'wtype9.py'
    ];
    for (const mod of modules) {
      const resp = await fetch(`${base}${mod}`);
      const code = await resp.text();
      pyodide.FS.writeFile(mod, code);
    }

    pyodide.runPython(`
import sys, os, json, tempfile, hashlib, shutil
sys.path.insert(0, '.')
import wtype_common
import wtype1, wtype2, wtype3, wtype4, wtype5, wtype6, wtype7, wtype8, wtype9

WTYPES = {1:wtype1,2:wtype2,3:wtype3,4:wtype4,5:wtype5,6:wtype6,7:wtype7,8:wtype8,9:wtype9}

TMP = '/tmp/redosan'
os.makedirs(TMP, exist_ok=True)

def embed_watermark(wtype, password):
    img_path = os.path.join(TMP, 'input.png')
    sec_path = os.path.join(TMP, 'secret.bin')
    out_path = os.path.join(TMP, 'output.png')
    mod = WTYPES.get(wtype)
    if not mod:
        return json.dumps({'ok': False, 'error': f'Unknown type {wtype}'})
    try:
        ok, msg = mod.embed(img_path, sec_path, out_path, password)
        if ok:
            with open(out_path, 'rb') as f:
                import base64
                data = base64.b64encode(f.read()).decode()
            return json.dumps({'ok': True, 'data': data, 'msg': msg})
        return json.dumps({'ok': False, 'error': msg})
    except Exception as e:
        return json.dumps({'ok': False, 'error': str(e)})

def extract_watermark(wtype, password):
    img_path = os.path.join(TMP, 'stego.png')
    out_dir = os.path.join(TMP, 'extracted')
    os.makedirs(out_dir, exist_ok=True)
    mod = WTYPES.get(wtype)
    if not mod:
        return json.dumps({'ok': False, 'error': f'Unknown type {wtype}'})
    try:
        ok, msg = mod.extract(img_path, out_dir, password)
        if ok:
            files = {}
            for fname in os.listdir(out_dir):
                fpath = os.path.join(out_dir, fname)
                with open(fpath, 'rb') as f:
                    import base64
                    files[fname] = base64.b64encode(f.read()).decode()
            shutil.rmtree(out_dir, ignore_errors=True)
            return json.dumps({'ok': True, 'files': files, 'msg': msg})
        shutil.rmtree(out_dir, ignore_errors=True)
        return json.dumps({'ok': False, 'error': msg})
    except Exception as e:
        shutil.rmtree(out_dir, ignore_errors=True)
        return json.dumps({'ok': False, 'error': str(e)})

def fingerprint_file_data(fname):
    path = os.path.join(TMP, fname)
    result = {'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()}
    ext = os.path.splitext(fname)[1].lower()
    img_exts = {'.png','.jpg','.jpeg','.bmp','.gif','.tiff','.webp'}
    if ext in img_exts:
        try:
            from PIL import Image
            import imagehash
            img = Image.open(path)
            result['ahash'] = str(imagehash.average_hash(img))
            result['dhash'] = str(imagehash.dhash(img))
            result['phash'] = str(imagehash.phash(img))
            try:
                result['whash'] = str(imagehash.whash(img))
            except:
                pass
            result['width'] = img.width
            result['height'] = img.height
            result['format'] = img.format
            img.close()
        except Exception as e:
            result['image_error'] = str(e)
    return json.dumps(result)

def read_metadata_web(fname):
    path = os.path.join(TMP, fname)
    result = {'file': fname, 'size': os.path.getsize(path)}
    from PIL import Image
    from PIL.ExifTags import TAGS
    try:
        img = Image.open(path)
        result['image'] = {'width': img.width, 'height': img.height, 'mode': img.mode, 'format': img.format}
        exif_data = img._getexif()
        if exif_data:
            exif = {}
            for k, v in exif_data.items():
                tag = TAGS.get(k, k)
                val = str(v)
                if len(val) > 200:
                    val = val[:197] + '...'
                exif[tag] = val
            result['exif'] = exif
        img.close()
    except Exception as e:
        result['error'] = str(e)
    return json.dumps(result, ensure_ascii=False)

def hash_file_web(fname):
    path = os.path.join(TMP, fname)
    sha = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            sha.update(chunk)
    return json.dumps({'file': fname, 'sha256': sha.hexdigest()})
    `);

    ready = true;
    status.textContent = 'Ready';
    status.className = 'badge badge-success';
    console.log('Pyodide ready');
  } catch (e) {
    status.textContent = 'Error';
    status.className = 'badge badge-warning';
    console.error('Pyodide init error:', e);
  }
}

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
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');
  const nav = document.querySelector(`nav a[data-page="${name}"]`);
  if (nav) nav.classList.add('active');
}

function switchWmTab(mode) {
  document.querySelectorAll('.tab-btn[data-wm-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('wm-embed').style.display = mode === 'embed' ? '' : 'none';
  document.getElementById('wm-extract').style.display = mode === 'extract' ? '' : 'none';
  document.querySelector(`.tab-btn[data-wm-tab="${mode}"]`).classList.add('active');
}

function switchTsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ts-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ts-hash').style.display = mode === 'hash' ? '' : 'none';
  document.getElementById('ts-ots').style.display = mode === 'ots' ? '' : 'none';
  document.querySelector(`.tab-btn[data-ts-tab="${mode}"]`).classList.add('active');
}

function writeFile(name, data) {
  pyodide.FS.writeFile('/tmp/redosan/' + name, new Uint8Array(data));
}

async function watermarkEmbed() {
  const btn = document.getElementById('wm-btn');
  const spinner = document.getElementById('wm-spinner');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const type = parseInt(document.getElementById('wm-type').value);
  const pw = document.getElementById('wm-password').value || null;
  const imgFile = document.getElementById('wm-image').files[0];
  if (!imgFile) { output.textContent = 'Please select an image'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const imgData = await imgFile.arrayBuffer();
    writeFile('input.png', imgData);
    writeFile('secret.bin', imgData); // embed image as secret

    const jsonStr = pyodide.runPython(`embed_watermark(${type}, ${pw ? repr(pw) : 'None'})`);
    const result = JSON.parse(jsonStr);
    if (result.ok) {
      const blob = base64ToBlob(result.data, 'image/png');
      const url = URL.createObjectURL(blob);
      const report = JSON.stringify({ algorithm: type, message: result.msg, status: 'ok' }, null, 2);
      const reportBlob = new Blob([report], { type: 'application/json' });
      const reportUrl = URL.createObjectURL(reportBlob);
      dl.innerHTML = `
        <a href="${url}" download="watermarked.png" class="btn">Download watermarked.png</a>
        <a href="${reportUrl}" download="watermark_report.json" class="btn" style="margin-left:8px">Download Report (JSON)</a>
      `;
      output.textContent = result.msg;
    } else {
      output.textContent = 'Error: ' + result.error;
    }
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

async function watermarkExtract() {
  const btn = document.getElementById('wm-btn-ex');
  const spinner = document.getElementById('wm-spinner');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const type = parseInt(document.getElementById('wm-type-ex').value);
  const pw = document.getElementById('wm-password-ex').value || null;
  const imgFile = document.getElementById('wm-image-ex').files[0];
  if (!imgFile) { output.textContent = 'Please select a stego image'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const imgData = await imgFile.arrayBuffer();
    writeFile('stego.png', imgData);
    const jsonStr = pyodide.runPython(`extract_watermark(${type}, ${pw ? repr(pw) : 'None'})`);
    const result = JSON.parse(jsonStr);
    if (result.ok) {
      let text = result.msg + '\n';
      const reportData = { algorithm: type, message: result.msg, files: {}, status: 'ok' };
      for (const [name, b64] of Object.entries(result.files || {})) {
        text += `\n  ${name}: extracted`;
        reportData.files[name] = `${b64.length > 100 ? '...' : ''}`;
        const blob = base64ToBlob(b64, 'application/octet-stream');
        const url = URL.createObjectURL(blob);
        dl.innerHTML += `<a href="${url}" download="${name}" class="btn" style="margin:4px">Download ${name}</a> `;
      }
      const report = JSON.stringify(reportData, null, 2);
      const reportBlob = new Blob([report], { type: 'application/json' });
      const reportUrl = URL.createObjectURL(reportBlob);
      dl.innerHTML += `<a href="${reportUrl}" download="extract_report.json" class="btn" style="margin:4px">Download Report (JSON)</a>`;
      output.textContent = text;
    } else {
      output.textContent = 'Error: ' + result.error;
    }
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

async function fingerprintFile() {
  const btn = document.getElementById('fp-btn');
  const spinner = document.getElementById('fp-spinner');
  const resultDiv = document.getElementById('fp-result');
  const output = document.getElementById('fp-output');
  const dl = document.getElementById('fp-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('fp-file').files[0];
  if (!file) { output.textContent = 'Please select a file'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    const jsonStr = pyodide.runPython(`fingerprint_file_data(${repr(file.name)})`);
    const pretty = JSON.stringify(JSON.parse(jsonStr), null, 2);
    output.textContent = pretty;
    // Download as JSON
    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = `<a href="${url}" download="${file.name}.fingerprint.json" class="btn">Download JSON</a>`;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

function repr(s) { return JSON.stringify(s); }

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function readMetadata() {
  const btn = document.getElementById('md-btn');
  const spinner = document.getElementById('md-spinner');
  const resultDiv = document.getElementById('md-result');
  const output = document.getElementById('md-output');
  const dl = document.getElementById('md-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('md-file').files[0];
  if (!file) { output.textContent = 'Please select an image'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    const jsonStr = pyodide.runPython(`read_metadata_web(${repr(file.name)})`);
    const pretty = JSON.stringify(JSON.parse(jsonStr), null, 2);
    output.textContent = pretty;
    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = `<a href="${url}" download="${file.name}.metadata.json" class="btn">Download JSON</a>`;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

async function timestampHash() {
  const btn = document.getElementById('ts-btn');
  const spinner = document.getElementById('ts-spinner');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('ts-file').files[0];
  if (!file) { output.textContent = 'Please select a file'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    const jsonStr = pyodide.runPython(`hash_file_web(${repr(file.name)})`);
    const result = JSON.parse(jsonStr);
    output.textContent = `SHA-256: ${result.sha256}`;
    const lines = `SHA-256 (${file.name}) = ${result.sha256}`;
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = `<a href="${url}" download="${file.name}.sha256.txt" class="btn">Download .sha256.txt</a>`;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

async function timestampOTS() {
  const btn = document.getElementById('ts-ots-btn');
  const spinner = document.getElementById('ts-spinner');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  if (!ready) { output.textContent = 'Pyodide still loading...'; resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('ts-ots-file').files[0];
  if (!file) { output.textContent = 'Please select a file'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    // Write file to Pyodide FS
    const data = await file.arrayBuffer();
    writeFile(file.name, data);

    // Compute SHA-256 (always works)
    const jsonStr = pyodide.runPython(`hash_file_web(${repr(file.name)})`);
    const result = JSON.parse(jsonStr);
    const sha256 = result.sha256;

    // Try to install opentimestamps, fall back to SHA-256 only
    let otsOk = false;
    try {
      pyodide.runPython(`
import micropip, sys
try:
    import opentimestamps
except:
    pass
`);
      const micropip = pyodide.pyimport('micropip');
      await micropip.install('opentimestamps');
      otsOk = true;
    } catch (e) {
      otsOk = false;
    }

    if (otsOk) {
      output.textContent = `SHA-256: ${sha256}\n\nOpenTimestamps is available in browser. Creating timestamp...`;
      // Future: implement full OTS stamp when the library supports it in Pyodide
    } else {
      output.textContent = `SHA-256: ${sha256}\n\nOpenTimestamps library cannot run in-browser (requires native crypto extensions). Use the desktop app or install opentimestamps locally for full timestamp verification.`;
    }

    // Always offer SHA-256 download
    const lines = `SHA-256 (${file.name}) = ${sha256}`;
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = `<a href="${url}" download="${file.name}.sha256.txt" class="btn">Download .sha256.txt</a>`;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

init();
