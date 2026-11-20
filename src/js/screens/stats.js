import { store } from '../store.js';
import { html, icon, dayKey, dayStart, addDays, dateLabel, relativeWhen, timeLabel, formatExactDateTime, formatCountdown, pad, daysBetween } from '../utils.js';
import { toast } from '../ui.js';

let srTableFilter = 'active';
let srTableShowAll = false;

function shortTimeOrDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  const diffDays = daysBetween(new Date(), d);
  if (diffDays === 0) {
    let h = d.getHours();
    const m = pad(d.getMinutes());
    const period = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${h}:${m} ${period}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function weekStart(date) {
  const start = dayStart(date);
  const index = (start.getDay() + 1) % 7; // Saturday starts the week
  return addDays(start, -index);
}

function heatmap() {
  const weeks = 12;
  const start = addDays(weekStart(new Date()), -7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = addDays(start, i);
    const key = dayKey(date);
    const day = store.state.days[key];
    const prod = day?.prod || 0;
    const level = prod === 0 ? 0 : prod < 5 ? 1 : prod < 10 ? 2 : prod < 20 ? 3 : 4;
    cells.push(html`<span class="hm-cell ${key === dayKey() ? 'is-today' : ''}" data-l="${level}"
      title="${dateLabel(date)} — ${prod} إنتاج${day?.reviews ? ` · ${day.reviews} مراجعة` : ''}"></span>`);
  }
  return html`
    <div class="heatmap-scroll">
      <div class="heatmap">${cells}</div>
    </div>
    <div class="hm-legend">
      <span>أكثر</span>
      <i data-l="4"></i><i data-l="3"></i><i data-l="2"></i><i data-l="1"></i><i data-l="0"></i>
      <span>أقل</span>
    </div>
  `;
}

function heatSummary() {
  const entries = Object.entries(store.state.days).filter(([, day]) => (day.prod || 0) > 0);
  const activeDays = entries.length;
  const total = entries.reduce((sum, [, day]) => sum + day.prod, 0);
  const avg = activeDays ? Math.round(total / activeDays) : 0;
  const best = entries.reduce(
    (top, [key, day]) => ((day.prod || 0) > (top.prod || 0) ? { key, prod: day.prod } : top),
    { key: null, prod: 0 },
  );
  return html`
    <div class="hm-summary">
      <div class="hm-stat">
        <b>${activeDays}</b>
        <span>يوم فيه إنتاج</span>
      </div>
      <div class="hm-stat">
        <b>${avg}</b>
        <span>متوسط الإنتاج في اليوم النشط</span>
      </div>
      <div class="hm-stat">
        <b>${best.prod || 0}</b>
        <span>${best.key ? `أفضل يوم · ${dateLabel(new Date(best.key))}` : 'أفضل يوم لسه جاي'}</span>
      </div>
    </div>
  `;
}

function longestStreak() {
  const keys = Object.keys(store.state.days)
    .filter((key) => {
      const day = store.state.days[key];
      return day.prod > 0 || day.minutes > 0.5 || day.reviews > 0;
    })
    .sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const key of keys) {
    if (previous && (new Date(key) - new Date(previous)) / 86400000 === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

function activityLabel(status) {
  if (status === 'mastered') return 'متقنة';
  if (status === 'learning') return 'شغال عليها';
  return 'لسه جديدة';
}

function renderScheduleRow(row) {
  const { chunk, isDue, countdown, formattedNextDate, currentStage, stageInfo, stages } = row;
  const isMastered = currentStage >= 5;

  return html`
    <tr class="sr-row ${isDue ? 'is-due' : ''}" data-chunk-id="${chunk.id}">
      <td class="sr-col-chunk">
        <div class="sr-de" dir="ltr" title="${chunk.de}"><b>${chunk.de}</b></div>
        <div class="sr-ar sub muted" title="${chunk.ar}">${chunk.ar}</div>
      </td>
      <td class="sr-col-next">
        <div class="sr-next-stack">
          <div class="row" style="gap:4px;align-items:center">
            <span class="sr-stage-badge ${isMastered ? 'is-complete' : isDue ? 'is-due' : ''}">
              ${stageInfo.label}
            </span>
          </div>
          <div class="sr-countdown-wrap">
            ${isDue
              ? html`<span class="chip chip-amber sr-chip-pulse">مستحق الآن</span>`
              : isMastered
                ? html`<span class="chip chip-green">أتمت بنجاح ✅</span>`
                : html`<span class="countdown-text sub muted">${countdown.text}</span>`}
          </div>
          ${!isMastered && formattedNextDate
            ? html`<div class="sr-next-time sub muted">${formattedNextDate}</div>`
            : ''}
        </div>
      </td>
      <td class="sr-col-plan">
        <div class="sr-pill-stepper">
          ${stages.map((st) => {
            const isCurrent = st.stage === currentStage;
            const cls = st.done
              ? 'is-done'
              : isCurrent
                ? isDue
                  ? 'is-current-due'
                  : 'is-current'
                : 'is-pending';
            const label = st.done ? '✓' : shortTimeOrDate(st.scheduledAt);
            const tooltip = `${st.label}: ${st.done ? (st.formattedCompleted ? 'تمت: ' + st.formattedCompleted : 'تمت بنجاح') : 'الموعد: ' + st.formattedScheduled}`;
            return html`
              <div class="sr-pill ${cls}" title="${tooltip}">
                <span class="sr-pill-num">${st.stage}</span>
                <span class="sr-pill-lbl">${label}</span>
              </div>
            `;
          })}
        </div>
      </td>
      <td class="sr-col-action">
        ${isDue
          ? html`
              <a class="btn btn-primary btn-xs sr-action-btn" href="#/review?chunkId=${encodeURIComponent(chunk.id)}">
                ${icon('play')} راجع
              </a>
            `
          : isMastered
            ? html`<span class="chip chip-green sr-action-done">مكتمل</span>`
            : html`
              <a class="btn btn-ghost btn-xs sr-action-btn" href="#/review?chunkId=${encodeURIComponent(chunk.id)}">
                درّب
              </a>
            `}
      </td>
    </tr>
  `;
}

function renderScheduleTableInner() {
  const allRows = store.getScheduleRows();
  if (!allRows.length) {
    return html`
      <div class="sr-empty-box">
        <p class="sub muted">لسه مفيش جمل نشطة في جدول المراجعات. ابدأ تدريب أي جملة وهيتم جدولة مواعيد المراجعات الأربعة فوراً.</p>
      </div>
    `;
  }

  const activeRows = allRows.filter((r) => r.currentStage < 5);
  const dueRows = allRows.filter((r) => r.isDue);
  const doneRows = allRows.filter((r) => r.currentStage >= 5);

  let displayed = allRows;
  if (srTableFilter === 'active') displayed = activeRows;
  else if (srTableFilter === 'due') displayed = dueRows;
  else if (srTableFilter === 'done') displayed = doneRows;

  const totalFiltered = displayed.length;
  const hasLimit = !srTableShowAll && totalFiltered > 8;
  const visibleRows = hasLimit ? displayed.slice(0, 8) : displayed;

  return html`
    <div class="sr-filter-bar">
      <button class="sr-filter-btn ${srTableFilter === 'active' ? 'is-active' : ''}" data-sr-filter="active">
        النشطة <span class="sr-filter-count">${activeRows.length}</span>
      </button>
      <button class="sr-filter-btn ${srTableFilter === 'due' ? 'is-active' : ''}" data-sr-filter="due">
        المستحقة <span class="sr-filter-count ${dueRows.length > 0 ? 'text-amber' : ''}">${dueRows.length}</span>
      </button>
      <button class="sr-filter-btn ${srTableFilter === 'done' ? 'is-active' : ''}" data-sr-filter="done">
        المكتملة <span class="sr-filter-count">${doneRows.length}</span>
      </button>
      <button class="sr-filter-btn ${srTableFilter === 'all' ? 'is-active' : ''}" data-sr-filter="all">
        الكل <span class="sr-filter-count">${allRows.length}</span>
      </button>
    </div>

    ${visibleRows.length === 0
      ? html`<div class="sr-empty-box"><p class="sub muted">لا توجد جمل في هذا التصنيف حالياً.</p></div>`
      : html`
        <div class="schedule-table-wrap">
          <table class="schedule-live-table">
            <colgroup>
              <col style="width: 38%;">
              <col style="width: 24%;">
              <col style="width: 24%;">
              <col style="width: 14%;">
            </colgroup>
            <thead>
              <tr>
                <th>الجملة (Chunk)</th>
                <th>الموعد القادم</th>
                <th>خطة المراحل (1-4)</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody id="schedule-tbody">
              ${visibleRows.map((row) => renderScheduleRow(row))}
            </tbody>
          </table>
        </div>
      `}

    ${totalFiltered > 8
      ? html`
        <div class="sr-pagination-wrap">
          <button class="btn btn-ghost btn-xs sr-show-more-btn" data-act="sr:toggle-show-all">
            ${srTableShowAll ? 'عرض أقل (أول 8 فقط) ▲' : `عرض باقي الجمل (${totalFiltered - 8} جملة أخرى) ▼`}
          </button>
        </div>
      `
      : ''}
  `;
}

function renderScheduleTable() {
  const allRows = store.getScheduleRows();
  const dueCount = allRows.filter((r) => r.isDue).length;

  return html`
    <div class="panel panel-pad schedule-panel" id="sr-schedule-panel">
      <div class="between" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:18px">جدول تتبع مواعيد المراجعات (Spaced Repetition)</h2>
          <p class="sub muted" style="font-size:12px">مواعيد دقيقة بالعدّ التنازلي المباشر للمراحل الأربع لكل جملة نشطة</p>
        </div>
        <div class="row" style="gap:8px;align-items:center">
          ${dueCount > 0
            ? html`<span class="chip chip-amber" id="due-count-pill">${dueCount} مستحق الآن</span>`
            : html`<span class="chip chip-green" id="due-count-pill">كل المراجعات مجدولة</span>`}
          <a class="btn btn-ghost btn-sm" href="#/review">${icon('clock')} صفحة المراجعة</a>
        </div>
      </div>

      <div id="sr-table-container">
        ${renderScheduleTableInner()}
      </div>
    </div>
  `;
}

export const statsScreen = {
  render() {
    const stats = store.overall();
    const longest = longestStreak();
    const activity = store.activity(8);

    return html`
      <div class="page stats-page">
        <div class="section-head">
          <div>
            <span class="eyebrow">تقدمك</span>
            <h1 style="font-size:clamp(26px,3.2vw,34px);margin-top:2px">كل رقم هنا اتحسب من شغلك</h1>
            <p class="sub muted">التقدم بيتحفظ في ملف على جهازك — مفيش سيرفر ومفيش حساب.</p>
          </div>
          <div class="row">
            <button class="btn btn-ghost btn-sm" data-act="export">${icon('download')} صدّر</button>
            <button class="btn btn-ghost btn-sm" data-act="import">${icon('upload')} استورد</button>
          </div>
        </div>

        <div class="stat-strip">
          <div class="stat-cell"><b>${stats.productions}</b><span>إنتاج إجمالي</span></div>
          <div class="stat-cell"><b>${stats.mastered}<small>من ${stats.total}</small></b><span>جملة متقنة</span></div>
          <div class="stat-cell">
            <b>${stats.minutes >= 90
              ? html`${(stats.minutes / 60).toFixed(1)}<small>ساعة</small>`
              : html`${stats.minutes}<small>دقيقة</small>`}</b>
            <span>وقت تدريب تقديري</span>
          </div>
          <div class="stat-cell"><b>${longest}<small>يوم</small></b><span>أطول سلسلة</span></div>
        </div>

        <div class="stats-grid">
          <div class="heatmap-panel">
            <div class="between" style="margin-bottom:12px">
              <div>
                <h2 style="font-size:18px">نشاطك آخر 12 أسبوع</h2>
                <p class="sub muted" style="font-size:12px">كل عمود أسبوع (من السبت للجمعة) وكل مربع يوم — لونه بيكبر مع عدد الإنتاجات.</p>
              </div>
              <span class="chip chip-yellow">${stats.todayProd} النهاردة</span>
            </div>
            <div class="hm-layout">
              ${heatSummary()}
              <div class="hm-body">${heatmap()}</div>
            </div>
            ${store.state.meta.importedCount
              ? html`<p class="sub muted" style="font-size:11px;margin-top:8px">الإنتاجات المستوردة من ملف A1 مالهاش تواريخ، عشان كده مش ظاهرة على الخريطة.</p>`
              : ''}
          </div>

          <div class="panel panel-pad">
            <h2 style="font-size:18px;margin-bottom:12px">المستويات</h2>
            <div class="level-bars">
              ${store.levels.map((level) => {
                const levelStats = store.levelStats(level.id);
                return html`
                  <div class="lb-row" style="--lv:var(--${level.id.toLowerCase()})">
                    <div class="between">
                      <b>${level.id} — ${level.title}</b>
                      <span class="sub muted" style="font-size:11.5px">${levelStats.mastered} من ${levelStats.total} متقن</span>
                    </div>
                    <div class="meter"><span style="width:${levelStats.pct}%"></span></div>
                    <div class="sub muted" style="font-size:11px;margin-top:3px">
                      ${levelStats.learning} شغال عليه · ${levelStats.due} مستحق
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>
        </div>

        ${renderScheduleTable()}

        <div class="panel panel-pad">
          <div class="between" style="margin-bottom:10px">
            <h2 style="font-size:18px">آخر حركة</h2>
            <a class="link" href="#/review">المراجعة ${icon('forward')}</a>
          </div>
          ${activity.length
            ? html`
                <div class="activity-list">
                  ${activity.map(
                    (row) => html`
                      <div class="activity-row">
                        <time>${timeLabel(row.at)}</time>
                        <span class="de" style="flex:1">${store.chunk(row.id)?.de || row.id}</span>
                        <span class="chip ${row.status === 'mastered' ? 'chip-green' : ''}">${activityLabel(row.status)}</span>
                      </div>
                    `,
                  )}
                </div>
              `
            : html`<p class="sub muted">لسه مفيش حركة — افتح أول جملة وابدأ.</p>`}
        </div>
      </div>
    `;
  },

  mount(root) {
    const updateTable = () => {
      const container = root.querySelector('#sr-table-container');
      if (container) {
        container.innerHTML = String(renderScheduleTableInner());
      }
      const allRows = store.getScheduleRows();
      const dueCount = allRows.filter((r) => r.isDue).length;
      const pill = root.querySelector('#due-count-pill');
      if (pill) {
        if (dueCount > 0) {
          pill.className = 'chip chip-amber';
          pill.textContent = `${dueCount} مستحق الآن`;
        } else {
          pill.className = 'chip chip-green';
          pill.textContent = 'كل المراجعات مجدولة';
        }
      }
    };

    const timer = setInterval(() => {
      updateTable();
    }, 30000);

    const onClick = async (event) => {
      const filterBtn = event.target.closest('[data-sr-filter]');
      if (filterBtn) {
        srTableFilter = filterBtn.dataset.srFilter;
        updateTable();
        return;
      }

      const toggleBtn = event.target.closest('[data-act="sr:toggle-show-all"]');
      if (toggleBtn) {
        srTableShowAll = !srTableShowAll;
        updateTable();
        return;
      }

      const action = event.target.closest('[data-act]')?.dataset.act;
      if (action === 'export') {
        const result = await store.exportData();
        if (result?.ok) toast('اتصدّر الملف', 'download');
        else if (!result?.canceled) toast('مش قادر أصدّر', 'lock');
      }
      if (action === 'import') {
        const result = await store.importData();
        if (result?.ok) {
          toast('اتستورد التقدم — فتح الصفحة من جديد', 'upload');
          location.hash = '#/home';
          location.reload();
        } else if (!result?.canceled) toast(result?.error || 'الملف مش صالح', 'lock');
      }
    };
    root.addEventListener('click', onClick);
    return () => {
      clearInterval(timer);
      root.removeEventListener('click', onClick);
    };
  },
};
