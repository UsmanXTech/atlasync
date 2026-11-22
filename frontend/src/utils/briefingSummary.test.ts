import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIEFING_SUMMARY_QUESTION, briefingSummarySnapshotLabel } from './briefingSummary.ts';

test('summary question asks for exactly one sentence about what needs attention', () => {
  assert.match(BRIEFING_SUMMARY_QUESTION, /exactly one sentence/i);
  assert.match(BRIEFING_SUMMARY_QUESTION, /needs attention most/i);
});

test('summary question names all three live sources', () => {
  for (const source of ['Jira', 'Confluence', 'JSM']) {
    assert.ok(BRIEFING_SUMMARY_QUESTION.includes(source), `missing ${source}`);
  }
});

test('summary question grounds the answer in the live snapshot only', () => {
  assert.match(BRIEFING_SUMMARY_QUESTION, /live snapshot/i);
});

test('summary question never asks about what the snapshot cannot show', () => {
  // No updated dates in the snapshot (so no age/staleness), no owners,
  // no PRs, no incidents — asking for any of those would invite invention.
  const forbidden = ['oldest', 'stale', 'days ago', 'owner', 'pull request', 'incident'];
  for (const word of forbidden) {
    assert.ok(!BRIEFING_SUMMARY_QUESTION.toLowerCase().includes(word), `forbidden: ${word}`);
  }
});

test('summary question carries no sample/demo wording and no numbers', () => {
  assert.ok(!/sample|demo/i.test(BRIEFING_SUMMARY_QUESTION));
  assert.ok(!/\d/.test(BRIEFING_SUMMARY_QUESTION), 'no digits — counts would leak as live fact');
  assert.ok(BRIEFING_SUMMARY_QUESTION.length < 300, 'well inside the resolver 1,500-char limit');
});

test('snapshot label states the real counts askAtlasync returned (fix #7)', () => {
  assert.equal(
    briefingSummarySnapshotLabel({ jiraIssues: 9, confluencePages: 10, jsmRequests: 1 }),
    'answered from 9 Jira · 10 Confluence · 1 JSM',
  );
  assert.equal(
    briefingSummarySnapshotLabel({ jiraIssues: 10, confluencePages: 10, jsmRequests: 10 }),
    'answered from 10 Jira · 10 Confluence · 10 JSM',
  );
});

test('snapshot label falls back to the cap wording without sources', () => {
  assert.equal(briefingSummarySnapshotLabel(null), 'up to 10 per source');
  assert.equal(briefingSummarySnapshotLabel(undefined), 'up to 10 per source');
});
