export const DEFAULT_PROJECT_LIMIT = 20;
export const MAX_PROJECT_LIMIT = 50;
export function validateProjectInput(payload) {
  if (payload == null) return { ok: true, limit: DEFAULT_PROJECT_LIMIT };
  if (typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'Request payload must be an object.' } };
  const raw = payload.limit;
  if (raw == null) return { ok: true, limit: DEFAULT_PROJECT_LIMIT };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'limit must be a number.' } };
  return { ok: true, limit: Math.min(MAX_PROJECT_LIMIT, Math.max(1, Math.floor(raw))) };
}
export function normalizeJiraProject(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string' || typeof raw.name !== 'string') return null;
  return { id: typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : raw.key, key: raw.key, name: raw.name, projectType: typeof raw.projectTypeKey === 'string' ? raw.projectTypeKey : 'Unknown' };
}
export function parseJiraProjects(data) {
  const rows = Array.isArray(data?.values) ? data.values : Array.isArray(data?.projects) ? data.projects : [];
  return rows.map(normalizeJiraProject).filter(Boolean).slice(0, MAX_PROJECT_LIMIT);
}