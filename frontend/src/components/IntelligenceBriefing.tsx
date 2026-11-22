import { AlertTriangle, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import Card from './Card';
import type { BriefingItem } from '../utils/briefing';
import type { Briefing } from '../hooks/useBriefingState';
import type { LiveReadiness } from '../services/readiness';

// The backend v2.1.0 breakdown, worded exactly like Overview's so the
// two surfaces can be compared by eye. The formula itself is shown
// below the stat (the 2026-11-21 review found a 63%-vs-78% conflict
// with no formula anywhere to explain it).
function readinessLine(readiness: LiveReadiness | null): string {
  if (!readiness) return 'Readiness could not be loaded — see the warning above';
  if (readiness.score === null) return 'No records to score';
  const b = readiness.breakdown;
  return `−12 × ${b.Bcrit} critical blockers · −15 × ${b.Isev} SEV-1/2 incidents · −5 × ${b.Pstale} stale PRs · −10 × ${b.Dmissing} unassigned`;
}

function BriefingList({ items }: { items: BriefingItem[] }) {
  if (items.length === 0)
    return <p className="source-empty">No matching open Jira issues in this snapshot.</p>;
  return (
    <div className="row-list">
      {items.map((item) => (
        <div className="data-row" key={item.key}>
          <div className="row-main">
            <strong>
              <span className="issue-key">{item.key}</span> · {item.summary}
            </strong>
            <small>
              {item.status} · {item.priority ?? 'No priority'} ·{' '}
              {item.ageDays === null
                ? 'Updated date unavailable'
                : `Updated ${item.ageDays} days ago`}
            </small>
          </div>
          <span className="pill pending">{item.priority ?? 'Unprioritized'}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Intelligence Briefing Component (M3 restyled)
 * Rules-based summary of bounded live records
 */
export default function IntelligenceBriefing({ briefing }: { briefing: Briefing }) {
  const { state, refresh } = briefing;

  return (
    <Card
      title="Today’s briefing"
      subtitle="Rules-based summary of the bounded live records · read-only"
      action={
        <button
          className="btn btn-small"
          onClick={() => refresh()}
          disabled={state.status === 'loading'}
          aria-label="Refresh briefing"
        >
          <RefreshCw size={13} /> <span>Refresh</span>
        </button>
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="source-loading">
          Reading live Jira, Confluence and JSM records…
        </p>
      )}
      {state.status === 'unavailable' && (
        <div className="note-box">
          <p>{state.message}</p>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          {state.warnings.map((warning) => (
            <p className="source-error" role="status" key={warning}>
              {warning}
            </p>
          ))}
          <div className="stat-grid" style={{ marginBottom: 12 }}>
            <div className="stat">
              <span className="stat-label">Readiness estimate</span>
              <div className="stat-value tabular-nums">
                {state.readiness?.score != null ? `${state.readiness.score}%` : '—'}
              </div>
              <div className="stat-delta flat">{readinessLine(state.readiness)}</div>
            </div>
            <div className="stat">
              <span className="stat-label">Open Jira issues</span>
              <div className="stat-value tabular-nums">{state.digest.totalOpen}</div>
              <div className="stat-delta flat">In the returned Jira snapshot</div>
            </div>
            <div className="stat">
              <span className="stat-label">Other records</span>
              <div className="stat-value tabular-nums">
                {state.confluenceCount + state.jsmCount}
              </div>
              <div className="stat-delta flat">
                {state.confluenceCount} Confluence · {state.jsmCount} JSM
              </div>
            </div>
          </div>
          <Card title="Top blockers" subtitle="Open Highest / High priority Jira issues">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <AlertTriangle size={15} color="var(--md-sys-color-at-risk-on-container)" />
              <span className="source-footnote">Sorted by priority, then oldest update</span>
            </div>
            <BriefingList items={state.digest.blockers} />
          </Card>
          <Card title="Stale work" subtitle="Oldest open Jira issues in this snapshot">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Clock3 size={15} color="var(--md-sys-color-outline)" />
              <span className="source-footnote">Sorted by last updated date</span>
            </div>
            <BriefingList items={state.digest.staleItems} />
          </Card>
          <p className="source-footnote">
            <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
            Rules-based only. No LLM is called on load. Readiness is the backend score — 100 − (12×critical blockers
            + 15×SEV-1/2 incidents + 5×stale PRs + 10×unassigned) — the same number Overview shows. Estimates reflect
            a bounded, permission-filtered snapshot—not the complete workspace.
          </p>
        </>
      )}
    </Card>
  );
}
