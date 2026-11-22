import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from './Card';
import RecordLink from './RecordLink';
import type { LiveIssue } from '../data/types';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { fetchIssueDevStatus, fetchLiveJiraIssues, type JiraError, type LinkedPullRequest } from '../services/jira';
import { formatUpdated } from '../utils/formatUpdated';
import { jiraIssueUrl } from '../utils/recordLinks';
import { RequestGeneration } from '../utils/requestGeneration';
import { LIVE_FETCH_LIMITS } from '../utils/liveSnapshot';

type LiveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; issues: LiveIssue[]; fetchedAt: string }
  | { status: 'error'; error: JiraError };

function IssueRow({ issue }: { issue: LiveIssue }) {
  const siteUrl = useSiteUrl();
  return (
    <div className="data-row">
      <div className="row-main">
        <strong>{issue.summary}</strong>
        <small>
          <RecordLink url={jiraIssueUrl(siteUrl, issue.key)} label={`Open ${issue.key} in Jira`}>
            <span className="issue-key">{issue.key}</span>
          </RecordLink>
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
            className="btn btn-small"
            onClick={() => (expanded ? setExpanded(false) : void loadPrs())}
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Hide linked PRs' : 'Linked pull requests'}</span>
          </button>
        </div>
      )}
      {expanded && prs.status === 'loading' && (
        <p role="status" style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.88rem', margin: '0 0 10px' }}>
          Loading linked pull requests…
        </p>
      )}
      {expanded && prs.status === 'error' && (
        <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.88rem', margin: '0 0 10px' }}>
          Could not load linked pull requests: {prs.error.message}
        </p>
      )}
      {expanded && prs.status === 'ready' && prs.pullRequests.length === 0 && (
        <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.88rem', margin: '0 0 10px' }}>
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

/**
 * Jira Issues Card (M3 restyled)
 * Live Jira records only — the demo/sample mode was deleted: the app
 * shows live project data, real-time, and an honest empty state when
 * the site has no issues for the query.
 */
export default function JiraIssuesCard({ refreshTick = 0 }: { refreshTick?: number }) {
  const [live, setLive] = useState<LiveState>({ status: 'idle' });

  // Generation guard (same pattern as useBriefingState): @forge/bridge
  // invoke() has no abort, so a stale response is discarded instead.
  // Without this, StrictMode's double-mount and a refresh-while-loading
  // could resolve out of order — the list would show an older fetch's
  // rows (and statuses) over a newer one.
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

  const loadLive = async () => {
    const generation = generations.next();
    setLive({ status: 'loading' });
    const result = await fetchLiveJiraIssues(LIVE_FETCH_LIMITS.cards.jira);
    if (!generations.isCurrent(generation)) return; // superseded — ignore
    setLive(
      result.ok
        ? { status: 'ready', issues: result.issues, fetchedAt: new Date().toISOString() }
        : { status: 'error', error: result.error },
    );
  };

  useEffect(() => {
    void loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  return (
    <Card
      title="Jira issues"
      subtitle="Live data from your Jira site via the Forge backend (read-only)"
      action={<span className="pill healthy">LIVE</span>}
    >
      {live.status === 'loading' && (
        <p role="status" style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.88rem' }}>
          Loading Jira issues via the Forge backend…
        </p>
      )}

      {live.status === 'error' && (
        <div>
          <div className="note-box">
            <span
              className={`pill ${
                live.error.kind === 'PERMISSION_DENIED'
                  ? 'critical'
                  : live.error.kind === 'RATE_LIMITED'
                  ? 'high'
                  : 'pending'
              }`}
            >
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
            <button className="btn btn-filled" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {live.status === 'ready' && live.issues.length === 0 && (
        <div>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.88rem' }}>
            No Jira issues found for the default query (recently updated, newest first).
          </p>
          <div className="row-actions">
            <button className="btn" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {live.status === 'ready' && live.issues.length > 0 && (
        <>
          <div style={{ marginBottom: 10 }}>
            <span className="pill healthy">LIVE</span>
            <span className="row-meta" style={{ marginLeft: 8 }}>
              {live.issues.length} issue{live.issues.length === 1 ? '' : 's'} · read-only · fetched at{' '}
              {new Date(live.fetchedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <div className="row-list">
            {live.issues.map((issue) => (
              <LiveIssueRow key={issue.key} issue={issue} />
            ))}
          </div>
          <div className="row-actions">
            <button className="btn" onClick={() => void loadLive()}>
              <RefreshCw size={14} /> <span>Refresh</span>
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
