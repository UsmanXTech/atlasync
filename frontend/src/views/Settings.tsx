import { useEffect,useState } from 'react';
import { Building2, BellRing, Clock3, Save, RotateCcw, ShieldCheck } from 'lucide-react';
import Card from '../components/Card';
import type { Workspace } from '../data/types';
const DEFAULTS={dailySync:true,incidentAlerts:true,weeklyDigest:false,aiSummaries:true};
export default function Settings({workspace}:{workspace:Workspace}){
 const [name,setName]=useState(workspace.name),[timezone,setTimezone]=useState('Asia/Karachi'),[toggles,setToggles]=useState(DEFAULTS),[saved,setSaved]=useState(false);
 useEffect(()=>{setName(workspace.name);setTimezone('Asia/Karachi');setToggles(DEFAULTS);setSaved(false);},[workspace.id,workspace.name]);
 const flip=(key:keyof typeof DEFAULTS)=>{setToggles(v=>({...v,[key]:!v[key]}));setSaved(false);};
 const rows:[keyof typeof DEFAULTS,string,string][]=[['dailySync','Daily sync','Daily synchronization is a planned feature; no scheduler is active.'],['incidentAlerts','Incident alerts','Alert preferences are preview-only and not delivered.'],['weeklyDigest','Weekly digest','Email delivery is not configured.'],['aiSummaries','AI summaries','Forge Intelligence is available on demand; no scheduled summaries run.']];
 return <div className="view workspace-view">
  <div className="workspace-heading"><div><div className="eyebrow">WORKSPACE / CONFIGURATION</div><h2>Settings</h2><p>Workspace profile and preview preferences.</p></div><span className="preview-label">PREVIEW CONTROLS</span></div>
  <div className="settings-layout">
   <Card title="Workspace profile" subtitle="Local preview values"><div className="settings-form"><div className="field"><label htmlFor="ws-name">Workspace name</label><input id="ws-name" value={name} onChange={e=>{setName(e.target.value);setSaved(false);}}/></div><div className="field"><label htmlFor="ws-tz">Timezone</label><select id="ws-tz" value={timezone} onChange={e=>{setTimezone(e.target.value);setSaved(false);}}><option value="Asia/Karachi">Asia/Karachi (PKT)</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York (ET)</option><option value="Europe/London">Europe/London (GMT)</option></select></div><div className="settings-actions"><button className="btn btn-primary" onClick={()=>setSaved(true)}><Save size={14}/> Save preview</button><button className="btn" onClick={()=>{setName(workspace.name);setTimezone('Asia/Karachi');setToggles(DEFAULTS);setSaved(false);}}><RotateCcw size={14}/> Reset</button></div>{saved&&<span className="saved-note">Saved in this page session only; no backend preferences are changed.</span>}</div></Card>
   <Card title="Notifications & sync" subtitle="Interactive preview preferences"><div className="settings-list">{rows.map(([key,title,detail])=><div className="setting-row" key={key}><div><strong>{title}</strong><small>{detail}</small></div><button type="button" role="switch" aria-checked={toggles[key]} className={`toggle ${toggles[key]?'on':''}`} onClick={()=>flip(key)} aria-label={`Toggle ${title}`}/></div>)}</div></Card>
  </div>
  <div className="settings-notice"><ShieldCheck size={16}/> These controls are not persisted. No automatic sync, alerts or email jobs are enabled by changing them.</div>
 </div>;
}
