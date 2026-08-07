const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 5; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));
    await pg.addInitScript(() => {
      window.__probe = [];
      let done = false;
      const tick = () => {
        const t = Math.round(performance.now());
        if (t > 150 && t < 1400 && !done) {
          window.__probe.push({
            t,
            initDZ: typeof window.initDropZones,
            setStatus: typeof window.setStatus,
            dz: document.querySelectorAll(".file-drop-zone").length,
          });
          if (window.__probe.length > 30) done = true;
        }
        if (t < 1500) setTimeout(tick, 20);
      };
      setTimeout(tick, 160);
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
    await pg.waitForTimeout(1800);
    const r = await pg.evaluate(() => window.__probe);
    const changes = [];
    let last = null;
    for (const p of r) {
      const sig = p.initDZ + "|" + p.setStatus + "|" + p.dz;
      if (sig !== last) {
        changes.push(p);
        last = sig;
      }
    }
    console.log("=== RUN " + run + " errs=" + (errs.length ? errs.join(" ; ") : "none"));
    for (const p of changes)
      console.log("   @" + p.t + " initDZ=" + p.initDZ + " setStatus=" + p.setStatus + " dz=" + p.dz);
    await ctx.close();
  }
  await browser.close();
})();
