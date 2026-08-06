'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [path.join(root, 'index.html')];
for (const p of fs.readdirSync(path.join(root, 'Style', 'pages'))) {
  const f = path.join(root, 'Style', 'pages', p, 'index.html');
  if (fs.existsSync(f)) files.push(f);
}

const OLD = [
  "        if (lang !== 'en') {",
  "          window.__I18N_EARLY = true;",
  "          document.write('<script src=\"' + base + 'lang/i18n-data-' + lang + '.js\"><\\/script>');",
  "          document.write('<script src=\"' + base + 'i18n.js\"><\\/script>');",
  '        }',
].join('\n');

const NEW = [
  '        window.__I18N_EARLY = true;',
  "        if (lang !== 'en') {",
  "          document.write('<script src=\"' + base + 'lang/i18n-data-' + lang + '.js\"><\\/script>');",
  '        } else {',
  '          if (window.__I18N_DATA === undefined) window.__I18N_DATA = {};',
  '          window.__I18N_DATA.en = window.__I18N_DATA.en || {};',
  '        }',
  "        document.write('<script src=\"' + base + 'i18n.js\"><\\/script>');",
].join('\n');

let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes(OLD)) {
    console.log('SKIP (block not found): ' + path.relative(root, f));
    continue;
  }
  if (src.includes(NEW)) {
    console.log('SKIP (already patched): ' + path.relative(root, f));
    continue;
  }
  const count = src.split(OLD).length - 1;
  fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
  changed += count;
  console.log('PATCHED (' + count + '): ' + path.relative(root, f));
}
console.log('changed=' + changed + ' of ' + files.length);
