import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, RefreshCw, Search, Layers3 } from 'lucide-react';
import { fetchLiveJiraProjects, type LiveJiraProject } from '../services/jira';

export default function Projects() {
  const [projects, setProjects] = useState<LiveJiraProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchLiveJiraProjects(50);
      if (result.ok) setProjects(result.projects); else setError(result.error.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load Jira projects.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const types = useMemo(() => Array.from(new Set(projects.map(p => p.projectType).filter(Boolean))), [projects]);
  const filtered = useMemo(() => projects.filter(p => {
    const text = `${p.key} ${p.name} ${p.projectType}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (kind === 'all' || p.projectType === kind);
  }), [projects, query, kind]);
  return <div className="view workspace-view projects-view">
    <div className="workspace-heading">
      <div><div className="eyebrow">WORKSPACE / DELIVERY</div><h2>Projects</h2><p>Your Jira project portfolio, filtered by your current Atlassian permissions.</p></div>
      <button className="btn btn-primary" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/>{loading ? 'Refreshing…' : 'Refresh projects'}</button>
    </div>
    <div className="workspace-toolbar">
      <label className="workspace-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a project…" aria-label="Filter projects"/></label>
      <div className="filter-pills"><button className={kind==='all'?'selected':''} onClick={()=>setKind('all')}>All projects <span>{projects.length}</span></button>{types.map(t=><button key={t} className={kind===t?'selected':''} onClick={()=>setKind(t)}>{t}</button>)}</div>
      <span className="results-count">{filtered.length} shown</span>
    </div>
    {error && <div className="inline-alert" role="alert">{error}</div>}
    {loading && projects.length===0 && <div className="workspace-empty"><RefreshCw size={18}/>Loading Jira projects…</div>}
    {!loading && !error && projects.length===0 && <div className="workspace-empty"><FolderKanban size={22}/><strong>No visible Jira projects</strong><span>Projects appear here when your Atlassian account has permission to browse them.</span></div>}
    {projects.length>0 && <div className="project-board">{filtered.map((p,i)=><article className="project-tile" key={p.id}>
      <div className="tile-top"><span className="project-mark"><FolderKanban size={17}/></span><span className="pill healthy">Jira connected</span></div>
      <div className="project-key">{p.key}</div><h3>{p.name}</h3><p className="project-description">Live Jira project · {p.projectType || 'Project'}</p>
      <div className="tile-bottom"><span><Layers3 size={13}/> {p.projectType || 'Jira project'}</span><span className="project-index">{String(i+1).padStart(2,'0')}</span></div>
    </article>)}</div>}
    {projects.length>0 && filtered.length===0 && <div className="workspace-empty">No projects match this filter.</div>}
    <div className="workspace-footnote">Live Jira metadata · no invented owners, progress, or health scores. Maximum 50 projects per refresh. The demo workspace selection does not scope live projects — every project visible to you is shown.</div>
  </div>;
}
