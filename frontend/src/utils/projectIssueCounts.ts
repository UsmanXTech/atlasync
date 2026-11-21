// Phase 3.2 — per-project issue counts from the bounded live
// snapshot. The backend fetch is windowed (updated in the last 30
// days, max 50 issues) and carries no status filter, so "open" is
// derived here: any status other than Done / Resolved / Closed.
// Blockers are the open Highest / Critical issues. Counts are
// therefore honest snapshot counts, never full project totals — the
// Projects footnote says so.
import type { LiveIssue } from '../data/types';

export interface ProjectIssueCounts {
  open: number;
  blockers: number;
}

const CLOSED_STATUSES = new Set(['done', 'resolved', 'closed']);

export function countIssuesByProject(issues: LiveIssue[]): Map<string, ProjectIssueCounts> {
  const counts = new Map<string, ProjectIssueCounts>();
  for (const issue of issues) {
    const prefix = issue.key.split('-')[0];
    if (prefix === '') continue;
    const entry = counts.get(prefix) ?? { open: 0, blockers: 0 };
    if (!CLOSED_STATUSES.has(issue.status.toLowerCase())) {
      entry.open += 1;
      const priority = (issue.priority ?? '').toLowerCase();
      if (priority === 'highest' || priority === 'critical') entry.blockers += 1;
    }
    counts.set(prefix, entry);
  }
  return counts;
}
