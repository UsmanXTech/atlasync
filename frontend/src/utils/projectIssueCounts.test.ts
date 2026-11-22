import test from 'node:test';
import assert from 'node:assert/strict';
import { countIssuesByProject } from './projectIssueCounts.ts';
import type { LiveIssue } from '../data/types.ts';

function issue(key: string, status: string, priority: string | null): LiveIssue {
  return { key, id: null, summary: key, status, priority, assignee: null, updated: '2026-11-21T00:00:00.000Z' };
}

test('countIssuesByProject groups by key prefix and counts open + blockers', () => {
  const counts = countIssuesByProject([
    issue('AT-1', 'In Progress', 'Highest'),
    issue('AT-2', 'To Do', 'Medium'),
    issue('AT-3', 'Done', 'Highest'),
    issue('AT-4', 'To Do', 'High'),
    issue('AS-1', 'In Progress', 'Critical'),
    issue('AS-2', 'Resolved', 'Critical'),
  ]);
  // Blockers are open issues at High priority or above — AT-4 (High)
  // counts; AT-2 (Medium) and AT-3 (Done) do not.
  assert.deepEqual(counts.get('AT'), { open: 3, blockers: 2 });
  assert.deepEqual(counts.get('AS'), { open: 1, blockers: 1 });
});

test('countIssuesByProject ignores closed statuses and unknown prefixes', () => {
  const counts = countIssuesByProject([
    issue('AT-1', 'Closed', 'Highest'),
    issue('AT-2', 'DONE', 'Medium'),
    issue('-9', 'In Progress', 'Highest'),
  ]);
  assert.deepEqual(counts.get('AT'), { open: 0, blockers: 0 });
  assert.equal(counts.has(''), false);
});
