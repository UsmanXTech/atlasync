// Tests for the v2.1.0 KVS memory helpers (forge-app/src/memory.js).
// Pure + store-injected logic only — the fake store below mimics the
// @forge/kvs surface (get/set/delete + query().where().limit().getMany())
// with a plain Map. No Forge runtime, no live Atlassian calls.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_SETTINGS,
  MAX_CONVERSATIONS,
  MAX_SNAPSHOTS,
  MAX_THREAD_TURNS,
  PENDING_ACTION_CLAIM_TTL_MS,
  PENDING_ACTION_TTL_MS,
  appendConversationTurn,
  appendThreadTurn,
  claimPendingAction,
  clearThread,
  consumePendingAction,
  conversationTitleFromQuestion,
  createConversation,
  deleteConversation,
  deletePendingAction,
  emptyThread,
  isPendingActionExpired,
  listConversations,
  listSnapshots,
  loadConversation,
  loadPendingAction,
  loadSettings,
  loadThread,
  listExecutionRuns,
  listPendingActions,
  normalizeExecutionRun,
  pendingActionClaimKey,
  pendingActionKey,
  recordExecutionRun,
  releasePendingActionClaim,
  renameConversation,
  resolveScope,
  sanitizeSourceCounts,
  saveSettings,
  settingsKey,
  snapshotKey,
  snapshotPrefix,
  storePendingAction,
  storeSnapshot,
  threadKey,
  todayDateString,
  updateLastReadiness,
  validateSettings,
} from '../src/memory.js';

function fakeStore() {
  const map = new Map();
  return {
    map,
    async get(key) {
      return map.get(key);
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    query() {
      let prefix = '';
      let limit = 30;
      let cursor;
      const builder = {
        where(_property, clause) {
          prefix = clause && Array.isArray(clause.values) ? clause.values[0] : '';
          return builder;
        },
        limit(n) {
          limit = n;
          return builder;
        },
        cursor(c) {
          cursor = c;
          return builder;
        },
        async getMany() {
          // Mimics the real KVS list: keys ascending, paged by cursor.
          const keys = [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
          const start = cursor ? parseInt(cursor, 10) || 0 : 0;
          const page = keys.slice(start, start + limit);
          const results = page.map((key) => ({ key, value: map.get(key) }));
          const nextCursor = start + limit < keys.length ? String(start + limit) : undefined;
          return { results, nextCursor };
        },
      };
      return builder;
    },
  };
}

describe('resolveScope', () => {
  it('uses context cloudId/accountId when present', () => {
    assert.deepEqual(resolveScope({ cloudId: 'cloud-1', accountId: 'acct-9' }), {
      cloudId: 'cloud-1',
      accountId: 'acct-9',
    });
  });

  it('falls back to default segments when context is empty', () => {
    assert.deepEqual(resolveScope({}), { cloudId: 'default', accountId: 'default' });
    assert.deepEqual(resolveScope(undefined), { cloudId: 'default', accountId: 'default' });
    assert.deepEqual(resolveScope({ cloudId: '  ', accountId: 42 }), {
      cloudId: 'default',
      accountId: 'default',
    });
  });
});

describe('KVS keys', () => {
  it('builds the three key shapes from the plan', () => {
    assert.equal(settingsKey('c1'), 'settings:c1');
    assert.equal(threadKey('c1', 'a1'), 'agent-thread:c1:a1');
    assert.equal(snapshotKey('c1', '2026-11-21'), 'snapshot:c1:2026-11-21');
    assert.equal(snapshotPrefix('c1'), 'snapshot:c1:');
  });

  it('todayDateString formats a UTC date', () => {
    assert.equal(todayDateString(new Date('2026-11-21T03:00:00.000Z')), '2026-11-21');
  });
});

describe('validateSettings', () => {
  it('returns defaults for null, array or missing input', () => {
    assert.deepEqual(validateSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(validateSettings([]), DEFAULT_SETTINGS);
    assert.deepEqual(validateSettings({}), DEFAULT_SETTINGS);
  });

  it('keeps valid booleans and drops unknown keys', () => {
    assert.deepEqual(validateSettings({ dailySync: false, weeklyDigest: true, bogus: 1 }), {
      dailySync: false,
      incidentAlerts: true,
      weeklyDigest: true,
    });
  });

  it('falls back per-field on mistyped values', () => {
    assert.deepEqual(validateSettings({ dailySync: 'yes', incidentAlerts: 0 }), {
      dailySync: true,
      incidentAlerts: true,
      weeklyDigest: false,
    });
  });
});

describe('settings round-trip', () => {
  it('loadSettings returns defaults on an empty store', async () => {
    const store = fakeStore();
    assert.deepEqual(await loadSettings(store, 'c1'), DEFAULT_SETTINGS);
  });

  it('saveSettings persists the sanitized toggles', async () => {
    const store = fakeStore();
    const saved = await saveSettings(store, 'c1', { dailySync: false });
    assert.equal(saved.dailySync, false);
    assert.deepEqual(await loadSettings(store, 'c1'), saved);
  });

  it('loadSettings sanitizes garbage already in the store', async () => {
    const store = fakeStore();
    await store.set(settingsKey('c1'), { dailySync: 'on', extra: true });
    assert.deepEqual(await loadSettings(store, 'c1'), DEFAULT_SETTINGS);
  });
});

describe('thread', () => {
  it('loadThread returns an empty thread on an empty store', async () => {
    const store = fakeStore();
    assert.deepEqual(await loadThread(store, 'c1', 'a1'), emptyThread());
  });

  it('appendThreadTurn caps at the last 10 turns, oldest dropped', async () => {
    const store = fakeStore();
    for (let i = 1; i <= MAX_THREAD_TURNS + 2; i++) {
      await appendThreadTurn(store, 'c1', 'a1', { question: `q${i}`, answer: `a${i}` });
    }
    const thread = await loadThread(store, 'c1', 'a1');
    assert.equal(thread.turns.length, MAX_THREAD_TURNS);
    assert.equal(thread.turns[0].question, 'q3');
    assert.equal(thread.turns[thread.turns.length - 1].question, 'q12');
  });

  it('appendThreadTurn stores lastReadiness only when given', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', { question: 'q', answer: 'a' });
    assert.equal((await loadThread(store, 'c1', 'a1')).lastReadiness, null);
    const readiness = { score: 72, breakdown: { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 0 }, generatedAt: '2026-11-21T00:00:00.000Z' };
    await appendThreadTurn(store, 'c1', 'a1', { question: 'q2', answer: 'a2' }, readiness);
    const thread = await loadThread(store, 'c1', 'a1');
    assert.deepEqual(thread.lastReadiness, readiness);
    assert.equal(thread.turns.length, 2);
  });

  it('appendThreadTurn stores citations on the turn, sanitized', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', {
      question: 'q',
      answer: 'a',
      citations: [
        { kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' },
        { kind: 'confluence', key: '12', title: 'Runbook', url: 'https://x/wiki/spaces/AT/pages/12' },
        { kind: 'jira', key: '', title: 'no key' },
        { kind: 'unknown', key: 'X-1', title: 'bad kind' },
        { kind: 'jira', key: 'AT-2', title: 42 },
        'junk',
      ],
    });
    const thread = await loadThread(store, 'c1', 'a1');
    assert.deepEqual(thread.turns[0].citations, [
      { kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' },
      { kind: 'confluence', key: '12', title: 'Runbook', url: 'https://x/wiki/spaces/AT/pages/12' },
    ]);
  });

  it('appendThreadTurn omits citations when none are given', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', { question: 'q', answer: 'a' });
    assert.equal('citations' in (await loadThread(store, 'c1', 'a1')).turns[0], false);
  });

  it('appendConversationTurn stores citations on the turn', async () => {
    const store = fakeStore();
    const created = await createConversation(store, 'c1', 'a1');
    await appendConversationTurn(store, 'c1', 'a1', created.id, {
      question: 'q',
      answer: 'a',
      citations: [{ kind: 'jsm', key: 'AS-1', title: 'VPN access', path: '/browse/AS-1' }],
    });
    const loaded = await loadConversation(store, 'c1', 'a1', created.id);
    assert.deepEqual(loaded.turns[0].citations, [{ kind: 'jsm', key: 'AS-1', title: 'VPN access', path: '/browse/AS-1' }]);
  });

  it('updateLastReadiness changes the score without appending a turn', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', { question: 'q', answer: 'a' });
    await updateLastReadiness(store, 'c1', 'a1', { score: 90 });
    const thread = await loadThread(store, 'c1', 'a1');
    assert.equal(thread.turns.length, 1);
    assert.deepEqual(thread.lastReadiness, { score: 90 });
  });

  it('clearThread removes the thread', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', { question: 'q', answer: 'a' });
    await clearThread(store, 'c1', 'a1');
    assert.deepEqual(await loadThread(store, 'c1', 'a1'), emptyThread());
  });

  it('loadThread discards malformed stored turns', async () => {
    const store = fakeStore();
    await store.set(threadKey('c1', 'a1'), { turns: [{ question: 'q' }, { question: 'ok', answer: 'fine' }, 'junk'], lastReadiness: 'nope' });
    const thread = await loadThread(store, 'c1', 'a1');
    assert.equal(thread.turns.length, 1);
    assert.equal(thread.lastReadiness, null);
  });
});

describe('pending actions (Phase B)', () => {
  it('stores, loads and deletes a pending action', async () => {
    const store = fakeStore();
    const record = await storePendingAction(store, 'c1', 'a1', {
      tool: 'escalate_jira_blocker',
      args: { issueKey: 'ATLAS-482', comment: 'c', priority: 'Highest' },
      preview: { tool: 'escalate_jira_blocker', target: 'ATLAS-482', params: {} },
      trace: [],
      messages: [],
      prompt: 'Escalate ATLAS-482.',
    });
    assert.equal(record.threadId, 'agent-thread:c1:a1');
    assert.match(record.actionId, /^act_/);
    const loaded = await loadPendingAction(store, 'c1', 'a1', record.actionId);
    assert.equal(loaded.tool, 'escalate_jira_blocker');
    assert.deepEqual(loaded.args, { issueKey: 'ATLAS-482', comment: 'c', priority: 'Highest' });
    assert.equal(await loadPendingAction(store, 'c1', 'a1', 'act_nope'), null);
    assert.equal(await loadPendingAction(store, 'c2', 'a1', record.actionId), null);
    assert.equal(await loadPendingAction(store, 'c1', 'a1', ''), null);
    await deletePendingAction(store, 'c1', 'a1', record.actionId);
    assert.equal(await loadPendingAction(store, 'c1', 'a1', record.actionId), null);
  });

  it('listPendingActions returns unexpired actions, newest first', async () => {
    const store = fakeStore();
    const first = await storePendingAction(store, 'c1', 'a1', {
      tool: 'escalate_jira_blocker',
      args: { issueKey: 'AT-1', comment: 'c', priority: 'Highest' },
      preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: {} },
      trace: [],
      messages: [],
      prompt: 'Escalate AT-1.',
    });
    const second = await storePendingAction(store, 'c1', 'a1', {
      tool: 'transition_jira_issue',
      args: { issueKey: 'AT-2', transitionName: 'In Progress' },
      preview: { tool: 'transition_jira_issue', target: 'AT-2', params: {} },
      trace: [],
      messages: [],
      prompt: 'Move AT-2.',
    });
    // Pin distinct createdAt values near now: two stores in the same
    // millisecond would tie on the sort and make newest-first flaky,
    // and fixed old dates would trip the 10-min TTL filter.
    const nowMs = Date.now();
    const firstRecord = await store.get(pendingActionKey('c1', 'a1', first.actionId));
    const secondRecord = await store.get(pendingActionKey('c1', 'a1', second.actionId));
    await store.set(pendingActionKey('c1', 'a1', first.actionId), { ...firstRecord, createdAt: new Date(nowMs - 60 * 1000).toISOString() });
    await store.set(pendingActionKey('c1', 'a1', second.actionId), { ...secondRecord, createdAt: new Date(nowMs - 30 * 1000).toISOString() });
    // A stale record (past the 10-min TTL) and a malformed one are
    // filtered out, never surfaced as an approval card.
    await store.set(pendingActionKey('c1', 'a1', 'act_old'), {
      actionId: 'act_old',
      threadId: 'agent-thread:c1:a1',
      tool: 'escalate_jira_blocker',
      preview: { tool: 'escalate_jira_blocker', target: 'AT-9', params: {} },
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });    await store.set(pendingActionKey('c1', 'a1', 'act_bad'), {
      actionId: 'act_bad',
      threadId: 'agent-thread:c1:a1',
      tool: 'escalate_jira_blocker',
      createdAt: new Date().toISOString(),
    });
    // Another user's record must not leak across accounts.
    await storePendingAction(store, 'c1', 'a2', {
      tool: 'escalate_jira_blocker',
      args: { issueKey: 'AT-3', comment: 'c', priority: 'Highest' },
      preview: { tool: 'escalate_jira_blocker', target: 'AT-3', params: {} },
      trace: [],
      messages: [],
      prompt: 'Escalate AT-3.',
    });
    const list = await listPendingActions(store, 'c1', 'a1');
    assert.equal(list.length, 2);
    assert.equal(list[0].actionId, second.actionId);
    assert.equal(list[1].actionId, first.actionId);
  });
});

describe('pending actions — P0 hardening (claim + TTL)', () => {
  function pendingFixture() {
    return {
      tool: 'transition_jira_issue',
      args: { issueKey: 'AT-1', transitionName: 'Done' },
      preview: { tool: 'transition_jira_issue', target: 'AT-1', params: {} },
      trace: [],
      messages: [],
      prompt: 'Move AT-1 to Done.',
    };
  }

  // Every store op yields to the event loop, so two concurrent claims
  // interleave the way two Forge invocations would.
  function yieldingStore() {
    const base = fakeStore();
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    return {
      ...base,
      async get(key) {
        await tick();
        return base.get(key);
      },
      async set(key, value) {
        await tick();
        return base.set(key, value);
      },
      async delete(key) {
        await tick();
        return base.delete(key);
      },
    };
  }

  it('isPendingActionExpired enforces the 10-minute TTL', () => {
    assert.equal(isPendingActionExpired({ createdAt: new Date().toISOString() }), false);
    const stale = { createdAt: new Date(Date.now() - (PENDING_ACTION_TTL_MS + 1000)).toISOString() };
    assert.equal(isPendingActionExpired(stale), true);
    assert.equal(isPendingActionExpired({}), true);
    assert.equal(isPendingActionExpired({ createdAt: 'not-a-date' }), true);
    assert.equal(isPendingActionExpired(null), true);
  });

  it('loadPendingAction rejects expired records and cleans them up', async () => {
    const store = fakeStore();
    const record = await storePendingAction(store, 'c1', 'a1', pendingFixture());
    const key = pendingActionKey('c1', 'a1', record.actionId);
    await store.set(key, {
      ...record,
      createdAt: new Date(Date.now() - (PENDING_ACTION_TTL_MS + 60_000)).toISOString(),
    });
    assert.equal(await loadPendingAction(store, 'c1', 'a1', record.actionId), null);
    assert.equal(await store.get(key), undefined);
  });

  it('claimPendingAction: first claim wins, second fails, release frees it', async () => {
    const store = fakeStore();
    const record = await storePendingAction(store, 'c1', 'a1', pendingFixture());
    const first = await claimPendingAction(store, 'c1', 'a1', record.actionId);
    assert.ok(first);
    assert.equal(first.record.actionId, record.actionId);
    assert.equal(await claimPendingAction(store, 'c1', 'a1', record.actionId), null);
    // Releasing a foreign claim id must not free the real claim.
    await releasePendingActionClaim(store, 'c1', 'a1', record.actionId, 'claim_not_mine');
    assert.equal(await claimPendingAction(store, 'c1', 'a1', record.actionId), null);
    await releasePendingActionClaim(store, 'c1', 'a1', record.actionId, first.claimId);
    assert.ok(await claimPendingAction(store, 'c1', 'a1', record.actionId));
  });

  it('claimPendingAction refuses missing and expired actions', async () => {
    const store = fakeStore();
    assert.equal(await claimPendingAction(store, 'c1', 'a1', 'act_nope'), null);
    const record = await storePendingAction(store, 'c1', 'a1', pendingFixture());
    const key = pendingActionKey('c1', 'a1', record.actionId);
    await store.set(key, {
      ...record,
      createdAt: new Date(Date.now() - (PENDING_ACTION_TTL_MS + 1000)).toISOString(),
    });
    assert.equal(await claimPendingAction(store, 'c1', 'a1', record.actionId), null);
  });

  it('a stale claim (owner crashed) can be stolen', async () => {
    const store = fakeStore();
    const record = await storePendingAction(store, 'c1', 'a1', pendingFixture());
    const first = await claimPendingAction(store, 'c1', 'a1', record.actionId);
    assert.ok(first);
    // Age the claim past the claim TTL without touching the record.
    await store.set(pendingActionClaimKey('c1', 'a1', record.actionId), {
      claimId: first.claimId,
      claimedAt: new Date(Date.now() - (PENDING_ACTION_CLAIM_TTL_MS + 1000)).toISOString(),
    });
    assert.ok(await claimPendingAction(store, 'c1', 'a1', record.actionId));
  });

  it('concurrent claims: exactly one approval wins', async () => {
    const store = yieldingStore();
    const record = await storePendingAction(store, 'c1', 'a1', pendingFixture());
    const [first, second] = await Promise.all([
      claimPendingAction(store, 'c1', 'a1', record.actionId),
      claimPendingAction(store, 'c1', 'a1', record.actionId),
    ]);
    assert.equal([first, second].filter(Boolean).length, 1);
  });

  it('consumePendingAction throws when the delete fails (fail closed)', async () => {
    const base = fakeStore();
    const record = await storePendingAction(base, 'c1', 'a1', pendingFixture());
    const failingStore = {
      ...base,
      async delete() {
        throw new Error('kvs down');
      },
    };
    await assert.rejects(consumePendingAction(failingStore, 'c1', 'a1', record.actionId, 'claim_x'));
  });
});

describe('snapshots', () => {
  it('listSnapshots returns newest first and excludes other installs', async () => {
    const store = fakeStore();
    await storeSnapshot(store, 'c1', '2026-11-19', { score: 80, breakdown: {}, counts: {}, generatedAt: '2026-11-19T00:00:00.000Z' });
    await storeSnapshot(store, 'c1', '2026-11-21', { score: 88, breakdown: {}, counts: {}, generatedAt: '2026-11-21T00:00:00.000Z' });
    await storeSnapshot(store, 'c1', '2026-11-20', { score: 84, breakdown: {}, counts: {}, generatedAt: '2026-11-20T00:00:00.000Z' });
    await storeSnapshot(store, 'c2', '2026-11-21', { score: 10, breakdown: {}, counts: {}, generatedAt: '2026-11-21T00:00:00.000Z' });
    const list = await listSnapshots(store, 'c1');
    assert.deepEqual(list.map((s) => s.date), ['2026-11-21', '2026-11-20', '2026-11-19']);
    assert.deepEqual(list.map((s) => s.score), [88, 84, 80]);
  });

  it('listSnapshots caps at MAX_SNAPSHOTS', async () => {
    const store = fakeStore();
    const base = new Date('2026-01-01T00:00:00.000Z').getTime();
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) {
      const date = new Date(base + i * 86400000).toISOString().slice(0, 10);
      await storeSnapshot(store, 'c1', date, { score: i, breakdown: {}, counts: {}, generatedAt: `${date}T00:00:00.000Z` });
    }
    const list = await listSnapshots(store, 'c1');
    assert.equal(list.length, MAX_SNAPSHOTS);
    assert.equal(list[0].date, '2026-02-04');
  });

  it('listSnapshots returns an empty list when nothing is stored', async () => {
    assert.deepEqual(await listSnapshots(fakeStore(), 'c1'), []);
  });
});

describe('execution history (Phase 2)', () => {
  const run = (overrides = {}) => ({
    question: 'What is blocking the release?',
    status: 'COMPLETE',
    trace: [{ step: 1, tool: 'get_jira_blockers', args: '{"projectKey":"AT"}', status: 'ok', durationMs: 253 }],
    citations: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout' }],
    generatedAt: '2026-11-21T15:53:53.000Z',
    conversationId: 'conv_1',
    ...overrides,
  });

  it('records a run and lists it newest first, excluding other installs', async () => {
    const store = fakeStore();
    await recordExecutionRun(store, 'c1', run({ generatedAt: '2026-11-21T15:00:00.000Z' }));
    await recordExecutionRun(store, 'c1', run({ generatedAt: '2026-11-21T16:00:00.000Z', status: 'AWAITING_APPROVAL', tool: 'escalate_jira_blocker', target: 'AT-1' }));
    await recordExecutionRun(store, 'c2', run({ generatedAt: '2026-11-21T17:00:00.000Z' }));
    const list = await listExecutionRuns(store, 'c1');
    assert.equal(list.length, 2);
    assert.equal(list[0].status, 'AWAITING_APPROVAL');
    assert.equal(list[0].tool, 'escalate_jira_blocker');
    assert.equal(list[0].target, 'AT-1');
    assert.equal(list[1].status, 'COMPLETE');
    assert.equal(list[0].citations[0].key, 'AT-1');
  });

  it('caps the list at MAX_EXECUTION_RUNS', async () => {
    const store = fakeStore();
    const base = new Date('2026-11-01T00:00:00.000Z').getTime();
    for (let i = 0; i < 25; i++) {
      await recordExecutionRun(store, 'c1', run({ generatedAt: new Date(base + i * 60000).toISOString() }));
    }
    const list = await listExecutionRuns(store, 'c1');
    assert.equal(list.length, 20);
    assert.equal(list[0].generatedAt, new Date(base + 24 * 60000).toISOString());
  });

  it('rejects unknown statuses and missing questions', async () => {
    const store = fakeStore();
    assert.equal(await recordExecutionRun(store, 'c1', run({ status: 'BOGUS' })), null);
    assert.equal(await recordExecutionRun(store, 'c1', run({ question: '   ' })), null);
    assert.equal(await recordExecutionRun(store, 'c1', run({ question: undefined })), null);
    assert.deepEqual(await listExecutionRuns(store, 'c1'), []);
  });

  it('truncates long questions and caps trace/citations', async () => {
    const entry = normalizeExecutionRun(
      run({
        question: 'x'.repeat(600),
        trace: Array.from({ length: 30 }, (_, i) => ({ step: i, tool: 't', args: '{}', status: 'ok', durationMs: 1 })),
        citations: Array.from({ length: 15 }, (_, i) => ({ kind: 'jira', key: `AT-${i}`, title: 't' })),
      }),
    );
    assert.equal(entry.question.length, 500);
    assert.equal(entry.trace.length, 20);
    assert.equal(entry.citations.length, 10);
  });

  it('listExecutionRuns returns an empty list when nothing is stored', async () => {
    assert.deepEqual(await listExecutionRuns(fakeStore(), 'c1'), []);
  });
});

describe('conversations (Phase 1)', () => {
  it('creates, lists, renames and deletes a conversation', async () => {
    const store = fakeStore();
    const created = await createConversation(store, 'c1', 'a1', 'Release check');
    assert.ok(created.id.startsWith('conv_'));
    assert.equal(created.title, 'Release check');
    assert.deepEqual(created.turns, []);
    let list = await listConversations(store, 'c1', 'a1');
    assert.equal(list.length, 1);
    assert.equal(list[0].turnCount, 0);
    const renamed = await renameConversation(store, 'c1', 'a1', created.id, '  Checkout risk  ');
    assert.equal(renamed.title, 'Checkout risk');
    list = await listConversations(store, 'c1', 'a1');
    assert.equal(list[0].title, 'Checkout risk');
    assert.equal(await deleteConversation(store, 'c1', 'a1', created.id), true);
    assert.equal(await deleteConversation(store, 'c1', 'a1', created.id), false);
    assert.deepEqual(await listConversations(store, 'c1', 'a1'), []);
  });

  it('rejects empty and over-long titles on rename', async () => {
    const store = fakeStore();
    const created = await createConversation(store, 'c1', 'a1');
    assert.equal(await renameConversation(store, 'c1', 'a1', created.id, '   '), null);
    assert.equal(await renameConversation(store, 'c1', 'a1', created.id, 'x'.repeat(81)), null);
    assert.equal(await renameConversation(store, 'c1', 'a1', 'conv_missing', 'New'), null);
  });

  it('auto-titles from the first question and caps turns at 10', async () => {
    const store = fakeStore();
    const created = await createConversation(store, 'c1', 'a1');
    assert.equal(created.title, 'New conversation');
    for (let i = 0; i < 12; i += 1) {
      await appendConversationTurn(store, 'c1', 'a1', created.id, {
        question: `What is blocking the release number ${i}?`,
        answer: `Answer ${i}`,
      });
    }
    const loaded = await loadConversation(store, 'c1', 'a1', created.id);
    assert.equal(loaded.turns.length, 10);
    assert.equal(loaded.turns[0].question, 'What is blocking the release number 2?');
    assert.equal(loaded.title, 'What is blocking the release number 0?');
    const list = await listConversations(store, 'c1', 'a1');
    assert.equal(list[0].turnCount, 10);
  });

  it('migrates the legacy thread once, and never re-migrates after delete-all', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', { question: 'Old question', answer: 'Old answer' });
    let list = await listConversations(store, 'c1', 'a1');
    assert.equal(list.length, 1);
    assert.equal(list[0].title, 'Previous conversation');
    assert.equal(list[0].turnCount, 1);
    const full = await loadConversation(store, 'c1', 'a1', list[0].id);
    assert.equal(full.turns[0].question, 'Old question');
    // Delete it: the legacy thread must NOT resurrect on the next list.
    await deleteConversation(store, 'c1', 'a1', list[0].id);
    list = await listConversations(store, 'c1', 'a1');
    assert.deepEqual(list, []);
  });

  it('caps the conversation list at MAX_CONVERSATIONS, dropping the oldest record', async () => {
    const store = fakeStore();
    const ids = [];
    for (let i = 0; i < MAX_CONVERSATIONS + 1; i += 1) {
      const c = await createConversation(store, 'c1', 'a1', `Conv ${i}`);
      ids.push(c.id);
    }
    const list = await listConversations(store, 'c1', 'a1');
    assert.equal(list.length, MAX_CONVERSATIONS);
    assert.equal(await loadConversation(store, 'c1', 'a1', ids[0]), null);
    assert.ok(await loadConversation(store, 'c1', 'a1', ids[MAX_CONVERSATIONS]));
  });

  it('conversationTitleFromQuestion trims and truncates', () => {
    assert.equal(conversationTitleFromQuestion('  hello   world  '), 'hello world');
    assert.equal(conversationTitleFromQuestion(''), 'New conversation');
    assert.equal(conversationTitleFromQuestion('x'.repeat(50)).length, 41);
  });
});

describe('sourceCounts on turns (fix #4)', () => {
  it('sanitizeSourceCounts keeps the four buckets, drops malformed values', () => {
    assert.deepEqual(sanitizeSourceCounts({ jira: 3, confluence: 1, jsm: 0, bitbucket: 2 }), {
      jira: 3,
      confluence: 1,
      jsm: 0,
      bitbucket: 2,
    });
    assert.deepEqual(sanitizeSourceCounts({ jira: '3', jsm: -1, bitbucket: 1.9 }), {
      jira: 0,
      confluence: 0,
      jsm: 0,
      bitbucket: 1,
    });
    assert.equal(sanitizeSourceCounts({ jira: 0, confluence: 0, jsm: 0, bitbucket: 0 }), null);
    assert.equal(sanitizeSourceCounts(null), null);
    assert.equal(sanitizeSourceCounts('junk'), null);
  });

  it('appendThreadTurn stores sourceCounts on the turn, omits them when all zero', async () => {
    const store = fakeStore();
    await appendThreadTurn(store, 'c1', 'a1', {
      question: 'q',
      answer: 'a',
      sourceCounts: { jira: 3, confluence: 1, jsm: 0, bitbucket: 2 },
    });
    await appendThreadTurn(store, 'c1', 'a1', {
      question: 'q2',
      answer: 'a2',
      sourceCounts: { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 },
    });
    const thread = await loadThread(store, 'c1', 'a1');
    assert.deepEqual(thread.turns[0].sourceCounts, { jira: 3, confluence: 1, jsm: 0, bitbucket: 2 });
    assert.equal('sourceCounts' in thread.turns[1], false);
  });

  it('storePendingAction keeps sanitized sourceCounts for the approval outcome', async () => {
    const store = fakeStore();
    const record = await storePendingAction(store, 'c1', 'a1', {
      tool: 'escalate_jira_blocker',
      args: { issueKey: 'AT-1' },
      preview: { tool: 'escalate_jira_blocker', target: 'AT-1', params: {} },
      sourceCounts: { jira: 2, confluence: 0, jsm: 0, bitbucket: 1 },
    });
    assert.deepEqual(record.sourceCounts, { jira: 2, confluence: 0, jsm: 0, bitbucket: 1 });
    const loaded = await loadPendingAction(store, 'c1', 'a1', record.actionId);
    assert.deepEqual(loaded.sourceCounts, { jira: 2, confluence: 0, jsm: 0, bitbucket: 1 });
  });
});
