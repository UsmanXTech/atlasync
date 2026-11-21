import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
export interface ThreadTurn { question: string; answer: string; at: string }
export interface ThreadLastReadiness { score: number | null; breakdown: { Bcrit: number; Isev: number; Pstale: number; Dmissing: number }; generatedAt: string }
export type ThreadResult = { ok: true; turns: ThreadTurn[]; lastReadiness: ThreadLastReadiness | null } | { ok: false; error: { kind: string; message: string } };
function isTurn(value: unknown): value is ThreadTurn {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.question === 'string' && typeof v.answer === 'string' && typeof v.at === 'string';
}
function isLastReadiness(value: unknown): value is ThreadLastReadiness {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const b = v.breakdown as Record<string, unknown> | undefined;
  return (typeof v.score === 'number' || v.score === null) && !!b
    && ['Bcrit', 'Isev', 'Pstale', 'Dmissing'].every((k) => typeof b[k] === 'number')
    && typeof v.generatedAt === 'string';
}
export async function fetchThread(): Promise<ThreadResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getThread', {});
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true || !Array.isArray(value.turns)) {
      const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Intelligence') } };
    }
    return {
      ok: true,
      turns: (value.turns as unknown[]).filter(isTurn),
      lastReadiness: value.lastReadiness === null ? null : isLastReadiness(value.lastReadiness) ? value.lastReadiness : null,
    };
  } catch { return { ok: false, error: backendUnreachableError('Intelligence') }; }
}
export async function clearThread(): Promise<{ ok: boolean; error?: { kind: string; message: string } }> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('clearThread', {});
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true) {
      const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Intelligence') } };
    }
    return { ok: true };
  } catch { return { ok: false, error: backendUnreachableError('Intelligence') }; }
}
