import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from './Card';
import { fetchConfluencePages } from '../services/confluence';
import type { LiveConfluencePage } from '../data/types';
import { formatUpdated } from '../utils/formatUpdated';
import { confluenceStatusTone } from '../utils/confluenceStatus';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { ViewId } from './Sidebar';

// The Confluence card: live pages through the Forge backend, read-only.
// Loading and error states are explicit in the card body (Nielsen H1/H9):
// the header Refresh button alone is not enough feedback while a fetch
// is in flight, and a bare error line leaves no recovery action in view.
export default function ConfluencePagesCard({ conversation, onNavigate }: { conversation: IntelligenceConversation; onNavigate: (view: ViewId) => void }) {
  const [pages, setPages] = useState<LiveConfluencePage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchConfluencePages(20);
    if (result.ok) setPages(result.pages);
    else setError(result.error.message);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Phase 2 contextual ask: one tap asks Intelligence about these pages
  // and opens the answer there (Agents "Try it" pattern, Run 16; same
  // shape as the Overview/Projects buttons, Runs 83–84). The question
  // names the pages' topics, never their numbers (see
  // utils/contextualQuestions) — and never recency or page contents,
  // which the ask snapshot does not carry.
  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('confluence'));
    onNavigate('intelligence');
  };
  // Row metadata speaks the user's language (Nielsen H2), not the API's:
  // the page id and the internal space id are identifiers no reader
  // needs, while the last-updated date the service already fetches is
  // the metadata that tells whether a page is fresh. The status pill
  // carries a tone (current = live, trashed = removed) instead of the
  // bare unstyled pill; its text stays Confluence's own status word.
  return (
    <Card
      title="Live Confluence pages"
      subtitle="Read-only · current-user permissions"
      action={
        <div className="chip-row">
          <button className="btn btn-small btn-primary" onClick={() => askAboutThis()}>
            <Sparkles size={13} />
            Ask about this
          </button>
          <button className="btn btn-small" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            {loading ? 'Loading…' : 'Refresh'}
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
            <button className="btn btn-primary" onClick={() => void load()}>
              <RefreshCw size={14} /> Retry
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
              <strong>{page.title}</strong>
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
