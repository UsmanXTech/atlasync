import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBlockerJql, shapeJsmIncidentsResult } from '../src/agent/toolExecutors.js';

// The blocker JQL is pinned as a pure helper: the exact string the
// agent sends to Jira. Regression test for the live incident
// 2026-11-21 — the AS project query failed on every ask because `AS`
// is a JQL reserved word and the key was interpolated unquoted
// (`project = AS` is an HTTP 400), which the error path then reported
// as a permission error.
describe('buildBlockerJql', () => {
  it('quotes the project key so reserved words like AS are valid JQL', () => {
    assert.equal(
      buildBlockerJql('AS'),
      'project = "AS" AND priority IN (Highest, Critical, High) AND status NOT IN (Done, Closed, Resolved) ORDER BY updated DESC',
    );
  });

  it('quotes ordinary keys the same way', () => {
    assert.equal(
      buildBlockerJql('AT'),
      'project = "AT" AND priority IN (Highest, Critical, High) AND status NOT IN (Done, Closed, Resolved) ORDER BY updated DESC',
    );
  });

  it('strips double quotes from the key instead of breaking out of the quoted literal', () => {
    assert.equal(
      buildBlockerJql('A"S'),
      'project = "AS" AND priority IN (Highest, Critical, High) AND status NOT IN (Done, Closed, Resolved) ORDER BY updated DESC',
    );
  });
});

// The JSM result always states its severity filter and the open total
// across all priorities. Regression test for the stored false answer
// "Zero open JSM requests at every priority level" (live review
// 2026-11-21): the Highest filter returned zero while AS-1 was open
// at High, and the bare { severity, count: 0 } output let the model
// generalize a per-filter zero into a total.
describe('shapeJsmIncidentsResult', () => {
  const request = (key, priority, status) => ({ key, summary: `Summary ${key}`, status, priority });

  it('zero at the requested severity with open requests elsewhere says so explicitly', () => {
    const result = shapeJsmIncidentsResult('Highest', [
      request('AS-1', 'High', 'Waiting for support'),
      request('AS-2', 'Medium', 'Resolved'),
    ]);
    const output = JSON.parse(result.output);
    assert.equal(output.severity, 'Highest');
    assert.equal(output.count, 0);
    assert.equal(output.totalOpen, 1);
    assert.deepEqual(output.requests, []);
    assert.match(output.note, /does NOT mean there are no open requests at all/);
    assert.match(output.note, /1 open request\(s\) exist at other priorities/);
    assert.deepEqual(result.records, []);
  });

  it('zero everywhere says there are no open requests at any priority', () => {
    const result = shapeJsmIncidentsResult('Highest', [request('AS-2', 'Medium', 'Resolved')]);
    const output = JSON.parse(result.output);
    assert.equal(output.count, 0);
    assert.equal(output.totalOpen, 0);
    assert.match(output.note, /no open requests at any priority/);
  });

  it('non-zero result reports the filter and the all-priorities open total', () => {
    const result = shapeJsmIncidentsResult('Highest', [
      request('AS-1', 'Highest', 'Waiting for support'),
      request('AS-2', 'High', 'Open'),
    ]);
    const output = JSON.parse(result.output);
    assert.equal(output.count, 1);
    assert.equal(output.totalOpen, 2);
    assert.equal(output.requests[0].key, 'AS-1');
    assert.match(output.note, /Filter: priority = Highest/);
    assert.match(output.note, /2 open request\(s\) at all priorities/);
    assert.deepEqual(result.records, [{ kind: 'jsm', key: 'AS-1', title: 'Summary AS-1', path: '/browse/AS-1' }]);
  });
});
