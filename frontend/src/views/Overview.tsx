import { useMemo, useState } from 'react';
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
import { computeReadiness, type ReadinessResult } from '../utils/readiness';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { BriefingSummary } from '../hooks/useBriefingSummary';
import { fetchLiveJiraIssues } from '../services/jira';
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

type ReadinessState =
  | { status: 'sample' }
  | { status: 'loading' }
  | { status: 'live'; result: ReadinessResult }
  | { status: 'error'; message: string };

/**
 * Screen 1: Overview (Portfolio Readiness & Blockers)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Overview({
  workspaceId,
  onNavigate,
  conversation,
  briefingSummary,
}: {
  workspaceId: WorkspaceId;
  onNavigate: (view: ViewId) => void;
  conversation: IntelligenceConversation;
  briefingSummary: BriefingSummary;
}) {
  const [resolved, setResolved] = useState<string[]>([]);
  const [prFilter, setPrFilter] = useState<'all' | PrStatus>('all');
  const [range, setRange] = useState<0 | 7 | 30>(7);
  const [readiness, setReadiness] = useState<ReadinessState>({ status: 'sample' });

  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('overview'));
    onNavigate('intelligence');
  };

  const calcReadiness = async () => {
    setReadiness({ status: 'loading' });
    const r = await fetchLiveJiraIssues(50);
    if (!r.ok) {
      setReadiness({ status: 'error', message: r.error.message });
      return;
    }
    const result = computeReadiness(r.issues);
    if (!result) {
      setReadiness({
        status: 'error',
        message:
          'No Jira issues found for the default query (recently updated, newest first) — nothing to score.',
      });
      return;
    }
    setReadiness({ status: 'live', result });
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

  return (
    <div className="view overview-view">
      <div className="view-head">
        <div>
          <h2>Delivery Confidence &amp; Portfolio Overview</h2>
          <p>Multi-tool delivery snapshot across Jira, Confluence, Bitbucket &amp; JSM.</p>
        </div>
        <div className="view-head-actions">
          <span className="mock-badge">SAMPLE METRICS · LIVE SOURCES BELOW</span>
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
            subtitle={
              readiness.status === 'live'
                ? 'Atlas v2 · live estimate from Jira'
                : 'Atlas v2 · sample assessment'
            }
          >
            <div className="ai-teaser">
              <Gauge
                value={readiness.status === 'live' ? readiness.result.score : 72}
                label={readiness.status === 'live' ? 'Live Readiness' : 'Sample Readiness'}
              />
              <div>
                {readiness.status === 'sample' && (
                  <>
                    <p>
                      <strong>Demo-only estimate.</strong> Not calculated from live records.
                    </p>
                    <div className="row-actions">
                      <button className="btn btn-filled" onClick={() => onNavigate('intelligence')}>
                        <span>Ask Intelligence</span> <ArrowRight size={14} />
                      </button>
                      <button className="btn" onClick={() => void calcReadiness()}>
                        <span>Calculate from live Jira</span>
                      </button>
                    </div>
                  </>
                )}
                {readiness.status === 'loading' && <p role="status">Reading live Jira issues…</p>}
                {readiness.status === 'live' && (
                  <>
                    <p>
                      <strong>
                        Live estimate from the {readiness.result.total} most recently updated Jira issues.
                      </strong>{' '}
                      {readiness.result.summary}.
                    </p>
                    <p className="source-footnote">
                      −15 per open Highest (max −45) · −8 High (max −24) · −3 Medium (max −12) · −1 Low (max −5). Done issues don&apos;t lower the score.
                    </p>
                    <div className="row-actions">
                      <button className="btn btn-filled" onClick={() => onNavigate('intelligence')}>
                        <span>Ask Intelligence</span> <ArrowRight size={14} />
                      </button>
                      <button className="btn" onClick={() => setReadiness({ status: 'sample' })}>
                        <span>Back to sample</span>
                      </button>
                    </div>
                  </>
                )}
                {readiness.status === 'error' && (
                  <>
                    <p className="source-error" role="alert">
                      {readiness.message}
                    </p>
                    <p>Showing the sample estimate instead.</p>
                    <div className="row-actions">
                      <button className="btn" onClick={() => void calcReadiness()}>
                        <RefreshCw size={14} /> <span>Retry</span>
                      </button>
                      <button className="btn btn-filled" onClick={() => onNavigate('intelligence')}>
                        <span>Ask Intelligence</span> <ArrowRight size={14} />
                      </button>
                    </div>
                  </>
                )}
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

        {/* Column 2: Live Feeds (Briefing, Jira, Confluence, JSM) */}
        <section className="overview-column">
          <Card className="overview-live-card" title="Today’s briefing" subtitle="Live blocker + stale watch">
            <OverviewBriefingCard onNavigate={onNavigate} briefingSummary={briefingSummary} />
          </Card>
          <Card className="overview-live-card" title="Jira issues" subtitle="Read-only · switch demo or live data">
            <JiraIssuesCard />
          </Card>
          <Card className="overview-live-card" title="Confluence pages">
            <ConfluencePagesCard conversation={conversation} onNavigate={onNavigate} />
          </Card>
          <Card className="overview-live-card" title="JSM requests">
            <JsmRequestsCard conversation={conversation} onNavigate={onNavigate} />
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

          <Card
            title="Pull requests"
            subtitle="Sample PR activity"
            action={
              <SegmentedButton
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'review', label: 'Review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'merged', label: 'Merged' },
                  { value: 'changes', label: 'Changes' },
                ]}
                value={prFilter}
                onChange={(s) => setPrFilter(s as 'all' | PrStatus)}
                ariaLabel="PR status filter"
              />
            }
          >
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
