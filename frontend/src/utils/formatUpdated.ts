// Shared "last updated" formatting for live-record rows (Jira issues,
// Confluence pages): short locale date + time, the format the rest of
// the dashboard uses. Empty input means "no date known" — callers omit
// the line instead of printing a dash; an unparseable string is shown
// as-is rather than hidden.
export function formatUpdated(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
