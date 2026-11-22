// Phase 3.3 — aging + priority analysis, derived from the same
// fetches Insights already makes (no backend change, no new calls).
//
// Honesty bounds, stated where the numbers render:
// - Jira has no `created` field in this slice, so Jira "aging" is
//   staleness by `updated` — and the snapshot only covers issues
//   updated in the last 30 days, so anything older is invisible
//   here by construction. True Jira age needs the `created` field
//   (follow-up 3.3b, backend).
// - JSM is the only source with a real `created` date, so only JSM
//   gets true age buckets. Records with an unparseable/missing date
//   are counted as `unknown` and never silently dropped into a
//   bucket.
import type { IssueBucket, LiveIssue, LiveJsmRequest } from '../data/types';

const DAY_MS = 86_400_000;

function daysSince(iso: string, now: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

export function jiraPriorityDistribution(issues: LiveIssue[]): IssueBucket[] {
  const labels = ['Highest', 'High', 'Medium', 'Low', 'No priority'] as const;
  const counts = new Map<string, number>(labels.map((l) => [l, 0]));
  for (const issue of issues) {
    const priority = issue.priority ?? '';
    const label = labels.includes(priority as (typeof labels)[number]) ? priority : 'No priority';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

// Done statuses — the same set the backend treats as closed
// (blockers JQL `status NOT IN (Done, Closed, Resolved)`, readiness).
// Status is the raw Jira name; no normalization exists anywhere.
export function isDoneStatus(status: string | null | undefined): boolean {
  return status === 'Done' || status === 'Closed' || status === 'Resolved';
}

// Fix #7: the priority chart used to count open + closed together, so
// its Highest count (2) disagreed with the briefing's open-only
// Highest (1) and nobody could tell why. Same buckets, split by
// status — the open column is what the briefing counts.
export function jiraPriorityDistributionByStatus(issues: LiveIssue[]): { open: IssueBucket[]; done: IssueBucket[] } {
  const labels = ['Highest', 'High', 'Medium', 'Low', 'No priority'] as const;
  const open = new Map<string, number>(labels.map((l) => [l, 0]));
  const done = new Map<string, number>(labels.map((l) => [l, 0]));
  for (const issue of issues) {
    const priority = issue.priority ?? '';
    const label = labels.includes(priority as (typeof labels)[number]) ? priority : 'No priority';
    const bucket = isDoneStatus(issue.status) ? done : open;
    bucket.set(label, (bucket.get(label) ?? 0) + 1);
  }
  const toBuckets = (counts: Map<string, number>): IssueBucket[] =>
    labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
  return { open: toBuckets(open), done: toBuckets(done) };
}

export function jsmAgeBuckets(requests: LiveJsmRequest[], now: number): { buckets: IssueBucket[]; unknown: number } {
  const labels = ['0–7 days', '8–30 days', '31–90 days', '90+ days'] as const;
  const counts = new Map<string, number>(labels.map((l) => [l, 0]));
  let unknown = 0;
  for (const request of requests) {
    const days = daysSince(request.created, now);
    if (days === null) {
      unknown += 1;
      continue;
    }
    const label = days <= 7 ? labels[0] : days <= 30 ? labels[1] : days <= 90 ? labels[2] : labels[3];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { buckets: labels.map((label) => ({ label, count: counts.get(label) ?? 0 })), unknown };
}

export function jiraStaleness(issues: LiveIssue[], now: number): { last7: number; last30: number; unknown: number } {
  let last7 = 0;
  let last30 = 0;
  let unknown = 0;
  for (const issue of issues) {
    const days = daysSince(issue.updated, now);
    if (days === null) {
      unknown += 1;
      continue;
    }
    if (days <= 7) last7 += 1;
    if (days <= 30) last30 += 1;
  }
  return { last7, last30, unknown };
}
