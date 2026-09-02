const fs = require('fs');
const file = process.argv[2] || '.lighthouseci/direct-report.json';
const raw = fs.readFileSync(file, 'utf8');

// Find audits by parsing from the raw string
const auditsIdx = raw.indexOf('"audits"');
if (auditsIdx === -1) {
  console.error('No audits found');
  process.exit(1);
}

// The JSON should parse fine - try a different approach
const report = JSON.parse(raw);

// Check categories
console.log('\n=== CATEGORY SCORES ===');
for (const [key, cat] of Object.entries(report.categories)) {
  console.log(`${key}: ${cat.score}`);
}

// The audits might be in a different structure in Lighthouse 13
// Let's check the category auditRefs and find the actual values
console.log('\n=== PERFORMANCE METRICS ===');
const perfCat = report.categories.performance;
if (perfCat && perfCat.auditRefs) {
  for (const ref of perfCat.auditRefs) {
    if (ref.group === 'metrics') {
      // Try to find the audit in the audits
      const audit = report.audios?.[ref.id];
      if (audit) {
        console.log(`${ref.id}: score=${audit.score} ${audit.displayValue || ''}`);
      }
    }
  }
}

// Check failing audits (score < 1 and not null)
console.log('\n=== FAILING AUDITS (score < 1) ===');
if (report.audios) {
  for (const [id, audit] of Object.entries(report.audios)) {
    if (audit.score !== null && audit.score !== undefined && audit.score < 1) {
      console.log(`${id}: score=${audit.score} - ${audit.title}`);
      if (audit.description) {
        console.log(`  desc: ${audit.description.substring(0, 200)}`);
      }
    }
  }
}
