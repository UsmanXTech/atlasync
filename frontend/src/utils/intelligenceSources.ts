// Source coverage for Intelligence answers (frontend/src/utils).
// Pure functions — the hook owns the state, this module owns the
// arithmetic, so the fallback rules are unit-testable.
//
// Two sources of truth exist for coverage: the tool results
// themselves (sourceCounts — rows each read tool returned) and the
// citations (the records the answer links). Counts win when they
// carry signal; citations are the fallback. The fallback matters:
// a non-null ALL-ZERO count object used to shadow real citations
// (live review 2026-11-22: the direct "What are the current
// blockers?" ask cited AT-1/AT-2 yet coverage showed 0 records,
// because an all-zero sourceCounts object beat the citations).
import { toCitations, toSourceCounts, type Citation, type SourceCounts } from '../services/agent.ts';
import type { IntelligenceSources } from '../services/intelligence.ts';

export function sourcesFromCitations(citations: Citation[]): IntelligenceSources {
  return {
    jiraIssues: citations.filter((c) => c.kind === 'jira').length,
    confluencePages: citations.filter((c) => c.kind === 'confluence').length,
    jsmRequests: citations.filter((c) => c.kind === 'jsm').length,
    // Bitbucket rows used to have no bucket at all, so their coverage
    // was silently dropped even when the answer linked PRs.
    bitbucketPullRequests: citations.filter((c) => c.kind === 'bitbucket').length,
    unavailable: [],
  };
}

// Coverage from the tool results themselves (loop.js sourceCounts):
// rows each read tool actually returned. Citations stay the Sources
// link list only — they are capped at 10 and miss tools that returned
// rows without a citable record.
export function sourcesFromCounts(counts: SourceCounts): IntelligenceSources {
  return {
    jiraIssues: counts.jira,
    confluencePages: counts.confluence,
    jsmRequests: counts.jsm,
    bitbucketPullRequests: counts.bitbucket,
    unavailable: [],
  };
}

function totalCounts(counts: SourceCounts): number {
  return counts.jira + counts.confluence + counts.jsm + counts.bitbucket;
}

export function sourcesForAnswer(citations: Citation[], sourceCounts: SourceCounts | null): IntelligenceSources {
  // A non-null all-zero count object carries no signal — fall back to
  // the citations the answer actually links instead of reporting 0.
  if (sourceCounts && totalCounts(sourceCounts) > 0) return sourcesFromCounts(sourceCounts);
  return sourcesFromCitations(citations);
}

// A restored turn keeps the coverage stored with it when present;
// older turns (no sourceCounts) fall back to counting citations —
// and so do turns whose stored counts are all zero.
export function sourcesForTurn(turn: { citations?: Citation[]; sourceCounts?: unknown }): IntelligenceSources {
  const counts = toSourceCounts(turn.sourceCounts);
  if (counts && totalCounts(counts) > 0) return sourcesFromCounts(counts);
  return sourcesFromCitations(toCitations(turn.citations ?? []));
}
