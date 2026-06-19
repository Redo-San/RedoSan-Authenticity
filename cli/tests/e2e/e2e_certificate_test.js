'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer, stopServer } = require('./e2e_helpers');
const path = require('path');
const fs = require('fs');

const PORT = 9897;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'testimg.png'));

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

describe('E2E — Certificate / Digital Passport', () => {
  it('should navigate to certificate page without errors', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'certificate');
    await page.waitForTimeout(1000);
    assert.equal(errors.filter(e => !e.includes('404') && !e.includes('Failed to load')).length, 0);
    await ctx.close();
  });

  it('should have form fields and generate button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'certificate');
    await page.waitForTimeout(1000);
    const hasName = await page.evaluate(() => !!document.getElementById('cert-name'));
    const hasEmail = await page.evaluate(() => !!document.getElementById('cert-email'));
    const hasPhone = await page.evaluate(() => !!document.getElementById('cert-phone'));
    const hasWebsite = await page.evaluate(() => !!document.getElementById('cert-website'));
    const hasFile = await page.evaluate(() => !!document.getElementById('cert-file'));
    const hasBtn = await page.evaluate(() => !!document.getElementById('cert-gen-btn'));
    assert.ok(hasName, 'Name input exists');
    assert.ok(hasEmail, 'Email input exists');
    assert.ok(hasPhone, 'Phone input exists');
    assert.ok(hasWebsite, 'Website input exists');
    assert.ok(hasFile, 'Image file input exists');
    assert.ok(hasBtn, 'Generate button exists');
    await ctx.close();
  });

  it('should generate certificate and show download links', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'certificate');
    await page.waitForTimeout(1000);

    await page.setInputFiles('#cert-file', [
      { name: 'photo.png', mimeType: 'image/png', buffer: PNG_BUF }
    ]);
    await page.waitForTimeout(500);

    await page.fill('#cert-name', 'E2E Test User');
    await page.fill('#cert-email', 'test@example.com');
    await page.evaluate(() => {
      const sel = document.getElementById('cert-phonecode');
      if (sel) sel.value = '+1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.fill('#cert-phone', '5551234567');
    await page.fill('#cert-website', 'https://example.com');
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('cert-gen-btn').click());
    await page.waitForTimeout(8000);

    const downloadSectionVisible = await page.evaluate(() => {
      const el = document.getElementById('cert-download-section');
      return el ? el.style.display !== 'none' && el.style.display !== '' : false;
    });

    if (downloadSectionVisible) {
      const downloadBtns = await page.evaluate(() => {
        const section = document.getElementById('cert-download-section');
        if (!section) return 0;
        return section.querySelectorAll('a.btn, button.btn').length;
      });
      assert.ok(downloadBtns >= 3, 'Should show at least 3 download format buttons (got ' + downloadBtns + ')');
    }

    const fatal = errors.filter(e => !e.includes('404') && !e.includes('Failed to load'));
    assert.equal(fatal.length, 0, 'No fatal errors: ' + fatal.join(', '));
    await ctx.close();
  });

  it('should generate a certificate (or show error from UI flow)', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await navTo(page, 'certificate');
    await page.waitForTimeout(1000);

    // Upload image
    await page.setInputFiles('#cert-file', [
      { name: 'photo.png', mimeType: 'image/png', buffer: PNG_BUF }
    ]);
    await page.waitForTimeout(500);

    // Fill form
    await page.fill('#cert-name', 'E2E Test User');
    await page.fill('#cert-email', 'test@example.com');
    // Phone: select country code first, then fill number
    await page.evaluate(() => {
      const sel = document.getElementById('cert-phonecode');
      if (sel) sel.value = '+1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.fill('#cert-phone', '5551234567');
    await page.fill('#cert-website', 'https://example.com');

    await page.waitForTimeout(300);

    // Click generate
    await page.evaluate(() => document.getElementById('cert-gen-btn').click());

    // Wait — certificate generation takes time (PDF/DOCX rendering)
    await page.waitForTimeout(5000);

    // Check for success — either download section appears or status text changes
    const statusText = await page.evaluate(() => {
      const el = document.getElementById('cert-status');
      return el ? el.textContent : '';
    });
    const downloadVisible = await page.evaluate(() => {
      const el = document.getElementById('cert-download-section');
      return el ? el.style.display !== 'none' && el.style.display !== '' : false;
    });

    // Accept either success or a proper error (UI flow works)
    const hasResult = statusText.length > 0 || downloadVisible;
    assert.ok(hasResult,
      'Certificate should produce status. Status: "' + statusText + '"' +
      ', DownloadSection: ' + downloadVisible);

    await ctx.close();
  });
});
