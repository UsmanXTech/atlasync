import type { LiveJsmRequest } from '../data/types';
import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
type SourceError = { kind: string; message: string };
type Result = { ok: true; requests: LiveJsmRequest[] } | { ok: false; error: SourceError };
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export async function fetchJsmRequests(limit = 20): Promise<Result> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getJsmRequests', { limit });
    if (!record(result) || typeof result.ok !== 'boolean') return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    if (!result.ok) {
      const error = record(result.error) ? result.error : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('JSM') } };
    }
    if (!Array.isArray(result.requests)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const requests: LiveJsmRequest[] = result.requests.filter(record).flatMap((r) => typeof r.key === 'string' && typeof r.summary === 'string' ? [{ key: r.key, summary: r.summary, status: typeof r.status === 'string' ? r.status : 'Unknown', requestType: typeof r.requestType === 'string' ? r.requestType : 'Service request', priority: typeof r.priority === 'string' ? r.priority : null, created: typeof r.created === 'string' ? r.created : '' }] : []);
    return { ok: true, requests };
  } catch { return { ok: false, error: backendUnreachableError('JSM') }; }
}
