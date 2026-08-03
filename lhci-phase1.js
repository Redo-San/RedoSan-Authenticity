module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:8080/watermark/index.html",
        "http://127.0.0.1:8080/certificate/index.html",
        "http://127.0.0.1:8080/timestamp/index.html",
      ],
      numberOfRuns: 1,
      settings: { chromeFlags: "--no-sandbox" },
    },
  },
};
