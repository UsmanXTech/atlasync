export interface IntelligenceSources { jiraIssues: number; confluencePages: number; jsmRequests: number; unavailable: string[] }
export type IntelligenceResult = { ok: true; answer: string; sources: IntelligenceSources } | { ok: false; error: { kind: string; message: string } };
export async function askAtlasync(prompt: string): Promise<IntelligenceResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('askAtlasync', { prompt });
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: 'Unexpected response from Forge.' } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true || typeof value.answer !== 'string') {
      const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
      return { ok: false, error: { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : 'Intelligence request failed.' } };
    }
    const raw = value.sources && typeof value.sources === 'object' ? value.sources as Record<string, unknown> : {};
    return { ok: true, answer: value.answer, sources: { jiraIssues: typeof raw.jiraIssues === 'number' ? raw.jiraIssues : 0, confluencePages: typeof raw.confluencePages === 'number' ? raw.confluencePages : 0, jsmRequests: typeof raw.jsmRequests === 'number' ? raw.jsmRequests : 0, unavailable: Array.isArray(raw.unavailable) ? raw.unavailable.filter((s): s is string => typeof s === 'string') : [] } };
  } catch { return { ok: false, error: { kind: 'BACKEND_UNREACHABLE', message: 'Live Intelligence is available only inside the installed Forge app.' } }; }
}
