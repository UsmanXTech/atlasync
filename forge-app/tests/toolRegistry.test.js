// Tests for the Phase B agent tool registry (forge-app/src/agent/
// toolRegistry.js). Pure validation/shaping only — no Forge imports,
// no live Atlassian calls.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  MAX_TOOL_OUTPUT_CHARS,
  READ_TOOLS,
  TOOL_DEFINITIONS,
  WRITE_TOOLS,
  buildAgentSystemPrompt,
  extractToolCalls,
  isReadTool,
  isWriteTool,
  previewWriteAction,
  shapeTraceEntry,
  truncateToolOutput,
  validateToolArgs,
} from '../src/agent/toolRegistry.js';

describe('tool sets', () => {
  it('declares 4 read + 3 write tools, no overlap', () => {
    assert.equal(READ_TOOLS.length, 4);
    assert.equal(WRITE_TOOLS.length, 3);
    assert.equal(TOOL_DEFINITIONS.length, 7);
    assert.deepEqual(new Set([...READ_TOOLS, ...WRITE_TOOLS]).size, 7);
    for (const def of TOOL_DEFINITIONS) {
      assert.equal(def.type, 'function');
      assert.equal(typeof def.function.name, 'string');
      assert.equal(def.function.parameters.additionalProperties, false);
    }
  });

  it('classifies read vs write tools', () => {
    assert.equal(isReadTool('get_jira_blockers'), true);
    assert.equal(isWriteTool('get_jira_blockers'), false);
    assert.equal(isWriteTool('transition_jira_issue'), true);
    assert.equal(isReadTool('transition_jira_issue'), false);
    assert.equal(isReadTool('nope'), false);
    assert.equal(isWriteTool('nope'), false);
  });
});

describe('validateToolArgs', () => {
  it('accepts valid args for every read tool', () => {
    assert.deepEqual(validateToolArgs('get_jira_blockers', { projectKey: 'ATLAS' }), { ok: true, args: { projectKey: 'ATLAS' } });
    assert.deepEqual(validateToolArgs('get_jsm_incidents', { severity: 'Highest' }), { ok: true, args: { severity: 'Highest' } });
    assert.deepEqual(validateToolArgs('search_confluence_runbooks', { query: 'release runbook' }), { ok: true, args: { query: 'release runbook' } });
    assert.deepEqual(validateToolArgs('get_pr_bottlenecks', { projectKey: 'atlas' }), { ok: true, args: { projectKey: 'ATLAS' } });
  });

  it('accepts valid args for every write tool', () => {
    assert.deepEqual(
      validateToolArgs('escalate_jira_blocker', { issueKey: 'atlas-482', comment: 'Escalating: blocks release.', priority: 'Highest' }),
      { ok: true, args: { issueKey: 'ATLAS-482', comment: 'Escalating: blocks release.', priority: 'Highest' } },
    );
    assert.deepEqual(
      validateToolArgs('transition_jira_issue', { issueKey: 'ATLAS-482', transitionName: 'In Progress' }),
      { ok: true, args: { issueKey: 'ATLAS-482', transitionName: 'In Progress' } },
    );
    assert.deepEqual(
      validateToolArgs('create_confluence_release_report', { spaceKey: 'eng', title: 'Release 2.1', markdownSummary: '# Notes\n- shipped' }),
      { ok: true, args: { spaceKey: 'ENG', title: 'Release 2.1', markdownSummary: '# Notes\n- shipped' } },
    );
  });

  it('rejects unknown tools and non-object args', () => {
    assert.equal(validateToolArgs('delete_everything', {}).ok, false);
    assert.equal(validateToolArgs('get_jira_blockers', null).ok, false);
    assert.equal(validateToolArgs('get_jira_blockers', 'ATLAS').ok, false);
    assert.equal(validateToolArgs('get_jira_blockers', []).ok, false);
  });

  it('rejects unknown argument keys', () => {
    const r = validateToolArgs('get_jira_blockers', { projectKey: 'ATLAS', dropTable: true });
    assert.equal(r.ok, false);
    assert.match(r.error.message, /Unknown argument 'dropTable'/);
  });

  it('rejects malformed keys and severities', () => {
    assert.equal(validateToolArgs('get_jira_blockers', { projectKey: 'at las' }).ok, false);
    assert.equal(validateToolArgs('get_jira_blockers', { projectKey: 'A'.repeat(11) }).ok, false);
    assert.equal(validateToolArgs('escalate_jira_blocker', { issueKey: 'ATLAS', comment: 'x', priority: 'Highest' }).ok, false);
    assert.equal(validateToolArgs('get_jsm_incidents', { severity: 'SEV-1' }).ok, false);
    assert.equal(validateToolArgs('escalate_jira_blocker', { issueKey: 'ATLAS-1', comment: 'x', priority: 'Critical' }).ok, false);
  });

  it('rejects oversized values', () => {
    assert.equal(validateToolArgs('search_confluence_runbooks', { query: 'x'.repeat(201) }).ok, false);
    assert.equal(validateToolArgs('escalate_jira_blocker', { issueKey: 'ATLAS-1', comment: 'x'.repeat(1001), priority: 'High' }).ok, false);
    assert.equal(validateToolArgs('transition_jira_issue', { issueKey: 'ATLAS-1', transitionName: 'x'.repeat(101) }).ok, false);
    assert.equal(validateToolArgs('create_confluence_release_report', { spaceKey: 'ENG', title: 't', markdownSummary: 'x'.repeat(5001) }).ok, false);
  });

  it('rejects missing required args', () => {
    assert.equal(validateToolArgs('escalate_jira_blocker', { issueKey: 'ATLAS-1', comment: 'x' }).ok, false);
    assert.equal(validateToolArgs('get_jsm_incidents', {}).ok, false);
  });
});

describe('previewWriteAction', () => {
  it('shapes exact target + params for the approval card', () => {
    assert.deepEqual(
      previewWriteAction('escalate_jira_blocker', { issueKey: 'ATLAS-482', comment: 'c', priority: 'Highest' }),
      { tool: 'escalate_jira_blocker', target: 'ATLAS-482', params: { comment: 'c', priority: 'Highest' } },
    );
    assert.deepEqual(
      previewWriteAction('transition_jira_issue', { issueKey: 'ATLAS-482', transitionName: 'Done' }),
      { tool: 'transition_jira_issue', target: 'ATLAS-482', params: { transitionName: 'Done' } },
    );
    assert.deepEqual(
      previewWriteAction('create_confluence_release_report', { spaceKey: 'ENG', title: 't', markdownSummary: 'm' }),
      { tool: 'create_confluence_release_report', target: 'ENG', params: { title: 't', markdownSummary: 'm' } },
    );
    assert.equal(previewWriteAction('get_jira_blockers', { projectKey: 'ATLAS' }), null);
  });
});

describe('shapeTraceEntry', () => {
  it('caps long args and normalizes duration', () => {
    const entry = shapeTraceEntry({ step: 2, tool: 'escalate_jira_blocker', args: { comment: 'x'.repeat(600) }, status: 'awaiting-approval', durationMs: 123.6 });
    assert.equal(entry.step, 2);
    assert.equal(entry.status, 'awaiting-approval');
    assert.equal(entry.durationMs, 124);
    assert.ok(entry.args.length <= 501);
    assert.ok(entry.args.endsWith('…'));
  });
});

describe('truncateToolOutput', () => {
  it('passes short output through and caps long output', () => {
    assert.equal(truncateToolOutput('short'), 'short');
    const long = truncateToolOutput('x'.repeat(MAX_TOOL_OUTPUT_CHARS + 100));
    assert.ok(long.length < MAX_TOOL_OUTPUT_CHARS + 100);
    assert.match(long, /truncated/);
  });
});

describe('extractToolCalls', () => {
  it('returns no calls for a plain text answer', () => {
    assert.deepEqual(extractToolCalls({ role: 'assistant', content: 'hello' }), { ok: true, calls: [] });
    assert.deepEqual(extractToolCalls(null), { ok: true, calls: [] });
  });

  it('parses well-formed tool calls', () => {
    const message = {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'c1', type: 'function', index: 0, function: { name: 'get_jira_blockers', arguments: { projectKey: 'ATLAS' } } }],
    };
    assert.deepEqual(extractToolCalls(message), {
      ok: true,
      calls: [{ id: 'c1', name: 'get_jira_blockers', args: { projectKey: 'ATLAS' } }],
    });
  });

  it('parses string arguments — the real Forge LLM shape', () => {
    const message = {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'c1', type: 'function', index: 0, function: { name: 'get_jira_blockers', arguments: '{"projectKey":"ATLAS"}' } }],
    };
    assert.deepEqual(extractToolCalls(message), {
      ok: true,
      calls: [{ id: 'c1', name: 'get_jira_blockers', args: { projectKey: 'ATLAS' } }],
    });
  });

  it('rejects malformed tool calls', () => {
    assert.equal(extractToolCalls({ tool_calls: 'nope' }).ok, false);
    assert.equal(
      extractToolCalls({ tool_calls: [{ function: { name: 'x', arguments: 'not json' } }] }).ok,
      false,
    );
    assert.equal(
      extractToolCalls({ tool_calls: [{ function: { name: 'x', arguments: '[1,2]' } }] }).ok,
      false,
    );
    assert.equal(extractToolCalls({ tool_calls: [{ function: {} }] }).ok, false);
  });
});

describe('buildAgentSystemPrompt', () => {
  it('requires citations and states approval-gating, without the read-only sentence', () => {
    const prompt = buildAgentSystemPrompt({});
    assert.match(prompt, /CITATIONS REQUIRED/);
    assert.match(prompt, /APPROVAL-GATED/);
    assert.match(prompt, /Never claim a write has happened/);
    assert.doesNotMatch(prompt, /The app is read-only/);
    assert.match(prompt, /No readiness score is available/);
  });

  it('includes the exact readiness breakdown when available', () => {
    const prompt = buildAgentSystemPrompt({
      readiness: { score: 41, breakdown: { Bcrit: 2, Isev: 1, Pstale: 2, Dmissing: 1 }, generatedAt: '2026-11-21T00:00:00.000Z' },
    });
    assert.match(prompt, /Latest readiness score: 41%/);
    assert.match(prompt, /Bcrit 2, Isev 1, Pstale 2, Dmissing 1/);
  });
});
