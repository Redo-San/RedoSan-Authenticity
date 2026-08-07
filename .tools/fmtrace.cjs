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
        if (t > 150 && t < 1500) {
          const q = (s) => {
            const el = document.querySelector(s);
            return el ? Math.round(el.getBoundingClientRect().height) : -1;
          };
          const sig =
            q(".form-group") +
            "|" +
            q(".dz-text") +
            "|" +
            q("#ts-create-btn") +
            "|" +
            q("#page-timestamp") +
            "|" +
            q(".dz-file");
          if (sig !== last) {
            window.__probe.push({
              t,
              sig,
              langBtn: (document.querySelector("#langBtn") || {}).textContent || "",
              dzTxt: (document.querySelector(".dz-text") || {}).textContent || "",
            });
            last = sig;
          }
        }
        if (t < 1500) setTimeout(tick, 25);
      };
      setTimeout(tick, 160);
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
    await pg.waitForTimeout(1900);
    const r = await pg.evaluate(() => window.__probe);
    console.log("=== RUN " + run);
    for (const p of r)
      console.log(
        "  @" +
          p.t +
          " [fg=" +
          p.sig.split("|")[0] +
          " dzText=" +
          p.sig.split("|")[1] +
          " btn=" +
          p.sig.split("|")[2] +
          " sec=" +
          p.sig.split("|")[3] +
          '] dzTxt="' +
          p.dzTxt.slice(0, 30) +
          '"',
      );
    await ctx.close();
  }
  await browser.close();
})();
