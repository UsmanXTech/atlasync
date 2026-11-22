import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildConfluencePagesUrl, normalizeConfluencePage, parseConfluencePages, validateConfluenceInput } from '../src/confluence.js';
describe('Confluence page normalization', () => {
  it('normalizes pages and drops unknown fields', () => {
    assert.deepEqual(normalizeConfluencePage({ id: 12, title: 'Runbook', status: 'current', spaceId: '42', version: { createdAt: '2026-01-01' }, secret: 'discard' }), { id: '12', title: 'Runbook', status: 'current', spaceId: '42', webui: null, updated: '2026-01-01' });
  });
  it('keeps the record URL from _links.webui instead of dropping it', () => {
    assert.deepEqual(
      normalizeConfluencePage({ id: 12, title: 'Runbook', status: 'current', spaceId: '42', version: { createdAt: '2026-01-01' }, _links: { webui: '/spaces/AT/pages/12' } }),
      { id: '12', title: 'Runbook', status: 'current', spaceId: '42', webui: '/spaces/AT/pages/12', updated: '2026-01-01' },
    );
    assert.equal(normalizeConfluencePage({ id: 12, title: 'Runbook', _links: { webui: '' } }).webui, null);
    assert.equal(normalizeConfluencePage({ id: 12, title: 'Runbook', _links: {} }).webui, null);
  });
  it('skips malformed rows and handles empty responses', () => {
    assert.deepEqual(parseConfluencePages({ results: [null, {}, { id: '1', title: 'x' }] }), [{ id: '1', title: 'x', status: 'Unknown', spaceId: null, webui: null, updated: '' }]);
    assert.deepEqual(parseConfluencePages(null), []);
  });
  it('validates and clamps limits', () => {
    assert.equal(validateConfluenceInput({ limit: 100 }).limit, 50);
    assert.equal(validateConfluenceInput({ limit: 0 }).limit, 1);
    assert.equal(validateConfluenceInput({ limit: 'x' }).ok, false);
  });
});
describe('buildConfluencePagesUrl (fix #11)', () => {
  it('scopes by space id and status, newest first', () => {
    assert.equal(
      buildConfluencePagesUrl({ spaceId: '42', status: 'archived', limit: 10 }),
      '/wiki/api/v2/pages?space-id=42&status=archived&sort=-modified-date&limit=10',
    );
  });

  it('omits absent filters and clamps the limit', () => {
    assert.equal(
      buildConfluencePagesUrl({}),
      '/wiki/api/v2/pages?sort=-modified-date&limit=10',
    );
    assert.equal(
      buildConfluencePagesUrl({ limit: 99 }),
      '/wiki/api/v2/pages?sort=-modified-date&limit=50',
    );
  });
});

describe('normalizeConfluencePage webui (fix #11)', () => {
  it('keeps _links.webui for record links, null when absent', () => {
    assert.equal(
      normalizeConfluencePage({ id: 7, title: 'Runbook', _links: { webui: '/spaces/AT/pages/7' } }).webui,
      '/spaces/AT/pages/7',
    );
    assert.equal(normalizeConfluencePage({ id: 7, title: 'Runbook' }).webui, null);
  });
});
