import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import Card from './Card';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
import { computeBriefingDigest, type BriefingDigest, type BriefingItem } from '../utils/briefing';

type BriefingState =
  | { status: 'loading' }
  | { status: 'ready'; digest: BriefingDigest; confluenceCount: number; jsmCount: number; warnings: string[] }
  | { status: 'unavailable'; message: string };

function BriefingList({ items }: { items: BriefingItem[] }) {
  if (items.length === 0) return <p className="source-empty">No matching open Jira issues in this snapshot.</p>;
  return <div className="row-list">{items.map((item) => (
    <div className="data-row" key={item.key}>
      <div className="row-main">
        <strong><span className="issue-key">{item.key}</span> · {item.summary}</strong>
        <small>{item.status} · {item.priority ?? 'No priority'} · {item.ageDays === null ? 'Updated date unavailable' : `Updated ${item.ageDays} days ago`}</small>
      </div>
      <span className="pill pending">{item.priority ?? 'Unprioritized'}</span>
    </div>
  ))}</div>;
}

/** Loads live records only; never falls back to the Overview demo fixtures. */
export default function IntelligenceBriefing() {
  const [state, setState] = useState<BriefingState>({ status: 'loading' });

  const load = async () => {
    setState({ status: 'loading' });
    const [jira, confluence, jsm] = await Promise.all([
      fetchLiveJiraIssues(25), fetchConfluencePages(20), fetchJsmRequests(20),
    ]);
    const failures = [jira, confluence, jsm].filter((result) => !result.ok);
    if (failures.length === 3 && failures.every((result) => !result.ok && result.error.kind === 'BACKEND_UNREACHABLE')) {
      setState({ status: 'unavailable', message: 'Live briefing appears when installed in Forge. This standalone preview does not contain live Atlassian records.' });
      return;
    }
    const warnings = [
      ...(!jira.ok ? [`Jira unavailable: ${jira.error.message}`] : []),
      ...(!confluence.ok ? [`Confluence unavailable: ${confluence.error.message}`] : []),
      ...(!jsm.ok ? [`JSM unavailable: ${jsm.error.message}`] : []),
    ];
    setState({
      status: 'ready',
      digest: computeBriefingDigest(jira.ok ? jira.issues : []),
      confluenceCount: confluence.ok ? confluence.pages.length : 0,
      jsmCount: jsm.ok ? jsm.requests.length : 0,
      warnings,
    });
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card title="Today’s briefing" subtitle="Rules-based summary of the bounded live records · read-only"
      action={<button className="btn btn-small" onClick={() => void load()} disabled={state.status === 'loading'}><RefreshCw size={13} /> Refresh</button>}>
      {state.status === 'loading' && <p role="status" className="source-loading">Reading live Jira, Confluence and JSM records…</p>}
      {state.status === 'unavailable' && <div className="note-box"><p>{state.message}</p></div>}
      {state.status === 'ready' && <>
        {state.warnings.map((warning) => <p className="source-error" role="status" key={warning}>{warning}</p>)}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat"><span className="stat-label">Readiness estimate</span><strong className="stat-value">{state.digest.readiness ? `${state.digest.readiness.score}%` : '—'}</strong><small>{state.digest.readiness?.summary ?? 'No Jira issues to score'}</small></div>
          <div className="stat"><span className="stat-label">Open Jira issues</span><strong className="stat-value">{state.digest.totalOpen}</strong><small>In the returned Jira snapshot</small></div>
          <div className="stat"><span className="stat-label">Other records</span><strong className="stat-value">{state.confluenceCount + state.jsmCount}</strong><small>{state.confluenceCount} Confluence · {state.jsmCount} JSM</small></div>
        </div>
        <Card title="Top blockers" subtitle="Open Highest / High priority Jira issues">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><AlertTriangle size={15} /><span className="source-footnote">Sorted by priority, then oldest update</span></div>
          <BriefingList items={state.digest.blockers} />
        </Card>
        <Card title="Stale work" subtitle="Oldest open Jira issues in this snapshot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><Clock3 size={15} /><span className="source-footnote">Sorted by last updated date</span></div>
          <BriefingList items={state.digest.staleItems} />
        </Card>
        <p className="source-footnote"><ShieldCheck size={13} /> Rules-based only. No LLM is called on load. Estimates reflect a bounded, permission-filtered snapshot—not the complete workspace.</p>
      </>}
    </Card>
  );
}
