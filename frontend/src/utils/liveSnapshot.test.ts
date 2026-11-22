// Tests for the shared live-fetch windows (frontend/src/utils/liveSnapshot.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/utils/liveSnapshot.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { LIVE_FETCH_LIMITS, snapshotDefinitionLine } from './liveSnapshot.ts';

// Fix #7: every surface's fetch window lives here, so the same
// workspace stops showing different counts with no stated reason.
test('fetch windows state one cap per surface per source', () => {
  assert.deepEqual(LIVE_FETCH_LIMITS.insights, { jira: 50, confluence: 50, jsm: 50 });
  assert.deepEqual(LIVE_FETCH_LIMITS.search, { jira: 25, confluence: 20, jsm: 20 });
  assert.deepEqual(LIVE_FETCH_LIMITS.briefing, { jira: 25, confluence: 20, jsm: 20 });
  assert.deepEqual(LIVE_FETCH_LIMITS.askSnapshot, { jira: 10, confluence: 10, jsm: 10 });
  assert.deepEqual(LIVE_FETCH_LIMITS.teaser, { jira: 25 });
  assert.deepEqual(LIVE_FETCH_LIMITS.projects, { jira: 50 });
});

test('snapshot definition line names the window for the surface', () => {
  assert.equal(snapshotDefinitionLine('insights'), 'Latest 50 Jira issues · 50 Confluence pages · 50 JSM requests');
  assert.equal(snapshotDefinitionLine('search'), 'Latest 25 Jira issues · 20 Confluence pages · 20 JSM requests');
  assert.equal(snapshotDefinitionLine('teaser'), 'Latest 25 Jira issues');
  assert.equal(snapshotDefinitionLine('askSnapshot'), 'Latest 10 Jira issues · 10 Confluence pages · 10 JSM requests');
});
