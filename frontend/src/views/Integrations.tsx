import { useCallback, useState } from 'react';
import Card from '../components/Card';
import { RefreshCw } from 'lucide-react';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';

type Check = { state: 'idle' | 'checking' | 'ok' | 'error'; detail?: string; count?: number };
export default function Integrations() {
  const [jira, setJira] = useState<Check>({ state: 'idle' });
  const [confluence, setConfluence] = useState<Check>({ state: 'idle' });
  const [jsm, setJsm] = useState<Check>({ state: 'idle' });
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    setChecking(true);
    setJira({ state: 'checking' }); setConfluence({ state: 'checking' }); setJsm({ state: 'checking' });
    const [j, c, s] = await Promise.all([fetchLiveJiraIssues(1), fetchConfluencePages(1), fetchJsmRequests(1)]);
    setJira(j.ok ? { state: 'ok', count: j.issues.length, detail: 'Jira issue API responded.' } : { state: 'error', detail: j.error.message });
    setConfluence(c.ok ? { state: 'ok', count: c.pages.length, detail: 'Confluence API responded.' } : { state: 'error', detail: c.error.message });
    setJsm(s.ok ? { state: 'ok', count: s.requests.length, detail: 'JSM API responded.' } : { state: 'error', detail: s.error.message });
    setChecking(false);
  }, []);
  const card = (title: string, desc: string, state: Check) => <Card className="tool-card" key={title}>
    <div style={{display:'flex',justifyContent:'space-between',gap:10}}><h3>{title}</h3><span className={`pill ${state.state === 'ok' ? 'healthy' : state.state === 'error' ? 'blocked' : 'pending'}`}>{state.state === 'ok' ? 'Reachable' : state.state === 'error' ? 'Unavailable' : state.state === 'checking' ? 'Checking…' : 'Not checked'}</span></div>
    <p>{desc}</p><p className={state.state === 'error' ? 'source-error' : 'source-footnote'}>{state.detail ?? 'Run a read-only connection check.'}</p>
    {state.state === 'ok' && <p className="source-footnote">Probe returned {state.count} visible record(s). This is not a full sync.</p>}
  </Card>;
  return <div className="view">
    <div className="view-head"><h2>Integrations</h2><p>Real read-only checks. No fake connect/disconnect switches or demo sync counters.</p></div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}><button className="btn btn-primary" onClick={() => void check()} disabled={checking}><RefreshCw size={14}/>{checking ? 'Checking…' : 'Check live connections'}</button></div>
    <div className="tool-grid">{card('Jira', 'Issue search using Forge asUser; Browse Projects permissions apply.', jira)}{card('Confluence', 'Page metadata using Forge asUser; space/content permissions apply.', confluence)}{card('Jira Service Management', 'Request list using Forge asUser; service-desk visibility applies.', jsm)}
      <Card className="tool-card"><h3>Bitbucket pull requests</h3><span className="pill pending">Issue-linked only</span><p>PRs are retrieved through Jira Development Status, not a direct Bitbucket workspace API.</p><p className="source-footnote">Owner action required: link Bitbucket Cloud in Jira DVCS settings, then reference a Jira issue key from a PR.</p></Card>
      <Card className="tool-card"><h3>Forge LLM</h3><span className="pill pending">Admin approval required</span><p>Atlasync Intelligence uses Atlassian-hosted Claude through Forge LLMs.</p><p className="source-footnote">The app update must be approved/reinstalled, and LLM usage is metered.</p></Card>
    </div>
  </div>;
}
