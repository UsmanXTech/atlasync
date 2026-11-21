import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CircleDot,
  FileText,
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
import { BarList } from '../components/Bars';
import SegmentedButton from '../components/SegmentedButton';
import {
  ACTIVITY,
  BLOCKERS,
  INCIDENTS,
  ISSUES_BY_PRIORITY,
  ISSUES_BY_STATUS,
  PROJECTS,
  PULL_REQUESTS,
} from '../data/mock';
import { overviewStatContext } from '../utils/overviewStats';
import { contextualQuestionFor, overviewStatQuestionFor, type OverviewStatKey } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { BriefingSummary } from '../hooks/useBriefingSummary';
import { fetchLiveReadiness, type LiveReadiness } from '../services/readiness';
import type { DataMode } from '../utils/dataMode';
import type { ActivityKind, PrStatus, WorkspaceId } from '../data/types';
import type { ViewId } from '../components/Sidebar';

const KIND_ICONS: Record<ActivityKind, typeof CircleDot> = {
  jira: CircleDot,
  confluence: FileText,
  bitbucket: GitPullRequest,
  jsm: AlertTriangle,
  ai: Sparkles,
};

function ageLabel(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

type LiveReadinessState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'live'; result: LiveReadiness }
  | { status: 'error'; message: string };

/**
 * Screen 1: Overview (Portfolio Readiness & Blockers)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 *
 * v2.1.0 data modes — the two modes never mix:
 * - Sample Dataset: ONLY demo data, labelled SAMPLE (the pre-v2.1.0 view).
 * - Live Workspace: ONLY live Atlassian data, readiness computed by the
 *   Forge backend (getReadiness), with exact backend errors.
 */
export default function Overview({
  workspaceId,
  onNavigate,
  conversation,
  briefingSummary,
  dataMode,
  onDataMode,
}: {
  workspaceId: WorkspaceId;
  onNavigate: (view: ViewId) => void;
  conversation: IntelligenceConversation;
  briefingSummary: BriefingSummary;
  dataMode: DataMode;
  onDataMode: (mode: DataMode) => void;
}) {
  const [resolved, setResolved] = useState<string[]>([]);
  const [prFilter, setPrFilter] = useState<'all' | PrStatus>('all');
  const [range, setRange] = useState<0 | 7 | 30>(7);
  const [liveReadiness, setLiveReadiness] = useState<LiveReadinessState>({ status: 'idle' });
  const [liveRefresh, setLiveRefresh] = useState(0);

  useEffect(() => {
    if (dataMode !== 'live') return;
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
  }, [dataMode, liveRefresh]);

  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('overview'));
    onNavigate('intelligence');
  };

  // Phase 3.1 — a live stat is a button: clicking it asks
  // Intelligence about that metric's topic (never its number) and
  // opens the answer. Sample-mode stats have no onClick and stay inert.
  const askStat = (stat: OverviewStatKey) => {
    conversation.ask(overviewStatQuestionFor(stat));
    onNavigate('intelligence');
  };

  const projects = useMemo(() => PROJECTS.filter((p) => p.workspace === workspaceId), [workspaceId]);
  const blockers = useMemo(
    () => BLOCKERS.filter((b) => b.workspace === workspaceId && !resolved.includes(b.id)),
    [workspaceId, resolved],
  );
  const prs = useMemo(() => {
    const list = PULL_REQUESTS.filter((p) => p.workspace === workspaceId);
    return prFilter === 'all' ? list : list.filter((p) => p.status === prFilter);
  }, [workspaceId, prFilter]);
  const incidents = useMemo(() => INCIDENTS.filter((i) => i.workspace === workspaceId), [workspaceId]);
  const activity = useMemo(
    () => ACTIVITY.filter((a) => a.workspace === workspaceId && a.daysAgo <= range),
    [workspaceId, range],
  );

  const openIssues = projects.reduce((sum, p) => sum + p.openIssues, 0);
  const awaitingPrs = PULL_REQUESTS.filter(
    (p) => p.workspace === workspaceId && (p.status === 'review' || p.status === 'changes'),
  );
  const prsInReview = awaitingPrs.length;
  const openIncidents = incidents.filter((i) => i.status !== 'resolved').length;
  const statCtx = useMemo(
    () => overviewStatContext(projects, blockers, awaitingPrs, incidents),
    [projects, blockers, awaitingPrs, incidents],
  );

  if (dataMode === 'live') {
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
            value={live ? String(b.Bcrit) : '—'}
            delta={live ? `${b.Dmissing} unassigned` : 'Highest / Critical'}
            tone={live && b.Bcrit > 0 ? 'bad' : 'flat'}
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
                        <button className="btn btn-filled" onClick={() => onNavigate('intelligence')}>
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

            <Card title="Critical blockers" subtitle="Open Highest / Critical · live snapshot">
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
                  <p className="source-empty">No open Highest / Critical blockers in the snapshot.</p>
                )}
                {!live && <p className="source-empty">Loading live blockers…</p>}
              </div>
            </Card>
          </section>

          {/* Column 2: Live Feeds (Briefing, Jira, Confluence, JSM) */}
          <section className="overview-column">
            <Card className="overview-live-card" title="Today’s briefing" subtitle="Live blocker + stale watch">
              <OverviewBriefingCard onNavigate={onNavigate} briefingSummary={briefingSummary} />
            </Card>
            <Card className="overview-live-card" title="Jira issues" subtitle="Read-only · switch demo or live data">
              <JiraIssuesCard dataMode={dataMode} />
            </Card>
            <Card className="overview-live-card" title="Confluence pages">
              <ConfluencePagesCard conversation={conversation} onNavigate={onNavigate} />
            </Card>
            <Card className="overview-live-card" title="JSM requests">
              <JsmRequestsCard conversation={conversation} onNavigate={onNavigate} />
            </Card>
          </section>

          {/* Column 3: Live Incidents + Sample-data note */}
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

            <Card title="Sample data hidden" subtitle="Live Workspace shows live records only">
              <p>
                Activity, pull requests and incident history shown in Sample Dataset are demo data and are hidden
                here.
              </p>
              <div className="row-actions">
                <button className="btn" onClick={() => onDataMode('sample')}>
                  <span>Switch to Sample Dataset</span>
                </button>
              </div>
            </Card>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="view overview-view">
      <div className="view-head">
        <div>
          <h2>Delivery Confidence &amp; Portfolio Overview</h2>
          <p>Multi-tool delivery snapshot across Jira, Confluence, Bitbucket &amp; JSM.</p>
        </div>
        <div className="view-head-actions">
          <span className="mock-badge">SAMPLE DATASET · DEMO DATA ONLY</span>
          <button className="btn btn-filled" onClick={askAboutThis}>
            <Sparkles size={16} />
            <span>Ask about this</span>
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          label="Open issues"
          value={String(openIssues)}
          delta={statCtx.issues.text}
          tone={statCtx.issues.tone}
          icon={ListTodo}
        />
        <Stat
          label="Active blockers"
          value={String(blockers.length)}
          delta={statCtx.blockers.text}
          tone={statCtx.blockers.tone}
          icon={ShieldAlert}
        />
        <Stat
          label="PRs awaiting action"
          value={String(prsInReview)}
          delta={statCtx.prs.text}
          tone={statCtx.prs.tone}
          icon={GitPullRequest}
        />
        <Stat
          label="Open incidents"
          value={String(openIncidents)}
          delta={statCtx.incidents.text}
          tone={statCtx.incidents.tone}
          icon={AlertTriangle}
        />
      </div>

      <div className="overview-main-grid">
        {/* Column 1: Release Readiness, Issue Distribution & Active Blockers */}
        <section className="overview-column">
          <Card
            className="overview-readiness"
            title="Release readiness"
            subtitle="Atlas v2 · sample assessment"
          >
            <div className="ai-teaser">
              <Gauge value={72} label="Sample Readiness" />
              <div>
                <p>
                  <strong>Demo-only estimate.</strong> Not calculated from live records.
                </p>
                <div className="row-actions">
                  <button className="btn btn-filled" onClick={() => onNavigate('intelligence')}>
                    <span>Ask Intelligence</span> <ArrowRight size={14} />
                  </button>
                  <button className="btn" onClick={() => onDataMode('live')}>
                    <span>View live readiness</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className="overview-distribution"
            title="Issue distribution"
            subtitle="Demo aggregate · not live analytics"
          >
            <div className="overview-chart-block">
              <div className="chart-group">
                <h4>By status</h4>
                <BarList items={ISSUES_BY_STATUS} compact />
              </div>
              <div className="chart-group">
                <h4>By priority</h4>
                <BarList items={ISSUES_BY_PRIORITY} tone="amber" compact />
              </div>
            </div>
          </Card>

          <Card title="Active blockers" subtitle="Sample data · local demo resolve actions">
            <div className="row-list">
              {blockers.map((b) => (
                <div className="data-row" key={b.id}>
                  <div className="row-main">
                    <strong>
                      <span className="issue-key">{b.key}</span> · {b.title}
                    </strong>
                    <small>
                      {b.owner} · {b.ageDays} days open
                    </small>
                  </div>
                  <span className={`pill ${b.severity}`}>{b.severity}</span>
                  <button
                    className="btn btn-small"
                    onClick={() => setResolved((v) => [...v, b.id])}
                  >
                    <span>Resolve</span>
                  </button>
                </div>
              ))}
              {blockers.length === 0 && <p className="source-empty">No demo blockers remaining.</p>}
            </div>
          </Card>
        </section>

        {/* Column 2: Live feeds live in Live Workspace mode — Sample shows a switch card instead */}
        <section className="overview-column">
          <Card title="Live Workspace" subtitle="Live Jira, Confluence and JSM feeds">
            <p>
              Sample Dataset shows demo data only. Switch to Live Workspace to see live records, exact backend
              diagnostics and the backend-computed readiness score.
            </p>
            <div className="row-actions">
              <button className="btn btn-filled" onClick={() => onDataMode('live')}>
                <span>Switch to Live Workspace</span>
              </button>
            </div>
          </Card>
        </section>

        {/* Column 3: Activity, PRs & Incident Snapshot */}
        <section className="overview-column">
          <Card
            title="Recent activity"
            subtitle="Sample event stream"
            action={
              <SegmentedButton
                options={[
                  { value: 0, label: 'Today' },
                  { value: 7, label: '7D' },
                  { value: 30, label: '30D' },
                ]}
                value={range}
                onChange={(r) => setRange(r as 0 | 7 | 30)}
                ariaLabel="Activity range"
              />
            }
          >
            <div className="feed">
              {activity.map((a) => {
                const Icon = KIND_ICONS[a.kind];
                return (
                  <div className="feed-item" key={a.id}>
                    <span className="feed-icon">
                      <Icon size={16} />
                    </span>
                    <div>
                      <strong>{a.title}</strong>
                      <small>
                        {a.detail} · {a.actor} · {ageLabel(a.daysAgo)}
                      </small>
                    </div>
                  </div>
                );
              })}
              {activity.length === 0 && <p className="source-empty">No activity in this range.</p>}
            </div>
          </Card>

          <Card title="Pull requests" subtitle="Sample PR activity">
            <div
              className="chip-row"
              role="group"
              aria-label="PR status filter"
              style={{ marginBottom: 8 }}
            >
              {(
                [
                  ['all', 'All'],
                  ['review', 'Review'],
                  ['approved', 'Approved'],
                  ['merged', 'Merged'],
                  ['changes', 'Changes'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${prFilter === value ? 'active' : ''}`}
                  aria-pressed={prFilter === value}
                  onClick={() => setPrFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="row-list">
              {prs.map((pr) => (
                <div className="data-row" key={pr.id}>
                  <div className="row-main">
                    <strong>{pr.title}</strong>
                    <small>
                      {pr.repo} · {pr.author}
                    </small>
                  </div>
                  <span className={`pill ${pr.checks}`}>{pr.checks}</span>
                  <span className={`pill ${pr.status}`}>{pr.status}</span>
                </div>
              ))}
              {prs.length === 0 && <p className="source-empty">No sample PRs in this filter.</p>}
            </div>
          </Card>

          <Card title="Incident snapshot" subtitle="Sample incident data">
            <div className="row-list">
              {incidents.map((inc) => (
                <div className="data-row" key={inc.id}>
                  <div className="row-main">
                    <strong>{inc.title}</strong>
                    <small>
                      {inc.service} · {inc.status === 'resolved' ? 'Resolved' : `${inc.minutesOpen} min open`}
                    </small>
                  </div>
                  <span className={`pill ${inc.severity}`}>{inc.severity.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
