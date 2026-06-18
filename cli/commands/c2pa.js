// ── CLI: C2PA Provenance Command ──
// Sign, read, and verify C2PA provenance metadata

const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { readFileBytes, getFileInfo, validateFile } = require("../utils");

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
/**
 *
 * @param data
 */
function signWithECKey(data) {
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  return sign.sign(C2PA_PRIVATE_KEY);
}

/**
 *
 * @param fileHash
 * @param fileName
 * @param mimeType
 * @param assertions
 */
function genC2PAManifest(fileHash, fileName, mimeType, assertions) {
  const now = new Date().toISOString();
  return {
    version: 1,
    generated_at: now,
    format: "application/c2pa",
    claim_generator: "RedoSan Authenticity CLI v1.0",
    signature_info: {
      issuer: "CN=C2PA Signer",
      certificate_chain: C2PA_CERTS,
    },
    assertions: assertions || [
      { label: "c2pa.claimed", data: { value: fileName } },
      { label: "c2pa.created", data: { value: now } },
    ],
    credentials: {
      signing_key_algorithm: "ES256",
      certificates: [{ issuer: "CN=C2PA Signer" }],
    },
    file: {
      name: fileName,
      hash: { algorithm: "SHA-256", value: fileHash },
      mime_type: mimeType,
    },
  };
}

// ── C2PA Read (search file for C2PA markers) ──
/**
 *
 * @param filePath
 */
function findC2PAInFile(filePath) {
  const data = readFileBytes(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") {
    // JPEG: look for C2PA marker (APP11 - 0xFFEB)
    for (let i = 0; i < data.length - 16; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xEB) {
        const segLen = (data[i + 2] << 8) | data[i + 3];
        const c2paMarker = "c2pa\u0000";
        let found = true;
        for (let j = 0; j < 5; j++) {
          if (data[i + 4 + j] !== c2paMarker.charCodeAt(j)) {
            found = false;
            break;
          }
        }
        if (found) {
          const payload = data.slice(i, i + 4 + segLen);
          return { offset: i, length: segLen + 2, data: payload };
        }
      }
    }
  } else if (ext === ".png") {
    // PNG: look for c2pa chunk
    const marker = Buffer.from("c2pa");
    let i = 8;
    while (i <= data.length - 12) {
      const chunkLen = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
      let match = true;
      for (let j = 0; j < 4; j++) {
        if (data[i + 4 + j] !== marker[j]) {
          match = false;
          break;
        }
      }
      if (match && chunkLen > 0 && i + 12 + chunkLen <= data.length) {
        return { offset: i, length: chunkLen + 12, data: data.slice(i, i + chunkLen + 12) };
      }
      i += chunkLen + 12;
    }
  }
  return null;
}

/**
 *
 * @param buf
 */
function parseC2PAFromBuffer(buf) {
  try {
    const dec = new TextDecoder("utf-8", { fatal: false });
    const text = dec.decode(buf);
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return { raw: buf, note: "C2PA binary data (not JSON-parseable)" };
  } catch {
    return { raw: buf, note: "C2PA binary data" };
  }
}

// ── Commands ──
/**
 *
 * @param action
 * @param filePath
 * @param opts
 */
async function runC2pa(action, filePath, opts) {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.error("File not found");
      process.exit(1);
    }
    const allowDangerous = opts.allowDangerous || process.argv.includes("--allow-dangerous");
    try {
      validateFile(absPath, { allowDangerous });
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      if (error.message.includes("Blocked dangerous file type")) console.error("Use --allow-dangerous to bypass");
      process.exit(1);
    }

    switch (action) {
    case "sign": {
    await doSign(absPath, opts);
    break;
    }
    case "read": {
    await doRead(absPath, opts);
    break;
    }
    case "verify": {
    await doVerify(absPath, opts);
    break;
    }
    default: {
      console.error("Unknown action. Use: sign, read, verify");
      process.exit(1);
    }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 *
 * @param absPath
 * @param opts
 */
async function doSign(absPath, opts) {
  const data = readFileBytes(absPath);
  const info = getFileInfo(absPath);
  const fileHash = crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
  const assertions = [];

  if (opts.claim) assertions.push({ label: "c2pa.claimed", data: { value: opts.claim } });
  if (opts.title) assertions.push({ label: "c2pa.title", data: { value: opts.title } });
  if (opts.author) assertions.push({ label: "c2pa.author", data: { value: opts.author } });
  assertions.push({ label: "c2pa.created", data: { value: new Date().toISOString() } });

  const manifest = genC2PAManifest(fileHash, info.name, info.type, assertions);
  const manifestJson = JSON.stringify(manifest, null, 2);
  const signature = signWithECKey(Buffer.from(manifestJson));
  manifest.signature = {
    algorithm: "ES256",
    value: signature.toString("base64"),
  };

  const signedManifest = JSON.stringify(manifest, null, 2);
  const manifestBuf = Buffer.from(signedManifest, "utf-8");

  // Determine output image path
  const output = opts.output ? path.resolve(opts.output) : absPath;

  // Embed C2PA manifest into image
  const ext = path.extname(absPath).toLowerCase();
  let outputData;

  if (ext === ".jpg" || ext === ".jpeg") {
    outputData = embedC2PAJPEG(data, manifestBuf);
  } else if (ext === ".png") {
    outputData = embedC2PAPNG(data, manifestBuf);
  } else {
    // For unsupported formats, just save the JSON manifest separately
    const jsonOut = `${output.replace(/\.\w+$/, "")}.c2pa.json`;
    fs.writeFileSync(jsonOut, signedManifest);
    console.log(`C2PA manifest signed (not embedded — ${ext} not supported)`);
    console.log(`Manifest: ${jsonOut}`);
    console.log(`File: ${info.name}`);
    console.log(`SHA-256: ${fileHash}`);
    console.log(`Signature: ${signature.length} bytes (ES256)`);
    return;
  }

  fs.writeFileSync(output, outputData);

  console.log(`C2PA manifest embedded`);
  console.log(`File: ${output}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log(`Signature: ${signature.length} bytes (ES256)`);
}

// ── JPEG: embed C2PA as APP11 (0xFFEB) segment before SOS ──
/**
 *
 * @param jpegBuf
 * @param manifestBuf
 */
function embedC2PAJPEG(jpegBuf, manifestBuf) {
  // Find SOS marker (0xFFDA) — insert APP11 before it
  const sosIdx = findJPEGMarker(jpegBuf, 0xDA);
  if (sosIdx < 0) throw new Error("JPEG SOS marker not found");

  // Build C2PA payload: 'c2pa\x00' + 4-byte big-endian length + manifest
  const c2paHeader = Buffer.concat([Buffer.from("c2pa\u0000", "utf-8"), Buffer.alloc(4), manifestBuf]);
  c2paHeader.writeUInt32BE(manifestBuf.length, 5); // 4-byte length after 'c2pa\0'

  // Build APP11 segment: FF EB + 2-byte big-endian segment length (including length field) + payload
  const segLen = c2paHeader.length + 2; // +2 for the length field itself
  const app11 = Buffer.alloc(2 + segLen);
  app11[0] = 0xFF;
  app11[1] = 0xEB;
  app11.writeUInt16BE(segLen, 2);
  c2paHeader.copy(app11, 4);

  // Insert before SOS
  return Buffer.concat([jpegBuf.slice(0, sosIdx), app11, jpegBuf.slice(sosIdx)]);
}

/**
 *
 * @param buf
 * @param marker
 */
function findJPEGMarker(buf, marker) {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0xFF && buf[i + 1] === marker) return i;
  }
  return -1;
}

// ── PNG: embed C2PA as custom 'c2pa' chunk before IEND ──
/**
 *
 * @param pngBuf
 * @param manifestBuf
 */
function embedC2PAPNG(pngBuf, manifestBuf) {
  const idatIdx = findPNGChunk(pngBuf, "IDAT");
  if (idatIdx < 0) throw new Error("PNG IDAT chunk not found");

  // Build c2pa chunk: 4-byte length + 'c2pa' + data + 4-byte CRC
  const chunkType = Buffer.from("c2pa", "ascii");
  const chunkLen = manifestBuf.length;
  const crcInput = Buffer.concat([chunkType, manifestBuf]);
  const crcVal = crc32(crcInput);
  const chunk = Buffer.alloc(12 + chunkLen);
  chunk.writeUInt32BE(chunkLen, 0);
  chunkType.copy(chunk, 4);
  manifestBuf.copy(chunk, 8);
  chunk.writeUInt32BE(crcVal, 8 + chunkLen);

  // Insert before first IDAT (PNG spec: ancillary chunks before IDAT, only text after)
  return Buffer.concat([pngBuf.slice(0, idatIdx), chunk, pngBuf.slice(idatIdx)]);
}

/**
 *
 * @param buf
 * @param name
 */
function findPNGChunk(buf, name) {
  const nameBytes = Buffer.from(name, "ascii");
  let i = 8;
  while (i <= buf.length - 12) {
    const chunkLen = buf.readUInt32BE(i);
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (buf[i + 4 + j] !== nameBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
    i += 12 + chunkLen;
  }
  return -1;
}

// Simple CRC32 for PNG chunk
/**
 *
 * @param buf
 */
function crc32(buf) {
  let crc = 0xFF_FF_FF_FF;
  for (const element of buf) {
    crc ^= element;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xED_B8_83_20 : 0);
    }
  }
  return (crc ^ 0xFF_FF_FF_FF) >>> 0;
}

/**
 *
 * @param absPath
 * @param opts
 */
async function doRead(absPath, opts) {
  const info = getFileInfo(absPath);
  const data = readFileBytes(absPath);
  const fileHash = crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");

  console.log(`C2PA Read: ${info.name}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log("─".repeat(60));

  const c2paData = findC2PAInFile(absPath);
  if (c2paData) {
    console.log(`\nC2PA data found at offset ${c2paData.offset} (${c2paData.length} bytes)`);
    const parsed = parseC2PAFromBuffer(c2paData.data);
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    console.log("\nNo C2PA data found in file.");
    console.log("Tip: C2PA is embedded in JPEG/SVG/PNG files as APP11 or custom chunk.");
    console.log("Files without C2PA support (GIF, BMP, WEBP) will not contain C2PA data.");
  }

  if (opts.output) {
    fs.writeFileSync(
      path.resolve(opts.output),
      JSON.stringify(
        {
          file: info.name,
          hash: fileHash,
          c2pa: c2paData ? parseC2PAFromBuffer(c2paData.data) : null,
        },
        null,
        2,
      ),
    );
    console.log(`\nResults saved to: ${opts.output}`);
  }
}

/**
 *
 * @param absPath
 * @param _opts
 */
async function doVerify(absPath, _opts) {
  const data = readFileBytes(absPath);
  const info = getFileInfo(absPath);
  const fileHash = crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");

  console.log(`C2PA Verify: ${info.name}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log("─".repeat(60));

  const c2paData = findC2PAInFile(absPath);
  if (!c2paData) {
    console.log("No C2PA data found in file.");
    return;
  }

  const parsed = parseC2PAFromBuffer(c2paData.data);
  if (parsed.signature?.value) {
    try {
      const verify = crypto.createVerify("SHA256");
      const manifestWithoutSig = { ...parsed };
      delete manifestWithoutSig.signature;
      verify.update(JSON.stringify(manifestWithoutSig));
      verify.end();

      const sigBuf = Buffer.from(parsed.signature.value, "base64");
      const certPem = C2PA_CERTS;
      const valid = verify.verify(certPem, sigBuf);
      console.log(`\nSignature: ${valid ? "✓ VALID" : "✗ INVALID"}`);
    } catch (error) {
      console.log(`\nSignature verification unavailable: ${error.message}`);
    }
  } else {
    console.log("\nNo signature found in C2PA data.");
  }
  console.log(`\nManifest:\n${JSON.stringify(parsed, null, 2)}`);
}

module.exports = { runC2pa };
