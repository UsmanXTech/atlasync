// Sidebar "last synced" footer formatting (fix #8). Pure, so the node
// test runner can cover it — the Sidebar itself has no component test
// harness (jsdom is missing, same as the other view components).
//
// The footer used to be a hardcoded literal ("Synced 14:32") — the
// time of nobody's fetch. It now renders the last successful live
// fetch (the briefing load in App) with date + timezone, or the honest
// fallback while nothing has synced yet.
export function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
