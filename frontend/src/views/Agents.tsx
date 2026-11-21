import { BrainCircuit, ShieldCheck, ArrowUpRight } from 'lucide-react';
import Card from '../components/Card';
import type { ViewId } from '../components/Sidebar';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import { AGENT_EXAMPLES } from '../utils/agentExamples';

/**
 * Screen 5: AI Agents (Autonomous Workflows & Approval Queue)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Agents({
  onNavigate,
  conversation,
}: {
  onNavigate: (view: ViewId) => void;
  conversation: IntelligenceConversation;
}) {
  const tryExample = (question: string) => {
    conversation.ask(question);
    onNavigate('intelligence');
  };

  return (
    <div className="view workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / AUTOMATION</div>
          <h2>AI Agents</h2>
          <p>Available agent experiences and their execution boundaries.</p>
        </div>
      </div>

      <div className="agent-feature">
        <div className="agent-feature-icon">
          <BrainCircuit size={28} />
        </div>
        <div className="agent-feature-copy">
          <div className="eyebrow">AVAILABLE NOW</div>
          <h3>Atlasync Release Intelligence</h3>
          <p>
            Analyzes bounded Jira, Confluence and JSM records as the current user, then answers delivery-readiness and risk questions.
          </p>
          <div className="agent-tags">
            <span>
              <ShieldCheck size={14} /> Permission-aware
            </span>
            <span>Read-only</span>
            <span>Forge-hosted LLM</span>
          </div>
        </div>
        <button
          className="btn btn-filled"
          onClick={() => onNavigate('intelligence')}
          aria-label="Open Intelligence"
        >
          <span>Open Intelligence</span>
          <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="agent-capabilities">
        <Card title="What it can do">
          <ul className="feature-list">
            <li>Summarize source records from connected Atlassian tools.</li>
            <li>Answer release-readiness and cross-tool risk questions.</li>
            <li>Report which sources were available for the current request.</li>
            <li>Draft Jira and Confluence updates for your approval — nothing writes without it.</li>
            <li>Keep session memory and a daily readiness snapshot.</li>
          </ul>
        </Card>

        <Card title="Not enabled in this build">
          <ul className="feature-list muted-list">
            <li>Autonomous Rovo/MCP orchestration.</li>
          </ul>
          <p className="source-footnote">
            Autonomous orchestration needs separate implementation, permissions and a user-data safety model.
            Approval-gated writes, scheduled snapshots and session memory ship in this build; the Forge-hosted
            LLM needs site-admin approval to run (see Integrations).
          </p>
        </Card>

        <Card title="Try it — example questions" className="span-full">
          <div className="example-list">
            {AGENT_EXAMPLES.map((ex) => (
              <button
                key={ex.question}
                className="example-row"
                onClick={() => tryExample(ex.question)}
                aria-label={`Ask: ${ex.question}`}
              >
                <span className="example-copy">
                  <strong>{ex.question}</strong>
                  <span>{ex.blurb}</span>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          <p className="source-footnote">One tap asks Intelligence right away — no typing needed.</p>
        </Card>
      </div>
    </div>
  );
}
