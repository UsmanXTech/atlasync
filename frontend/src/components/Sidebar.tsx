import { BarChart3, Bot, FolderKanban, LayoutDashboard, Plug, Settings, Sparkles, X, Zap } from 'lucide-react';
import { APP_VERSION } from '../utils/appInfo';
import { formatSyncTime } from '../utils/lastSync';

export type ViewId =
  | 'overview'
  | 'intelligence'
  | 'projects'
  | 'integrations'
  | 'agents'
  | 'insights'
  | 'settings';

const ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'agents', label: 'AI Agents', icon: Bot },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  open: boolean;
  onClose: () => void;
  // Fix #10: the section label tracks the active workspace instead of
  // a stuck literal — the old "Platform Navigation" never changed when
  // the workspace did (the default workspace is Atlasync HQ).
  workspaceName: string;
  // Fix #8: ISO timestamp of the last successful live fetch (the
  // briefing load), or null while nothing has synced yet.
  lastSyncedAt: string | null;
}

/**
 * Material Design 3 Navigation Drawer (Specification #4)
 * - 224px desktop drawer, resting at surface-container-low
 * - 64dp brand header with Title Large "Atlasync", subtitle "Jira Sync Engine", and '26 badge
 * - 56dp full stadium active pill items, 24dp icons, Label Large typography
 * - Pinned live sync status footer in code-md (JetBrains Mono)
 */
export default function Sidebar({ view, onNavigate, open, onClose, workspaceName, lastSyncedAt }: SidebarProps) {
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-main">
            <span className="brand-mark">
              <Zap size={20} />
            </span>
            <div className="brand-name">
              <span>Atlasync</span>
              <small>JIRA SYNC ENGINE</small>
            </div>
          </div>
          <span className="sidebar-badge-26" aria-label="Version '26">
            &apos;26
          </span>
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-section-label">{workspaceName} Navigation</div>

        <nav className="nav" aria-label={`${workspaceName} destinations`}>
          {ITEMS.map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
              >
                <item.icon size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-foot-meta">
            <i aria-hidden="true" />
            <span>
              {lastSyncedAt
                ? `Jira Live: Synced ${formatSyncTime(lastSyncedAt)} · ${APP_VERSION}`
                : `Jira Live: Not synced yet · ${APP_VERSION}`}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
