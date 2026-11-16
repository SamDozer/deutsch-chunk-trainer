import {
  STAGES,
  PRODUCE_PLAN,
  VARIATION_AXES,
  FUNCTIONS,
  store,
} from '../store.js';
import {
  html,
  icon,
  raw,
  clamp,
  dayKey,
  formatClock,
  dueLabel,
  relativeWhen,
  timeLabel,
  addDays,
  daysBetween,
  speech,
  debounce,
  esc,
} from '../utils.js';
import { toast, confirmDialog, openModal } from '../ui.js';
import { openRecallDrill, openSprintDrill, openSpeakingDrill } from '../drills.js';
import { audioEngine } from '../audioEngine.js';
import { trophyManager } from '../trophies.js';

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

const CHECK_ITEMS = [
  { key: 'read', title: 'اقرأ الجملة بصوت واطي', hint: 'مرة واحدة كفاية — المهم تفهمها مش تحفظها' },
  { key: 'mean', title: 'افهم المعنى بالعربي', hint: 'شوف الترجمة وقارنها باللي فهمته' },
  { key: 'func', title: 'اعرف الوظيفة', hint: 'رأي؟ مقارنة؟ سبب؟ رد؟' },
  { key: 'order', title: 'راقب ترتيب الكلمات', hint: 'شوف إيه الثابت وإيه اللي بيتغير' },
];

function germanParts(chunk) {
  if (!chunk.template) return { prefix: '', rest: chunk.de };
  const prefix = chunk.template.replace(/\s*…$/, '').trim();
  if (prefix && chunk.de.startsWith(prefix)) {
    return { prefix, rest: chunk.de.slice(prefix.length) };
  }
  return { prefix: '', rest: chunk.de };
}

function ring(value, total) {
  const pct = total ? clamp(value / total, 0, 1) : 0;
  return raw(`
    <svg viewBox="0 0 108 108" aria-hidden="true">
      <circle class="ring-bg" cx="54" cy="54" r="${RING_R}"></circle>
      <circle class="ring-fg" cx="54" cy="54" r="${RING_R}"
        stroke-dasharray="${RING_C.toFixed(1)}"
        stroke-dashoffset="${(RING_C * (1 - pct)).toFixed(1)}"></circle>
    </svg>
    <div class="ring-center"><b>${value}</b><span>من ${total}</span></div>
  `);
}

function stepHead(index, title, sub, totalSteps = 4) {
  return html`
    <div class="step-head">
      <div class="step-kicker"><b>${index}</b> من ${totalSteps} خطوات</div>
      <h2>${title}</h2>
      <p class="step-sub">${sub}</p>
    </div>
  `;
}

function chunkReference(chunk) {
  const parts = germanParts(chunk);
  return html`
    <div class="ref-card">
      <div class="de">
        ${parts.prefix ? html`<span class="tpl-mark">${parts.prefix}</span>` : ''}${parts.rest}
      </div>
      <div class="ref-ar">${chunk.ar}</div>
    </div>
  `;
}

/* ---------------- STEP 1 ---------------- */

function stepUnderstand(chunk, local, isLast = false) {
  const rec = store.record(chunk.id);
  const checks = rec.understand.checks || {};
  const parts = germanParts(chunk);
  const prefixWords = parts.prefix ? parts.prefix.split(/\s+/).length : 0;
  const tokens = chunk.de.split(/\s+/);

  return html`
    ${stepHead(1, 'افهم الـChunk', 'اقرأ الجملة، افهم معناها بالعربي، وحدد وظيفتها قبل أي تدريب.', isLast ? 5 : 4)}
    <div class="chunk-hero">
      <div class="de">
        ${parts.prefix ? html`<span class="tpl-mark">${parts.prefix}</span>` : ''}${parts.rest}
      </div>
      ${local.revealed
        ? html`<div class="ar-reveal">${chunk.ar}</div>`
        : html`
            <div class="reveal-zone">
              <span>غطّي المعنى الأول... جرّب تفهمه بنفسك</span>
              <button class="btn btn-ghost btn-sm" data-act="understand:reveal">${icon('eye')} شوف المعنى</button>
            </div>
          `}
      <div class="chunk-tags">
        <span class="chip level-chip">${chunk.level}</span>
        <span class="chip">${chunk.id}</span>
        ${chunk.template ? html`<span class="chip chip-yellow">القالب: ${chunk.template}</span>` : ''}
      </div>
    </div>

    <div class="check-list">
      ${CHECK_ITEMS.map((item) => {
        const on = Boolean(checks[item.key]);
        return html`
          <button class="check-row ${on ? 'is-on' : ''}" data-act="understand:check" data-check="${item.key}">
            <span class="check-box">${icon('check')}</span>
            <span class="check-text"><strong>${item.title}</strong><span>${item.hint}</span></span>
          </button>
        `;
      })}
    </div>

    <div>
      <div class="eyebrow" style="margin-bottom:8px">وظيفة الجملة في الكلام</div>
      <div class="func-row">
        ${FUNCTIONS.map(
          (name) => html`<button class="func-chip ${rec.understand.func === name ? 'is-on' : ''}" data-act="understand:func" data-func="${name}">${name}</button>`,
        )}
      </div>
    </div>

    ${local.showMap
      ? html`
          <div>
            <div class="eyebrow" style="margin-bottom:8px">خريطة الجملة</div>
            <div class="wordmap">
              ${tokens.map(
                (token, index) =>
                  html`<span class="token ${index >= prefixWords && prefixWords > 0 ? 'is-slot' : ''}">${token}</span>`,
              )}
            </div>
            <p class="wordmap-note" style="margin-top:8px">
              ${prefixWords
                ? 'الجزء الملوّن هو القالب الثابت، والباقي هو اللي بتغيّره كل مرة.'
                : 'الجملة كلها قالب واحد — غيّر فيها لما توصل لخطوة التنويع.'}
            </p>
          </div>
        `
      : html`<button class="btn btn-ghost btn-sm" data-act="understand:map" style="align-self:flex-start">${icon('spark')} افتح خريطة الكلمات</button>`}

    <div class="between" style="padding-top:6px">
      <span class="sub muted">الفهم مش حفظ — لو مش قادر تشرح الجملة بكلامك، ارجع اقرأها تاني.</span>
      <button class="btn btn-primary" data-act="understand:done">
        ${icon('check')} فهمت — يلا ننطقها
      </button>
    </div>
  `;
}

/* ---------------- STEP 2 ---------------- */

function stepSpeak(chunk, local, isLast = false) {
  const rec = store.record(chunk.id);
  const passes = rec.speak.passes;
  const ttsOn = store.state.settings.tts;
  const hasVoice = speech.germanVoices().length > 0;
  const voicesLoaded = speech.allVoices().length > 0;

  return html`
    ${stepHead(2, 'انطقه بصوت عالي', 'تلات مرات بس: بطيء، طبيعي، وبعدين من غير ما تبص على الجملة.', isLast ? 5 : 4)}
    ${chunkReference(chunk)}
    <div class="tts-row">
      <button class="speak-btn" data-act="say" data-rate="0.62">${icon('speaker')} اسمعه بطيء</button>
      <button class="speak-btn" data-act="say" data-rate="0.95">${icon('speaker')} اسمعه طبيعي</button>
      <button class="speak-btn" data-act="blind" data-autofocus>${icon('eye-off')} من غير ما تبص</button>
    </div>
    ${!ttsOn
      ? html`<div class="callout">${icon('speaker')}<span>الصوت متوقف من الإعدادات — تقدر ترجعه من صفحة الإعدادات.</span></div>`
      : voicesLoaded && !hasVoice
        ? html`<div class="callout">${icon('speaker')}<span>مفيش صوت ألماني متسطّب على الجهاز — ممكن تثبّت صوت Deutsch من إعدادات ويندوز، أو تكمّل بالتسجيل الصوتي.</span></div>`
        : ''}

    <div class="pass-grid">
      ${[
        { key: 'slow', title: '1 · ببطء', hint: 'انطق كل كلمة واضحة، واقف عند المقاطع الصعبة.' },
        { key: 'natural', title: '2 · بسرعة طبيعية', hint: 'زي ما هتقولها في كلام عادي.' },
        { key: 'blind', title: '3 · من غير ما تبص', hint: 'قفل الجملة وقولها من دماغك.' },
      ].map(
        (pass) => html`
          <button class="pass-card ${passes[pass.key] ? 'is-done' : ''}" data-act="speak:pass" data-pass="${pass.key}">
            <span class="pass-num">${passes[pass.key] ? 'تم ✓' : 'لسه'}</span>
            <span class="pass-title">${pass.title}</span>
            <span class="pass-hint">${pass.hint}</span>
          </button>
        `,
      )}
    </div>

    <div class="record-box" id="rec-area">
      <span class="record-dot"></span>
      <div style="flex:1;min-width:160px">
        <div class="pass-title">سجّل صوتك وقارنه (اختياري)</div>
        <div class="pass-hint">مش بيتحفظ على الجهاز — بيتمسح أول ما تقفل الجلسة.</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-act="record">${icon('mic')} ابدأ التسجيل</button>
    </div>
  `;
}

/* ---------------- STEP 3 ---------------- */

function stepProduce(chunk, local, isLast = false) {
  const rec = store.record(chunk.id);
  const total = rec.produce.total || 0;
  const batches = store.batchState(chunk.id);
  const now = new Date();
  const session1Done = total >= 10;

  return html`
    ${stepHead(3, 'درّب عليه 30 إنتاج', 'مش 30 مرة نفس الجملة — 30 جملة مختلفة بنفس القالب، موزّعة على أسبوع.', isLast ? 5 : 4)}
    ${chunkReference(chunk)}
    <div class="produce-top">
      <div class="ring-wrap">${ring(total, 30)}</div>
      <div class="produce-copy">
        <strong>${total >= 30 ? 'خلّصت الـ30 إنتاج كاملين ✓' : session1Done ? `جلسة اليوم مكتملة (${total} من 30)` : `فاضل ${10 - total} إنتاج لإكمال الجلسة الأولى`}</strong>
        <span>${session1Done ? 'الجلسة الأولى (10 جمل) تمت بنجاح! باقي الجلسات مجدولة للتثبيت في المراجعة، وتقدر تسجل تدريب إضافي دلوقتي لو حابب.' : 'الخطة: 10 في الجلسة الأولى، وبعدين 5 × 4 مرات على مدار أسبوع. البرنامج بيفكرك بيهم في صفحة المراجعة.'}</span>
      </div>
    </div>

    <div class="callout" style="${session1Done ? 'background:var(--card-2);border-inline-start-color:var(--green)' : ''}">
      ${icon(session1Done ? 'check' : 'spark')}
      <span>${session1Done ? '<b>ممتاز:</b> الجلسة الأولى كافية لفتح باقي الخطوات والإتقان. المواعيد الجاية معمولة للتكرار المتباعد.' : '<b>مهم:</b> 10 جمل مختلفة في الجلسة الأولى — لو كررت نفس الجملة 30 مرة هتحفظ الصوت مش اللغة.'}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 6px">
      <div class="eyebrow">جدول جلسات التوزيع</div>
      <button class="btn btn-ghost btn-sm" data-act="batch:extra" title="سجل إنتاج إضافي دون انتظار المؤقت">${icon('spark')} تدريب حر إضافي (+5)</button>
    </div>

    <table class="batch-table">
      <thead>
        <tr><th>المرحلة</th><th>المطلوب</th><th>الموعد</th><th>الحالة</th><th></th></tr>
      </thead>
      <tbody>
        ${batches.map((batch) => {
          const state = batch.done
            ? html`<span class="batch-state done">تم</span>`
            : batch.overdue
              ? html`<span class="batch-state due">مستحق</span>`
              : html`<span class="batch-state wait">مستني</span>`;
          const when = batch.done
            ? batch.entry?.at
              ? `${timeLabel(batch.entry.at)} · ${relativeWhen(batch.entry.at)}`
              : '—'
            : batch.due
              ? `${timeLabel(batch.due)} · ${dueLabel(batch.due)}`
              : '—';
          const canLog = batch.isNext && (!batch.due || batch.due <= now);
          const action = batch.done
            ? html`<span class="sub muted" style="font-size:11px">${batch.entry?.at ? relativeWhen(batch.entry.at) : 'مكتمل'}</span>`
            : canLog
              ? html`<button class="btn btn-primary btn-sm" data-act="batch:log" data-index="${batch.index}">سجّل ${batch.amount}</button>`
              : '';
          return html`
            <tr>
              <td><span class="batch-name">${batch.label}</span><div class="batch-when">${batch.sub}</div></td>
              <td data-label="المطلوب"><span class="batch-amount">${batch.amount}</span></td>
              <td data-label="الموعد"><span class="batch-when">${when}</span></td>
              <td data-label="الحالة">${state}</td>
              <td style="text-align:end">${action}</td>
            </tr>
          `;
        })}
      </tbody>
    </table>

    <div class="journal">
      <div class="eyebrow" style="margin-bottom:6px">جرنال الإنتاج (اختياري)</div>
      <textarea id="notes" placeholder="اكتب جمل إنتاجك هنا — عشان ترجع لها بعدين">${rec.notes || ''}</textarea>
    </div>
  `;
}

/* ---------------- STEP 4: TEST ---------------- */

function stepTest(chunk, isLast = false, next = null) {
  const rec = store.record(chunk.id);
  const recall = rec.test.recall;
  const sprint = rec.test.sprint;
  const speaking = rec.test.speaking;
  const delayed = rec.test.delayed;
  const groupPos = store.getGroupPosition(chunk.id);
  const delayedDue = store.delayedDue(chunk.id);
  const delayedReady = Boolean(delayedDue && delayedDue <= new Date());
  const daysLeft = delayedDue ? Math.max(1, daysBetween(new Date(), delayedDue)) : 7;
  const passedCount = [recall.passed, sprint.count >= 5, speaking.seconds >= 30].filter(Boolean).length;
  const allImmediateDone = passedCount === 3;

  return html`
    ${stepHead(4, 'اختبر نفسك', 'تلات اختبارات فورية للاستدعاء والسرعة والكلام، واختبار مؤجل بعد أسبوع.', isLast ? 5 : 4)}
    <div class="produce-top" style="gap:18px">
      <div class="counter-badge ${allImmediateDone ? 'is-full' : ''}" style="font-size:14px;height:30px;padding:0 12px">${passedCount} من 3</div>
      <div class="produce-copy">
        <strong>${allImmediateDone ? 'كل الاختبارات الفورية للجملة اكتملت بنجاح ✓' : 'كمّل الاختبارات الفورية للجملة'}</strong>
        <span>الاستدعاء السريع وسبرنت الدقيقة والكلام المرتجل شرط أساسي لإتقان الجملة. الاستدعاء المؤجل يأتي بعد أسبوع في جدول المراجعة.</span>
      </div>
    </div>

    ${allImmediateDone
      ? html`
          <div class="callout" style="background:var(--card-2);border-inline-start-color:var(--green);margin-top:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:24px">🎉</span>
              <div>
                <strong>اجتزت كل اختبارات الجملة بنجاح! (+20 XP)</strong>
                <p style="margin:2px 0 0;font-size:12px;color:var(--muted)">
                  ${next?.inGroup
                    ? `الجملة أصبحت متقنة. اضغط للاستمرار إلى الجملة التالية في المجموعة.`
                    : `أتممت جميع جمل المجموعة الأساسية! اضغط للانتقال للمرحلة الختامية (5 تنويعات للقالب).`}
                </p>
              </div>
            </div>
            ${next?.inGroup
              ? html`<a class="btn btn-primary btn-sm" href="#/practice/${next.id}?step=1">
                  الجملة التالية بالمجموعة (${next.position}/${next.total}) ${icon('forward')}
                </a>`
              : html`<button class="btn btn-primary btn-sm" data-act="go-step" data-step="5">
                  المرحلة الختامية للمجموعة (5 تنويعات) ${icon('spark')}
                </button>`}
          </div>
        `
      : ''}

    <div class="test-grid">
      <div class="test-card ${recall.passed ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${recall.passed ? 'green' : ''}">${icon('clock')}</span>
          <h4>استدعاء سريع</h4>
        </div>
        <p class="test-req">اقرا العربي وقول الألماني قبل انتهاء العدّ التنازلي. محتاج 4 من 5.</p>
        <div class="test-foot">
          <span class="test-state ${recall.passed ? 'done' : ''}">
            ${recall.passed ? `تم ✓ (${recall.score} من ${recall.total})` : recall.at ? `${recall.score} من ${recall.total} · ${relativeWhen(recall.at)}` : 'لسه ما اتجربش'}
          </span>
          <button class="btn ${recall.passed ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="recall:start">${recall.passed ? 'أعد' : 'ابدأ'}</button>
        </div>
      </div>

      <div class="test-card ${sprint.count >= 5 ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${sprint.count >= 5 ? 'green' : ''}">${icon('target')}</span>
          <h4>سباق الـ60 ثانية</h4>
        </div>
        <p class="test-req">5 جمل في دقيقة واحدة. السرعة بتبيّن إن القالب بقى في دماغك.</p>
        <div class="test-foot">
          <span class="test-state ${sprint.count >= 5 ? 'done' : ''}">${sprint.count >= 5 ? `تم ✓ (${sprint.count} جمل/دقيقة)` : sprint.at ? `${sprint.count} جمل` : 'لسه ما اتجربش'}</span>
          <button class="btn ${sprint.count >= 5 ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="sprint:start">${sprint.count ? 'أعد' : 'ابدأ'}</button>
        </div>
      </div>

      <div class="test-card ${speaking.seconds >= 30 ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${speaking.seconds >= 30 ? 'green' : ''}">${icon('mic')}</span>
          <h4>كلام مرتجل</h4>
        </div>
        <p class="test-req">اتكلم 30–45 ثانية واستخدم الجملة طبيعي في الكلام.</p>
        <div class="test-foot">
          <span class="test-state ${speaking.seconds >= 30 ? 'done' : ''}">
            ${speaking.seconds >= 30 ? `تم ✓ (${Math.round(speaking.seconds)} ثانية)` : speaking.at ? `${Math.round(speaking.seconds)} ثانية` : 'لسه ما اتجربش'}
          </span>
          <button class="btn ${speaking.seconds >= 30 ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="speaking:start">${speaking.seconds >= 30 ? 'أعد' : 'ابدأ'}</button>
        </div>
      </div>

      <div class="test-card ${delayed.passed ? 'is-done' : ''}" style="grid-column:1/-1">
        <div class="test-head">
          <span class="test-ico ${delayed.passed ? 'green' : delayedReady ? '' : 'locked'}">${delayed.passed ? icon('trophy') : icon('calendar')}</span>
          <h4>استدعاء مؤجل (تثبيت متباعد بعد 7 أيام)</h4>
        </div>
        <p class="test-req">بعد أسبوع من تدريب الجملة، قولها من غير أي مراجعة في اليوم ده لتأكيد تثبيتها في الذاكرة الدائمة.</p>
        <div class="test-foot">
          <span class="test-state ${delayed.passed ? 'done' : delayedReady ? '' : 'locked'}">
            ${delayed.passed
              ? `عدّى بنجاح · ${relativeWhen(delayed.at)}`
              : !delayedDue
                ? 'بيفتح تلقائيًا بعد أسبوع من تدريب الجملة'
                : delayedReady
                  ? 'مستحق النهاردة'
                  : `🔒 مقفل — بيفتح بعد ${daysLeft} أيام`}
          </span>
          ${delayed.passed
            ? html`<span class="test-state done">تم ✓</span>`
            : delayedReady
              ? html`<button class="btn btn-primary btn-sm" data-act="delayed:start">ابدأ</button>`
              : html`<button class="btn btn-ghost btn-sm" disabled style="opacity:0.5;cursor:not-allowed">${icon('lock')} يفتح بعد ${daysLeft} يوم</button>`}
        </div>
      </div>
    </div>
  `;
}

/* ---------------- STEP 5: GROUP FINALE ---------------- */

function stepGroupFinale(chunk, local) {
  const rec = store.record(chunk.id);
  const groupPos = store.getGroupPosition(chunk.id);
  const group = groupPos?.group;
  const groupId = group?.id;
  const groupDone = groupId ? store.isGroupVariationDone(groupId) : false;
  const groupVars = groupId ? store.getGroupVariations(groupId) : [];
  const items = groupVars.length ? groupVars : rec.vary.items;
  const siblings = store.siblings(chunk.id, 5);
  const voice = local.voice;
  const templateTitle = group?.title || chunk.template || chunk.de;

  return html`
    <div class="step-head">
      <div class="step-kicker" style="color:var(--yellow);font-weight:700">
        🏆 المرحلة الختامية للمجموعة ${groupPos ? `· (${groupPos.total} من ${groupPos.total} جمل مكتملة)` : ''}
      </div>
      <h2>المرحلة الختامية للمجموعة: غيّر كل مرة (5 تنويعات للقالب)</h2>
      <p class="step-sub">
        أتممت التدريب على جمل المجموعة! دلوقتي هتطبّق 5 تنويعات جديدة على قالب «<b class="de" style="color:var(--ink)">${templateTitle}</b>» عبر المحاور الأربعة (الفاعل، الزمن، الكلمات، الموقف) لاعتماد إتقان المجموعة بالكامل (+150 XP).
      </p>
    </div>

    ${chunkReference(chunk)}

    ${groupDone
      ? html`
          <div class="callout" style="background:var(--card-2);border-inline-start-color:var(--green);margin:14px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:28px">🏆</span>
              <div>
                <strong>تم إنجاز شرط الـ 5 تنويعات وإتقان مجموعة «${templateTitle}» بنجاح! (+150 XP)</strong>
                <p style="margin:2px 0 0;font-size:12px;color:var(--muted)">القالب وجمله أصبحت متقنة بالكامل في سجلك. تقدر تضيف تنويعات إضافية أو ترجع لقائمة المستويات.</p>
              </div>
            </div>
            <a class="btn btn-primary btn-sm" href="#/level/${chunk.level}">
              ${icon('forward')} العودة لقائمة المجموعات
            </a>
          </div>
        `
      : ''}

    <div class="produce-top" style="gap:14px">
      <div class="counter-badge ${items.length >= 5 ? 'is-full' : ''}" style="font-size:14px;height:30px;padding:0 12px">
        ${items.length} من 5 تنويعات للقالب
      </div>
      <div class="produce-copy">
        <strong>${items.length >= 5 ? 'اكتمل شرط الـ 5 تنويعات للقالب ✓' : `فاضل ${Math.max(0, 5 - items.length)} تنويعات لاعتماد إتقان المجموعة`}</strong>
        <span>اكتب الجملة بالألماني أو انطقها بالمايك، وسجلها عبر المحاور الأربعة. بعد 5 تنويعات تُعتبر المجموعة متقنة بالكامل (+150 XP)!</span>
      </div>
    </div>

    <div class="axis-grid">
      ${VARIATION_AXES.map((axis) => {
        const axisItems = items.filter((item) => item.axis === axis.key);
        return html`
          <div class="axis-card">
            <div class="axis-head">
              <span class="axis-title">${axis.title}</span>
              <span class="counter-badge ${axisItems.length ? 'is-full' : ''}">${axisItems.length}</span>
            </div>
            <span class="axis-hint">${axis.hint}</span>
            <textarea data-draft="${axis.key}" dir="auto" placeholder="اكتب جملة أو انطقها بالألماني..." ${voice.axis === axis.key && voice.state !== 'idle' ? 'readonly' : ''}>${local.drafts[axis.key] || ''}</textarea>
            <div class="axis-actions">
              <button class="btn btn-ghost btn-sm" data-act="vary:save" data-axis="${axis.key}" ${voice.axis === axis.key && voice.state !== 'idle' ? 'disabled' : ''}>
                ${icon('check')} سجّل التنويع
              </button>
              <button class="btn btn-ghost btn-sm axis-voice-btn ${voice.axis === axis.key && voice.state === 'recording' ? 'is-recording' : ''}"
                data-act="vary:voice" data-axis="${axis.key}" ${voice.state !== 'idle' && voice.axis !== axis.key ? 'disabled' : ''}
                aria-label="${voice.axis === axis.key && voice.state === 'recording' ? 'إيقاف التسجيل' : voice.axis === axis.key && voice.state === 'processing' ? 'إلغاء التفريغ' : `سجّل جملة صوتية في ${axis.title}`}"
                aria-pressed="${voice.axis === axis.key && voice.state === 'recording' ? 'true' : 'false'}">
                ${voice.axis === axis.key && voice.state === 'processing' ? icon('close') : icon('mic')}
                ${voice.axis === axis.key && voice.state === 'recording' ? 'إيقاف' : voice.axis === axis.key && voice.state === 'processing' ? 'إلغاء' : 'اتكلم بالألماني'}
              </button>
            </div>
            ${voice.axis === axis.key && voice.state !== 'idle'
              ? html`<div class="axis-voice-status ${voice.state}" role="status" aria-live="polite">
                  <span class="axis-voice-indicator"></span>
                  ${voice.state === 'recording' ? 'بيتسجّل صوتك... اضغط إيقاف لما تخلص (حد أقصى 30 ثانية).' : 'Whisper بيحوّل صوتك لنص ألماني... ممكن ياخد شوية وقت.'}
                </div>`
              : ''}
          </div>
        `;
      })}
    </div>

    ${rec.vary.importedDone && !items.length
      ? html`<div class="callout">${icon('spark')}<span>الخطوة دي متسجلة من ملف A1 القديم — تقدر تضيف تنويعات جديدة لو حبيت.</span></div>`
      : ''}

    ${items.length
      ? html`
          <div>
            <div class="eyebrow" style="margin-bottom:8px">تنويعات قالب المجموعة (${items.length} مسجلة)</div>
            <div class="vary-list">
              ${items.map(
                (item, index) => html`
                  <div class="vary-item">
                    <span class="chip">${store.axisTitle(item.axis)}</span>
                    <span class="de">${item.text}</span>
                    <button class="vary-del" data-act="vary:del" data-index="${index}" aria-label="امسح">${icon('close')}</button>
                  </div>
                `,
              )}
            </div>
          </div>
        `
      : ''}

    ${siblings.length
      ? html`
          <div>
            <div class="eyebrow" style="margin-bottom:8px">جمل تانية بنفس القالب</div>
            <div class="row">
              ${siblings.map(
                (sibling) => html`<a class="chip" href="#/practice/${sibling.id}?step=1" title="${sibling.ar}">${sibling.de.slice(0, 40)}${sibling.de.length > 40 ? '…' : ''}</a>`,
              )}
            </div>
          </div>
        `
      : ''}
  `;
}

/* ---------------- PRACTICE SCREEN ---------------- */

function railMarkup(step, isLast = false) {
  const flags = store.stageFlags(currentChunkId);
  const stagesToRender = isLast ? STAGES.slice(0, 5) : STAGES.slice(0, 4);
  return html`
    ${stagesToRender.map((stage, index) => {
      const number = index + 1;
      const done = flags[index];
      const isNow = number === step;
      return html`
        <li class="rail-step ${done ? 'is-done' : ''} ${isNow ? 'is-now' : ''}" data-act="go-step" data-step="${number}">
          <span class="rail-num">${done && !isNow ? icon('check') : number}</span>
          <span>
            <span class="rail-title">${stage.title}</span>
            <span class="rail-hint">${stage.hint}</span>
          </span>
        </li>
      `;
    })}
  `;
}

let currentChunkId = null;

export const practiceScreen = {
  render({ params, query }) {
    const chunk = store.chunk(params.chunkId);
    if (!chunk) {
      return html`
        <div class="page">
          <div class="empty"><div class="empty-icon">${icon('search')}</div>
            <h3>الجملة دي مش موجودة</h3><p>الكود ${params.chunkId} مش في الملفات.</p>
            <a class="btn btn-primary" href="#/home">رجوع للرئيسية</a>
          </div>
        </div>
      `;
    }
    currentChunkId = chunk.id;
    const level = store.level(chunk.level);
    const groupPos = store.getGroupPosition(chunk.id);
    const group = groupPos?.group;
    const cIndex = level?.chunks?.findIndex((c) => c.id === chunk.id) ?? -1;
    const prevC = groupPos?.prevChunk || (cIndex > 0 ? level.chunks[cIndex - 1] : null);
    const nextC = groupPos?.nextChunk || (cIndex >= 0 && cIndex < (level?.chunks?.length - 1) ? level.chunks[cIndex + 1] : null);
    const isLastChunk = !nextC;
    const maxAllowedStep = isLastChunk ? 5 : 4;
    const requested = Number(query.get('step'));
    const step = clamp(Number.isFinite(requested) && requested > 0 ? requested : store.currentStep(chunk.id), 1, maxAllowedStep);
    const total = store.peek(chunk.id)?.produce.total || 0;
    const phase = store.sessionPhase(chunk.id);
    const rankInfo = trophyManager.getRankInfo();

    return html`
      <div class="page practice-page" style="--lv:var(--${chunk.level.toLowerCase()})">
        <div class="practice-top">
          <a class="back-btn" href="#/level/${chunk.level}" aria-label="رجوع للمستوى">${icon('back')}</a>
          <div class="practice-meta">
            <strong>${chunk.level} · ${chunk.id}</strong>
            <span class="dot-sep"></span>
            ${group
              ? html`<span class="sub" style="color:var(--ink);font-weight:600">مجموعة: <span class="de">${group.title}</span> (${groupPos.position} من ${groupPos.total})</span>`
              : html`<span class="sub muted">${chunk.family ? `قالب: ${chunk.template}` : 'جملة مستقلة'}</span>`}
            <span class="dot-sep"></span>
            ${group?.variationDone
              ? html`<span class="chip chip-blue" style="font-size:11px">5 تنويعات جاهزة ✓</span>`
              : html`<button class="chip chip-yellow" data-act="go-step" data-step="5" style="font-size:11px;cursor:pointer" title="الانتقال للمرحلة الختامية">المرحلة الختامية ⚡</button>`}
            <span class="chip chip-yellow" style="font-size:11px">${phase.label}</span>
          </div>

          <!-- Live XP Badge in Topbar -->
          <div class="live-xp-pill" id="live-xp-pill" title="نقاط الإتقان الكلية والمكتسبة في هذه الجلسة">
            <span class="live-xp-icon">${icon('spark')}</span>
            <span class="live-xp-total"><b id="top-total-xp">${rankInfo.xp.toLocaleString()}</b> XP</span>
            <span class="live-xp-session" id="top-session-xp">+0 في الجلسة</span>
          </div>

          <div class="chunk-nav-seq" style="margin-inline-start:auto;display:flex;align-items:center;gap:6px">
            ${prevC ? html`<a class="btn btn-ghost btn-sm" href="#/practice/${prevC.id}?step=1" title="الجملة السابقة">${icon('back')} ${groupPos?.prevChunk ? `السابقة (${groupPos.position - 1}/${groupPos.total})` : prevC.id}</a>` : ''}
            ${nextC ? html`<a class="btn btn-ghost btn-sm" href="#/practice/${nextC.id}?step=1" title="الجملة التالية">${groupPos?.nextChunk ? `التالية (${groupPos.position + 1}/${groupPos.total})` : nextC.id} ${icon('forward')}</a>` : ''}
          </div>
          <span class="saveflag" id="saveflag">محفوظ تلقائيًا</span>
        </div>

        <div class="practice-grid">
          <section class="step-panel" id="step-panel"></section>

          <aside class="practice-aside">
            <!-- Live Session XP & Level Progress Card -->
            <div class="session-xp-card" id="session-xp-card">
              <div class="session-xp-row">
                <span class="session-xp-rank">${rankInfo.current.icon} ${rankInfo.current.title}</span>
                <span class="session-xp-counter" id="aside-session-xp">+0 XP</span>
              </div>
              <div class="session-xp-track">
                <div class="session-xp-fill" id="aside-xp-fill" style="width:${rankInfo.progressPct}%"></div>
              </div>
              <div class="session-xp-sub">
                <span>المستوى <b>${rankInfo.current.level}</b> من 50</span>
                <span id="aside-xp-hint">${rankInfo.next ? `فاضل ${rankInfo.remainingXP.toLocaleString()} XP` : 'الرتبة القصوى 👑'}</span>
              </div>
            </div>

            <div class="rail-panel">
              <div class="rail-panel-title">مسار الجملة</div>
              <ul class="rail-steps" id="rail">${railMarkup(step, isLastChunk)}</ul>
            </div>
            <div class="session-box">
              <div class="between"><span>وقت الجلسة</span><b id="session-clock">00:00</b></div>
              <div class="between"><span>إنتاجات الجملة</span><b id="session-produce">${total} من 30</b></div>
              <div class="between"><span>آخر حفظ</span><b id="last-save">—</b></div>
              <a class="link" href="#/level/${chunk.level}" style="margin-top:2px">شوف القايمة كلها ${icon('forward')}</a>
            </div>
          </aside>
        </div>
      </div>
    `;
  },

  mount(root, { params }) {
    const chunk = store.chunk(params.chunkId);
    if (!chunk) return null;

    const panel = root.querySelector('#step-panel');
    const rail = root.querySelector('#rail');
    const saveflag = root.querySelector('#saveflag');
    const sessionClock = root.querySelector('#session-clock');
    const sessionProduce = root.querySelector('#session-produce');
    const lastSave = root.querySelector('#last-save');
    const startedAt = Date.now();
    const drafts = {};
    const local = { revealed: false, showMap: false };
    const voice = { axis: '', state: 'idle', recorder: null, stream: null, timer: null, nonce: 0 };
    let disposed = false;
    let step = clamp(Number(new URLSearchParams(location.hash.split('?')[1] || '').get('step')) || store.currentStep(chunk.id), 1, 6);
    let stream = null;
    let recorder = null;
    let recUrl = null;
    let heartbeat = null;
    let clockTick = null;

    const groupPos = store.getGroupPosition(chunk.id);
    const prevChunk = () => {
      if (groupPos?.prevChunk) {
        return {
          id: groupPos.prevChunk.id,
          step: store.currentStep(groupPos.prevChunk.id),
          inGroup: true,
          position: groupPos.position - 1,
          total: groupPos.total,
        };
      }
      const level = store.level(chunk.level);
      const index = level.chunks.findIndex((c) => c.id === chunk.id);
      const preceding = level.chunks[index - 1];
      if (preceding) return { id: preceding.id, step: store.currentStep(preceding.id) };
      return null;
    };
    const nextChunk = () => {
      if (groupPos?.nextChunk) {
        return {
          id: groupPos.nextChunk.id,
          step: store.currentStep(groupPos.nextChunk.id),
          inGroup: true,
          position: groupPos.position + 1,
          total: groupPos.total,
        };
      }
      const level = store.level(chunk.level);
      const index = level.chunks.findIndex((c) => c.id === chunk.id);
      const following = level.chunks[index + 1];
      if (following) return { id: following.id, step: store.currentStep(following.id) };
      const nextLevel = store.levels[store.levels.findIndex((l) => l.id === chunk.level) + 1];
      if (nextLevel && nextLevel.chunks[0]) return { id: nextLevel.chunks[0].id, step: 1 };
      return null;
    };
    const prev = prevChunk();
    const next = nextChunk();

    // --- Live Gamification & Real-Time XP Engine ---
    let sessionXPEarned = 0;
    let initialRankInfo = trophyManager.getRankInfo();
    let previousLevel = initialRankInfo.current.level;

    const updateLiveCounters = () => {
      const rank = trophyManager.getRankInfo();
      const topTotal = root.querySelector('#top-total-xp');
      const topSession = root.querySelector('#top-session-xp');
      const asideSession = root.querySelector('#aside-session-xp');
      const asideFill = root.querySelector('#aside-xp-fill');
      const asideHint = root.querySelector('#aside-xp-hint');
      const asideRank = root.querySelector('.session-xp-rank');

      if (topTotal) topTotal.textContent = rank.xp.toLocaleString();
      if (topSession) topSession.textContent = `+${sessionXPEarned} في الجلسة`;
      if (asideSession) asideSession.textContent = `+${sessionXPEarned} XP`;
      if (asideFill) asideFill.style.width = `${rank.progressPct}%`;
      if (asideHint) {
        asideHint.textContent = rank.next ? `فاضل ${rank.remainingXP.toLocaleString()} XP` : 'الرتبة القصوى 👑';
      }
      if (asideRank) {
        asideRank.textContent = `${rank.current.icon} ${rank.current.title}`;
      }

      if (rank.current.level > previousLevel) {
        const leveledUpTo = rank.current;
        previousLevel = rank.current.level;
        showLevelUpNotification(leveledUpTo);
      }
    };

    const showXPToast = (amount, reason) => {
      sessionXPEarned += amount;
      audioEngine.playStepComplete(amount >= 20 ? 4 : 2);

      // Create floating notification
      const container = document.getElementById('toast-root') || root;
      const toastEl = document.createElement('div');
      toastEl.className = 'xp-floating-toast';
      toastEl.innerHTML = `
        <span class="xp-toast-spark">✨</span>
        <strong class="xp-toast-amount">+${amount} XP</strong>
        <span class="xp-toast-sep">·</span>
        <span class="xp-toast-reason">${reason}</span>
      `;
      container.appendChild(toastEl);
      setTimeout(() => {
        toastEl.classList.add('is-floating-out');
        setTimeout(() => toastEl.remove(), 400);
      }, 2400);

      updateLiveCounters();
    };

    const showLevelUpNotification = (newRank) => {
      audioEngine.playNewPR();
      toast(`🎉 مبروك! ارتقيت إلى المستوى ${newRank.level}: ${newRank.title}!`, 'spark');
    };

    const showCompletionSummaryModal = (targetChunk) => {
      audioEngine.playWorkoutComplete();
      const chunkXP = trophyManager.getChunkXPEarned(targetChunk.id);
      const rankInfo = trophyManager.getRankInfo();
      const nextC = next;

      const praises = [
        `عاش يا بطل! أداء استثنائي وتركيز عالي، جمعت ${chunkXP.total} XP وقربت خطوة كبيرة من المستوى اللي جاي!`,
        `ما شاء الله عليك! نطق وإنتاج في الجون، الجملة دي ثبتت في دماغك خلاص، كمّل بنفس الحماس!`,
        `شاطر جداً! جمعت ${chunkXP.total} XP كاملين في الجملة دي، مستواك في الألماني بيعلى خطوة بخطوة!`,
        `الله ينور عليك! أتقنت القالب بكل تفاصيله واجتزت التحدي بنجاح، يلا على الجملة اللي بعدها!`,
      ];
      const praiseMsg = praises[Math.floor(Math.random() * praises.length)];

      const modalContent = html`
        <div class="completion-summary-modal" style="text-align:center;padding:16px 8px">
          <div class="summary-trophy-badge">
            <span class="summary-trophy-icon">${icon('trophy')}</span>
          </div>

          <span class="eyebrow" style="color:var(--yellow);margin-top:10px;display:inline-block">تم إتقان الجملة بنجاح ✓</span>
          <h2 style="font-size:24px;margin:6px 0 2px">${targetChunk.de}</h2>
          <p class="sub muted" style="margin-bottom:14px">${targetChunk.ar}</p>

          <div class="summary-total-xp-banner">
            <span class="summary-xp-kicker">مجموع نقاط الـ XP المكتسبة في الجملة</span>
            <div class="summary-xp-number"><b>+${chunkXP.total}</b> <span>XP</span></div>
          </div>

          <div class="summary-breakdown-grid">
            ${chunkXP.breakdown.map(
              (item) => html`
                <div class="summary-item-chip">
                  <span class="item-icon">${icon(item.icon || 'check')}</span>
                  <span class="item-lbl">${item.label}</span>
                  <strong class="item-xp">+${item.xp} XP</strong>
                </div>
              `,
            )}
          </div>

          <div class="summary-level-progress">
            <div class="between" style="font-size:13px;margin-bottom:6px">
              <span><b>${rankInfo.current.icon} ${rankInfo.current.title}</b> (المستوى ${rankInfo.current.level} من 50)</span>
              <span><b>${rankInfo.xp.toLocaleString()}</b> XP إجمالي</span>
            </div>
            <div class="bento-bar"><span style="width:${rankInfo.progressPct}%"></span></div>
            <div class="between" style="font-size:11px;color:var(--muted);margin-top:4px">
              <span>نسبة إكمال المستوى ${rankInfo.progressPct}%</span>
              <span>${rankInfo.next ? `فاضل ${rankInfo.remainingXP.toLocaleString()} XP للوصول لـ ${rankInfo.next.title}` : 'أعلى رتبة إتقان 🎉'}</span>
            </div>
          </div>

          <div class="summary-egy-praise">
            <p>${praiseMsg}</p>
          </div>

          <div class="modal-actions" style="justify-content:center;gap:10px;margin-top:20px;flex-wrap:wrap">
            ${nextC?.inGroup
              ? html`<button class="btn btn-primary" data-act-next-chunk>الجملة التالية بالمجموعة (${nextC.position}/${nextC.total}) ${icon('forward')}</button>`
              : html`<button class="btn btn-primary" data-act-go-finale>المرحلة الختامية للمجموعة (5 تنويعات) ${icon('spark')}</button>`}
            <a class="btn btn-ghost" href="#/level/${targetChunk.level}">العودة للمستويات</a>
            <a class="btn btn-quiet" href="#/trophies">${icon('trophy')} خزانة الإنجازات</a>
          </div>
        </div>
      `;

      const modal = openModal(modalContent, {
        className: 'summary-dialog-window',
      });

      modal.root.querySelector('[data-act-next-chunk]')?.addEventListener('click', () => {
        audioEngine.playTap();
        modal.close();
        if (nextC) {
          location.hash = `#/practice/${nextC.id}?step=1`;
        }
      });

      modal.root.querySelector('[data-act-go-finale]')?.addEventListener('click', () => {
        audioEngine.playTap();
        modal.close();
        goToStep(5);
      });
    };

    const checkImmediateTestsCompletion = () => {
      const r = store.record(chunk.id);
      const immediateTestsPassed = Boolean(
        r.test?.recall?.passed &&
        r.test?.sprint?.count >= 5 &&
        r.test?.speaking?.seconds >= 30
      );
      if (immediateTestsPassed && !r.mastery?.done) {
        store.completeMastery(chunk.id);
        showXPToast(20, 'تاج الإتقان المعتمد — الجملة متقنة');
        setTimeout(() => {
          showCompletionSummaryModal(chunk);
        }, 500);
      }
    };

    const showGroupMasterySummaryModal = (targetChunk, targetGroup) => {
      audioEngine.playWorkoutComplete();
      const rankInfo = trophyManager.getRankInfo();
      const groupTitle = targetGroup?.title || targetChunk.template || 'مجموعة القالب';
      const totalChunks = groupPos?.total || 10;

      const modalContent = html`
        <div class="completion-summary-modal" style="text-align:center;padding:16px 8px">
          <div class="summary-trophy-badge" style="background:linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.3));border:2px solid var(--yellow)">
            <span class="summary-trophy-icon">${icon('trophy')}</span>
          </div>

          <span class="eyebrow" style="color:var(--yellow);margin-top:10px;display:inline-block">إنجاز استثنائي 🏆</span>
          <h2 style="font-size:24px;margin:6px 0 2px">أتقنت مجموعة «${groupTitle}» بالكامل!</h2>
          <p class="sub muted" style="margin-bottom:14px">أتممت تدريب كل جمل المجموعة (${totalChunks} من ${totalChunks}) وأنجزت الـ 5 تنويعات الشاملة بنجاح.</p>

          <div class="summary-total-xp-banner" style="background:var(--card-2);border:1px solid var(--border)">
            <span class="summary-xp-kicker">مجموع نقاط الـ XP المكتسبة للمجموعة</span>
            <div class="summary-xp-number"><b style="color:var(--yellow)">+150</b> <span>XP</span></div>
          </div>

          <div class="summary-breakdown-grid">
            <div class="summary-item-chip">
              <span class="item-icon">${icon('spark')}</span>
              <span class="item-lbl">تنويع قالب المجموعة (5 تنويعات عبر المحاور)</span>
              <strong class="item-xp">+50 XP</strong>
            </div>
            <div class="summary-item-chip">
              <span class="item-icon">${icon('trophy')}</span>
              <span class="item-lbl">بونص إتقان جميع جمل المجموعة بالكامل</span>
              <strong class="item-xp">+100 XP</strong>
            </div>
          </div>

          <div class="summary-level-progress">
            <div class="between" style="font-size:13px;margin-bottom:6px">
              <span><b>${rankInfo.current.icon} ${rankInfo.current.title}</b> (المستوى ${rankInfo.current.level} من 50)</span>
              <span><b>${rankInfo.xp.toLocaleString()}</b> XP إجمالي</span>
            </div>
            <div class="bento-bar"><span style="width:${rankInfo.progressPct}%"></span></div>
          </div>

          <div class="summary-egy-praise">
            <p>عاش يا بطل! أتقنت القالب بكل تفاصيله وتفرعاته وجمله، وبقى جزء راسخ وسريع في لسانك الألماني. يلا على المجموعة اللي بعدها!</p>
          </div>

          <div class="modal-actions" style="justify-content:center;gap:10px;margin-top:20px;flex-wrap:wrap">
            <a class="btn btn-primary" href="#/level/${targetChunk.level}">العودة لقائمة المجموعات ${icon('forward')}</a>
            <a class="btn btn-ghost" href="#/trophies">${icon('trophy')} خزانة الإنجازات</a>
          </div>
        </div>
      `;

      openModal(modalContent, {
        className: 'summary-dialog-window',
      });
    };

    const setSaveFlag = (state = 'saved') => {
      saveflag.classList.toggle('is-saving', state === 'saving');
      saveflag.textContent = state === 'saving' ? 'بيتحفظ...' : 'محفوظ تلقائيًا';
    };

    const cancelVoice = () => {
      const wasProcessing = voice.state === 'processing';
      voice.nonce += 1;
      clearTimeout(voice.timer);
      if (voice.recorder?.state === 'recording') {
        voice.recorder.onstop = null;
        voice.recorder.stop();
      }
      voice.stream?.getTracks().forEach((track) => track.stop());
      voice.recorder = null;
      voice.stream = null;
      voice.axis = '';
      voice.state = 'idle';
      if (wasProcessing) window.chunkAPI.cancelTranscription().catch(() => {});
    };

    const paint = () => {
      const isLast = !next?.inGroup;
      const rec = store.record(chunk.id);
      if (step === 1) panel.innerHTML = String(stepUnderstand(chunk, local, isLast));
      else if (step === 2) panel.innerHTML = String(stepSpeak(chunk, local, isLast));
      else if (step === 3) panel.innerHTML = String(stepProduce(chunk, local, isLast));
      else if (step === 4) panel.innerHTML = String(stepTest(chunk, isLast, next));
      else panel.innerHTML = String(stepGroupFinale(chunk, { drafts, voice }));

      panel.innerHTML += String(footerMarkup(step));
      rail.innerHTML = String(railMarkup(step, isLast));
      history.replaceState(null, '', `#/practice/${chunk.id}?step=${step}`);
      store.setPointer(chunk.id, step);
      bindStepInputs();
      if (sessionProduce) sessionProduce.textContent = `${rec.produce.total || 0} من 30`;
      if (lastSave) lastSave.textContent = timeLabel(new Date());
      if (step === 2 && recUrl) renderAudio();
    };

    const footerMarkup = (current) => {
      const isLast = !next?.inGroup;
      const totalSteps = isLast ? 5 : 4;
      const dots = Array.from({ length: totalSteps }, (_, i) => i);
      const gid = groupPos?.group?.id;
      const groupDone = gid ? store.isGroupVariationDone(gid) : false;

      return html`
        <div class="step-foot">
          <button class="btn btn-ghost btn-sm" data-act="prev" ${current === 1 ? 'disabled' : ''}>${icon('back')} اللي فات</button>
          <div class="step-dots">${dots.map((i) => html`<i class="${i < current ? 'on' : ''}"></i>`)}</div>
          ${current < totalSteps
            ? html`<button class="btn btn-primary btn-sm" data-act="next">الخطوة اللي بعدها ${icon('forward')}</button>`
            : current === 4 && next?.inGroup
              ? html`<a class="btn btn-primary btn-sm" href="#/practice/${next.id}?step=1">الجملة التالية بالمجموعة (${next.position}/${next.total}) ${icon('forward')}</a>`
              : current === 4 && isLast
                ? html`<button class="btn btn-primary btn-sm" data-act="go-step" data-step="5">المرحلة الختامية (5 تنويعات) ${icon('spark')}</button>`
                : groupDone
                  ? html`<a class="btn btn-primary btn-sm" href="#/level/${chunk.level}">العودة للمستويات ${icon('forward')}</a>`
                  : html`<button class="btn btn-ghost btn-sm" disabled>سجّل 5 تنويعات لاعتماد المجموعة</button>`}
          ${next?.inGroup ? html`<a class="btn btn-quiet btn-sm" href="#/practice/${next.id}?step=1" style="margin-inline-start:auto" title="انتقل للجملة التالية مباشرة">التالية بالمجموعة (${next.position}/${next.total}) ${icon('forward')}</a>` : ''}
        </div>
      `;
    };

    const goToStep = (target) => {
      if (step === 5 && target !== 5) cancelVoice();
      const isLast = !next?.inGroup;
      const maxSteps = isLast ? 5 : 4;
      const nextStep = clamp(target, 1, maxSteps);
      if (nextStep > step) {
        audioEngine.playStepComplete(nextStep);
      } else if (nextStep < step) {
        audioEngine.playStepper('down');
      }
      step = nextStep;
      local.revealed = false;
      local.showMap = false;
      paint();
      const top = panel.getBoundingClientRect().top + window.scrollY - 96;
      if (top > 0 && window.scrollY > top - 40) {
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    };

    const renderAudio = () => {
      const area = panel.querySelector('#rec-area');
      if (!area || !recUrl) return;
      area.innerHTML = String(html`
        <span class="record-dot"></span>
        <div style="flex:1;min-width:160px">
          <div class="pass-title">تسجيلك — قارن النطق</div>
          <div class="pass-hint">بيتمسح أول ما تقفل الجلسة.</div>
        </div>
        <audio controls src="${recUrl}"></audio>
        <button class="btn btn-ghost btn-sm" data-act="record">${icon('mic')} سجّل تاني</button>
      `);
    };

    const bindStepInputs = () => {
      const notes = panel.querySelector('#notes');
      if (notes) {
        notes.addEventListener(
          'input',
          debounce((event) => {
            store.note(chunk.id, event.target.value);
          }, 400),
        );
      }
      panel.querySelectorAll('[data-draft]').forEach((area) => {
        area.value = drafts[area.dataset.draft] || '';
        area.addEventListener('input', () => {
          drafts[area.dataset.draft] = area.value;
          area.removeAttribute('aria-invalid');
        });
      });
    };

    async function startRecording(button) {
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => {
          stream?.getTracks().forEach((track) => track.stop());
          stream = null;
          if (!chunks.length) return;
          if (recUrl) URL.revokeObjectURL(recUrl);
          recUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' }));
          renderAudio();
          showXPToast(5, 'سجلت نطقك وقارنته بالصوت الأصلي');
          toast('اتسجل — اسمعه وقارنه', 'mic');
        };
        recorder.start();
        button.classList.add('is-rec');
        button.innerHTML = String(html`${icon('close')} وقّف التسجيل`);
        toast('بيتسجل... اتكلم عادي', 'mic');
      } catch (error) {
        toast('مش قادر أوصل للمايك — اسمح بالوصول من إعدادات ويندوز', 'lock');
      }
    }

    async function toggleVoice(axis) {
      if (!VARIATION_AXES.some((item) => item.key === axis)) return;
      if (voice.state === 'processing' && voice.axis === axis) {
        cancelVoice();
        paint();
        return;
      }
      if (voice.state === 'recording' && voice.axis === axis) {
        if (voice.recorder?.state === 'recording') voice.recorder.stop();
        return;
      }
      if (voice.state !== 'idle') return;
      if (!window.chunkAPI?.transcribeGermanAudio || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        toast('التسجيل الصوتي مش متاح على الجهاز ده', 'mic');
        return;
      }

      const nonce = ++voice.nonce;
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed || step !== 5 || nonce !== voice.nonce) {
          micStream.getTracks().forEach((track) => track.stop());
          return;
        }
        const mime = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : undefined;
        const micRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
        const pieces = [];
        voice.axis = axis;
        voice.state = 'recording';
        voice.recorder = micRecorder;
        voice.stream = micStream;
        micRecorder.ondataavailable = (event) => {
          if (event.data?.size) pieces.push(event.data);
        };
        micRecorder.onerror = () => {
          if (nonce !== voice.nonce) return;
          cancelVoice();
          paint();
          toast('حصلت مشكلة أثناء التسجيل — جرّب تاني', 'mic');
        };
        micRecorder.onstop = async () => {
          clearTimeout(voice.timer);
          micStream.getTracks().forEach((track) => track.stop());
          if (nonce !== voice.nonce || disposed || step !== 5) return;
          voice.recorder = null;
          voice.stream = null;
          if (!pieces.length) {
            voice.state = 'idle';
            voice.axis = '';
            paint();
            toast('التسجيل فاضي — جرّب تاني', 'mic');
            return;
          }
          voice.state = 'processing';
          paint();
          try {
            const bytes = new Uint8Array(await new Blob(pieces, { type: mime || micRecorder.mimeType }).arrayBuffer());
            const result = await window.chunkAPI.transcribeGermanAudio(bytes);
            if (nonce !== voice.nonce || disposed || step !== 5) return;
            voice.state = 'idle';
            voice.axis = '';
            if (result?.ok && result.text?.trim()) {
              drafts[axis] = [drafts[axis]?.trim(), result.text.trim()].filter(Boolean).join(' ');
              paint();
              panel.querySelector(`[data-draft="${axis}"]`)?.focus();
              toast('النص الألماني جاهز — راجعه وبعدين سجّله', 'check');
            } else {
              paint();
              const messages = {
                'model-missing': 'نموذج Whisper مش جاهز على الجهاز',
                'tool-missing': 'ملفات Whisper مش جاهزة',
                'bad-audio': 'التسجيل قصير أو غير صالح — جرّب تاني',
                empty: 'ما اتسمعش كلام واضح — جرّب تاني',
                timeout: 'التفريغ طول أكتر من المتوقع — جرّب تسجيل أقصر',
                busy: 'Whisper مشغول بتسجيل تاني',
              };
              if (result?.error !== 'cancelled') toast(messages[result?.error] || 'تعذّر تحويل الصوت — جرّب تاني', 'mic');
            }
          } catch {
            if (nonce !== voice.nonce || disposed) return;
            voice.state = 'idle';
            voice.axis = '';
            paint();
            toast('تعذّر تحويل الصوت — جرّب تاني', 'mic');
          }
        };
        micRecorder.start();
        voice.timer = setTimeout(() => {
          if (micRecorder.state === 'recording') micRecorder.stop();
        }, 30000);
        paint();
      } catch {
        micStream?.getTracks().forEach((track) => track.stop());
        if (nonce !== voice.nonce || disposed) return;
        cancelVoice();
        paint();
        toast('مش قادر أوصل للمايك — اسمح بالوصول من إعدادات ويندوز', 'lock');
      }
    }

    const speak = async (rate) => {
      if (!store.state.settings.tts) {
        toast('الصوت متوقف من الإعدادات', 'speaker');
        return;
      }
      const button = panel.querySelector(`[data-act="say"][data-rate="${rate}"]`);
      button?.classList.add('is-playing');
      await speech.speak(chunk.de, { rate, voiceName: store.state.settings.voice });
      button?.classList.remove('is-playing');
    };

    const handleAction = async (action, target) => {
      const rec = store.record(chunk.id);
      switch (action) {
        case 'understand:reveal':
          local.revealed = true;
          paint();
          break;
        case 'understand:map':
          local.showMap = true;
          paint();
          break;
        case 'understand:check': {
          const key = target.dataset.check;
          store.toggleUnderstandCheck(chunk.id, key);
          paint();
          break;
        }
        case 'understand:func':
          store.setUnderstandFunc(chunk.id, target.dataset.func);
          paint();
          break;
        case 'understand:done': {
          const wasDone = rec.understand?.done;
          store.finishUnderstand(chunk.id);
          if (!wasDone) {
            showXPToast(10, 'فهمت الـChunk وحددت وظيفته');
          }
          goToStep(2);
          break;
        }
        case 'speak:pass': {
          const passKey = target.dataset.pass;
          const passesBefore = { ...rec.speak?.passes };
          store.setSpeakPass(chunk.id, passKey, !passesBefore[passKey]);
          paint();
          const recAfter = store.record(chunk.id);
          const allPassesAfter = recAfter.speak?.passes?.slow && recAfter.speak?.passes?.natural && recAfter.speak?.passes?.blind;
          const allPassesBefore = passesBefore.slow && passesBefore.natural && passesBefore.blind;
          if (recAfter.speak?.passes?.[passKey] && !passesBefore[passKey]) {
            if (allPassesAfter && !allPassesBefore) {
              showXPToast(15, 'أتممت خطوات النطق الثلاث بنجاح');
            } else {
              showXPToast(5, `نطقت الخطوة (${passKey === 'slow' ? 'ببطء' : passKey === 'natural' ? 'طبيعي' : 'من غير ما تبص'})`);
            }
          }
          break;
        }
        case 'say':
          speak(Number(target.dataset.rate) || 0.95);
          break;
        case 'blind':
          openBlindTest();
          break;
        case 'record':
          startRecording(target);
          break;
        case 'vary:voice':
          toggleVoice(target.dataset.axis);
          break;
        case 'batch:log': {
          const index = Number(target.dataset.index);
          const batch = store.batchState(chunk.id)[index];
          audioEngine.playStepper('up');
          store.addProduction(chunk.id, batch.amount);
          showXPToast(20, `سجلت ${batch.amount} إنتاج — ${batch.label}`);
          toast(`سجلت ${batch.amount} إنتاج — ${batch.label}`, 'check');
          paint();
          break;
        }
        case 'batch:extra': {
          audioEngine.playStepper('up');
          store.addProduction(chunk.id, 5);
          showXPToast(10, 'سجلت 5 إنتاجات إضافية بنجاح ✓');
          toast('سجلت 5 إنتاجات إضافية بنجاح ✓', 'check');
          paint();
          break;
        }
        case 'vary:save': {
          const axis = target.dataset.axis;
          const field = target.closest('.axis-card')?.querySelector('[data-draft]');
          const text = field?.value || drafts[axis] || '';
          if (!text.trim()) {
            audioEngine.playSoftError();
            field?.setAttribute('aria-invalid', 'true');
            field?.focus();
            toast('اكتب جملة الأول', 'spark');
            return;
          }
          audioEngine.playSetComplete(3);
          const covBefore = store.variationCoverage(chunk.id);
          const gid = groupPos?.group?.id;
          const grpDoneBefore = gid ? store.isGroupVariationDone(gid) : false;

          store.addVariation(chunk.id, axis, text);
          if (gid) {
            store.addGroupVariation(gid, axis, text);
          }
          drafts[axis] = '';
          const covAfter = store.variationCoverage(chunk.id);
          const grpDoneAfter = gid ? store.isGroupVariationDone(gid) : false;

          if (grpDoneAfter && !grpDoneBefore) {
            audioEngine.playNewPR();
            showXPToast(50, '🎉 أتممت شرط الـ 5 تنويعات للمجموعة بالكامل (+50 XP)!');
            toast('أتممت الـ 5 تنويعات للقالب — تم اعتماد إتقان المجموعة بنجاح!', 'spark');
            showGroupMasterySummaryModal(chunk, groupPos?.group);
          } else if (covAfter >= 4 && covBefore < 4) {
            showXPToast(15, 'سجلت تنويع جديد + بونص إكمال المحاور الأربعة (+10 XP)!');
          } else {
            showXPToast(5, `سجلت تنويع في محور ${store.axisTitle(axis)}`);
          }
          paint();
          break;
        }
        case 'vary:del': {
          audioEngine.playSoftError();
          const idx = Number(target.dataset.index);
          const gid = groupPos?.group?.id;
          if (gid) {
            store.removeGroupVariation(gid, idx);
          }
          store.removeVariation(chunk.id, idx);
          paint();
          break;
        }
        case 'recall:start':
          openRecallDrill(chunk, {
            onDone: ({ passed, score, total }) => {
              const wasPassed = rec.test?.recall?.passed;
              store.setRecall(chunk.id, score, total);
              if (passed && !wasPassed) {
                showXPToast(25, `اجتزت الاستدعاء السريع بنجاح (${score} من ${total})`);
              } else {
                toast(passed ? 'استدعاء ممتاز' : `جبت ${score} من ${total} — جرّب تاني`, passed ? 'check' : 'clock');
              }
              checkImmediateTestsCompletion();
              paint();
            },
          });
          break;
        case 'sprint:start':
          openSprintDrill(chunk, {
            onDone: ({ count }) => {
              const countBefore = rec.test?.sprint?.count || 0;
              store.setSprint(chunk.id, count);
              if (count >= 5 && countBefore < 5) {
                showXPToast(15, `بونص سرعة سبرنت الدقيقة (${count} جمل/دقيقة)!`);
              } else {
                toast(`سجلت ${count} جمل في الدقيقة`, count >= 5 ? 'check' : 'clock');
              }
              checkImmediateTestsCompletion();
              paint();
            },
          });
          break;
        case 'speaking:start':
          openSpeakingDrill(chunk, {
            onDone: ({ seconds, note }) => {
              const secondsBefore = rec.test?.speaking?.seconds || 0;
              store.setSpeaking(chunk.id, seconds, note);
              if (seconds >= 30 && secondsBefore < 30) {
                showXPToast(10, `بونص الكلام المرتجل (${Math.round(seconds)} ثانية)!`);
              } else {
                toast('اتسجل الكلام المرتجل', 'check');
              }
              checkImmediateTestsCompletion();
              paint();
            },
          });
          break;
        case 'delayed:start':
          if (!store.delayedReady(chunk.id)) {
            audioEngine.playSoftError();
            toast('الاستدعاء المؤجل هيفتح بعد أسبوع من تدريب الجملة', 'clock');
            return;
          }
          openRecallDrill(chunk, {
            onDone: ({ passed, score, total }) => {
              if (passed) {
                store.setDelayed(chunk.id, true, score);
                showXPToast(25, 'اجتزت الاستدعاء المؤجل لتثبيت الذاكرة');
                toast('الاستدعاء المؤجل عدّى — الشروط كاملة', 'trophy');
              } else {
                toast(`جبت ${score} من ${total} — راجع الجملة وحاول بعد يوم`, 'clock');
              }
              paint();
            },
          });
          break;
        case 'summary:view': {
          if (!store.peek(chunk.id)?.mastery?.done) {
            store.completeMastery(chunk.id);
            showXPToast(20, 'تاج الإتقان المعتمد — الجملة متقنة');
          }
          paint();
          showCompletionSummaryModal(chunk);
          break;
        }
        case 'mastery:complete': {
          if (store.completeMastery(chunk.id)) {
            showXPToast(20, 'تاج الإتقان المعتمد — الجملة متقنة');
            paint();
            setTimeout(() => {
              showCompletionSummaryModal(chunk);
            }, 300);
          }
          break;
        }
        case 'go-step':
          goToStep(Number(target.dataset.step));
          break;
        case 'prev':
          goToStep(step - 1);
          break;
        case 'next': {
          const isLast = !next?.inGroup;
          const maxSteps = isLast ? 5 : 4;
          if (step < maxSteps) {
            goToStep(step + 1);
          } else if (step === 4 && next?.inGroup) {
            location.hash = `#/practice/${next.id}?step=1`;
          } else if (step === 4 && isLast) {
            goToStep(5);
          }
          break;
        }
        case 'finish':
          break;
        default:
          break;
      }
    };

    function openBlindTest() {
      let closed = false;
      const modal = openModal(
        html`
          <div class="drill">
            <div class="prompt-label" style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
              <span>من غير ما تبص</span><span>العين بعيدة عن الجملة</span>
            </div>
            <p class="drill-prompt">هتقفل الجملة 3 ثواني، بعدها قولها من دماغك</p>
            <div class="blind-count" id="blind-num">3</div>
            <div class="drill-actions">
              <button class="btn btn-ghost" id="blind-cancel">إلغاء</button>
            </div>
          </div>
        `,
        { className: 'drill-modal', onClose: () => clearInterval(timer) },
      );
      const num = modal.root.querySelector('#blind-num');
      let count = 3;
      const timer = setInterval(() => {
        count -= 1;
        if (count > 0) {
          num.textContent = String(count);
          return;
        }
        clearInterval(timer);
        num.style.display = 'none';
        const body = modal.root.querySelector('.drill');
        body.insertAdjacentHTML(
          'beforeend',
          `<div class="drill-ar" style="margin-top:6px">${esc(chunk.de)}</div>
           <div class="drill-actions">
             <button class="btn btn-primary" data-blind-yes>${icon('check')} قلتها صح</button>
             <button class="btn btn-ghost" data-blind-no>لأ، احتاجت أبص</button>
           </div>
           <p class="sub muted" style="margin-top:10px">الجملة ظاهرة دلوقتي — التقييم على اللي قلته قبل ما تظهر.</p>`,
        );
        body.querySelector('[data-blind-yes]').addEventListener('click', () => {
          if (closed) return;
          closed = true;
          store.setSpeakPass(chunk.id, 'blind', true);
          showXPToast(10, 'نطقت الجملة صح من غير ما تبص!');
          modal.close();
          paint();
          toast('تمام — الجملة خرجت من غير ما تبص', 'check');
        });
        body.querySelector('[data-blind-no]').addEventListener('click', () => {
          modal.close();
          toast('عادي — اسمعها تاني وجرب بعد شوية', 'clock');
        });
      }, 1000);
      modal.root.querySelector('#blind-cancel').addEventListener('click', () => modal.close());
    }

    const onClick = (event) => {
      const target = event.target.closest('[data-act]');
      if (!target || target.disabled) return;
      Promise.resolve(handleAction(target.dataset.act, target)).catch((error) => {
        console.error(error);
        toast('حصلت مشكلة صغيرة — جرّب تاني', 'lock');
      });
    };

    root.addEventListener('click', onClick);

    store.onSaved = (at) => {
      if (!at) {
        saveflag.classList.remove('is-saving');
        saveflag.textContent = 'مش قادر أحفظ — راجع المساحة';
        saveflag.style.color = 'var(--red)';
        return;
      }
      saveflag.style.color = '';
      setSaveFlag('saved');
      if (lastSave) lastSave.textContent = timeLabel(new Date(at));
    };
    store.setPointer(chunk.id, step);

    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('.modal-backdrop')) {
        location.hash = `#/level/${chunk.level}`;
      }
      if (event.altKey && event.key === 'ArrowLeft') goToStep(step - 1);
      if (event.altKey && event.key === 'ArrowRight') goToStep(step + 1);
    };
    document.addEventListener('keydown', onKey);

    paint();
    setSaveFlag('saved');

    clockTick = setInterval(() => {
      if (sessionClock) sessionClock.textContent = formatClock((Date.now() - startedAt) / 1000);
    }, 1000);

    heartbeat = setInterval(() => {
      if (!document.hidden && document.hasFocus()) store.heartbeat(20);
    }, 20000);

    const onVisibility = () => {
      if (document.hidden) speech.stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onVoices = () => {
      if (step === 2) paint();
    };
    window.speechSynthesis?.addEventListener?.('voiceschanged', onVoices);

    return () => {
      disposed = true;
      cancelVoice();
      clearInterval(clockTick);
      clearInterval(heartbeat);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', onVoices);
      speech.stop();
      if (recorder && recorder.state === 'recording') recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (recUrl) URL.revokeObjectURL(recUrl);
      store.onSaved = null;
      store.heartbeat((Date.now() - startedAt) / 1000 > 60 ? 30 : 0);
      store.flush();
    };
  },
};
