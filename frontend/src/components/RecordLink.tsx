// RecordLink — a record title/key that opens the ORIGINAL record in
// Jira / Confluence (new tab, via @forge/bridge router.open). Plain <a>
// anchors are dead inside the Forge Custom UI iframe, so rows use this
// button instead. When no URL can be built (site URL unknown, or the
// record has no usable identity) it renders plain text — never a link
// to nowhere.
import type { ReactNode } from 'react';
import { openRecordUrl } from '../utils/recordLinks';

export default function RecordLink({ url, label, children }: { url: string | null | undefined; label?: string; children: ReactNode }) {
  if (!url) return <span>{children}</span>;
  return (
    <button type="button" className="link-btn" title={url} aria-label={label ?? `Open original record`} onClick={() => void openRecordUrl(url)}>
      {children}
    </button>
  );
}
