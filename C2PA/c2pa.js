import { createC2pa } from '@contentauth/c2pa-web';

const WASM_SRC = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.8.1/dist/resources/c2pa_bg.wasm';

const C2PA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfNJBsaRLSeHizv0m
GL+gcn78QmtfLSm+n+qG9veC2W2hRANCAAQPaL6RkAkYkKU4+IryBSYxJM3h77sF
iMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWkyl3QGuV/wt0MrAPDo
-----END PRIVATE KEY-----`;

const C2PA_CERTS = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
gYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJU29tZXdoZXJl
MScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3QgQ0ExGTAXBgNV
BAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVkaWF0ZSBDQTAe
Fw0yMjA2MTAxODQ2NDBaFw0zMDA4MjYxODQ2NDBaMIGAMQswCQYDVQQGEwJVUzEL
MAkGA1UECAwCQ0ExEjAQBgNVBAcMCVNvbWV3aGVyZTEfMB0GA1UECgwWQzJQQSBU
ZXN0IFNpZ25pbmcgQ2VydDEZMBcGA1UECwwQRk9SIFRFU1RJTkdfT05MWTEUMBIG
A1UEAwwLQzJQQSBTaWduZXIwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQPaL6R
kAkYkKU4+IryBSYxJM3h77sFiMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWky
l3QGuV/wt0MrAPDoo3gwdjAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB/wQMMAoGCCsG
AQUFBwMEMA4GA1UdDwEB/wQEAwIGwDAdBgNVHQ4EFgQUFznP0y83joiNOCedQkxT
tAMyNcowHwYDVR0jBBgwFoAUDnyNcma/osnlAJTvtW6A4rYOL2swCgYIKoZIzj0E
AwIDRwAwRAIgOY/2szXjslg/MyJFZ2y7OH8giPYTsvS7UPRP9GI9NgICIDQPMKrE
LQUJEtipZ0TqvI/4mieoyRCeIiQtyuS0LACz
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICajCCAg+gAwIBAgIUfXDXHH+6GtA2QEBX2IvJ2YnGMnUwCgYIKoZIzj0EAwIw
dzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlTb21ld2hlcmUx
GjAYBgNVBAoMEUMyUEEgVGVzdCBSb290IENBMRkwFwYDVQQLDBBGT1IgVEVTVElO
R19PTkxZMRAwDgYDVQQDDAdSb290IENBMB4XDTIyMDYxMDE4NDY0MFoXDTMwMDgy
NzE4NDY0MFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJ
U29tZXdoZXJlMScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3Qg
Q0ExGTAXBgNVBAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVk
aWF0ZSBDQTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHllI4O7a0EkpTYAWfPM
D6Rnfk9iqhEmCQKMOR6J47Rvh2GGjUw4CS+aLT89ySukPTnzGsMQ4jK9d3V4Aq4Q
LsOjYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQW
BBQOfI1yZr+iyeUAlO+1boDitg4vazAfBgNVHSMEGDAWgBRembiG4Xgb2VcVWnUA
UrYpDsuojDAKBggqhkjOPQQDAgNJADBGAiEAtdZ3+05CzFo90fWeZ4woeJcNQC4B
84Ill3YeZVvR8ZECIQDVRdha1xEDKuNTAManY0zthSosfXcvLnZui1A/y/DYeg==
-----END CERTIFICATE-----`;

let c2paInstance = null;

async function getC2pa() {
  if (!c2paInstance) {
    c2paInstance = await createC2pa({ wasmSrc: WASM_SRC });
  }
  return c2paInstance;
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch(e) { return d; }
}

function parsePem(pem) {
  const b64 = pem.replace(/-----BEGIN [\w\s]+-----/g, '').replace(/-----END [\w\s]+-----/g, '').replace(/\s/g, '');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return bytes.buffer;
}

async function createBrowserSigner() {
  const privateKeyBuffer = parsePem(C2PA_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  return {
    alg: 'es256',
    reserveSize: async () => 300,
    sign: async (data) => {
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
      return new Uint8Array(sig);
    }
  };
}

async function addIngredientFromFile(builder, file, rel) {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf]);
  await builder.addIngredientFromBlob(
    { title: file.name, relationship: rel || 'parentOf' },
    file.type || 'image/jpeg',
    blob
  );
}

function getActionsHtml(manifest) {
  const assertions = manifest.assertions || [];
  const actions = assertions.filter(a => a.label === 'c2pa.actions');
  if (!actions.length) return '<p class="c2pa-empty">No actions recorded</p>';
  return actions.map(a => {
    const data = a.data;
    const items = Array.isArray(data) ? data : (data.actions || [data]);
    return items.map(act => `
      <div class="c2pa-action-item">
        <span class="c2pa-action-badge">${escHtml(act.action || 'unknown')}</span>
        ${act.softwareAgent ? `<span class="c2pa-action-agent">${escHtml(act.softwareAgent)}</span>` : ''}
        ${act.when ? `<span class="c2pa-action-when">${formatDate(act.when)}</span>` : ''}
        ${act.digitalSourceType ? `<span class="c2pa-action-src">${escHtml(act.digitalSourceType.split('/').pop())}</span>` : ''}
        ${act.reason ? `<span class="c2pa-action-reason">${escHtml(act.reason)}</span>` : ''}
      </div>
    `).join('');
  }).join('');
}

function getAssertionsHtml(manifest) {
  const assertions = (manifest.assertions || []).filter(a => a.label !== 'c2pa.actions' && a.label !== 'c2pa.thumbnail');
  if (!assertions.length) return '<p class="c2pa-empty">No additional assertions</p>';
  return assertions.map(a => {
    const dataStr = typeof a.data === 'object' ? JSON.stringify(a.data, null, 2) : String(a.data);
    return `
      <div class="c2pa-assertion-item">
        <strong>${escHtml(a.label)}</strong>
        ${a.kind ? `<span class="badge badge-muted">${escHtml(a.kind)}</span>` : ''}
        <pre>${escHtml(dataStr)}</pre>
      </div>
    `;
  }).join('');
}

function getIngredientsHtml(manifest) {
  const ingredients = manifest.ingredients || [];
  if (!ingredients.length) return '<p class="c2pa-empty">No ingredients</p>';
  return ingredients.map(ing => `
    <div class="c2pa-ingredient-item">
      <strong>${escHtml(ing.title || ing.instance_id || 'Unnamed')}</strong>
      ${ing.format ? `<span class="badge badge-muted">${escHtml(ing.format)}</span>` : ''}
      ${ing.relationship ? `<span class="badge badge-muted">${escHtml(ing.relationship)}</span>` : ''}
      ${ing.document_id ? `<br><span class="c2pa-meta">Document ID: ${escHtml(ing.document_id)}</span>` : ''}
      ${ing.instance_id ? `<br><span class="c2pa-meta">Instance ID: ${escHtml(ing.instance_id)}</span>` : ''}
    </div>
  `).join('');
}

function getSignatureInfoHtml(manifest) {
  const sig = manifest.signature_info;
  if (!sig) return '<p class="c2pa-empty">No signature info</p>';
  return `
    <div class="c2pa-sig-info">
      ${sig.issuer ? `<p><strong>Issuer:</strong> ${escHtml(sig.issuer)}</p>` : ''}
      ${sig.cert_serial_number ? `<p><strong>Serial:</strong> ${escHtml(sig.cert_serial_number)}</p>` : ''}
      ${sig.time ? `<p><strong>Signed:</strong> ${formatDate(sig.time)}</p>` : ''}
    </div>
  `;
}

function getValidationHtml(manifestStore) {
  const state = manifestStore.validation_state;
  const status = manifestStore.validation_status || [];
  const results = manifestStore.validation_results;

  if (state === 'ok' || (state == null && (!status || !status.length))) {
    return '<span class="badge badge-success">Valid</span>';
  }
  let html = `<span class="badge ${state === 'warning' ? 'badge-warning' : 'badge-muted'}">${escHtml(state || 'unknown')}</span>`;
  if (status.length) {
    html += '<ul class="c2pa-validation-list">' +
      status.map(s => `<li>${escHtml(JSON.stringify(s))}</li>`).join('') +
      '</ul>';
  }
  return html;
}

window.handleC2paRead = async function() {
  const file = document.getElementById('c2pa-read-file').files[0];
  if (!file) { alert('Please select a file'); return; }

  const output = document.getElementById('c2pa-read-output');
  const spinner = document.getElementById('c2pa-read-spinner');
  const resultDiv = document.getElementById('c2pa-read-result');
  output.innerHTML = '';
  spinner.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(file.type || 'image/jpeg', file);

    if (!reader) {
      output.innerHTML = '<div class="c2pa-no-data"><strong>No C2PA data found</strong><p>This file does not contain any C2PA provenance metadata.</p></div>';
      spinner.style.display = 'none';
      resultDiv.style.display = 'block';
      return;
    }

    const manifestStore = await reader.manifestStore();
    await reader.free();

    if (!manifestStore || !manifestStore.manifests || !Object.keys(manifestStore.manifests).length) {
      output.innerHTML = '<div class="c2pa-no-data"><strong>No C2PA manifests</strong><p>The file has C2PA data but no readable manifests.</p></div>';
      spinner.style.display = 'none';
      resultDiv.style.display = 'block';
      return;
    }

    const activeLabel = manifestStore.active_manifest || Object.keys(manifestStore.manifests)[0];
    const manifest = manifestStore.manifests[activeLabel];

    let html = '';

    // Validation
    html += `<div class="c2pa-section"><h3>Validation</h3>${getValidationHtml(manifestStore)}</div>`;

    // Active manifest label
    html += `<div class="c2pa-section"><h3>Active Manifest</h3><code>${escHtml(activeLabel)}</code></div>`;

    // Title & format
    html += '<div class="c2pa-section"><h3>Details</h3>';
    html += `<table class="c2pa-details-table">
      <tr><td>Title</td><td>${escHtml(manifest.title || '—')}</td></tr>
      <tr><td>Format</td><td>${escHtml(manifest.format || '—')}</td></tr>
      <tr><td>Claim Generator</td><td>${escHtml(manifest.claim_generator || '—')}</td></tr>
      <tr><td>Instance ID</td><td><code>${escHtml(manifest.instance_id || '—')}</code></td></tr>
      <tr><td>Claim Version</td><td>${manifest.claim_version != null ? manifest.claim_version : '—'}</td></tr>
    </table>`;
    html += '</div>';

    // Claim generator info
    if (manifest.claim_generator_info && manifest.claim_generator_info.length) {
      html += '<div class="c2pa-section"><h3>Generator Info</h3>';
      html += manifest.claim_generator_info.map(info =>
        `<div class="c2pa-gen-info">${info.name ? `<strong>${escHtml(info.name)}</strong>` : ''}${info.version ? ` v${escHtml(info.version)}` : ''}${info.icon_url ? `<br><img src="${escHtml(info.icon_url)}" style="max-height:24px">` : ''}</div>`
      ).join('');
      html += '</div>';
    }

    // Actions
    html += `<div class="c2pa-section"><h3>Actions</h3>${getActionsHtml(manifest)}</div>`;

    // Assertions
    html += `<div class="c2pa-section"><h3>Assertions</h3>${getAssertionsHtml(manifest)}</div>`;

    // Ingredients
    html += `<div class="c2pa-section"><h3>Ingredients (${(manifest.ingredients || []).length})</h3>${getIngredientsHtml(manifest)}</div>`;

    // Signature info
    html += `<div class="c2pa-section"><h3>Signature</h3>${getSignatureInfoHtml(manifest)}</div>`;

    // All manifests count
    const manifestCount = Object.keys(manifestStore.manifests).length;
    if (manifestCount > 1) {
      html += `<div class="c2pa-section"><h3>All Manifests (${manifestCount})</h3><ul class="c2pa-manifest-list">`;
      for (const [label, m] of Object.entries(manifestStore.manifests)) {
        html += `<li>${label === activeLabel ? '<strong>' : ''}${escHtml(label)}: ${escHtml(m.title || 'Untitled')} ${m.claim_generator ? `— ${escHtml(m.claim_generator)}` : ''}${label === activeLabel ? ' (active)</strong>' : ''}</li>`;
      }
      html += '</ul></div>';
    }

    output.innerHTML = html;

    var c2paDl = document.createElement('div');
    c2paDl.style.marginTop = '16px';
    c2paDl.innerHTML = '<button onclick="showC2paDownloadModal()" class="btn">Download Results</button>';
    output.appendChild(c2paDl);

    window._c2paReadResult = {
      manifestStore: manifestStore,
      activeLabel: activeLabel,
      manifest: manifest,
      file: file.name
    };

    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  } catch (err) {
    output.innerHTML = `<div class="c2pa-error"><strong>Error:</strong> ${escHtml(err.message)}</div>`;
    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  }
};

window.handleC2paWrite = async function() {
  const fileInput = document.getElementById('c2pa-write-file');
  const titleInput = document.getElementById('c2pa-write-title');
  const authorInput = document.getElementById('c2pa-write-author');
  const typeSelect = document.getElementById('c2pa-write-type');
  const ingredientInput = document.getElementById('c2pa-write-ingredient');
  const output = document.getElementById('c2pa-write-output');
  const spinner = document.getElementById('c2pa-write-spinner');
  const resultDiv = document.getElementById('c2pa-write-result');

  const file = fileInput.files[0];
  if (!file) { alert('Please select an image'); return; }

  output.innerHTML = '';
  spinner.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const digitalSrc = selectedOption.dataset.c2paSrc;
    const contentType = typeSelect.value;

    let signedBytes;
    let usedCustomSigner = false;

    try {
      const signerModule = await import('./c2pa-signer.js');
      if (await signerModule.isAvailable()) {
        signedBytes = await signerModule.signImage({
          file,
          title: titleInput.value,
          author: authorInput.value,
          contentType,
          digitalSrc,
          ingredients: ingredientInput.files,
          privateKeyPem: C2PA_PRIVATE_KEY,
          certsPem: C2PA_CERTS
        });
        usedCustomSigner = true;
      }
    } catch (customErr) {
      console.warn('Custom C2PA signer unavailable, falling back:', customErr.message);
    }

    if (!usedCustomSigner) {
      const c2pa = await getC2pa();
      const signer = await createBrowserSigner();
      const builder = await c2pa.builder.new();

      if (digitalSrc) {
        await builder.setIntent({ create: digitalSrc });
      } else {
        await builder.setIntent(contentType);
      }

      if (titleInput.value) {
        const def = await builder.getDefinition();
        def.title = titleInput.value;
      }

      if (authorInput.value) {
        await builder.addAction({
          action: 'c2pa.created',
          actor: { name: authorInput.value }
        });
      }

      if (ingredientInput.files && ingredientInput.files.length) {
        for (const ingFile of ingredientInput.files) {
          await addIngredientFromFile(builder, ingFile, 'componentOf');
        }
      }

      const buf = await file.arrayBuffer();
      const blob = new Blob([buf]);

      signedBytes = await builder.sign(signer, file.type || 'image/jpeg', blob);
      await builder.free();
    }

    const signedBlob = new Blob([signedBytes], { type: file.type || 'image/jpeg' });
    const url = URL.createObjectURL(signedBlob);
    const origName = file.name.replace(/\.[^.]+$/, '');
    const fileName = origName + '_c2pa_signed' + (file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg');

    output.innerHTML = `
      <div class="c2pa-success">
        <strong>Success!</strong>
        <p>Image signed with C2PA provenance metadata${usedCustomSigner ? ' (full certificate chain)' : ''}.</p>
        <a href="${url}" download="${fileName}" class="btn">Download Signed Image</a>
      </div>
    `;
    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  } catch (err) {
    console.error('C2PA write error:', err);
    output.innerHTML = `<div class="c2pa-error"><strong>Error:</strong> ${escHtml(err.message)}<br><small>Check console for details.</small></div>`;
    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  }
};

// ── C2PA Download functions ──

window.showC2paDownloadModal = function() {
  window._currentDownloadHandler = window.downloadC2pa;
  document.getElementById('dl-modal-title').textContent = 'Download C2PA Report';
  showDownloadModal();
};

window.downloadC2pa = function(format) {
  closeDownloadModal();
  var r = window._c2paReadResult;
  if (!r) return;
  var name = (r.file || 'c2pa_report').replace(/\.[^.]+$/, '');
  if (format === 'pdf') {
    var blob = c2paToPDF(r);
    downloadBlobSimple(blob, name + '.c2pa.pdf');
    return;
  }
  if (format === 'doc') {
    var blob = c2paToDOCX(r);
    downloadBlobSimple(blob, name + '.c2pa.docx');
    return;
  }
  var content, ext, mime;
  switch (format) {
    case 'json': content = JSON.stringify(r.manifestStore, null, 2); ext = 'json'; mime = 'application/json'; break;
    case 'csv':  content = c2paToCSV(r);  ext = 'csv';  mime = 'text/csv'; break;
    case 'txt':  content = c2paToTXT(r);  ext = 'txt';  mime = 'text/plain'; break;
    case 'xml':  content = c2paToXML(r);  ext = 'xml';  mime = 'application/xml'; break;
    case 'html': content = c2paToHTML(r); ext = 'html'; mime = 'text/html'; break;
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, name + '.c2pa.' + ext);
}

function c2paToPDF(r) {
  var doc = new jspdf.jsPDF();
  var y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text('RedoSan Authenticity - C2PA Report', 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('File: ' + r.file, 14, y); y += 6;
  doc.text('Active Manifest: ' + r.activeLabel, 14, y); y += 8;
  var m = r.manifest;
  if (m.title) { doc.text('Title: ' + m.title, 14, y); y += 6; }
  if (m.format) { doc.text('Format: ' + m.format, 14, y); y += 6; }
  if (m.claim_generator) { doc.text('Generator: ' + m.claim_generator, 14, y); y += 6; }
  if (m.instance_id) { doc.text('Instance ID: ' + m.instance_id, 14, y); y += 6; }
  y += 4;
  var state = r.manifestStore.validation_state;
  doc.text('Validation: ' + (state || 'unknown'), 14, y); y += 8;
  if (m.claim_generator_info && m.claim_generator_info.length) {
    m.claim_generator_info.forEach(function(info) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text('Generator: ' + (info.name || '') + ' ' + (info.version || ''), 14, y); y += 6;
    });
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  if (actions.length) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.setTextColor(108, 92, 231);
    doc.text('Actions', 14, y); y += 7;
    doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    actions.forEach(function(a) {
      var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
      items.forEach(function(act) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text((act.action || 'unknown') + (act.when ? ' (' + act.when + ')' : ''), 18, y); y += 5;
      });
    });
    y += 3;
  }
  if (m.signature_info) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.setTextColor(108, 92, 231);
    doc.text('Signature', 14, y); y += 7;
    doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    if (m.signature_info.issuer) { doc.text('Issuer: ' + m.signature_info.issuer, 18, y); y += 5; }
    if (m.signature_info.time) { doc.text('Signed: ' + m.signature_info.time, 18, y); y += 5; }
  }
  doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text('Generated by RedoSan Authenticity', 14, 285);
  return doc.output('blob');
}

function c2paToDOCX(r) {
  var docx = window.docx;
  var children = [];
  children.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: 'RedoSan Authenticity - C2PA Report', bold: true, size: 28, color: '6C5CE7' })],
    spacing: { after: 200 }
  }));
  var m = r.manifest;
  var infoRows = [['File', r.file], ['Active Manifest', r.activeLabel]];
  if (m.title) infoRows.push(['Title', m.title]);
  if (m.format) infoRows.push(['Format', m.format]);
  if (m.claim_generator) infoRows.push(['Generator', m.claim_generator]);
  if (m.instance_id) infoRows.push(['Instance ID', m.instance_id]);
  infoRows.push(['Validation', r.manifestStore.validation_state || 'unknown']);
  children.push(createDocxTable(docx, infoRows));
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 100 } }));
  if (m.claim_generator_info && m.claim_generator_info.length) {
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Generator Info', bold: true, size: 22, color: '6C5CE7' })],
      spacing: { before: 200, after: 100 }
    }));
    var genRows = m.claim_generator_info.map(function(info) { return [(info.name || '') + ' ' + (info.version || ''), '']; });
    children.push(createDocxTable(docx, genRows));
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  if (actions.length) {
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Actions', bold: true, size: 22, color: '6C5CE7' })],
      spacing: { before: 200, after: 100 }
    }));
    var actRows = [];
    actions.forEach(function(a) {
      var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
      items.forEach(function(act) { actRows.push([act.action || 'unknown', act.when || '']); });
    });
    children.push(createDocxTable(docx, actRows));
  }
  if (m.signature_info) {
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Signature', bold: true, size: 22, color: '6C5CE7' })],
      spacing: { before: 200, after: 100 }
    }));
    var sigRows = [];
    if (m.signature_info.issuer) sigRows.push(['Issuer', m.signature_info.issuer]);
    if (m.signature_info.time) sigRows.push(['Signed', m.signature_info.time]);
    children.push(createDocxTable(docx, sigRows));
  }
  var d = new docx.Document({ sections: [{ children: children }] });
  return docx.Packer.toBlob(d);
}

function c2paToCSV(r) {
  var rows = [['Key', 'Value']];
  rows.push(['File', r.file]);
  rows.push(['Active Manifest', r.activeLabel]);
  var m = r.manifest;
  if (m.title) rows.push(['Title', m.title]);
  if (m.format) rows.push(['Format', m.format]);
  if (m.claim_generator) rows.push(['Claim Generator', m.claim_generator]);
  if (m.instance_id) rows.push(['Instance ID', m.instance_id]);
  rows.push(['Validation', r.manifestStore.validation_state || 'unknown']);
  if (m.signature_info) {
    if (m.signature_info.issuer) rows.push(['Signature Issuer', m.signature_info.issuer]);
    if (m.signature_info.time) rows.push(['Signature Time', m.signature_info.time]);
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  actions.forEach(function(a) {
    var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
    items.forEach(function(act) { rows.push(['Action', act.action || 'unknown']); });
  });
  return rows.map(function(row) {
    return row.map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}

function c2paToTXT(r) {
  var lines = [];
  lines.push('=== RedoSan Authenticity - C2PA Report ===');
  lines.push('');
  lines.push('File: ' + r.file);
  lines.push('Active Manifest: ' + r.activeLabel);
  var m = r.manifest;
  if (m.title) lines.push('Title: ' + m.title);
  if (m.format) lines.push('Format: ' + m.format);
  if (m.claim_generator) lines.push('Claim Generator: ' + m.claim_generator);
  if (m.instance_id) lines.push('Instance ID: ' + m.instance_id);
  lines.push('Validation: ' + (r.manifestStore.validation_state || 'unknown'));
  lines.push('');
  if (m.claim_generator_info && m.claim_generator_info.length) {
    lines.push('--- Generator Info ---');
    m.claim_generator_info.forEach(function(info) {
      lines.push((info.name || '') + ' ' + (info.version || ''));
    });
    lines.push('');
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  if (actions.length) {
    lines.push('--- Actions ---');
    actions.forEach(function(a) {
      var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
      items.forEach(function(act) {
        lines.push('  ' + (act.action || 'unknown') + (act.when ? ' (' + act.when + ')' : ''));
      });
    });
    lines.push('');
  }
  if (m.signature_info) {
    lines.push('--- Signature ---');
    if (m.signature_info.issuer) lines.push('Issuer: ' + m.signature_info.issuer);
    if (m.signature_info.time) lines.push('Signed: ' + m.signature_info.time);
    lines.push('');
  }
  if (m.ingredients && m.ingredients.length) {
    lines.push('--- Ingredients ---');
    m.ingredients.forEach(function(ing) {
      lines.push('  ' + (ing.title || ing.instance_id || 'Unnamed') + (ing.relationship ? ' (' + ing.relationship + ')' : ''));
    });
    lines.push('');
  }
  lines.push('Generated by RedoSan Authenticity');
  return lines.join('\n');
}

function c2paToXML(r) {
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<c2pa_report>\n';
  xml += '  <file>' + escXml(r.file) + '</file>\n';
  xml += '  <active_manifest>' + escXml(r.activeLabel) + '</active_manifest>\n';
  xml += '  <validation_state>' + escXml(r.manifestStore.validation_state || 'unknown') + '</validation_state>\n';
  var m = r.manifest;
  if (m.title) xml += '  <title>' + escXml(m.title) + '</title>\n';
  if (m.format) xml += '  <format>' + escXml(m.format) + '</format>\n';
  if (m.claim_generator) xml += '  <claim_generator>' + escXml(m.claim_generator) + '</claim_generator>\n';
  if (m.instance_id) xml += '  <instance_id>' + escXml(m.instance_id) + '</instance_id>\n';
  if (m.claim_generator_info && m.claim_generator_info.length) {
    xml += '  <generator_info>\n';
    m.claim_generator_info.forEach(function(info) {
      xml += '    <generator name="' + escXml(info.name || '') + '" version="' + escXml(info.version || '') + '"/>\n';
    });
    xml += '  </generator_info>\n';
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  if (actions.length) {
    xml += '  <actions>\n';
    actions.forEach(function(a) {
      var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
      items.forEach(function(act) {
        xml += '    <action name="' + escXml(act.action || 'unknown') + '"';
        if (act.when) xml += ' when="' + escXml(act.when) + '"';
        if (act.digitalSourceType) xml += ' digitalSourceType="' + escXml(act.digitalSourceType) + '"';
        xml += '/>\n';
      });
    });
    xml += '  </actions>\n';
  }
  if (m.signature_info) {
    xml += '  <signature>\n';
    if (m.signature_info.issuer) xml += '    <issuer>' + escXml(m.signature_info.issuer) + '</issuer>\n';
    if (m.signature_info.time) xml += '    <time>' + escXml(m.signature_info.time) + '</time>\n';
    xml += '  </signature>\n';
  }
  if (m.ingredients && m.ingredients.length) {
    xml += '  <ingredients>\n';
    m.ingredients.forEach(function(ing) {
      xml += '    <ingredient title="' + escXml(ing.title || '') + '" relationship="' + escXml(ing.relationship || '') + '"/>\n';
    });
    xml += '  </ingredients>\n';
  }
  xml += '</c2pa_report>';
  return xml;
}

function c2paToHTML(r) {
  var m = r.manifest;
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>C2PA Report - ' + escHtml(r.file) + '</title>';
  h += '<style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#222}';
  h += 'h1{font-size:1.5rem;border-bottom:2px solid #6C5CE7;padding-bottom:8px}';
  h += 'table{width:100%;border-collapse:collapse;margin:12px 0}';
  h += 'td,th{padding:6px 12px;border:1px solid #ddd;text-align:left;font-size:0.85rem}';
  h += 'td:first-child{font-weight:600;width:180px;background:#f5f5f5}';
  h += 'code{font-size:0.75rem;word-break:break-all}';
  h += '.section{margin-top:20px;font-weight:700;font-size:0.9rem;color:#6C5CE7}';
  h += '.footer{margin-top:30px;font-size:0.75rem;color:#888;border-top:1px solid #ddd;padding-top:8px}</style></head><body>';
  h += '<h1>RedoSan Authenticity - C2PA Report</h1>';
  h += '<table>';
  h += '<tr><td>File</td><td>' + escHtml(r.file) + '</td></tr>';
  h += '<tr><td>Active Manifest</td><td><code>' + escHtml(r.activeLabel) + '</code></td></tr>';
  if (m.title) h += '<tr><td>Title</td><td>' + escHtml(m.title) + '</td></tr>';
  if (m.format) h += '<tr><td>Format</td><td>' + escHtml(m.format) + '</td></tr>';
  if (m.claim_generator) h += '<tr><td>Claim Generator</td><td>' + escHtml(m.claim_generator) + '</td></tr>';
  if (m.instance_id) h += '<tr><td>Instance ID</td><td><code>' + escHtml(m.instance_id) + '</code></td></tr>';
  h += '<tr><td>Validation</td><td>' + escHtml(r.manifestStore.validation_state || 'unknown') + '</td></tr>';
  h += '</table>';
  if (m.claim_generator_info && m.claim_generator_info.length) {
    h += '<div class="section">Generator Info</div><table>';
    m.claim_generator_info.forEach(function(info) {
      h += '<tr><td>' + escHtml(info.name || '') + '</td><td>v' + escHtml(info.version || '') + '</td></tr>';
    });
    h += '</table>';
  }
  var actions = (m.assertions || []).filter(function(a) { return a.label === 'c2pa.actions'; });
  if (actions.length) {
    h += '<div class="section">Actions</div><table>';
    actions.forEach(function(a) {
      var items = Array.isArray(a.data) ? a.data : (a.data && a.data.actions ? a.data.actions : [a.data]);
      items.forEach(function(act) {
        h += '<tr><td>' + escHtml(act.action || 'unknown') + '</td><td>' + (act.when ? escHtml(act.when) : '') + '</td></tr>';
      });
    });
    h += '</table>';
  }
  if (m.signature_info) {
    h += '<div class="section">Signature</div><table>';
    if (m.signature_info.issuer) h += '<tr><td>Issuer</td><td>' + escHtml(m.signature_info.issuer) + '</td></tr>';
    if (m.signature_info.time) h += '<tr><td>Signed</td><td>' + escHtml(m.signature_info.time) + '</td></tr>';
    h += '</table>';
  }
  if (m.ingredients && m.ingredients.length) {
    h += '<div class="section">Ingredients</div><table>';
    m.ingredients.forEach(function(ing) {
      h += '<tr><td>' + escHtml(ing.title || ing.instance_id || 'Unnamed') + '</td><td>' + escHtml(ing.relationship || '') + '</td></tr>';
    });
    h += '</table>';
  }
  h += '<div class="footer">Generated by RedoSan Authenticity</div></body></html>';
  return h;
}

window.handleC2paVerify = async function() {
  const fileInput = document.getElementById('c2pa-verify-file');
  const output = document.getElementById('c2pa-verify-output');
  const spinner = document.getElementById('c2pa-verify-spinner');
  const resultDiv = document.getElementById('c2pa-verify-result');

  const file = fileInput.files[0];
  if (!file) { alert('Please select a file'); return; }

  output.innerHTML = '';
  spinner.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(file.type || 'image/jpeg', file);

    if (!reader) {
      output.innerHTML = '<div class="c2pa-no-data"><strong>No C2PA data found</strong><p>This file has no C2PA provenance metadata.</p></div>';
      spinner.style.display = 'none';
      resultDiv.style.display = 'block';
      return;
    }

    const manifestStore = await reader.manifestStore();
    await reader.free();

    if (!manifestStore || !manifestStore.manifests) {
      output.innerHTML = '<div class="c2pa-no-data"><strong>No manifests found</strong></div>';
      spinner.style.display = 'none';
      resultDiv.style.display = 'block';
      return;
    }

    const state = manifestStore.validation_state;
    const statusList = manifestStore.validation_status || [];
    const activeLabel = manifestStore.active_manifest || Object.keys(manifestStore.manifests)[0];
    const manifest = manifestStore.manifests[activeLabel];

    let html = `<div class="c2pa-verify-result ${state === 'ok' ? 'c2pa-verified' : 'c2pa-unverified'}">`;

    if (state === 'ok') {
      html += '<div class="c2pa-verify-icon">✓</div><strong>Verified</strong>';
    } else {
      html += '<div class="c2pa-verify-icon c2pa-verify-icon-warn">!</div><strong>' + escHtml(state || 'Unknown') + '</strong>';
    }

    html += `<p>Claim: ${escHtml(manifest.title || 'Untitled')}</p>`;
    html += `<p>Generator: ${escHtml(manifest.claim_generator || 'Unknown')}</p>`;
    if (manifest.claim_generator_info && manifest.claim_generator_info.length) {
      const genInfo = manifest.claim_generator_info[0];
      html += `<p>Software: ${escHtml(genInfo.name || '')} ${genInfo.version || ''}</p>`;
    }
    if (manifest.signature_info && manifest.signature_info.issuer) {
      html += `<p>Signed by: ${escHtml(manifest.signature_info.issuer)}</p>`;
    }
    html += '<p><a href="#" onclick="showPage(\'c2pa\');switchC2paTab(\'read\');return false;">View Full Details</a></p>';

    html += '</div>';
    output.innerHTML = html;
    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  } catch (err) {
    output.innerHTML = `<div class="c2pa-error"><strong>Error:</strong> ${escHtml(err.message)}</div>`;
    spinner.style.display = 'none';
    resultDiv.style.display = 'block';
  }
};



