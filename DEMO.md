# Atlasync — Demo Guide

> **Demo build.** Everything below runs on sample data. No live Atlassian
> connection exists yet — the dashboard says so on screen (MOCK DATA badge,
> "Preview mode", "Demo connected", "Sample response").

## The problem

A release decision lives in four places at once. The blocker is in Jira,
the incident is in Jira Service Management, the failing build is in
Bitbucket, and the runbook that explains the blast radius is in Confluence.
Nobody holds all four in their head at the moment the team asks: *can we
ship?* So releases slip, or ship blind.

## The solution

**Atlasync — Every Atlassian Tool, One Sync.** One view that pulls the
context of all four tools together and answers the release question with
its evidence attached. Not four dashboards side by side — one verdict,
traced to the exact issue, incident, PR, and doc behind it.

## 60–90 second demo flow

| Time | What to do | What it proves |
|---|---|---|
| 0–10s | Open **Overview**. Point at the four stat cards. | One screen already spans Jira, Bitbucket, and JSM. |
| 10–30s | Go to **Intelligence** and ask: *"Are we ready to release Atlas v2?"* | The headline feature: a cross-tool verdict, not a chart. |
| 30–55s | Read the answer out loud: **72% ready**, then its evidence — ATLAS-482 (Jira blocker), INC-91 (Sev1 incident), the failing Cart totals PR (Bitbucket). | Every claim traces to a record in another tool. That traceability *is* the product. |
| 55–75s | Flip to **Overview → Active blockers**, resolve one, and show the counts move. Switch workspace to **Platform** and watch the whole dashboard re-filter. | The UI is live and data-driven, not a screenshot. |
| 75–90s | Close on the roadmap: live reads replace the mock layer, same components. | Judges see exactly what is demo and what comes next. |

## Recommended scenario: "Are we ready to release Atlas v2?"

The answer is **no — 72%, not yet**. Two critical items stand in the way:

1. **ATLAS-482** (Jira, critical, 4 days open) — checkout timeout under load.
2. **INC-91** (JSM, Sev1, investigating) — payments API latency spike.

Plus the risk the answer names explicitly: the checkout path is touched by
*both* the open blocker *and* the failing PR, so releasing now risks payment
failures at peak traffic. Suggested next actions come with owners and dues
(Sara Khan — today; on-call — today).

Use this scenario because it is the only one where all four tools matter to
a single decision. A generic dashboard tour hides that; this question shows it.

## What is currently mocked

- All projects, issues, blockers, docs, PRs, incidents, and activity
  (`frontend/src/data/mock.ts`).
- All AI answers, including the Atlas v2 verdict — fixed sample responses,
  labeled "Sample response · Mock data". No AI service is called.
- Integration "Demo connected" states, sync timestamps, and item counts.
- Workspace switching, search, filters, toggles, and Resolve — real UI
  state over the mock dataset.

## What live integrations are planned

1. **Jira** (read) — issues, sprints, releases; per-issue blocker graph.
2. **Bitbucket** (read) — PRs, reviewers, build statuses.
3. **Confluence** (read) — spaces, pages, recent edits linked to issues.
4. **JSM** (read) — incidents, severity, service health.
5. **Forge storage + scheduled triggers** — hourly sync snapshots and
   readiness history, replacing the mock layer without changing components.
6. **Rovo agent + MCP tools** — the Intelligence panel backed by a real
   agent over the synced context (read-only first; careful writes last).

## Known limitations

- No live Atlassian data: deploy needs an Atlassian login and dev site
  (`forge login → register → deploy → install`).
- The resolver exposes `getStatus` only; no sync reads yet.
- `npm test` checks the resolver's structure, not live Forge execution
  (the official `new Resolver()` pattern resolves differently in plain Node).
- Search is hidden below 640px width (mobile keeps nav + actions only).
- The app is dark-first; no light theme.
- Demo data covers two workspaces; a real install would page through many more.

## Run it yourself

```bash
npm ci
npm run build
npm run preview   # or: npm run dev
```

Then open the printed localhost URL. The topbar shows "Preview mode"
outside Forge; inside a Forge iframe the same build shows "Forge connected".
