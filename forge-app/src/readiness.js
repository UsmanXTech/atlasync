// Pure readiness + health-diagnostics helpers for Atlasync v2.1.0.
// Deliberately free of Forge imports, so plain Node can test them.
// The resolver (index.js) owns the actual API calls; this module owns
// the scoring formula, the per-source status mapping, and the stale-PR
// signal. Nothing here ever sees a token, and no message below includes
// response details from Atlassian.
//
// buildReadinessReport (Phase C1) composes the pure scorer with the
// shared gatherSnapshot helper: it takes injected fetchers, so the
// resolver, the daily snapshot trigger and unit tests all run the
// exact same computation. It never calls a live API itself.
import { gatherSnapshot } from './gather.js';

// Release readiness (v2.1.0 formula, approved product decision — it
// REPLACES the old frontend formula of Highest -15 / High -8 /
// Medium -3 / Low -1):
//   Readiness = max(0, 100 - (12*Bcrit + 15*Isev + 5*Pstale + 10*Dmissing))
// - Bcrit: open issues with priority Highest or Critical (30-day
//   snapshot, max 50). Terminal statuses (Done/Closed/Resolved/...)
//   never count.
// - Isev: open JSM requests with priority Highest or Critical. JSM
//   exposes no SEV field, so priority is the SEV-1/2 proxy — the UI
//   footnote says so.
// - Pstale: linked PRs in an open review state on the sampled critical
//   issues (see countStalePrs below).
// - Dmissing: open Highest/Critical blockers with NO assignee
//   (unowned work). This definition is set here because the spec left
//   Dmissing undefined; the UI footnote repeats it.

const DONE_STATUSES = new Set([
  'done',
  'closed',
  'resolved',
  'complete',
  'completed',
  'cancelled',
  'canceled',
]);

// JSM terminal statuses: a request in one of these is not open work.
const JSM_DONE_STATUSES = new Set(['resolved', 'closed', 'done', 'completed', 'cancelled', 'canceled']);

const CRITICAL_PRIORITIES = new Set(['highest', 'critical']);

export const READINESS_WEIGHTS = { Bcrit: 12, Isev: 15, Pstale: 5, Dmissing: 10 };

function isOpenIssue(issue) {
  if (!issue || typeof issue !== 'object') return false;
  return !DONE_STATUSES.has(String(issue.status ?? '').trim().toLowerCase());
}

function isCriticalPriority(priority) {
  return CRITICAL_PRIORITIES.has(String(priority ?? '').trim().toLowerCase());
}

function isOpenJsmRequest(request) {
  if (!request || typeof request !== 'object') return false;
  return !JSM_DONE_STATUSES.has(String(request.status ?? '').trim().toLowerCase());
}

// Top open Highest/Critical blockers for the Live-mode UI (max 10,
// snapshot order — newest updated first). The numeric id is kept so
// the resolver can sample linked PRs via dev-status; it is Jira's own
// record id, not a credential.
export function selectCriticalBlockers(issues, max = 10) {
  const list = Array.isArray(issues) ? issues : [];
  const out = [];
  for (const issue of list) {
    if (!isOpenIssue(issue) || !isCriticalPriority(issue.priority)) continue;
    out.push({
      key: issue.key,
      id: typeof issue.id === 'string' ? issue.id : null,
      summary: typeof issue.summary === 'string' ? issue.summary : '(no summary)',
      priority: issue.priority ?? null,
      assignee: issue.assignee ?? null,
      updated: typeof issue.updated === 'string' ? issue.updated : '',
    });
    if (out.length >= max) break;
  }
  return out;
}

// Top open Highest/Critical JSM requests (SEV-1/2 proxy) for the
// Live-mode UI (max 10).
export function selectSevIncidents(requests, max = 10) {
  const list = Array.isArray(requests) ? requests : [];
  const out = [];
  for (const request of list) {
    if (!isOpenJsmRequest(request) || !isCriticalPriority(request.priority)) continue;
    out.push({
      key: request.key,
      summary: typeof request.summary === 'string' ? request.summary : '(no summary)',
      priority: request.priority ?? null,
      status: typeof request.status === 'string' ? request.status : 'Unknown',
    });
    if (out.length >= max) break;
  }
  return out;
}

// Computes the v2.1.0 readiness score from a gathered snapshot.
// issues: normalized Jira issues ({ key, status, priority, assignee }).
// jsmRequests: normalized JSM requests ({ key, status, priority }).
// stalePrCount: open linked PRs on the sampled critical issues.
// Returns { score, breakdown, counts, notes }. score is null when the
// snapshot holds no records at all — zero records is not evidence of
// readiness, so the UI keeps its labelled sample estimate instead.
export function computeReadinessScore({ issues = [], jsmRequests = [], stalePrCount = 0 } = {}) {
  const jiraList = Array.isArray(issues) ? issues : [];
  const jsmList = Array.isArray(jsmRequests) ? jsmRequests : [];
  const stale = Number.isFinite(stalePrCount) && stalePrCount > 0 ? Math.floor(stalePrCount) : 0;

  let jiraOpen = 0;
  let bcrit = 0;
  let dmissing = 0;
  for (const issue of jiraList) {
    if (!isOpenIssue(issue)) continue;
    jiraOpen += 1;
    if (isCriticalPriority(issue.priority)) {
      bcrit += 1;
      if (issue.assignee === null || issue.assignee === undefined || String(issue.assignee).trim() === '') {
        dmissing += 1;
      }
    }
  }

  let jsmOpen = 0;
  let isev = 0;
  for (const request of jsmList) {
    if (!isOpenJsmRequest(request)) continue;
    jsmOpen += 1;
    if (isCriticalPriority(request.priority)) isev += 1;
  }

  const notes = [];
  if (jiraList.length === 0 && jsmList.length === 0) {
    notes.push('No records in the 30-day snapshot — nothing to score.');
    return {
      score: null,
      breakdown: { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 },
      counts: { jiraTotal: 0, jiraOpen: 0, jsmTotal: 0, jsmOpen: 0 },
      notes,
    };
  }
  if (stale === 0) notes.push('No open linked pull requests found on the sampled critical issues.');

  const breakdown = { Bcrit: bcrit, Isev: isev, Pstale: stale, Dmissing: dmissing };
  const deduction =
    READINESS_WEIGHTS.Bcrit * bcrit +
    READINESS_WEIGHTS.Isev * isev +
    READINESS_WEIGHTS.Pstale * stale +
    READINESS_WEIGHTS.Dmissing * dmissing;
  const score = Math.max(0, 100 - deduction);

  return {
    score,
    breakdown,
    counts: { jiraTotal: jiraList.length, jiraOpen, jsmTotal: jsmList.length, jsmOpen },
    notes,
  };
}

// Maps one source's HTTP status to a structured diagnostic entry.
// Never includes response bodies, status text, or headers — only the
// status number and fixed copy. 401/403 name the scope that would fix
// it; a 404 on JSM means "not provisioned", which is a fact to report,
// not an error to alarm on.
export function diagnoseHealthStatus(source, status) {
  const code = typeof status === 'number' ? status : 0;
  const base = { source, ok: false, status: code, code: 'API_ERROR', message: '', missingScopeHint: null };
  if (code >= 200 && code < 300) {
    return { ...base, ok: true, code: 'OK', message: 'Connected.' };
  }
  if (code === 401 || code === 403) {
    const hints = {
      jira: 'read:jira-work — the signed-in user needs Browse Projects permission.',
      confluence: 'read:confluence-space.summary — the signed-in user needs space access.',
      jsm: 'read:servicedesk-request — the signed-in user needs service-desk access.',
    };
    return {
      ...base,
      code: 'PERMISSION_DENIED',
      message: `${source === 'jira' ? 'Jira' : source === 'confluence' ? 'Confluence' : 'Jira Service Management'} denied access (HTTP ${code}).`,
      missingScopeHint: hints[source] ?? null,
    };
  }
  if (code === 404) {
    if (source === 'jsm') {
      return {
        ...base,
        code: 'NOT_PROVISIONED',
        message: 'Jira Service Management is not provisioned on this site.',
      };
    }
    return { ...base, code: 'NOT_FOUND', message: `The ${source} endpoint was not found (HTTP 404).` };
  }
  if (code === 429) {
    return { ...base, code: 'RATE_LIMITED', message: 'The source is rate-limiting requests. Wait a moment and retry.' };
  }
  if (code === 0) {
    return { ...base, code: 'UNREACHABLE', message: 'The source could not be reached.' };
  }
  return { ...base, message: `The source returned HTTP ${code}.` };
}

// Stale-PR signal from dev-status pull requests.
//
// The dev-status payload keeps only id/name/status/url per PR — it
// carries no updated timestamp, so the spec's "> 48h" age test cannot
// be applied from this endpoint. The honest signal available is the
// review state: a PR whose status is OPEN is still awaiting review.
// MERGED / DECLINED / closed states are not stale. The UI footnote
// states this limitation; Pstale counts OPEN PRs on critical issues.
const OPEN_PR_STATUSES = new Set(['open', 'changes requested', 'in review', 'review']);

export function isOpenPrStatus(status) {
  return OPEN_PR_STATUSES.has(String(status ?? '').trim().toLowerCase());
}

export function countStalePrs(pullRequests) {
  const list = Array.isArray(pullRequests) ? pullRequests : [];
  let count = 0;
  for (const pr of list) {
    if (pr && typeof pr === 'object' && isOpenPrStatus(pr.status)) count += 1;
  }
  return {
    count,
    note:
      'Dev-status pull requests carry no updated timestamp, so the 48-hour age test does not apply here; open PRs on critical issues are counted as the stale-PR signal.',
  };
}

// Full readiness report from injected fetchers — the single computation
// behind the getReadiness resolver AND the daily snapshot trigger.
// Jira is the primary source: if its snapshot cannot be loaded, the
// report answers ok:false instead of inventing a score from partial
// data. `countStalePrsForIssues` is injected the same way (the live
// dev-status sampler in production, a stub in tests).
export async function buildReadinessReport({
  fetchJiraIssues,
  fetchConfluencePages,
  fetchJsmRequests,
  countStalePrsForIssues,
}) {
  const snapshot = await gatherSnapshot({ fetchJiraIssues, fetchConfluencePages, fetchJsmRequests });
  if (snapshot.unavailable.some((message) => message.startsWith('Jira'))) {
    return {
      ok: false,
      error: {
        kind: 'API_ERROR',
        message: 'Readiness needs the Jira snapshot, which could not be loaded. Check Jira access and retry.',
      },
    };
  }
  const stale = await countStalePrsForIssues(snapshot.jiraIssues);
  const result = computeReadinessScore({
    issues: snapshot.jiraIssues,
    jsmRequests: snapshot.jsmRequests,
    stalePrCount: stale,
  });
  const notes = [...result.notes];
  if (stale > 0) {
    notes.push(
      'Dev-status pull requests carry no updated timestamp, so the 48-hour age test does not apply here; open PRs on critical issues are counted as the stale-PR signal.',
    );
  }
  return {
    ok: true,
    score: result.score,
    breakdown: result.breakdown,
    counts: result.counts,
    blockers: selectCriticalBlockers(snapshot.jiraIssues, 10),
    incidents: selectSevIncidents(snapshot.jsmRequests, 10),
    unavailable: snapshot.unavailable,
    notes,
    generatedAt: new Date().toISOString(),
  };
}
