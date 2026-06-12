'use strict';
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.resolve(__dirname, '../Style_Web_Page/pages');
// All 20 page directories
const PAGES = [
  'home', 'watermark', 'audio-watermark', 'fingerprint', 'search',
  'pixel-injection', 'metadata', 'timestamp', 'did', 'c2pa',
  'certificate', 'forensic', 'converter', 'removal-tools', 'id_forge',
  'document-watermark', 'about', 'privacy', 'contact', 'social',
];

const MODE_SELECT_START = '    <!-- Mode Selection Overlay -->\n    <div\n      id="modeSelect"\n';
const MODE_SELECT_END = '    </div>\n\n    <!-- Navigation bar -->';

// New init script that shows app directly (no modeSelect/simplified)
const NEW_INIT_SCRIPT = `    <script>
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(function () {
          document.documentElement.style.overflow = "";
        }, 0);
        document.documentElement.dataset.standalone = "{PAGE_ID}";
        var app = document.getElementById("app");
        if (app) app.style.display = "";
        if (typeof showPage === "function") {
          showPage("{PAGE_ID}");
        }
      });
    </script>`;

let fixed = 0;

for (const pageId of PAGES) {
  const filePath = path.join(PAGES_DIR, pageId, 'index.html');
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP ${pageId}: file not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changed = false;

  // 1. Remove Mode Selection Overlay
  const msStart = content.indexOf(MODE_SELECT_START);
  if (msStart !== -1) {
    const msEnd = content.indexOf(MODE_SELECT_END, msStart);
    if (msEnd !== -1) {
      content = content.slice(0, msStart) + content.slice(msEnd + MODE_SELECT_END.length);
      changed = true;
      console.log(`  Removed modeSelect from ${pageId}`);
    } else {
      console.log(`  WARN ${pageId}: found modeSelect start but no end marker`);
    }
  } else {
    // Try alternative: modeSelect might not have the exact same whitespace
    // Fall back to removing the div with id="modeSelect" up to <!-- Navigation bar -->
    const altStart = content.indexOf('<!-- Mode Selection Overlay -->');
    if (altStart !== -1) {
      const navStart = content.indexOf('<!-- Navigation bar -->', altStart);
      if (navStart !== -1) {
        content = content.slice(0, altStart) + content.slice(navStart);
        changed = true;
        console.log(`  Removed modeSelect (alt) from ${pageId}`);
      }
    }
  }

  // 2. Replace inline init script
  const scriptPattern = `document.addEventListener("DOMContentLoaded", function () {`;
  const scriptIdx = content.lastIndexOf(scriptPattern);
  if (scriptIdx !== -1) {
    // Find the end of this script block
    const scriptEnd = content.indexOf('</script>', scriptIdx);
    if (scriptEnd !== -1) {
      const oldScript = content.slice(scriptIdx, scriptEnd + 9); // +9 for </script>
      const newScript = NEW_INIT_SCRIPT.replace(/\{PAGE_ID\}/g, pageId);
      content = content.replace(oldScript, newScript);
      changed = true;
      console.log(`  Updated init script for ${pageId}`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixed++;
  } else {
    console.log(`  No changes for ${pageId}`);
  }
}

console.log(`\nFixed ${fixed} / ${PAGES.length} pages`);
