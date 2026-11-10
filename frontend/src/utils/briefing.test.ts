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

test('briefing reuses the shared readiness estimate and reports empty snapshots honestly', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Highest', 'Open', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'Low', 'Done', '2026-11-08T12:00:00.000Z'),
  ], now);
  assert.equal(digest.readiness?.score, 85);
  assert.equal(digest.readiness?.total, 2);
  const empty = computeBriefingDigest([], now);
  assert.equal(empty.readiness, null);
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
