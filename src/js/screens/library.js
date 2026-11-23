import { html, icon, esc, raw, clamp } from '../utils.js';
import { sectionHead, toast } from '../ui.js';
import { audioEngine } from '../audioEngine.js';

const STORAGE_KEY = 'chunk-trainer-library-v1';
const PAGE_SIZE = 36;

let cachedManifest = null;
let loadPromise = null;

function loadUserLibState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      read: new Set(Array.isArray(parsed?.read) ? parsed.read : []),
      fav: new Set(Array.isArray(parsed?.fav) ? parsed.fav : []),
      lastTopic: parsed?.lastTopic || 'all',
      lastPillar: parsed?.lastPillar || 'all',
    };
  } catch {
    return { read: new Set(), fav: new Set(), lastTopic: 'all', lastPillar: 'all' };
  }
}

function saveUserLibState(st) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        read: [...st.read],
        fav: [...st.fav],
        lastTopic: st.lastTopic,
        lastPillar: st.lastPillar,
      }),
    );
  } catch {}
}

async function ensureLibraryManifest() {
  if (cachedManifest) return cachedManifest;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const url = new URL('../../../data/library.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedManifest = await res.json();
    return cachedManifest;
  })();
  return loadPromise;
}

export const libraryScreen = {
  render() {
    return html`
      <div class="page library-page" id="library-root">
        <div class="library-loading panel panel-pad">
          <div class="row">
            ${icon('spark')}
            <span>جارٍ تحميل المكتبة المصورة...</span>
          </div>
        </div>
      </div>
    `;
  },

  mount(root, context) {
    const container = root.querySelector('#library-root');
    if (!container) return null;

    const userState = loadUserLibState();
    let activePillar = context?.query?.get('pillar') || 'all';
    let activeTopic = context?.params?.topicId || context?.query?.get('topic') || 'all';
    let statusFilter = context?.query?.get('filter') || 'all'; // 'all' | 'fav' | 'unread' | 'read'
    let searchQuery = '';
    let visibleCount = PAGE_SIZE;
    let lightboxIndex = -1;
    let zoomLevel = 1;
    let currentFiltered = [];
    let isUnmounted = false;

    const cleanups = [];

    function getFilteredItems(manifest) {
      const q = searchQuery.trim().toLowerCase();
      return manifest.items.filter((item) => {
        if (activePillar !== 'all' && item.pillarId !== activePillar) return false;
        if (activeTopic !== 'all' && item.topicId !== activeTopic) return false;
        if (statusFilter === 'fav' && !userState.fav.has(item.id)) return false;
        if (statusFilter === 'read' && !userState.read.has(item.id)) return false;
        if (statusFilter === 'unread' && userState.read.has(item.id)) return false;
        if (q) {
          const topicObj = manifest.topics.find((t) => t.id === item.topicId);
          const hay = `${item.title} ${item.badge} ${item.origName || ''} ${topicObj?.title || ''} ${topicObj?.desc || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function renderCard(item, idx, topicMap) {
      const isRead = userState.read.has(item.id);
      const isFav = userState.fav.has(item.id);
      const topic = topicMap.get(item.topicId);
      return html`
        <article
          class="lib-card ${isRead ? 'is-read' : ''} ${isFav ? 'is-fav' : ''}"
          data-card-idx="${idx}"
          data-id="${item.id}"
        >
          <div class="lib-card-media" data-open-idx="${idx}" role="button" tabindex="0" aria-label="عرض ${item.title}">
            <img
              src="${item.src}"
              alt="${item.title}"
              width="${item.width || 900}"
              height="${item.height || 1350}"
              loading="lazy"
              decoding="async"
            />
            <div class="lib-card-overlay">
              <span class="lib-zoom-pill">${icon('eye')} تكبير وقراءة</span>
            </div>
            <div class="lib-card-badges">
              <span class="chip chip-navy">${item.badge}</span>
              ${isRead ? html`<span class="chip chip-green">${icon('check')} مقروء</span>` : ''}
            </div>
          </div>

          <div class="lib-card-body">
            <div class="lib-card-topic">${topic?.title || item.badge}</div>
            <h3 class="lib-card-title" data-open-idx="${idx}">${item.title}</h3>
            <div class="lib-card-actions">
              <button
                class="lib-action-btn ${isRead ? 'is-on' : ''}"
                data-toggle-read="${item.id}"
                title="${isRead ? 'إلغاء علامة المقروء' : 'علّم كمقروء'}"
              >
                ${icon('check')}
                <span>${isRead ? 'تمت قراءته' : 'علّم كمقروء'}</span>
              </button>
              <button
                class="lib-action-btn is-fav-btn ${isFav ? 'is-on' : ''}"
                data-toggle-fav="${item.id}"
                title="${isFav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}"
                aria-label="المفضلة"
              >
                ${icon('spark')}
              </button>
            </div>
          </div>
        </article>
      `;
    }

    function renderGridOnly(manifest) {
      const gridEl = container.querySelector('#lib-grid');
      const countEl = container.querySelector('#lib-results-count');
      const moreWrap = container.querySelector('#lib-more-wrap');
      if (!gridEl) return;

      const topicMap = new Map(manifest.topics.map((t) => [t.id, t]));
      currentFiltered = getFilteredItems(manifest);
      const slice = currentFiltered.slice(0, visibleCount);

      if (countEl) {
        countEl.textContent = `${currentFiltered.length} لوحة مصورة`;
      }

      if (currentFiltered.length === 0) {
        gridEl.innerHTML = String(html`
          <div class="lib-empty panel panel-pad">
            <div class="empty-icon">${icon('search')}</div>
            <h3>مفيش نتائج مطابقة للفلتر الحالي</h3>
            <p class="muted">جرّب تغيّر القسم أو تمسح كلمة البحث علشان تشوف كل البطاقات المصورة.</p>
            <button class="btn btn-primary" data-reset-filters style="margin-top:12px">عرض كل المكتبة</button>
          </div>
        `);
      } else {
        gridEl.innerHTML = String(slice.map((item, idx) => renderCard(item, idx, topicMap)));
      }

      if (moreWrap) {
        const remaining = currentFiltered.length - slice.length;
        if (remaining > 0) {
          moreWrap.hidden = false;
          moreWrap.innerHTML = String(html`
            <button class="btn btn-ghost" data-load-more>
              عرض المزيد (${remaining} بطاقة متبقية)
            </button>
          `);
        } else {
          moreWrap.hidden = true;
          moreWrap.innerHTML = '';
        }
      }
    }

    function renderFull(manifest) {
      const readCount = manifest.items.filter((i) => userState.read.has(i.id)).length;
      const favCount = manifest.items.filter((i) => userState.fav.has(i.id)).length;
      const readPct = manifest.totalItems ? Math.round((readCount / manifest.totalItems) * 100) : 0;

      const visibleTopics =
        activePillar === 'all'
          ? manifest.topics
          : manifest.topics.filter((t) => t.pillarId === activePillar);

      const activeTopicObj = manifest.topics.find((t) => t.id === activeTopic);

      container.innerHTML = String(html`
        <section class="hero lib-hero">
          <div class="hero-main">
            <span class="eyebrow">مركز المحتوى المصور · Abdo &amp; Friends Hub</span>
            <h1 class="hero-title">
              المكتبة <span class="hl">المصورة الشاملة</span>
            </h1>
            <p class="hero-sub">
              ${manifest.totalItems} لوحة تعليمية مصورة مقسمة إلى ${manifest.totalTopics} قسماً: قواعد المستويات من A1 إلى C1، الكلمات المتشابهة، الأساطير اليونانية والمصرية، قصص الأنبياء، الفلسفة، وعلم النفس بالألمانية والعربية.
            </p>
            <div class="lib-pillar-tabs" role="tablist" aria-label="الأقسام الرئيسية">
              <button
                class="lib-pillar-tab ${activePillar === 'all' ? 'is-active' : ''}"
                data-pillar="all"
                role="tab"
              >
                <span>🌟 كل الأقسام</span>
                <b>${manifest.totalItems}</b>
              </button>
              ${manifest.pillars.map(
                (p) => html`
                  <button
                    class="lib-pillar-tab ${activePillar === p.id ? 'is-active' : ''}"
                    data-pillar="${p.id}"
                    role="tab"
                  >
                    <span>${p.icon} ${p.title}</span>
                    <b>${p.count}</b>
                  </button>
                `,
              )}
            </div>
          </div>

          <aside class="hero-side">
            <div class="hero-side-title">تقدمك في المكتبة</div>
            <div class="hstat">
              <span>إجمالي اللوحات</span>
              <b>${manifest.totalItems}<small>لوحة</small></b>
            </div>
            <div class="hstat">
              <span>تمت قراءتها</span>
              <b>${readCount}<small>من ${manifest.totalItems}</small></b>
            </div>
            <div class="hstat">
              <span>في المفضلة</span>
              <b>${favCount}<small>محفوظة</small></b>
            </div>
            <div class="goal-block">
              <div class="between">
                <span>نسبة القراءة</span>
                <span>${readPct}%</span>
              </div>
              <div class="meter"><span style="width:${readPct}%"></span></div>
            </div>
          </aside>
        </section>

        <section class="lib-controls panel panel-pad">
          <div class="lib-toolbar">
            <div class="lib-search-box">
              ${icon('search')}
              <input
                type="search"
                id="lib-search-input"
                placeholder="ابحث عن موضوع، مستوى (A2, B1, C1)، أساطير، قواعد، أو اسم سلسلة..."
                value="${searchQuery}"
                aria-label="بحث في المكتبة المصورة"
              />
            </div>

            <div class="lib-status-filters" role="group" aria-label="فلترة حسب الحالة">
              <button class="chip ${statusFilter === 'all' ? 'chip-navy' : ''}" data-status-filter="all">
                الكل
              </button>
              <button class="chip ${statusFilter === 'unread' ? 'chip-navy' : ''}" data-status-filter="unread">
                غير مقروء (${manifest.totalItems - readCount})
              </button>
              <button class="chip ${statusFilter === 'read' ? 'chip-navy' : ''}" data-status-filter="read">
                ${icon('check')} مقروء (${readCount})
              </button>
              <button class="chip ${statusFilter === 'fav' ? 'chip-yellow' : ''}" data-status-filter="fav">
                ${icon('spark')} المفضلة (${favCount})
              </button>
            </div>
          </div>

          <div class="lib-topics-rail" role="navigation" aria-label="الموضوعات الفرعية">
            <button
              class="lib-topic-pill ${activeTopic === 'all' ? 'is-active' : ''}"
              data-topic="all"
            >
              <span>كل الموضوعات</span>
              <small>${activePillar === 'all' ? manifest.totalItems : visibleTopics.reduce((acc, t) => acc + t.count, 0)}</small>
            </button>
            ${visibleTopics.map(
              (t) => html`
                <button
                  class="lib-topic-pill ${activeTopic === t.id ? 'is-active' : ''}"
                  data-topic="${t.id}"
                  title="${t.desc}"
                >
                  <span>${t.title}</span>
                  <small>${t.count}</small>
                </button>
              `,
            )}
          </div>

          ${activeTopicObj
            ? html`
                <div class="lib-topic-banner">
                  <div>
                    <span class="chip chip-yellow">${activeTopicObj.badge}</span>
                    <strong>${activeTopicObj.title}</strong>
                    <span class="muted"> — ${activeTopicObj.desc}</span>
                  </div>
                  <span class="lib-results-badge" id="lib-results-count"></span>
                </div>
              `
            : html`
                <div class="lib-topic-banner">
                  <div>
                    <strong>عرض البطاقات التعليمية</strong>
                    <span class="muted"> — اضغط على أي بطاقة لتكبيرها وقراءتها بوضوح كامل مع التنقل بالأسهم</span>
                  </div>
                  <span class="lib-results-badge" id="lib-results-count"></span>
                </div>
              `}
        </section>

        <section class="lib-grid" id="lib-grid" aria-live="polite"></section>
        <div class="lib-more-wrap" id="lib-more-wrap" hidden></div>
      `);

      renderGridOnly(manifest);
    }

    function renderLightbox(manifest) {
      let lbRoot = document.getElementById('lib-lightbox-portal');
      if (lightboxIndex < 0 || lightboxIndex >= currentFiltered.length) {
        if (lbRoot) lbRoot.remove();
        document.body.style.overflow = '';
        return;
      }
      if (!lbRoot) {
        lbRoot = document.createElement('div');
        lbRoot.id = 'lib-lightbox-portal';
        document.body.appendChild(lbRoot);
      }

      document.body.style.overflow = 'hidden';
      const item = currentFiltered[lightboxIndex];
      const topic = manifest.topics.find((t) => t.id === item.topicId);
      const isRead = userState.read.has(item.id);
      const isFav = userState.fav.has(item.id);

      lbRoot.innerHTML = String(html`
        <div class="lib-lightbox" role="dialog" aria-modal="true" aria-label="${item.title}">
          <header class="lib-lb-header">
            <div class="lib-lb-meta">
              <span class="chip chip-yellow">${item.badge}</span>
              <div class="lib-lb-titles">
                <strong>${item.title}</strong>
                <span>${topic?.title || ''} · بطاقة ${lightboxIndex + 1} من ${currentFiltered.length}</span>
              </div>
            </div>

            <div class="lib-lb-controls">
              <button class="btn btn-sm btn-ghost" data-lb-zoom="out" title="تصغير (-)">−</button>
              <button class="btn btn-sm btn-ghost" data-lb-zoom="reset" title="إعادة الضبط">
                <span id="lib-lb-zoom-label">${Math.round(zoomLevel * 100)}%</span>
              </button>
              <button class="btn btn-sm btn-ghost" data-lb-zoom="in" title="تكبير (+)">+</button>

              <button
                class="btn btn-sm ${isRead ? 'btn-primary' : 'btn-ghost'}"
                data-toggle-read="${item.id}"
              >
                ${icon('check')} ${isRead ? 'تمت قراءته' : 'علّم كمقروء'}
              </button>

              <button
                class="btn btn-sm ${isFav ? 'btn-primary' : 'btn-ghost'}"
                data-toggle-fav="${item.id}"
                title="حفظ في المفضلة"
              >
                ${icon('spark')} ${isFav ? 'في المفضلة' : 'مفضلة'}
              </button>

              <button class="icon-btn lib-lb-close" data-lb-close aria-label="إغلاق (Esc)" title="إغلاق (Esc)">
                ${icon('close')}
              </button>
            </div>
          </header>

          <div class="lib-lb-stage" data-lb-backdrop>
            <button
              class="lib-lb-nav is-prev"
              data-lb-nav="-1"
              ${lightboxIndex === 0 ? 'disabled' : ''}
              aria-label="البطاقة السابقة"
              title="السابق (سهم يمين)"
            >
              ${icon('back')}
            </button>

            <div class="lib-lb-canvas" id="lib-lb-canvas">
              <img
                id="lib-lb-img"
                src="${item.src}"
                alt="${item.title}"
                style="transform: scale(${zoomLevel}); transform-origin: top center;"
              />
            </div>

            <button
              class="lib-lb-nav is-next"
              data-lb-nav="1"
              ${lightboxIndex >= currentFiltered.length - 1 ? 'disabled' : ''}
              aria-label="البطاقة التالية"
              title="التالي (سهم يسار)"
            >
              ${icon('forward')}
            </button>
          </div>
        </div>
      `);
    }

    function updateZoomDOM() {
      const img = document.getElementById('lib-lb-img');
      const lbl = document.getElementById('lib-lb-zoom-label');
      if (img) img.style.transform = `scale(${zoomLevel})`;
      if (lbl) lbl.textContent = `${Math.round(zoomLevel * 100)}%`;
    }

    ensureLibraryManifest()
      .then((manifest) => {
        if (isUnmounted) return;
        renderFull(manifest);

        const onInput = (event) => {
          if (event.target.id === 'lib-search-input') {
            searchQuery = event.target.value || '';
            visibleCount = PAGE_SIZE;
            renderGridOnly(manifest);
          }
        };

        const onClick = (event) => {
          const pillarBtn = event.target.closest('[data-pillar]');
          if (pillarBtn) {
            activePillar = pillarBtn.dataset.pillar;
            activeTopic = 'all';
            visibleCount = PAGE_SIZE;
            renderFull(manifest);
            return;
          }

          const topicBtn = event.target.closest('[data-topic]');
          if (topicBtn) {
            activeTopic = topicBtn.dataset.topic;
            visibleCount = PAGE_SIZE;
            renderFull(manifest);
            return;
          }

          const statusBtn = event.target.closest('[data-status-filter]');
          if (statusBtn) {
            statusFilter = statusBtn.dataset.statusFilter;
            visibleCount = PAGE_SIZE;
            renderFull(manifest);
            return;
          }

          const resetBtn = event.target.closest('[data-reset-filters]');
          if (resetBtn) {
            activePillar = 'all';
            activeTopic = 'all';
            statusFilter = 'all';
            searchQuery = '';
            visibleCount = PAGE_SIZE;
            renderFull(manifest);
            return;
          }

          const moreBtn = event.target.closest('[data-load-more]');
          if (moreBtn) {
            visibleCount += PAGE_SIZE;
            renderGridOnly(manifest);
            return;
          }

          const readBtn = event.target.closest('[data-toggle-read]');
          if (readBtn) {
            event.stopPropagation();
            const id = readBtn.dataset.toggleRead;
            if (userState.read.has(id)) {
              userState.read.delete(id);
            } else {
              userState.read.add(id);
              audioEngine.playTap();
            }
            saveUserLibState(userState);
            const currentOpenId = lightboxIndex >= 0 ? currentFiltered[lightboxIndex]?.id : null;
            renderFull(manifest);
            if (currentOpenId) {
              lightboxIndex = currentFiltered.findIndex((it) => it.id === currentOpenId);
              renderLightbox(manifest);
            }
            return;
          }

          const favBtn = event.target.closest('[data-toggle-fav]');
          if (favBtn) {
            event.stopPropagation();
            const id = favBtn.dataset.toggleFav;
            if (userState.fav.has(id)) {
              userState.fav.delete(id);
              toast('تمت الإزالة من المفضلة', 'close');
            } else {
              userState.fav.add(id);
              toast('تم الحفظ في المفضلة ✨', 'spark');
            }
            saveUserLibState(userState);
            const currentOpenId = lightboxIndex >= 0 ? currentFiltered[lightboxIndex]?.id : null;
            renderFull(manifest);
            if (currentOpenId) {
              lightboxIndex = currentFiltered.findIndex((it) => it.id === currentOpenId);
              renderLightbox(manifest);
            }
            return;
          }

          const openTarget = event.target.closest('[data-open-idx]');
          if (openTarget) {
            lightboxIndex = Number(openTarget.dataset.openIdx);
            zoomLevel = 1;
            renderLightbox(manifest);
            return;
          }

          const closeBtn = event.target.closest('[data-lb-close]');
          if (closeBtn || event.target.matches('[data-lb-backdrop]')) {
            lightboxIndex = -1;
            zoomLevel = 1;
            renderLightbox(manifest);
            return;
          }

          const navBtn = event.target.closest('[data-lb-nav]');
          if (navBtn) {
            const delta = Number(navBtn.dataset.lbNav);
            const nextIdx = lightboxIndex + delta;
            if (nextIdx >= 0 && nextIdx < currentFiltered.length) {
              lightboxIndex = nextIdx;
              zoomLevel = 1;
              renderLightbox(manifest);
            }
            return;
          }

          const zoomBtn = event.target.closest('[data-lb-zoom]');
          if (zoomBtn) {
            const mode = zoomBtn.dataset.lbZoom;
            if (mode === 'in') zoomLevel = clamp(Number((zoomLevel + 0.25).toFixed(2)), 0.5, 3);
            else if (mode === 'out') zoomLevel = clamp(Number((zoomLevel - 0.25).toFixed(2)), 0.5, 3);
            else zoomLevel = 1;
            updateZoomDOM();
          }
        };

        const onKeyDown = (event) => {
          if (lightboxIndex < 0) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            lightboxIndex = -1;
            renderLightbox(manifest);
          } else if (event.key === 'ArrowLeft') {
            // In RTL Arabic layout, ArrowLeft goes to NEXT card
            if (lightboxIndex < currentFiltered.length - 1) {
              event.preventDefault();
              lightboxIndex += 1;
              zoomLevel = 1;
              renderLightbox(manifest);
            }
          } else if (event.key === 'ArrowRight') {
            if (lightboxIndex > 0) {
              event.preventDefault();
              lightboxIndex -= 1;
              zoomLevel = 1;
              renderLightbox(manifest);
            }
          } else if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomLevel = clamp(Number((zoomLevel + 0.25).toFixed(2)), 0.5, 3);
            updateZoomDOM();
          } else if (event.key === '-') {
            event.preventDefault();
            zoomLevel = clamp(Number((zoomLevel - 0.25).toFixed(2)), 0.5, 3);
            updateZoomDOM();
          }
        };

        container.addEventListener('input', onInput);
        document.addEventListener('click', onClick);
        window.addEventListener('keydown', onKeyDown);

        cleanups.push(() => {
          container.removeEventListener('input', onInput);
          document.removeEventListener('click', onClick);
          window.removeEventListener('keydown', onKeyDown);
          document.getElementById('lib-lightbox-portal')?.remove();
          document.body.style.overflow = '';
        });
      })
      .catch((error) => {
        if (isUnmounted) return;
        container.innerHTML = String(html`
          <div class="empty panel panel-pad">
            <div class="empty-icon">${icon('spark')}</div>
            <h3>تعذر تحميل المكتبة المصورة</h3>
            <p class="muted">${String(error?.message || error)}</p>
          </div>
        `);
      });

    return () => {
      isUnmounted = true;
      cleanups.forEach((fn) => fn());
    };
  },
};
