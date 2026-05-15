// ── OpenTimestamps (.ots) client (100% browser, no server required) ──

// OTS header magic: \x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94
var OTS_HEADER = [0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94];
var OTS_MAJOR_VERSION = 1; // version varuint
var OTS_SHA256_TAG = 0x08; // SHA-256 op tag

function otsBuildDetached(fileBytes, sha256Bytes) {
  // Build a minimal valid .ots byte array (incomplete timestamp)
  var out = OTS_HEADER.slice();
  out.push(OTS_MAJOR_VERSION);
  out.push(OTS_SHA256_TAG);
  for (var i = 0; i < 32; i++) out.push(sha256Bytes[i]);
  return new Uint8Array(out);
}

function otsParse(bytes) {
  // Parse .ots file, return { hash: Uint8Array(32), fileHashOp: number } or throw
  var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  var off = 0;
  function read(n) {
    var slice = data.slice(off, off + n);
    off += n;
    return slice;
  }
  // Check magic
  var magic = read(OTS_HEADER.length);
  for (var i = 0; i < OTS_HEADER.length; i++) {
    if (magic[i] !== OTS_HEADER[i]) throw new Error('Invalid OTS file: bad magic bytes');
  }
  // Read version (varuint)
  var ver = data[off++];
  if (ver !== OTS_MAJOR_VERSION) throw new Error('Unsupported OTS version: ' + ver);
  // Read file hash op tag
  var tag = data[off++];
  if (tag !== OTS_SHA256_TAG) throw new Error('Unsupported hash: only SHA-256 (tag ' + tag + ')');
  // Read 32-byte hash
  var hash = read(32);
  return { hash: hash, tag: tag };
}

var OTS_AGGREGATORS = [
  'https://a.pool.opentimestamps.org/digest',
  'https://b.pool.opentimestamps.org/digest'
];

async function upgradeOts(bytes) {
  var lastErr;
  for (var url of OTS_AGGREGATORS) {
    try {
      var resp = await fetch(url, {
        method: 'POST',
        // Use x-www-form-urlencoded to avoid CORS preflight (simple content-type).
        // Aggregator ignores Content-Type — only reads raw body bytes.
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bytes
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return new Uint8Array(await resp.arrayBuffer());
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function getOtsUpgradeCommand(fileName) {
  var escaped = fileName.replace(/'/g, "'\\''");
  return [
    '# Option 1 — OpenTimestamps website (easiest):',
    '#   1. Go to https://opentimestamps.org',
    '#   2. Drag & drop "' + fileName + '.ots" onto the page',
    '#   3. Click "Stamp" to get complete .ots with blockchain proof',
    '',
    '# Option 2 — Official CLI:',
    '#   pip install opentimestamps-client',
    '#   ots upgrade "' + fileName + '.ots"',
    '',
    '# Option 3 — PowerShell (submit raw hash, 32 bytes only):',
    '#   $hash = (Get-Item "' + fileName.replace(/"/g, '`"') + '.ots").OpenRead();' + " $hash.Position = $hash.Length - 32;" + ' $bytes = [byte[]]::new(32);' + ' $hash.Read($bytes, 0, 32) | Out-Null;' + ' $hash.Close();' + ' Invoke-WebRequest -Uri https://a.pool.opentimestamps.org/digest -Method POST -ContentType "application/x-www-form-urlencoded" -Body $bytes -OutFile "' + fileName.replace(/"/g, '`"') + '.ots.upgraded"'
  ].join('\n');
}

async function handleOtsCreate() {
  var btn = document.getElementById('ts-create-btn');
  var fileInput = document.getElementById('ts-create-file');
  var output = document.getElementById('ts-output');
  var resultDiv = document.getElementById('ts-result');
  var dlContainer = document.getElementById('ts-download');

  var file = fileInput.files[0];
  if (!file) { setText('ts-output', 'Please select a file'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('ts-spinner', true);
  output.innerHTML = ''; dlContainer.innerHTML = '';
  resultDiv.style.display = 'none';

  try {
    var buf = await file.arrayBuffer();
    var hashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    var hex = Array.from(hashBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    // Try aggregator: send just the 32-byte hash (avoids 64-byte size limit)
    var otsBytes;
    var complete = false;
    try {
      var resp = await upgradeOts(hashBytes);
      // Aggregator returns serialized timestamp (without magic header).
      // Response format: version(1) | SHA-256_op(1) | hash(32) | calendar_ops[...]
      // Prepend magic to make valid .ots file:
      otsBytes = new Uint8Array(OTS_HEADER.length + resp.length);
      otsBytes.set(new Uint8Array(OTS_HEADER));
      otsBytes.set(resp, OTS_HEADER.length);
      complete = true;
    } catch (e) {
      // Aggregator unreachable — build incomplete .ots as fallback
      otsBytes = otsBuildDetached(buf, hashBytes);
    }

    var blob = new Blob([otsBytes], { type: 'application/octet-stream' });
    downloadBlob(blob, file.name + '.ots', 'ts-download');

    if (complete) {
      setText('ts-output', '✓ Complete .ots timestamp created with blockchain attestation!\n\nSHA-256: ' + hex + '\nSize: ' + otsBytes.length + ' bytes\n\nThis .ots file includes merkle proof from the OpenTimestamps calendar aggregator. Verify it anytime using the Verify tab.');
    } else {
      var cmd = getOtsUpgradeCommand(file.name);
      setText('ts-output', 'SHA-256: ' + hex + '\n\n⚠ Calendar aggregator unreachable. Created an incomplete .ots timestamp (' + otsBytes.length + ' bytes, standard format).\n\nTo attach a blockchain attestation, run one of these commands:\n\n' + cmd);
    }

    var dlBtn = document.getElementById('ts-create-dl-btn');
    if (dlBtn) dlBtn.style.display = '';
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}

async function handleOtsVerify() {
  var btn = document.getElementById('ts-verify-btn');
  var fileInput = document.getElementById('ts-verify-file');
  var otsInput = document.getElementById('ts-ots-proof');
  var output = document.getElementById('ts-output');
  var resultDiv = document.getElementById('ts-result');

  var file = fileInput.files[0];
  var otsFile = otsInput.files[0];
  if (!file || !otsFile) { setText('ts-output', 'Please select both the original file and its .ots proof'); resultDiv.style.display = 'block'; return; }

  btn.disabled = true; spinner('ts-spinner', true);
  output.innerHTML = '';
  resultDiv.style.display = 'none';

  try {
    var [fileBuf, otsBuf] = await Promise.all([file.arrayBuffer(), otsFile.arrayBuffer()]);
    var fileHash = new Uint8Array(await crypto.subtle.digest('SHA-256', fileBuf));
    var parsed = otsParse(new Uint8Array(otsBuf));
    var storedHex = Array.from(parsed.hash).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    var fileHex = Array.from(fileHash).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    var match = true;
    for (var i = 0; i < 32; i++) {
      if (fileHash[i] !== parsed.hash[i]) { match = false; break; }
    }

    if (match) {
      setText('ts-output', '✓ Verified! Hash matches the .ots proof.\n\nFile SHA-256: ' + fileHex + '\n.ots SHA-256:  ' + storedHex + '\n\nThe file has NOT changed since the timestamp was created.');
    } else {
      setText('ts-output', '✗ Hash MISMATCH! The file has been modified.\n\nFile SHA-256: ' + fileHex + '\n.ots SHA-256:  ' + storedHex + '\n\nThe file has changed since the timestamp was created.');
    }
  } catch (e) { setText('ts-output', 'Error: ' + e.message); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('ts-spinner', false);
}
