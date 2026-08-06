const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const targets = ['(none)', 'i18n.js', 'shared_validation.js', 'search.js', 'navigation.js', 'timestamp.js', 'mpa-router.js', 'music-player.js', 'removal_tools'];
  for (const blocked of targets) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    if (blocked !== '(none)') {
      await pg.route('**/*', (route) => {
        const u = route.request().url();
        if (blocked === 'removal_tools' ? u.includes('removal_tools') : u.includes(blocked)) return route.abort();
        return route.continue();
      });
    }
    await pg.addInitScript(() => {
      window.__cls = 0; window.__clsRaw = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsRaw.push({ v: e.value, t: Math.round(e.startTime) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
    });
    await pg.goto('http://localhost:8080/timestamp/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(2200);
    const r = await pg.evaluate(() => ({ cls: window.__cls, raw: window.__clsRaw }));
    console.log(`blocking=${blocked}: cls=${r.cls.toFixed(4)} raw=${JSON.stringify(r.raw)}`);
    await ctx.close();
  }
  await browser.close();
})();
