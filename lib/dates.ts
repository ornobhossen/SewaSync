import type { Lang, Localized } from './types';

/**
 * Demo "now" is pinned to 15 September 2026, 09:41 MYT. Every due, overdue
 * and relative label in the app is measured from this instant, never from the
 * visitor's wall clock, so the seeded states are stable on any machine.
 */
export const NOW = new Date('2026-09-15T09:41:00+08:00');
export const NOW_ISO = NOW.toISOString();

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_BM = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis',
];

export function parseDate(iso: string): Date {
  return new Date(iso);
}

/** Whole days from `iso` to now. Positive = in the past. */
export function daysSince(iso: string, from: Date = NOW): number {
  const then = parseDate(iso);
  const a = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const b = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/** Days from now until `iso`. Positive = still ahead. */
export function daysUntil(iso: string, from: Date = NOW): number {
  return -daysSince(iso, from);
}

/** "3 Sep" in dense lists, "3 Sep 2026" in records. */
export function formatDate(iso: string, lang: Lang, style: 'short' | 'long' = 'short'): string {
  const date = parseDate(iso);
  const months = lang === 'bm' ? MONTHS_BM : MONTHS_EN;
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  return style === 'long' ? `${day} ${month} ${date.getUTCFullYear()}` : `${day} ${month}`;
}

/** "Aug 2026" / "Ogos 2026" from a '2026-08' period key. */
export function formatPeriod(period: string, lang: Lang): string {
  const [year, month] = period.split('-');
  const months = lang === 'bm' ? MONTHS_BM : MONTHS_EN;
  return `${months[Number(month) - 1]} ${year}`;
}

/** "3 days ago" / "3 hari lalu", "just now" / "baru sahaja". */
export function formatRelative(iso: string, lang: Lang): string {
  const minutes = Math.round((NOW.getTime() - parseDate(iso).getTime()) / 60_000);
  if (minutes < 2) return lang === 'bm' ? 'baru sahaja' : 'just now';
  if (minutes < 60) {
    const n = Math.round(minutes / 5) * 5;
    return lang === 'bm' ? `${n} minit lalu` : `${n} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return lang === 'bm' ? `${hours} jam lalu` : `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = daysSince(iso);
  if (days <= 0) return lang === 'bm' ? 'hari ini' : 'today';
  if (days === 1) return lang === 'bm' ? 'semalam' : 'yesterday';
  if (days < 30) return lang === 'bm' ? `${days} hari lalu` : `${days} days ago`;
  const months = Math.round(days / 30);
  return lang === 'bm' ? `${months} bulan lalu` : `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

export function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = NOW.getUTCHours() + 1; // 09:41 MYT is 01:41 UTC
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function localize(value: Localized, lang: Lang): string {
  return value[lang];
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Date input value (yyyy-mm-dd) for <input type="date">. */
export function dateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function monthInputValue(period: string): string {
  return period;
}

export function nextPeriod(period: string, monthsAhead = 1): string {
  const [year, month] = period.split('-').map(Number);
  const total = (year * 12 + (month - 1)) + monthsAhead;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
