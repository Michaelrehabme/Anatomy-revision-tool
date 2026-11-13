/** Shared short-date formatting for admin tables/panels — "26 Aug 2026", or an em dash for unset timestamps. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Same as formatDate but with a time component, for "last active" style fields. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Today", "Yesterday", "4 days ago", then a short date — for "last session" style fields scanned in a list. */
export function formatRelativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Never';
  const then = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Whether `iso` falls within the last `days` days of `now`. */
export function withinDays(iso: string | null | undefined, days: number, now: Date = new Date()): boolean {
  if (!iso) return false;
  return now.getTime() - new Date(iso).getTime() <= days * 86_400_000;
}
