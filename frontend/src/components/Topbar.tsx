import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  FolderKanban,
  GitPullRequest,
  LifeBuoy,
  Menu,
  Search,
} from 'lucide-react';
import {
  ACTIVITY,
  BLOCKERS,
  DOCS,
  INCIDENTS,
  NOTIFICATIONS,
  PROJECTS,
  PULL_REQUESTS,
} from '../data/mock';
import type { LiveConfluencePage, LiveIssue, LiveJsmRequest, Workspace } from '../data/types';
import type { ViewId } from './Sidebar';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';

export type ForgeMode = 'loading' | 'forge' | 'standalone';

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  detail: string;
  source: 'live' | 'demo';
  view: ViewId;
}

interface TopbarProps {
  workspaces: Workspace[];
  workspace: Workspace;
  onWorkspace: (id: string) => void;
  onNavigate: (view: ViewId) => void;
  forgeMode: ForgeMode;
  onMenu: () => void;
}

const KIND_ICONS: Record<string, typeof CircleDot> = {
  Project: FolderKanban,
  Issue: CircleDot,
  PR: GitPullRequest,
  Doc: FileText,
  Incident: AlertTriangle,
  Request: LifeBuoy,
};

export default function Topbar({ workspaces, workspace, onWorkspace, onNavigate, forgeMode, onMenu }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notes, setNotes] = useState(NOTIFICATIONS);

  // Live search: inside a Forge install the three live sources are fetched
  // once (on the first real query) and cached for the session; every later
  // query filters the cache. In the standalone preview there is no Forge
  // backend, so live search stays off and only labelled demo results show.
  const [liveIssues, setLiveIssues] = useState<LiveIssue[]>([]);
  const [livePages, setLivePages] = useState<LiveConfluencePage[]>([]);
  const [liveRequests, setLiveRequests] = useState<LiveJsmRequest[]>([]);
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const q = query.trim();
    if (forgeMode !== 'forge' || q.length < 2 || liveState !== 'idle') return;
    let cancelled = false;
    setLiveState('loading');
    void (async () => {
      const [issues, pages, requests] = await Promise.all([
        fetchLiveJiraIssues(25),
        fetchConfluencePages(20),
        fetchJsmRequests(20),
      ]);
      if (cancelled) return;
      if (!issues.ok && !pages.ok && !requests.ok) {
        setLiveState('error');
        return;
      }
      if (issues.ok) setLiveIssues(issues.issues);
      if (pages.ok) setLivePages(pages.pages);
      if (requests.ok) setLiveRequests(requests.requests);
      setLiveState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [query, forgeMode, liveState]);

  // Escape closes any open dropdown — keyboard users are never trapped.
  useEffect(() => {
    if (!notifOpen && !profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notifOpen, profileOpen]);

  const unread = notes.filter((n) => n.unread).length;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchResult[] = [];
    for (const p of PROJECTS) {
      if (`${p.key} ${p.name}`.toLowerCase().includes(q)) {
        out.push({ id: p.id, kind: 'Project', title: `${p.key} · ${p.name}`, detail: `Owner: ${p.owner}`, source: 'demo', view: 'projects' });
      }
    }
    for (const b of BLOCKERS) {
      if (`${b.key} ${b.title}`.toLowerCase().includes(q)) {
        out.push({ id: b.id, kind: 'Issue', title: `${b.key} · ${b.title}`, detail: `Severity: ${b.severity}`, source: 'demo', view: 'overview' });
      }
    }
    for (const pr of PULL_REQUESTS) {
      if (`${pr.title} ${pr.repo}`.toLowerCase().includes(q)) {
        out.push({ id: pr.id, kind: 'PR', title: pr.title, detail: `${pr.repo} · ${pr.author}`, source: 'demo', view: 'overview' });
      }
    }
    for (const d of DOCS) {
      if (d.title.toLowerCase().includes(q)) {
        out.push({ id: d.id, kind: 'Doc', title: d.title, detail: `${d.space} · ${d.editor}`, source: 'demo', view: 'overview' });
      }
    }
    for (const inc of INCIDENTS) {
      if (inc.title.toLowerCase().includes(q)) {
        out.push({ id: inc.id, kind: 'Incident', title: inc.title, detail: `${inc.service} · ${inc.severity}`, source: 'demo', view: 'overview' });
      }
    }
    return out.slice(0, 8);
  }, [query]);

  // Live results filter the cached live sources; they are always shown
  // under their own "Live" heading, never mixed into demo rows.
  const liveResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || liveState !== 'ready') return [];
    const out: SearchResult[] = [];
    for (const issue of liveIssues) {
      if (`${issue.key} ${issue.summary}`.toLowerCase().includes(q)) {
        out.push({
          id: `live-issue-${issue.key}`,
          kind: 'Issue',
          title: `${issue.key} · ${issue.summary}`,
          detail: `${issue.status}${issue.priority ? ` · ${issue.priority}` : ''}`,
          source: 'live',
          view: 'overview',
        });
      }
    }
    for (const page of livePages) {
      if (page.title.toLowerCase().includes(q)) {
        out.push({ id: `live-page-${page.id}`, kind: 'Doc', title: page.title, detail: `Confluence · ${page.status}`, source: 'live', view: 'overview' });
      }
    }
    for (const request of liveRequests) {
      if (`${request.key} ${request.summary}`.toLowerCase().includes(q)) {
        out.push({
          id: `live-jsm-${request.key}`,
          kind: 'Request',
          title: `${request.key} · ${request.summary}`,
          detail: `${request.requestType} · ${request.status}`,
          source: 'live',
          view: 'overview',
        });
      }
    }
    return out.slice(0, 8);
  }, [query, liveState, liveIssues, livePages, liveRequests]);

  // Recent activity is searchable context too — kept in the dropdown footer.
  const activityHits = useMemo(
    () => ACTIVITY.filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase())).length,
    [query],
  );

  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <label className="workspace-select" title="Demo data grouping — does not scope live Jira, Confluence or JSM data.">
        <span>Demo workspace</span>
        <span className="select-wrap">
          <select
            value={workspace.id}
            onChange={(e) => onWorkspace(e.target.value)}
            aria-label="Workspace selector"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </span>
      </label>

      <div className="search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => window.setTimeout(() => setSearchFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search issues, PRs, docs, incidents…"
          aria-label="Global search"
        />
        {searchFocus && query.trim().length >= 2 && (
          <div className="search-drop">
            {forgeMode === 'forge' && (
              <>
                <p className="drop-section">Live</p>
                {liveState === 'loading' && <p className="drop-empty">Searching live sources…</p>}
                {liveState === 'error' && (
                  <p className="drop-empty">
                    Live search unavailable right now.{' '}
                    <button className="link-btn" onClick={() => setLiveState('idle')}>
                      Retry
                    </button>
                  </p>
                )}
                {liveState === 'ready' && liveResults.length === 0 && <p className="drop-empty">No live matches.</p>}
                {liveResults.map((r) => {
                  const Icon = KIND_ICONS[r.kind] ?? CircleDot;
                  return (
                    <button
                      key={r.id}
                      className="drop-row"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onNavigate(r.view);
                        setQuery('');
                      }}
                    >
                      <Icon size={15} />
                      <span>
                        <strong>{r.title}</strong>
                        <small>{r.detail}</small>
                      </span>
                      <em>{r.kind}</em>
                    </button>
                  );
                })}
              </>
            )}
            <p className="drop-section">Demo</p>
            {results.length === 0 ? (
              <p className="drop-empty">
                No demo matches. {activityHits > 0 ? `${activityHits} activity item(s) mention this.` : ''}
              </p>
            ) : (
              results.map((r) => {
                const Icon = KIND_ICONS[r.kind] ?? CircleDot;
                // Search results navigate to the view that shows the item —
                // a result row must never be a dead click.
                return (
                  <button
                    key={r.id}
                    className="drop-row"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onNavigate(r.view);
                      setQuery('');
                    }}
                  >
                    <Icon size={15} />
                    <span>
                      <strong>{r.title}</strong>
                      <small>{r.detail}</small>
                    </span>
                    <em>{r.kind}</em>
                  </button>
                );
              })
            )}
            {forgeMode !== 'forge' && <p className="drop-note">Live results appear when installed in Forge.</p>}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <span className={`forge-badge ${forgeMode}`}>
          <i />
          {forgeMode === 'forge' ? 'Forge connected' : forgeMode === 'loading' ? 'Connecting…' : 'Preview mode'}
        </span>

        <div className="menu-wrap">
          <button
            className="icon-btn bell"
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={19} />
            {unread > 0 && <span className="bell-count">{unread}</span>}
          </button>
          {notifOpen && (
            <div className="drop-panel notif-panel">
              <div className="drop-head">
                <strong>Notifications</strong>
                <button onClick={() => setNotes(notes.map((n) => ({ ...n, unread: false })))}>
                  <Check size={14} /> Mark all read
                </button>
              </div>
              {notes.map((n) => (
                <div key={n.id} className={`notif-row ${n.unread ? 'unread' : ''}`}>
                  <strong>{n.title}</strong>
                  <small>{n.detail}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="menu-wrap">
          <button
            className="profile-btn"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
          >
            <span className="avatar">UH</span>
            <span className="profile-name">
              Usman Hassan
              <small>Workspace admin</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {profileOpen && (
            <div className="drop-panel profile-panel">
              <strong>Usman Hassan</strong>
              <small>Workspace admin · {workspace.plan}</small>
              <p>Preview account — sample data only.</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
