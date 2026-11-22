import { useCallback, useEffect, useState } from 'react';
import { Activity, FileText, GitPullRequest, RefreshCw, ShieldCheck } from 'lucide-react';
import Stat from '../components/Stat';
import Card from '../components/Card';
import { BarList } from '../components/Bars';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
import { fetchSnapshots, type ReadinessSnapshot } from '../services/snapshots';
import { jiraPriorityDistributionByStatus, jsmAgeBuckets, jiraStaleness } from '../utils/insightAnalysis';
import { LIVE_FETCH_LIMITS, snapshotDefinitionLine } from '../utils/liveSnapshot';
import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';

type Counts = {
  jira: number;
  confluence: number;
  jsm: number;
  errors: string[];
};

// Phase 3.3 — the records behind the counts, kept so aging and
// priority can be derived from the same refresh (no new calls).
type Records = {
  jira: LiveIssue[];
  confluence: LiveConfluencePage[];
  jsm: LiveJsmRequest[];
};

type TrendState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshots: ReadinessSnapshot[] };

/**
 * Screen 6: Insights (Source Health & Data Freshness)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Insights() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState<TrendState>({ status: 'loading' });

  const loadTrend = useCallback(async () => {
    setTrend({ status: 'loading' });
    const r = await fetchSnapshots();
    setTrend(r.ok ? { status: 'ready', snapshots: r.snapshots } : { status: 'error', message: r.error.message });
  }, []);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, c, s] = await Promise.all([
        fetchLiveJiraIssues(LIVE_FETCH_LIMITS.insights.jira),
        fetchConfluencePages(LIVE_FETCH_LIMITS.insights.confluence),
        fetchJsmRequests(LIVE_FETCH_LIMITS.insights.jsm),
      ]);
      const errors: string[] = [];
      if (!j.ok) errors.push('Jira: ' + j.error.message);
      if (!c.ok) errors.push('Confluence: ' + c.error.message);
      if (!s.ok) errors.push('JSM: ' + s.error.message);
      setCounts({
        jira: j.ok ? j.issues.length : 0,
        confluence: c.ok ? c.pages.length : 0,
        jsm: s.ok ? s.requests.length : 0,
        errors,
      });
      setRecords({
        jira: j.ok ? j.issues : [],
        confluence: c.ok ? c.pages : [],
        jsm: s.ok ? s.requests : [],
      });
    } catch (e) {
      setCounts({
        jira: 0,
        confluence: 0,
        jsm: 0,
        errors: [e instanceof Error ? e.message : 'Unable to read live sources.'],
      });
      setRecords({ jira: [], confluence: [], jsm: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = counts ? counts.jira + counts.confluence + counts.jsm : 0;

  // Phase 3.3 — derived from the same refresh, computed once per
  // load. `now` is captured here so all buckets share one clock.
  const analysis = records
    ? {
        priority: jiraPriorityDistributionByStatus(records.jira),
        jsmAge: jsmAgeBuckets(records.jsm, Date.now()),
        staleness: jiraStaleness(records.jira, Date.now()),
      }
    : null;

  return (
    <div className="view workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / OBSERVABILITY</div>
          <h2>Insights</h2>
          <p>Live source coverage for the latest refresh.</p>
        </div>
        <button
          className="btn btn-filled"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing…' : 'Refresh data'}</span>
        </button>
      </div>

      <div className="insight-hero">
        <div>
          <span className="summary-label">VISIBLE RECORDS LOADED</span>
          <strong className="text-display-sm tabular-nums">{counts ? total : '—'}</strong>
          <p>Current permission-filtered snapshot · maximum 50 records per source</p>
        </div>
        <div className="hero-orb">
          <Activity size={32} />
        </div>
      </div>

      <div className="insight-stats">
        <div>
          <Stat
            label="Jira issues"
            value={counts ? String(counts.jira) : '—'}
            delta="Live sample · max 50"
            tone="flat"
            icon={Activity}
          />
          {counts && (
            <div
              className="linear-progress"
              role="progressbar"
              aria-valuenow={(counts.jira / 50) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ marginTop: 6 }}
            >
              <div
                className="linear-progress-fill"
                style={{ width: `${(counts.jira / 50) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div>
          <Stat
            label="Confluence pages"
            value={counts ? String(counts.confluence) : '—'}
            delta="Live sample · max 50"
            tone="flat"
            icon={FileText}
          />
          {counts && (
            <div
              className="linear-progress"
              role="progressbar"
              aria-valuenow={(counts.confluence / 50) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ marginTop: 6 }}
            >
              <div
                className="linear-progress-fill"
                style={{ width: `${(counts.confluence / 50) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div>
          <Stat
            label="JSM requests"
            value={counts ? String(counts.jsm) : '—'}
            delta="Live sample · max 50"
            tone="flat"
            icon={GitPullRequest}
          />
          {counts && (
            <div
              className="linear-progress"
              role="progressbar"
              aria-valuenow={(counts.jsm / 50) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ marginTop: 6 }}
            >
              <div
                className="linear-progress-fill"
                style={{ width: `${(counts.jsm / 50) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <Card title="Readiness trend" subtitle="Daily snapshots from the Forge backend (newest first)">
        {trend.status === 'loading' && (
          <p role="status" className="source-empty">
            Reading daily snapshots…
          </p>
        )}
        {trend.status === 'error' && (
          <p className="source-error">{trend.message} Snapshots need the installed Forge app — in the standalone preview there is no snapshot history.</p>
        )}
        {trend.status === 'ready' && trend.snapshots.length < 2 && (
          <p className="source-empty">
            Daily snapshots are paused while the snapshot identity model is redesigned — no new snapshots are stored.
            {trend.snapshots.length === 1 ? ' 1 snapshot stored so far.' : ' No daily snapshot stored yet.'}
            Trends appear once 2 snapshots exist.
          </p>
        )}
        {trend.status === 'ready' && trend.snapshots.length >= 2 && (
          <div className="row-list">
            {trend.snapshots.slice(0, 14).map((s, i, list) => {
              const prev = list[i + 1];
              const delta = s.score !== null && prev && prev.score !== null ? s.score - prev.score : null;
              return (
                <div className="data-row" key={s.date}>
                  <div className="row-main">
                    <strong className="tabular-nums">
                      {s.date} · {s.score === null ? 'no score' : `${s.score}% ready`}
                    </strong>
                    <small>
                      {s.breakdown.Bcrit} critical blocker{s.breakdown.Bcrit === 1 ? '' : 's'} ·{' '}
                      {s.breakdown.Isev} SEV-1/2 incident{s.breakdown.Isev === 1 ? '' : 's'} · {s.breakdown.Pstale}{' '}
                      stale PR{s.breakdown.Pstale === 1 ? '' : 's'} · {s.breakdown.Dmissing} unassigned
                    </small>
                    <div
                      className="linear-progress"
                      role="progressbar"
                      aria-valuenow={s.score ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ marginTop: 6 }}
                    >
                      <div className="linear-progress-fill" style={{ width: `${s.score ?? 0}%` }} />
                    </div>
                  </div>
                  <span className={`pill ${delta === null ? 'pending' : delta < 0 ? 'critical' : delta > 0 ? 'healthy' : 'pending'}`}>
                    {delta === null ? '—' : delta > 0 ? `+${delta}` : `${delta}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Aging & priority" subtitle={`Derived from this refresh — ${snapshotDefinitionLine('insights')}`}>
        {loading && !records && (
          <p role="status" className="source-empty">
            Reading Jira, Confluence and JSM…
          </p>
        )}
        {analysis && (
          <>
            <div className="data-row">
              <div className="row-main">
                <strong>Jira issues by priority</strong>
                <small>Split open vs done — the briefing counts open only, so its Highest count matches the open column here</small>
              </div>
            </div>
            <p className="source-footnote">Open</p>
            <BarList items={analysis.priority.open} tone="amber" compact />
            <p className="source-footnote">Done (Done / Closed / Resolved)</p>
            <BarList items={analysis.priority.done} tone="green" compact />
            <div className="data-row" style={{ marginTop: 12 }}>
              <div className="row-main">
                <strong>JSM requests by age</strong>
                <small>Days since the request was created — JSM is the only source with a real created date</small>
              </div>
            </div>
            <BarList items={analysis.jsmAge.buckets} compact />
            <p className="source-footnote">
              Jira staleness: {analysis.staleness.last7} issues updated in the last 7 days,{' '}
              {analysis.staleness.last30} in the last 30 days. The snapshot only covers issues updated in the last
              30 days, so older work is invisible here — true Jira age needs the created field, which this slice
              does not add.
              {analysis.jsmAge.unknown > 0 &&
                ` ${analysis.jsmAge.unknown} JSM requests have no usable created date and are not counted above.`}
              {analysis.staleness.unknown > 0 &&
                ` ${analysis.staleness.unknown} Jira issues have no usable updated date and are not counted above.`}
            </p>
          </>
        )}
        {!analysis && !loading && <p className="source-empty">No source snapshot yet.</p>}
      </Card>

      <Card title="Source health" subtitle="Status from this refresh only">
        {loading && !counts && (
          <p role="status" className="source-empty">
            Reading Jira, Confluence and JSM…
          </p>
        )}
        {counts?.errors.length === 0 && (
          <p className="health-line">
            <ShieldCheck size={18} />
            <span>All three APIs responded successfully for this refresh.</span>
          </p>
        )}
        {counts?.errors.map((e) => (
          <p className="source-error" key={e}>
            {e}
          </p>
        ))}
        {!counts && !loading && <p className="source-empty">No source snapshot yet.</p>}
      </Card>

      <p className="workspace-footnote">
        Trends come only from daily snapshots stored by the installed app — nothing is invented for days without one.
      </p>
    </div>
  );
}
