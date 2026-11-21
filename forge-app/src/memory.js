// Atlasync v2.1.0 — persistent memory over Forge KVS (@forge/kvs).
//
// KVS keys (per installation — Forge scopes KVS per app installation,
// so the cloudId/accountId segments below only separate data inside
// one install; they are not a security boundary):
//   settings:${cloudId}
//   agent-thread:${cloudId}:${accountId}   (last 10 turns + last readiness)
//   snapshot:${cloudId}:${YYYY-MM-DD}      (daily readiness snapshot)
//
// Every function takes the KVS store as its first argument — the real
// `kvs` object from '@forge/kvs' in production, a fake Map-backed
// store in unit tests. Nothing here imports @forge/kvs itself, so plain
// Node can test all of it. The store surface used is exactly:
// get(key), set(key, value), delete(key), and
// query().where('key', WhereConditions.beginsWith(prefix)).limit(n).getMany()
// (verified against installed @forge/kvs@2.1.2 — the named import
// `import { kvs } from '@forge/kvs'` is the live instance; the README's
// default import resolves to the module exports object under Node ESM,
// not the instance, so the named import is the one to use).

export const MAX_THREAD_TURNS = 10;
export const MAX_SNAPSHOTS = 30;

export const DEFAULT_SETTINGS = {
  dailySync: true,
  incidentAlerts: true,
  weeklyDigest: false,
};

// Resolver/trigger context carries the install + user identity when
// Forge provides it; a scheduled trigger (or a test) may carry neither.
// Fall back to a single 'default' segment rather than failing — one
// install's data stays in one install's KVS either way.
export function resolveScope(context) {
  const cloudId =
    context && typeof context.cloudId === 'string' && context.cloudId.trim() !== ''
      ? context.cloudId.trim()
      : 'default';
  const accountId =
    context && typeof context.accountId === 'string' && context.accountId.trim() !== ''
      ? context.accountId.trim()
      : 'default';
  return { cloudId, accountId };
}

export function settingsKey(cloudId) {
  return `settings:${cloudId}`;
}

export function threadKey(cloudId, accountId) {
  return `agent-thread:${cloudId}:${accountId}`;
}

export function snapshotKey(cloudId, dateStr) {
  return `snapshot:${cloudId}:${dateStr}`;
}

export function snapshotPrefix(cloudId) {
  return `snapshot:${cloudId}:`;
}

// UTC date string for the daily snapshot key.
export function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Sanitize stored/ incoming settings: only the three known boolean
// toggles survive; anything missing, mistyped or extra falls back to
// the default. Never throws on hostile input.
export function validateSettings(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    dailySync: typeof source.dailySync === 'boolean' ? source.dailySync : DEFAULT_SETTINGS.dailySync,
    incidentAlerts:
      typeof source.incidentAlerts === 'boolean' ? source.incidentAlerts : DEFAULT_SETTINGS.incidentAlerts,
    weeklyDigest:
      typeof source.weeklyDigest === 'boolean' ? source.weeklyDigest : DEFAULT_SETTINGS.weeklyDigest,
  };
}

export async function loadSettings(store, cloudId) {
  const stored = await store.get(settingsKey(cloudId));
  return validateSettings(stored);
}

export async function saveSettings(store, cloudId, input) {
  const settings = validateSettings(input);
  await store.set(settingsKey(cloudId), settings);
  return settings;
}

export function emptyThread() {
  return { turns: [], lastReadiness: null };
}

function validateThread(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return emptyThread();
  const turns = Array.isArray(stored.turns)
    ? stored.turns
        .filter((t) => t && typeof t === 'object' && typeof t.question === 'string' && typeof t.answer === 'string')
        .slice(-MAX_THREAD_TURNS)
    : [];
  const lastReadiness =
    stored.lastReadiness && typeof stored.lastReadiness === 'object' && !Array.isArray(stored.lastReadiness)
      ? stored.lastReadiness
      : null;
  return { turns, lastReadiness };
}

export async function loadThread(store, cloudId, accountId) {
  return validateThread(await store.get(threadKey(cloudId, accountId)));
}

// Append one Q/A turn, keeping at most the last 10. `lastReadiness`
// (a { score, breakdown, generatedAt } object) is stored alongside
// when the caller has a fresh one; otherwise the previous value stays.
export async function appendThreadTurn(store, cloudId, accountId, turn, lastReadiness) {
  const thread = await loadThread(store, cloudId, accountId);
  const entry = {
    question: String(turn.question ?? '').slice(0, 1500),
    answer: String(turn.answer ?? '').slice(0, 12000),
    at: new Date().toISOString(),
  };
  const turns = [...thread.turns, entry].slice(-MAX_THREAD_TURNS);
  const next = {
    turns,
    lastReadiness: lastReadiness !== undefined ? lastReadiness : thread.lastReadiness,
  };
  await store.set(threadKey(cloudId, accountId), next);
  return next;
}

export async function clearThread(store, cloudId, accountId) {
  await store.delete(threadKey(cloudId, accountId));
  return emptyThread();
}

// --- Phase B: pending agent actions (approval-gated writes) ---------
//
// A write tool never executes on the model's word alone. invokeAgent
// stores the validated action here; approveAgentAction loads it back
// and re-validates before executing. The frontend's copy is never
// trusted. Entries are single-use: approve/reject deletes them, so a
// stale approval cannot be replayed.
export function pendingActionKey(cloudId, accountId, actionId) {
  return `pending-action:${cloudId}:${accountId}:${actionId}`;
}

export function newActionId() {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function storePendingAction(store, cloudId, accountId, action) {
  const actionId = newActionId();
  const record = {
    actionId,
    threadId: threadKey(cloudId, accountId),
    tool: action.tool,
    args: action.args,
    preview: action.preview ?? null,
    trace: Array.isArray(action.trace) ? action.trace : [],
    messages: Array.isArray(action.messages) ? action.messages : [],
    prompt: typeof action.prompt === 'string' ? action.prompt.slice(0, 1500) : '',
    createdAt: new Date().toISOString(),
  };
  await store.set(pendingActionKey(cloudId, accountId, actionId), record);
  return record;
}

export async function loadPendingAction(store, cloudId, accountId, actionId) {
  if (typeof actionId !== 'string' || actionId.trim() === '') return null;
  const record = await store.get(pendingActionKey(cloudId, accountId, actionId.trim()));
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  if (record.actionId !== actionId.trim()) return null;
  return record;
}

export async function deletePendingAction(store, cloudId, accountId, actionId) {
  await store.delete(pendingActionKey(cloudId, accountId, actionId));
}

// Refresh only the thread's lastReadiness — no turn is appended.
// Used by getReadiness so Intelligence follow-ups can cite the latest
// score without duplicating a turn.
export async function updateLastReadiness(store, cloudId, accountId, lastReadiness) {
  const thread = await loadThread(store, cloudId, accountId);
  const next = { turns: thread.turns, lastReadiness };
  await store.set(threadKey(cloudId, accountId), next);
  return next;
}

export async function storeSnapshot(store, cloudId, dateStr, snapshot) {
  const entry = {
    date: dateStr,
    score: typeof snapshot.score === 'number' ? snapshot.score : null,
    breakdown: snapshot.breakdown ?? { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 },
    counts: snapshot.counts ?? { jiraTotal: 0, jiraOpen: 0, jsmTotal: 0, jsmOpen: 0 },
    generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
  };
  await store.set(snapshotKey(cloudId, dateStr), entry);
  return entry;
}

// Newest first, capped at 30. Keys are `snapshot:${cloudId}:YYYY-MM-DD`,
// so lexicographic order is chronological order — but the KVS query
// builder has no sort option and returns keys ascending, so the newest
// snapshots sit on the LAST page. Walk pages (bounded: 10 pages x 100
// rows ≈ 2.7 years of daily snapshots) and take the newest `limit`
// after sorting. With one snapshot a day this is a single page for
// the first ~3 months.
export async function listSnapshots(store, cloudId, limit = MAX_SNAPSHOTS) {
  const { WhereConditions } = await import('@forge/kvs');
  const prefix = snapshotPrefix(cloudId);
  const all = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    let qb = store.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
    if (cursor) qb = qb.cursor(cursor);
    const result = await qb.getMany();
    const results = Array.isArray(result?.results) ? result.results : [];
    for (const r of results) {
      if (r && r.value && typeof r.value === 'object' && typeof r.value.date === 'string') all.push(r.value);
    }
    cursor = result?.nextCursor;
    if (!cursor || results.length === 0) break;
  }
  return all
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}
