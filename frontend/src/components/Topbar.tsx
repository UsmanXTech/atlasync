import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
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
import { LIVE_FETCH_LIMITS } from '../utils/liveSnapshot';
import { LiveSearchLoader, type LiveSearchSnapshot, type LiveSourceFetchers, type LiveSourceKey } from '../utils/liveSearch';
import { DATA_MODE_LABELS, type DataMode } from '../utils/dataMode';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { openRecordUrl, recordUrl, type SearchRecordIdentity } from '../utils/recordLinks';

export type ForgeMode = 'loading' | 'forge' | 'standalone';

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  detail: string;
  source: 'live' | 'demo';
  view: ViewId;
  // Live results carry the record's identity so a click can open the
  // ORIGINAL record (router.open) instead of just navigating to a view.
  // Demo results have no record and keep navigating to their view.
  record?: SearchRecordIdentity;
}

interface TopbarProps {
  workspaces: Workspace[];
  workspace: Workspace;
  onWorkspace: (id: string) => void;
  onNavigate: (view: ViewId) => void;
  forgeMode: ForgeMode;
  dataMode: DataMode;
  onDataMode: (mode: DataMode) => void;
  onMenu: () => void;
  // Fix #9: fired after a Sync Portfolio run with whether every
  // source refreshed cleanly. App bumps its refresh counter (cards +
  // readiness + briefing reload) and stamps lastSyncedAt on success.
  onSync?: (ok: boolean) => void;
}

const KIND_ICONS: Record<string, typeof CircleDot> = {
  Project: FolderKanban,
  Issue: CircleDot,
  PR: GitPullRequest,
  Doc: FileText,
  Incident: AlertTriangle,
  Request: LifeBuoy,
};

const LIVE_SOURCE_LABELS: Record<LiveSourceKey, string> = {
  issues: 'Jira',
  pages: 'Confluence',
  requests: 'JSM',
};

// One fetcher per live source, normalized to the loader's { ok, data }
// shape. A source that fails returns { ok: false } instead of throwing,
// so the loader can record the failure per source.
function liveSourceFetchers(): LiveSourceFetchers {
  return {
    issues: async () => {
      const result = await fetchLiveJiraIssues(LIVE_FETCH_LIMITS.search.jira);
      return result.ok ? { ok: true as const, data: result.issues } : { ok: false as const };
    },
    pages: async () => {
      const result = await fetchConfluencePages(LIVE_FETCH_LIMITS.search.confluence);
      return result.ok ? { ok: true as const, data: result.pages } : { ok: false as const };
    },
    requests: async () => {
      const result = await fetchJsmRequests(LIVE_FETCH_LIMITS.search.jsm);
      return result.ok ? { ok: true as const, data: result.requests } : { ok: false as const };
    },
  };
}

/**
 * Material Design 3 Small Top App Bar (Specification #5 & #11)
 * - Exactly 64dp tall, surface-container (#f3ebf7), no shadow
 * - Contained 56dp search bar with ⌘K keycap
 * - Bell icon button with 16dp badge
 * - Exactly ONE filled primary button (SYNC PORTFOLIO, 40dp, pill)
 * - 30dp circular user avatar
 */
export default function Topbar({ workspaces, workspace, onWorkspace, onNavigate, forgeMode, dataMode, onDataMode, onMenu, onSync }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notes, setNotes] = useState(NOTIFICATIONS);
  const [syncing, setSyncing] = useState(false);
  const siteUrl = useSiteUrl();
  // Fix #9: small success/failure notice for the Sync Portfolio run.
  // No toast system exists in the app, so this is a plain status line
  // next to the button; it clears when the next sync starts.
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Live search cache and loader
  const [liveIssues, setLiveIssues] = useState<LiveIssue[]>([]);
  const [livePages, setLivePages] = useState<LiveConfluencePage[]>([]);
  const [liveRequests, setLiveRequests] = useState<LiveJsmRequest[]>([]);
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'ready' | 'partial' | 'error'>('idle');
  const [liveFailed, setLiveFailed] = useState<LiveSourceKey[]>([]);
  const [liveRetrying, setLiveRetrying] = useState<LiveSourceKey[]>([]);

  const liveLoaderRef = useRef<LiveSearchLoader | null>(null);
  if (liveLoaderRef.current === null) {
    liveLoaderRef.current = new LiveSearchLoader();
  }

  const applyLiveSnapshot = useCallback((snapshot: LiveSearchSnapshot) => {
    setLiveIssues(snapshot.sources.issues);
    setLivePages(snapshot.sources.pages);
    setLiveRequests(snapshot.sources.requests);
    setLiveFailed(snapshot.failed);
    const loadedCount =
      snapshot.sources.issues.length + snapshot.sources.pages.length + snapshot.sources.requests.length;
    if (snapshot.failed.length === 0) setLiveState('ready');
    else if (loadedCount === 0) setLiveState('error');
    else setLiveState('partial');
  }, []);

  const startLiveFetch = useCallback(() => {
    const loader = liveLoaderRef.current;
    if (!loader || loader.isFetching) return;
    setLiveState('loading');
    loader.ensure(liveSourceFetchers()).then(applyLiveSnapshot);
  }, [applyLiveSnapshot]);

  const retryLiveSource = useCallback(
    (key: LiveSourceKey) => {
      const loader = liveLoaderRef.current;
      if (!loader || loader.isFetching) return;
      setLiveRetrying((prev) => [...prev, key]);
      loader.ensure(liveSourceFetchers()).then((snapshot) => {
        applyLiveSnapshot(snapshot);
        setLiveRetrying((prev) => prev.filter((k) => k !== key));
      });
    },
    [applyLiveSnapshot],
  );

  useEffect(() => {
    if (forgeMode !== 'forge' || query.trim().length < 2) return;
    startLiveFetch();
  }, [query, forgeMode, startLiveFetch]);

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

  const liveResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || (liveState !== 'ready' && liveState !== 'partial')) return [];
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
          record: { kind: 'issue', key: issue.key },
        });
      }
    }
    for (const page of livePages) {
      if (page.title.toLowerCase().includes(q)) {
        out.push({ id: `live-page-${page.id}`, kind: 'Doc', title: page.title, detail: `Confluence · ${page.status}`, source: 'live', view: 'overview', record: { kind: 'page', id: page.id, spaceId: page.spaceId, webui: page.webui } });
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
          record: { kind: 'request', key: request.key },
        });
      }
    }
    return out.slice(0, 8);
  }, [query, liveState, liveIssues, livePages, liveRequests]);

  const activityHits = useMemo(
    () => ACTIVITY.filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase())).length,
    [query],
  );

  // Fix #9: the old handler fired startLiveFetch() (ensure — a no-op
  // once loaded) and cleared the spinner on a fixed 900ms timer, so
  // Sync did zero network traffic and reported success regardless.
  // The spinner is now tied to the refresh() promise, and the notice
  // reports what actually happened per source.
  const handleSyncPortfolio = async () => {
    const loader = liveLoaderRef.current;
    if (!loader || syncing) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const snapshot = await loader.refresh(liveSourceFetchers());
      applyLiveSnapshot(snapshot);
      if (snapshot.failed.length === 0) {
        setSyncNotice('Portfolio synced — all sources up to date.');
      } else {
        const names = snapshot.failed.map((key) => LIVE_SOURCE_LABELS[key]).join(', ');
        setSyncNotice(`Synced with failures: ${names} could not be reached.`);
      }
      onSync?.(snapshot.failed.length === 0);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <label className="workspace-select" title="Demo data grouping — does not scope live Jira, Confluence or JSM data.">
        <span>Workspace</span>
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
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => window.setTimeout(() => setSearchFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search issues, agents, pull requests…"
          aria-label="Global search"
        />
        <span className="search-shortcut">⌘K</span>
        {searchFocus && query.trim().length >= 2 && (
          <div className="search-drop">
            {forgeMode === 'forge' && (
              <>
                <p className="drop-section">Live</p>
                <p className="drop-note">
                  Recent records only — 25 Jira issues · 20 Confluence pages · 20 JSM requests.
                </p>
                {liveState === 'loading' && <p className="drop-empty">Searching live sources…</p>}
                {liveState === 'error' && (
                  <p className="drop-empty">
                    Live search unavailable right now.{' '}
                    <button className="link-btn" onClick={startLiveFetch}>
                      Retry
                    </button>
                  </p>
                )}
                {liveState === 'partial' &&
                  liveFailed.map((key) => (
                    <p key={key} className="drop-empty">
                      {LIVE_SOURCE_LABELS[key]} search failed.{' '}
                      {liveRetrying.includes(key) ? (
                        'Retrying…'
                      ) : (
                        <button className="link-btn" onClick={() => retryLiveSource(key)}>
                          Retry {LIVE_SOURCE_LABELS[key]}
                        </button>
                      )}
                    </p>
                  ))}
                {(liveState === 'ready' || liveState === 'partial') && liveResults.length === 0 && (
                  <p className="drop-empty">
                    {liveState === 'partial'
                      ? 'No live matches in the sources that loaded.'
                      : 'No live matches.'}
                  </p>
                )}
                {liveResults.map((r) => {
                  const Icon = KIND_ICONS[r.kind] ?? CircleDot;
                  return (
                    <button
                      key={r.id}
                      className="drop-row"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        // Live results open the ORIGINAL record; only
                        // fall back to navigating to the view when no
                        // record URL can be built (site URL unknown).
                        const url = r.record ? recordUrl(siteUrl, r.record) : null;
                        if (url) void openRecordUrl(url);
                        else onNavigate(r.view);
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
        {/* v2.1.0 data-mode toggle: the old status pill ("Preview mode" /
            "Forge connected") is now the explicit Sample Dataset vs Live
            Workspace switch. The dot still signals Forge connectivity
            (green = installed, amber = preview); the label is the mode.
            While connecting, the pill is not interactive yet. */}
        {forgeMode === 'loading' ? (
          <span className={`forge-badge ${forgeMode}`}>
            <i />
            Connecting…
          </span>
        ) : (
          <button
            type="button"
            className={`forge-badge ${forgeMode} mode-toggle`}
            onClick={() => onDataMode(dataMode === 'sample' ? 'live' : 'sample')}
            aria-pressed={dataMode === 'live'}
            title={
              dataMode === 'sample'
                ? 'Sample Dataset — showing demo data. Click to switch to Live Workspace.'
                : 'Live Workspace — showing live Atlassian data. Click to switch to Sample Dataset.'
            }
          >
            <i />
            {DATA_MODE_LABELS[dataMode]}
          </button>
        )}

        <div className="menu-wrap">
          <button
            className="icon-btn bell"
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={18} />
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
              <p className="drop-note">Sample notifications — read state is local only.</p>
              {notes.map((n) => (
                <div key={n.id} className={`notif-row ${n.unread ? 'unread' : ''}`}>
                  <strong>{n.title}</strong>
                  <small>{n.detail}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* M3 Primary Top App Bar Action — Exactly ONE 40dp filled pill button */}
        <button
          className="btn btn-filled"
          onClick={handleSyncPortfolio}
          disabled={syncing}
          aria-label="Sync portfolio"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          <span>SYNC PORTFOLIO</span>
        </button>
        {syncNotice && (
          <span className="sync-notice" role="status">
            {syncNotice}
          </span>
        )}

        <div className="menu-wrap">
          <button
            className="profile-btn"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            aria-label="User profile"
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
