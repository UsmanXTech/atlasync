import { useRef, useState } from 'react';
import { askAtlasync } from '../services/intelligence';
import { BRIEFING_SUMMARY_QUESTION } from '../utils/briefingSummary';
import { RequestGeneration } from '../utils/requestGeneration';

export type BriefingSummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; answer: string }
  | { status: 'error'; message: string };

export interface BriefingSummary {
  summary: BriefingSummaryState;
  summarize: () => void;
  stop: () => void;
  reset: () => void;
}

// Owns the Overview briefing card's optional LLM summary. The hook lives
// in App (above the view switch), so a summary survives navigating away
// and back — the Overview view unmounts on switch, but this state does
// not. That matters because the summary costs a metered Forge LLM call:
// the card-local version (Phase 3 slice 2) discarded it on every
// navigation, so returning to Overview meant paying for the same
// sentence again. A full page reload still starts fresh.
//
// The summary is bound to the snapshot it was answered from (the card
// labels it "live snapshot (10 Jira issues · 10 Confluence pages ·
// 10 JSM requests)"), so keeping it while the teaser rows refresh is
// the same staleness the Intelligence answer already has (Run 3): the
// label states the scope, the answer is never re-presented as fresh.
// `reset()` is the card's call when a NEW teaser snapshot arrives —
// the old summary no longer describes the rows on screen.
export function useBriefingSummary(): BriefingSummary {
  const [summary, setSummary] = useState<BriefingSummaryState>({ status: 'idle' });
  // Generation guard (see utils/requestGeneration): @forge/bridge invoke()
  // has no abort, so a stale response is discarded instead of cancelled
  // at the transport. Every summarize/stop/reset bumps the generation; a
  // response only applies when its generation is still current.
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

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
  const stop = () => {
    generations.invalidate();
    setSummary({ status: 'idle' });
  };

  // Retire the summary (and any in-flight response for it): called when
  // a fresh teaser snapshot arrives, so a summary from the old snapshot
  // cannot outlive the rows it describes.
  const reset = () => {
    generations.invalidate();
    setSummary({ status: 'idle' });
  };

  return { summary, summarize, stop, reset };
}
