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

// URL for the Confluence v2 pages list (fix #11). Space scoping needs
// the numeric space id — resolved from the space key first (see
// toolExecutors.js) — because the v2 endpoint takes `space-id`, not a
// key. Sort is newest first so "least recently updated" questions are
// answerable from the returned order + updated dates.
export function buildConfluencePagesUrl({ spaceId, status, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (spaceId !== undefined && spaceId !== null && String(spaceId) !== '') params.set('space-id', String(spaceId));
  if (status !== undefined && status !== null && String(status) !== '') params.set('status', String(status));
  params.set('sort', '-modified-date');
  params.set('limit', String(Math.max(1, Math.min(50, Math.floor(limit) || 10))));
  return `/wiki/api/v2/pages?${params.toString()}`;
}