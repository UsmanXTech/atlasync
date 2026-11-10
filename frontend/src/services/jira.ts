import type { LiveIssue } from '../data/types';
import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';

// Jira data service — the frontend's only path to Jira data.
//
// It calls the Forge resolver through @forge/bridge. It NEVER calls the
// Jira REST API directly: authentication, permission scoping, and
// rate-limit handling live in the Forge backend (forge-app/src/).
//
// Error model: the resolver returns { ok: false } payloads for API-level
// failures (permission denied, rate limited, ...). A failure at the
// bridge stage itself means the Forge backend could not be reached:
// in the standalone preview there is no backend, and on a real install
// it means the resolver failed. It must never be reported as a missing
// installation — that message misled a real live test (Task 5.1).

export type JiraErrorKind =
  | 'BACKEND_UNREACHABLE'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'INVALID_INPUT';

export interface JiraError {
  kind: JiraErrorKind;
  message: string;
}

export type JiraIssuesResult =
  | { ok: true; issues: LiveIssue[] }
  | { ok: false; error: JiraError };

const BACKEND_UNREACHABLE: JiraError = backendUnreachableError('Jira');

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Defense in depth: the backend already normalizes, but the UI never
// renders an unshaped record.
function cleanIssue(value: unknown): LiveIssue | null {
  if (!isRecord(value)) return null;
  if (typeof value.key !== 'string' || typeof value.summary !== 'string') return null;
  if (typeof value.status !== 'string') return null;
  return {
    key: value.key,
    id: typeof value.id === 'string' ? value.id : null,
    summary: value.summary,
    status: value.status,
    priority: typeof value.priority === 'string' ? value.priority : null,
    assignee: typeof value.assignee === 'string' ? value.assignee : null,
    updated: typeof value.updated === 'string' ? value.updated : '',
  };
}

// Linked pull requests (Task 6, Architecture A) — read-only, from the
// Jira Development Status API via the Forge backend. An empty list is
// the honest answer while no Bitbucket workspace is linked through
// DVCS: it means "nothing linked", never an error.
export interface LinkedPullRequest {
  id: string | null;
  name: string;
  status: string;
  url: string | null;
}

export type DevStatusResult =
  | { ok: true; pullRequests: LinkedPullRequest[] }
  | { ok: false; error: JiraError };

function cleanPullRequest(value: unknown): LinkedPullRequest | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string' || typeof value.status !== 'string') return null;
  return {
    id: typeof value.id === 'string' ? value.id : null,
    name: value.name,
    status: value.status,
    url: typeof value.url === 'string' ? value.url : null,
  };
}

export async function fetchIssueDevStatus(issueId: string): Promise<DevStatusResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getIssueDevStatus', { issueId });

    if (!isRecord(result) || typeof result.ok !== 'boolean') {
      return {
        ok: false,
        error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE },
      };
    }
    if (result.ok) {
      if (!Array.isArray(result.pullRequests)) {
        return {
          ok: false,
          error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE },
        };
      }
      const pullRequests: LinkedPullRequest[] = [];
      for (const raw of result.pullRequests) {
        const pr = cleanPullRequest(raw);
        if (pr) pullRequests.push(pr);
      }
      return { ok: true, pullRequests };
    }
    if (
      isRecord(result.error) &&
      typeof result.error.kind === 'string' &&
      (['BACKEND_UNREACHABLE', 'PERMISSION_DENIED', 'RATE_LIMITED', 'API_ERROR', 'INVALID_INPUT'] as const).includes(
        result.error.kind as JiraErrorKind,
      ) &&
      typeof result.error.message === 'string'
    ) {
      return {
        ok: false,
        error: { kind: result.error.kind as JiraErrorKind, message: result.error.message },
      };
    }
    return {
      ok: false,
      error: { kind: 'API_ERROR', message: serviceUnreachableMessage('Jira') },
    };
  } catch {
    return { ok: false, error: BACKEND_UNREACHABLE };
  }
}

export async function fetchLiveJiraIssues(maxResults = 25): Promise<JiraIssuesResult> {
  try {
    // Dynamic import, same rule as the app shell: @forge/bridge only
    // works inside a Forge iframe, and a static import would break the
    // standalone preview build.
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getJiraIssues', { maxResults });

    if (!isRecord(result) || typeof result.ok !== 'boolean') {
      return {
        ok: false,
        error: {
          kind: 'API_ERROR',
          message: UNEXPECTED_RESPONSE_MESSAGE,
        },
      };
    }
    if (result.ok) {
      if (!Array.isArray(result.issues)) {
        return {
          ok: false,
          error: {
            kind: 'API_ERROR',
            message: UNEXPECTED_RESPONSE_MESSAGE,
          },
        };
      }
      const issues: LiveIssue[] = [];
      for (const raw of result.issues) {
        const issue = cleanIssue(raw);
        if (issue) issues.push(issue);
      }
      return { ok: true, issues };
    }
    if (
      isRecord(result.error) &&
      typeof result.error.kind === 'string' &&
      (['BACKEND_UNREACHABLE', 'PERMISSION_DENIED', 'RATE_LIMITED', 'API_ERROR', 'INVALID_INPUT'] as const).includes(
        result.error.kind as JiraErrorKind,
      ) &&
      typeof result.error.message === 'string'
    ) {
      return {
        ok: false,
        error: { kind: result.error.kind as JiraErrorKind, message: result.error.message },
      };
    }
    return {
      ok: false,
      error: { kind: 'API_ERROR', message: serviceUnreachableMessage('Jira') },
    };
  } catch {
    return { ok: false, error: BACKEND_UNREACHABLE };
  }
}

export interface LiveJiraProject { id: string; key: string; name: string; projectType: string }
export type JiraProjectsResult = { ok: true; projects: LiveJiraProject[] } | { ok: false; error: JiraError };
export async function fetchLiveJiraProjects(limit = 25): Promise<JiraProjectsResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getJiraProjects', { limit });
    if (!isRecord(result) || typeof result.ok !== 'boolean') return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    if (result.ok) {
      if (!Array.isArray(result.projects)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
      const projects: LiveJiraProject[] = result.projects.filter(isRecord).flatMap((p) => typeof p.id === 'string' && typeof p.key === 'string' && typeof p.name === 'string' ? [{ id: p.id, key: p.key, name: p.name, projectType: typeof p.projectType === 'string' ? p.projectType : 'Unknown' }] : []);
      return { ok: true, projects };
    }
    const error = isRecord(result.error) ? result.error : {};
    return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind as JiraErrorKind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Jira') } };
  } catch { return { ok: false, error: BACKEND_UNREACHABLE }; }
}
