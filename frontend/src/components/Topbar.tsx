import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CircleDot, FileText, LifeBuoy, Menu, RefreshCw, Search } from 'lucide-react';
import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';
import type { ViewId } from './Sidebar';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
import { LIVE_FETCH_LIMITS } from '../utils/liveSnapshot';
import { LiveSearchLoader, type LiveSearchSnapshot, type LiveSourceFetchers, type LiveSourceKey } from '../utils/liveSearch';
import { useSiteUrl } from '../hooks/useSiteUrl';
import { openRecordUrl, recordUrl, type SearchRecordIdentity } from '../utils/recordLinks';

export type ForgeMode = 'loading' | 'forge' | 'standalone';

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  detail: string;
  source: 'live';
  view: ViewId;
  // Live results carry the record's identity so a click can open the
  // ORIGINAL record (router.open) instead of just navigating to a view.
  // Demo results have no record and keep navigating to their view.
  record?: SearchRecordIdentity;
}

interface TopbarProps {
  onNavigate: (view: ViewId) => void;
  forgeMode: ForgeMode;
  onMenu: () => void;
  // Fix #9: fired after a Sync Portfolio run with whether every
  // source refreshed cleanly. App bumps its refresh counter (cards +
  // readiness + briefing reload) and stamps lastSyncedAt on success.
  onSync?: (ok: boolean) => void;
}

// Live search results only ever carry these three kinds now that
// the demo results (Project / PR / Incident) are deleted.
const KIND_ICONS: Record<string, typeof CircleDot> = {
  Issue: CircleDot,
  Doc: FileText,
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
 * - Exactly ONE filled primary button (SYNC PORTFOLIO, 40dp, pill)
 * - 30dp circular user avatar
 */
export default function Topbar({ onNavigate, forgeMode, onMenu, onSync }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileOpen]);

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
          placeholder="Search issues, pages, requests…"
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
            {forgeMode !== 'forge' && <p className="drop-note">Live results appear when installed in Forge.</p>}
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Connectivity badge only — the Sample Dataset / Live
            Workspace toggle was deleted with the demo data. The dot
            signals Forge connectivity (green = installed, amber =
            preview); the label is the connection state. */}
        <span className={`forge-badge ${forgeMode}`}>
          <i />
          {forgeMode === 'loading' ? 'Connecting…' : forgeMode === 'forge' ? 'Forge connected' : 'Preview'}
        </span>

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
              <small>Workspace admin</small>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
