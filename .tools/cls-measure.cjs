const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const page of ['watermark', 'certificate', 'timestamp']) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__cls = 0;
      window.__clsEntries = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) {
              window.__cls += e.value;
              window.__clsEntries.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime) });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (err) {}
    });
    await pg.goto(`http://localhost:8080/${page}/index.html`, { waitUntil: 'load' });
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => {
      const dz = document.querySelectorAll('.file-drop-zone').length;
      const inputs = document.querySelectorAll('input[type="file"]').length;
      const pw = document.getElementById('wm-password-group') || document.getElementById('awm-password-group') || document.getElementById('cert-password') || null;
      return { cls: window.__cls, entries: window.__clsEntries, dz, inputs, pwVisible: pw ? getComputedStyle(pw).display : 'n/a' };
    });
    console.log(`=== ${page} ===`);
    console.log(JSON.stringify(r, null, 1));
    await ctx.close();
  }
  await browser.close();
})();
