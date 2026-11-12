import type { LiveConfluencePage, LiveIssue, LiveJsmRequest } from '../data/types';
import { computeBriefingDigest, type BriefingDigest } from './briefing.ts';

export type BriefingState =
  | { status: 'loading' }
  | { status: 'ready'; digest: BriefingDigest; confluenceCount: number; jsmCount: number; warnings: string[] }
  | { status: 'unavailable'; message: string };

export interface BriefingFetchResults {
  jira: { ok: true; issues: LiveIssue[] } | { ok: false; error: { kind: string; message: string } };
  confluence: { ok: true; pages: LiveConfluencePage[] } | { ok: false; error: { kind: string; message: string } };
  jsm: { ok: true; requests: LiveJsmRequest[] } | { ok: false; error: { kind: string; message: string } };
}

export const BRIEFING_UNAVAILABLE_MESSAGE =
  'Live briefing appears when installed in Forge. This standalone preview does not contain live Atlassian records.';

/**
 * Pure reduce of the three live-source fetches into the briefing state.
 * Kept pure (no services, no React) so the node test runner can cover
 * it: the hook only fetches and hands its results here.
 *
 * - `unavailable` only when ALL THREE sources fail with
 *   BACKEND_UNREACHABLE (no backend at all — the standalone preview).
 *   Any other failure shape is a partial failure, not a missing
 *   installation: the digest is computed from whatever loaded, and
 *   each failed source is named in `warnings` so the card can show it
 *   instead of silently dropping a source.
 */
export function reduceBriefingResults({ jira, confluence, jsm }: BriefingFetchResults): BriefingState {
  const failures = [jira, confluence, jsm].filter((result) => !result.ok);
  if (failures.length === 3 && failures.every((result) => !result.ok && result.error.kind === 'BACKEND_UNREACHABLE')) {
    return { status: 'unavailable', message: BRIEFING_UNAVAILABLE_MESSAGE };
  }
  const warnings = [
    ...(!jira.ok ? [`Jira unavailable: ${jira.error.message}`] : []),
    ...(!confluence.ok ? [`Confluence unavailable: ${confluence.error.message}`] : []),
    ...(!jsm.ok ? [`JSM unavailable: ${jsm.error.message}`] : []),
  ];
  return {
    status: 'ready',
    digest: computeBriefingDigest(jira.ok ? jira.issues : []),
    confluenceCount: confluence.ok ? confluence.pages.length : 0,
    jsmCount: jsm.ok ? jsm.requests.length : 0,
    warnings,
  };
}
