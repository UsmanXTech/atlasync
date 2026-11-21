// Tests for the Phase B agent loop (forge-app/src/agent/loop.js) and
// the markdown→storage conversion (toolExecutors.js). The loop runs
// against a scripted fake chat + fake read executor — no @forge/llm,
// no live Atlassian calls. The write executor is never called here:
// the loop must HALT before any mutation.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { extractText, runAgentLoop, summarizeAfterApproval } from '../src/agent/loop.js';
import { markdownToStorage } from '../src/agent/toolExecutors.js';

const textAnswer = (text) => ({ choices: [{ message: { role: 'assistant', content: text } }] });
const toolCall = (id, name, args) => ({
  choices: [
    {
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ id, type: 'function', index: 0, function: { name, arguments: args } }],
      },
    },
  ],
});

function fakeChat(script) {
  const requests = [];
  let i = 0;
  const chat = async (req) => {
    requests.push(req);
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    return typeof step === 'function' ? step(req) : step;
  };
  chat.requests = requests;
  return chat;
}

describe('runAgentLoop', () => {
  it('returns a final answer with no tools, trace empty', async () => {
    const chat = fakeChat([textAnswer('All clear. No blockers found.')]);
    const result = await runAgentLoop({ chat, prompt: 'Are we ready to release?' });
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.answer, 'All clear. No blockers found.');
    assert.deepEqual(result.trace, []);
    assert.equal(chat.requests.length, 1);
    assert.equal(chat.requests[0].model, 'claude-sonnet-5');
    assert.equal(chat.requests[0].tools.length, 8);
    assert.equal(chat.requests[0].tool_choice, 'auto');
  });

  it('auto-executes a read tool and feeds the output back', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'ATLAS' }),
      textAnswer('Found 1 blocker: [ATLAS-482] Checkout timeout.'),
    ]);
    const seen = [];
    const executeRead = async (name, args) => {
      seen.push([name, args]);
      return { ok: true, output: JSON.stringify({ count: 1, issues: [{ key: 'ATLAS-482' }] }) };
    };
    const result = await runAgentLoop({ chat, prompt: 'What is blocking us?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.match(result.answer, /ATLAS-482/);
    assert.equal(result.trace.length, 1);
    assert.equal(result.trace[0].tool, 'get_jira_blockers');
    assert.equal(result.trace[0].status, 'ok');
    assert.deepEqual(seen, [['get_jira_blockers', { projectKey: 'ATLAS' }]]);
    const toolMessage = result.messages.find((m) => m.role === 'tool');
    assert.match(toolMessage.content, /ATLAS-482/);
  });

  it('discovers the project key first, then queries its blockers', async () => {
    const chat = fakeChat([
      toolCall('c1', 'list_jira_projects', '{}'),
      toolCall('c2', 'get_jira_blockers', '{"projectKey":"AT"}'),
      textAnswer('AT-1 is the top blocker.'),
    ]);
    const seen = [];
    const executeRead = async (name, args) => {
      seen.push([name, args]);
      if (name === 'list_jira_projects') {
        return {
          ok: true,
          output: '{}',
          records: [{ kind: 'project', key: 'AT', title: 'Atlasync Test', path: '/jira/software/projects/AT' }],
        };
      }
      return {
        ok: true,
        output: '{}',
        records: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }],
      };
    };
    const result = await runAgentLoop({ chat, prompt: 'What is blocking the release?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.deepEqual(seen, [
      ['list_jira_projects', { limit: 20 }],
      ['get_jira_blockers', { projectKey: 'AT' }],
    ]);
    assert.deepEqual(
      result.citations.map((c) => c.key),
      ['AT', 'AT-1'],
    );
  });

  it('executes a read tool whose arguments arrive as a JSON string (real LLM shape)', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', '{"projectKey":"ATLAS"}'),
      textAnswer('Found 1 blocker.'),
    ]);
    const seen = [];
    const executeRead = async (name, args) => {
      seen.push([name, args]);
      return { ok: true, output: '{}', records: [{ kind: 'jira', key: 'ATLAS-482', title: 'Checkout timeout', path: '/browse/ATLAS-482' }] };
    };
    const result = await runAgentLoop({ chat, prompt: 'What is blocking us?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.deepEqual(seen, [['get_jira_blockers', { projectKey: 'ATLAS' }]]);
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].key, 'ATLAS-482');
  });

  it('truncates huge read-tool output before feeding it back', async () => {
    const chat = fakeChat([toolCall('c1', 'get_jira_blockers', { projectKey: 'ATLAS' }), textAnswer('done')]);
    const executeRead = async () => ({ ok: true, output: 'x'.repeat(9000) });
    const result = await runAgentLoop({ chat, prompt: 'q', executeRead });
    const toolMessage = result.messages.find((m) => m.role === 'tool');
    assert.ok(toolMessage.content.length < 5000);
    assert.match(toolMessage.content, /truncated/);
  });

  it('HALTS on a write tool and never executes it', async () => {
    const chat = fakeChat([toolCall('c1', 'escalate_jira_blocker', { issueKey: 'ATLAS-482', comment: 'Escalate.', priority: 'Highest' })]);
    let readCalls = 0;
    const executeRead = async () => {
      readCalls += 1;
      return { ok: true, output: '{}' };
    };
    let stored = null;
    const result = await runAgentLoop({
      chat,
      prompt: 'Escalate ATLAS-482.',
      executeRead,
      storePending: async (action) => {
        stored = action;
        return { actionId: 'act_test1', threadId: 'agent-thread:c1:a1' };
      },
    });
    assert.equal(result.status, 'AWAITING_APPROVAL');
    assert.equal(readCalls, 0);
    assert.equal(result.pendingAction.actionId, 'act_test1');
    assert.equal(result.pendingAction.threadId, 'agent-thread:c1:a1');
    assert.deepEqual(result.pendingAction.preview, {
      tool: 'escalate_jira_blocker',
      target: 'ATLAS-482',
      params: { comment: 'Escalate.', priority: 'Highest' },
    });
    assert.equal(result.trace[0].status, 'awaiting-approval');
    assert.equal(stored.tool, 'escalate_jira_blocker');
    assert.equal(chat.requests.length, 1);
  });

  it('rejects an invalid tool call, tells the model, and continues', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'not a key!!' }),
      textAnswer('No valid project key was available, so I could not list blockers.'),
    ]);
    const result = await runAgentLoop({ chat, prompt: 'List blockers.' });
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.trace[0].status, 'rejected');
    assert.equal(result.trace[0].tool, 'get_jira_blockers');
    const rejection = result.messages.find((m) => m.role === 'tool');
    assert.match(rejection.content, /rejected/);
  });

  it('rejects an unknown tool and continues', async () => {
    const chat = fakeChat([
      toolCall('c1', 'delete_everything', {}),
      textAnswer('That tool does not exist.'),
    ]);
    const result = await runAgentLoop({ chat, prompt: 'Delete everything.' });
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.trace[0].status, 'rejected');
  });

  it('rejects malformed tool calls and continues', async () => {
    const chat = fakeChat([
      { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'x', arguments: 'not json' } }] } }] },
      textAnswer('Recovered from a malformed call.'),
    ]);
    const result = await runAgentLoop({ chat, prompt: 'q' });
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.trace[0].tool, '(malformed)');
    assert.equal(result.trace[0].status, 'rejected');
  });

  it('stops at the 5-step budget with an honest note', async () => {
    const chat = fakeChat([toolCall('c1', 'get_jira_blockers', { projectKey: 'ATLAS' })]);
    const executeRead = async () => ({ ok: true, output: '{}' });
    const result = await runAgentLoop({ chat, prompt: 'q', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.match(result.answer, /5-step tool budget/);
    assert.equal(result.trace.length, 5);
    assert.equal(chat.requests.length, 5);
  });

  it('includes prior turns and readiness in the first request', async () => {
    const chat = fakeChat([textAnswer('ok')]);
    await runAgentLoop({
      chat,
      prompt: 'Follow up?',
      priorTurns: [{ question: 'First?', answer: 'First answer.' }],
      readiness: { score: 41, breakdown: { Bcrit: 2, Isev: 1, Pstale: 2, Dmissing: 1 }, generatedAt: '2026-11-21T00:00:00.000Z' },
    });
    const system = chat.requests[0].messages[0];
    assert.match(system.content, /Latest readiness score: 41%/);
    assert.equal(chat.requests[0].messages[1].content, 'First?');
    assert.equal(chat.requests[0].messages[2].content, 'First answer.');
  });
});

describe('summarizeAfterApproval', () => {
  it('calls chat once with tools disabled and returns the summary', async () => {
    const chat = fakeChat([textAnswer('The escalation was approved and executed on [ATLAS-482].')]);
    const answer = await summarizeAfterApproval({
      chat,
      messages: [{ role: 'user', content: 'Escalate ATLAS-482.' }],
      outcomeText: 'The approved action EXECUTED successfully.',
    });
    assert.match(answer, /ATLAS-482/);
    assert.equal(chat.requests[0].tool_choice, 'none');
    assert.equal(chat.requests.length, 1);
  });
});

describe('extractText', () => {
  it('handles string and part-array content', () => {
    assert.equal(extractText({ content: 'hi' }), 'hi');
    assert.equal(extractText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a\nb');
    assert.equal(extractText(null), '');
  });
});

describe('markdownToStorage', () => {
  it('converts headings, bullets and paragraphs, escaping HTML', () => {
    const out = markdownToStorage('# Release 2.1\n\nShipped <fast>.\n\n- one\n- two');
    assert.equal(out, '<h1>Release 2.1</h1><p>Shipped &lt;fast&gt;.</p><ul><li>one</li><li>two</li></ul>');
  });

  it('returns a placeholder for empty input', () => {
    assert.equal(markdownToStorage(''), '<p>(empty summary)</p>');
  });
});

describe('runAgentLoop citations (Phase 1)', () => {
  it('collects citations from read tools, deduped, malformed dropped', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'ATLAS' }),
      toolCall('c2', 'search_confluence_runbooks', { query: 'release' }),
      textAnswer('Two blockers, see sources.'),
    ]);
    const executeRead = async (name) => {
      if (name === 'get_jira_blockers') {
        return {
          ok: true,
          output: '{}',
          records: [
            { kind: 'jira', key: 'ATLAS-482', title: 'Checkout timeout', path: '/browse/ATLAS-482' },
            { kind: 'jira', key: 'ATLAS-482', title: 'Checkout timeout', path: '/browse/ATLAS-482' },
            { kind: 'bogus', key: 'X', title: 'Dropped' },
          ],
        };
      }
      return {
        ok: true,
        output: '{}',
        records: [{ kind: 'confluence', key: '123', title: 'Release runbook', path: '/wiki/spaces/X/pages/123' }],
      };
    };
    const result = await runAgentLoop({ chat, prompt: 'What is blocking us?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.deepEqual(result.citations, [
      { kind: 'jira', key: 'ATLAS-482', title: 'Checkout timeout', path: '/browse/ATLAS-482' },
      { kind: 'confluence', key: '123', title: 'Release runbook', path: '/wiki/spaces/X/pages/123' },
    ]);
    assert.ok(typeof result.generatedAt === 'string' && result.generatedAt !== '');
  });

  it('carries citations into the pending action on a write halt', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'ATLAS' }),
      toolCall('c2', 'escalate_jira_blocker', { issueKey: 'ATLAS-482', comment: 'Escalate.', priority: 'Highest' }),
    ]);
    const executeRead = async () => ({
      ok: true,
      output: '{}',
      records: [{ kind: 'jira', key: 'ATLAS-482', title: 'Checkout timeout', path: '/browse/ATLAS-482' }],
    });
    let stored = null;
    const result = await runAgentLoop({
      chat,
      prompt: 'Escalate ATLAS-482.',
      executeRead,
      storePending: async (action) => {
        stored = action;
        return { actionId: 'act_test1', threadId: 'agent-thread:c1:a1' };
      },
    });
    assert.equal(result.status, 'AWAITING_APPROVAL');
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].key, 'ATLAS-482');
    assert.equal(stored.citations.length, 1);
  });
});
