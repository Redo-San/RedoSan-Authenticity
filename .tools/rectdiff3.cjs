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
          const id = el.id ? "#" + el.id : "";
          const cls =
            typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "";
          out.push({ k: id + cls + "<" + el.tagName + ">", t: Math.round(r.top), h: Math.round(r.height) });
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
    if (!b || !a) return { err: "missing" };
    const groups = {};
    b.forEach((x) => {
      (groups[x.k] = groups[x.k] || []).push(x);
    });
    const agroups = {};
    a.forEach((x) => {
      (agroups[x.k] = agroups[x.k] || []).push(x);
    });
    const diffs = [];
    for (const k of Object.keys(groups)) {
      const bg = groups[k],
        ag = agroups[k] || [];
      for (let i = 0; i < bg.length; i++) {
        if (i >= ag.length) {
          diffs.push({ k, gone: true });
          continue;
        }
        const x = bg[i],
          y = ag[i];
        if (Math.abs(y.h - x.h) > 4 || Math.abs(y.t - x.t) > 4)
          diffs.push({ k, t: x.t + "->" + y.t, h: x.h + "->" + y.h });
      }
    }
    return diffs;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
