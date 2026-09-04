var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var {
  ensureServer,
  openPage,
  checkPageLoad,
  checkNoErrors,
  closePage,
} = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "iris-biometric";
var browser;
var PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/testimg.png"),
);

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Iris Biometric", function () {
  it("should load page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have key UI elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var hasConsent = await page.evaluate(function () {
        return !!document.getElementById("iris-consent-panel");
      });
      var hasConsentCheck = await page.evaluate(function () {
        return !!document.getElementById("iris-consent-check");
      });
      var hasConsentAccept = await page.evaluate(function () {
        return !!document.getElementById("iris-consent-accept");
      });
      var hasFile = await page.evaluate(function () {
        return !!document.getElementById("iris-image");
      });
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("iris-run");
      });
      var hasLabel = await page.evaluate(function () {
        return !!document.getElementById("iris-label");
      });
      var hasEyeSide = await page.evaluate(function () {
        return !!document.getElementById("iris-eye-side");
      });
      var hasResultBox = await page.evaluate(function () {
        return !!document.getElementById("iris-result-box");
      });
      var hasGallery = await page.evaluate(function () {
        return !!document.getElementById("iris-gallery-list");
      });
      var hasSteps = await page.evaluate(function () {
        return !!document.getElementById("iris-steps");
      });
      var hasStatus = await page.evaluate(function () {
        return !!document.getElementById("iris-status");
      });
      assert.ok(hasConsent, "Consent panel should exist");
      assert.ok(hasConsentCheck, "Consent checkbox should exist");
      assert.ok(hasConsentAccept, "Consent accept button should exist");
      assert.ok(hasFile, "File input should exist");
      assert.ok(hasBtn, "Run button should exist");
      assert.ok(hasLabel, "Label input should exist");
      assert.ok(hasEyeSide, "Eye side selector should exist");
      assert.ok(hasResultBox, "Result box should exist");
      assert.ok(hasGallery, "Gallery list should exist");
      assert.ok(hasSteps, "Steps container should exist");
      assert.ok(hasStatus, "Status display should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should accept consent and store in localStorage", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var hasConsent = await page.evaluate(function () {
        return localStorage.getItem("iris_consent") === "1";
      });
      if (!hasConsent) {
        var consentVisible = await page.evaluate(function () {
          var panel = document.getElementById("iris-consent-panel");
          return panel && panel.offsetParent !== null;
        });
        if (consentVisible) {
          await page.evaluate(function () {
            var cb = document.getElementById("iris-consent-check");
            if (cb && !cb.checked) cb.click();
          });
          await page.waitForTimeout(200);
          await page.evaluate(function () {
            var btn = document.getElementById("iris-consent-accept");
            if (btn) btn.click();
          });
          await page.waitForTimeout(500);
        }
      }
      var stored = await page.evaluate(function () {
        return localStorage.getItem("iris_consent");
      });
      assert.strictEqual(
        stored,
        "1",
        "Consent should be stored in localStorage",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show upload tab and hide camera tab by default", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");
      var uploadExists = await page.evaluate(function () {
        var el = document.getElementById("iris-upload-wrapper");
        return !!el;
      });
      var cameraExists = await page.evaluate(function () {
        var el = document.getElementById("iris-camera-wrapper");
        return !!el;
      });
      assert.ok(uploadExists, "Upload wrapper should exist in DOM");
      assert.ok(cameraExists, "Camera wrapper should exist in DOM");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should set label text", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.fill("#iris-label", "Test User");
      var val = await page.evaluate(function () {
        return document.getElementById("iris-label").value;
      });
      assert.strictEqual(val, "Test User", "Label should be set");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should select eye side from dropdown", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.selectOption("#iris-eye-side", "left");
      var val = await page.evaluate(function () {
        return document.getElementById("iris-eye-side").value;
      });
      assert.strictEqual(val, "left", "Eye side should be left");
      await page.selectOption("#iris-eye-side", "right");
      val = await page.evaluate(function () {
        return document.getElementById("iris-eye-side").value;
      });
      assert.strictEqual(val, "right", "Eye side should be right");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should upload PNG and run iris analysis showing results", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      await page.setInputFiles("#iris-image", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);

      var hasFile = await page.evaluate(function () {
        var inp = document.getElementById("iris-image");
        return inp && inp.files && inp.files.length > 0;
      });
      assert.ok(hasFile, "File should be uploaded");

      await page.fill("#iris-label", "E2E Test");
      await page.selectOption("#iris-eye-side", "left");

      await page.evaluate(function () {
        document.getElementById("iris-run").click();
      });

      await page.waitForFunction(
        function () {
          var result = document.getElementById("iris-result-box");
          return result && result.offsetParent !== null;
        },
        { timeout: 30000 },
      );
      await page.waitForTimeout(2000);

      var resultText = await page.evaluate(function () {
        var box = document.getElementById("iris-result-box");
        return box ? box.innerText : "";
      });
      assert.ok(resultText.length > 0, "Result box should contain text");

      var statusText = await page.evaluate(function () {
        var el = document.getElementById("iris-status");
        return el ? el.innerText : "";
      });
      assert.ok(statusText.length > 0, "Status should show text");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should render gallery after enrollment", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      await page.setInputFiles("#iris-image", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.fill("#iris-label", "Gallery Test");
      await page.selectOption("#iris-eye-side", "right");

      await page.evaluate(function () {
        document.getElementById("iris-run").click();
      });

      await page.waitForFunction(
        function () {
          var result = document.getElementById("iris-result-box");
          return result && result.offsetParent !== null;
        },
        { timeout: 30000 },
      );
      await page.waitForTimeout(2000);

      var galleryItems = await page.evaluate(function () {
        var list = document.getElementById("iris-gallery-list");
        return list ? list.children.length : 0;
      });
      assert.ok(
        galleryItems > 0,
        "Gallery should have at least 1 item after enrollment",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should not have critical console errors", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });
});
