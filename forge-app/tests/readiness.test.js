// Tests for the v2.1.0 readiness + diagnostics helpers
// (forge-app/src/readiness.js). Pure functions only — no Forge imports,
// no live Atlassian calls.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  READINESS_WEIGHTS,
  computeReadinessScore,
  countStalePrs,
  diagnoseHealthStatus,
  isOpenPrStatus,
  isTopBlocker,
  selectCriticalBlockers,
  selectSevIncidents,
  selectTopBlockers,
} from '../src/readiness.js';

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
  requestType: 'Service request',
  priority: 'Medium',
  created: '2026-11-20T00:00:00.000Z',
  ...overrides,
});

describe('computeReadinessScore (v2.1.0 formula)', () => {
  it('scores 100 with no deductions — Medium/Low/High open issues do not deduct in v2.1.0', () => {
    const r = computeReadinessScore({
      issues: [issue({ status: 'Done' }), issue({ key: 'ATLAS-2', status: 'In Progress', priority: 'Low' }), issue({ key: 'ATLAS-3', status: 'In Progress', priority: 'High' })],
      jsmRequests: [request({ status: 'Resolved' })],
    });
    // Only Bcrit / Isev / Pstale / Dmissing deduct; Low and High are not scored.
    assert.equal(r.score, 100);
    assert.deepEqual(r.breakdown, { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 });
  });

  it('applies the spec weights: 12*Bcrit + 15*Isev + 5*Pstale + 10*Dmissing', () => {
    const r = computeReadinessScore({
      issues: [
        issue({ key: 'A-1', priority: 'Highest', assignee: 'Sara Khan' }),
        issue({ key: 'A-2', priority: 'Critical', assignee: null }),
      ],
      jsmRequests: [request({ priority: 'Highest' })],
      stalePrCount: 2,
    });
    // Bcrit=2 (12*2=24), Isev=1 (15), Pstale=2 (10), Dmissing=1 (10) => 100-59=41.
    assert.equal(r.score, 41);
    assert.deepEqual(r.breakdown, { Bcrit: 2, Isev: 1, Pstale: 2, Dmissing: 1 });
    assert.equal(READINESS_WEIGHTS.Bcrit, 12);
    assert.equal(READINESS_WEIGHTS.Isev, 15);
    assert.equal(READINESS_WEIGHTS.Pstale, 5);
    assert.equal(READINESS_WEIGHTS.Dmissing, 10);
  });

  it('clamps the score at 0', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      issue({ key: `A-${i}`, priority: 'Highest', assignee: null }),
    );
    const r = computeReadinessScore({ issues: many, jsmRequests: [], stalePrCount: 0 });
    // 10*12 + 10*10 = 220 deduction -> clamped to 0.
    assert.equal(r.score, 0);
    assert.equal(r.breakdown.Bcrit, 10);
    assert.equal(r.breakdown.Dmissing, 10);
  });

  it('scores the live 9-issue set at 78% — the set the 2026-11-21 review found', () => {
    // Live workspace on 2026-11-21: 1 open Highest unassigned (AT-1),
    // 1 High (AT-2), 4 Medium, 2 Low, 1 Done (AT-4); JSM has 1 open
    // High request (AS-1). The review found Overview showing 78%
    // while the Intelligence briefing showed 63% from its own
    // frontend formula — the briefing now uses this backend score, so
    // both surfaces must agree on 78%.
    // The review named 7 of the 8 open issues; the briefing counts
    // show a 4th Medium whose key was not in the report (AT-9 here is
    // a stand-in — Medium deducts nothing in v2.1.0, so the key
    // cannot affect the score).
    const r = computeReadinessScore({
      issues: [
        issue({ key: 'AT-1', priority: 'Highest', status: 'In Progress', assignee: null }),
        issue({ key: 'AT-2', priority: 'High', status: 'In Progress', assignee: 'Sara Khan' }),
        issue({ key: 'AT-3', priority: 'Medium', status: 'Open' }),
        issue({ key: 'AT-5', priority: 'Medium', status: 'Open' }),
        issue({ key: 'AT-6', priority: 'Medium', status: 'Open' }),
        issue({ key: 'AT-9', priority: 'Medium', status: 'Open' }),
        issue({ key: 'AT-7', priority: 'Low', status: 'Open' }),
        issue({ key: 'AT-8', priority: 'Low', status: 'Open' }),
        issue({ key: 'AT-4', priority: 'Highest', status: 'Done', assignee: 'Sara Khan' }),
      ],
      jsmRequests: [request({ key: 'AS-1', priority: 'High', status: 'Open' })],
      stalePrCount: 0,
    });
    // Bcrit=1 (AT-1, 12) + Dmissing=1 (AT-1 unassigned, 10) = 22 → 78.
    // High/Medium/Low, the Done issue and the High JSM request deduct
    // nothing in v2.1.0.
    assert.equal(r.score, 78);
    assert.deepEqual(r.breakdown, { Bcrit: 1, Isev: 0, Pstale: 0, Dmissing: 1 });
  });

  it('counts only open issues and open JSM requests; terminal statuses never deduct', () => {
    const r = computeReadinessScore({
      issues: [issue({ priority: 'Highest', status: 'Done' }), issue({ priority: 'Highest', status: 'Closed' })],
      jsmRequests: [request({ priority: 'Critical', status: 'Resolved' })],
    });
    assert.equal(r.score, 100);
    assert.deepEqual(r.breakdown, { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 });
  });

  it('treats priority case-insensitively and unassigned as missing assignee', () => {
    const r = computeReadinessScore({
      issues: [issue({ priority: 'HIGHEST', assignee: '  ' })],
      jsmRequests: [request({ priority: 'critical' })],
    });
    assert.deepEqual(r.breakdown, { Bcrit: 1, Isev: 1, Pstale: 0, Dmissing: 1 });
    assert.equal(r.score, 100 - 12 - 15 - 10);
  });

  it('returns a null score with a note for an empty snapshot', () => {
    const r = computeReadinessScore({ issues: [], jsmRequests: [] });
    assert.equal(r.score, null);
    assert.equal(r.notes.length, 1);
    assert.match(r.notes[0], /nothing to score/);
  });

  it('notes when no open linked PRs were found', () => {
    const r = computeReadinessScore({ issues: [issue()], jsmRequests: [] });
    assert.match(r.notes.join(' '), /No open linked pull requests/);
  });

  it('reports counts for the UI', () => {
    const r = computeReadinessScore({
      issues: [issue({ status: 'Done' }), issue()],
      jsmRequests: [request(), request({ status: 'Closed' })],
    });
    assert.deepEqual(r.counts, { jiraTotal: 2, jiraOpen: 1, jsmTotal: 2, jsmOpen: 1 });
  });
});

describe('diagnoseHealthStatus', () => {
  it('marks 2xx as connected', () => {
    const d = diagnoseHealthStatus('jira', 200);
    assert.equal(d.ok, true);
    assert.equal(d.code, 'OK');
    assert.equal(d.missingScopeHint, null);
  });

  it('maps 401/403 to PERMISSION_DENIED with a scope hint', () => {
    for (const source of ['jira', 'confluence', 'jsm']) {
      const d = diagnoseHealthStatus(source, 403);
      assert.equal(d.ok, false);
      assert.equal(d.code, 'PERMISSION_DENIED');
      assert.equal(typeof d.missingScopeHint, 'string');
      assert.ok(d.missingScopeHint.length > 0);
    }
    assert.match(diagnoseHealthStatus('jira', 401).missingScopeHint, /read:jira-work/);
    assert.match(diagnoseHealthStatus('confluence', 401).missingScopeHint, /read:confluence-space.summary/);
    assert.match(diagnoseHealthStatus('jsm', 401).missingScopeHint, /read:servicedesk-request/);
  });

  it('maps a JSM 404 to NOT_PROVISIONED, not an error to alarm on', () => {
    const d = diagnoseHealthStatus('jsm', 404);
    assert.equal(d.code, 'NOT_PROVISIONED');
    assert.match(d.message, /not provisioned/);
  });

  it('maps a non-JSM 404 to NOT_FOUND', () => {
    assert.equal(diagnoseHealthStatus('jira', 404).code, 'NOT_FOUND');
  });

  it('maps 429 to RATE_LIMITED and 500 to API_ERROR', () => {
    assert.equal(diagnoseHealthStatus('jira', 429).code, 'RATE_LIMITED');
    assert.equal(diagnoseHealthStatus('jira', 500).code, 'API_ERROR');
  });

  it('maps a missing status to UNREACHABLE and never leaks bodies', () => {
    const d = diagnoseHealthStatus('confluence', undefined);
    assert.equal(d.code, 'UNREACHABLE');
    assert.equal(JSON.stringify(d).includes('body'), false);
  });
});

describe('live-list selectors', () => {
  it('selectCriticalBlockers keeps only open Highest/Critical, newest first, max 10', () => {
    const list = [
      issue({ key: 'A-1', priority: 'Highest' }),
      issue({ key: 'A-2', priority: 'High' }),
      issue({ key: 'A-3', priority: 'Critical', status: 'Done' }),
      issue({ key: 'A-4', priority: 'Critical', assignee: null }),
    ];
    const out = selectCriticalBlockers(list);
    assert.deepEqual(
      out.map((b) => b.key),
      ['A-1', 'A-4'],
    );
    assert.equal(out[0].id, '10001');
    assert.equal(out[1].assignee, null);
  });

  // The ONE user-facing blocker definition: open, High priority or
  // above. Live review 2026-11-22: the stat card counted Highest/
  // Critical only (1) while the briefing counted High+ (2).
  it('selectTopBlockers keeps open High or above, including High and Major', () => {
    const list = [
      issue({ key: 'A-1', priority: 'Highest' }),
      issue({ key: 'A-2', priority: 'High' }),
      issue({ key: 'A-3', priority: 'Major' }),
      issue({ key: 'A-4', priority: 'Medium' }),
      issue({ key: 'A-5', priority: 'Critical', status: 'Done' }),
      issue({ key: 'A-6', priority: 'High', status: 'Resolved' }),
    ];
    const out = selectTopBlockers(list);
    assert.deepEqual(
      out.map((b) => b.key),
      ['A-1', 'A-2', 'A-3'],
    );
    assert.equal(isTopBlocker(issue({ priority: 'High' })), true);
    assert.equal(isTopBlocker(issue({ priority: 'Medium' })), false);
    assert.equal(isTopBlocker(issue({ priority: 'Highest', status: 'Done' })), false);
  });

  it('selectSevIncidents keeps only open Highest/Critical JSM requests', () => {
    const out = selectSevIncidents([
      request({ key: 'S-1', priority: 'Highest' }),
      request({ key: 'S-2', priority: 'Medium' }),
      request({ key: 'S-3', priority: 'Critical', status: 'Resolved' }),
    ]);
    assert.deepEqual(
      out.map((r) => r.key),
      ['S-1'],
    );
  });

  it('selectors tolerate non-array input', () => {
    assert.deepEqual(selectCriticalBlockers(null), []);
    assert.deepEqual(selectTopBlockers(undefined), []);
    assert.deepEqual(selectSevIncidents(undefined), []);
  });
});

describe('stale-PR signal', () => {
  it('counts OPEN as stale and MERGED/DECLINED as not stale', () => {
    const { count } = countStalePrs([
      { id: '1', name: 'A', status: 'OPEN', url: null },
      { id: '2', name: 'B', status: 'MERGED', url: null },
      { id: '3', name: 'C', status: 'DECLINED', url: null },
      { id: '4', name: 'D', status: 'open', url: null },
    ]);
    assert.equal(count, 2);
  });

  it('is case-insensitive and documents the missing-timestamp limit', () => {
    assert.equal(isOpenPrStatus('Open'), true);
    assert.equal(isOpenPrStatus('MERGED'), false);
    const { note } = countStalePrs([]);
    assert.match(note, /no updated timestamp/);
    assert.match(note, /48-hour/);
  });

  it('tolerates a non-array input', () => {
    assert.equal(countStalePrs(null).count, 0);
    assert.equal(countStalePrs(undefined).count, 0);
  });
});
