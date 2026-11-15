// Timed drills shared by the practice wizard and the review queue.
import { openModal } from './ui.js';
import { html, icon, formatClock } from './utils.js';
import { audioEngine } from './audioEngine.js';

export function openRecallDrill(chunk, { onDone, rounds = 5, seconds = 2 } = {}) {
  const results = [];
  let round = 0;
  let closed = false;
  let timer = null;

  const modal = openModal(
    html`<div class="drill" id="drill-body"></div>`,
    {
      className: 'drill-modal',
      onClose: () => {
        closed = true;
        clearInterval(timer);
      },
    },
  );

  const body = modal.root.querySelector('#drill-body');

  const paintRound = () => {
    const revealed = { value: false };
    const remaining = { value: seconds };
    if (round >= rounds) {
      const score = results.filter(Boolean).length;
      const passed = score >= Math.ceil(rounds * 0.8);
      if (passed) {
        if (score === rounds) audioEngine.playWorkoutComplete();
        else audioEngine.playExerciseComplete();
      } else {
        audioEngine.playSoftError();
      }
      body.innerHTML = String(html`
        <div class="mastery-sticker" style="margin:0 auto 14px;width:66px;height:66px;font-size:26px">
          ${icon('trophy')}
        </div>
        <h3>${passed ? 'استدعاء تمام' : 'محتاج تكرار أكتر'}</h3>
        <p class="sub muted" style="margin:4px 0 6px">جبت ${score} من ${rounds}</p>
        <p class="sub muted">${passed ? 'الاستدعاء السريع شرط أساسي للإتقان.' : 'جرّب تاني بعد ما تراجع الجملة بصوت عالي.'}</p>
        <div class="modal-actions" style="justify-content:center">
          <button class="btn btn-primary" data-finish>تمام</button>
        </div>
      `);
      body.querySelector('[data-finish]').addEventListener('click', () => {
        modal.close();
        onDone?.({ passed, score, total: rounds });
      });
      return;
    }

    const render = () => {
      const score = results.filter(Boolean).length;
      body.innerHTML = String(html`
        <div class="prompt-label" style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
          <span>استدعاء سريع</span>
          <span>${round + 1} من ${rounds} · ${score} صح</span>
        </div>
        <p class="drill-prompt">اقرا المعنى، وقول الجملة بالألماني قبل ما تظهر</p>
        <div class="drill-ar">${chunk.ar}</div>
        ${revealed.value
          ? html`<div class="drill-de de" dir="ltr">${chunk.de}</div>`
          : html`
              <div class="timer-ring">
                <svg viewBox="0 0 54 54">
                  <circle class="t-bg" cx="27" cy="27" r="23"></circle>
                  <circle class="t-fg" cx="27" cy="27" r="23"
                    stroke-dasharray="144.5"
                    stroke-dashoffset="${144.5 * (1 - remaining.value / seconds)}"></circle>
                </svg>
                <span class="timer-num">${remaining.value}</span>
              </div>
              <button class="btn btn-ghost btn-sm" data-reveal>شوف الجملة بدري</button>
            `}
        ${revealed.value
          ? html`
              <div class="drill-actions">
                <button class="btn btn-primary" data-answer="yes">${icon('check')} عرفت</button>
                <button class="btn btn-ghost" data-answer="no">لأ، نسيتها</button>
              </div>
            `
          : ''}
      `);

      body.querySelector('[data-reveal]')?.addEventListener('click', () => {
        clearInterval(timer);
        revealed.value = true;
        render();
      });
      body.querySelectorAll('[data-answer]').forEach((button) => {
        button.addEventListener('click', () => {
          const isYes = button.dataset.answer === 'yes';
          results.push(isYes);
          if (isYes) audioEngine.playSetComplete(round);
          else audioEngine.playSoftError();
          round += 1;
          paintRound();
        });
      });
      if (!revealed.value) {
        clearInterval(timer);
        timer = setInterval(() => {
          remaining.value -= 1;
          if (remaining.value <= 3 && remaining.value > 0) {
            audioEngine.playCountdownTick(remaining.value);
          }
          if (remaining.value <= 0) {
            clearInterval(timer);
            revealed.value = true;
            audioEngine.playRestComplete();
          }
          render();
        }, 1000);
      }
    };

    render();
  };

  paintRound();
  return modal;
}

export function openSprintDrill(chunk, { seconds = 60, target = 5, onDone } = {}) {
  let left = seconds;
  let count = 0;
  let interval = null;
  let finished = false;

  const modal = openModal(html`<div class="drill" id="sprint-body"></div>`, {
    className: 'drill-modal',
    onClose: () => {
      finished = true;
      clearInterval(interval);
    },
  });
  const body = modal.root.querySelector('#sprint-body');

  const paint = () => {
    body.innerHTML = String(html`
      <div class="prompt-label" style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
        <span>سباق الـ60 ثانية</span>
        <span>${formatClock(left)}</span>
      </div>
      <p class="drill-prompt">قول جمل مختلفة بنفس القالب — كل جملة تخلصها اضغط +1</p>
      <div class="drill-ar" style="font-size:17px;margin-bottom:8px">${chunk.ar}</div>
      <div class="drill-timer-bar"><span style="width:${(left / seconds) * 100}%"></span></div>
      <div class="sprint-count">${count} <small style="font-size:16px;font-weight:normal;color:var(--muted)">/ ${target} جمل</small></div>
      <p class="sub muted" style="margin-bottom:8px">الهدف: ${target} جمل على الأقل في الدقيقة</p>
      <div class="drill-actions" style="margin-top:12px;gap:10px">
        <button class="btn btn-primary" data-plus style="font-size:16px;font-weight:700;padding:10px 20px">+1 جملة جديدة</button>
        <button class="btn btn-ghost" data-stop style="border:1px solid var(--line);font-size:14px">إنهاء وحفظ (${count})</button>
      </div>
    `);
    body.querySelector('[data-plus]').addEventListener('click', () => {
      if (finished) return;
      count += 1;
      audioEngine.playStepper('up');
      if (count === target) {
        audioEngine.playSetComplete(target);
      }
      paint();
    });
    body.querySelector('[data-stop]').addEventListener('click', () => {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      if (count >= target) audioEngine.playExerciseComplete();
      modal.close();
      onDone?.({ count, seconds: seconds - left });
    });
  };

  paint();
  interval = setInterval(() => {
    if (finished) return;
    left -= 1;
    if (left <= 3 && left > 0) {
      audioEngine.playCountdownTick(left);
    }
    if (left <= 0) {
      left = 0;
      clearInterval(interval);
      audioEngine.playRestComplete();
      if (!finished) {
        finished = true;
        if (count >= target) audioEngine.playExerciseComplete();
        modal.close();
        onDone?.({ count, seconds });
        return;
      }
    }
    paint();
  }, 1000);

  return modal;
}

export function openSpeakingDrill(chunk, { seconds = 45, minSeconds = 30, onDone } = {}) {
  let interval = null;
  let finished = false;
  const started = Date.now();
  let note = '';

  const modal = openModal(
    html`
      <div class="drill">
        <div class="prompt-label" style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
          <span>كلام مرتجل</span>
          <span id="speak-clock">00:00 / ${formatClock(seconds)}</span>
        </div>
        <p class="drill-prompt">اتكلم 30–45 ثانية وتدخل الجملة طبيعي في الكلام — من غير تفكير طويل</p>
        <div class="drill-ar de" dir="ltr">${chunk.de}</div>
        <div class="drill-timer-bar"><span id="speak-bar" style="width:0%"></span></div>
        <div class="callout" style="text-align:start;margin-top:6px">
          ${icon('spark')}
          <span id="speak-hint">لسه ${minSeconds} ثانية على أقل حاجة مقبولة.</span>
        </div>
        <label class="sub muted" style="display:block;text-align:start;margin-top:10px">ملاحظة (اختياري): إيه اللي قلته؟</label>
        <textarea id="speak-note" rows="2" style="width:100%;margin-top:4px;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--card)"
          placeholder="مثال: حكيت عن يومي في الشغل واستخدمت الجملة مرتين"></textarea>
        <div class="modal-actions" style="justify-content:center">
          <button class="btn btn-primary" id="speak-done" disabled>${icon('check')} خلصت</button>
          <button class="btn btn-quiet" id="speak-cancel">إلغاء</button>
        </div>
      </div>
    `,
    {
      className: 'drill-modal',
      onClose: () => {
        finished = true;
        clearInterval(interval);
      },
    },
  );

  const body = modal.root;
  const clock = body.querySelector('#speak-clock');
  const bar = body.querySelector('#speak-bar');
  const hint = body.querySelector('#speak-hint');
  const done = body.querySelector('#speak-done');
  body.querySelector('#speak-note').addEventListener('input', (event) => {
    note = event.target.value;
  });

  const tick = () => {
    if (finished) return;
    const used = Math.min(seconds, Math.round((Date.now() - started) / 1000));
    clock.textContent = `${formatClock(used)} / ${formatClock(seconds)}`;
    bar.style.width = `${(used / seconds) * 100}%`;
    const ready = used >= minSeconds;
    done.disabled = !ready;
    hint.textContent = ready ? 'تمام، كمّل لحد ما تحس إن الجملة خرجت لوحدها.' : `لسه ${minSeconds - used} ثانية على أقل حاجة مقبولة.`;

    if (used >= seconds) {
      finished = true;
      clearInterval(interval);
      modal.close();
      onDone?.({ seconds, note });
    }
  };

  done.addEventListener('click', () => {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    modal.close();
    onDone?.({ seconds: Math.min(seconds, Math.round((Date.now() - started) / 1000)), note });
  });
  body.querySelector('#speak-cancel').addEventListener('click', () => modal.close());

  tick();
  interval = setInterval(tick, 1000);
  return modal;
}
