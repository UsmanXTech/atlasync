import { Save, RotateCcw, ShieldCheck, Info } from 'lucide-react';
import Card from '../components/Card';
import Switch from '../components/Switch';
import { SETTINGS_ROWS } from '../utils/settingsState';
import { APP_INFO_ROWS, APP_DEPLOY_NOTE } from '../utils/appInfo';
import type { SettingsState } from '../hooks/useSettingsState';

/**
 * Screen 7: Settings (Workspace Governance & Configuration)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Settings({ settings }: { settings: SettingsState }) {
  const { name, timezone, toggles, saved, backend, saveError, setName, setTimezone, flip, save, reset } = settings;
  const connected = backend === 'connected';

  return (
    <div className="view workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / CONFIGURATION</div>
          <h2>Settings</h2>
          <p>Workspace profile and preview preferences.</p>
        </div>
        <span className="preview-label">
          {backend === 'loading' ? 'CHECKING BACKEND…' : connected ? 'SYNCED TO FORGE' : 'PREVIEW CONTROLS'}
        </span>
      </div>

      <div className="settings-layout">
        <Card
          title="Workspace profile"
          subtitle="Session-only — the name and timezone reset on reload"
        >
          <div className="settings-form">
            <div className="field">
              <label htmlFor="ws-name">Workspace name</label>
              <input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ws-tz">Timezone</label>
              <select id="ws-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (ET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <div className="settings-actions">
              <button className="btn btn-filled" onClick={save} aria-label="Save preview">
                <Save size={15} /> <span>Save preview</span>
              </button>
              <button className="btn" onClick={reset} aria-label="Reset preferences">
                <RotateCcw size={15} /> <span>Reset</span>
              </button>
            </div>
            {saved && (
              <span className="saved-note">
                {connected
                  ? 'Saved to the Forge backend — only the toggles below are stored; the workspace name and timezone are session-only and reset on reload.'
                  : 'Saved in this page session only; no backend preferences are changed.'}
              </span>
            )}
            {saveError && (
              <span className="saved-note" role="alert" style={{ color: 'var(--md-sys-color-blocked-on-container)' }}>
                {saveError}
              </span>
            )}
          </div>
        </Card>

        <Card
          title="Notifications & sync"
          subtitle={connected ? 'Stored in the Forge backend' : 'Interactive preview preferences'}
        >
          <div className="settings-list">
            {SETTINGS_ROWS.map(({ key, title, detail, effect }) => (
              <div className="setting-row" key={key}>
                <div>
                  <strong>{title}</strong>
                  <small>{connected && effect ? effect : detail}</small>
                </div>
                <Switch
                  checked={toggles[key]}
                  onChange={() => flip(key)}
                  ariaLabel={`Toggle ${title}`}
                />
              </div>
            ))}
          </div>
          {!connected && backend !== 'loading' && (
            <p className="source-empty" style={{ margin: '12px 0 0' }}>
              The Forge backend is not reachable in this preview, so these toggles are preview-only.
            </p>
          )}
        </Card>

        <Card
          title="About Atlasync"
          subtitle="App, deployment and data split — the facts behind this install"
          className="span-full"
        >
          <div className="about-grid">
            {APP_INFO_ROWS.map(({ label, value }) => (
              <div className="about-row" key={label}>
                <span>{label}</span>
                <p>{value}</p>
              </div>
            ))}
          </div>
          <p className="about-note">
            <Info size={14} /> <span>{APP_DEPLOY_NOTE}</span>
          </p>
        </Card>
      </div>

      <div className="settings-notice">
        <ShieldCheck size={18} />
        <span>
          {connected
            ? 'Daily snapshots are paused while the snapshot identity model is redesigned; the Daily sync toggle is kept for that redesign and currently stores nothing.'
            : 'No automatic sync, alerts or email jobs are enabled by changing them.'}
        </span>
      </div>
    </div>
  );
}
