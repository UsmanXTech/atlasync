import type { LiveIssue } from '../data/types';
import { computeReadiness, type ReadinessResult } from './readiness';

const DONE = new Set(['done', 'closed', 'resolved', 'complete', 'completed', 'cancelled', 'canceled']);
const PRIORITY: Record<string, number> = { highest: 5, critical: 5, blocker: 5, high: 4, major: 4, medium: 3, normal: 3, low: 2, minor: 2, lowest: 1 };

export interface BriefingItem {
  key: string;
  summary: string;
  status: string;
  priority: string | null;
  updated: string;
  ageDays: number | null;
}

export interface BriefingDigest {
  readiness: ReadinessResult | null;
  blockers: BriefingItem[];
  staleItems: BriefingItem[];
  totalOpen: number;
}

/** Rules-only digest over the bounded live Jira snapshot. No model/API calls. */
export function computeBriefingDigest(issues: LiveIssue[], now = new Date()): BriefingDigest {
  const open = issues.filter((issue) => !DONE.has(issue.status.trim().toLowerCase()));
  const toItem = (issue: LiveIssue): BriefingItem => {
    const updatedAt = Date.parse(issue.updated);
    const ageDays = Number.isFinite(updatedAt) ? Math.max(0, Math.floor((now.getTime() - updatedAt) / 86_400_000)) : null;
    return { key: issue.key, summary: issue.summary, status: issue.status, priority: issue.priority, updated: issue.updated, ageDays };
  };
  const priority = (value: string | null) => PRIORITY[(value ?? '').trim().toLowerCase()] ?? 0;
  const blockers = [...open]
    .filter((issue) => priority(issue.priority) >= PRIORITY.high)
    .sort((a, b) => priority(b.priority) - priority(a.priority) || Date.parse(a.updated) - Date.parse(b.updated))
    .slice(0, 5)
    .map(toItem);
  const staleItems = [...open]
    .sort((a, b) => {
      const aDate = Date.parse(a.updated), bDate = Date.parse(b.updated);
      if (!Number.isFinite(aDate)) return Number.isFinite(bDate) ? -1 : 0;
      if (!Number.isFinite(bDate)) return 1;
      return aDate - bDate;
    })
    .slice(0, 5)
    .map(toItem);
  return { readiness: computeReadiness(issues), blockers, staleItems, totalOpen: open.length };
}
