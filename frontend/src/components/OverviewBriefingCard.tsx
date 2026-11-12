import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Card from './Card';
import { fetchLiveJiraIssues, type JiraError } from '../services/jira';
import { computeBriefingDigest } from '../utils/briefing';
import { pickBriefingTeaser, STALE_THRESHOLD_DAYS, type BriefingTeaser } from '../utils/overviewBriefing';
import type { ViewId } from './Sidebar';

type BriefingState =
  | { status: 'loading' }
  | { status: 'ready'; teaser: BriefingTeaser }
  | { status: 'error'; error: JiraError };

// Phase 3 slice 1 — the proactive teaser on Overview. Two rows only:
// the single highest-priority live blocker and the single oldest live
// issue untouched for 14+ days. The full lists live in the
// Intelligence briefing, one tap away (progressive disclosure: the
// summary first, the detail on demand). No readiness number here —
// the Release readiness card owns that figure, and the briefing's
// 25-issue snapshot would show a second, different number on the
// same view. Rules-based only; no LLM is called.
function TeaserRow({ tag, tagTone, item }: { tag: string; tagTone: string; item: { key: string; summary: string; ageDays: number | null } }) {
  return (
    <div className="briefing-row">
      <span className={`pill ${tagTone}`}>{tag}</span>
      <span className="briefing-summary">
        <span className="issue-key">{item.key}</span> · {item.summary}
      </span>
      <span className="row-meta">{item.ageDays === null ? 'Age unknown' : item.ageDays === 0 ? 'Today' : `${item.ageDays}d ago`}</span>
    </div>
  );
}

export default function OverviewBriefingCard({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const [state, setState] = useState<BriefingState>({ status: 'loading' });

  const load = async () => {
    setState({ status: 'loading' });
    const result = await fetchLiveJiraIssues(25);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return;
    }
    setState({ status: 'ready', teaser: pickBriefingTeaser(computeBriefingDigest(result.issues)) });
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card
      title="Today’s briefing"
      subtitle="Live blocker + stale watch"
      action={
        <button className="btn btn-small" onClick={() => void load()} disabled={state.status === 'loading'}>
          <RefreshCw size={13} /> Refresh
        </button>
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="source-loading">Reading live Jira issues…</p>
      )}
      {state.status === 'error' && (
        <div>
          <p className="source-error" role="alert">{state.error.message}</p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => void load()}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          {state.teaser.blocker ? (
            <TeaserRow tag="Blocker" tagTone="blocked" item={state.teaser.blocker} />
          ) : (
            <p className="source-empty">No open Highest/High issues in this snapshot.</p>
          )}
          {state.teaser.stale ? (
            <TeaserRow tag="Stale" tagTone="pending" item={state.teaser.stale} />
          ) : (
            <p className="source-empty">No open issue untouched for {STALE_THRESHOLD_DAYS}+ days.</p>
          )}
          <p className="source-footnote">
            Rules-based · latest 25 Jira issues ·{' '}
            <button className="briefing-link" onClick={() => onNavigate('intelligence')}>
              Full briefing in Intelligence <ArrowRight size={12} />
            </button>
          </p>
        </>
      )}
    </Card>
  );
}
