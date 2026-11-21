import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';

// Live readiness service — the frontend's only path to the
// getReadiness resolver (v2.1.0 formula, computed in the backend).
// The resolver returns null score when the snapshot holds no records;
// that is not an error, it is "nothing to score".

export interface LiveBlocker {
  key: string;
  id: string | null;
  summary: string;
  priority: string | null;
  assignee: string | null;
  updated: string;
}

export interface LiveIncident {
  key: string;
  summary: string;
  priority: string | null;
  status: string;
}

export interface ReadinessBreakdown {
  Bcrit: number;
  Isev: number;
  Pstale: number;
  Dmissing: number;
}

export interface LiveReadiness {
  score: number | null;
  breakdown: ReadinessBreakdown;
  counts: { jiraTotal: number; jiraOpen: number; jsmTotal: number; jsmOpen: number };
  blockers: LiveBlocker[];
  incidents: LiveIncident[];
  unavailable: string[];
  notes: string[];
  generatedAt: string;
}

export type LiveReadinessResult =
  | { ok: true; readiness: LiveReadiness }
  | { ok: false; error: { kind: string; message: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function cleanBlocker(value: unknown): LiveBlocker | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null;
  return {
    key: value.key,
    id: typeof value.id === 'string' ? value.id : null,
    summary: str(value.summary) || '(no summary)',
    priority: typeof value.priority === 'string' ? value.priority : null,
    assignee: typeof value.assignee === 'string' ? value.assignee : null,
    updated: str(value.updated),
  };
}

function cleanIncident(value: unknown): LiveIncident | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null;
  return {
    key: value.key,
    summary: str(value.summary) || '(no summary)',
    priority: typeof value.priority === 'string' ? value.priority : null,
    status: str(value.status) || 'Unknown',
  };
}

export async function fetchLiveReadiness(): Promise<LiveReadinessResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getReadiness', {});
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
    const breakdown = isRecord(result.breakdown) ? result.breakdown : {};
    const counts = isRecord(result.counts) ? result.counts : {};
    const blockers: LiveBlocker[] = Array.isArray(result.blockers)
      ? result.blockers.flatMap((raw) => {
          const b = cleanBlocker(raw);
          return b ? [b] : [];
        })
      : [];
    const incidents: LiveIncident[] = Array.isArray(result.incidents)
      ? result.incidents.flatMap((raw) => {
          const r = cleanIncident(raw);
          return r ? [r] : [];
        })
      : [];
    return {
      ok: true,
      readiness: {
        score: typeof result.score === 'number' ? result.score : null,
        breakdown: {
          Bcrit: num(breakdown.Bcrit),
          Isev: num(breakdown.Isev),
          Pstale: num(breakdown.Pstale),
          Dmissing: num(breakdown.Dmissing),
        },
        counts: {
          jiraTotal: num(counts.jiraTotal),
          jiraOpen: num(counts.jiraOpen),
          jsmTotal: num(counts.jsmTotal),
          jsmOpen: num(counts.jsmOpen),
        },
        blockers,
        incidents,
        unavailable: Array.isArray(result.unavailable)
          ? result.unavailable.filter((s): s is string => typeof s === 'string')
          : [],
        notes: Array.isArray(result.notes)
          ? result.notes.filter((s): s is string => typeof s === 'string')
          : [],
        generatedAt: str(result.generatedAt),
      },
    };
  } catch {
    return { ok: false, error: backendUnreachableError('Jira') };
  }
}
