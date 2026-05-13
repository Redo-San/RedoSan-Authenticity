let wasmExports = null;

async function ensureWasm() {
  if (!wasmExports) {
    wasmExports = await import('./c2pa-custom/pkg/c2pa_custom.js');
    await wasmExports.default();
  }
  return wasmExports;
}

function parsePem(pem) {
  const b64 = pem.replace(/-----BEGIN [\w\s]+-----/g, '').replace(/-----END [\w\s]+-----/g, '').replace(/\s/g, '');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function splitCerts(pem) {
  const certs = [];
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let match;
  while ((match = regex.exec(pem)) !== null) {
    certs.push(parsePem(match[0]));
  }
  return certs;
}

export async function isAvailable() {
  try {
    await ensureWasm();
    return true;
  } catch {
    return false;
  }
}

export async function signImage(options) {
  const { file, title, author, contentType, digitalSrc, ingredients, privateKeyPem, certsPem } = options;

  const wasm = await ensureWasm();
  const { WasmBuilder } = wasm;

  const allCerts = splitCerts(certsPem);
  const signingCert = allCerts[0] || new Uint8Array(0);
  const taCerts = allCerts.slice(1);

  const privateKeyBuffer = parsePem(privateKeyPem);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const signerDef = {
    alg: 'es256',
    reserveSize: 300,
    signingCert,
    taCerts,
    sign: async (data) => {
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
      return new Uint8Array(sig);
    }
  };

  const vendor = 'RedoSan Authenticity';

  const manifestDef = {
    title: title || file.name || 'Untitled',
    claim_generator: vendor,
    claim_generator_info: [{ name: vendor, version: '1.0' }],
    assertions: []
  };

  const builder = WasmBuilder.fromJson(JSON.stringify(manifestDef));

  if (digitalSrc) {
    builder.setIntent({ Create: digitalSrc });
  } else if (contentType === 'edit') {
    builder.setIntent('Edit');
  } else if (contentType === 'update') {
    builder.setIntent('Update');
  } else {
    builder.setIntent({ Create: 'http://c2pa.org/digitalsourcetype/empty' });
  }

  if (author) {
    const action = {
      action: 'c2pa.created',
      actor: { name: author },
      when: new Date().toISOString()
    };
    if (digitalSrc) {
      action.digitalSourceType = digitalSrc;
    }
    builder.addAction(action);
  }

  if (ingredients && ingredients.length > 0) {
    for (const ingFile of ingredients) {
      const ingBuf = await ingFile.arrayBuffer();
      const ingBlob = new Blob([ingBuf]);
      await builder.addIngredientFromBlob(
        JSON.stringify({ title: ingFile.name, relationship: 'componentOf' }),
        ingFile.type || 'image/jpeg',
        ingBlob
      );
    }
  }

  const buf = await file.arrayBuffer();
  const format = file.type || 'image/jpeg';
  const signedBytes = await builder.signFromBytes(signerDef, format, new Uint8Array(buf));
  builder.free();

  return signedBytes;
}
