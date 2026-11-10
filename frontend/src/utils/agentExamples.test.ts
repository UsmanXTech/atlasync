import assert from 'node:assert';
import { describe, it } from 'node:test';
import { AGENT_EXAMPLES } from './agentExamples.ts';
import { INTELLIGENCE_PRESETS } from './intelligencePresets.ts';

// Agents "Try it" examples (Run 16): every Intelligence preset must
// have exactly one example row, so adding a preset without a blurb
// (or removing one) fails here instead of shipping a blank row.
describe('AGENT_EXAMPLES', () => {
  it('covers every Intelligence preset exactly once', () => {
    assert.deepEqual(
      AGENT_EXAMPLES.map((e) => e.question).sort(),
      [...INTELLIGENCE_PRESETS].sort(),
    );
  });

  it('gives every example a distinct, non-empty blurb', () => {
    const blurbs = AGENT_EXAMPLES.map((e) => e.blurb);
    for (const b of blurbs) assert.ok(b.trim().length > 0, 'blurb must not be empty');
    assert.equal(new Set(blurbs).size, blurbs.length, 'blurbs must be distinct');
  });
});
