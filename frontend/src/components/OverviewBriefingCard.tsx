import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles, Square } from 'lucide-react';
import Card from './Card';
import MarkdownText from './Markdown';
import { fetchLiveJiraIssues, type JiraError } from '../services/jira';
import { computeBriefingDigest } from '../utils/briefing';
import { pickBriefingTeaser, STALE_THRESHOLD_DAYS, type BriefingTeaser } from '../utils/overviewBriefing';
import { BRIEFING_SUMMARY_SNAPSHOT_LABEL } from '../utils/briefingSummary';
import type { BriefingSummary } from '../hooks/useBriefingSummary';
import type { ViewId } from './Sidebar';

type BriefingState =
  | { status: 'loading' }
  | { status: 'ready'; teaser: BriefingTeaser }
  | { status: 'error'; error: JiraError };

function TeaserRow({
  tag,
  tagTone,
  item,
}: {
  tag: string;
  tagTone: string;
  item: { key: string; summary: string; ageDays: number | null };
}) {
  return (
    <div className="briefing-row">
      <span className={`pill ${tagTone}`}>{tag}</span>
      <span className="briefing-summary">
        <span className="issue-key">{item.key}</span> · {item.summary}
      </span>
      <span className="row-meta">
        {item.ageDays === null ? 'Age unknown' : item.ageDays === 0 ? 'Today' : `${item.ageDays}d ago`}
      </span>
    </div>
  );
}

/**
 * Overview Briefing Card (M3 restyled)
 * Live blocker + stale watch proactive teaser with optional LLM summary
 */
export default function OverviewBriefingCard({
  onNavigate,
  briefingSummary,
}: {
  onNavigate: (view: ViewId) => void;
  briefingSummary: BriefingSummary;
}) {
  const [state, setState] = useState<BriefingState>({ status: 'loading' });
  const { summary, summarize, stop, reset } = briefingSummary;

  const load = async (): Promise<boolean> => {
    setState({ status: 'loading' });
    const result = await fetchLiveJiraIssues(25);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return false;
    }
    setState({ status: 'ready', teaser: pickBriefingTeaser(computeBriefingDigest(result.issues)) });
    return true;
  };

  const refresh = async () => {
    if (await load()) reset();
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card
      title="Today’s briefing"
      subtitle="Live blocker + stale watch"
      action={
        <div className="chip-row">
          {summary.status === 'loading' ? (
            <button className="btn btn-small" onClick={stop} aria-label="Stop summary">
              <Square size={13} /> <span>Stop</span>
            </button>
          ) : (
            <button
              className="btn btn-small btn-filled"
              onClick={() => void summarize()}
              disabled={state.status === 'loading'}
            >
              <Sparkles size={13} /> <span>Summarize</span>
            </button>
          )}
          <button
            className="btn btn-small"
            onClick={() => void refresh()}
            disabled={state.status === 'loading'}
          >
            <RefreshCw size={13} /> <span>Refresh</span>
          </button>
        </div>
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="source-loading">
          Reading live Jira issues…
        </p>
      )}
      {state.status === 'error' && (
        <div>
          <p className="source-error" role="alert">
            {state.error.message}
          </p>
          <div className="row-actions">
            <button className="btn btn-filled" onClick={() => void refresh()}>
              <RefreshCw size={14} /> <span>Retry</span>
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
      {summary.status === 'loading' && (
        <p role="status" className="source-loading">
          Summarizing the live snapshot…
        </p>
      )}
      {summary.status === 'ready' && (
        <div className="briefing-ai-summary">
          <MarkdownText text={summary.answer} />
          <p className="source-footnote">AI summary · live snapshot ({BRIEFING_SUMMARY_SNAPSHOT_LABEL})</p>
        </div>
      )}
      {summary.status === 'error' && (
        <div className="briefing-ai-summary">
          <p className="source-error" role="alert">
            {summary.message}
          </p>
          <div className="row-actions">
            <button className="btn btn-filled" onClick={() => void summarize()}>
              <RefreshCw size={14} /> <span>Retry summary</span>
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
