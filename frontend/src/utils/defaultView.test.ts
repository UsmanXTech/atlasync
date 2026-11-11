import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW } from './defaultView.ts';

// Intelligence-first Phase 1, slice 2 (PR-B): the app opens on Intelligence,
// not on Overview. Overview stays as a tab, it is just no longer the default.
test('default view is Intelligence', () => {
  assert.equal(DEFAULT_VIEW, 'intelligence');
});
