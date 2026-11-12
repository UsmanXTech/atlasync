import type { BriefingDigest, BriefingItem } from './briefing';

export interface BriefingTeaser {
  blocker: BriefingItem | null;
  stale: BriefingItem | null;
}

/**
 * The Overview teaser's two rows, picked from the rules-based digest.
 *
 * - Blocker: the single highest-priority open issue (digest order is
 *   already priority-then-oldest). No age threshold — Highest/High
 *   priority IS the threshold.
 * - Stale: the oldest open issue that is actually untouched for at
 *   least `staleDays` days. An item with no usable updated date is
 *   not provably stale, so it never qualifies; the same issue is
 *   never shown twice (if the top blocker is also the oldest item,
 *   the next-oldest qualifying item is used).
 *
 * The Overview card shows at most these two rows: the full lists
 * live in the Intelligence briefing, one tap away.
 */
export const STALE_THRESHOLD_DAYS = 14;

export function pickBriefingTeaser(digest: BriefingDigest, staleDays = STALE_THRESHOLD_DAYS): BriefingTeaser {
  const blocker = digest.blockers[0] ?? null;
  const stale =
    digest.staleItems.find(
      (item) =>
        item.key !== blocker?.key && item.ageDays !== null && item.ageDays >= staleDays,
    ) ?? null;
  return { blocker, stale };
}
