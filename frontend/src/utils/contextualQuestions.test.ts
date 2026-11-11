import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXTUAL_QUESTIONS, contextualQuestionFor } from './contextualQuestions.ts';

// The contextual question is the prompt sent to the Forge LLM, so it must
// stay inside the resolver's 1–1500 character limit, name the view's topics
// (not its numbers — Overview stats are sample data), and never mention
// demo/sample data as something to analyze.
test('overview contextual question names every overview topic', () => {
  const q = contextualQuestionFor('overview');
  assert.equal(q, CONTEXTUAL_QUESTIONS.overview);
  for (const topic of ['open issues', 'active blockers', 'PRs awaiting action', 'open incidents', 'release readiness']) {
    assert.ok(q.includes(topic), `question should name "${topic}"`);
  }
});

test('projects contextual question names every projects topic', () => {
  const q = contextualQuestionFor('projects');
  assert.equal(q, CONTEXTUAL_QUESTIONS.projects);
  for (const topic of ['live Jira projects', 'open issues', 'blockers', 'attention']) {
    assert.ok(q.includes(topic), `question should name "${topic}"`);
  }
});

test('confluence contextual question names every confluence topic', () => {
  const q = contextualQuestionFor('confluence');
  assert.equal(q, CONTEXTUAL_QUESTIONS.confluence);
  for (const topic of ['live Confluence pages', 'page status', 'archived', 'attention', 'clean up']) {
    assert.ok(q.includes(topic), `question should name "${topic}"`);
  }
});

test('jsm contextual question names every jsm topic', () => {
  const q = contextualQuestionFor('jsm');
  assert.equal(q, CONTEXTUAL_QUESTIONS.jsm);
  for (const topic of ['live JSM requests', 'request types', 'statuses', 'priorities', 'attention']) {
    assert.ok(q.includes(topic), `question should name "${topic}"`);
  }
});

test('contextual questions stay inside the resolver prompt limit and carry no invented data', () => {
  for (const q of Object.values(CONTEXTUAL_QUESTIONS)) {
    assert.ok(q.length >= 1 && q.length <= 1500, `question length ${q.length} outside 1–1500`);
    assert.ok(!/\d/.test(q), 'question must not contain numbers (no demo counts as facts)');
    assert.ok(!/sample|demo/i.test(q), 'question must not ask about sample/demo data');
  }
});
