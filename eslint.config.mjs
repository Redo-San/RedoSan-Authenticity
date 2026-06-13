import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.es2022,
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "warn",
    },
  },
  {
    files: ["cli/**", "scripts/**"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    ignores: [
      "node_modules/",
      "vendor/",
      "**/*.min.js",
      "C2PA/",
      "Pixel_Injection/watermark_core_advanced.js",
      "Style/lang/i18n-data.js",
    ],
  },
];
