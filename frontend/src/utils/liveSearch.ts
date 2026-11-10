import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';

// One-time live-search fetch, extracted from Topbar so the lifecycle is
// unit-testable (the repo has no DOM test harness).
//
// The fetch is started once and its promise is cached: re-running the
// effect (query change, state change, StrictMode double-invoke) neither
// restarts nor cancels it, so a slow first fetch always settles to
// 'ready' (or 'error') instead of sticking in 'loading' forever.
//
// The old effect listed `liveState` as a dependency and cancelled the
// in-flight fetch in its cleanup: `setLiveState('loading')` re-ran the
// effect, the new run exited on the `liveState !== 'idle'` guard, and the
// first fetch's response was discarded — live search was stuck in Loading
// on the very first query, every time, inside a Forge install.
export interface LiveSearchSources {
  issues: LiveIssue[];
  pages: LiveConfluencePage[];
  requests: LiveJsmRequest[];
}

export class LiveSearchLoader {
  private inflight: Promise<LiveSearchSources> | null = null;
  private sources: LiveSearchSources | null = null;

  /** True once a fetch has resolved with sources. */
  get hasSources(): boolean {
    return this.sources !== null;
  }

  /** True while the one-time fetch is still pending. */
  get isFetching(): boolean {
    return this.inflight !== null;
  }

  /**
   * Start the one-time fetch, or return the in-flight / completed fetch.
   * Later calls never restart or cancel it. On rejection the loader
   * resets, so a Retry can start a fresh fetch.
   */
  ensure(fetch: () => Promise<LiveSearchSources>): Promise<LiveSearchSources> {
    if (this.sources) return Promise.resolve(this.sources);
    if (this.inflight) return this.inflight;
    this.inflight = fetch().then(
      (sources) => {
        this.sources = sources;
        this.inflight = null;
        return sources;
      },
      (error: unknown) => {
        this.inflight = null;
        throw error;
      },
    );
    return this.inflight;
  }
}
