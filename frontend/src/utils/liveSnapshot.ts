// One source of truth for the live-fetch windows (fix #7).
//
// The app fetches "recent live data" in several places, and each one
// silently used its own cap for the same concept — Overview card 25,
// briefing 25/20/20, Insights 50/50/50, search 25/20/20, the
// askAtlasync snapshot 10/10/10 — so the same workspace showed
// different counts on different surfaces and nobody could tell why.
// Every fetch call site takes its limit from here, and every visible
// window label is built from the same numbers, so a cap and its label
// cannot drift apart again.
//
// The windows are deliberately different per surface (a card needs
// fewer rows than an Insights refresh); the point is that the
// difference is stated in one place, not hidden in eight literals.
// The askAtlasync 10/10/10 snapshot lives in the backend
// (forge-app/src/index.js gatherSnapshot) — the frontend only states
// it here so the briefing label can name the cap honestly.
export const LIVE_FETCH_LIMITS = {
  // Individual card defaults: JiraIssuesCard 25, ConfluencePagesCard 20, JsmRequestsCard 20.
  cards: { jira: 25, confluence: 20, jsm: 20 },
  // Overview briefing card teaser (blocker + stale rows).
  teaser: { jira: 25 },
  // Full briefing data behind Overview stats (useBriefingState).
  briefing: { jira: 25, confluence: 20, jsm: 20 },
  // Insights refresh (counts + aging/priority analysis).
  insights: { jira: 50, confluence: 50, jsm: 50 },
  // Per-project counts behind the Projects tiles.
  projects: { jira: 50 },
  // Topbar global live search.
  search: { jira: 25, confluence: 20, jsm: 20 },
  // askAtlasync briefing snapshot (backend cap — stated here, not set here).
  askSnapshot: { jira: 10, confluence: 10, jsm: 10 },
} as const;

export type LiveSnapshotKey = keyof typeof LIVE_FETCH_LIMITS;

// The window line for a surface, e.g. "Latest 25 Jira issues · 20
// Confluence pages · 20 JSM requests". Rendered next to the numbers
// that came from that window, so a count is never shown without the
// fetch that produced it.
export function snapshotDefinitionLine(key: LiveSnapshotKey): string {
  const limits = LIVE_FETCH_LIMITS[key];
  const parts: string[] = [];
  if ('jira' in limits) parts.push(`${limits.jira} Jira issues`);
  if ('confluence' in limits) parts.push(`${limits.confluence} Confluence pages`);
  if ('jsm' in limits) parts.push(`${limits.jsm} JSM requests`);
  return `Latest ${parts.join(' · ')}`;
}
