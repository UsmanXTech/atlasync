import { useCallback, useEffect, useState } from 'react';
import { Activity, FileText, GitPullRequest, RefreshCw, ShieldCheck } from 'lucide-react';
import Stat from '../components/Stat';
import Card from '../components/Card';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';
type Counts={jira:number;confluence:number;jsm:number;errors:string[]};
export default function Insights(){
 const [counts,setCounts]=useState<Counts|null>(null),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const [j,c,s]=await Promise.all([fetchLiveJiraIssues(50),fetchConfluencePages(50),fetchJsmRequests(50)]);const errors:string[]=[];if(!j.ok)errors.push('Jira: '+j.error.message);if(!c.ok)errors.push('Confluence: '+c.error.message);if(!s.ok)errors.push('JSM: '+s.error.message);setCounts({jira:j.ok?j.issues.length:0,confluence:c.ok?c.pages.length:0,jsm:s.ok?s.requests.length:0,errors});}catch(e){setCounts({jira:0,confluence:0,jsm:0,errors:[e instanceof Error?e.message:'Unable to read live sources.']});}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const total=counts?counts.jira+counts.confluence+counts.jsm:0;
 return <div className="view workspace-view">
  <div className="workspace-heading"><div><div className="eyebrow">WORKSPACE / OBSERVABILITY</div><h2>Insights</h2><p>Live source coverage for the latest refresh.</p></div><button className="btn" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{loading?'Refreshing…':'Refresh data'}</button></div>
  <div className="insight-hero"><div><span className="summary-label">VISIBLE RECORDS LOADED</span><strong>{counts?total:'—'}</strong><p>Current permission-filtered snapshot · maximum 50 records per source</p></div><div className="hero-orb"><Activity size={34}/></div></div>
  <div className="insight-stats">
   <Stat label="Jira issues" value={counts?String(counts.jira):'—'} delta="Live sample · max 50" tone="flat" icon={Activity}/>
   <Stat label="Confluence pages" value={counts?String(counts.confluence):'—'} delta="Live sample · max 50" tone="flat" icon={FileText}/>
   <Stat label="JSM requests" value={counts?String(counts.jsm):'—'} delta="Live sample · max 50" tone="flat" icon={GitPullRequest}/>
  </div>
  <Card title="Source health" subtitle="Status from this refresh only">
   {loading&&!counts&&<p role="status" className="source-empty">Reading Jira, Confluence and JSM…</p>}
   {counts?.errors.length===0&&<p className="health-line"><ShieldCheck size={17}/> All three APIs responded successfully for this refresh.</p>}
   {counts?.errors.map(e=><p className="source-error" key={e}>{e}</p>)}
   {!counts&&!loading&&<p className="source-empty">No source snapshot yet.</p>}
  </Card>
  <p className="workspace-footnote">Historical trends and comparative charts are intentionally absent until Atlasync has a secure, permission-aware snapshot history.</p>
 </div>;
}
