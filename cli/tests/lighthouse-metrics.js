const fs = require('fs');
const r = JSON.parse(fs.readFileSync('.lighthouseci/direct-report.json', 'utf8'));

console.log('=== CATEGORY SCORES ===');
for (const [key, cat] of Object.entries(r.categories)) {
  console.log(`  ${key}: ${cat.score}`);
}

// Check i18n for metric values
console.log('\n=== RAW AUDIT DATA (via i18n) ===');
if (r.i18n && r.i18n.rendererStrings) {
  for (const [key, val] of Object.entries(r.i18n.rendererStrings)) {
    if (typeof val === 'string' && (val.includes('s') || val.includes('ms'))) {
      console.log(`  ${key}: ${val}`);
    }
  }
}

// Try to extract metrics from the categories' auditRefs
console.log('\n=== PERFORMANCE METRIC REFS ===');
const perfRefs = r.categories.performance.auditRefs.filter(a => a.group === 'metrics');
for (const ref of perfRefs) {
  console.log(`  ${ref.id} (weight ${ref.weight}): ${ref.acronym || ''}`);
}

// Check config settings
console.log('\n=== CONFIG SETTINGS ===');
console.log(`  formFactor: ${r.configSettings.formFactor}`);
console.log(`  throttling: ${JSON.stringify(r.configSettings.throttling)}`);
console.log(`  screenEmulation: ${JSON.stringify(r.configSettings.screenEmulation)}`);
