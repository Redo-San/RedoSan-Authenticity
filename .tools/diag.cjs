const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await pg.addInitScript(() => {
    window.__marker = "initran";
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch (e) {
      window.__obsErr = String(e);
    }
  });
  await pg.goto("http://localhost:8080/timestamp/index.html", { waitUntil: "load" });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => ({
    marker: window.__marker,
    cls: window.__cls,
    obsErr: window.__obsErr,
    hasObs: typeof PerformanceObserver,
    navCount: performance.getEntriesByType("navigation").length,
  }));
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
