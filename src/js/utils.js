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

/** German speech playback with a graceful fallback when no German voice exists. */
export const speech = {
  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
  germanVoices() {
    if (!this.supported) return [];
    return speechSynthesis.getVoices().filter((v) => /^de/i.test(v.lang));
  },
  allVoices() {
    if (!this.supported) return [];
    return speechSynthesis.getVoices();
  },
  stop() {
    if (this.supported) speechSynthesis.cancel();
  },
  speak(text, { rate = 0.95, voiceName = '' } = {}) {
    if (!this.supported) return Promise.resolve(false);
    speechSynthesis.cancel();
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'de-DE';
      utter.rate = rate;
      const voices = this.germanVoices();
      const chosen = voices.find((v) => v.name === voiceName) || voices[0];
      if (chosen) utter.voice = chosen;
      utter.onend = () => resolve(true);
      utter.onerror = () => resolve(false);
      speechSynthesis.speak(utter);
    });
  },
};
