'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  isDangerousExt, checkMagicBytes, hasDangerousContent,
  checkDocumentThreats, checkFileStructure, fmtSize,
  readFileBytes, getFileInfo, validateFile,
} = require('../cli/utils.js');
const { getTestImage, getTestJpeg, TMP_DIR, cleanTmp } = require('./helpers/setup.js');

describe('fmtSize', () => {
  it('formats bytes', () => { assert.strictEqual(fmtSize(500), '500 B'); });
  it('formats KB', () => { assert.strictEqual(fmtSize(2048), '2.0 KB'); });
  it('formats MB', () => { assert.strictEqual(fmtSize(2097152), '2.0 MB'); });
  it('formats edge', () => { assert.strictEqual(fmtSize(1023), '1023 B'); });
  it('formats 1KB boundary', () => { assert.strictEqual(fmtSize(1024), '1.0 KB'); });
});

describe('isDangerousExt', () => {
  it('blocks .exe', () => { assert.ok(isDangerousExt('virus.exe')); });
  it('blocks .bat', () => { assert.ok(isDangerousExt('script.bat')); });
  it('blocks .py', () => { assert.ok(isDangerousExt('script.py')); });
  it('blocks .jar', () => { assert.ok(isDangerousExt('app.jar')); });
  it('blocks .dll', () => { assert.ok(isDangerousExt('lib.dll')); });
  it('blocks .sh', () => { assert.ok(isDangerousExt('script.sh')); });
  it('allows .png', () => { assert.ok(!isDangerousExt('image.png')); });
  it('allows .jpg', () => { assert.ok(!isDangerousExt('photo.jpg')); });
  it('allows .txt', () => { assert.ok(!isDangerousExt('notes.txt')); });
  it('allows .pdf', () => { assert.ok(!isDangerousExt('doc.pdf')); });
});

describe('checkMagicBytes', () => {
  it('accepts valid PNG header', () => {
    const buf = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A, 0,0,0,0]);
    assert.ok(checkMagicBytes(buf, 'image/png'));
  });
  it('rejects invalid PNG header', () => {
    const buf = Buffer.from([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
    assert.ok(!checkMagicBytes(buf, 'image/png'));
  });
  it('accepts valid JPEG header', () => {
    const buf = Buffer.from([0xFF,0xD8,0xFF,0xE0]);
    assert.ok(checkMagicBytes(buf, 'image/jpeg'));
  });
  it('returns true for unknown MIME', () => {
    assert.ok(checkMagicBytes(Buffer.alloc(4), 'application/octet-stream'));
  });
});

describe('hasDangerousContent', () => {
  it('detects <script> tag', () => {
    const buf = Buffer.from('normal data <script>alert(1)</script> end');
    assert.ok(hasDangerousContent(buf));
  });
  it('detects onerror handler', () => {
    const buf = Buffer.from('<img src=x onerror="evil()">');
    assert.ok(hasDangerousContent(buf));
  });
  it('passes safe content', () => {
    const buf = Buffer.from('This is a perfectly safe image with no code.');
    assert.ok(!hasDangerousContent(buf));
  });
  it('passes binary data (no text patterns)', () => {
    const buf = Buffer.alloc(4096, 0xAB);
    assert.ok(!hasDangerousContent(buf));
  });
});

describe('checkDocumentThreats', () => {
  it('passes safe PDF content', () => {
    const buf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj');
    const r = checkDocumentThreats(buf);
    assert.ok(r.safe);
  });
  it('detects embedded JavaScript in PDF', () => {
    const buf = Buffer.from('%PDF-1.4\n/JavaScript <>');
    const r = checkDocumentThreats(buf);
    assert.ok(!r.safe);
    assert.ok(r.reason.includes('JavaScript'));
  });
  it('detects OpenAction', () => {
    const buf = Buffer.from('%PDF-1.4\n/OpenAction <>');
    const r = checkDocumentThreats(buf);
    assert.ok(!r.safe);
    assert.ok(r.reason.includes('auto-execute'));
  });
  it('rejects oversized PDF (>10MB)', () => {
    const buf = Buffer.alloc(11 * 1024 * 1024, 0x25);
    const r = checkDocumentThreats(buf);
    assert.ok(!r.safe);
    assert.ok(r.reason.includes('exceeds'));
  });
});

describe('checkFileStructure', () => {
  it('accepts valid PNG with IEND', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
      Buffer.alloc(100),
      Buffer.from([0,0,0,0, 0x49,0x45,0x4E,0x44, 0xAE,0x42,0x60,0x82]),
    ]);
    assert.ok(checkFileStructure(buf, '.png').safe);
  });
  it('rejects PNG without IEND', () => {
    const buf = Buffer.alloc(100, 0x00);
    assert.ok(!checkFileStructure(buf, '.png').safe);
  });
  it('accepts valid JPEG with EOI', () => {
    const buf = Buffer.concat([Buffer.from([0xFF,0xD8,0xFF]), Buffer.alloc(100), Buffer.from([0xFF,0xD9])]);
    assert.ok(checkFileStructure(buf, '.jpg').safe);
  });
  it('rejects JPEG without EOI', () => {
    const buf = Buffer.alloc(100, 0xFF);
    assert.ok(!checkFileStructure(buf, '.jpg').safe);
  });
});

describe('readFileBytes', () => {
  it('reads a file', () => {
    const img = getTestImage();
    const data = readFileBytes(img);
    assert.ok(data instanceof Buffer);
    assert.ok(data.length > 20);
  });
  it('throws on missing file', () => {
    assert.throws(() => readFileBytes('nonexistent_' + Date.now()), /File not found/);
  });
});

describe('getFileInfo', () => {
  it('returns info for PNG', () => {
    const img = getTestImage();
    const info = getFileInfo(img);
    assert.strictEqual(info.type, 'image/png');
    assert.ok(info.size > 0);
  });
  it('returns info for JPEG', () => {
    const img = getTestJpeg();
    const info = getFileInfo(img);
    assert.strictEqual(info.type, 'image/jpeg');
  });
});

describe('validateFile', () => {
  let png, jpg;
  before(() => { png = getTestImage(); jpg = getTestJpeg(); });

  it('validates PNG', () => {
    const data = validateFile(png);
    assert.ok(data instanceof Buffer);
  });
  it('validates JPEG', () => {
    const data = validateFile(jpg);
    assert.ok(data instanceof Buffer);
  });
  it('rejects dangerous extension', () => {
    const exePath = path.join(TMP_DIR, 'dangerous_file.exe');
    fs.writeFileSync(exePath, Buffer.from([0x4D, 0x5A, 0x90]));
    assert.throws(() => validateFile(exePath), /Blocked dangerous/);
    try { fs.rmSync(exePath); } catch {}
  });
  it('rejects missing file', () => {
    assert.throws(() => validateFile('does_not_exist_' + Date.now()), /File not found/);
  });
});

describe('stripC2PA', () => {
  const { stripC2PA } = require('../cli/utils.js');
  it('returns buffer unchanged for non-PNG', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF]);
    const result = stripC2PA(buf);
    assert.strictEqual(result.length, 3);
  });
});
