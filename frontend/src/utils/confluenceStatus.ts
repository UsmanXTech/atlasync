// Tone class for a Confluence page status pill. Confluence v2 page
// statuses are 'current' (published, live), 'archived', 'draft' and
// 'trashed'. The pill text stays the raw status (Confluence's own word,
// capitalised by CSS) — only the tone is derived, so an unknown status
// degrades to the neutral grey instead of an unstyled pill.
export type ConfluenceStatusTone = 'healthy' | 'pending' | 'blocked';

export function confluenceStatusTone(status: string): ConfluenceStatusTone {
  switch (status.trim().toLowerCase()) {
    case 'current':
      return 'healthy';
    case 'trashed':
      return 'blocked';
    default:
      return 'pending';
  }
}
