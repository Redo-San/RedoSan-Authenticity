'use strict';

const { describe, it } = require('node:test');
const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getTestImage, getTestJpeg, TMP_DIR } = require('./helpers/setup.js');

const CLI = path.resolve(__dirname, '..', 'cli', 'index.js');

function run(args) {
  return execSync(`node "${CLI}" ${args}`, { encoding: 'utf-8', timeout: 120000 });
}

function runSafe(args) {
  try {
    return { stdout: execSync(`node "${CLI}" ${args}`, { encoding: 'utf-8', timeout: 120000 }), code: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', code: e.status };
  }
}

function parseJSON(out) {
  const m = out.match(/{[\s\S]*}/);
  if (m) return JSON.parse(m[0]);
  throw new SyntaxError('No JSON found in output:\n' + out);
}

describe('fingerprint command', { concurrency: false }, () => {
  let png, jpg;

  it('fingerprints a PNG file (default algos)', () => {
    png = getTestImage();
    const out = run(`fingerprint "${png}" -a all`);
    assert.ok(out.includes('Fingerprint:'));
    assert.ok(out.includes('SHA-256'));
  });

  it('fingerprints with a specific algorithm', () => {
    const out = run(`fingerprint "${png}" -a sha256`);
    assert.ok(out.includes('SHA-256'));
  });

  it('fingerprints with --json flag', () => {
    const out = run(`fingerprint "${png}" --json`);
    const data = parseJSON(out);
    assert.ok(data.hashes['SHA-256']);
  });

  it('fingerprints a JPEG file', () => {
    jpg = getTestJpeg();
    const out = run(`fingerprint "${jpg}" -a sha256 --json`);
    const data = parseJSON(out);
    assert.ok(data.file.name.endsWith('.jpg'));
    assert.ok(data.hashes['SHA-256']);
  });

  it('includes perceptual hashes for images', () => {
    const out = run(`fingerprint "${png}" --json`);
    const data = parseJSON(out);
    assert.ok(data.perceptual_hashes);
    assert.ok(data.perceptual_hashes.ahash);
  });

  it('rejects missing file', () => {
    const { code } = runSafe(`fingerprint nonexistent_${Date.now()}.png`);
    assert.notStrictEqual(code, 0);
  });

  it('outputs all known hash algorithms with -a all', () => {
    const out = run(`fingerprint "${png}" -a all`);
    assert.ok(out.includes('SHA-256'));
    assert.ok(out.includes('SHA-384'));
    assert.ok(out.includes('BLAKE2b'));
    assert.ok(out.includes('MD5'));
  });

  it('saves output to file', () => {
    const outPath = path.join(TMP_DIR, `fp_out_${Date.now()}.txt`);
    run(`fingerprint "${png}" -a sha256 -o "${outPath}"`);
    assert.ok(fs.existsSync(outPath));
    const content = fs.readFileSync(outPath, 'utf-8');
    assert.ok(content.includes('SHA-256'));
    try { fs.rmSync(outPath); } catch {}
  });
});
