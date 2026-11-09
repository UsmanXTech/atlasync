import { useMemo,useState } from 'react';
import { AlertTriangle,ArrowRight,CircleDot,FileText,GitPullRequest,ListTodo,ShieldAlert,Sparkles } from 'lucide-react';
import Card from '../components/Card';
import Gauge from '../components/Gauge';
import JiraIssuesCard from '../components/JiraIssuesCard';
import ConfluencePagesCard from '../components/ConfluencePagesCard';
import JsmRequestsCard from '../components/JsmRequestsCard';
import Stat from '../components/Stat';
import { BarList } from '../components/Bars';
import { ACTIVITY,BLOCKERS,INCIDENTS,ISSUES_BY_PRIORITY,ISSUES_BY_STATUS,PROJECTS,PULL_REQUESTS } from '../data/mock';
import type { ActivityKind,PrStatus,WorkspaceId } from '../data/types';
import type { ViewId } from '../components/Sidebar';
const KIND_ICONS:Record<ActivityKind,typeof CircleDot>={jira:CircleDot,confluence:FileText,bitbucket:GitPullRequest,jsm:AlertTriangle,ai:Sparkles};
function ageLabel(days:number){if(days===0)return'Today';if(days===1)return'Yesterday';return `${days} days ago`;}
export default function Overview({workspaceId,onNavigate}:{workspaceId:WorkspaceId;onNavigate:(view:ViewId)=>void}){
 const [resolved,setResolved]=useState<string[]>([]),[prFilter,setPrFilter]=useState<'all'|PrStatus>('all'),[range,setRange]=useState<0|7|30>(7);
 const projects=useMemo(()=>PROJECTS.filter(p=>p.workspace===workspaceId),[workspaceId]);
 const blockers=useMemo(()=>BLOCKERS.filter(b=>b.workspace===workspaceId&&!resolved.includes(b.id)),[workspaceId,resolved]);
 const prs=useMemo(()=>{const list=PULL_REQUESTS.filter(p=>p.workspace===workspaceId);return prFilter==='all'?list:list.filter(p=>p.status===prFilter);},[workspaceId,prFilter]);
 const incidents=useMemo(()=>INCIDENTS.filter(i=>i.workspace===workspaceId),[workspaceId]);
 const activity=useMemo(()=>ACTIVITY.filter(a=>a.workspace===workspaceId&&a.daysAgo<=range),[workspaceId,range]);
 const openIssues=projects.reduce((sum,p)=>sum+p.openIssues,0),prsInReview=PULL_REQUESTS.filter(p=>p.workspace===workspaceId&&(p.status==='review'||p.status==='changes')).length,openIncidents=incidents.filter(i=>i.status!=='resolved').length;
 return <div className="view overview-view">
  <div className="view-head"><div><h2>Workspace overview</h2><p>Delivery snapshot across connected tools.</p></div><span className="mock-badge">SAMPLE METRICS · LIVE SOURCES BELOW</span></div>
  <div className="stat-grid">
   <Stat label="Open issues" value={String(openIssues)} delta="Sample workspace metric" tone="flat" icon={ListTodo}/>
   <Stat label="Active blockers" value={String(blockers.length)} delta="Sample workspace metric" tone="flat" icon={ShieldAlert}/>
   <Stat label="PRs awaiting action" value={String(prsInReview)} delta="Sample workspace metric" tone="flat" icon={GitPullRequest}/>
   <Stat label="Open incidents" value={String(openIncidents)} delta="Sample workspace metric" tone="flat" icon={AlertTriangle}/>
  </div>
  <div className="overview-main-grid">
   <section className="overview-column">
    <Card className="overview-readiness" title="Release readiness" subtitle="Atlas v2 · sample assessment"><div className="ai-teaser"><Gauge value={72} label="Sample"/><div><p><strong>Demo-only readiness estimate.</strong> This score is not calculated from live records.</p><button className="btn btn-primary" onClick={()=>onNavigate('intelligence')}>Ask Intelligence <ArrowRight size={14}/></button></div></div></Card>
    <Card title="Issue distribution" subtitle="Demo aggregate · not live analytics"><div className="overview-chart-block"><h4>By status</h4><BarList items={ISSUES_BY_STATUS}/><h4>By priority</h4><BarList items={ISSUES_BY_PRIORITY} tone="amber"/></div></Card>
    <Card title="Active blockers" subtitle="Sample data · local demo resolve actions"><div className="row-list">{blockers.map(b=><div className="data-row" key={b.id}><div className="row-main"><strong>{b.key} · {b.title}</strong><small>{b.owner} · {b.ageDays} days open</small></div><span className={`pill ${b.severity}`}>{b.severity}</span><button className="btn btn-small" onClick={()=>setResolved(v=>[...v,b.id])}>Resolve</button></div>)}{blockers.length===0&&<p className="source-empty">No demo blockers remaining.</p>}</div></Card>
   </section>
   <section className="overview-column">
    <Card className="overview-live-card" title="Jira issues" subtitle="Read-only · switch demo or live data"><JiraIssuesCard/></Card>
    <Card className="overview-live-card" title="Confluence pages"><ConfluencePagesCard/></Card>
    <Card className="overview-live-card" title="JSM requests"><JsmRequestsCard/></Card>
   </section>
   <section className="overview-column">
    <Card title="Recent activity" subtitle="Sample event stream" action={<div className="chip-row">{([0,7,30] as const).map(r=><button key={r} className={`chip ${range===r?'active':''}`} onClick={()=>setRange(r)}>{r===0?'Today':`${r}D`}</button>)}</div>}>
     <div className="feed">{activity.map(a=>{const Icon=KIND_ICONS[a.kind];return <div className="feed-item" key={a.id}><span className="feed-icon"><Icon size={14}/></span><div><strong>{a.title}</strong><small>{a.detail} · {a.actor} · {ageLabel(a.daysAgo)}</small></div></div>;})}{activity.length===0&&<p className="source-empty">No activity in this range.</p>}</div>
    </Card>
    <Card title="Pull requests" subtitle="Sample PR activity" action={<div className="chip-row">{(['all','review','approved','merged','changes'] as const).map(s=><button key={s} className={`chip ${prFilter===s?'active':''}`} onClick={()=>setPrFilter(s)}>{s==='all'?'All':s}</button>)}</div>}>
     <div className="row-list">{prs.map(pr=><div className="data-row" key={pr.id}><div className="row-main"><strong>{pr.title}</strong><small>{pr.repo} · {pr.author}</small></div><span className={`pill ${pr.checks}`}>{pr.checks}</span><span className={`pill ${pr.status}`}>{pr.status}</span></div>)}{prs.length===0&&<p className="source-empty">No sample PRs in this filter.</p>}</div>
    </Card>
    <Card title="Incident snapshot" subtitle="Sample incident data"><div className="row-list">{incidents.map(inc=><div className="data-row" key={inc.id}><div className="row-main"><strong>{inc.title}</strong><small>{inc.service} · {inc.status==='resolved'?'Resolved':`${inc.minutesOpen} min open`}</small></div><span className={`pill ${inc.severity}`}>{inc.severity.toUpperCase()}</span></div>)}</div></Card>
   </section>
  </div>
 </div>;
}
