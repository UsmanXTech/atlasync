import { BrainCircuit, ShieldCheck, ArrowUpRight } from 'lucide-react';
import Card from '../components/Card';
import type { ViewId } from '../components/Sidebar';
export default function Agents({onNavigate}:{onNavigate:(view:ViewId)=>void}){
 return <div className="view workspace-view">
  <div className="workspace-heading"><div><div className="eyebrow">WORKSPACE / AUTOMATION</div><h2>AI Agents</h2><p>Available agent experiences and their execution boundaries.</p></div></div>
  <div className="agent-feature"><div className="agent-feature-icon"><BrainCircuit size={26}/></div><div className="agent-feature-copy"><div className="eyebrow">AVAILABLE NOW</div><h3>Atlasync Release Intelligence</h3><p>Analyzes bounded Jira, Confluence and JSM records as the current user, then answers delivery-readiness and risk questions.</p><div className="agent-tags"><span><ShieldCheck size={13}/> Permission-aware</span><span>Read-only</span><span>Forge-hosted LLM</span></div></div><button className="btn btn-primary" onClick={()=>onNavigate('intelligence')}>Open Intelligence <ArrowUpRight size={15}/></button></div>
  <div className="agent-capabilities"><Card title="What it can do"><ul className="feature-list"><li>Summarize source records from connected Atlassian tools.</li><li>Answer release-readiness and cross-tool risk questions.</li><li>Report which sources were available for the current request.</li></ul></Card><Card title="Not enabled in this build"><ul className="feature-list muted-list"><li>Autonomous Rovo/MCP orchestration.</li><li>Jira or Bitbucket write actions.</li><li>Scheduled runs, persistent agent memory or background sync.</li></ul><p className="source-footnote">These capabilities require separate implementation, permissions and a user-data safety model.</p></Card></div>
 </div>;
}
