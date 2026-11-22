// Optional LLM one-line summary for the Overview briefing card
// (Intelligence-first Phase 3, slice 2). The rules-based teaser rows
// stay the card's default — the summary is a second, user-initiated
// layer (progressive disclosure: the answer first, on tap; never an
// LLM call on load). Forge LLM is metered, so one tap is exactly one
// call, and a tap while a summary is already loading is ignored.
//
// The question names only what the ask snapshot carries (verified
// against forge-app/src/index.js askAtlasync): 10 Jira issues
// (key/summary/status/priority), 10 Confluence pages
// (title/status/spaceId), 10 JSM requests
// (key/summary/status/requestType/priority). It never asks about age
// or staleness — the snapshot carries no updated dates, so no item's
// age is knowable to the model — and never about owners, dates, PRs
// or incidents, which the snapshot does not contain either. The
// resolver's system prompt already forbids inventing those; the
// question stays inside the evidence so it cannot drift outside it.
//
// The summary is card-local on purpose: it does not touch the shared
// Intelligence conversation, so tapping Summarize never wipes an
// analysis the user is running in the Intelligence view. The cost is
// that leaving Overview discards the summary (same as the card's live
// lists, which reload on mount) — one more tap re-fetches it.
export const BRIEFING_SUMMARY_QUESTION =
  'In exactly one sentence, what needs attention most today across Jira, Confluence and JSM, and why? Base it only on the live snapshot.';

// The snapshot the summary is answered from, as the resolver builds
// it — stated next to the summary so the one-line answer never looks
// more comprehensive than it is.
//
// Fix #7: this used to be a hardcoded '10 Jira issues · 10 Confluence
// pages · 10 JSM requests' — the resolver's CAP, stated as if it were
// the count. askAtlasync returns the REAL counts (fewer when the
// workspace holds fewer records — e.g. 9 Jira · 10 Confluence ·
// 1 JSM), so the label is built from those. Without sources (an older
// response shape) it falls back to the honest cap wording.
export function briefingSummarySnapshotLabel(
  sources?: { jiraIssues: number; confluencePages: number; jsmRequests: number } | null,
): string {
  if (!sources) return 'up to 10 per source';
  return `answered from ${sources.jiraIssues} Jira · ${sources.confluencePages} Confluence · ${sources.jsmRequests} JSM`;
}
