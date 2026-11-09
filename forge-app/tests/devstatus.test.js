// Tests for the pure dev-status helpers (forge-app/src/devstatus.js).
// Run with Node's built-in runner — no new dependency:
//   node --test forge-app/tests/devstatus.test.js
// The live network call lives in index.js behind Forge auth and is NOT
// exercised here (it needs a real Forge installation; see README).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { MAX_PULL_REQUESTS, parseDevStatusResponse, validateDevStatusInput } from '../src/devstatus.js';

describe('validateDevStatusInput', () => {
  it('accepts a numeric string issue id', () => {
    assert.deepEqual(validateDevStatusInput({ issueId: '10001' }), { ok: true, issueId: '10001' });
  });

  it('accepts a numeric issue id', () => {
    assert.deepEqual(validateDevStatusInput({ issueId: 10001 }), { ok: true, issueId: '10001' });
  });

  it('rejects missing, non-object, and non-numeric ids', () => {
    assert.equal(validateDevStatusInput(undefined).ok, false);
    assert.equal(validateDevStatusInput(null).ok, false);
    assert.equal(validateDevStatusInput('10001').ok, false);
    assert.equal(validateDevStatusInput({}).ok, false);
    assert.equal(validateDevStatusInput({ issueId: 'DEMO-8' }).ok, false);
    assert.equal(validateDevStatusInput({ issueId: '' }).ok, false);
    assert.equal(validateDevStatusInput({ issueId: '10a01' }).ok, false);
    assert.equal(validateDevStatusInput({ issueId: '10001 ' }).ok, false);
  });
});

describe('parseDevStatusResponse', () => {
  it('collects pull requests from detail entries', () => {
    const out = parseDevStatusResponse({
      detail: [
        {
          pullRequests: [
            { id: '1', name: 'Fix checkout timeout', status: 'OPEN', url: 'https://bitbucket.org/x/y/pull-requests/1' },
          ],
        },
      ],
    });
    assert.equal(out.pullRequests.length, 1);
    assert.equal(out.pullRequests[0].name, 'Fix checkout timeout');
    assert.equal(out.pullRequests[0].status, 'OPEN');
  });

  it('collects pull requests nested under repositories', () => {
    const out = parseDevStatusResponse({
      detail: [{ repositories: [{ pullRequests: [{ id: 7, name: 'Cart totals', status: 'MERGED' }] }] }],
    });
    assert.equal(out.pullRequests.length, 1);
    assert.equal(out.pullRequests[0].id, '7');
    assert.equal(out.pullRequests[0].url, null);
  });

  it('returns an empty list for unlinked issues and malformed input', () => {
    assert.deepEqual(parseDevStatusResponse({ detail: [] }), { pullRequests: [] });
    assert.deepEqual(parseDevStatusResponse({ detail: [{ pullRequests: [] }] }), { pullRequests: [] });
    assert.deepEqual(parseDevStatusResponse(null), { pullRequests: [] });
    assert.deepEqual(parseDevStatusResponse({}), { pullRequests: [] });
    assert.deepEqual(parseDevStatusResponse({ detail: 'nope' }), { pullRequests: [] });
    assert.deepEqual(parseDevStatusResponse({ detail: [null, { pullRequests: 'nope' }] }), { pullRequests: [] });
  });

  it('dedupes repeats and caps the list', () => {
    const pr = { id: '1', name: 'Same PR', status: 'OPEN' };
    const many = Array.from({ length: MAX_PULL_REQUESTS + 10 }, (_, i) => ({
      id: String(i),
      name: `PR ${i}`,
      status: 'OPEN',
    }));
    assert.equal(parseDevStatusResponse({ detail: [{ pullRequests: [pr, pr] }] }).pullRequests.length, 1);
    assert.equal(parseDevStatusResponse({ detail: [{ pullRequests: many }] }).pullRequests.length, MAX_PULL_REQUESTS);
  });
});
