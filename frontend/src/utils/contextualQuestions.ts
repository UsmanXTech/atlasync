// Contextual "Ask about this" questions (Intelligence-first Phase 2).
// One question per view, in a pure module (no React, no services) so unit
// tests can import it without pulling in the hook's React/services graph —
// the same pattern as intelligencePresets.ts (Run 16).
//
// The question names the view's TOPICS, never its numbers: the Overview
// stats are sample/demo data, and the resolver's system prompt tells the
// LLM to analyze only the supplied live source snapshot and never invent
// facts. Embedding demo counts in the prompt would leak them into the
// answer as if they were live. The LLM answers from the live snapshot
// (10 Jira issues / 10 Confluence pages / 10 JSM requests) it already
// receives server-side; the question only tells it which slice of the
// workspace the user is looking at.
//
// Projects nuance: the snapshot carries no project list — but every Jira
// issue key carries its project prefix, so project-level grouping is
// derivable from the recent-issues slice. The projects question therefore
// asks about "the recent open work" per project, never about the project
// list itself, and the system prompt's state-when-evidence-is-missing rule
// covers the 10-issue bound.
//
// Confluence nuance: the snapshot's Confluence slice carries title + status
// + spaceId only — no updated dates and no page bodies. The confluence
// question therefore asks about page status (archived / drafted / current)
// and cleanup, never about recency or page contents; the card's own
// "Updated …" line comes from the card's separate 20-page fetch, not from
// the ask snapshot.
//
// JSM nuance: the snapshot's JSM slice carries key + summary + status +
// requestType + priority only — no created dates, no requester, no comments
// or request bodies. The jsm question therefore asks about request types,
// statuses, and priorities, never about age/recency, who asked, or what a
// request says beyond its summary; the card's own 20-request fetch is a
// wider list than the 10-request ask snapshot.
export const CONTEXTUAL_QUESTIONS = {
  overview:
    'From this workspace overview — open issues, active blockers, PRs awaiting action, open incidents, and release readiness — what are the top risks right now, and what should we tackle first?',
  projects:
    'From the live Jira projects — looking at the recent open work, which projects carry the most open issues and blockers, and which project needs attention first?',
  confluence:
    'From the live Confluence pages — looking at page status across the workspace, which pages are archived, drafted, or otherwise need attention, and what should we clean up or update first?',
  jsm:
    'From the live JSM requests — looking at request types, statuses, and priorities across the service desk, which requests need attention first, and are any request types piling up?',
} as const;

// The same no-numbers rule governs the per-stat questions below
// (Phase 3.1): a stat click asks about that metric's TOPIC in the
// live snapshot — never the number shown on the tile, which the
// agent cannot see and which may come from a different fetch window
// than the ask snapshot. Sample-mode stats stay inert (no onClick):
// clicking demo numbers into a live agent prompt would leak demo
// data as if it were live.
export const OVERVIEW_STAT_QUESTIONS = {
  openIssues:
    'From this workspace — looking at the currently open Jira issues in the live snapshot, which ones matter most and what should we tackle first?',
  blockers:
    'From this workspace — looking at the active Highest and Critical Jira blockers in the live snapshot, what is blocking delivery and what should we unblock first?',
  stalePrs:
    'From this workspace — looking at the pull requests on critical issues in the live snapshot, which PRs are stale or blocking, and what should move first?',
  incidents:
    'From this workspace — looking at the open Highest and Critical JSM incidents in the live snapshot, which incidents need attention first and what is their impact?',
} as const;

export type OverviewStatKey = keyof typeof OVERVIEW_STAT_QUESTIONS;

export function overviewStatQuestionFor(stat: OverviewStatKey): string {
  return OVERVIEW_STAT_QUESTIONS[stat];
}

export type ContextualView = keyof typeof CONTEXTUAL_QUESTIONS;

export function contextualQuestionFor(view: ContextualView): string {
  return CONTEXTUAL_QUESTIONS[view];
}
