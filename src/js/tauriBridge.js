// Seamless Runtime Bridge: exposes `window.chunkAPI` when running inside Rust/Tauri v2
// (or falls back cleanly when running in Electron or Capacitor Android WebView).
(function initRuntimeBridge() {
  if (typeof window === 'undefined') return;
  if (window.chunkAPI) return; // Already provided by Electron preload.cjs

  const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
  if (!tauriInvoke) return; // Plain browser or Capacitor Android uses localStorage + fetch()

  window.chunkAPI = {
    getChunks: async () => {
      const res = await fetch('./data/chunks.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    loadState: () => tauriInvoke('state_load'),
    saveState: (state) => tauriInvoke('state_save', { state }),
    saveStateSync: (state) => {
      try {
        localStorage.setItem('chunk-trainer-state', JSON.stringify(state));
      } catch {}
      tauriInvoke('state_save', { state }).catch(() => {});
      return true;
    },
    exportState: async () => {
      try {
        const res = await tauriInvoke('state_load');
        const blob = new Blob([JSON.stringify(res?.state || {}, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chunk-progress-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    importState: () =>
      new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve({ ok: false, canceled: true });
          try {
            const parsed = JSON.parse(await file.text());
            if (!parsed || typeof parsed !== 'object' || !parsed.chunks) {
              return resolve({ ok: false, error: 'Invalid progress JSON' });
            }
            await tauriInvoke('state_save', { state: parsed });
            resolve({ ok: true, state: parsed });
          } catch (err) {
            resolve({ ok: false, error: String(err) });
          }
        };
        input.click();
      }),
    resetState: () => tauriInvoke('state_reset'),
    openDataFolder: () => tauriInvoke('open_data_folder'),
    focusWindow: () => Promise.resolve(true),
    appInfo: () => tauriInvoke('app_info'),
  };
})();
