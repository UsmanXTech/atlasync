// Shared snapshot fetchers (v2.1.0): the raw per-source reads behind
// gatherSnapshot. Each returns a normalized array on success and throws
// an Error with a fixed, safe message on any failure — the message is
// what gatherSnapshot records in `unavailable`, so it must never carry
// response bodies or URLs. These are the same queries the standalone
// resolvers run; the snapshot path just shares them so askAtlasync,
// getReadiness and the daily snapshot trigger cannot drift apart.
//
// Moved here from index.js in Phase C1 so the scheduled snapshot
// handler (snapshot.js) can reuse the exact same fetchers without
// importing the resolver module.
import api, { route } from '@forge/api';
import { DEFAULT_JQL, buildSearchBody, parseJiraSearchResponse } from './jira.js';
import { parseDevStatusResponse } from './devstatus.js';
import { parseConfluencePages } from './confluence.js';
import { parseJsmRequests } from './jsm.js';
import { countStalePrs, selectCriticalBlockers } from './readiness.js';

export async function fetchJiraSnapshotIssues(maxResults) {
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSearchBody({ jql: DEFAULT_JQL, maxResults })),
    });
    if (response.status >= 400) throw new Error('Jira unavailable or permission denied');
    return parseJiraSearchResponse(await response.json());
  } catch (error) {
    if (error instanceof Error && error.message === 'Jira unavailable or permission denied') throw error;
    throw new Error('Jira unavailable');
  }
}

export async function fetchConfluenceSnapshotPages(limit) {
  try {
    const response = await api.asUser().requestConfluence(
      route`/wiki/api/v2/pages?limit=${limit}&sort=-modified-date`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (response.status >= 400) throw new Error('Confluence unavailable or permission denied');
    return parseConfluencePages(await response.json());
  } catch (error) {
    if (error instanceof Error && error.message === 'Confluence unavailable or permission denied') throw error;
    throw new Error('Confluence unavailable');
  }
}

export async function fetchJsmSnapshotRequests(limit) {
  try {
    const response = await api.asUser().requestJira(route`/rest/servicedeskapi/request?limit=${limit}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.status >= 400) throw new Error('JSM unavailable or permission denied');
    return parseJsmRequests(await response.json());
  } catch (error) {
    if (error instanceof Error && error.message === 'JSM unavailable or permission denied') throw error;
    throw new Error('JSM unavailable');
  }
}

// Stale-PR sampling for getReadiness: linked PRs in an open review
// state on the top 10 open Highest/Critical issues. Bounded to 10
// dev-status calls; a failed call contributes 0 and is skipped, never
// an error. Issues without a numeric id cannot be queried and are
// skipped (the dev-status endpoint rejects keys).
export async function countStalePrsForIssues(issues) {
  const blockers = selectCriticalBlockers(issues, 10);
  let stale = 0;
  for (const blocker of blockers) {
    if (!blocker.id) continue;
    try {
      const response = await api.asUser().requestJira(
        route`/rest/dev-status/1.0/issue/detail?issueId=${blocker.id}&applicationType=bitbucket&dataType=pullrequest`,
        { method: 'GET', headers: { Accept: 'application/json' } },
      );
      if (response.status >= 400) continue;
      const { pullRequests } = parseDevStatusResponse(await response.json());
      stale += countStalePrs(pullRequests).count;
    } catch {
      continue;
    }
  }
  return stale;
}
