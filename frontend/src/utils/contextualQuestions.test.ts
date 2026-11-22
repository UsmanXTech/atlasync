import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXTUAL_QUESTIONS,
  OVERVIEW_STAT_QUESTIONS,
  contextualQuestionFor,
  FULL_BRIEFING_QUESTION,
  overviewStatQuestionFor,
  questionForProject,
  READINESS_QUESTION,
} from './contextualQuestions.ts';

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

// Phase 3.1 — per-stat questions: each names its metric's topic and
// carries no digits at all, so no displayed number can leak into the
// prompt as if the agent had seen it.
test('overview stat questions name their metric topic and carry no numbers', () => {
  const topics: Record<keyof typeof OVERVIEW_STAT_QUESTIONS, string[]> = {
    openIssues: ['open Jira issues', 'tackle first'],
    blockers: ['Highest and Critical Jira blockers', 'blocking delivery', 'unblock first'],
    stalePrs: ['pull requests on critical issues', 'least recently updated', 'blocking', 'move first'],
    incidents: ['Highest and Critical JSM incidents', 'attention first', 'impact'],
  };
  for (const [key, words] of Object.entries(topics) as [keyof typeof OVERVIEW_STAT_QUESTIONS, string[]][]) {
    const q = overviewStatQuestionFor(key);
    assert.equal(q, OVERVIEW_STAT_QUESTIONS[key]);
    assert.ok(q.length > 0 && q.length <= 1500, `question for ${key} must fit the 1–1500 limit`);
    assert.ok(!/\d/.test(q), `question for ${key} must not contain a number`);
    for (const word of words) {
      assert.ok(q.includes(word), `question for ${key} should name "${word}"`);
    }
  }
});

// Phase 3.2 — per-project ask names the project and tells the agent
// to admit it when the snapshot has no evidence for that project.
test('questionForProject names the project and admits missing evidence', () => {
  const q = questionForProject('AT');
  assert.ok(q.length > 0 && q.length <= 1500, 'question must fit the 1–1500 limit');
  assert.ok(q.includes('project AT'), 'question should name the project');
  assert.ok(q.includes('no evidence'), 'question should let the agent admit missing evidence');
  assert.ok(q.includes('rather than guessing'), 'question should forbid guessing');
});

test('contextual questions stay inside the resolver prompt limit and carry no invented data', () => {
  for (const q of Object.values(CONTEXTUAL_QUESTIONS)) {
    assert.ok(q.length >= 1 && q.length <= 1500, `question length ${q.length} outside 1–1500`);
    assert.ok(!/\d/.test(q), 'question must not contain numbers (no demo counts as facts)');
    assert.ok(!/sample|demo/i.test(q), 'question must not ask about sample/demo data');
  }
});

test('fix #13: the two navigate-only buttons have their decided questions', () => {
  assert.equal(READINESS_QUESTION, 'Are we ready to release?');
  assert.equal(
    FULL_BRIEFING_QUESTION,
    "Summarize today's briefing, including readiness, top blockers, and stale work.",
  );
});
