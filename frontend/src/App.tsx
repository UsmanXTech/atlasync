import { useEffect, useState } from 'react';

// Minimal Forge-compatible app shell — scaffold only, no features yet.
// Inside a Forge iframe it asks the backend resolver for status via the
// bridge; outside Forge (local dev/preview) it renders a standalone note.

interface ForgeStatus {
  ok: boolean;
  app: string;
  version: string;
}

type Mode = 'loading' | 'forge' | 'standalone';

export default function App() {
  const [mode, setMode] = useState<Mode>('loading');
  const [status, setStatus] = useState<ForgeStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @forge/bridge only works inside a Forge iframe. A static import
        // would break the app outside Forge, so it is loaded dynamically.
        const { invoke } = await import('@forge/bridge');
        const result = (await invoke('getStatus')) as ForgeStatus;
        if (!cancelled) {
          setStatus(result);
          setMode('forge');
        }
      } catch {
        // Not running inside Forge (local dev/preview): standalone mode.
        if (!cancelled) setMode('standalone');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>Atlasync</h1>
        <p>Every Atlassian Tool, One Sync</p>
      </header>
      <section>
        {mode === 'loading' && <p>Connecting…</p>}
        {mode === 'forge' && status && (
          <p>
            Forge connected — {status.app} v{status.version}.
          </p>
        )}
        {mode === 'standalone' && (
          <p>Standalone preview — Forge bridge unavailable (expected outside Forge).</p>
        )}
      </section>
      <footer>
        <p>Built for Codegeist 2026 · Build with context. Ship with confidence.</p>
      </footer>
    </main>
  );
}
