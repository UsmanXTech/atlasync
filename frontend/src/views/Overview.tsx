import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  GitPullRequest,
  ListTodo,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import Card from '../components/Card';
import Gauge from '../components/Gauge';
import JiraIssuesCard from '../components/JiraIssuesCard';
import OverviewBriefingCard from '../components/OverviewBriefingCard';
import ConfluencePagesCard from '../components/ConfluencePagesCard';
import JsmRequestsCard from '../components/JsmRequestsCard';
import Stat from '../components/Stat';
import {
  contextualQuestionFor,
  overviewStatQuestionFor,
  READINESS_QUESTION,
  type OverviewStatKey,
} from '../utils/contextualQuestions';
import type { BriefingSummary } from '../hooks/useBriefingSummary';
import { fetchLiveReadiness, type LiveReadiness } from '../services/readiness';

type LiveReadinessState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'live'; result: LiveReadiness }
  | { status: 'error'; message: string };

/**
 * Screen 1: Overview (Portfolio Readiness & Blockers)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 *
 * Live data only — the Sample Dataset mode was deleted: every number
 * here comes from the live Atlassian snapshot, readiness computed by
 * the Forge backend (getReadiness), with exact backend errors and an
 * honest empty state when the snapshot is empty.
 */
export default function Overview({
  // Fix #13: the one shared ask path (App) — every button below asks
  // Intelligence AND opens the view through it.
  askInIntelligence,
  briefingSummary,
  // Fix #9: App's Sync Portfolio counter — a bump reloads the live
  // readiness fetch and all three live cards below.
  refreshTick,
}: {
  askInIntelligence: (question: string) => void;
  briefingSummary: BriefingSummary;
  refreshTick: number;
}) {
  const [liveReadiness, setLiveReadiness] = useState<LiveReadinessState>({ status: 'idle' });
  const [liveRefresh, setLiveRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLiveReadiness({ status: 'loading' });
    void fetchLiveReadiness().then((r) => {
      if (cancelled) return;
      if (r.ok) setLiveReadiness({ status: 'live', result: r.readiness });
      else setLiveReadiness({ status: 'error', message: r.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [liveRefresh, refreshTick]);

  const askAboutThis = () => {
    askInIntelligence(contextualQuestionFor('overview'));
  };

  // Phase 3.1 — a live stat is a button: clicking it asks
  // Intelligence about that metric's topic (never its number) and
  // opens the answer.
  const askStat = (stat: OverviewStatKey) => {
    askInIntelligence(overviewStatQuestionFor(stat));
  };

  const live = liveReadiness.status === 'live' ? liveReadiness.result : null;
  const b = live?.breakdown ?? { Bcrit: 0, Isev: 0, Pstale: 0, Dmissing: 0 };

  return (
    <div className="view overview-view">
      <div className="view-head">
        <div>
          <h2>Delivery Confidence &amp; Portfolio Overview</h2>
          <p>Live Atlassian snapshot — Jira, Confluence, Bitbucket &amp; JSM.</p>
        </div>
        <div className="view-head-actions">
          <span className="live-badge">LIVE WORKSPACE</span>
          <button className="btn btn-filled" onClick={askAboutThis}>
            <Sparkles size={16} />
            <span>Ask about this</span>
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          label="Open issues"
          value={live ? String(live.counts.jiraOpen) : '—'}
          delta={live ? `${live.counts.jiraTotal} in 30-day snapshot` : 'Live snapshot'}
          tone="flat"
          icon={ListTodo}
          onClick={() => askStat('openIssues')}
          ariaLabel="Ask about open issues"
        />
        <Stat
          label="Active blockers"
          value={live ? String(live.blockerCount) : '—'}
          delta={live ? `${live.blockersUnassigned} unassigned · High or above` : 'High priority or above'}
          tone={live && live.blockerCount > 0 ? 'bad' : 'flat'}
          icon={ShieldAlert}
          onClick={() => askStat('blockers')}
          ariaLabel="Ask about active blockers"
        />
        <Stat
          label="Stale PRs"
          value={live ? String(b.Pstale) : '—'}
          delta="Open PRs on critical issues"
          tone={live && b.Pstale > 0 ? 'bad' : 'flat'}
          icon={GitPullRequest}
          onClick={() => askStat('stalePrs')}
          ariaLabel="Ask about stale pull requests"
        />
        <Stat
          label="Open incidents"
          value={live ? String(b.Isev) : '—'}
          delta="SEV-1/2 proxy: Highest / Critical"
          tone={live && b.Isev > 0 ? 'bad' : 'flat'}
          icon={AlertTriangle}
          onClick={() => askStat('incidents')}
          ariaLabel="Ask about open incidents"
        />
      </div>

      <div className="overview-main-grid">
        {/* Column 1: Live Readiness + Live Critical Blockers */}
        <section className="overview-column">
          <Card
            className="overview-readiness"
            title="Release readiness"
            subtitle="Live · computed in the Forge backend"
          >
            <div className="ai-teaser">
              {liveReadiness.status === 'loading' && <p role="status">Reading the live snapshot…</p>}
              {liveReadiness.status === 'error' && (
                <>
                  <p className="source-error" role="alert">
                    {liveReadiness.message}
                  </p>
                  <div className="row-actions">
                    <button className="btn" onClick={() => setLiveRefresh((v) => v + 1)}>
                      <RefreshCw size={14} /> <span>Retry</span>
                    </button>
                  </div>
                </>
              )}
              {live && live.score === null && (
                <>
                  <p>
                    <strong>No records in the 30-day snapshot — nothing to score.</strong>
                  </p>
                  {live.notes.map((note) => (
                    <p key={note} className="source-footnote">
                      {note}
                    </p>
                  ))}
                  <div className="row-actions">
                    <button className="btn" onClick={() => setLiveRefresh((v) => v + 1)}>
                      <RefreshCw size={14} /> <span>Retry</span>
                    </button>
                  </div>
                </>
              )}
              {live && live.score !== null && (
                <>
                  <Gauge value={live.score} label="Live Readiness" />
                  <div>
                    <p>
                      <strong>Live estimate from the {live.counts.jiraTotal} most recently updated Jira issues.</strong>{' '}
                      −12 × {b.Bcrit} critical blockers · −15 × {b.Isev} SEV-1/2 incidents · −5 × {b.Pstale} stale
                      PRs · −10 × {b.Dmissing} unassigned.
                    </p>
                    <p className="source-footnote">
                      Isev is a priority proxy: JSM exposes no SEV field. Dmissing counts open Highest/Critical
                      blockers with no assignee. PR age is not available from dev-status — open PRs on critical
                      issues are counted as stale.
                    </p>
                    {live.notes.map((note) => (
                      <p key={note} className="source-footnote">
                        {note}
                      </p>
                    ))}
                    {live.generatedAt && (
                      <p className="source-footnote">Computed {new Date(live.generatedAt).toLocaleTimeString()}.</p>
                    )}
                    {live.unavailable.length > 0 && (
                      <p className="source-error">{live.unavailable.join(' · ')}</p>
                    )}
                    <div className="row-actions">
                      <button className="btn btn-filled" onClick={() => askInIntelligence(READINESS_QUESTION)}>
                        <span>Ask Intelligence</span> <ArrowRight size={14} />
                      </button>
                      <button className="btn" onClick={() => setLiveRefresh((v) => v + 1)}>
                        <RefreshCw size={14} /> <span>Refresh</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card title="Active blockers" subtitle="Open · High priority or above · live snapshot">
            <div className="row-list">
              {live?.blockers.map((blocker) => (
                <div className="data-row" key={blocker.key}>
                  <div className="row-main">
                    <strong>
                      <span className="issue-key">{blocker.key}</span> · {blocker.summary}
                    </strong>
                    <small>
                      {blocker.assignee ?? 'Unassigned'}
                      {blocker.updated ? ` · updated ${new Date(blocker.updated).toLocaleDateString()}` : ''}
                    </small>
                  </div>
                  <span className="pill critical">{blocker.priority ?? 'Critical'}</span>
                </div>
              ))}
              {live && live.blockers.length === 0 && (
                <p className="source-empty">No open blockers at High priority or above in the snapshot.</p>
              )}
              {!live && <p className="source-empty">Loading live blockers…</p>}
            </div>
          </Card>
        </section>

        {/* Column 2: Live Feeds (Briefing, Jira, Confluence, JSM) */}
        <section className="overview-column">
          <Card className="overview-live-card" title="Today’s briefing" subtitle="Live blocker + stale watch">
            <OverviewBriefingCard askInIntelligence={askInIntelligence} briefingSummary={briefingSummary} />
          </Card>
          <Card className="overview-live-card" title="Jira issues" subtitle="Read-only · live data from your Jira site">
            <JiraIssuesCard refreshTick={refreshTick} />
          </Card>
          <Card className="overview-live-card" title="Confluence pages">
            <ConfluencePagesCard askInIntelligence={askInIntelligence} refreshTick={refreshTick} />
          </Card>
          <Card className="overview-live-card" title="JSM requests">
            <JsmRequestsCard askInIntelligence={askInIntelligence} refreshTick={refreshTick} />
          </Card>
        </section>

        {/* Column 3: Live Incidents */}
        <section className="overview-column">
          <Card title="SEV-1/2 incidents" subtitle="Open JSM requests · Highest / Critical priority">
            <div className="row-list">
              {live?.incidents.map((incident) => (
                <div className="data-row" key={incident.key}>
                  <div className="row-main">
                    <strong>
                      <span className="issue-key">{incident.key}</span> · {incident.summary}
                    </strong>
                    <small>{incident.status}</small>
                  </div>
                  <span className="pill critical">{incident.priority ?? 'Critical'}</span>
                </div>
              ))}
              {live && live.incidents.length === 0 && (
                <p className="source-empty">No open SEV-1/2 incidents in the snapshot.</p>
              )}
              {!live && <p className="source-empty">Loading live incidents…</p>}
            </div>
          </Card>

        </section>
      </div>
    </div>
  );
}
