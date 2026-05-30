'use strict';

const path = require('path');
const fs = require('fs');

async function runCertificate(filePath, opts) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('Fingerprint JSON not found:', absPath);
    process.exit(1);
  }

  let fpData;
  try {
    fpData = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } catch (e) {
    console.error('Invalid JSON file:', e.message);
    process.exit(1);
  }

  const format = (opts.format || 'pdf').toLowerCase();
  const outPath = opts.output ? path.resolve(opts.output) : path.resolve('passport.' + format);

  const cert = {
    title: 'RedoSan Authenticity — Digital Passport',
    generated: new Date().toISOString(),
    fingerprint: fpData,
    issuer: 'RedoSan Authenticity CLI',
    serial: 'CERT-' + Date.now().toString(36).toUpperCase(),
  };

  let output;
  if (format === 'pdf') {
    output = generatePDF(cert);
  } else if (format === 'json') {
    output = JSON.stringify(cert, null, 2);
  } else {
    output = JSON.stringify(cert, null, 2);
    console.log('Only PDF and JSON formats supported in CLI. Generating JSON.');
  }

  fs.writeFileSync(outPath, output);
  console.log(`Digital Passport generated: ${outPath}`);
}

function generatePDF(cert) {
  let pdf = `%PDF-1.4\n`;
  const esc = (s) => (s || '').replace(/[\\()]/g, '\\$&');
  const lines = [
    `1 0 obj`,
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `endobj`,
    `2 0 obj`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `endobj`,
    `3 0 obj`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `endobj`,
    `4 0 obj`,
    `<< /Length 400 >>`,
    `stream`,
    `BT /F1 24 Tf 72 720 Td (${esc(cert.title)}) Tj ET`,
    `BT /F1 12 Tf 72 680 Td (Certificate Serial: ${esc(cert.serial)}) Tj ET`,
    `BT /F1 10 Tf 72 650 Td (Generated: ${esc(cert.generated)}) Tj ET`,
    `BT /F1 10 Tf 72 620 Td (Issuer: ${esc(cert.issuer)}) Tj ET`,
    `BT /F1 12 Tf 72 580 Td (File Fingerprint:) Tj ET`,
    `BT /F1 9 Tf 72 560 Td (SHA-256: ${esc((cert.fingerprint.sha256 || cert.fingerprint.fileHash || 'N/A'))}) Tj ET`,
    `endstream`,
    `endobj`,
    `5 0 obj`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `endobj`,
    `xref`,
    `0 6`,
    `0000000000 65535 f `,
    `0000000009 00000 n `,
    `0000000058 00000 n `,
    `0000000115 00000 n `,
    `0000000266 00000 n `,
    `0000000725 00000 n `,
    `trailer << /Size 6 /Root 1 0 R >>`,
    `startxref`,
    `780`,
    `%%%%EOF`,
  ];
  return lines.join('\n');
}

module.exports = { runCertificate };
