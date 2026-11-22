import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIEFING_UNAVAILABLE_MESSAGE, reduceBriefingResults } from './briefingState.ts';
import type { LiveIssue } from '../data/types';

const issue = (key: string, priority: string | null, status: string, updated: string): LiveIssue => ({
  key, id: null, summary: `Summary ${key}`, priority, status, updated, assignee: null,
});

const unreachable = (service: string) => ({
  ok: false as const,
  error: { kind: 'BACKEND_UNREACHABLE', message: `Live ${service} could not reach the Forge backend. Try again shortly.` },
});

const denied = (service: string) => ({
  ok: false as const,
  error: { kind: 'PERMISSION_DENIED', message: `Live ${service} could not be reached.` },
});

// A backend getReadiness result, shaped exactly like the service
// returns it. The briefing surfaces this object verbatim — it never
// re-scores — so Overview and Intelligence agree by construction.
const readinessOk = (score: number | null, breakdown = { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 }) => ({
  ok: true as const,
  readiness: {
    score,
    breakdown,
    counts: { jiraTotal: 9, jiraOpen: 8, jsmTotal: 1, jsmOpen: 1 },
    blockers: [],
    incidents: [],
    unavailable: [],
    notes: [],
    generatedAt: '2026-11-21T09:17:15.000Z',
  },
});

test('all three sources backend-unreachable → unavailable with the preview message', () => {
  const state = reduceBriefingResults({
    jira: unreachable('Jira'),
    confluence: unreachable('Confluence'),
    jsm: unreachable('JSM'),
    readiness: unreachable('Readiness'),
  });
  assert.equal(state.status, 'unavailable');
  if (state.status === 'unavailable') assert.equal(state.message, BRIEFING_UNAVAILABLE_MESSAGE);
});

test('all three failing for another reason → ready with four warnings, never unavailable', () => {
  const state = reduceBriefingResults({
    jira: denied('Jira'), confluence: denied('Confluence'), jsm: denied('JSM'), readiness: denied('Readiness'),
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.warnings.length, 4);
    assert.match(state.warnings[3], /Readiness unavailable/);
    assert.equal(state.digest.totalOpen, 0);
    assert.equal(state.readiness, null);
  }
});

test('partial failure → ready from what loaded, failed source named in warnings', () => {
  const state = reduceBriefingResults({
    jira: { ok: true, issues: [
      issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z'),
      issue('ATL-2', 'Medium', 'Open', '2026-10-20T12:00:00.000Z'),
    ] },
    confluence: unreachable('Confluence'),
    jsm: { ok: true, requests: [{ key: 'AS-1', summary: 'Request AS-1', status: 'Open', requestType: 'Service request', priority: 'High', created: '' }] },
    readiness: readinessOk(88, { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 0 }),
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.warnings.length, 1);
    assert.match(state.warnings[0], /Confluence unavailable/);
    assert.equal(state.confluenceCount, 0);
    assert.equal(state.jsmCount, 1);
    assert.equal(state.digest.totalOpen, 2);
    assert.equal(state.digest.blockers[0]?.key, 'ATL-1');
    assert.equal(state.readiness?.score, 88);
  }
});

test('ready state stamps the fetch time for the sidebar footer (fix #8)', () => {
  const state = reduceBriefingResults({
    jira: { ok: true, issues: [issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z')] },
    confluence: { ok: true, pages: [] },
    jsm: { ok: true, requests: [] },
    readiness: readinessOk(78, { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 1 }),
  });
  assert.equal(state.status, 'ready');
  if (state.status !== 'ready') return;
  const generatedAt = Date.parse(state.generatedAt);
  assert.ok(!Number.isNaN(generatedAt), 'generatedAt must be a valid ISO timestamp');
  assert.ok(Date.now() - generatedAt < 60_000, 'generatedAt must be stamped at reduce time');
});

test('all sources ok → ready with exact counts, no warnings, backend readiness surfaced verbatim', () => {
  const state = reduceBriefingResults({
    jira: { ok: true, issues: [issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z')] },
    confluence: { ok: true, pages: [
      { id: '1', title: 'Page 1', status: 'current', spaceId: 'SP', updated: '2026-11-09T12:00:00.000Z' },
      { id: '2', title: 'Page 2', status: 'current', spaceId: 'SP', updated: '2026-11-08T12:00:00.000Z' },
    ] },
    jsm: { ok: true, requests: [{ key: 'AS-1', summary: 'Request AS-1', status: 'Open', requestType: 'Service request', priority: 'High', created: '' }] },
    // The live 9-issue set from the 2026-11-21 review: 1 open Highest
    // unassigned (AT-1), 1 High, 4 Medium, 2 Low, 1 Done → 78% by the
    // backend formula (12×Bcrit + 10×Dmissing). The backend test in
    // forge-app/tests/readiness.test.js proves the 78%; this test
    // proves the briefing shows that same number, unmodified.
    readiness: readinessOk(78, { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 1 }),
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.deepEqual(state.warnings, []);
    assert.equal(state.confluenceCount, 2);
    assert.equal(state.jsmCount, 1);
    assert.equal(state.digest.totalOpen, 1);
    assert.equal(state.readiness?.score, 78);
    assert.deepEqual(state.readiness?.breakdown, { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 1 });
  }
});

test('readiness fetch fails → ready with a warning, readiness null, digest still computed', () => {
  const state = reduceBriefingResults({
    jira: { ok: true, issues: [issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z')] },
    confluence: { ok: true, pages: [] },
    jsm: { ok: true, requests: [] },
    readiness: denied('Readiness'),
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.warnings.length, 1);
    assert.match(state.warnings[0], /Readiness unavailable/);
    assert.equal(state.readiness, null);
    assert.equal(state.digest.totalOpen, 1);
    assert.equal(state.digest.blockers[0]?.key, 'ATL-1');
  }
});
