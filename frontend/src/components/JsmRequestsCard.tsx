import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from './Card';
import RecordLink from './RecordLink';
import { fetchJsmRequests } from '../services/jsm';
import type { LiveJsmRequest } from '../data/types';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { jsmRequestUrl } from '../utils/recordLinks';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { ViewId } from './Sidebar';

/**
 * JSM Requests Card (M3 restyled)
 * Live customer and service desk requests through Forge backend, read-only
 */
export default function JsmRequestsCard({
  conversation,
  onNavigate,
}: {
  conversation: IntelligenceConversation;
  onNavigate: (view: ViewId) => void;
}) {
  const siteUrl = useSiteUrl();
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
          Loading JSM requests via the Forge backend…
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
      {!loading && !error && requests.length === 0 && (
        <p className="source-empty">No requests are visible to this user, or the service desk has no requests.</p>
      )}
      <div className="row-list">
        {requests.map((request) => (
          <div className="data-row" key={request.key}>
            <div className="row-main">
              <strong>
                <RecordLink url={jsmRequestUrl(siteUrl, request.key)} label={`Open ${request.key} in Jira`}>
                  <span className="issue-key">{request.key}</span>
                </RecordLink>{' '}
                · {request.summary}
              </strong>
              <small>
                {request.requestType}
                {request.priority ? ` · ${request.priority}` : ''}
              </small>
            </div>
            <span className="pill pending">{request.status}</span>
          </div>
        ))}
      </div>
      <p className="source-footnote">JSM limits visibility by service-desk access and request permissions.</p>
    </Card>
  );
}
