import { AlertTriangle, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import Card from './Card';
import type { BriefingItem } from '../utils/briefing';
import type { Briefing } from '../hooks/useBriefingState';

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

// Presentational only: the briefing state lives in App (via
// useBriefingState), so the digest survives leaving this view.
// Intelligence is the default/home view, and the card-local version
// (PR #35) re-fired three live fetches and flashed its loading line
// on every return visit (Run 103 audit probe). Refresh is the explicit
// path to a new snapshot. Loads live records only; never falls back to
// the Overview demo fixtures.
export default function IntelligenceBriefing({ briefing }: { briefing: Briefing }) {
  const { state, refresh } = briefing;

  return (
    <Card title="Today’s briefing" subtitle="Rules-based summary of the bounded live records · read-only"
      action={<button className="btn btn-small" onClick={() => refresh()} disabled={state.status === 'loading'}><RefreshCw size={13} /> Refresh</button>}>
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
