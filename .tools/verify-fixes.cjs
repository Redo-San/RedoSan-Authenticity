'use strict';
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8080';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 } });

  // ── Test 1: en default — C1 (i18n must exist, no console errors) ──
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text());
    });
    page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ': ' + r.url()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(BASE + '/Style/pages/timestamp/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const res = await page.evaluate(() => ({
      hasI18n: typeof window.i18n !== 'undefined',
      hasTranslatePage: typeof window.translatePage === 'function',
      langBtnText: document.getElementById('langBtn') ? document.getElementById('langBtn').textContent : null,
      dzBuilt: !!document.querySelector('.file-drop-zone'),
      dzText: document.querySelector('.dz-text') ? document.querySelector('.dz-text').textContent.trim() : null,
      swRegister: typeof navigator.serviceWorker !== 'undefined' ? 'sw-ok' : 'no-sw',
    }));
    console.log('[en] i18n=' + res.hasI18n + ' translatePage=' + res.hasTranslatePage +
      ' langBtn="' + res.langBtnText + '" dz=' + res.dzBuilt + ' dzText="' + res.dzText + '"');
    console.log('[en] console errors: ' + (errors.length ? errors.join(' || ') : 'NONE'));
  }

  // ── Test 2: ar — C2 (no infinite loop) ──
  {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem('redosan_lang', 'ar'); } catch (e) {}
    });
    let applyCount = 0;
    await page.addInitScript(() => {
      const orig = window.applyLang;
      // count via monkey-patching requestAnimationFrame-driven translatePage later
    });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ': ' + r.url()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/Style/pages/timestamp/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    // instrument after load: wrap translatePage and count calls over 3s
    const counts = await page.evaluate(async () => {
      const orig = window.translatePage;
      let n = 0;
      window.translatePage = function () { n++; return orig.apply(this, arguments); };
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 3000));
      return { n, ms: Math.round(performance.now() - t0) };
    });
    const res = await page.evaluate(() => ({
      htmlLang: document.documentElement.lang,
      dir: document.documentElement.dir,
      btnText: document.getElementById('langBtn') ? document.getElementById('langBtn').textContent : null,
      dzText: document.querySelector('.dz-text') ? document.querySelector('.dz-text').textContent.trim() : null,
      rtlCss: !!document.getElementById('rtl-css'),
    }));
    console.log('[ar] lang=' + res.htmlLang + ' dir=' + res.dir + ' langBtn="' + res.btnText + '" dzText="' + res.dzText + '" rtlCss=' + res.rtlCss);
    console.log('[ar] translatePage calls in 3s = ' + counts.n + ' (was ~158; must be ≤ 3)');
    console.log('[ar] console errors: ' + (errors.length ? errors.join(' || ') : 'NONE'));
  }

  // ── Test 3: SW path + 404 status ──
  {
    const r1 = await fetch(BASE + '/sw.js?v=2');
    console.log('[sw] /sw.js?v=2 status=' + r1.status + ' type=' + r1.headers.get('content-type'));
    const r2 = await fetch(BASE + '/definitely-missing.js');
    console.log('[404] missing.js status=' + r2.status + ' type=' + r2.headers.get('content-type'));
    const r3 = await fetch(BASE + '/Style/pages/timestamp/index.html');
    console.log('[cache] html cache-control=' + r3.headers.get('cache-control'));
    const r4 = await fetch(BASE + '/Style/style.css');
    console.log('[cache] css cache-control=' + r4.headers.get('cache-control'));
  }

  // ── Test 4: certificate page — i18n ReferenceError must be gone ──
  {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ': ' + r.url()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(BASE + '/Style/pages/certificate/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    console.log('[cert] console errors: ' + (errors.length ? errors.join(' || ') : 'NONE'));
    const r = await page.evaluate(() => ({
      hasI18n: typeof window.i18n !== 'undefined',
      selName: document.querySelector('select') ? document.querySelector('select').name || document.querySelector('select').id || document.querySelector('select').getAttribute('aria-label') : 'no-select',
    }));
    console.log('[cert] i18n=' + r.hasI18n + ' select name/aria=' + r.selName);
  }

  await browser.close();
}

main().catch((e) => { console.error('FAIL: ' + e); process.exit(1); });
