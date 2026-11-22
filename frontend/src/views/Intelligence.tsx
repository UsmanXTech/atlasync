import { useState } from 'react';
import { Send, Sparkles, Database, ShieldCheck, Square, Check, X, Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import RecordLink from '../components/RecordLink';
import IntelligenceBriefing from '../components/IntelligenceBriefing';
import MarkdownText from '../components/Markdown';
import { INTELLIGENCE_PRESETS, type IntelligenceConversation } from '../hooks/useIntelligenceConversation';
import type { Briefing } from '../hooks/useBriefingState';
import { citationUrl } from '../utils/recordLinks';

/**
 * Screen 2: Intelligence (Jira Rovo / Atlassian Forge LLM Ask & Answer)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Intelligence({
  conversation,
  briefing,
}: {
  conversation: IntelligenceConversation;
  briefing: Briefing;
}) {
  const { prompt, setPrompt, answer, sources, error, loading, restored, threadTurns, trace, citations, generatedAt, siteUrl, pendingAction, approving, conversations, conversationsLoading, activeConversationId, ask, cancel, approvePending, selectConversation, newConversation, renameConversation, deleteConversation } = conversation;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="view workspace-view intelligence-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / AI ANALYSIS</div>
          <h2>Intelligence</h2>
          <p>Ask questions across permission-filtered Jira, Confluence and JSM context.</p>
        </div>
        <span className="live-readonly">
          <Sparkles size={14} /> PERMISSION-AWARE AGENT (APPROVAL-GATED WRITES)
        </span>
      </div>

      <IntelligenceBriefing briefing={briefing} />

      <div className="intelligence-layout">
        <section className="intelligence-primary">
          <div className="intelligence-welcome">
            <span className="intelligence-emblem">
              <Sparkles size={22} />
            </span>
            <div>
              <span className="eyebrow">ATLASYNC INTELLIGENCE</span>
              <h3 className="text-title-md">Think across your Atlassian workspace.</h3>
              <p className="text-body-md">Get source-aware answers from a bounded live snapshot. Atlasync can propose actions — writes only run after your approval.</p>
            </div>
          </div>

          <div className="prompt-chips">
            {INTELLIGENCE_PRESETS.map((p) => (
              <button key={p} className="chip" onClick={() => setPrompt(p)}>
                <span>{p}</span>
              </button>
            ))}
          </div>

          <div className="prompt-composer">
            <textarea
              value={prompt}
              maxLength={1500}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder="Ask about a release, project, dependency or risk…"
              aria-label="Ask Atlasync Intelligence"
            />
            <button
              className="btn btn-filled"
              disabled={loading || !prompt.trim() || !!pendingAction}
              onClick={() => void ask()}
              aria-label="Ask Atlasync"
            >
              <Send size={15} />
              <span>{loading ? 'Analyzing…' : 'Ask Atlasync'}</span>
            </button>
            {loading && (
              <button className="btn btn-outlined" onClick={cancel} aria-label="Stop analysis">
                <Square size={14} /> <span>Stop</span>
              </button>
            )}
          </div>

          {trace.length > 0 && (
            <Card title="Execution trace" subtitle="Live tool calls for this analysis (max 5 steps)">
              <div className="row-list">
                {trace.map((entry, i) => (
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
            </Card>
          )}

          {pendingAction && (
            <Card
              title="Approval required"
              subtitle="This write has NOT run yet — nothing changes until you approve it"
            >
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
                    onClick={() => void approvePending(true)}
                    aria-label="Approve and execute"
                  >
                    <Check size={15} /> <span>{approving ? 'Executing…' : 'Approve & Execute'}</span>
                  </button>
                  <button
                    className="btn"
                    disabled={approving}
                    onClick={() => void approvePending(false)}
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
            </Card>
          )}

          <Card
            title="Analysis"
            subtitle="Generated by Atlassian Forge LLM · verify critical decisions against source records"
          >
            {loading && (
              <p role="status" className="source-empty">
                Reading live records and preparing the analysis…
              </p>
            )}
            {error && (
              <p role="alert" className="source-error">
                {error}
              </p>
            )}
            {!loading && !error && !answer && pendingAction && (
              <div className="analysis-empty">
                <ShieldCheck size={22} />
                <strong>Waiting for your approval</strong>
                <span>The proposed write above has not run. Approve it to execute, or reject it to continue without it.</span>
              </div>
            )}
            {!loading && !error && !answer && !pendingAction && (
              <div className="analysis-empty">
                <Sparkles size={22} />
                <strong>Your analysis appears here</strong>
                <span>No sample response is presented as live AI output.</span>
              </div>
            )}
            {answer && (
              <div className="ai-answer">
                <div className="intelligence-answer">
                  <MarkdownText text={answer} />
                </div>
                {citations.length > 0 && (
                  <div className="row-list">
                    <div className="data-row">
                      <div className="row-main">
                        <strong>Sources</strong>
                        <small>Records the agent actually read — links open the original record</small>
                      </div>
                    </div>
                    {citations.map((c) => {
                      return (
                        <div className="data-row" key={`${c.kind}-${c.key}`}>
                          <div className="row-main">
                            <strong>
                              <RecordLink url={citationUrl(siteUrl, c)} label={`Open ${c.key} in the original source`}>
                                <span className="issue-key">{c.key}</span>
                              </RecordLink>
                            </strong>
                            <small>{c.title}</small>
                          </div>
                          <span className="pill pending">{c.kind}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {generatedAt && (
                  <p className="source-footnote">
                    Snapshot computed at {new Date(generatedAt).toLocaleTimeString()} — sources as read at that time.
                  </p>
                )}
                {restored && (
                  <p className="source-footnote">
                    Restored from your previous session — {threadTurns} turn{threadTurns === 1 ? '' : 's'} in this
                    conversation. Ask a follow-up to continue it, or start a new analysis.
                  </p>
                )}
                <p className="source-footnote">
                  AI output may be incomplete. Atlasync does not make release decisions; write actions only run
                  after your approval.
                </p>
              </div>
            )}
          </Card>
        </section>

        <aside className="intelligence-rail">
          <Card title="Conversations" subtitle="Saved Intelligence chats — select to revisit">
            <div className="row-actions">
              <button className="btn btn-tonal" onClick={newConversation} aria-label="New conversation">
                <Plus size={14} /> <span>New conversation</span>
              </button>
            </div>
            {conversationsLoading && <p className="source-empty">Loading conversations…</p>}
            {!conversationsLoading && conversations.length === 0 && (
              <p className="source-empty">No conversations yet — ask your first question.</p>
            )}
            {conversations.length > 0 && (
              <div className="row-list">
                {conversations.map((c) => (
                  <div className="data-row" key={c.id}>
                    <div className="row-main">
                      {renamingId === c.id ? (
                        <input
                          value={renameDraft}
                          maxLength={80}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameConversation(c.id, renameDraft);
                              setRenamingId(null);
                            }
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          aria-label="Conversation title"
                          autoFocus
                        />
                      ) : (
                        <button
                          className="btn"
                          onClick={() => selectConversation(c.id)}
                          aria-label={`Open conversation ${c.title}`}
                        >
                          <strong>{c.title}</strong>
                        </button>
                      )}
                      <small>
                        {c.turnCount} turn{c.turnCount === 1 ? '' : 's'}
                        {c.id === activeConversationId ? ' · current' : ''}
                      </small>
                    </div>
                    {renamingId === c.id ? (
                      <div className="row-actions">
                        <button
                          className="btn btn-filled"
                          onClick={() => {
                            renameConversation(c.id, renameDraft);
                            setRenamingId(null);
                          }}
                          aria-label="Save title"
                        >
                          <Check size={14} />
                        </button>
                        <button className="btn" onClick={() => setRenamingId(null)} aria-label="Cancel rename">
                          <X size={14} />
                        </button>
                      </div>
                    ) : confirmDeleteId === c.id ? (
                      <div className="row-actions">
                        <button
                          className="btn btn-filled"
                          onClick={() => {
                            deleteConversation(c.id);
                            setConfirmDeleteId(null);
                          }}
                          aria-label="Confirm delete conversation"
                        >
                          <Check size={14} /> <span>Delete</span>
                        </button>
                        <button className="btn" onClick={() => setConfirmDeleteId(null)} aria-label="Cancel delete">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button
                          className="btn"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameDraft(c.title);
                            setConfirmDeleteId(null);
                          }}
                          aria-label={`Rename conversation ${c.title}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setConfirmDeleteId(c.id);
                            setRenamingId(null);
                          }}
                          aria-label={`Delete conversation ${c.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Source coverage" subtitle="Included in latest answer">
            <div className="coverage-total">
              <Database size={18} />
              <strong className="tabular-nums">
                {sources ? sources.jiraIssues + sources.confluencePages + sources.jsmRequests + sources.bitbucketPullRequests : '—'}
              </strong>
              <span>records</span>
            </div>
            {[
              { name: 'Jira issues', value: sources?.jiraIssues },
              { name: 'Confluence pages', value: sources?.confluencePages },
              { name: 'JSM requests', value: sources?.jsmRequests },
              { name: 'Bitbucket pull requests', value: sources?.bitbucketPullRequests },
            ].map((x) => (
              <div className="coverage-row" key={x.name}>
                <span>{x.name}</span>
                <b className="tabular-nums">{x.value ?? '—'}</b>
              </div>
            ))}
            {sources?.unavailable.map((s) => (
              <p key={s} className="source-error">
                {s}
              </p>
            ))}
          </Card>

          <div className="intelligence-guard">
            <ShieldCheck size={18} />
            <div>
              <strong>Permission-aware</strong>
              <span>Records are retrieved as the current Atlassian user and kept within the bounded request context.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
