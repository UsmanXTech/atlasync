import assert from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeJsmRequest, parseJsmRequests, summarizeJsmRequests, validateJsmInput } from '../src/jsm.js';

// Fixture shaped like the documented GET /rest/servicedeskapi/request
// response (developer.atlassian.com, "Get customer requests"): top-level
// summary string, requestFieldValues as an ARRAY of { fieldId, label, value },
// createdDate as an object { epochMillis, iso8601 }.
const documentedResponse = {
  values: [
    {
      issueId: '107001',
      issueKey: 'HELPDESK-1',
      summary: 'Request JSD help via REST',
      requestTypeId: '25',
      serviceDeskId: '10',
      createdDate: { epochMillis: 1444290120000, friendly: 'Monday 14:42 PM', iso8601: '2015-10-08T14:42:00+0700', jira: '2015-10-08T14:42:00.000+0700' },
      requestFieldValues: [
        { fieldId: 'summary', label: 'What do you need?', value: 'Request JSD help via REST' },
        { fieldId: 'description', label: 'Why do you need this?', value: 'I need a new *mouse* for my Mac' },
        { fieldId: 'priority', label: 'Priority', value: { id: '3', name: 'High' } },
      ],
      currentStatus: { status: 'Waiting for Support', statusCategory: 'NEW' },
      secret: 'discard',
    },
    {
      issueKey: 'HELPDESK-2',
      createdDate: { epochMillis: 1444289400000, iso8601: '2015-10-08T14:30:00+0700' },
      requestFieldValues: [
        { fieldId: 'summary', label: 'What do you need?', value: 'Request a new account' },
        { fieldId: 'priority', label: 'Priority', value: 'Medium' },
      ],
      currentStatus: { status: 'Waiting for Support' },
    },
  ],
};

describe('JSM request normalization', () => {
  it('normalizes a real documented response (array requestFieldValues)', () => {
    assert.deepEqual(parseJsmRequests(documentedResponse), [
      { key: 'HELPDESK-1', summary: 'Request JSD help via REST', status: 'Waiting for Support', requestType: 'Service request', priority: 'High', created: '2015-10-08T14:42:00+0700' },
      { key: 'HELPDESK-2', summary: 'Request a new account', status: 'Waiting for Support', requestType: 'Service request', priority: 'Medium', created: '2015-10-08T14:30:00+0700' },
    ]);
  });

  it('falls back to the summary field value when no top-level summary exists', () => {
    assert.deepEqual(
      normalizeJsmRequest({
        issueKey: 'SD-9',
        requestFieldValues: [{ fieldId: 'summary', value: 'Printer on level 3 did not work' }],
        currentStatus: { status: 'Open' },
      }),
      { key: 'SD-9', summary: 'Printer on level 3 did not work', status: 'Open', requestType: 'Service request', priority: null, created: '' },
    );
  });

  it('derives created from epochMillis when no iso8601 is present', () => {
    const request = normalizeJsmRequest({ issueKey: 'SD-10', createdDate: { epochMillis: 0 } });
    assert.equal(request.created, '1970-01-01T00:00:00.000Z');
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

describe('summarizeJsmRequests (fix #11)', () => {
  const rows = [
    { key: 'AS-1', summary: 'VPN down', status: 'Open', requestType: 'Incident', priority: 'Highest' },
    { key: 'AS-2', summary: 'New laptop', status: 'Open', requestType: 'Service request', priority: 'Medium' },
    { key: 'AS-3', summary: 'Access request', status: 'Waiting for support', requestType: 'Service request', priority: 'Low' },
    { key: 'AS-4', summary: 'Printer jam', status: 'Resolved', requestType: 'Incident', priority: 'Low' },
  ];

  it('counts the full set by type and status, then filters + slices', () => {
    const out = summarizeJsmRequests(rows, { status: 'Open' });
    assert.equal(out.total, 4);
    assert.deepEqual(out.countsByType, { Incident: 2, 'Service request': 2 });
    assert.deepEqual(out.countsByStatus, { Open: 2, 'Waiting for support': 1, Resolved: 1 });
    assert.equal(out.count, 2);
    assert.deepEqual(out.requests.map((r) => r.key), ['AS-1', 'AS-2']);
  });

  it('filters by request type and caps the limit at 10', () => {
    const out = summarizeJsmRequests(rows, { requestType: 'Incident', limit: 1 });
    assert.equal(out.count, 1);
    assert.equal(out.requests[0].key, 'AS-1');
    // The grouping still describes the whole desk, not the slice.
    assert.deepEqual(out.countsByType, { Incident: 2, 'Service request': 2 });
  });

  it('returns empty rows and zero counts for an empty desk', () => {
    assert.deepEqual(summarizeJsmRequests([], {}), { total: 0, countsByType: {}, countsByStatus: {}, count: 0, requests: [] });
    assert.deepEqual(summarizeJsmRequests(null, {}), { total: 0, countsByType: {}, countsByStatus: {}, count: 0, requests: [] });
  });
});
