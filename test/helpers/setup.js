'use strict';

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const TEST_DIR = path.resolve(__dirname, '..');
const TMP_DIR = path.join(TEST_DIR, 'tmp');

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}
ensureTmpDir();

function generatePng(width, height, outputPath) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = (i / 4) % 256;
    imgData.data[i + 1] = ((i / 4) * 2) % 256;
    imgData.data[i + 2] = ((i / 4) * 3) % 256;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  const buf = c.toBuffer('image/png');
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

function generateJpeg(width, height, outputPath) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Test', 10, height - 10);
  const buf = c.toBuffer('image/jpeg', { quality: 95 });
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

function generateSecret(outputPath, text) {
  fs.writeFileSync(outputPath, text || 'Hello RedoSan Test Secret!', 'utf-8');
  return outputPath;
}

let imgCounter = 0;
function uniquePath(ext) {
  return path.join(TMP_DIR, `${++imgCounter}_${Date.now().toString(36)}${ext}`);
}

function getTestImage() {
  return generatePng(64, 64, uniquePath('.png'));
}

function getTestJpeg() {
  return generateJpeg(64, 64, uniquePath('.jpg'));
}

function getTestSecret(text) {
  return generateSecret(uniquePath('.txt'), text);
}

module.exports = {
  TEST_DIR, TMP_DIR,
  generatePng, generateJpeg, generateSecret,
  getTestImage, getTestJpeg, getTestSecret,
};
