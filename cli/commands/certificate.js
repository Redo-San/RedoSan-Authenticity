const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const JSZip = require("jszip");

/**
 *
 * @param filePath
 * @param opts
 */
async function runCertificate(filePath, opts) {
  const data = await buildCertData(filePath, opts);

  const format = (opts.format || "pdf").toLowerCase();
  const outPath = opts.output ? path.resolve(opts.output) : path.resolve(`passport.${format}`);

  const qrVerData = buildQRVerificationJSON(data);
  const docHash = crypto.createHash("sha256").update(qrVerData).digest("hex");
  const qrContent = JSON.stringify({
    data: JSON.parse(qrVerData),
    hash: docHash,
  });
  const qrPngBuf = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  let output;
  switch (format) {
    case "pdf": {
      output = await generatePDF(data, qrPngBuf, qrContent);

      break;
    }
    case "docx": {
      output = await generateDOCX(data, qrPngBuf, qrContent);

      break;
    }
    case "epub": {
      output = await generateEPUB(data, qrPngBuf, qrContent);

      break;
    }
    default: {
      console.error("Unsupported format. Use pdf, docx, or epub.");
      process.exit(1);
    }
  }

  fs.writeFileSync(outPath, output);
  console.log(`Digital Passport generated: ${outPath}`);
}

/**
 *
 * @param filePath
 * @param opts
 */
async function buildCertData(filePath, opts) {
  const data = {
    generatedAt: new Date().toISOString(),
    generator: "RedoSan Authenticity",
    user: {
      name: opts.name || "",
      email: opts.email || "",
      phoneCode: opts.phoneCode || "",
      phone: opts.phone || "",
      website: opts.website || "",
      social: {
        tiktok: opts.socialTiktok || "",
        facebook: opts.socialFacebook || "",
        instagram: opts.socialInstagram || "",
        youtube: opts.socialYoutube || "",
      },
      isArtist: false,
      music: {
        spotify: opts.musicSpotify || "",
        appleMusic: opts.musicAppleMusic || "",
        youtubeMusic: opts.musicYtmusic || "",
        soundcloud: opts.musicSoundcloud || "",
      },
    },
    file: {
      name: "",
      size: 0,
      type: "",
      width: 0,
      height: 0,
      buf: null,
      hash: "",
    },
    watermark: false,
    watermarkAlgo: "",
    watermarkResult: "",
    pixelInjection: false,
    piResultHtml: "",
    timestamp: false,
    tsResult: "",
    fingerprint: false,
    fpResult: null,
    didSig: null,
    didIdentity: "",
    ct: { submitted: false },
  };

  // Image file
  if (filePath && fs.existsSync(filePath)) {
    const fbuf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".bmp": "image/bmp",
      ".tiff": "image/tiff",
      ".tif": "image/tiff",
      ".webp": "image/webp",
    };
    data.file.name = path.basename(filePath);
    data.file.size = fbuf.length;
    data.file.type = mimeMap[ext] || "application/octet-stream";
    data.file.buf = fbuf;
    data.file.hash = crypto.createHash("sha256").update(fbuf).digest("hex");

    if (/\.(png|jpg|jpeg|bmp|tiff?|webp)$/i.test(ext)) {
      try {
        const { loadImage } = require("canvas");
        const img = await loadImage(fbuf);
        data.file.width = img.width;
        data.file.height = img.height;
      } catch {
        // canvas not available for image loading
      }
    }
  }

  // Watermark result file
  if (opts.watermark && fs.existsSync(opts.watermark)) {
    data.watermark = true;
    data.watermarkAlgo = path.basename(opts.watermark);
    data.watermarkResult = fs.readFileSync(opts.watermark, "utf8");
  }

  // Pixel injection result file
  if (opts.pixelInjection && fs.existsSync(opts.pixelInjection)) {
    data.pixelInjection = true;
    data.piResultHtml = fs.readFileSync(opts.pixelInjection, "utf8");
  }

  // Fingerprint JSON file (the original <file> argument, but separate option too)
  if (opts.fingerprint && fs.existsSync(opts.fingerprint)) {
    try {
      const fpText = fs.readFileSync(opts.fingerprint, "utf8");
      data.fpResult = JSON.parse(fpText);
      data.fingerprint = true;
    } catch {
      console.error("Invalid fingerprint JSON:", opts.fingerprint);
    }
  }

  // DID identity file
  if (opts.did && fs.existsSync(opts.did)) {
    try {
      const didText = fs.readFileSync(opts.did, "utf8");
      const didData = JSON.parse(didText);
      if (didData.signature) data.didSig = didData;
      if (didData.did) data.didIdentity = didData.did;
    } catch {
      // ignore parse errors
    }
  }

  // Timestamp file
  if (opts.timestamp && fs.existsSync(opts.timestamp)) {
    data.timestamp = true;
    const tsStat = fs.statSync(opts.timestamp);
    data.tsResult = `Timestamp file: ${path.basename(opts.timestamp)} (${fmtSize(tsStat.size)})`;
  }

  // Also read the <filePath> argument — if it's a fingerprint JSON, use it
  if (filePath && !data.fpResult && fs.existsSync(filePath)) {
    try {
      const fpText = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(fpText);
      // Only treat as fingerprint if it has hashes
      if (parsed.hashes || parsed.perceptual_hashes || parsed.fileHash) {
        data.fpResult = parsed;
        data.fingerprint = true;
      }
    } catch {
      // not a fingerprint JSON, that's OK
    }
  }

  return data;
}

/**
 *
 * @param data
 */
function buildQRVerificationJSON(data) {
  const qr = {
    v: 1,
    gen: data.generator,
    genAt: data.generatedAt,
    file: { n: data.file.name, s: data.file.size, h: data.file.hash || "" },
    dims: data.file.width ? `${data.file.width}x${data.file.height}` : "",
    user: { n: data.user.name, e: data.user.email },
  };
  if (data.fpResult?.hashes) {
    qr.fp = {};
    const keys = ["SHA-256", "SHA-384", "SHA-512", "BLAKE3", "MD5"];
    for (const key of keys) {
      if (data.fpResult.hashes[key]) qr.fp[key] = data.fpResult.hashes[key];
    }
    if (data.fpResult.perceptual_hashes) {
      for (const key in data.fpResult.perceptual_hashes) {
        if (!qr.fp) qr.fp = {};
        qr.fp[`ph_${key}`] = data.fpResult.perceptual_hashes[key];
      }
    }
  }
  if (data.didSig?.did) {
    qr.did = data.didSig.did.substring(0, 60);
    if (data.didSig.signature) qr.sig = `${data.didSig.signature.substring(0, 20)}...`;
  } else if (data.didIdentity) {
    qr.did = data.didIdentity.substring(0, 60);
  }
  qr.wm = data.watermark ? 1 : 0;
  qr.pi = data.pixelInjection ? 1 : 0;
  qr.ts = data.timestamp ? 1 : 0;
  return JSON.stringify(qr);
}

/**
 *
 * @param bytes
 */
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 *
 * @param s
 */
function stripHtml(s) {
  if (!s) return "";
  let p;
  do {
    p = s;
    s = s.replaceAll(/<[^>]*>/g, "");
  } while (s !== p);
  return s
    .replaceAll(/&[^;]+;/g, (m) => {
      const e = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
      };
      return e[m] || " ";
    })
    .replaceAll(/\s+/g, " ")
    .trim();
}

// ── PDF generation (pdfkit) ──

/**
 *
 * @param data
 * @param qrPngBuf
 * @param qrContent
 */
function generatePDF(data, qrPngBuf, qrContent) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pw = doc.page.width,
      ph = doc.page.height;
    const margin = 50,
      pageW = pw - 2 * margin;
    let y = margin;

    /**
     *
     * @param need
     */
    function checkPage(need) {
      if (y + need > ph - margin) {
        doc.addPage();
        y = margin;
      }
    }

    // Title
    doc.fontSize(22).font("Helvetica-Bold");
    doc.text("Digital Passport", pw / 2, y, { align: "center" });
    y += 12;
    doc.fontSize(9).font("Helvetica");
    doc.text(`Generated by RedoSan Authenticity — ${data.generatedAt.replace("T", " ").substring(0, 19)}`, pw / 2, y, {
      align: "center",
    });
    y += 10;

    // 1. User Info
    if (data.user.name) {
      checkPage(14);
      doc.fontSize(14).font("Helvetica-Bold").text("Owner", margin, y);
      y += 6;
      doc.fontSize(10).font("Helvetica");
      if (data.user.name) {
        doc.font("Helvetica-Bold").text("Name: ", margin, y, { continued: true });
        doc.font("Helvetica").text(data.user.name);
        y += 5;
      }
      if (data.user.email) {
        doc.font("Helvetica-Bold").text("Email: ", margin, y, { continued: true });
        doc.font("Helvetica").text(data.user.email);
        y += 5;
      }
      if (data.user.phone) {
        doc.font("Helvetica-Bold").text("Phone: ", margin, y, { continued: true });
        doc.font("Helvetica").text(data.user.phone);
        y += 5;
      }
      if (data.user.website) {
        doc.font("Helvetica-Bold").text("Website: ", margin, y, { continued: true });
        doc.font("Helvetica").text(data.user.website);
        y += 5;
      }
      y += 3;
    }

    // Social links
    const socialEntries = Object.entries(data.user.social).filter(([, v]) => v);
    if (socialEntries.length > 0) {
      checkPage(6 + socialEntries.length * 5);
      doc.fontSize(10).font("Helvetica");
      for (const [k, v] of socialEntries) {
        doc.text(`${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`, margin, y);
        y += 5;
      }
      y += 2;
    }

    // 2. File Info
    checkPage(18);
    doc.fontSize(14).font("Helvetica-Bold").text("File Information", margin, y);
    y += 6;
    doc.fontSize(10).font("Helvetica");
    if (data.file.name) {
      doc.font("Helvetica-Bold").text("Name: ", margin, y, { continued: true });
      doc.font("Helvetica").text(data.file.name);
      y += 5;
    }
    if (data.file.size > 0) {
      doc.font("Helvetica-Bold").text("Size: ", margin, y, { continued: true });
      doc.font("Helvetica").text(fmtSize(data.file.size));
      y += 5;
    }
    if (data.file.width) {
      doc.font("Helvetica-Bold").text("Dimensions: ", margin, y, { continued: true });
      doc.font("Helvetica").text(`${data.file.width} x ${data.file.height} px`);
      y += 5;
    }
    if (data.file.hash) {
      doc.font("Helvetica-Bold").text("SHA-256: ", margin, y, { continued: true });
      doc.font("Helvetica").text(data.file.hash);
      y += 5;
    }
    y += 2;

    // Embed image
    if (data.file.buf) {
      const imgMaxW = pageW,
        imgMaxH = 240;
      let imgW = data.file.width || 400,
        imgH = data.file.height || 300;
      if (imgW > imgMaxW) {
        imgH = (imgH * imgMaxW) / imgW;
        imgW = imgMaxW;
      }
      if (imgH > imgMaxH) {
        imgW = (imgW * imgMaxH) / imgH;
        imgH = imgMaxH;
      }
      checkPage(imgH + 10);
      try {
        doc.image(data.file.buf, (pw - imgW) / 2, y, {
          width: imgW,
          height: imgH,
        });
        y += imgH + 6;
      } catch {
        y += 2;
      }
    }

    // 3. Watermark
    if (data.watermark) {
      checkPage(12);
      doc.fontSize(14).font("Helvetica-Bold").text("Watermark", margin, y);
      y += 6;
      doc.fontSize(10).font("Helvetica");
      doc.font("Helvetica-Bold").text("Result: ", margin, y, { continued: true });
      doc.font("Helvetica").text(data.watermarkAlgo || "Completed");
      y += 5;
      if (data.watermarkResult) {
        doc.fontSize(8).font("Helvetica");
        const wmLines = doc.text(data.watermarkResult, margin, y, {
          width: pageW,
        });
        y += 5 + wmLines.length;
      }
      y += 2;
    }

    // 4. Pixel Injection
    if (data.pixelInjection) {
      checkPage(12);
      doc.fontSize(14).font("Helvetica-Bold").text("Pixel Injection", margin, y);
      y += 6;
      doc.fontSize(10).font("Helvetica");
      doc.font("Helvetica-Bold").text("Result: ", margin, y, { continued: true });
      doc.font("Helvetica").text("Completed");
      y += 5;
      if (data.piResultHtml) {
        doc.fontSize(8).font("Helvetica");
        const piText = stripHtml(data.piResultHtml);
        const piLines = doc.text(piText, margin, y, { width: pageW });
        y += 5 + piLines.length;
      }
      y += 2;
    }

    // 5. Timestamp
    if (data.timestamp) {
      checkPage(12);
      doc.fontSize(14).font("Helvetica-Bold").text("Timestamp", margin, y);
      y += 6;
      doc.fontSize(10).font("Helvetica");
      if (data.tsResult) {
        doc.fontSize(8).font("Helvetica");
        doc.text(data.tsResult, margin, y, { width: pageW });
        y += 5 + data.tsResult.length / 80;
      } else {
        doc.text("Timestamp created successfully.", margin, y);
        y += 5;
      }
      y += 2;
    }

    // 6. Fingerprint (hashes)
    if (data.fingerprint && data.fpResult?.hashes) {
      checkPage(16);
      doc.fontSize(14).font("Helvetica-Bold").text("Fingerprint (Hashes)", margin, y);
      y += 6;
      doc.fontSize(8).font("Courier");
      const families = [
        { label: "SHA-1", keys: ["SHA-1"] },
        { label: "SHA-2", keys: ["SHA-224", "SHA-256", "SHA-384", "SHA-512"] },
        {
          label: "SHA-3",
          keys: ["SHA-3_224", "SHA-3_256", "SHA-3_384", "SHA-3_512"],
        },
        { label: "MD", keys: ["MD2", "MD4", "MD5"] },
        { label: "BLAKE", keys: ["BLAKE2b", "BLAKE2s", "BLAKE3"] },
        { label: "Other", keys: ["RIPEMD-160", "Whirlpool"] },
      ];
      for (const fam of families) {
        const has = fam.keys.some((k) => data.fpResult.hashes[k]);
        if (!has) continue;
        checkPage(4 + fam.keys.length * 4);
        doc.font("Helvetica-Bold").fontSize(9).text(fam.label, margin, y);
        y += 4;
        doc.font("Courier").fontSize(7);
        for (const k of fam.keys) {
          const v = data.fpResult.hashes[k];
          if (v) {
            doc.text(`${k}:  ${v}`, margin, y);
            y += 3.5;
          }
        }
        y += 1;
      }
      if (data.fpResult.perceptual_hashes) {
        for (const [pk, pv] of Object.entries(data.fpResult.perceptual_hashes)) {
          checkPage(6);
          doc.font("Helvetica-Bold").fontSize(9).text(pk, margin, y);
          y += 4;
          doc.font("Courier").fontSize(7).text(pv, margin, y);
          y += 4;
        }
      }
    }

    // 7. DID Signature
    if (data.didSig?.did) {
      checkPage(20);
      doc.fontSize(14).font("Helvetica-Bold").text("Decentralized Identity (DID)", margin, y);
      y += 6;
      doc.fontSize(8).font("Courier");
      doc.text(`DID: ${data.didSig.did}`, margin, y);
      y += 4;
      doc.text(`Algorithm: ${data.didSig.algorithm || "Ed25519"}`, margin, y);
      y += 4;
      doc.text(`Signed: ${(data.didSig.timestamp || "").replace("T", " ").substring(0, 19)}`, margin, y);
      y += 4;
      doc.fontSize(7);
      const sigText = `Signature: ${data.didSig.signature || ""}`;
      doc.text(sigText, margin, y, { width: pageW });
      y += 5 + Math.ceil(sigText.length / 100) * 3.5;
    } else if (data.didIdentity) {
      checkPage(10);
      doc.fontSize(14).font("Helvetica-Bold").text("DID Identity", margin, y);
      y += 6;
      doc.fontSize(8).font("Courier");
      doc.text(`DID: ${data.didIdentity}`, margin, y);
      y += 4;
    }

    // 8. Certificate Transparency
    if (data.ct?.submitted && data.ct.hash) {
      checkPage(12);
      doc.fontSize(12).font("Helvetica-Bold").text("Certificate Transparency", margin, y);
      y += 5;
      doc.fontSize(7).font("Courier");
      doc.text(`SHA-256: ${data.ct.hash}`, margin, y);
      y += 3;
      if (!data.ct.pending) {
        doc.text(`Logged: ${(data.ct.timestamp || "").replace("T", " ").substring(0, 19)}`, margin, y);
        y += 3;
        const shortAgg = (data.ct.aggregator || "").replace("https://", "").split("/", 1)[0] || "OTS calendar";
        doc.text(`Transparency log: ${shortAgg}`, margin, y);
        y += 3;
      }
      doc.text("Verifiable at: https://opentimestamps.org", margin, y);
      y += 6;
    } else if (data.ct) {
      checkPage(8);
      doc.fontSize(12).font("Helvetica-Bold").text("Certificate Transparency", margin, y);
      y += 5;
      doc.fontSize(7).font("Courier");
      doc.text(`Status: ${data.ct.submitted ? "Submitted" : `Unavailable — ${data.ct.error || "offline"}`}`, margin, y);
      y += 4;
    }

    // 9. QR Verification Code
    checkPage(90);
    y += 4;
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text("Verification QR Code", pw / 2, y, { align: "center" });
    y += 7;
    doc.fontSize(8).font("Helvetica");
    doc.text("Scan this QR code to verify the document contents. The QR encodes all", pw / 2, y, { align: "center" });
    y += 4;
    doc.text("verification data (hashes, file info, owner). Any mismatch indicates tampering.", pw / 2, y, {
      align: "center",
    });
    y += 8;

    const qrSize = 180;
    const qrX = (pw - qrSize) / 2;
    doc.image(qrPngBuf, qrX, y, { width: qrSize, height: qrSize });
    y += qrSize + 6;

    doc.fontSize(6).font("Courier");
    doc.text(qrContent, margin, y, { width: pageW });
    y += 4;

    doc.end();
  });
}

// ── DOCX generation ──

/**
 *
 * @param data
 * @param qrPngBuf
 * @param _qrContent
 */
async function generateDOCX(data, qrPngBuf, _qrContent) {
  let docx;
  try {
    docx = require("docx");
  } catch {
    console.error("docx library not available. Install with: npm install docx");
    process.exit(1);
  }

  const children = [];

  /**
   *
   * @param content
   */
  function addParagraph(content) {
    children.push(new docx.Paragraph({ children: content, spacing: { after: 200 } }));
  }

  /**
   *
   * @param pngBuf
   * @param width
   * @param height
   */
  function addImage(pngBuf, width, height) {
    addParagraph([
      new docx.ImageRun({
        data: pngBuf,
        type: "png",
        transformation: { width: width || 400, height: height || 300 },
      }),
    ]);
  }

  /**
   *
   * @param text
   * @param level
   */
  function addHeading(text, level) {
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: text,
            bold: true,
            size: level === 1 ? 32 : 24,
            font: "Calibri",
          }),
        ],
        spacing: { after: 200 },
      }),
    );
  }

  /**
   *
   * @param text
   */
  function addBody(text) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: text, size: 20, font: "Calibri" })],
        spacing: { after: 100 },
      }),
    );
  }

  /**
   *
   * @param label
   * @param value
   */
  function addLabelValue(label, value) {
    if (!value) return;
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: `${label}: `,
            bold: true,
            size: 20,
            font: "Calibri",
          }),
          new docx.TextRun({ text: String(value), size: 20, font: "Calibri" }),
        ],
        spacing: { after: 60 },
      }),
    );
  }

  // Title
  addHeading("Digital Passport", 1);
  addBody(`Generated by RedoSan Authenticity — ${data.generatedAt.replace("T", " ").substring(0, 19)}`);

  // 1. User Info
  if (data.user.name) {
    addHeading("Owner", 2);
    addLabelValue("Name", data.user.name);
    addLabelValue("Email", data.user.email);
    addLabelValue("Phone", data.user.phone);
    addLabelValue("Website", data.user.website);
    // Social links
    for (const [k, v] of Object.entries(data.user.social)) {
      if (v) addLabelValue(k.charAt(0).toUpperCase() + k.slice(1), v);
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 2. File Info
  addHeading("File Information", 2);
  addLabelValue("Name", data.file.name);
  addLabelValue("Size", fmtSize(data.file.size));
  if (data.file.width) addLabelValue("Dimensions", `${data.file.width} x ${data.file.height} px`);
  if (data.file.hash) addLabelValue("SHA-256", data.file.hash);
  children.push(new docx.Paragraph({ spacing: { after: 200 } }));

  // 3. Watermark
  if (data.watermark) {
    addHeading("Watermark", 2);
    addLabelValue("Result", data.watermarkAlgo || "Completed");
    if (data.watermarkResult) addBody(data.watermarkResult);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 4. Pixel Injection
  if (data.pixelInjection) {
    addHeading("Pixel Injection", 2);
    addLabelValue("Result", "Completed");
    if (data.piResultHtml) addBody(stripHtml(data.piResultHtml));
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 5. Timestamp
  if (data.timestamp) {
    addHeading("Timestamp", 2);
    addBody(data.tsResult || "Timestamp created successfully.");
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 6. Fingerprint
  if (data.fingerprint && data.fpResult?.hashes) {
    addHeading("Fingerprint (Hashes)", 2);
    const families = [
      { label: "SHA-1", keys: ["SHA-1"] },
      { label: "SHA-2", keys: ["SHA-224", "SHA-256", "SHA-384", "SHA-512"] },
      {
        label: "SHA-3",
        keys: ["SHA-3_224", "SHA-3_256", "SHA-3_384", "SHA-3_512"],
      },
      { label: "MD", keys: ["MD2", "MD4", "MD5"] },
      { label: "BLAKE", keys: ["BLAKE2b", "BLAKE2s", "BLAKE3"] },
      { label: "Other", keys: ["RIPEMD-160", "Whirlpool"] },
    ];
    for (const fam of families) {
      const has = fam.keys.some((k) => data.fpResult.hashes[k]);
      if (!has) continue;
      addHeading(fam.label, 2);
      for (const k of fam.keys) {
        const v = data.fpResult.hashes[k];
        if (v) addLabelValue(k, v);
      }
    }
    if (data.fpResult.perceptual_hashes) {
      addHeading("Perceptual Hashes", 2);
      for (const [pk, pv] of Object.entries(data.fpResult.perceptual_hashes)) {
        addLabelValue(pk, pv);
      }
    }
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 7. DID Signature
  if (data.didSig?.did) {
    addHeading("Decentralized Identity (DID)", 2);
    addLabelValue("DID", data.didSig.did);
    addLabelValue("Algorithm", data.didSig.algorithm || "Ed25519");
    addLabelValue("Signed", (data.didSig.timestamp || "").replace("T", " ").substring(0, 19));
    addLabelValue("Signature", `${(data.didSig.signature || "").substring(0, 64)}...`);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  } else if (data.didIdentity) {
    addHeading("DID Identity", 2);
    addLabelValue("DID", data.didIdentity);
    children.push(new docx.Paragraph({ spacing: { after: 200 } }));
  }

  // 8. Certificate Transparency
  if (data.ct?.submitted && data.ct.hash) {
    addHeading("Certificate Transparency", 2);
    addLabelValue("SHA-256", data.ct.hash);
    if (!data.ct.pending) {
      addLabelValue("Logged", (data.ct.timestamp || "").replace("T", " ").substring(0, 19));
      const shortAgg = (data.ct.aggregator || "").replace("https://", "").split("/", 1)[0] || "OTS calendar";
      addLabelValue("Transparency log", shortAgg);
    }
    addBody("Verifiable at: https://opentimestamps.org");
    children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  } else if (data.ct) {
    addHeading("Certificate Transparency", 2);
    addBody(`Status: ${data.ct.submitted ? "Submitted" : `Unavailable — ${data.ct.error || "offline"}`}`);
    children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  }

  // 9. QR Verification Code
  children.push(new docx.Paragraph({ spacing: { after: 100 } }));
  addHeading("Verification QR Code", 2);
  addBody(
    "Scan this QR code to verify the document contents. The QR encodes all verification data (hashes, file info, owner). Any mismatch indicates tampering.",
  );
  addImage(qrPngBuf, 150, 150);
  children.push(new docx.Paragraph({ spacing: { after: 100 } }));

  const docObj = new docx.Document({ sections: [{ children: children }] });
  const buf = await docx.Packer.toBuffer(docObj);
  return buf;
}

// ── EPUB generation (JSZip) ──

/**
 *
 * @param s
 */
function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 *
 * @param data
 * @param qrPngBuf
 * @param qrContent
 */
async function generateEPUB(data, qrPngBuf, qrContent) {
  let userSection = "";
  if (data.user.name) {
    userSection += "<h2>Owner</h2><table>";
    if (data.user.name) userSection += `<tr><td><strong>Name</strong></td><td>${escHtml(data.user.name)}</td></tr>`;
    if (data.user.email) userSection += `<tr><td><strong>Email</strong></td><td>${escHtml(data.user.email)}</td></tr>`;
    if (data.user.phone) userSection += `<tr><td><strong>Phone</strong></td><td>${escHtml(data.user.phone)}</td></tr>`;
    if (data.user.website)
      userSection += `<tr><td><strong>Website</strong></td><td>${escHtml(data.user.website)}</td></tr>`;
    for (const [k, v] of Object.entries(data.user.social)) {
      if (v)
        userSection += `<tr><td><strong>${escHtml(
          k.charAt(0).toUpperCase() + k.slice(1),
        )}</strong></td><td>${escHtml(v)}</td></tr>`;
    }
    userSection += "</table>";
  }

  let fpSection = "";
  if (data.fingerprint && data.fpResult?.hashes) {
    fpSection += "<h2>Fingerprint (Hashes)</h2>";
    const families = [
      { label: "SHA-1", keys: ["SHA-1"] },
      { label: "SHA-2", keys: ["SHA-224", "SHA-256", "SHA-384", "SHA-512"] },
      {
        label: "SHA-3",
        keys: ["SHA-3_224", "SHA-3_256", "SHA-3_384", "SHA-3_512"],
      },
      { label: "MD", keys: ["MD2", "MD4", "MD5"] },
      { label: "BLAKE", keys: ["BLAKE2b", "BLAKE2s", "BLAKE3"] },
      { label: "Other", keys: ["RIPEMD-160", "Whirlpool"] },
    ];
    for (const fam of families) {
      const has = fam.keys.some((k) => data.fpResult.hashes[k]);
      if (!has) continue;
      fpSection += `<h3>${escHtml(fam.label)}</h3><table>`;
      for (const k of fam.keys) {
        const v = data.fpResult.hashes[k];
        if (v)
          fpSection += `<tr><td><strong>${escHtml(
            k,
          )}</strong></td><td style="font-size:0.7em;word-break:break-all">${escHtml(v)}</td></tr>`;
      }
      fpSection += "</table>";
    }
    if (data.fpResult.perceptual_hashes) {
      for (const [pk, pv] of Object.entries(data.fpResult.perceptual_hashes)) {
        fpSection += `<h3>${escHtml(pk)}</h3><p style="font-size:0.7em;word-break:break-all">${escHtml(pv)}</p>`;
      }
    }
  }

  const xhtml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<!DOCTYPE html>" +
    '<html xmlns="http://www.w3.org/1999/xhtml">' +
    '<head><meta charset="utf-8"/><title>Digital Passport</title>' +
    '<link rel="stylesheet" type="text/css" href="style.css"/>' +
    "</head><body>" +
    "<h1>Digital Passport</h1>" +
    '<p class="subtitle">Generated by RedoSan Authenticity — ' +
    escHtml(data.generatedAt.replace("T", " ").substring(0, 19)) +
    "</p>" +
    userSection +
    "<h2>File Information</h2>" +
    "<table>" +
    "<tr><td><strong>Name</strong></td><td>" +
    escHtml(data.file.name) +
    "</td></tr>" +
    "<tr><td><strong>Size</strong></td><td>" +
    fmtSize(data.file.size) +
    "</td></tr>" +
    (data.file.width
      ? `<tr><td><strong>Dimensions</strong></td><td>${data.file.width} x ${data.file.height} px</td></tr>`
      : "") +
    (data.file.hash
      ? `<tr><td><strong>SHA-256</strong></td><td style="font-size:0.7em;word-break:break-all">${data.file.hash}</td></tr>`
      : "") +
    "</table>" +
    (data.watermark
      ? `<h2>Watermark</h2><p><strong>Result:</strong> ${escHtml(
          data.watermarkAlgo || "Completed",
        )}</p><pre>${escHtml(data.watermarkResult || "")}</pre>`
      : "") +
    (data.pixelInjection
      ? `<h2>Pixel Injection</h2><p><strong>Result:</strong> Completed</p><pre>${escHtml(
          data.piResultHtml || "",
        )}</pre>`
      : "") +
    (data.timestamp
      ? `<h2>Timestamp</h2><pre>${escHtml(data.tsResult || "Timestamp created successfully.")}</pre>`
      : "") +
    fpSection +
    (data.didSig?.did
      ? "<h2>Decentralized Identity (DID)</h2><table>" +
        '<tr><td><strong>DID</strong></td><td style="font-size:0.7em;word-break:break-all">' +
        escHtml(data.didSig.did) +
        "</td></tr>" +
        "<tr><td><strong>Algorithm</strong></td><td>" +
        escHtml(data.didSig.algorithm || "Ed25519") +
        "</td></tr>" +
        "<tr><td><strong>Signed</strong></td><td>" +
        escHtml((data.didSig.timestamp || "").replace("T", " ").substring(0, 19)) +
        "</td></tr>" +
        '<tr><td><strong>Signature</strong></td><td style="font-size:0.6em;word-break:break-all">' +
        escHtml(`${(data.didSig.signature || "").substring(0, 64)}...`) +
        "</td></tr></table>"
      : data.didIdentity
        ? `<h2>DID Identity</h2><table><tr><td><strong>DID</strong></td><td style="font-size:0.7em;word-break:break-all">${escHtml(
            data.didIdentity,
          )}</td></tr></table>`
        : "") +
    (data.ct?.submitted && data.ct.hash
      ? "<h2>Certificate Transparency</h2><table>" +
        '<tr><td><strong>SHA-256</strong></td><td style="font-size:0.6em;word-break:break-all">' +
        escHtml(data.ct.hash) +
        "</td></tr>" +
        (data.ct.pending
          ? ""
          : "<tr><td><strong>Logged</strong></td><td>" +
            escHtml((data.ct.timestamp || "").replace("T", " ").substring(0, 19)) +
            "</td></tr>" +
            "<tr><td><strong>Log</strong></td><td>" +
            escHtml((data.ct.aggregator || "OTS").replace("https://", "").split("/", 1)[0] || "OTS calendar") +
            "</td></tr>") +
        '</table><p>Verifiable at: <a href="https://opentimestamps.org">opentimestamps.org</a></p>'
      : data.ct
        ? `<h2>Certificate Transparency</h2><p>Status: ${escHtml(
            data.ct.submitted ? "Submitted" : `Unavailable — ${data.ct.error || "offline"}`,
          )}</p>`
        : "") +
    "<h2>Verification QR Code</h2>" +
    "<p>Scan this QR code to verify the document contents.</p>" +
    '<div class="qr-wrapper"><img src="images/qr.png" alt="QR Code"/></div>' +
    '<pre class="qr-data">' +
    escHtml(qrContent) +
    "</pre>" +
    "</body></html>";

  const css =
    "body{font-family:serif;padding:20px;max-width:800px;margin:0 auto}" +
    "h1{font-size:1.6em;border-bottom:2px solid #333;padding-bottom:8px}" +
    ".subtitle{color:#666;font-size:0.85em}" +
    "h2{font-size:1.2em;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}" +
    "h3{font-size:1em;margin-top:16px}" +
    "table{width:100%;border-collapse:collapse;margin:8px 0}" +
    "td{padding:4px 8px;border:1px solid #ddd;vertical-align:top;font-size:0.85em}" +
    "td:first-child{white-space:nowrap;font-weight:700;width:120px}" +
    ".qr-wrapper{text-align:center;margin:16px 0}" +
    ".qr-wrapper img{width:200px;height:200px}" +
    ".qr-data{font-size:0.6em;background:#f5f5f5;padding:8px;border:1px solid #ddd;white-space:pre-wrap;word-break:break-all}";

  /**
   *
   */
  function makeUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip
    .folder("META-INF")
    .file(
      "container.xml",
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
        '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    );

  const manifestItems = [
    { id: "content", href: "content.xhtml", mt: "application/xhtml+xml" },
    { id: "style", href: "style.css", mt: "text/css" },
    { id: "ncx", href: "toc.ncx", mt: "application/x-dtbncx+xml" },
  ];
  const imgExt = data.file.type === "image/png" ? "png" : "jpg";
  if (data.file.buf) {
    manifestItems.push({
      id: "img",
      href: `images/photo.${imgExt}`,
      mt: data.file.type || "image/jpeg",
    });
  }
  manifestItems.push({ id: "qr", href: "images/qr.png", mt: "image/png" });

  const spineItems = manifestItems.filter((m) => m.mt === "application/xhtml+xml");

  const ncx =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
    '<head><meta name="dtb:uid" content="urn:uuid:' +
    makeUUID() +
    '"/></head>' +
    "<docTitle><text>Digital Passport</text></docTitle>" +
    '<navMap><navPoint id="np-1" playOrder="1">' +
    "<navLabel><text>Digital Passport</text></navLabel>" +
    '<content src="content.xhtml"/>' +
    "</navPoint></navMap></ncx>";

  let opf =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">' +
    '<metadata><dc:identifier xmlns:dc="http://purl.org/dc/elements/1.1/" id="uid">' +
    "urn:uuid:" +
    makeUUID() +
    "</dc:identifier>" +
    '<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Digital Passport</dc:title>' +
    '<dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language>' +
    '<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">RedoSan Authenticity</dc:creator>' +
    "</metadata><manifest>";
  for (const item of manifestItems) {
    opf += `<item id="${item.id}" href="${item.href}" media-type="${item.mt}"/>`;
  }
  opf += '</manifest><spine toc="ncx">';
  for (const item of spineItems) {
    opf += `<itemref idref="${item.id}"/>`;
  }
  opf += "</spine></package>";

  zip.folder("OEBPS").file("content.opf", opf);
  zip.folder("OEBPS").file("content.xhtml", xhtml);
  zip.folder("OEBPS").file("style.css", css);
  zip.folder("OEBPS").file("toc.ncx", ncx);
  if (data.file.buf) {
    zip.folder("OEBPS").folder("images").file(`photo.${imgExt}`, data.file.buf);
  }
  zip.folder("OEBPS").folder("images").file("qr.png", qrPngBuf);

  return await zip.generateAsync({ type: "nodebuffer" });
}

module.exports = { runCertificate };
