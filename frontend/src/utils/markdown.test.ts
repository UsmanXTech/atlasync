// Tests for the Markdown parser (frontend/src/utils/markdown.ts).
// Run with Node's built-in runner — no new dependency:
//   node --test frontend/src/utils/markdown.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMarkdown } from './markdown.ts';

// Fix #12: the LLM's usual loose-list style (blank line between
// items) used to split one ordered list into a single-item <ol> per
// item, each rendering "1." — the parser broke the list loop on the
// blank line and Markdown.tsx rendered each block as a fresh <ol>.
test('loose ordered list stays one list with all items', () => {
  const blocks = parseMarkdown('1. Alpha\n\n2. Beta\n\n3. Gamma');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.type, 'list');
  if (blocks[0]?.type !== 'list') return;
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].items.length, 3);
});

test('loose unordered list stays one list', () => {
  const blocks = parseMarkdown('- Alpha\n\n- Beta\n\n- Gamma');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.type, 'list');
  if (blocks[0]?.type !== 'list') return;
  assert.equal(blocks[0].ordered, false);
  assert.equal(blocks[0].items.length, 3);
});

test('a paragraph between lists keeps them separate', () => {
  const blocks = parseMarkdown('1. Alpha\n\nSome text.\n\n1. Beta');
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0]?.type, 'list');
  assert.equal(blocks[1]?.type, 'paragraph');
  assert.equal(blocks[2]?.type, 'list');
});

test('ordered and unordered lists are not merged', () => {
  const blocks = parseMarkdown('1. Alpha\n\n- Beta');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.type, 'list');
  assert.equal(blocks[1]?.type, 'list');
});

test('tight list is unchanged', () => {
  const blocks = parseMarkdown('1. Alpha\n2. Beta');
  assert.equal(blocks.length, 1);
  if (blocks[0]?.type !== 'list') return;
  assert.equal(blocks[0].items.length, 2);
});
