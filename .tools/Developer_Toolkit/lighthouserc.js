module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:8080/",
        "http://127.0.0.1:8080/watermark/index.html",
        "http://127.0.0.1:8080/audio-watermark/index.html",
        "http://127.0.0.1:8080/fingerprint/index.html",
        "http://127.0.0.1:8080/search/index.html",
        "http://127.0.0.1:8080/pixel-injection/index.html",
        "http://127.0.0.1:8080/metadata/index.html",
        "http://127.0.0.1:8080/timestamp/index.html",
        "http://127.0.0.1:8080/did/index.html",
        "http://127.0.0.1:8080/c2pa/index.html",
        "http://127.0.0.1:8080/certificate/index.html",
        "http://127.0.0.1:8080/forensic/index.html",
        "http://127.0.0.1:8080/converter/index.html",
        "http://127.0.0.1:8080/removal-tools/index.html",
        "http://127.0.0.1:8080/id_forge/index.html",
        "http://127.0.0.1:8080/document-watermark/index.html",
        "http://127.0.0.1:8080/about/index.html",
        "http://127.0.0.1:8080/privacy/index.html",
        "http://127.0.0.1:8080/contact/index.html",
        "http://127.0.0.1:8080/social/index.html",
      ],
      numberOfRuns: 2,
      settings: {
        chromeFlags: "--no-sandbox",
        headless: true,
      },
      lighthouseVersion: "local",
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
      target: "filesystem",
      outputDir: ".lighthouseci",
      reportFilenamePattern: "%%HOSTNAME%%-%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
    server: {
      command: "node dev-server.js",
      port: 8080,
    },
  },
};
