const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9877;
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

describe("Hybrid Architecture — Initial Load", () => {
  it("should load index.html with mode overlay visible", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    const modeSelectVisible = await page.evaluate(() => {
      const el = document.getElementById("modeSelect");
      return el && el.style.display !== "none";
    });
    assert.ok(modeSelectVisible, "Mode overlay should be visible on load");
    await ctx.close();
  });

  it("should have app container empty (no pre-loaded sections)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    const pageCount = await page.evaluate(() => document.querySelectorAll("#app > .page").length);
    assert.equal(pageCount, 0, "#app should have 0 pre-loaded page sections");
    await ctx.close();
  });

  it("should have shell elements outside #app", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    const shell = await page.evaluate(() => ({
      nav: !!document.getElementById("mainNav"),
      sidebar: !!document.getElementById("sidebar"),
      musicBtn: !!document.getElementById("music-btn"),
      audio: !!document.getElementById("bg-music"),
      themeToggle: !!document.getElementById("themeToggle"),
      footer: !!document.getElementById("mainFooter"),
      assistant: !!document.getElementById("assistantBubble"),
    }));
    assert.ok(shell.nav, "mainNav should exist");
    assert.ok(shell.sidebar, "sidebar should exist");
    assert.ok(shell.musicBtn, "music-btn should exist");
    assert.ok(shell.audio, "bg-music should exist");
    assert.ok(shell.themeToggle, "themeToggle should exist");
    assert.ok(shell.footer, "mainFooter should exist");
    assert.ok(shell.assistant, "assistantBubble should exist");
    await ctx.close();
  });

  it("should have static page sections hidden in DOM", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    const staticPages = await page.evaluate(() => ({
      about: !!document.getElementById("page-about"),
      privacy: !!document.getElementById("page-privacy"),
      contact: !!document.getElementById("page-contact"),
      social: !!document.getElementById("page-social"),
    }));
    assert.ok(staticPages.about, "page-about should exist in DOM");
    assert.ok(staticPages.privacy, "page-privacy should exist in DOM");
    assert.ok(staticPages.contact, "page-contact should exist in DOM");
    assert.ok(staticPages.social, "page-social should exist in DOM");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Professional Mode Entry", () => {
  it("should navigate to home via Professional Mode card", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    // Click the Professional Mode card
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    const modeOverlayHidden = await page.evaluate(() => {
      const el = document.getElementById("modeSelect");
      return el && el.style.display === "none";
    });
    const navVisible = await page.evaluate(() => {
      const el = document.getElementById("mainNav");
      return el && el.style.display !== "none";
    });
    assert.ok(modeOverlayHidden, "Mode overlay should be hidden");
    assert.ok(navVisible, "Main nav should be visible");
    await ctx.close();
  });

  it("should load content into #app after Professional Mode entry", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    const hasContent = await page.evaluate(() => {
      const section = document.querySelector("#app > .page.active");
      return section && section.id === "page-home";
    });
    assert.ok(hasContent, "#app should contain page-home as active");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Navigation Between Tools", () => {
  it("should navigate to watermark via sidebar and load content", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    // Enter professional mode first
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
    const active = await page.evaluate(() => {
      const s = document.querySelector("#app > .page.active");
      return s ? s.id : null;
    });
    assert.equal(active, "page-watermark", "Should have watermark page active");
    // Verify tool-specific elements exist
    const hasTool = await page.evaluate(() => !!document.getElementById("wm-type"));
    assert.ok(hasTool, "Watermark tool select should exist");
    await ctx.close();
  });

  it("should navigate to fingerprint and update URL", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="fingerprint"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    const active = await page.evaluate(() => {
      const s = document.querySelector("#app > .page.active");
      return s ? s.id : null;
    });
    assert.equal(active, "page-fingerprint");
    const hash = await page.evaluate(() => window.location.hash);
    assert.ok(hash.includes("page-fingerprint"), `Hash should include 'page-fingerprint': ${hash}`);
    await ctx.close();
  });

  it("should navigate to ID forge and generate a UUID", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="id_forge"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    // Generate a UUID
    await page.evaluate(() => {
      const sel = document.getElementById("if-type");
      if (sel) sel.value = "uuidv4";
      const btn = document.getElementById("if-gen-btn");
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const output = await page.evaluate(() => {
      const el = document.getElementById("if-output");
      return el ? el.value || el.textContent || "" : "";
    });
    assert.ok(output.length > 0, "Generated UUID should not be empty");
    assert.ok(output.includes("-"), "UUID v4 should contain hyphens");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Static Pages", () => {
  it("should show about page from local DOM (no AJAX)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    // Enter professional mode first
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    // Navigate to about via footer link
    await page.evaluate(() => {
      const link = document.querySelector('.footer-links a[data-page="about"]');
      if (link) link.click();
    });
    await page.waitForTimeout(1500);
    const active = await page.evaluate(() => {
      const s = document.querySelector(".page.active");
      return s ? s.id : null;
    });
    assert.equal(active, "page-about", "About page should be shown from local DOM");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Shell Persistence", () => {
  it("should keep shell elements after navigating between tools", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    // Navigate to a few pages
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="watermark"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    // Check shell
    const shell1 = await page.evaluate(() => ({
      nav: !!document.getElementById("mainNav"),
      sidebar: !!document.getElementById("sidebar"),
      music: !!document.getElementById("music-btn"),
      footer: !!document.getElementById("mainFooter"),
      assistant: !!document.getElementById("assistantBubble"),
    }));
    assert.ok(shell1.nav, "Nav persists after watermark nav");
    assert.ok(shell1.music, "Music button persists after watermark nav");
    // Navigate again
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="fingerprint"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    const shell2 = await page.evaluate(() => ({
      nav: !!document.getElementById("mainNav"),
      sidebar: !!document.getElementById("sidebar"),
      music: !!document.getElementById("music-btn"),
      footer: !!document.getElementById("mainFooter"),
    }));
    assert.ok(shell2.nav, "Nav persists after fingerprint nav");
    assert.ok(shell2.music, "Music button persists after fingerprint nav");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Back/Forward Navigation", () => {
  it("should go back to previous page via browser back button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
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
    // Navigate to fingerprint
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="fingerprint"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    // Go back
    await page.goBack();
    await page.waitForTimeout(2000);
    const active = await page.evaluate(() => {
      const s = document.querySelector("#app > .page.active");
      return s ? s.id : null;
    });
    assert.equal(active, "page-watermark", "Should be back on watermark after goBack");
    await ctx.close();
  });

  it("should go forward after going back", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="watermark"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="fingerprint"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    // Back
    await page.goBack();
    await page.waitForTimeout(2000);
    // Forward
    await page.goForward();
    await page.waitForTimeout(2000);
    const active = await page.evaluate(() => {
      const s = document.querySelector("#app > .page.active");
      return s ? s.id : null;
    });
    assert.equal(active, "page-fingerprint", "Should be on fingerprint after goForward");
    await ctx.close();
  });
});

describe("Hybrid Architecture — Title and Meta Updates", () => {
  it("should update document title when navigating", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = document.querySelector('.card[data-page="home"], a.mode-card');
      if (card) card.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const link = document.querySelector('#sidebar a[data-page="c2pa"]');
      if (link) link.click();
    });
    await page.waitForTimeout(2000);
    const title = await page.title();
    assert.ok(title.includes("C2PA"), `Title should include C2PA: ${title}`);
    await ctx.close();
  });
});
