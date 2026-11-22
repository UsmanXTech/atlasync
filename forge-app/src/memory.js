// Atlasync v2.1.0 — persistent memory over Forge KVS (@forge/kvs).
//
// KVS keys (per installation — Forge scopes KVS per app installation,
// so the cloudId/accountId segments below only separate data inside
// one install; they are not a security boundary):
//   settings:${cloudId}
//   agent-thread:${cloudId}:${accountId}   (last 10 turns + last readiness)
//   pending-action:${cloudId}:${accountId}:${actionId}   (approval-gated write, single-use)
//   pending-action-claim:${cloudId}:${accountId}:${actionId}   (short-lived approval claim, P0 hardening)
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

// Citations stored on a turn, so a restored answer keeps its Sources
// links (the fix for dead links after reload). Same shape as the
// frontend Citation: kind/key/title required, path/url optional. Anything
// malformed is dropped, never stored; capped at 20 so one turn cannot
// bloat the KVS record. Old turns without citations are unaffected.
const CITATION_KINDS = new Set(['jira', 'jsm', 'confluence', 'bitbucket']);
export function sanitizeCitations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const c of value) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    if (!CITATION_KINDS.has(c.kind)) continue;
    if (typeof c.key !== 'string' || c.key === '') continue;
    if (typeof c.title !== 'string') continue;
    const entry = { kind: c.kind, key: c.key, title: c.title };
    if (typeof c.path === 'string' && c.path !== '') entry.path = c.path;
    if (typeof c.url === 'string' && c.url !== '') entry.url = c.url;
    out.push(entry);
    if (out.length >= 20) break;
  }
  return out;
}

// Append one Q/A turn, keeping at most the last 10. `lastReadiness`
// (a { score, breakdown, generatedAt } object) is stored alongside
// when the caller has a fresh one; otherwise the previous value stays.
// Per-source row counts stored on a turn, so a restored answer keeps
// the coverage the tools actually returned (loop.js sourceCounts) —
// not a recount from the capped citations. Same storage rule as
// citations: malformed values are dropped, never stored; all-zero or
// absent counts are not stored at all (old turns are unaffected).
const SOURCE_COUNT_BUCKETS = ['jira', 'confluence', 'jsm', 'bitbucket'];
export function sanitizeSourceCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  let any = false;
  for (const bucket of SOURCE_COUNT_BUCKETS) {
    const n = value[bucket];
    const count = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    out[bucket] = count;
    if (count > 0) any = true;
  }
  return any ? out : null;
}

export async function appendThreadTurn(store, cloudId, accountId, turn, lastReadiness) {
  const thread = await loadThread(store, cloudId, accountId);
  const entry = {
    question: String(turn.question ?? '').slice(0, 1500),
    answer: String(turn.answer ?? '').slice(0, 12000),
    at: new Date().toISOString(),
  };
  const citations = sanitizeCitations(turn.citations);
  if (citations.length > 0) entry.citations = citations;
  const sourceCounts = sanitizeSourceCounts(turn.sourceCounts);
  if (sourceCounts) entry.sourceCounts = sourceCounts;
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
//
// P0 hardening (2026-11-21 security review):
// Forge KVS has no compare-and-swap or transaction, so a perfect atomic
// claim is impossible. Defense in depth instead:
//   1. Server-enforced TTL (10 min): loadPendingAction treats an expired
//      record as missing, so a stale approval can never execute.
//   2. Claim: approveAgentAction writes a unique claim key, re-reads it,
//      and proceeds only while it still holds its own claim id. A live
//      claim already held by another approval refuses a second claim
//      outright; two concurrent claims race on the key and the loser
//      aborts. This narrows the race window (load->delete) to the
//      claim-read->delete gap — it does not close it (KVS has no atomic
//      operation). The idempotency guards in the write executors are
//      the backstop that makes a residual double execution harmless.
//      A claim older than PENDING_ACTION_CLAIM_TTL_MS is stale (its
//      owner crashed before consuming) and may be stolen.
export const PENDING_ACTION_CLAIM_TTL_MS = 60 * 1000;

export function isClaimStale(claim, nowMs = Date.now()) {
  if (!claim || typeof claim !== 'object') return true;
  const claimed = Date.parse(claim.claimedAt);
  if (Number.isNaN(claimed)) return true; // no trustworthy timestamp: fail closed
  return nowMs - claimed > PENDING_ACTION_CLAIM_TTL_MS;
}
//   3. Fail-closed consume: if the pending record cannot be deleted,
//      the action is NOT executed — delete errors are never swallowed.
export function pendingActionKey(cloudId, accountId, actionId) {
  return `pending-action:${cloudId}:${accountId}:${actionId}`;
}

export function newActionId() {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Server-enforced approval TTL: a pending action older than this can
// never execute, whatever the frontend shows.
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

export function isPendingActionExpired(record, nowMs = Date.now()) {
  if (!record || typeof record !== 'object') return true;
  const created = Date.parse(record.createdAt);
  if (Number.isNaN(created)) return true; // no trustworthy timestamp: fail closed
  return nowMs - created > PENDING_ACTION_TTL_MS;
}

export function pendingActionClaimKey(cloudId, accountId, actionId) {
  return `pending-action-claim:${cloudId}:${accountId}:${actionId}`;
}

export function newClaimId() {
  return `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Claim a pending action for execution. Returns { record, claimId } on
// success, null when the action is missing/expired or another approval
// already holds the claim.
export async function claimPendingAction(store, cloudId, accountId, actionId, nowMs = Date.now()) {
  const record = await loadPendingAction(store, cloudId, accountId, actionId);
  if (!record || isPendingActionExpired(record, nowMs)) return null;
  // Refuse outright when a live claim is already held — a second
  // approval (double-click, retry, second tab) must not overwrite it.
  const existing = await store.get(pendingActionClaimKey(cloudId, accountId, actionId));
  if (existing && !isClaimStale(existing, nowMs)) return null;
  const claimId = newClaimId();
  await store.set(pendingActionClaimKey(cloudId, accountId, actionId), {
    claimId,
    claimedAt: new Date(nowMs).toISOString(),
  });
  const current = await store.get(pendingActionClaimKey(cloudId, accountId, actionId));
  if (!current || current.claimId !== claimId) return null; // lost the race
  // Re-load: the action must still be there and unexpired.
  const fresh = await loadPendingAction(store, cloudId, accountId, actionId);
  if (!fresh || isPendingActionExpired(fresh, nowMs)) {
    await releasePendingActionClaim(store, cloudId, accountId, actionId, claimId);
    return null;
  }
  return { record: fresh, claimId };
}

// Release a claim, but only if it is still ours — never delete another
// approval's claim.
export async function releasePendingActionClaim(store, cloudId, accountId, actionId, claimId) {
  const current = await store.get(pendingActionClaimKey(cloudId, accountId, actionId)).catch(() => null);
  if (current && current.claimId === claimId) {
    await store.delete(pendingActionClaimKey(cloudId, accountId, actionId)).catch(() => {});
  }
}

// Delete the pending record AND its claim. Throws on failure — callers
// must NOT execute when this fails (fail closed).
export async function consumePendingAction(store, cloudId, accountId, actionId, claimId) {
  await store.delete(pendingActionKey(cloudId, accountId, actionId));
  await releasePendingActionClaim(store, cloudId, accountId, actionId, claimId);
}

// --- Phase 1 (AI workspace evolution): multiple conversations --------
//
// v2.1.0 kept ONE thread per user (agent-thread:...). Phase 1 keeps that
// thread for backward compatibility (askAtlasync + old clients) and adds
// named conversations on top of it:
//   agent-conversations:${cloudId}:${accountId}  (index)
//   agent-conversation:${cloudId}:${accountId}:${conversationId}  (record)
// A conversation holds the same turn shape as the legacy thread (last 10
// turns + lastReadiness). The first list migrates the legacy thread into
// a "Previous conversation" once (marked, so it never re-runs — even
// after the user deletes every conversation).
export const MAX_CONVERSATIONS = 20;

export function conversationKey(cloudId, accountId, conversationId) {
  return `agent-conversation:${cloudId}:${accountId}:${conversationId}`;
}

export function conversationIndexKey(cloudId, accountId) {
  return `agent-conversations:${cloudId}:${accountId}`;
}

export function conversationMigrationKey(cloudId, accountId) {
  return `agent-conversations-migrated:${cloudId}:${accountId}`;
}

export function newConversationId() {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function conversationTitleFromQuestion(question) {
  const q = typeof question === 'string' ? question.trim().replace(/\s+/g, ' ') : '';
  if (!q) return 'New conversation';
  return q.length > 40 ? `${q.slice(0, 40).trimEnd()}…` : q;
}

async function loadConversationIndex(store, cloudId, accountId) {
  const index = await store.get(conversationIndexKey(cloudId, accountId));
  if (!Array.isArray(index)) return [];
  return index.filter((e) => e && typeof e.id === 'string');
}

async function saveConversationIndex(store, cloudId, accountId, index) {
  await store.set(conversationIndexKey(cloudId, accountId), index);
  return index;
}

export async function listConversations(store, cloudId, accountId) {
  let index = await loadConversationIndex(store, cloudId, accountId);
  const migrated = await store.get(conversationMigrationKey(cloudId, accountId));
  if (index.length === 0 && !migrated) {
    const legacy = await loadThread(store, cloudId, accountId);
    if (legacy.turns.length > 0) {
      const now = new Date().toISOString();
      const conversation = {
        id: newConversationId(),
        title: 'Previous conversation',
        turns: legacy.turns,
        lastReadiness: legacy.lastReadiness ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await store.set(conversationKey(cloudId, accountId, conversation.id), conversation);
      index = [
        {
          id: conversation.id,
          title: conversation.title,
          createdAt: now,
          updatedAt: now,
          turnCount: conversation.turns.length,
        },
      ];
      await saveConversationIndex(store, cloudId, accountId, index);
    }
    await store.set(conversationMigrationKey(cloudId, accountId), '1');
  }
  return [...index].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export async function createConversation(store, cloudId, accountId, title) {
  const index = await loadConversationIndex(store, cloudId, accountId);
  const now = new Date().toISOString();
  const cleanTitle =
    typeof title === 'string' && title.trim() !== '' ? title.trim().slice(0, 80) : 'New conversation';
  const conversation = {
    id: newConversationId(),
    title: cleanTitle,
    turns: [],
    lastReadiness: null,
    createdAt: now,
    updatedAt: now,
  };
  await store.set(conversationKey(cloudId, accountId, conversation.id), conversation);
  const next = [
    { id: conversation.id, title: conversation.title, createdAt: now, updatedAt: now, turnCount: 0 },
    ...index,
  ].slice(0, MAX_CONVERSATIONS);
  const kept = new Set(next.map((e) => e.id));
  for (const entry of index) {
    if (!kept.has(entry.id)) {
      await store.delete(conversationKey(cloudId, accountId, entry.id)).catch(() => {});
    }
  }
  await saveConversationIndex(store, cloudId, accountId, next);
  return conversation;
}

export async function loadConversation(store, cloudId, accountId, conversationId) {
  if (typeof conversationId !== 'string' || conversationId.trim() === '') return null;
  const record = await store.get(conversationKey(cloudId, accountId, conversationId.trim()));
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  if (record.id !== conversationId.trim()) return null;
  return record;
}

export async function renameConversation(store, cloudId, accountId, conversationId, title) {
  const clean = typeof title === 'string' ? title.trim() : '';
  if (clean === '' || clean.length > 80) return null;
  const record = await loadConversation(store, cloudId, accountId, conversationId);
  if (!record) return null;
  const next = { ...record, title: clean, updatedAt: new Date().toISOString() };
  await store.set(conversationKey(cloudId, accountId, conversationId), next);
  const index = await loadConversationIndex(store, cloudId, accountId);
  await saveConversationIndex(
    store,
    cloudId,
    accountId,
    index.map((e) => (e.id === conversationId ? { ...e, title: clean, updatedAt: next.updatedAt } : e)),
  );
  return next;
}

export async function deleteConversation(store, cloudId, accountId, conversationId) {
  const record = await loadConversation(store, cloudId, accountId, conversationId);
  if (!record) return false;
  await store.delete(conversationKey(cloudId, accountId, conversationId));
  const index = await loadConversationIndex(store, cloudId, accountId);
  await saveConversationIndex(
    store,
    cloudId,
    accountId,
    index.filter((e) => e.id !== conversationId),
  );
  return true;
}

export async function appendConversationTurn(store, cloudId, accountId, conversationId, turn, lastReadiness) {
  const record = await loadConversation(store, cloudId, accountId, conversationId);
  if (!record) return null;
  const entry = {
    question: typeof turn?.question === 'string' ? turn.question : '',
    answer: typeof turn?.answer === 'string' ? turn.answer : '',
    at: new Date().toISOString(),
  };
  const citations = sanitizeCitations(turn?.citations);
  if (citations.length > 0) entry.citations = citations;
  const sourceCounts = sanitizeSourceCounts(turn?.sourceCounts);
  if (sourceCounts) entry.sourceCounts = sourceCounts;
  const turns = [...(Array.isArray(record.turns) ? record.turns : []), entry].slice(-MAX_THREAD_TURNS);
  const now = new Date().toISOString();
  const title = record.title === 'New conversation' ? conversationTitleFromQuestion(entry.question) : record.title;
  const next = {
    ...record,
    title,
    turns,
    lastReadiness: lastReadiness ?? record.lastReadiness ?? null,
    updatedAt: now,
  };
  await store.set(conversationKey(cloudId, accountId, conversationId), next);
  const index = await loadConversationIndex(store, cloudId, accountId);
  await saveConversationIndex(
    store,
    cloudId,
    accountId,
    index.map((e) =>
      e.id === conversationId ? { ...e, title, updatedAt: now, turnCount: turns.length } : e,
    ),
  );
  return next;
}

export async function storePendingAction(store, cloudId, accountId, action, threadIdOverride) {
  const actionId = newActionId();
  const record = {
    actionId,
    // Phase 1: a conversation-scoped pending action carries the
    // conversation id as its thread id, so approveAgentAction appends
    // the outcome to the right conversation. Default: legacy thread.
    threadId:
      typeof threadIdOverride === 'string' && threadIdOverride !== ''
        ? threadIdOverride
        : threadKey(cloudId, accountId),
    tool: action.tool,
    args: action.args,
    preview: action.preview ?? null,
    trace: Array.isArray(action.trace) ? action.trace : [],
    messages: Array.isArray(action.messages) ? action.messages : [],
    // Phase 1: the records the model read before proposing the write,
    // so the approval outcome can still cite them.
    citations: Array.isArray(action.citations) ? action.citations : [],
    // Fix #4: the per-source row counts at halt time, so the approval
    // outcome can still show the coverage the tools returned.
    sourceCounts: sanitizeSourceCounts(action.sourceCounts) ?? undefined,
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
  if (isPendingActionExpired(record)) {
    // Expired: treat as missing and clean up best-effort, so a stale
    // approval can never execute.
    await store.delete(pendingActionKey(cloudId, accountId, actionId.trim())).catch(() => {});
    return null;
  }
  return record;
}

export async function deletePendingAction(store, cloudId, accountId, actionId) {
  await store.delete(pendingActionKey(cloudId, accountId, actionId));
}

export function pendingActionPrefix(cloudId, accountId) {
  return `pending-action:${cloudId}:${accountId}:`;
}

// List every pending (unexpired, well-formed) approval for this user,
// newest first. The read side of the approval flow: without this, a
// proposal survived only in volatile React state and vanished on
// reload/remount while the KVS record lived on until its 10-min TTL —
// the phantom-approval bug (Intelligence said "pending approval", AI
// Agents said "no pending approvals"). Expired and malformed records
// are filtered out, never surfaced; claim keys
// (pending-action-claim:...) do not match this prefix.
export async function listPendingActions(store, cloudId, accountId) {
  const { WhereConditions } = await import('@forge/kvs');
  const prefix = pendingActionPrefix(cloudId, accountId);
  const all = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    let qb = store.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
    if (cursor) qb = qb.cursor(cursor);
    const result = await qb.getMany();
    const results = Array.isArray(result?.results) ? result.results : [];
    for (const r of results) {
      const record = r && r.value && typeof r.value === 'object' ? r.value : null;
      if (!record) continue;
      if (typeof record.actionId !== 'string' || record.actionId === '') continue;
      if (!record.preview || typeof record.preview !== 'object' || Array.isArray(record.preview)) continue;
      if (typeof record.preview.tool !== 'string' || typeof record.preview.target !== 'string') continue;
      if (isPendingActionExpired(record)) continue;
      all.push(record);
    }
    cursor = result?.nextCursor;
    if (!cursor || results.length === 0) break;
  }
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
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

// Phase 2 — persistent execution history. Every agent run (ask or
// approval decision) is recorded as one entry so the Agents view can
// show what the agent actually did, instead of the trace living only
// in the current analysis in memory. Keys are
// `exec-history:${cloudId}:${generatedAt-ISO}:${random}` so
// lexicographic order is chronological order; listing mirrors
// listSnapshots (bounded page walk, newest first, capped).
export const MAX_EXECUTION_RUNS = 20;
export const EXECUTION_RUN_STATUSES = ['COMPLETE', 'AWAITING_APPROVAL', 'ERROR', 'APPROVED', 'REJECTED', 'EXECUTION_FAILED'];

export function executionHistoryKey(cloudId, runId) {
  return `exec-history:${cloudId}:${runId}`;
}

export function executionHistoryPrefix(cloudId) {
  return `exec-history:${cloudId}:`;
}

export function newExecutionRunId(generatedAt = new Date().toISOString()) {
  return `${generatedAt}:${Math.random().toString(36).slice(2, 10)}`;
}

function cleanRunText(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// Normalize a run into the stored shape; returns null when the input
// cannot be a run (unknown status, no question, no timestamp).
export function normalizeExecutionRun(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (!EXECUTION_RUN_STATUSES.includes(input.status)) return null;
  const question = cleanRunText(input.question, 500);
  if (!question) return null;
  const generatedAt = typeof input.generatedAt === 'string' && input.generatedAt !== '' ? input.generatedAt : new Date().toISOString();
  const trace = Array.isArray(input.trace) ? input.trace.slice(0, 20) : [];
  const citations = Array.isArray(input.citations) ? input.citations.slice(0, 10) : [];
  return {
    id: typeof input.id === 'string' && input.id !== '' ? input.id : newExecutionRunId(generatedAt),
    question,
    status: input.status,
    tool: cleanRunText(input.tool, 100),
    target: cleanRunText(input.target, 200),
    trace,
    citations,
    // Fix #5: count snapshot taken at record time. The trace is capped
    // at 20 and citations at 10, so the arrays alone undercount a long
    // run; the stored counts keep the true number even after the cap.
    // When the caller passes no counts they default to the array
    // lengths, so old callers stay honest.
    toolCallCount:
      Number.isInteger(input.toolCallCount) && input.toolCallCount >= 0 ? input.toolCallCount : trace.length,
    sourceCount:
      Number.isInteger(input.sourceCount) && input.sourceCount >= 0 ? input.sourceCount : citations.length,
    generatedAt,
    conversationId: typeof input.conversationId === 'string' && input.conversationId !== '' ? input.conversationId : null,
    error: cleanRunText(input.error, 500),
  };
}

export async function recordExecutionRun(store, cloudId, run) {
  const entry = normalizeExecutionRun(run);
  if (!entry) return null;
  await store.set(executionHistoryKey(cloudId, entry.id), entry);
  return entry;
}

export async function listExecutionRuns(store, cloudId, limit = MAX_EXECUTION_RUNS) {
  const { WhereConditions } = await import('@forge/kvs');
  const prefix = executionHistoryPrefix(cloudId);
  const all = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    let qb = store.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
    if (cursor) qb = qb.cursor(cursor);
    const result = await qb.getMany();
    const results = Array.isArray(result?.results) ? result.results : [];
    for (const r of results) {
      if (r && r.value && typeof r.value === 'object' && typeof r.value.id === 'string') all.push(r.value);
    }
    cursor = result?.nextCursor;
    if (!cursor || results.length === 0) break;
  }
  return all
    .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : a.generatedAt > b.generatedAt ? -1 : 0))
    .slice(0, limit);
}

const DECISION_RUN_STATUSES = ['APPROVED', 'REJECTED', 'EXECUTION_FAILED'];

// A pending action's prompt is stored raw (up to 1500 chars) while a
// run's question is cleanRunText(prompt, 500) — trim + first 500 chars.
// Match the two the same way the recorder produced them.
function sameQuestion(pendingPrompt, runQuestion) {
  if (typeof pendingPrompt !== 'string' || typeof runQuestion !== 'string') return false;
  return pendingPrompt.trim().slice(0, 500) === runQuestion;
}

function sameProposal(a, b) {
  return (
    sameQuestion(a.question ?? a.prompt, b.question) &&
    (b.tool == null || a.tool == null || a.tool === b.tool)
  );
}

// Annotate each AWAITING_APPROVAL run with its proposal's live state,
// derived at read time — the stored record is never mutated, so the
// annotation can never go stale the way a stored status would.
//
// Live review 2026-11-22: a proposal created ~02:56 AM expired after
// its 10-min KVS TTL, Pending approvals correctly went empty, but
// history still listed the run as "awaiting approval" forever — the
// stored status was written once and nothing ever updated it.
//
// Rules (fail-safe — a dead proposal is never presented as actionable):
// - 'awaiting': a live (unexpired) pending action matches this run's
//   question + tool. This is the ONLY state that means actionable.
// - 'decided': no live action matches, but a later run records the
//   decision for the same proposal (APPROVED / REJECTED /
//   EXECUTION_FAILED, same question + tool, later generatedAt).
// - 'expired': anything else — the action is gone with no decision
//   (TTL elapsed, superseded, or KVS loss), whatever the run's age.
// Non-awaiting runs are returned unchanged (no actionState).
export function annotateRunActionStates(runs, livePendingActions) {
  const list = Array.isArray(runs) ? runs : [];
  const pending = Array.isArray(livePendingActions) ? livePendingActions : [];
  return list.map((run) => {
    if (!run || run.status !== 'AWAITING_APPROVAL') return run;
    const awaiting = pending.some(
      (p) => p && typeof p === 'object' && sameQuestion(p.prompt, run.question) && (run.tool == null || p.tool == null || p.tool === run.tool),
    );
    if (awaiting) return { ...run, actionState: 'awaiting' };
    const decided = list.some(
      (other) =>
        other &&
        other !== run &&
        DECISION_RUN_STATUSES.includes(other.status) &&
        typeof other.generatedAt === 'string' &&
        typeof run.generatedAt === 'string' &&
        other.generatedAt > run.generatedAt &&
        sameProposal(other, run),
    );
    if (decided) return { ...run, actionState: 'decided' };
    return { ...run, actionState: 'expired' };
  });
}
