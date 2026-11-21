// Phase 2 — loads the persistent execution history for the Agents
// view. Loads on mount; callers refresh after an approval decision
// so the new run appears without a page reload.
import { useCallback, useEffect, useState } from 'react';
import { listExecutionHistory, type ExecutionRun } from '../services/executionHistory';

export function useExecutionHistory() {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listExecutionHistory();
    if (result.ok) {
      setRuns(result.runs);
      setError(null);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, loading, error, refresh };
}
