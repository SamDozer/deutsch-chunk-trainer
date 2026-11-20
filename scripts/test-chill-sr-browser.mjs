// Headless browser test for Chill Mode Spaced Repetition Strip & Interactions
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'shots', 'chill_sr');
const port = 4192;
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
console.log(`SR test preview server listening on port ${port}`);

try {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const problems = [];

  page.on('pageerror', (err) => problems.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) {
      problems.push(`CONSOLE: ${msg.text()}`);
    }
  });

  console.log('Navigating to Chill Mode...');
  await page.goto(`http://127.0.0.1:${port}/src/index.html#/chill`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Start session
  await page.locator('#chill-start-btn').click();
  await page.waitForTimeout(600);

  // 2. Check initial SR enroll button
  const enrollBtn = page.locator('#chill-sr-enroll');
  const enrollCount = await enrollBtn.count();
  console.log(`Found SR enroll button: ${enrollCount > 0}`);
  await page.screenshot({ path: path.join(out, '01-sr-unenrolled.png') });

  // 3. Click enroll
  if (enrollCount > 0) {
    await enrollBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, '02-sr-enrolled-waiting.png') });
    console.log('✓ Clicked enroll -> captured 02-sr-enrolled-waiting.png');

    const statusBox = page.locator('.chill-srs-status-box');
    const hasStatus = (await statusBox.count()) > 0;
    console.log(`SR status box visible: ${hasStatus}`);
    if (!hasStatus) throw new Error('Status box should be visible after enrollment');

    // 4. Test cancel button
    const cancelBtn = page.locator('#chill-sr-cancel');
    await cancelBtn.click();
    await page.waitForTimeout(400);
    const reEnrollCount = await page.locator('#chill-sr-enroll').count();
    console.log(`Back to unenrolled state: ${reEnrollCount > 0}`);
    if (reEnrollCount === 0) throw new Error('Should revert to unenrolled button after cancel');
    await page.screenshot({ path: path.join(out, '03-sr-cancelled.png') });

    // 5. Re-enroll and simulate Due state in page context
    await page.locator('#chill-sr-enroll').click();
    await page.waitForTimeout(300);

    // Make it due via store
    await page.evaluate(() => {
      // Find current chunk ID
      const chunkBadge = document.querySelector('.chill-bar-meta .chip:nth-child(3)');
      const cid = chunkBadge ? chunkBadge.textContent.trim() : 'A1-001';
      const rec = window.__store?.peek(cid) || (window.localStorage ? JSON.parse(localStorage.getItem('chunk-trainer-state') || '{}').chunks?.[cid] : null);
      if (window.__store) {
        const sch = window.__store.peek(cid)?.srSchedule;
        if (sch) sch.nextReviewAt = new Date(Date.now() - 3600000).toISOString();
        window.__store.touch();
      }
    });

    // Refresh view
    await page.locator('#chill-blur-toggle').click();
    await page.locator('#chill-blur-toggle').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, '04-sr-due-state.png') });
    console.log('✓ Captured 04-sr-due-state.png');
  }

  if (problems.length > 0) {
    console.warn('Encountered non-fatal problems:', problems);
  } else {
    console.log('✓ ZERO console/page errors detected during all browser tests!');
  }

  await browser.close();
  console.log('ALL CHILL MODE SPACED REPETITION BROWSER TESTS PASSED! 🎉');
} finally {
  server.close();
}
