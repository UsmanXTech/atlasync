import { useCallback, useEffect, useState } from 'react';
import Card from '../components/Card';
import { RefreshCw } from 'lucide-react';
import { fetchLiveJiraProjects, type LiveJiraProject } from '../services/jira';

export default function Projects() {
  const [projects, setProjects] = useState<LiveJiraProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await fetchLiveJiraProjects(50);
    if (result.ok) setProjects(result.projects); else setError(result.error.message);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="view">
    <div className="view-head"><h2>Projects</h2><p>Live Jira project directory · filtered by the signed-in user's permissions.</p></div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <button className="btn btn-small" onClick={() => void load()} disabled={loading}><RefreshCw size={13}/>{loading ? 'Loading…' : 'Refresh projects'}</button>
    </div>
    {error && <Card><p role="alert" className="source-error">{error}</p></Card>}
    {loading && <Card><p role="status" className="source-empty">Loading Jira projects…</p></Card>}
    {!loading && !error && projects.length === 0 && <Card><p className="source-empty">No Jira projects are visible to this account.</p></Card>}
    <div className="project-grid">{projects.map((p) => <Card key={p.id} className="project-card">
      <span className="key">{p.key}</span><h3>{p.name}</h3><p className="meta">Project type: {p.projectType}</p>
      <p className="source-footnote">Live Jira metadata · no sample progress or health score is fabricated.</p>
    </Card>)}</div>
  </div>;
}
