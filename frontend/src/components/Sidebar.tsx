import {
  BarChart3,
  Bot,
  FolderKanban,
  LayoutDashboard,
  Plug,
  Settings,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

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

export default function Sidebar({ view, onNavigate, open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Zap size={18} />
          </span>
          <span className="brand-name">
            Atlasync
            <small>ENTERPRISE</small>
          </span>
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="nav">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="mock-badge">LIVE + DEMO</span>
          <p>Live source views are separated from clearly labeled preview metrics.</p>
        </div>
      </aside>
    </>
  );
}
