import { store, STAGES } from '../store.js';
import { html, icon, raw, chunksLabel } from '../utils.js';
import { sectionHead } from '../ui.js';

const levelStyle = (id) => raw(`style="--lv:var(--${id.toLowerCase()})"`);

function focusCard(chunk, step) {
  const flags = store.stageFlags(chunk.id);
  const status = store.status(chunk.id);
  const batch = store.nextBatch(chunk.id);
  const variants = store.variationCoverage(chunk.id);
  let hint = '';
  if (step === 3 && batch) hint = `فاضل ${30 - (store.peek(chunk.id)?.produce.total || 0)} إنتاج من الخطة`;
  else if (step === 4) hint = 'اختبر نفسك: استدعاء، سرعة، كلام';
  else if (status === 'mastered') hint = 'متقن ومراجعته جاية';
  else hint = STAGES[step - 1]?.hint || '';

  return html`
    <div class="focus-card">
      <div class="focus-top">
        <span class="chip is-level">${chunk.level}</span>
        <span class="focus-id">${chunk.id}</span>
        ${chunk.groupTitle ? html`<span class="chip chip-blue">${chunk.groupTitle}</span>` : ''}
        ${chunk.template || chunk.patternKey ? html`<span class="chip">قالب: ${chunk.template || chunk.patternKey}</span>` : ''}
      </div>
      <div class="de focus-de">${chunk.de}</div>
      <div class="focus-ar">${chunk.ar}</div>
      <div class="focus-rail" aria-hidden="true">
        ${[0, 1, 2, 3].map((i) =>
          html`<i class="${flags[i] ? 'on' : i === step - 1 ? 'now' : ''}"></i>`,
        )}
      </div>
      <div class="focus-foot">
        <span>الخطوة ${step} من 4 · ${STAGES[step - 1]?.title || ''}</span>
        <span class="focus-sep">·</span>
        <span class="focus-hint">${hint}</span>
      </div>
    </div>
  `;
}

function levelRow(level) {
  const stats = store.levelStats(level.id);
  const started = stats.learning + stats.mastered;
  return html`
    <div class="level-row" data-href="#/level/${level.id}" ${levelStyle(level.id)}>
      <div class="level-sigil">${level.id}</div>
      <div class="level-body">
        <div class="level-title-row">
          <h3>${level.title}</h3>
          <span class="level-count">${chunksLabel(level.count)} · ${store.getGroups(level.id).length} مجموعة منوعة</span>
          ${stats.mastered > 0 ? html`<span class="chip chip-green">${stats.mastered} متقن</span>` : ''}
          ${stats.learning > 0 ? html`<span class="chip">${stats.learning} شغال عليه</span>` : ''}
        </div>
        <div class="rail-wrap">
          <div class="meter ticks"><span style="width:${stats.pct}%;background:var(--lv)"></span></div>
          <div class="rail-nums"><b>${stats.mastered}</b> من ${stats.total}</div>
        </div>
      </div>
      <div class="level-due ${stats.due ? 'has' : ''}">
        ${stats.due ? html`<b>${stats.due}</b><small>مستحق</small>` : html`<span>${started ? 'مفيش مستحق' : 'لسه جديد'}</span>`}
      </div>
      <div class="level-go">${icon('forward')}</div>
    </div>
  `;
}

export const homeScreen = {
  render() {
    const stats = store.overall();
    const pointer = store.pointer();
    const focus = store.upNext(pointer?.levelId);
    const chunk = store.chunk(focus.chunkId);
    const step = focus.step || store.currentStep(focus.chunkId);
    const goalPct = stats.todayGoal ? Math.min(100, Math.round((stats.todayProd / stats.todayGoal) * 100)) : 0;
    const goalMet = stats.todayProd >= stats.todayGoal;
    const headline =
      store.status(focus.chunkId) === 'mastered' ? 'اللي جاي جاهز' : stats.learning > 0 ? 'كمّل من حيث وقفت' : 'ابدأ أول Chunk';

    return html`
      <div class="page home-page">
        <section class="hero">
          <div class="hero-main">
            <span class="eyebrow">جلسة النهاردة</span>
            <h1 class="hero-title">
              ${headline === 'كمّل من حيث وقفت'
                ? html`كمّل <span class="hl">من حيث وقفت</span>`
                : headline}
            </h1>
            <p class="hero-sub">
              التطبيق بيحفظ كل خطوة وكل إنتاج — تقفل وترجع بعد أسبوع، هتلاقي نفسك واقف في نفس المكان بالظبط.
            </p>
            ${chunk ? focusCard(chunk, step) : ''}
            <div class="hero-actions">
              <a class="btn btn-primary" href="#/practice/${focus.chunkId}?step=${step}">
                ${icon('play')} افتح الجلسة
              </a>
              <a class="btn btn-ghost" href="#/library">
                ${icon('library')} المكتبة المصورة (619 لوحة)
              </a>
              ${stats.due > 0 ? html`<a class="btn btn-ghost" href="#/review">${icon('clock')} راجع ${stats.due} مستحق</a>` : ''}
              <button class="btn btn-quiet" data-scroll="levels">شوف المستويات ${icon('forward')}</button>
            </div>
            ${store.state.meta.importedObsidian && store.state.meta.importedCount
              ? html`<div class="focus-foot"><span>${icon('spark')} استوردنا تقدمك القديم من ملف A1 — ${chunksLabel(store.state.meta.importedCount)} عندها شغل محفوظ</span></div>`
              : ''}
          </div>

          <aside class="hero-side">
            <div class="hero-side-title">أرقامك النهاردة</div>
            <div class="hstat"><span>مستحق للمراجعة</span><b>${stats.due}<small>${stats.due ? 'مستحق' : 'صفّي'}</small></b></div>
            <div class="hstat"><span>إنتاجات النهاردة</span><b>${stats.todayProd}<small>من ${stats.todayGoal}</small></b></div>
            <div class="hstat"><span>جمل متقنة</span><b>${stats.mastered}<small>من ${stats.total}</small></b></div>
            <div class="goal-block">
              <div class="between">
                <span>${goalMet ? 'خلصت هدف النهاردة' : 'هدفك اليومي'}</span>
                <span>${goalPct}%</span>
              </div>
              <div class="meter"><span style="width:${goalPct}%"></span></div>
            </div>
          </aside>
        </section>

        <section class="levels-block" id="levels">
          ${sectionHead(
            'المستويات',
            'اختار مستوى، والبرنامج يمشي معاك جملة جملة على 6 خطوات.',
            stats.due > 0 ? html`<a class="link" href="#/review">ابدأ المراجعة ${icon('forward')}</a>` : '',
          )}
          <div style="margin-top:8px">
            ${store.levels.map((level) => levelRow(level))}
          </div>
        </section>

        <section class="method-strip">
          <div class="method-steps">
            ${STAGES.map(
              (stage, index) => html`<span class="method-step"><span class="method-num">${index + 1}</span>${stage.short}</span>`,
            )}
          </div>
          <a class="link" href="#/method">الطريقة كاملة + جدول التكرار ${icon('forward')}</a>
        </section>
      </div>
    `;
  },

  mount(root) {
    const onClick = (event) => {
      const target = event.target.closest('[data-href]');
      if (target) {
        location.hash = target.dataset.href;
        return;
      }
      const scroller = event.target.closest('[data-scroll]');
      if (scroller) {
        document.getElementById(scroller.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  },
};
