const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__before = null;
    window.__after = null;
    const snap = () => {
      const out = [];
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top < 2000) {
          out.push({
            id: el.id,
            cls: typeof el.className === "string" ? el.className : "",
            tag: el.tagName,
            t: Math.round(r.top),
            h: Math.round(r.height),
            d: getComputedStyle(el).display,
          });
        }
      });
      return out;
    };
    setTimeout(() => {
      window.__before = snap();
    }, 350);
    setTimeout(() => {
      window.__after = snap();
    }, 1100);
  });
  await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => {
    const b = window.__before,
      a = window.__after;
    if (!b || !a) return { err: "snapshots missing", before: !!b, after: !!a };
    const map = {};
    a.forEach((x) => {
      map[(x.id ? "#" + x.id : "") + "<" + x.tag + ">"] = x;
    });
    const diffs = [];
    b.forEach((x) => {
      const k = (x.id ? "#" + x.id : "") + "<" + x.tag + ">";
      const y = map[k];
      if (y) {
        const dh = y.h - x.h,
          dt = y.t - x.t;
        if (Math.abs(dh) > 4 || Math.abs(dt) > 4) diffs.push({ k, disp: x.d + "->" + y.d, dt, dh });
      } else {
        diffs.push({ k, removed: true });
      }
    });
    a.forEach((x) => {
      const k = (x.id ? "#" + x.id : "") + "<" + x.tag + ">";
      const found = b.some((z) => (z.id ? "#" + z.id : "") + "<" + z.tag + ">" === k);
      if (!found) diffs.push({ k, added: true, cls: x.cls.slice(0, 40) });
    });
    return diffs.filter((d) => !d.removed || d.k.includes("footer")).slice(0, 30);
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
