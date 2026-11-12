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

// Phase 3 slice 1 — the proactive teaser on Overview. Two rows only:
// the single highest-priority live blocker and the single oldest live
// issue untouched for 14+ days. The full lists live in the
// Intelligence briefing, one tap away (progressive disclosure: the
// summary first, the detail on demand). No readiness number here —
// the Release readiness card owns that figure, and the briefing's
// 25-issue snapshot would show a second, different number on the
// same view. Rules-based only; no LLM is called for the rows.
//
// Phase 3 slice 2 — optional LLM one-line summary, on tap only.
// The summary is a second, user-initiated layer on the same card:
// the rules-based rows stay the default, and Summarize asks
// Intelligence for exactly one sentence about what needs attention
// most. Forge LLM is metered, so one tap is exactly one call, a tap
// while a summary is loading is ignored, and nothing is called on
// load. The answer renders with the shared MarkdownText (Run 1),
// and the snapshot it was answered from is labelled next to it.
//
// Phase 3 slice 3 — the summary state lives in App now (hook
// useBriefingSummary, same lift as the Intelligence conversation in
// Run 3), so it survives navigating away and back instead of being
// discarded with the card. A metered answer is never thrown away by
// a view switch. Refreshing the teaser still retires the summary —
// but only when a fresh snapshot actually arrives: a failed refresh
// leaves it alone, because no new snapshot exists to supersede it.
// The mount load never clears it (the card reloads its rows on every
// visit; the summary keeps its snapshot label, the same staleness
// the preserved Intelligence answer already has).
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

export default function OverviewBriefingCard({ onNavigate, briefingSummary }: { onNavigate: (view: ViewId) => void; briefingSummary: BriefingSummary }) {
  const [state, setState] = useState<BriefingState>({ status: 'loading' });
  const { summary, summarize, stop, reset } = briefingSummary;

  // Returns whether a fresh snapshot arrived. The caller decides
  // whether the summary survives: mount loads never retire it, an
  // explicit refresh retires it only on success (see slice 3 note).
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

  useEffect(() => { void load(); }, []);

  return (
    <Card
      title="Today’s briefing"
      subtitle="Live blocker + stale watch"
      action={
        <div className="chip-row">
          {summary.status === 'loading' ? (
            <button className="btn btn-small" onClick={stop} aria-label="Stop summary">
              <Square size={13} /> Stop
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={() => void summarize()} disabled={state.status === 'loading'}>
              <Sparkles size={13} /> Summarize
            </button>
          )}
          <button className="btn btn-small" onClick={() => void refresh()} disabled={state.status === 'loading'}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="source-loading">Reading live Jira issues…</p>
      )}
      {state.status === 'error' && (
        <div>
          <p className="source-error" role="alert">{state.error.message}</p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => void refresh()}>
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
      {summary.status === 'loading' && (
        <p role="status" className="source-loading">Summarizing the live snapshot…</p>
      )}
      {summary.status === 'ready' && (
        <div className="briefing-ai-summary">
          <MarkdownText text={summary.answer} />
          <p className="source-footnote">AI summary · live snapshot ({BRIEFING_SUMMARY_SNAPSHOT_LABEL})</p>
        </div>
      )}
      {summary.status === 'error' && (
        <div className="briefing-ai-summary">
          <p className="source-error" role="alert">{summary.message}</p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => void summarize()}>
              <RefreshCw size={14} /> Retry summary
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
