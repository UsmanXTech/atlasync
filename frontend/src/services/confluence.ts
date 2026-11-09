import type { LiveConfluencePage } from '../data/types';
type SourceError = { kind: string; message: string };
type Result = { ok: true; pages: LiveConfluencePage[] } | { ok: false; error: SourceError };
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export async function fetchConfluencePages(limit = 20): Promise<Result> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getConfluencePages', { limit });
    if (!record(result) || typeof result.ok !== 'boolean') return { ok: false, error: { kind: 'API_ERROR', message: 'Unexpected response from Forge.' } };
    if (!result.ok) {
      const error = record(result.error) ? result.error : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : 'Confluence could not be reached.' } };
    }
    if (!Array.isArray(result.pages)) return { ok: false, error: { kind: 'API_ERROR', message: 'Unexpected Confluence response shape.' } };
    const pages: LiveConfluencePage[] = result.pages.filter(record).flatMap((p) => typeof p.id === 'string' && typeof p.title === 'string' ? [{ id: p.id, title: p.title, status: typeof p.status === 'string' ? p.status : 'Unknown', spaceId: typeof p.spaceId === 'string' ? p.spaceId : null, updated: typeof p.updated === 'string' ? p.updated : '' }] : []);
    return { ok: true, pages };
  } catch { return { ok: false, error: { kind: 'BACKEND_UNREACHABLE', message: 'Live Confluence is available only inside the installed Forge app.' } }; }
}