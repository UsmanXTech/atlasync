// Tests for the pure Jira helpers (forge-app/src/jira.js).
// Run with Node's built-in runner — no new dependency:
//   node --test forge-app/tests/
// These cover normalization, null fields, input validation, empty
// results, and error mapping. The live network call itself lives in
// index.js behind Forge auth and is NOT exercised here (it needs a real
// Forge installation; see README).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_JQL,
  DEFAULT_MAX_RESULTS,
  buildSearchBody,
  mapJiraErrorStatus,
  normalizeJiraIssue,
  parseJiraSearchResponse,
  validateJiraInput,
} from '../src/jira.js';

const fullIssue = {
  key: 'ATLAS-482',
  id: '10001',
  fields: {
    summary: 'Checkout timeout under load',
    status: { name: 'In Progress' },
    priority: { name: 'Highest' },
    assignee: { displayName: 'Sara Khan' },
    updated: '2026-11-05T07:00:00.000+0500',
  },
};

describe('normalizeJiraIssue', () => {
  it('normalizes a complete issue', () => {
    assert.deepEqual(normalizeJiraIssue(fullIssue), {
      key: 'ATLAS-482',
      id: '10001',
      summary: 'Checkout timeout under load',
      status: 'In Progress',
      priority: 'Highest',
      assignee: 'Sara Khan',
      updated: '2026-11-05T07:00:00.000+0500',
    });
  });

  it('maps a missing numeric id to null', () => {
    const issue = normalizeJiraIssue({ key: 'ATLAS-3', fields: { summary: 'x' } });
    assert.equal(issue.id, null);
  });

  it('maps missing assignee and priority to null', () => {
    const issue = normalizeJiraIssue({
      key: 'ATLAS-1',
      fields: { summary: 'x', status: { name: 'To Do' }, priority: null, assignee: null, updated: '2026-01-01' },
    });
    assert.equal(issue.priority, null);
    assert.equal(issue.assignee, null);
  });

  it('falls back safely for missing summary, status, and updated', () => {
    const issue = normalizeJiraIssue({ key: 'ATLAS-2', fields: {} });
    assert.equal(issue.summary, '(no summary)');
    assert.equal(issue.status, 'Unknown');
    assert.equal(issue.updated, '');
  });

  it('skips records without a string key', () => {
    assert.equal(normalizeJiraIssue(null), null);
    assert.equal(normalizeJiraIssue({ fields: {} }), null);
    assert.equal(normalizeJiraIssue({ key: 42, fields: {} }), null);
  });
});

describe('parseJiraSearchResponse', () => {
  it('returns normalized issues and skips invalid entries', () => {
    const out = parseJiraSearchResponse({ issues: [fullIssue, { fields: {} }, null] });
    assert.equal(out.length, 1);
    assert.equal(out[0].key, 'ATLAS-482');
  });

  it('returns an empty list for empty or malformed responses', () => {
    assert.deepEqual(parseJiraSearchResponse({ issues: [] }), []);
    assert.deepEqual(parseJiraSearchResponse({}), []);
    assert.deepEqual(parseJiraSearchResponse(null), []);
    assert.deepEqual(parseJiraSearchResponse({ issues: 'nope' }), []);
  });
});

describe('validateJiraInput', () => {
  it('defaults an absent payload', () => {
    assert.deepEqual(validateJiraInput(undefined), {
      ok: true,
      jql: DEFAULT_JQL,
      maxResults: DEFAULT_MAX_RESULTS,
    });
    assert.deepEqual(validateJiraInput(null), {
      ok: true,
      jql: DEFAULT_JQL,
      maxResults: DEFAULT_MAX_RESULTS,
    });
  });

  it('accepts a custom jql and clamps maxResults to 1..50', () => {
    assert.deepEqual(validateJiraInput({ jql: 'project = ATLAS', maxResults: 100 }), {
      ok: true,
      jql: 'project = ATLAS',
      maxResults: 50,
    });
    assert.deepEqual(validateJiraInput({ maxResults: 0 }), {
      ok: true,
      jql: DEFAULT_JQL,
      maxResults: 1,
    });
    assert.deepEqual(validateJiraInput({ maxResults: 25.7 }), {
      ok: true,
      jql: DEFAULT_JQL,
      maxResults: 25,
    });
  });

  it('treats blank jql as the default query', () => {
    const result = validateJiraInput({ jql: '   ' });
    assert.equal(result.ok, true);
    assert.equal(result.jql, DEFAULT_JQL);
  });

  it('rejects non-object payloads, bad types, and oversized jql', () => {
    for (const bad of ['x', 42, ['ATLAS'], { jql: 123 }, { maxResults: 'many' }, { maxResults: NaN }]) {
      const result = validateJiraInput(bad);
      assert.equal(result.ok, false, JSON.stringify(bad));
      assert.equal(result.error.kind, 'INVALID_INPUT');
    }
    const long = validateJiraInput({ jql: 'x'.repeat(501) });
    assert.equal(long.ok, false);
    assert.equal(long.error.kind, 'INVALID_INPUT');
  });

  it('ignores unknown payload fields', () => {
    const result = validateJiraInput({ admin: true, dropDatabase: 'yes' });
    assert.equal(result.ok, true);
    assert.equal(result.jql, DEFAULT_JQL);
  });
});

describe('mapJiraErrorStatus', () => {
  it('maps auth failures to permission denied', () => {
    assert.equal(mapJiraErrorStatus(401).kind, 'PERMISSION_DENIED');
    assert.equal(mapJiraErrorStatus(403).kind, 'PERMISSION_DENIED');
  });

  it('maps 429 to rate limited and everything else to api error', () => {
    assert.equal(mapJiraErrorStatus(429).kind, 'RATE_LIMITED');
    assert.equal(mapJiraErrorStatus(404).kind, 'API_ERROR');
    assert.equal(mapJiraErrorStatus(500).kind, 'API_ERROR');
  });

  it('never includes dynamic details in messages', () => {
    for (const status of [401, 403, 429, 500]) {
      const { message } = mapJiraErrorStatus(status);
      assert.equal(typeof message, 'string');
      assert.ok(!message.includes(String(status)), 'message must not echo the status');
    }
  });
});

describe('buildSearchBody', () => {
  it('requests only the small typed field set, referenced by key', () => {
    assert.deepEqual(buildSearchBody({ jql: 'project = ATLAS', maxResults: 10 }), {
      jql: 'project = ATLAS',
      maxResults: 10,
      fields: ['summary', 'status', 'priority', 'assignee', 'updated'],
      fieldsByKeys: true,
    });
  });
});

describe('DEFAULT_JQL', () => {
  it('is bounded: a bare ORDER BY is rejected by Jira as unbounded (Task 5.1)', () => {
    assert.match(DEFAULT_JQL, /ORDER BY updated DESC/);
    assert.ok(!/^ORDER BY/i.test(DEFAULT_JQL.trim()), 'default JQL must have a WHERE clause');
  });
});
