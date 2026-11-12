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

test('all three sources backend-unreachable → unavailable with the preview message', () => {
  const state = reduceBriefingResults({
    jira: unreachable('Jira'),
    confluence: unreachable('Confluence'),
    jsm: unreachable('JSM'),
  });
  assert.equal(state.status, 'unavailable');
  if (state.status === 'unavailable') assert.equal(state.message, BRIEFING_UNAVAILABLE_MESSAGE);
});

test('all three failing for another reason → ready with three warnings, never unavailable', () => {
  const state = reduceBriefingResults({ jira: denied('Jira'), confluence: denied('Confluence'), jsm: denied('JSM') });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.warnings.length, 3);
    assert.equal(state.digest.totalOpen, 0);
    assert.equal(state.digest.readiness, null);
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
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.equal(state.warnings.length, 1);
    assert.match(state.warnings[0], /Confluence unavailable/);
    assert.equal(state.confluenceCount, 0);
    assert.equal(state.jsmCount, 1);
    assert.equal(state.digest.totalOpen, 2);
    assert.equal(state.digest.blockers[0]?.key, 'ATL-1');
  }
});

test('all sources ok → ready with exact counts, no warnings, readiness scored', () => {
  const state = reduceBriefingResults({
    jira: { ok: true, issues: [issue('ATL-1', 'Highest', 'In Progress', '2026-11-09T12:00:00.000Z')] },
    confluence: { ok: true, pages: [
      { id: '1', title: 'Page 1', status: 'current', spaceId: 'SP', updated: '2026-11-09T12:00:00.000Z' },
      { id: '2', title: 'Page 2', status: 'current', spaceId: 'SP', updated: '2026-11-08T12:00:00.000Z' },
    ] },
    jsm: { ok: true, requests: [{ key: 'AS-1', summary: 'Request AS-1', status: 'Open', requestType: 'Service request', priority: 'High', created: '' }] },
  });
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') {
    assert.deepEqual(state.warnings, []);
    assert.equal(state.confluenceCount, 2);
    assert.equal(state.jsmCount, 1);
    assert.equal(state.digest.totalOpen, 1);
    assert.equal(state.digest.readiness?.score, 85);
  }
});
