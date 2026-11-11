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
export const CONTEXTUAL_QUESTIONS = {
  overview:
    'From this workspace overview — open issues, active blockers, PRs awaiting action, open incidents, and release readiness — what are the top risks right now, and what should we tackle first?',
  projects:
    'From the live Jira projects — looking at the recent open work, which projects carry the most open issues and blockers, and which project needs attention first?',
  confluence:
    'From the live Confluence pages — looking at page status across the workspace, which pages are archived, drafted, or otherwise need attention, and what should we clean up or update first?',
} as const;

export type ContextualView = keyof typeof CONTEXTUAL_QUESTIONS;

export function contextualQuestionFor(view: ContextualView): string {
  return CONTEXTUAL_QUESTIONS[view];
}
