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

function stepHead(index, title, sub) {
  return html`
    <div class="step-head">
      <div class="step-kicker"><b>${index}</b> من 6 خطوات</div>
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

function stepUnderstand(chunk, local) {
  const rec = store.record(chunk.id);
  const checks = rec.understand.checks || {};
  const parts = germanParts(chunk);
  const prefixWords = parts.prefix ? parts.prefix.split(/\s+/).length : 0;
  const tokens = chunk.de.split(/\s+/);

  return html`
    ${stepHead(1, 'افهم الـChunk', 'اقرأ الجملة، افهم معناها بالعربي، وحدد وظيفتها قبل أي تدريب.')}
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

function stepSpeak(chunk, local) {
  const rec = store.record(chunk.id);
  const passes = rec.speak.passes;
  const ttsOn = store.state.settings.tts;
  const hasVoice = speech.germanVoices().length > 0;
  const voicesLoaded = speech.allVoices().length > 0;

  return html`
    ${stepHead(2, 'انطقه بصوت عالي', 'تلات مرات بس: بطيء، طبيعي، وبعدين من غير ما تبص على الجملة.')}
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

function stepProduce(chunk, local) {
  const rec = store.record(chunk.id);
  const total = rec.produce.total || 0;
  const batches = store.batchState(chunk.id);
  const now = new Date();

  return html`
    ${stepHead(3, 'درّب عليه 30 إنتاج', 'مش 30 مرة نفس الجملة — 30 جملة مختلفة بنفس القالب، موزّعة على أسبوع.')}
    ${chunkReference(chunk)}
    <div class="produce-top">
      <div class="ring-wrap">${ring(total, 30)}</div>
      <div class="produce-copy">
        <strong>${total >= 30 ? 'خلّصت الـ30 إنتاج' : `فاضل ${30 - total} إنتاج`}</strong>
        <span>الخطة: 10 في الجلسة الأولى، وبعدين 5 × 4 مرات على مدار أسبوع. البرنامج بيفكرك بيهم في صفحة المراجعة.</span>
      </div>
    </div>

    <div class="callout">
      ${icon('spark')}
      <span><b>مهم:</b> 10 جمل مختلفة في الجلسة الأولى — لو كررت نفس الجملة 30 مرة هتحفظ الصوت مش اللغة.</span>
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

/* ---------------- STEP 4 ---------------- */

function stepVary(chunk, local) {
  const rec = store.record(chunk.id);
  const coverage = store.variationCoverage(chunk.id);
  const siblings = store.siblings(chunk.id, 3);

  return html`
    ${stepHead(4, 'غيّر كل مرة', 'نفس القالب، أربع تغييرات: الفاعل، الزمن، الكلمات، والموقف.')}
    ${chunkReference(chunk)}
    <div class="produce-top" style="gap:14px">
      <div class="counter-badge ${coverage >= 4 ? 'is-full' : ''}" style="font-size:14px;height:30px;padding:0 12px">
        ${coverage} من 4 محاور
      </div>
      <div class="produce-copy">
        <strong>${coverage >= 4 ? 'غطيت المحاور الأربعة' : `فاضل ${4 - coverage} محاور`}</strong>
        <span>اكتب الجملة اللي أنتجتها في كل خانة. اكتب بالألماني، وممكن تضيف معناها بالعربي.</span>
      </div>
    </div>

    <div class="axis-grid">
      ${VARIATION_AXES.map((axis) => {
        const items = rec.vary.items.filter((item) => item.axis === axis.key);
        return html`
          <div class="axis-card">
            <div class="axis-head">
              <span class="axis-title">${axis.title}</span>
              <span class="counter-badge ${items.length ? 'is-full' : ''}">${items.length}</span>
            </div>
            <span class="axis-hint">${axis.hint}</span>
            <textarea data-draft="${axis.key}" placeholder="اكتب جملة واحدة على الأقل...">${local.drafts[axis.key] || ''}</textarea>
            <button class="btn btn-ghost btn-sm" data-act="vary:save" data-axis="${axis.key}" style="align-self:flex-start;margin-top:6px">
              ${icon('check')} سجّل التنويع
            </button>
          </div>
        `;
      })}
    </div>

    ${rec.vary.importedDone && !rec.vary.items.length
      ? html`<div class="callout">${icon('spark')}<span>الخطوة دي متسجلة من ملف A1 القديم — تقدر تضيف تنويعات جديدة لو حبيت.</span></div>`
      : ''}

    ${rec.vary.items.length
      ? html`
          <div>
            <div class="eyebrow" style="margin-bottom:8px">تنويعاتك المحفوظة (${rec.vary.items.length})</div>
            <div class="vary-list">
              ${rec.vary.items.map(
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

/* ---------------- STEP 5 ---------------- */

function stepTest(chunk) {
  const rec = store.record(chunk.id);
  const recall = rec.test.recall;
  const sprint = rec.test.sprint;
  const speaking = rec.test.speaking;
  const delayed = rec.test.delayed;
  const variationCount = rec.vary.items.length;
  const delayedDue = store.delayedDue(chunk.id);
  const delayedReady = Boolean(delayedDue && delayedDue <= new Date());
  const passedCount = [recall.passed, variationCount >= 5, sprint.count >= 5, speaking.seconds >= 30, delayed.passed].filter(Boolean).length;

  return html`
    ${stepHead(5, 'اختبر نفسك', 'خمس اختبارات. النجاح مش معناه إنك شفت الجملة — معناه إنك طلّعتها لوحدك.')}
    <div class="produce-top" style="gap:18px">
      <div class="counter-badge ${passedCount === 5 ? 'is-full' : ''}" style="font-size:14px;height:30px;padding:0 12px">${passedCount} من 5</div>
      <div class="produce-copy">
        <strong>${passedCount === 5 ? 'كل الاختبارات عدّت' : 'كمّل الاختبارات الناقصة'}</strong>
        <span>الاستدعاء والسرعة والكلام شرط للإتقان، والاستدعاء المؤجل بييجي بعد أسبوع.</span>
      </div>
    </div>

    <div class="test-grid">
      <div class="test-card ${recall.passed ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${recall.passed ? 'green' : ''}">${icon('clock')}</span>
          <h4>استدعاء سريع</h4>
        </div>
        <p class="test-req">اقرا العربي وقول الألماني في ثانيتين تقريبًا. محتاج 4 من 5.</p>
        <div class="test-foot">
          <span class="test-state ${recall.passed ? 'done' : ''}">
            ${recall.at ? `${recall.score} من ${recall.total} · ${relativeWhen(recall.at)}` : 'لسه ما اتجربش'}
          </span>
          <button class="btn ${recall.passed ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="recall:start">${recall.passed ? 'أعد' : 'ابدأ'}</button>
        </div>
      </div>

      <div class="test-card ${variationCount >= 5 ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${variationCount >= 5 ? 'green' : ''}">${icon('spark')}</span>
          <h4>تنويع</h4>
        </div>
        <p class="test-req">5 جمل مختلفة بنفس القالب — بتتحسب من خطوة «غيّر».</p>
        <div class="test-foot">
          <span class="test-state ${variationCount >= 5 ? 'done' : ''}">${variationCount} من 5 جمل</span>
          ${variationCount >= 5
            ? html`<span class="test-state done">تم</span>`
            : html`<button class="btn btn-ghost btn-sm" data-act="go-step" data-step="4">روح لخطوة 4</button>`}
        </div>
      </div>

      <div class="test-card ${sprint.count >= 5 ? 'is-done' : ''}">
        <div class="test-head">
          <span class="test-ico ${sprint.count >= 5 ? 'green' : ''}">${icon('target')}</span>
          <h4>سباق الـ60 ثانية</h4>
        </div>
        <p class="test-req">5 جمل في دقيقة واحدة. السرعة بتبيّن إن القالب بقى في دماغك.</p>
        <div class="test-foot">
          <span class="test-state ${sprint.count >= 5 ? 'done' : ''}">${sprint.at ? `${sprint.count} جمل` : 'لسه ما اتجربش'}</span>
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
            ${speaking.at ? `${Math.round(speaking.seconds)} ثانية` : 'لسه ما اتجربش'}
          </span>
          <button class="btn ${speaking.seconds >= 30 ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="speaking:start">${speaking.at ? 'أعد' : 'ابدأ'}</button>
        </div>
      </div>

      <div class="test-card ${delayed.passed ? 'is-done' : ''}" style="grid-column:1/-1">
        <div class="test-head">
          <span class="test-ico ${delayed.passed ? 'green' : delayedReady ? '' : 'green'}">${delayed.passed ? icon('trophy') : icon('calendar')}</span>
          <h4>استدعاء مؤجل</h4>
        </div>
        <p class="test-req">بعد أسبوع من خطوة التنويع، قول الجملة من غير أي مراجعة في اليوم ده.</p>
        <div class="test-foot">
          <span class="test-state ${delayed.passed ? 'done' : delayedReady ? '' : 'locked'}">
            ${delayed.passed
              ? `عدّى · ${relativeWhen(delayed.at)}`
              : !delayedDue
                ? 'بيفتح بعد إكمال خطوة «غيّر»'
                : delayedReady
                  ? 'مستحق النهاردة'
                  : `بيفتح بعد ${Math.max(1, daysBetween(new Date(), delayedDue))} أيام`}
          </span>
          ${delayed.passed
            ? html`<span class="test-state done">تم</span>`
            : html`<button class="btn btn-primary btn-sm" data-act="delayed:start" ${delayedReady ? '' : 'disabled'}>ابدأ</button>`}
        </div>
      </div>
    </div>
  `;
}

/* ---------------- STEP 6 ---------------- */

function stepMastery(chunk, next) {
  const rec = store.record(chunk.id);
  const flags = store.stageFlags(chunk.id);
  const gates = [
    { done: flags[0], label: 'فهمت الـChunk وحددت وظيفته', hint: 'خطوة 1', step: 1 },
    { done: flags[1], label: 'نطقته 3 مرات بصوت عالي', hint: 'خطوة 2', step: 2 },
    { done: flags[2], label: '30 إنتاج موزعين على أسبوع', hint: 'خطوة 3', step: 3 },
    { done: flags[3], label: '4 محاور تنويع', hint: 'خطوة 4', step: 4 },
    {
      done: flags[4],
      label: 'الاختبارات: استدعاء + سرعة + كلام + استدعاء مؤجل',
      hint: 'خطوة 5',
      step: 5,
    },
  ];
  const ready = gates.every((gate) => gate.done);
  const mastered = rec.mastery.done;
  const missing = gates.filter((gate) => !gate.done);
  const missingLabel =
    missing.length === 1 ? 'شرط واحد ناقص' : missing.length === 2 ? 'شرطين ناقصين' : `${missing.length} شروط ناقصة`;

  return html`
    ${stepHead(6, 'اعتبره متقنًا', 'الإتقان مش إنك خلصت الخطوات — إن الجملة تطلع منك لوحدها بعد فترة.')}
    <div class="gate-list">
      ${gates.map(
        (gate) => html`
          <div class="gate-row ${gate.done ? 'is-on' : ''}">
            ${icon(gate.done ? 'check' : 'lock')}
            <span>${gate.label}</span>
            <button class="link gate-hint" data-act="go-step" data-step="${gate.step}">${gate.hint}</button>
          </div>
        `,
      )}
    </div>

    ${mastered
      ? html`
          <div class="mastery-card">
            <div class="mastery-sticker">${icon('trophy')}</div>
            <div>
              <h3>الجملة متقنة ✓</h3>
              <p>${rec.mastery.at ? `اتقنت ${relativeWhen(rec.mastery.at)}` : ''} · المراجعة الجاية ${dueLabel(rec.review.due)}</p>
            </div>
            <a class="btn btn-primary" href="#/practice/${next.id}?step=${next.step}">الجملة اللي بعدها ${icon('forward')}</a>
          </div>
        `
      : ready
        ? html`
            <div class="mastery-card">
              <div class="mastery-sticker">${icon('trophy')}</div>
              <div>
                <h3>كل الشروط اكتملت</h3>
                <p>لو حاسس إن الجملة خرجت منك لوحدها من غير تفكير طويل — اعتبرها متقنة.</p>
              </div>
              <button class="btn btn-primary" data-act="mastery:complete">اعتبره متقن ${icon('check')}</button>
            </div>
          `
        : html`
            <div class="callout">
              ${icon('lock')}
              <span>لسه ${missingLabel}. كمّلهم وبعدين ارجع للخطوة دي.</span>
              ${missing[0] ? html`<button class="btn btn-ghost btn-sm" data-act="go-step" data-step="${missing[0].step}">روح للخطوة</button>` : ''}
            </div>
          `}

    <div class="callout" style="background:var(--card-2);border-inline-start-color:var(--blue)">
      ${icon('calendar')}
      <span>بعد الإتقان، الجملة بتدخل جدول المراجعة: بعد 3 أيام، وبعدها الفواصل بتطول تلقائيًا كل مرة تعرفها.</span>
    </div>

    ${!mastered && !ready
      ? html`<a class="link" href="#/level/${chunk.level}">اشتغل على جملة تانية لحد ما المواعيد تحين ${icon('forward')}</a>`
      : ''}
  `;
}

/* ---------------- PRACTICE SCREEN ---------------- */

function railMarkup(step) {
  const flags = store.stageFlags(currentChunkId);
  return html`
    ${STAGES.map((stage, index) => {
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
    const requested = Number(query.get('step'));
    const step = clamp(Number.isFinite(requested) && requested > 0 ? requested : store.currentStep(chunk.id), 1, 6);
    const total = store.peek(chunk.id)?.produce.total || 0;

    return html`
      <div class="page practice-page" style="--lv:var(--${chunk.level.toLowerCase()})">
        <div class="practice-top">
          <a class="back-btn" href="#/level/${chunk.level}" aria-label="رجوع للمستوى">${icon('back')}</a>
          <div class="practice-meta">
            <strong>${chunk.level} · ${chunk.id}</strong>
            <span class="dot-sep"></span>
            <span class="sub muted">${chunk.family ? `قالب: ${chunk.template}` : 'جملة مستقلة'}</span>
          </div>
          <span class="saveflag" id="saveflag">محفوظ تلقائيًا</span>
        </div>

        <div class="practice-grid">
          <section class="step-panel" id="step-panel"></section>

          <aside class="practice-aside">
            <div class="rail-panel">
              <div class="rail-panel-title">مسار الجملة</div>
              <ul class="rail-steps" id="rail">${railMarkup(step)}</ul>
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
    let step = clamp(Number(new URLSearchParams(location.hash.split('?')[1] || '').get('step')) || store.currentStep(chunk.id), 1, 6);
    let stream = null;
    let recorder = null;
    let recUrl = null;
    let heartbeat = null;
    let clockTick = null;

    const nextChunk = () => {
      const level = store.level(chunk.level);
      const index = level.chunks.findIndex((c) => c.id === chunk.id);
      const following = level.chunks[index + 1];
      if (following) return { id: following.id, step: store.currentStep(following.id) };
      const nextLevel = store.levels[store.levels.findIndex((l) => l.id === chunk.level) + 1];
      if (nextLevel) return { id: nextLevel.chunks[0].id, step: 1 };
      return { id: chunk.id, step: 1 };
    };
    const next = nextChunk();

    const setSaveFlag = (state = 'saved') => {
      saveflag.classList.toggle('is-saving', state === 'saving');
      saveflag.textContent = state === 'saving' ? 'بيتحفظ...' : 'محفوظ تلقائيًا';
    };

    const paint = () => {
      const rec = store.record(chunk.id);
      if (step === 1) panel.innerHTML = String(stepUnderstand(chunk, local));
      else if (step === 2) panel.innerHTML = String(stepSpeak(chunk, local));
      else if (step === 3) panel.innerHTML = String(stepProduce(chunk, local));
      else if (step === 4) panel.innerHTML = String(stepVary(chunk, { drafts }));
      else if (step === 5) panel.innerHTML = String(stepTest(chunk));
      else panel.innerHTML = String(stepMastery(chunk, next));

      panel.innerHTML += String(footerMarkup(step));
      rail.innerHTML = String(railMarkup(step));
      history.replaceState(null, '', `#/practice/${chunk.id}?step=${step}`);
      store.setPointer(chunk.id, step);
      bindStepInputs();
      if (sessionProduce) sessionProduce.textContent = `${rec.produce.total || 0} من 30`;
      if (lastSave) lastSave.textContent = timeLabel(new Date());
      if (step === 2 && recUrl) renderAudio();
    };

    const footerMarkup = (current) => html`
      <div class="step-foot">
        <button class="btn btn-ghost btn-sm" data-act="prev" ${current === 1 ? 'disabled' : ''}>${icon('back')} اللي فات</button>
        <div class="step-dots">${[0, 1, 2, 3, 4, 5].map((i) => html`<i class="${i < current ? 'on' : ''}"></i>`)}</div>
        ${current < 6
          ? html`<button class="btn btn-primary btn-sm" data-act="next">الخطوة اللي بعدها ${icon('forward')}</button>`
          : store.peek(chunk.id)?.mastery?.done
            ? html`<a class="btn btn-primary btn-sm" href="#/practice/${next.id}?step=${next.step}">الجملة اللي بعدها ${icon('forward')}</a>`
            : html`<button class="btn btn-ghost btn-sm" data-act="finish" disabled>كمّل الشروط الأول</button>`}
      </div>
    `;

    const goToStep = (target) => {
      step = clamp(target, 1, 6);
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
        case 'understand:done':
          store.finishUnderstand(chunk.id);
          goToStep(2);
          break;
        case 'speak:pass':
          store.setSpeakPass(chunk.id, target.dataset.pass, !rec.speak.passes[target.dataset.pass]);
          paint();
          break;
        case 'say':
          speak(Number(target.dataset.rate) || 0.95);
          break;
        case 'blind':
          openBlindTest();
          break;
        case 'record':
          startRecording(target);
          break;
        case 'batch:log': {
          const index = Number(target.dataset.index);
          const batch = store.batchState(chunk.id)[index];
          store.addProduction(chunk.id, batch.amount);
          toast(`سجلت ${batch.amount} إنتاج — ${batch.label}`, 'check');
          paint();
          break;
        }
        case 'vary:save': {
          const axis = target.dataset.axis;
          const text = drafts[axis] || panel.querySelector(`[data-draft="${axis}"]`)?.value || '';
          if (!text.trim()) {
            toast('اكتب جملة الأول', 'spark');
            return;
          }
          store.addVariation(chunk.id, axis, text);
          drafts[axis] = '';
          paint();
          break;
        }
        case 'vary:del':
          store.removeVariation(chunk.id, Number(target.dataset.index));
          paint();
          break;
        case 'recall:start':
          openRecallDrill(chunk, {
            onDone: ({ passed, score, total }) => {
              store.setRecall(chunk.id, score, total);
              toast(passed ? 'استدعاء ممتاز' : `جبت ${score} من ${total} — جرّب تاني`, passed ? 'check' : 'clock');
              paint();
            },
          });
          break;
        case 'sprint:start':
          openSprintDrill(chunk, {
            onDone: ({ count }) => {
              store.setSprint(chunk.id, count);
              toast(`سجلت ${count} جمل في الدقيقة`, count >= 5 ? 'check' : 'clock');
              paint();
            },
          });
          break;
        case 'speaking:start':
          openSpeakingDrill(chunk, {
            onDone: ({ seconds, note }) => {
              store.setSpeaking(chunk.id, seconds, note);
              toast('اتسجل الكلام المرتجل', 'check');
              paint();
            },
          });
          break;
        case 'delayed:start':
          openRecallDrill(chunk, {
            onDone: ({ passed, score, total }) => {
              if (passed) {
                store.setDelayed(chunk.id, true, score);
                toast('الاستدعاء المؤجل عدّى — الشروط كاملة', 'trophy');
              } else {
                toast(`جبت ${score} من ${total} — راجع الجملة وحاول بعد يوم`, 'clock');
              }
              paint();
            },
          });
          break;
        case 'mastery:complete':
          if (store.completeMastery(chunk.id)) {
            toast('الجملة دخلت جدول المراجعة ✓', 'trophy');
            paint();
          }
          break;
        case 'go-step':
          goToStep(Number(target.dataset.step));
          break;
        case 'prev':
          goToStep(step - 1);
          break;
        case 'next':
          goToStep(step + 1);
          break;
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
