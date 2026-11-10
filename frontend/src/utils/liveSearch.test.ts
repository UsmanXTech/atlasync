import assert from 'node:assert';
import { describe, it } from 'node:test';
import { LiveSearchLoader, type LiveSourceFetchers, type LiveSourceKey } from './liveSearch.ts';
import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';
import type { LiveSearchSources } from './liveSearch.ts';

// Regression tests — live-search lifecycle (second + third ChatGPT reviews).
//
// Second review (main 65bbcf5): the old Topbar effect depended on
// `liveState` and cancelled the in-flight fetch in its cleanup, so the
// dropdown stuck in "Searching live sources…" on the very first query.
// The fetch lifecycle lives in LiveSearchLoader; these tests drive the
// loader through the exact sequence React performs and assert the fetch
// still settles.
//
// Third review (main 63ceb31): the three sources were fetched as one
// Promise.all and a partial failure was silently replaced with an empty
// array — the failed source could never be retried in the session and
// the user saw a misleading "No live matches". Each source now tracks
// its own loaded / failed state, and a retry refetches ONLY the failed
// sources and merges the result into the cache.
//
// Note: the repo has no DOM test harness (Node cannot import .tsx, and
// the workspace's hoisted React 18 copy crashes react-dom 19 in vitest),
// so the lifecycle is tested here and the component is verified in the
// headless-Chromium preview.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const SOURCES: LiveSearchSources = {
  issues: [
    {
      key: 'AT-9',
      id: '10009',
      summary: 'Zebra sync regression',
      status: 'In Progress',
      priority: 'High',
      assignee: null,
      updated: '',
    },
  ],
  pages: [{ id: 'p9', title: 'Zebra runbook', status: 'current', spaceId: null, updated: '' }],
  requests: [
    {
      key: 'AS-9',
      summary: 'Zebra VPN access',
      status: 'Open',
      requestType: 'Access request',
      priority: null,
      created: '',
    },
  ],
};

function succeedingFetchers(calls: Record<LiveSourceKey, number>): LiveSourceFetchers {
  return {
    issues: async () => {
      calls.issues += 1;
      return { ok: true as const, data: SOURCES.issues };
    },
    pages: async () => {
      calls.pages += 1;
      return { ok: true as const, data: SOURCES.pages };
    },
    requests: async () => {
      calls.requests += 1;
      return { ok: true as const, data: SOURCES.requests };
    },
  };
}

describe('LiveSearchLoader', () => {
  it('a slow first fetch still settles after the effect re-runs and the query changes', async () => {
    const loader = new LiveSearchLoader();
    const gates = {
      issues: deferred<LiveIssue[]>(),
      pages: deferred<LiveConfluencePage[]>(),
      requests: deferred<LiveJsmRequest[]>(),
    };
    const calls: Record<LiveSourceKey, number> = { issues: 0, pages: 0, requests: 0 };
    const fetchers: LiveSourceFetchers = {
      issues: () => {
        calls.issues += 1;
        return gates.issues.promise.then((data) => ({ ok: true as const, data }));
      },
      pages: () => {
        calls.pages += 1;
        return gates.pages.promise.then((data) => ({ ok: true as const, data }));
      },
      requests: () => {
        calls.requests += 1;
        return gates.requests.promise.then((data) => ({ ok: true as const, data }));
      },
    };

    // Effect run 1 (first query): starts the fetch.
    const first = loader.ensure(fetchers);
    assert.equal(loader.isFetching, true);
    // React re-runs the effect when liveState flips to 'loading', and
    // again when the user types more characters while the fetch is
    // pending. In the old effect both re-runs cancelled the in-flight
    // fetch; here they must return the SAME promise — no restart, no
    // cancel — and each source must be fetched exactly once.
    assert.equal(loader.ensure(fetchers), first);
    assert.equal(loader.ensure(fetchers), first);
    assert.deepEqual(calls, { issues: 1, pages: 1, requests: 1 });

    // The first fetch finally resolves: the caller gets the sources and
    // the loader reports them cached (the component sets 'ready').
    gates.issues.resolve(SOURCES.issues);
    gates.pages.resolve(SOURCES.pages);
    gates.requests.resolve(SOURCES.requests);
    const snapshot = await first;
    assert.deepEqual(snapshot.sources, SOURCES);
    assert.deepEqual(snapshot.failed, []);
    assert.equal(loader.hasSources, true);
    assert.equal(loader.isFetching, false);
    // A later query reuses the cache without refetching.
    assert.deepEqual(await loader.ensure(fetchers), snapshot);
    assert.deepEqual(calls, { issues: 1, pages: 1, requests: 1 });
  });

  it('a total failure marks every source failed and Retry refetches all three', async () => {
    const loader = new LiveSearchLoader();
    const calls: Record<LiveSourceKey, number> = { issues: 0, pages: 0, requests: 0 };
    const failing: LiveSourceFetchers = {
      issues: async () => {
        calls.issues += 1;
        return { ok: false as const };
      },
      pages: async () => {
        calls.pages += 1;
        return { ok: false as const };
      },
      requests: async () => {
        calls.requests += 1;
        return { ok: false as const };
      },
    };
    const snapshot = await loader.ensure(failing);
    assert.deepEqual([...snapshot.failed].sort(), ['issues', 'pages', 'requests']);
    assert.deepEqual(snapshot.sources, { issues: [], pages: [], requests: [] });
    assert.equal(loader.hasSources, false);
    assert.equal(loader.isFetching, false);

    // Retry: a fresh fetch of all three starts, and its result is the
    // one delivered — nothing is cached from the failed attempt.
    const retried = await loader.ensure(succeedingFetchers(calls));
    assert.deepEqual(retried.sources, SOURCES);
    assert.deepEqual(retried.failed, []);
    assert.deepEqual(calls, { issues: 2, pages: 2, requests: 2 });
  });

  it('a partial failure keeps the good sources, marks the failed one, and Retry refetches only it', async () => {
    const loader = new LiveSearchLoader();
    const calls: Record<LiveSourceKey, number> = { issues: 0, pages: 0, requests: 0 };
    const first: LiveSourceFetchers = {
      issues: async () => {
        calls.issues += 1;
        return { ok: false as const };
      },
      pages: async () => {
        calls.pages += 1;
        return { ok: true as const, data: SOURCES.pages };
      },
      requests: async () => {
        calls.requests += 1;
        return { ok: true as const, data: SOURCES.requests };
      },
    };
    const snapshot = await loader.ensure(first);
    // Not a clean 'ready': the failed source is named, while the good
    // sources still delivered their records.
    assert.deepEqual(snapshot.failed, ['issues']);
    assert.deepEqual(snapshot.sources.pages, SOURCES.pages);
    assert.deepEqual(snapshot.sources.requests, SOURCES.requests);
    assert.deepEqual(snapshot.sources.issues, []);
    assert.equal(loader.hasSources, true);

    // Retry: only the failed source is refetched — the loaded sources
    // are never fetched again — and the result merges into the cache.
    const retried = await loader.ensure(succeedingFetchers(calls));
    assert.deepEqual(retried.sources, SOURCES);
    assert.deepEqual(retried.failed, []);
    assert.deepEqual(calls, { issues: 2, pages: 1, requests: 1 });
  });

  it('a throwing source fetch is a failure, not a stuck load, and its retry cannot be clobbered', async () => {
    const loader = new LiveSearchLoader();
    const calls: Record<LiveSourceKey, number> = { issues: 0, pages: 0, requests: 0 };
    const throwing: LiveSourceFetchers = {
      issues: async () => {
        calls.issues += 1;
        throw new Error('bridge down');
      },
      pages: async () => {
        calls.pages += 1;
        return { ok: true as const, data: SOURCES.pages };
      },
      requests: async () => {
        calls.requests += 1;
        return { ok: true as const, data: SOURCES.requests };
      },
    };
    const snapshot = await loader.ensure(throwing);
    assert.deepEqual(snapshot.failed, ['issues']);
    assert.equal(loader.isFetching, false);

    // Retry: the throwing source is fetched again and merges; the
    // rejected first fetch has no second chance to overwrite state.
    const retried = await loader.ensure(succeedingFetchers(calls));
    assert.deepEqual(retried.sources, SOURCES);
    assert.deepEqual(retried.failed, []);
    assert.deepEqual(calls, { issues: 2, pages: 1, requests: 1 });
  });
});
