const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || ".";
const BRAND = "#6c5ce7";
const BRAND_DARK = "#5a4bd1";
const BG = "#0f0f1a";
const TEXT = "#e8e8f0";
const MUTED = "#9b9bb5";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── og-image.png 1200x630 ──
(function () {
  const W = 1200, H = 630;
  const c = createCanvas(W, H);
  const x = c.getContext("2d");

  // background
  x.fillStyle = BG;
  x.fillRect(0, 0, W, H);

  // subtle dot grid
  x.fillStyle = "rgba(108,92,231,0.10)";
  for (let i = 40; i < W; i += 48)
    for (let j = 40; j < H; j += 48) { x.beginPath(); x.arc(i, j, 1.6, 0, Math.PI * 2); x.fill(); }

  // left accent bar
  const grad = x.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BRAND); grad.addColorStop(1, BRAND_DARK);
  x.fillStyle = grad;
  x.fillRect(0, 0, 14, H);

  // brand chip
  roundRect(x, 90, 96, 132, 132, 30);
  x.fillStyle = BRAND; x.fill();
  x.fillStyle = "#ffffff";
  x.font = "700 78px 'Segoe UI', sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("R", 90 + 66, 96 + 70);

  // headline
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.fillStyle = TEXT;
  x.font = "700 84px 'Segoe UI', sans-serif";
  x.fillText("RedoSan", 260, 168);
  x.fillStyle = BRAND;
  x.fillText("Authenticity", 260, 258);

  // tagline
  x.fillStyle = MUTED;
  x.font = "400 34px 'Segoe UI', sans-serif";
  x.fillText("Watermarking · Fingerprinting · Provenance · Biometrics", 90, 360);

  // badges row
  const badges = ["100% in your browser", "Open source · GPL-2.0", "20+ tools"];
  x.font = "600 26px 'Segoe UI', sans-serif";
  let bx = 90;
  for (const b of badges) {
    const w = x.measureText(b).width + 44;
    roundRect(x, bx, 420, w, 58, 29);
    x.strokeStyle = "rgba(232,232,240,0.28)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = TEXT; x.textAlign = "left";
    x.fillText(b, bx + 22, 458);
    bx += w + 22;
  }

  // footer url
  x.fillStyle = MUTED; x.font = "500 24px 'Segoe UI', sans-serif";
  x.fillText("redo-san.github.io/RedoSan-Authenticity", 90, 560);

  fs.writeFileSync(path.join(OUT, "og-image.png"), c.toBuffer("image/png"));
  console.log("og-image.png", fs.statSync(path.join(OUT, "og-image.png")).size, "bytes");
})();

// ── icon-512 / icon-192 (maskable-friendly: full-bleed brand square + R) ──
for (const size of [512, 192]) {
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  x.fillStyle = BG; x.fillRect(0, 0, size, size);
  const pad = Math.round(size * 0.06);
  const box = size - pad * 2;
  roundRect(x, pad, pad, box, box, Math.round(box * 0.22));
  x.fillStyle = BRAND; x.fill();
  x.fillStyle = "#ffffff";
  x.font = `700 ${Math.round(size * 0.52)}px 'Segoe UI', sans-serif`;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("R", size / 2, size / 2 + Math.round(size * 0.02));
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), c.toBuffer("image/png"));
  console.log(`icon-${size}.png`, fs.statSync(path.join(OUT, `icon-${size}.png`)).size, "bytes");
}
