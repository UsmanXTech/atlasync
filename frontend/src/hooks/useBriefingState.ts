import { useEffect, useRef, useState } from 'react';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
import { RequestGeneration } from '../utils/requestGeneration';
import { reduceBriefingResults, type BriefingState } from '../utils/briefingState';

export interface Briefing {
  state: BriefingState;
  refresh: () => void;
}

// Owns the Intelligence briefing ("Today's briefing" digest). The hook
// lives in App (above the view switch), so the digest survives
// navigating away and back — Intelligence is the default/home view, and
// the card-local version (PR #35) re-fired three live fetches and
// flashed its loading line on every return visit (confirmed by the Run
// 103 audit probe). The digest is bound to the snapshot it was computed
// from (the card labels it a "bounded, permission-filtered snapshot"),
// so keeping it while navigating is the same staleness the Intelligence
// answer already has (Run 3): the label states the scope, the digest
// is never re-presented as fresh. Refresh is the explicit path to a new
// snapshot. A full page reload still starts fresh.
export function useBriefingState(): Briefing {
  const [state, setState] = useState<BriefingState>({ status: 'loading' });
  // Generation guard (see utils/requestGeneration): @forge/bridge invoke()
  // has no abort, so a stale response is discarded instead of cancelled
  // at the transport. Every load bumps the generation; a response only
  // applies when its generation is still current (a fast Refresh
  // supersedes the in-flight load).
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;
  const startedRef = useRef(false);

  const load = async () => {
    const generation = generations.next();
    setState({ status: 'loading' });
    const [jira, confluence, jsm] = await Promise.all([
      fetchLiveJiraIssues(25), fetchConfluencePages(20), fetchJsmRequests(20),
    ]);
    if (!generations.isCurrent(generation)) return; // superseded — ignore
    setState(reduceBriefingResults({ jira, confluence, jsm }));
  };

  // Auto-load once, when the app starts. StrictMode double-invokes
  // mount effects in dev, so the started flag — not the effect itself —
  // is what guarantees a single first load.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();
  }, []);

  return { state, refresh: () => void load() };
}
