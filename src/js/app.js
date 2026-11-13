// App shell: boot, hash router, chrome status, global error surface.
import { store } from './store.js';
import { html, icon, chunksLabel } from './utils.js';
import { toast, closeAllModals } from './ui.js';
import { homeScreen } from './screens/home.js';
import { levelScreen } from './screens/level.js';
import { practiceScreen } from './screens/practice.js';
import { reviewScreen } from './screens/review.js';
import { statsScreen } from './screens/stats.js';
import { settingsScreen } from './screens/settings.js';
import { methodScreen } from './screens/method.js';

const routes = [
  { name: 'home', pattern: /^\/?$/, screen: homeScreen },
  { name: 'home', pattern: /^\/home$/, screen: homeScreen },
  { name: 'level', pattern: /^\/level\/([A-Z]\d)$/, screen: levelScreen, keys: ['levelId'] },
  { name: 'practice', pattern: /^\/practice\/([A-Z]\d-\d{3})$/, screen: practiceScreen, keys: ['chunkId'] },
  { name: 'review', pattern: /^\/review$/, screen: reviewScreen },
  { name: 'stats', pattern: /^\/stats$/, screen: statsScreen },
  { name: 'settings', pattern: /^\/settings$/, screen: settingsScreen },
  { name: 'method', pattern: /^\/method$/, screen: methodScreen },
];

const view = document.getElementById('view');
let cleanup = null;
let current = null;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/home';
  const [path, search] = raw.split('?');
  return { path: path || '/home', query: new URLSearchParams(search || '') };
}

function resolve() {
  const { path, query } = parseHash();
  for (const entry of routes) {
    const match = entry.pattern.exec(path);
    if (!match) continue;
    const params = {};
    (entry.keys || []).forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1] || '');
    });
    return { ...entry, params, query };
  }
  return { ...routes[0], params: {}, query };
}

function updateChrome(name) {
  document.querySelectorAll('.nav a').forEach((link) => {
    const navName = link.dataset.nav;
    const active = navName === name || (name === 'level' && navName === 'home');
    link.classList.toggle('is-active', active);
  });

  const badge = document.getElementById('nav-due');
  const due = store.overall().due;
  badge.hidden = due === 0;
  badge.textContent = due > 99 ? '99+' : String(due);

  const pill = document.getElementById('streak-pill');
  const streak = store.streak();
  pill.innerHTML = String(
    html`${icon('flame')}${streak > 0 ? html`<span><b>${streak}</b> يوم متواصل</span>` : html`<span>ابدأ سلسلتك</span>`}`,
  );
  pill.title = streak > 0 ? `${streak} يوم متواصل` : 'لسه مفيش أيام متواصلة';
}

function route() {
  const match = resolve();
  try {
    closeAllModals();
    cleanup?.();
    cleanup = null;
    const context = {
      params: match.params,
      query: match.query,
      navigate,
      refresh: () => route(),
      name: match.name,
    };
    const markup = match.screen.render(context);
    view.innerHTML = String(markup);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.scrollTo(0, 0));
    cleanup = match.screen.mount?.(view, context) || null;
    current = match;
    updateChrome(match.name);
  } catch (error) {
    console.error(error);
    view.innerHTML = String(failScreen(error));
    updateChrome('home');
  }
}

function failScreen(error) {
  return html`
    <div class="page">
      <div class="empty">
        <div class="empty-icon">${icon('spark')}</div>
        <h3>حصلت مشكلة في تحميل الصفحة</h3>
        <p>${String(error?.message || error)}</p>
        <a class="btn btn-primary" href="#/home">رجوع للرئيسية</a>
      </div>
    </div>
  `;
}

async function boot() {
  try {
    await store.init();
    document.documentElement.dataset.theme = store.state.settings.theme === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error(error);
    view.innerHTML = String(html`
      <div class="page">
        <div class="empty">
          <div class="empty-icon">${icon('spark')}</div>
          <h3>مش قادر أفتح ملفات الشانكس</h3>
          <p>${String(error?.message || error)} — اتأكد إن فولدر <b>data/chunks.json</b> موجود جوه التطبيق.</p>
        </div>
      </div>
    `);
    return;
  }

  document.getElementById('settings-btn').addEventListener('click', () => navigate('#/settings'));

  if (new URLSearchParams(location.search).get('debug') === '1') window.__store = store;

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', () => {
    store.flush();
  });
  window.addEventListener('pagehide', () => {
    store.flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.flush();
  });

  route();

  store.onChange = () => updateChrome(current?.name || 'home');

  if (store.freshImport) {
    setTimeout(() => {
      toast(`لقيت تقدمك القديم في ملف A1 — استوردت ${chunksLabel(store.state.meta.importedCount)}`, 'spark');
      store.freshImport = false;
    }, 900);
  }
}

boot();
