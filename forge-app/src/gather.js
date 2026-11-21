// Shared snapshot gathering for Atlasync v2.1.0 — deliberately free of
// Forge imports, so plain Node can test the allSettled behaviour.
//
// gatherSnapshot takes three fetcher functions (one per source) and runs
// them in parallel with Promise.allSettled, so one unavailable product
// (e.g. a missing JSM license) never blocks the remaining sources.
// Each fetcher returns a normalized array on success and throws an Error
// whose message names the failure on any failure; the thrown message is
// recorded verbatim in `unavailable` (callers use fixed, safe strings).
// The resolver (index.js) supplies the real fetchers; askAtlasync and
// getReadiness share this helper instead of each hand-rolling parallel
// fetches (askAtlasync previously used Promise.all with per-source
// try/catch — same outcome, now explicit and shared).
export async function gatherSnapshot(fetchers) {
  const jobs = [
    { key: 'jiraIssues', fetch: fetchers?.fetchJiraIssues, label: 'Jira' },
    { key: 'confluencePages', fetch: fetchers?.fetchConfluencePages, label: 'Confluence' },
    { key: 'jsmRequests', fetch: fetchers?.fetchJsmRequests, label: 'JSM' },
  ];
  const settled = await Promise.allSettled(
    jobs.map((job) =>
      typeof job.fetch === 'function'
        ? job.fetch()
        : Promise.reject(new Error(`${job.label} unavailable`)),
    ),
  );
  const snapshot = { jiraIssues: [], confluencePages: [], jsmRequests: [], unavailable: [] };
  settled.forEach((result, i) => {
    const job = jobs[i];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      snapshot[job.key] = result.value;
      return;
    }
    if (result.status === 'fulfilled') {
      snapshot.unavailable.push(`${job.label} unavailable`);
      return;
    }
    const message = result.reason instanceof Error ? result.reason.message : '';
    snapshot.unavailable.push(message && typeof message === 'string' ? message : `${job.label} unavailable`);
  });
  snapshot.unavailable = [...new Set(snapshot.unavailable)];
  return snapshot;
}
