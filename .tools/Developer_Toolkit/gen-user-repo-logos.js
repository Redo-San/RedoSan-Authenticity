const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2];

// Monochrome brand marks: rounded chip + knockout "R", transparent bg.
// logo-on-dark.png  -> WHITE chip (sits on the dark surface)
// logo-on-light.png -> BLACK chip (sits on the light surface)
function make(file, chip, knock) {
  const S = 256;
  const c = createCanvas(S, S);
  const x = c.getContext("2d");

  const pad = Math.round(S * 0.04);
  const box = S - pad * 2;
  const r = Math.round(box * 0.22);

  x.beginPath();
  x.moveTo(pad + r, pad);
  x.arcTo(pad + box, pad, pad + box, pad + box, r);
  x.arcTo(pad + box, pad + box, pad, pad + box, r);
  x.arcTo(pad, pad + box, pad, pad, r);
  x.arcTo(pad, pad, pad + box, pad, r);
  x.closePath();
  x.fillStyle = chip;
  x.fill();

  // subtle inner ring for depth
  x.lineWidth = Math.round(S * 0.012);
  x.strokeStyle = knock === "#0f0f1a" ? "rgba(15,15,26,0.25)" : "rgba(255,255,255,0.25)";
  const inset = Math.round(S * 0.075);
  x.beginPath();
  x.moveTo(inset + r, inset);
  x.arcTo(S - inset, inset, S - inset, S - inset, r);
  x.arcTo(S - inset, S - inset, inset, S - inset, r);
  x.arcTo(inset, S - inset, inset, inset, r);
  x.arcTo(inset, inset, S - inset, inset, r);
  x.closePath();
  x.stroke();

  // knockout R
  x.fillStyle = knock;
  x.font = `700 ${Math.round(S * 0.5)}px 'Segoe UI', sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("R", S / 2, S / 2 + Math.round(S * 0.02));

  fs.writeFileSync(path.join(OUT, file), c.toBuffer("image/png"));
  console.log(file, fs.statSync(path.join(OUT, file)).size, "bytes");
}

make("logo-on-dark.png", "#ffffff", "#0f0f1a");
make("logo-on-light.png", "#14141f", "#f5f5fa");
