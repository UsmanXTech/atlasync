import assert from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeJsmRequest, parseJsmRequests, validateJsmInput } from '../src/jsm.js';
describe('JSM request normalization', () => {
  it('normalizes safe request fields', () => {
    assert.deepEqual(normalizeJsmRequest({ issueKey: 'SD-1', requestFieldValues: { summary: 'VPN down', priority: { name: 'High' } }, currentStatus: { status: 'Open' }, requestType: { name: 'Incident' }, createdDate: '2026-01-01', secret: 'discard' }), { key: 'SD-1', summary: 'VPN down', status: 'Open', requestType: 'Incident', priority: 'High', created: '2026-01-01' });
  });
  it('skips malformed requests', () => {
    assert.deepEqual(parseJsmRequests({ values: [null, {}, { issueKey: 'SD-2' }] }), [{ key: 'SD-2', summary: '(no summary)', status: 'Unknown', requestType: 'Service request', priority: null, created: '' }]);
    assert.deepEqual(parseJsmRequests({}), []);
  });
  it('validates and clamps limits', () => {
    assert.equal(validateJsmInput({ limit: 100 }).limit, 50);
    assert.equal(validateJsmInput({ limit: 0 }).limit, 1);
    assert.equal(validateJsmInput({ limit: 'x' }).ok, false);
  });
});