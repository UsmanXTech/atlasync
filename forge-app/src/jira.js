// Pure Jira helpers — deliberately free of Forge imports, so plain Node
// can test them. The resolver (index.js) owns the actual API call; this
// module owns validation, normalization, and safe error mapping. Nothing
// here ever sees a token, and no error message below includes response
// details from Jira.

// Bounded by design: Jira's new /search/jql endpoint rejects unbounded
// queries ("Unbounded JQL queries are not allowed here") — a bare
// ORDER BY with no WHERE clause returns 400 (proven by Forge logs,
// 2026-11-05). The 30-day window also matches the card's "recently
// updated, newest first" purpose.
export const DEFAULT_JQL = 'updated >= -30d ORDER BY updated DESC';
export const DEFAULT_MAX_RESULTS = 25;
export const MAX_MAX_RESULTS = 50;
export const JIRA_FIELDS = ['summary', 'status', 'priority', 'assignee', 'updated'];

// Validates a getJiraIssues payload. Unknown fields are ignored; only the
// bounded, read-only shape below ever reaches the Jira API.
export function validateJiraInput(payload) {
  if (payload === undefined || payload === null) {
    return { ok: true, jql: DEFAULT_JQL, maxResults: DEFAULT_MAX_RESULTS };
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: { kind: 'INVALID_INPUT', message: 'Request payload must be an object.' } };
  }

  let jql = DEFAULT_JQL;
  if (payload.jql !== undefined && payload.jql !== null) {
    if (typeof payload.jql !== 'string') {
      return { ok: false, error: { kind: 'INVALID_INPUT', message: 'jql must be a string.' } };
    }
    if (payload.jql.trim() !== '') {
      if (payload.jql.length > 500) {
        return { ok: false, error: { kind: 'INVALID_INPUT', message: 'jql must be at most 500 characters.' } };
      }
      jql = payload.jql;
    }
  }

  let maxResults = DEFAULT_MAX_RESULTS;
  if (payload.maxResults !== undefined && payload.maxResults !== null) {
    if (typeof payload.maxResults !== 'number' || !Number.isFinite(payload.maxResults)) {
      return { ok: false, error: { kind: 'INVALID_INPUT', message: 'maxResults must be a number.' } };
    }
    maxResults = Math.min(MAX_MAX_RESULTS, Math.max(1, Math.floor(payload.maxResults)));
  }

  return { ok: true, jql, maxResults };
}

export function buildSearchBody({ jql, maxResults }) {
  // fieldsByKeys is required: the new /search/jql endpoint treats `fields`
  // entries as field IDs unless this flag is set, and our entries are keys
  // (summary, status, ...). Without it Jira rejects the request with 400
  // (proven by Forge logs, 2026-11-05).
  return { jql, maxResults, fields: [...JIRA_FIELDS], fieldsByKeys: true };
}

// Normalizes one raw Jira issue to the small, typed payload the frontend
// renders. Nullable fields become explicit nulls; a record without a
// string key is skipped (returns null) rather than rendered half-broken.
export function normalizeJiraIssue(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string') return null;
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};
  const status =
    fields.status && typeof fields.status.name === 'string' ? fields.status.name : 'Unknown';
  const priority =
    fields.priority && typeof fields.priority.name === 'string' ? fields.priority.name : null;
  const assignee =
    fields.assignee && typeof fields.assignee.displayName === 'string'
      ? fields.assignee.displayName
      : null;
  const summary =
    typeof fields.summary === 'string' && fields.summary !== '' ? fields.summary : '(no summary)';
  const updated = typeof fields.updated === 'string' ? fields.updated : '';
  // The numeric Jira issue id is needed by the dev-status endpoint
  // (Task 6, Architecture A): it rejects issue keys with "An invalid ID".
  // It is Jira's own record id, not a credential, and null when absent.
  const id =
    typeof raw.id === 'string' && raw.id !== ''
      ? raw.id
      : typeof raw.id === 'number' && Number.isFinite(raw.id)
        ? String(raw.id)
        : null;
  return { key: raw.key, id, summary, status, priority, assignee, updated };
}

export function parseJiraSearchResponse(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.issues)) return [];
  const issues = [];
  for (const raw of data.issues) {
    const issue = normalizeJiraIssue(raw);
    if (issue) issues.push(issue);
  }
  return issues;
}

// Maps an HTTP status to a safe, fixed error kind. Messages are static —
// no status text, body, or header from Jira ever reaches the frontend.
export function mapJiraErrorStatus(status) {
  if (status === 401 || status === 403) {
    return {
      kind: 'PERMISSION_DENIED',
      message:
        'Jira denied access. The signed-in user needs Browse Projects permission on the requested projects.',
    };
  }
  if (status === 429) {
    return {
      kind: 'RATE_LIMITED',
      message: 'Jira is rate-limiting requests. Wait a moment and try again.',
    };
  }
  return { kind: 'API_ERROR', message: 'Jira could not be reached. Try again shortly.' };
}
