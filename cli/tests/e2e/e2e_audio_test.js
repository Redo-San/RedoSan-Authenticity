'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer, stopServer } = require('./e2e_helpers');
const path = require('path');
const fs = require('fs');

const PORT = 9894;
const BASE = `http://localhost:${PORT}`;
const WAV_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'silence.wav'));
const LONG_WAV_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'silence_5s.wav'));

let browser, server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
  stopServer();
});

function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe('E2E — Audio Watermark', () => {
  it('should navigate to audio watermark page without errors', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);
    assert.equal(errors.filter(e => !e.includes('404') && !e.includes('Failed to load')).length, 0);
    await ctx.close();
  });

  it('should have audio input, text area, algorithm selector, and embed button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);
    const hasAudio = await page.evaluate(() => !!document.getElementById('awm-audio'));
    const hasText = await page.evaluate(() => !!document.getElementById('awm-text'));
    const hasType = await page.evaluate(() => !!document.getElementById('awm-type'));
    const hasBtn = await page.evaluate(() => !!document.getElementById('awm-btn'));
    assert.ok(hasAudio, 'Audio file input exists');
    assert.ok(hasText, 'Message textarea exists');
    assert.ok(hasType, 'Algorithm selector exists');
    assert.ok(hasBtn, 'Embed button exists');
    await ctx.close();
  });

  it('should embed a message into WAV audio (QIM algorithm)', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);

    // Select QIM algorithm (value 5) — uses file upload, supports 1 bit/sample
    await page.evaluate(() => {
      const sel = document.getElementById('awm-type');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Upload audio file
    await page.setInputFiles('#awm-audio', [
      { name: 'silence.wav', mimeType: 'audio/wav', buffer: WAV_BUF }
    ]);
    await page.waitForTimeout(500);

    // Upload secret file (QIM uses file input, not text)
    await page.setInputFiles('#awm-file', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from('E2E TEST') }
    ]);
    await page.waitForTimeout(500);

    // Set password (always required for audio watermark)
    await page.fill('#awm-password', 'test-pw');

    // Click embed button
    await page.evaluate(() => document.getElementById('awm-btn').click());

    // Wait for result
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(outputHtml.length > 0, 'Output should contain embed result');
    assert.ok(outputHtml.includes('hidden') || outputHtml.includes('success') ||
      outputHtml.includes('bytes') || outputHtml.includes('Embedded') || outputHtml.includes('✅'),
      'Should indicate success: ' + outputHtml.substring(0, 100));

    await ctx.close();
  });

  it('should show extract tab with file input and extract button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);

    // Switch to extract tab
    await page.evaluate(() => switchAwmTab('extract'));
    await page.waitForTimeout(300);

    const hasAudioEx = await page.evaluate(() => !!document.getElementById('awm-audio-ex'));
    const hasTypeEx = await page.evaluate(() => !!document.getElementById('awm-type-ex'));
    const hasBtnEx = await page.evaluate(() => !!document.getElementById('awm-btn-ex'));
    assert.ok(hasAudioEx, 'Extract audio input exists');
    assert.ok(hasTypeEx, 'Extract algorithm selector exists');
    assert.ok(hasBtnEx, 'Extract button exists');
    await ctx.close();
  });

  it('should round-trip LSB (type 1): embed secret into WAV then extract recovers content', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('awm-type');
      if (sel) sel.value = '1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.setInputFiles('#awm-audio', [
      { name: 'silence.wav', mimeType: 'audio/wav', buffer: WAV_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.setInputFiles('#awm-file', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from('LSB ROUNDTRIP') }
    ]);
    await page.waitForTimeout(500);
    await page.fill('#awm-password', 'lsb-pw');

    await page.evaluate(() => document.getElementById('awm-btn').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('successfully') || embedHtml.includes('✅'),
      'LSB embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const getFn = typeof getResult === 'function' ? getResult : window.getResult;
      const r = getFn ? getFn('awmResult') : null;
      if (!r || !r.blob) return null;
      const resp = await fetch(URL.createObjectURL(r.blob));
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || 'audio/wav'
      };
    });
    assert.ok(wmInfo, 'Watermarked audio blob for LSB should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchAwmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('awm-type-ex');
      if (sel) sel.value = '1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.fill('#awm-password-ex', 'lsb-pw');

    await page.setInputFiles('#awm-audio-ex', [
      { name: 'watermarked.wav', mimeType: 'audio/wav', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('awm-btn-ex').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('LSB ROUNDTRIP'),
      'LSB extract should recover secret. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip DWT (type 6): embed secret into WAV then extract recovers content', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('awm-type');
      if (sel) sel.value = '6';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // DWT needs more samples due to 1024 samples/bit in haar wavelet
    await page.setInputFiles('#awm-audio', [
      { name: 'silence_5s.wav', mimeType: 'audio/wav', buffer: LONG_WAV_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.setInputFiles('#awm-file', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from('DWT') }
    ]);
    await page.waitForTimeout(500);
    await page.fill('#awm-password', 'dwt-pw');

    await page.evaluate(() => document.getElementById('awm-btn').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1000);

    const wmInfo = await page.evaluate(async () => {
      const getFn = typeof getResult === 'function' ? getResult : window.getResult;
      const r = getFn ? getFn('awmResult') : null;
      if (!r || !r.blob) return null;
      const resp = await fetch(URL.createObjectURL(r.blob));
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || 'audio/wav'
      };
    });
    assert.ok(wmInfo, 'Watermarked audio blob for DWT should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchAwmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('awm-type-ex');
      if (sel) sel.value = '6';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.fill('#awm-password-ex', 'dwt-pw');

    await page.setInputFiles('#awm-audio-ex', [
      { name: 'watermarked.wav', mimeType: 'audio/wav', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('awm-btn-ex').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('DWT'),
      'DWT extract should recover secret. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip QIM (type 5): embed secret into WAV then extract recovers content', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'audio-watermark');
    await page.waitForTimeout(1000);

    // Select QIM algorithm (type 5)
    await page.evaluate(() => {
      const sel = document.getElementById('awm-type');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Upload audio file
    await page.setInputFiles('#awm-audio', [
      { name: 'silence.wav', mimeType: 'audio/wav', buffer: WAV_BUF }
    ]);
    await page.waitForTimeout(500);

    // Upload secret file
    await page.setInputFiles('#awm-file', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from('AUDIO E2E ROUNDTRIP') }
    ]);
    await page.waitForTimeout(500);

    // Set password
    await page.fill('#awm-password', 'roundtrip-pw');

    // Click embed
    await page.evaluate(() => document.getElementById('awm-btn').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1000);

    // Verify embed success
    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('successfully') || embedHtml.includes('✅'),
      'Embed should succeed. Got: ' + embedHtml.substring(0, 100));

    // Fetch watermarked audio blob
    const wmInfo = await page.evaluate(async () => {
      const getFn = typeof getResult === 'function' ? getResult : window.getResult;
      const r = getFn ? getFn('awmResult') : null;
      if (!r || !r.blob) return null;
      const resp = await fetch(URL.createObjectURL(r.blob));
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || 'audio/wav'
      };
    });
    assert.ok(wmInfo, 'Watermarked audio blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    // Switch to extract tab
    await page.evaluate(() => switchAwmTab('extract'));
    await page.waitForTimeout(300);

    // Select QIM algorithm (type 5)
    await page.evaluate(() => {
      const sel = document.getElementById('awm-type-ex');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Set password
    await page.fill('#awm-password-ex', 'roundtrip-pw');

    // Upload watermarked audio
    await page.setInputFiles('#awm-audio-ex', [
      { name: 'watermarked.wav', mimeType: 'audio/wav', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    // Click extract
    await page.evaluate(() => document.getElementById('awm-btn-ex').click());
    await page.waitForSelector('#awm-result', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('awm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('AUDIO E2E ROUNDTRIP'),
      'Extract should recover secret. Got: ' + extractHtml.substring(0, 300));

    await ctx.close();
  });
});
