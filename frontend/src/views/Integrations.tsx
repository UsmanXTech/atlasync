import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CircleCheck, CircleAlert, PlugZap, GitPullRequest, BrainCircuit, Layers3, LifeBuoy } from 'lucide-react';
import { fetchLiveJiraIssues } from '../services/jira';
import { fetchConfluencePages } from '../services/confluence';
import { fetchJsmRequests } from '../services/jsm';

type Check={state:'idle'|'checking'|'ok'|'error';detail?:string;count?:number};
export default function Integrations(){
 const [jira,setJira]=useState<Check>({state:'idle'}),[confluence,setConfluence]=useState<Check>({state:'idle'}),[jsm,setJsm]=useState<Check>({state:'idle'}),[checking,setChecking]=useState(false),[lastChecked,setLastChecked]=useState<string|null>(null);
 // The probes are read-only; there is no reason to make the user ask for
 // them. The check runs once when the view opens, so the summary never
 // reports "0 / 3" for a check that simply has not run yet.
 const mountedRef=useRef(true),autoCheckRef=useRef(false);
 useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;};},[]);
 const check=useCallback(async()=>{setChecking(true);setJira({state:'checking'});setConfluence({state:'checking'});setJsm({state:'checking'});
 try{const [j,c,s]=await Promise.all([fetchLiveJiraIssues(1),fetchConfluencePages(1),fetchJsmRequests(1)]);
 if(!mountedRef.current)return;
 setJira(j.ok?{state:'ok',count:j.issues.length,detail:'Jira issue API responded.'}:{state:'error',detail:j.error.message});
 setConfluence(c.ok?{state:'ok',count:c.pages.length,detail:'Confluence API responded.'}:{state:'error',detail:c.error.message});
 setJsm(s.ok?{state:'ok',count:s.requests.length,detail:'JSM API responded.'}:{state:'error',detail:s.error.message});}
 catch(e){if(!mountedRef.current)return;const detail=e instanceof Error?e.message:'Connection check failed.';setJira({state:'error',detail});setConfluence({state:'error',detail});setJsm({state:'error',detail});}finally{if(mountedRef.current){setChecking(false);setLastChecked(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));}}},[]);
 useEffect(()=>{if(autoCheckRef.current)return;autoCheckRef.current=true;void check();},[check]);
 const checks=[jira,confluence,jsm],okCount=checks.filter(x=>x.state==='ok').length,anyChecking=checks.some(x=>x.state==='checking'),allIdle=checks.every(x=>x.state==='idle');
 const sources=[{name:'Jira',desc:'Issues and project metadata',note:'Forge asUser · Browse Projects permissions',check:jira,icon:PlugZap},{name:'Confluence',desc:'Pages and space metadata',note:'Forge asUser · content and space permissions',check:confluence,icon:Layers3},{name:'Jira Service Management',desc:'Customer and service requests',note:'Forge asUser · service-desk permissions',check:jsm,icon:LifeBuoy}];
 return <div className="view workspace-view">
  <div className="workspace-heading"><div><div className="eyebrow">WORKSPACE / CONNECTIONS</div><h2>Integrations</h2><p>Connection health and access to your Atlassian tools.</p></div><button className="btn btn-primary" onClick={()=>void check()} disabled={checking}><RefreshCw size={14}/>{checking?'Checking…':'Check connections'}</button></div>
  <div className="integration-summary"><div><span className="summary-label">CONNECTED SOURCES</span><strong><span className="summary-number">{anyChecking?'…':allIdle?'–':okCount}</span><small> / 3</small></strong><span className="summary-status">{anyChecking?'Checking connections…':allIdle?'Not checked yet':lastChecked?`Last checked ${lastChecked}`:'Checked'}</span></div><p>Checks make small read-only requests as the signed-in Atlassian user. A successful probe is not a full sync.</p></div>
  <div className="integration-grid">{sources.map(s=><article className="integration-tile" key={s.name}><div className="integration-top"><span className="integration-icon"><s.icon size={20}/></span><span className={`connection-state ${s.check.state}`}>{s.check.state==='ok'?<><CircleCheck size={13}/> Reachable</>:s.check.state==='error'?<><CircleAlert size={13}/> Unavailable</>:s.check.state==='checking'?'Checking…':'Not checked'}</span></div><h3>{s.name}</h3><p>{s.desc}</p><small>{s.note}</small><div className="connection-detail">{s.check.state==='ok'?s.check.detail:s.check.state==='error'?s.check.detail:s.check.state==='checking'?'Waiting for Atlassian…':'Run a connection check to verify access.'}{s.check.state==='ok'&&<b>{s.check.count} record returned</b>}</div></article>)}</div>
  <div className="integration-grid secondary-grid">
   <article className="integration-tile"><div className="integration-top"><span className="integration-icon"><GitPullRequest size={20}/></span><span className="connection-state limited">Issue-linked</span></div><h3>Bitbucket</h3><p>Pull requests linked to Jira issues through Development Status.</p><small>No direct Bitbucket workspace OAuth configured.</small><div className="connection-detail">Owner action: link Bitbucket Cloud in Jira DVCS settings and reference a Jira issue key in a PR.</div></article>
   <article className="integration-tile"><div className="integration-top"><span className="integration-icon"><BrainCircuit size={20}/></span><span className="connection-state limited">Admin approval</span></div><h3>Forge Intelligence</h3><p>Atlassian-hosted Claude analysis through Forge LLM.</p><small>Read-only, bounded current-user source snapshot.</small><div className="connection-detail">App upgrade approval/reinstall is required. Usage is metered by Atlassian.</div></article>
  </div>
 </div>;
}
