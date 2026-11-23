import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceRoot = 'c:\\Users\\Hossam\\Downloads\\Discord-Images-Downloader\\Discord-Images';
const outAssetRoot = path.join(rootDir, 'src', 'assets', 'library');
const outManifestPath = path.join(rootDir, 'data', 'library.json');

const PILLARS = [
  {
    id: 'levels-grammar',
    title: 'المستويات والقواعد',
    subtitle: 'شرح مصور للقواعد وتراكيب الجمل من A1 إلى C1',
    icon: '📐',
    color: '#2563eb',
  },
  {
    id: 'vocab-idioms',
    title: 'الكلمات والتعبيرات',
    subtitle: 'مفردات مصورة، فروق دقيقة، اصطلاحات، ولغة الشارع والمحادثة',
    icon: '💬',
    color: '#059669',
  },
  {
    id: 'myth-history',
    title: 'الأساطير والتاريخ',
    subtitle: 'الأساطير اليونانية والمصرية، قصص الأنبياء، والتاريخ بالألمانية',
    icon: '🏛️',
    color: '#d97706',
  },
  {
    id: 'philosophy-psych',
    title: 'الفلسفة وعلم النفس',
    subtitle: 'علم النفس، الأعصاب، الفلسفة، الميتافيزيقا، وخوارزميات التعلم',
    icon: '🧠',
    color: '#7c3aed',
  },
  {
    id: 'culture-lit',
    title: 'الأدب والثقافة والفن',
    subtitle: 'تحليل أفلام ومسلسلات، روايات، شعر، وثقافة ألمانية',
    icon: '🎬',
    color: '#db2777',
  },
];

// Map Discord folders to structured topics
const FOLDER_MAP = {
  '🌱│a1-a2material': {
    pillarId: 'levels-grammar',
    topicId: 'a1-a2',
    title: 'مستوى A1 – A2',
    badge: 'A1-A2',
    desc: 'أساسيات تكوين الجمل، الأفعال المنفصلة، والماضي البسيط والمركب',
  },
  '🌿│b1-b2material': {
    pillarId: 'levels-grammar',
    topicId: 'b1-b2',
    title: 'مستوى B1 – B2',
    badge: 'B1-B2',
    desc: 'الروابط المتقدمة، المبني للمجهول، وتراكيب المستوى المتوسط وفوق المتوسط',
  },
  '🌲│c1-material': {
    pillarId: 'levels-grammar',
    topicId: 'c1',
    title: 'مستوى C1 المتقدم',
    badge: 'C1',
    desc: 'التعبيرات الأكاديمية، الروابط الرسمية، وتراكيب المستوى المتقدم',
  },
  '📐│grammatik': {
    pillarId: 'levels-grammar',
    topicId: 'grammatik',
    title: 'قواعد الألمانية الشاملة (Grammatik)',
    badge: 'Grammatik',
    desc: 'خرائط ذهنية وجداول مقارنة لأهم قواعد اللغة الألمانية',
  },
  '📚│neue-wörter': {
    pillarId: 'vocab-idioms',
    topicId: 'neue-woerter',
    title: 'كلمات وفروق لغوية (Neue Wörter)',
    badge: 'Wortschatz',
    desc: 'بطاقات مصورة للكلمات المتشابهة والفروق الدقيقة مع الأمثلة',
  },
  '💬│redemittel-und-idiome': {
    pillarId: 'vocab-idioms',
    topicId: 'redemittel-idiome',
    title: 'تعبيرات واصطلاحات (Redemittel & Idiome)',
    badge: 'Idiome',
    desc: 'تعبيرات جاهزة للكتابة والمحادثة والامتحانات',
  },
  '🔥│umgangssprache': {
    pillarId: 'vocab-idioms',
    topicId: 'umgangssprache',
    title: 'لغة الشارع والحياة اليومية (Umgangssprache)',
    badge: 'Alltag',
    desc: 'تعبيرات عامية ويومية يستخدمها الألمان في الحياة الحقيقية',
  },
  '💼│kundenservice-material': {
    pillarId: 'vocab-idioms',
    topicId: 'kundenservice',
    title: 'ألماني العمل وخدمة العملاء (Kundenservice)',
    badge: 'Beruf',
    desc: 'مصطلحات، جمل، ودليل العمليات في بيئة العمل وخدمة العملاء',
  },
  '🏛️│griechische-mythologie': {
    pillarId: 'myth-history',
    topicId: 'griechische-mythologie',
    title: 'الأساطير اليونانية (Griechische Mythologie)',
    badge: 'Mythos',
    desc: 'قصص سيزيف، بروميثيوس، وأبطال الأساطير اليونانية بالألمانية',
  },
  '📿│ägyptische-mythologie': {
    pillarId: 'myth-history',
    topicId: 'aegyptische-mythologie',
    title: 'الأساطير المصرية القديمة (Ägyptische Mythologie)',
    badge: 'Ägypten',
    desc: 'رموز وآلهة وأساطير مصر القديمة مصورة ومشروحة بالألمانية',
  },
  '🏛️🇪🇬-ägyptische-geschichte': {
    pillarId: 'myth-history',
    topicId: 'aegyptische-geschichte',
    title: 'تاريخ مصر الحضاري (Ägyptische Geschichte)',
    badge: 'Geschichte',
    desc: 'محطات وشخصيات من التاريخ المصري القديم والحديث بالألمانية',
  },
  '📖│prophetengeschichten': {
    pillarId: 'myth-history',
    topicId: 'prophetengeschichten',
    title: 'قصص الأنبياء والحكمة (Prophetengeschichten)',
    badge: 'Geschichten',
    desc: 'سلسلة مصورة متسلسلة (مثل رحلة موسى والخضر) بلغة ألمانية سلسة',
  },
  '🏛️│geschichte-und-politik': {
    pillarId: 'myth-history',
    topicId: 'geschichte-politik',
    title: 'التاريخ والسياسة (Geschichte & Politik)',
    badge: 'Geschichte',
    desc: 'أحداث تاريخية وتحولات سياسية كبرى مشروحة بالألمانية',
  },
  '🏛️│politik-und-theorie': {
    pillarId: 'myth-history',
    topicId: 'politik-theorie',
    title: 'النظريات السياسية (Politik & Theorie)',
    badge: 'Theorie',
    desc: 'مفاهيم الفلسفة السياسية والدولة والمجتمع',
  },
  '🧠│psychologie-und-neuro': {
    pillarId: 'philosophy-psych',
    topicId: 'psychologie-neuro',
    title: 'علم النفس والأعصاب (Psychologie & Neuro)',
    badge: 'Psychologie',
    desc: 'سلاسل مصورة عن الدماغ، الإدراك، الانفصال، والصحة النفسية',
  },
  '🧠│philosophie': {
    pillarId: 'philosophy-psych',
    topicId: 'philosophie',
    title: 'الفلسفة والتفكير النقدي (Philosophie)',
    badge: 'Philosophie',
    desc: 'مدارس الفلسفة، المنطق، والأسئلة الوجودية الكبرى بالألمانية',
  },
  '🧠│psycho-philosophie': {
    pillarId: 'philosophy-psych',
    topicId: 'psycho-philosophie',
    title: 'الفلسفة النفسية (Psycho-Philosophie)',
    badge: 'Psycho',
    desc: 'تقاطع علم النفس مع الفلسفة وفهم الذات',
  },
  '🌌│metaphysik-und-ontologie': {
    pillarId: 'philosophy-psych',
    topicId: 'metaphysik-ontologie',
    title: 'الميتافيزيقا والأنطولوجيا (Metaphysik)',
    badge: 'Metaphysik',
    desc: 'مفاهيم الوجود والكون وما وراء الطبيعة',
  },
  '🔮│pseudowissenschaft': {
    pillarId: 'philosophy-psych',
    topicId: 'pseudowissenschaft',
    title: 'العلم الزائف والتفكير العلمي (Pseudowissenschaft)',
    badge: 'Wissenschaft',
    desc: 'كيف نفرق بين العلم الحقيقي والخرافات والعلوم الزائفة',
  },
  '🤖│lern-algorithmen': {
    pillarId: 'philosophy-psych',
    topicId: 'lern-algorithmen',
    title: 'خوارزميات ومنهجيات التعلم (Lern-Algorithmen)',
    badge: 'Lernen',
    desc: 'كيف يتعلم الدماغ ويبني الذاكرة طويلة المدى',
  },
  '🎬│filme-und-serien': {
    pillarId: 'culture-lit',
    topicId: 'filme-serien',
    title: 'أفلام ومسلسلات (Filme & Serien)',
    badge: 'Kino',
    desc: 'تحليل حبكات وشخصيات الأعمال الدرامية والسينمائية بالألمانية',
  },
  '📚│literatur-und-romane': {
    pillarId: 'culture-lit',
    topicId: 'literatur-romane',
    title: 'الأدب والروايات العالمية (Literatur & Romane)',
    badge: 'Literatur',
    desc: 'قراءات وملخصات مصورة لأهم الروايات والأعمال الأدبية',
  },
  '📜│zitate-und-poesie': {
    pillarId: 'culture-lit',
    topicId: 'zitate-poesie',
    title: 'اقتباسات وشعر (Zitate & Poesie)',
    badge: 'Poesie',
    desc: 'قصائد واقتباسات أدبية وفلسفية مختارة',
  },
  '🎭│deutsche-kultur': {
    pillarId: 'culture-lit',
    topicId: 'deutsche-kultur',
    title: 'الثقافة والمجتمع الألماني (Deutsche Kultur)',
    badge: 'Kultur',
    desc: 'ملامح الثقافة والحياة الاجتماعية في ألمانيا',
  },
  '📌│themen': {
    pillarId: 'culture-lit',
    topicId: 'themen',
    title: 'موضوعات متنوعة (Themen)',
    badge: 'Themen',
    desc: 'موضوعات عامة ومناقشات ثقافية بالألمانية',
  },
};

// Folders excluded completely (non-learning / app UI screenshots / torrent screenshot / personal photo)
const EXCLUDED_FOLDERS = new Set([
  '🎬│videos-und-medien',
  '👥│duo-raum',
  '🗣️│Sprechgruppe (Max 4)',
  '🤖│ki-lerntools',
]);

// Special routing for 🗣️│Sprechgruppe (Max 3):
// Keep the 6 high-value B1 Satzbau / -dem grammar cards and route them to b1-b2, skip the 10 low-res quiz/voice UI screenshots
function routeSpecialFile(folderName, fileName, fileSize) {
  if (folderName === '🗣️│Sprechgruppe (Max 3)') {
    if (fileName.startsWith('ChatGPT_Image_') || fileName === 'image_1558665991150501919.png') {
      return FOLDER_MAP['🌿│b1-b2material'];
    }
    return null; // exclude voice/quiz UI screenshot
  }
  return FOLDER_MAP[folderName] || null;
}

function cleanHumanTitle(fileName, topicTitle, indexInTopic) {
  const base = path.basename(fileName, path.extname(fileName));

  // Recognize named German series
  if (/^A2_Satzbau_(\d+)/i.test(base)) {
    const num = RegExp.$1;
    return `تراكيب جمل A2 (Satzbau) — بطاقة ${Number(num)}`;
  }
  if (/^A2[-_]+(\d+)/i.test(base)) {
    return `ملخص قواعد ومفردات A2 — جزء ${RegExp.$1}`;
  }
  if (/^German_Customer_Service_Operations_(\d+)(?:_(.+))?/i.test(base)) {
    const num = Number(RegExp.$1);
    const extra = RegExp.$2 ? ` (${RegExp.$2.replace(/_/g, ' ')})` : '';
    return `دليل خدمة العملاء بالألمانية — فصل ${num}${extra}`;
  }
  if (/^Bilingual_table_with_Arabic_spelling_repair-(\d+)/i.test(base)) {
    return `جدول تعبيرات الحياة اليومية — بطاقة ${RegExp.$1}`;
  }
  if (/^(\d{2})[-_](.+)$/.test(base)) {
    const num = Number(RegExp.$1);
    let label = RegExp.$2
      .replace(/_\d{15,}$/, '') // strip discord snowflake suffix
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .trim();
    return `${num}. ${label}`;
  }
  if (/^ChatGPT_Image_/i.test(base)) {
    const m = base.match(/-(\d+)$/);
    const part = m ? ` (صفحة ${m[1]})` : '';
    return `${topicTitle} — لوحة تعليمية #${indexInTopic}${part}`;
  }
  if (/^[0-9a-f]{14,}$/i.test(base) || /^image(?:_\d+)?$/i.test(base) || /^\d+$/.test(base)) {
    return `${topicTitle} — بطاقة #${indexInTopic}`;
  }
  return base.replace(/_\d{15,}$/, '').replace(/[_-]+/g, ' ').trim();
}

async function main() {
  console.log('Scanning Discord-Images directory...');
  if (fs.existsSync(outAssetRoot)) {
    fs.rmSync(outAssetRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(outAssetRoot, { recursive: true });

  const entries = fs.readdirSync(sourceRoot, { withFileTypes: true });
  const seenHashes = new Set();
  const rawCandidates = [];
  let skippedDuplicates = 0;
  let skippedExcluded = 0;

  for (const dirEntry of entries) {
    if (!dirEntry.isDirectory()) continue;
    const folderName = dirEntry.name;
    if (EXCLUDED_FOLDERS.has(folderName)) {
      const files = fs.readdirSync(path.join(sourceRoot, folderName));
      skippedExcluded += files.length;
      continue;
    }

    const folderPath = path.join(sourceRoot, folderName);
    const files = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((f) => f.isFile() && /\.(png|jpe?g|gif|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    for (const file of files) {
      const fullPath = path.join(folderPath, file.name);
      const stat = fs.statSync(fullPath);
      const targetTopic = routeSpecialFile(folderName, file.name, stat.size);
      if (!targetTopic) {
        skippedExcluded++;
        continue;
      }

      const buf = fs.readFileSync(fullPath);
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (seenHashes.has(hash)) {
        skippedDuplicates++;
        continue;
      }
      seenHashes.add(hash);

      rawCandidates.push({
        fullPath,
        origName: file.name,
        origBytes: stat.size,
        hash: hash.slice(0, 10),
        ...targetTopic,
      });
    }
  }

  console.log(`Found ${rawCandidates.length} unique curated learning images (skipped ${skippedDuplicates} duplicates, ${skippedExcluded} non-learning screenshots).`);

  // Group by topicId to assign clean sequential numbers and convert in parallel batches
  const byTopic = new Map();
  for (const item of rawCandidates) {
    if (!byTopic.has(item.topicId)) byTopic.set(item.topicId, []);
    byTopic.get(item.topicId).push(item);
  }

  const finalItems = [];
  let totalOrigBytes = 0;
  let totalOutBytes = 0;
  let processed = 0;

  const CONCURRENCY = 8;

  for (const [topicId, topicItems] of byTopic.entries()) {
    const topicOutDir = path.join(outAssetRoot, topicId);
    fs.mkdirSync(topicOutDir, { recursive: true });

    for (let i = 0; i < topicItems.length; i += CONCURRENCY) {
      const slice = topicItems.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (item, idxInSlice) => {
          const seqNum = i + idxInSlice + 1;
          const seqPad = String(seqNum).padStart(3, '0');
          const id = `${topicId}-${seqPad}`;
          const outFileName = `${seqPad}-${item.hash}.webp`;
          const outDiskPath = path.join(topicOutDir, outFileName);

          const image = sharp(item.fullPath, { animated: false });
          const meta = await image.metadata();

          // Resize if taller than 1350px or wider than 1350px while preserving aspect ratio
          const maxDim = 1350;
          let pipeline = image;
          if ((meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim)) {
            pipeline = pipeline.resize({
              width: maxDim,
              height: maxDim,
              fit: 'inside',
              withoutEnlargement: true,
            });
          }

          const outInfo = await pipeline
            .webp({ quality: 75, effort: 5, smartSubsample: true })
            .toFile(outDiskPath);

          totalOrigBytes += item.origBytes;
          totalOutBytes += outInfo.size;
          processed++;

          finalItems.push({
            id,
            order: seqNum,
            pillarId: item.pillarId,
            topicId: item.topicId,
            badge: item.badge,
            title: cleanHumanTitle(item.origName, item.title, seqNum),
            origName: item.origName,
            src: `./assets/library/${topicId}/${outFileName}`,
            width: outInfo.width,
            height: outInfo.height,
            sizeKB: Math.round(outInfo.size / 1024),
          });
        }),
      );
      if (processed % 64 === 0 || processed === rawCandidates.length) {
        console.log(`Converted ${processed}/${rawCandidates.length} images...`);
      }
    }
  }

  // Sort items deterministically by topic order then sequence number
  const topicOrder = Object.values(FOLDER_MAP).map((t) => t.topicId);
  finalItems.sort((a, b) => {
    const tDiff = topicOrder.indexOf(a.topicId) - topicOrder.indexOf(b.topicId);
    if (tDiff !== 0) return tDiff;
    return a.order - b.order;
  });

  // Build topic summaries with counts
  const topicsList = [];
  const seenTopics = new Set();
  for (const t of Object.values(FOLDER_MAP)) {
    if (seenTopics.has(t.topicId)) continue;
    seenTopics.add(t.topicId);
    const itemsForTopic = finalItems.filter((it) => it.topicId === t.topicId);
    if (itemsForTopic.length === 0) continue;
    topicsList.push({
      id: t.topicId,
      pillarId: t.pillarId,
      title: t.title,
      badge: t.badge,
      desc: t.desc,
      count: itemsForTopic.length,
      coverSrc: itemsForTopic[0].src,
    });
  }

  const pillarsWithCounts = PILLARS.map((p) => {
    const count = finalItems.filter((it) => it.pillarId === p.id).length;
    const topicCount = topicsList.filter((t) => t.pillarId === p.id).length;
    return { ...p, count, topicCount };
  });

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalItems: finalItems.length,
    totalTopics: topicsList.length,
    origSizeMB: Number((totalOrigBytes / (1024 * 1024)).toFixed(2)),
    compressedSizeMB: Number((totalOutBytes / (1024 * 1024)).toFixed(2)),
    pillars: pillarsWithCounts,
    topics: topicsList,
    items: finalItems,
  };

  fs.writeFileSync(outManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nDONE! Compressed ${finalItems.length} images from ${manifest.origSizeMB} MB -> ${manifest.compressedSizeMB} MB (${((1 - manifest.compressedSizeMB / manifest.origSizeMB) * 100).toFixed(1)}% saved).`);
  console.log(`Manifest written to ${outManifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
