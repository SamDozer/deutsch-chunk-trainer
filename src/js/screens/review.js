import { store } from '../store.js';
import { html, icon, dueLabel, relativeWhen, chunksLabel } from '../utils.js';
import { toast } from '../ui.js';
import { audioEngine } from '../audioEngine.js';

const TYPE_LABEL = {
  review: 'مراجعة جملة متقنة',
  produce: 'إنتاج مستحق',
  delayed: 'استدعاء مؤجل',
};

const TYPE_HINT = {
  review: 'الجملة كانت متقنة — قولها من غير ما تبص.',
  produce: 'الموعد وصل: أنتج 5 جمل مختلفة بنفس القالب.',
  delayed: 'بعد أسبوع — قولها من دماغك من غير مراجعة.',
};

export const reviewScreen = {
  render() {
    const queue = store.dueItems();
    const stats = store.overall();
    const counts = queue.reduce(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      { review: 0, produce: 0, delayed: 0 },
    );

    return html`
      <div class="page review-page">
        <div class="review-hero">
          <div>
            <span class="eyebrow" style="color:rgba(234,243,250,.6)">مراجعة النهاردة</span>
            <h1>${queue.length ? 'فاضل شغل بسيط وتبقى في السليم' : 'مفيش حاجة مستحقة النهاردة'}</h1>
            <p>
              ${queue.length
                ? `${chunksLabel(counts.review)} متقنة، ${counts.produce} إنتاج مستحق، ${counts.delayed} استدعاء مؤجل. المراجعة بتخلي الجملة تثبت في الذاكرة طويلة المدى.`
                : 'المراجعة بتظهر لوحدها في مواعيدها. تقدر تفتح جملة جديدة أو تراجع حاجة من المستويات.'}
            </p>
          </div>
          <div class="hero-count">
            <b>${queue.length}</b>
            <span>مستحق النهاردة</span>
          </div>
        </div>

        <div class="review-body ${queue.length ? '' : 'is-empty'}">
          <div id="review-main">
            ${queue.length ? '' : emptyReview(stats)}
          </div>
          <aside id="review-side">
            ${queue.length ? queuePanel(queue, 0) : ''}
          </aside>
        </div>
      </div>
    `;
  },

  mount(root) {
    const queue = store.dueItems();
    if (!queue.length) return null;

    const main = root.querySelector('#review-main');
    const side = root.querySelector('#review-side');
    const results = [];
    let index = 0;
    const revealed = new Set();

    const finish = () => {
      audioEngine.playWorkoutComplete();
      const good = results.filter((r) => r === 'good').length;
      const hard = results.filter((r) => r === 'hard').length;
      const again = results.filter((r) => r === 'again').length;
      main.innerHTML = String(html`
        <div class="review-card review-done">
          <div class="mastery-sticker">${icon('trophy')}</div>
          <h3>خلصت مراجعة النهاردة</h3>
          <p>${good} عرفت · ${hard} تقريبًا · ${again} نسيت. الجمل اللي نسيتها هترجع قريب جدًا، واللي عرفتها الفاصل بينها هيكبر.</p>
          <div class="row" style="justify-content:center">
            <a class="btn btn-primary" href="#/home">رجوع للرئيسية</a>
            <button class="btn btn-ghost" data-act="reload">حدّث القايمة</button>
          </div>
        </div>
      `);
      side.innerHTML = String(queuePanel(queue, queue.length, results));
    };

    const nextItem = () => {
      index += 1;
      if (index >= queue.length) finish();
      else paint();
    };

    const paint = () => {
      const item = queue[index];
      const chunk = store.chunk(item.id);
      if (!chunk) {
        nextItem();
        return;
      }
      const isRevealed = revealed.has(item.id);
      const isProduce = item.type === 'produce';

      main.innerHTML = String(html`
        <div class="review-card">
          <div class="prompt-label">
            <span class="chip ${isProduce ? 'chip-yellow' : ''}">${TYPE_LABEL[item.type]}</span>
            ${chunk.groupTitle ? html`<span class="chip chip-blue de" style="font-size:11px">قالب: ${chunk.groupTitle}</span>` : ''}
            <span>${index + 1} من ${queue.length}</span>
          </div>
          <p class="sub muted" style="margin-bottom:10px">${TYPE_HINT[item.type]}</p>

          ${isProduce
            ? html`
                <div class="review-de-reveal de" dir="ltr" style="animation:none">${chunk.de}</div>
                <div class="review-ar" style="font-size:18px;margin-top:12px">${chunk.ar}</div>
                <div class="callout" style="margin-top:6px">
                  ${icon('spark')}
                  <span>${chunk.template ? `القالب: ${chunk.template} — غيّر اللي بعده.` : 'غيّر في الجملة وانتج نسخ جديدة.'}</span>
                </div>
                <div class="drill-actions" style="justify-content:flex-start;margin-top:16px">
                  <button class="btn btn-primary" data-produce="${index}">${icon('check')} سجّلت ${item.amount} إنتاج</button>
                  <button class="btn btn-quiet" data-produce="${index}" data-amount="0">تخطّى</button>
                </div>
              `
            : html`
                <div class="review-ar">${chunk.ar}</div>
                ${isRevealed
                  ? html`<div class="review-de-reveal de" dir="ltr">${chunk.de}</div>`
                  : html`<div class="reveal-zone"><span>حاول تقولها قبل ما تفتح الإجابة</span><button class="btn btn-ghost btn-sm" data-reveal>شوف الجملة</button></div>`}
                ${isRevealed && item.type === 'review'
                  ? html`
                      <div class="grade-row" style="margin-top:16px">
                        <button class="grade-btn g-again" data-grade="again">نسيتها<span>بعد يوم</span></button>
                        <button class="grade-btn g-hard" data-grade="hard">تقريبًا<span>فاصل أطول شوية</span></button>
                        <button class="grade-btn g-good" data-grade="good">عرفتها<span>فاصل أطول</span></button>
                      </div>
                    `
                  : ''}
                ${isRevealed && item.type === 'delayed'
                  ? html`
                      <div class="grade-row" style="margin-top:16px;grid-template-columns:repeat(2,1fr)">
                        <button class="grade-btn g-hard" data-grade="hard">لسه محتاجة مراجعة<span>هترجع تاني</span></button>
                        <button class="grade-btn g-good" data-grade="good">طلعت من غير مراجعة<span>تمام</span></button>
                      </div>
                    `
                  : ''}
              `}
        </div>
      `);

      side.innerHTML = String(queuePanel(queue, index, results));
    };

    const onGrade = (grade) => {
      const item = queue[index];
      if (grade === 'good') audioEngine.playSetComplete(index);
      else if (grade === 'again') audioEngine.playSoftError();
      else audioEngine.playTap();

      if (item.type === 'review') {
        store.gradeReview(item.id, grade);
        results.push(grade);
        toast(grade === 'good' ? 'تمام — الفاصل هيكبر' : grade === 'hard' ? 'خدت وقت — هترجع أقرب' : 'هترجع بكرة', 'check');
      } else if (item.type === 'delayed') {
        if (grade === 'good') {
          store.setDelayed(item.id, true, 5);
          results.push('good');
          toast('الاستدعاء المؤجل عدّى', 'trophy');
        } else {
          results.push('again');
          toast('خليها ترجع في المراجعة القريبة', 'clock');
        }
      }
      nextItem();
    };

    const onClick = (event) => {
      if (event.target.closest('[data-act="reload"]')) {
        location.reload();
        return;
      }
      if (event.target.closest('[data-reveal]')) {
        revealed.add(queue[index].id);
        paint();
        return;
      }
      const grade = event.target.closest('[data-grade]');
      if (grade) {
        onGrade(grade.dataset.grade);
        return;
      }
      const produce = event.target.closest('[data-produce]');
      if (produce) {
        const item = queue[index];
        if (produce.dataset.amount === '0') {
          audioEngine.playSoftError();
          toast('اتخطت — هتفضل مستحقة', 'clock');
          nextItem();
          return;
        }
        audioEngine.playSetComplete(index);
        store.addProduction(item.id, item.amount || 5);
        results.push('good');
        toast(`سجلت ${item.amount || 5} إنتاج`, 'check');
        nextItem();
      }
    };

    root.addEventListener('click', onClick);
    paint();
    return () => root.removeEventListener('click', onClick);
  },
};

function queuePanel(queue, activeIndex, results = []) {
  const shown = queue.slice(0, 12);
  return html`
    <div class="queue-panel">
      <h3>قايمة المراجعة</h3>
      <p class="sub muted" style="margin-bottom:6px">${chunksLabel(queue.length)} مستحقة النهاردة</p>
      ${shown.map((item, i) => {
        const chunk = store.chunk(item.id);
        const done = i < activeIndex;
        const active = i === activeIndex;
        return html`
          <div class="queue-item" style="${active ? 'background:var(--card-2);border-radius:10px;padding-inline:8px' : ''}">
            <span class="chip ${done ? 'chip-green' : item.type === 'produce' ? 'chip-yellow' : ''}" style="min-width:58px;justify-content:center">
              ${done ? 'تم' : item.type === 'review' ? 'مراجعة' : item.type === 'produce' ? 'إنتاج' : 'مؤجل'}
            </span>
            <span class="de">${chunk?.de || item.id}</span>
            <span class="sub muted" style="font-size:10.5px;white-space:nowrap">${done ? '' : dueLabel(item.due)}</span>
          </div>
        `;
      })}
      ${queue.length > shown.length
        ? html`<p class="sub muted" style="margin-top:8px">+ ${queue.length - shown.length} كمان في القايمة</p>`
        : ''}
    </div>
  `;
}

function emptyReview(stats) {
  const pointer = store.pointer();
  return html`
    <div class="empty" style="min-height:280px;justify-content:center">
      <div class="empty-icon">${icon('check')}</div>
      <h3>مفيش مراجعة مستحقة</h3>
      <p>المراجعة بتظهر لما يحين وقتها — إنتاج مستحق، استدعاء مؤجل، أو جملة متقنة وصل معادها. استغل الوقت في جملة جديدة.</p>
      <div class="row" style="justify-content:center;margin-top:6px">
        <a class="btn btn-primary" href="#/practice/${pointer?.chunkId || 'A1-001'}?step=${pointer?.step || 1}">افتح الجملة الحالية</a>
        <a class="btn btn-ghost" href="#/stats">شوف تقدمك</a>
      </div>
      <p class="sub muted" style="margin-top:14px">${chunksLabel(stats.mastered)} متقنة · ${stats.productions} إنتاج إجمالي</p>
    </div>
  `;
}
