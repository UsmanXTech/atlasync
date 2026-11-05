import { useMemo, useState } from 'react';
import Card from '../components/Card';
import { PROJECTS } from '../data/mock';
import type { HealthStatus, WorkspaceId } from '../data/types';

type Filter = 'all' | HealthStatus;

export default function Projects({ workspaceId }: { workspaceId: WorkspaceId }) {
  const [filter, setFilter] = useState<Filter>('all');

  const projects = useMemo(() => {
    const list = PROJECTS.filter((p) => p.workspace === workspaceId);
    return filter === 'all' ? list : list.filter((p) => p.health === filter);
  }, [workspaceId, filter]);

  return (
    <div className="view">
      <div className="view-head">
        <h2>Projects</h2>
        <p>Every project in this workspace, with health and progress — sample data.</p>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {(['all', 'healthy', 'at-risk', 'blocked'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All projects' : f}
          </button>
        ))}
      </div>

      <div className="project-grid">
        {projects.map((p) => (
          <Card key={p.id} className="project-card">
            <span className="key">{p.key}</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
              <h3>{p.name}</h3>
              <span className={`pill ${p.health}`}>{p.health}</span>
            </div>
            <p className="meta">
              Owner: {p.owner} · Next: {p.nextMilestone} · {p.openIssues} open issues · {p.blockers} blockers
            </p>
            <div className="progress">
              <div
                className={p.health === 'healthy' ? 'good' : p.health === 'at-risk' ? 'warn' : 'bad'}
                style={{ width: `${p.progress}%` }}
              />
            </div>
            <div className="progress-label">
              <span>Progress</span>
              <span>{p.progress}%</span>
            </div>
          </Card>
        ))}
        {projects.length === 0 && (
          <Card>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>No projects in this filter.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
