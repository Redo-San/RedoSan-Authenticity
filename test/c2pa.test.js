'use strict';

const { describe, it } = require('node:test');
const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getTestImage } = require('./helpers/setup.js');

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

describe('c2pa sign/read', { concurrency: false }, () => {
  it('signs a PNG with C2PA manifest', () => {
    const testImage = getTestImage();
    const signedPng = path.join(path.dirname(testImage), `c2pa_signed_${Date.now()}.png`);
    const out = run(`c2pa sign "${testImage}" -o "${signedPng}" --claim "Test Claim" --title "Test Image" --author "Test Author"`);
    assert.ok(fs.existsSync(signedPng));
    assert.ok(out.includes('C2PA'));
    assert.ok(out.includes('SHA-256'));
  });

  it('reads no C2PA from unsigned image', () => {
    const testImage = getTestImage();
    const out = run(`c2pa read "${testImage}"`);
    assert.ok(out.includes('C2PA'));
  });

  it('fails on missing file', () => {
    const { code } = runSafe(`c2pa sign nonexistent_${Date.now()}.png`);
    assert.notStrictEqual(code, 0);
  });
});
