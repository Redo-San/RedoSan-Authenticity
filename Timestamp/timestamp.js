// ── Timestamp UI handlers (SHA-256 + OTS) ──

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
    setText('ts-output', 'SHA-256: ' + sha + '\n\nOpenTimestamps (.ots creation) requires an external server. SHA-256 hash is shown for manual verification.');
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
    setText('ts-output', 'File SHA-256: ' + sha + '\n\nOTS verification requires an external server. SHA-256 hash is shown for manual verification.');
    const blob = new Blob(['SHA-256 (' + file.name + ') = ' + sha], { type: 'text/plain' });
    downloadBlob(blob, file.name + '.sha256.txt', 'ts-download');
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}
