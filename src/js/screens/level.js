import { store, STAGES } from '../store.js';
import { html, icon, raw, chunksLabel, debounce, esc } from '../utils.js';

const LEVEL_COPY = {
  A1: 'أساسيات الكلام اليومي: طلبات، تعريف بنفسك، وأسئلة بسيطة.',
  A2: 'تمدّد في الحياة اليومية: مواعيد، سفر، شغل، وخطط قريبة.',
  B1: 'تعبر عن رأيك وتشرح أسبابك في مواقف مألوفة.',
  B2: 'تناقش موضوعات مركبة بطلاقة ودقة أعلى.',
  C1: 'صياغات دقيقة للمناقشات والأفكار المعقدة.',
};

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'learning', label: 'شغال عليه' },
  { key: 'due', label: 'مستحق' },
  { key: 'mastered', label: 'متقن' },
  { key: 'new', label: 'جديد' },
];

const uiByLevel = {};
const PAGE = 40;

const getUI = (levelId) => {
  if (!uiByLevel[levelId]) uiByLevel[levelId] = { filter: 'all', query: '', limit: PAGE };
  return uiByLevel[levelId];
};

function chunkMatches(chunk, ui, dueSet, filterCounts) {
  const status = store.status(chunk.id);
  if (ui.filter === 'learning' && status !== 'learning') return false;
  if (ui.filter === 'mastered' && status !== 'mastered') return false;
  if (ui.filter === 'new' && status !== 'new') return false;
  if (ui.filter === 'due' && !dueSet.has(chunk.id)) return false;
  const q = ui.query.trim().toLowerCase();
  if (q && !(chunk.de.toLowerCase().includes(q) || chunk.ar.includes(q) || chunk.id.toLowerCase().includes(q))) return false;
  return true;
}

function rowMarkup(chunk, currentId) {
  const flags = store.stageFlags(chunk.id);
  const done = flags.filter(Boolean).length;
  const status = store.status(chunk.id);
  const statusLabel = status === 'mastered' ? 'متقن' : done > 0 ? `${done} من 6` : 'جديد';
  const statusClass = status === 'mastered' ? 'is-done' : done > 0 ? 'is-prog' : '';
  const step = store.currentStep(chunk.id);
  return html`
    <button class="chunk-row ${chunk.id === currentId ? 'is-current' : ''}" data-href="#/practice/${chunk.id}?step=${step}" data-id="${chunk.id}">
      <span class="chunk-id">${chunk.id}</span>
      <span class="chunk-main">
        <span class="de chunk-de">${chunk.de}</span>
        <span class="chunk-ar">${chunk.ar}</span>
      </span>
      <span class="stage-dots" aria-label="${done} من 6 خطوات">
        ${flags.map((flag, index) =>
          html`<i class="${flag ? 'on' : index === step - 1 && status !== 'mastered' ? 'now' : ''}"></i>`,
        )}
      </span>
      <span class="chunk-status ${statusClass}">${statusLabel}</span>
      <span class="chunk-go">${icon('forward')}</span>
    </button>
  `;
}

function listPayload(levelId) {
  const level = store.level(levelId);
  const ui = getUI(levelId);
  const dueSet = new Set(store.dueItems().filter((item) => item.levelId === levelId).map((item) => item.id));
  const counts = { all: level.count, learning: 0, due: dueSet.size, mastered: 0, new: 0 };
  for (const chunk of level.chunks) {
    const status = store.status(chunk.id);
    if (status === 'learning') counts.learning += 1;
    else if (status === 'mastered') counts.mastered += 1;
    else counts.new += 1;
  }
  const filtered = level.chunks.filter((chunk) => chunkMatches(chunk, ui, dueSet, counts));
  const shown = filtered.slice(0, ui.limit);
  const currentId = store.pointer()?.chunkId;
  const rows = shown.map((chunk) => rowMarkup(chunk, currentId));
  return {
    counts,
    total: filtered.length,
    shown: shown.length,
    html: rows.length
      ? html`${rows}`
      : html`
          <div class="empty" style="border:0;border-radius:0">
            <div class="empty-icon">${icon('search')}</div>
            <h3>مفيش جمل بالفلتر ده</h3>
            <p>جرّب فلتر تاني أو امسح البحث.</p>
          </div>
        `,
  };
}

function levelDescription(id) {
  return LEVEL_COPY[id] || '';
}

export const levelScreen = {
  render({ params }) {
    const levelId = store.level(params.levelId) ? params.levelId : 'A1';
    const level = store.level(levelId);
    const stats = store.levelStats(levelId);    const ui = getUI(levelId);
    const payload = listPayload(levelId);
    const firstUnfinished =
      level.chunks.find((chunk) => store.status(chunk.id) === 'learning') ||
      level.chunks.find((chunk) => store.status(chunk.id) !== 'mastered') ||
      level.chunks[0];

    return html`
      <div class="page level-page" style="--lv:var(--${levelId.toLowerCase()})">
        <div class="screen-head">
          <a class="back-btn" href="#/home" aria-label="رجوع للرئيسية">${icon('back')}</a>
          <div>
            <h1>${level.id} — ${level.title}</h1>
            <p class="sub">${levelDescription(levelId)}</p>
          </div>
          <a class="btn btn-primary btn-sm" style="margin-inline-start:auto"
            href="#/practice/${firstUnfinished.id}?step=${store.currentStep(firstUnfinished.id)}">
            ${icon('play')} ابدأ من أول غير متقن
          </a>
        </div>

        <section class="level-hero" data-code="${level.id}">
          <div class="level-hero-main">
            <div class="level-big">${level.id}</div>
            <div>
              <h2>${chunksLabel(level.count)} في المستوى ده</h2>
              <p>افتح أي جملة وامشي عليها 6 خطوات. تقدمك بيتحفظ لوحده.</p>
            </div>
          </div>
          <div class="level-hero-side">
            <div class="lh-row">
              <div class="lh-stat"><b>${stats.mastered}</b><span>متقن</span></div>
              <div class="lh-stat"><b>${stats.learning}</b><span>شغال عليه</span></div>
              <div class="lh-stat"><b>${stats.due}</b><span>مستحق</span></div>
            </div>
            <div class="meter ticks"><span style="width:${stats.pct}%;background:var(--lv)"></span></div>
          </div>
        </section>

        <div class="toolbar">
          <div class="filterbar" id="filters">
            ${FILTERS.map(
              (filter) => html`
                <button data-filter="${filter.key}" class="${ui.filter === filter.key ? 'is-on' : ''}">
                  ${filter.label}${filter.key === 'due' && payload.counts.due ? ` (${payload.counts.due})` : ''}
                </button>
              `,
            )}
          </div>
          <label class="search-field">
            ${icon('search')}
            <input id="chunk-search" type="search" placeholder="دوّر بالألماني أو بالعربي أو بالكود" value="${ui.query}" />
          </label>
        </div>

        <div id="list-wrap">
          <div class="chunk-list" id="chunk-list">${payload.html}</div>
          <div class="pager" id="pager">
            ${payload.total > payload.shown
              ? html`<button class="btn btn-ghost btn-sm" data-more>عرض المزيد (${payload.total - payload.shown} فاضل)</button>`
              : html`<span>${payload.total} ${payload.total === 1 ? 'جملة' : 'جملة'} · خلصت القايمة تحت الفلتر ده</span>`}
          </div>
        </div>

        <div class="method-strip">
          <div class="method-steps">
            ${STAGES.map(
              (stage, index) => html`<span class="method-step"><span class="method-num">${index + 1}</span>${stage.short}</span>`,
            )}
          </div>
          <span class="sub muted">كل جملة بتتقن لما تعدّي الست خطوات — مش لما تخلصها مرة واحدة.</span>
        </div>
      </div>
    `;
  },

  mount(root, { params }) {
    const levelId = store.level(params.levelId) ? params.levelId : 'A1';
    const ui = getUI(levelId);
    const list = root.querySelector('#chunk-list');
    const pager = root.querySelector('#pager');
    const filters = root.querySelector('#filters');

    const paint = () => {
      const payload = listPayload(levelId);
      list.innerHTML = String(payload.html);
      pager.innerHTML = String(
        payload.total > payload.shown
          ? html`<button class="btn btn-ghost btn-sm" data-more>عرض المزيد (${payload.total - payload.shown} فاضل)</button>`
          : html`<span>${payload.total} جملة تحت الفلتر ده</span>`,
      );
      filters.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.classList.toggle('is-on', btn.dataset.filter === ui.filter);
      });
    };

    const onClick = (event) => {
      const filterBtn = event.target.closest('[data-filter]');
      if (filterBtn) {
        ui.filter = filterBtn.dataset.filter;
        ui.limit = PAGE;
        paint();
        return;
      }
      if (event.target.closest('[data-more]')) {
        ui.limit += PAGE;
        paint();
        return;
      }
      const row = event.target.closest('[data-href]');
      if (row) location.hash = row.dataset.href;
    };

    const onSearch = debounce((value) => {
      ui.query = value;
      ui.limit = PAGE;
      paint();
    }, 160);

    const onInput = (event) => {
      if (event.target.id === 'chunk-search') onSearch(event.target.value);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);

    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
    };
  },
};
