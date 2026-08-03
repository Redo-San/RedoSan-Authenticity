const crypto = require("crypto");
const fs = require("fs");

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NANOID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function uuidv4() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function uuidv7() {
  const ts = BigInt(Date.now());
  const b = crypto.randomBytes(16);
  b[0] = Number((ts >> 40n) & 0xffn);
  b[1] = Number((ts >> 32n) & 0xffn);
  b[2] = Number((ts >> 24n) & 0xffn);
  b[3] = Number((ts >> 16n) & 0xffn);
  b[4] = Number((ts >> 8n) & 0xffn);
  b[5] = Number(ts & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function uuidv4Bulk(count) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(uuidv4());
  return results.sort ? results : results;
}

function uuidv7Bulk(count) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(uuidv7());
  return results;
}

function ulid() {
  const ts = Date.now();
  const rand = crypto.randomBytes(10);
  let str = "";
  let val = BigInt(ts);
  for (let i = 9; i >= 0; i--) {
    str = CROCKFORD_BASE32[Number(val % 32n)] + str;
    val /= 32n;
  }
  val = 0n;
  for (let i = 0; i < 10; i++) {
    val = (val << 8n) | BigInt(rand[i]);
  }
  for (let i = 15; i >= 0; i--) {
    str += CROCKFORD_BASE32[Number(val % 32n)];
    val /= 32n;
  }
  return str;
}

function ulidBulk(count) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(ulid());
  return results;
}

function swhid(filePath) {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha1").update(buf).digest("hex");
  return `swh:1:cnt:${hash}`;
}

function swhidWithAlgo(filePath, algo) {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash(algo).update(buf).digest("hex");
  const prefix = algo === "sha1" ? "swh:1:cnt" : `urn:hash:${algo}`;
  return `${prefix}:${hash}`;
}

function nanoid(length) {
  const len = length || 21;
  const bytes = crypto.randomBytes(len);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += NANOID_ALPHABET[bytes[i] & 63];
  }
  return str;
}

function nanoidBulk(count, length) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(nanoid(length));
  return results;
}

function formatResults(ids, format, fileName) {
  if (format === "csv") {
    return ids.map((id) => `${fileName || "id"},${id}`).join("\n");
  }
  if (format === "json") {
    return JSON.stringify(ids, null, 2);
  }
  return ids.join("\n");
}

module.exports = {
  uuidv4,
  uuidv7,
  uuidv4Bulk,
  uuidv7Bulk,
  ulid,
  ulidBulk,
  swhid,
  swhidWithAlgo,
  nanoid,
  nanoidBulk,
  formatResults,
};

/* c8 ignore start */
if (require.main === module) {
  const type = process.argv[2];
  const arg = process.argv[3];
  const format = process.argv[4] === "--json" ? "json" : process.argv[4] === "--csv" ? "csv" : "text";
  const count = parseInt(arg, 10) > 0 ? parseInt(arg, 10) : 1;

  try {
    const single = !arg || arg.startsWith("--");
    let ids;
    switch (type) {
      case "uuidv4":
        ids = single ? [uuidv4()] : uuidv4Bulk(count);
        break;
      case "uuidv7":
        ids = single ? [uuidv7()] : uuidv7Bulk(count);
        break;
      case "ulid":
        ids = single ? [ulid()] : ulidBulk(count);
        break;
      case "nanoid":
        ids = single ? [nanoid()] : nanoidBulk(count);
        break;
      case "swhid":
        if (!arg || arg.startsWith("--")) {
          console.error("Usage: node id_forge.js swhid <file> [--json|--csv]");
          process.exit(1);
        }
        ids = [swhid(arg)];
        break;
      case "all":
        ids = { uuidv4: uuidv4(), uuidv7: uuidv7(), ulid: ulid(), nanoid: nanoid() };
        if (arg && !arg.startsWith("--")) {
          try {
            ids.swhid = swhid(arg);
          } catch (e) {
            ids.swhid = "N/A (file not found)";
          }
        }
        process.stdout.write(JSON.stringify(ids, null, 2) + "\n");
        process.exit(0);
      // falls through
      default:
        console.error("Usage: node id_forge.js <uuidv4|uuidv7|ulid|swhid|nanoid|all> [count|file] [--json|--csv]");
        process.exit(1);
    }
    process.stdout.write(formatResults(ids, format, type) + "\n");
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
/* c8 ignore stop */
