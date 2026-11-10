// Pure Jira Service Management normalization. No Forge imports or credentials.
export const DEFAULT_JSM_LIMIT = 20;
export const MAX_JSM_LIMIT = 50;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// GET /rest/servicedeskapi/request returns requestFieldValues as an ARRAY of
// { fieldId, label, value } objects (Atlassian JSM REST docs, "Get customer
// requests"). Build a lookup by fieldId so summary/priority resolve from real
// responses. The legacy map shape (used by the create-request payload, never
// by GET responses) is tolerated so older fixtures do not crash the parser.
function fieldValuesById(raw) {
  const values = raw.requestFieldValues;
  if (Array.isArray(values)) {
    const map = {};
    for (const entry of values) {
      if (isRecord(entry) && typeof entry.fieldId === 'string' && !(entry.fieldId in map)) {
        map[entry.fieldId] = entry.value;
      }
    }
    return map;
  }
  return isRecord(values) ? values : {};
}

// Field values arrive as plain strings ("High") or as objects ({ name: "High" }).
function textValue(value) {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.name === 'string') return value.name;
  return null;
}

// Real responses carry createdDate as an object { epochMillis, iso8601 }.
// Prefer the ISO string; fall back to the epoch value.
function createdValue(raw) {
  const created = raw.createdDate;
  if (typeof created === 'string') return created;
  if (isRecord(created)) {
    if (typeof created.iso8601 === 'string') return created.iso8601;
    if (typeof created.epochMillis === 'number' && Number.isFinite(created.epochMillis)) {
      return new Date(created.epochMillis).toISOString();
    }
  }
  return '';
}

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
  const fields = fieldValuesById(raw);
  const status = isRecord(raw.currentStatus) ? raw.currentStatus : {};
  const type = isRecord(raw.requestType) ? raw.requestType : {};
  // The list response also carries a top-level summary string; prefer it,
  // then the summary field value from requestFieldValues.
  const summary = typeof raw.summary === 'string' ? raw.summary : textValue(fields.summary);
  return {
    key,
    summary: summary || '(no summary)',
    status: typeof status.status === 'string' ? status.status : typeof status.name === 'string' ? status.name : 'Unknown',
    // The list response has requestTypeId only (no requestType object), so
    // the fallback is honest here; a single-request fetch with expand may
    // supply the object and it is used when present.
    requestType: typeof type.name === 'string' ? type.name : 'Service request',
    priority: textValue(fields.priority),
    created: createdValue(raw),
  };
}

export function parseJsmRequests(data) {
  const rows = Array.isArray(data?.values) ? data.values : Array.isArray(data?.requests) ? data.requests : [];
  return rows.map(normalizeJsmRequest).filter(Boolean).slice(0, MAX_JSM_LIMIT);
}
