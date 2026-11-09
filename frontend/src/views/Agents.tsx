import Card from '../components/Card';
import type { ViewId } from '../components/Sidebar';
export default function Agents({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  return <div className="view">
    <div className="view-head"><h2>AI Agents</h2><p>Atlasync Intelligence is the live Forge-hosted agent experience in this build.</p></div>
    <Card className="agent-card">
      <div style={{display:'flex',justifyContent:'space-between',gap:10}}><h3>Atlasync Release Intelligence</h3><span className="pill healthy">Read-only</span></div>
      <p>Gathers bounded live Jira, Confluence, and JSM records as the current user, then uses Atlassian Forge LLMs to answer release-readiness and risk questions.</p>
      <div className="cap">Source-aware · current-user permissions · no write actions · no external model API</div>
      <div className="agent-foot"><span>Model: Claude Sonnet 5 via Forge LLM</span><button className="btn btn-primary" onClick={() => onNavigate('intelligence')}>Open Intelligence</button></div>
    </Card>
    <Card><h3>Not included in this live agent</h3><p className="source-footnote">Autonomous Rovo/MCP tool execution, Jira writes, scheduled actions, and agent memory are not enabled. The agent only analyzes source snapshots returned for the current request.</p></Card>
  </div>;
}
