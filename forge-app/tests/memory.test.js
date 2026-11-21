// Tests for the v2.1.0 KVS memory helpers (forge-app/src/memory.js).
// Pure + store-injected logic only — the fake store below mimics the
// @forge/kvs surface (get/set/delete + query().where().limit().getMany())
// with a plain Map. No Forge runtime, no live Atlassian calls.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_SETTINGS,
  MAX_SNAPSHOTS,
  MAX_THREAD_TURNS,
  appendThreadTurn,
  clearThread,
  deletePendingAction,
  emptyThread,
  listSnapshots,
  loadPendingAction,
  loadSettings,
  loadThread,
  resolveScope,
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
