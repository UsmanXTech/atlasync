import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  FolderKanban,
  GitPullRequest,
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
import type { Workspace } from '../data/types';

export type ForgeMode = 'loading' | 'forge' | 'standalone';

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  detail: string;
}

interface TopbarProps {
  workspaces: Workspace[];
  workspace: Workspace;
  onWorkspace: (id: string) => void;
  forgeMode: ForgeMode;
  onMenu: () => void;
}

const KIND_ICONS: Record<string, typeof CircleDot> = {
  Project: FolderKanban,
  Issue: CircleDot,
  PR: GitPullRequest,
  Doc: FileText,
  Incident: AlertTriangle,
};

export default function Topbar({ workspaces, workspace, onWorkspace, forgeMode, onMenu }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notes, setNotes] = useState(NOTIFICATIONS);

  const unread = notes.filter((n) => n.unread).length;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchResult[] = [];
    for (const p of PROJECTS) {
      if (`${p.key} ${p.name}`.toLowerCase().includes(q)) {
        out.push({ id: p.id, kind: 'Project', title: `${p.key} · ${p.name}`, detail: `Owner: ${p.owner}` });
      }
    }
    for (const b of BLOCKERS) {
      if (`${b.key} ${b.title}`.toLowerCase().includes(q)) {
        out.push({ id: b.id, kind: 'Issue', title: `${b.key} · ${b.title}`, detail: `Severity: ${b.severity}` });
      }
    }
    for (const pr of PULL_REQUESTS) {
      if (`${pr.title} ${pr.repo}`.toLowerCase().includes(q)) {
        out.push({ id: pr.id, kind: 'PR', title: pr.title, detail: `${pr.repo} · ${pr.author}` });
      }
    }
    for (const d of DOCS) {
      if (d.title.toLowerCase().includes(q)) {
        out.push({ id: d.id, kind: 'Doc', title: d.title, detail: `${d.space} · ${d.editor}` });
      }
    }
    for (const inc of INCIDENTS) {
      if (inc.title.toLowerCase().includes(q)) {
        out.push({ id: inc.id, kind: 'Incident', title: inc.title, detail: `${inc.service} · ${inc.severity}` });
      }
    }
    return out.slice(0, 8);
  }, [query]);

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

      <label className="workspace-select">
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
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => window.setTimeout(() => setSearchFocus(false), 150)}
          placeholder="Search issues, PRs, docs, incidents…"
          aria-label="Global search"
        />
        {searchFocus && query.trim().length >= 2 && (
          <div className="search-drop">
            {results.length === 0 ? (
              <p className="drop-empty">
                No matches. {activityHits > 0 ? `${activityHits} activity item(s) mention this.` : ''}
              </p>
            ) : (
              results.map((r) => {
                const Icon = KIND_ICONS[r.kind] ?? CircleDot;
                return (
                  <button key={r.id} className="drop-row" onMouseDown={(e) => e.preventDefault()}>
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
