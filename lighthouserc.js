module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:8080/",
        "http://127.0.0.1:8080/watermark/index.html",
        "http://127.0.0.1:8080/fingerprint/index.html",
        "http://127.0.0.1:8080/pixel-injection/index.html",
        "http://127.0.0.1:8080/c2pa/index.html",
        "http://127.0.0.1:8080/certificate/index.html",
      ],
      numberOfRuns: 2,
      settings: {
        chromeFlags: "--no-sandbox",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.7 }],
        "categories:best-practices": ["warn", { minScore: 0.7 }],
        "categories:seo": ["warn", { minScore: 0.7 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
