import { useState } from 'react';
import Card from '../components/Card';
import { AGENTS } from '../data/mock';
import type { Agent } from '../data/types';

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>(AGENTS);

  const toggle = (id: string) =>
    setAgents(agents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));

  const enabledCount = agents.filter((a) => a.enabled).length;

  return (
    <div className="view">
      <div className="view-head">
        <h2>AI Agents</h2>
        <p>
          {enabledCount} of {agents.length} agents enabled. These are mock agents — capabilities and run
          counts are sample data.
        </p>
      </div>

      <div className="agent-grid">
        {agents.map((a) => (
          <Card key={a.id} className="agent-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <h3>{a.name}</h3>
              <button
                className={`toggle ${a.enabled ? 'on' : ''}`}
                onClick={() => toggle(a.id)}
                aria-label={`${a.enabled ? 'Disable' : 'Enable'} ${a.name}`}
              />
            </div>
            <p>{a.description}</p>
            <div className="cap">{a.capability}</div>
            <div className="agent-foot">
              <span>
                Last run: {a.lastRun} · {a.runsThisWeek} runs this week
              </span>
              <span className={`pill ${a.enabled ? 'healthy' : 'pending'}`}>{a.enabled ? 'Active' : 'Paused'}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
