import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import { INTEGRATIONS } from '../data/mock';
import type { Integration } from '../data/types';

export default function Integrations() {
  const [tools, setTools] = useState<Integration[]>(INTEGRATIONS);
  const [syncing, setSyncing] = useState<string[]>([]);

  const toggle = (id: string) =>
    setTools(tools.map((t) => (t.id === id ? { ...t, connected: !t.connected } : t)));

  const sync = (id: string) => {
    if (syncing.includes(id)) return;
    setSyncing([...syncing, id]);
    window.setTimeout(() => {
      setTools((prev) =>
        prev.map((t) => (t.id === id ? { ...t, lastSync: 'Just now', itemsSynced: t.itemsSynced + 14 } : t)),
      );
      setSyncing((prev) => prev.filter((s) => s !== id));
    }, 1200);
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Integrations</h2>
        <p>Connected Atlassian tools. Toggles and syncs below are mock controls — no live connection yet.</p>
      </div>

      <div className="tool-grid">
        {tools.map((t) => (
          <Card key={t.id} className="tool-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <h3>{t.tool}</h3>
              <span className={`pill ${t.connected ? 'healthy' : 'blocked'}`}>
                {t.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p>{t.note}</p>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              Last sync: {syncing.includes(t.id) ? 'Syncing…' : t.lastSync} · {t.itemsSynced.toLocaleString()} items
            </div>
            <div className="tool-foot">
              <span>{t.connected ? 'Auto-sync daily' : 'Connect to start syncing'}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-small" disabled={!t.connected || syncing.includes(t.id)} onClick={() => sync(t.id)}>
                  <RefreshCw size={13} /> {syncing.includes(t.id) ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="btn btn-small" onClick={() => toggle(t.id)}>
                  {t.connected ? 'Disconnect' : 'Connect'}
                </button>
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
