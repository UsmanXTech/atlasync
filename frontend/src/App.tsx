import { useEffect, useState } from 'react';
import Sidebar, { type ViewId } from './components/Sidebar';
import Topbar, { type ForgeMode } from './components/Topbar';
import ErrorBoundary from './components/ErrorBoundary';
import Overview from './views/Overview';
import Intelligence from './views/Intelligence';
import Projects from './views/Projects';
import Integrations from './views/Integrations';
import Agents from './views/Agents';
import Insights from './views/Insights';
import Settings from './views/Settings';
import { WORKSPACES } from './data/mock';
import { DEFAULT_VIEW } from './utils/defaultView';
import { useIntelligenceConversation } from './hooks/useIntelligenceConversation';
import { useBriefingSummary } from './hooks/useBriefingSummary';
import { useSettingsState } from './hooks/useSettingsState';

// Atlasync application shell: persistent navigation and a viewport-fitted content region.
// Live views retain their own loading, empty, and error states.
export default function App() {
  const [view, setView] = useState<ViewId>(DEFAULT_VIEW);
  const [workspaceId, setWorkspaceId] = useState('hq');
  const [forgeMode, setForgeMode] = useState<ForgeMode>('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  // Lives above the view switch: the Intelligence answer must survive
  // navigating away and back (the view unmounts on switch).
  const intelligence = useIntelligenceConversation();

  // Same pattern as Intelligence: the briefing card's LLM summary is a
  // metered call, so it must survive navigating away and back instead
  // of being discarded (and re-paid for) on every view switch.
  const briefingSummary = useBriefingSummary();

  const workspace = WORKSPACES.find((w) => w.id === workspaceId) ?? WORKSPACES[0];

  // Same pattern as Intelligence: the Settings form state must survive
  // navigating away and back (the view unmounts on switch). Switching
  // demo workspace still resets it to that workspace's defaults.
  const settings = useSettingsState(workspace);

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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar view={view} onNavigate={setView} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <Topbar
          workspaces={WORKSPACES}
          workspace={workspace}
          onWorkspace={setWorkspaceId}
          onNavigate={setView}
          forgeMode={forgeMode}
          onMenu={() => setMenuOpen(true)}
        />
        <main id="main-content" tabIndex={-1}>
          <ErrorBoundary key={view}>
            {view === 'overview' && <Overview workspaceId={workspace.id} onNavigate={setView} conversation={intelligence} briefingSummary={briefingSummary} />}
            {view === 'intelligence' && <Intelligence conversation={intelligence} />}
            {view === 'projects' && <Projects onNavigate={setView} conversation={intelligence} />}
            {view === 'integrations' && <Integrations />}
            {view === 'agents' && <Agents onNavigate={setView} conversation={intelligence} />}
            {view === 'insights' && <Insights />}
            {view === 'settings' && <Settings settings={settings} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
