import { useCallback, useEffect, useState } from 'react';
import { Activity, FileText, GitPullRequest, RefreshCw, ShieldCheck } from 'lucide-react';
import Stat from '../components/Stat';
import Card from '../components/Card';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
import { fetchSnapshots, type ReadinessSnapshot } from '../services/snapshots';

type Counts = {
  jira: number;
  confluence: number;
  jsm: number;
  errors: string[];
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
        fetchLiveJiraIssues(50),
        fetchConfluencePages(50),
        fetchJsmRequests(50),
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
    } catch (e) {
      setCounts({
        jira: 0,
        confluence: 0,
        jsm: 0,
        errors: [e instanceof Error ? e.message : 'Unable to read live sources.'],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = counts ? counts.jira + counts.confluence + counts.jsm : 0;

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
                      Bcrit {s.breakdown.Bcrit} · Isev {s.breakdown.Isev} · Pstale {s.breakdown.Pstale} · Dmissing{' '}
                      {s.breakdown.Dmissing}
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
