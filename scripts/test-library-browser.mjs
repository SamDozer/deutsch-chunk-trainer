// Browser integration & UI verification for the Visual Knowledge Hub, Level Guides, & Trilingual Interface (AR/EN/DE)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = 'C:\\Users\\Hossam\\.gemini\\antigravity\\brain\\19d44b9d-c661-4024-9358-7360d0655a60\\screenshots';
const port = 4187;
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

  console.log('1. Verifying Arabic (AR) interface on #/home and #/library...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/library`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lib-card', { timeout: 10000 });
  await page.waitForTimeout(350);

  // Switch to English (EN) via topbar language switcher
  console.log('2. Switching to English (EN) interface...');
  await page.locator('.topbar [data-lang-switch="en"]').click();
  await page.waitForTimeout(350);

  const htmlDirEn = await page.evaluate(() => document.documentElement.dir);
  const htmlLangEn = await page.evaluate(() => document.documentElement.lang);
  assert.equal(htmlDirEn, 'ltr', 'English interface should switch dir to ltr');
  assert.equal(htmlLangEn, 'en', 'English interface should switch lang to en');

  const navHomeEn = await page.locator('[data-nav="home"]').textContent();
  const navLibEn = await page.locator('[data-nav="library"]').textContent();
  console.log(`English navbar: "${navHomeEn?.trim()}" | "${navLibEn?.trim()}"`);
  assert.equal(navHomeEn?.trim(), 'Home', 'Expected Home in English navbar');
  assert.equal(navLibEn?.trim(), 'Visual Library', 'Expected Visual Library in English navbar');

  await page.screenshot({ path: path.join(shotsDir, '08-library-english.png') });
  console.log('✓ Captured 08-library-english.png');

  // Check Home page in English
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(shotsDir, '09-home-english.png') });
  console.log('✓ Captured 09-home-english.png');

  // Switch to German (DE) via topbar language switcher
  console.log('3. Switching to German (DE) interface on #/level/A1...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/level/A1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.level-visual-shelf', { timeout: 5000 });
  await page.locator('.topbar [data-lang-switch="de"]').click();
  await page.waitForTimeout(400);

  const htmlDirDe = await page.evaluate(() => document.documentElement.dir);
  const htmlLangDe = await page.evaluate(() => document.documentElement.lang);
  assert.equal(htmlDirDe, 'ltr', 'German interface should switch dir to ltr');
  assert.equal(htmlLangDe, 'de', 'German interface should switch lang to de');

  const navHomeDe = await page.locator('[data-nav="home"]').textContent();
  const navLibDe = await page.locator('[data-nav="library"]').textContent();
  console.log(`German navbar: "${navHomeDe?.trim()}" | "${navLibDe?.trim()}"`);
  assert.equal(navHomeDe?.trim(), 'Startseite', 'Expected Startseite in German navbar');
  assert.equal(navLibDe?.trim(), 'Bildbibliothek', 'Expected Bildbibliothek in German navbar');

  await page.screenshot({ path: path.join(shotsDir, '10-level-a1-german.png') });
  console.log('✓ Captured 10-level-a1-german.png');

  // Switch back to Arabic (AR) and verify lossless restore
  console.log('4. Switching back to Arabic (AR) and verifying lossless restore...');
  await page.locator('.topbar [data-lang-switch="ar"]').click();
  await page.waitForTimeout(350);
  const htmlDirAr = await page.evaluate(() => document.documentElement.dir);
  assert.equal(htmlDirAr, 'rtl', 'Arabic interface should restore dir to rtl');
  const navHomeAr = await page.locator('[data-nav="home"]').textContent();
  assert.equal(navHomeAr?.trim(), 'الرئيسية', 'Expected الرئيسية restored in Arabic navbar');

  await browser.close();

  if (problems.length > 0) {
    console.error('Errors during browser test:', problems);
    throw new Error('Browser test encountered console/page errors');
  }

  console.log('\nALL TRILINGUAL (AR/EN/DE) & VISUAL LIBRARY BROWSER TESTS PASSED ✅');
} finally {
  server.close();
}
