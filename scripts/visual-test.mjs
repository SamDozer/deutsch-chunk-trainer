// Browser-based visual + interaction test for the renderer.
// Electron cannot start inside this sandbox, so the same UI is verified in Chrome.
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'shots', 'web');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

const problems = [];
page.on('pageerror', (error) => problems.push(`PAGEERROR: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
    problems.push(`CONSOLE: ${message.text()}`);
  }
});
page.on('response', (response) => {
  if (response.status() >= 400) problems.push(`HTTP ${response.status()} ${response.url()}`);
});

const shot = async (name, full = true) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full });
  console.log('shot', name);
};

const go = async (hash) => {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await page.waitForTimeout(500);
};

const ratioChecks = async (label) => {
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (layout.scrollWidth > layout.innerWidth + 2) problems.push(`OVERFLOW ${label}: ${JSON.stringify(layout)}`);
};

await page.goto(`${base}/src/index.html#/home`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(700);

await shot('01-home');
await ratioChecks('home');
await page.evaluate(() => document.getElementById('levels')?.scrollIntoView());
await page.waitForTimeout(250);
await shot('02-home-levels', false);

await page.locator('.level-row[data-href="#/level/A1"]').click();
await page.waitForTimeout(600);
await shot('03-level-a1');
await ratioChecks('level');

// Practice on a fresh chunk so every step starts empty
await go('#/practice/A1-006?step=1');
await page.waitForTimeout(500);
await shot('04-practice-step1', false);

await page.getByRole('button', { name: /شوف المعنى/ }).click();
await page.locator('[data-check="read"]').click();
await page.locator('[data-check="mean"]').click();
await page.locator('[data-func="طلب"]').click();
await page.waitForTimeout(250);
await shot('05-practice-step1-revealed', false);

await page.locator('[data-act="understand:done"]').click();
await page.waitForTimeout(500);
await shot('06-practice-step2', false);

await page.locator('.pass-card').nth(0).click();
await page.locator('.pass-card').nth(1).click();
await page.locator('.pass-card').nth(2).click();
await page.waitForTimeout(250);

await page.locator('[data-act="blind"]').click();
await page.waitForTimeout(3400);
await shot('07-blind-test', false);
const blindYes = page.getByRole('button', { name: /قلتها صح/ });
if (await blindYes.count()) await blindYes.click();
await page.waitForTimeout(350);

// Step 3: log the first batch
await page.locator('.rail-step[data-step="3"]').click();
await page.waitForTimeout(500);
await shot('08-practice-step3');
const logButton = page.getByRole('button', { name: /^سجّل 10/ });
if (await logButton.count()) {
  await logButton.click();
  await page.waitForTimeout(350);
}
await shot('09-practice-step3-logged', false);

// Step 4: save a variation
await page.locator('.rail-step[data-step="4"]').click();
await page.waitForTimeout(450);
await page.locator('[data-draft="subject"]').fill('Wir möchten eine Suppe.');
await page.locator('[data-act="vary:save"][data-axis="subject"]').click();
await page.waitForTimeout(300);
await page.locator('[data-draft="tense"]').fill('Ich wollte eine Suppe.');
await page.locator('[data-act="vary:save"][data-axis="tense"]').click();
await page.waitForTimeout(350);
await shot('10-practice-step4');

// Step 5: recall drill full loop
await page.locator('.rail-step[data-step="5"]').click();
await page.waitForTimeout(450);
await shot('11-practice-step5');
await page.getByRole('button', { name: /^ابدأ$/ }).first().click();
await page.waitForTimeout(400);
for (let i = 0; i < 5; i += 1) {
  const reveal = page.getByRole('button', { name: /شوف الجملة بدري/ });
  if (await reveal.count()) await reveal.click();
  const known = page.getByRole('button', { name: /عرفت/ });
  await known.waitFor({ state: 'visible', timeout: 4000 });
  await known.click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(300);
await shot('12-drill-result', false);
await page.getByRole('button', { name: 'تمام' }).click();
await page.waitForTimeout(500);
await shot('13-practice-step5-after', false);

await page.locator('.rail-step[data-step="6"]').click();
await page.waitForTimeout(450);
await shot('14-practice-step6');

// Review / stats / settings / method
await go('#/review');
await shot('15-review');
await go('#/stats');
await shot('16-stats');
await go('#/settings');
await shot('17-settings');
await go('#/method');
await shot('18-method');
await ratioChecks('method');

// Seed review + heatmap data (init script runs before app boot, after state is loaded)
await page.addInitScript(() => {
  const raw = localStorage.getItem('chunk-trainer-state');
  if (!raw) return;
  const s = JSON.parse(raw);
  if (s.__seeded) return;
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  for (let i = 0; i < 45; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    s.days[key(d)] = { prod: [0, 2, 6, 12, 25][i % 5], minutes: 18 + (i % 3) * 12, reviews: i % 4, chunks: [] };
  }
  if (s.chunks && s.chunks['A1-003']) {
    s.chunks['A1-003'].review = {
      due: new Date(Date.now() - 86400000).toISOString(),
      interval: 3,
      reps: 2,
      lastGrade: 'good',
      lastAt: new Date().toISOString(),
    };
  }
  s.__seeded = true;
  localStorage.setItem('chunk-trainer-state', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);await go('#/review');
await shot('25-review-due');
await page.locator('[data-reveal]').first().click();
await page.waitForTimeout(250);
await shot('26-review-revealed');
await page.locator('[data-grade="good"]').click();
await page.waitForTimeout(350);
await shot('27-review-finished');
await go('#/stats');
await shot('28-stats-populated');

// Settings with the new sliders
await go('#/settings');
await shot('29-settings-updated');

// Dark mode
await page.locator('[data-toggle="theme"]').click();
await page.waitForTimeout(500);
await go('#/home');
await shot('30-home-dark');
await go('#/practice/A1-005?step=3');
await shot('31-practice-dark');

// Persistence
const state = await page.evaluate(() => JSON.parse(localStorage.getItem('chunk-trainer-state') || '{}'));
console.log('chunks saved:', Object.keys(state.chunks || {}).length, 'pointer:', JSON.stringify(state.pointer));
console.log('A1-006 recall:', JSON.stringify(state.chunks?.['A1-006']?.test?.recall));
if (!state.chunks?.['A1-006']?.test?.recall?.passed) problems.push('STATE: recall result not persisted');
if (!state.pointer?.chunkId) problems.push('STATE: pointer missing');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('32-home-after-reload');

// Mobile (light theme)
await go('#/settings');
await page.locator('[data-toggle="theme"]').click();
await page.waitForTimeout(400);
await page.setViewportSize({ width: 430, height: 920 });
await page.waitForTimeout(500);
await go('#/home');
await shot('33-home-mobile');
await go('#/level/A1');
await shot('34-level-mobile');
await go('#/practice/A1-006?step=3');
await shot('35-practice-mobile');
await go('#/review');
await shot('36-review-mobile');
await ratioChecks('mobile');
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'NO PROBLEMS');
await browser.close();


