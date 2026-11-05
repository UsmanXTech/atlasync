import type { LiveIssue } from '../data/types';

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

const BACKEND_UNREACHABLE: JiraError = {
  kind: 'BACKEND_UNREACHABLE',
  message: 'Live Jira could not reach the Forge backend. Try again shortly.',
};

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
    summary: value.summary,
    status: value.status,
    priority: typeof value.priority === 'string' ? value.priority : null,
    assignee: typeof value.assignee === 'string' ? value.assignee : null,
    updated: typeof value.updated === 'string' ? value.updated : '',
  };
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
          message: 'The Forge backend returned an unexpected response. Try again shortly.',
        },
      };
    }
    if (result.ok) {
      if (!Array.isArray(result.issues)) {
        return {
          ok: false,
          error: {
            kind: 'API_ERROR',
            message: 'The Forge backend returned an unexpected response. Try again shortly.',
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
      error: { kind: 'API_ERROR', message: 'Jira could not be reached. Try again shortly.' },
    };
  } catch {
    return { ok: false, error: BACKEND_UNREACHABLE };
  }
}
