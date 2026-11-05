import { useEffect, useState } from 'react';
import Card from '../components/Card';
import type { Workspace } from '../data/types';

const DEFAULTS = { dailySync: true, incidentAlerts: true, weeklyDigest: false, aiSummaries: true };

export default function Settings({ workspace }: { workspace: Workspace }) {
  const [name, setName] = useState(workspace.name);
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [toggles, setToggles] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // Settings is mounted across workspace switches. Reinitialize the demo form
  // when its workspace changes so the name/preferences never leak between
  // workspaces and the visible form matches the selected workspace.
  useEffect(() => {
    setName(workspace.name);
    setTimezone('Asia/Karachi');
    setToggles(DEFAULTS);
    setSaved(false);
  }, [workspace.id, workspace.name]);

  const flip = (key: keyof typeof DEFAULTS) => {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  const save = () => setSaved(true);
  const reset = () => {
    setName(workspace.name);
    setTimezone('Asia/Karachi');
    setToggles(DEFAULTS);
    setSaved(false);
  };

  const rows: { key: keyof typeof DEFAULTS; title: string; detail: string }[] = [
    { key: 'dailySync', title: 'Daily sync', detail: 'Sync all connected tools once a day.' },
    { key: 'incidentAlerts', title: 'Incident alerts', detail: 'Notify the workspace when a Sev1/Sev2 opens.' },
    { key: 'weeklyDigest', title: 'Weekly digest', detail: 'Email a weekly summary to workspace members.' },
    { key: 'aiSummaries', title: 'AI summaries', detail: 'Generate readiness summaries for active releases.' },
  ];

  return (
    <div className="view">
      <div className="view-head">
        <h2>Settings</h2>
        <p>Workspace preferences. Controls below are mock — nothing is persisted yet.</p>
      </div>

      <div className="grid-2">
        <Card title="Workspace" subtitle={workspace.plan + ' plan'}>
          <div className="settings-form">
            <div className="field">
              <label htmlFor="ws-name">Workspace name</label>
              <input id="ws-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
            </div>
            <div className="field">
              <label htmlFor="ws-tz">Timezone</label>
              <select id="ws-tz" value={timezone} onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}>
                <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (ET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <div>
              <button className="btn btn-primary" onClick={save}>Save changes</button>{' '}
              <button className="btn" onClick={reset}>Reset demo values</button>
              {saved && <span className="saved-note"> · Saved (mock — nothing persisted)</span>}
            </div>
          </div>
        </Card>

        <Card title="Sync & notifications" subtitle="Toggle demo preferences">
          {rows.map((r) => (
            <div className="setting-row" key={r.key}>
              <div>
                <strong>{r.title}</strong>
                <small>{r.detail}</small>
              </div>
              <button
                className={`toggle ${toggles[r.key] ? 'on' : ''}`}
                onClick={() => flip(r.key)}
                aria-label={`Toggle ${r.title}`}
              />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
