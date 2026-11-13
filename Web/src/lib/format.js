const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const numFmt = new Intl.NumberFormat('en-IN');

/** API DateOnly "yyyy-MM-dd" → local Date at midnight. */
export function parseDateOnly(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateOnly(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const asDate = (v) => (v instanceof Date ? v : typeof v === 'string' && v.length === 10 ? parseDateOnly(v) : new Date(v));

export const fmt = {
  date: (v) => (v ? dateFmt.format(asDate(v)) : '—'),
  dayMonth: (v) => dayMonth.format(asDate(v)),
  time: (v) => timeFmt.format(asDate(v)),
  dateTime: (v) => (v ? `${dateFmt.format(asDate(v))}, ${timeFmt.format(asDate(v))}` : '—'),
  num: (n) => numFmt.format(n ?? 0),
  dateNum(v) {
    const d = asDate(v);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  },
  /** "12–15 Nov" or "28 Nov – 02 Dec" */
  rangeShort(a, b) {
    const x = asDate(a); const y = asDate(b);
    if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) {
      return x.getDate() === y.getDate() ? dayMonth.format(x) : `${x.getDate()}–${y.getDate()} ${monthFmt.format(y)}`;
    }
    return `${dayMonth.format(x)} – ${dayMonth.format(y)}`;
  },
  rangeLong: (a, b) => `${fmt.dateNum(a)} to ${fmt.dateNum(b)}`,
  relative(v) {
    const d = new Date(v);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    const t = today();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === t.getTime()) return `Today, ${timeFmt.format(d)}`;
    if (day.getTime() === addDays(t, -1).getTime()) return `Yesterday, ${timeFmt.format(d)}`;
    return fmt.dateTime(d);
  },
  mobile: (m) => (m && m.length === 10 ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : m || '—'),
  fileSize(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  },
  initials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },
  hour(h) {
    if (h === null || h === undefined) return '—';
    const s = h % 12 === 0 ? 12 : h % 12;
    return `${s} ${h < 12 ? 'AM' : 'PM'}`;
  },
  greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  },
};

export const sourceLabel = (s) => ({ App: 'App', QrCode: 'QR scan', Link: 'Link' }[s] || s);

export const validators = {
  normalizeMobile(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d;
  },
  isMobile: (v) => /^[6-9]\d{9}$/.test(validators.normalizeMobile(v)),
  isEmail: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(v).trim()),
  isNumber: (v) => String(v).trim() !== '' && !Number.isNaN(Number(v)),
};

/** Form status → badge class + label. */
export function formState(f) {
  if (f.status === 'Draft') return { cls: 'b-draft', label: 'Draft' };
  if (f.isLive) return { cls: 'b-live', label: 'Live' };
  if (f.isUpcoming) return { cls: 'b-upcoming', label: 'Upcoming' };
  return { cls: 'b-expired', label: 'Expired' };
}

/** Copy text, falling back to a hidden textarea. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
