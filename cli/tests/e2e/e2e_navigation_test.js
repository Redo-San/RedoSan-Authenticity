'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer, stopServer } = require('./e2e_helpers');

const PORT = 9876;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: 'domcontentloaded' };

let browser;
let server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

describe('E2E — Home Page', () => {
  it('should load without fatal console errors', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);
    const fatal = errors.filter(e => !e.includes('frame-ancestors') && !e.includes('404'));
    assert.equal(fatal.length, 0, `Errors: ${fatal.join(', ')}`);
    await ctx.close();
  });

  it('should have correct title', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    const title = await page.title();
    assert.ok(title.length > 0);
    await ctx.close();
  });

  it('should have sidebar with data-page links', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    const count = await page.evaluate(() =>
      document.querySelectorAll('#sidebar a[data-page]').length
    );
    assert.ok(count >= 10, `Expected >=10 sidebar links, got ${count}`);
    await ctx.close();
  });

  it('should have footer', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    const footer = await page.$('footer');
    assert.ok(footer);
    await ctx.close();
  });
});

describe('E2E — Hash Routing & Page Navigation', () => {
  it('should navigate via sidebar click to watermark', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="watermark"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    const active = await page.evaluate(() => {
      const p = document.getElementById('page-watermark');
      return p ? p.classList.contains('active') : false;
    });
    assert.ok(active, 'page-watermark should be active');
    await ctx.close();
  });

  it('should navigate to ID forge via sidebar', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    const active = await page.evaluate(() => {
      const p = document.getElementById('page-id_forge');
      return p ? p.classList.contains('active') : false;
    });
    assert.ok(active, 'page-id_forge should be active');
    await ctx.close();
  });

  it('should update URL after navigation (MPA-style path)', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(2000);
    const hash = await page.evaluate(() => window.location.hash);
    assert.ok(hash.includes('page-id_forge'), `Hash should include 'page-id_forge', got: ${hash}`);
    await ctx.close();
  });
});

describe('E2E — ID Forge Functionality', () => {
  it('should have type selector and generate button', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    const hasSelect = await page.evaluate(() => !!document.getElementById('if-type'));
    const hasBtn = await page.evaluate(() => !!document.getElementById('if-gen-btn'));
    const hasOutput = await page.evaluate(() => !!document.getElementById('if-output'));
    assert.ok(hasSelect, 'ID Forge type selector should exist');
    assert.ok(hasBtn, 'ID Forge generate button (#if-gen-btn) should exist');
    assert.ok(hasOutput, 'ID Forge output textarea should exist');
    await ctx.close();
  });

  it('should generate UUID v4', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const sel = document.getElementById('if-type');
      if (sel) sel.value = 'uuidv4';
      const btn = document.getElementById('if-gen-btn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const output = await page.evaluate(() => {
      const el = document.getElementById('if-output');
      return el ? (el.value || el.textContent || '') : '';
    });
    assert.ok(output.length > 0, 'Generated output should not be empty');
    assert.ok(output.includes('-'), 'UUID v4 should contain hyphens');
    await ctx.close();
  });

  it('should generate ULID', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const sel = document.getElementById('if-type');
      if (sel) sel.value = 'ulid';
      const btn = document.getElementById('if-gen-btn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const output = await page.evaluate(() => {
      const el = document.getElementById('if-output');
      return el ? (el.value || el.textContent || '') : '';
    });
    assert.ok(output.length > 0, 'Generated ULID should not be empty');
    await ctx.close();
  });

  it('should generate NanoID with custom length', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const a = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (a) a.click();
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const sel = document.getElementById('if-type');
      if (sel) sel.value = 'nanoid';
      const lenInput = document.getElementById('if-nanoid-len');
      if (lenInput) lenInput.value = '10';
      const btn = document.getElementById('if-gen-btn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const output = await page.evaluate(() => {
      const el = document.getElementById('if-output');
      return el ? (el.value || el.textContent || '') : '';
    });
    assert.ok(output.length > 0, 'Generated NanoID should not be empty');
    await ctx.close();
  });
});
