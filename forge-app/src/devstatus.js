// Pure dev-status helpers for Architecture A (Task 6) — deliberately
// free of Forge imports, so plain Node can test them.
//
// The Jira Development Status API is the read-only path from a Jira
// Forge app to Bitbucket pull requests WITHOUT any Bitbucket scope:
//   GET /rest/dev-status/1.0/issue/detail
//       ?issueId=<numeric-id>&applicationType=bitbucket&dataType=pullrequest
// The endpoint only knows about PRs when a Bitbucket workspace is linked
// to the Jira site through DVCS and the PR references the issue key.
// Until then it answers successfully with zero pull requests — that is
// a real, honest "nothing linked" result, never an error and never
// fake data. The probe on 2026-11-05 verified exactly that (numeric id
// required; a key errors with "An invalid ID"; no 401/403).
//
// Nothing here ever sees a token. Only the PR fields the UI renders
// are kept; everything else from Jira's response is dropped.

export const MAX_PULL_REQUESTS = 50;

// Validates a getIssueDevStatus payload. Only a numeric Jira issue id
// is accepted — the dev-status endpoint rejects issue keys.
export function validateDevStatusInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: { kind: 'INVALID_INPUT', message: 'Request payload must be an object.' } };
  }
  const rawId = payload.issueId;
  if (rawId === undefined || rawId === null) {
    return { ok: false, error: { kind: 'INVALID_INPUT', message: 'issueId is required.' } };
  }
  const issueId = typeof rawId === 'number' ? String(rawId) : rawId;
  if (typeof issueId !== 'string' || !/^[0-9]{1,19}$/.test(issueId)) {
    return {
      ok: false,
      error: { kind: 'INVALID_INPUT', message: 'issueId must be a numeric Jira issue id.' },
    };
  }
  return { ok: true, issueId };
}

function cleanPullRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id =
    typeof raw.id === 'string' && raw.id !== ''
      ? raw.id
      : typeof raw.id === 'number' && Number.isFinite(raw.id)
        ? String(raw.id)
        : null;
  const name = typeof raw.name === 'string' && raw.name !== '' ? raw.name : '(unnamed pull request)';
  const status = typeof raw.status === 'string' && raw.status !== '' ? raw.status : 'Unknown';
  const url =
    typeof raw.url === 'string' && (raw.url.startsWith('http://') || raw.url.startsWith('https://'))
      ? raw.url
      : null;
  return { id, name, status, url };
}

// Normalizes a dev-status detail response to { pullRequests: [...] }.
// The response nests PRs under detail[].pullRequests and under
// detail[].repositories[].pullRequests; both are walked defensively,
// because Jira omits empty containers instead of sending empty arrays.
// Malformed input yields an empty list, never a throw.
export function parseDevStatusResponse(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.detail)) return { pullRequests: [] };
  const seen = new Set();
  const pullRequests = [];
  for (const entry of data.detail) {
    if (!entry || typeof entry !== 'object') continue;
    const buckets = [];
    if (Array.isArray(entry.pullRequests)) buckets.push(entry.pullRequests);
    if (Array.isArray(entry.repositories)) {
      for (const repo of entry.repositories) {
        if (repo && typeof repo === 'object' && Array.isArray(repo.pullRequests)) {
          buckets.push(repo.pullRequests);
        }
      }
    }
    for (const bucket of buckets) {
      for (const raw of bucket) {
        const pr = cleanPullRequest(raw);
        if (!pr) continue;
        const dedupeKey = `${pr.id ?? ''}|${pr.url ?? ''}|${pr.name}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        pullRequests.push(pr);
        if (pullRequests.length >= MAX_PULL_REQUESTS) return { pullRequests };
      }
    }
  }
  return { pullRequests };
}
