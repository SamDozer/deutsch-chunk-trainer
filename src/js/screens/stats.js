import { store } from '../store.js';
import { html, icon, dayKey, dayStart, addDays, dateLabel, relativeWhen, timeLabel } from '../utils.js';
import { toast } from '../ui.js';

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
    const onClick = async (event) => {
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
    return () => root.removeEventListener('click', onClick);
  },
};
