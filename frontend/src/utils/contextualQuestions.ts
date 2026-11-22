// Contextual "Ask about this" questions (Intelligence-first Phase 2).
// One question per view, in a pure module (no React, no services) so unit
// tests can import it without pulling in the hook's React/services graph —
// the same pattern as intelligencePresets.ts (Run 16).
//
// These questions are submitted through the Intelligence AGENT
// (invokeAgent's tool loop), not through askAtlasync. The agent
// receives NO live snapshot server-side — only a readiness score and
// the project list are injected into its system prompt. It answers by
// calling READ TOOLS live, per question. Each question's scope must
// therefore match what the read tools can actually prove — a question
// about evidence no tool returns can only be answered by guessing.
// (An earlier version of this comment claimed the LLM answers from a
// live 10/10/10 snapshot it receives server-side. That is true only
// for askAtlasync's briefing path, never for these questions.)
//
// The question names the view's TOPICS, never its numbers: the
// resolver's system prompt tells the LLM to analyze only what the
// tools return and never invent facts. Embedding displayed counts in
// the prompt would leak them into the answer as if the agent had read
// them. The tools the agent can call:
//   get_jira_blockers — open Highest/Critical Jira issues, with updated
//     dates (so "least recently updated" is provable);
//   get_pr_bottlenecks — open linked Bitbucket PRs on critical issues
//     (name/status/url only — PRs carry no updated date, so PR "staleness"
//     by age is NOT provable; only the issue's recency is);
//   get_jsm_incidents — JSM requests at one priority severity;
//   list_jsm_requests — JSM requests by status/request type, with counts
//     grouped by type and status (so "which type is piling up" is provable);
//   search_confluence_runbooks — Confluence pages matching text, with the
//     spaceId of each hit;
//   list_confluence_pages — Confluence pages in one space (by key) and/or
//     one status, most recently updated first (so per-space status and
//     cleanup questions are provable — this closes the old blind spot
//     where agent evidence was a global top-10 with no space scoping).
//
// Projects nuance: the snapshot carries no project list — but every Jira
// issue key carries its project prefix, so project-level grouping is
// derivable from the recent-issues slice. The projects question therefore
// asks about "the recent open work" per project, never about the project
// list itself, and the system prompt's state-when-evidence-is-missing rule
// covers the 10-issue bound.
//
// Confluence nuance: list_confluence_pages returns id + title + status +
// spaceId + updated per page, most recently updated first; search returns
// text matches with spaceId. The confluence question therefore asks about
// page status (archived / drafted / current) and cleanup — now provable
// per space, not just globally.
//
// JSM nuance: list_jsm_requests returns key + summary + status +
// requestType + priority, plus counts grouped by type and status; the
// jsm question therefore asks about request types, statuses, and
// priorities, never about age/recency, who asked, or what a request
// says beyond its summary. (One honest limit: the JSM list endpoint
// carries requestTypeId only, so the request-type NAME defaults to
// "Service request" when the type object is absent — the status counts
// are the reliable half of the grouping.)
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
// live tool reads — never the number shown on the tile, which the
// agent cannot see and which may come from a different fetch window
// than the ask. Sample-mode stats stay inert (no onClick): clicking
// demo numbers into a live agent prompt would leak demo data as if
// it were live.
export const OVERVIEW_STAT_QUESTIONS = {
  openIssues:
    'From this workspace — looking at the currently open Jira issues, which ones matter most and what should we tackle first?',
  blockers:
    'From this workspace — looking at the active Highest and Critical Jira blockers, what is blocking delivery and what should we unblock first?',
  stalePrs:
    'From this workspace — looking at the open critical issues least recently updated, and the open pull requests on critical issues, which PRs are blocking, and what should move first?',
  incidents:
    'From this workspace — looking at the open Highest and Critical JSM incidents, which incidents need attention first and what is their impact?',
} as const;

export type OverviewStatKey = keyof typeof OVERVIEW_STAT_QUESTIONS;

export function overviewStatQuestionFor(stat: OverviewStatKey): string {
  return OVERVIEW_STAT_QUESTIONS[stat];
}

export type ContextualView = keyof typeof CONTEXTUAL_QUESTIONS;

export function contextualQuestionFor(view: ContextualView): string {
  return CONTEXTUAL_QUESTIONS[view];
}

// Phase 3.2 — per-project ask. The question names the project key and
// tells the agent to say so when the 10-issue snapshot has no
// evidence for it, rather than guessing from the tile counts.
export function questionForProject(projectKey: string): string {
  return `From the live Jira snapshot — looking at project ${projectKey}, what open issues and blockers does it carry, and what needs attention first? If the snapshot has no evidence for this project, say so rather than guessing.`;
}

// Fix #13 — the two navigate-only buttons, given their questions.
// Before this, "Ask Intelligence" and "Full briefing in Intelligence"
// navigated to the view without asking anything, so the user landed on
// an empty composer and had to type the obvious question themselves.
// The wording is the decided question for each button (visual-behaviour
// test fix #13), pinned by the test below.
export const READINESS_QUESTION = 'Are we ready to release?';
export const FULL_BRIEFING_QUESTION =
  "Summarize today's briefing, including readiness, top blockers, and stale work.";
