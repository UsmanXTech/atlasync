// Tests for the agent service validators (frontend/src/services/agent.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/services/agent.test.ts
// The invoke/approve calls need @forge/bridge and are NOT exercised
// here (they run inside the Forge iframe; see the hook).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { toSourceCounts } from './agent.ts';

// Source coverage validation (visual-behaviour-test fix #4): the
// backend's per-source row counts. Malformed buckets become 0; a
// non-record value is null so the hook falls back to counting
// citations (older backend / unexpected shape).
describe('toSourceCounts', () => {
  it('keeps the four buckets and floors fractional counts', () => {
    assert.deepEqual(toSourceCounts({ jira: 3, confluence: 1, jsm: 0, bitbucket: 2 }), {
      jira: 3,
      confluence: 1,
      jsm: 0,
      bitbucket: 2,
    });
    assert.deepEqual(toSourceCounts({ jira: 2.7, bitbucket: 1 }), {
      jira: 2,
      confluence: 0,
      jsm: 0,
      bitbucket: 1,
    });
  });

  it('coerces malformed buckets to 0', () => {
    assert.deepEqual(toSourceCounts({ jira: '3', jsm: -1, confluence: NaN }), {
      jira: 0,
      confluence: 0,
      jsm: 0,
      bitbucket: 0,
    });
  });

  it('returns null for non-record values', () => {
    assert.equal(toSourceCounts(null), null);
    assert.equal(toSourceCounts(undefined), null);
    assert.equal(toSourceCounts('junk'), null);
    assert.equal(toSourceCounts([1, 2]), null);
  });
});
