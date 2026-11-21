// Atlasync v2.1.0 Phase B — agent tool executors (Forge-backed).
//
// READ executors run under api.asUser(): Jira/Confluence enforce the
// signed-in user's own permissions, and every result is capped (max 10
// rows) before it returns. WRITE executors are only ever called from
// approveAgentAction AFTER it re-validated the action against the
// KVS-backed pending record — nothing in this file is reachable from
// the frontend directly, and nothing here is called by invokeAgent.
//
// Failures answer {ok:false, error:{kind,message}} with fixed safe
// copy; response bodies are never read into messages.

import api, { route } from '@forge/api';
import { buildSearchBody, parseJiraSearchResponse } from '../jira.js';
import { parseDevStatusResponse } from '../devstatus.js';
import { parseJsmRequests } from '../jsm.js';
import { parseJiraProjects } from '../projects.js';
import { countStalePrs, isOpenPrStatus, selectCriticalBlockers } from '../readiness.js';

const apiError = (message) => ({ ok: false, error: { kind: 'API_ERROR', message } });
const MAX_ROWS = 10;

// Flatten an Atlassian Document Format body to plain text (used by the
// P0 idempotency guard: an identical comment already on the issue means
// the escalation already happened).
function adfText(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.content)) return '';
  return body.content
    .flatMap((block) => (Array.isArray(block?.content) ? block.content : []))
    .map((node) => (typeof node?.text === 'string' ? node.text : ''))
    .join('');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Minimal Markdown → Confluence storage format. Headings, bullet
// lists and paragraphs only — anything fancier stays plain text inside
// a paragraph, which is honest and always valid storage XML.
export function markdownToStorage(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const out = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('# ')) {
      closeList();
      out.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
    } else if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  return out.join('') || '<p>(empty summary)</p>';
}

async function fetchBlockerIssues(projectKey) {
  const jql = `project = ${projectKey} AND priority IN (Highest, Critical) AND status NOT IN (Done, Closed, Resolved) ORDER BY updated DESC`;
  const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSearchBody({ jql, maxResults: MAX_ROWS })),
  });
  if (response.status >= 400) throw new Error('Jira unavailable or permission denied');
  return parseJiraSearchResponse(await response.json());
}

// --- READ tools (auto-execute) -------------------------------------------

export async function executeReadTool(name, args) {
  try {
    switch (name) {
      case 'list_jira_projects': {
        const response = await api.asUser().requestJira(route`/rest/api/3/project/search?maxResults=20`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.status >= 400) throw new Error('Jira unavailable or permission denied');
        const projects = parseJiraProjects(await response.json());
        const rows = projects.map((p) => ({ key: p.key, name: p.name, projectType: p.projectType }));
        // Kind 'project' (not 'jira'): a project is not an issue, and
        // the frontend must not count it as one in Source coverage.
        const records = rows.map((r) => ({
          kind: 'project',
          key: r.key,
          title: r.name,
          path: `/jira/software/projects/${r.key}`,
        }));
        return { ok: true, output: JSON.stringify({ count: rows.length, projects: rows }), records };
      }
      case 'get_jira_blockers': {
        const issues = await fetchBlockerIssues(args.projectKey);
        const rows = issues.map((i) => ({
          key: i.key,
          summary: i.summary,
          status: i.status,
          priority: i.priority,
          assignee: i.assignee ?? 'Unassigned',
        }));
        // Phase 1 citations: the same rows the model sees, as structured
        // records — the loop collects them so answers can link back to
        // the source issue. Never invented: only fetched rows appear.
        const records = rows.map((r) => ({
          kind: 'jira',
          key: r.key,
          title: r.summary,
          path: `/browse/${r.key}`,
        }));
        return {
          ok: true,
          output: JSON.stringify({ projectKey: args.projectKey, count: rows.length, issues: rows }),
          records,
        };
      }
      case 'get_jsm_incidents': {
        const response = await api.asUser().requestJira(route`/rest/servicedeskapi/request?limit=50`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.status >= 400) throw new Error('JSM unavailable or permission denied');
        const all = parseJsmRequests(await response.json());
        const rows = all
          .filter((r) => r.priority === args.severity)
          .slice(0, MAX_ROWS)
          .map((r) => ({ key: r.key, summary: r.summary, status: r.status, priority: r.priority }));
        const records = rows.map((r) => ({
          kind: 'jsm',
          key: r.key,
          title: r.summary,
          path: `/browse/${r.key}`,
        }));
        return {
          ok: true,
          output: JSON.stringify({ severity: args.severity, count: rows.length, requests: rows }),
          records,
        };
      }
      case 'search_confluence_runbooks': {
        const cql = `text ~ "${args.query.replaceAll('"', '')}" AND type = page`;
        const response = await api.asUser().requestConfluence(
          route`/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${MAX_ROWS}`,
          { method: 'GET', headers: { Accept: 'application/json' } },
        );
        if (response.status >= 400) throw new Error('Confluence unavailable or permission denied');
        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        const rows = results.slice(0, MAX_ROWS).map((p) => ({
          id: String(p?.id ?? ''),
          title: String(p?.title ?? '(untitled)'),
          url: p?._links?.webui ? `/wiki${p._links.webui}` : null,
        }));
        const records = rows
          .filter((r) => r.id !== '')
          .map((r) => ({ kind: 'confluence', key: r.id, title: r.title, path: r.url }));
        return {
          ok: true,
          output: JSON.stringify({ query: args.query, count: rows.length, pages: rows }),
          records,
        };
      }
      case 'get_pr_bottlenecks': {
        const issues = await fetchBlockerIssues(args.projectKey);
        const blockers = selectCriticalBlockers(issues, MAX_ROWS);
        const rows = [];
        for (const blocker of blockers) {
          if (!blocker.id) continue;
          try {
            const response = await api.asUser().requestJira(
              route`/rest/dev-status/1.0/issue/detail?issueId=${blocker.id}&applicationType=bitbucket&dataType=pullrequest`,
              { method: 'GET', headers: { Accept: 'application/json' } },
            );
            if (response.status >= 400) continue;
            const { pullRequests } = parseDevStatusResponse(await response.json());
            const open = pullRequests.filter((pr) => isOpenPrStatus(pr.status));
            if (open.length > 0) {
              rows.push({
                issueKey: blocker.key,
                summary: blocker.summary,
                pullRequests: open.map((pr) => ({ name: pr.name, status: pr.status, url: pr.url ?? null })),
              });
            }
          } catch {
            continue;
          }
        }
        const records = [];
        for (const row of rows) {
          records.push({
            kind: 'jira',
            key: row.issueKey,
            title: row.summary,
            path: `/browse/${row.issueKey}`,
          });
          for (const pr of row.pullRequests) {
            if (pr.url) {
              records.push({
                kind: 'bitbucket',
                key: pr.name,
                title: `${row.issueKey} — ${pr.name}`,
                url: pr.url,
              });
            }
          }
        }
        return {
          ok: true,
          output: JSON.stringify({
            projectKey: args.projectKey,
            count: rows.length,
            bottlenecks: rows,
            note: countStalePrs([]).note,
          }),
          records,
        };
      }
      default:
        return { ok: false, error: { kind: 'INVALID_INPUT', message: `Unknown read tool '${name}'.` } };
    }
  } catch (error) {
    if (error instanceof Error && /unavailable or permission denied/.test(error.message)) {
      return apiError('The source could not be reached or permission was denied. Check access and try again.');
    }
    return apiError('The tool call failed. Try again shortly.');
  }
}

// --- WRITE tools (approval-gated — see approveAgentAction) ---------------

export async function executeWriteTool(name, args) {
  try {
    switch (name) {
      case 'escalate_jira_blocker': {
        // Idempotency (P0): a retried/double approval must not post the
        // same comment twice. If the exact comment text is already on
        // the issue, skip the POST and only ensure the priority. A failed
        // comments read fails open — the approved action still runs; the
        // guard is duplicate-prevention, not a gate.
        let commentAlreadyPresent = false;
        try {
          const commentsResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}/comment`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (commentsResponse.status < 400) {
            const commentsData = await commentsResponse.json();
            const comments = Array.isArray(commentsData?.comments) ? commentsData.comments : [];
            commentAlreadyPresent = comments.some((c) => adfText(c?.body) === args.comment);
          }
        } catch {
          // best-effort guard only
        }
        let commentAdded = false;
        if (!commentAlreadyPresent) {
          const commentResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}/comment`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              body: {
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text: args.comment }] }],
              },
            }),
          });
          if (commentResponse.status >= 400) {
            return apiError(`Could not add the escalation comment to ${args.issueKey}. Nothing was changed.`);
          }
          commentAdded = true;
        }
        const priorityResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}`, {
          method: 'PUT',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { priority: { name: args.priority } } }),
        });
        if (priorityResponse.status >= 400) {
          // The comment already landed — say so plainly, do not hide it.
          return {
            ok: false,
            error: {
              kind: 'API_ERROR',
              message: `The escalation comment was added to ${args.issueKey}, but the priority could not be set to ${args.priority}. The comment is live; the priority is unchanged.`,
            },
          };
        }
        return {
          ok: true,
          result: {
            issueKey: args.issueKey,
            commentAdded,
            commentSkippedDuplicate: commentAlreadyPresent,
            prioritySet: args.priority,
          },
        };
      }
      case 'transition_jira_issue': {
        const listResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}/transitions`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (listResponse.status >= 400) {
          return apiError(`Could not read the available transitions for ${args.issueKey}. Nothing was changed.`);
        }
        const data = await listResponse.json();
        const transitions = Array.isArray(data?.transitions) ? data.transitions : [];
        const match = transitions.find(
          (t) => typeof t?.name === 'string' && t.name.trim().toLowerCase() === args.transitionName.toLowerCase(),
        );
        if (!match) {
          const names = transitions.map((t) => t?.name).filter(Boolean).slice(0, 10).join(', ') || '(none listed)';
          return {
            ok: false,
            error: {
              kind: 'INVALID_INPUT',
              message: `No transition named '${args.transitionName}' exists for ${args.issueKey}. Available: ${names}. Nothing was changed.`,
            },
          };
        }
        // Idempotency (P0): if the issue is already in the status this
        // transition leads to, the action already happened — report
        // success without re-posting. A failed status read fails open;
        // the transitions list itself already blocks a harmful duplicate
        // (an unavailable transition answers INVALID_INPUT above).
        try {
          const currentResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}?fields=status`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (currentResponse.status < 400) {
            const currentData = await currentResponse.json();
            const currentStatus = currentData?.fields?.status?.name;
            const targetStatus = match?.to?.name;
            if (
              typeof currentStatus === 'string' &&
              typeof targetStatus === 'string' &&
              currentStatus.trim().toLowerCase() === targetStatus.trim().toLowerCase()
            ) {
              return {
                ok: true,
                result: {
                  issueKey: args.issueKey,
                  toStatus: match.name,
                  transitionId: String(match.id),
                  alreadyInStatus: true,
                },
              };
            }
          }
        } catch {
          // best-effort guard only
        }
        const doResponse = await api.asUser().requestJira(route`/rest/api/3/issue/${args.issueKey}/transitions`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ transition: { id: match.id } }),
        });
        if (doResponse.status >= 400) {
          return apiError(`Could not move ${args.issueKey} to '${args.transitionName}'. Nothing was changed.`);
        }
        return { ok: true, result: { issueKey: args.issueKey, toStatus: match.name, transitionId: String(match.id) } };
      }
      case 'create_confluence_release_report': {
        const spaceResponse = await api.asUser().requestConfluence(
          route`/wiki/api/v2/spaces?keys=${encodeURIComponent(args.spaceKey)}`,
          { method: 'GET', headers: { Accept: 'application/json' } },
        );
        if (spaceResponse.status >= 400) {
          return apiError(`Could not find Confluence space '${args.spaceKey}'. Nothing was created.`);
        }
        const spaceData = await spaceResponse.json();
        const space = Array.isArray(spaceData?.results) ? spaceData.results[0] : null;
        if (!space?.id) {
          return {
            ok: false,
            error: { kind: 'INVALID_INPUT', message: `No Confluence space with key '${args.spaceKey}' exists. Nothing was created.` },
          };
        }
        // Idempotency (P0): a page with this exact title in this space
        // means the report already exists — return it instead of
        // creating a duplicate. A failed lookup fails open.
        try {
          const existingResponse = await api.asUser().requestConfluence(
            route`/wiki/api/v2/pages?spaceId=${space.id}&title=${encodeURIComponent(args.title)}&status=current`,
            { method: 'GET', headers: { Accept: 'application/json' } },
          );
          if (existingResponse.status < 400) {
            const existingData = await existingResponse.json();
            const existing = (Array.isArray(existingData?.results) ? existingData.results : []).find(
              (p) => p?.title === args.title,
            );
            if (existing?.id) {
              return {
                ok: true,
                result: {
                  spaceKey: args.spaceKey,
                  pageId: String(existing.id),
                  title: args.title,
                  url: `/wiki/spaces/${args.spaceKey}/pages/${existing.id}`,
                  alreadyExists: true,
                },
              };
            }
          }
        } catch {
          // best-effort guard only
        }
        const pageResponse = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceId: space.id,
            status: 'current',
            title: args.title,
            body: { representation: 'storage', value: markdownToStorage(args.markdownSummary) },
          }),
        });
        if (pageResponse.status >= 400) {
          return apiError(`Could not create the page in space '${args.spaceKey}'. Nothing was created.`);
        }
        const page = await pageResponse.json();
        return {
          ok: true,
          result: {
            spaceKey: args.spaceKey,
            pageId: String(page?.id ?? ''),
            title: args.title,
            url: page?.id ? `/wiki/spaces/${args.spaceKey}/pages/${page.id}` : null,
          },
        };
      }
      default:
        return { ok: false, error: { kind: 'INVALID_INPUT', message: `Unknown write tool '${name}'.` } };
    }
  } catch {
    return apiError('The approved action failed. Check access and try again.');
  }
}
