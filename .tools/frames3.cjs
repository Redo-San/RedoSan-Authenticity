const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__frames = [];
    let last = null;
    const tick = () => {
      const t = Math.round(performance.now());
      if (t >= 250 && t <= 1300) {
        const ots = document.getElementById("ots-create");
        if (ots) {
          const kids = [];
          ots.querySelectorAll(":scope > *").forEach((el) => {
            const r = el.getBoundingClientRect();
            kids.push({
              c:
                (el.id ? "#" + el.id : "") +
                (el.className && typeof el.className === "string"
                  ? "." + el.className.trim().split(/\s+/).join(".")
                  : "") +
                "<" +
                el.tagName +
                ">",
              t: Math.round(r.top),
              h: Math.round(r.height),
              d: getComputedStyle(el).display,
            });
          });
          const hasDz = !!document.querySelector("#ots-create .file-drop-zone");
          const hasRaw = !!document.querySelector("#ots-create input[type=file]:not(.dz-input)");
          const sig = JSON.stringify(kids) + hasDz + hasRaw;
          if (sig !== last) {
            window.__frames.push({ t, kids, hasDz, hasRaw });
            last = sig;
          }
        }
      }
      if (t < 1400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await pg.goto("http://localhost:8080/Style/pages/timestamp/index.html", { waitUntil: "load" });
  await pg.waitForTimeout(1700);
  const r = await pg.evaluate(() => window.__frames);
  for (const f of r) {
    console.log("@" + f.t + " dz=" + f.hasDz + " raw=" + f.hasRaw);
    for (const k of f.kids) console.log("   " + k.c + " t" + k.t + " h" + k.h + " [" + k.d + "]");
  }
  await browser.close();
})();
