// Regression test for the Task 5.1 Forge resolver runtime crash.
//
// On the live install (2026-11-05), clicking Live Jira crashed the Forge
// function with "out_namespaceObject is not a constructor": plain
// `new Resolver()` fails because @forge/resolver@1.8.0's constructor lives
// under `exports.default` and Forge's bundler hands the module the
// namespace object instead. The source now resolves the constructor
// defensively (`Resolver.default ?? Resolver`), so importing this module
// must succeed and its getStatus definition must answer — in plain Node
// as well as on Forge.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { handler } from '../src/index.js';

describe('resolver initialization (Task 5.1 regression)', () => {
  it('exports a definitions handler function', () => {
    assert.equal(typeof handler, 'function');
  });

  it('answers getStatus without touching Jira', async () => {
    const result = await handler({ call: { functionKey: 'getStatus' }, context: {} });
    assert.equal(result.ok, true);
    assert.equal(result.app, 'atlasync');
    assert.equal(result.version, '0.2.0');
  });

  it('rejects an unknown function key', async () => {
    await assert.rejects(handler({ call: { functionKey: 'nope' }, context: {} }), /no definition for 'nope'/);
  });
});
