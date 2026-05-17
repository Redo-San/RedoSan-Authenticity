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

async function collectCertData() {
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
    pixelInjection: !!results['pixel-injection'],
    timestamp: !!results.timestamp,
    fingerprint: !!results.fingerprint,
    fpResult: results.fpResult || null
  };
  // Get image dimensions
  if (buf && file) {
    var dataUrl = bufToDataURL(buf, file.type);
    var dims = await loadImageDimensions(dataUrl);
    data.file.width = dims.width;
    data.file.height = dims.height;
    data.file.dataUrl = dataUrl;
    data.file.hash = await getFileHashSha256(buf);
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

  // Load image
  if (data.file.dataUrl) {
    img = data.file.dataUrl;
    dims = { w: data.file.width || 1, h: data.file.height || 1 };
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
    if (data.user.name) { doc.text('Name: ' + data.user.name, margin, y); y += 4; }
    if (data.user.email) { doc.text('Email: ' + data.user.email, margin, y); y += 4; }
    if (data.user.phone) { doc.text('Phone: ' + data.user.phone, margin, y); y += 4; }
    if (data.user.website) { doc.text('Website: ' + data.user.website, margin, y); y += 4; }
    y += 2;
  }

  // ── 2. File Info ──
  checkPage(20);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('File Information', margin, y); y += 5;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text('Name: ' + data.file.name, margin, y); y += 4;
  doc.text('Size: ' + fmtSize(data.file.size), margin, y); y += 4;
  if (data.file.width) doc.text('Dimensions: ' + data.file.width + ' x ' + data.file.height + ' px', margin, y); y += (data.file.width ? 4 : 0);
  if (data.file.hash) doc.text('SHA-256: ' + data.file.hash, margin, y); y += (data.file.hash ? 4 : 0);
  y += 2;

  // Embed image
  if (img) {
    checkPage(imgH + 8);
    doc.addImage(img, 'PNG', (pw - imgW) / 2, y, imgW, imgH);
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
    doc.text('Status: Embedded successfully', margin, y); y += 4;
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
    doc.text('Status: Injected successfully', margin, y); y += 4;
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
    doc.text('Status: Timestamped successfully', margin, y); y += 4;
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

  // ── 7. QR Verification Code ──
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

  doc.save('RedoSan_Digital_Passport.pdf');
}

// ── DOCX Certificate ──

async function downloadCertDOCX(data) {
  var children = [];

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

  // Separator
  children.push(new docx.Paragraph({ spacing: { after: 200 } }));

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

  // 3. Embed image (DOCX doesn't support easy image embedding via browser)
  // We skip the image in DOCX since docx library requires a file path for images
  addBody('(Image preview not available in DOCX format. Use PDF for image preview.)');

  children.push(new docx.Paragraph({ spacing: { after: 200 } }));

  // 4. Watermark
  if (data.watermark) {
    addHeading('Watermark', 2);
    addBody('Status: Embedded successfully');
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 5. Pixel Injection
  if (data.pixelInjection) {
    addHeading('Pixel Injection', 2);
    addBody('Status: Injected successfully');
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 6. Timestamp
  if (data.timestamp) {
    addHeading('Timestamp', 2);
    addBody('Status: Timestamped successfully');
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

  // 8. QR note
  addHeading('Verification', 2);
  addBody('Scan the QR code on the PDF version of this document to verify contents.');
  addBody('The QR encodes file hashes, owner information, and result status for cross-checking.');

  var docObj = new docx.Document({ sections: [{ children: children }] });
  var blob = await docx.Packer.toBlob(docObj);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RedoSan_Digital_Passport.docx';
  a.click();
  URL.revokeObjectURL(url);
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

    (data.watermark ? '<h2>Watermark</h2><p>Status: Embedded successfully</p>' : '') +
    (data.pixelInjection ? '<h2>Pixel Injection</h2><p>Status: Injected successfully</p>' : '') +
    (data.timestamp ? '<h2>Timestamp</h2><p>Status: Timestamped successfully</p>' : '') +

    fpSection +

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
    { id: 'style', href: 'style.css', mt: 'text/css' }
  ];
  if (data.file.dataUrl) {
    var imgExt = data.file.type === 'image/png' ? 'png' : 'jpg';
    manifestItems.push({ id: 'img', href: 'images/photo.' + imgExt, mt: data.file.type || 'image/jpeg' });
  }
  manifestItems.push({ id: 'qr', href: 'images/qr.png', mt: 'image/png' });

  var spine = manifestItems.filter(function(m) { return m.id === 'content'; }).concat(
    manifestItems.filter(function(m) { return m.id !== 'content' && m.id !== 'style'; })
  );

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
  for (var si = 0; si < spine.length; si++) {
    opf += '<itemref idref="' + spine[si].id + '"/>';
  }
  opf += '</spine></package>';

  zip.folder('OEBPS').file('content.opf', opf);
  zip.folder('OEBPS').file('content.xhtml', xhtml);
  zip.folder('OEBPS').file('style.css', css);
  if (data.file.dataUrl) {
    var imgExt = data.file.type === 'image/png' ? 'png' : 'jpg';
    zip.folder('OEBPS').folder('images').file('photo.' + imgExt, imgBase64, { base64: true });
  }
  zip.folder('OEBPS').folder('images').file('qr.png', qrBase64, { base64: true });

  var blob = await zip.generateAsync({ type: 'blob' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RedoSan_Digital_Passport.epub';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main download dispatcher ──

async function downloadCert(format, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  try {
    var data = await collectCertData();
    if (format === 'pdf') await downloadCertPDF(data);
    else if (format === 'docx') await downloadCertDOCX(data);
    else if (format === 'epub') await downloadCertEPUB(data);
  } catch (e) {
    console.error('Certificate generation failed:', e);
    alert('Failed to generate certificate: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = format.toUpperCase(); }
}
