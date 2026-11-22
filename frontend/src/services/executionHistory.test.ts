// Tests for the execution-history action-state validator
// (frontend/src/services/executionHistory.ts). The listExecutionHistory
// invoke call needs @forge/bridge and is NOT exercised here (it runs
// inside the Forge iframe); only the pure validator is tested.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { toActionState } from './executionHistory.ts';

// Expired-approval history: a run whose proposal lapsed must render
// "expired", not "awaiting approval". Unknown values are dropped so a
// bad backend value can never render as a state.
describe('toActionState', () => {
  it('keeps the three backend annotation values', () => {
    assert.equal(toActionState('awaiting'), 'awaiting');
    assert.equal(toActionState('expired'), 'expired');
    assert.equal(toActionState('decided'), 'decided');
  });

  it('drops unknown, non-string and missing values', () => {
    assert.equal(toActionState('pending'), undefined);
    assert.equal(toActionState('AWAITING_APPROVAL'), undefined);
    assert.equal(toActionState(null), undefined);
    assert.equal(toActionState(undefined), undefined);
    assert.equal(toActionState(3), undefined);
  });
});
