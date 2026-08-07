const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  for (const page of ["watermark", "certificate", "timestamp", ""]) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
    pg.on("console", (m) => {
      if (m.type() === "error") errs.push("CONSOLE: " + m.text());
    });
    await pg.addInitScript(() => {
      window.__clsEntries = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) {
              window.__clsEntries.push({
                v: Math.round(e.value * 1000) / 1000,
                t: Math.round(e.startTime),
                sources: (e.sources || []).map((s) => {
                  const n = s.node || {};
                  return {
                    id: n.id || null,
                    cls: (n.className || "").toString().slice(0, 60),
                    tag: n.tagName,
                    prevTop: Math.round(s.previousRect.top),
                    curTop: Math.round(s.currentRect.top),
                    prevH: Math.round(s.previousRect.height),
                    curH: Math.round(s.currentRect.height),
                  };
                }),
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch (err) {}
    });
    const url = page === "" ? "http://localhost:8080/" : `http://localhost:8080/${page}/index.html`;
    await pg.goto(url, { waitUntil: "load" });
    await pg.waitForTimeout(4500);
    const r = await pg.evaluate(() => ({
      clsEntries: window.__clsEntries,
      fonts: document.fonts ? [...document.fonts].map((f) => f.family + " " + f.status) : [],
      dzAtPaint: document.querySelectorAll(".file-drop-zone").length,
      title: document.title,
    }));
    console.log(`=== ${page || "home"} ===`);
    console.log(JSON.stringify(r, null, 1));
    if (errs.length) console.log("ERRORS:", errs.slice(0, 6));
    await ctx.close();
  }
  await browser.close();
})();
