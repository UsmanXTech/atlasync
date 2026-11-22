// Tests for buildReadinessReport (forge-app/src/readiness.js, Phase C1).
// The report is the single computation behind the getReadiness resolver
// and the daily snapshot trigger — it runs here against injected fake
// fetchers, never a live Atlassian API.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildReadinessReport } from '../src/readiness.js';

const issue = (overrides = {}) => ({
  key: 'ATLAS-1',
  id: '10001',
  summary: 'Something',
  status: 'In Progress',
  priority: 'Medium',
  assignee: 'Sara Khan',
  updated: '2026-11-20T00:00:00.000Z',
  ...overrides,
});

const request = (overrides = {}) => ({
  key: 'SUP-1',
  summary: 'Help',
  status: 'Open',
  requestType: 'Incident',
  priority: 'Medium',
  ...overrides,
});

const deps = (overrides = {}) => ({
  fetchJiraIssues: async () => [
    issue({ key: 'ATLAS-1', priority: 'Highest', assignee: null }),
    issue({ key: 'ATLAS-2', priority: 'Critical', assignee: 'Omar Farooq' }),
    issue({ key: 'ATLAS-3', priority: 'High' }),
    issue({ key: 'ATLAS-4', priority: 'Highest', status: 'Done' }),
  ],
  fetchConfluencePages: async () => [{ title: 'Runbook', status: 'current', spaceId: 'ENG' }],
  fetchJsmRequests: async () => [
    request({ key: 'SUP-1', priority: 'Highest' }),
    request({ key: 'SUP-2', priority: 'Low' }),
  ],
  countStalePrsForIssues: async () => 2,
  ...overrides,
});

describe('buildReadinessReport', () => {
  it('computes the v2.1.0 score from the injected snapshot', async () => {
    const report = await buildReadinessReport(deps());
    assert.equal(report.ok, true);
    // Bcrit 2 (ATLAS-1 Highest + ATLAS-2 Critical; Done ATLAS-4 excluded),
    // Isev 1, Pstale 2, Dmissing 1 (ATLAS-1 unassigned):
    // 100 - (12*2 + 15*1 + 5*2 + 10*1) = 100 - 59 = 41.
    assert.equal(report.score, 41);
    assert.deepEqual(report.breakdown, { Bcrit: 2, Isev: 1, Pstale: 2, Dmissing: 1 });
    assert.equal(report.counts.jiraOpen, 3);
    assert.equal(report.counts.jsmOpen, 2);
    // The blocker list is the ONE user-facing definition — open, High
    // priority or above — so ATLAS-3 (High) joins ATLAS-1/ATLAS-2.
    // The score still uses the Highest/Critical-only formula inputs
    // (Bcrit 2, Dmissing 1), so it stays 41.
    assert.equal(report.blockers.length, 3);
    assert.deepEqual(
      report.blockers.map((b) => b.key),
      ['ATLAS-1', 'ATLAS-2', 'ATLAS-3'],
    );
    assert.equal(report.blockerCount, 3);
    assert.equal(report.blockersUnassigned, 1);
    assert.equal(report.incidents.length, 1);
    assert.deepEqual(report.unavailable, []);
    assert.ok(typeof report.generatedAt === 'string');
    assert.ok(report.notes.some((n) => n.includes('48-hour age test')));
  });

  it('answers ok:false when the Jira snapshot cannot load', async () => {
    const report = await buildReadinessReport(
      deps({ fetchJiraIssues: async () => { throw new Error('Jira unavailable'); } }),
    );
    assert.equal(report.ok, false);
    assert.equal(report.error.kind, 'API_ERROR');
    assert.match(report.error.message, /Jira snapshot/);
  });

  it('still scores when Confluence is unavailable, and records it', async () => {
    const report = await buildReadinessReport(
      deps({ fetchConfluencePages: async () => { throw new Error('Confluence unavailable'); } }),
    );
    assert.equal(report.ok, true);
    assert.equal(report.score, 41);
    assert.deepEqual(report.unavailable, ['Confluence unavailable']);
  });

  it('returns a null score on an empty snapshot', async () => {
    const report = await buildReadinessReport(
      deps({
        fetchJiraIssues: async () => [],
        fetchJsmRequests: async () => [],
        countStalePrsForIssues: async () => 0,
      }),
    );
    assert.equal(report.ok, true);
    assert.equal(report.score, null);
    assert.deepEqual(report.breakdown, { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 });
  });
});
