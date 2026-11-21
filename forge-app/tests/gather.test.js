// Tests for the shared snapshot gatherer (forge-app/src/gather.js).
// Fetchers are stubs — no Forge imports, no live Atlassian calls.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { gatherSnapshot } from '../src/gather.js';

describe('gatherSnapshot', () => {
  it('returns all three sources when every fetcher succeeds', async () => {
    const s = await gatherSnapshot({
      fetchJiraIssues: async () => [{ key: 'A-1' }],
      fetchConfluencePages: async () => [{ id: '1' }],
      fetchJsmRequests: async () => [{ key: 'S-1' }],
    });
    assert.deepEqual(s.jiraIssues, [{ key: 'A-1' }]);
    assert.deepEqual(s.confluencePages, [{ id: '1' }]);
    assert.deepEqual(s.jsmRequests, [{ key: 'S-1' }]);
    assert.deepEqual(s.unavailable, []);
  });

  it('isolates a failing source: the others still return, the failure is named', async () => {
    const s = await gatherSnapshot({
      fetchJiraIssues: async () => [{ key: 'A-1' }],
      fetchConfluencePages: async () => {
        throw new Error('Confluence unavailable');
      },
      fetchJsmRequests: async () => [{ key: 'S-1' }],
    });
    assert.deepEqual(s.jiraIssues, [{ key: 'A-1' }]);
    assert.deepEqual(s.confluencePages, []);
    assert.deepEqual(s.jsmRequests, [{ key: 'S-1' }]);
    assert.deepEqual(s.unavailable, ['Confluence unavailable']);
  });

  it('records every failure when all sources fail, de-duplicated', async () => {
    const s = await gatherSnapshot({
      fetchJiraIssues: async () => {
        throw new Error('Jira unavailable');
      },
      fetchConfluencePages: async () => {
        throw new Error('Jira unavailable');
      },
      fetchJsmRequests: async () => {
        throw new Error('JSM unavailable');
      },
    });
    assert.deepEqual(s.jiraIssues, []);
    assert.deepEqual(s.unavailable, ['Jira unavailable', 'JSM unavailable']);
  });

  it('treats a missing fetcher as an unavailable source', async () => {
    const s = await gatherSnapshot({ fetchJiraIssues: async () => [{ key: 'A-1' }] });
    assert.deepEqual(s.jiraIssues, [{ key: 'A-1' }]);
    assert.deepEqual(s.unavailable, ['Confluence unavailable', 'JSM unavailable']);
  });

  it('treats a non-array success as unavailable, never a crash', async () => {
    const s = await gatherSnapshot({
      fetchJiraIssues: async () => 'not-an-array',
      fetchConfluencePages: async () => [],
      fetchJsmRequests: async () => [],
    });
    assert.deepEqual(s.jiraIssues, []);
    assert.deepEqual(s.unavailable, ['Jira unavailable']);
  });
});
