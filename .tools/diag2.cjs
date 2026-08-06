const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    try {
      window.__mut = [];
      const obs = new MutationObserver((muts) => {
        const foot = () => document.getElementById('mainFooter');
        for (const m of muts) {
          if (m.target === foot() || (m.target && m.target.parentElement === foot())) {
            window.__mut.push({ t: Math.round(performance.now()), type: m.type, attr: m.attributeName || null, removed: m.removedNodes.length, added: m.addedNodes.length });
          }
        }
      });
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['style', 'class'] });
      window.__cls = 0;
      window.__clsRaw = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsRaw.push({ v: e.value, t: Math.round(e.startTime) }); } }).observe({ type: 'layout-shift', buffered: true });
      window.__initOk = true;
    } catch (e) { window.__initErr = String(e); }
  });
  await pg.goto('http://localhost:8080/timestamp/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => ({
    initOk: window.__initOk, initErr: window.__initErr, cls: window.__cls, clsRaw: window.__clsRaw,
    mut: (window.__mut || []).slice(0, 8),
    footerDisplay: getComputedStyle(document.getElementById('mainFooter')).display,
    footerH: document.getElementById('mainFooter').offsetHeight,
  }));
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
