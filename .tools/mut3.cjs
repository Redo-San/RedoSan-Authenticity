const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 2; run++) {
    const ctx = await browser.newContext({
      viewport: { width: 1350, height: 940 },
    });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__clsRaw = [];
      window.__muts = [];
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
      const init = () => {
        const mo = new MutationObserver((muts) => {
          const t = Math.round(performance.now());
          for (const m of muts) {
            if (m.type === "attributes") {
              window.__muts.push({
                t,
                target:
                  (m.target.id ? "#" + m.target.id : "") +
                  (m.target.className && typeof m.target.className === "string"
                    ? "." + m.target.className.split(" ").join(".")
                    : "") +
                  "<" +
                  m.target.tagName +
                  ">",
                attr: m.attributeName,
                val: (
                  (m.target.getAttribute &&
                    m.target.getAttribute(m.attributeName)) ||
                  ""
                )
                  .toString()
                  .slice(0, 60),
              });
            } else if (m.type === "childList") {
              m.addedNodes.forEach((n) => {
                if (n.nodeType === 1)
                  window.__muts.push({
                    t,
                    target:
                      (n.id ? "#" + n.id : "") +
                      (n.className && typeof n.className === "string"
                        ? "." + n.className.split(" ").join(".")
                        : "") +
                      "<" +
                      n.tagName +
                      "> ADDED to " +
                      (m.target.id || m.target.tagName),
                  });
              });
            }
          }
        });
        mo.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      };
      if (document.readyState !== "loading") init();
      else document.addEventListener("DOMContentLoaded", init, { once: true });
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", {
      waitUntil: "load",
    });
    await pg.waitForTimeout(2200);
    const r = await pg.evaluate(() => ({
      clsRaw: window.__clsRaw,
      muts: window.__muts,
    }));
    const total = r.clsRaw.reduce((a, b) => a + b.v, 0);
    console.log(`=== RUN ${run}: cls=${total.toFixed(4)}`);
    for (const c of r.clsRaw) console.log("  shift", c.v, "@", c.t);
    const first = r.muts.findIndex((m) => m.t > 400);
    for (const m of r.muts.slice(Math.max(0, first - 3), first + 12))
      console.log("  mut@" + m.t, m.target, m.attr || "", m.val || "");
    await ctx.close();
  }
  await browser.close();
})();
