/**
 * Tiny dependency-free date helpers.
 * All "day math" in LifeLens is local-time and whole-day based,
 * because deadlines are a human concept, not a UTC one.
 */

export const MS_DAY = 86400000;

export function localDateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(baseKey: string, days: number): string {
  const d = new Date(`${baseKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** today = 0, tomorrow = 1, yesterday = -1. null when the key is missing/invalid. */
export function daysUntil(dateKey: string | null | undefined, from: Date = new Date()): number | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const target = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / MS_DAY);
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function isIsoTime(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Normalise 24h time to HH:mm, else null. Out-of-range input is rejected, not clamped. */
export function normTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function format12h(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function humanDate(dateKey: string | null | undefined): string | null {
  if (!dateKey) return null;
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function relativeLabel(dateKey: string | null | undefined): string {
  const d = daysUntil(dateKey);
  if (d === null) return 'No date';
  if (d < 0) return d === -1 ? 'Yesterday' : `${Math.abs(d)} days overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 7) return `in ${d} days`;
  const weeks = Math.round(d / 7);
  return `in ${weeks} week${weeks === 1 ? '' : 's'}`;
}
