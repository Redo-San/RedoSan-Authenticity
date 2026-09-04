const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 2; run++) {
    const ctx = await browser.newContext({
      viewport: { width: 1350, height: 940 },
    });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__mut = [];
      window.__clsRaw = [];
      const setup = () => {
        try {
          const obs = new MutationObserver((muts) => {
            for (const m of muts) {
              const t = m.target;
              if (
                m.type === "attributes" &&
                (m.attributeName === "style" || m.attributeName === "class") &&
                (t.id || (t.classList && t.classList.length))
              ) {
                window.__mut.push({
                  t: Math.round(performance.now()),
                  ty: m.attributeName,
                  id: t.id || null,
                  cls: (t.className || "").toString().slice(0, 40),
                  val:
                    m.attributeName === "style"
                      ? t.getAttribute("style") || ""
                      : null,
                });
              } else if (
                m.type === "childList" &&
                m.removedNodes.length &&
                m.removedNodes[0].nodeType === 1
              ) {
                window.__mut.push({
                  t: Math.round(performance.now()),
                  ty: "remove",
                  id: t.id || null,
                  cls: (t.className || "").toString().slice(0, 40),
                  removed:
                    m.removedNodes[0].nodeName +
                    ":" +
                    String(
                      m.removedNodes[0].id || m.removedNodes[0].className || "",
                    ).slice(0, 30),
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
        } catch (e) {}
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries())
              if (!e.hadRecentInput)
                window.__clsRaw.push({
                  v: e.value,
                  t: Math.round(e.startTime),
                });
          }).observe({ type: "layout-shift", buffered: true });
        } catch (e) {}
      };
      if (document.readyState !== "loading") setup();
      else document.addEventListener("DOMContentLoaded", setup);
    });
    await pg.goto("http://localhost:8080/timestamp/index.html", {
      waitUntil: "load",
    });
    await pg.waitForTimeout(2200);
    const r = await pg.evaluate(() => ({
      mut: window.__mut,
      cls: window.__clsRaw,
    }));
    const total = r.cls.reduce((a, b) => a + b.v, 0);
    console.log(`=== RUN ${run}: cls=${total.toFixed(4)}`);
    for (const c of r.cls) console.log("  SHIFT", c.v, "@", c.t);
    for (const m of r.mut)
      console.log(
        "  ",
        m.t,
        m.ty,
        m.id ? "#" + m.id : "",
        m.cls ? "." + m.cls.replace(/ /g, ".") : "",
        m.val ? 'style="' + m.val + '"' : "",
        m.removed ? "-> removed " + m.removed : "",
      );
    await ctx.close();
  }
  await browser.close();
})();
