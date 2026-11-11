import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from './Card';
import { fetchJsmRequests } from '../services/jsm';
import type { LiveJsmRequest } from '../data/types';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { ViewId } from './Sidebar';

// The JSM card: live requests through the Forge backend, read-only.
// Loading and error states are explicit in the card body (Nielsen H1/H9):
// the header Refresh button alone is not enough feedback while a fetch
// is in flight, and a bare error line leaves no recovery action in view.
// Same structure as the Confluence card (Run 13).
export default function JsmRequestsCard({ conversation, onNavigate }: { conversation: IntelligenceConversation; onNavigate: (view: ViewId) => void }) {
  const [requests, setRequests] = useState<LiveJsmRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchJsmRequests(20);
    if (result.ok) setRequests(result.requests);
    else setError(result.error.message);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Phase 2 contextual ask: one tap asks Intelligence about these requests
  // and opens the answer there (Agents "Try it" pattern, Run 16; same
  // shape as the Overview/Projects/Confluence buttons, Runs 83–85). The
  // question names the requests' topics, never their numbers (see
  // utils/contextualQuestions) — and never age, requester, or request
  // bodies, which the ask snapshot does not carry.
  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('jsm'));
    onNavigate('intelligence');
  };
  return (
    <Card
      title="Live JSM requests"
      subtitle="Read-only · current-user permissions"
      action={
        <div className="chip-row">
          <button className="btn btn-small btn-primary" onClick={askAboutThis}>
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
          Loading JSM requests via the Forge backend…
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
      {!loading && !error && requests.length === 0 && (
        <p className="source-empty">No requests are visible to this user, or the service desk has no requests.</p>
      )}
      <div className="row-list">
        {requests.map((request) => (
          <div className="data-row" key={request.key}>
            <div className="row-main">
              <strong>
                {request.key} · {request.summary}
              </strong>
              <small>
                {request.requestType}
                {request.priority ? ` · ${request.priority}` : ''}
              </small>
            </div>
            <span className="pill">{request.status}</span>
          </div>
        ))}
      </div>
      <p className="source-footnote">JSM limits visibility by service-desk access and request permissions.</p>
    </Card>
  );
}
