import test from 'node:test';
import assert from 'node:assert/strict';
import { isDoneStatus, jiraPriorityDistribution, jiraPriorityDistributionByStatus, jsmAgeBuckets, jiraStaleness } from './insightAnalysis.ts';
import type { LiveIssue, LiveJsmRequest } from '../data/types.ts';

const NOW = Date.parse('2026-11-21T12:00:00.000Z');

function issue(key: string, priority: string | null, updated: string): LiveIssue {
  return { key, id: null, summary: key, status: 'In Progress', priority, assignee: null, updated };
}

function request(key: string, created: string): LiveJsmRequest {
  return { key, summary: key, status: 'Open', requestType: 'Service request', priority: null, created };
}

test('jiraPriorityDistribution orders by severity and buckets missing priorities', () => {
  const buckets = jiraPriorityDistribution([
    issue('AT-1', 'Highest', '2026-11-20T00:00:00.000Z'),
    issue('AT-2', 'High', '2026-11-20T00:00:00.000Z'),
    issue('AT-3', null, '2026-11-20T00:00:00.000Z'),
    issue('AT-4', 'weird', '2026-11-20T00:00:00.000Z'),
  ]);
  assert.deepEqual(
    buckets.map((b) => b.label),
    ['Highest', 'High', 'Medium', 'Low', 'No priority'],
  );
  assert.deepEqual(
    buckets.map((b) => b.count),
    [1, 1, 0, 0, 2],
  );
});

test('jsmAgeBuckets splits by created age and counts unknown dates separately', () => {
  const { buckets, unknown } = jsmAgeBuckets(
    [
      request('A', '2026-11-20T00:00:00.000Z'),
      request('B', '2026-11-01T00:00:00.000Z'),
      request('C', '2026-09-01T00:00:00.000Z'),
      request('D', '2026-06-01T00:00:00.000Z'),
      request('E', ''),
      request('F', 'not-a-date'),
    ],
    NOW,
  );
  assert.deepEqual(
    buckets.map((b) => b.count),
    [1, 1, 1, 1],
  );
  assert.equal(unknown, 2);
});

test('jiraStaleness counts updated-in-window and never invents older work', () => {
  const { last7, last30, unknown } = jiraStaleness(
    [
      issue('AT-1', 'Highest', '2026-11-20T00:00:00.000Z'),
      issue('AT-2', 'High', '2026-11-01T00:00:00.000Z'),
      issue('AT-3', 'Medium', '2026-10-01T00:00:00.000Z'),
      issue('AT-4', 'Low', ''),
    ],
    NOW,
  );
  assert.equal(last7, 1);
  assert.equal(last30, 2);
  assert.equal(unknown, 1);
});

test('jiraPriorityDistributionByStatus splits open vs done (fix #7)', () => {
  const split = jiraPriorityDistributionByStatus([
    issue('AT-1', 'Highest', '2026-11-20T00:00:00.000Z'),
    { ...issue('AT-2', 'Highest', '2026-11-20T00:00:00.000Z'), status: 'Done' },
    { ...issue('AT-3', 'High', '2026-11-20T00:00:00.000Z'), status: 'Closed' },
    issue('AT-4', 'High', '2026-11-20T00:00:00.000Z'),
    { ...issue('AT-5', 'Medium', '2026-11-20T00:00:00.000Z'), status: 'Resolved' },
  ]);
  assert.deepEqual(
    split.open.map((b) => b.count),
    [1, 1, 0, 0, 0],
  );
  assert.deepEqual(
    split.done.map((b) => b.count),
    [1, 1, 1, 0, 0],
  );
  // The open column is what the briefing counts: Highest open is 1,
  // even though Highest total is 2.
  assert.equal(split.open[0].count, 1);
});
