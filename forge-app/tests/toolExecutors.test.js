import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBlockerJql } from '../src/agent/toolExecutors.js';

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
