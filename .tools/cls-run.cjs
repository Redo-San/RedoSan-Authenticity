const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2];
  const runs = parseInt(process.argv[3] || '3', 10);
  const browser = await chromium.launch();
  for (let run = 1; run <= runs; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__clsRaw = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            if (!e.hadRecentInput) {
              window.__clsRaw.push({
                v: Math.round(e.value * 1000) / 1000,
                t: Math.round(e.startTime),
                srcs: (e.sources || []).map((s) => {
                  const n = s.node || {};
                  return (n.id ? '#' + n.id : '') + (n.className ? '.' + String(n.className).split(' ').join('.') : '') + (n.tagName ? '<' + n.tagName + '>' : '') + '[' + Math.round(s.previousRect.top) + '->' + Math.round(s.currentRect.top) + ',h' + Math.round(s.previousRect.height) + '->' + Math.round(s.currentRect.height) + ']';
                }),
              });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
    });
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForTimeout(2200);
    const r = await pg.evaluate(() => {
      const res = performance.getEntriesByType('resource').map((e) => ({ n: e.name.split('/').pop(), t: Math.round(e.startTime), d: Math.round(e.duration) }));
      return { clsRaw: window.__clsRaw, res };
    });
    const total = r.clsRaw.reduce((a, b) => a + b.v, 0);
    const lang = await pg.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, active: document.querySelectorAll('.page.active').length }));
    console.log(`=== RUN ${run}: cls=${total.toFixed(4)} lang=${lang.lang} dir=${lang.dir} activePages=${lang.active}`);
    for (const c of r.clsRaw) console.log('  ', c.v, '@', c.t, c.srcs.slice(0, 4).join(' | '));
    if (run === 1) console.log('  res:', r.res.filter((x) => ['ar.json', 'rtl.css', 'i18n.js', 'navigation.js'].includes(x.n)).map((x) => `${x.n}@${x.t}+${x.d}`).join(' '));
    await ctx.close();
  }
  await browser.close();
})();
