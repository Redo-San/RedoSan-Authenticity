const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 6; run++) {
    const ctx = await browser.newContext({
      viewport: { width: 1350, height: 940 },
    });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__clsRaw = [];
      window.__dzTimeline = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries())
            if (!e.hadRecentInput)
              window.__clsRaw.push({
                v: Math.round(e.value * 1000) / 1000,
                t: Math.round(e.startTime),
              });
        }).observe({ type: "layout-shift", buffered: true });
      } catch (e) {}
      let last = -1;
      const tick = () => {
        const t = Math.round(performance.now());
        if (t > 150 && t < 1400) {
          const n = document.querySelectorAll(".file-drop-zone").length;
          if (n !== last) {
            window.__dzTimeline.push({ t, n });
            last = n;
          }
        }
        if (t < 1500) setTimeout(tick, 15);
      };
      setTimeout(tick, 160);
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", {
      waitUntil: "load",
    });
    await pg.waitForTimeout(1700);
    const r = await pg.evaluate(() => ({
      cls: window.__clsRaw,
      tl: window.__dzTimeline,
    }));
    const total = r.cls.reduce((a, b) => a + b.v, 0);
    console.log(
      "=== RUN " +
        run +
        " cls=" +
        total.toFixed(4) +
        " dzTimeline=" +
        r.tl.map((x) => x.t + ":" + x.n).join(" "),
    );
    await ctx.close();
  }
  await browser.close();
})();
