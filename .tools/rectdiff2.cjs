const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__before = null; window.__after = null;
    const snap = () => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top < 2000) {
          const id = el.id ? '#' + el.id : '';
          const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          out.push({ k: id + cls + '<' + el.tagName + '>', t: Math.round(r.top), h: Math.round(r.height) });
        }
      });
      return out;
    };
    setTimeout(() => { window.__before = snap(); }, 350);
    setTimeout(() => { window.__after = snap(); }, 1100);
  });
  await pg.goto('http://localhost:8080/Style/pages/timestamp/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => {
    const b = window.__before, a = window.__after;
    if (!b || !a) return { err: 'missing' };
    const map = {}; a.forEach((x) => { map[x.k] = x; });
    const seen = {};
    const diffs = [];
    b.forEach((x) => {
      seen[x.k] = (seen[x.k] || 0) + 1;
      const y = map[x.k + '#' + seen[x.k]];
      if (y) { if (Math.abs(y.h - x.h) > 4 || Math.abs(y.t - x.t) > 4) diffs.push({ k: x.k, t: x.t + '->' + y.t, h: x.h + '->' + y.h }); }
      else diffs.push({ k: x.k, gone: true });
    });
    return diffs.slice(0, 40);
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
