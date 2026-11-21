// Tests for the v2.1.0 data-mode helpers (frontend/src/utils/dataMode.ts).
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { DATA_MODE_LABELS, defaultDataMode } from './dataMode.ts';

describe('defaultDataMode', () => {
  it('defaults to Live inside the installed Forge app', () => {
    assert.equal(defaultDataMode('forge'), 'live');
  });

  it('defaults to Sample in the standalone preview and while connecting', () => {
    assert.equal(defaultDataMode('standalone'), 'sample');
    assert.equal(defaultDataMode('loading'), 'sample');
  });
});

describe('DATA_MODE_LABELS', () => {
  it('names both modes for the toggle', () => {
    assert.equal(DATA_MODE_LABELS.sample, 'Sample Dataset');
    assert.equal(DATA_MODE_LABELS.live, 'Live Workspace');
  });
});
