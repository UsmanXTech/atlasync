// Atlasync v2.1.0 — daily readiness snapshot (scheduled trigger).
//
// DISABLED 2026-11-21 (P0 security review): the `scheduledTrigger`
// module was removed from the manifest. A scheduled trigger runs
// without an interactive user context, so `api.asUser()` has no user
// to act as, and the trigger context may not carry cloudId —
// resolveScope falls back to the shared 'default' segment. Storing a
// snapshot from that context would silently persist
// user-permission-filtered records into shared app storage, which the
// README forbids. Do NOT re-add the trigger (and do NOT switch the
// fetchers to asApp() — that changes the permission model) until the
// snapshot identity and data-ownership model is redesigned.
// The handler below is kept, unreachable, so the redesign can reuse it.
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
