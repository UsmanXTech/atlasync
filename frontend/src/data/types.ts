// Dashboard domain types. All data in mock.ts is sample data — no live
// Atlassian connection exists yet. Types stay UI-shaped on purpose: the
// integration adapters (integrations/) will map real API payloads onto
// these shapes later.

export type WorkspaceId = 'hq' | 'platform';

export interface Workspace {
  id: WorkspaceId;
  name: string;
  plan: string;
}

export type HealthStatus = 'healthy' | 'at-risk' | 'blocked';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Project {
  id: string;
  key: string;
  name: string;
  workspace: WorkspaceId;
  owner: string;
  health: HealthStatus;
  progress: number; // 0–100
  openIssues: number;
  blockers: number;
  nextMilestone: string;
  updatedDaysAgo: number;
}

export interface IssueBucket {
  label: string;
  count: number;
}

export interface Blocker {
  id: string;
  key: string;
  title: string;
  workspace: WorkspaceId;
  severity: Severity;
  owner: string;
  blockedBy: string;
  ageDays: number;
}

export interface DocActivity {
  id: string;
  title: string;
  space: string;
  workspace: WorkspaceId;
  editor: string;
  edits: number;
  daysAgo: number;
}

export type PrStatus = 'review' | 'approved' | 'merged' | 'changes';

export interface PullRequest {
  id: string;
  title: string;
  repo: string;
  workspace: WorkspaceId;
  author: string;
  status: PrStatus;
  checks: 'pass' | 'fail' | 'pending';
  daysAgo: number;
}

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3';

export interface Incident {
  id: string;
  title: string;
  service: string;
  workspace: WorkspaceId;
  severity: IncidentSeverity;
  status: 'open' | 'investigating' | 'resolved';
  minutesOpen: number;
}

export type ActivityKind = 'jira' | 'confluence' | 'bitbucket' | 'jsm' | 'ai';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  actor: string;
  workspace: WorkspaceId;
  daysAgo: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capability: string;
  enabled: boolean;
  lastRun: string;
  runsThisWeek: number;
}

export interface Integration {
  id: string;
  tool: 'Jira' | 'Confluence' | 'Bitbucket' | 'Jira Service Management';
  connected: boolean;
  lastSync: string;
  itemsSynced: number;
  note: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  daysAgo: number;
  unread: boolean;
}

export interface AiNextAction {
  title: string;
  owner: string;
  due: string;
}

export interface AiResponse {
  prompt: string;
  readiness: number; // 0–100
  verdict: string;
  summary: string;
  blockers: string[];
  risks: string[];
  issues: string[];
  actions: AiNextAction[];
}

export interface InsightPoint {
  label: string;
  issues: number;
  docs: number;
  prs: number;
}
