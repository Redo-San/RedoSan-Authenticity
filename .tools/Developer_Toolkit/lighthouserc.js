module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:8080/Style/pages/face-biometric/index.html",
      ],
      numberOfRuns: 1,
      headful: true,
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
      lighthouseVersion: "local",
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
      reportFilenamePattern:
        "%%HOSTNAME%%-%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
