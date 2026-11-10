import assert from 'node:assert';
import { describe, it } from 'node:test';
import { RequestGeneration } from './requestGeneration.ts';

describe('RequestGeneration', () => {
  it('only the latest generation is current', () => {
    const generations = new RequestGeneration();
    const first = generations.next();
    const second = generations.next();
    assert.equal(generations.isCurrent(first), false);
    assert.equal(generations.isCurrent(second), true);
  });

  it('invalidate() retires an in-flight generation (reset / Stop case)', () => {
    const generations = new RequestGeneration();
    const inFlight = generations.next();
    generations.invalidate();
    assert.equal(generations.isCurrent(inFlight), false);
  });

  it('a new ask after invalidate is current again', () => {
    const generations = new RequestGeneration();
    generations.next();
    generations.invalidate();
    const next = generations.next();
    assert.equal(generations.isCurrent(next), true);
  });
});
