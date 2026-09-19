import type { Priority } from '@lifelens/shared';
import { daysUntil, priorityRank } from '@lifelens/shared';

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function formatDate(dateKey: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateKey) return 'No date';
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateLong(dateKey: string | null | undefined): string {
  return formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "Due tomorrow", "in 3 days", "Overdue by 2 days" — the copy users actually read. */
export function dueCopy(dateKey: string | null | undefined, time?: string | null): string {
  const d = daysUntil(dateKey);
  if (d === null) return 'No date set';
  const at = time ? ` at ${formatTime(time)}` : '';
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return `Due today${at}`;
  if (d === 1) return `Due tomorrow${at}`;
  if (d < 7) return `Due in ${d} days${at}`;
  return `Due ${formatDate(dateKey)}${at}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export const PRIORITY_ORDER: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];

export function sortByUrgency<T extends { dueDate?: string | null; priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = daysUntil(a.dueDate ?? null);
    const db = daysUntil(b.dueDate ?? null);
    if (da === null && db === null) return priorityRank(b.priority) - priorityRank(a.priority);
    if (da === null) return 1;
    if (db === null) return -1;
    if (da !== db) return da - db;
    return priorityRank(b.priority) - priorityRank(a.priority);
  });
}
