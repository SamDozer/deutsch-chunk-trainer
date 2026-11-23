import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'data', 'library.json');

console.log('Running Visual Library Hub & Level Mapping integrity tests...');

// 1. Manifest existence & schema
assert.ok(fs.existsSync(manifestPath), 'data/library.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.ok(Array.isArray(manifest.pillars), 'manifest.pillars must be an array');
assert.equal(manifest.pillars.length, 5, 'manifest must have 5 main pillars');
assert.ok(Array.isArray(manifest.topics) && manifest.topics.length >= 24, 'manifest must have at least 24 topics');
assert.ok(Array.isArray(manifest.items) && manifest.items.length >= 600, `manifest must have >= 600 curated items, got ${manifest.items?.length}`);

// 2. Check levelCounts and per-level visual guide assignments (A1, A2, B1, B2, C1)
assert.ok(manifest.levelCounts && typeof manifest.levelCounts === 'object', 'manifest.levelCounts must exist');
for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1']) {
  const matching = manifest.items.filter((it) => Array.isArray(it.levels) && it.levels.includes(lv));
  assert.ok(matching.length >= 40, `Expected at least 40 visual cards mapped to level ${lv}, got ${matching.length}`);
  assert.equal(manifest.levelCounts[lv], matching.length, `levelCounts[${lv}] mismatch`);
}

// 3. Check no blocklisted items, ugly raw English fallback titles, or duplicate IDs/paths
const seenIds = new Set();
const seenSrcPaths = new Set();
let totalBytes = 0;

const bannedPatterns = [
  /d33f959a-3770-438d-bae4-575ee32ee7b3/i,
  /videos-und-medien/i,
  /ki-lerntools/i,
  /duo-raum/i,
  /failed-downloads/i,
];

const uglyTitlePatterns = [
  /^Gemini Generated Image/i,
  /^ChatGPT Image/i,
  /^Corrected Arabic English glossary/i,
  /^German rap glossary/i,
];

for (const item of manifest.items) {
  assert.ok(item.id && !seenIds.has(item.id), `Duplicate or missing item.id: ${item.id}`);
  seenIds.add(item.id);

  assert.ok(item.pillarId, `Missing pillarId on ${item.id}`);
  assert.ok(item.topicId, `Missing topicId on ${item.id}`);
  assert.ok(item.title, `Missing title on ${item.id}`);
  assert.ok(Array.isArray(item.levels) && item.levels.length >= 1, `Missing levels array on ${item.id}`);
  assert.ok(item.src && item.src.startsWith('./assets/library/'), `Invalid src on ${item.id}: ${item.src}`);
  assert.ok(!seenSrcPaths.has(item.src), `Duplicate src path: ${item.src}`);
  seenSrcPaths.add(item.src);

  for (const pat of bannedPatterns) {
    assert.ok(!pat.test(item.origName || '') && !pat.test(item.src), `Banned pattern matched on ${item.id}`);
  }
  for (const ugly of uglyTitlePatterns) {
    assert.ok(!ugly.test(item.title), `Ugly raw fallback title found on ${item.id}: "${item.title}"`);
  }

  const diskPath = path.join(rootDir, 'src', item.src.replace(/^\.\//, ''));
  assert.ok(fs.existsSync(diskPath), `Image file missing on disk: ${diskPath}`);
  const stat = fs.statSync(diskPath);
  assert.ok(stat.size > 1000, `Image file suspiciously small (${stat.size}B): ${diskPath}`);
  assert.ok(stat.size < 650 * 1024, `Image file exceeds 650KB budget (${stat.size}B): ${diskPath}`);
  totalBytes += stat.size;
}

const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`Verified ${manifest.items.length} curated images across ${manifest.topics.length} topics (${totalMB} MB total).`);
console.log('Level Visual Guides count:', manifest.levelCounts);
assert.ok(totalBytes < 110 * 1024 * 1024, `Total library size (${totalMB} MB) must be under 110 MB`);
console.log('ALL LIBRARY & LEVEL MAPPING TESTS PASSED ✅');
