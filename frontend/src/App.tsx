import { useEffect, useRef, useState } from 'react';
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
import { useBriefingState } from './hooks/useBriefingState';
import { useSettingsState } from './hooks/useSettingsState';
import { defaultDataMode, type DataMode } from './utils/dataMode';

// Atlasync application shell: persistent navigation and a viewport-fitted content region.
// Live views retain their own loading, empty, and error states.
export default function App() {
  const [view, setView] = useState<ViewId>(DEFAULT_VIEW);
  const [workspaceId, setWorkspaceId] = useState('hq');
  const [forgeMode, setForgeMode] = useState<ForgeMode>('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  // v2.1.0 data mode: Sample Dataset vs Live Workspace. The default
  // follows the install state (Live inside Forge, Sample in the
  // standalone preview) until the user picks explicitly via the
  // top-bar toggle; the choice then sticks for the session.
  const [dataMode, setDataMode] = useState<DataMode>('sample');
  const modeChosenRef = useRef(false);
  useEffect(() => {
    if (forgeMode === 'forge' && !modeChosenRef.current) {
      setDataMode(defaultDataMode(forgeMode));
    }
  }, [forgeMode]);
  const handleDataMode = (mode: DataMode) => {
    modeChosenRef.current = true;
    setDataMode(mode);
  };
  // Lives above the view switch: the Intelligence answer must survive
  // navigating away and back (the view unmounts on switch).
  const intelligence = useIntelligenceConversation();

  // Fix #13: ONE shared ask path. Every button that asks Intelligence
  // submits the question AND opens the view — before this, three
  // independent call sites disagreed: stat cards submitted+navigated,
  // "Ask Intelligence" / "Full briefing" navigated only, and preset
  // chips filled only. The question is passed explicitly as ask(p):
  // calling setPrompt(p) then ask() in one handler would submit the
  // STALE prompt (ask defaults to the current prompt state).
  const askInIntelligence = (question: string) => {
    void intelligence.ask(question);
    setView('intelligence');
  };

  // Same pattern as Intelligence: the briefing card's LLM summary is a
  // metered call, so it must survive navigating away and back instead
  // of being discarded (and re-paid for) on every view switch.
  const briefingSummary = useBriefingSummary();

  // Same pattern again: the Intelligence briefing digest itself must
  // survive navigating away and back. Intelligence is the default
  // view, so the card-local version re-fired three live fetches and
  // flashed its loading line on every return visit (Run 103 audit).
  const briefing = useBriefingState();

  // Fix #9: Sync Portfolio broadcast. Topbar reports each sync run
  // here; the counter is the reload trigger for the Overview's live
  // fetches (readiness + cards) and the briefing, and lastSyncedAt is
  // the sidebar footer's time — the latest successful live fetch,
  // whether from the app-start briefing load or a sync.
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  useEffect(() => {
    if (briefing.state.status === 'ready') setLastSyncedAt(briefing.state.generatedAt);
  }, [briefing.state]);
  useEffect(() => {
    if (refreshTick > 0) briefing.refresh();
    // briefing.refresh is a fresh closure each render; the tick is the
    // only intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);
  const handleSync = (ok: boolean) => {
    setRefreshTick((t) => t + 1);
    if (ok) setLastSyncedAt(new Date().toISOString());
  };

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
      <Sidebar
        view={view}
        onNavigate={setView}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        workspaceName={workspace.name}
        lastSyncedAt={lastSyncedAt}
      />
      <div className="main">
        <Topbar
          workspaces={WORKSPACES}
          workspace={workspace}
          onWorkspace={setWorkspaceId}
          onNavigate={setView}
          forgeMode={forgeMode}
          dataMode={dataMode}
          onDataMode={handleDataMode}
          onMenu={() => setMenuOpen(true)}
          onSync={handleSync}
        />
        <main id="main-content" tabIndex={-1}>
          <ErrorBoundary key={view}>
            {view === 'overview' && <Overview workspaceId={workspace.id} askInIntelligence={askInIntelligence} briefingSummary={briefingSummary} dataMode={dataMode} onDataMode={handleDataMode} refreshTick={refreshTick} />}
            {view === 'intelligence' && <Intelligence conversation={intelligence} briefing={briefing} />}
            {view === 'projects' && <Projects askInIntelligence={askInIntelligence} />}
            {view === 'integrations' && <Integrations />}
            {view === 'agents' && <Agents onNavigate={setView} conversation={intelligence} askInIntelligence={askInIntelligence} />}
            {view === 'insights' && <Insights />}
            {view === 'settings' && <Settings settings={settings} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
