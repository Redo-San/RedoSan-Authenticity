(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Watermark embed/extract orchestrators + UI handlers ──

async function watermarkEmbed(type, imageFile, secretFile, password) {
    if (type !== 5 && type !== 8 && (!password || !password.trim()))
        return { ok: false, error: 'Password is required for this algorithm' };
    const [imgResult, secretBuf] = await Promise.all([loadImage(imageFile), secretFile.arrayBuffer()]); 
    const secret = new Uint8Array(secretBuf);
    const { imgData, canvas, w, h } = imgResult;
    
    var key = password ? await pw_key(password) : new Uint8Array(0);
    
    // Format: [len (4 plaintext)] + [xor_bytes([0xAA,0xBB || secret], key)]
    // len = 2 + secret.length (includes magic marker)
    const magic = new Uint8Array([0xAA, 0xBB]);
    const rawData = new Uint8Array(2 + secret.length);
    rawData.set(magic); rawData.set(secret, 2);
    const xored = xor_bytes(rawData, key);
    const lenBytes = pack32(2 + secret.length);
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes); payload.set(xored, 4);
    const payloadBits = bits(payload);
    
    const maxPixels = w * h * 3;
    
    if (type === 1) {
        if (payloadBits.length > maxPixels) return { ok: false, error: `Image too small: need ${payloadBits.length} bits, have ${maxPixels}` };
        wm1_embed(imgData, payloadBits);
        imgResult.ctx.putImageData(imgData, 0, 0);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 1 (Spatial LSB): ${secret.length} bytes hidden` };
    }
    
    else if (type === 2 || type === 4 || type === 5 || type === 7 || type === 9) {
        const cap = maxDCTBits(w, h, 11);
        if (type === 4) {
            if (payloadBits.length * 3 > cap) return { ok: false, error: 'Secret too large for redundant embedding' };
        } else if (type !== 5) {
            if (payloadBits.length > cap) return { ok: false, error: `Secret too large: image supports ~${Math.floor(cap/8)} bytes` };
        }
        
        const ycbcr = rgbToYcbcr(imgData);
        
        if (type === 2) {
            embedInDCT(ycbcr.Y, w, h, payloadBits, 25);
        } else if (type === 4) {
            const triple = payloadBits.repeat(3);
            embedInDCT(ycbcr.Y, w, h, triple, 30);
        } else if (type === 5) {
            const sig = new TextEncoder().encode('RedoSanZeroBit');
            const sigBits = bits(sig);
            embedInDCT(ycbcr.Y, w, h, sigBits, 25);
        } else if (type === 7) {
            embedInDCT(ycbcr.Y, w, h, payloadBits, 20);
        } else if (type === 9) {
            embedInDCT(ycbcr.Y, w, h, payloadBits, 15);
            embedInDCT(ycbcr.Cb, w, h, payloadBits, 10);
        }
        
        const result = ycbcrToImageData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
        const blob = await canvasToBlob(result.canvas);
        const names = {2:'Frequency DCT',4:'Latent DCT',5:'Zero-bit',7:'Forensic',9:'Imatag-style'};
        const extras = {4:' (redundant x3)',5:'',7:'',9:''};
        return { ok: true, data: blob, msg: `Type ${type} (${names[type]}): ${type === 5 ? 'Presence mark embedded' : secret.length + ' bytes hidden'}${extras[type] || ''}` };
    }
    
    else if (type === 3) {
        if (payloadBits.length > maxPixels) return { ok: false, error: `Image too small` };
        const keyVal = key.length >= 4 ? ((key[0] << 24) | (key[1] << 16) | (key[2] << 8) | key[3]) >>> 0 : 12345;
        wm3_embed(imgData, payloadBits, keyVal);
        imgResult.ctx.putImageData(imgData, 0, 0);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 3 (Neural SS): ${secret.length} bytes hidden` };
    }
    
    else if (type === 6) {
        if (payloadBits.length > maxPixels * 2 / 3) return { ok: false, error: `Image too small` };
        wm6_embed(imgData, payloadBits);
        imgResult.ctx.putImageData(imgData, 0, 0);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 6 (Multi-bit): ${secret.length} bytes hidden (2-bit LSB)` };
    }
    
    else if (type === 8) {
        if (512 > maxPixels) return { ok: false, error: 'Image too small (need at least 171 pixels for 512-bit hash)' };
        await wm8_embed(imgData, secret, key);
        imgResult.ctx.putImageData(imgData, 0, 0);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: 'Type 8 (Fragile): SHA-256 integrity hash embedded' };
    }
    
    return { ok: false, error: `Unknown type ${type}` };
}

async function watermarkExtract(type, imageFile, password) {
    if (type !== 5 && type !== 8 && (!password || !password.trim()))
        return { ok: false, error: 'Password is required for this algorithm' };
    const imgResult = await loadImage(imageFile);
    const { imgData, w, h } = imgResult;
    
    var key = password ? await pw_key(password) : new Uint8Array(0);
    
    const keyVal = key.length >= 4 ? ((key[0] << 24) | (key[1] << 16) | (key[2] << 8) | key[3]) >>> 0 : 12345;
    
    function extractData(bitsStr) {
        if (bitsStr.length < 32) return { data: null, reason: 'no-data' };
        var dlen = parseInt(bitsStr.substr(0, 32), 2);
        if (isNaN(dlen) || dlen <= 0 || dlen > Math.min(w * h * 3 / 8, 100000)) return { data: null, reason: 'no-data' };
        if (bitsStr.length < 32 + dlen * 8) return { data: null, reason: 'no-data' };
        const enc = from_bits(bitsStr.substr(32, dlen * 8));
        const dec = xor_bytes(enc, key);
        if (dec.length >= 2 && dec[0] === 0xAA && dec[1] === 0xBB)
            return { data: dec.slice(2), reason: 'ok' };
        return { data: null, reason: 'bad-password' };
    }
    
    if (type === 1) {
        const b = wm1_extract(imgData);
        const res = b.length >= 32 ? extractData(b) : { data: null, reason: 'no-data' };
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type1.bin': res.data }, msg: `Type 1 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 2) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No watermark found with this algorithm' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: 'No watermark found with this algorithm' };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const res = extractData(b);
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type2.bin': res.data }, msg: `Type 2 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 3) {
        const b = wm3_extract(imgData, keyVal);
        const res = b.length >= 32 ? extractData(b) : { data: null, reason: 'no-data' };
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type3.bin': res.data }, msg: `Type 3 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 4) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No watermark found with this algorithm' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: 'No watermark found with this algorithm' };
        // Type 4 embeds payload 3x redundantly — read all 3 copies
        const totalBits = 32 + dlen * 8 * 3;
        b = extractFromDCT(ycbcr.Y, w, h, totalBits);
        if (b.length < totalBits) return { ok: false, error: 'No watermark found with this algorithm' };
        // Majority vote across 3 copies to validate type 4
        const copy1 = b.substr(32, dlen * 8);
        const copy2 = b.substr(32 + dlen * 8, dlen * 8);
        const copy3 = b.substr(32 + dlen * 8 * 2, dlen * 8);
        let agree12 = 0, agree13 = 0, agree23 = 0;
        for (let i = 0; i < dlen * 8; i++) {
            if (copy1[i] === copy2[i]) agree12++;
            if (copy1[i] === copy3[i]) agree13++;
            if (copy2[i] === copy3[i]) agree23++;
        }
        const maxAgree = Math.max(agree12, agree13, agree23);
        // Type 4 redundancy: expect > 90% agreement between any 2 copies
        if (maxAgree < dlen * 8 * 0.9) return { ok: false, error: 'No watermark found with this algorithm' };
        const res = extractData(b);
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type4.bin': res.data }, msg: `Type 4 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 5) {
        const ycbcr = rgbToYcbcr(imgData);
        const sig = new TextEncoder().encode('RedoSanZeroBit');
        const b = extractFromDCT(ycbcr.Y, w, h, sig.length * 8);
        if (b.length < sig.length * 8) return { ok: false, error: 'No zero-bit watermark detected' };
        const data = from_bits(b.substr(0, sig.length * 8));
        let matches = 0;
        for (let i = 0; i < data.length; i++) if (data[i] === sig[i]) matches++;
        const ratio = matches / sig.length;
        if (ratio > 0.85) return { ok: true, msg: ratio === 1 ? 'Type 5: PRESENCE CONFIRMED - Zero-bit watermark detected' : `Type 5: Presence likely (${Math.round(ratio*100)}% match)` };
        return { ok: false, error: `Type 5: No watermark (only ${Math.round(ratio*100)}% match)` };
    }
    
    else if (type === 6) {
        const b = wm6_extract(imgData);
        const res = b.length >= 32 ? extractData(b) : { data: null, reason: 'no-data' };
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type6.bin': res.data }, msg: `Type 6 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 7) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No watermark found with this algorithm' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: 'No watermark found with this algorithm' };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const res = extractData(b);
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type7.bin': res.data }, msg: `Type 7 extract: ${res.data.length} bytes` };
    }
    
    else if (type === 8) {
        const hash = wm8_extract(imgData, key);
        if (!hash) return { ok: false, error: key && key.length ? 'Wrong password' : 'No hash found' };
        return { ok: true, files: { 'extracted_hash_type8.txt': new TextEncoder().encode(hash) }, msg: `Type 8: Embedded hash: ${hash}` };
    }
    
    else if (type === 9) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No watermark found with this algorithm' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: 'No watermark found with this algorithm' };
        // Type 9 embeds in both Y and Cb — verify Cb matches Y
        const bY = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const bCb = extractFromDCT(ycbcr.Cb, w, h, 32 + dlen * 8);
        if (bY.length < 32 + dlen * 8 || bCb.length < 32 + dlen * 8)
            return { ok: false, error: 'No watermark found with this algorithm' };
        let matches = 0;
        for (let i = 0; i < 32 + dlen * 8; i++) {
            if (bY[i] === bCb[i]) matches++;
        }
        const matchRatio = matches / (32 + dlen * 8);
        if (matchRatio < 0.8) return { ok: false, error: 'No watermark found with this algorithm' };
        const res = extractData(bY);
        if (!res.data) return { ok: false, error: res.reason === 'bad-password' ? 'Wrong password' : 'No watermark found with this algorithm' };
        return { ok: true, files: { 'extracted_type9.bin': res.data }, msg: `Type 9 extract: ${res.data.length} bytes` };
    }
    
    return { ok: false, error: `Unknown type ${type}` };
}

// ── UI Handlers ──

async function handleWatermarkEmbed() {
  const btn = document.getElementById('wm-btn');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  const type = parseInt(getVal('wm-type'));
  const pw = getVal('wm-password');
  const imgFile = await getFile('wm-image');
  if (!imgFile) { setText('wm-output', __('wm.err_select_image')); resultDiv.style.display = 'block'; return; }
  if (!(await validateFileInput(document.getElementById('wm-image')))) { return; }

  if (type !== 5 && type !== 8 && (!pw || !pw.trim())) {
    setText('wm-output', __('wm.err_pw_required'));
    resultDiv.style.display = 'block'; return;
  }

  var secretFile = await getFile('wm-secret');
  if (type !== 5 && type !== 8 && !secretFile) {
    setText('wm-output', __('wm.err_select_secret').replace('{type}', type));
    resultDiv.style.display = 'block'; return;
  }
  if (secretFile) {
    var secretInput = document.getElementById('wm-secret');
    if (secretInput && !(await validateFileInput(secretInput))) { return; }
  }
  if (!secretFile) secretFile = imgFile;

  btn.disabled = true; spinner('wm-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('wm-output', __('wm.processing'));

  try {
    const result = await watermarkEmbed(type, imgFile, secretFile, pw);
    if (result.ok) {
      if (window._wmLastBlobUrl) URL.revokeObjectURL(window._wmLastBlobUrl);
      const imgUrl = URL.createObjectURL(result.data);
      window._wmLastBlobUrl = imgUrl;
      window._wmResult = {
        type: 'embed', algorithm: type, algorithmName: __('algo.' + type, 'Type ' + type),
        message: result.msg, imageName: imgFile.name, secretName: secretFile ? secretFile.name : '',
        password: pw ? '****' : '', timestamp: new Date().toISOString()
      };
      window._currentDownloadHandler = downloadWatermark;
      document.getElementById('dl-modal-title').textContent = 'Download Watermark Result';
      dl.innerHTML = '<a href="' + imgUrl + '" download="watermarked.png" class="btn">' + __('wm.download_btn') + '</a>' +
        '<br><button onclick="showDownloadModal()" class="btn" style="margin-top:8px">' + __('fp.results_btn', 'Download Results') + '</button>';
      setText('wm-output', result.msg);
    } else {
      setText('wm-output', __('wm.error_prefix').replace('{msg}', result.error));
    }
  } catch (e) { setText('wm-output', __('wm.error_prefix').replace('{msg}', e.message)); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('wm-spinner', false);
}

async function updateCapacity() {
  const capEl = document.getElementById('wm-capacity');
  const secretStatusEl = document.getElementById('wm-secret-status');
  const imgFile = await getFile('wm-image');
  if (!imgFile) { capEl.textContent = ''; secretStatusEl.textContent = ''; return; }
  const type = parseInt(getVal('wm-type') || '1', 10);
  try {
    const loaded = await loadImage(imgFile);
    const { w, h } = loaded;
    let bits = 0;
    if (type === 1 || type === 3) {
      bits = w * h * 3;
    } else if (type === 6) {
      bits = Math.floor(w * h * 3 * 2 / 3);
    } else if (type === 2 || type === 4 || type === 5 || type === 7 || type === 9) {
      bits = maxDCTBits(w, h, 11);
      if (type === 4) bits = Math.floor(bits / 3);
    } else if (type === 8) {
      bits = 512;
    }
    const capacityBytes = Math.floor(bits/8);
    const suffix = type === 9 ? __('wm.chrominance_suffix', ' (chrominance redundant)') : type === 4 ? __('wm.redundant_suffix', ' (redundant x3)') : '';
    const capText = __('wm.capacity_label', 'Capacity: ~{bytes} byte{s}{suffix} ({w}×{h} image)').replace('{bytes}', capacityBytes.toLocaleString()).replace('{s}', capacityBytes !== 1 ? 's' : '').replace('{suffix}', suffix).replace('{w}', w).replace('{h}', h);
    capEl.textContent = capText;

    const secretFile = await getFile('wm-secret');
    if (type === 5) {
      secretStatusEl.textContent = '';
    } else if (type === 8) {
      secretStatusEl.textContent = '';
    } else if (!secretFile) {
      const maxSecretBytes = capacityBytes;
      secretStatusEl.innerHTML = `<span style="color:var(--text-muted)">${__('wm.secret_status_max', 'Max secret size: ~{bytes} bytes').replace('{bytes}', maxSecretBytes.toLocaleString())}</span>`;
    } else {
      const secretSize = secretFile.size;
      const effectiveCapacity = capacityBytes;
      if (secretSize <= effectiveCapacity) {
        secretStatusEl.innerHTML = `<span style="color:#4caf50">${__('wm.secret_status_ok', '✓ Secret file: {size} bytes — fits within capacity').replace('{size}', secretSize.toLocaleString())}</span>`;
      } else {
        const excess = secretSize - effectiveCapacity;
        secretStatusEl.innerHTML = `<span style="color:#f44336">${__('wm.secret_status_exceed', '✗ Secret file: {size} bytes — exceeds capacity by {excess} bytes').replace('{size}', secretSize.toLocaleString()).replace('{excess}', excess.toLocaleString())}</span>`;
      }
    }
  } catch(e) { capEl.textContent = ''; secretStatusEl.textContent = ''; }
}

async function detectWatermarkAlgorithm(imgFile, password) {
  const all = [];
  const pw = password || '';
  for (let t = 1; t <= 9; t++) {
    if (t === 5) continue;
    try {
      const r = await watermarkExtract(t, imgFile, pw);
      if (r.ok) all.push({ type: t, msg: r.msg, files: r.files });
    } catch(e) { /* skip */ }
  }
  try {
    const r5 = await watermarkExtract(5, imgFile, '');
    if (r5.ok) all.push({ type: 5, msg: r5.msg });
  } catch(e) { /* skip */ }
  // Deduplicate: group by payload content, keep most specific type per group
  function payloadKey(r) {
    if (!r.files) return 'nofiles';
    const data = Object.values(r.files)[0];
    if (!data) return 'nodata';
    let k = data.length + ':';
    for (let i = 0; i < Math.min(data.length, 64); i++) k += data[i] + ',';
    return k;
  }
  const groups = new Map();
  for (const r of all) {
    const key = payloadKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const priority = [8, 9, 4, 7, 2, 1, 3, 6, 5];
  const results = [];
  for (const [, group] of groups) {
    group.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
    results.push(group[0]);
  }
  return results;
}

async function handleWatermarkExtract() {
  const btn = document.getElementById('wm-btn-ex');
  const resultDiv = document.getElementById('wm-result');
  const output = document.getElementById('wm-output');
  const dl = document.getElementById('wm-download');

  let type = parseInt(getVal('wm-type-ex'));
  const pw = getVal('wm-password-ex');
  const imgFile = await getFile('wm-image-ex');
  if (!imgFile) { setText('wm-output', __('wm.err_select_stego')); resultDiv.style.display = 'block'; return; }
  if (!(await validateFileInput(document.getElementById('wm-image-ex')))) { return; }

  if (type !== 0 && type !== 5 && type !== 8 && (!pw || !pw.trim())) {
    setText('wm-output', __('wm.err_pw_required'));
    resultDiv.style.display = 'block'; return;
  }

  btn.disabled = true; spinner('wm-spinner', true);
  resultDiv.style.display = 'none'; dl.innerHTML = '';
  setText('wm-output', __('wm.processing'));

  function wmErr(err) {
    const m = {
      'Wrong password': __('wm.err_wrong_password'),
      'No watermark found with this algorithm': __('wm.err_no_watermark'),
    };
    return m[err] || err;
  }

  try {
    if (type === 0) {
      setText('wm-output', __('wm.detect_scanning', 'Scanning for watermark algorithm...'));
      const found = await detectWatermarkAlgorithm(imgFile, pw);
      if (found.length === 0) {
        setText('wm-output', __('wm.detect_no_match', 'No watermark detected with any known algorithm.'));
        resultDiv.style.display = 'block';
        btn.disabled = false; spinner('wm-spinner', false);
        return;
      }
      const priority = [8, 9, 4, 7, 2, 1, 3, 6, 5];
      found.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
      type = found[0].type;
      setText('wm-output', __('wm.detect_found', 'Detected algorithm: {algo}').replace('{algo}', __('algo.' + type, 'Type ' + type)) + '...');
    }
    const result = await watermarkExtract(type, imgFile, pw);
    if (result.ok) {
      let textParts = [result.msg];
      dl.innerHTML = '';
      var extractedFiles = {};
      if (result.files) {
        for (const [name, data] of Object.entries(result.files)) {
          textParts.push(name + ': ' + __('wm.extracted'));
          const blob = new Blob([data], { type: 'application/octet-stream' });
          downloadBlob(blob, name, 'wm-download');
          extractedFiles[name] = data.length + ' bytes';
          try {
            var contentStr = new TextDecoder().decode(data);
            if (contentStr.length > 0 && contentStr.length < 5000) {
              textParts.push('<pre style="font-size:0.75rem;background:var(--bg);color:var(--text);padding:10px;border-radius:6px;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all;margin:6px 0">' +
                escHtml(contentStr) + '</pre>');
            }
          } catch(e) {}
        }
      }
      window._wmResult = {
        type: 'extract', algorithm: type, algorithmName: __('algo.' + type, 'Type ' + type),
        message: result.msg, files: extractedFiles,
        password: pw ? '****' : '', imageName: imgFile.name, timestamp: new Date().toISOString()
      };
      window._currentDownloadHandler = downloadWatermark;
      document.getElementById('dl-modal-title').textContent = 'Download Watermark Result';
      dl.innerHTML += '<br><button onclick="showDownloadModal()" class="btn" style="margin-top:8px">' + __('fp.results_btn', 'Download Results') + '</button>';
      output.innerHTML = textParts.join('\n');
    } else {
      let errMsg = __('wm.error_prefix').replace('{msg}', wmErr(result.error));
      if (pw && pw.trim()) {
        errMsg += '\n\n' + __('wm.tip_wrong_algo');
      }
      setText('wm-output', errMsg);
    }
  } catch (e) { setText('wm-output', __('wm.error_prefix').replace('{msg}', e.message)); }
  resultDiv.style.display = 'block';
  btn.disabled = false; spinner('wm-spinner', false);
}

// ── Password visibility toggles ──
function toggleWmPassword() {
  var pwGroup = document.getElementById('wm-password-group');
  if (!pwGroup) return;
  var typeSelect = document.getElementById('wm-type');
  var type = typeSelect ? parseInt(typeSelect.value, 10) : 1;
  pwGroup.style.display = (type !== 5 && type !== 8) ? 'block' : 'none';
}

function toggleWmExtractPassword() {
  var pwGroup = document.getElementById('wm-password-ex-group');
  var typeSelect = document.getElementById('wm-type-ex');
  var type = typeSelect ? parseInt(typeSelect.value, 10) : 0;
  pwGroup.style.display = (type !== 5 && type !== 8) ? 'block' : 'none';
}

// ── Multi-format watermark download ──

function wmToTXT(r) {
  var lines = ['=== RedoSan Authenticity - Watermark Result ===', ''];
  for (var k in r) lines.push(k + ': ' + String(r[k]));
  lines.push('', 'Generated by RedoSan Authenticity');
  return lines.join('\n');
}

function wmToCSV(r) {
  var rows = [['Key', 'Value']];
  for (var k in r) rows.push([k, String(r[k])]);
  return rows.map(function(row) { return row.map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
}

function wmToXML(r) {
  var xml = '<?xml version="1.0"?>\n<watermark>\n';
  for (var k in r) xml += '  <' + k + '>' + escXml(String(r[k])) + '</' + k + '>\n';
  xml += '</watermark>';
  return xml;
}

function wmToHTML(r) {
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Watermark Result</title>';
  h += '<style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:0 20px}';
  h += 'table{width:100%;border-collapse:collapse}td{padding:6px 12px;border:1px solid #ddd;font-size:0.85rem}';
  h += 'td:first-child{font-weight:600;width:160px;background:#f5f5f5}</style></head><body>';
  h += '<h2>Watermark Result</h2><table>';
  for (var k in r) h += '<tr><td>' + k + '</td><td>' + escHtml(String(r[k])) + '</td></tr>';
  h += '</table><p style="font-size:0.75rem;color:#888;margin-top:20px">Generated by RedoSan Authenticity</p></body></html>';
  return h;
}

async function downloadWatermark(format) {
  closeDownloadModal();
  var r = window._wmResult;
  if (!r) return;
  var name = 'watermark_' + r.type;

  if (format === 'pdf') {
    var doc = new jspdf.jsPDF();
    var y = 20;
    doc.setFontSize(16); doc.text('Watermark Result', 14, y); y += 10; doc.setFontSize(10);
    for (var k in r) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(k + ': ' + String(r[k]), 14, y); y += 6;
    }
    doc.setFontSize(8); doc.text('Generated by RedoSan Authenticity', 14, 285);
    downloadBlobSimple(doc.output('blob'), name + '.pdf');
    return;
  }
  if (format === 'doc') {
    var docx = window.docx;
    var children = [];
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Watermark Result', bold: true, size: 28 })], spacing: { after: 200 } }));
    var rows = [];
    for (var kk in r) rows.push([kk, String(r[kk])]);
    children.push(new docx.Table({ rows: rows.map(function(row) { return new docx.TableRow({ children: row.map(function(c) { return new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(c), size: 18 })], spacing: { before: 40, after: 40 } })] }); }) }); }), width: { size: 100, type: docx.WidthType.PERCENTAGE } }));
    var d = new docx.Document({ sections: [{ children: children }] });
    var blob = await docx.Packer.toBlob(d);
    downloadBlobSimple(blob, name + '.docx');
    return;
  }

  var content, ext, mime;
  switch (format) {
    case 'json': content = JSON.stringify(r, null, 2); ext = 'json'; mime = 'application/json'; break;
    case 'csv':  content = wmToCSV(r);  ext = 'csv';  mime = 'text/csv'; break;
    case 'txt':  content = wmToTXT(r);  ext = 'txt';  mime = 'text/plain'; break;
    case 'xml':  content = wmToXML(r);  ext = 'xml';  mime = 'application/xml'; break;
    case 'html': content = wmToHTML(r); ext = 'html'; mime = 'text/html'; break;
  }
  if (content == null) return;
  downloadBlobSimple(new Blob([content], { type: mime }), name + '.' + ext);
}

// ── Live capacity updates ──
document.addEventListener('DOMContentLoaded', function() {
  var imgInput = document.getElementById('wm-image');
  var secretInput = document.getElementById('wm-secret');
  var typeSelect = document.getElementById('wm-type');
  if (imgInput) imgInput.addEventListener('change', updateCapacity);
  if (secretInput) secretInput.addEventListener('change', updateCapacity);
  if (typeSelect) typeSelect.addEventListener('change', updateCapacity);
  
  toggleWmPassword();
  toggleWmExtractPassword();
  
  var embedType = document.getElementById('wm-type');
  if (embedType) embedType.addEventListener('change', toggleWmPassword);
  
  var extractType = document.getElementById('wm-type-ex');
  if (extractType) extractType.addEventListener('change', toggleWmExtractPassword);
});
