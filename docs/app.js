let pyodide = null;
let ready = false;
let initError = null;

function setStatus(msg, cls) {
  const el = document.getElementById('py-status');
  if (el) { el.textContent = msg; if (cls) el.className = 'badge badge-' + cls; }
}

async function init() {
  setStatus('Loading Pyodide...', 'muted');
  try {
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/' });
    setStatus('Installing packages...', 'muted');
    await pyodide.loadPackage('micropip');
    const micropip = pyodide.pyimport('micropip');
    await micropip.install('Pillow');
    await micropip.install('imagehash');
    setStatus('Loading modules...', 'muted');

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
    with open(path, 'rb') as f:
        data = f.read()
    ext = os.path.splitext(fname)[1].lower()
    img_exts = {'.png','.jpg','.jpeg','.bmp','.gif','.tiff','.webp'}

    hashes = {}
    hashes['SHA-1'] = hashlib.sha1(data).hexdigest()
    hashes['SHA-224'] = hashlib.sha224(data).hexdigest()
    hashes['SHA-256'] = hashlib.sha256(data).hexdigest()
    hashes['SHA-384'] = hashlib.sha384(data).hexdigest()
    hashes['SHA-512'] = hashlib.sha512(data).hexdigest()
    hashes['SHA-3_224'] = hashlib.sha3_224(data).hexdigest()
    hashes['SHA-3_256'] = hashlib.sha3_256(data).hexdigest()
    hashes['SHA-3_384'] = hashlib.sha3_384(data).hexdigest()
    hashes['SHA-3_512'] = hashlib.sha3_512(data).hexdigest()
    hashes['MD5'] = hashlib.md5(data).hexdigest()
    hashes['BLAKE2b'] = hashlib.blake2b(data).hexdigest()
    hashes['BLAKE2s'] = hashlib.blake2s(data).hexdigest()

    result = {
        'file_info': {
            'file_name': fname,
            'file_size_bytes': os.path.getsize(path),
        },
        'hashes': hashes,
        'perceptual_hashes': {},
    }

    if ext in img_exts:
        try:
            from PIL import Image
            import imagehash
            img = Image.open(path)
            ph = {}
            ph['ahash'] = str(imagehash.average_hash(img))
            ph['dhash'] = str(imagehash.dhash(img))
            ph['phash'] = str(imagehash.phash(img))
            try:
                ph['whash'] = str(imagehash.whash(img))
            except:
                pass
            result['perceptual_hashes'] = ph
            result['file_info']['width'] = img.width
            result['file_info']['height'] = img.height
            result['file_info']['format'] = img.format
            img.close()
        except Exception as e:
            result['file_info']['image_error'] = str(e)
    return json.dumps(result)

def read_metadata_web(fname):
    path = os.path.join(TMP, fname)
    result = {'file': fname, 'size': os.path.getsize(path), 'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()}
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

def ots_create_web(fname):
    path = os.path.join(TMP, fname)
    try:
        from opentimestamps.core.timestamp import DetachedTimestampFile
        from opentimestamps.core.op import OpSHA256
        from opentimestamps.core.serialize import StreamSerializationContext
        import io, base64

        with open(path, 'rb') as f:
            dtf = DetachedTimestampFile.from_fd(OpSHA256(), f)

        # Try calendar submission
        try:
            from opentimestamps.calendar import RemoteCalendar, DEFAULT_AGGREGATORS
            for url in DEFAULT_AGGREGATORS:
                try:
                    cal = RemoteCalendar(url)
                    cal_timestamp = cal.submit(dtf.timestamp.msg)
                    dtf.timestamp.merge(cal_timestamp)
                    break
                except:
                    continue
        except:
            pass

        buf = io.BytesIO()
        ctx = StreamSerializationContext(buf)
        dtf.serialize(ctx)
        ots_bytes = buf.getvalue()
        return json.dumps({
            'ok': True,
            'ots_b64': base64.b64encode(ots_bytes).decode(),
            'sha256': dtf.timestamp.msg.hex()
        })
    except Exception as e:
        return json.dumps({'ok': False, 'error': str(e)})

def ots_verify_web(fname, ots_fname):
    path = os.path.join(TMP, fname)
    ots_path = os.path.join(TMP, ots_fname)
    try:
        from opentimestamps.core.timestamp import DetachedTimestampFile
        from opentimestamps.core.op import OpSHA256
        from opentimestamps.core.serialize import BytesDeserializationContext

        with open(path, 'rb') as f:
            dtf = DetachedTimestampFile.from_fd(OpSHA256(), f)
        current_digest = dtf.timestamp.msg

        with open(ots_path, 'rb') as f:
            data = f.read()
        ctx = BytesDeserializationContext(data)
        ots_dtf = DetachedTimestampFile.deserialize(ctx)
        ots_digest = ots_dtf.timestamp.msg

        match = current_digest == ots_digest
        return json.dumps({
            'ok': True,
            'match': match,
            'file_sha256': current_digest.hex(),
            'ots_sha256': ots_digest.hex()
        })
    except Exception as e:
        return json.dumps({'ok': False, 'error': str(e)})
    `);

    ready = true;
    setStatus('Ready', 'success');
    console.log('Pyodide ready');
  } catch (e) {
    initError = e;
    setStatus('Load failed', 'warning');
    console.error('Pyodide init error:', e);
    // Show retry button
    const nav = document.querySelector('nav');
    if (nav) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'font-size:0.75rem;padding:4px 12px;margin-left:8px';
      btn.textContent = 'Retry';
      btn.onclick = () => { initError = null; setStatus('Loading...', 'muted'); btn.remove(); init(); };
      nav.appendChild(btn);
    }
  }
}

function checkReady() {
  if (ready) return true;
  const nav = document.querySelector('nav');
  if (initError) {
    setStatus('Click Retry', 'warning');
  }
  return false;
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

function switchOtsTab(mode) {
  document.querySelectorAll('.tab-btn[data-ots-tab]').forEach(b => b.classList.remove('active'));
  document.getElementById('ots-create').style.display = mode === 'create' ? '' : 'none';
  document.getElementById('ots-verify').style.display = mode === 'verify' ? '' : 'none';
  document.querySelector(`.tab-btn[data-ots-tab="${mode}"]`).classList.add('active');
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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('fp-file').files[0];
  if (!file) { output.textContent = 'Please select a file'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    const jsonStr = pyodide.runPython(`fingerprint_file_data(${repr(file.name)})`);
    const result = JSON.parse(jsonStr);
    const pretty = JSON.stringify(result, null, 2);

    // Build formatted display
    let html = '<table class="meta-table">';
    html += `<tr><td>File</td><td>${escHtml(result.file_info.file_name)}</td></tr>`;
    html += `<tr><td>Size</td><td>${(result.file_info.file_size_bytes / 1024).toFixed(1)} KB</td></tr>`;
    if (result.file_info.width) {
      html += `<tr><td>Dimensions</td><td>${result.file_info.width} x ${result.file_info.height}</td></tr>`;
      html += `<tr><td>Format</td><td>${result.file_info.format}</td></tr>`;
    }
    html += '</table>';

    // Hash families table
    const familyOrder = [
      { label: 'SHA-2', keys: ['SHA-1','SHA-224','SHA-256','SHA-384','SHA-512'] },
      { label: 'SHA-3', keys: ['SHA-3_224','SHA-3_256','SHA-3_384','SHA-3_512'] },
      { label: 'MD', keys: ['MD5'] },
      { label: 'BLAKE2', keys: ['BLAKE2b','BLAKE2s'] },
    ];
    for (const family of familyOrder) {
      html += `<div style="margin-top:12px;font-weight:700;font-size:0.85rem">${family.label}</div>`;
      html += '<table class="meta-table">';
      for (const key of family.keys) {
        const v = result.hashes[key];
        if (v) html += `<tr><td style="width:100px">${key}</td><td><code style="font-size:0.65rem">${v}</code></td></tr>`;
      }
      html += '</table>';
    }

    // Perceptual hashes
    if (result.perceptual_hashes && Object.keys(result.perceptual_hashes).length > 0) {
      html += `<div style="margin-top:12px;font-weight:700;font-size:0.85rem">Perceptual (image hashes)</div>`;
      html += '<table class="meta-table">';
      for (const [k, v] of Object.entries(result.perceptual_hashes)) {
        html += `<tr><td style="width:100px">${k}</td><td><code style="font-size:0.65rem">${v}</code></td></tr>`;
      }
      html += '</table>';
    }

    output.innerHTML = html;

    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    dl.innerHTML = `<a href="${url}" download="${file.name}.fingerprint.json" class="btn">Download JSON</a>`;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

function repr(s) { return JSON.stringify(s); }

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('md-file').files[0];
  if (!file) { output.textContent = 'Please select an image'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    const jsonStr = pyodide.runPython(`read_metadata_web(${repr(file.name)})`);
    const result = JSON.parse(jsonStr);
    const pretty = JSON.stringify(result, null, 2);

    let html = `<table class="meta-table">`;
    html += `<tr><td>File</td><td>${escHtml(result.file)}</td></tr>`;
    html += `<tr><td>Size</td><td>${(result.size / 1024).toFixed(1)} KB</td></tr>`;
    html += `<tr><td>SHA-256</td><td><code>${result.sha256}</code></td></tr>`;
    if (result.image) {
      html += `<tr><td>Dimensions</td><td>${result.image.width} x ${result.image.height}</td></tr>`;
      html += `<tr><td>Mode</td><td>${result.image.mode}</td></tr>`;
      html += `<tr><td>Format</td><td>${result.image.format}</td></tr>`;
    }
    if (result.exif) {
      html += `<tr><td colspan="2" style="font-weight:700;padding-top:12px">EXIF</td></tr>`;
      for (const [k, v] of Object.entries(result.exif)) {
        if (v && v !== '0') html += `<tr><td style="padding-left:12px">${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`;
      }
    }
    if (result.error) {
      html += `<tr><td style="color:var(--danger)">Error</td><td>${escHtml(result.error)}</td></tr>`;
    }
    html += `</table>`;
    output.innerHTML = html;

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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
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

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('ts-ots-file').files[0];
  if (!file) { output.textContent = 'Please select a file'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    writeFile(file.name, data);
    output.textContent = 'Loading OpenTimestamps...';

    // Load cryptography WASM package first, then install opentimestamps
    let otsReady = false;
    try {
      await pyodide.loadPackage('cryptography');
      const micropip = pyodide.pyimport('micropip');
      await micropip.install('opentimestamps');
      otsReady = true;
    } catch (e) {
      otsReady = false;
    }

    if (!otsReady) {
      // Fallback: just SHA-256
      const jsonStr = pyodide.runPython(`hash_file_web(${repr(file.name)})`);
      const result = JSON.parse(jsonStr);
      output.textContent = `OpenTimestamps unavailable (cryptography not in Pyodide). SHA-256: ${result.sha256}`;
      const lines = `SHA-256 (${file.name}) = ${result.sha256}`;
      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      dl.innerHTML = `<a href="${url}" download="${file.name}.sha256.txt" class="btn">Download .sha256.txt</a>`;
      btn.disabled = false; spinner.style.display = 'none';
      return;
    }

    // Create OTS timestamp
    const jsonStr = pyodide.runPython(`ots_create_web(${repr(file.name)})`);
    const result = JSON.parse(jsonStr);
    if (!result.ok) throw new Error(result.error);

    const sha256 = result.sha256;
    const otsBlob = base64ToBlob(result.ots_b64, 'application/octet-stream');
    const otsUrl = URL.createObjectURL(otsBlob);
    const shaLines = `SHA-256 (${file.name}) = ${sha256}`;
    const shaBlob = new Blob([shaLines], { type: 'text/plain' });
    const shaUrl = URL.createObjectURL(shaBlob);

    output.innerHTML = `SHA-256: <code>${sha256}</code><br><br>.ots file created. Calendar submission attempted (may fail due to CORS in browser).`;
    dl.innerHTML = `
      <a href="${otsUrl}" download="${file.name}.ots" class="btn">Download .ots</a>
      <a href="${shaUrl}" download="${file.name}.sha256.txt" class="btn" style="margin-left:8px">Download .sha256.txt</a>
    `;
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

async function verifyOTS() {
  const btn = document.getElementById('ts-verify-btn');
  const spinner = document.getElementById('ts-spinner');
  const resultDiv = document.getElementById('ts-result');
  const output = document.getElementById('ts-output');
  const dl = document.getElementById('ts-download');

  if (!ready) { output.textContent = 'Python engine ' + (initError ? 'failed to load. Click Retry above.' : 'still loading on mobile — please wait 10-30s...'); resultDiv.style.display = 'block'; return; }
  const file = document.getElementById('ts-verify-file').files[0];
  const otsFile = document.getElementById('ts-ots-proof').files[0];
  if (!file || !otsFile) { output.textContent = 'Please select both a file and its .ots proof'; resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner.style.display = 'block';
  resultDiv.style.display = 'none'; dl.innerHTML = '';

  try {
    const data = await file.arrayBuffer();
    const otsData = await otsFile.arrayBuffer();
    writeFile(file.name, data);
    writeFile(otsFile.name, otsData);

    // Try loading OTS library if not already loaded
    try {
      await pyodide.loadPackage('cryptography');
      const micropip = pyodide.pyimport('micropip');
      await micropip.install('opentimestamps');
    } catch (e) { /* if already loaded, fine */ }

    const jsonStr = pyodide.runPython(`ots_verify_web(${repr(file.name)}, ${repr(otsFile.name)})`);
    const result = JSON.parse(jsonStr);
    if (!result.ok) throw new Error(result.error);

    if (result.match) {
      output.innerHTML = `<span style="color:var(--success);font-weight:700">VERIFIED</span> — SHA-256 hash matches the .ots proof.<br><br>File hash: <code style="font-size:0.7rem">${result.file_sha256}</code><br>OTS hash:  <code style="font-size:0.7rem">${result.ots_sha256}</code>`;
    } else {
      output.innerHTML = `<span style="color:var(--danger);font-weight:700">MISMATCH</span> — The file has been modified or the .ots proof is for a different file.<br><br>File hash: <code style="font-size:0.7rem">${result.file_sha256}</code><br>OTS hash:  <code style="font-size:0.7rem">${result.ots_sha256}</code>`;
    }
  } catch (e) { output.textContent = 'Error: ' + e.message; }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner.style.display = 'none';
}

init();
