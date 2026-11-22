import { useEffect, useState } from 'react';
import { BrainCircuit, Check, ShieldCheck, ArrowUpRight, Wrench, X } from 'lucide-react';
import Card from '../components/Card';
import type { ViewId } from '../components/Sidebar';
import type { IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import { useExecutionHistory } from '../hooks/useExecutionHistory';
import type { ExecutionRunStatus } from '../services/executionHistory';
import { AGENT_EXAMPLES } from '../utils/agentExamples';

const RUN_STATUS: Record<ExecutionRunStatus, { label: string; pill: string }> = {
  COMPLETE: { label: 'complete', pill: 'healthy' },
  APPROVED: { label: 'approved', pill: 'healthy' },
  AWAITING_APPROVAL: { label: 'awaiting approval', pill: 'high' },
  REJECTED: { label: 'rejected', pill: 'pending' },
  ERROR: { label: 'error', pill: 'critical' },
  EXECUTION_FAILED: { label: 'execution failed', pill: 'critical' },
};

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
  // Phase 2 — persistent execution history + the pending approval
  // queue live here (the approval card itself is the same markup as
  // Intelligence; the backend record is the authority either way).
  const history = useExecutionHistory();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { pendingAction, approving, approvePending } = conversation;
  // Refresh the history when an approval decision completes (the
  // pending action clearing is the decision-done signal; the backend
  // records the run before the resolver returns). Depend on the
  // stable refresh callback, not the hook object (a new object every
  // render would re-run this effect endlessly).
  const refreshHistory = history.refresh;
  useEffect(() => {
    if (!pendingAction) void refreshHistory();
  }, [pendingAction, refreshHistory]);

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
        <Card
          title="Pending approvals"
          subtitle="Proposed writes wait here until you approve or reject them"
          className="span-full"
        >
        {pendingAction ? (
          <div className="approval-card">
            <div className="approval-row">
              <Wrench size={18} />
              <div>
                <strong>{pendingAction.preview.tool}</strong>
                <small>
                  Target: <span className="issue-key">{pendingAction.preview.target}</span>
                </small>
              </div>
            </div>
            <div className="approval-params">
              {Object.entries(pendingAction.preview.params).map(([key, value]) => (
                <div className="approval-param" key={key}>
                  <span>{key}</span>
                  <p>{typeof value === 'string' ? value : JSON.stringify(value)}</p>
                </div>
              ))}
            </div>
            <div className="row-actions">
              <button
                className="btn btn-filled"
                disabled={approving}
                onClick={() => approvePending(true)}
                aria-label="Approve and execute"
              >
                <Check size={15} /> <span>{approving ? 'Executing…' : 'Approve & Execute'}</span>
              </button>
              <button
                className="btn"
                disabled={approving}
                onClick={() => approvePending(false)}
                aria-label="Reject action"
              >
                <X size={15} /> <span>Reject</span>
              </button>
            </div>
            <p className="source-footnote">
              The backend re-checks this action against its own stored record before executing — the card
              above is a preview, not the authority.
            </p>
          </div>
        ) : (
          <p className="source-empty">No pending approvals — a proposed write will appear here for your decision.</p>
        )}
      </Card>

        <Card
          title="Execution history"
          subtitle="What the agent actually did — newest first, last 20 runs"
          className="span-full"
        >
        {history.loading && <p className="source-empty">Loading run history…</p>}
        {history.error && <p className="source-error">{history.error}</p>}
        {!history.loading && !history.error && history.runs.length === 0 && (
          <p className="source-empty">No runs yet — ask Intelligence a question and its runs will appear here.</p>
        )}
        {history.runs.length > 0 && (
          <div className="row-list">
            {history.runs.map((run) => (
              <div key={run.id}>
                <button
                  className="example-row"
                  onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                  aria-expanded={expandedId === run.id}
                  aria-label={`Run details: ${run.question}`}
                >
                  <span className="example-copy">
                    <strong>{run.question}</strong>
                    <span>
                      {new Date(run.generatedAt).toLocaleString()} · {(run.toolCallCount ?? run.trace.length)} tool calls ·{' '}
                      {(run.sourceCount ?? run.citations.length)} sources
                      {run.tool ? ` · ${run.tool}${run.target ? ` on ${run.target}` : ''}` : ''}
                    </span>
                    {run.error && <span className="source-error">{run.error}</span>}
                  </span>
                  <span className={`pill ${RUN_STATUS[run.status].pill}`}>{RUN_STATUS[run.status].label}</span>
                </button>
                {expandedId === run.id && run.trace.length > 0 && (
                  <div className="row-list">
                    {run.trace.map((entry, i) => (
                      <div className="data-row" key={`${entry.step}-${entry.tool}-${i}`}>
                        <div className="row-main">
                          <strong>
                            <span className="tabular-nums">Step {entry.step}</span>
                            {' · '}
                            {entry.tool}
                          </strong>
                          <small>
                            {entry.args} · {entry.durationMs} ms
                          </small>
                        </div>
                        <span
                          className={`pill ${
                            entry.status === 'ok'
                              ? 'healthy'
                              : entry.status === 'awaiting-approval'
                                ? 'high'
                                : entry.status === 'error' || entry.status === 'rejected'
                                  ? 'critical'
                                  : 'pending'
                          }`}
                        >
                          {entry.status === 'awaiting-approval' ? 'awaiting approval' : entry.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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
