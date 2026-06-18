import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import security from "eslint-plugin-security";
import jsdoc from "eslint-plugin-jsdoc";
import i18n from "eslint-plugin-i18n";
import unicorn from "eslint-plugin-unicorn";
import importX from "eslint-plugin-import-x";
import promise from "eslint-plugin-promise";
import compat from "eslint-plugin-compat";

export default [
  js.configs.recommended,
  unicorn.configs.recommended,
  promise.configs["flat/recommended"],
  {
    plugins: {
      sonarjs,
      security,
      jsdoc,
      i18n,
      "import-x": importX,
      compat,
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      ...security.configs.recommended.rules,
      ...jsdoc.configs["flat/recommended"].rules,
      ...i18n.configs.recommended.rules,
      ...importX.configs.recommended.rules,
      ...compat.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "warn",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-await-expression-member": "off",
      "unicorn/no-useless-undefined": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-static-only-class": "off",
      "unicorn/prefer-string-slice": "off",
      "import-x/no-unresolved": "warn",
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",
      "import-x/namespace": "off",
    },
    settings: {
      "import-x/resolver": {
        node: true,
      },
    },
  },
  {
    files: ["cli/**", "scripts/**"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
  {
    files: ["Style/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.serviceworker,
        ...globals.es2022,
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
      "cli/tests/",
      "cli/lib/",
    ],
  },
];
