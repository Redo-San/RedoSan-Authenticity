import { defineConfig } from "wxt";

// v1 scope (plan B1+B2): inspection only. Nothing is registered on page load,
// there are no host permissions, and `activeTab` is granted only by the popup
// or a context-menu click. MV3 additionally needs `scripting` to inject the
// inspector bundle into the clicked frame; the Firefox MV2 build uses
// `tabs.executeScript` instead, so the permission stays out of that manifest.
const BASE_PERMISSIONS = ["contextMenus", "activeTab", "storage"];

export default defineConfig({
  manifest: ({ browser }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    permissions:
      browser === "firefox"
        ? BASE_PERMISSIONS
        : [...BASE_PERMISSIONS, "scripting"],
    host_permissions: [],
    action: { default_title: "__MSG_actionTitle__" },
    // Firefox needs a stable add-on ID before the store will sign a build.
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "inspector@redo-san.github.io",
          strict_min_version: "115.0",
        },
      },
    }),
  }),
  // The fingerprint implementations are shared with the site and live outside
  // extension/ (repo root Fingerprint/). Vite's dev server refuses to serve
  // files above its root by default; allow the repo root for `wxt dev`.
  vite: () => ({
    server: {
      fs: {
        allow: [".."],
      },
    },
  }),
  // AMO reviews a sources zip that must rebuild the published bundle. The WXT
  // default only archives this project root, which would omit the two shared
  // Fingerprint scripts and make the archive impossible to rebuild, so archive
  // from the repository root with an explicit allowlist instead.
  zip: {
    sourcesRoot: "..",
    includeSources: [
      "extension/**/*",
      "Fingerprint/hashing.js",
      "Fingerprint/hashing_perceptual.js",
      "LICENSE",
    ],
    excludeSources: [
      "extension/.output/**",
      "extension/.wxt/**",
      "extension/node_modules/**",
      "extension/tests/**",
    ],
  },
});
