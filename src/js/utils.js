// Small shared helpers: escaped templating, dates, Arabic counts, speech.

class RawHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value) => new RawHTML(String(value));

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || value === undefined || value === false) {
      out += '';
    } else if (value instanceof RawHTML) {
      out += value.value;
    } else if (Array.isArray(value)) {
      out += value
        .map((item) => (item instanceof RawHTML ? item.value : esc(item)))
        .join('');
    } else {
      out += esc(value);
    }
    out += strings[i + 1] ?? '';
  }
  return new RawHTML(out);
}

export const icon = (name, extra = '') =>
  raw(`<svg class="i ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`);

export const el = (markup) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(markup).trim();
  return tpl.content.firstElementChild;
};

export const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const dayStart = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const addHours = (date, amount) => new Date(date.getTime() + amount * 3600 * 1000);

export const daysBetween = (from, to) => Math.round((dayStart(to) - dayStart(from)) / 86400000);

const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' });

export const dateLabel = (date) => dateFmt.format(date instanceof Date ? date : new Date(date));
export const timeLabel = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatTime12 = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${pad(h)}:${m} ${period}`;
};

export function formatExactDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const diff = daysBetween(new Date(), d);
  const time = formatTime12(d);
  if (diff === 0) return `اليوم — ${time}`;
  if (diff === 1) return `بكرة — ${time}`;
  if (diff === -1) return `أمس — ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} — ${time}`;
}

export function formatCountdown(targetDate) {
  if (!targetDate) return { isDue: false, text: '—', diffMs: 0 };
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (isNaN(target.getTime())) return { isDue: false, text: '—', diffMs: 0 };
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return { isDue: true, text: 'مستحق الآن', diffMs };
  }
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const remMinutes = totalMinutes % 60;

  let text = '';
  if (totalDays > 0) {
    const dText = totalDays === 1 ? 'يوم' : totalDays === 2 ? 'يومين' : `${totalDays} أيام`;
    const hText = remHours > 0 ? ` و ${remHours === 1 ? 'ساعة' : remHours === 2 ? 'ساعتين' : `${remHours} ساعات`}` : '';
    text = `متبقي ${dText}${hText}`;
  } else if (totalHours > 0) {
    const hText = totalHours === 1 ? 'ساعة' : totalHours === 2 ? 'ساعتين' : `${totalHours} ساعات`;
    const mText = remMinutes > 0 ? ` و ${remMinutes === 1 ? 'دقيقة' : remMinutes === 2 ? 'دقيقتين' : `${remMinutes} دقيقة`}` : '';
    text = `متبقي ${hText}${mText}`;
  } else {
    text = remMinutes <= 1 ? 'متبقي أقل من دقيقة' : remMinutes === 2 ? 'متبقي دقيقتين' : `متبقي ${remMinutes} دقيقة`;
  }
  return { isDue: false, text, diffMs, totalMinutes };
}

export function dueLabel(due) {
  if (!due) return '';
  const diff = daysBetween(new Date(), new Date(due));
  if (diff < 0) return `متأخر ${Math.abs(diff)} ${diff === -1 ? 'يوم' : 'يوم'}`;
  if (diff === 0) return 'مستحق النهاردة';
  if (diff === 1) return 'بكرة';
  if (diff <= 10) return `بعد ${diff} أيام`;
  return dateLabel(due);
}

export function relativeWhen(date) {
  if (!date) return '';
  const diff = daysBetween(new Date(), new Date(date));
  if (diff < 0) return `فات ${Math.abs(diff)} يوم`;
  if (diff === 0) return 'النهاردة';
  if (diff === 1) return 'بكرة';
  return `بعد ${diff} أيام`;
}

export function arPlural(n, forms) {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return forms.few;
  return forms.many;
}

export const chunksLabel = (n) => {
  if (n === 1) return 'جملة واحدة';
  if (n === 2) return 'جملتين';
  if (n >= 3 && n <= 10) return `${n} جمل`;
  return `${n} جملة`;
};

export const sentencesLabel = chunksLabel;

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function debounce(fn, wait = 300) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

export const mmss = formatClock;

export const progressPct = (part, total) => (total > 0 ? clamp(Math.round((part / total) * 100), 0, 100) : 0);

/** German speech playback powered natively by Windows Web Speech (speechSynthesis). */
export const speech = {
  _speakNonce: 0,
  _activeUtterance: null,
  _speakTimer: null,

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
  germanVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return speechSynthesis.getVoices().filter((v) => /^de/i.test(v.lang));
    }
    return [];
  },
  allVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return speechSynthesis.getVoices();
    }
    return [];
  },
  stop() {
    this._speakNonce += 1;
    if (this._speakTimer) {
      clearTimeout(this._speakTimer);
      this._speakTimer = null;
    }
    this._activeUtterance = null;
    if (typeof window !== 'undefined') {
      window._activeUtterance = null;
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    }
  },
  async speak(text, { rate = 1.0, voiceName = '', onStart, onEnd } = {}) {
    if (!this.supported || !text || !text.trim()) return Promise.resolve(false);
    this.stop();
    const nonce = this._speakNonce;

    return new Promise((resolve) => {
      this._speakTimer = setTimeout(() => {
        if (this._speakNonce !== nonce) return resolve(false);
        const utter = new SpeechSynthesisUtterance(text.trim());
        this._activeUtterance = utter;
        if (typeof window !== 'undefined') {
          window._activeUtterance = utter;
        }
        utter.lang = 'de-DE';
        utter.rate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));

        const voices = this.germanVoices();
        const chosen = (voiceName && voices.find((v) => v.name === voiceName)) || voices.find((v) => /^de/i.test(v.lang)) || voices[0];
        if (chosen) utter.voice = chosen;

        if (typeof onStart === 'function') {
          utter.onstart = () => {
            if (this._speakNonce === nonce) onStart();
          };
        }

        const finish = (result) => {
          this._activeUtterance = null;
          if (typeof window !== 'undefined') {
            window._activeUtterance = null;
          }
          if (typeof onEnd === 'function') {
            onEnd();
          }
          resolve(result);
        };

        utter.onend = () => finish(true);
        utter.onerror = () => finish(false);
        speechSynthesis.speak(utter);
      }, 40);
    });
  },
};
