// Overlay primitives: toast + accessible light modal.
import { el, html, icon, raw } from './utils.js';

export function toast(message, ico = 'check') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = el(html`<div class="toast">${icon(ico)}<span>${message}</span></div>`);
  root.append(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, 3000);
}

export function openModal(content, options = {}) {
  const backdrop = el(html`
    <div class="modal-backdrop">
      <div class="modal ${options.className || ''}">${content}</div>
    </div>
  `);
  const root = document.getElementById('modal-root');
  root.append(backdrop);
  const previous = document.activeElement;

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') {
      const focusables = [...backdrop.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  function close() {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    options.onClose?.();
    if (previous && typeof previous.focus === 'function') previous.focus();
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    const target = backdrop.querySelector('[data-autofocus]') || backdrop.querySelector('button, input, textarea');
    target?.focus();
  });
  options.onMount?.(backdrop, close);
  return { root: backdrop, close };
}

export function confirmDialog({ title, text, confirm = 'أيوة', cancel = 'إلغاء', danger = false }) {
  return new Promise((resolve) => {
    const modal = openModal(
      html`
        <h3>${title}</h3>
        <p class="sub muted" style="margin-top:4px">${text}</p>
        <div class="modal-actions">
          <button class="btn ${danger ? 'btn-dark' : 'btn-primary'}" data-ok data-autofocus>${confirm}</button>
          <button class="btn btn-ghost" data-cancel>${cancel}</button>
        </div>
      `,
      {
        onMount(root, close) {
          root.querySelector('[data-ok]').addEventListener('click', () => {
            close();
            resolve(true);
          });
          root.querySelector('[data-cancel]').addEventListener('click', () => {
            close();
            resolve(false);
          });
          root.querySelector('.modal-backdrop').addEventListener('click', (event) => {
            if (event.target.classList.contains('modal-backdrop')) resolve(false);
          });
        },
        onClose() {
          resolve(false);
        },
      },
    );
    return modal;
  });
}

export function sectionHead(title, subtitle, action = null) {
  return html`
    <div class="section-head">
      <div>
        <h2>${title}</h2>
        ${subtitle ? html`<p>${subtitle}</p>` : ''}
      </div>
      ${action || ''}
    </div>
  `;
}

export function meters(value, total, cls = '') {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return raw(`<div class="meter ${cls}"><span style="width:${pct}%"></span></div>`);
}
