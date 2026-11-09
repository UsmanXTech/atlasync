import { useState } from 'react';
import { askAtlasync, type IntelligenceSources } from '../services/intelligence';

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

  const ask = async (text = prompt) => {
    const q = text.trim();
    if (!q || loading) return;
    setPrompt(q);
    setLoading(true);
    setError(null);
    setAnswer('');
    setSources(null);
    try {
      const r = await askAtlasync(q);
      if (r.ok) {
        setAnswer(r.answer);
        setSources(r.sources);
      } else {
        setError(r.error.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The analysis request failed.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setAnswer('');
    setSources(null);
    setError(null);
    setPrompt(INTELLIGENCE_PRESETS[0]);
  };

  return { prompt, answer, sources, error, loading, setPrompt, ask, reset };
}
