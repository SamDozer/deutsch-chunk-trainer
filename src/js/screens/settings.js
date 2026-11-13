import { store } from '../store.js';
import { html, icon, speech, chunksLabel } from '../utils.js';
import { toast, confirmDialog } from '../ui.js';

function switchRow(key, title, desc, on) {
  return html`
    <div class="set-row">
      <div>
        <div class="set-label">${title}</div>
        <div class="set-desc">${desc}</div>
      </div>
      <button class="switch ${on ? 'is-on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" data-toggle="${key}" aria-label="${title}"></button>
    </div>
  `;
}

function rangeRow(key, title, desc, value, min, max, step, format) {
  return html`
    <div class="set-row">
      <div>
        <div class="set-label">${title}</div>
        <div class="set-desc">${desc}</div>
      </div>
      <div class="slider-wrap">
        <b class="slider-value" id="val-${key}" dir="ltr">${format(value)}</b>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-range="${key}" />
        <span class="slider-range" dir="ltr">${format(min)}–${format(max)}</span>
      </div>
    </div>
  `;
}

export const settingsScreen = {
  render() {
    const settings = store.state.settings;
    const voices = speech.germanVoices();
    const path = store.paths?.path || '';
    const stats = { imported: store.state.meta.importedObsidian, importedCount: store.state.meta.importedCount || 0 };

    return html`
      <div class="page settings-page">
        <div class="section-head">
          <div>
            <span class="eyebrow">الإعدادات</span>
            <h1 style="font-size:clamp(26px,3.2vw,34px);margin-top:2px">خلي البرنامج على مزاجك</h1>
            <p class="sub muted">كل حاجة هنا بتتحفظ فورًا على جهازك.</p>
          </div>
          <a class="btn btn-ghost btn-sm" href="#/method">${icon('calendar')} الطريقة</a>
        </div>

        <div class="settings-wrap">
          <div class="stack" style="--gap:18px">
            <section class="set-group">
              <div class="set-group-head"><h2>التفضيلات</h2><p>اليومي والواجهة</p></div>
              ${switchRow('theme', 'الوضع الليلي', 'ألوان هادية للعين في المذاكرة بالليل', settings.theme === 'dark')}
              ${rangeRow(
                'dailyGoal',
                'هدفك اليومي',
                'عدد الإنتاجات اللي عايز تخلصها في اليوم. الافتراضي 25.',
                settings.dailyGoal,
                5,
                80,
                5,
                (value) => `${value}`,
              )}
            </section>

            <section class="set-group">
              <div class="set-group-head"><h2>الصوت الألماني</h2><p>نطق الجمل من غير ما تسيب الشاشة</p></div>
              ${switchRow('tts', 'تشغيل الصوت', 'زرار السماع في خطوة النطق بيشتغل بالصوت الألماني المثبت على الجهاز.', settings.tts !== false)}
              ${rangeRow(
                'ttsRate',
                'سرعة النطق',
                '0.62 للبطيء، و0.95 للطبيعي. تقدر تغيّرها من غير ما تسيب الجملة.',
                settings.ttsRate,
                0.5,
                1.2,
                0.05,
                (value) => `${Number(value).toFixed(2)}×`,
              )}
              <div class="set-row">
                <div>
                  <div class="set-label">صوت النطق</div>
                  <div class="set-desc">${voices.length ? 'اختار الصوت الألماني اللي يعجبك.' : 'مفيش صوت ألماني متسطّب — من إعدادات ويندوز: الوقت واللغة ← اللغة ← إضافة لغة Deutsch.'}</div>
                </div>
                <div class="voice-list" id="voice-list">
                  <button class="voice-chip ${!settings.voice ? 'is-on' : ''}" data-voice="">افتراضي</button>
                  ${voices.map(
                    (voice) => html`<button class="voice-chip ${settings.voice === voice.name ? 'is-on' : ''}" data-voice="${voice.name}" title="${voice.name}">${voice.name}</button>`,
                  )}
                </div>
              </div>
              <div class="set-row">
                <div>
                  <div class="set-label">جرّب الصوت</div>
                  <div class="set-desc">جملة تجريبية: Ich möchte einen Kaffee.</div>
                </div>
                <button class="btn btn-ghost btn-sm" data-act="test-voice">${icon('speaker')} اسمع</button>
              </div>
            </section>

            <section class="set-group">
              <div class="set-group-head"><h2>البيانات</h2><p>تقدمك محفوظ في ملف JSON على جهازك</p></div>
              <div class="set-row" style="display:block">
                <div class="set-label" style="margin-bottom:6px">مكان الملف</div>
                <div class="data-path" id="data-path">${path || 'progress.json — جوه مجلد بيانات التطبيق'}</div>
                <div class="row" style="margin-top:10px">
                  <button class="btn btn-ghost btn-sm" data-act="open-folder">${icon('folder')} افتح فولدر البيانات</button>
                  <button class="btn btn-ghost btn-sm" data-act="export">${icon('download')} صدّر نسخة</button>
                  <button class="btn btn-ghost btn-sm" data-act="import">${icon('upload')} استورد نسخة</button>
                </div>
              </div>
              <div class="set-row">
                <div>
                  <div class="set-label">تقدم ملفات Obsidian القديمة</div>
                  <div class="set-desc">
                    ${stats.imported
                      ? `تم الاستيراد · ${stats.importedCount} جملة عندها شغل محفوظ. تقدر تعيد الاستيراد في أي وقت من غير ما تمسح حاجة.`
                      : 'استورد الشغل اللي في ملفات A1 اللي عندك.'}
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" data-act="legacy">${icon('spark')} استيراد</button>
              </div>
              <div class="set-row">
                <div>
                  <div class="set-label">مسح كل التقدم</div>
                  <div class="set-desc">هيمسح كل الخطوات والإنتاجات والمراجعات. خد نسخة احتياطية الأول.</div>
                </div>
                <button class="btn btn-ghost btn-sm" data-act="reset" style="border-color:var(--red);color:var(--red)">${icon('trash')} مسح</button>
              </div>
            </section>

            <section class="set-group">
              <div class="set-group-head"><h2>عن التطبيق</h2><p>دفتر الشانكس — نسخة محلية بالكامل</p></div>
              <div class="set-row">
                <div>
                  <div class="set-label" id="app-version">الإصدار 1.0.0</div>
                  <div class="set-desc">1500 جملة من A1 لـ C1، مقسمة 5 مستويات، بمسار 6 خطوات وجدول تكرار.</div>
                </div>
                <a class="btn btn-ghost btn-sm" href="#/method">شوف المنهج</a>
              </div>
            </section>
          </div>

          <aside class="settings-side">
            <div class="tip-card">
              <strong>اختصارات سريعة</strong>
              Esc: خروج من الجلسة · Alt + ← / →: تنقّل بين الخطوات. كل حاجة بتتحفظ تلقائيًا.
            </div>
            <div class="tip-card" style="background:color-mix(in srgb, var(--yellow) 18%, var(--card))">
              <strong>نصيحة الاستمرار</strong>
              5–10 جمل في الجلسة الواحدة أحسن من 30 مرة واحدة. المراجعة اليومية أهم من الجلسات الطويلة.
            </div>
            <div class="tip-card">
              <strong>ملاحظة أمان</strong>
              مفيش أي بيانات بتطلع من الجهاز. التسجيل الصوتي (لو استخدمته) بيتمسح أول ما تقفل الجلسة.
            </div>
          </aside>
        </div>
      </div>
    `;
  },

  mount(root) {
    const settings = store.state.settings;

    const setTheme = (next) => {
      store.setSetting('theme', next);
      document.documentElement.dataset.theme = next === 'dark' ? 'dark' : 'light';
      root.querySelector('[data-toggle="theme"]')?.classList.toggle('is-on', next === 'dark');
      root.querySelector('[data-toggle="theme"]')?.setAttribute('aria-checked', next === 'dark' ? 'true' : 'false');
    };

    const onClick = async (event) => {
      const toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        const key = toggle.dataset.toggle;
        if (key === 'theme') {
          setTheme(settings.theme === 'dark' ? 'light' : 'dark');
          return;
        }
        const next = !settings[key];
        store.setSetting(key, next);
        toggle.classList.toggle('is-on', next);
        toggle.setAttribute('aria-checked', next ? 'true' : 'false');
        return;
      }

      const voice = event.target.closest('[data-voice]');
      if (voice) {
        store.setSetting('voice', voice.dataset.voice || '');
        root.querySelectorAll('[data-voice]').forEach((chip) => chip.classList.toggle('is-on', chip === voice));
        toast('اتغير الصوت', 'speaker');
        return;
      }

      const action = event.target.closest('[data-act]')?.dataset.act;
      if (!action) return;

      if (action === 'test-voice') {
        const ok = await speech.speak('Ich möchte einen Kaffee.', {
          rate: settings.ttsRate,
          voiceName: settings.voice,
        });
        if (!ok) toast('الصوت مش متاح على الجهاز ده', 'lock');
      } else if (action === 'open-folder') {
        await window.chunkAPI?.openDataFolder();
      } else if (action === 'export') {
        const result = await store.exportData();
        if (result?.ok) toast('اتصدّرت نسخة من تقدمك', 'download');
        else if (!result?.canceled) toast('مش قادر أصدّر', 'lock');
      } else if (action === 'import') {
        const result = await store.importData();
        if (result?.ok) {
          toast('اتستورد — التطبيق هيعيد التحميل', 'upload');
          setTimeout(() => location.reload(), 600);
        } else if (!result?.canceled) toast(result?.error || 'الملف مش صالح', 'lock');
      } else if (action === 'legacy') {
        const result = store.importLegacyProgress();
        toast(`تم استيراد ${chunksLabel(result.count)} · ${result.stages} مرحلة`, 'spark');
      } else if (action === 'reset') {
        const confirmed = await confirmDialog({
          title: 'متأكد إنك عايز تمسح كل التقدم؟',
          text: 'هيتم مسح كل الخطوات والإنتاجات والمراجعات. النسخة الاحتياطية بتتحفظ في مجلد backups جوه بيانات التطبيق.',
          confirm: 'امسح كل حاجة',
          danger: true,
        });
        if (confirmed) {
          await store.resetAll();
          toast('اتمسح كل حاجة — بداية جديدة', 'spark');
          location.hash = '#/home';
          setTimeout(() => location.reload(), 400);
        }
      }
    };

    const onInput = (event) => {
      const range = event.target.closest('[data-range]');
      if (!range) return;
      const key = range.dataset.range;
      const value = Number(range.value);
      const label = root.querySelector(`#val-${key}`);
      if (label) label.textContent = key === 'ttsRate' ? `${value.toFixed(2)}×` : String(value);
    };

    const onChange = (event) => {
      const range = event.target.closest('[data-range]');
      if (!range) return;
      store.setSetting(range.dataset.range, Number(range.value));
      toast('اتحفظ', 'check');
    };

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);

    const rebuildVoices = () => {
      const list = root.querySelector('#voice-list');
      if (!list) return;
      const voices = speech.germanVoices();
      if (!voices.length) return;
      list.innerHTML = String(html`
        <button class="voice-chip ${!settings.voice ? 'is-on' : ''}" data-voice="">افتراضي</button>
        ${voices.map(
          (voice) => html`<button class="voice-chip ${settings.voice === voice.name ? 'is-on' : ''}" data-voice="${voice.name}" title="${voice.name}">${voice.name}</button>`,
        )}
      `);
    };
    rebuildVoices();
    const voiceTimer = setTimeout(rebuildVoices, 900);
    window.speechSynthesis?.addEventListener?.('voiceschanged', rebuildVoices);

    window.chunkAPI?.appInfo().then((info) => {
      const node = root.querySelector('#app-version');
      if (node && info) node.textContent = `الإصدار ${info.version} · Electron ${info.electron}`;
    });

    return () => {
      clearTimeout(voiceTimer);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', rebuildVoices);
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onChange);
    };
  },
};
