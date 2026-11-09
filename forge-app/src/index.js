import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import {
  buildSearchBody,
  mapJiraErrorStatus,
  parseJiraSearchResponse,
  validateJiraInput,
} from './jira.js';
import { parseDevStatusResponse, validateDevStatusInput } from './devstatus.js';
import { parseConfluencePages, validateConfluenceInput } from './confluence.js';
import { parseJsmRequests, validateJsmInput } from './jsm.js';

// Atlasync Forge resolver.
//
// getStatus: health stub for the frontend bridge check.
// getJiraIssues: the first real integration — read-only Jira issue search
// through Forge authentication (asUser, so Jira enforces the signed-in
// user's own project permissions). All Jira calls live here; the frontend
// never touches the Jira REST API directly, and no token or credential
// ever enters this codebase — Forge holds the auth.

// Task 5.1: @forge/resolver@1.8.0 is a CommonJS module whose constructor
// lives under `exports.default` (plus a `makeResolver` helper). Forge's
// function bundler hands this file the module namespace object instead of
// the default export, so plain `new Resolver()` threw
// "out_namespaceObject is not a constructor" on the live install
// (forge logs, 2026-11-05). Resolve defensively: a namespace object
// yields its .default class; an already-resolved class passes through.
const ResolverCtor = Resolver?.default ?? Resolver;
if (typeof ResolverCtor !== 'function') {
  throw new Error(
    'Forge resolver constructor could not be resolved from @forge/resolver: expected a class under .default',
  );
}

const resolver = new ResolverCtor();

resolver.define('getStatus', () => ({
  ok: true,
  app: 'atlasync',
  version: '0.2.0',
}));

resolver.define('getJiraIssues', async ({ payload }) => {
  const input = validateJiraInput(payload);
  if (!input.ok) return { ok: false, error: input.error };

  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSearchBody(input)),
    });

    const status = typeof response.status === 'number' ? response.status : 500;
    // Diagnostic only (Task 5.1 follow-up): the status number goes to
    // Forge logs, never to the frontend. The frontend keeps its generic
    // message by design; without this line a failing Jira request is
    // indistinguishable from any other backend failure.
    console.log('[atlasync] Jira search status:', status);
    if (status >= 400) {
      // Diagnostic only (Task 5.1 follow-up): the status alone does not
      // say why Jira rejects the request, and the 400 body carries no
      // errorMessages array (verified 2026-11-05). Log the capped raw
      // error body to Forge logs: an error response carries no issue
      // data, and at most echoes our own request parameters. Never the
      // full unbounded body, and never to the frontend.
      try {
        const errText = await response.text();
        console.error('[atlasync] Jira error body:', errText ? errText.slice(0, 500) : '(empty)');
      } catch {
        console.error('[atlasync] Jira error body: (unreadable)');
      }
      return { ok: false, error: mapJiraErrorStatus(status) };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      console.error('[atlasync] Jira search response was not JSON');
      return {
        ok: false,
        error: { kind: 'API_ERROR', message: 'Jira returned an unreadable response. Try again shortly.' },
      };
    }
    return { ok: true, issues: parseJiraSearchResponse(data) };
  } catch (error) {
    // Log only the error class, never the message: messages can carry
    // URLs or response fragments, and none of that may leave the server.
    console.error('[atlasync] Jira request threw:', error instanceof Error ? error.name : typeof error);
    // Deliberately generic: the underlying error can carry URLs or
    // response fragments, and none of it may reach the frontend.
    return { ok: false, error: { kind: 'API_ERROR', message: 'Jira could not be reached. Try again shortly.' } };
  }
});

// Task 6, Architecture A: read-only linked pull requests for one issue
// through the Jira Development Status API — no Bitbucket scope, no
// manifest change, no install change. The endpoint only returns PRs
// when a Bitbucket workspace is linked to this Jira site through DVCS
// and the PR references the issue key; until then it answers
// successfully with an empty list (verified by the 2026-11-05 probe).
resolver.define('getIssueDevStatus', async ({ payload }) => {
  const input = validateDevStatusInput(payload);
  if (!input.ok) return { ok: false, error: input.error };

  try {
    const response = await api.asUser().requestJira(
      route`/rest/dev-status/1.0/issue/detail?issueId=${input.issueId}&applicationType=bitbucket&dataType=pullrequest`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    );

    const status = typeof response.status === 'number' ? response.status : 500;
    console.log('[atlasync] Jira dev-status status:', status);
    if (status >= 400) {
      try {
        const errText = await response.text();
        console.error('[atlasync] Jira dev-status error body:', errText ? errText.slice(0, 500) : '(empty)');
      } catch {
        console.error('[atlasync] Jira dev-status error body: (unreadable)');
      }
      return { ok: false, error: mapJiraErrorStatus(status) };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      console.error('[atlasync] Jira dev-status response was not JSON');
      return {
        ok: false,
        error: { kind: 'API_ERROR', message: 'Jira returned an unreadable response. Try again shortly.' },
      };
    }
    return { ok: true, ...parseDevStatusResponse(data) };
  } catch (error) {
    console.error('[atlasync] Jira dev-status request threw:', error instanceof Error ? error.name : typeof error);
    return { ok: false, error: { kind: 'API_ERROR', message: 'Jira could not be reached. Try again shortly.' } };
  }
});


// Cross-tool live reads. Both are read-only and run as the current user,
// so Atlassian's product permissions still apply. The UI never receives
// raw API payloads or response bodies.
resolver.define('getConfluencePages', async ({ payload }) => {
  const input = validateConfluenceInput(payload);
  if (!input.ok) return { ok: false, error: input.error };
  try {
    const response = await api.asUser().requestConfluence(
      route`/wiki/api/v2/pages?limit=${input.limit}&sort=-modified-date`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    const status = typeof response.status === 'number' ? response.status : 500;
    if (status >= 400) return { ok: false, error: mapJiraErrorStatus(status) };
    let data;
    try { data = await response.json(); } catch {
      return { ok: false, error: { kind: 'API_ERROR', message: 'Confluence returned an unreadable response. Try again shortly.' } };
    }
    return { ok: true, pages: parseConfluencePages(data) };
  } catch (error) {
    console.error('[atlasync] Confluence request threw:', error instanceof Error ? error.name : typeof error);
    return { ok: false, error: { kind: 'API_ERROR', message: 'Confluence could not be reached. Check app access and try again.' } };
  }
});

resolver.define('getJsmRequests', async ({ payload }) => {
  const input = validateJsmInput(payload);
  if (!input.ok) return { ok: false, error: input.error };
  try {
    const response = await api.asUser().requestJira(
      route`/rest/servicedeskapi/request?limit=${input.limit}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    const status = typeof response.status === 'number' ? response.status : 500;
    if (status >= 400) return { ok: false, error: mapJiraErrorStatus(status) };
    let data;
    try { data = await response.json(); } catch {
      return { ok: false, error: { kind: 'API_ERROR', message: 'Jira Service Management returned an unreadable response. Try again shortly.' } };
    }
    return { ok: true, requests: parseJsmRequests(data) };
  } catch (error) {
    console.error('[atlasync] JSM request threw:', error instanceof Error ? error.name : typeof error);
    return { ok: false, error: { kind: 'API_ERROR', message: 'Jira Service Management could not be reached. Check app access and try again.' } };
  }
});

export const handler = resolver.getDefinitions();
