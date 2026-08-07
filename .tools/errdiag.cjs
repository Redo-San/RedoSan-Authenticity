const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  pg.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      console.log("[console." + m.type() + "]", m.text().slice(0, 200));
  });
  pg.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  pg.on("requestfailed", (r) =>
    console.log("[reqfailed]", r.url().split("/").slice(-2).join("/"), r.failure() && r.failure().errorText),
  );
  await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => ({
    hasI18nData: !!window.__I18N_DATA,
    i18nLang: (window.i18n && i18n.lang) || null,
    firstText: (document.querySelector("[data-i18n]") || {}).textContent,
    langBtn: (document.getElementById("langBtn") || {}).textContent,
    arJsonLoaded: performance
      .getEntriesByType("resource")
      .filter((x) => x.name.includes("ar.json"))
      .map((x) => x.name.slice(-40) + " status?"),
    rtlLoaded: performance
      .getEntriesByType("resource")
      .filter((x) => x.name.includes("rtl.css"))
      .map((x) => x.name.slice(-40)),
    i18nLoaded: performance
      .getEntriesByType("resource")
      .filter((x) => x.name.includes("i18n.js"))
      .map((x) => x.name.slice(-40)),
  }));
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
