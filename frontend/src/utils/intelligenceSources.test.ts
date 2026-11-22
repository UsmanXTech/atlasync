// Tests for the Intelligence coverage helpers
// (frontend/src/utils/intelligenceSources.ts). The coverage rules are
// pure: tool-result counts win when they carry signal, citations are
// the fallback — an all-zero count object must never shadow real
// citations (live review 2026-11-22: the direct blockers ask cited
// AT-1/AT-2 yet coverage showed 0 records).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { sourcesForAnswer, sourcesForTurn, sourcesFromCitations, sourcesFromCounts } from './intelligenceSources.ts';
import type { Citation } from '../services/agent.ts';

const jira = (key: string): Citation => ({ kind: 'jira', key, title: key });
const jsm = (key: string): Citation => ({ kind: 'jsm', key, title: key });

describe('sourcesFromCitations', () => {
  it('counts citations per bucket, including bitbucket', () => {
    assert.deepEqual(sourcesFromCitations([jira('AT-1'), jira('AT-2'), jsm('AS-1'), { kind: 'bitbucket', key: 'PR-1', title: 'PR' }]), {
      jiraIssues: 2,
      confluencePages: 0,
      jsmRequests: 1,
      bitbucketPullRequests: 1,
      unavailable: [],
    });
  });
});

describe('sourcesFromCounts', () => {
  it('maps the four buckets straight through', () => {
    assert.deepEqual(sourcesFromCounts({ jira: 2, confluence: 1, jsm: 0, bitbucket: 3 }), {
      jiraIssues: 2,
      confluencePages: 1,
      jsmRequests: 0,
      bitbucketPullRequests: 3,
      unavailable: [],
    });
  });
});

describe('sourcesForAnswer', () => {
  it('prefers non-zero counts over citations', () => {
    // Counts see rows citations miss (capped at 10, or rows without a
    // citable record), so a live count wins when it carries signal.
    const out = sourcesForAnswer([jira('AT-1')], { jira: 5, confluence: 0, jsm: 0, bitbucket: 0 });
    assert.equal(out.jiraIssues, 5);
  });

  it('falls back to citations when the counts are all zero', () => {
    // The live-review case: the answer cited AT-1/AT-2, the backend
    // sent an all-zero counts object, coverage read 0. It must read 2.
    const out = sourcesForAnswer([jira('AT-1'), jira('AT-2')], { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 });
    assert.equal(out.jiraIssues, 2);
  });

  it('falls back to citations when there are no counts at all', () => {
    const out = sourcesForAnswer([jira('AT-1')], null);
    assert.equal(out.jiraIssues, 1);
  });

  it('reads 0 when both counts and citations are empty', () => {
    const out = sourcesForAnswer([], { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 });
    assert.deepEqual(out, { jiraIssues: 0, confluencePages: 0, jsmRequests: 0, bitbucketPullRequests: 0, unavailable: [] });
  });
});

describe('sourcesForTurn', () => {
  it('uses stored counts when they carry signal', () => {
    const out = sourcesForTurn({ citations: [jira('AT-1')], sourceCounts: { jira: 4, confluence: 0, jsm: 0, bitbucket: 0 } });
    assert.equal(out.jiraIssues, 4);
  });

  it('falls back to citations for all-zero or missing stored counts', () => {
    assert.equal(sourcesForTurn({ citations: [jira('AT-1'), jira('AT-2')], sourceCounts: { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 } }).jiraIssues, 2);
    assert.equal(sourcesForTurn({ citations: [jira('AT-1')] }).jiraIssues, 1);
    assert.equal(sourcesForTurn({ citations: [jira('AT-1')], sourceCounts: {} }).jiraIssues, 1);
  });
});
