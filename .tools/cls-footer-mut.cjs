const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 3; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(() => {
      window.__mut = [];
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.target === document.getElementById('mainFooter') || (m.target && m.target.parentElement === document.getElementById('mainFooter'))) {
            window.__mut.push({
              t: Math.round(performance.now()),
              type: m.type,
              attr: m.attributeName || null,
              value: m.attributeName === 'style' ? m.target.getAttribute('style') : null,
              removed: m.removedNodes.length,
              added: m.addedNodes.length,
            });
          }
        }
      });
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['style', 'class'] });
      window.__cls = 0;
      window.__clsRaw = [];
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsRaw.push({ v: e.value, t: Math.round(e.startTime) }); } }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
    });
    await pg.goto('http://localhost:8080/timestamp/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => ({
      cls: window.__cls,
      clsRaw: window.__clsRaw,
      mut: window.__mut.slice(0, 10),
      footerDisplay: getComputedStyle(document.getElementById('mainFooter')).display,
    }));
    console.log(`=== RUN ${run}: cls=${r.cls.toFixed(3)} footerDisplay=${r.footerDisplay}`);
    console.log('raw:', JSON.stringify(r.clsRaw));
    if (r.mut.length) console.log('mut:', JSON.stringify(r.mut));
    if (errs.length) console.log('errs:', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
})();
