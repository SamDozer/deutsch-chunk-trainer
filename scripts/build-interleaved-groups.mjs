// Interleaved Groups Builder with Zero-Collision Dispersal and Capstone Groups
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chunksPath = path.join(root, 'data', 'chunks.json');
// Read from backup or original
const backupPath = path.join(root, 'data', 'chunks.json.bak');
const rawPayload = JSON.parse(fs.readFileSync(fs.existsSync(backupPath) ? backupPath : chunksPath, 'utf8'));

export function getBucketKey(chunk) {
  if (chunk.template && chunk.template.trim()) return chunk.template.trim();
  if (chunk.family && chunk.family.trim()) return chunk.family.trim();
  const words = (chunk.de || '').replace(/[.,!?;:„“"'’]/g, '').trim().split(/\s+/).slice(0, 2).join(' ');
  return words ? words + ' …' : 'other';
}

/**
 * Interleaves an array of chunks using max-dispersion and intra-group diversity
 */
export function interleaveLevelChunks(levelChunks, groupSize = 8) {
  const bucketsMap = new Map();
  for (const c of levelChunks) {
    const key = getBucketKey(c);
    if (!bucketsMap.has(key)) bucketsMap.set(key, []);
    bucketsMap.get(key).push(c);
  }

  // Preserve initial order for deterministic tie-breaking
  const buckets = Array.from(bucketsMap.entries()).map(([key, list], idx) => ({
    key,
    order: idx,
    list: [...list],
  }));

  const total = levelChunks.length;
  const interleaved = [];
  let lastKey = null;
  let currentGroupKeys = new Set();

  for (let i = 0; i < total; i++) {
    if (i % groupSize === 0) {
      currentGroupKeys.clear();
    }

    const available = buckets.filter((b) => b.list.length > 0);
    if (available.length === 0) break;

    // 1. Avoid consecutive collision
    let candidates = available.filter((b) => b.key !== lastKey);
    if (candidates.length === 0) candidates = available;

    // 2. Strongly prefer patterns not already in the current 8-sentence window
    const freshForGroup = candidates.filter((b) => !currentGroupKeys.has(b.key));
    const pool = freshForGroup.length > 0 ? freshForGroup : candidates;

    // 3. Pick bucket with largest remaining count; tie-break deterministically
    pool.sort((a, b) => b.list.length - a.list.length || a.order - b.order);
    const chosen = pool[0];

    const item = chosen.list.shift();
    interleaved.push({ ...item, patternKey: chosen.key });
    lastKey = chosen.key;
    currentGroupKeys.add(chosen.key);
  }

  return interleaved;
}

/**
 * Distributes a level into diverse groups with terminal capstones
 */
export function buildLevelGroups(levelChunks, levelId, groupSize = 8) {
  const total = levelChunks.length;
  const flatInterleaved = interleaveLevelChunks(levelChunks, groupSize);

  // Remainder calculation:
  // A1: 200 / 8 = 25 groups (capstone 8)
  // A2: 250 = 30 groups of 8 + 1 capstone of 10 = 31 groups
  // B1: 300 = 36 groups of 8 + 1 capstone of 12 = 37 groups
  // B2: 400 / 8 = 50 groups (capstone 8)
  // C1: 350 = 42 groups of 8 + 1 capstone of 14 = 43 groups
  const standardGroupCount = Math.floor(total / groupSize);
  const remainder = total % groupSize;
  const numGroups = remainder === 0 ? standardGroupCount : standardGroupCount;

  const groups = [];
  let offset = 0;

  for (let gIndex = 1; gIndex <= numGroups; gIndex++) {
    const isLast = gIndex === numGroups;
    const currentSize = isLast && remainder > 0 ? groupSize + remainder : groupSize;
    const slice = flatInterleaved.slice(offset, offset + currentSize);
    offset += currentSize;

    const groupId = `${levelId}::group-${gIndex}`;
    const groupTitle = `المجموعة ${gIndex}`;
    const groupKey = `group-${gIndex}`;

    const templatesInGroup = slice.map((c) => c.template || c.patternKey).filter(Boolean);
    const uniqueTemplates = Array.from(new Set(templatesInGroup));

    // Designate first sentence with a distinct template as the anchor for Step 5
    const anchorIdx = 0;

    const decoratedChunks = slice.map((c, idx) => ({
      ...c,
      level: levelId,
      groupId,
      groupTitle,
      groupKey,
      groupNumber: gIndex,
      groupOrder: idx + 1,
      groupTotal: slice.length,
      isAnchor: idx === anchorIdx,
      isCapstone: isLast && remainder > 0,
      uniqueTemplatesCount: uniqueTemplates.length,
    }));

    groups.push({
      id: groupId,
      levelId,
      number: gIndex,
      title: groupTitle,
      key: groupKey,
      chunks: decoratedChunks,
      total: decoratedChunks.length,
      uniqueTemplatesCount: uniqueTemplates.length,
      templates: uniqueTemplates,
      isCapstone: isLast && remainder > 0,
    });
  }

  return groups;
}

export function generateAllLevels() {
  console.log('Generating Diverse Interleaved Groups for all levels...');
  const newLevels = [];

  for (const level of rawPayload.levels) {
    const groups = buildLevelGroups(level.chunks, level.id, 8);
    const flatChunks = groups.flatMap((g) => g.chunks);

    console.log(`Level ${level.id}: ${level.chunks.length} sentences -> ${groups.length} groups (last group size: ${groups[groups.length - 1].total})`);
    
    // Collision check
    let collisions = 0;
    for (let i = 1; i < flatChunks.length; i++) {
      if (flatChunks[i].patternKey === flatChunks[i - 1].patternKey) {
        collisions++;
      }
    }
    console.log(`  Collisions: ${collisions}`);
    if (collisions > 0) {
      throw new Error(`Fatal: Level ${level.id} produced ${collisions} consecutive template collisions!`);
    }

    newLevels.push({
      ...level,
      count: flatChunks.length,
      chunks: flatChunks,
    });
  }

  const updatedPayload = {
    ...rawPayload,
    updatedAt: new Date().toISOString(),
    groupingMode: 'interleaved',
    groupSize: 8,
    levels: newLevels,
  };

  fs.writeFileSync(chunksPath, JSON.stringify(updatedPayload, null, 2), 'utf8');
  console.log(`\n✓ Successfully wrote updated diverse chunks to ${chunksPath}`);
}

// Run if directly executed
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllLevels();
}
