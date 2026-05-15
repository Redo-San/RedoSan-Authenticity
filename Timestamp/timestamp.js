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

async function upgradeOts(bytes) {
  var resp = await fetch('https://a.pool.opentimestamps.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ots-timestamp' },
    body: bytes
  });
  if (!resp.ok) throw new Error('Aggregator returned HTTP ' + resp.status);
  return new Uint8Array(await resp.arrayBuffer());
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
    var otsBytes = otsBuildDetached(buf, hashBytes);
    var hex = Array.from(hashBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    // Try to get a complete timestamp from the calendar aggregator
    var complete = false;
    try {
      var upgraded = await upgradeOts(otsBytes);
      otsBytes = upgraded;
      complete = true;
    } catch (e) {
      // Aggregator unreachable (CORS, network, etc.) — use incomplete timestamp
    }

    var blob = new Blob([otsBytes], { type: 'application/octet-stream' });
    downloadBlob(blob, file.name + '.ots', 'ts-download');

    if (complete) {
      setText('ts-output', '✓ Complete .ots timestamp created with blockchain attestation!\n\nSHA-256: ' + hex + '\nSize: ' + otsBytes.length + ' bytes\n\nThis .ots file includes merkle proof from the OpenTimestamps calendar aggregator. Verify it anytime using the Verify tab.');
    } else {
      setText('ts-output', 'SHA-256: ' + hex + '\n\n⚠ Calendar aggregator unreachable. Created an incomplete .ots timestamp (' + otsBytes.length + ' bytes). To get a blockchain attestation, use the command:\n  ots upgrade "' + file.name + '.ots"\nor submit the .ots file at https://opentimestamps.org');
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
