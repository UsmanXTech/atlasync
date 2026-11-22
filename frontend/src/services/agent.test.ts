// Tests for the agent service validators (frontend/src/services/agent.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/services/agent.test.ts
// The invoke/approve calls need @forge/bridge and are NOT exercised
// here (they run inside the Forge iframe; see the hook).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { toPendingActions, toSourceCounts } from './agent.ts';

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

// Pending-action payload validation (visual-behaviour-test fix #3):
// the listPendingActions resolver returns whatever KVS holds, so the
// frontend only renders well-formed proposals as approval cards.
describe('toPendingActions', () => {
  it('keeps well-formed proposals with trace and citations', () => {
    const out = toPendingActions([
      {
        actionId: 'act_1',
        threadId: 'agent-thread:c1:a1',
        preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: { comment: 'c', priority: 'Highest' } },
        createdAt: '2026-11-22T00:00:00.000Z',
        trace: [{ step: 1, tool: 'escalate_jira_blocker', args: '{}', status: 'awaiting-approval', durationMs: 0 }],
        citations: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }],
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].actionId, 'act_1');
    assert.equal(out[0].preview.tool, 'escalate_jira_blocker');
    assert.equal(out[0].trace?.length, 1);
    assert.equal(out[0].citations?.[0].key, 'AT-1');
  });

  it('drops malformed entries and non-arrays', () => {
    assert.deepEqual(toPendingActions(null), []);
    assert.deepEqual(toPendingActions({}), []);
    assert.deepEqual(
      toPendingActions([
        { actionId: 'act_1', threadId: 't', preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: {} } },
        { actionId: 'act_2', threadId: 't' },
        { actionId: 'act_3', threadId: 't', preview: { tool: 'escalate_jira_blocker', target: 'AT-1' } },
        { actionId: '', threadId: 't', preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: {} } },
        'junk',
      ]),
      [{ actionId: 'act_1', threadId: 't', preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: {} } }],
    );
  });

  it('tolerates missing trace and citations', () => {
    const out = toPendingActions([
      { actionId: 'act_1', threadId: 't', preview: { tool: 'transition_jira_issue', target: 'AT-2', params: {} } },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].trace, undefined);
    assert.equal(out[0].citations, undefined);
  });
});
