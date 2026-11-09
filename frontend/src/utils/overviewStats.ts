import type { Blocker,Incident,Project,PullRequest,Severity } from '../data/types';

export type StatTone = 'up' | 'down' | 'flat' | 'bad';

export interface StatContext { text: string; tone: StatTone }

export interface OverviewStatContext {
  issues: StatContext;
  blockers: StatContext;
  prs: StatContext;
  incidents: StatContext;
}

const SEVERITY_RANK: Record<Severity,number> = { critical: 0, high: 1, medium: 2, low: 3 };
const INCIDENT_RANK: Record<Incident['severity'],number> = { sev1: 0, sev2: 1, sev3: 2 };

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Derives the context line shown under each Overview stat from the same
 * workspace-filtered sample data the numbers come from — so the subline
 * always explains the number above it, and stays honest when the workspace
 * changes or a list empties out. No hardcoded counts.
 */
export function overviewStatContext(
  projects: Project[],
  blockers: Blocker[],
  awaitingPrs: PullRequest[],
  incidents: Incident[],
): OverviewStatContext {
  const issues: StatContext = projects.length === 0
    ? { text: 'No projects in workspace', tone: 'flat' }
    : { text: `Across ${projects.length} project${projects.length === 1 ? '' : 's'}`, tone: 'flat' };

  let blockersCtx: StatContext;
  if (blockers.length === 0) {
    blockersCtx = { text: 'No active blockers', tone: 'flat' };
  } else {
    const top = [...blockers].sort((a,b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
    const oldest = Math.max(...blockers.map(b => b.ageDays));
    blockersCtx = {
      text: `Highest ${cap(top.severity)} · oldest ${oldest} day${oldest === 1 ? '' : 's'}`,
      tone: top.severity === 'critical' ? 'bad' : 'flat',
    };
  }

  const inReview = awaitingPrs.filter(p => p.status === 'review').length;
  const changes = awaitingPrs.filter(p => p.status === 'changes').length;
  let prsCtx: StatContext;
  if (inReview + changes === 0) {
    prsCtx = { text: 'Nothing awaiting action', tone: 'flat' };
  } else {
    const parts: string[] = [];
    if (inReview > 0) parts.push(`${inReview} in review`);
    if (changes > 0) parts.push(`${changes} changes requested`);
    prsCtx = { text: parts.join(' · '), tone: changes > 0 ? 'bad' : 'flat' };
  }

  const open = incidents.filter(i => i.status !== 'resolved');
  let incidentsCtx: StatContext;
  if (open.length === 0) {
    incidentsCtx = { text: 'No open incidents', tone: 'flat' };
  } else {
    const top = [...open].sort((a,b) => INCIDENT_RANK[a.severity] - INCIDENT_RANK[b.severity])[0];
    const longest = Math.max(...open.map(i => i.minutesOpen));
    incidentsCtx = {
      text: `Highest ${top.severity.toUpperCase()} · ${longest} min open`,
      tone: top.severity === 'sev1' ? 'bad' : 'flat',
    };
  }

  return { issues, blockers: blockersCtx, prs: prsCtx, incidents: incidentsCtx };
}
