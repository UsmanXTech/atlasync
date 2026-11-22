// The Jira site URL, shared by every record link (cards, search,
// Intelligence citations). Fetches once per session through the cached
// getSiteInfo service; null while unknown or unavailable — callers
// render plain text when there is no URL to open.
import { useEffect, useState } from 'react';
import { getSiteInfo } from '../services/conversations';

export function useSiteUrl(): string | null {
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getSiteInfo().then((r) => {
      if (alive && r.ok) setSiteUrl(r.siteUrl);
    });
    return () => {
      alive = false;
    };
  }, []);
  return siteUrl;
}
