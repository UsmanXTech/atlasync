// Tests for the pure health-check selector (forge-app/src/readiness.js).
// Run with Node's built-in runner — no new dependency:
//   node --test forge-app/tests/
// The live probes themselves live in index.js behind Forge auth and
// are NOT exercised here (they need a real Forge installation).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { filterHealthChecks } from '../src/readiness.js';

const CHECKS = [{ source: 'jira' }, { source: 'confluence' }, { source: 'jsm' }];

describe('filterHealthChecks', () => {
  it('runs all three checks when no source is given', () => {
    for (const source of [undefined, null, '']) {
      assert.deepEqual(filterHealthChecks(CHECKS, source), CHECKS);
    }
  });

  it('runs only the requested source', () => {
    assert.deepEqual(filterHealthChecks(CHECKS, 'jsm'), [{ source: 'jsm' }]);
    assert.deepEqual(filterHealthChecks(CHECKS, 'jira'), [{ source: 'jira' }]);
  });

  it('selects nothing for an unknown source', () => {
    assert.deepEqual(filterHealthChecks(CHECKS, 'bitbucket'), []);
    assert.deepEqual(filterHealthChecks(CHECKS, 'JIRA'), []);
  });
});
