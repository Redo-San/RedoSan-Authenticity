const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 4; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__frames = [];
      window.__clsRaw = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__clsRaw.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      let last = null;
      const tick = () => {
        const t = Math.round(performance.now());
        if (t >= 250 && t <= 1300) {
          const s = document.getElementById('page-timestamp');
          if (s) {
            const sr = s.getBoundingClientRect();
            const kids = [];
            const cf = s.querySelector('.card-form');
            if (cf) {
              const cr = cf.getBoundingClientRect();
              kids.push({ c: '.card-form', t: Math.round(cr.top), h: Math.round(cr.height), d: getComputedStyle(cf).display });
              cf.querySelectorAll(':scope > *').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.height > 0 || getComputedStyle(el).display !== 'none') kids.push({ c: (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + '<' + el.tagName + '>', t: Math.round(r.top), h: Math.round(r.height), d: getComputedStyle(el).display });
              });
            }
            const sig = JSON.stringify(kids) + sr.height;
            if (sig !== last) { window.__frames.push({ t, secH: Math.round(sr.height), kids }); last = sig; }
          }
        }
        if (t < 1400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await pg.goto('http://localhost:8080/Style/pages/timestamp/index.html', { waitUntil: 'load' });
    await pg.waitForTimeout(1700);
    const r = await pg.evaluate(() => ({ frames: window.__frames, cls: window.__clsRaw }));
    const total = r.cls.reduce((a, b) => a + b.v, 0);
    console.log('=== RUN ' + run + ' cls=' + total.toFixed(4));
    for (const f of r.frames) {
      console.log('  @' + f.t + ' secH=' + f.secH);
      for (const k of f.kids) console.log('    ' + k.c + ' t' + k.t + ' h' + k.h + ' [' + k.d + ']');
    }
    await ctx.close();
  }
  await browser.close();
})();
