// Parses the five Obsidian markdown levels into data/chunks.json.
// Also recovers the checkbox progress that already exists inside the A1 file,
// so the app can start exactly where the old notes stopped.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = process.env.CHUNKS_DIR ?? path.join(root, 'markdown-source');

const LEVELS = [
  { id: 'A1', title: 'الأساسيات', file: 'German_Chunks_A1_Obsidian_CORRECTED.md' },
  { id: 'A2', title: 'البناء الأولي', file: 'German_Chunks_A2_Obsidian_CORRECTED.md' },
  { id: 'B1', title: 'التعبير المستقل', file: 'German_Chunks_B1_Obsidian_CORRECTED.md' },
  { id: 'B2', title: 'الطلاقة', file: 'German_Chunks_B2_Obsidian_CORRECTED.md' },
  { id: 'C1', title: 'الإتقان', file: 'German_Chunks_C1_Obsidian_CORRECTED.md' },
];

// The six markdown checkboxes map onto the six stations of the method.
const STAGE_KEYS = ['produce', 'recall', 'variation', 'sprint', 'speaking', 'delayed'];

const parseFile = (text) => {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = /^###\s+([A-Z]{1,2}\d-\d{3})\s+—\s+(.+?)\s*$/.exec(lines[i]);
    if (!head) continue;

    const id = head[1];
    const de = head[2].trim();
    let ar = '';
    let j = i + 1;
    const boxes = [];
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (/^###\s/.test(line)) break;
      const box = /^-\s+\[([ xX])\]\s*(.*)$/.exec(line);
      if (box) {
        boxes.push({ checked: box[1].toLowerCase() === 'x', label: box[2].trim() });
        continue;
      }
      if (!line.trim()) continue;
      if (!ar) ar = line.trim();
    }

    const stages = STAGE_KEYS.filter((_, index) => boxes[index]?.checked);
    chunks.push({ id, de, ar, stages });
    i = j - 1;
  }
  return chunks;
};

const words = (de) =>
  de
    .replace(/[.,!?;:„“"'’]/g, '')
    .split(/\s+/)
    .filter(Boolean);

const levels = [];
let total = 0;
let imported = 0;

for (const level of LEVELS) {
  const text = await fs.readFile(path.join(sourceDir, level.file), 'utf8');
  const chunks = parseFile(text);
  if (!chunks.length) throw new Error(`No chunks parsed from ${level.file}`);

  // Chunk families: sentences that share their opening words are one pattern
  // with a swapped slot. 1500 sentences collapse to a few hundred patterns.
  const byPrefix = new Map();
  for (const chunk of chunks) {
    const key = words(chunk.de).slice(0, 3).join(' ').toLowerCase();
    if (!byPrefix.has(key)) byPrefix.set(key, []);
    byPrefix.get(key).push(chunk.id);
  }

  for (const chunk of chunks) {
    const key = words(chunk.de).slice(0, 3).join(' ').toLowerCase();
    const family = byPrefix.get(key);
    if (family.length > 1) {
      const prefixWords = words(chunk.de).slice(0, 3);
      chunk.template = prefixWords.join(' ') + ' …';
      chunk.family = `${level.id}:${key}`;
      chunk.familySize = family.length;
    }
    if (chunk.stages.length) imported += 1;
  }

  total += chunks.length;
  levels.push({ id: level.id, title: level.title, count: chunks.length, chunks });
  console.log(`${level.id}: ${chunks.length} chunks`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: path.basename(sourceDir),
  total,
  importedChunks: imported,
  levels,
};

await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'data', 'chunks.json'), JSON.stringify(payload), 'utf8');

console.log(`total ${total} chunks, ${imported} with existing progress`);
console.log('wrote data/chunks.json');
