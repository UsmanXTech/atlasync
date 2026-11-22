// Pure Confluence normalization. Keep this module independent of Forge for tests.
export const DEFAULT_CONFLUENCE_LIMIT = 20;
export const MAX_CONFLUENCE_LIMIT = 50;

export function validateConfluenceInput(payload) {
  if (payload == null) return { ok: true, limit: DEFAULT_CONFLUENCE_LIMIT };
  if (typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'Request payload must be an object.' } };
  const raw = payload.limit;
  if (raw == null) return { ok: true, limit: DEFAULT_CONFLUENCE_LIMIT };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, error: { kind: 'INVALID_INPUT', message: 'limit must be a number.' } };
  return { ok: true, limit: Math.min(MAX_CONFLUENCE_LIMIT, Math.max(1, Math.floor(raw))) };
}

export function normalizeConfluencePage(raw) {
  if (!raw || typeof raw !== 'object' || (typeof raw.id !== 'string' && typeof raw.id !== 'number')) return null;
  const version = raw.version && typeof raw.version === 'object' ? raw.version : {};
  const space = raw.space && typeof raw.space === 'object' ? raw.space : {};
  const links = raw._links && typeof raw._links === 'object' ? raw._links : {};
  // Keep the record URL the API already returns (_links.webui, e.g.
  // "/spaces/AT/pages/12") instead of dropping it: the frontend builds
  // the "open the original record" link from it. Null when the API
  // omits _links — the frontend then falls back to spaceId + id.
  const webui = typeof links.webui === 'string' && links.webui !== '' ? links.webui : null;
  return { id: String(raw.id), title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : '(untitled page)', status: typeof raw.status === 'string' ? raw.status : 'Unknown', spaceId: typeof raw.spaceId === 'string' ? raw.spaceId : typeof space.id === 'string' ? space.id : null, webui, updated: typeof version.createdAt === 'string' ? version.createdAt : '' };
}
export function parseConfluencePages(data) {
  const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data?.pages) ? data.pages : [];
  return rows.map(normalizeConfluencePage).filter(Boolean).slice(0, MAX_CONFLUENCE_LIMIT);
}