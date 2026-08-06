const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__frames = [];
    const sec = () => document.getElementById('page-timestamp');
    let last = null;
    const tick = () => {
      const t = Math.round(performance.now());
      if (t >= 300 && t <= 1200) {
        const s = sec();
        if (s) {
          const sr = s.getBoundingClientRect();
          const kids = [];
          s.querySelectorAll(':scope > *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.height > 0) kids.push({ c: (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + '<' + el.tagName + '>', t: Math.round(r.top), h: Math.round(r.height) });
          });
          const sig = JSON.stringify(kids);
          if (sig !== last) { window.__frames.push({ t, secH: Math.round(sr.height), secT: Math.round(sr.top), kids }); last = sig; }
        }
      }
      if (t < 1400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await pg.goto('http://localhost:8080/Style/pages/timestamp/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1600);
  const r = await pg.evaluate(() => window.__frames);
  for (const f of r) {
    console.log('@' + f.t + ' sec[t' + f.secT + ',h' + f.secH + ']');
    for (const k of f.kids) console.log('   ' + k.c + ' t' + k.t + ' h' + k.h);
  }
  await browser.close();
})();
