# Atlasync — Demo Guide

> **Live-only build.** Every surface reads live data — Jira issues/projects, Confluence page metadata, JSM requests, linked PR lookups, and Forge LLM Intelligence — inside an updated Forge install. Preview mode cannot access the Forge backend, so it shows backend-unreachable states instead of fake data.

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
| 30–55s | Read the answer out loud: the readiness score, then its evidence — the top Jira blocker, the open SEV-1/2 incident, the stale PR on a critical issue. | Every claim traces to a record in another tool. That traceability *is* the product. |
| 55–75s | Flip to **Overview → Critical blockers** and open one record in Jira (clicks open the original record). Press **Sync Portfolio** and watch the counts refresh from live sources. | The UI is live and data-driven, not a screenshot. |
| 75–90s | Close on the roadmap: scheduled snapshots and per-record navigation are next. | Judges see what is live today and what comes next. |

## Recommended scenario: "Are we ready to release?"

Ask Intelligence the readiness question and read the verdict against the
live snapshot: the score comes from the backend (critical blockers,
SEV-1/2 incidents, stale PRs, unassigned work), and every claim in the
answer cites the live record behind it — the top Jira blocker, the open
SEV-1/2 incident, the stale PR on a critical issue. The numbers change
with the site's real data; there are no fixed demo records to quote, so
read the live values on the day.

Use this scenario because it is the only one where all four tools matter to
a single decision. A generic dashboard tour hides that; this question shows it.

## What is live

Nothing is mocked. Every surface reads live data through the Forge
backend under the signed-in user's own permissions; empty results render
honest empty states. The standalone preview has no backend, so it shows
backend-unreachable states instead of fake data.

## Live data (Forge only)

In a Forge-installed app, the Overview **Jira issues** card loads real
issues (key, summary, status, priority, assignee, updated) through the
Forge backend — read-only, at most 50 issues, newest first. Live behavior
against a real Forge installation is verified (2026-11-09 and 2026-11-21
on the Codegeist dev site: 9 Jira issues, 12 Confluence pages, 1 JSM
request, 2 projects, live Intelligence answers). In the preview, the same
card shows a backend-unreachable state instead of fake live data.

### Linked pull requests (Task 6, Architecture A)

Each live issue can expand a **Linked pull requests** section, read
through the Jira Development Status API (`getIssueDevStatus`, no
Bitbucket scope, no manifest change). A PR only appears when a
Bitbucket workspace is linked to the Jira site through DVCS and the PR
references the issue key — until then the section honestly reports
zero linked PRs and how to link one. Implemented on branch
`feature/dev-status-bitbucket` (tests 27/27); deploy and live
verification still pending at the time of writing.

## Live integration coverage

1. **Jira** (read) — issues, projects, blockers, readiness (backend-computed).
2. **Bitbucket** (read) — linked PRs via the Jira dev-status API; 0 with owner setup guidance until a workspace is linked via DVCS.
3. **Confluence** (read) — spaces, pages, recent edits.
4. **JSM** (read) — requests, incidents by priority.
5. **Forge Intelligence** — live LLM answers over a bounded snapshot, with approval-gated writes (escalate, transition, release report).
6. **Forge storage** — session memory + execution history; scheduled snapshots are paused while the snapshot identity model is redesigned.

## Known limitations

- Live data needs a Forge installation: deploy needs an Atlassian login
  and dev site (`forge login → register → deploy → install`). The
  standalone preview shows backend-unreachable states instead.
- Snapshots are paused (snapshot identity is being redesigned), so the
  Insights trend chart is empty by design.
- `npm test` checks the resolver's structure, not live Forge execution
  (the official `new Resolver()` pattern resolves differently in plain Node).
- Search is hidden below 640px width (mobile keeps nav + actions only).
- The app is dark-first; no light theme.

## Run it yourself

```bash
npm ci
npm run build
npm run preview   # or: npm run dev
```

Then open the printed localhost URL. The topbar shows "Preview"
outside Forge; inside a Forge iframe the same build shows "Forge connected".
