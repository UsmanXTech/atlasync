import { useRef, useState } from 'react';
import { askAtlasync, type IntelligenceSources } from '../services/intelligence';
import { RequestGeneration } from '../utils/requestGeneration';

export const INTELLIGENCE_PRESETS = [
  'Are we ready to release?',
  'What are the biggest risks?',
  'Summarize recent cross-tool activity.',
];

export interface IntelligenceConversation {
  prompt: string;
  answer: string;
  sources: IntelligenceSources | null;
  error: string | null;
  loading: boolean;
  setPrompt: (prompt: string) => void;
  ask: (text?: string) => void;
  cancel: () => void;
  reset: () => void;
}

// Owns the Intelligence conversation state. The hook lives in App (above the
// view switch), so the last answer, its sources and the prompt survive
// navigating to another view and back — the view itself unmounts on switch,
// but this state does not. A full page reload still starts fresh.
export function useIntelligenceConversation(): IntelligenceConversation {
  const [prompt, setPrompt] = useState(INTELLIGENCE_PRESETS[0]);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<IntelligenceSources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Generation guard (see utils/requestGeneration): @forge/bridge invoke()
  // has no abort, so a stale response is discarded instead of cancelled
  // at the transport. Every ask/reset/cancel bumps the generation; a
  // response only applies when its generation is still current. Without
  // this, "New analysis" (or Stop) during a request could be overwritten
  // by the late response.
  const generationsRef = useRef<RequestGeneration | null>(null);
  if (generationsRef.current === null) generationsRef.current = new RequestGeneration();
  const generations = generationsRef.current;

  const ask = async (text = prompt) => {
    const q = text.trim();
    if (!q || loading) return;
    const generation = generations.next();
    setPrompt(q);
    setLoading(true);
    setError(null);
    setAnswer('');
    setSources(null);
    try {
      const r = await askAtlasync(q);
      if (!generations.isCurrent(generation)) return; // superseded — ignore
      if (r.ok) {
        setAnswer(r.answer);
        setSources(r.sources);
      } else {
        setError(r.error.message);
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
  };

  return { prompt, answer, sources, error, loading, setPrompt, ask, cancel, reset };
}
