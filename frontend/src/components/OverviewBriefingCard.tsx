import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles, Square } from 'lucide-react';
import Card from './Card';
import MarkdownText from './Markdown';
import { fetchLiveJiraIssues, type JiraError } from '../services/jira';
import { askAtlasync } from '../services/intelligence';
import { computeBriefingDigest } from '../utils/briefing';
import { pickBriefingTeaser, STALE_THRESHOLD_DAYS, type BriefingTeaser } from '../utils/overviewBriefing';
import { BRIEFING_SUMMARY_QUESTION, BRIEFING_SUMMARY_SNAPSHOT_LABEL } from '../utils/briefingSummary';
import { RequestGeneration } from '../utils/requestGeneration';
import type { ViewId } from './Sidebar';

type BriefingState =
  | { status: 'loading' }
  | { status: 'ready'; teaser: BriefingTeaser }
  | { status: 'error'; error: JiraError };

type SummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; answer: string }
  | { status: 'error'; message: string };

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
// load. The summary is card-local (its own RequestGeneration guard,
// same pattern as the Intelligence hook — @forge/bridge invoke() has
// no abort, so a late response is discarded instead): it never
// touches the shared Intelligence conversation, so it cannot wipe an
// analysis running there. The cost is that leaving Overview discards
// the summary — one more tap re-fetches it. Refreshing the teaser
// also clears the summary: it was computed from the previous
// snapshot. The answer renders with the shared MarkdownText (Run 1),
// and the snapshot it was answered from is labelled next to it.
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
  const [summary, setSummary] = useState<SummaryState>({ status: 'idle' });
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

  const load = async () => {
    // A fresh teaser snapshot retires any summary computed from the old
    // one: the late response is discarded by the generation guard.
    generations.invalidate();
    setSummary({ status: 'idle' });
    setState({ status: 'loading' });
    const result = await fetchLiveJiraIssues(25);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return;
    }
    setState({ status: 'ready', teaser: pickBriefingTeaser(computeBriefingDigest(result.issues)) });
  };

  const summarize = async () => {
    if (summary.status === 'loading') return; // metered: never double-fire
    const generation = generations.next();
    setSummary({ status: 'loading' });
    try {
      const r = await askAtlasync(BRIEFING_SUMMARY_QUESTION);
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      if (r.ok) setSummary({ status: 'ready', answer: r.answer });
      else setSummary({ status: 'error', message: r.error.message });
    } catch (e) {
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      setSummary({ status: 'error', message: e instanceof Error ? e.message : 'The summary request failed.' });
    }
  };

  // Stop the summary from the user's point of view: the late response
  // is ignored (see generation note above). The Forge backend call
  // itself cannot be aborted mid-flight.
  const stopSummary = () => {
    generations.invalidate();
    setSummary({ status: 'idle' });
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card
      title="Today’s briefing"
      subtitle="Live blocker + stale watch"
      action={
        <div className="chip-row">
          {summary.status === 'loading' ? (
            <button className="btn btn-small" onClick={stopSummary} aria-label="Stop summary">
              <Square size={13} /> Stop
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={() => void summarize()} disabled={state.status === 'loading'}>
              <Sparkles size={13} /> Summarize
            </button>
          )}
          <button className="btn btn-small" onClick={() => void load()} disabled={state.status === 'loading'}>
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
