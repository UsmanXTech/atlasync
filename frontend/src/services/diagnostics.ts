import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';

// Health diagnostics service — the frontend's only path to the
// getHealthDiagnostics resolver. The resolver pings Jira, Confluence
// and JSM and returns one structured entry per source; this service
// only validates the shape, it never invents statuses. A failure at
// the bridge stage means the Forge backend could not be reached (in
// the standalone preview there is no backend).

export type DiagnosticSource = 'jira' | 'confluence' | 'jsm';

export interface HealthDiagnostic {
  source: DiagnosticSource;
  ok: boolean;
  status: number;
  code: string;
  message: string;
  missingScopeHint: string | null;
}

export type HealthDiagnosticsResult =
  | { ok: true; diagnostics: HealthDiagnostic[] }
  | { ok: false; error: { kind: string; message: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanDiagnostic(value: unknown): HealthDiagnostic | null {
  if (!isRecord(value)) return null;
  if (value.source !== 'jira' && value.source !== 'confluence' && value.source !== 'jsm') return null;
  if (typeof value.ok !== 'boolean') return null;
  if (typeof value.message !== 'string') return null;
  return {
    source: value.source,
    ok: value.ok,
    status: typeof value.status === 'number' ? value.status : 0,
    code: typeof value.code === 'string' ? value.code : 'API_ERROR',
    message: value.message,
    missingScopeHint: typeof value.missingScopeHint === 'string' ? value.missingScopeHint : null,
  };
}

export async function fetchHealthDiagnostics(): Promise<HealthDiagnosticsResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getHealthDiagnostics', {});
    if (!isRecord(result) || typeof result.ok !== 'boolean') {
      return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    }
    if (!result.ok) {
      const error = isRecord(result.error) ? result.error : {};
      return {
        ok: false,
        error: {
          kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR',
          message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Jira'),
        },
      };
    }
    if (!Array.isArray(result.diagnostics)) {
      return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    }
    const diagnostics: HealthDiagnostic[] = [];
    for (const raw of result.diagnostics) {
      const entry = cleanDiagnostic(raw);
      if (entry) diagnostics.push(entry);
    }
    return { ok: true, diagnostics };
  } catch {
    return { ok: false, error: backendUnreachableError('Jira') };
  }
}
