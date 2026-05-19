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

describe('metadata command', { concurrency: false }, () => {
  it('reads metadata from PNG', () => {
    const png = getTestImage();
    const out = run(`metadata "${png}"`);
    assert.ok(out.includes('Metadata:'));
    assert.ok(out.includes('Dimensions:'));
    assert.ok(out.includes('64'));
  });

  it('reads metadata from JPEG', () => {
    const jpg = getTestJpeg();
    const out = run(`metadata "${jpg}"`);
    assert.ok(out.includes('Metadata:'));
    assert.ok(out.includes('Dimensions:'));
  });

  it('outputs JSON with --json', () => {
    const png = getTestImage();
    const out = run(`metadata "${png}" --json`);
    const data = parseJSON(out);
    assert.ok(data.file);
    assert.strictEqual(data.image.width, 64);
    assert.strictEqual(data.image.height, 64);
    assert.ok(data.sha256);
  });

  it('rejects missing file', () => {
    const { code } = runSafe(`metadata nonexistent_${Date.now()}.png`);
    assert.notStrictEqual(code, 0);
  });

  it('saves output to file', () => {
    const png = getTestImage();
    const outPath = path.join(TMP_DIR, `meta_out_${Date.now()}.txt`);
    run(`metadata "${png}" -o "${outPath}"`);
    assert.ok(fs.existsSync(outPath));
    try { fs.rmSync(outPath); } catch {}
  });
});
