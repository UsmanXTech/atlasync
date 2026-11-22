import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Check,
  CircleAlert,
  PlugZap,
  GitPullRequest,
  BrainCircuit,
  Layers3,
  LifeBuoy,
} from 'lucide-react';
import { fetchHealthDiagnostics, type HealthDiagnostic } from '../services/diagnostics';

// v2.1.0: the three source tiles are driven by the backend's
// getHealthDiagnostics resolver (one structured entry per source:
// exact HTTP status + scope hint) instead of three parallel data
// fetches with a generic "Try again shortly" fallback. A source that
// is not provisioned (JSM 404) is reported as a fact, not an alarm.
type TileState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; detail: string }
  | { state: 'error'; detail: string; code: string; scopeHint: string | null }
  | { state: 'not-provisioned'; detail: string };

const SOURCE_META = [
  {
    source: 'jira' as const,
    name: 'Jira',
    desc: 'Issues and project metadata',
    note: 'Forge asUser · Browse Projects permissions',
    icon: PlugZap,
  },
  {
    source: 'confluence' as const,
    name: 'Confluence',
    desc: 'Pages and space metadata',
    note: 'Forge asUser · content and space permissions',
    icon: Layers3,
  },
  {
    source: 'jsm' as const,
    name: 'Jira Service Management',
    desc: 'Customer and service requests',
    note: 'Forge asUser · service-desk permissions',
    icon: LifeBuoy,
  },
];

/**
 * Screen 4: Integrations (Toolchain Sync Status)
 * Aligned with Stitch M3 Redesign & M3 alignment brief
 */
export default function Integrations() {
  const [tiles, setTiles] = useState<Record<string, TileState>>({
    jira: { state: 'idle' },
    confluence: { state: 'idle' },
    jsm: { state: 'idle' },
  });
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const autoCheckRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const tileFromDiagnostic = (entry: HealthDiagnostic): TileState => {
    if (entry.ok) return { state: 'ok', detail: `HTTP ${entry.status} · ${entry.message}` };
    if (entry.code === 'NOT_PROVISIONED') {
      return { state: 'not-provisioned', detail: entry.message };
    }
    return {
      state: 'error',
      detail: entry.message,
      code: entry.code,
      scopeHint: entry.missingScopeHint,
    };
  };

  const check = useCallback(async () => {
    setChecking(true);
    setBackendError(null);
    setTiles({
      jira: { state: 'checking' },
      confluence: { state: 'checking' },
      jsm: { state: 'checking' },
    });
    try {
      const result = await fetchHealthDiagnostics();
      if (!mountedRef.current) return;
      if (!result.ok) {
        // The bridge itself failed: there is no Forge backend in the
        // standalone preview, or the resolver failed on a real install.
        // Say so plainly instead of marking every source down.
        setBackendError(result.error.message);
        setTiles({
          jira: { state: 'idle' },
          confluence: { state: 'idle' },
          jsm: { state: 'idle' },
        });
        return;
      }
      const next: Record<string, TileState> = {};
      for (const entry of result.diagnostics) {
        next[entry.source] = tileFromDiagnostic(entry);
      }
      for (const meta of SOURCE_META) {
        if (!next[meta.source]) {
          next[meta.source] = {
            state: 'error',
            detail: 'No diagnostic was returned for this source.',
            code: 'API_ERROR',
            scopeHint: null,
          };
        }
      }
      setTiles(next);
    } catch {
      if (!mountedRef.current) return;
      setBackendError('The health check failed unexpectedly. Try again shortly.');
      setTiles({
        jira: { state: 'idle' },
        confluence: { state: 'idle' },
        jsm: { state: 'idle' },
      });
    } finally {
      if (mountedRef.current) {
        setChecking(false);
        setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
  }, []);

  useEffect(() => {
    if (autoCheckRef.current) return;
    autoCheckRef.current = true;
    void check();
  }, [check]);

  // Phase 3.4 — per-tile retry: re-probes only this source and
  // updates only its tile; the other tiles keep their state. The
  // global check above is unchanged. A dead bridge stays a global
  // backendError — a per-tile retry cannot fix that.
  const checkOne = useCallback(async (source: 'jira' | 'confluence' | 'jsm') => {
    setBackendError(null);
    setTiles((prev) => ({ ...prev, [source]: { state: 'checking' } }));
    try {
      const result = await fetchHealthDiagnostics(source);
      if (!mountedRef.current) return;
      if (!result.ok) {
        setBackendError(result.error.message);
        setTiles((prev) => ({ ...prev, [source]: { state: 'idle' } }));
        return;
      }
      const entry = result.diagnostics.find((d) => d.source === source);
      setTiles((prev) => ({
        ...prev,
        [source]: entry
          ? tileFromDiagnostic(entry)
          : { state: 'error', detail: 'No diagnostic was returned for this source.', code: 'API_ERROR', scopeHint: null },
      }));
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      if (!mountedRef.current) return;
      setBackendError('The health check failed unexpectedly. Try again shortly.');
      setTiles((prev) => ({ ...prev, [source]: { state: 'idle' } }));
    }
  }, []);

  const tileList = SOURCE_META.map((meta) => ({ ...meta, check: tiles[meta.source] ?? { state: 'idle' as const } }));
  const okCount = tileList.filter((t) => t.check.state === 'ok').length;
  const anyChecking = tileList.some((t) => t.check.state === 'checking');
  const allIdle = tileList.every((t) => t.check.state === 'idle');

  return (
    <div className="view workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / CONNECTIONS</div>
          <h2>Integrations</h2>
          <p>Connection health and access to your Atlassian tools.</p>
        </div>
        <button
          className="btn btn-filled"
          onClick={() => void check()}
          disabled={checking}
          aria-label="Check connections"
        >
          <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
          <span>{checking ? 'Checking…' : 'Check connections'}</span>
        </button>
      </div>

      <div className="integration-summary">
        <div>
          <span className="summary-label">CONNECTED SOURCES</span>
          <strong>
            <span className="summary-number tabular-nums">
              {anyChecking ? '…' : allIdle ? '–' : okCount}
            </span>
            <small> / 3</small>
          </strong>
          <span className="summary-status">
            {anyChecking
              ? 'Checking connections…'
              : allIdle
                ? 'Not checked yet'
                : lastChecked
                  ? `Last checked ${lastChecked}`
                  : 'Checked'}
          </span>
        </div>
        <p>
          Checks ping each product as the signed-in Atlassian user. A successful probe is not a full sync.
        </p>
      </div>

      {backendError && (
        <p className="source-error" role="alert">
          {backendError} This check needs the installed Forge app — in the standalone preview there is no backend
          to reach.
        </p>
      )}

      <div className="integration-grid">
        {tileList.map((s) => (
          <article className="integration-tile" key={s.name}>
            <div className="integration-top">
              <span className="integration-icon">
                <s.icon size={20} />
              </span>
              <span className={`connection-state ${s.check.state}`}>
                {s.check.state === 'ok' ? (
                  <>
                    <Check size={14} strokeWidth={2.5} />
                    <span>Reachable</span>
                  </>
                ) : s.check.state === 'error' ? (
                  <>
                    <CircleAlert size={14} />
                    <span>Unavailable</span>
                  </>
                ) : s.check.state === 'not-provisioned' ? (
                  <span>Not provisioned</span>
                ) : s.check.state === 'checking' ? (
                  <span>Checking…</span>
                ) : (
                  <span>Not checked</span>
                )}
              </span>
            </div>
            <h3>{s.name}</h3>
            <p>{s.desc}</p>
            <small>{s.note}</small>
            <div className="connection-detail">
              {s.check.state === 'ok' && s.check.detail}
              {s.check.state === 'error' && (
                <>
                  {s.check.detail}
                  <br />
                  <b>Diagnostic: {s.check.code}</b>
                  {s.check.scopeHint && (
                    <>
                      <br />
                      {s.check.scopeHint}
                    </>
                  )}
                </>
              )}
              {s.check.state === 'not-provisioned' && s.check.detail}
              {s.check.state === 'checking' && 'Waiting for Atlassian…'}
              {s.check.state === 'idle' && 'Run a connection check to verify access.'}
            </div>
            {(s.check.state === 'error' || s.check.state === 'not-provisioned') && (
              <div className="row-actions">
                <button
                  className="btn btn-small"
                  onClick={() => void checkOne(s.source)}
                  aria-label={`Retry ${s.name} check`}
                >
                  <RefreshCw size={14} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="integration-grid secondary-grid">
        <article className="integration-tile">
          <div className="integration-top">
            <span className="integration-icon">
              <GitPullRequest size={20} />
            </span>
            <span className="connection-state limited">Issue-linked</span>
          </div>
          <h3>Bitbucket</h3>
          <p>Pull requests linked to Jira issues through Development Status.</p>
          <small>No direct Bitbucket workspace OAuth configured.</small>
          <div className="connection-detail">
            Owner action: link Bitbucket Cloud in Jira DVCS settings and reference a Jira issue key in a PR.
          </div>
        </article>

        {/* Forge Intelligence tile: static copy, NOT a probe result.
            There is no cheap LLM health probe — a check would need a
            real @forge/llm chat call, which is metered by Atlassian —
            so the tile states what is observed (Intelligence answers
            live through askAtlasync) and claims no approval status.
            The old copy ("Admin approval / upgrade approval required")
            contradicted the live LLM answers (review 2026-11-21). */}
        <article className="integration-tile">
          <div className="integration-top">
            <span className="integration-icon">
              <BrainCircuit size={20} />
            </span>
            <span className="connection-state ok">Live</span>
          </div>
          <h3>Forge Intelligence</h3>
          <p>Atlassian-hosted Claude analysis through Forge LLM.</p>
          <small>Read-only, bounded current-user source snapshot.</small>
          <div className="connection-detail">
            Answering live through Intelligence Q&amp;A (askAtlasync). Usage is metered by Atlassian.
          </div>
        </article>
      </div>
    </div>
  );
}
