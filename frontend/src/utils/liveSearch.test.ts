import assert from 'node:assert';
import { describe, it } from 'node:test';
import { LiveSearchLoader } from './liveSearch.ts';
import type { LiveSearchSources } from './liveSearch.ts';

// Regression test — live search race (second ChatGPT review, main 65bbcf5).
// The old Topbar effect depended on `liveState` and cancelled the
// in-flight fetch in its cleanup: `setLiveState('loading')` re-ran the
// effect, the new run exited on the `liveState !== 'idle'` guard, and the
// first fetch's response was discarded — the dropdown stuck in
// "Searching live sources…" on the very first query. The fetch lifecycle
// now lives in LiveSearchLoader (Topbar only starts it, never cancels
// it); these tests drive the loader through the exact sequence React
// performs — effect run, re-run on the loading state change, query change
// while pending — and assert the fetch still settles.
//
// Note: the repo has no DOM test harness (Node cannot import .tsx, and
// the workspace's hoisted React 18 copy crashes react-dom 19 in vitest),
// so the lifecycle is tested here and the component is verified in the
// headless-Chromium preview. If the loader ever regains cancel-on-rerun
// semantics, these tests fail.
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

describe('LiveSearchLoader', () => {
  it('a slow first fetch still settles after the effect re-runs and the query changes', async () => {
    const loader = new LiveSearchLoader();
    const gate = deferred<LiveSearchSources>();
    let fetchCalls = 0;
    const fetch = () => {
      fetchCalls += 1;
      return gate.promise;
    };

    // Effect run 1 (first query): starts the fetch.
    const first = loader.ensure(fetch);
    assert.equal(loader.isFetching, true);
    // React re-runs the effect when liveState flips to 'loading', and
    // again when the user types more characters while the fetch is
    // pending. In the old effect both re-runs cancelled the in-flight
    // fetch; here they must return the SAME promise — no restart, no
    // cancel — and the fetch must run exactly once.
    assert.equal(loader.ensure(fetch), first);
    assert.equal(loader.ensure(fetch), first);
    assert.equal(fetchCalls, 1);

    // The first fetch finally resolves: the caller gets the sources and
    // the loader reports them cached (the component sets 'ready').
    gate.resolve(SOURCES);
    assert.deepEqual(await first, SOURCES);
    assert.equal(loader.hasSources, true);
    assert.equal(loader.isFetching, false);
    // A later query reuses the cache without refetching.
    assert.deepEqual(await loader.ensure(fetch), SOURCES);
    assert.equal(fetchCalls, 1);
  });

  it('a total failure resets the loader so Retry fetches again, and the rejected first fetch cannot clobber the second', async () => {
    const loader = new LiveSearchLoader();
    const firstGate = deferred<LiveSearchSources>();
    let fetchCalls = 0;
    const firstFetch = () => {
      fetchCalls += 1;
      return firstGate.promise;
    };
    const first = loader.ensure(firstFetch);
    assert.equal(loader.isFetching, true);
    firstGate.reject(new Error('live search failed'));
    await assert.rejects(first);
    assert.equal(loader.hasSources, false);
    assert.equal(loader.isFetching, false);

    // Retry: a fresh fetch starts, and its result is the one delivered —
    // the rejected first fetch has no second chance to overwrite state.
    const secondGate = deferred<LiveSearchSources>();
    const secondFetch = () => {
      fetchCalls += 1;
      return secondGate.promise;
    };
    const second = loader.ensure(secondFetch);
    assert.notEqual(second, first);
    assert.equal(fetchCalls, 2);
    secondGate.resolve(SOURCES);
    assert.deepEqual(await second, SOURCES);
    assert.equal(loader.hasSources, true);
  });
});
