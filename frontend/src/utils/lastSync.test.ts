// Tests for the sidebar sync-time formatting (frontend/src/utils/lastSync.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/utils/lastSync.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSyncTime } from './lastSync.ts';

// Fix #8: the footer renders the last successful live fetch with date
// + timezone instead of the hardcoded "14:32".
test('formats an ISO timestamp with date, time and timezone', () => {
  const out = formatSyncTime('2026-11-22T09:32:00.000Z');
  assert.match(out, /Nov/);
  assert.match(out, /22/);
  assert.match(out, /\d{1,2}:\d{2}/);
  // A timezone abbreviation or offset must be present — the old
  // literal carried neither.
  assert.match(out, /([A-Z]{2,5}|GMT[+-]\d{1,2})/);
});

test('invalid timestamp degrades to the input instead of throwing', () => {
  assert.equal(formatSyncTime('not-a-date'), 'not-a-date');
});
