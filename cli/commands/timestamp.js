// ── CLI: Timestamp Command ──
// Creates/verifies OpenTimestamps (.ots) proofs

const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const fs = require("node:fs");
const { readFileBytes, getFileInfo, fmtSize } = require("../utils");

// ── OTS constants (copied from timestamp.js) ──
var OTS_HEADER = [
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72,
  0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
];
var OTS_MAJOR_VERSION = 1;
var OTS_SHA256_TAG = 0x08;

/**
 *
 * @param sha256Bytes
 */
function otsBuildDetached(sha256Bytes) {
  var out = [...OTS_HEADER];
  out.push(OTS_MAJOR_VERSION, OTS_SHA256_TAG);
  for (let i = 0; i < 32; i++) out.push(sha256Bytes[i]);
  return new Uint8Array(out);
}

/**
 *
 * @param bytes
 */
function otsParse(bytes) {
  var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  var off = 0;
  var magic = data.slice(off, off + OTS_HEADER.length);
  off += OTS_HEADER.length;
  for (const [i, element] of OTS_HEADER.entries()) {
    if (magic[i] !== element) throw new Error("Invalid OTS file: bad magic bytes");
  }
  var ver = data[off++];
  if (ver !== OTS_MAJOR_VERSION) throw new Error(`Unsupported OTS version: ${ver}`);
  var tag = data[off++];
  if (tag !== OTS_SHA256_TAG) throw new Error("Unsupported hash: only SHA-256 supported");
  var hash = data.slice(off, off + 32);
  return { hash: hash, tag: tag };
}

var OTS_AGGREGATORS = ["https://a.pool.opentimestamps.org/digest", "https://b.pool.opentimestamps.org/digest"];

// Node.js HTTPS POST (replaces fetch)
/**
 *
 * @param url
 * @param bodyBytes
 */
function httpsPost(url, bodyBytes) {
  return new Promise((resolve, reject) => {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": bodyBytes.length,
      },
      timeout: 15_000,
    };
    var req = https.request(options, (res) => {
      var chunks = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        var buf = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(new Uint8Array(buf));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf.toString().substring(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(Buffer.from(bodyBytes));
    req.end();
  });
}

/**
 *
 * @param bytes
 */
async function upgradeOts(bytes) {
  var lastErr;
  for (var url of OTS_AGGREGATORS) {
    try {
      return await httpsPost(url, bytes);
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr;
}

/**
 *
 * @param action
 * @param filePath
 * @param opts
 */
async function runTimestamp(action, filePath, opts) {
  try {
    if (action === "create") {
      await runCreate(filePath, opts);
    } else if (action === "verify") {
      await runVerify(filePath, opts);
    } else {
      console.error(`Unknown action: ${action}`);
      console.error("Available: create, verify");
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 *
 * @param filePath
 * @param opts
 */
async function runCreate(filePath, opts) {
  const absPath = path.resolve(filePath);
  const data = readFileBytes(absPath);
  const info = getFileInfo(filePath);

  // Compute SHA-256
  const sha256Hash = crypto.createHash("sha256").update(Buffer.from(data)).digest();
  const sha256Bytes = new Uint8Array(sha256Hash);

  console.log("Creating OpenTimestamps proof...");

  // Try to upgrade via calendar aggregator (send raw 32-byte hash only)
  let upgraded = false;
  let upgradedBytes;
  try {
    const resp = await upgradeOts(sha256Bytes);
    // Aggregator returns timestamp operations — wrap in .ots format
    upgradedBytes = new Uint8Array(OTS_HEADER.length + 1 + 1 + 32 + resp.length);
    upgradedBytes.set(new Uint8Array(OTS_HEADER), 0);
    upgradedBytes[OTS_HEADER.length] = 1;
    upgradedBytes[OTS_HEADER.length + 1] = 0x08;
    upgradedBytes.set(sha256Bytes, OTS_HEADER.length + 2);
    upgradedBytes.set(resp, OTS_HEADER.length + 2 + 32);
    upgraded = true;
  } catch {
    // Aggregator unreachable — build incomplete .ots as fallback
    upgradedBytes = otsBuildDetached(sha256Bytes);
    console.log("⚠ Calendar aggregator unreachable (will create incomplete .ots)");
    console.log("  To complete later: redosan timestamp upgrade proof.ots");
  }

  // Determine output path
  let outputPath;
  outputPath = opts.output ? path.resolve(opts.output) : `${absPath}.ots`;

  fs.writeFileSync(outputPath, Buffer.from(upgradedBytes));

  console.log(`\n✓ ${upgraded ? "Complete" : "Incomplete"} .ots timestamp created`);
  console.log(`File: ${info.name}`);
  console.log(`SHA-256: ${sha256Hash.toString("hex")}`);
  console.log(`Size: ${fmtSize(info.size)}`);
  console.log(`Proof: ${outputPath} (${upgradedBytes.length} bytes)`);
}

/**
 *
 * @param filePath
 * @param opts
 */
async function runVerify(filePath, opts) {
  const absPath = path.resolve(filePath);
  const data = readFileBytes(absPath);
  const info = getFileInfo(filePath);

  // Determine .ots proof path
  let otsPath;
  otsPath = opts.output ? path.resolve(opts.output) : `${absPath}.ots`;

  if (!fs.existsSync(otsPath)) {
    console.error(`Proof file not found: ${otsPath}`);
    console.error("Use -o/--output to specify the .ots proof file");
    process.exit(1);
  }

  const otsData = readFileBytes(otsPath);
  const parsed = otsParse(otsData);

  // Compute file's SHA-256
  const fileHash = crypto.createHash("sha256").update(Buffer.from(data)).digest();
  const fileHashBytes = new Uint8Array(fileHash);

  // Compare
  let match = true;
  for (let i = 0; i < 32; i++) {
    if (fileHashBytes[i] !== parsed.hash[i]) {
      match = false;
      break;
    }
  }

  console.log(`Verification: ${info.name}`);
  console.log(`Proof: ${otsPath}`);
  console.log("─".repeat(60));
  console.log(`File SHA-256:  ${fileHash.toString("hex")}`);
  console.log(`.ots SHA-256:  ${Buffer.from(parsed.hash).toString("hex")}`);
  console.log("─".repeat(60));

  if (match) {
    console.log("\n✓ Verified! Hash matches the .ots proof.");
    console.log("  The file has NOT changed since the timestamp was created.");
  } else {
    console.log("\n✗ Hash MISMATCH! The file has been modified.");
    console.log("  The file has changed since the timestamp was created.");
    process.exit(1);
  }
}

module.exports = { runTimestamp, upgradeOts, otsParse };
