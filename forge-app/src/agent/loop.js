// Atlasync v2.1.0 Phase B — the agentic tool loop.
//
// The loop is dependency-injected: `chat` is the @forge/llm chat
// function in production and a scripted fake in unit tests; the read
// executor defaults to the real one and is likewise injectable. That
// keeps this module testable in plain Node with zero live calls.
//
// Flow (max 5 steps):
//   1. chat with native tool calling (tools + tool_choice 'auto').
//   2. No tool calls → final answer, loop complete.
//   3. READ tool → validate args, execute, feed the (truncated) output
//      back as a `tool` message, continue.
//   4. WRITE tool → validate args, store the pending action via the
//      injected `storePending` callback, HALT immediately and return
//      AWAITING_APPROVAL. Nothing is mutated on this path.
//   5. Invalid/unknown tool call → rejected in the trace, the model is
//      told why, loop continues. The step still counts.
//   6. Step budget exhausted → complete with an honest budget note,
//      never an invented answer.
//
// After approval, approveAgentAction calls summarizeAfterApproval: one
// more chat call with tool_choice 'none' so the model only summarizes
// the executed (or rejected) action — no nested write can sneak in.
import {
  MAX_AGENT_STEPS,
  TOOL_DEFINITIONS,
  buildAgentSystemPrompt,
  extractToolCalls,
  isWriteTool,
  previewWriteAction,
  shapeTraceEntry,
  truncateToolOutput,
  validateToolArgs,
} from './toolRegistry.js';
import { executeReadTool } from './toolExecutors.js';

const MODEL = 'claude-sonnet-5';
const MAX_COMPLETION_TOKENS = 1200;

export function extractText(message) {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
}

function truncate(text, max) {
  const s = typeof text === 'string' ? text : '';
  return s.length > max ? s.slice(0, max) : s;
}

export async function runAgentLoop({
  chat,
  prompt,
  priorTurns = [],
  readiness = null,
  executeRead = executeReadTool,
  storePending,
}) {
  const messages = [
    { role: 'system', content: buildAgentSystemPrompt({ readiness }) },
    ...priorTurns.slice(-3).flatMap((t) => [
      { role: 'user', content: truncate(t.question ?? '', 1500) },
      { role: 'assistant', content: truncate(t.answer ?? '', 4000) },
    ]),
    { role: 'user', content: prompt },
  ];
  const trace = [];

  for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
    const response = await chat({
      model: MODEL,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
    });
    const message = response?.choices?.[0]?.message;
    if (!message) {
      return { status: 'ERROR', error: 'The model returned an empty response.', trace, messages };
    }
    const text = extractText(message);
    const parsed = extractToolCalls(message);
    if (!parsed.ok) {
      trace.push(shapeTraceEntry({ step, tool: '(malformed)', args: {}, status: 'rejected', durationMs: 0 }));
      messages.push({ role: 'assistant', content: text || '(no text)' });
      messages.push({
        role: 'user',
        content: `Your tool call was rejected: ${parsed.error.message}. Reply with a valid tool call or a final answer.`,
      });
      continue;
    }
    if (parsed.calls.length === 0) {
      const answer = text.trim();
      if (!answer) {
        messages.push({ role: 'assistant', content: text });
        messages.push({ role: 'user', content: 'Please give a final answer in text.' });
        continue;
      }
      return {
        status: 'COMPLETE',
        answer: answer.slice(0, 12000),
        trace,
        messages: [...messages, { role: 'assistant', content: answer }],
      };
    }

    messages.push({ role: 'assistant', content: text, tool_calls: message.tool_calls });
    let halted = null;
    for (const call of parsed.calls) {
      const validation = validateToolArgs(call.name, call.args);
      if (!validation.ok) {
        trace.push(shapeTraceEntry({ step, tool: call.name, args: call.args, status: 'rejected', durationMs: 0 }));
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: `Tool call rejected: ${validation.error.message}`,
        });
        continue;
      }
      if (isWriteTool(call.name)) {
        const preview = previewWriteAction(call.name, validation.args);
        const pending = await storePending({
          tool: call.name,
          args: validation.args,
          preview,
          trace: [...trace],
          messages: [...messages],
        });
        trace.push(
          shapeTraceEntry({ step, tool: call.name, args: validation.args, status: 'awaiting-approval', durationMs: 0 }),
        );
        halted = { pendingAction: { ...pending, preview }, trace: [...trace] };
        break;
      }
      const started = Date.now();
      const result = await executeRead(call.name, validation.args);
      const durationMs = Date.now() - started;
      if (result.ok) {
        trace.push(shapeTraceEntry({ step, tool: call.name, args: validation.args, status: 'ok', durationMs }));
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: truncateToolOutput(result.output),
        });
      } else {
        trace.push(shapeTraceEntry({ step, tool: call.name, args: validation.args, status: 'error', durationMs }));
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: `Tool failed: ${result.error?.message ?? 'Unknown error.'}`,
        });
      }
    }
    if (halted) {
      return { status: 'AWAITING_APPROVAL', pendingAction: halted.pendingAction, trace: halted.trace, messages };
    }
  }

  return {
    status: 'COMPLETE',
    answer:
      'I reached the 5-step tool budget before finishing. What I gathered so far is in the execution trace — ask a narrower follow-up and I will continue from there.',
    trace,
    messages,
  };
}

// One summary call after approve/reject, with tools disabled so the
// model can only narrate the outcome — never start a new write.
export async function summarizeAfterApproval({ chat, messages, outcomeText }) {
  const next = [
    ...messages,
    { role: 'user', content: `${outcomeText}\n\nSummarize the outcome concisely for the user: what happened, what did not happen, and the smallest next step. Cite the issue key or page where relevant.` },
  ];
  const response = await chat({
    model: MODEL,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    messages: next,
    tool_choice: 'none',
  });
  const answer = extractText(response?.choices?.[0]?.message).trim();
  return answer === '' ? outcomeText : answer.slice(0, 12000);
}
