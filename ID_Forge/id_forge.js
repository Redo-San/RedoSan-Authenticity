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
var CROCKFORD_B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var NANOID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function hex(n, w) {
  return n.toString(16).padStart(w, "0");
}

function uuidv4() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var i = 0;
  return (
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2)
  );
}

function uuidv7() {
  var ts = Date.now();
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[0] = (ts / 0x10000000000) & 0xff;
  bytes[1] = (ts / 0x100000000) & 0xff;
  bytes[2] = (ts / 0x1000000) & 0xff;
  bytes[3] = (ts / 0x10000) & 0xff;
  bytes[4] = (ts / 0x100) & 0xff;
  bytes[5] = ts & 0xff;
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  var i = 0;
  return (
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    "-" +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2) +
    hex(bytes[i++], 2)
  );
}

function uuidv7Bulk(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(uuidv7());
  return r;
}
function uuidv4Bulk(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(uuidv4());
  return r;
}

function ulid() {
  var ts = Date.now();
  var t = "";
  var n = ts;
  for (var i = 0; i < 10; i++) {
    t = CROCKFORD_B32[n % 32] + t;
    n = Math.floor(n / 32);
  }
  var r = "";
  var bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (var j = 0; j < 10; j++) {
    r += CROCKFORD_B32[bytes[j] % 32];
    if (r.length === 4) r += "-";
  }
  return t + r.replace(/-/g, "");
}

function ulidBulk(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(ulid());
  return r;
}

function nanoid(len) {
  len = len || 21;
  var bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  var r = "";
  for (var i = 0; i < len; i++) r += NANOID_ALPHABET[bytes[i] % 64];
  return r;
}

function nanoidBulk(n, len) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(nanoid(len));
  return r;
}

async function swhid() {
  var bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  var hash = await crypto.subtle.digest("SHA-1", bytes);
  var h = "";
  var v = new Uint8Array(hash);
  for (var i = 0; i < v.length; i++) h += hex(v[i], 2);
  return "swh:1:cnt:" + h;
}

function handleIdForgeGenerate() {
  var type = document.getElementById("if-type").value;
  var count = parseInt(document.getElementById("if-count").value, 10) || 1;
  var output = document.getElementById("if-output");
  var resultDiv = document.getElementById("if-result");
  var btn = document.getElementById("if-gen-btn");

  btn.disabled = true;
  btn.textContent =
    (i18n.data && i18n.data["id_forge.generating_btn"]) || "Generating...";

  setTimeout(async function () {
    try {
      var ids;
      switch (type) {
        case "uuidv4":
          ids = count === 1 ? [uuidv4()] : uuidv4Bulk(count);
          break;
        case "uuidv7":
          ids = count === 1 ? [uuidv7()] : uuidv7Bulk(count);
          break;
        case "ulid":
          ids = count === 1 ? [ulid()] : ulidBulk(count);
          break;
        case "nanoid":
          ids = count === 1 ? [nanoid()] : nanoidBulk(count);
          break;
        case "swhid":
          ids = [];
          for (var k = 0; k < count; k++) ids.push(await swhid());
          break;
        default:
          ids = [uuidv4()];
      }
      window._ifResult = {
        ids: ids,
        type: type,
        count: count,
        timestamp: new Date().toISOString(),
      };
      output.value = ids.join("\n");
      resultDiv.style.display = "block";
    } catch (e) {
      output.value = "Error: " + e.message;
      resultDiv.style.display = "block";
    }

    btn.disabled = false;
    btn.textContent =
      (i18n.data && i18n.data["id_forge.generate_btn"]) || "Generate";
  }, 50);
}

function idForgeCopy(el) {
  var output = document.getElementById("if-output");
  if (!output.value) return;
  var orig = el.textContent;
  el.textContent =
    (i18n.data && i18n.data["id_forge.copied_btn"]) || "✓ Copied!";
  el.style.background = "var(--success, #00e676)";
  el.style.color = "#000";
  navigator.clipboard.writeText(output.value).catch(function () {
    output.select();
    document.execCommand("copy");
  });
  setTimeout(function () {
    el.textContent = orig;
    el.style.background = "";
    el.style.color = "";
  }, 1500);
}

function idForgeDownload(format) {
  closeDownloadModal();
  var r = window._ifResult;
  if (!r) return;

  if (format === "pdf") {
    var doc = new jspdf.jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(108, 92, 231);
    doc.text("ID Forge — " + r.type, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    var y = 30;
    doc.text("Generated: " + r.timestamp, 14, y);
    y += 6;
    doc.text("Type: " + r.type, 14, y);
    y += 6;
    doc.text("Count: " + r.count, 14, y);
    y += 10;
    doc.setFontSize(8);
    for (var p = 0; p < r.ids.length && p < 500; p++) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.ids[p], 14, y);
      y += 5;
    }
    doc.save("id-forge-" + r.type + ".pdf");
    return;
  }

  if (format === "doc") {
    var docHtml = '<html><body style="font-family:monospace">';
    docHtml += "<h2>ID Forge — " + r.type + "</h2>";
    docHtml += "<p>Generated: " + r.timestamp + "</p>";
    docHtml += "<p>Count: " + r.count + "</p><hr>";
    for (var q = 0; q < r.ids.length; q++) docHtml += "<p>" + r.ids[q] + "</p>";
    docHtml += "</body></html>";
    var docBlob = new Blob([docHtml], { type: "application/msword" });
    downloadBlobSimple(docBlob, "id-forge-" + r.type + ".doc");
    return;
  }

  var content, ext, mime;
  switch (format) {
    case "json":
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    case "csv":
      content = "Type,Count,Timestamp,ID\n";
      for (var s = 0; s < r.ids.length; s++)
        content +=
          r.type + "," + r.count + "," + r.timestamp + "," + r.ids[s] + "\n";
      ext = "csv";
      mime = "text/csv";
      break;
    case "txt":
      content =
        "ID Forge — " +
        r.type +
        "\nGenerated: " +
        r.timestamp +
        "\nCount: " +
        r.count +
        "\n\n" +
        r.ids.join("\n");
      ext = "txt";
      mime = "text/plain";
      break;
    case "xml":
      content =
        '<?xml version="1.0" encoding="UTF-8"?>\n<id-forge>\n  <metadata>\n    <type>' +
        escXml(r.type) +
        "</type>\n    <count>" +
        r.count +
        "</count>\n    <timestamp>" +
        escXml(r.timestamp) +
        "</timestamp>\n  </metadata>\n  <ids>\n";
      for (var t = 0; t < r.ids.length; t++)
        content += "    <id>" + escXml(r.ids[t]) + "</id>\n";
      content += "  </ids>\n</id-forge>";
      ext = "xml";
      mime = "application/xml";
      break;
  }
  if (content == null) return;
  var blob = new Blob([content], { type: mime });
  downloadBlobSimple(blob, "id-forge-" + r.type + "." + ext);
}

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlobSimple(blob, name) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function idForgeShowInfo() {
  var type = document.getElementById("if-type").value;
  var info = document.getElementById("if-info");
  var icon = {
    uuidv4: "🎲",
    uuidv7: "⏱️",
    ulid: "🔤",
    nanoid: "🔗",
    swhid: "📦",
  };
  var text = (i18n.data && i18n.data["id_forge.info." + type]) || "";
  info.style.display = text ? "block" : "none";
  info.innerHTML =
    '<span style="font-size:1.1rem;margin-right:6px">' +
    (icon[type] || "") +
    "</span> " +
    text;
}

function idForgeShowDownload() {
  if (!window._ifResult) return;
  window._currentDownloadHandler = idForgeDownload;
  document.getElementById("dl-modal-title").textContent = "Download — ID Forge";
  showDownloadModal();
}

function idForgeUpdateCount() {
  var val = parseInt(document.getElementById("if-count").value, 10);
  if (isNaN(val) || val < 1) document.getElementById("if-count").value = 1;
  if (val > 10000) document.getElementById("if-count").value = 10000;
}
/* exported handleIdForgeGenerate, idForgeCopy, idForgeShowDownload, idForgeUpdateCount, idForgeShowInfo */
