import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FolderKanban, RefreshCw, Search, Layers3, Sparkles } from 'lucide-react';
import { fetchLiveJiraProjects, type LiveJiraProject } from '../services/jira';
import { contextualQuestionFor } from '../utils/contextualQuestions';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { ViewId } from '../components/Sidebar';

/**
 * Screen 3: Projects (Portfolio Initiatives & Health)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Projects({
  onNavigate,
  conversation,
}: {
  onNavigate: (view: ViewId) => void;
  conversation: IntelligenceConversation;
}) {
  const [projects, setProjects] = useState<LiveJiraProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLiveJiraProjects(50);
      if (result.ok) setProjects(result.projects);
      else setError(result.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Jira projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const types = useMemo(
    () => Array.from(new Set(projects.map((p) => p.projectType).filter(Boolean))),
    [projects],
  );

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const text = `${p.key} ${p.name} ${p.projectType}`.toLowerCase();
        return text.includes(query.trim().toLowerCase()) && (kind === 'all' || p.projectType === kind);
      }),
    [projects, query, kind],
  );

  const loadFailed = error !== null && projects.length === 0;

  const askAboutThis = () => {
    conversation.ask(contextualQuestionFor('projects'));
    onNavigate('intelligence');
  };

  return (
    <div className="view workspace-view projects-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / DELIVERY</div>
          <h2>Projects</h2>
          <p>Your Jira project portfolio, filtered by your current Atlassian permissions.</p>
        </div>
        <div className="workspace-heading-actions">
          {!error && projects.length > 0 && <span className="pill healthy">Jira connected</span>}
          <button className="btn btn-filled" onClick={askAboutThis}>
            <Sparkles size={15} />
            <span>Ask about this</span>
          </button>
          <button className="btn btn-filled" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing…' : 'Refresh projects'}</span>
          </button>
        </div>
      </div>

      {!loadFailed && (
        <div className="workspace-toolbar">
          <label className="workspace-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project…"
              aria-label="Filter projects"
            />
          </label>
          <div className="filter-pills" role="group" aria-label="Project category filters">
            <button
              className={`chip ${kind === 'all' ? 'active' : ''}`}
              onClick={() => setKind('all')}
            >
              {kind === 'all' && <Check size={14} strokeWidth={2.5} />}
              <span>All projects</span>
              <span className="tabular-nums">({projects.length})</span>
            </button>
            {types.map((t) => {
              const isSelected = kind === t;
              return (
                <button
                  key={t}
                  className={`chip ${isSelected ? 'active' : ''}`}
                  onClick={() => setKind(t)}
                >
                  {isSelected && <Check size={14} strokeWidth={2.5} />}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
          <span className="results-count tabular-nums">{filtered.length} shown</span>
        </div>
      )}

      {error && projects.length > 0 && (
        <div className="inline-alert" role="alert">
          {error}
        </div>
      )}

      {loadFailed && (
        <div className="workspace-empty workspace-empty-fill" role="alert">
          <AlertTriangle size={24} className="error-icon" />
          <strong>Couldn&apos;t load Jira projects</strong>
          <span>{error}</span>
          <button className="btn btn-filled" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} />
            <span>{loading ? 'Retrying…' : 'Retry'}</span>
          </button>
        </div>
      )}

      {loading && projects.length === 0 && (
        <div className="workspace-empty">
          <RefreshCw size={20} className="animate-spin" />
          <span>Loading Jira projects…</span>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="workspace-empty">
          <FolderKanban size={24} />
          <strong>No visible Jira projects</strong>
          <span>Projects appear here when your Atlassian account has permission to browse them.</span>
        </div>
      )}

      {projects.length > 0 && (
        <div className="project-board">
          {filtered.map((p, i) => (
            <article className="project-tile" key={p.id}>
              <div className="tile-top">
                <span className="project-key-pill">{p.key}</span>
                <span className="chip chip-compact active">{p.projectType || 'Jira'}</span>
              </div>
              <h3>{p.name}</h3>
              <div className="tile-bottom">
                <span>
                  <Layers3 size={14} /> Jira project
                </span>
                <span className="project-index">#{String(i + 1).padStart(2, '0')}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {projects.length > 0 && filtered.length === 0 && (
        <div className="workspace-empty">No projects match this filter.</div>
      )}

      <div className="workspace-footnote">
        Live Jira metadata · no invented owners, progress, or health scores. Maximum 50 projects per refresh. The demo workspace selection does not scope live projects — every project visible to you is shown.
      </div>
    </div>
  );
}
