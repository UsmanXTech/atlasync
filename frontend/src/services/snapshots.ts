import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
export interface ReadinessSnapshot { date: string; score: number | null; breakdown: { Bcrit: number; Isev: number; Pstale: number; Dmissing: number }; counts: { jiraTotal: number; jiraOpen: number; jsmTotal: number; jsmOpen: number }; generatedAt: string }
export type SnapshotsResult = { ok: true; snapshots: ReadinessSnapshot[] } | { ok: false; error: { kind: string; message: string } };
function isSnapshot(value: unknown): value is ReadinessSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const b = v.breakdown as Record<string, unknown> | undefined;
  const c = v.counts as Record<string, unknown> | undefined;
  return typeof v.date === 'string' && (typeof v.score === 'number' || v.score === null)
    && !!b && ['Bcrit', 'Isev', 'Pstale', 'Dmissing'].every((k) => typeof b[k] === 'number')
    && !!c && ['jiraTotal', 'jiraOpen', 'jsmTotal', 'jsmOpen'].every((k) => typeof c[k] === 'number')
    && typeof v.generatedAt === 'string';
}
export async function fetchSnapshots(): Promise<SnapshotsResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getSnapshots', {});
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true || !Array.isArray(value.snapshots)) {
      const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Insights') } };
    }
    // Newest first; the backend already sorts, but never trust order.
    const snapshots = (value.snapshots as unknown[]).filter(isSnapshot).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { ok: true, snapshots };
  } catch { return { ok: false, error: backendUnreachableError('Insights') }; }
}
