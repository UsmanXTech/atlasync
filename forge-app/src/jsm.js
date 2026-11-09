// Pure Jira Service Management normalization. No Forge imports or credentials.
export const DEFAULT_JSM_LIMIT = 20;
export const MAX_JSM_LIMIT = 50;
export function validateJsmInput(payload) {
  if (payload == null) return { ok: true, limit: DEFAULT_JSM_LIMIT };
  if (typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'Request payload must be an object.' } };
  const raw = payload.limit;
  if (raw == null) return { ok: true, limit: DEFAULT_JSM_LIMIT };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'limit must be a number.' } };
  return { ok: true, limit: Math.min(MAX_JSM_LIMIT, Math.max(1, Math.floor(raw))) };
}
export function normalizeJsmRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const key = typeof raw.issueKey === 'string' ? raw.issueKey : typeof raw.key === 'string' ? raw.key : null;
  if (!key) return null;
  const fields = raw.requestFieldValues && typeof raw.requestFieldValues === 'object' ? raw.requestFieldValues : {};
  const status = raw.currentStatus && typeof raw.currentStatus === 'object' ? raw.currentStatus : {};
  const type = raw.requestType && typeof raw.requestType === 'object' ? raw.requestType : {};
  const priority = fields.priority && typeof fields.priority === 'object' ? fields.priority : {};
  return { key, summary: typeof fields.summary === 'string' ? fields.summary : typeof raw.summary === 'string' ? raw.summary : '(no summary)', status: typeof status.status === 'string' ? status.status : typeof status.name === 'string' ? status.name : 'Unknown', requestType: typeof type.name === 'string' ? type.name : 'Service request', priority: typeof priority.name === 'string' ? priority.name : null, created: typeof raw.createdDate === 'string' ? raw.createdDate : '' };
}
export function parseJsmRequests(data) {
  const rows = Array.isArray(data?.values) ? data.values : Array.isArray(data?.requests) ? data.requests : [];
  return rows.map(normalizeJsmRequest).filter(Boolean).slice(0, MAX_JSM_LIMIT);
}