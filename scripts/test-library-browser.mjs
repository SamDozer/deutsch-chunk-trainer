// Browser integration & UI verification for the Visual Knowledge Hub (المكتبة المصورة) & Level Visual Guides
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = 'C:\\Users\\Hossam\\.gemini\\antigravity\\brain\\19d44b9d-c661-4024-9358-7360d0655a60\\screenshots';
const port = 4185;
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await fs.mkdir(shotsDir, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

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
console.log(`Preview server running on http://127.0.0.1:${port}`);

try {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const problems = [];
  page.on('pageerror', (err) => problems.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`CONSOLE: ${msg.text()}`);
  });

  console.log('1. Navigating to #/library...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/library`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lib-card', { timeout: 10000 });
  await page.waitForTimeout(350);

  const countText = await page.locator('#lib-results-count').textContent();
  console.log(`Initial results badge: "${countText?.trim()}"`);
  assert.ok(countText?.includes('619'), `Expected 619 cards, got ${countText}`);

  // Test CEFR Level Filter chip inside Library Hub (e.g. A1 -> 51 cards)
  await page.locator('[data-level-filter="A1"]').click();
  await page.waitForTimeout(250);
  const a1Count = await page.locator('#lib-results-count').textContent();
  console.log(`A1 filter in library: "${a1Count?.trim()}"`);
  assert.ok(a1Count?.includes('51'), `Expected 51 A1 cards, got ${a1Count}`);

  await page.locator('[data-level-filter="all"]').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shotsDir, '01-library-desktop.png') });

  // 2. Test keyboard accessibility (Enter key on focused .lib-card-media opens lightbox)
  console.log('2. Testing Keyboard Enter on card media & layout-based zoom...');
  await page.locator('.lib-card-media').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lib-lightbox', { timeout: 5000 });
  await page.waitForTimeout(250);

  await page.locator('[data-lb-zoom="in"]').click();
  const zoomLabel = await page.locator('#lib-lb-zoom-label').textContent();
  assert.equal(zoomLabel?.trim(), '125%', 'Expected zoom level to be 125%');

  await page.locator('[data-lb-read]').click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // 3. Test Level Screen (#/level/A1 and #/level/B1) Visual Shelf & Visuals Tab
  console.log('3. Navigating to #/level/A1 to verify Level Visual Shelf & Tab...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/level/A1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.level-visual-shelf', { timeout: 5000 });
  await page.waitForTimeout(400);

  const shelfThumbs = await page.locator('.level-visual-thumb').count();
  assert.equal(shelfThumbs, 6, `Expected 6 preview thumbs in A1 visual shelf, got ${shelfThumbs}`);
  await page.screenshot({ path: path.join(shotsDir, '05-level-a1-visual-shelf.png') });
  console.log('✓ Captured 05-level-a1-visual-shelf.png');

  // Click "عرض كل اللوحات" button to switch to the full visuals tab inside #/level/A1
  await page.locator('[data-switch-visuals]').click();
  await page.waitForTimeout(350);
  const levelVisualCards = await page.locator('#chunk-list .lib-card').count();
  console.log(`Level A1 visuals tab rendered ${levelVisualCards} cards (page 1)`);
  assert.ok(levelVisualCards === 30, `Expected 30 cards on page 1 of A1 visuals tab, got ${levelVisualCards}`);
  await page.screenshot({ path: path.join(shotsDir, '06-level-a1-visuals-tab.png') });
  console.log('✓ Captured 06-level-a1-visuals-tab.png');

  // 4. Test Practice Screen (#/practice/A1-001?step=1) visual guide button
  console.log('4. Navigating to #/practice/A1-001?step=1 to verify Practice Visual Guide button...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/practice/A1-001?step=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-act="understand:visuals"]', { timeout: 5000 });
  await page.locator('[data-act="understand:visuals"]').click();
  await page.waitForSelector('.lib-lightbox', { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, '07-practice-visual-lightbox.png') });
  console.log('✓ Captured 07-practice-visual-lightbox.png');
  await page.keyboard.press('Escape');

  await browser.close();

  if (problems.length > 0) {
    console.error('Errors during browser test:', problems);
    throw new Error('Browser test encountered console/page errors');
  }

  console.log('\nALL VISUAL LIBRARY & LEVEL INTEGRATION BROWSER TESTS PASSED ✅');
} finally {
  server.close();
}
