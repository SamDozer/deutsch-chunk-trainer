import { store, STAGES } from '../store.js';
import { html, icon, raw, chunksLabel, debounce, esc } from '../utils.js';
import { toast } from '../ui.js';
import {
  ensureLibraryManifest,
  getVisualGuidesForLevel,
  loadUserLibState,
  saveUserLibState,
  renderLibraryCard,
  openLibraryLightbox,
  closeLibraryLightbox,
} from './library.js';

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
const PAGE = 30;

const getUI = (levelId) => {
  if (!uiByLevel[levelId]) {
    uiByLevel[levelId] = {
      filter: 'all',
      query: '',
      limit: PAGE,
      viewMode: 'groups', // 'groups' | 'all' | 'visuals'
      expanded: new Set(),
    };
  }
  return uiByLevel[levelId];
};

function chunkMatches(chunk, ui, dueSet) {
  const status = store.status(chunk.id);
  if (ui.filter === 'learning' && status !== 'learning') return false;
  if (ui.filter === 'mastered' && status !== 'mastered') return false;
  if (ui.filter === 'new' && status !== 'new') return false;
  if (ui.filter === 'due' && !dueSet.has(chunk.id)) return false;
  const q = ui.query.trim().toLowerCase();
  if (q && !(chunk.de.toLowerCase().includes(q) || chunk.ar.includes(q) || chunk.id.toLowerCase().includes(q))) return false;
  return true;
}

function groupMatches(group, ui, dueSet) {
  const q = ui.query.trim().toLowerCase();
  const titleMatches = q && (group.title.toLowerCase().includes(q) || group.key.toLowerCase().includes(q));

  const hasMatchingChunk = group.chunks.some((c) => chunkMatches(c, ui, dueSet));
  if (!hasMatchingChunk && !titleMatches) return false;

  if (ui.filter === 'learning' && group.learningCount === 0) return false;
  if (ui.filter === 'mastered' && !group.isMastered) return false;
  if (ui.filter === 'new' && group.freshCount === 0) return false;
  if (ui.filter === 'due' && !group.chunks.some((c) => dueSet.has(c.id))) return false;

  return true;
}

function rowMarkup(chunk, currentId) {
  const flags = store.stageFlags(chunk.id);
  const sentenceFlags = flags.slice(0, 4);
  const done = sentenceFlags.filter(Boolean).length;
  const status = store.status(chunk.id);
  const phase = store.sessionPhase(chunk.id);
  const statusLabel = phase.label;
  const statusClass = status === 'mastered' ? 'is-done' : done > 0 ? 'is-prog' : '';
  const step = store.currentStep(chunk.id);
  const pattern = chunk.template || chunk.patternKey || (chunk.family ? chunk.family.split(':')[1] : null);
  return html`
    <button class="chunk-row ${chunk.id === currentId ? 'is-current' : ''}" data-href="#/practice/${chunk.id}?step=${step}" data-id="${chunk.id}">
      <span class="chunk-id">${chunk.id}</span>
      <span class="chunk-main">
        <span class="de chunk-de">${chunk.de}</span>
        <span class="chunk-ar">${chunk.ar}</span>
        ${pattern ? html`<span class="chip chip-blue de" style="font-size:11px;margin-top:4px;align-self:flex-start;opacity:0.9">قالب: ${pattern}</span>` : ''}
      </span>
      <span class="stage-dots" aria-label="${done} من 4 خطوات">
        ${sentenceFlags.map((flag, index) =>
          html`<i class="${flag ? 'on' : index === step - 1 && status !== 'mastered' ? 'now' : ''}"></i>`,
        )}
      </span>
      <span class="chunk-status ${statusClass}">${statusLabel}</span>
      <span class="chunk-go">${icon('forward')}</span>
    </button>
  `;
}

function groupCardMarkup(group, currentId, isExpanded, hasQuery, dueSet, ui) {
  const step = store.currentStep(group.firstUnfinished.id);
  const statusTag = group.isMastered
    ? html`<span class="chip chip-green" style="font-size:11px">متقنة بالكامل 🏆</span>`
    : group.variationDone
      ? html`<span class="chip chip-blue" style="font-size:11px">5 تنويعات جاهزة ✓</span>`
      : group.learningCount > 0
        ? html`<span class="chip chip-yellow" style="font-size:11px">قيد التدريب</span>`
        : html`<span class="chip" style="font-size:11px">مجموعة جديدة</span>`;

  const displayChunks = hasQuery || ui.filter !== 'all'
    ? group.chunks.filter((c) => chunkMatches(c, ui, dueSet))
    : group.chunks;

  const showList = isExpanded || (hasQuery && displayChunks.length > 0);

  return html`
    <div class="group-card ${group.isMastered ? 'is-mastered' : ''}" data-group-id="${group.id}">
      <div class="group-card-header" data-toggle-group="${group.id}">
        <div class="group-card-info">
          <div class="group-title-row" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
            <span class="group-icon">${icon('folder')}</span>
            <span class="group-title">${group.title}</span>
            <span class="chip chip-blue" style="font-size:11px">${group.uniqueTemplatesCount || 8} قوالب مختلفة</span>
            ${group.isCapstone ? html`<span class="chip chip-purple" style="font-size:11px">المجموعة الختامية للمستوى 🌟 (${group.total} جمل)</span>` : ''}
            ${statusTag}
          </div>
          <div class="group-meta-row" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px">
            <span class="sub muted">${group.masteredCount} من ${group.total} جمل متقنة</span>
            <span class="dot-sep"></span>
            <div class="group-meter-wrap">
              <div class="meter ticks" style="width:80px;height:6px"><span style="width:${group.pct}%;background:var(--lv)"></span></div>
              <span class="group-pct">${group.pct}%</span>
            </div>
            <span class="dot-sep"></span>
            <div class="group-pips" style="display:inline-flex;gap:4px;align-items:center" title="حالة جمل المجموعة">
              ${group.chunks.map((c) => {
                const st = store.status(c.id);
                const bg = st === 'mastered' ? 'var(--green)' : st === 'learning' ? 'var(--yellow)' : 'var(--line)';
                return html`<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${bg}" title="${c.id}: ${c.de}"></i>`;
              })}
            </div>
          </div>
        </div>

        <div class="group-card-actions">
          <a class="btn btn-primary btn-sm group-start-btn" href="#/practice/${group.firstUnfinished.id}?step=${step}">
            ${icon('play')} ابدأ تدريب المجموعة (${group.total} جمل)
          </a>
          <a class="btn btn-quiet btn-sm group-finale-btn" href="#/practice/${group.chunks[group.chunks.length - 1].id}?step=5" title="المرحلة الختامية: 5 تنويعات للقالب">
            ${icon('spark')} ${group.variationDone ? 'التنويعات جاهزة ✓' : 'المرحلة الختامية ⚡'}
          </a>
          <button class="btn btn-ghost btn-sm group-toggle-btn" data-toggle-group="${group.id}">
            ${showList ? 'إخفاء الجمل ▲' : `عرض الجمل (${group.total}) ▼`}
          </button>
        </div>
      </div>

      ${showList
        ? html`
            <div class="group-chunks-wrap">
              <div class="chunk-list" style="border:0;border-radius:0;border-top:1px solid var(--line-soft)">
                ${displayChunks.map((chunk) => rowMarkup(chunk, currentId))}
              </div>
            </div>
          `
        : ''}
    </div>
  `;
}

function listPayload(levelId, manifest = null, userLibState = null) {
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

  const currentId = store.pointer()?.chunkId;
  const hasQuery = Boolean(ui.query.trim());

  if (ui.viewMode === 'visuals') {
    if (!manifest) {
      return {
        counts,
        total: 0,
        shown: 0,
        isGroups: false,
        isVisuals: true,
        filteredVisuals: [],
        html: html`<div class="panel panel-pad">جارٍ تحميل لوحات الشرح المصور للمستوى ${levelId}...</div>`,
      };
    }
    const allVisuals = getVisualGuidesForLevel(manifest, levelId);
    const q = ui.query.trim().toLowerCase();
    const topicMap = new Map(manifest.topics.map((t) => [t.id, t]));
    const filteredVisuals = q
      ? allVisuals.filter((it) => {
          const t = topicMap.get(it.topicId);
          return `${it.title} ${it.badge} ${t?.title || ''}`.toLowerCase().includes(q);
        })
      : allVisuals;
    const shownVisuals = filteredVisuals.slice(0, ui.limit);
    const libState = userLibState || loadUserLibState();

    return {
      counts,
      total: filteredVisuals.length,
      shown: shownVisuals.length,
      isGroups: false,
      isVisuals: true,
      filteredVisuals,
      html: shownVisuals.length
        ? html`<div class="lib-grid">${shownVisuals.map((item, idx) => renderLibraryCard(item, idx, topicMap, libState))}</div>`
        : html`
            <div class="empty" style="border:0;border-radius:0">
              <div class="empty-icon">${icon('search')}</div>
              <h3>مفيش لوحات مصورة مطابقة للبحث</h3>
              <p>جرّب تمسح كلمة البحث علشان تشوف كل لوحات المستوى ${levelId}.</p>
            </div>
          `,
    };
  }

  if (ui.viewMode === 'groups') {
    const allGroups = store.getGroups(levelId);
    const filteredGroups = allGroups.filter((g) => groupMatches(g, ui, dueSet));
    const shownGroups = filteredGroups.slice(0, ui.limit);
    const cards = shownGroups.map((g) =>
      groupCardMarkup(g, currentId, ui.expanded.has(g.id), hasQuery, dueSet, ui),
    );

    return {
      counts,
      total: filteredGroups.length,
      shown: shownGroups.length,
      isGroups: true,
      isVisuals: false,
      filteredVisuals: [],
      html: cards.length
        ? html`${cards}`
        : html`
            <div class="empty" style="border:0;border-radius:0">
              <div class="empty-icon">${icon('search')}</div>
              <h3>مفيش مجموعات بالفلتر ده</h3>
              <p>جرّب فلتر تاني أو امسح البحث.</p>
            </div>
          `,
    };
  } else {
    const filtered = level.chunks.filter((chunk) => chunkMatches(chunk, ui, dueSet));
    const shown = filtered.slice(0, ui.limit);
    const rows = shown.map((chunk) => rowMarkup(chunk, currentId));
    return {
      counts,
      total: filtered.length,
      shown: shown.length,
      isGroups: false,
      isVisuals: false,
      filteredVisuals: [],
      html: rows.length
        ? html`<div class="chunk-list">${rows}</div>`
        : html`
            <div class="empty" style="border:0;border-radius:0">
              <div class="empty-icon">${icon('search')}</div>
              <h3>مفيش جمل بالفلتر ده</h3>
              <p>جرّب فلتر تاني أو امسح البحث.</p>
            </div>
          `,
    };
  }
}

function levelDescription(id) {
  return LEVEL_COPY[id] || '';
}

function renderVisualShelf(levelId, cards) {
  if (!cards || !cards.length) return '';
  const preview = cards.slice(0, 6);
  return html`
    <section class="level-visual-shelf panel panel-pad" aria-label="الشرح المصور للمستوى ${levelId}">
      <div class="between" style="margin-bottom:14px">
        <div>
          <div class="row" style="gap:8px">
            <span class="chip chip-yellow">📐 شرح مصور بالعربي · ${levelId}</span>
            <h3 style="font-size:19px">لوحات القواعد وتراكيب الجمل والكلمات للمستوى ${levelId}</h3>
          </div>
          <p class="sub muted" style="margin-top:3px">
            ${cards.length} لوحة مصورة تشرح قواعد وتراكيب ومفردات ${levelId} بالعربي مع أمثلة جاهزة — اضغط على أي لوحة لتكبيرها فوراً.
          </p>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-primary btn-sm" data-switch-visuals>
            ${icon('eye')} عرض كل اللوحات (${cards.length})
          </button>
          <a class="btn btn-ghost btn-sm" href="#/library?level=${levelId}">
            ${icon('library')} فتح في المكتبة ↗
          </a>
        </div>
      </div>

      <div class="level-visual-strip">
        ${preview.map(
          (item, idx) => html`
            <button
              type="button"
              class="level-visual-thumb"
              data-shelf-open="${idx}"
              title="${item.title}"
            >
              <div class="level-visual-thumb-img">
                <img src="${item.src}" alt="${item.title}" loading="lazy" decoding="async" />
                <span class="chip chip-navy">${item.badge}</span>
              </div>
              <span class="level-visual-thumb-title">${item.title}</span>
            </button>
          `,
        )}
      </div>
    </section>
  `;
}

export const levelScreen = {
  render({ params }) {
    const levelId = store.level(params.levelId) ? params.levelId : 'A1';
    const level = store.level(levelId);
    const stats = store.levelStats(levelId);
    const ui = getUI(levelId);
    const payload = listPayload(levelId);
    const groups = store.getGroups(levelId);
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
          <div class="row" style="margin-inline-start:auto;gap:8px">
            <a class="btn btn-ghost btn-sm" href="#/practice/${level.chunks[0].id}?step=1">
              ${icon('play')} ابدأ بالترتيب (${level.id}-001)
            </a>
            <a class="btn btn-primary btn-sm"
              href="#/practice/${firstUnfinished.id}?step=${store.currentStep(firstUnfinished.id)}">
              ${icon('forward')} كمّل من غير المتقن
            </a>
          </div>
        </div>

        <section class="level-hero" data-code="${level.id}">
          <div class="level-hero-main">
            <div class="level-big">${level.id}</div>
            <div>
              <h2>${chunksLabel(level.count)} مقسمة إلى ${groups.length} مجموعة منوعة</h2>
              <p>مجموعات منوعة تدمج قوالب وتراكيب مختلفة لتجنب التكرار الرتيب، مع شرح مصور بالعربي ومرحلة ختامية من 5 تنويعات لكل مجموعة.</p>
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

        <div id="level-visual-shelf-root"></div>

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

          <!-- View Mode Toggle: Groups vs All Chunks vs Level Visual Guides -->
          <div class="view-mode-toggle" id="view-mode-toggle">
            <button class="view-toggle-btn ${ui.viewMode === 'groups' ? 'is-active' : ''}" data-view="groups" title="عرض المجموعات المنوعة">
              ${icon('folder')} المجموعات المنوعة (${groups.length})
            </button>
            <button class="view-toggle-btn ${ui.viewMode === 'all' ? 'is-active' : ''}" data-view="all" title="عرض كل الجمل مسطحة">
              كل الجمل (${level.count})
            </button>
            <button class="view-toggle-btn ${ui.viewMode === 'visuals' ? 'is-active' : ''}" data-view="visuals" id="level-visuals-tab-btn" title="عرض لوحات الشرح المصور للمستوى">
              ${icon('library')} الشرح المصور <span id="level-visuals-count"></span>
            </button>
          </div>

          <label class="search-field">
            ${icon('search')}
            <input id="chunk-search" type="search" placeholder="دوّر برقم المجموعة أو بالقالب أو بالألماني أو بالعربي" value="${ui.query}" />
          </label>
        </div>

        <div id="list-wrap">
          <div class="${ui.viewMode === 'groups' ? 'groups-list' : ''}" id="chunk-list">${payload.html}</div>
          <div class="pager" id="pager">
            ${payload.total > payload.shown
              ? html`<button class="btn btn-ghost btn-sm" data-more>عرض المزيد (${payload.total - payload.shown} فاضل)</button>`
              : html`<span>${payload.total} ${payload.isVisuals ? 'لوحة مصورة' : payload.isGroups ? 'مجموعة منوعة' : 'جملة'} تحت الفلتر ده</span>`}
          </div>
        </div>

        <div class="method-strip">
          <div class="method-steps">
            ${STAGES.map(
              (stage, index) => html`<span class="method-step"><span class="method-num">${index + 1}</span>${stage.short}</span>`,
            )}
          </div>
          <span class="sub muted">كل مجموعة بتتدرب على جملها المنوعة بالتتابع، وتنتج 5 تنويعات للمجموعة في المرحلة الختامية!</span>
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
    const viewToggle = root.querySelector('#view-mode-toggle');
    const shelfRoot = root.querySelector('#level-visual-shelf-root');

    let loadedManifest = null;
    let levelVisualCards = [];
    let currentFilteredVisuals = [];
    const userLibState = loadUserLibState();
    let isUnmounted = false;

    const paint = () => {
      const payload = listPayload(levelId, loadedManifest, userLibState);
      currentFilteredVisuals = payload.filteredVisuals || levelVisualCards;
      list.className = ui.viewMode === 'groups' ? 'groups-list' : '';
      list.innerHTML = String(payload.html);
      pager.innerHTML = String(
        payload.total > payload.shown
          ? html`<button class="btn btn-ghost btn-sm" data-more>عرض المزيد (${payload.total - payload.shown} فاضل)</button>`
          : html`<span>${payload.total} ${payload.isVisuals ? 'لوحة مصورة' : payload.isGroups ? 'مجموعة قوالب' : 'جملة'} تحت الفلتر ده</span>`,
      );
      filters.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.classList.toggle('is-on', btn.dataset.filter === ui.filter);
      });
      viewToggle?.querySelectorAll('[data-view]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.view === ui.viewMode);
      });
      if (shelfRoot) {
        shelfRoot.hidden = ui.viewMode === 'visuals';
      }
    };

    ensureLibraryManifest()
      .then((manifest) => {
        if (isUnmounted) return;
        loadedManifest = manifest;
        levelVisualCards = getVisualGuidesForLevel(manifest, levelId);
        const countSpan = root.querySelector('#level-visuals-count');
        if (countSpan) countSpan.textContent = `(${levelVisualCards.length})`;
        if (shelfRoot) {
          shelfRoot.innerHTML = String(renderVisualShelf(levelId, levelVisualCards));
          shelfRoot.hidden = ui.viewMode === 'visuals';
        }
        if (ui.viewMode === 'visuals') paint();
      })
      .catch(() => {});

    const onClick = (event) => {
      // Switch to full visuals tab from shelf button
      if (event.target.closest('[data-switch-visuals]')) {
        ui.viewMode = 'visuals';
        ui.limit = PAGE;
        paint();
        root.querySelector('#view-mode-toggle')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      // Open card from shelf thumbnail
      const shelfThumb = event.target.closest('[data-shelf-open]');
      if (shelfThumb && loadedManifest) {
        const idx = Number(shelfThumb.dataset.shelfOpen);
        openLibraryLightbox({
          items: levelVisualCards,
          startIndex: idx,
          manifest: loadedManifest,
          userState: userLibState,
          onStateChange() {
            if (ui.viewMode === 'visuals') paint();
          },
        });
        return;
      }

      // Open card from visuals grid
      const openCard = event.target.closest('[data-open-idx]');
      if (openCard && loadedManifest) {
        const idx = Number(openCard.dataset.openIdx);
        openLibraryLightbox({
          items: currentFilteredVisuals.length ? currentFilteredVisuals : levelVisualCards,
          startIndex: idx,
          manifest: loadedManifest,
          userState: userLibState,
          onStateChange() {
            if (ui.viewMode === 'visuals') paint();
          },
        });
        return;
      }

      // Toggle read/fav on visual card inside level screen
      const readBtn = event.target.closest('[data-toggle-read]');
      if (readBtn) {
        event.stopPropagation();
        const id = readBtn.dataset.toggleRead;
        if (userLibState.read.has(id)) userLibState.read.delete(id);
        else userLibState.read.add(id);
        saveUserLibState(userLibState);
        paint();
        return;
      }

      const favBtn = event.target.closest('[data-toggle-fav]');
      if (favBtn) {
        event.stopPropagation();
        const id = favBtn.dataset.toggleFav;
        if (userLibState.fav.has(id)) {
          userLibState.fav.delete(id);
          toast('تمت الإزالة من المفضلة', 'close');
        } else {
          userLibState.fav.add(id);
          toast('تم الحفظ في المفضلة ✨', 'spark');
        }
        saveUserLibState(userLibState);
        paint();
        return;
      }

      // Toggle view mode (groups vs all vs visuals)
      const viewBtn = event.target.closest('[data-view]');
      if (viewBtn) {
        ui.viewMode = viewBtn.dataset.view;
        ui.limit = PAGE;
        paint();
        return;
      }

      // Ignore click on links (like Start Group button)
      const link = event.target.closest('a');
      if (link) return;

      // Toggle group expansion
      const groupToggle = event.target.closest('[data-toggle-group]');
      if (groupToggle) {
        const gid = groupToggle.dataset.toggleGroup;
        if (ui.expanded.has(gid)) ui.expanded.delete(gid);
        else ui.expanded.add(gid);
        paint();
        return;
      }

      // Filter click
      const filterBtn = event.target.closest('[data-filter]');
      if (filterBtn) {
        ui.filter = filterBtn.dataset.filter;
        ui.limit = PAGE;
        paint();
        return;
      }

      // Pagination click
      if (event.target.closest('[data-more]')) {
        ui.limit += PAGE;
        paint();
        return;
      }

      // Chunk row click
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

    const onKeyDown = (event) => {
      const openEl = event.target?.closest?.('[data-open-idx]');
      if (openEl && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openEl.click();
      }
    };

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeyDown);

    return () => {
      isUnmounted = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('keydown', onKeyDown);
      closeLibraryLightbox();
    };
  },
};
