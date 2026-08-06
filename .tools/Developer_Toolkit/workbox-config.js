module.exports = {
  globDirectory: ".",
  globPatterns: [
    "Style/**/*.{js,css,yml}",
    "vendor/**/*.js",
    "index.html",
    "404.html",
    "sw.js",
  ],
  globIgnores: ["Style/lang/i18n-data.js", "Style/pages/"],
  swDest: "sw-precache.js",
  inlineWorkboxRuntime: true,
  sourcemap: false,
};
