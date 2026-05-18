// ── CLI: C2PA Provenance Command ──
// Sign, read, and verify C2PA provenance metadata

'use strict';

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { readFileBytes, getFileInfo, fmtSize } = require('../utils');

// ── Embedded C2PA test credentials (from C2PA/c2pa.js) ──
const C2PA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfNJBsaRLSeHizv0m
GL+gcn78QmtfLSm+n+qG9veC2W2hRANCAAQPaL6RkAkYkKU4+IryBSYxJM3h77sF
iMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWkyl3QGuV/wt0MrAPDo
-----END PRIVATE KEY-----`;

const C2PA_CERTS = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
gYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJU29tZXdoZXJl
MScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3QgQ0ExGTAXBgNV
BAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVkaXRlIENBMCAe
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
gEdZPT2qO+/2xxICIQD/nFV4pGEf7n7LC3lh7BC8P/WPFd2S6FMq9Lg7WqVAmg==
-----END CERTIFICATE-----`;

// ── Signing ──
function signWithECKey(data) {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(C2PA_PRIVATE_KEY);
}

function genC2PAManifest(fileHash, fileName, mimeType, assertions) {
  const now = new Date().toISOString();
  return {
    version: 1,
    generated_at: now,
    format: 'application/c2pa',
    claim_generator: 'RedoSan Authenticity CLI v1.0',
    signature_info: {
      issuer: 'CN=C2PA Signer',
      certificate_chain: C2PA_CERTS,
    },
    assertions: assertions || [
      { label: 'c2pa.claimed', data: { value: fileName } },
      { label: 'c2pa.created', data: { value: now } },
    ],
    credentials: {
      signing_key_algorithm: 'ES256',
      certificates: [{ issuer: 'CN=C2PA Signer' }],
    },
    file: {
      name: fileName,
      hash: { algorithm: 'SHA-256', value: fileHash },
      mime_type: mimeType,
    },
  };
}

// ── C2PA Read (search file for C2PA markers) ──
function findC2PAInFile(filePath) {
  const data = readFileBytes(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') {
    // JPEG: look for C2PA marker (APP11 - 0xFFEB)
    for (let i = 0; i < data.length - 16; i++) {
      if (data[i] === 0xFF && data[i+1] === 0xEB) {
        const segLen = (data[i+2] << 8) | data[i+3];
        const c2paMarker = 'c2pa\x00';
        let found = true;
        for (let j = 0; j < 5; j++) {
          if (data[i+4+j] !== c2paMarker.charCodeAt(j)) { found = false; break; }
        }
        if (found) {
          const payload = data.slice(i, i + 4 + segLen);
          return { offset: i, length: segLen + 2, data: payload };
        }
      }
    }
  } else if (ext === '.png') {
    // PNG: look for c2pa chunk
    const marker = Buffer.from('c2pa');
    for (let i = 8; i < data.length - 12; i++) {
      const chunkLen = (data[i] << 24) | (data[i+1] << 16) | (data[i+2] << 8) | data[i+3];
      let match = true;
      for (let j = 0; j < 4; j++) {
        if (data[i+4+j] !== marker[j]) { match = false; break; }
      }
      if (match && chunkLen > 0 && i + 12 + chunkLen <= data.length) {
        return { offset: i, length: chunkLen + 12, data: data.slice(i, i + chunkLen + 12) };
      }
      i += chunkLen + 12;
    }
  }
  return null;
}

function parseC2PAFromBuffer(buf) {
  try {
    const dec = new TextDecoder('utf-8', { fatal: false });
    const text = dec.decode(buf);
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return { raw: buf, note: 'C2PA binary data (not JSON-parseable)' };
  } catch(e) {
    return { raw: buf, note: 'C2PA binary data' };
  }
}

// ── Commands ──
async function runC2pa(action, filePath, opts) {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) { console.error('File not found'); process.exit(1); }

    if (action === 'sign') await doSign(absPath, opts);
    else if (action === 'read') await doRead(absPath, opts);
    else if (action === 'verify') await doVerify(absPath, opts);
    else { console.error('Unknown action. Use: sign, read, verify'); process.exit(1); }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function doSign(absPath, opts) {
  const data = readFileBytes(absPath);
  const info = getFileInfo(absPath);
  const fileHash = crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
  const assertions = [];

  if (opts.claim) assertions.push({ label: 'c2pa.claimed', data: { value: opts.claim } });
  if (opts.title) assertions.push({ label: 'c2pa.title', data: { value: opts.title } });
  if (opts.author) assertions.push({ label: 'c2pa.author', data: { value: opts.author } });
  assertions.push({ label: 'c2pa.created', data: { value: new Date().toISOString() } });

  const manifest = genC2PAManifest(fileHash, info.name, info.type, assertions);
  const manifestJson = JSON.stringify(manifest, null, 2);
  const signature = signWithECKey(Buffer.from(manifestJson));
  manifest.signature = {
    algorithm: 'ES256',
    value: signature.toString('base64'),
  };

  const signedManifest = JSON.stringify(manifest, null, 2);
  const output = opts.output ? path.resolve(opts.output) : absPath + '.c2pa.json';
  fs.writeFileSync(output, signedManifest);

  console.log(`C2PA manifest signed`);
  console.log(`File: ${info.name}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log(`Manifest: ${output}`);
  console.log(`Signature: ${signature.length} bytes (ES256)`);
}

async function doRead(absPath, opts) {
  const info = getFileInfo(absPath);
  const data = readFileBytes(absPath);
  const fileHash = crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');

  console.log(`C2PA Read: ${info.name}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log('─'.repeat(60));

  const c2paData = findC2PAInFile(absPath);
  if (c2paData) {
    console.log(`\nC2PA data found at offset ${c2paData.offset} (${c2paData.length} bytes)`);
    const parsed = parseC2PAFromBuffer(c2paData.data);
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    console.log('\nNo C2PA data found in file.');
    console.log('Tip: C2PA is embedded in JPEG/SVG/PNG files as APP11 or custom chunk.');
    console.log('Files without C2PA support (GIF, BMP, WEBP) will not contain C2PA data.');
  }

  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), JSON.stringify({
      file: info.name,
      hash: fileHash,
      c2pa: c2paData ? parseC2PAFromBuffer(c2paData.data) : null,
    }, null, 2));
    console.log(`\nResults saved to: ${opts.output}`);
  }
}

async function doVerify(absPath, opts) {
  const data = readFileBytes(absPath);
  const info = getFileInfo(absPath);
  const fileHash = crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');

  console.log(`C2PA Verify: ${info.name}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log('─'.repeat(60));

  const c2paData = findC2PAInFile(absPath);
  if (!c2paData) {
    console.log('No C2PA data found in file.');
    return;
  }

  const parsed = parseC2PAFromBuffer(c2paData.data);
  if (parsed.signature && parsed.signature.value) {
    try {
      const verify = crypto.createVerify('SHA256');
      const manifestWithoutSig = { ...parsed };
      delete manifestWithoutSig.signature;
      verify.update(JSON.stringify(manifestWithoutSig));
      verify.end();

      const sigBuf = Buffer.from(parsed.signature.value, 'base64');
      const certPem = C2PA_CERTS;
      const valid = verify.verify(certPem, sigBuf);
      console.log(`\nSignature: ${valid ? '✓ VALID' : '✗ INVALID'}`);
    } catch(e) {
      console.log(`\nSignature verification unavailable: ${e.message}`);
    }
  } else {
    console.log('\nNo signature found in C2PA data.');
  }
  console.log(`\nManifest:\n${JSON.stringify(parsed, null, 2)}`);
}

module.exports = { runC2pa };