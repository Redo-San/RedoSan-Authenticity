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

describe('watermark embed/extract', { concurrency: false }, () => {
  for (const algo of ['lsb', 'dct', 'random_lsb']) {
    it(`roundtrips with ${algo}`, () => {
      const testImage = getTestImage();
      const outPng = path.join(path.dirname(testImage), `wm_${algo}_${Date.now()}.png`);
      const outExtract = path.join(path.dirname(testImage), `wm_${algo}_ext_${Date.now()}.txt`);
      const secretFile = getTestSecret('WatermarkTest_' + algo);

      const embedOut = run(`watermark embed -i "${testImage}" -o "${outPng}" -a ${algo} -p testpass -s "${secretFile}"`);
      assert.ok(fs.existsSync(outPng), `Output PNG not created for ${algo}`);

      const extractOut = run(`watermark extract -i "${outPng}" -a ${algo} -p testpass -o "${outExtract}"`);
      const extracted = fs.readFileSync(outExtract, 'utf-8').trim();
      assert.strictEqual(extracted, 'WatermarkTest_' + algo);
    });
  }

  it('rejects missing --image', () => {
    const { code } = runSafe('watermark embed -o out.png');
    assert.notStrictEqual(code, 0);
  });
});
