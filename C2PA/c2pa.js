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
    const c2pa = await getC2pa();
    const signer = await createBrowserSigner();
    const builder = await c2pa.builder.new();

    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const digitalSrc = selectedOption.dataset.c2paSrc;
    const contentType = typeSelect.value;

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

    const signedBytes = await builder.sign(signer, file.type || 'image/jpeg', blob);
    await builder.free();

    const signedBlob = new Blob([signedBytes], { type: file.type || 'image/jpeg' });
    const url = URL.createObjectURL(signedBlob);
    const origName = file.name.replace(/\.[^.]+$/, '');
    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg';
    const fileName = origName + '_c2pa_signed' + ext;

    output.innerHTML = `
      <div class="c2pa-success">
        <strong>Success!</strong>
        <p>Image signed with C2PA provenance metadata.</p>
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



