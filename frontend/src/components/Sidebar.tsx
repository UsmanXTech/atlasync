import { BarChart3, Bot, FolderKanban, LayoutDashboard, Plug, Settings, Sparkles, X, Zap } from 'lucide-react';

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
}

/**
 * Material Design 3 Navigation Drawer (Specification #4)
 * - 224px desktop drawer, resting at surface-container-low
 * - 64dp brand header with Title Large "Atlasync", subtitle "Jira Sync Engine", and '26 badge
 * - 56dp full stadium active pill items, 24dp icons, Label Large typography
 * - Pinned live sync status footer in code-md (JetBrains Mono)
 */
export default function Sidebar({ view, onNavigate, open, onClose }: SidebarProps) {
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

        <div className="drawer-section-label">Platform Navigation</div>

        <nav className="nav" aria-label="Platform destinations">
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
            <span>Jira Live: Synced 14:32 · v2.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
