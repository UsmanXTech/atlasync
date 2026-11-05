import { useEffect, useState } from 'react';
import Sidebar, { type ViewId } from './components/Sidebar';
import Topbar, { type ForgeMode } from './components/Topbar';
import Overview from './views/Overview';
import Intelligence from './views/Intelligence';
import Projects from './views/Projects';
import Integrations from './views/Integrations';
import Agents from './views/Agents';
import Insights from './views/Insights';
import Settings from './views/Settings';
import { WORKSPACES } from './data/mock';

// Atlasync dashboard shell. Navigation, workspace, and Forge-connection
// state live here; each view renders from the mock data layer.
// Inside a Forge iframe the bridge connects (status badge in the topbar);
// outside Forge the same build renders in preview mode with mock data.
export default function App() {
  const [view, setView] = useState<ViewId>('overview');
  const [workspaceId, setWorkspaceId] = useState('hq');
  const [forgeMode, setForgeMode] = useState<ForgeMode>('loading');
  const [menuOpen, setMenuOpen] = useState(false);

  const workspace = WORKSPACES.find((w) => w.id === workspaceId) ?? WORKSPACES[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import: @forge/bridge only works inside a Forge iframe.
        // A static import would break the app outside Forge.
        const { invoke } = await import('@forge/bridge');
        await invoke('getStatus');
        if (!cancelled) setForgeMode('forge');
      } catch {
        if (!cancelled) setForgeMode('standalone');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <Topbar
          workspaces={WORKSPACES}
          workspace={workspace}
          onWorkspace={setWorkspaceId}
          forgeMode={forgeMode}
          onMenu={() => setMenuOpen(true)}
        />
        {view === 'overview' && <Overview workspaceId={workspace.id} onNavigate={setView} />}
        {view === 'intelligence' && <Intelligence />}
        {view === 'projects' && <Projects workspaceId={workspace.id} />}
        {view === 'integrations' && <Integrations />}
        {view === 'agents' && <Agents />}
        {view === 'insights' && <Insights />}
        {view === 'settings' && <Settings workspace={workspace} />}
      </div>
    </div>
  );
}
