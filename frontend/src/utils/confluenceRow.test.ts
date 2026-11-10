import assert from 'node:assert';
import { describe, it } from 'node:test';
import { confluenceStatusTone } from './confluenceStatus.ts';
import { formatUpdated } from './formatUpdated.ts';

// Confluence row metadata (Run 15, main 32ceae1): rows used to show
// internal identifiers ("Page ID … · Space …") and a bare unstyled
// status pill. The metadata is now the last-updated date the service
// already fetches, and the pill carries a tone derived from the
// Confluence v2 status — the text stays Confluence's own status word.
describe('confluenceStatusTone', () => {
  it('marks a published page healthy', () => {
    assert.equal(confluenceStatusTone('current'), 'healthy');
  });

  it('marks a trashed page blocked', () => {
    assert.equal(confluenceStatusTone('trashed'), 'blocked');
  });

  it('keeps archived and draft neutral', () => {
    assert.equal(confluenceStatusTone('archived'), 'pending');
    assert.equal(confluenceStatusTone('draft'), 'pending');
  });

  it('degrades unknown and empty statuses to neutral, case-insensitively', () => {
    assert.equal(confluenceStatusTone('Unknown'), 'pending');
    assert.equal(confluenceStatusTone(''), 'pending');
    assert.equal(confluenceStatusTone('  Current '), 'healthy');
  });
});

describe('formatUpdated', () => {
  it('returns a dash for an empty date', () => {
    assert.equal(formatUpdated(''), '—');
  });

  it('passes an unparseable date through unchanged', () => {
    assert.equal(formatUpdated('not-a-date'), 'not-a-date');
  });

  it('formats an ISO date as a short locale date + time', () => {
    const out = formatUpdated('2026-11-10T07:30:00.000Z');
    assert.notEqual(out, '2026-11-10T07:30:00.000Z');
    assert.match(out, /Nov 10/);
    assert.match(out, /\d{1,2}:\d{2}/);
  });
});
