(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Digital Passport / Certificate Generator ──
// Generates PDF, DOCX, EPUB with all results + QR verification

function makeCertDataURL(buf, mime) {
  var blob = new Blob([buf], { type: mime || 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

function bufToBase64(buf) {
  var bytes = new Uint8Array(buf);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function bufToDataURL(buf, mime) {
  return 'data:' + (mime || 'application/octet-stream') + ';base64,' + bufToBase64(buf);
}

function hasNonLatinChars(str) {
  return /[^\u0000-\u00ff]/.test(str);
}

// Render text with non-Latin chars (Arabic, etc.) as a canvas image for PDF
function addTextSafe(doc, text, x, y, maxWidthMm, fontSizePt) {
  if (!hasNonLatinChars(text)) {
    doc.text(text, x, y);
    return;
  }
  // Render to canvas and embed as PNG
  var dpr = window.devicePixelRatio || 1;
  var fontSizePx = fontSizePt * 4/3;
  var lineHeightPx = fontSizePx * 1.35;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = fontSizePx + 'px sans-serif';
  var textW = ctx.measureText(text).width;
  var maxW = (maxWidthMm || 180) * 3.78;
  var w = Math.min(textW, maxW);
  var h = lineHeightPx;
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.font = fontSizePx + 'px sans-serif';
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  if (textW > maxW) {
    while (ctx.measureText(text + '…').width > maxW && text.length > 0) text = text.slice(0, -1);
    text += '…';
  }
  ctx.fillText(text, 0, 0);
  var url = canvas.toDataURL('image/png');
  var imgW = w / 3.78;
  var imgH = h / 3.78;
  doc.addImage(url, 'PNG', x, y, imgW, imgH);
}

function loadImageDimensions(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() { resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = function() { resolve({ width: 0, height: 0 }); };
    img.src = dataUrl;
  });
}

async function getFileHashSha256(buf) {
  var hashBuf = await crypto.subtle.digest('SHA-256', buf);
  var arr = new Uint8Array(hashBuf);
  return Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

var CT_AGGREGATORS = [
  'https://a.pool.opentimestamps.org/digest',
  'https://b.pool.opentimestamps.org/digest',
  'https://alice.btc.calendar.opentimestamps.org/digest',
  'https://bob.btc.calendar.opentimestamps.org/digest',
  'https://finney.calendar.eternitywall.com/digest',
  'https://a.pool.eternitywall.com/digest'
];

var OTS_HEADER_MAGIC = [0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94];

function generatePendingOts(hashHex) {
  if (!window.OpenTimestamps) return null;
  try {
    var OTS = window.OpenTimestamps;
    var hash = new Uint8Array(hashHex.match(/.{2}/g).map(function(b) { return parseInt(b, 16); }));
    var detached = OTS.DetachedTimestampFile.fromHash(
      new OTS.Ops.OpSHA256(), hash
    );
    var randomBytes = OTS.Utils.randBytes(16);
    var t1 = detached.timestamp.add(new OTS.Ops.OpAppend(OTS.Utils.arrayToBytes(randomBytes)));
    var sub = t1.add(new OTS.Ops.OpSHA256());
    sub.attestations.push(new OTS.Notary.PendingAttestation('https://a.pool.opentimestamps.org/digest'));
    var bytes = detached.serializeToBytes();
    var b64 = btoa(String.fromCharCode.apply(null, bytes));
    return b64;
  } catch (e) { return null; }
}

async function submitCertTransparency(fileBuf) {
  try {
    var hashBuf = await crypto.subtle.digest('SHA-256', fileBuf);
    var hashBytes = new Uint8Array(hashBuf);
    var hashHex = Array.from(hashBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    var lastErr;
    for (var ui = 0; ui < CT_AGGREGATORS.length; ui++) {
      try {
        var resp = await fetch(CT_AGGREGATORS[ui], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: hashBytes
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var calResp = new Uint8Array(await resp.arrayBuffer());
        // Build full .ots: magic + version + SHA-256 tag + file hash + calendar response
        var fullOts = new Uint8Array(31 + 1 + 1 + 32 + calResp.length);
        fullOts.set(new Uint8Array(OTS_HEADER_MAGIC), 0);
        fullOts[31] = 1;
        fullOts[32] = 0x08;
        fullOts.set(hashBytes, 33);
        fullOts.set(calResp, 65);
        var ctBase64 = btoa(String.fromCharCode.apply(null, fullOts));
        return {
          submitted: true,
          aggregator: CT_AGGREGATORS[ui],
          otsProof: ctBase64,
          hash: hashHex,
          timestamp: new Date().toISOString()
        };
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  } catch (e) {
    var pendingB64 = generatePendingOts(hashHex);
    if (pendingB64) {
      return {
        submitted: true,
        pending: true,
        otsProof: pendingB64,
        hash: hashHex,
        timestamp: new Date().toISOString()
      };
    }
    var friendlyMsg = e.message;
    if (location && location.protocol === 'file:') {
      friendlyMsg = 'Cannot reach timestamp server from file:// protocol (CORS blocked). Serve via HTTP or use the OTS CLI.';
    } else if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
      friendlyMsg = 'All OpenTimestamps calendar servers are unreachable from your network. Use the CLI: node cli timestamp create';
    }
    return {
      submitted: false,
      error: friendlyMsg,
      timestamp: new Date().toISOString()
    };
  }
}

async function collectCertData() {
  await new Promise(function(r) { setTimeout(r, 30); });
  var info = window.simpleUserInfo || {};
  var file = window.simpleFile;
  var buf = window.simpleBuf;
  var results = window.simpleResults || {};
  var data = {
    generatedAt: new Date().toISOString(),
    generator: 'RedoSan Authenticity',
    user: {
      name: info.name || '',
      email: info.email || '',
      phone: info.phone || '',
      website: info.website || '',
      social: info.social || {},
      isArtist: !!info.isArtist,
      music: info.music || {}
    },
    file: { name: file ? file.name : '', size: file ? file.size : 0, type: file ? file.type : '' },
    watermark: !!results.watermark,
    watermarkUrl: results.watermarkUrl || null,
    watermarkAlgo: results.watermarkAlgoName || '',
    watermarkResult: results.watermarkResult || '',
    pixelInjection: !!results['pixel-injection'],
    piResultHtml: stripHtml(results.piResultHtml || ''),
    timestamp: !!results.timestamp,
    tsResult: results.tsResult || '',
    fingerprint: !!results.fingerprint,
    fpResult: results.fpResult || null,
    didSig: results.didSig || (window._didSig || null),
    didIdentity: results.didIdentity || (window._didKeypair ? window._didKeypair.did : ''),
    ct: { submitted: false }
  };
  if (buf && file) {
    var dataUrl = bufToDataURL(buf, file.type);
    var dims = await loadImageDimensions(dataUrl);
    data.file.width = dims.width;
    data.file.height = dims.height;
    data.file.dataUrl = dataUrl;
    data.file.hash = await getFileHashSha256(buf);
  }
  // Submit ORIGINAL FILE to transparency log (fire-and-forget with 10s timeout)
  try {
    var fileData = buf || new Uint8Array();
    var ctPromise = submitCertTransparency(fileData);
    var timeoutPromise = new Promise(function(_, rej) { setTimeout(function() { rej(new Error('CT submission timed out')); }, 10000); });
    var ctResult = await Promise.race([ctPromise, timeoutPromise]);
    ctResult.originalFileHash = data.file.hash || '';
    data.ct = ctResult;
  } catch (e) {
    data.ct = { submitted: false, error: e.message, timestamp: new Date().toISOString() };
  }
  return data;
}

function buildQRVerificationJSON(data) {
  var qr = {
    v: 1,
    gen: data.generator,
    genAt: data.generatedAt,
    file: { n: data.file.name, s: data.file.size, h: data.file.hash || '' },
    dims: data.file.width ? (data.file.width + 'x' + data.file.height) : '',
    user: { n: data.user.name, e: data.user.email }
  };
  if (data.fpResult && data.fpResult.hashes) {
    qr.fp = {};
    var keys = ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3', 'MD5'];
    for (var i = 0; i < keys.length; i++) {
      if (data.fpResult.hashes[keys[i]]) qr.fp[keys[i]] = data.fpResult.hashes[keys[i]];
    }
    if (data.fpResult.perceptual_hashes) {
      for (var key in data.fpResult.perceptual_hashes) {
        if (!qr.fp) qr.fp = {};
        qr.fp['ph_' + key] = data.fpResult.perceptual_hashes[key];
      }
    }
  }
  if (data.didSig && data.didSig.did) {
    qr.did = data.didSig.did.substring(0, 60);
    if (data.didSig.signature) qr.sig = data.didSig.signature.substring(0, 20) + '...';
  } else if (data.didIdentity) {
    qr.did = data.didIdentity.substring(0, 60);
  }
  qr.wm = data.watermark ? 1 : 0;
  qr.pi = data.pixelInjection ? 1 : 0;
  qr.ts = data.timestamp ? 1 : 0;
  return JSON.stringify(qr);
}

function getDocHash(jsonStr) {
  var encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(jsonStr)).then(function(buf) {
    var arr = new Uint8Array(buf);
    return Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

function generateQRDataURL(text, size) {
  var canvas = document.createElement('canvas');
  new QRious({ element: canvas, value: text, size: size || 300, level: 'H', padding: 8 });
  return canvas.toDataURL('image/png');
}

function makeUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function stripHtml(s) {
  if (!s) return '';
  do { var p = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== p);
  return s.replace(/&[^;]+;/g, function(m) {
    var e = { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'" };
    return e[m] || ' ';
  }).replace(/\s+/g, ' ').trim();
}

function escHtml(s) {
  if (s == null) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// ── PDF Certificate ──

async function downloadCertPDF(data) {
  var doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var pw = 210, ph = 297, margin = 15, y = margin;
  var pageW = pw - 2 * margin;
  var img, dims, imgW, imgH, qrDataUrl, qrSize = 50;

  // Load image (only for actual images)
  if (data.file.dataUrl && data.file.width && data.file.height) {
    img = data.file.dataUrl;
    dims = { w: data.file.width, h: data.file.height };
    imgW = pageW;
    imgH = imgW * dims.h / dims.w;
    if (imgH > 120) { imgH = 120; imgW = imgH * dims.w / dims.h; }
  }

  // Generate QR
  var qrVerData = buildQRVerificationJSON(data);
  var docHash = await getDocHash(qrVerData);
  var qrContent = JSON.stringify({ data: JSON.parse(qrVerData), hash: docHash });
  qrDataUrl = generateQRDataURL(qrContent, 400);

  function checkPage(need) {
    if (y + need > ph - margin) { doc.addPage(); y = margin; }
  }

  // Title
  doc.setFontSize(18);
  doc.text('Digital Passport', pw / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(8);
  doc.text('Generated by RedoSan Authenticity — ' + data.generatedAt.replace('T', ' ').substring(0, 19), pw / 2, y, { align: 'center' });
  y += 8;

  // ── 1. User Info ──
  if (data.user.name) {
    checkPage(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Owner', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (data.user.name) { addTextSafe(doc, 'Name: ' + data.user.name, margin, y, pageW, 9); y += 4; }
    if (data.user.email) { addTextSafe(doc, 'Email: ' + data.user.email, margin, y, pageW, 9); y += 4; }
    if (data.user.phone) { addTextSafe(doc, 'Phone: ' + data.user.phone, margin, y, pageW, 9); y += 4; }
    if (data.user.website) { addTextSafe(doc, 'Website: ' + data.user.website, margin, y, pageW, 9); y += 4; }
    y += 2;
  }

  // ── 2. File Info ──
  checkPage(20);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('File Information', margin, y); y += 5;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  addTextSafe(doc, 'Name: ' + data.file.name, margin, y, pageW, 9); y += 4;
  doc.text('Size: ' + fmtSize(data.file.size), margin, y); y += 4;
  if (data.file.width) doc.text('Dimensions: ' + data.file.width + ' x ' + data.file.height + ' px', margin, y); y += (data.file.width ? 4 : 0);
  if (data.file.hash) doc.text('SHA-256: ' + data.file.hash, margin, y); y += (data.file.hash ? 4 : 0);
  y += 2;

  // Embed image
  if (img) {
    checkPage(imgH + 8);
    var imgFmt = data.file.type === 'image/png' ? 'PNG' : 'JPEG';
    doc.addImage(img, imgFmt, (pw - imgW) / 2, y, imgW, imgH);
    y += imgH + 6;
  }

  // ── 3. Watermark ──
  if (data.watermark) {
    checkPage(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Watermark', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Result: ' + (data.watermarkAlgo || 'Completed'), margin, y); y += 4;
    if (data.watermarkResult) {
      doc.setFontSize(7);
      var wmLines = doc.splitTextToSize(data.watermarkResult, pageW);
      doc.text(wmLines, margin, y);
      y += wmLines.length * 3.5;
    }
    y += 2;
  }

  // ── 4. Pixel Injection ──
  if (data.pixelInjection) {
    checkPage(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Pixel Injection', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Result: Completed', margin, y); y += 4;
    if (data.piResultHtml) {
      doc.setFontSize(7);
      var piLines = doc.splitTextToSize(data.piResultHtml, pageW);
      doc.text(piLines, margin, y);
      y += piLines.length * 3.5;
    }
    y += 2;
  }

  // ── 5. Timestamp ──
  if (data.timestamp) {
    checkPage(12);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Timestamp', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (data.tsResult) {
      var tsLines = doc.splitTextToSize(data.tsResult, pageW);
      doc.text(tsLines, margin, y);
      y += tsLines.length * 3.5;
    } else {
      doc.text('Timestamp created successfully.', margin, y); y += 4;
    }
    y += 2;
  }

  // ── 6. Fingerprint (hashes) ──
  if (data.fingerprint && data.fpResult && data.fpResult.hashes) {
    checkPage(16);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Fingerprint (Hashes)', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    var families = [
      { label: 'SHA-1', keys: ['SHA-1'] },
      { label: 'SHA-2', keys: ['SHA-224', 'SHA-256', 'SHA-384', 'SHA-512'] },
      { label: 'SHA-3', keys: ['SHA-3_224', 'SHA-3_256', 'SHA-3_384', 'SHA-3_512'] },
      { label: 'MD', keys: ['MD2', 'MD4', 'MD5'] },
      { label: 'BLAKE', keys: ['BLAKE2b', 'BLAKE2s', 'BLAKE3'] },
      { label: 'Other', keys: ['RIPEMD-160', 'Whirlpool'] }
    ];
    for (var fi = 0; fi < families.length; fi++) {
      var fam = families[fi];
      var has = false;
      for (var ki = 0; ki < fam.keys.length; ki++) {
        if (data.fpResult.hashes[fam.keys[ki]]) { has = true; break; }
      }
      if (!has) continue;
      checkPage(4 + fam.keys.length * 3.5);
      doc.setFont(undefined, 'bold');
      doc.text(fam.label, margin, y); y += 3.5;
      doc.setFont(undefined, 'normal');
      for (ki = 0; ki < fam.keys.length; ki++) {
        var v = data.fpResult.hashes[fam.keys[ki]];
        if (v) {
          doc.text(fam.keys[ki] + ':  ' + v, margin, y);
          y += 3.5;
        }
      }
      y += 1;
      await new Promise(function(r) { setTimeout(r, 0); });
    }
    // Perceptual hashes
    if (data.fpResult.perceptual_hashes) {
      for (var pk in data.fpResult.perceptual_hashes) {
        checkPage(6);
        doc.setFont(undefined, 'bold');
        doc.text(pk, margin, y); y += 3.5;
        doc.setFont(undefined, 'normal');
        doc.text(data.fpResult.perceptual_hashes[pk], margin, y); y += 4;
      }
    }
  }

  // ── 7. DID Signature ──
  if (data.didSig && data.didSig.did) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Decentralized Identity (DID)', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text('DID: ' + data.didSig.did, margin, y); y += 3.5;
    doc.text('Algorithm: ' + (data.didSig.algorithm || 'Ed25519'), margin, y); y += 3.5;
    doc.text('Signed: ' + (data.didSig.timestamp || '').replace('T', ' ').substring(0, 19), margin, y); y += 3.5;
    doc.setFontSize(6);
    var sigLines = doc.splitTextToSize('Signature: ' + (data.didSig.signature || ''), pageW);
    doc.text(sigLines, margin, y);
    y += sigLines.length * 3 + 4;
  } else if (data.didIdentity) {
    checkPage(10);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DID Identity', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text('DID: ' + data.didIdentity, margin, y); y += 4;
  }

  // ── 8. Certificate Transparency ──
  if (data.ct && data.ct.submitted && data.ct.hash) {
    checkPage(12);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Certificate Transparency', margin, y); y += 4.5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(6);
    doc.text('SHA-256: ' + data.ct.hash, margin, y); y += 3;
    if (data.ct.pending) {
      // hash only, no status text
    } else {
      doc.text('Logged: ' + (data.ct.timestamp || '').replace('T', ' ').substring(0, 19), margin, y); y += 3;
      var shortAgg = (data.ct.aggregator || '').replace('https://', '').split('/')[0] || 'OTS calendar';
      doc.text('Transparency log: ' + shortAgg, margin, y); y += 3;
    }
    doc.text('Verifiable at: https://opentimestamps.org', margin, y); y += 6;
  } else if (data.ct) {
    checkPage(8);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Certificate Transparency', margin, y); y += 4.5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(6);
    doc.text('Status: ' + (data.ct.submitted ? 'Submitted' : 'Unavailable — ' + (data.ct.error || 'offline')), margin, y); y += 4;
  }

  // ── 9. QR Verification Code ──
  checkPage(qrSize + 20);
  y += 4;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Verification QR Code', pw / 2, y, { align: 'center' }); y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.text('Scan this QR code to verify the document contents. The QR encodes all', pw / 2, y, { align: 'center' }); y += 3;
  doc.text('verification data (hashes, file info, owner). Compare values with those above.', pw / 2, y, { align: 'center' }); y += 3;
  doc.text('Any mismatch indicates tampering.', pw / 2, y, { align: 'center' }); y += 6;
  doc.addImage(qrDataUrl, 'PNG', (pw - qrSize) / 2, y, qrSize, qrSize);
  y += qrSize + 4;
  // QR text below
  doc.setFontSize(6);
  var lines = doc.splitTextToSize(qrContent, pageW);
  doc.text(lines, margin, y);

  await new Promise(function(r) { setTimeout(r, 0); });
  var blob = doc.output('blob');
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RedoSan_Digital_Passport.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  return blob;
}

// ── DOCX Certificate ──

async function downloadCertDOCX(data) {
  var children = [];

  // Helper: convert data URL to Uint8Array
  function dataURLToUint8Array(dataUrl) {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    return Uint8Array.from(binary, function(c) { return c.charCodeAt(0); });
  }

  // Helper: detect image type from MIME
  function imageTypeFromMime(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';
    if (mime === 'image/gif') return 'gif';
    if (mime === 'image/bmp') return 'bmp';
    return 'png';
  }

  function addParagraph(content) {
    children.push(new docx.Paragraph({ children: content, spacing: { after: 200 } }));
  }

  function addImage(dataUrl, width, height) {
    var mime = (dataUrl.split(',')[0].split(':')[1] || '').split(';')[0];
    var type = imageTypeFromMime(mime);
    var imgData = dataURLToUint8Array(dataUrl);
    addParagraph([
      new docx.ImageRun({
        data: imgData,
        type: type,
        transformation: { width: width, height: height }
      })
    ]);
  }

  function addHeading(text, level) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: text, bold: true, size: level === 1 ? 32 : 24, font: 'Calibri' })],
        spacing: { after: 200 }
      })
    );
  }

  function addBody(text) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: text, size: 20, font: 'Calibri' })],
        spacing: { after: 100 }
      })
    );
  }

  function addLabelValue(label, value) {
    if (!value) return;
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: label + ': ', bold: true, size: 20, font: 'Calibri' }),
          new docx.TextRun({ text: String(value), size: 20, font: 'Calibri' })
        ],
        spacing: { after: 60 }
      })
    );
  }

  // Title
  addHeading('Digital Passport', 1);
  addBody('Generated by RedoSan Authenticity — ' + data.generatedAt.replace('T', ' ').substring(0, 19));

  // 1. User Info
  if (data.user.name) {
    addHeading('Owner', 2);
    addLabelValue('Name', data.user.name);
    addLabelValue('Email', data.user.email);
    addLabelValue('Phone', data.user.phone);
    addLabelValue('Website', data.user.website);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 2. File Info
  addHeading('File Information', 2);
  addLabelValue('Name', data.file.name);
  addLabelValue('Size', fmtSize(data.file.size));
  if (data.file.width) addLabelValue('Dimensions', data.file.width + ' x ' + data.file.height + ' px');
  if (data.file.hash) addLabelValue('SHA-256', data.file.hash);
  children.push(new docx.Paragraph({ spacing: { after: 200 } }));

  // Embed original image
  if (data.file.dataUrl) {
    var imgW = data.file.width || 400;
    var imgH = data.file.height || 400;
    var maxW = 400, maxH = 300;
    var scale = Math.min(maxW / imgW, maxH / imgH, 1);
    var dispW = Math.round(imgW * scale);
    var dispH = Math.round(imgH * scale);
    addImage(data.file.dataUrl, dispW, dispH);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 4. Watermark
  if (data.watermark) {
    addHeading('Watermark', 2);
    addLabelValue('Result', data.watermarkAlgo || 'Completed');
    if (data.watermarkResult) {
      addBody(data.watermarkResult);
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 5. Pixel Injection
  if (data.pixelInjection) {
    addHeading('Pixel Injection', 2);
    addLabelValue('Result', 'Completed');
    if (data.piResultHtml) {
      addBody(data.piResultHtml);
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 6. Timestamp
  if (data.timestamp) {
    addHeading('Timestamp', 2);
    if (data.tsResult) {
      addBody(data.tsResult);
    } else {
      addBody('Timestamp created successfully.');
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 7. Fingerprint
  if (data.fingerprint && data.fpResult && data.fpResult.hashes) {
    addHeading('Fingerprint (Hashes)', 2);
    var families = [
      { label: 'SHA-1', keys: ['SHA-1'] },
      { label: 'SHA-2', keys: ['SHA-224', 'SHA-256', 'SHA-384', 'SHA-512'] },
      { label: 'SHA-3', keys: ['SHA-3_224', 'SHA-3_256', 'SHA-3_384', 'SHA-3_512'] },
      { label: 'MD', keys: ['MD2', 'MD4', 'MD5'] },
      { label: 'BLAKE', keys: ['BLAKE2b', 'BLAKE2s', 'BLAKE3'] },
      { label: 'Other', keys: ['RIPEMD-160', 'Whirlpool'] }
    ];
    for (var fi = 0; fi < families.length; fi++) {
      var fam = families[fi];
      var has = false;
      for (var ki = 0; ki < fam.keys.length; ki++) {
        if (data.fpResult.hashes[fam.keys[ki]]) { has = true; break; }
      }
      if (!has) continue;
      addHeading(fam.label, 2);
      for (ki = 0; ki < fam.keys.length; ki++) {
        var v = data.fpResult.hashes[fam.keys[ki]];
        if (v) addLabelValue(fam.keys[ki], v);
      }
      await new Promise(function(r) { setTimeout(r, 0); });
    }
    // Perceptual hashes
    if (data.fpResult.perceptual_hashes) {
      addHeading('Perceptual Hashes', 2);
      for (var pk in data.fpResult.perceptual_hashes) {
        addLabelValue(pk, data.fpResult.perceptual_hashes[pk]);
      }
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 8. DID Signature
  if (data.didSig && data.didSig.did) {
    addHeading('Decentralized Identity (DID)', 2);
    addLabelValue('DID', data.didSig.did);
    addLabelValue('Algorithm', data.didSig.algorithm || 'Ed25519');
    addLabelValue('Signed', (data.didSig.timestamp || '').replace('T', ' ').substring(0, 19));
    addLabelValue('Signature', (data.didSig.signature || '').substring(0, 64) + '...');
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  } else if (data.didIdentity) {
    addHeading('DID Identity', 2);
    addLabelValue('DID', data.didIdentity);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 9. Certificate Transparency
  if (data.ct && data.ct.submitted && data.ct.hash) {
    addHeading('Certificate Transparency', 2);
    addLabelValue('SHA-256', data.ct.hash);
    if (data.ct.pending) {
      // hash only, no status text
    } else {
      addLabelValue('Logged', (data.ct.timestamp || '').replace('T', ' ').substring(0, 19));
      var shortAgg = (data.ct.aggregator || '').replace('https://', '').split('/')[0] || 'OTS calendar';
      addLabelValue('Transparency log', shortAgg);
    }
    addBody('Verifiable at: https://opentimestamps.org');
    children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  } else if (data.ct) {
    addHeading('Certificate Transparency', 2);
    addBody('Status: ' + (data.ct.submitted ? 'Submitted' : 'Unavailable — ' + (data.ct.error || 'offline')));
    children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  }

  // 10. QR Verification Code
  var qrVerData = buildQRVerificationJSON(data);
  var docHash = await getDocHash(qrVerData);
  var qrContent = JSON.stringify({ data: JSON.parse(qrVerData), hash: docHash });
  var qrDataUrl = generateQRDataURL(qrContent, 400);
  children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  addHeading('Verification QR Code', 2);
  addBody('Scan this QR code to verify the document contents. The QR encodes all verification data (hashes, file info, owner). Any mismatch indicates tampering.');
  addImage(qrDataUrl, 150, 150);
  children.push(new docx.Paragraph({ spacing: { after: 100 } }));

  await new Promise(function(r) { setTimeout(r, 0); });
  var docObj = new docx.Document({ sections: [{ children: children }] });
  var blob = await docx.Packer.toBlob(docObj);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RedoSan_Digital_Passport.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  return blob;
}

// ── EPUB Certificate ──

async function downloadCertEPUB(data) {
  var qrText = buildQRVerificationJSON(data);
  var docHash = await getDocHash(qrText);
  var qrContent = JSON.stringify({ data: JSON.parse(qrText), hash: docHash });
  var qrDataUrl = generateQRDataURL(qrContent, 400);

  var imgBase64 = '';
  if (data.file.dataUrl) {
    imgBase64 = data.file.dataUrl.split(',')[1];
  }
  var qrBase64 = qrDataUrl.split(',')[1];
  var imgMime = data.file.type || 'image/png';

  // Build HTML content
  var userSection = '';
  if (data.user.name) {
    userSection += '<h2>Owner</h2><table>';
    if (data.user.name) userSection += '<tr><td><strong>Name</strong></td><td>' + escHtml(data.user.name) + '</td></tr>';
    if (data.user.email) userSection += '<tr><td><strong>Email</strong></td><td>' + escHtml(data.user.email) + '</td></tr>';
    if (data.user.phone) userSection += '<tr><td><strong>Phone</strong></td><td>' + escHtml(data.user.phone) + '</td></tr>';
    if (data.user.website) userSection += '<tr><td><strong>Website</strong></td><td>' + escHtml(data.user.website) + '</td></tr>';
    userSection += '</table>';
  }

  var fpSection = '';
  if (data.fingerprint && data.fpResult && data.fpResult.hashes) {
    fpSection += '<h2>Fingerprint (Hashes)</h2>';
    var families = [
      { label: 'SHA-1', keys: ['SHA-1'] },
      { label: 'SHA-2', keys: ['SHA-224', 'SHA-256', 'SHA-384', 'SHA-512'] },
      { label: 'SHA-3', keys: ['SHA-3_224', 'SHA-3_256', 'SHA-3_384', 'SHA-3_512'] },
      { label: 'MD', keys: ['MD2', 'MD4', 'MD5'] },
      { label: 'BLAKE', keys: ['BLAKE2b', 'BLAKE2s', 'BLAKE3'] },
      { label: 'Other', keys: ['RIPEMD-160', 'Whirlpool'] }
    ];
    for (var fi = 0; fi < families.length; fi++) {
      var fam = families[fi];
      var has = false;
      for (var ki = 0; ki < fam.keys.length; ki++) {
        if (data.fpResult.hashes[fam.keys[ki]]) { has = true; break; }
      }
      if (!has) continue;
      fpSection += '<h3>' + escHtml(fam.label) + '</h3><table>';
      for (ki = 0; ki < fam.keys.length; ki++) {
        var v = data.fpResult.hashes[fam.keys[ki]];
        if (v) fpSection += '<tr><td><strong>' + escHtml(fam.keys[ki]) + '</strong></td><td style="font-size:0.7em;word-break:break-all">' + escHtml(v) + '</td></tr>';
      }
      fpSection += '</table>';
      await new Promise(function(r) { setTimeout(r, 0); });
    }
    if (data.fpResult.perceptual_hashes) {
      for (var pk in data.fpResult.perceptual_hashes) {
        fpSection += '<h3>' + escHtml(pk) + '</h3><p style="font-size:0.7em;word-break:break-all">' + escHtml(data.fpResult.perceptual_hashes[pk]) + '</p>';
      }
    }
  }

  var xhtml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<!DOCTYPE html>' +
    '<html xmlns="http://www.w3.org/1999/xhtml">' +
    '<head><meta charset="utf-8"/><title>Digital Passport</title>' +
    '<link rel="stylesheet" type="text/css" href="style.css"/>' +
    '</head><body>' +
    '<h1>Digital Passport</h1>' +
    '<p class="subtitle">Generated by RedoSan Authenticity — ' + escHtml(data.generatedAt.replace('T', ' ').substring(0, 19)) + '</p>' +

    userSection +

    '<h2>File Information</h2>' +
    '<table>' +
    '<tr><td><strong>Name</strong></td><td>' + escHtml(data.file.name) + '</td></tr>' +
    '<tr><td><strong>Size</strong></td><td>' + fmtSize(data.file.size) + '</td></tr>' +
    (data.file.width ? '<tr><td><strong>Dimensions</strong></td><td>' + data.file.width + ' x ' + data.file.height + ' px</td></tr>' : '') +
    (data.file.hash ? '<tr><td><strong>SHA-256</strong></td><td style="font-size:0.7em;word-break:break-all">' + data.file.hash + '</td></tr>' : '') +
    '</table>' +

    (imgBase64 ? '<div class="img-wrapper"><img src="images/photo.' + (data.file.type === 'image/png' ? 'png' : 'jpg') + '" alt="Original Image"/></div>' : '') +

    (data.watermark ? '<h2>Watermark</h2><p><strong>Result:</strong> ' + escHtml(data.watermarkAlgo || 'Completed') + '</p><pre>' + escHtml(data.watermarkResult || '') + '</pre>' : '') +
    (data.pixelInjection ? '<h2>Pixel Injection</h2><p><strong>Result:</strong> Completed</p><pre>' + escHtml(data.piResultHtml || '') + '</pre>' : '') +
    (data.timestamp ? '<h2>Timestamp</h2><pre>' + escHtml(data.tsResult || 'Timestamp created successfully.') + '</pre>' : '') +

    fpSection +

    (data.didSig && data.didSig.did ?
      '<h2>Decentralized Identity (DID)</h2><table>' +
      '<tr><td><strong>DID</strong></td><td style="font-size:0.7em;word-break:break-all">' + escHtml(data.didSig.did) + '</td></tr>' +
      '<tr><td><strong>Algorithm</strong></td><td>' + escHtml(data.didSig.algorithm || 'Ed25519') + '</td></tr>' +
      '<tr><td><strong>Signed</strong></td><td>' + escHtml((data.didSig.timestamp || '').replace('T', ' ').substring(0, 19)) + '</td></tr>' +
      '<tr><td><strong>Signature</strong></td><td style="font-size:0.6em;word-break:break-all">' + escHtml((data.didSig.signature || '').substring(0, 64) + '...') + '</td></tr></table>' :
      (data.didIdentity ? '<h2>DID Identity</h2><table><tr><td><strong>DID</strong></td><td style="font-size:0.7em;word-break:break-all">' + escHtml(data.didIdentity) + '</td></tr></table>' : '')) +

    (data.ct && data.ct.submitted && data.ct.hash ?
      '<h2>Certificate Transparency</h2><table>' +
      '<tr><td><strong>SHA-256</strong></td><td style="font-size:0.6em;word-break:break-all">' + escHtml(data.ct.hash) + '</td></tr>' +
      (data.ct.pending ?
        '' :
        '<tr><td><strong>Logged</strong></td><td>' + escHtml((data.ct.timestamp || '').replace('T', ' ').substring(0, 19)) + '</td></tr>' +
        '<tr><td><strong>Log</strong></td><td>' + escHtml((data.ct.aggregator || 'OTS').replace('https://', '').split('/')[0] || 'OTS calendar') + '</td></tr>') +
      '</table><p>Verifiable at: <a href="https://opentimestamps.org">opentimestamps.org</a></p>' :
      (data.ct ? '<h2>Certificate Transparency</h2><p>Status: ' + escHtml(data.ct.submitted ? 'Submitted' : 'Unavailable — ' + (data.ct.error || 'offline')) + '</p>' : '')) +

    '<h2>Verification QR Code</h2>' +
    '<p>Scan this QR code to verify the document contents.</p>' +
    '<div class="qr-wrapper"><img src="images/qr.png" alt="QR Code"/></div>' +
    '<pre class="qr-data">' + escHtml(qrContent) + '</pre>' +

    '</body></html>';

  var css = 'body{font-family:serif;padding:20px;max-width:800px;margin:0 auto}' +
    'h1{font-size:1.6em;border-bottom:2px solid #333;padding-bottom:8px}' +
    '.subtitle{color:#666;font-size:0.85em}' +
    'h2{font-size:1.2em;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}' +
    'h3{font-size:1em;margin-top:16px}' +
    'table{width:100%;border-collapse:collapse;margin:8px 0}' +
    'td{padding:4px 8px;border:1px solid #ddd;vertical-align:top;font-size:0.85em}' +
    'td:first-child{white-space:nowrap;font-weight:700;width:120px}' +
    '.img-wrapper{text-align:center;margin:16px 0}' +
    '.img-wrapper img{max-width:100%;max-height:400px}' +
    '.qr-wrapper{text-align:center;margin:16px 0}' +
    '.qr-wrapper img{width:200px;height:200px}' +
    '.qr-data{font-size:0.6em;background:#f5f5f5;padding:8px;border:1px solid #ddd;white-space:pre-wrap;word-break:break-all}';

  // Generate EPUB zip
  var zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );

  var manifestItems = [
    { id: 'content', href: 'content.xhtml', mt: 'application/xhtml+xml' },
    { id: 'style', href: 'style.css', mt: 'text/css' },
    { id: 'ncx', href: 'toc.ncx', mt: 'application/x-dtbncx+xml' }
  ];
  if (data.file.dataUrl) {
    var imgExt = data.file.type === 'image/png' ? 'png' : 'jpg';
    manifestItems.push({ id: 'img', href: 'images/photo.' + imgExt, mt: data.file.type || 'image/jpeg' });
  }
  manifestItems.push({ id: 'qr', href: 'images/qr.png', mt: 'image/png' });

  var spineItems = manifestItems.filter(function(m) { return m.mt === 'application/xhtml+xml'; });

  var ncx = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
    '<head><meta name="dtb:uid" content="urn:uuid:' + makeUUID() + '"/></head>' +
    '<docTitle><text>Digital Passport</text></docTitle>' +
    '<navMap><navPoint id="np-1" playOrder="1">' +
    '<navLabel><text>Digital Passport</text></navLabel>' +
    '<content src="content.xhtml"/>' +
    '</navPoint></navMap></ncx>';

  var opf = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">' +
    '<metadata><dc:identifier xmlns:dc="http://purl.org/dc/elements/1.1/" id="uid">' +
    'urn:uuid:' + makeUUID() + '</dc:identifier>' +
    '<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Digital Passport</dc:title>' +
    '<dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language>' +
    '<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">RedoSan Authenticity</dc:creator>' +
    '</metadata><manifest>';
  for (var mi = 0; mi < manifestItems.length; mi++) {
    opf += '<item id="' + manifestItems[mi].id + '" href="' + manifestItems[mi].href + '" media-type="' + manifestItems[mi].mt + '"/>';
  }
  opf += '</manifest><spine toc="ncx">';
  for (var si = 0; si < spineItems.length; si++) {
    opf += '<itemref idref="' + spineItems[si].id + '"/>';
  }
  opf += '</spine></package>';

  zip.folder('OEBPS').file('content.opf', opf);
  zip.folder('OEBPS').file('content.xhtml', xhtml);
  zip.folder('OEBPS').file('style.css', css);
  zip.folder('OEBPS').file('toc.ncx', ncx);
  if (data.file.dataUrl) {
    var imgExt = data.file.type === 'image/png' ? 'png' : 'jpg';
    zip.folder('OEBPS').folder('images').file('photo.' + imgExt, imgBase64, { base64: true });
  }
  zip.folder('OEBPS').folder('images').file('qr.png', qrBase64, { base64: true });

  await new Promise(function(r) { setTimeout(r, 0); });
  var blob = await zip.generateAsync({ type: 'blob' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RedoSan_Digital_Passport.epub';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  return blob;
}

async function stampCertFile(blob, format) {
  try {
    var buf = await blob.arrayBuffer();
    var hashBuf = await crypto.subtle.digest('SHA-256', buf);
    var hashBytes = new Uint8Array(hashBuf);
    var hashHex = Array.from(hashBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    var pendingB64 = generatePendingOts(hashHex);
    if (pendingB64) {
      window._certCtResult = {
        submitted: true, pending: true, otsProof: pendingB64, hash: hashHex,
        format: format, timestamp: new Date().toISOString()
      };
      var certOtsBtn = document.getElementById('cert-ots-dl-btn');
      if (certOtsBtn) certOtsBtn.style.display = 'inline-block';
    }
  } catch(e) { console.error('Failed to stamp certificate file:', e); }
}

// ── Main download dispatcher ──

function ensureLib(name) {
  return new Promise(function(resolve, reject) {
    if (name === 'jspdf' && typeof jspdf !== 'undefined') return resolve();
    if (name === 'QRious' && typeof QRious !== 'undefined') return resolve();
    if (name === 'JSZip' && typeof JSZip !== 'undefined') return resolve();
    // Static vendor script didn't load — try CDN fallbacks
    var urls;
    if (name === 'jspdf') urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ]; else if (name === 'QRious') urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
      'https://unpkg.com/qrious@4.0.2/dist/qrious.min.js',
      'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js'
    ]; else urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
      'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
    ];
    var idx = 0;
    function tryNext() {
      if (idx >= urls.length) return reject(new Error('Library ' + name + ' not available (vendor + ' + urls.length + ' CDNs all failed)'));
      var s = document.createElement('script');
      s.src = urls[idx++];
      s.onload = function() { resolve(); };
      s.onerror = function() { setTimeout(tryNext, 1000); };
      document.head.appendChild(s);
    }
    tryNext();
  });
}

// ── Loading overlay (CSS spinner survives sync freeze) ──
var _certOverlay = null;
function showCertOverlay() {
  if (_certOverlay) return;
  var o = document.createElement('div');
  o.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999';
  o.innerHTML =
    '<div class="cert-spinner" style="border:5px solid rgba(255,255,255,0.2);border-top:5px solid #d32f2f;border-radius:50%;width:50px;height:50px;animation:certSpin 0.9s linear infinite"></div>' +
    '<div style="color:#fff;font:18px/1.4 sans-serif;margin-top:16px">Generating certificate…</div>' +
    '<div style="color:rgba(255,255,255,0.65);font:13px/1.4 sans-serif;margin-top:6px">Please wait, this may take up to 30 seconds</div>';
  document.body.appendChild(o);
  _certOverlay = o;
  if (!document.getElementById('cert-spin-style')) {
    var s = document.createElement('style');
    s.id = 'cert-spin-style';
    s.textContent = '@keyframes certSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
}
function hideCertOverlay() {
  if (_certOverlay) { _certOverlay.remove(); _certOverlay = null; }
}

function downloadCertOtsProof() {
  var ct = window._certCtResult;
  if (!ct || !ct.otsProof) return;
  try {
    var bytes = Uint8Array.from(atob(ct.otsProof), function(c) { return c.charCodeAt(0); });
    var blob = new Blob([bytes], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'RedoSan_Digital_Passport.' + (ct.format || 'pdf') + '.ots';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch(e) { console.error('Failed to download cert .ots proof:', e); }
}

function downloadOtsProof() {
  var ct = window._lastCtResult;
  if (!ct || !ct.otsProof) return;
  try {
    var bytes = Uint8Array.from(atob(ct.otsProof), function(c) { return c.charCodeAt(0); });
    var blob = new Blob([bytes], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'RedoSan_Digital_Passport.ots';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch(e) { console.error('Failed to download .ots proof:', e); }
}



async function downloadCert(format, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  await new Promise(function(r) { setTimeout(r, 30); });
  showCertOverlay();
  try {
    var data = await collectCertData();
    var certBlob;
    if (format === 'pdf') {
      await ensureLib('jspdf');
      certBlob = await downloadCertPDF(data);
    } else if (format === 'docx' || format === 'epub') {
      await ensureLib('QRious');
      if (format === 'docx') certBlob = await downloadCertDOCX(data);
      else { await ensureLib('JSZip'); certBlob = await downloadCertEPUB(data); }
    }
    // Stamp the certificate file itself
    if (certBlob) {
      stampCertFile(certBlob, format);
    }
    window._lastCtResult = data.ct || null;
    if (data.ct && data.ct.otsProof) {
      var otsBtn = document.getElementById('ots-dl-btn');
      if (otsBtn) otsBtn.style.display = 'inline-block';
    }
  } catch (e) {
    console.error('Certificate generation failed:', e);
    alert('Failed to generate certificate: ' + e.message);
  }
  hideCertOverlay();
  if (btn) { btn.disabled = false; btn.textContent = format.toUpperCase(); }
}

// ── Professional Mode Certificate ──

var _certData = null;

function getValOrEmpty(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getUrlOrEmpty(id) {
  var val = getValOrEmpty(id);
  return val || '';
}

async function generateProfessionalCert() {
  var btn = document.getElementById('cert-gen-btn');
  var spinner = document.getElementById('cert-spinner');
  var status = document.getElementById('cert-status');
  var dlSection = document.getElementById('cert-download-section');
  if (spinner) spinner.style.display = 'block';
  if (status) status.textContent = 'Generating certificate...';
  if (btn) btn.disabled = true;

  try {
    var fileInput = document.getElementById('cert-file');
    var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    var buf = null;
    if (file) { buf = await file.arrayBuffer(); }

    function getFileFrom(id) {
      var el = document.getElementById(id);
      return el && el.files && el.files[0] ? el.files[0] : null;
    }

    async function readFileAsText(f) {
      if (!f) return '';
      return new Promise(function(resolve) {
        var r = new FileReader();
        r.onload = function(e) { resolve(e.target.result); };
        r.onerror = function() { resolve(''); };
        r.readAsText(f);
      });
    }

    // Watermark: uploaded file only
    var wmFile = getFileFrom('cert-result-wm');
    var wmText = wmFile ? await readFileAsText(wmFile) : '';
    var wmFileName = wmFile ? wmFile.name : '';

    // PI: uploaded file only
    var piFile = getFileFrom('cert-result-pi');
    var piText = piFile ? await readFileAsText(piFile) : '';
    var piFileName = piFile ? piFile.name : '';

    // Fingerprint: uploaded file only
    var fpFile = getFileFrom('cert-result-fp');
    var fpText = fpFile ? await readFileAsText(fpFile) : '';
    var fpResultData = null;
    if (fpText) {
      try { fpResultData = JSON.parse(fpText); } catch(e) {
        fpResultData = { hashes: {}, perceptual_hashes: {}, raw: fpText };
        var fpLines = fpText.split('\n');
        var curSection = '';
        for (var fli = 0; fli < fpLines.length; fli++) {
          var line = fpLines[fli].trim();
          if (line.indexOf('--- Hashes ---') >= 0) { curSection = 'hashes'; continue; }
          if (line.indexOf('--- Perceptual Hashes ---') >= 0) { curSection = 'phash'; continue; }
          if (curSection === 'hashes') {
            var hc = line.indexOf(':');
            if (hc > 0) {
              var hk = line.substring(0, hc).trim();
              var hv = line.substring(hc + 1).trim();
              if (hk && hv) fpResultData.hashes[hk] = hv;
            }
          }
          if (curSection === 'phash') {
            var pc = line.indexOf(':');
            if (pc > 0) {
              var pk = line.substring(0, pc).trim();
              var pv = line.substring(pc + 1).trim();
              if (pk && pv) fpResultData.perceptual_hashes[pk] = pv;
            }
          }
        }
      }
    }

    // DID Identity: uploaded file only
    var didFile = getFileFrom('cert-result-did');
    var didText = didFile ? await readFileAsText(didFile) : '';
    var didUploadData = null;
    if (didText) {
      try { didUploadData = JSON.parse(didText); } catch(e) { didUploadData = { raw: didText }; }
    }

    // Timestamp: uploaded file only
    var tsFile = getFileFrom('cert-result-ts');
    var tsName = tsFile ? tsFile.name : '';
    var tsSize = tsFile ? tsFile.size : 0;

    // Validate required fields
    var cname = getValOrEmpty('cert-name');
    var cemail = getValOrEmpty('cert-email');
    var cphoneCode = (document.getElementById('cert-phonecode') || {}).value || '';
    var cphoneRaw = getValOrEmpty('cert-phone');
    var cphone = cphoneRaw.replace(/\D/g, '').slice(0, 15);
    var cwebsite = getValOrEmpty('cert-website');

    if (!cname || !cemail || !cphone || !cwebsite) {
      if (status) status.textContent = 'Please fill in all required fields: Name, Email, Phone, Website.';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.disabled = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cemail)) {
      var ew = document.getElementById('cert-email-warn');
      if (ew) ew.style.display = 'block';
      if (status) status.textContent = '';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.disabled = false;
      return;
    }
    if (cwebsite === 'https://' || !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(cwebsite)) {
      var ww = document.getElementById('cert-website-warn');
      if (ww) ww.style.display = 'block';
      if (status) status.textContent = '';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.disabled = false;
      return;
    }

    _certData = {
      generatedAt: new Date().toISOString(),
      generator: 'RedoSan Authenticity',
      user: {
        name: cname,
        email: cemail,
        phone: cphoneCode + cphone,
        phoneCode: cphoneCode,
        phone: cphone,
        website: cwebsite,
        social: {
          tiktok: getUrlOrEmpty('cert-social-tiktok'),
          facebook: getUrlOrEmpty('cert-social-facebook'),
          instagram: getUrlOrEmpty('cert-social-instagram'),
          youtube: getUrlOrEmpty('cert-social-youtube')
        },
        isArtist: false,
        music: {
          spotify: getUrlOrEmpty('cert-music-spotify'),
          appleMusic: getUrlOrEmpty('cert-music-applemusic'),
          youtubeMusic: getUrlOrEmpty('cert-music-ytmusic'),
          soundcloud: getUrlOrEmpty('cert-music-soundcloud')
        }
      },
      file: { name: file ? (file.name || '') : '', size: file ? file.size : 0, type: file ? file.type : '', width: 0, height: 0, dataUrl: null, hash: '' },
      watermark: !!(wmFile || wmGlobal),
      watermarkUrl: null,
      watermarkAlgo: wmFileName,
      watermarkResult: stripHtml(wmText),
      pixelInjection: !!(piFile || piGlobal),
      piResultHtml: stripHtml(piText),
      piFileDataUrl: null,
      timestamp: !!tsFile,
      tsResult: tsFile ? ('Timestamp file: ' + tsName + ' (' + fmtSize(tsSize) + ')') : '',
      fingerprint: !!(fpFile || fpGlobal),
      fpResult: fpResultData,
      fpFileName: fpFile ? fpFile.name : (fpGlobal ? (fpGlobal.file_info ? fpGlobal.file_info.file_name : '') : ''),
      didSig: window._didSig || (didUploadData && didUploadData.signature ? didUploadData.signature : null),
      didIdentity: (window._didKeypair ? window._didKeypair.did : '') || (didUploadData ? didUploadData.did : ''),
      ct: { submitted: false }
    };
    // Submit ORIGINAL FILE to transparency log
    try {
      var fileData = buf || new Uint8Array();
      var ctPromise = submitCertTransparency(fileData);
      var ctTimeout = new Promise(function(_, rej) { setTimeout(function() { rej(new Error('CT submission timed out')); }, 10000); });
      var ctResult = await Promise.race([ctPromise, ctTimeout]);
      ctResult.originalFileHash = _certData.file.hash || '';
      _certData.ct = ctResult;
    } catch (e) {
      _certData.ct = { submitted: false, error: e.message, timestamp: new Date().toISOString() };
    }

    // Main image dimensions + hash
    if (buf && file) {
      var dataUrl = bufToDataURL(buf, file.type);
      var dims = await loadImageDimensions(dataUrl);
      _certData.file.width = dims.width;
      _certData.file.height = dims.height;
      _certData.file.dataUrl = dataUrl;
      _certData.file.hash = await getFileHashSha256(buf);
    }

    if (status) status.textContent = 'Certificate generated successfully!';
    if (dlSection) dlSection.style.display = 'block';
  } catch (e) {
    console.error('Certificate generation failed:', e);
    if (status) status.textContent = 'Error: ' + e.message;
    alert('Failed to generate certificate: ' + e.message);
  }

  if (spinner) spinner.style.display = 'none';
  if (btn) btn.disabled = false;
}

async function downloadProfessionalCert(format) {
  if (!_certData) { alert('Please generate the certificate first.'); return; }
  var status = document.getElementById('cert-status');
  if (status) status.textContent = 'Generating ' + format.toUpperCase() + '...';
  var certBlob;
  try {
    if (format === 'pdf') {
      if (typeof jspdf === 'undefined') throw new Error('PDF library (jspdf) did not load. Try disabling ad blockers or check your internet connection.');
      certBlob = await downloadCertPDF(_certData);
    }
    else if (format === 'docx') {
      if (typeof QRious === 'undefined') throw new Error('QR library (QRious) did not load. Try disabling ad blockers or check your internet connection.');
      certBlob = await downloadCertDOCX(_certData);
    }
    else if (format === 'epub') certBlob = await downloadCertEPUB(_certData);
    if (certBlob) stampCertFile(certBlob, format);
    if (status) status.textContent = format.toUpperCase() + ' downloaded successfully.';
  } catch (e) {
    console.error('Download failed:', e);
    if (status) status.textContent = 'Error: ' + e.message;
    alert('Failed to download: ' + e.message);
  }
}

function initCertPhoneCode() {
  var sel = document.getElementById('cert-phonecode');
  if (!sel) return;
  // Build options — same format as simplified mode (country code + dial)
  var html = '<option value="">—— ' + __('simple.select_country', 'Select country') + ' ——</option>';
  for (var i = 0; i < COUNTRY_CODES.length; i++) {
    var c = COUNTRY_CODES[i];
    html += '<option value="' + c.dial + '">' + c.code + ' ' + c.dial + '</option>';
  }
  sel.innerHTML = html;
  // Auto-detect
  if (typeof getDefaultPhoneCode === 'function') {
    var detected = getDefaultPhoneCode();
    if (detected) { sel.value = detected.dial; }
  }
  if (typeof updatePhoneMaxLength === 'function') updatePhoneMaxLength();
}

function toggleCertMusicFields() {
  var cb = document.getElementById('cert-show-music');
  var fields = document.getElementById('cert-music-fields');
  if (fields) fields.style.display = cb && cb.checked ? '' : 'none';
}

function resetProfessionalCert() {
  _certData = null;
  var ids = ['cert-file', 'cert-name', 'cert-email', 'cert-phone', 'cert-website',
    'cert-social-tiktok', 'cert-social-facebook', 'cert-social-instagram', 'cert-social-youtube',
    'cert-music-spotify', 'cert-music-applemusic', 'cert-music-ytmusic', 'cert-music-soundcloud',
    'cert-result-wm', 'cert-result-pi', 'cert-result-fp', 'cert-result-ts', 'cert-result-did'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; }
  });
  var phonecode = document.getElementById('cert-phonecode');
  if (phonecode) { phonecode.value = ''; }
  var showMusic = document.getElementById('cert-show-music');
  if (showMusic) { showMusic.checked = false; }
  var musicFields = document.getElementById('cert-music-fields');
  if (musicFields) musicFields.style.display = 'none';
  var dlSection = document.getElementById('cert-download-section');
  if (dlSection) dlSection.style.display = 'none';
  var status = document.getElementById('cert-status');
  if (status) status.textContent = '';
  // Re-init phone code detection
  initCertPhoneCode();
}

// Init phone code on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCertPhoneCode);
  } else {
    initCertPhoneCode();
  }
}
