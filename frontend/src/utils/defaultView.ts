import type { ViewId } from '../components/Sidebar';

// Intelligence-first Phase 1, slice 2 (PR-B): the app opens on Intelligence —
// a question plus today's briefing — not on the Overview stats grid.
// Overview stays as a tab; only the landing view changes.
export const DEFAULT_VIEW: ViewId = 'intelligence';
