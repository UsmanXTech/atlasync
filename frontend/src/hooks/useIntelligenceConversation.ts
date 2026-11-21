import { useEffect, useRef, useState } from 'react';
import { approveAgentAction, invokeAgent, type PendingAction, type TraceEntry } from '../services/agent';
import type { IntelligenceSources } from '../services/intelligence';
import { clearThread, fetchThread } from '../services/thread';
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
  pendingAction: PendingAction | null;
  approving: boolean;
  setPrompt: (prompt: string) => void;
  ask: (text?: string) => void;
  cancel: () => void;
  reset: () => void;
  approvePending: (approved: boolean) => void;
}

// Owns the Intelligence conversation state. The hook lives in App (above the
// view switch), so the last answer, its sources and the prompt survive
// navigating to another view and back — the view itself unmounts on switch,
// but this state does not.
//
// v2.1.0 Phase C1: the thread also survives a full page reload — every
// successful ask is appended to the KVS thread by the backend (last 10
// turns), and this hook restores the most recent turn on mount. A
// restored answer has no source counts (turns store question + answer
// only), so coverage shows '—' until the next ask. "New analysis" clears
// the local state AND the KVS thread, but only on this explicit action.
export function useIntelligenceConversation(): IntelligenceConversation {
  const [prompt, setPrompt] = useState(INTELLIGENCE_PRESETS[0]);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<IntelligenceSources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const [threadTurns, setThreadTurns] = useState(0);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [approving, setApproving] = useState(false);
  // Generation guard (see utils/requestGeneration): @forge/bridge invoke()
  // has no abort, so a stale response is discarded instead of cancelled
  // at the transport. Every ask/reset/cancel bumps the generation; a
  // response only applies when its generation is still current. Without
  // this, "New analysis" (or Stop) during a request could be overwritten
  // by the late response.
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

  // Phase C1: restore the last turn from the KVS thread on mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void fetchThread().then((r) => {
      if (!r.ok || r.turns.length === 0) return;
      const last = r.turns[r.turns.length - 1];
      setPrompt(last.question);
      setAnswer(last.answer);
      setSources(null);
      setRestored(true);
      setThreadTurns(r.turns.length);
    });
  }, []);

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
    setPendingAction(null);
    try {
      const r = await invokeAgent(q);
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      if (!r.ok) {
        setError(r.error.message);
      } else if (r.status === 'AWAITING_APPROVAL') {
        // The loop halted on a write tool: nothing was executed. The
        // approval card shows the exact target + params.
        setPendingAction(r.pendingAction);
        setTrace(r.trace);
      } else {
        setAnswer(r.answer);
        setSources(null);
        setTrace(r.trace);
        // The backend appended this turn to the KVS thread (max 10).
        setThreadTurns((n) => Math.min(n + 1, 10));
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
        setPendingAction(null);
        setThreadTurns((n) => Math.min(n + 1, 10));
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

  const reset = () => {
    // Also invalidates any in-flight response, so it cannot repopulate
    // the cleared conversation.
    generations.invalidate();
    setAnswer('');
    setSources(null);
    setError(null);
    setLoading(false);
    setPrompt(INTELLIGENCE_PRESETS[0]);
    setRestored(false);
    setThreadTurns(0);
    setTrace([]);
    setPendingAction(null);
    setApproving(false);
    // Explicit user action: clear the KVS thread too, so the next ask
    // starts a fresh conversation. In the preview there is no backend
    // (BACKEND_UNREACHABLE) — expected, stays silent. A real backend
    // failure is reported, not hidden.
    void clearThread().then((r) => {
      if (!r.ok && r.error && r.error.kind !== 'BACKEND_UNREACHABLE') setError(r.error.message);
    });
  };

  return { prompt, answer, sources, error, loading, restored, threadTurns, trace, pendingAction, approving, setPrompt, ask, cancel, reset, approvePending };
}
