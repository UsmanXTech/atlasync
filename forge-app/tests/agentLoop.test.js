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
    assert.equal(chat.requests[0].tools.length, 9);
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

  it('never sends an empty text block after a tool call with no text', async () => {
    // Regression: the real Forge LLM rejects empty text content
    // blocks, and a pure tool-call response carries content ''. The
    // loop pushed that '' into the history verbatim, so the NEXT chat
    // call threw ForgeLlmAPIError live — 6x in a row — while the
    // unit-test fake never validated. Every message sent must carry
    // non-empty text.
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', '{"projectKey":"AT"}'),
      textAnswer('AT-1 is the top blocker.'),
    ]);
    const executeRead = async () => ({
      ok: true,
      output: '{}',
      records: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }],
    });
    const result = await runAgentLoop({ chat, prompt: 'What is blocking the release?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.equal(chat.requests.length, 2);
    for (const req of chat.requests) {
      for (const m of req.messages) {
        assert.equal(typeof m.content, 'string');
        assert.notEqual(m.content.trim(), '', `empty content in ${m.role} message`);
      }
    }
    const pushed = chat.requests[1].messages.find((m) => m.role === 'assistant' && m.tool_calls);
    assert.equal(pushed.content, '(no text)');
  });

  it('drops a prior turn whole when either side is blank', async () => {
    const chat = fakeChat([textAnswer('All clear.')]);
    await runAgentLoop({
      chat,
      prompt: 'Are we ready?',
      priorTurns: [
        { question: 'What is blocking?', answer: '' },
        { question: 'What is blocking?', answer: 'AT-1 is the top blocker.' },
      ],
    });
    const messages = chat.requests[0].messages;
    assert.deepEqual(
      messages.map((m) => m.role),
      ['system', 'user', 'assistant', 'user'],
    );
    assert.match(messages[2].content, /AT-1 is the top blocker/);
  });

  it('injects the project keys into the system prompt and calls the blocker tool with them', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', '{"projectKey":"AT"}'),
      textAnswer('AT-1 is the top blocker.'),
    ]);
    const seen = [];
    const executeRead = async (name, args) => {
      seen.push([name, args]);
      return {
        ok: true,
        output: '{}',
        records: [{ kind: 'jira', key: 'AT-1', title: 'Checkout timeout', path: '/browse/AT-1' }],
      };
    };
    const result = await runAgentLoop({
      chat,
      prompt: 'What is blocking the release?',
      projects: [{ key: 'AT', name: 'Atlasync Test' }],
      executeRead,
    });
    assert.equal(result.status, 'COMPLETE');
    assert.match(chat.requests[0].messages[0].content, /Available Jira projects: AT \(Atlasync Test\)/);
    assert.deepEqual(seen, [['get_jira_blockers', { projectKey: 'AT' }]]);
    assert.deepEqual(
      result.citations.map((c) => c.key),
      ['AT-1'],
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

describe('sourceCounts (fix #4)', () => {
  it('counts coverage from the tool results, per source, including bitbucket', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'AT' }),
      toolCall('c2', 'get_jsm_incidents', { severity: 'Highest' }),
      toolCall('c3', 'get_pr_bottlenecks', { projectKey: 'AT' }),
      toolCall('c4', 'search_confluence_runbooks', { query: 'deploy' }),
      textAnswer('AT-1 blocks the release; two PRs are stale.'),
    ]);
    const executeRead = async (name) => {
      switch (name) {
        case 'get_jira_blockers':
          // 3 rows read, but no citable records — coverage must still
          // count 3, where the old citation count read 0.
          return { ok: true, output: '{}', count: 3, records: [] };
        case 'get_jsm_incidents':
          // Exact-priority filter dropped every row: honestly 0.
          return { ok: true, output: '{}', count: 0, records: [] };
        case 'get_pr_bottlenecks':
          return {
            ok: true,
            output: '{}',
            count: 2,
            records: [
              { kind: 'bitbucket', key: 'Fix login', title: 'AT-1 — Fix login', url: 'https://bitbucket.example/pr/1' },
              { kind: 'bitbucket', key: 'Bump deps', title: 'AT-2 — Bump deps', url: 'https://bitbucket.example/pr/2' },
            ],
          };
        default:
          return {
            ok: true,
            output: '{}',
            count: 1,
            records: [{ kind: 'confluence', key: '7', title: 'Deploy runbook', path: '/wiki/spaces/AT/pages/7' }],
          };
      }
    };
    const result = await runAgentLoop({ chat, prompt: 'What blocks the release?', executeRead });
    assert.equal(result.status, 'COMPLETE');
    assert.deepEqual(result.sourceCounts, { jira: 3, confluence: 1, jsm: 0, bitbucket: 2 });
    // Citations (the Sources link list) are NOT the coverage: only 3
    // records were citable, but 6 rows were read.
    assert.equal(result.citations.length, 3);
  });

  it('falls back to records.length when a tool returns no count', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'AT' }),
      textAnswer('done'),
    ]);
    const executeRead = async () => ({
      ok: true,
      output: '{}',
      records: [
        { kind: 'jira', key: 'AT-1', title: 'a', path: '/browse/AT-1' },
        { kind: 'jira', key: 'AT-2', title: 'b', path: '/browse/AT-2' },
      ],
    });
    const result = await runAgentLoop({ chat, prompt: 'q', executeRead });
    assert.deepEqual(result.sourceCounts, { jira: 2, confluence: 0, jsm: 0, bitbucket: 0 });
  });

  it('a failed read tool adds nothing to coverage', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'AT' }),
      toolCall('c2', 'get_jsm_incidents', { severity: 'Highest' }),
      textAnswer('done'),
    ]);
    const executeRead = async (name) => {
      if (name === 'get_jsm_incidents') return { ok: false, error: { kind: 'API_ERROR', message: 'JSM down' } };
      return { ok: true, output: '{}', count: 1, records: [] };
    };
    const result = await runAgentLoop({ chat, prompt: 'q', executeRead });
    assert.deepEqual(result.sourceCounts, { jira: 1, confluence: 0, jsm: 0, bitbucket: 0 });
  });

  it('a no-tool answer reports zero coverage', async () => {
    const chat = fakeChat([textAnswer('All clear.')]);
    const result = await runAgentLoop({ chat, prompt: 'Are we ready?' });
    assert.deepEqual(result.sourceCounts, { jira: 0, confluence: 0, jsm: 0, bitbucket: 0 });
  });

  it('carries sourceCounts into the pending record on a write halt', async () => {
    const chat = fakeChat([
      toolCall('c1', 'get_jira_blockers', { projectKey: 'AT' }),
      toolCall('c2', 'escalate_jira_blocker', { issueKey: 'AT-1', comment: 'Escalate.', priority: 'Highest' }),
    ]);
    const executeRead = async () => ({ ok: true, output: '{}', count: 2, records: [] });
    let stored = null;
    const result = await runAgentLoop({
      chat,
      prompt: 'Escalate AT-1.',
      executeRead,
      storePending: async (action) => {
        stored = action;
        return { actionId: 'act_test1', threadId: 'agent-thread:c1:a1' };
      },
    });
    assert.equal(result.status, 'AWAITING_APPROVAL');
    assert.deepEqual(result.sourceCounts, { jira: 2, confluence: 0, jsm: 0, bitbucket: 0 });
    assert.deepEqual(stored.sourceCounts, { jira: 2, confluence: 0, jsm: 0, bitbucket: 0 });
  });
});
