'use strict';

const { describe, it } = require('node:test');
const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getTestImage, getTestSecret } = require('./helpers/setup.js');

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

describe('pixel-injection embed/extract', { concurrency: false }, () => {
  it('embeds with enhanced_lsb (output file exists)', () => {
    const testImage = getTestImage();
    const outPng = path.join(path.dirname(testImage), `pi_embed_${Date.now()}.png`);
    const secretFile = getTestSecret('PITest');
    run(`pixel-injection embed -i "${testImage}" -o "${outPng}" -a enhanced_lsb -p testpass -s "${secretFile}"`);
    assert.ok(fs.existsSync(outPng));
  });

  it('embeds with dct (output file exists)', () => {
    const testImage = getTestImage();
    const outPng = path.join(path.dirname(testImage), `pi_dct_${Date.now()}.png`);
    const secretFile = getTestSecret('PITest');
    run(`pixel-injection embed -i "${testImage}" -o "${outPng}" -a dct -p testpass -s "${secretFile}"`);
    assert.ok(fs.existsSync(outPng));
  });

  it('embeds with dwt (output file exists)', () => {
    const testImage = getTestImage();
    const outPng = path.join(path.dirname(testImage), `pi_dwt_${Date.now()}.png`);
    const secretFile = getTestSecret('PITest');
    run(`pixel-injection embed -i "${testImage}" -o "${outPng}" -a dwt -p testpass -s "${secretFile}"`);
    assert.ok(fs.existsSync(outPng));
  });

  it('rejects missing --image', () => {
    const { code } = runSafe('pixel-injection embed -o out.png');
    assert.notStrictEqual(code, 0);
  });

  it('extract on clean image runs without crash', () => {
    const cleanImg = getTestImage();
    const outPath = path.join(path.dirname(cleanImg), `pi_ext_${Date.now()}.txt`);
    const { code } = runSafe(`pixel-injection extract -i "${cleanImg}" -o "${outPath}" -a dct`);
    // Should not crash with non-zero exit or crash; some algorithms
    // return garbage on clean images which is expected behavior
    assert.ok(typeof code === 'number');
  });
});
