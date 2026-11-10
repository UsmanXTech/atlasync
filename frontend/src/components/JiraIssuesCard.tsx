import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from './Card';
import { SAMPLE_JIRA_ISSUES } from '../data/mock';
import type { LiveIssue } from '../data/types';
import { fetchIssueDevStatus, fetchLiveJiraIssues, type JiraError, type LinkedPullRequest } from '../services/jira';
import { formatUpdated } from '../utils/formatUpdated';

type Mode = 'demo' | 'live';
type LiveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; issues: LiveIssue[] }
  | { status: 'error'; error: JiraError };

// The Jira issues card: the first live surface in Atlasync.
// Demo mode shows fixed sample issues (labeled as such). Live mode loads
// real issues through the Forge backend — in the standalone preview that
// resolves to a backend-unreachable state, never to fake live data. Every other card on the dashboard stays mock.
function IssueRow({ issue }: { issue: LiveIssue }) {
  return (
    <div className="data-row">
      <div className="row-main">
        <strong>{issue.summary}</strong>
        <small>
          <span className="issue-key">{issue.key}</span>
          {' · '}
          {issue.assignee ?? 'Unassigned'}
          {' · '}
          {issue.priority ?? 'No priority'}
          {' · '}
          {formatUpdated(issue.updated)}
        </small>
      </div>
      <span className="pill pending">{issue.status}</span>
    </div>
  );
}

type PrState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; pullRequests: LinkedPullRequest[] }
  | { status: 'error'; error: JiraError };

// Live issue row with linked Bitbucket pull requests (Task 6,
// Architecture A). The PR list loads on demand through the Forge
// backend's dev-status call — read-only, and only when the issue
// carries a numeric Jira id. An empty list is shown honestly: no
// Bitbucket workspace is linked to this Jira site yet, so there is
// nothing to link — the user links one in Jira's DVCS settings.
function LiveIssueRow({ issue }: { issue: LiveIssue }) {
  const [expanded, setExpanded] = useState(false);
  const [prs, setPrs] = useState<PrState>({ status: 'idle' });

  const loadPrs = async () => {
    if (!issue.id) return;
    setExpanded(true);
    setPrs({ status: 'loading' });
    const result = await fetchIssueDevStatus(issue.id);
    setPrs(
      result.ok
        ? { status: 'ready', pullRequests: result.pullRequests }
        : { status: 'error', error: result.error },
    );
  };

  return (
    <div>
      <IssueRow issue={issue} />
      {issue.id && (
        <div className="row-actions" style={{ padding: '0 0 8px' }}>
          <button
            className="btn"
            onClick={() => (expanded ? setExpanded(false) : void loadPrs())}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide linked PRs' : 'Linked pull requests'}
          </button>
        </div>
      )}
      {expanded && prs.status === 'loading' && (
        <p role="status" style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 10px' }}>
          Loading linked pull requests…
        </p>
      )}
      {expanded && prs.status === 'error' && (
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 10px' }}>
          Could not load linked pull requests: {prs.error.message}
        </p>
      )}
      {expanded && prs.status === 'ready' && prs.pullRequests.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 10px' }}>
          No linked pull requests — no Bitbucket workspace is linked to this Jira site yet. Link one in
          Jira&apos;s DVCS settings and reference the issue key in a PR to see it here.
        </p>
      )}
      {expanded && prs.status === 'ready' && prs.pullRequests.length > 0 && (
        <div className="row-list" style={{ marginBottom: 10 }}>
          {prs.pullRequests.map((pr, i) => (
            <div className="data-row" key={pr.id ?? `${pr.name}-${i}`}>
              <div className="row-main">
                <strong>
                  {pr.url ? (
                    <a href={pr.url} target="_blank" rel="noreferrer">
                      {pr.name}
                    </a>
                  ) : (
                    pr.name
                  )}
                </strong>
                <small>Bitbucket pull request</small>
              </div>
              <span className="pill pending">{pr.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JiraIssuesCard() {
  const [mode, setMode] = useState<Mode>('demo');
  const [live, setLive] = useState<LiveState>({ status: 'idle' });

  const loadLive = async () => {
    setLive({ status: 'loading' });
    const result = await fetchLiveJiraIssues();
    setLive(
      result.ok
        ? { status: 'ready', issues: result.issues }
        : { status: 'error', error: result.error },
    );
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    if (next === 'live') void loadLive();
  };

  return (
    <Card
      title="Jira issues"
      subtitle={
        mode === 'demo'
          ? 'Sample issues · Demo data — switch to Live inside a Forge installation'
          : 'Live data from your Jira site via the Forge backend (read-only)'
      }
      action={
        <div className="segmented" role="group" aria-label="Jira data mode">
          <button className={mode === 'demo' ? 'active' : ''} onClick={() => switchMode('demo')}>
            Demo data
          </button>
          <button className={mode === 'live' ? 'active' : ''} onClick={() => switchMode('live')}>
            Live Jira
          </button>
        </div>
      }
    >
      {mode === 'demo' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <span className="mock-badge">DEMO DATA</span>
          </div>
          <div className="row-list">
            {SAMPLE_JIRA_ISSUES.map((issue) => (
              <IssueRow key={issue.key} issue={issue} />
            ))}
          </div>
        </>
      )}

      {mode === 'live' && live.status === 'loading' && (
        <p role="status" style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
          Loading Jira issues via the Forge backend…
        </p>
      )}

      {mode === 'live' && live.status === 'error' && (
        <div>
          <div className="note-box">
            <span className={`pill ${live.error.kind === 'PERMISSION_DENIED' ? 'critical' : live.error.kind === 'RATE_LIMITED' ? 'high' : 'pending'}`}>
              {live.error.kind === 'PERMISSION_DENIED'
                ? 'Permission denied'
                : live.error.kind === 'RATE_LIMITED'
                  ? 'Rate limited'
                  : 'Could not load'}
            </span>
            <p style={{ margin: '10px 0 0' }}>{live.error.message}</p>
            {live.error.kind === 'PERMISSION_DENIED' && (
              <p style={{ margin: '8px 0 0' }}>
                Nothing is written or changed — this is a read-only request. Ask your Jira admin to
                grant your user Browse Projects permission on the projects you need.
              </p>
            )}
          </div>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> Retry
            </button>
            <button className="btn" onClick={() => switchMode('demo')}>
              Back to demo data
            </button>
          </div>
        </div>
      )}

      {mode === 'live' && live.status === 'ready' && live.issues.length === 0 && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
            No Jira issues found for the default query (recently updated, newest first).
          </p>
          <div className="row-actions">
            <button className="btn" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn" onClick={() => switchMode('demo')}>
              Back to demo data
            </button>
          </div>
        </div>
      )}

      {mode === 'live' && live.status === 'ready' && live.issues.length > 0 && (
        <>
          <div style={{ marginBottom: 10 }}>
            <span className="pill healthy">LIVE</span>
            <span className="row-meta" style={{ marginLeft: 8 }}>
              {live.issues.length} issue{live.issues.length === 1 ? '' : 's'} · read-only
            </span>
          </div>
          <div className="row-list">
            {live.issues.map((issue) => (
              <LiveIssueRow key={issue.key} issue={issue} />
            ))}
          </div>
          <div className="row-actions">
            <button className="btn" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn" onClick={() => switchMode('demo')}>
              Back to demo data
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
