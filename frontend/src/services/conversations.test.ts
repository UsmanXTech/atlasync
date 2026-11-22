import assert from 'node:assert';
import { describe, it } from 'node:test';
import { sanitizeConversationTurn } from './conversations.ts';

// Turn citation sanitization (visual-behaviour-test fix #1): a restored
// answer keeps its Sources links only when the stored turn's citations
// survive the read path. Malformed entries are dropped; a turn with no
// usable citations loses the field instead of failing the restore.
describe('sanitizeConversationTurn', () => {
  it('keeps valid citations and drops malformed ones', () => {
    const turn = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      citations: [
        { kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' },
        { kind: 'jira', key: '', title: 'no key' },
        { kind: 'unknown', key: 'X-1', title: 'bad kind' },
        { kind: 'confluence', key: '12', title: 42 },
      ],
    });
    assert.deepEqual(turn.citations, [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }]);
  });

  it('drops the citations field when nothing usable remains', () => {
    const turn = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      citations: [{ kind: 'jira', key: '', title: 'no key' }],
    });
    assert.equal('citations' in turn, false);
  });

  it('passes through a turn with no citations field untouched', () => {
    const turn = { question: 'q', answer: 'a', at: '2026-11-22T00:00:00.000Z' };
    assert.deepEqual(sanitizeConversationTurn(turn), turn);
  });
});

describe('sanitizeConversationTurn sourceCounts (fix #4)', () => {
  it('keeps valid sourceCounts on the turn', () => {
    const turn = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      sourceCounts: { jira: 3, confluence: 1, jsm: 0, bitbucket: 2 },
    });
    assert.deepEqual(turn.sourceCounts, { jira: 3, confluence: 1, jsm: 0, bitbucket: 2 });
  });

  it('drops the sourceCounts field when nothing usable remains', () => {
    const allZero = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      sourceCounts: { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 },
    });
    assert.equal('sourceCounts' in allZero, false);
    const malformed = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      sourceCounts: { jira: '3', jsm: -1 },
    });
    assert.equal('sourceCounts' in malformed, false);
  });

  it('keeps citations and sourceCounts together', () => {
    const turn = sanitizeConversationTurn({
      question: 'q',
      answer: 'a',
      at: '2026-11-22T00:00:00.000Z',
      citations: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }],
      sourceCounts: { jira: 3, confluence: 0, jsm: 0, bitbucket: 0 },
    });
    assert.equal(turn.citations?.length, 1);
    assert.deepEqual(turn.sourceCounts, { jira: 3, confluence: 0, jsm: 0, bitbucket: 0 });
  });
});
