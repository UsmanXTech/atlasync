import { Save, RotateCcw, ShieldCheck } from 'lucide-react';
import Card from '../components/Card';
import { SETTINGS_ROWS } from '../utils/settingsState';
import type { SettingsState } from '../hooks/useSettingsState';

// Presentational only: the form state lives in useSettingsState (called in
// App, above the view switch), so a saved name/timezone/toggle choice
// survives navigating away and back. Editing any control marks the form
// dirty again (the "saved" note clears) until Save preview is pressed.
export default function Settings({ settings }: { settings: SettingsState }) {
  const { name, timezone, toggles, saved, setName, setTimezone, flip, save, reset } = settings;
  return (
    <div className="view workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / CONFIGURATION</div>
          <h2>Settings</h2>
          <p>Workspace profile and preview preferences.</p>
        </div>
        <span className="preview-label">PREVIEW CONTROLS</span>
      </div>
      <div className="settings-layout">
        <Card
          title="Demo workspace profile"
          subtitle="Local preview values — the demo workspace never scopes live data"
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
              <button className="btn btn-primary" onClick={save}>
                <Save size={14} /> Save preview
              </button>
              <button className="btn" onClick={reset}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            {saved && (
              <span className="saved-note">
                Saved in this page session only; no backend preferences are changed.
              </span>
            )}
          </div>
        </Card>
        <Card title="Notifications & sync" subtitle="Interactive preview preferences">
          <div className="settings-list">
            {SETTINGS_ROWS.map(({ key, title, detail }) => (
              <div className="setting-row" key={key}>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toggles[key]}
                  className={`toggle ${toggles[key] ? 'on' : ''}`}
                  onClick={() => flip(key)}
                  aria-label={`Toggle ${title}`}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="settings-notice">
        <ShieldCheck size={16} /> These controls are not persisted. No automatic sync, alerts or
        email jobs are enabled by changing them.
      </div>
    </div>
  );
}
