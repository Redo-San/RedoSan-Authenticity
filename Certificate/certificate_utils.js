/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */
// ── Certificate Utility Functions ──

/**
 *
 * @param buf
 * @param mime
 */
function makeCertDataURL(buf, mime) {
  var blob = new Blob([buf], { type: mime || "application/octet-stream" });
  return URL.createObjectURL(blob);
}

/**
 *
 * @param buf
 */
function bufToBase64(buf) {
  var bytes = new Uint8Array(buf);
  var binary = "";
  for (var i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 *
 * @param buf
 * @param mime
 */
function bufToDataURL(buf, mime) {
  return (
    "data:" +
    (mime || "application/octet-stream") +
    ";base64," +
    bufToBase64(buf)
  );
}

/**
 *
 * @param str
 */
function hasNonLatinChars(str) {
  return /[\u0100-\uFFFF]/.test(str);
}

// Render text with non-Latin chars (Arabic, etc.) as a canvas image for PDF
/**
 *
 * @param doc
 * @param text
 * @param x
 * @param y
 * @param maxWidthMm
 * @param fontSizePt
 */
function addTextSafe(doc, text, x, y, maxWidthMm, fontSizePt) {
  if (!hasNonLatinChars(text)) {
    doc.text(text, x, y);
    return;
  }
  // Render to canvas and embed as PNG
  var dpr = window.devicePixelRatio || 1;
  var fontSizePx = (fontSizePt * 4) / 3;
  var lineHeightPx = fontSizePx * 1.35;
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  ctx.font = fontSizePx + "px sans-serif";
  var textW = ctx.measureText(text).width;
  var maxW = (maxWidthMm || 180) * 3.78;
  var w = Math.min(textW, maxW);
  var h = lineHeightPx;
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.font = fontSizePx + "px sans-serif";
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  if (textW > maxW) {
    while (ctx.measureText(text + "\u2026").width > maxW && text.length > 0)
      text = text.slice(0, -1);
    text += "\u2026";
  }
  ctx.fillText(text, 0, 0);
  var url = canvas.toDataURL("image/png");
  var imgW = w / 3.78;
  var imgH = h / 3.78;
  doc.addImage(url, "PNG", x, y, imgW, imgH);
}

/**
 *
 * @param dataUrl
 */
function loadImageDimensions(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = function () {
      resolve({ width: 0, height: 0 });
    };
    img.src = dataUrl;
  });
}

/**
 *
 * @param buf
 */
async function getFileHashSha256(buf) {
  var hashBuf = await crypto.subtle.digest("SHA-256", buf);
  var arr = new Uint8Array(hashBuf);
  return Array.from(arr)
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

/**
 *
 * @param data
 */
function buildQRVerificationJSON(data) {
  var qr = {
    v: 1,
    gen: data.generator,
    genAt: data.generatedAt,
    file: { n: data.file.name, s: data.file.size, h: data.file.hash || "" },
    dims: data.file.width ? data.file.width + "x" + data.file.height : "",
    user: { n: data.user.name, e: data.user.email },
  };
  if (data.fpResult && data.fpResult.hashes) {
    qr.fp = {};
    var keys = ["SHA-256", "SHA-384", "SHA-512", "BLAKE3", "MD5"];
    for (var i = 0; i < keys.length; i++) {
      if (data.fpResult.hashes[keys[i]])
        qr.fp[keys[i]] = data.fpResult.hashes[keys[i]];
    }
    if (data.fpResult.perceptual_hashes) {
      for (var key in data.fpResult.perceptual_hashes) {
        if (!qr.fp) qr.fp = {};
        qr.fp["ph_" + key] = data.fpResult.perceptual_hashes[key];
      }
    }
  }
  if (data.didSig && data.didSig.did) {
    qr.did = data.didSig.did.substring(0, 60);
    if (data.didSig.signature)
      qr.sig = data.didSig.signature.substring(0, 20) + "...";
  } else if (data.didIdentity) {
    qr.did = data.didIdentity.substring(0, 60);
  }
  if (data.faceBiometric && data.faceBiometric.detected) {
    qr.fc = data.faceBiometric.faceCount;
  }
  qr.wm = data.watermark ? 1 : 0;
  qr.pi = data.pixelInjection ? 1 : 0;
  qr.ts = data.timestamp ? 1 : 0;
  return JSON.stringify(qr);
}

/**
 *
 * @param jsonStr
 */
function getDocHash(jsonStr) {
  var encoder = new TextEncoder();
  return crypto.subtle
    .digest("SHA-256", encoder.encode(jsonStr))
    .then(function (buf) {
      var arr = new Uint8Array(buf);
      return Array.from(arr)
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
}

/**
 *
 * @param text
 * @param size
 */
function generateQRDataURL(text, size) {
  var canvas = document.createElement("canvas");
  new QRious({
    element: canvas,
    value: text,
    size: size || 300,
    level: "H",
    padding: 8,
  });
  return canvas.toDataURL("image/png");
}

/**
 *
 */
function makeUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 *
 * @param bytes
 */
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1_048_576).toFixed(1) + " MB";
}

/**
 *
 * @param s
 */
function stripHtml(s) {
  if (!s) return "";
  do {
    var p = s;
    s = s.replace(/<[^>]*>/g, "");
  } while (s !== p);
  return s
    .replace(/&[^;]+;/g, function (m) {
      var e = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
      };
      return e[m] || " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 *
 * @param s
 */
function escHtml(s) {
  if (s == null) return "";
  var d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}
