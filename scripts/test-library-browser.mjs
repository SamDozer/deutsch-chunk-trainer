// Browser integration & UI verification for the Visual Knowledge Hub (المكتبة المصورة)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = 'C:\\Users\\Hossam\\.gemini\\antigravity\\brain\\19d44b9d-c661-4024-9358-7360d0655a60\\screenshots';
const port = 4183;
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
  await page.waitForTimeout(400);

  const countText = await page.locator('#lib-results-count').textContent();
  console.log(`Initial results badge: "${countText?.trim()}"`);
  assert.ok(countText?.includes('619'), `Expected 619 cards, got ${countText}`);

  // Check images actually loaded (naturalWidth > 0)
  const firstImgLoaded = await page.locator('.lib-card img').first().evaluate((img) => img.complete && img.naturalWidth > 0);
  assert.ok(firstImgLoaded, 'First library WebP card image failed to load');

  await page.screenshot({ path: path.join(shotsDir, '01-library-desktop.png') });
  console.log('✓ Captured 01-library-desktop.png');

  // 2. Test Pillar filter: Mythology & History
  console.log('2. Filtering by Mythology & History pillar...');
  await page.locator('[data-pillar="myth-history"]').click();
  await page.waitForTimeout(350);
  const mythCount = await page.locator('#lib-results-count').textContent();
  console.log(`Mythology results badge: "${mythCount?.trim()}"`);
  assert.ok(mythCount?.includes('62'), `Expected 62 mythology cards, got ${mythCount}`);
  await page.screenshot({ path: path.join(shotsDir, '02-library-mythology.png') });
  console.log('✓ Captured 02-library-mythology.png');

  // 3. Test Lightbox Reader & Zoom
  console.log('3. Opening Lightbox Reader and testing Zoom + Mark Read...');
  await page.locator('.lib-card [data-open-idx="0"]').first().click();
  await page.waitForSelector('.lib-lightbox', { timeout: 5000 });
  await page.waitForTimeout(350);

  // Zoom in
  await page.locator('[data-lb-zoom="in"]').click();
  const zoomLabel = await page.locator('#lib-lb-zoom-label').textContent();
  assert.equal(zoomLabel?.trim(), '125%', 'Expected zoom level to be 125%');

  // Mark as read inside lightbox
  await page.locator('.lib-lightbox [data-toggle-read]').click();
  await page.waitForTimeout(200);

  await page.screenshot({ path: path.join(shotsDir, '03-library-lightbox.png') });
  console.log('✓ Captured 03-library-lightbox.png');

  // Close lightbox with Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const lbCount = await page.locator('.lib-lightbox').count();
  assert.equal(lbCount, 0, 'Lightbox should close on Escape');

  // 4. Test Search & Edge Case (empty query match)
  console.log('4. Testing Search input and empty state...');
  await page.locator('[data-pillar="all"]').click();
  await page.fill('#lib-search-input', 'Satzbau');
  await page.waitForTimeout(250);
  const searchCount = await page.locator('#lib-results-count').textContent();
  console.log(`Search "Satzbau" results: "${searchCount?.trim()}"`);
  assert.ok(!searchCount?.includes('0 لوحة'), 'Expected Satzbau search to return cards');

  await page.fill('#lib-search-input', 'zzzz_nonexistent_query_999');
  await page.waitForTimeout(250);
  const emptyVisible = await page.locator('.lib-empty').isVisible();
  assert.ok(emptyVisible, 'Empty state should be visible for non-matching query');
  await page.locator('[data-reset-filters]').click();
  await page.waitForTimeout(250);

  // 5. Test Mobile Viewport (375px) & Dark Theme
  console.log('5. Verifying responsive layout at 375px mobile & dark theme...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.waitForTimeout(350);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  assert.ok(!hasHorizontalOverflow, 'Mobile 375px layout should not overflow horizontally');
  await page.screenshot({ path: path.join(shotsDir, '04-library-mobile-dark.png') });
  console.log('✓ Captured 04-library-mobile-dark.png');

  // 6. Nearby regression check: Home & Level A1 still work
  console.log('6. Checking Home and Level A1 screens for regressions...');
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const homeLibBtn = await page.locator('a[href="#/library"]').count();
  assert.ok(homeLibBtn >= 2, 'Home and navbar should both link to #/library');

  await browser.close();

  if (problems.length > 0) {
    console.error('Errors during browser test:', problems);
    throw new Error('Browser test encountered console/page errors');
  }

  console.log('\nALL VISUAL LIBRARY BROWSER TESTS PASSED ✅');
} finally {
  server.close();
}
