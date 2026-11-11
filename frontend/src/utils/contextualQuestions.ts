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
export const CONTEXTUAL_QUESTIONS = {
  overview:
    'From this workspace overview — open issues, active blockers, PRs awaiting action, open incidents, and release readiness — what are the top risks right now, and what should we tackle first?',
} as const;

export type ContextualView = keyof typeof CONTEXTUAL_QUESTIONS;

export function contextualQuestionFor(view: ContextualView): string {
  return CONTEXTUAL_QUESTIONS[view];
}
