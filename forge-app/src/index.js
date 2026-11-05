import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import {
  buildSearchBody,
  mapJiraErrorStatus,
  parseJiraSearchResponse,
  validateJiraInput,
} from './jira.js';

// Atlasync Forge resolver.
//
// getStatus: health stub for the frontend bridge check.
// getJiraIssues: the first real integration — read-only Jira issue search
// through Forge authentication (asUser, so Jira enforces the signed-in
// user's own project permissions). All Jira calls live here; the frontend
// never touches the Jira REST API directly, and no token or credential
// ever enters this codebase — Forge holds the auth.

const resolver = new Resolver();

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
    if (status >= 400) {
      return { ok: false, error: mapJiraErrorStatus(status) };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        ok: false,
        error: { kind: 'API_ERROR', message: 'Jira returned an unreadable response. Try again shortly.' },
      };
    }
    return { ok: true, issues: parseJiraSearchResponse(data) };
  } catch {
    // Deliberately generic: the underlying error can carry URLs or
    // response fragments, and none of it may reach the frontend.
    return { ok: false, error: { kind: 'API_ERROR', message: 'Jira could not be reached. Try again shortly.' } };
  }
});

export const handler = resolver.getDefinitions();
