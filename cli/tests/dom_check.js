const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 9875;
const PAGES = ['index.html', '404.html'];

const KEY_ELEMENTS = {
  'index.html': ['#sidebar', 'nav', 'footer', '[data-i18n]'],
  '404.html': ['main'],
};

let issues = [];

function report(category, severity, msg, file) {
  issues.push({ category, severity, msg, file });
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const decodedUrl = decodeURIComponent(req.url);
      let filePath = path.join(ROOT, decodedUrl === '/' ? '/index.html' : decodedUrl);
      filePath = path.normalize(filePath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      const mime = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json',
        '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
      };
      const contentType = mime[path.extname(filePath)] || 'application/octet-stream';
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
    server.on('error', (e) => { console.error('Server error:', e.message); process.exit(1); });
    server.listen(PORT, () => resolve(server));
  });
}

async function checkLinks(page, baseUrl, seenAnchors) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map(a => ({
      href: a.getAttribute('href'),
      text: a.textContent.trim().slice(0, 60),
    }))
  );
  const anchorWarned = new Set();
  for (const link of links) {
    const href = link.href;
    if (!href || href === '#' || href.startsWith('?') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('http')) continue;
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (!id) continue;
      if (seenAnchors && !seenAnchors.has(id)) continue;
      if (anchorWarned.has(id)) continue;
      const exists = await page.evaluate((id) => !!document.getElementById(id), id);
      if (!exists) {
        report('Broken Link', 'warning', `Anchor #${id} not found on page`, baseUrl);
        anchorWarned.add(id);
      }
    } else {
      const normalized = href.replace(/^\/RedoSan-Authenticity\//, '/');
      const url = new URL(normalized, `http://localhost:${PORT}/`);
      try {
        const resp = await page.request.get(url.toString());
        if (resp.status() >= 400) {
          report('Broken Link', 'error', `HTTP ${resp.status()} for "${link.text}" (${href})`, baseUrl);
        }
      } catch {
        report('Broken Link', 'error', `Failed to fetch "${link.text}" (${href})`, baseUrl);
      }
    }
  }
}

async function checkAxe(page, url) {
  try {
    const AxeBuilder = require('@axe-core/playwright').default;
    const results = await new AxeBuilder({ page }).analyze();
    const grouped = {};
    for (const violation of results.violations) {
      const key = violation.id;
      if (!grouped[key]) {
        grouped[key] = {
          impact: violation.impact,
          help: violation.help,
          count: 0,
          examples: [],
        };
      }
      grouped[key].count += violation.nodes.length;
      for (const node of violation.nodes) {
        if (grouped[key].examples.length < 3) {
          grouped[key].examples.push(node.target.join(', '));
        }
      }
    }
    for (const [, g] of Object.entries(grouped)) {
      const sev = (g.impact === 'critical' || g.impact === 'serious') ? 'error' : 'warning';
      let msg = `${g.help} (${g.count} element${g.count > 1 ? 's' : ''})`;
      if (g.examples.length > 0) msg += ` — e.g. ${g.examples.join(', ')}`;
      report('Accessibility', sev, msg, url);
    }
    return results.violations.length;
  } catch (e) {
    report('Accessibility', 'warning', `axe-core skipped: ${e.message}`, url);
    return 0;
  }
}

async function checkPage(browser, pageName) {
  const url = `http://localhost:${PORT}/${pageName}`;
  console.log(`\n📄 Checking ${pageName}...`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => { consoleErrors.push(err.message); });

  await page.route('**/*', async (route) => {
    const reqUrl = route.request().url();
    if (!reqUrl.startsWith('http://localhost') && !reqUrl.startsWith('data:') && !reqUrl.startsWith('blob:')) {
      await route.abort().catch(() => {});
      return;
    }
    await route.continue().catch(() => {});
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    report('Page Load', 'error', `Failed to load: ${e.message}`, pageName);
    await context.close();
    return;
  }
  await page.waitForTimeout(1000);

  const filteredErrors = consoleErrors.filter(e =>
    !e.includes('frame-ancestors') &&
    !e.includes('net::ERR_FAILED') &&
    !e.includes('Failed to load resource') &&
    !e.includes('Language file not found') &&
    !e.includes('A bad HTTP response code (404) was received when fetching the script')
  );
  if (filteredErrors.length > 0) {
    for (const err of filteredErrors.slice(0, 5)) {
      report('Console Error', 'error', err.slice(0, 200), pageName);
    }
    if (filteredErrors.length > 5) {
      report('Console Error', 'warning', `... and ${filteredErrors.length - 5} more`, pageName);
    }
  } else {
    console.log('  ✅ No console errors');
  }

  const title = await page.title();
  console.log(`  Title: ${title}`);

  const elements = KEY_ELEMENTS[pageName] || [];
  for (const sel of elements) {
    if ((await page.locator(sel).count()) === 0) {
      report('DOM', 'warning', `Missing element: ${sel}`, pageName);
    }
  }

  const knownAnchorIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[id]')).map(el => el.id)
  );
  const seenAnchors = new Set(knownAnchorIds);

  const violCount = await checkAxe(page, pageName);
  if (violCount === 0) console.log('  ✅ No accessibility violations');

  await checkLinks(page, pageName, seenAnchors);
  await context.close();
}

function generateMarkdown() {
  let md = '## 🏗️ DOM Review\n\n';
  if (issues.length === 0) {
    md += '✅ No issues found across all pages.\n';
    return md;
  }
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  md += `| Severity | Count |\n| --- | --- |\n`;
  md += `| 🚫 Error | ${errors.length} |\n`;
  md += `| ⚠️ Warning | ${warnings.length} |\n\n`;

  const byPage = {};
  for (const issue of issues) {
    const key = issue.file || '_general';
    if (!byPage[key]) byPage[key] = [];
    byPage[key].push(issue);
  }
  for (const [page, pageIssues] of Object.entries(byPage)) {
    md += `### ${page}\n\n`;
    md += '| Severity | Category | Message |\n| --- | --- | --- |\n';
    for (const issue of pageIssues) {
      const icon = issue.severity === 'error' ? '🚫' : '⚠️';
      md += `| ${icon} ${issue.severity} | ${issue.category} | ${issue.msg} |\n`;
    }
    md += '\n';
  }
  return md;
}

async function postToPR(md) {
  const num = process.env.PR_NUMBER;
  if (!num) {
    console.log('\n📝 Report (not posted to PR):\n');
    console.log(md);
    return;
  }
  try {
    execSync(`gh pr comment ${num} --body ${JSON.stringify(md)}`, {
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
    });
    console.log(`✅ Posted DOM Review to PR #${num}`);
  } catch (e) {
    console.error(`Failed to post comment: ${e.message}`);
  }
}

async function main() {
  console.log('🚀 DOM Review Bot\n');
  console.log(`Root: ${ROOT}`);
  console.log(`Pages: ${PAGES.join(', ')}`);

  const server = await startServer();
  console.log(`🌐 Server at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  for (const page of PAGES) await checkPage(browser, page);

  await browser.close();
  server.close();

  if (issues.length > 0) {
    console.log(`\n📊 Summary: ${issues.filter(i => i.severity === 'error').length} errors, ${issues.filter(i => i.severity === 'warning').length} warnings`);
  } else {
    console.log('\n✅ All clean!');
  }

  await postToPR(generateMarkdown());
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });