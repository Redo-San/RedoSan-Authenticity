const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 3; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__probe = [];
      let last = null;
      const tick = () => {
        const t = Math.round(performance.now());
        if (t > 150 && t < 1600) {
          const sec = document.querySelector("#page-timestamp");
          const btn = document.querySelector("#ts-create-btn");
          const h = sec ? Math.round(sec.getBoundingClientRect().height) : -1;
          const bh = btn ? Math.round(btn.getBoundingClientRect().height) : -1;
          const sig = h + "|" + bh + "|" + ((document.querySelector(".dz-text") || {}).textContent || "").charCodeAt(0);
          if (sig !== last) {
            window.__probe.push({ t, sig, btn: (btn || {}).textContent || "" });
            last = sig;
          }
        }
        if (t < 1600) setTimeout(tick, 20);
      };
      setTimeout(tick, 160);
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
    await pg.waitForTimeout(2100);
    const r = await pg.evaluate(() => ({
      probe: window.__probe,
      res: performance
        .getEntriesByType("resource")
        .map((e) => e.name.split("/").pop() + "@" + Math.round(e.responseEnd))
        .filter((s) => s.includes("lang") || s.includes("i18n")),
    }));
    console.log("=== RUN " + run + " resources: " + JSON.stringify(r.res));
    for (const p of r.probe)
      console.log("  @" + p.t + " sec|btn|dz0=" + p.sig + ' btnTxt="' + p.btn.slice(0, 20) + '"');
    await ctx.close();
  }
  await browser.close();
})();
