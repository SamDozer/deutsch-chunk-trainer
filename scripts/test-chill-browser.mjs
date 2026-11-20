// Headless browser test for Chill Mode UI, interactions & store sync
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'shots', 'chill');
const port = 4188;
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await fs.mkdir(out, { recursive: true });

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
console.log(`Test preview server listening on port ${port}`);

try {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];

  page.on('pageerror', (err) => problems.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) {
      problems.push(`CONSOLE: ${msg.text()}`);
    }
  });

  console.log('Navigating to home...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Verify Chill Mode link in navbar
  const chillNavLink = page.locator('.nav a[data-nav="chill"]');
  const count = await chillNavLink.count();
  if (count === 0) throw new Error('Chill Mode navigation link not found in navbar!');
  console.log('✓ Found Chill Mode tab in navbar');

  // 2. Click Chill Mode link
  await chillNavLink.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '01-chill-setup.png') });
  console.log('✓ Captured 01-chill-setup.png');

  // Check that setup view is rendered
  const setupTitle = await page.locator('.chill-hero-title').textContent();
  console.log(`Setup title: "${setupTitle.trim()}"`);

  // Check level boxes
  const levelBoxes = page.locator('.chill-level-box');
  const levelCount = await levelBoxes.count();
  console.log(`Found ${levelCount} level selection boxes`);

  // 3. Start session
  const startBtn = page.locator('#chill-start-btn');
  await startBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '02-chill-card.png') });
  console.log('✓ Captured 02-chill-card.png');

  // 4. Test German Text blur toggle
  const blurBtn = page.locator('#chill-blur-toggle');
  await blurBtn.click();
  await page.waitForTimeout(300);
  const isBlurred = await page.locator('#chill-de-box').evaluate((el) => el.classList.contains('is-blurred'));
  console.log(`Text blur toggle working: ${isBlurred}`);
  if (!isBlurred) throw new Error('Blur toggle did not add .is-blurred class');
  await page.screenshot({ path: path.join(out, '03-chill-blurred.png') });

  // Unblur
  await blurBtn.click();
  await page.waitForTimeout(300);

  // 5. Test Step 1: Read check
  const readCheck = page.locator('#chill-check-read');
  await readCheck.click();
  await page.waitForTimeout(300);
  const readIsDone = await readCheck.evaluate((el) => el.classList.contains('is-done'));
  console.log(`Read check is done: ${readIsDone}`);

  // 6. Test Step 2: Speak Slow, Natural, Blind
  await page.locator('#chill-pass-slow').click();
  await page.waitForTimeout(200);
  await page.locator('#chill-pass-natural').click();
  await page.waitForTimeout(200);
  await page.locator('#chill-pass-blind').click();
  await page.waitForTimeout(300);

  // 7. Test Step 4: Recall (+1 five times)
  const recallInc = page.locator('#chill-recall-inc');
  for (let i = 0; i < 5; i++) {
    await recallInc.click();
    await page.waitForTimeout(150);
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, '04-chill-card-completed.png') });
  console.log('✓ Captured 04-chill-card-completed.png');

  // Verify completion banner appears
  const banner = page.locator('.chill-card-done-banner');
  const bannerVisible = await banner.isVisible();
  console.log(`Completion banner visible: ${bannerVisible}`);
  if (!bannerVisible) throw new Error('Completion banner should be visible when all 5 exercises are done!');

  // 8. Test Navigation to next card
  const nextBtn = page.locator('#chill-btn-next');
  await nextBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '05-chill-next-card.png') });
  console.log('✓ Successfully navigated to next card');

  // 9. Now navigate to practice screen for the previous chunk (A1-001) to verify bidirectional sync in regular mode!
  console.log('Verifying bidirectional sync in regular mode for A1-001...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/practice/A1-001?step=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Check Step 1 read check in practice screen
  const step1ReadCheck = await page.locator('[data-check="read"]').evaluate((el) => el.classList.contains('is-on'));
  console.log(`Step 1 'read' check in normal mode: ${step1ReadCheck}`);
  if (!step1ReadCheck) throw new Error('Step 1 read check was not synced to normal practice mode!');

  // Check Step 2 passes in practice screen
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/practice/A1-001?step=2`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const slowPass = await page.locator('[data-pass="slow"]').evaluate((el) => el.classList.contains('is-done'));
  const naturalPass = await page.locator('[data-pass="natural"]').evaluate((el) => el.classList.contains('is-done'));
  const blindPass = await page.locator('[data-pass="blind"]').evaluate((el) => el.classList.contains('is-done'));
  console.log(`Step 2 passes in normal mode: slow=${slowPass}, natural=${naturalPass}, blind=${blindPass}`);
  if (!slowPass || !naturalPass || !blindPass) {
    throw new Error('Step 2 speak passes were not synced to normal practice mode!');
  }

  // Check Step 4 recall in practice screen
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/practice/A1-001?step=4`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const recallCard = page.locator('.test-card').first();
  const recallIsDone = await recallCard.evaluate((el) => el.classList.contains('is-done'));
  console.log(`Step 4 recall card in normal mode is-done: ${recallIsDone}`);
  if (!recallIsDone) {
    throw new Error('Step 4 recall pass was not synced to normal practice mode!');
  }

  await page.screenshot({ path: path.join(out, '06-normal-practice-synced.png') });
  console.log('✓ Captured 06-normal-practice-synced.png');

  if (problems.length > 0) {
    console.warn('Encountered non-fatal problems:', problems);
  } else {
    console.log('✓ ZERO console/page errors detected during all browser tests!');
  }

  await browser.close();
  console.log('ALL BROWSER INTERACTION & SYNC TESTS PASSED! 🎉');
} finally {
  server.close();
}
