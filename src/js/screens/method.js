import { html, icon } from '../utils.js';
import { openModal } from '../ui.js';

const STEPS = [
  {
    title: 'افهم الـChunk',
    body: 'اقرأ الجملة، افهم معناها بالعربي، اعرف وظيفتها (رأي، مقارنة، سبب، رد)، وراقب ترتيب الكلمات. الفهم قبل أي تدريب.',
    app: 'في التطبيق: خطوة 1 — مع ترجمة مخفية وخريطة كلمات توضّح القالب الثابت والجزء اللي بيتغيّر.',
  },
  {
    title: 'انطقه بصوت عالي',
    body: 'مرة ببطء، مرة بسرعة طبيعية، ومرة من غير ما تبص على الجملة. النطق العالي بيربط الشكل بالصوت.',
    app: 'في التطبيق: خطوة 2 — صوت ألماني، تسجيل صوتك للمقارنة، واختبار «من غير ما تبص».',
  },
  {
    title: 'درّب عليه 30 إنتاج',
    body: '10 جمل مختلفة في الجلسة الأولى، وبعدين 5 بعد عدة ساعات، 5 اليوم التالي، 5 بعد 3 أيام، 5 بعد 7 أيام.',
    app: 'في التطبيق: خطوة 3 — الجدول بيتفتح بمواعيده، والتطبيق بيفكرك في المراجعة.',
  },
  {
    title: 'غيّر كل مرة',
    body: 'غيّر الفاعل، غيّر الزمن، غيّر الكلمات، وغيّر الموقف. نفس القالب في سياقات مختلفة.',
    app: 'في التطبيق: خطوة 4 — أربع خانات محفوظة، وبتشوف جمل تانية بنفس القالب.',
  },
  {
    title: 'اختبر نفسك',
    body: 'استدعاء القالب من الذاكرة، 5 جمل جديدة، 5 جمل في دقيقة، استخدام في كلام مرتجل 30–45 ثانية، واستدعاء مؤجل بعد أسبوع.',
    app: 'في التطبيق: خطوة 5 — خمس اختبارات بتسجيل نتائجها وتواريخها.',
  },
  {
    title: 'اعتبره متقنًا فقط إذا...',
    body: 'تفتكره بسرعة، تستخدمه طبيعي، تدخله في إجابة بدون تفكير طويل، وترجع تفتكره بعد فترة.',
    app: 'في التطبيق: خطوة 6 — الشروط الخمسة لازم تكتمل، وبعدها الجملة تدخل جدول المراجعة.',
  },
];

export const methodScreen = {
  render() {
    return html`
      <div class="page method-page">
        <div class="section-head">
          <div>
            <span class="eyebrow">الطريقة</span>
            <h1 style="font-size:clamp(26px,3.2vw,34px);margin-top:2px">الـChunk يبقى تلقائي في الكلام</h1>
            <p class="sub muted">مش مجرد حفظ — 6 خطوات لكل جملة، وجدول تكرار بيخليها تثبت.</p>
          </div>
          <a class="btn btn-primary btn-sm" href="#/home">${icon('play')} ابدأ جلسة</a>
        </div>

        <div class="method-wrap">
          <div>
            <figure class="poster-frame" data-act="zoom" role="button" tabindex="0" aria-label="كبّر صورة الدليل">
              <img src="../assets/method.png" alt="دليل إتقان الشانكس الألماني خطوة بخطوة" />
              <span class="zoom-hint">${icon('search')} كبّر الصورة</span>
            </figure>
            <p class="poster-caption">الدليل اللي اتبنى عليه التطبيق — ست خطوات لكل Chunk.</p>
          </div>

          <div class="method-copy">
            ${STEPS.map(
              (step, index) => html`
                <div class="method-item">
                  <div class="method-index">${index + 1}</div>
                  <div>
                    <h3>${step.title}</h3>
                    <p>${step.body}</p>
                    <p style="color:var(--blue);margin-top:4px">${step.app}</p>
                  </div>
                </div>
              `,
            )}
          </div>
        </div>

        <div class="panel panel-pad">
          <h2 style="font-size:19px;margin-bottom:10px">جدول الـ30 إنتاج</h2>
          <table class="schedule-table">
            <thead><tr><th>المرحلة</th><th>عدد الجمل</th><th>إمتى</th></tr></thead>
            <tbody>
              <tr><td>الجلسة الأولى</td><td><b>10</b> جمل مختلفة</td><td>أول ما تتعلم الجملة</td></tr>
              <tr><td>بعد عدة ساعات</td><td><b>5</b></td><td>نفس اليوم</td></tr>
              <tr><td>اليوم التالي</td><td><b>5</b></td><td>بعد 24 ساعة</td></tr>
              <tr><td>بعد 3 أيام</td><td><b>5</b></td><td>مراجعة</td></tr>
              <tr><td>بعد 7 أيام</td><td><b>5</b></td><td>مراجعة نهائية</td></tr>
            </tbody>
          </table>
          <p class="sub muted" style="margin-top:10px">الرقم ده اقتراح وليس قاعدة علمية ثابتة — عدّله على حسب وقتك، بس متكررش نفس الجملة.</p>
        </div>

        <div class="method-strip">
          <div class="method-steps">
            <span class="method-step"><span class="method-num">${icon('target')}</span> النجاح المقترح: 8/10 مع اجتياز الاستخدام التلقائي والمراجعة المؤجلة</span>
          </div>
          <a class="link" href="#/settings">${icon('gear')} ظبط هدفك اليومي</a>
        </div>
      </div>
    `;
  },

  mount(root) {
    const open = () => {
      openModal(
        html`<img src="../assets/method.png" alt="دليل إتقان الشانكس الألماني خطوة بخطوة" style="display:block;width:100%;height:auto;border-radius:12px" />`,
        { className: 'poster-modal' },
      );
    };
    const onClick = (event) => {
      if (event.target.closest('[data-act="zoom"]')) open();
    };
    const onKey = (event) => {
      if (event.key === 'Enter' && event.target.closest('[data-act="zoom"]')) open();
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
    };
  },
};
