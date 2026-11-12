import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBriefingDigest } from './briefing.ts';
import { pickBriefingTeaser } from './overviewBriefing.ts';
import type { LiveIssue } from '../data/types';

const now = new Date('2026-11-10T12:00:00.000Z');
const issue = (key: string, priority: string | null, status: string, updated: string): LiveIssue => ({
  key, id: null, summary: `Summary ${key}`, priority, status, updated, assignee: null,
});

test('teaser picks the top blocker and the oldest item untouched for 14+ days', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'Medium', 'Open', '2026-10-20T12:00:00.000Z'),
    issue('ATL-3', 'Low', 'Open', '2026-11-08T12:00:00.000Z'),
  ], now);
  const teaser = pickBriefingTeaser(digest);
  assert.equal(teaser.blocker?.key, 'ATL-1');
  assert.equal(teaser.stale?.key, 'ATL-2');
  assert.equal(teaser.stale?.ageDays, 21);
});

test('teaser never shows the same issue twice: the stale row falls to the next-oldest', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Highest', 'Open', '2026-10-01T12:00:00.000Z'),
    issue('ATL-2', 'Low', 'Open', '2026-10-20T12:00:00.000Z'),
  ], now);
  const teaser = pickBriefingTeaser(digest);
  assert.equal(teaser.blocker?.key, 'ATL-1');
  assert.equal(teaser.stale?.key, 'ATL-2');
});

test('teaser leaves the stale row empty when nothing is untouched for 14+ days', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Highest', 'Open', '2026-11-09T12:00:00.000Z'),
    issue('ATL-2', 'Low', 'Open', '2026-11-05T12:00:00.000Z'),
  ], now);
  const teaser = pickBriefingTeaser(digest);
  assert.equal(teaser.blocker?.key, 'ATL-1');
  assert.equal(teaser.stale, null);
});

test('teaser does not call an item stale when its updated date is unknown', () => {
  const digest = computeBriefingDigest([
    issue('ATL-1', 'Low', 'Open', ''),
    issue('ATL-2', 'Medium', 'Open', '2026-11-09T12:00:00.000Z'),
  ], now);
  const teaser = pickBriefingTeaser(digest);
  assert.equal(teaser.blocker, null);
  assert.equal(teaser.stale, null);
});

test('teaser reports both rows empty for an empty snapshot', () => {
  const teaser = pickBriefingTeaser(computeBriefingDigest([], now));
  assert.equal(teaser.blocker, null);
  assert.equal(teaser.stale, null);
});
