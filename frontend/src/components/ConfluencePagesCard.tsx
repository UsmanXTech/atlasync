import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from './Card';
import RecordLink from './RecordLink';
import { fetchConfluencePages } from '../services/confluence';
import { LIVE_FETCH_LIMITS } from '../utils/liveSnapshot';
import type { LiveConfluencePage } from '../data/types';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { formatUpdated } from '../utils/formatUpdated';
import { confluencePageUrl } from '../utils/recordLinks';
import { confluenceStatusTone } from '../utils/confluenceStatus';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { ViewId } from './Sidebar';

/**
 * Confluence Pages Card (M3 restyled)
 * Live pages loaded through Forge backend, read-only
 */
export default function ConfluencePagesCard({
  conversation,
  onNavigate,
  // Fix #9: App's Sync Portfolio counter — a bump refetches the pages.
  refreshTick = 0,
}: {
  conversation: IntelligenceConversation;
  onNavigate: (view: ViewId) => void;
  refreshTick?: number;
}) {
  const siteUrl = useSiteUrl();
  const [pages, setPages] = useState<LiveConfluencePage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchConfluencePages(LIVE_FETCH_LIMITS.cards.confluence);
    if (result.ok) setPages(result.pages);
    else setError(result.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // refreshTick is App's Sync Portfolio counter — a bump refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshTick]);

  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('confluence'));
    onNavigate('intelligence');
  };

  return (
    <Card
      title="Live Confluence pages"
      subtitle="Read-only · current-user permissions"
      action={
        <div className="chip-row">
          <button className="btn btn-small btn-filled" onClick={askAboutThis}>
            <Sparkles size={13} />
            <span>Ask about this</span>
          </button>
          <button className="btn btn-small" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
        </div>
      }
    >
      {loading && (
        <p role="status" className="source-loading">
          Loading Confluence pages via the Forge backend…
        </p>
      )}
      {!loading && error && (
        <div>
          <p role="status" className="source-error">
            {error}
          </p>
          <div className="row-actions">
            <button className="btn btn-filled" onClick={() => void load()}>
              <RefreshCw size={14} /> <span>Retry</span>
            </button>
          </div>
        </div>
      )}
      {!loading && !error && pages.length === 0 && (
        <p className="source-empty">No pages are visible to this user, or the space has no pages.</p>
      )}
      <div className="row-list">
        {pages.map((page) => (
          <div className="data-row" key={page.id}>
            <div className="row-main">
              <strong>
                <RecordLink url={confluencePageUrl(siteUrl, page)} label={`Open ${page.title} in Confluence`}>
                  {page.title}
                </RecordLink>
              </strong>
              {page.updated && <small>Updated {formatUpdated(page.updated)}</small>}
            </div>
            <span className={`pill ${confluenceStatusTone(page.status)}`}>{page.status}</span>
          </div>
        ))}
      </div>
      <p className="source-footnote">Live records only. No sample pages are mixed into this list.</p>
    </Card>
  );
}
