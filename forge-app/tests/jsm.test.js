import assert from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeJsmRequest, parseJsmRequests, validateJsmInput } from '../src/jsm.js';

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
