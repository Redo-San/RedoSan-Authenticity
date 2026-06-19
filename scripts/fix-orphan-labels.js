#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SKIP_DIRS = ['node_modules', 'vendor', '.git', 'cli'];
var FIXED_FILES = [];

function shouldProcess(filePath) {
  var rel = path.relative(ROOT, filePath);
  for (var i = 0; i < SKIP_DIRS.length; i++) {
    if (rel.startsWith(SKIP_DIRS[i])) return false;
  }
  return /\.(html|js)$/i.test(filePath);
}

function findOrphanLabels(content) {
  var orphans = [];
  var re = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  var m;
  while ((m = re.exec(content)) !== null) {
    var attrs = m[1];
    var inner = m[2];
    var hasFor = /for\s*=\s*["']([^"']*)["']/i.test(attrs);
    var wrapsControl = /<(?:input|select|textarea)\b/i.test(inner);
    if (!hasFor && !wrapsControl) {
      orphans.push({ full: m[0], attrs: attrs, inner: inner, start: m.index, end: re.lastIndex });
    }
  }
  return orphans;
}

function findNextInputId(content, fromIndex) {
  var re = /<(?:input|select|textarea)\b[^>]*?\s+id\s*=\s*["']([^"']*)["']/gi;
  re.lastIndex = fromIndex;
  var m = re.exec(content);
  return m ? m[1] : null;
}

function fixOrphans(content, filePath) {
  var orphans = findOrphanLabels(content);
  if (orphans.length === 0) return content;

  var fixed = false;
  for (var i = orphans.length - 1; i >= 0; i--) {
    var o = orphans[i];
    var nextId = findNextInputId(content, o.end);
    if (nextId) {
      var newLabel = '<label for="' + nextId + '"' + o.attrs + '>' + o.inner + '</label>';
      content = content.substring(0, o.start) + newLabel + content.substring(o.end);
      fixed = true;
      console.log('  Fixed: label → for="' + nextId + '" at offset ' + o.start);
    }
  }
  if (fixed) FIXED_FILES.push(filePath);
  return content;
}

function walkDir(dir) {
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.name.startsWith('.')) continue;
    var full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full);
    } else if (e.isFile() && shouldProcess(full)) {
      var content = fs.readFileSync(full, 'utf-8');
      var fixed = fixOrphans(content, full);
      if (fixed !== content) {
        fs.writeFileSync(full, fixed, 'utf-8');
        console.log('Updated: ' + path.relative(ROOT, full));
      }
    }
  }
}

console.log('Scanning for orphan labels...');
walkDir(ROOT);
if (FIXED_FILES.length === 0) {
  console.log('No orphan labels found.');
} else {
  console.log('\nFixed ' + FIXED_FILES.length + ' file(s):');
  FIXED_FILES.forEach(function(f) { console.log('  ' + path.relative(ROOT, f)); });
}
