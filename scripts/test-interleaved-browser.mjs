// Browser integration & UI verification for Diverse / Interleaved Groups
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'shots', 'interleaved');
const port = 4179;
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await fs.mkdir(shotsDir, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

// 1. Start ephemeral preview server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/src/index.html';
    const file = path.join(root, path.normalize(pathname).replace(/^([/\\])+/, ''));
    if (!file.startsWith(root)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
console.log(`Ephemeral preview server running on http://127.0.0.1:${port}`);

try {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const problems = [];
  page.on('pageerror', (err) => problems.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`CONSOLE: ${msg.text()}`);
  });

  console.log('\n--- Navigating to Home ---');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, '01-home.png') });
  console.log('✓ Home screen rendered and captured');

  console.log('\n--- Navigating to Level A1 ---');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/level/A1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Check hero text
  const heroText = await page.locator('.level-hero h2').textContent();
  console.log(`Hero text: "${heroText.trim()}"`);
  if (!heroText.includes('25 مجموعة منوعة')) {
    throw new Error(`Expected hero text to contain "25 مجموعة منوعة", got: "${heroText}"`);
  }

  // Check first group card
  const firstCardTitle = await page.locator('.group-card-header .group-title').first().textContent();
  console.log(`First group card title: "${firstCardTitle.trim()}"`);
  if (!firstCardTitle.includes('المجموعة 1')) {
    throw new Error(`Expected first group card to be "المجموعة 1", got: "${firstCardTitle}"`);
  }

  const badgeText = await page.locator('.group-card-header .chip-blue').first().textContent();
  console.log(`First group badge: "${badgeText.trim()}"`);

  await page.screenshot({ path: path.join(shotsDir, '02-level-a1-groups.png') });
  console.log('✓ Level A1 groups rendered and captured');

  // Expand group 1
  console.log('\n--- Expanding Group 1 ---');
  await page.locator('.group-toggle-btn').first().click();
  await page.waitForTimeout(400);

  const chunkRows = await page.locator('.group-chunks-wrap .chunk-row').count();
  console.log(`Group 1 rendered ${chunkRows} chunk rows`);
  if (chunkRows !== 8) {
    throw new Error(`Expected 8 chunks in Group 1, found ${chunkRows}`);
  }

  await page.screenshot({ path: path.join(shotsDir, '03-group-1-expanded.png') });
  console.log('✓ Group 1 expanded chunk list captured');

  // Click start training group 1
  console.log('\n--- Starting Group 1 Practice ---');
  await page.locator('.group-start-btn').first().click();
  await page.waitForTimeout(600);

  const practiceMeta = await page.locator('.practice-meta').textContent();
  console.log(`Practice meta header: "${practiceMeta.replace(/\s+/g, ' ').trim()}"`);
  if (!practiceMeta.includes('المجموعة 1')) {
    throw new Error(`Expected practice header to reference "المجموعة 1"`);
  }

  // Check template chip in practice view
  const refTpl = await page.locator('.chunk-tags .chip-blue, .ref-card .chip-blue').first().textContent();
  console.log(`Sentence pattern chip in practice view: "${refTpl.trim()}"`);

  await page.screenshot({ path: path.join(shotsDir, '04-practice-in-group.png') });
  console.log('✓ Practice view inside mixed group captured');

  // Test navigate to Step 5 (Group finale)
  console.log('\n--- Checking Step 5 (Group Finale) with Inspiration Chips ---');
  const lastChunkBtn = await page.locator('.chunk-nav-seq a').last();
  // Jump to step 5 directly
  const currUrl = page.url();
  const step5Url = currUrl.replace(/step=\d+/, 'step=5');
  await page.goto(step5Url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const inspirationCount = await page.locator('.group-tpl-inspiration button').count();
  console.log(`Step 5 rendered ${inspirationCount} inspiration template pills`);
  if (inspirationCount === 0) {
    throw new Error(`Expected inspiration template pills in Step 5 finale`);
  }

  await page.screenshot({ path: path.join(shotsDir, '05-step-5-group-finale.png') });
  console.log('✓ Step 5 finale with inspiration pills captured');

  await browser.close();

  if (problems.length > 0) {
    console.error('\nConsole or Page Errors encountered during test:');
    problems.forEach((p) => console.error(' ', p));
    throw new Error('Browser test encountered errors');
  }

  console.log('\n>>> BROWSER RUNTIME VERIFICATION COMPLETED WITH 100% SUCCESS! <<<');
} finally {
  server.close();
}
