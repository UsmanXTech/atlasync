import { useCallback, useEffect, useRef, useState } from 'react';
import { approveAgentAction, invokeAgent, listPendingActions, toCitations, toSourceCounts, type Citation, type PendingAction, type SourceCounts, type TraceEntry } from '../services/agent';
import type { IntelligenceSources } from '../services/intelligence';
import {
  createConversation,
  deleteConversation as deleteConversationService,
  getConversation,
  getSiteInfo,
  listConversations,
  renameConversation as renameConversationService,
  type ConversationSummary,
} from '../services/conversations';
import { RequestGeneration } from '../utils/requestGeneration';
import { INTELLIGENCE_PRESETS } from '../utils/intelligencePresets';

export { INTELLIGENCE_PRESETS };

export interface IntelligenceConversation {
  prompt: string;
  answer: string;
  sources: IntelligenceSources | null;
  error: string | null;
  loading: boolean;
  restored: boolean;
  threadTurns: number;
  trace: TraceEntry[];
  citations: Citation[];
  generatedAt: string | null;
  siteUrl: string | null;
  pendingAction: PendingAction | null;
  approving: boolean;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  setPrompt: (prompt: string) => void;
  ask: (text?: string) => void;
  cancel: () => void;
  reset: () => void;
  approvePending: (approved: boolean) => void;
  refreshPendingActions: () => void;
  selectConversation: (conversationId: string) => void;
  newConversation: () => void;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
}

function sourcesFromCitations(citations: Citation[]): IntelligenceSources {
  return {
    jiraIssues: citations.filter((c) => c.kind === 'jira').length,
    confluencePages: citations.filter((c) => c.kind === 'confluence').length,
    jsmRequests: citations.filter((c) => c.kind === 'jsm').length,
    // Bitbucket rows used to have no bucket at all, so their coverage
    // was silently dropped even when the answer linked PRs.
    bitbucketPullRequests: citations.filter((c) => c.kind === 'bitbucket').length,
    unavailable: [],
  };
}

// Coverage from the tool results themselves (loop.js sourceCounts):
// rows each read tool actually returned. Citations stay the Sources
// link list only — they are capped at 10 and miss tools that returned
// rows without a citable record.
function sourcesFromCounts(counts: SourceCounts): IntelligenceSources {
  return {
    jiraIssues: counts.jira,
    confluencePages: counts.confluence,
    jsmRequests: counts.jsm,
    bitbucketPullRequests: counts.bitbucket,
    unavailable: [],
  };
}

function sourcesForAnswer(citations: Citation[], sourceCounts: SourceCounts | null): IntelligenceSources {
  return sourceCounts ? sourcesFromCounts(sourceCounts) : sourcesFromCitations(citations);
}

// A restored turn keeps the coverage stored with it when present;
// older turns (no sourceCounts) fall back to counting citations.
function sourcesForTurn(turn: { citations?: Citation[]; sourceCounts?: unknown }): IntelligenceSources {
  const counts = toSourceCounts(turn.sourceCounts);
  return counts ? sourcesFromCounts(counts) : sourcesFromCitations(toCitations(turn.citations ?? []));
}

// Owns the Intelligence conversation state. The hook lives in App (above the
// view switch), so the last answer, its sources and the prompt survive
// navigating to another view and back — the view itself unmounts on switch,
// but this state does not.
//
// Phase 1 (AI workspace evolution): the single KVS thread is replaced by
// NAMED CONVERSATIONS — list, create, rename, delete, revisit. The
// backend migrates the legacy thread into a "Previous conversation" on
// first list, so existing history survives. "New analysis" starts a fresh
// conversation and keeps the old ones; nothing is deleted except by an
// explicit per-conversation delete. Every successful ask appends its turn
// (last 10) to the active conversation; the most recent conversation is
// restored on mount. Citations are the records the agent actually read —
// never invented — and render as links once the site URL is known.
export function useIntelligenceConversation(): IntelligenceConversation {
  const [prompt, setPrompt] = useState(INTELLIGENCE_PRESETS[0]);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<IntelligenceSources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const [threadTurns, setThreadTurns] = useState(0);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [approving, setApproving] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Generation guard (see utils/requestGeneration): @forge/bridge invoke()
  // has no abort, so a stale response is discarded instead of cancelled
  // at the transport. Every ask/reset/cancel bumps the generation; a
  // response only applies when its generation is still current. Without
  // this, "New analysis" (or Stop) during a request could be overwritten
  // by the late response.
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;

  // Refresh the conversation list (best-effort, silent): titles auto-set
  // from the first question and turn counts change after each ask.
  const refreshConversations = async () => {
    const r = await listConversations();
    if (r.ok) setConversations(r.conversations);
  };

  // Read the pending approvals back from KVS (phantom-approval fix):
  // the proposal survives in the backend even when this tab's React
  // state is gone (reload/remount). Newest first; a failure stays
  // silent and keeps whatever the card currently shows.
  const refreshPendingActions = useCallback(async () => {
    const r = await listPendingActions();
    if (!r.ok) return;
    const [first] = r.pendingActions;
    if (!first) {
      // Nothing pending server-side: clear a stale local card (e.g. the
      // 10-min TTL expired it while this tab was open).
      setPendingAction(null);
      return;
    }
    setPendingAction(first);
    setTrace(first.trace ?? []);
    const restoredCitations = toCitations(first.citations ?? []);
    setCitations(restoredCitations);
    setSources(sourcesFromCitations(restoredCitations));
  }, []);

  // Phase 1: restore the most recent conversation on mount. In the
  // preview there is no backend (BACKEND_UNREACHABLE) — expected, stays
  // silent; the list just stays empty until a backend is reachable.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void getSiteInfo().then((r) => {
      if (r.ok) setSiteUrl(r.siteUrl);
    });
    // A proposal awaiting approval is restored from KVS, not from
    // volatile state: after a reload the card is back instead of the
    // Intelligence/Agents views disagreeing about it.
    void refreshPendingActions();
    void listConversations().then(async (r) => {
      setConversationsLoading(false);
      if (!r.ok || r.conversations.length === 0) return;
      setConversations(r.conversations);
      const mostRecent = r.conversations[0];
      setActiveConversationId(mostRecent.id);
      const full = await getConversation(mostRecent.id);
      if (!full.ok || full.conversation.turns.length === 0) return;
      const last = full.conversation.turns[full.conversation.turns.length - 1];
      setPrompt(last.question);
      setAnswer(last.answer);
      // Citations persist with the turn, so a restored answer keeps its
      // Sources links instead of rendering plain text (dead links).
      const restoredCitations = toCitations(last.citations ?? []);
      setCitations(restoredCitations);
      setSources(sourcesForTurn(last));
      setRestored(true);
      setThreadTurns(full.conversation.turns.length);
    });
  }, []);

  const clearAnswerState = () => {
    setAnswer('');
    setSources(null);
    setError(null);
    setTrace([]);
    setCitations([]);
    setGeneratedAt(null);
    // Deliberately NOT cleared: a proposal awaiting approval survives
    // "New analysis" and conversation switches — it lives in KVS until
    // the user approves/rejects it or its 10-min TTL expires. Clearing
    // it here orphaned the KVS record (phantom approval) while ask()
    // stayed blocked on the invisible proposal.
    setRestored(false);
    setThreadTurns(0);
  };

  // v2.1.0 Phase B: asks run through the agentic tool loop
  // (invokeAgent). Read tools auto-execute; a write tool halts the loop
  // and surfaces an approval card instead of mutating anything.
  const ask = async (text = prompt) => {
    const q = text.trim();
    if (!q || loading || pendingAction) return;
    const generation = generations.next();
    setPrompt(q);
    setLoading(true);
    setError(null);
    setAnswer('');
    setSources(null);
    setRestored(false);
    setTrace([]);
    setCitations([]);
    setGeneratedAt(null);
    setPendingAction(null);
    try {
      // No active conversation yet (fresh install / list empty): create
      // one on demand so the turn has somewhere to live.
      let conversationId = activeIdRef.current;
      if (!conversationId) {
        const created = await createConversation();
        if (!created.ok) {
          if (generations.isCurrent(generation)) setError(created.error.message);
          return;
        }
        conversationId = created.conversation.id;
        setActiveConversationId(conversationId);
        setConversations((prev) => [
          {
            id: created.conversation.id,
            title: created.conversation.title,
            createdAt: created.conversation.createdAt,
            updatedAt: created.conversation.updatedAt,
            turnCount: 0,
          },
          ...prev,
        ]);
      }
      const r = await invokeAgent(q, conversationId);
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      if (!r.ok) {
        setError(r.error.message);
      } else if (r.status === 'AWAITING_APPROVAL') {
        // The loop halted on a write tool: nothing was executed. The
        // approval card shows the exact target + params. The citations
        // are the records read before the halt.
        setPendingAction(r.pendingAction);
        setTrace(r.trace);
        setCitations(r.citations);
        setGeneratedAt(r.generatedAt);
        setSources(sourcesForAnswer(r.citations, r.sourceCounts));
      } else {
        setAnswer(r.answer);
        setTrace(r.trace);
        setCitations(r.citations);
        setGeneratedAt(r.generatedAt);
        setSources(sourcesForAnswer(r.citations, r.sourceCounts));
        // The backend appended this turn to the conversation (max 10)
        // and may have auto-titled it from the first question.
        setThreadTurns((n) => Math.min(n + 1, 10));
        void refreshConversations();
      }
    } catch (e) {
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      setError(e instanceof Error ? e.message : 'The analysis request failed.');
    } finally {
      // Only the current generation may clear loading: an old request
      // finishing after a newer ask started must not hide the new spinner.
      if (generations.isCurrent(generation)) setLoading(false);
    }
  };

  // Approve & Execute / Reject for the pending write action. The
  // backend re-validates against the KVS record — the card's copy is
  // never trusted on its own.
  const approvePending = async (approved: boolean) => {
    if (!pendingAction || approving) return;
    const generation = generations.next();
    setApproving(true);
    setError(null);
    try {
      const r = await approveAgentAction({
        threadId: pendingAction.threadId,
        actionId: pendingAction.actionId,
        approved,
      });
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      if (!r.ok) {
        setError(r.error.message);
      } else if (r.status === 'COMPLETE') {
        setAnswer(r.answer);
        setTrace(r.trace);
        setCitations(r.citations);
        setGeneratedAt(r.generatedAt);
        setSources(sourcesForAnswer(r.citations, r.sourceCounts));
        setPendingAction(null);
        setThreadTurns((n) => Math.min(n + 1, 10));
        void refreshConversations();
      }
    } catch (e) {
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      setError(e instanceof Error ? e.message : 'The approval request failed.');
    } finally {
      if (generations.isCurrent(generation)) setApproving(false);
    }
  };

  // Stop the current analysis from the user's point of view: the late
  // response is ignored (see generation note above). The Forge backend
  // call itself cannot be aborted mid-flight.
  const cancel = () => {
    generations.invalidate();
    setLoading(false);
  };

  // Phase 1: "New analysis" starts a FRESH conversation and keeps the
  // old ones in the list (the old destructive clear is gone). Local
  // state clears immediately even if the backend is unreachable; the
  // next ask creates a conversation on demand.
  const reset = () => {
    // Also invalidates any in-flight response, so it cannot repopulate
    // the cleared conversation.
    generations.invalidate();
    clearAnswerState();
    setLoading(false);
    setPrompt(INTELLIGENCE_PRESETS[0]);
    setApproving(false);
    setActiveConversationId(null);
    void createConversation().then((r) => {
      if (!r.ok) {
        if (r.error.kind !== 'BACKEND_UNREACHABLE') setError(r.error.message);
        return;
      }
      setActiveConversationId(r.conversation.id);
      setConversations((prev) => [
        {
          id: r.conversation.id,
          title: r.conversation.title,
          createdAt: r.conversation.createdAt,
          updatedAt: r.conversation.updatedAt,
          turnCount: 0,
        },
        ...prev,
      ]);
    });
  };

  const newConversation = () => {
    reset();
  };

  const selectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId || loading || pendingAction) return;
    generations.invalidate();
    clearAnswerState();
    setLoading(false);
    setPrompt(INTELLIGENCE_PRESETS[0]);
    setActiveConversationId(conversationId);
    void getConversation(conversationId).then((r) => {
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      if (r.conversation.turns.length === 0) return;
      const last = r.conversation.turns[r.conversation.turns.length - 1];
      setPrompt(last.question);
      setAnswer(last.answer);
      // Citations persist with the turn — see the mount restore above.
      const restoredCitations = toCitations(last.citations ?? []);
      setCitations(restoredCitations);
      setSources(sourcesForTurn(last));
      setRestored(true);
      setThreadTurns(r.conversation.turns.length);
    });
  };

  const renameConversation = (conversationId: string, title: string) => {
    const clean = title.trim();
    if (!clean || clean.length > 80) return;
    void renameConversationService(conversationId, clean).then((r) => {
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: r.conversation.title, updatedAt: r.conversation.updatedAt } : c)),
      );
    });
  };

  const deleteConversation = (conversationId: string) => {
    void deleteConversationService(conversationId).then((r) => {
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      const next = conversations.filter((c) => c.id !== conversationId);
      setConversations(next);
      if (conversationId === activeIdRef.current) {
        if (next.length > 0) {
          selectConversation(next[0].id);
        } else {
          generations.invalidate();
          clearAnswerState();
          setLoading(false);
          setPrompt(INTELLIGENCE_PRESETS[0]);
          setActiveConversationId(null);
        }
      }
    });
  };

  return {
    prompt,
    answer,
    sources,
    error,
    loading,
    restored,
    threadTurns,
    trace,
    citations,
    generatedAt,
    siteUrl,
    pendingAction,
    approving,
    conversations,
    conversationsLoading,
    activeConversationId,
    setPrompt,
    ask,
    cancel,
    reset,
    approvePending,
    refreshPendingActions,
    selectConversation,
    newConversation,
    renameConversation,
    deleteConversation,
  };
}
