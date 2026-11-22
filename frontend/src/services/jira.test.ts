// Tests for the live Jira issue sort (frontend/src/services/jira.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/services/jira.test.ts
// The invoke() calls need @forge/bridge and are NOT exercised here
// (they run inside the Forge iframe); only the pure sort is tested.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { sortLiveIssues } from './jira.ts';
import type { LiveIssue } from '../data/types.ts';

const issue = (key: string, updated: string): LiveIssue => ({
  key,
  id: '10001',
  summary: `Summary ${key}`,
  status: 'To Do',
  priority: 'High',
  assignee: null,
  updated,
});

// Deterministic client-side order (visual-behaviour-test fix #6): the
// raw Jira API order shuffled between identical re-runs, so the card
// re-sorts every fetch — updated desc, then key asc as the tiebreak.
describe('sortLiveIssues', () => {
  it('sorts by updated desc, newest first', () => {
    const sorted = sortLiveIssues([
      issue('AT-2', '2026-11-01T10:00:00.000+0500'),
      issue('AT-1', '2026-11-09T10:00:00.000+0500'),
      issue('AT-3', '2026-11-05T10:00:00.000+0500'),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.key),
      ['AT-1', 'AT-3', 'AT-2'],
    );
  });

  it('breaks equal updated dates by key asc', () => {
    const sorted = sortLiveIssues([
      issue('AT-8', '2026-11-05T10:00:00.000+0500'),
      issue('AT-4', '2026-11-05T10:00:00.000+0500'),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.key),
      ['AT-4', 'AT-8'],
    );
  });

  it('sorts rows with no parseable updated date last, key asc among them', () => {
    const sorted = sortLiveIssues([
      issue('AT-9', ''),
      issue('AT-1', '2026-11-09T10:00:00.000+0500'),
      issue('AT-5', 'not a date'),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.key),
      ['AT-1', 'AT-5', 'AT-9'],
    );
  });

  it('does not mutate the input array', () => {
    const input = [issue('AT-2', '2026-11-01T10:00:00.000+0500'), issue('AT-1', '2026-11-09T10:00:00.000+0500')];
    const sorted = sortLiveIssues(input);
    assert.deepEqual(
      input.map((i) => i.key),
      ['AT-2', 'AT-1'],
    );
    assert.deepEqual(
      sorted.map((i) => i.key),
      ['AT-1', 'AT-2'],
    );
  });
});
