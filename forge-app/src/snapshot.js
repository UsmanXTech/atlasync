// Atlasync v2.1.0 — daily readiness snapshot (scheduled trigger).
//
// Manifest module `scheduledTrigger` key `atlasync-daily-snapshot`,
// function `snapshot-handler`, interval `day`. (Not the `trigger`
// module — that one is product-events only and rejects `interval`;
// the validator proved this on 2026-11-21.) Forge invokes
// `handler(event, context)` once a day. The handler:
//   1. reads the workspace settings from KVS;
//   2. no-ops (log + return) when Daily sync is off;
//   3. otherwise computes the same readiness report as the getReadiness
//      resolver (shared buildReadinessReport + liveSources fetchers)
//      and stores it under snapshot:${cloudId}:${YYYY-MM-DD}.
//
// A failed readiness computation stores nothing — a missing day is
// honest, an invented snapshot is not. The trigger context may not
// carry cloudId (unlike a resolver call); resolveScope falls back to
// the single 'default' segment in that case.
import { kvs } from '@forge/kvs';
import { buildReadinessReport } from './readiness.js';
import {
  fetchConfluenceSnapshotPages,
  fetchJiraSnapshotIssues,
  fetchJsmSnapshotRequests,
  countStalePrsForIssues,
} from './liveSources.js';
import { loadSettings, resolveScope, storeSnapshot, todayDateString } from './memory.js';

export async function handler(event, context) {
  const { cloudId } = resolveScope(context);
  const settings = await loadSettings(kvs, cloudId);
  if (!settings.dailySync) {
    console.log('[atlasync] daily snapshot: daily sync is off, skipping.');
    return { skipped: true, reason: 'daily-sync-off' };
  }
  const report = await buildReadinessReport({
    fetchJiraIssues: () => fetchJiraSnapshotIssues(50),
    fetchConfluencePages: () => fetchConfluenceSnapshotPages(10),
    fetchJsmRequests: () => fetchJsmSnapshotRequests(50),
    countStalePrsForIssues,
  });
  if (!report.ok) {
    console.log('[atlasync] daily snapshot: readiness unavailable, nothing stored.');
    return { skipped: true, reason: 'readiness-unavailable' };
  }
  const date = todayDateString();
  await storeSnapshot(kvs, cloudId, date, report);
  console.log(`[atlasync] daily snapshot stored for ${date}: score ${report.score}.`);
  return { stored: true, date, score: report.score };
}
