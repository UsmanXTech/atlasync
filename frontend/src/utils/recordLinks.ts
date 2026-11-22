// Record links — one place that turns a live record's identity into the
// URL of the ORIGINAL record in Jira / Confluence, and opens it.
//
// Decision (visual-behaviour-test fix #1): clicks open the original
// record via @forge/bridge router.open (new tab). Plain <a> anchors are
// dead inside the Forge Custom UI iframe, so every record row, search
// result and Intelligence citation goes through openRecordUrl. This is
// flippable to in-app navigation later — only this module changes.
//
// URL shapes (match the backend citation paths in
// forge-app/src/agent/toolExecutors.js):
//   Jira issue / JSM request: {siteUrl}/browse/{key}
//   Confluence page: {siteUrl}/wiki{webui} when the API returned
//     _links.webui ("/spaces/AT/pages/12"), else
//     {siteUrl}/wiki/spaces/{spaceId}/pages/{id}
//   Jira project: {siteUrl}/jira/software/projects/{key} (software),
//     /jira/servicedesk/projects/{key} (service_desk),
//     /jira/core/projects/{key} (business); unknown types get no link.
import type { Citation } from '../services/agent';

export type SearchRecordIdentity =
  | { kind: 'issue'; key: string }
  | { kind: 'request'; key: string }
  | { kind: 'page'; id: string; spaceId: string | null; webui?: string | null };

function joinSite(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

export function jiraIssueUrl(siteUrl: string | null | undefined, key: string | undefined | null): string | null {
  if (!siteUrl || !key) return null;
  return `${joinSite(siteUrl)}/browse/${encodeURIComponent(key)}`;
}

export function jsmRequestUrl(siteUrl: string | null | undefined, key: string | undefined | null): string | null {
  return jiraIssueUrl(siteUrl, key);
}

export function confluencePageUrl(
  siteUrl: string | null | undefined,
  page: { id: string; spaceId?: string | null; webui?: string | null },
): string | null {
  if (!siteUrl || !page.id) return null;
  const base = joinSite(siteUrl);
  if (typeof page.webui === 'string' && page.webui !== '') {
    if (page.webui.startsWith('/wiki/') || page.webui === '/wiki') return `${base}${page.webui}`;
    if (page.webui.startsWith('/')) return `${base}/wiki${page.webui}`;
    return null;
  }
  if (page.spaceId) return `${base}/wiki/spaces/${encodeURIComponent(page.spaceId)}/pages/${encodeURIComponent(page.id)}`;
  return null;
}

export function jiraProjectUrl(
  siteUrl: string | null | undefined,
  project: { key: string; projectType?: string },
): string | null {
  if (!siteUrl || !project.key) return null;
  const base = joinSite(siteUrl);
  const key = encodeURIComponent(project.key);
  if (project.projectType === 'service_desk') return `${base}/jira/servicedesk/projects/${key}`;
  if (project.projectType === 'business') return `${base}/jira/core/projects/${key}`;
  if (project.projectType === 'software') return `${base}/jira/software/projects/${key}`;
  return null;
}

export function recordUrl(siteUrl: string | null | undefined, record: SearchRecordIdentity): string | null {
  if (record.kind === 'issue') return jiraIssueUrl(siteUrl, record.key);
  if (record.kind === 'request') return jsmRequestUrl(siteUrl, record.key);
  return confluencePageUrl(siteUrl, record);
}

// Citation URL: an absolute `url` is used as-is; otherwise the
// site-relative `path` is prefixed with the site URL (same rule the
// Intelligence view already used).
export function citationUrl(siteUrl: string | null | undefined, citation: Pick<Citation, 'path' | 'url'>): string | null {
  if (citation.url) return citation.url;
  if (siteUrl && citation.path) return `${joinSite(siteUrl)}${citation.path}`;
  return null;
}

// Open a record URL in a new tab through the Forge bridge. Best-effort:
// a failed open resolves false instead of throwing into a click handler.
export async function openRecordUrl(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const { router } = await import('@forge/bridge');
    await router.open(url);
    return true;
  } catch {
    return false;
  }
}
