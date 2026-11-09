import { useCallback, useEffect, useState } from 'react';
import Card from '../components/Card';
import Stat from '../components/Stat';
import { BarChart3, FileText, GitPullRequest } from 'lucide-react';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';

type Counts = { jira: number; confluence: number; jsm: number; errors: string[] };
export default function Insights() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null); setCounts(null);
    const [jira, confluence, jsm] = await Promise.all([fetchLiveJiraIssues(50), fetchConfluencePages(50), fetchJsmRequests(50)]);
    const errors: string[] = [];
    if (!jira.ok) errors.push(`Jira: ${jira.error.message}`);
    if (!confluence.ok) errors.push(`Confluence: ${confluence.error.message}`);
    if (!jsm.ok) errors.push(`JSM: ${jsm.error.message}`);
    setCounts({ jira: jira.ok ? jira.issues.length : 0, confluence: confluence.ok ? confluence.pages.length : 0, jsm: jsm.ok ? jsm.requests.length : 0, errors });
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="view">
    <div className="view-head"><h2>Insights</h2><p>Live source coverage and current record counts. Historical trends require a safe snapshot system and are not fabricated.</p></div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}><button className="btn btn-small" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh metrics'}</button></div>
    {loading && <Card><p role="status" className="source-empty">Reading live sources…</p></Card>}
    {error && <Card><p role="alert" className="source-error">{error}</p></Card>}
    {counts && <>
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <Stat label="Jira issues loaded" value={String(counts.jira)} delta="Current live sample · max 50" tone="flat" icon={BarChart3}/>
        <Stat label="Confluence pages loaded" value={String(counts.confluence)} delta="Current live sample · max 50" tone="flat" icon={FileText}/>
        <Stat label="JSM requests loaded" value={String(counts.jsm)} delta="Current live sample · max 50" tone="flat" icon={GitPullRequest}/>
      </div>
      <Card title="Source health" subtitle="This refresh only">
        {counts.errors.length === 0 ? <p className="source-empty">All three source APIs responded.</p> : counts.errors.map((e) => <p className="source-error" key={e}>{e}</p>)}
      </Card>
    </>}
    {!counts && !loading && <Card><p className="source-empty">Refresh to retrieve live counts. Preview mode will show backend-unreachable messages instead of mock analytics.</p></Card>}
  </div>;
}
