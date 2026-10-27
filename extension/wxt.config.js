import { defineConfig } from "wxt";

// v1 scope (plan B1): inspection only - no embedding, no content script on
// page load, no host permissions. `activeTab` grants access only after the
// user opens the popup or the context menu.
export default defineConfig({
  manifest: {
    name: "RedoSan Authenticity Inspector",
    description:
      "Client-side image inspection: cryptographic and perceptual fingerprints, C2PA presence check. No data leaves your browser.",
    permissions: ["contextMenus", "activeTab", "storage"],
    host_permissions: [],
  },
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
});
