// Background Review Notification & Chime Scheduler
import { store, SR_INTERVALS } from './store.js';
import { audioEngine } from './audioEngine.js';

class ReviewScheduler {
  constructor() {
    this.intervalId = null;
    this.started = false;
    this._lastCheckMs = 0;
  }

  init() {
    if (this.started) return;
    this.started = true;

    // Check immediately shortly after app boot
    setTimeout(() => this.checkDueNotifications(), 2500);

    // Periodically check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkDueNotifications();
    }, 30000);

    // Also check on tab/window focus and visibilitychange (with 2000ms guard)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.checkDueNotifications());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.checkDueNotifications();
      });
    }
  }

  async requestPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  checkDueNotifications() {
    const now = Date.now();
    // Guard: Prevent double-firing within 2000ms (e.g. focus + visibilitychange)
    if (now - this._lastCheckMs < 2000) return;
    this._lastCheckMs = now;

    if (!store.loaded) return;
    const settings = store.state.settings || {};
    if (settings.notificationsEnabled === false) return;

    const dueList = [];

    for (const [id, rec] of Object.entries(store.state.chunks)) {
      if (!rec || !rec.srSchedule) continue;
      const sch = rec.srSchedule;
      if (!sch.nextReviewAt) continue;

      const dueMs = new Date(sch.nextReviewAt).getTime();
      if (now >= dueMs && sch.notifiedStage !== sch.currentStage) {
        const chunk = store.chunk(id);
        if (!chunk) continue;

        const stageInfo = SR_INTERVALS.find((i) => i.stage === sch.currentStage) || {
          label: `المرحلة ${sch.currentStage}`,
        };

        dueList.push({
          chunkId: id,
          chunkDe: chunk.de,
          chunkAr: chunk.ar,
          stageName: stageInfo.label,
          sch,
        });
      }
    }

    if (dueList.length > 0) {
      // Mark notifiedStage on all due items to prevent repeated alerts
      for (const item of dueList) {
        item.sch.notifiedStage = item.sch.currentStage;
      }

      if (dueList.length === 1) {
        this.fireNotification({
          chunkId: dueList[0].chunkId,
          chunkDe: dueList[0].chunkDe,
          chunkAr: dueList[0].chunkAr,
          stageName: dueList[0].stageName,
        });
      } else {
        this.fireConsolidatedNotification({
          count: dueList.length,
          firstChunkDe: dueList[0].chunkDe,
        });
      }

      if (settings.reviewChimeEnabled !== false) {
        audioEngine.playReviewChime();
      }
      store.touch();
    }
  }

  fireNotification({ chunkId, chunkDe, chunkAr, stageName }) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    try {
      const title = 'حان وقت المراجعة — دفتر تشانكس';
      const body = `موعد [${stageName}] لجملة: "${chunkDe}"`;
      const notif = new Notification(title, {
        body,
        icon: './assets/icon.png',
        silent: true, // OS alert is silent so custom chime plays
      });

      notif.onclick = () => {
        try {
          window.focus?.();
          if (window.chunkAPI?.focusWindow) {
            window.chunkAPI.focusWindow();
          }
        } catch {}
        if (chunkId) {
          location.hash = `#/review?chunkId=${encodeURIComponent(chunkId)}`;
        } else {
          location.hash = '#/review';
        }
      };
    } catch (e) {
      console.warn('Could not fire Notification:', e);
    }
  }

  fireConsolidatedNotification({ count, firstChunkDe }) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    try {
      const title = 'حان وقت المراجعة — دفتر تشانكس';
      const body = `لديك ${count} جمل مستحقة للمراجعة الآن — أولها: "${firstChunkDe}"`;
      const notif = new Notification(title, {
        body,
        icon: './assets/icon.png',
        silent: true,
      });

      notif.onclick = () => {
        try {
          window.focus?.();
          if (window.chunkAPI?.focusWindow) {
            window.chunkAPI.focusWindow();
          }
        } catch {}
        location.hash = '#/review';
      };
    } catch (e) {
      console.warn('Could not fire Consolidated Notification:', e);
    }
  }

  async testNotificationAndChime() {
    const perm = await this.requestPermission();
    // Play gentle chime
    audioEngine.playReviewChime(true);

    if (perm && typeof Notification !== 'undefined') {
      try {
        const notif = new Notification('حان وقت المراجعة — دفتر تشانكس', {
          body: 'تجربة الإشعار: موعد المرحلة 1 (بعد عدة ساعات) لجملة: "Ich habe vor, Deutsch zu lernen"',
          icon: './assets/icon.png',
          silent: true,
        });
        notif.onclick = () => {
          try {
            window.focus?.();
            if (window.chunkAPI?.focusWindow) {
              window.chunkAPI.focusWindow();
            }
          } catch {}
          location.hash = '#/review';
        };
      } catch (e) {
        console.warn('Test notification failed:', e);
      }
    }
    return true;
  }
}

export const reviewScheduler = new ReviewScheduler();
