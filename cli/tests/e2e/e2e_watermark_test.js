'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer, stopServer } = require('./e2e_helpers');
const path = require('path');
const fs = require('fs');

const PORT = 9893;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'testimg.png'));
const PNG_64_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'testimg_64x64.png'));
const SECRET_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'secret.txt'));

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

describe('E2E — Image Watermark', () => {
  it('should navigate to watermark page without errors', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);
    assert.equal(errors.filter(e => !e.includes('404') && !e.includes('Failed to load')).length, 0);
    await ctx.close();
  });

  it('should have file inputs and embed button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);
    const hasCover = await page.evaluate(() => !!document.getElementById('wm-image'));
    const hasSecret = await page.evaluate(() => !!document.getElementById('wm-secret'));
    const hasBtn = await page.evaluate(() => !!document.getElementById('wm-btn'));
    const hasType = await page.evaluate(() => !!document.getElementById('wm-type'));
    assert.ok(hasCover, 'Cover image input exists');
    assert.ok(hasSecret, 'Secret file input exists');
    assert.ok(hasBtn, 'Embed button exists');
    assert.ok(hasType, 'Algorithm selector exists');
    await ctx.close();
  });

  it('should embed a message into a PNG image (Zero-bit algorithm)', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    // Select Zero-bit algorithm (type 5 — doesn't require password)
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Upload cover image
    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_BUF }
    ]);
    await page.waitForTimeout(500);

    // Upload secret file
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    // Click embed button
    await page.evaluate(() => document.getElementById('wm-btn').click());

    // Wait for result
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(outputHtml.length > 0, 'Output should contain embed result');
    assert.ok(outputHtml.includes('embedded') || outputHtml.includes('hidden') ||
      outputHtml.includes('bytes') || outputHtml.includes('success'),
      'Should indicate success: ' + outputHtml.substring(0, 100));

    const hasDownload = await page.evaluate(() => {
      const el = document.getElementById('wm-download');
      return el ? el.innerHTML.length > 20 : false;
    });
    assert.ok(hasDownload, 'Download section should be populated');

    await ctx.close();
  });

  it('should show extract tab with file input and extract button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    // Switch to extract tab
    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    const hasImageEx = await page.evaluate(() => !!document.getElementById('wm-image-ex'));
    const hasTypeEx = await page.evaluate(() => !!document.getElementById('wm-type-ex'));
    const hasBtnEx = await page.evaluate(() => !!document.getElementById('wm-btn-ex'));
    assert.ok(hasImageEx, 'Extract image input exists');
    assert.ok(hasTypeEx, 'Extract algorithm selector exists');
    assert.ok(hasBtnEx, 'Extract button exists');
    await ctx.close();
  });

  it('should round-trip Zero-bit (type 5): embed then extract confirms presence', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    // Select Zero-bit algorithm (type 5, no password or secret needed)
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Upload cover image (no secret needed for Zero-bit, use 64x64 for DCT blocks)
    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);

    // Click embed
    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify embed success
    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('embedded') || embedHtml.includes('Presence'),
      'Embed should succeed: ' + embedHtml.substring(0, 100));

    // Fetch the watermarked image blob for extraction
    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || 'image/png'
      };
    });
    assert.ok(wmInfo, 'Watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);
    const wmType = wmInfo.type;
    const wmExt = wmType === 'image/jpeg' ? 'jpg' : 'png';

    // Switch to extract tab
    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    // Select Zero-bit algorithm (type 5)
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Upload watermarked image (use correct mime type from blob)
    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.' + wmExt, mimeType: wmType, buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    // Click extract
    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('PRESENCE CONFIRMED'),
      'Extract should confirm presence. Got: ' + extractHtml.substring(0, 200));

    await ctx.close();
  });

  it('should round-trip LSB (type 1) with password and recover secret content', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    // Select LSB algorithm (type 1, default, but set explicitly)
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Password group should be visible for type 1
    const pwVisible = await page.evaluate(() => {
      const g = document.getElementById('wm-password-group');
      return g ? g.style.display !== 'none' : false;
    });
    assert.ok(pwVisible, 'Password group should be visible for type 1');

    // Set password
    await page.evaluate(() => {
      const pw = document.getElementById('wm-password');
      if (pw) pw.value = 'test-password-123';
    });

    // Upload cover image (64x64 for enough LSB capacity)
    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);

    // Upload secret file
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    // Click embed
    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('hidden') || embedHtml.includes('bytes'),
      'Embed should report bytes hidden. Got: ' + embedHtml.substring(0, 100));

    // Fetch watermarked image blob (LSB produces PNG)
    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || 'image/png'
      };
    });
    assert.ok(wmInfo, 'Watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);
    const wmType = wmInfo.type;
    const wmExt = wmType === 'image/jpeg' ? 'jpg' : 'png';

    // Switch to extract tab
    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    // Select LSB algorithm (type 1)
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Set password
    await page.evaluate(() => {
      const pw = document.getElementById('wm-password-ex');
      if (pw) pw.value = 'test-password-123';
    });

    // Upload watermarked image (use correct mime type)
    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.' + wmExt, mimeType: wmType, buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    // Click extract
    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('extract') || extractHtml.includes('E2E') || extractHtml.includes('TES'),
      'Extract should show recovered content. Got: ' + extractHtml.substring(0, 300));

    await ctx.close();
  });

  // ── Missing algorithm round-trips (types 4, 6, 7, 8, 9) ──

  it('should round-trip Latent DCT (type 4) with password and recover secret', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '4';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password');
      if (pw) pw.value = 'test-password-123';
    });

    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('hidden') || embedHtml.includes('bytes'),
      'Type 4 embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || 'image/png' };
    });
    assert.ok(wmInfo, 'Type 4 watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '4';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password-ex');
      if (pw) pw.value = 'test-password-123';
    });

    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.png', mimeType: wmInfo.type || 'image/png', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('E2E') || extractHtml.includes('Type 4'),
      'Type 4 extract should recover content. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip Multi-bit (type 6) with password and recover secret', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '6';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password');
      if (pw) pw.value = 'test-password-456';
    });

    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('hidden') || embedHtml.includes('bytes'),
      'Type 6 embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || 'image/png' };
    });
    assert.ok(wmInfo, 'Type 6 watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '6';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password-ex');
      if (pw) pw.value = 'test-password-456';
    });

    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.png', mimeType: wmInfo.type || 'image/png', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('E2E') || extractHtml.includes('Type 6'),
      'Type 6 extract should recover content. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip Forensic (type 7) with password and recover secret', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '7';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password');
      if (pw) pw.value = 'forensic-pw';
    });

    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('hidden') || embedHtml.includes('bytes'),
      'Type 7 embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || 'image/png' };
    });
    assert.ok(wmInfo, 'Type 7 watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '7';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password-ex');
      if (pw) pw.value = 'forensic-pw';
    });

    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.png', mimeType: wmInfo.type || 'image/png', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('E2E') || extractHtml.includes('Type 7'),
      'Type 7 extract should recover content. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip Fragile (type 8): embed then extract recovers SHA-256 hash', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    // Type 8 does NOT require a password
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '8';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('Type 8') || embedHtml.includes('hash'),
      'Type 8 embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || 'image/png' };
    });
    assert.ok(wmInfo, 'Type 8 watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    // Type 8 also does NOT require password for extract
    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '8';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.png', mimeType: wmInfo.type || 'image/png', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('Type 8') && extractHtml.includes('Embedded hash'),
      'Type 8 extract should show SHA-256 hash. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });

  it('should round-trip Imatag-style (type 9) with password and recover secret', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'watermark');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type');
      if (sel) sel.value = '9';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password');
      if (pw) pw.value = 'imatag-pw';
    });

    await page.setInputFiles('#wm-image', [
      { name: 'cover.png', mimeType: 'image/png', buffer: PNG_64_BUF }
    ]);
    await page.waitForTimeout(500);
    await page.setInputFiles('#wm-secret', [
      { name: 'secret.txt', mimeType: 'text/plain', buffer: SECRET_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const embedHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(embedHtml.includes('hidden') || embedHtml.includes('bytes'),
      'Type 9 embed should succeed. Got: ' + embedHtml.substring(0, 100));

    const wmInfo = await page.evaluate(async () => {
      const url = window._wmLastBlobUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || 'image/png' };
    });
    assert.ok(wmInfo, 'Type 9 watermarked image blob should be available');
    const wmBuf = Buffer.from(wmInfo.buf);

    await page.evaluate(() => switchWmTab('extract'));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById('wm-type-ex');
      if (sel) sel.value = '9';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const pw = document.getElementById('wm-password-ex');
      if (pw) pw.value = 'imatag-pw';
    });

    await page.setInputFiles('#wm-image-ex', [
      { name: 'watermarked.png', mimeType: wmInfo.type || 'image/png', buffer: wmBuf }
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById('wm-btn-ex').click());
    await page.waitForSelector('#wm-result', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const extractHtml = await page.evaluate(() => {
      const el = document.getElementById('wm-output');
      return el ? el.innerHTML : '';
    });
    assert.ok(extractHtml.includes('E2E') || extractHtml.includes('Type 9'),
      'Type 9 extract should recover content. Got: ' + extractHtml.substring(0, 300));
    await ctx.close();
  });
});
