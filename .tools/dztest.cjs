const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 160)); });
  pg.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 200)));
  pg.on('response', (r) => { if (r.status() >= 400) errors.push('[HTTP ' + r.status() + '] ' + r.url().split('/').slice(-2).join('/')); });
  await pg.goto('http://localhost:8080/Style/pages/timestamp/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(300);
  const t1 = await pg.evaluate(() => ({
    initDropZonesType: typeof window.initDropZones,
    dzCount: document.querySelectorAll('.file-drop-zone').length,
    rawInputs: document.querySelectorAll('input[type=file]').length,
    sharedLoaded: !!window.setStatus,
  }));
  console.log('@300ms:', JSON.stringify(t1));
  await pg.waitForTimeout(1200);
  const t2 = await pg.evaluate(() => ({
    dzCount: document.querySelectorAll('.file-drop-zone').length,
    rawInputs: document.querySelectorAll('input[type=file]:not(.dz-input)').length,
  }));
  console.log('@1500ms:', JSON.stringify(t2));
  console.log('ERRORS:', errors.join('\n  '));
  await browser.close();
})();
