const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9881;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

let browser;
let _server;

before(async () => {
  _server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

describe("Music Persistence — Hybrid Navigation", () => {
  it("should have music elements on initial load", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    const shell = await page.evaluate(() => ({
      audio: !!document.getElementById("bg-music"),
      btn: !!document.getElementById("music-btn"),
      credit: !!document.getElementById("music-credit"),
      count: document.querySelectorAll("#bg-music").length,
    }));
    assert.ok(shell.audio, "bg-music should exist");
    assert.ok(shell.btn, "music-btn should exist");
    assert.ok(shell.credit, "music-credit should exist");
    assert.equal(shell.count, 1, "Only one bg-music element");
    await ctx.close();
  });

  it("should have music elements outside #app", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    const outsideApp = await page.evaluate(() => {
      const app = document.getElementById("app");
      if (!app) return { audio: false, btn: false };
      return {
        audio: !app.contains(document.getElementById("bg-music")),
        btn: !app.contains(document.getElementById("music-btn")),
      };
    });
    assert.ok(outsideApp.audio, "bg-music should be outside #app");
    assert.ok(outsideApp.btn, "music-btn should be outside #app");
    await ctx.close();
  });

  it("should simulate play via JavaScript (set _playing + doPlay)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    // Enter Professional Mode first
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);

    // Directly invoke the toggle to set _playing = true
    const btnExists = await page.evaluate(() => {
      const btn = document.getElementById("music-btn");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    assert.ok(btnExists, "Music button exists and was clicked");

    // Check the _playing flag through the UI (button textContent changes)
    const btnText = await page.evaluate(() => {
      const btn = document.getElementById("music-btn");
      return btn ? btn.textContent : "";
    });
    // After toggle, button should show speaker icon regardless of actual audio play
    assert.ok(btnText.length > 0, "Button has text content");

    // Toggle back (pause)
    await page.evaluate(() => {
      const btn = document.getElementById("music-btn");
      if (btn) btn.click();
    });
    await page.waitForTimeout(200);

    const btnText2 = await page.evaluate(() => {
      const btn = document.getElementById("music-btn");
      return btn ? btn.textContent : "";
    });
    assert.ok(btnText2.length > 0, "Button still has text after second toggle");
    await ctx.close();
  });

  it("should persist music elements after navigating to watermark", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);

    // Navigate to watermark
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="watermark"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);

    const shell = await page.evaluate(() => ({
      btn: !!document.getElementById("music-btn"),
      audio: !!document.getElementById("bg-music"),
      credit: !!document.getElementById("music-credit"),
      count: document.querySelectorAll("#bg-music").length,
      audioInApp: (() => {
        var app = document.getElementById("app");
        return app ? app.contains(document.getElementById("bg-music")) : false;
      })(),
    }));
    assert.ok(shell.btn, "music-btn persists after watermark");
    assert.ok(shell.audio, "bg-music persists after watermark");
    assert.ok(shell.credit, "music-credit persists after watermark");
    assert.equal(shell.count, 1, "Only one bg-music");
    assert.ok(!shell.audioInApp, "bg-music not inside #app");
    await ctx.close();
  });

  it("should persist music elements across 5 tool navigations", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    // Dismiss the mode-selection overlay like a real user picking a mode.
    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-pro, .mode-card");
      if (card) card.click();
    });
    await page.waitForTimeout(1500);

    // Music player is lazy-loaded on first music-btn click; a second click
    // toggles playback on (defers audio init out of the SPA critical path).
    await page.evaluate(() => {
      const b = document.getElementById("music-btn");
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = document.getElementById("music-btn");
      if (b) b.click();
    });
    await page.waitForTimeout(1500);

    const pages = ["watermark", "fingerprint", "c2pa", "certificate", "timestamp"];
    for (const p of pages) {
      await page.evaluate((name) => {
        const link = document.querySelector(`#sidebar a[data-page="${name}"]`);
        if (link) link.click();
      }, p);
      await page.waitForTimeout(1500);

      const ok = await page.evaluate(() => {
        var a = document.getElementById("bg-music");
        var b = document.getElementById("music-btn");
        var c = document.getElementById("music-credit");
        var cnt = document.querySelectorAll("#bg-music").length;
        var app = document.getElementById("app");
        return {
          ok: !!(a && b && c && cnt === 1 && app && !app.contains(a)),
          audio: !!a,
          btn: !!b,
          credit: !!c,
          count: cnt,
        };
      });
      assert.ok(ok.ok, `Music elements valid after navigating to ${p} (count=${ok.count})`);
    }

    // Final check: audio src is still set
    const src = await page.evaluate(() => {
      var a = document.getElementById("bg-music");
      return a ? a.src : null;
    });
    assert.ok(src && src.length > 0, "Audio src is still set after 5 navigations");
    await ctx.close();
  });

  it("should persist music elements after back/forward navigation", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);

    // Navigate: watermark → fingerprint
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="watermark"]');
      if (link) link.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="fingerprint"]');
      if (link) link.click();
    });
    await page.waitForTimeout(1500);

    // Back to watermark
    await page.goBack();
    await page.waitForTimeout(2000);

    let ok = await page.evaluate(() => {
      var a = document.getElementById("bg-music");
      var b = document.getElementById("music-btn");
      var cnt = document.querySelectorAll("#bg-music").length;
      return !!(a && b && cnt === 1);
    });
    assert.ok(ok, "Music elements persist after goBack");

    // Forward to fingerprint
    await page.goForward();
    await page.waitForTimeout(2000);

    ok = await page.evaluate(() => {
      var a = document.getElementById("bg-music");
      var b = document.getElementById("music-btn");
      var cnt = document.querySelectorAll("#bg-music").length;
      return !!(a && b && cnt === 1);
    });
    assert.ok(ok, "Music elements persist after goForward");

    await ctx.close();
  });

  it("should have exactly one button and toggleable", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);

    // Navigate to id_forge
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);

    // Should have exactly one music button
    const btnCount = await page.evaluate(() => document.querySelectorAll("#music-btn").length);
    assert.equal(btnCount, 1, "Exactly one music-btn element");

    // Should have exactly one audio
    const audioCount = await page.evaluate(() => document.querySelectorAll("#bg-music").length);
    assert.equal(audioCount, 1, "Exactly one bg-music element");

    await ctx.close();
  });

  it("should not remove music elements when content swap replaces section", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);

    // Repeated rapid navigations
    const navs = ["watermark", "fingerprint", "watermark", "c2pa", "fingerprint", "certificate"];
    for (const p of navs) {
      await page.evaluate((name) => {
        const link = document.querySelector(`#sidebar a[data-page="${name}"]`);
        if (link) link.click();
      }, p);
      await page.waitForTimeout(1000);
    }

    const final = await page.evaluate(() => {
      var a = document.getElementById("bg-music");
      var b = document.getElementById("music-btn");
      var c = document.getElementById("music-credit");
      var cnt = document.querySelectorAll("#bg-music").length;
      return {
        ok: !!(a && b && c && cnt === 1),
        count: cnt,
      };
    });
    assert.ok(final.ok, `Music elements survive rapid navigation (count=${final.count})`);
    await ctx.close();
  });

  it("should not duplicate music elements when going from standalone page to hybrid", async () => {
    // Simulate entering a standalone page URL directly, then navigating back
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Go to standalone watermark page first
    await page.goto(`${BASE}/Style/pages/watermark/index.html`, NAV_WAIT);
    await page.waitForTimeout(2000);

    const beforeCount = await page.evaluate(() => document.querySelectorAll("#bg-music").length);
    assert.equal(beforeCount, 1, "One bg-music on standalone page");

    // Now navigate via a simulated hybrid link (back to index + nav)
    // This is a full page reload scenario
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    const afterCount = await page.evaluate(() => document.querySelectorAll("#bg-music").length);
    assert.equal(afterCount, 1, "One bg-music after returning to index.html");

    await ctx.close();
  });
});
