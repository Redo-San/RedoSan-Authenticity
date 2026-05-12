// ── Watermark embed/extract orchestrators + UI handlers ──

async function watermarkEmbed(type, imageFile, secretFile, password) {
    const [imgResult, secretBuf] = await Promise.all([loadImage(imageFile), secretFile.arrayBuffer()]);
    const secret = new Uint8Array(secretBuf);
    const { imgData, canvas, w, h } = imgResult;
    
    if (password !== null && password !== undefined && password !== '') {
        var key = await pw_key(password);
    } else { key = new Uint8Array(0); }
    
    const xored = xor_bytes(secret, key);
    const lenBytes = pack32(secret.length);
    const payload = new Uint8Array(lenBytes.length + xored.length);
    payload.set(lenBytes); payload.set(xored, 4);
    const payloadBits = bits(payload);
    
    const maxPixels = w * h * 3;
    
    if (type === 1) {
        if (payloadBits.length > maxPixels) return { ok: false, error: `Image too small: need ${payloadBits.length} bits, have ${maxPixels}` };
        wm1_embed(imgData, payloadBits);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 1 (Spatial LSB): ${secret.length} bytes hidden` };
    }
    
    else if (type === 2 || type === 4 || type === 5 || type === 7 || type === 9) {
        const cap = maxDCTBits(w, h, 11);
        if (type === 4) {
            if (payloadBits.length * 3 > maxDCTBits(w, h, 11) * 3) return { ok: false, error: 'Secret too large for redundant embedding' };
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
        const keyVal = key.length ? key.reduce((a,b) => (a*31 + b) | 0, 0) : 12345;
        wm3_embed(imgData, payloadBits, keyVal);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 3 (Neural SS): ${secret.length} bytes hidden` };
    }
    
    else if (type === 6) {
        if (payloadBits.length > maxPixels * 2 / 3) return { ok: false, error: `Image too small` };
        wm6_embed(imgData, payloadBits);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: `Type 6 (Multi-bit): ${secret.length} bytes hidden (2-bit LSB)` };
    }
    
    else if (type === 8) {
        if (512 > maxPixels) return { ok: false, error: 'Image too small (need at least 171 pixels for 512-bit hash)' };
        await wm8_embed(imgData, secret);
        const blob = await canvasToBlob(canvas);
        return { ok: true, data: blob, msg: 'Type 8 (Fragile): SHA-256 integrity hash embedded' };
    }
    
    return { ok: false, error: `Unknown type ${type}` };
}

async function watermarkExtract(type, imageFile, password) {
    const imgResult = await loadImage(imageFile);
    const { imgData, w, h } = imgResult;
    
    if (password !== null && password !== undefined && password !== '') {
        var key = await pw_key(password);
    } else { key = new Uint8Array(0); }
    
    const keyVal = key.length ? key.reduce((a,b) => (a*31 + b) | 0, 0) : 12345;
    
    function extractData(bitsStr) {
        if (bitsStr.length < 32) return null;
        const dlen = parseInt(bitsStr.substr(0, 32), 2);
        if (dlen <= 0 || dlen > w * h * 3 / 8) return null;
        if (bitsStr.length < 32 + dlen * 8) return null;
        const enc = from_bits(bitsStr.substr(32, dlen * 8));
        return xor_bytes(enc, key);
    }
    
    if (type === 1) {
        const b = wm1_extract(imgData);
        const data = b.length >= 32 ? extractData(b) : null;
        if (!data) return { ok: false, error: 'No data found' };
        return { ok: true, files: { 'extracted_type1': data }, msg: `Type 1 extract: ${data.length} bytes` };
    }
    
    else if (type === 2) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No data found' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: `Corrupted: invalid size ${dlen}` };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const data = extractData(b);
        if (!data) return { ok: false, error: 'Not enough bits' };
        return { ok: true, files: { 'extracted_type2': data }, msg: `Type 2 extract: ${data.length} bytes` };
    }
    
    else if (type === 3) {
        const b = wm3_extract(imgData, keyVal);
        const data = b.length >= 32 ? extractData(b) : null;
        if (!data) return { ok: false, error: 'No data found' };
        return { ok: true, files: { 'extracted_type3': data }, msg: `Type 3 extract: ${data.length} bytes` };
    }
    
    else if (type === 4) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 96);
        let dlen;
        if (b.length >= 96) {
            const d0 = parseInt(b.substr(0, 32), 2), d1 = parseInt(b.substr(32, 32), 2), d2 = parseInt(b.substr(64, 32), 2);
            dlen = [d0, d1, d2].sort((a,b) => a-b)[1];
        } else {
            b = extractFromDCT(ycbcr.Y, w, h, 32);
            if (b.length < 32) return { ok: false, error: 'No data found' };
            dlen = parseInt(b.substr(0, 32), 2);
        }
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: `Corrupted: invalid size ${dlen}` };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const data = extractData(b);
        if (!data) return { ok: false, error: 'Not enough bits' };
        return { ok: true, files: { 'extracted_type4': data }, msg: `Type 4 extract: ${data.length} bytes` };
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
        const data = b.length >= 32 ? extractData(b) : null;
        if (!data) return { ok: false, error: 'No data found' };
        return { ok: true, files: { 'extracted_type6': data }, msg: `Type 6 extract: ${data.length} bytes` };
    }
    
    else if (type === 7) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No data found' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: `Corrupted` };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const data = extractData(b);
        if (!data) return { ok: false, error: 'Not enough bits' };
        return { ok: true, files: { 'extracted_type7': data }, msg: `Type 7 extract: ${data.length} bytes` };
    }
    
    else if (type === 8) {
        const hash = wm8_extract(imgData);
        if (!hash) return { ok: false, error: 'No hash found' };
        return { ok: true, files: { 'extracted_hash_type8.txt': new TextEncoder().encode(hash) }, msg: `Type 8: Embedded hash: ${hash}` };
    }
    
    else if (type === 9) {
        const ycbcr = rgbToYcbcr(imgData);
        let b = extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) return { ok: false, error: 'No data found' };
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100000) return { ok: false, error: `Corrupted` };
        b = extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
        const data = extractData(b);
        if (!data) return { ok: false, error: 'Not enough bits' };
        return { ok: true, files: { 'extracted_type9': data }, msg: `Type 9 extract: ${data.length} bytes` };
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

async function handleWatermarkExtract() {
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
