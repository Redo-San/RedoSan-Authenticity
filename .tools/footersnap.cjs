const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (let run = 1; run <= 4; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
    const pg = await ctx.newPage();
    await pg.addInitScript(() => {
      localStorage.setItem("redosan_lang", "ar");
    });
    await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
    const snap = () =>
      pg.evaluate(() => {
        const fb = document.querySelector("#mainFooter");
        const out = { t: Math.round(performance.now()) };
        if (fb) {
          out.rect = Math.round(fb.getBoundingClientRect().top) + "/" + Math.round(fb.getBoundingClientRect().height);
          out.kids = Array.from(fb.children)
            .map(
              (c) =>
                c.tagName +
                "." +
                (c.className || "").split(" ")[0] +
                "=" +
                Math.round(c.getBoundingClientRect().height),
            )
            .join(" ");
          out.text = fb.textContent.trim().slice(0, 60).replace(/\n/g, "|");
        }
        return out;
      });
    console.log("=== RUN " + run);
    console.log("  @400: " + JSON.stringify(await snap()));
    await pg.waitForTimeout(600);
    console.log(" @1000: " + JSON.stringify(await snap()));
    await ctx.close();
  }
  await browser.close();
})();
