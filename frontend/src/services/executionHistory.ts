// Phase 2 — execution history service. Reads the persistent run
// records written by invokeAgent / approveAgentAction (see
// forge-app/src/memory.js). Validation mirrors agent.ts: unknown
// shapes are dropped, never rendered as if they were runs.
import { backendUnreachableError, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
import type { Citation, TraceEntry } from './agent';

export type ExecutionRunStatus = 'COMPLETE' | 'AWAITING_APPROVAL' | 'ERROR' | 'APPROVED' | 'REJECTED' | 'EXECUTION_FAILED';

export interface ExecutionRun {
  id: string;
  question: string;
  status: ExecutionRunStatus;
  tool: string | null;
  target: string | null;
  trace: TraceEntry[];
  citations: Citation[];
  generatedAt: string;
  conversationId: string | null;
  error: string | null;
}

const RUN_STATUSES: ExecutionRunStatus[] = ['COMPLETE', 'AWAITING_APPROVAL', 'ERROR', 'APPROVED', 'REJECTED', 'EXECUTION_FAILED'];

function isTrace(value: unknown): value is TraceEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (e) =>
      e &&
      typeof e === 'object' &&
      typeof (e as Record<string, unknown>).step === 'number' &&
      typeof (e as Record<string, unknown>).tool === 'string' &&
      typeof (e as Record<string, unknown>).status === 'string',
  );
}

function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    ['jira', 'jsm', 'confluence', 'bitbucket'].includes(v.kind as string) &&
    typeof v.key === 'string' &&
    v.key !== '' &&
    typeof v.title === 'string'
  );
}

function toCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(isCitation).map((c) => {
    const out: Citation = { kind: (c as Citation).kind, key: (c as Citation).key, title: (c as Citation).title };
    if (typeof (c as Citation).path === 'string' && (c as Citation).path !== '') out.path = (c as Citation).path;
    if (typeof (c as Citation).url === 'string' && (c as Citation).url !== '') out.url = (c as Citation).url;
    return out;
  });
}

function isRun(value: unknown): value is ExecutionRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    v.id !== '' &&
    typeof v.question === 'string' &&
    v.question !== '' &&
    RUN_STATUSES.includes(v.status as ExecutionRunStatus) &&
    typeof v.generatedAt === 'string' &&
    v.generatedAt !== '' &&
    isTrace(v.trace)
  );
}

function toRun(value: unknown): ExecutionRun | null {
  if (!isRun(value)) return null;
  return {
    id: value.id,
    question: value.question,
    status: value.status,
    tool: typeof value.tool === 'string' && value.tool !== '' ? value.tool : null,
    target: typeof value.target === 'string' && value.target !== '' ? value.target : null,
    trace: value.trace,
    citations: toCitations(value.citations),
    generatedAt: value.generatedAt,
    conversationId:
      typeof value.conversationId === 'string' && value.conversationId !== '' ? value.conversationId : null,
    error: typeof value.error === 'string' && value.error !== '' ? value.error : null,
  };
}

export async function listExecutionHistory(): Promise<
  { ok: true; runs: ExecutionRun[] } | { ok: false; error: { kind: string; message: string } }
> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('listExecutionHistory', {});
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    }
    const value = result as Record<string, unknown>;
    if (value.ok !== true || !Array.isArray(value.runs)) {
      const error = value.error && typeof value.error === 'object' ? (value.error as Record<string, unknown>) : {};
      return {
        ok: false,
        error: {
          kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR',
          message: typeof error.message === 'string' ? error.message : UNEXPECTED_RESPONSE_MESSAGE,
        },
      };
    }
    return { ok: true, runs: (value.runs as unknown[]).map(toRun).filter((r): r is ExecutionRun => r !== null) };
  } catch {
    return { ok: false, error: backendUnreachableError('Intelligence') };
  }
}
