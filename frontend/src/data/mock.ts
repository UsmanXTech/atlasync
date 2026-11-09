// Mock data layer — every record below is SAMPLE data for the dashboard
// demo. Nothing here comes from a live Atlassian tool, and no integration
// is implemented yet. Views filter and derive from these arrays; they do
// not hardcode numbers, so workspace switches and filters change the UI.
import type {
  ActivityItem,
  Agent,
  AiResponse,
  Blocker,
  DocActivity,
  Incident,
  InsightPoint,
  Integration,
  IssueBucket,
  LiveIssue,
  NotificationItem,
  Project,
  PullRequest,
  Workspace,
} from './types';

export const WORKSPACES: Workspace[] = [
  { id: 'hq', name: 'Atlasync HQ', plan: 'Enterprise' },
  { id: 'platform', name: 'Platform', plan: 'Enterprise' },
];

export const PROJECTS: Project[] = [
  { id: 'p1', key: 'ATLAS', name: 'Atlas v2', workspace: 'hq', owner: 'Sara Khan', health: 'at-risk', progress: 78, openIssues: 34, blockers: 3, nextMilestone: 'Release candidate', updatedDaysAgo: 0 },
  { id: 'p2', key: 'SYNC', name: 'Sync Engine', workspace: 'hq', owner: 'Omar Farooq', health: 'healthy', progress: 86, openIssues: 18, blockers: 0, nextMilestone: 'v1.4 rollout', updatedDaysAgo: 0 },
  { id: 'p3', key: 'MOB', name: 'Mobile Companion', workspace: 'platform', owner: 'Ali Raza', health: 'blocked', progress: 52, openIssues: 27, blockers: 2, nextMilestone: 'Beta review', updatedDaysAgo: 1 },
  { id: 'p4', key: 'DOCS', name: 'Docs Revamp', workspace: 'platform', owner: 'Mira Shah', health: 'healthy', progress: 91, openIssues: 9, blockers: 0, nextMilestone: 'Launch', updatedDaysAgo: 1 },
  { id: 'p5', key: 'ONB', name: 'Onboarding Flow', workspace: 'hq', owner: 'Sara Khan', health: 'healthy', progress: 64, openIssues: 15, blockers: 0, nextMilestone: 'User testing', updatedDaysAgo: 2 },
];

export const ISSUES_BY_STATUS: IssueBucket[] = [
  { label: 'To do', count: 28 },
  { label: 'In progress', count: 41 },
  { label: 'In review', count: 19 },
  { label: 'Done', count: 63 },
];

export const ISSUES_BY_PRIORITY: IssueBucket[] = [
  { label: 'Blocker', count: 5 },
  { label: 'Critical', count: 11 },
  { label: 'Major', count: 38 },
  { label: 'Minor', count: 49 },
];

export const BLOCKERS: Blocker[] = [
  { id: 'b1', key: 'ATLAS-482', title: 'Checkout timeout under load', workspace: 'hq', severity: 'critical', owner: 'Sara Khan', blockedBy: 'Payments API latency spike', ageDays: 4 },
  { id: 'b2', key: 'ATLAS-491', title: 'Cart totals refactor blocked on API contract', workspace: 'hq', severity: 'high', owner: 'Omar Farooq', blockedBy: 'API contract sign-off', ageDays: 6 },
  { id: 'b3', key: 'MOB-118', title: 'Push gateway certificate expiry', workspace: 'platform', severity: 'critical', owner: 'Ali Raza', blockedBy: 'Vendor renewal', ageDays: 2 },
  { id: 'b4', key: 'MOB-121', title: 'Offline sync conflict resolution', workspace: 'platform', severity: 'medium', owner: 'Ali Raza', blockedBy: 'Sync Engine v1.4', ageDays: 9 },
  { id: 'b5', key: 'SYNC-77', title: 'Retry logic for payment webhook', workspace: 'hq', severity: 'high', owner: 'Omar Farooq', blockedBy: 'Webhook provider review', ageDays: 3 },
];

export const DOCS: DocActivity[] = [
  { id: 'd1', title: 'Release Runbook v2', space: 'Engineering', workspace: 'hq', editor: 'Sara Khan', edits: 14, daysAgo: 0 },
  { id: 'd2', title: 'Payments API Contract', space: 'API', workspace: 'hq', editor: 'Omar Farooq', edits: 9, daysAgo: 0 },
  { id: 'd3', title: 'Incident Response Guide', space: 'Operations', workspace: 'platform', editor: 'Mira Shah', edits: 6, daysAgo: 1 },
  { id: 'd4', title: 'Mobile Beta Test Plan', space: 'Product', workspace: 'platform', editor: 'Ali Raza', edits: 11, daysAgo: 1 },
  { id: 'd5', title: 'Onboarding Copy Draft', space: 'Product', workspace: 'hq', editor: 'Mira Shah', edits: 4, daysAgo: 2 },
];

export const PULL_REQUESTS: PullRequest[] = [
  { id: 'pr1', title: 'Retry logic for payment webhook', repo: 'atlasync/api', workspace: 'hq', author: 'Omar Farooq', status: 'review', checks: 'pass', daysAgo: 0 },
  { id: 'pr2', title: 'Cart totals refactor', repo: 'atlasync/web', workspace: 'hq', author: 'Sara Khan', status: 'changes', checks: 'fail', daysAgo: 0 },
  { id: 'pr3', title: 'Add Apple Pay checkout', repo: 'atlasync/web', workspace: 'hq', author: 'Ali Raza', status: 'review', checks: 'pending', daysAgo: 1 },
  { id: 'pr4', title: 'Sync engine backoff policy', repo: 'atlasync/sync', workspace: 'platform', author: 'Omar Farooq', status: 'approved', checks: 'pass', daysAgo: 1 },
  { id: 'pr5', title: 'Offline queue persistence', repo: 'atlasync/mobile', workspace: 'platform', author: 'Ali Raza', status: 'review', checks: 'pass', daysAgo: 2 },
  { id: 'pr6', title: 'Docs search indexing', repo: 'atlasync/docs', workspace: 'platform', author: 'Mira Shah', status: 'merged', checks: 'pass', daysAgo: 2 },
];

export const INCIDENTS: Incident[] = [
  { id: 'i1', title: 'Payments API latency spike', service: 'payments', workspace: 'hq', severity: 'sev1', status: 'investigating', minutesOpen: 145 },
  { id: 'i2', title: 'Search index lag', service: 'search', workspace: 'platform', severity: 'sev3', status: 'open', minutesOpen: 320 },
  { id: 'i3', title: 'Webhook delivery delays', service: 'webhooks', workspace: 'hq', severity: 'sev2', status: 'open', minutesOpen: 95 },
  { id: 'i4', title: 'Cache stampede on product pages', service: 'web', workspace: 'hq', severity: 'sev3', status: 'resolved', minutesOpen: 0 },
];

export const ACTIVITY: ActivityItem[] = [
  { id: 'a1', kind: 'jira', title: 'ATLAS-482 moved to In Progress', detail: 'Checkout timeout under load', actor: 'Sara Khan', workspace: 'hq', daysAgo: 0 },
  { id: 'a2', kind: 'bitbucket', title: 'PR opened: Retry logic for payment webhook', detail: 'atlasync/api · checks passing', actor: 'Omar Farooq', workspace: 'hq', daysAgo: 0 },
  { id: 'a3', kind: 'confluence', title: 'Release Runbook v2 updated', detail: '14 edits in Engineering space', actor: 'Sara Khan', workspace: 'hq', daysAgo: 0 },
  { id: 'a4', kind: 'jsm', title: 'INC-91 opened: Payments API latency spike', detail: 'Sev1 · payments service', actor: 'On-call', workspace: 'hq', daysAgo: 0 },
  { id: 'a5', kind: 'ai', title: 'Readiness summary generated', detail: 'Atlas v2 · 72% ready', actor: 'Atlasync AI', workspace: 'hq', daysAgo: 0 },
  { id: 'a6', kind: 'jira', title: 'MOB-118 flagged as blocker', detail: 'Push gateway certificate expiry', actor: 'Ali Raza', workspace: 'platform', daysAgo: 1 },
  { id: 'a7', kind: 'bitbucket', title: 'PR merged: Docs search indexing', detail: 'atlasync/docs · all checks green', actor: 'Mira Shah', workspace: 'platform', daysAgo: 2 },
  { id: 'a8', kind: 'confluence', title: 'Incident Response Guide published', detail: 'Operations space', actor: 'Mira Shah', workspace: 'platform', daysAgo: 2 },
];

export const AGENTS: Agent[] = [
  { id: 'ag1', name: 'Release Readiness', description: 'Scores every release from blockers, incidents, PR health, and change volume.', capability: 'Readiness scoring · risk summary', enabled: true, lastRun: '12 min ago', runsThisWeek: 34 },
  { id: 'ag2', name: 'Triage Assistant', description: 'Routes new issues to the right owner and flags duplicates.', capability: 'Issue triage · routing', enabled: true, lastRun: '26 min ago', runsThisWeek: 58 },
  { id: 'ag3', name: 'Docs Gardener', description: 'Finds stale pages and drafts refresh suggestions for owners.', capability: 'Stale docs · refresh drafts', enabled: false, lastRun: '3 days ago', runsThisWeek: 6 },
  { id: 'ag4', name: 'Incident Scribe', description: 'Drafts timelines and post-incident summaries from the event log.', capability: 'Timelines · summaries', enabled: true, lastRun: '1 hr ago', runsThisWeek: 12 },
];

export const INTEGRATIONS: Integration[] = [
  { id: 'in1', tool: 'Jira', connected: true, lastSync: '4 min ago', itemsSynced: 12480, note: 'Issues, sprints, and releases' },
  { id: 'in2', tool: 'Confluence', connected: true, lastSync: '11 min ago', itemsSynced: 3210, note: 'Spaces, pages, and comments' },
  { id: 'in3', tool: 'Bitbucket', connected: true, lastSync: '7 min ago', itemsSynced: 8640, note: 'Repos, PRs, and build statuses' },
  { id: 'in4', tool: 'Jira Service Management', connected: false, lastSync: 'Never', itemsSynced: 0, note: 'Incidents and service requests' },
];

export const NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: 'Sev1 incident opened', detail: 'Payments API latency spike · INC-91', daysAgo: 0, unread: true },
  { id: 'n2', title: 'PR needs review', detail: 'Retry logic for payment webhook · Omar Farooq', daysAgo: 0, unread: true },
  { id: 'n3', title: 'Blocker age warning', detail: 'ATLAS-491 open for 6 days', daysAgo: 1, unread: true },
  { id: 'n4', title: 'Weekly sync digest ready', detail: '1,204 items synced across 3 tools', daysAgo: 2, unread: false },
];

export const AI_RESPONSES: AiResponse[] = [
  {
    prompt: 'Are we ready to release Atlas v2?',
    readiness: 72,
    verdict: 'Not yet — close, but two critical items stand in the way.',
    summary:
      'Atlas v2 is 78% through its milestone with most work complete, but an open Sev1 incident on payments and one unresolved critical blocker keep it below the release bar. PR health is the weakest signal: one failing build and one unreviewed change touch the checkout path.',
    blockers: [
      'ATLAS-482 — Checkout timeout under load (critical, 4 days open)',
      'INC-91 — Payments API latency spike (Sev1, investigating)',
    ],
    risks: [
      'Checkout path is touched by both the open blocker and the failing PR — a release now risks payment failures at peak traffic.',
      'The latency spike has no confirmed root cause yet; its 145-minute age is above the team’s 60-minute triage target.',
    ],
    issues: ['ATLAS-482', 'ATLAS-491', 'INC-91', 'PR: Cart totals refactor'],
    actions: [
      { title: 'Resolve ATLAS-482 or de-scope checkout changes', owner: 'Sara Khan', due: 'Today' },
      { title: 'Confirm root cause for INC-91 with on-call', owner: 'On-call', due: 'Today' },
      { title: 'Fix the failing build on Cart totals refactor', owner: 'Sara Khan', due: 'Tomorrow' },
    ],
  },
  {
    prompt: 'What is blocking the Mobile Companion beta?',
    readiness: 52,
    verdict: 'Blocked — the beta cannot start until the push gateway is renewed.',
    summary:
      'Mobile Companion sits at 52% with two open blockers. The push gateway certificate expires before the beta window, and offline sync conflicts still need the Sync Engine v1.4 rollout.',
    blockers: [
      'MOB-118 — Push gateway certificate expiry (critical, 2 days open)',
      'MOB-121 — Offline sync conflict resolution (medium, 9 days open)',
    ],
    risks: [
      'If the vendor renewal slips, push notifications fail for the entire beta cohort.',
      'Offline conflicts compound the longer v1.4 is delayed.',
    ],
    issues: ['MOB-118', 'MOB-121', 'SYNC v1.4 rollout'],
    actions: [
      { title: 'Escalate the vendor renewal today', owner: 'Ali Raza', due: 'Today' },
      { title: 'Confirm Sync Engine v1.4 rollout date', owner: 'Omar Farooq', due: 'Tomorrow' },
    ],
  },
  {
    prompt: 'Summarize this week across all tools.',
    readiness: 81,
    verdict: 'A strong week — one incident and one failing PR are the only drags.',
    summary:
      'Across Jira, Confluence, Bitbucket, and JSM this week: 63 issues closed, 11 docs updated, 6 PRs touched, and 1 incident resolved. The open Sev1 on payments is the single item needing leadership attention.',
    blockers: ['INC-91 — Payments API latency spike (Sev1, investigating)'],
    risks: [
      'The payments incident is the only Sev1 open; everything else is green or minor.',
    ],
    issues: ['INC-91', 'PR: Cart totals refactor'],
    actions: [
      { title: 'Close out the INC-91 post-incident review', owner: 'On-call', due: 'Friday' },
      { title: 'Re-run the failing build after the next push', owner: 'Sara Khan', due: 'Tomorrow' },
    ],
  },
];

export const INSIGHTS_WEEKLY: InsightPoint[] = [
  { label: 'W1', issues: 42, docs: 18, prs: 9 },
  { label: 'W2', issues: 55, docs: 24, prs: 12 },
  { label: 'W3', issues: 38, docs: 21, prs: 7 },
  { label: 'W4', issues: 63, docs: 29, prs: 14 },
  { label: 'W5', issues: 47, docs: 26, prs: 11 },
  { label: 'W6', issues: 58, docs: 31, prs: 13 },
];

// Sample issues for the Jira card's Demo mode. Same shape as the live
// payload, same Atlas story — but fixed sample data, never presented
// as live. The live list replaces this only inside a Forge installation.
export const SAMPLE_JIRA_ISSUES: LiveIssue[] = [
  { key: 'ATLAS-482', id: null, summary: 'Checkout timeout under load', status: 'In Progress', priority: 'Highest', assignee: 'Sara Khan', updated: '2026-11-05T07:00:00.000+0500' },
  { key: 'ATLAS-491', id: null, summary: 'Cart totals refactor blocked on API contract', status: 'To Do', priority: 'High', assignee: 'Omar Farooq', updated: '2026-11-04T15:30:00.000+0500' },
  { key: 'SYNC-77', id: null, summary: 'Retry logic for payment webhook', status: 'In Review', priority: 'Medium', assignee: 'Omar Farooq', updated: '2026-11-04T11:20:00.000+0500' },
  { key: 'MOB-118', id: null, summary: 'Push gateway certificate expiry', status: 'To Do', priority: 'Highest', assignee: 'Ali Raza', updated: '2026-11-03T09:45:00.000+0500' },
  { key: 'MOB-121', id: null, summary: 'Offline sync conflict resolution', status: 'In Progress', priority: 'Medium', assignee: null, updated: '2026-11-02T17:10:00.000+0500' },
];
