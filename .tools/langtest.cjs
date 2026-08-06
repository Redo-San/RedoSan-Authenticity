const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'ar';
  const browser = await chromium.launch();
  for (let run = 1; run <= 4; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript((m) => {
      try { localStorage.setItem('redosan_lang', m); } catch (e) {}
      window.__clsRaw = [];
      window.__texts = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__clsRaw.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      const tick = () => {
        const t = Math.round(performance.now());
        if (t % 50 < 15 && t > 200 && t < 1200) {
          const el = document.querySelector('[data-i18n]');
          const ots = document.getElementById('ots-create');
          window.__texts.push({ t, s: (el ? el.textContent : '').slice(0, 30), dir: document.documentElement.dir, ots: ots ? Math.round(ots.getBoundingClientRect().height) : -1 });
        }
        if (t < 1300) setTimeout(tick, 20);
      };
      setTimeout(tick, 210);
    }, mode);
    await pg.goto('http://localhost:8080/Style/pages/timestamp/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => ({ cls: window.__clsRaw, texts: window.__texts }));
    const total = r.cls.reduce((a, b) => a + b.v, 0);
    console.log('=== RUN ' + run + ' mode=' + mode + ' cls=' + total.toFixed(4));
    const seen = [];
    for (const t of r.texts) { const k = t.s + '|' + t.ots; if (!seen.includes(k) || seen.length < 12) { seen.push(k); console.log('  @' + t.t + ' dir=' + t.dir + ' ots=' + t.ots + ' text="' + t.s + '"'); } }
    await ctx.close();
  }
  await browser.close();
})();
