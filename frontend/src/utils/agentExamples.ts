import { INTELLIGENCE_PRESETS } from './intelligencePresets.ts';

// Agents view "Try it" examples (Run 16, main 1fe8454): the Agents view
// told the user what Release Intelligence can do but gave no way to try
// it except a bare "Open Intelligence" button — recognition over recall
// (Nielsen H6) says show the questions, don't make the user recall them.
// Each example is one of the Intelligence presets (single source of
// truth) plus a one-line blurb saying what the answer covers, so the
// user knows what they get before tapping. Tapping asks Intelligence
// right away (one-tap send — the top chat pattern Run 10 noted for the
// Intelligence presets themselves).
export interface AgentExample {
  question: string;
  blurb: string;
}

const BLURBS: Record<string, string> = {
  'Are we ready to release?': 'Readiness estimate from the live Jira snapshot.',
  'What are the biggest risks?': 'Highest-priority open risks across Jira, Confluence and JSM.',
  'Summarize recent cross-tool activity.': 'A short summary of the latest records from connected tools.',
};

export const AGENT_EXAMPLES: AgentExample[] = INTELLIGENCE_PRESETS.map((question) => ({
  question,
  blurb: BLURBS[question] ?? 'Ask Release Intelligence about the connected tools.',
}));
