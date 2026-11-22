import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBriefingDigest } from './briefing.ts';
import type { LiveIssue } from '../data/types';

const now = new Date('2026-11-10T12:00:00.000Z');
const issue = (key: string, priority: string | null, status: string, updated: string): LiveIssue => ({
  key, id: null, summary: `Summary ${key}`, priority, status, updated, assignee: null,
});

test('briefing ranks open Highest and High issues first and excludes completed work', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'High', 'In Progress', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'Highest', 'To Do', '2026-11-08T12:00:00.000Z'),
    issue('ATL-3', 'Highest', 'Done', '2026-11-01T12:00:00.000Z'),
    issue('ATL-4', 'Medium', 'Open', '2026-11-07T12:00:00.000Z'),
  ], now);
  assert.deepEqual(digest.blockers.map((item) => item.key), ['ATL-2', 'ATL-1']);
  assert.equal(digest.totalOpen, 3);
});

test('briefing lists the oldest open work first, with age in whole days', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Low', 'Open', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'High', 'Open', '2026-11-01T00:00:00.000Z'),
    issue('ATL-3', 'Highest', 'Closed', '2026-10-01T00:00:00.000Z'),
  ], now);
  assert.deepEqual(digest.staleItems.map((item) => item.key), ['ATL-2', 'ATL-1']);
  assert.equal(digest.staleItems[0].ageDays, 9);
});

// The digest no longer scores readiness: the old frontend formula
// (Highest −15 / High −8 / Medium −3 / Low −1) is REMOVED — the
// briefing shows the backend getReadiness score instead, so it can
// never disagree with Overview again (live review 2026-11-21: this
// formula scored 63% while Overview showed 78% for the same
// workspace). The backend score is covered by the readiness tests in
// forge-app/tests/readiness.test.js; the previous assertions on
// score 85 / total 2 are deleted with this test, not moved.
test('briefing digest carries no readiness score of its own', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Highest', 'Open', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'Low', 'Done', '2026-11-08T12:00:00.000Z'),
  ], now);
  assert.equal('readiness' in digest, false);
  assert.equal(digest.totalOpen, 1);
  const empty = computeBriefingDigest([], now);
  assert.equal(empty.totalOpen, 0);
});

test('briefing does not invent an age when Jira updated timestamp is missing', () => {
  const digest = computeBriefingDigest([issue('ATL-1', 'High', 'Open', '')], now);
  assert.equal(digest.staleItems[0].ageDays, null);
});

test('briefing puts blockers with unknown update dates after dated blockers', () => {
  const digest = computeBriefingDigest([
    issue('ATL-UNKNOWN', 'Highest', 'Open', ''),
    issue('ATL-OLD', 'Highest', 'Open', '2026-11-01T00:00:00.000Z'),
    issue('ATL-NEW', 'Highest', 'Open', '2026-11-08T00:00:00.000Z'),
  ], now);
  assert.deepEqual(digest.blockers.map((item) => item.key), ['ATL-OLD', 'ATL-NEW', 'ATL-UNKNOWN']);
});

test('briefing sorts work with an unknown updated date last in stale work', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Low', 'Open', ''),
    issue('ATL-2', 'Low', 'Open', '2026-11-09T12:00:00.000Z'),
    issue('ATL-3', 'Low', 'Open', '2026-11-01T00:00:00.000Z'),
  ], now);
  assert.deepEqual(digest.staleItems.map((item) => item.key), ['ATL-3', 'ATL-2', 'ATL-1']);
  assert.equal(digest.staleItems[2].ageDays, null);
});
