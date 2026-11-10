import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';

// One-time live-search fetch, extracted from Topbar so the lifecycle is
// unit-testable (the repo has no DOM test harness).
//
// The fetch is started once and its promise is cached: re-running the
// effect (query change, state change, StrictMode double-invoke) neither
// restarts nor cancels it, so a slow first fetch always settles instead
// of sticking in 'loading' forever.
//
// Per-source state (third ChatGPT review, main 63ceb31): the three
// sources used to be fetched as one Promise.all and a partial failure
// was silently replaced with an empty array — the failed source could
// never be retried in the session and the user saw a misleading
// "No live matches". Each source now tracks its own loaded / failed /
// in-flight state: a failed source stays failed (and visibly so) until
// a retry refetches ONLY that source and merges the result into the
// cache. Loaded sources are never refetched.
export type LiveSourceKey = 'issues' | 'pages' | 'requests';

export interface LiveSearchSources {
  issues: LiveIssue[];
  pages: LiveConfluencePage[];
  requests: LiveJsmRequest[];
}

export type LiveSourceFetcher<T> = () => Promise<{ ok: true; data: T[] } | { ok: false }>;

export interface LiveSourceFetchers {
  issues: LiveSourceFetcher<LiveIssue>;
  pages: LiveSourceFetcher<LiveConfluencePage>;
  requests: LiveSourceFetcher<LiveJsmRequest>;
}

export interface LiveSearchSnapshot {
  sources: LiveSearchSources;
  failed: LiveSourceKey[];
  loading: LiveSourceKey[];
}

const SOURCE_KEYS: LiveSourceKey[] = ['issues', 'pages', 'requests'];

export class LiveSearchLoader {
  private cache: LiveSearchSources = { issues: [], pages: [], requests: [] };
  private loaded = new Set<LiveSourceKey>();
  private failed = new Set<LiveSourceKey>();
  private inflightKeys = new Set<LiveSourceKey>();
  private batch: Promise<LiveSearchSnapshot> | null = null;

  /** True while a fetch batch is still pending. */
  get isFetching(): boolean {
    return this.batch !== null;
  }

  /** True once at least one source has loaded. */
  get hasSources(): boolean {
    return this.loaded.size > 0;
  }

  snapshot(): LiveSearchSnapshot {
    return {
      sources: {
        issues: [...this.cache.issues],
        pages: [...this.cache.pages],
        requests: [...this.cache.requests],
      },
      failed: [...this.failed],
      loading: [...this.inflightKeys],
    };
  }

  /**
   * Fetch every source that has neither loaded nor is in flight, or
   * return the in-flight batch / the cached snapshot. Later calls never
   * restart or cancel a pending batch. A failed source stays failed
   * until a later call refetches it, so Retry repairs only what broke.
   */
  ensure(fetchers: LiveSourceFetchers): Promise<LiveSearchSnapshot> {
    if (this.batch) return this.batch;
    const pending = SOURCE_KEYS.filter((key) => !this.loaded.has(key) && !this.inflightKeys.has(key));
    if (pending.length === 0) return Promise.resolve(this.snapshot());
    this.batch = Promise.all(pending.map((key) => this.fetchOne(key, fetchers))).then(() => {
      this.batch = null;
      return this.snapshot();
    });
    return this.batch;
  }

  private async fetchOne(key: LiveSourceKey, fetchers: LiveSourceFetchers): Promise<void> {
    this.inflightKeys.add(key);
    try {
      if (key === 'issues') {
        const result = await fetchers.issues();
        if (result.ok) {
          this.cache.issues = result.data;
          this.loaded.add(key);
          this.failed.delete(key);
        } else {
          this.failed.add(key);
        }
      } else if (key === 'pages') {
        const result = await fetchers.pages();
        if (result.ok) {
          this.cache.pages = result.data;
          this.loaded.add(key);
          this.failed.delete(key);
        } else {
          this.failed.add(key);
        }
      } else {
        const result = await fetchers.requests();
        if (result.ok) {
          this.cache.requests = result.data;
          this.loaded.add(key);
          this.failed.delete(key);
        } else {
          this.failed.add(key);
        }
      }
    } catch {
      // A fetcher that throws (bridge failure, ...) is a failed source,
      // never a stuck load: the retry path can still repair it.
      this.failed.add(key);
    } finally {
      this.inflightKeys.delete(key);
    }
  }
}
