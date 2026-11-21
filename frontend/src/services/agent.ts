import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
export interface TraceEntry { step: number; tool: string; args: string; status: string; durationMs: number }
export interface PendingActionPreview { tool: string; target: string; params: Record<string, unknown> }
export interface PendingAction { actionId: string; threadId: string; preview: PendingActionPreview }
// Phase 1 citation: a record the agent actually read (never invented).
// `path` is site-relative (/browse/AT-1, /wiki/...) and is prefixed with
// the Jira site URL from getSiteInfo; `url` is already absolute (e.g. a
// Bitbucket PR link) and is used as-is.
export interface Citation { kind: 'jira' | 'jsm' | 'confluence' | 'bitbucket'; key: string; title: string; path?: string; url?: string }
export type AgentResult =
  | { ok: true; status: 'COMPLETE'; answer: string; trace: TraceEntry[]; citations: Citation[]; generatedAt: string | null; executed?: unknown }
  | { ok: true; status: 'AWAITING_APPROVAL'; pendingAction: PendingAction; trace: TraceEntry[]; citations: Citation[]; generatedAt: string | null }
  | { ok: false; error: { kind: string; message: string } };
function isTrace(value: unknown): value is TraceEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every((e) => e && typeof e === 'object' && typeof (e as Record<string, unknown>).step === 'number' && typeof (e as Record<string, unknown>).tool === 'string' && typeof (e as Record<string, unknown>).status === 'string');
}
function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return ['jira', 'jsm', 'confluence', 'bitbucket'].includes(v.kind as string)
    && typeof v.key === 'string' && v.key !== '' && typeof v.title === 'string';
}
function toCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(isCitation).map((c) => {
    const out: Citation = { kind: c.kind, key: c.key, title: c.title };
    if (typeof c.path === 'string' && c.path !== '') out.path = c.path;
    if (typeof c.url === 'string' && c.url !== '') out.url = c.url;
    return out;
  });
}
function toGeneratedAt(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
function toError(value: Record<string, unknown>): { kind: string; message: string } {
  const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
  return { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Intelligence') };
}
function isPendingAction(value: unknown): value is PendingAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const p = v.preview as Record<string, unknown> | undefined;
  return typeof v.actionId === 'string' && typeof v.threadId === 'string'
    && !!p && typeof p.tool === 'string' && typeof p.target === 'string'
    && !!p.params && typeof p.params === 'object' && !Array.isArray(p.params);
}
export async function invokeAgent(prompt: string, conversationId?: string): Promise<AgentResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('invokeAgent', { prompt, ...(conversationId ? { conversationId } : {}) });
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true) return { ok: false, error: toError(value) };
    const trace = isTrace(value.trace) ? value.trace as TraceEntry[] : [];
    const citations = toCitations(value.citations);
    const generatedAt = toGeneratedAt(value.generatedAt);
    if (value.status === 'AWAITING_APPROVAL' && isPendingAction(value.pendingAction)) {
      return { ok: true, status: 'AWAITING_APPROVAL', pendingAction: value.pendingAction as PendingAction, trace, citations, generatedAt };
    }
    if (value.status === 'COMPLETE' && typeof value.answer === 'string') {
      return { ok: true, status: 'COMPLETE', answer: value.answer as string, trace, citations, generatedAt, executed: value.executed };
    }
    return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
  } catch { return { ok: false, error: backendUnreachableError('Intelligence') }; }
}
export async function approveAgentAction(input: { threadId: string; actionId: string; approved: boolean }): Promise<AgentResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('approveAgentAction', input);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true) return { ok: false, error: toError(value) };
    const trace = isTrace(value.trace) ? value.trace as TraceEntry[] : [];
    const citations = toCitations(value.citations);
    const generatedAt = toGeneratedAt(value.generatedAt);
    if (value.status === 'COMPLETE' && typeof value.answer === 'string') {
      return { ok: true, status: 'COMPLETE', answer: value.answer as string, trace, citations, generatedAt, executed: value.executed };
    }
    return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
  } catch { return { ok: false, error: backendUnreachableError('Intelligence') }; }
}
