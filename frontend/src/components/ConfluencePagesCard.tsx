import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from './Card';
import { fetchConfluencePages } from '../services/confluence';
import type { LiveConfluencePage } from '../data/types';
export default function ConfluencePagesCard() {
  const [pages, setPages] = useState<LiveConfluencePage[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); const result = await fetchConfluencePages(20); if (result.ok) setPages(result.pages); else setError(result.error.message); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  return <Card title="Live Confluence pages" subtitle="Read-only · current-user permissions" action={<button className="btn btn-small" onClick={() => void load()} disabled={loading}><RefreshCw size={13}/>{loading ? 'Loading…' : 'Refresh'}</button>}>
    {error && <p role="status" className="source-error">{error}</p>}
    {!loading && !error && pages.length === 0 && <p className="source-empty">No pages are visible to this user, or the space has no pages.</p>}
    <div className="row-list">{pages.map((page) => <div className="data-row" key={page.id}><div className="row-main"><strong>{page.title}</strong><small>Page ID {page.id}{page.spaceId ? ` · Space ${page.spaceId}` : ''}</small></div><span className="pill">{page.status}</span></div>)}</div>
    <p className="source-footnote">Live records only. No sample pages are mixed into this list.</p>
  </Card>;
}