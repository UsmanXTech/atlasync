import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from './Card';
import RecordLink from './RecordLink';
import { fetchJsmRequests } from '../services/jsm';
import { LIVE_FETCH_LIMITS } from '../utils/liveSnapshot';
import type { LiveJsmRequest } from '../data/types';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { jsmRequestUrl } from '../utils/recordLinks';
import { contextualQuestionFor } from '../utils/contextualQuestions';

/**
 * JSM Requests Card (M3 restyled)
 * Live customer and service desk requests through Forge backend, read-only
 */
export default function JsmRequestsCard({
  // Fix #13: the one shared ask path (App).
  askInIntelligence,
  // Fix #9: App's Sync Portfolio counter — a bump refetches the requests.
  refreshTick = 0,
}: {
  askInIntelligence: (question: string) => void;
  refreshTick?: number;
}) {
  const siteUrl = useSiteUrl();
  const [requests, setRequests] = useState<LiveJsmRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchJsmRequests(LIVE_FETCH_LIMITS.cards.jsm);
    if (result.ok) setRequests(result.requests);
    else setError(result.error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // refreshTick is App's Sync Portfolio counter — a bump refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshTick]);

  const askAboutThis = () => {
    askInIntelligence(contextualQuestionFor('jsm'));
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
