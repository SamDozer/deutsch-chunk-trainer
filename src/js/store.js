// Single source of truth. Every mutation is persisted to disk through the
// Electron bridge (with a localStorage fallback for plain-browser previews).
import {
  addDays,
  addHours,
  clamp,
  dayKey,
  dayStart,
  debounce,
  daysBetween,
} from './utils.js';

export const STAGES = [
  { key: 'understand', title: 'افهم الـChunk', short: 'افهم', hint: 'اقرأ، افهم المعنى، شوف الوظيفة' },
  { key: 'speak', title: 'انطقه بصوت عالي', short: 'انطق', hint: 'بطيء، طبيعي، وبعدين من غير ما تبص' },
  { key: 'produce', title: 'درّب عليه 30 إنتاج', short: 'درّب', hint: '10 + 5 + 5 + 5 + 5 على أيام' },
  { key: 'test', title: 'اختبر نفسك', short: 'اختبر', hint: 'استدعاء سريع، سرعة، كلام مرتجل' },
  { key: 'vary', title: 'المرحلة الختامية: غيّر كل مرة', short: 'التنويع', hint: '5 تنويعات شاملة لقالب المجموعة' },
];

export const PRODUCE_PLAN = [
  { amount: 10, label: 'الجلسة الأولى', sub: '10 جمل مختلفة', hours: 0 },
  { amount: 5, label: 'بعد عدة ساعات', sub: 'نفس اليوم', hours: 4 },
  { amount: 5, label: 'اليوم التالي', sub: 'بعد 24 ساعة', hours: 24 },
  { amount: 5, label: 'بعد 3 أيام', sub: 'مراجعة', hours: 72 },
  { amount: 5, label: 'بعد 7 أيام', sub: 'مراجعة', hours: 168 },
];

export const VARIATION_AXES = [
  { key: 'subject', title: 'غيّر الفاعل', hint: 'مثال: ich ← wir / du / er / die Leute' },
  { key: 'tense', title: 'غيّر الزمن', hint: 'مثال: حاضر ← ماضي / مستقبل / شرط' },
  { key: 'words', title: 'غيّر الكلمات', hint: 'بدّل الاسم أو الصفة أو المفعول' },
  { key: 'situation', title: 'غيّر الموقف', hint: 'نفس الجملة في مطعم / شغل / سفر' },
];

export const FUNCTIONS = ['رأي', 'مقارنة', 'سبب', 'نتيجة', 'طلب', 'رفض', 'رد', 'اقتراح'];

const AXIS_TITLE = Object.fromEntries(VARIATION_AXES.map((a) => [a.key, a.title]));

const nowIso = () => new Date().toISOString();

const emptyRecord = () => ({
  understand: { done: false, at: null, func: null, checks: {} },
  speak: { passes: { slow: false, natural: false, blind: false }, count: 0, at: null },
  produce: { total: 0, log: [] },
  vary: { items: [], at: null, importedDone: false },
  test: {
    recall: { score: 0, total: 5, at: null, passed: false },
    variation: { count: 0, at: null },
    sprint: { count: 0, at: null },
    speaking: { seconds: 0, at: null, note: '' },
    delayed: { passed: false, at: null },
  },
  mastery: { done: false, at: null },
  review: { due: null, interval: 0, reps: 0, lastGrade: null, lastAt: null },
  seconds: 0,
  lastAt: null,
  imported: [],
  notes: '',
});

const defaultSettings = () => ({
  dailyGoal: 25,
  theme: 'light',
  tts: true,
  ttsRate: 0.95,
  voice: '',
});

const defaultState = () => ({
  v: 1,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  settings: defaultSettings(),
  pointer: null,
  days: {},
  chunks: {},
  groups: {},
  reviews: [],
  meta: { importedObsidian: false, importedAt: null, importedCount: 0 },
});

export function getChunkGroupInfo(chunk, levelId) {
  if (!chunk) return { groupId: 'other', title: 'عبارات متنوعة', key: 'other' };
  const lv = levelId || chunk.level || (chunk.id ? chunk.id.split('-')[0] : 'A1');
  let title = (chunk.template || '').trim();
  if (!title && chunk.family) {
    const famPart = chunk.family.split(':')[1] || chunk.family;
    title = famPart.trim();
  }
  if (!title) {
    const words = (chunk.de || '').trim().split(/\s+/).slice(0, 2).join(' ');
    title = words ? `${words} …` : 'عبارات متنوعة';
  }
  const cleanKey = title.replace(/[.…]+$/, '').trim().toLowerCase();
  return {
    groupId: `${lv}::${cleanKey}`,
    title: title.includes('…') ? title : `${title} …`,
    key: cleanKey,
  };
}

function stageFlags(rec, groupVariationDone = false) {
  const speak = rec.speak?.passes?.slow && rec.speak?.passes?.natural && rec.speak?.passes?.blind;
  const immediateTestsPassed = Boolean(
    rec.test?.recall?.passed &&
      rec.test?.sprint?.count >= 5 &&
      rec.test?.speaking?.seconds >= 30,
  );
  const variationDone =
    groupVariationDone ||
    (rec.vary?.items?.length || 0) >= 5 ||
    (rec.test?.variation?.count || 0) >= 5 ||
    Boolean(rec.vary?.importedDone);

  return [
    Boolean(rec.understand?.done),
    Boolean(speak),
    (rec.produce?.total || 0) >= 10,
    immediateTestsPassed,
    variationDone,
    Boolean(rec.mastery?.done),
  ];
}

class Store {
  constructor() {
    this.data = null;
    this.state = defaultState();
    this.loaded = false;
    this.onSaved = null;
    this.onChange = null;
    this.api = typeof window !== 'undefined' ? window.chunkAPI : undefined;
    this.save = debounce(() => this.persist(), 180);
  }

  async init() {
    let payload = null;
    if (this.api) {
      payload = await this.api.getChunks();
    } else if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      payload = await (await fetch(new URL('../../data/chunks.json', import.meta.url))).json();
    } else {
      const fs = await import('node:fs');
      payload = JSON.parse(fs.readFileSync(new URL('../../data/chunks.json', import.meta.url), 'utf8'));
    }
    if (!payload || !payload.levels) throw new Error('ملفات الشانكس مش موجودة');
    this.data = payload;
    this.levels = payload.levels.map((level) => ({
      ...level,
      chunks: level.chunks.map((chunk, index) => {
        const groupInfo = getChunkGroupInfo(chunk, level.id);
        return {
          ...chunk,
          level: level.id,
          levelTitle: level.title,
          index,
          groupId: groupInfo.groupId,
          groupTitle: groupInfo.title,
          groupKey: groupInfo.key,
        };
      }),
    }));
    this.byId = new Map();
    this.levelMap = new Map();
    for (const level of this.levels) {
      this.levelMap.set(level.id, level);
      for (const chunk of level.chunks) this.byId.set(chunk.id, chunk);
    }

    let loadedState = null;
    if (this.api) {
      const loaded = await this.api.loadState();
      loadedState = loaded?.state || null;
      this.paths = loaded;
    } else {
      try {
        loadedState = JSON.parse(localStorage.getItem('chunk-trainer-state') || 'null');
      } catch {
        loadedState = null;
      }
    }

    this.state = this.normalize(loadedState);
    if (!this.state.meta.importedObsidian) {
      this.state.meta.importedObsidian = true;
    }
    this.freshImport = false;
    if (!this.state.pointer) this.state.pointer = this.firstUnfinishedPointer();
    this.loaded = true;
    this.save();
    return this.state;
  }

  normalize(loaded) {
    if (!loaded || typeof loaded !== 'object') return defaultState();
    const base = defaultState();
    const state = {
      ...base,
      ...loaded,
      settings: { ...base.settings, ...(loaded.settings || {}) },
      days: loaded.days || {},
      chunks: loaded.chunks || {},
      groups: loaded.groups || {},
      reviews: loaded.reviews || [],
      meta: { ...base.meta, ...(loaded.meta || {}) },
      pointer: loaded.pointer || null,
    };
    for (const [id, rec] of Object.entries(state.chunks)) {
      // Clean up spurious B2/C1 entries caused by leaked modals if they have no real user content
      if ((id.startsWith('B2-') || id.startsWith('C1-')) && (!rec.vary?.items?.length && !rec.notes && !rec.mastery?.done)) {
        delete state.chunks[id];
        continue;
      }
      state.chunks[id] = this.normalizeRecord(rec);
    }
    // Auto-migrate any existing chunk variations into group variations (Zero Data Loss)
    for (const [id, rec] of Object.entries(state.chunks)) {
      if (!rec.vary?.items?.length && !rec.vary?.importedDone) continue;
      const lv = id.split('-')[0];
      const chunk = this.byId?.get(id);
      const groupInfo = getChunkGroupInfo(chunk || { id }, lv);
      const gid = groupInfo.groupId;
      if (!state.groups[gid]) {
        state.groups[gid] = { variations: [], done: false, at: null };
      }
      const grp = state.groups[gid];
      if (rec.vary?.importedDone) grp.done = true;
      for (const item of rec.vary?.items || []) {
        const text = String(item.text || '').trim();
        if (!text) continue;
        const exists = grp.variations.some(
          (v) => v.text.trim().toLowerCase() === text.toLowerCase(),
        );
        if (!exists) {
          grp.variations.push({
            axis: item.axis || 'words',
            text,
            at: item.at || nowIso(),
          });
        }
      }
      if (grp.variations.length >= 5) grp.done = true;
    }
    for (const day of Object.values(state.days)) {
      if (Array.isArray(day.chunks)) {
        day.chunks = day.chunks.filter((cid) => state.chunks[cid] || (!cid.startsWith('B2-') && !cid.startsWith('C1-')));
      }
    }
    return state;
  }

  normalizeRecord(rec) {
    const base = emptyRecord();
    return {
      ...base,
      ...rec,
      understand: { ...base.understand, ...(rec.understand || {}) },
      speak: { ...base.speak, ...(rec.speak || {}), passes: { ...base.speak.passes, ...(rec.speak?.passes || {}) } },
      produce: { ...base.produce, ...(rec.produce || {}), log: rec.produce?.log?.slice(-40) || [] },
      vary: { ...base.vary, ...(rec.vary || {}), items: rec.vary?.items || [] },
      test: {
        recall: { ...base.test.recall, ...(rec.test?.recall || {}) },
        variation: { ...base.test.variation, ...(rec.test?.variation || {}) },
        sprint: { ...base.test.sprint, ...(rec.test?.sprint || {}) },
        speaking: { ...base.test.speaking, ...(rec.test?.speaking || {}) },
        delayed: { ...base.test.delayed, ...(rec.test?.delayed || {}) },
      },
      mastery: { ...base.mastery, ...(rec.mastery || {}) },
      review: { ...base.review, ...(rec.review || {}) },
      imported: rec.imported || [],
    };
  }

  // ---------- persistence ----------

  async persist() {
    this.state.updatedAt = nowIso();
    try {
      if (this.api) await this.api.saveState(this.state);
      else if (typeof localStorage !== 'undefined') localStorage.setItem('chunk-trainer-state', JSON.stringify(this.state));
      this.onSaved?.(this.state.updatedAt);
    } catch (error) {
      console.error('save failed', error);
      this.onSaved?.(null);
    }
  }

  async flush() {
    this.save.cancel();
    await this.persist();
  }

  touch() {
    this._dueCache = null;
    this.save();
    this.onChange?.();
  }

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.touch();
  }

  // ---------- records ----------

  record(id) {
    if (!this.state.chunks[id]) this.state.chunks[id] = emptyRecord();
    return this.state.chunks[id];
  }

  peek(id) {
    return this.state.chunks[id] || null;
  }

  chunk(id) {
    return this.byId.get(id) || null;
  }

  level(id) {
    return this.levelMap.get(id) || null;
  }

  levelOf(id) {
    return id ? id.split('-')[0] : null;
  }

  stageFlags(id) {
    const rec = this.peek(id);
    const chunk = this.chunk(id);
    const lv = this.levelOf(id);
    const gid = chunk?.groupId || (chunk ? getChunkGroupInfo(chunk, lv).groupId : null);
    const groupDone = gid ? this.isGroupVariationDone(gid) : false;
    return stageFlags(rec || emptyRecord(), groupDone);
  }

  stageDone(id, stageIndex) {
    return this.stageFlags(id)[stageIndex];
  }

  completedCount(id) {
    return this.stageFlags(id).filter(Boolean).length;
  }

  status(id) {
    const rec = this.peek(id);
    if (!rec) return 'new';
    if (rec.mastery?.done) return 'mastered';
    if (this.completedCount(id) > 0 || (rec.produce?.total || 0) > 0) return 'learning';
    return 'new';
  }

  sessionPhase(id) {
    const rec = this.peek(id);
    if (!rec) return { code: 'new', label: 'جديد', step: 1 };
    if (rec.mastery?.done) return { code: 'mastered', label: 'متقن ومراجعته مجدولة', step: 6 };
    const prodTotal = rec.produce?.total || 0;
    const batches = this.batchState(id);
    const doneBatches = batches.filter((b) => b.done).length;
    const nextBatch = batches.find((b) => !b.done);
    if (prodTotal >= 30) {
      return { code: 'all_sessions', label: '30/30 إنتاج مكتمل', step: 4 };
    }
    if (prodTotal >= 10) {
      if (nextBatch?.overdue) {
        return { code: 'session_due', label: `جلسة ${nextBatch.index + 1} مستحقة الآن`, step: 3 };
      }
      return { code: 'session1_done', label: `جلسة 1 تمت · (${doneBatches}/5 جلسات)`, step: 4 };
    }
    if (prodTotal > 0) {
      return { code: 'session1_prog', label: `جلسة 1 (${prodTotal}/10)`, step: 3 };
    }
    const currentStep = this.currentStep(id);
    if (currentStep > 1) {
      return { code: 'learning', label: `خطوة ${currentStep} من 4`, step: currentStep };
    }
    return { code: 'new', label: 'جديد', step: 1 };
  }

  currentStep(id) {
    const flags = this.stageFlags(id);
    if (!flags[0]) return 1;
    if (!flags[1]) return 2;
    if (!flags[2]) return 3;
    if (!flags[3]) return 4;
    const groupPos = this.getGroupPosition(id);
    if (groupPos && !groupPos.nextChunk && !flags[4]) {
      return 5;
    }
    return 4;
  }

  // ---------- day / stats ----------

  day(date = new Date()) {
    const key = dayKey(date);
    if (!this.state.days[key]) this.state.days[key] = { prod: 0, minutes: 0, reviews: 0, chunks: [] };
    return this.state.days[key];
  }

  today() {
    return this.day();
  }

  addProduction(id, amount) {
    const rec = this.record(id);
    const at = nowIso();
    rec.produce.log.push({ at, amount });
    rec.produce.total = rec.produce.log.reduce((sum, entry) => sum + entry.amount, 0);
    rec.lastAt = at;
    if (!this.day().chunks.includes(id)) this.day().chunks.push(id);
    this.day().prod += amount;
    this.touch();
    return rec.produce.total;
  }

  addExtraProduction(id, amount = 1) {
    return this.addProduction(id, amount);
  }

  batchState(id) {
    const rec = this.record(id);
    const log = rec.produce.log;
    const first = log[0]?.at ? new Date(log[0].at) : null;
    const allDone = (rec.produce.total || 0) >= 30;
    return PRODUCE_PLAN.map((plan, index) => {
      const entry = log[index];
      const due = first ? addHours(first, plan.hours) : null;
      return {
        ...plan,
        index,
        entry,
        done: Boolean(entry) || allDone,
        due,
        isNext: !entry && !allDone && (index === 0 ? true : Boolean(log[index - 1])),
        overdue: Boolean(due && !entry && due <= new Date()),
      };
    });
  }

  nextBatch(id) {
    return this.batchState(id).find((batch) => !batch.done) || null;
  }

  addVariation(id, axis, text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const rec = this.record(id);
    rec.vary.items.push({ axis, text: clean, at: nowIso() });
    rec.vary.at = nowIso();
    rec.test.variation.count = Math.max(rec.test.variation.count, rec.vary.items.length);
    if (rec.vary.items.length >= 5) rec.test.variation.at = rec.test.variation.at || nowIso();
    rec.lastAt = nowIso();
    if (!this.day().chunks.includes(id)) this.day().chunks.push(id);

    // Sync to group
    const chunk = this.chunk(id);
    const lv = this.levelOf(id);
    const gid = chunk?.groupId || (chunk ? getChunkGroupInfo(chunk, lv).groupId : null);
    if (gid) {
      const grp = this.getGroupRecord(gid);
      const exists = grp.variations.some((v) => v.text.trim().toLowerCase() === clean.toLowerCase());
      if (!exists) {
        grp.variations.push({ axis, text: clean, at: nowIso() });
        grp.at = nowIso();
        if (grp.variations.length >= 5) grp.done = true;
      }
    }

    this.touch();
  }

  removeVariation(id, index) {
    const rec = this.record(id);
    rec.vary.items.splice(index, 1);
    rec.test.variation.count = rec.vary.items.length;
    this.touch();
  }

  variationCoverage(id) {
    const rec = this.record(id);
    const chunk = this.chunk(id);
    const axes = new Set((rec.vary?.items || []).map((item) => item.axis));
    const lv = this.levelOf(id);
    const gid = chunk?.groupId || (chunk ? getChunkGroupInfo(chunk, lv).groupId : null);
    if (gid) {
      const groupVars = this.getGroupVariations(gid);
      for (const gv of groupVars) {
        if (gv.axis) axes.add(gv.axis);
      }
    }
    return VARIATION_AXES.filter((axis) => axes.has(axis.key)).length;
  }

  siblings(id, limit = 4) {
    const chunk = this.chunk(id);
    if (!chunk?.family) return [];
    const level = this.level(chunk.level);
    return level.chunks
      .filter((c) => c.family === chunk.family && c.id !== id)
      .slice(0, limit);
  }

  // ---------- chunk groups & template packs ----------

  getGroupRecord(groupId) {
    if (!this.state.groups) this.state.groups = {};
    if (!this.state.groups[groupId]) {
      this.state.groups[groupId] = { variations: [], done: false, at: null };
    }
    return this.state.groups[groupId];
  }

  isGroupVariationDone(groupId) {
    const rec = this.state.groups?.[groupId];
    if (!rec) return false;
    return Boolean(rec.done || (rec.variations?.length || 0) >= 5);
  }

  getGroupVariations(groupId) {
    return this.state.groups?.[groupId]?.variations || [];
  }

  addGroupVariation(groupId, axis, text) {
    const clean = String(text || '').trim();
    if (!clean) return 0;
    const rec = this.getGroupRecord(groupId);
    const exists = rec.variations.some((v) => v.text.trim().toLowerCase() === clean.toLowerCase());
    if (!exists) {
      rec.variations.push({ axis: axis || 'words', text: clean, at: nowIso() });
      rec.at = nowIso();
    }
    if (rec.variations.length >= 5) {
      rec.done = true;
    }
    this.touch();
    return rec.variations.length;
  }

  removeGroupVariation(groupId, index) {
    const rec = this.getGroupRecord(groupId);
    rec.variations.splice(index, 1);
    rec.done = rec.variations.length >= 5;
    this.touch();
  }

  setGroupVariationDone(groupId, done = true) {
    const rec = this.getGroupRecord(groupId);
    rec.done = Boolean(done);
    rec.at = nowIso();
    this.touch();
  }

  getGroups(levelId) {
    const level = this.level(levelId);
    if (!level) return [];
    const map = new Map();
    for (const chunk of level.chunks) {
      const gid = chunk.groupId;
      if (!map.has(gid)) {
        map.set(gid, {
          id: gid,
          levelId,
          title: chunk.groupTitle,
          key: chunk.groupKey,
          chunks: [],
        });
      }
      map.get(gid).chunks.push(chunk);
    }
    const list = [];
    for (const grp of map.values()) {
      let masteredCount = 0;
      let learningCount = 0;
      for (const c of grp.chunks) {
        const st = this.status(c.id);
        if (st === 'mastered') masteredCount++;
        else if (st === 'learning') learningCount++;
      }
      const total = grp.chunks.length;
      const isMastered = total > 0 && masteredCount === total;
      const firstUnfinished =
        grp.chunks.find((c) => this.status(c.id) === 'learning') ||
        grp.chunks.find((c) => this.status(c.id) !== 'mastered') ||
        grp.chunks[0];
      const varDone = this.isGroupVariationDone(grp.id);
      const varCount = this.getGroupVariations(grp.id).length;
      list.push({
        ...grp,
        total,
        masteredCount,
        learningCount,
        freshCount: total - masteredCount - learningCount,
        isMastered,
        pct: Math.round((masteredCount / total) * 100),
        firstUnfinished,
        variationDone: varDone,
        variationCount: varCount,
      });
    }
    return list;
  }

  getGroup(groupId) {
    const [levelId] = String(groupId || '').split('::');
    const groups = this.getGroups(levelId);
    return groups.find((g) => g.id === groupId) || null;
  }

  getGroupForChunk(chunkId) {
    const chunk = this.chunk(chunkId);
    if (!chunk) return null;
    const groups = this.getGroups(chunk.level);
    return groups.find((g) => g.id === chunk.groupId) || null;
  }

  getGroupPosition(chunkId) {
    const chunk = this.chunk(chunkId);
    if (!chunk) return null;
    const group = this.getGroupForChunk(chunkId);
    if (!group) return null;
    const index = group.chunks.findIndex((c) => c.id === chunkId);
    const prevChunk = index > 0 ? group.chunks[index - 1] : null;
    const nextChunk = index >= 0 && index < group.chunks.length - 1 ? group.chunks[index + 1] : null;
    return {
      group,
      index,
      position: index + 1,
      total: group.total,
      prevChunk,
      nextChunk,
    };
  }

  // ---------- tests & mastery ----------

  setUnderstand(id, patch) {
    Object.assign(this.record(id).understand, patch, { done: true, at: nowIso() });
    this.touch();
  }

  toggleUnderstandCheck(id, key) {
    const rec = this.record(id);
    rec.understand.checks = { ...(rec.understand.checks || {}), [key]: !rec.understand.checks?.[key] };
    rec.lastAt = nowIso();
    this.touch();
  }

  setUnderstandFunc(id, func) {
    const rec = this.record(id);
    rec.understand.func = rec.understand.func === func ? null : func;
    rec.lastAt = nowIso();
    this.touch();
  }

  finishUnderstand(id) {
    const rec = this.record(id);
    rec.understand.done = true;
    rec.understand.at = nowIso();
    rec.lastAt = nowIso();
    this.touch();
  }

  note(id, text) {
    this.record(id).notes = String(text || '');
    this.save();
  }

  setSpeakPass(id, key, value) {
    const rec = this.record(id);
    rec.speak.passes[key] = Boolean(value);
    if (rec.speak.passes.slow && rec.speak.passes.natural && rec.speak.passes.blind) {
      rec.speak.at = rec.speak.at || nowIso();
    }
    if (value) rec.speak.count += 1;
    rec.lastAt = nowIso();
    this.touch();
  }

  setSprint(id, count) {
    const rec = this.record(id);
    rec.test.sprint = { count, at: nowIso() };
    this.day().chunks = [...new Set([...this.day().chunks, id])];
    this.touch();
  }

  setSpeaking(id, seconds, note = '') {
    const rec = this.record(id);
    rec.test.speaking = { seconds, at: nowIso(), note };
    this.touch();
  }

  setRecall(id, score, total = 5) {
    const rec = this.record(id);
    rec.test.recall = { score, total, at: nowIso(), passed: score >= 4 };
    this.touch();
    return rec.test.recall.passed;
  }

  setDelayed(id, passed, score = 0) {
    const rec = this.record(id);
    rec.test.delayed = { passed, at: nowIso(), score };
    this.touch();
  }

  delayedDue(id) {
    const rec = this.peek(id);
    if (!rec || rec.test?.delayed?.passed) return null;
    const refAt = rec.mastery?.at || rec.vary?.at || rec.test?.recall?.at || rec.lastAt;
    if (!refAt) return null;
    return addDays(new Date(refAt), 7);
  }

  delayedReady(id) {
    const due = this.delayedDue(id);
    return Boolean(due && due <= new Date());
  }

  masteryReady(id) {
    const flags = this.stageFlags(id);
    return Boolean(flags[0] && flags[1] && flags[2] && flags[3]);
  }

  completeMastery(id) {
    const rec = this.record(id);
    if (!this.masteryReady(id)) return false;
    rec.mastery = { done: true, at: nowIso() };
    rec.review = { due: addDays(new Date(), 3).toISOString(), interval: 3, reps: 1, lastGrade: 'good', lastAt: nowIso() };
    this.touch();
    return true;
  }

  gradeReview(id, grade) {
    const rec = this.record(id);
    const previous = rec.review.interval || 1;
    const nextInterval =
      grade === 'again' ? 1 : clamp(Math.round(previous * (grade === 'hard' ? 1.4 : 2.3)), 1, 180);
    rec.review = {
      due: addDays(new Date(), nextInterval).toISOString(),
      interval: nextInterval,
      reps: (rec.review.reps || 1) + 1,
      lastGrade: grade,
      lastAt: nowIso(),
    };
    this.state.reviews.unshift({ id, grade, at: nowIso(), interval: nextInterval });
    this.state.reviews = this.state.reviews.slice(0, 400);
    this.day().reviews += 1;
    this.touch();
  }

  // ---------- navigation ----------

  setPointer(chunkId, step = 1) {
    const levelId = this.levelOf(chunkId);
    this.state.pointer = { levelId, chunkId, step: clamp(step, 1, 6), at: nowIso() };
    this.touch();
  }

  pointer() {
    return this.state.pointer;
  }

  firstUnfinishedPointer() {
    for (const level of this.levels) {
      for (const chunk of level.chunks) {
        if (this.status(chunk.id) !== 'mastered' && this.peek(chunk.id)) {
          return { levelId: level.id, chunkId: chunk.id, step: this.currentStep(chunk.id), at: nowIso() };
        }
      }
    }
    return { levelId: 'A1', chunkId: 'A1-001', step: 1, at: nowIso() };
  }

  upNext(preferredLevel = null) {
    const pointer = this.state.pointer;
    if (pointer && this.status(pointer.chunkId) !== 'mastered') {
      return { ...pointer, step: clamp(pointer.step || 1, 1, 6) };
    }
    const order = preferredLevel
      ? [this.level(preferredLevel), ...this.levels.filter((l) => l.id !== preferredLevel)]
      : this.levels;
    for (const level of order) {
      if (!level) continue;
      const started = level.chunks.find((chunk) => this.status(chunk.id) === 'learning');
      if (started) return { levelId: level.id, chunkId: started.id, step: this.currentStep(started.id), at: nowIso() };
    }
    for (const level of order) {
      if (!level) continue;
      const fresh = level.chunks.find((chunk) => this.status(chunk.id) === 'new');
      if (fresh) return { levelId: level.id, chunkId: fresh.id, step: 1, at: nowIso() };
    }
    return { levelId: order[0]?.id || 'A1', chunkId: `${order[0]?.id || 'A1'}-001`, step: 1, at: nowIso() };
  }

  dueItems() {
    if (this._dueCache && this._dueDay === dayKey()) return this._dueCache;
    const out = [];
    const now = new Date();
    for (const level of this.levels) {
      for (const chunk of level.chunks) {
        const rec = this.peek(chunk.id);
        if (!rec) continue;
        if (rec.mastery?.done) {
          if (rec.review?.due && dayStart(new Date(rec.review.due)) <= dayStart(now)) {
            out.push({ id: chunk.id, levelId: level.id, type: 'review', due: rec.review.due, interval: rec.review.interval });
          }
          continue;
        }
        const next = this.nextBatch(chunk.id);
        if (next?.due && next.due <= now) {
          out.push({ id: chunk.id, levelId: level.id, type: 'produce', due: next.due.toISOString(), amount: next.amount });
        }
        const flags = stageFlags(rec);
        if (flags[3] && !rec.test?.delayed?.passed) {
          const due = this.delayedDue(chunk.id);
          if (due && due <= now) {
            out.push({ id: chunk.id, levelId: level.id, type: 'delayed', due: due.toISOString() });
          }
        }
      }
    }
    const weight = { review: 0, delayed: 1, produce: 2 };
    out.sort((a, b) => weight[a.type] - weight[b.type] || new Date(a.due) - new Date(b.due));
    this._dueCache = out;
    this._dueDay = dayKey();
    return out;
  }

  levelStats(levelId) {
    const level = this.level(levelId);
    if (!level) return { total: 0, mastered: 0, learning: 0, fresh: 0, due: 0, stageTotal: 0, stageDone: 0 };
    const due = this.dueItems().filter((item) => item.levelId === levelId).length;
    let mastered = 0;
    let learning = 0;
    let stageDone = 0;
    for (const chunk of level.chunks) {
      const status = this.status(chunk.id);
      if (status === 'mastered') mastered += 1;
      else if (status === 'learning') learning += 1;
      stageDone += this.completedCount(chunk.id);
    }
    return {
      total: level.count,
      mastered,
      learning,
      fresh: level.count - mastered - learning,
      due,
      stageDone,
      stageTotal: level.count * 6,
      pct: Math.round((mastered / level.count) * 100),
    };
  }

  overall() {
    let mastered = 0;
    let learning = 0;
    let productions = 0;
    for (const level of this.levels) {
      const stats = this.levelStats(level.id);
      mastered += stats.mastered;
      learning += stats.learning;
    }
    for (const rec of Object.values(this.state.chunks)) {
      productions += rec.produce?.total || 0;
    }
    const totals = Object.values(this.state.days).reduce(
      (acc, day) => {
        acc.minutes += day.minutes || 0;
        acc.reviews += day.reviews || 0;
        return acc;
      },
      { minutes: 0, reviews: 0 },
    );
    return {
      total: this.data.total,
      mastered,
      learning,
      fresh: this.data.total - mastered - learning,
      streak: this.streak(),
      due: this.dueItems().length,
      productions,
      minutes: Math.round(totals.minutes),
      reviews: totals.reviews,
      todayProd: this.today().prod,
      todayGoal: this.state.settings.dailyGoal,
    };
  }

  streak() {
    const hasActivity = (key) => {
      const day = this.state.days[key];
      return Boolean(day && (day.prod > 0 || day.minutes > 0.5 || day.reviews > 0));
    };
    let cursor = dayStart();
    let count = 0;
    if (!hasActivity(dayKey(cursor))) cursor = addDays(cursor, -1);
    while (hasActivity(dayKey(cursor)) && count < 4000) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  heartbeat(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const day = this.day();
    day.minutes = (day.minutes || 0) + seconds / 60;
    this.save();
  }

  lastChunkSeconds(id) {
    return this.peek(id)?.seconds || 0;
  }

  activity(limit = 8) {
    const rows = [];
    for (const [id, rec] of Object.entries(this.state.chunks)) {
      if (rec.lastAt) rows.push({ id, at: rec.lastAt, status: this.status(id) });
    }
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
  }

  recentVariations(limit = 6) {
    const all = [];
    for (const [id, rec] of Object.entries(this.state.chunks)) {
      for (const item of rec.vary?.items || []) all.push({ id, ...item });
    }
    return all.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
  }

  // ---------- legacy import ----------

  importLegacyProgress(notify = true) {
    const stamp = nowIso();
    let count = 0;
    let stages = 0;
    for (const level of this.data.levels) {
      for (const chunk of level.chunks) {
        if (!chunk.stages?.length) continue;
        const rec = this.record(chunk.id);
        rec.imported = [...new Set([...(rec.imported || []), ...chunk.stages])];
        rec.understand.done = true;
        rec.understand.at = rec.understand.at || stamp;
        rec.speak.passes = { slow: true, natural: true, blind: true };
        rec.speak.at = rec.speak.at || stamp;
        for (const stage of chunk.stages) {
          stages += 1;
          if (stage === 'produce' && rec.produce.total < 30) {
            rec.produce.log = [{ at: stamp, amount: 30, imported: true }];
            rec.produce.total = 30;
          }
          if (stage === 'recall') rec.test.recall = { score: 5, total: 5, at: stamp, passed: true };
          if (stage === 'variation') {
            rec.vary.importedDone = true;
            rec.test.variation = { count: 5, at: stamp };
          }
          if (stage === 'sprint') rec.test.sprint = { count: 5, at: stamp };
          if (stage === 'speaking') rec.test.speaking = { seconds: 30, at: stamp, note: '' };
          if (stage === 'delayed') rec.test.delayed = { passed: true, at: stamp, score: 5 };
        }
        if (chunk.stages.length === 6 && !rec.mastery.done) {
          rec.mastery = { done: true, at: stamp };
          rec.review = {
            due: addDays(new Date(), 3).toISOString(),
            interval: 3,
            reps: 1,
            lastGrade: 'good',
            lastAt: stamp,
          };
        }
        count += 1;
      }
    }
    this.state.meta.importedObsidian = true;
    this.state.meta.importedAt = stamp;
    this.state.meta.importedCount = count;
    this.state.meta.importedStages = stages;
    this.save();
    return { count, stages };
  }

  // ---------- data reset / transfer ----------

  async exportData() {
    if (!this.api) return { ok: false };
    return this.api.exportState();
  }

  async importData() {
    if (!this.api) return { ok: false };
    const result = await this.api.importState();
    if (result.ok) {
      this.state = this.normalize(result.state);
      this.onChange?.();
    }
    return result;
  }

  async resetAll() {
    const keepSettings = { ...this.state.settings };
    const fresh = defaultState();
    fresh.settings = keepSettings;
    this.state = fresh;
    if (this.api) await this.api.resetState();
    this.state.meta.importedObsidian = true;
    this.state.pointer = { levelId: 'A1', chunkId: 'A1-001', step: 1, at: nowIso() };
    await this.flush();
    this.onChange?.();
  }

  axisTitle(axis) {
    return AXIS_TITLE[axis] || axis;
  }
}

export const store = new Store();
