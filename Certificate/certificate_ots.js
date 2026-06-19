(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
// ── OpenTimestamps — Certificate Transparency ──

var CT_AGGREGATORS = [
  "https://a.pool.opentimestamps.org/digest",
  "https://b.pool.opentimestamps.org/digest",
  "https://alice.btc.calendar.opentimestamps.org/digest",
  "https://bob.btc.calendar.opentimestamps.org/digest",
  "https://finney.calendar.eternitywall.com/digest",
  "https://a.pool.eternitywall.com/digest",
];

var OTS_HEADER_MAGIC = [
  0x00, 0x4F, 0x70, 0x65, 0x6E, 0x54, 0x69, 0x6D, 0x65, 0x73, 0x74, 0x61, 0x6D,
  0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6F, 0x6F, 0x66, 0x00, 0xBF, 0x89, 0xE2,
  0xE8, 0x84, 0xE8, 0x92, 0x94,
];

/**
 *
 * @param hashHex
 */
function generatePendingOts(hashHex) {
  if (!globalThis.OpenTimestamps) return null;
  try {
    var OTS = globalThis.OpenTimestamps;
    var hash = new Uint8Array(
      hashHex.match(/.{2}/g).map(function (b) {
        return Number.parseInt(b, 16);
      }),
    );
    var detached = OTS.DetachedTimestampFile.fromHash(
      new OTS.Ops.OpSHA256(),
      hash,
    );
    var randomBytes = OTS.Utils.randBytes(16);
    var t1 = detached.timestamp.add(
      new OTS.Ops.OpAppend(OTS.Utils.arrayToBytes(randomBytes)),
    );
    var sub = t1.add(new OTS.Ops.OpSHA256());
    sub.attestations.push(
      new OTS.Notary.PendingAttestation(
        "https://a.pool.opentimestamps.org/digest",
      ),
    );
    var bytes = detached.serializeToBytes();
    var b64 = btoa(String.fromCharCode.apply(null, bytes));
    return b64;
  } catch {
    return null;
  }
}

/**
 *
 * @param fileBuf
 */
async function submitCertTransparency(fileBuf) {
  try {
    var hashBuf = await crypto.subtle.digest("SHA-256", fileBuf);
    var hashBytes = new Uint8Array(hashBuf);
    var hashHex = [...hashBytes]
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
    var lastErr;
    for (const CT_AGGREGATOR of CT_AGGREGATORS) {
      try {
        var ac = new AbortController();
        var to = setTimeout(function () {
          ac.abort();
        }, 15_000);
        var resp = await fetch(CT_AGGREGATOR, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: hashBytes,
          signal: ac.signal,
        });
        clearTimeout(to);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
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
          aggregator: CT_AGGREGATOR,
          otsProof: ctBase64,
          hash: hashHex,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastErr = error;
      }
    }
    throw lastErr;
  } catch (error) {
    var pendingB64 = generatePendingOts(hashHex);
    if (pendingB64) {
      return {
        submitted: true,
        pending: true,
        otsProof: pendingB64,
        hash: hashHex,
        timestamp: new Date().toISOString(),
      };
    }
    var friendlyMsg = error.message;
    if (location && location.protocol === "file:") {
      friendlyMsg =
        "Cannot reach timestamp server from file:// protocol (CORS blocked). Serve via HTTP or use the OTS CLI.";
    } else if (error.message === "Failed to fetch" || error.name === "TypeError") {
      friendlyMsg =
        "All OpenTimestamps calendar servers are unreachable from your network. Use the CLI: node cli timestamp create";
    }
    return {
      submitted: false,
      error: friendlyMsg,
      timestamp: new Date().toISOString(),
    };
  }
}
