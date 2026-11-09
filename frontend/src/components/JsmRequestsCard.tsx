import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from './Card';
import { fetchJsmRequests } from '../services/jsm';
import type { LiveJsmRequest } from '../data/types';
export default function JsmRequestsCard() {
  const [requests, setRequests] = useState<LiveJsmRequest[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); const result = await fetchJsmRequests(20); if (result.ok) setRequests(result.requests); else setError(result.error.message); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  return <Card title="Live JSM requests" subtitle="Read-only · current-user permissions" action={<button className="btn btn-small" onClick={() => void load()} disabled={loading}><RefreshCw size={13}/>{loading ? 'Loading…' : 'Refresh'}</button>}>
    {error && <p role="status" className="source-error">{error}</p>}
    {!loading && !error && requests.length === 0 && <p className="source-empty">No requests are visible to this user, or the service desk has no requests.</p>}
    <div className="row-list">{requests.map((request) => <div className="data-row" key={request.key}><div className="row-main"><strong>{request.key} · {request.summary}</strong><small>{request.requestType}{request.priority ? ` · ${request.priority}` : ''}</small></div><span className="pill">{request.status}</span></div>)}</div>
    <p className="source-footnote">JSM limits visibility by service-desk access and request permissions.</p>
  </Card>;
}