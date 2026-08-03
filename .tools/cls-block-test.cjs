const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__mut = [];
    const foot = () => document.getElementById('mainFooter');
    const obs = new MutationObserver((muts) => {
      const f = foot();
      for (const m of muts) {
        window.__mut.push({
          t: Math.round(performance.now()),
          target: m.target.id || m.target.tagName || m.target.className,
          type: m.type,
          attr: m.attributeName || null,
          added: m.addedNodes.length,
          removed: m.removedNodes.length,
          footH: f ? Math.round(f.offsetHeight) : null,
          footDisplay: f ? getComputedStyle(f).display : null,
        });
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  });
  const scripts = ['i18n.js', 'navigation.js', 'search.js', 'removal_tools.js', 'music-player.js', 'mpa-router.js'];
  for (const blocked of scripts) {
    await pg.route('**/*', (route) => {
      const u = route.request().url();
      if (blocked === 'removal_tools.js' && u.includes('removal_tools')) return route.abort();
      if (blocked !== 'removal_tools.js' && u.includes(blocked)) return route.abort();
      return route.continue();
    });
    await pg.goto('http://localhost:8080/timestamp/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(1800);
    const r = await pg.evaluate(() => ({
      cls: window.__cls,
      footerH: document.getElementById('mainFooter') ? Math.round(document.getElementById('mainFooter').offsetHeight) : null,
      footMut: window.__mut.filter((m) => (m.target === 'mainFooter' || m.target === 'FOOTER') && (m.type === 'attributes' || m.removed > 0 || m.added > 0)).slice(0, 8),
    }));
    console.log(`--- blocking ${blocked}: cls=${(r.cls || 0).toFixed(3)} footerH=${r.footerH}`);
    if (r.footMut.length) console.log(JSON.stringify(r.footMut.slice(0, 5)));
    await pg.unroute('**/*');
  }
  await browser.close();
})();
