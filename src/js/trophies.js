// ============================================================
// Behavioral Mechanics: Trophy Cabinet, 50-Level Player Ranks,
// Instant XP Economy, Milestone Celebrations, and Skill Certificates.
// Conforming to G066, G067, G068, G070, and P03.
// Designed for the 1,500-Chunk German Curriculum (A1 -> C1).
// ============================================================

import { store } from './store.js';
import { audioEngine } from './audioEngine.js';
import { openModal } from './ui.js';
import { html, icon, raw, dateLabel } from './utils.js';

// ------------------------------------------------------------
// 1. Comprehensive Badges (Achievements) for 1,500 Chunks
// ------------------------------------------------------------
export const BADGES = [
  // --- Micro-Steps & Interactions ---
  {
    id: 'first_chunk',
    category: 'practice',
    title: 'الشرارة الأولى',
    desc: 'فهمت أول شانك وحللت معناه ووظيفته بدقة.',
    icon: 'spark',
    xp: 50,
    check: (s) => Object.values(s.chunks || {}).some((c) => c.understand?.done),
  },
  {
    id: 'speak_master',
    category: 'practice',
    title: 'صوت الواثق',
    desc: 'اجتزت خطوات النطق الثلاث: بطيء، طبيعي، ومن غير ما تبص.',
    icon: 'speaker',
    xp: 75,
    check: (s) =>
      Object.values(s.chunks || {}).some(
        (c) => c.speak?.passes?.slow && c.speak?.passes?.natural && c.speak?.passes?.blind,
      ),
  },
  {
    id: 'producer_25',
    category: 'practice',
    title: 'خط الإنتاج الأول',
    desc: 'سجلت 25 إنتاجًا لجمل حقيقية مشتقة من القوالب.',
    icon: 'check',
    xp: 120,
    check: (s) => {
      const total = Object.values(s.chunks || {}).reduce((sum, c) => sum + (c.produce?.total || 0), 0);
      return total >= 25;
    },
  },
  {
    id: 'producer_100',
    category: 'practice',
    title: 'ماكينة التراكيب',
    desc: 'تجاوزت 100 إنتاج لجمل ألمانية متنوعة الأركان.',
    icon: 'check',
    xp: 250,
    check: (s) => {
      const total = Object.values(s.chunks || {}).reduce((sum, c) => sum + (c.produce?.total || 0), 0);
      return total >= 100;
    },
  },
  {
    id: 'producer_500',
    category: 'practice',
    title: 'مصنع القوالب',
    desc: 'تجاوزت 500 إنتاج جمل في رصيدك اللغوي الفعلي.',
    icon: 'check',
    xp: 750,
    check: (s) => {
      const total = Object.values(s.chunks || {}).reduce((sum, c) => sum + (c.produce?.total || 0), 0);
      return total >= 500;
    },
  },
  {
    id: 'vary_master_20',
    category: 'practice',
    title: 'فنان التنويع',
    desc: 'سجلت 20 تنويعًا ناجحًا عبر المحاور الأربعة (الفاعل، الزمن، الكلمات، الموقف).',
    icon: 'target',
    xp: 200,
    check: (s) => {
      const chunkTotal = Object.values(s.chunks || {}).reduce((sum, c) => sum + (c.vary?.items?.length || 0), 0);
      const groupTotal = Object.values(s.groups || {}).reduce((sum, g) => sum + (g.variations?.length || (g.done ? 5 : 0)), 0);
      return (chunkTotal + groupTotal) >= 20;
    },
  },
  {
    id: 'vary_master_100',
    category: 'practice',
    title: 'مهندس التحويلات',
    desc: 'سجلت 100 تنويع مرن للجمل الألمانية لتطويعها في مختلف المواقف.',
    icon: 'target',
    xp: 600,
    check: (s) => {
      const chunkTotal = Object.values(s.chunks || {}).reduce((sum, c) => sum + (c.vary?.items?.length || 0), 0);
      const groupTotal = Object.values(s.groups || {}).reduce((sum, g) => sum + (g.variations?.length || (g.done ? 5 : 0)), 0);
      return (chunkTotal + groupTotal) >= 100;
    },
  },
  {
    id: 'group_first_vary',
    category: 'practice',
    title: 'قالب متجدد',
    desc: 'أنجزت شرط الـ 5 تنويعات لأول مجموعة قوالب بنجاح.',
    icon: 'target',
    xp: 100,
    check: (s) => Object.values(s.groups || {}).some((g) => g.done || (g.variations?.length || 0) >= 5),
  },
  {
    id: 'group_first_mastery',
    category: 'mastery',
    title: 'مجموعة متقنة',
    desc: 'أتقنت جميع جمل أول مجموعة قوالب بالكامل.',
    icon: 'trophy',
    xp: 150,
    check: () => {
      if (!store.levels) return false;
      for (const level of store.levels) {
        const groups = store.getGroups(level.id);
        if (groups.some((g) => g.isMastered)) return true;
      }
      return false;
    },
  },
  {
    id: 'group_master_10',
    category: 'mastery',
    title: 'كتيبة القوالب',
    desc: 'أتقنت 10 مجموعات قوالب كاملة باحترافية وتلقائية.',
    icon: 'trophy',
    xp: 500,
    check: () => {
      if (!store.levels) return false;
      let count = 0;
      for (const level of store.levels) {
        const groups = store.getGroups(level.id);
        count += groups.filter((g) => g.isMastered).length;
      }
      return count >= 10;
    },
  },
  {
    id: 'recall_ace',
    category: 'practice',
    title: 'الاستدعاء الصاروخي',
    desc: 'حققت 5 من 5 في تمرين الاستدعاء السريع الخاطف.',
    icon: 'target',
    xp: 100,
    check: (s) => Object.values(s.chunks || {}).some((c) => c.test?.recall?.passed && c.test?.recall?.score >= 5),
  },
  {
    id: 'sprint_beast',
    category: 'practice',
    title: 'سباق الدقيقة',
    desc: 'أنتجت 5 جمل أو أكثر خلال دقيقة واحدة في سبرنت السرعة.',
    icon: 'clock',
    xp: 100,
    check: (s) => Object.values(s.chunks || {}).some((c) => (c.test?.sprint?.count || 0) >= 5),
  },
  {
    id: 'sprint_legend',
    category: 'practice',
    title: 'سبرنت الأبطال',
    desc: 'أنتجت 10 جمل أو أكثر في دقيقة واحدة بسرعة وبديهة تلقائية.',
    icon: 'clock',
    xp: 300,
    check: (s) => Object.values(s.chunks || {}).some((c) => (c.test?.sprint?.count || 0) >= 10),
  },

  // --- Chunks Mastery Milestones (1,500 Journey) ---
  {
    id: 'first_mastery',
    category: 'mastery',
    title: 'التاج الأول',
    desc: 'أتقنت أول شانك بالكامل واستوفيت كافة شروط الإتقان الـ 5.',
    icon: 'trophy',
    xp: 150,
    check: (s) => Object.values(s.chunks || {}).some((c) => c.mastery?.done),
  },
  {
    id: 'mastery_10',
    category: 'mastery',
    title: 'عاشر الشانكس',
    desc: 'أتقنت 10 شانكات كاملة بثبات واستدعاء تلقائي.',
    icon: 'trophy',
    xp: 250,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 10,
  },
  {
    id: 'mastery_50',
    category: 'mastery',
    title: 'نصف المئوية',
    desc: 'أتقنت 50 شانك متكامل في رصيدك اللغوي الدائم.',
    icon: 'trophy',
    xp: 500,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 50,
  },
  {
    id: 'mastery_100',
    category: 'mastery',
    title: 'نادي المئة',
    desc: 'كسرت حاجز الـ 100 شانك متقن — الأساس اللغوي أصبح راسخًا.',
    icon: 'trophy',
    xp: 1000,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 100,
  },
  {
    id: 'mastery_250',
    category: 'mastery',
    title: 'كتيبة الـ 250',
    desc: '250 شانك متقن جاهز للاستدعاء الفوري في أي نقاش.',
    icon: 'trophy',
    xp: 1500,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 250,
  },
  {
    id: 'mastery_500',
    category: 'mastery',
    title: 'ثلث المنهج',
    desc: 'أتقنت 500 شانك كامل — ثلث الطريق نحو الطلاقة التامة.',
    icon: 'trophy',
    xp: 2500,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 500,
  },
  {
    id: 'mastery_1000',
    category: 'mastery',
    title: 'ألفية القوالب',
    desc: 'إنجاز استثنائي: 1,000 شانك متقن في التراكيب الألمانية المعقدة.',
    icon: 'trophy',
    xp: 5000,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 1000,
  },
  {
    id: 'mastery_1500',
    category: 'mastery',
    title: 'أسطورة الـ 1,500',
    desc: 'أتممت إتقان كافة الـ 1,500 شانك في المنهج بالكامل من A1 حتى C1!',
    icon: 'trophy',
    xp: 10000,
    check: (s) => Object.values(s.chunks || {}).filter((c) => c.mastery?.done).length >= 1500,
  },

  // --- CEFR Levels Completion (300 Chunks per Level) ---
  {
    id: 'level_a1_complete',
    category: 'mastery',
    title: 'فارس مستوى A1',
    desc: 'أتقنت جميع جمل مستوى A1 الـ 300 بالكامل.',
    icon: 'trophy',
    xp: 2500,
    check: (s) => {
      const count = Object.entries(s.chunks || {}).filter(([id, c]) => id.startsWith('A1-') && c.mastery?.done).length;
      return count >= 300;
    },
  },
  {
    id: 'level_a2_complete',
    category: 'mastery',
    title: 'صقر مستوى A2',
    desc: 'أتقنت جميع جمل مستوى A2 الـ 300 بالكامل.',
    icon: 'trophy',
    xp: 3000,
    check: (s) => {
      const count = Object.entries(s.chunks || {}).filter(([id, c]) => id.startsWith('A2-') && c.mastery?.done).length;
      return count >= 300;
    },
  },
  {
    id: 'level_b1_complete',
    category: 'mastery',
    title: 'عملاق مستوى B1',
    desc: 'أتقنت جميع جمل مستوى B1 الـ 300 بالكامل وبدأت الطلاقة الحقيقية.',
    icon: 'trophy',
    xp: 3500,
    check: (s) => {
      const count = Object.entries(s.chunks || {}).filter(([id, c]) => id.startsWith('B1-') && c.mastery?.done).length;
      return count >= 300;
    },
  },
  {
    id: 'level_b2_complete',
    category: 'mastery',
    title: 'أستاذ مستوى B2',
    desc: 'أتقنت جميع جمل مستوى B2 الـ 300 بالكامل باحترافية عالية.',
    icon: 'trophy',
    xp: 4000,
    check: (s) => {
      const count = Object.entries(s.chunks || {}).filter(([id, c]) => id.startsWith('B2-') && c.mastery?.done).length;
      return count >= 300;
    },
  },
  {
    id: 'level_c1_complete',
    category: 'mastery',
    title: 'تاج الطلاقة C1',
    desc: 'أتقنت جميع جمل مستوى C1 الـ 300 بالكامل ووصلت إلى أعلى مستويات اللغة.',
    icon: 'trophy',
    xp: 5000,
    check: (s) => {
      const count = Object.entries(s.chunks || {}).filter(([id, c]) => id.startsWith('C1-') && c.mastery?.done).length;
      return count >= 300;
    },
  },

  // --- Consistency & Streaks ---
  {
    id: 'streak_3',
    category: 'streak',
    title: 'ثلاثية الانطلاق',
    desc: 'أنجزت تدريبك لـ 3 أيام متواصلة دون انقطاع.',
    icon: 'flame',
    xp: 100,
    check: () => store.streak() >= 3,
  },
  {
    id: 'streak_7',
    category: 'streak',
    title: 'شعلة الأسبوع',
    desc: 'حافظت على التدريب لـ 7 أيام متواصلة بنجاح باهر.',
    icon: 'flame',
    xp: 250,
    check: () => store.streak() >= 7,
  },
  {
    id: 'streak_14',
    category: 'streak',
    title: 'حصن الأسبوعين',
    desc: '14 يومًا متواصلًا من الممارسة الصباحية المنتظمة.',
    icon: 'flame',
    xp: 500,
    check: () => store.streak() >= 14,
  },
  {
    id: 'streak_30',
    category: 'streak',
    title: 'أسطورة الشهر',
    desc: 'شهر كامل (30 يومًا) من الممارسة والإنتاج المتواصل.',
    icon: 'flame',
    xp: 1000,
    check: () => store.streak() >= 30,
  },
  {
    id: 'streak_60',
    category: 'streak',
    title: 'عزم الستين',
    desc: '60 يومًا متواصلًا — اللغة أصبحت عادة يومية لا غنى عنها.',
    icon: 'flame',
    xp: 2000,
    check: () => store.streak() >= 60,
  },
  {
    id: 'streak_100',
    category: 'streak',
    title: 'مئوية الفولاذ',
    desc: '100 يوم تدريب متواصل — التزام حديدي استثنائي.',
    icon: 'flame',
    xp: 5000,
    check: () => store.streak() >= 100,
  },

  // --- Reviews & Memory Guard ---
  {
    id: 'review_guardian',
    category: 'mastery',
    title: 'حارس الذاكرة',
    desc: 'أكملت مراجعة 15 شانك في مواعيد التكرار المتباعد.',
    icon: 'calendar',
    xp: 150,
    check: (s) => (s.reviews || []).length >= 15,
  },
  {
    id: 'review_centurion',
    category: 'mastery',
    title: 'حامي المخزون',
    desc: 'أكملت 100 جلسة مراجعة متباعدة لحماية الذاكرة طويلة المدى.',
    icon: 'calendar',
    xp: 600,
    check: (s) => (s.reviews || []).length >= 100,
  },
];

// ------------------------------------------------------------
// 2. 50-Level Player Ranks Ladder (0 to 160,000+ XP)
// ------------------------------------------------------------
const RAW_RANK_CONFIG = [
  // Tier A1 (Levels 1 - 10)
  { level: 1, title: 'مبتدئ الشانكس', icon: '🌱', tier: 'A1', minXP: 0, maxXP: 250 },
  { level: 2, title: 'مستكشف القوالب', icon: '⚡', tier: 'A1', minXP: 250, maxXP: 600 },
  { level: 3, title: 'صانع التراكيب', icon: '🎯', tier: 'A1', minXP: 600, maxXP: 1100 },
  { level: 4, title: 'ممارس الجمل', icon: '💬', tier: 'A1', minXP: 1100, maxXP: 1750 },
  { level: 5, title: 'حاصد الكلمات', icon: '📖', tier: 'A1', minXP: 1750, maxXP: 2550 },
  { level: 6, title: 'واثق الألمانية', icon: '🌟', tier: 'A1', minXP: 2550, maxXP: 3500 },
  { level: 7, title: 'رائد النطق', icon: '🗣️', tier: 'A1', minXP: 3500, maxXP: 4650 },
  { level: 8, title: 'صياد العبارات', icon: '🏹', tier: 'A1', minXP: 4650, maxXP: 6000 },
  { level: 9, title: 'مغامر الأساسيات', icon: '🧭', tier: 'A1', minXP: 6000, maxXP: 7550 },
  { level: 10, title: 'بطل تأسيس A1', icon: '🏅', tier: 'A1', minXP: 7550, maxXP: 9300 },

  // Tier A2 (Levels 11 - 20)
  { level: 11, title: 'منطلق A2', icon: '🚀', tier: 'A2', minXP: 9300, maxXP: 11300 },
  { level: 12, title: 'متمرس التراكيب', icon: '⚙️', tier: 'A2', minXP: 11300, maxXP: 13550 },
  { level: 13, title: 'صائد المعاني', icon: '🔍', tier: 'A2', minXP: 13550, maxXP: 16050 },
  { level: 14, title: 'نبيه اللسان', icon: '💬', tier: 'A2', minXP: 16050, maxXP: 18850 },
  { level: 15, title: 'محاور الحوارات', icon: '🗣️', tier: 'A2', minXP: 18850, maxXP: 21950 },
  { level: 16, title: 'صلب الذاكرة', icon: '🧠', tier: 'A2', minXP: 21950, maxXP: 25350 },
  { level: 17, title: 'منظم العبارات', icon: '📑', tier: 'A2', minXP: 25350, maxXP: 29050 },
  { level: 18, title: 'بارع السبرنت', icon: '⚡', tier: 'A2', minXP: 29050, maxXP: 33050 },
  { level: 19, title: 'متقن القوالب', icon: '🎯', tier: 'A2', minXP: 33050, maxXP: 37400 },
  { level: 20, title: 'فارس متوسط A2', icon: '🛡️', tier: 'A2', minXP: 37400, maxXP: 42100 },

  // Tier B1 (Levels 21 - 30)
  { level: 21, title: 'رائد B1', icon: '🧭', tier: 'B1', minXP: 42100, maxXP: 47200 },
  { level: 22, title: 'متحدث طليق', icon: '🗣️', tier: 'B1', minXP: 47200, maxXP: 52700 },
  { level: 23, title: 'مهندس الحوار', icon: '📐', tier: 'B1', minXP: 52700, maxXP: 58600 },
  { level: 24, title: 'خبير القوالب', icon: '🧩', tier: 'B1', minXP: 58600, maxXP: 64900 },
  { level: 25, title: 'قائد النقاش', icon: '🎙️', tier: 'B1', minXP: 64900, maxXP: 71600 },
  { level: 26, title: 'سريع البديهة', icon: '⚡', tier: 'B1', minXP: 71600, maxXP: 78700 },
  { level: 27, title: 'متمكن B1', icon: '⚔️', tier: 'B1', minXP: 78700, maxXP: 86200 },
  { level: 28, title: 'محاور بارع', icon: '💬', tier: 'B1', minXP: 86200, maxXP: 94100 },
  { level: 29, title: 'دقيق التعبير', icon: '🎯', tier: 'B1', minXP: 94100, maxXP: 102400 },
  { level: 30, title: 'حكيم متقدم B1', icon: '🏆', tier: 'B1', minXP: 102400, maxXP: 111100 },

  // Tier B2 (Levels 31 - 40)
  { level: 31, title: 'فيلسوف التراكيب', icon: '📜', tier: 'B2', minXP: 111100, maxXP: 119800 },
  { level: 32, title: 'رائد B2', icon: '🌟', tier: 'B2', minXP: 119800, maxXP: 128600 },
  { level: 33, title: 'بليغ اللسان', icon: '🖋️', tier: 'B2', minXP: 128600, maxXP: 137500 },
  { level: 34, title: 'عميد الشانكس', icon: '🏛️', tier: 'B2', minXP: 137500, maxXP: 146500 },
  { level: 35, title: 'فصيح الجمل', icon: '💎', tier: 'B2', minXP: 146500, maxXP: 155600 },
  { level: 36, title: 'محلل الألمانية', icon: '🔬', tier: 'B2', minXP: 155600, maxXP: 164800 },
  { level: 37, title: 'أستاذ B2', icon: '🎓', tier: 'B2', minXP: 164800, maxXP: 174100 },
  { level: 38, title: 'مايسترو اللغة', icon: '🎼', tier: 'B2', minXP: 174100, maxXP: 183500 },
  { level: 39, title: 'صقر التراكيب', icon: '🦅', tier: 'B2', minXP: 183500, maxXP: 193000 },
  { level: 40, title: 'عبقري احترافي B2', icon: '🔮', tier: 'B2', minXP: 193000, maxXP: 202600 },

  // Tier C1 (Levels 41 - 50)
  { level: 41, title: 'فارس C1 الأسطوري', icon: '⚔️', tier: 'C1', minXP: 202600, maxXP: 212300 },
  { level: 42, title: 'متحدث أصيل C1', icon: '🗣️', tier: 'C1', minXP: 212300, maxXP: 222100 },
  { level: 43, title: 'حكيم اللغة', icon: '📜', tier: 'C1', minXP: 222100, maxXP: 232000 },
  { level: 44, title: 'أسطورة الشانكس', icon: '🌌', tier: 'C1', minXP: 232000, maxXP: 242000 },
  { level: 45, title: 'سلطان الفصاحة', icon: '👑', tier: 'C1', minXP: 242000, maxXP: 252100 },
  { level: 46, title: 'داهية التعبير', icon: '⚡', tier: 'C1', minXP: 252100, maxXP: 262300 },
  { level: 47, title: 'ملك الطلاقة', icon: '🏰', tier: 'C1', minXP: 262300, maxXP: 272600 },
  { level: 48, title: 'إمبراطور القوالب', icon: '🪐', tier: 'C1', minXP: 272600, maxXP: 283000 },
  { level: 49, title: 'مرجع الألمانية الأكبر', icon: '📚', tier: 'C1', minXP: 283000, maxXP: 293500 },
  { level: 50, title: 'فخر الفايكس — أستاذ الألمانية C1', icon: '👑', tier: 'C1', minXP: 293500, maxXP: Infinity },
];

export const RANKS = RAW_RANK_CONFIG;

// ------------------------------------------------------------
// 3. Trophy & XP Manager Class
// ------------------------------------------------------------
export class TrophyManager {
  constructor() {
    this.seenCelebrations = this.loadSeenCelebrations();
    this.levelUpListeners = new Set();
  }

  loadSeenCelebrations() {
    try {
      const raw = localStorage.getItem('chunk_seen_celebrations');
      if (raw === null) {
        // First boot: mark existing unlocked badges as seen to avoid initial popup spam
        const initialSet = new Set();
        try {
          const s = store.state || {};
          for (const b of BADGES) {
            if (b.check(s)) initialSet.add(b.id);
          }
          localStorage.setItem('chunk_seen_celebrations', JSON.stringify([...initialSet]));
        } catch {}
        return initialSet;
      }
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  }

  saveSeenCelebration(badgeId) {
    this.seenCelebrations.add(badgeId);
    try {
      localStorage.setItem('chunk_seen_celebrations', JSON.stringify([...this.seenCelebrations]));
    } catch {}
  }

  // ------------------------------------------------------------
  // Deterministic, Idempotent XP Calculation (G067)
  // Perfectly calibrated for 1,500 Chunks (~150,000+ XP scale)
  // ------------------------------------------------------------
  calculateXP() {
    const s = store.state || {};
    let xp = 0;

    for (const chunk of Object.values(s.chunks || {})) {
      // Step 1: افهم الـ Chunk (+10 XP)
      if (chunk.understand?.done) xp += 10;

      // Step 2: انطقه بصوت عالي (+15 XP total: 5 slow + 5 natural + 5 blind)
      const sp = chunk.speak?.passes;
      if (sp) {
        if (sp.slow) xp += 5;
        if (sp.natural) xp += 5;
        if (sp.blind) xp += 5;
      }

      // Step 3: درّب عليه 30 إنتاج (+20 XP for 10+ productions target)
      const totalProd = chunk.produce?.total || 0;
      if (totalProd >= 10) xp += 20;
      else if (totalProd > 0) xp += Math.min(18, totalProd * 2);

      // Step 4: غيّر كل مرة (+5 XP per axis up to 20 XP + 10 XP bonus for all 4 axes = 30 XP)
      if (chunk.vary?.importedDone) {
        xp += 30;
      } else {
        const axesUsed = new Set((chunk.vary?.items || []).map((it) => it.axis));
        xp += axesUsed.size * 5;
        if (axesUsed.size >= 4) xp += 10; // Bonus for covering all 4 axes
      }

      // Step 5: اختبر نفسك (+25 XP recall pass, +15 sprint bonus, +10 speaking bonus)
      if (chunk.test?.recall?.passed) xp += 25;
      if ((chunk.test?.sprint?.count || 0) >= 5) xp += 15;
      if ((chunk.test?.speaking?.seconds || 0) >= 30) xp += 10;

      // Mastery Crown (+20 XP)
      if (chunk.mastery?.done) xp += 20;
    }

    // Group Variations Bonus: +50 XP per group with 5 variations completed
    for (const group of Object.values(s.groups || {})) {
      if (group.done || (group.variations?.length || 0) >= 5) {
        xp += 50;
      }
    }

    // Group Full Mastery Bonus: +100 XP per fully mastered group
    if (store.levels) {
      for (const level of store.levels) {
        const groups = store.getGroups(level.id);
        for (const grp of groups) {
          if (grp.isMastered) {
            xp += 100;
          }
        }
      }
    }

    // Spaced Repetition Reviews: +15 XP each
    const reviewsCount = (s.reviews || []).length;
    xp += reviewsCount * 15;

    // Daily Streak: +25 XP per day in current streak
    const streak = store.streak();
    xp += streak * 25;

    // Badges Rewards
    for (const badge of BADGES) {
      if (badge.check(s)) {
        xp += badge.xp;
      }
    }

    return xp;
  }

  // Itemized breakdown of XP earned specifically on a single chunk
  getChunkXPEarned(chunkId) {
    const rec = store.peek(chunkId);
    const groupPos = store.getGroupPosition(chunkId);
    if (!rec && !groupPos?.group?.variationDone && !groupPos?.group?.isMastered) {
      return { total: 0, breakdown: [] };
    }
    const breakdown = [];
    let total = 0;

    if (rec?.understand?.done) {
      breakdown.push({ label: 'فهم الجملة وتحديد وظيفتها', xp: 10, icon: 'eye' });
      total += 10;
    }

    const sp = rec?.speak?.passes;
    let speakXP = 0;
    if (sp?.slow) speakXP += 5;
    if (sp?.natural) speakXP += 5;
    if (sp?.blind) speakXP += 5;
    if (speakXP > 0) {
      breakdown.push({ label: `النطق ثلاثي المراحل (${speakXP}/15)`, xp: speakXP, icon: 'speaker' });
      total += speakXP;
    }

    const totalProd = rec?.produce?.total || 0;
    const prodXP = totalProd >= 10 ? 20 : totalProd * 2;
    if (prodXP > 0) {
      breakdown.push({ label: `إنتاج الجمل (${totalProd} من 30)`, xp: prodXP, icon: 'check' });
      total += prodXP;
    }

    let varyXP = 0;
    if (rec?.vary?.importedDone) {
      varyXP = 30;
      breakdown.push({ label: 'تغطية محاور التنويع الأربعة (+10 بونص)', xp: 30, icon: 'spark' });
    } else if (rec?.vary?.items?.length) {
      const axes = new Set((rec.vary.items || []).map((it) => it.axis));
      varyXP = axes.size * 5 + (axes.size >= 4 ? 10 : 0);
      if (varyXP > 0) {
        breakdown.push({
          label: `تنويع القوالب (${axes.size} محاور${axes.size >= 4 ? ' + بونص' : ''})`,
          xp: varyXP,
          icon: 'spark',
        });
      }
    }
    total += varyXP;

    if (rec?.test?.recall?.passed) {
      breakdown.push({ label: 'اجتياز الاستدعاء السريع (4+/5)', xp: 25, icon: 'target' });
      total += 25;
    }

    if ((rec?.test?.sprint?.count || 0) >= 5) {
      breakdown.push({ label: `بونص سرعة السبرنت (${rec.test.sprint.count} جمل/د)`, xp: 15, icon: 'clock' });
      total += 15;
    }

    if ((rec?.test?.speaking?.seconds || 0) >= 30) {
      breakdown.push({ label: 'بونص الكلام المرتجل بالألماني', xp: 10, icon: 'mic' });
      total += 10;
    }

    if (rec?.mastery?.done) {
      breakdown.push({ label: 'تاج الإتقان الشامل للمراجعة', xp: 20, icon: 'trophy' });
      total += 20;
    }

    if (groupPos?.group) {
      if (groupPos.group.variationDone) {
        breakdown.push({ label: 'إنجاز تنويعات قالب المجموعة (+50 بونص)', xp: 50, icon: 'target' });
        total += 50;
      }
      if (groupPos.group.isMastered) {
        breakdown.push({ label: 'إتقان مجموعة القالب بالكامل (+100 بونص)', xp: 100, icon: 'trophy' });
        total += 100;
      }
    }

    return { total, breakdown };
  }

  // ------------------------------------------------------------
  // Rank and Level Info Calculation
  // ------------------------------------------------------------
  getRankInfo(xp = this.calculateXP()) {
    let current = RANKS[0];
    let next = RANKS[1];

    for (let i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].minXP) {
        current = RANKS[i];
        next = RANKS[i + 1] || null;
      }
    }

    let progressPct = 100;
    let remainingXP = 0;

    if (next && next.minXP < Infinity) {
      const span = next.minXP - current.minXP;
      const progressInSpan = xp - current.minXP;
      progressPct = Math.min(100, Math.max(0, Math.round((progressInSpan / span) * 100)));
      remainingXP = Math.max(0, next.minXP - xp);
    }

    // Overall 1,500 Chunks Curriculum progress
    const overallMastered = store.overall().mastered || 0;
    const curriculumPct = Math.min(100, Math.round((overallMastered / 1500) * 100));

    return {
      current,
      next,
      xp,
      progressPct,
      remainingXP,
      overallMastered,
      curriculumPct,
      totalLevels: RANKS.length,
    };
  }

  getBadgeStatus(badgeId) {
    const badge = BADGES.find((b) => b.id === badgeId);
    if (!badge) return null;
    return {
      ...badge,
      unlocked: badge.check(store.state),
    };
  }

  getAllBadges() {
    return BADGES.map((b) => ({
      ...b,
      unlocked: b.check(store.state),
    }));
  }

  // Check and trigger new milestone celebrations (G068)
  checkMilestones() {
    if (typeof document !== 'undefined' && document.querySelector('.modal-backdrop, .modal-dialog')) {
      return; // Do not interrupt an active modal
    }
    const badges = this.getAllBadges();
    for (const badge of badges) {
      if (badge.unlocked && !this.seenCelebrations.has(badge.id)) {
        this.saveSeenCelebration(badge.id);
        this.showMilestoneCelebration(badge);
        break; // Show one celebration at a time to prevent modal spam
      }
    }
  }

  // Milestone celebration modal (G068)
  showMilestoneCelebration(badge) {
    audioEngine.playNewPR();

    const content = html`
      <div class="celebration-modal" style="text-align:center;padding:12px 6px">
        <div class="celebration-badge-anim">
          <div class="badge-icon-lg">${icon(badge.icon || 'trophy')}</div>
        </div>
        <span class="eyebrow" style="color:var(--yellow);margin-top:12px;display:inline-block">إنجاز جديد معتمد!</span>
        <h2 style="font-size:26px;margin:6px 0 8px">${badge.title}</h2>
        <p style="color:var(--muted);font-size:15px;line-height:1.6;margin-bottom:16px">${badge.desc}</p>
        <div class="xp-award-pill">
          ${icon('spark')}
          <span>+<b>${badge.xp}</b> نقطة إتقان (XP)</span>
        </div>
        <div class="modal-actions" style="justify-content:center;margin-top:22px">
          <button class="btn btn-primary" data-dismiss-celebration>استمر في التدريب ${icon('check')}</button>
        </div>
      </div>
    `;

    const modal = openModal(content, {
      className: 'celebration-dialog',
    });

    modal.root.querySelector('[data-dismiss-celebration]')?.addEventListener('click', () => {
      audioEngine.playTap();
      modal.close();
    });
  }

  // ------------------------------------------------------------
  // Printable & Verified Skill Certificate Modal (G070)
  // Perfectly calibrated for 300 chunks per level (1,500 total)
  // ------------------------------------------------------------
  openCertificateModal(levelId = 'A1') {
    audioEngine.playWorkoutComplete();
    const stats = store.levelStats(levelId);
    const rankInfo = this.getRankInfo();
    const defaultName = localStorage.getItem('chunk_cert_name') || 'متعلّم الشانكس الألمانية';
    const certId = `CT-${levelId}-${Math.abs(hashString(defaultName + levelId)).toString(16).toUpperCase()}`;

    const content = html`
      <div class="cert-modal-wrap">
        <div class="cert-actions-top no-print">
          <div class="cert-name-input-group">
            <label for="cert-name-field">الاسم على الشهادة:</label>
            <input type="text" id="cert-name-field" value="${defaultName}" class="input-text" maxlength="40" />
          </div>
          <div class="row">
            <button class="btn btn-primary btn-sm" id="cert-print-btn">${icon('download')} طباعة / حفظ PDF</button>
            <button class="btn btn-ghost btn-sm" id="cert-close-btn">${icon('close')} إغلاق</button>
          </div>
        </div>

        <div class="skill-certificate" id="printable-certificate">
          <div class="cert-border-outer">
            <div class="cert-border-inner">
              <div class="cert-header">
                <div class="cert-seal">${icon('trophy')}</div>
                <div class="cert-org">دليل الفايكس · CHUNKTRAINER DEUTSCH</div>
                <h1 class="cert-title">شهادة إتقان المهارة اللغوية</h1>
                <p class="cert-subtitle">OFFICIAL SKILL & MASTERY CERTIFICATE · CEFR ${levelId}</p>
              </div>

              <div class="cert-body">
                <p class="cert-prose-intro">يشهد نظام دليل الفايكس التفاعلي بأن المتعلم(ة):</p>
                <div class="cert-recipient" id="cert-recipient-display">${defaultName}</div>
                <p class="cert-prose-desc">
                  قد أتم بنجاح متطلبات الإتقان المعياري في التراكيب والقوالب اللغوية لمستوى
                  <strong class="cert-level-tag">المستوى ${levelId}</strong> (بإجمالي 300 شانك)،
                  واستوفى شروط الفهم المباشر، النطق ثلاثي المراحل، إنتاج الجمل المتعدد،
                  واختبارات السرعة والتكرار المتباعد بمعدل إتقان استثنائي.
                </p>

                <div class="cert-stats-grid">
                  <div class="cert-stat-box">
                    <span class="cert-stat-val">${stats.mastered} / 300</span>
                    <span class="cert-stat-lbl">شانك متقن في المستوى</span>
                  </div>
                  <div class="cert-stat-box">
                    <span class="cert-stat-val">${rankInfo.xp.toLocaleString()}</span>
                    <span class="cert-stat-lbl">إجمالي نقاط الـ XP</span>
                  </div>
                  <div class="cert-stat-box">
                    <span class="cert-stat-val">${store.streak()} أيام</span>
                    <span class="cert-stat-lbl">أطول سلسلة متواصلة</span>
                  </div>
                </div>
              </div>

              <div class="cert-footer">
                <div class="cert-col">
                  <div class="cert-sign-line"></div>
                  <span>تاريخ الاعتماد: ${dateLabel(new Date())}</span>
                </div>
                <div class="cert-col cert-badge-col">
                  <div class="cert-emblem">معتمد رقميًا</div>
                  <span class="cert-serial">رمز التحقق: ${certId}</span>
                </div>
                <div class="cert-col">
                  <div class="cert-sign-line"></div>
                  <span>نظام إدارة التدريب المحلي (CEFR Engine)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = openModal(content, {
      className: 'cert-dialog-window',
    });

    const nameField = modal.root.querySelector('#cert-name-field');
    const displayField = modal.root.querySelector('#cert-recipient-display');

    nameField?.addEventListener('input', (e) => {
      const val = e.target.value.trim() || 'متعلّم الشانكس الألمانية';
      if (displayField) displayField.textContent = val;
      try {
        localStorage.setItem('chunk_cert_name', val);
      } catch {}
    });

    modal.root.querySelector('#cert-print-btn')?.addEventListener('click', () => {
      audioEngine.playTap();
      window.print();
    });

    modal.root.querySelector('#cert-close-btn')?.addEventListener('click', () => {
      audioEngine.playTap();
      modal.close();
    });
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const trophyManager = new TrophyManager();
