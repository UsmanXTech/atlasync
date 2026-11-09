import assert from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeConfluencePage, parseConfluencePages, validateConfluenceInput } from '../src/confluence.js';
describe('Confluence page normalization', () => {
  it('normalizes pages and drops unknown fields', () => {
    assert.deepEqual(normalizeConfluencePage({ id: 12, title: 'Runbook', status: 'current', spaceId: '42', version: { createdAt: '2026-01-01' }, secret: 'discard' }), { id: '12', title: 'Runbook', status: 'current', spaceId: '42', updated: '2026-01-01' });
  });
  it('skips malformed rows and handles empty responses', () => {
    assert.deepEqual(parseConfluencePages({ results: [null, {}, { id: '1', title: 'x' }] }), [{ id: '1', title: 'x', status: 'Unknown', spaceId: null, updated: '' }]);
    assert.deepEqual(parseConfluencePages(null), []);
  });
  it('validates and clamps limits', () => {
    assert.equal(validateConfluenceInput({ limit: 100 }).limit, 50);
    assert.equal(validateConfluenceInput({ limit: 0 }).limit, 1);
    assert.equal(validateConfluenceInput({ limit: 'x' }).ok, false);
  });
});