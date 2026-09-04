const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1350, height: 940 },
  });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__probe = [];
    let last = null;
    const tick = () => {
      const t = Math.round(performance.now());
      if (t > 380 && t < 1000) {
        const btn = document.querySelector("#ts-create-btn");
        const bt = btn ? btn.textContent.trim().slice(0, 18) : "";
        const sig =
          bt +
          "|" +
          !!(window.__I18N_DATA && window.__I18N_DATA.ar) +
          "|" +
          (typeof window.i18n !== "undefined" &&
            !!i18n.data &&
            !!i18n.data["ts.ts_create_btn"]);
        if (sig !== last) {
          window.__probe.push({ t, sig });
          last = sig;
        }
      }
      if (t < 1000) setTimeout(tick, 20);
    };
    setTimeout(tick, 390);
  });
  await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", {
    waitUntil: "load",
  });
  await pg.waitForTimeout(1600);
  const r = await pg.evaluate(() => window.__probe);
  for (const p of r)
    console.log("  @" + p.t + ' btnTxt|dataAr|key="' + p.sig + '"');
  await browser.close();
})();
