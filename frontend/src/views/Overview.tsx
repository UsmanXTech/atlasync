import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CircleDot,
  FileText,
  GitPullRequest,
  ListTodo,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import Card from '../components/Card';
import Gauge from '../components/Gauge';
import Stat from '../components/Stat';
import { BarList } from '../components/Bars';
import {
  ACTIVITY,
  BLOCKERS,
  DOCS,
  INCIDENTS,
  ISSUES_BY_PRIORITY,
  ISSUES_BY_STATUS,
  PROJECTS,
  PULL_REQUESTS,
} from '../data/mock';
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

interface OverviewProps {
  workspaceId: WorkspaceId;
  onNavigate: (view: ViewId) => void;
}

export default function Overview({ workspaceId, onNavigate }: OverviewProps) {
  const [resolved, setResolved] = useState<string[]>([]);
  const [prFilter, setPrFilter] = useState<'all' | PrStatus>('all');
  const [range, setRange] = useState<0 | 7 | 30>(7);

  const projects = useMemo(() => PROJECTS.filter((p) => p.workspace === workspaceId), [workspaceId]);
  const blockers = useMemo(
    () => BLOCKERS.filter((b) => b.workspace === workspaceId && !resolved.includes(b.id)),
    [workspaceId, resolved],
  );
  const docs = useMemo(() => DOCS.filter((d) => d.workspace === workspaceId), [workspaceId]);
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
  const prsInReview = PULL_REQUESTS.filter(
    (p) => p.workspace === workspaceId && (p.status === 'review' || p.status === 'changes'),
  ).length;
  const openIncidents = incidents.filter((i) => i.status !== 'resolved').length;

  return (
    <div className="view">
      <div className="view-head">
        <h2>Overview</h2>
        <p>Synced state across Jira, Confluence, Bitbucket, and JSM — sample data.</p>
      </div>

      <div className="stat-grid">
        <Stat label="Open issues" value={String(openIssues)} delta="+8 vs last week" tone="bad" icon={ListTodo} />
        <Stat label="Active blockers" value={String(blockers.length)} delta={`${blockers.filter((b) => b.severity === 'critical').length} critical`} tone="bad" icon={ShieldAlert} />
        <Stat label="PRs awaiting action" value={String(prsInReview)} delta="1 with failing checks" tone="flat" icon={GitPullRequest} />
        <Stat label="Open incidents" value={String(openIncidents)} delta="1 Sev1 investigating" tone="bad" icon={AlertTriangle} />
      </div>

      <div className="grid-2">
        <Card title="Release readiness" subtitle="Atlas v2 · AI assessment · Mock data">
          <div className="ai-teaser">
            <Gauge value={72} label="Ready" />
            <div>
              <p>
                <strong>Not yet — close, but two critical items stand in the way.</strong> An open Sev1
                incident on payments and one unresolved critical blocker keep Atlas v2 below the release bar.
              </p>
              <button className="btn btn-primary" onClick={() => onNavigate('intelligence')}>
                Open Intelligence <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Card>

        <Card title="Project health" subtitle="Current workspace · progress to next milestone">
          <div className="row-list">
            {projects.map((p) => (
              <div className="data-row" key={p.id}>
                <div className="row-main">
                  <strong>
                    {p.key} · {p.name}
                  </strong>
                  <small>
                    {p.owner} · {p.nextMilestone}
                  </small>
                  <div className="progress">
                    <div
                      className={p.health === 'healthy' ? 'good' : p.health === 'at-risk' ? 'warn' : 'bad'}
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <span className={`pill ${p.health}`}>{p.health}</span>
                <span className="row-meta">{p.progress}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Jira issue statistics" subtitle="All workspaces · sample aggregate">
          <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--muted)' }}>By status</h4>
          <BarList items={ISSUES_BY_STATUS} />
          <h4 style={{ margin: '18px 0 10px', fontSize: '0.82rem', color: 'var(--muted)' }}>By priority</h4>
          <BarList items={ISSUES_BY_PRIORITY} tone="amber" />
        </Card>

        <Card
          title="Active blockers & dependencies"
          subtitle={resolved.length > 0 ? `${resolved.length} resolved in this session` : 'What is holding work back'}
        >
          <div className="row-list">
            {blockers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No active blockers — all clear.</p>}
            {blockers.map((b) => (
              <div className="data-row" key={b.id}>
                <div className="row-main">
                  <strong>
                    {b.key} · {b.title}
                  </strong>
                  <small>
                    Blocked by {b.blockedBy} · {b.owner} · {b.ageDays} days open
                  </small>
                </div>
                <span className={`pill ${b.severity}`}>{b.severity}</span>
                <button className="btn btn-small" onClick={() => setResolved([...resolved, b.id])}>
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Confluence activity" subtitle="Recently edited docs">
          <div className="row-list">
            {docs.map((d) => (
              <div className="data-row" key={d.id}>
                <div className="row-main">
                  <strong>{d.title}</strong>
                  <small>
                    {d.space} · {d.editor} · {d.edits} edits
                  </small>
                </div>
                <span className="row-meta">{ageLabel(d.daysAgo)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Bitbucket pull requests"
          subtitle="Filter by status"
          action={
            <div className="chip-row">
              {(['all', 'review', 'approved', 'merged', 'changes'] as const).map((s) => (
                <button key={s} className={`chip ${prFilter === s ? 'active' : ''}`} onClick={() => setPrFilter(s)}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          }
        >
          <div className="row-list">
            {prs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No PRs in this filter.</p>}
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
          </div>
        </Card>

        <Card title="JSM incidents" subtitle="Service health">
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
      </div>

      <Card
        title="Recent activity"
        subtitle="Across all connected tools"
        action={
          <div className="chip-row">
            {([0, 7, 30] as const).map((r) => (
              <button key={r} className={`chip ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                {r === 0 ? 'Today' : `${r}D`}
              </button>
            ))}
          </div>
        }
      >
        <div className="feed">
          {activity.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Nothing in this range.</p>}
          {activity.map((a) => {
            const Icon = KIND_ICONS[a.kind];
            return (
              <div className="feed-item" key={a.id}>
                <span className="feed-icon">
                  <Icon size={15} />
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
        </div>
      </Card>
    </div>
  );
}
