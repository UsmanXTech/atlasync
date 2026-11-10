// The Intelligence preset questions, in one pure module (no React,
// no services) so unit tests can import them without pulling in the
// hook's React/services graph. The hook and the Agents "Try it"
// examples both read from here — one source of truth.
export const INTELLIGENCE_PRESETS = [
  'Are we ready to release?',
  'What are the biggest risks?',
  'Summarize recent cross-tool activity.',
];
