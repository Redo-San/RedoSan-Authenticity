const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 3; run++) {
    const ctx = await browser.newContext({
      viewport: { width: 1350, height: 940 },
    });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__mut = [];
      window.__cls = 0;
      window.__clsRaw = [];
      const setup = () => {
        try {
          const obs = new MutationObserver((muts) => {
            const foot = document.getElementById("mainFooter");
            for (const m of muts) {
              if (
                m.target === foot ||
                (m.target && m.target.parentElement === foot)
              ) {
                window.__mut.push({
                  t: Math.round(performance.now()),
                  type: m.type,
                  attr: m.attributeName || null,
                  value:
                    m.attributeName === "style"
                      ? m.target.getAttribute("style") || ""
                      : null,
                  removed: m.removedNodes.length,
                  added: m.addedNodes.length,
                });
              }
            }
          });
          obs.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["style", "class"],
          });
        } catch (e) {
          window.__mutErr = String(e);
        }
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries())
              if (!e.hadRecentInput) {
                window.__cls += e.value;
                window.__clsRaw.push({
                  v: e.value,
                  t: Math.round(e.startTime),
                });
              }
          }).observe({ type: "layout-shift", buffered: true });
        } catch (e) {}
      };
      if (document.readyState !== "loading") setup();
      else document.addEventListener("DOMContentLoaded", setup);
    });
    await pg.goto("http://localhost:8080/timestamp/index.html", {
      waitUntil: "load",
    });
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => ({
      cls: window.__cls,
      clsRaw: window.__clsRaw,
      mut: (window.__mut || []).slice(0, 10),
      mutErr: window.__mutErr,
      footerDisplay: getComputedStyle(document.getElementById("mainFooter"))
        .display,
    }));
    console.log(
      `=== RUN ${run}: cls=${r.cls.toFixed(4)} footerDisplay=${
        r.footerDisplay
      } mutErr=${r.mutErr}`,
    );
    console.log("raw:", JSON.stringify(r.clsRaw));
    if (r.mut.length) console.log("mut:", JSON.stringify(r.mut));
    await ctx.close();
  }
  await browser.close();
})();
