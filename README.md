# Atlasync — Every Atlassian Tool, One Sync

![CI](https://github.com/UsmanXTech/atlasync/actions/workflows/ci.yml/badge.svg)

> Build with context. Ship with confidence.

> Demo guide for judges and reviewers: [DEMO.md](./DEMO.md) — the 60–90
> second flow, the "Are we ready to release Atlas v2?" scenario, what is
> live, and what is demo data.

Atlasync is an Atlassian Forge app built for **Codegeist 2026**. It gives teams one synced view across every Atlassian tool they use — Jira, Confluence, Bitbucket, and Jira Service Management — so the context behind work is always in one place, instead of scattered across silos.

**Status:** Premium Forge dashboard with live read-only Jira issues/projects, Confluence pages, JSM requests, Jira-linked Bitbucket PRs, and Forge-hosted Intelligence. Overview sample metrics remain demo data; Projects, Insights source counts, Integrations health checks, and Intelligence now use live reads.

## Vision

Teams plan in Jira, document in Confluence, review code in Bitbucket, and handle incidents in JSM. Each tool holds a piece of the story, but no single place shows how they connect. Atlasync syncs context across all of them so a team can answer, at a glance: what changed, what it affects, who owns it, and what needs attention next.

Principles:

- **One sync, every tool** — a single, consistent view across Jira, Confluence, Bitbucket, and JSM.
- **Context over noise** — surface what matters for the work at hand, not a raw feed of everything.
- **Read-first, act carefully** — reads are the foundation; any write action is explicit, scoped, and reversible where possible.
- **Honest data** — if a source is unavailable, the app says so and degrades per source instead of showing stale or invented data.

## Architecture

```text
┌─────────────────────────────┐
│  frontend/  (Custom UI)     │  React + TypeScript + Vite
│  The app surface teams see  │
└──────────────┬──────────────┘
               │  @forge/bridge invoke
┌──────────────▼──────────────┐
│  forge-app/  (Resolver)     │  Forge functions (Node.js 24)
│  Owns reads, storage, sync  │
└──────┬──────────────┬───────┘
       │              │
┌──────▼──────┐  ┌────▼────────┐
│ integrations│  │   agents/   │
│ One adapter │  │ Rovo agents │
│ per tool    │  │ & MCP tools │
└─────────────┘  └─────────────┘
       ┌──────────────┐
       │   shared/    │
       │ Shared types │
       └──────────────┘
```

- **frontend/** — the Forge Custom UI app (React + TypeScript + Vite). It renders the synced view and talks to the backend only through the Forge bridge (`invoke`). It never calls Atlassian APIs directly.
- **forge-app/** — the Forge backend: `manifest.yml` plus a resolver (`src/index.js`). It owns all Atlassian API access, per-installation storage, and sync orchestration.
- **integrations/** — placeholder directories for one adapter per Atlassian tool (Jira, Confluence, Bitbucket, JSM). The live adapters currently live in `forge-app/src/` (`jira.js`, `confluence.js`, `jsm.js`, `projects.js`, `devstatus.js`); the folders stay as the home for per-tool adapters if they are split out later.
- **agents/** — the AI agent layer (Rovo agents and MCP tools). Planned after the core sync works; reads first.
- **shared/** — TypeScript types shared by the frontend and the Forge backend so both sides agree on shapes.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Forge backend | Atlassian Forge, Node.js 24 runtime (`nodejs24.x`), `@forge/resolver` |
| Atlassian APIs | Jira, Confluence, Bitbucket, Jira Service Management (via Forge) |
| Agents | Rovo agent modules, Atlassian MCP (`rovo:mcp`) — planned |
| Package manager | npm (workspaces) |

## Project Structure

```text
atlasync/
├── frontend/            # Vite + React + TypeScript (Forge Custom UI)
│   └── src/
│       ├── components/  # Sidebar, Topbar, Card, Stat, Gauge, charts,
│       │                # Jira/Confluence/JSM live cards, Markdown
│       ├── views/       # Overview, Intelligence, Projects, Integrations,
│       │                # Agents, Insights, Settings
│       ├── services/    # Forge bridge calls (jira, confluence, jsm,
│       │                # intelligence) + shared error copy
│       ├── hooks/       # useIntelligenceConversation (ask/cancel/reset)
│       ├── utils/       # markdown, readiness, overview stats, request guard
│       ├── data/        # types.ts + mock.ts (sample data layer)
│       └── App.tsx      # Shell: nav, demo workspace, Forge bridge status
├── forge-app/
│   ├── manifest.yml     # Forge app definition (registered app id, scopes, llm module)
│   └── src/             # Resolver (index.js) + per-source modules:
│                        # jira.js, confluence.js, jsm.js, projects.js, devstatus.js
├── integrations/        # Per-tool adapter folders (planned placeholders)
├── agents/              # Rovo agents & MCP tools (planned)
├── shared/
│   └── types.ts         # Shared TypeScript types
├── README.md
├── LICENSE
└── .gitignore
```

## Dashboard

The frontend is a light, premium enterprise dashboard (white panels on a soft grey canvas, thin borders, restrained indigo accents, Lucide icons, subtle animations), screen-fitted to one page with scrolling confined to the main content area. It is a real, interactive React UI — not a static mockup — mixing live read-only data from the Forge backend with clearly labeled demo data; see [Feature status](#feature-status--what-is-live-what-is-demo) for the exact split.

### Views (sidebar)

- **Overview** — live Jira issues, Confluence pages, and JSM requests cards (the Jira card has a Demo / Live toggle), release readiness (sample estimate by default, with a "Calculate from live Jira" action), derived per-stat context, plus demo sections: active blockers (with local demo Resolve buttons), Confluence activity, Bitbucket PRs (status filters), JSM incident snapshot, and recent activity (Today/7D/30D range).
- **Intelligence** — live Forge LLM assistant over a bounded snapshot of Jira, Confluence, and JSM records (up to 10 each). Answers render as Markdown, report source coverage, and are read-only; they may be incomplete and are not release approvals. A Stop button cancels a running analysis (the late response is discarded) and "New analysis" resets the conversation.
- **Projects** — live Jira project directory, filtered by the signed-in user's permissions. The demo workspace selection does not scope it.
- **Integrations** — read-only connection probes for Jira, Confluence, and JSM (auto-checked when the view opens), plus owner setup guidance for Jira-linked Bitbucket PRs and Forge LLM.
- **AI Agents** — Atlasync Release Intelligence entry point; no autonomous writes or background agent actions.
- **Insights** — live record counts per source (latest refresh, max 50 per source) with per-source errors. Historical trend charts are withheld until a privacy-safe snapshot system exists.
- **Settings** — demo workspace profile and preference toggles (preview-only — nothing persists).

### Interactive controls

Demo workspace selector (scopes the sample sections only — blockers, PRs, incidents, activity — and never scopes live data), global search (live Jira issues, Confluence pages, and JSM requests inside a Forge install, plus clearly labeled demo results), notifications with mark-all-read, and the Forge connection badge (green when connected inside Forge, "Preview mode" otherwise).

### Mock data

The sample dashboard data lives in `frontend/src/data/mock.ts`. Overview health cards, blocker lists, PR/incidents sample panels, and demo workspace state remain labeled as demo data. Live source cards do not mix sample rows into their live results. Stats on the Overview are derived from those arrays (workspace filters and Resolve buttons change them); only the small "vs last week" annotations are fixed display text. Release readiness shows a sample estimate (72) until "Calculate from live Jira" scores the most recently updated live issues instead.

### Preview it

```bash
npm run dev      # dev server, then open the printed localhost URL
npm run build && npm run preview   # production build preview
```

To see it inside Forge instead of preview mode, deploy and install the app on a dev site (see Feature status below) — the same build renders with the bridge connected.

## Feature status — what is live, what is demo

This is the one authoritative split. **Live** means the data comes from the Forge backend through the signed-in user's own Atlassian permissions; **Demo** means sample data from `frontend/src/data/mock.ts`, labeled as such in the UI. Live cards never mix sample rows into their results.

| Surface | Data |
|---|---|
| Jira issues (Overview card, Live mode) | **Live** — key, summary, status, priority, assignee, updated timestamp, via `getJiraIssues` |
| Jira projects (Projects view) | **Live** — project directory via `getJiraProjects`, filtered by the user's permissions |
| Confluence pages (Overview card) | **Live** — via `getConfluencePages` (`requestConfluence`) |
| JSM requests (Overview card) | **Live** — via `getJsmRequests` (`/rest/servicedeskapi/request`, normalized from the documented array shape) |
| Linked Bitbucket PRs (Jira issue detail) | **Live when linked** — via the Jira dev-status API; shows 0 with owner setup guidance until a Bitbucket workspace is linked via DVCS |
| Intelligence answers | **Live** — Forge LLM (`claude-sonnet-5`) over a bounded snapshot (up to 10 Jira issues, 10 Confluence pages, 10 JSM requests); Markdown answers, source coverage, Stop/cancel |
| Release readiness | **Live on demand** — "Calculate from live Jira" scores the most recently updated issues; sample estimate (72) until then |
| Insights counts | **Live** — record counts per source, latest refresh, max 50 per source |
| Integrations probes | **Live** — read-only health checks for Jira, Confluence, JSM, auto-run when the view opens |
| Global search | **Live in Forge + Demo** — live Jira issues, Confluence pages, JSM requests under a Live heading; demo results under a Demo heading |
| Overview stats, blockers, PR/incident panels, activity | **Demo** — sample data; Resolve buttons act locally only |
| AI Agents view | **Demo** — Release Intelligence entry point; no autonomous writes or background actions |
| Settings | **Preview-only** — demo workspace profile; nothing persists |

### Deployed version vs main

**v3.0.0 was deployed 2026-11-09** to the development environment on the Codegeist dev site and live-verified the same day (9 Jira issues incl. AS-1, 12 Confluence pages, 2 projects; Intelligence correctly answered the highest-priority open issues). Changes merged to `main` after that deploy (PRs #8–#21: Markdown answers, live search, JSM array fix, demo-workspace definition, Intelligence cancel, and more) are verified locally — `npm test` 41/41 + production build + headless-Chromium preview — and reach the installed app only on the next deploy. Do not claim a post-v3.0.0 change is live-verified until that deploy happens.

### Notes

- **Forge LLM usage is metered**; check Atlassian's current Forge LLM pricing before enabling Intelligence. Intelligence never sends source data to an external model provider.
- **Scheduled/background sync is not enabled**: Forge scheduled functions run without a user identity, so they must not silently persist user-permission-filtered records into shared app storage. Live reads and Intelligence always run in the requesting user's context.

## Live integrations (read-only)

The live slices all follow the same vertical path — Forge authentication → Atlassian API → resolver → frontend → real data — and every call runs via `asUser()`, so Atlassian enforces the signed-in user's own access. The app never sees projects or pages the user cannot see.

### Deploy and install

These steps need the owner's Atlassian account and a free developer site. The app id is already registered in `manifest.yml` — do not run `forge register` for this app (that would create a new app); it is only needed when starting a fresh Forge app.

```bash
npm install -g @forge/cli@latest
forge login
npm run build       # build the frontend first (from the repo root)
cd forge-app
forge deploy
forge install       # pick your dev site; install on Jira AND Confluence (cross-product scopes)
```

Upgrading an existing installation to a version with new scopes or the `llm` module (a major version) needs an administrator to review/approve the new version and permissions.

### Required permissions

- **App scopes (in the manifest):** `read:jira-work`, `read:confluence-content.all`, `read:confluence-space.summary`, `read:page:confluence`, `read:servicedesk-request`, `storage:app`, plus the `llm` module (`claude` model family).
- **User permission (enforced by Atlassian itself):** the signed-in user needs **Browse Projects** permission on the Jira projects being read, plus a Jira license on the site; Confluence and JSM reads likewise follow that user's own access. Calls run via `asUser()`, so the app never sees data the user cannot see.
- **No writes, no tokens:** every integration is read-only, live lists request at most 50 records (default 25 for Jira issues, newest first), and no credential ever enters the codebase — Forge holds the authentication.

### How to enable live mode

In a Forge-installed app, open **Overview → Jira issues** and switch the toggle from **Demo data** to **Live Jira**. It loads automatically; **Refresh** re-loads, **Back to demo data** returns to samples. Confluence pages, JSM requests, Projects, Insights, and Integrations load live automatically in Forge. In the standalone preview the same controls show a backend-unreachable state — that is correct behavior, not an app error.

### Limitations and troubleshooting

- **Live behavior verified against a real Forge installation (v3.0.0, 2026-11-09)** — on the Codegeist dev site: 9 Jira issues incl. a live JSM request (AS-1), 12 Confluence pages, 2 projects, and an Intelligence answer that correctly listed the highest-priority open issues. The empty-state branch renders only when the query returns zero records.
- **Project sidebar entry:** on Jira Service Management projects the Atlasync sidebar entry may not appear; the project page is still reachable via its direct URL (`/jira/servicedesk/projects/<KEY>/apps/<appId>/<envId>`).
- **Permission denied** in Live mode → the signed-in user lacks Browse Projects permission; ask the Jira admin, or check the site's project permissions.
- **Rate limited** → Jira throttled the request; wait a moment and press **Retry** (no automatic retry loop).
- **Could not load** (backend unreachable) in the preview → expected: the app is running standalone, not inside Forge.
- Custom JQL is supported by the resolver (`getJiraIssues` accepts an optional `jql`, max 500 chars) but is not exposed in the UI yet; the UI uses the default query (recently updated, newest first).

## Development Setup

### Prerequisites

- Node.js 20+ (developed on Node 24) and npm
- A free Atlassian Cloud developer site — only needed for Forge deploy/install, not for frontend work
- The Forge CLI (`@forge/cli`) — only needed for deploy/install/lint, not for frontend work

### Environment variables

None. This project needs no `.env` file and no API tokens: the frontend talks to the Forge backend only through the bridge, and the backend uses Forge permissions and storage. Never commit a `.env` file or a token; Forge secrets (if ever needed) go through `forge variables`, not the repo.

### Install

```bash
npm install
```

This installs the root workspace plus `frontend/` and `forge-app/`.

### Frontend (no Atlassian account needed)

```bash
npm run dev        # start the Vite dev server for the frontend
npm run build      # type-check + build the frontend into forge-app/static/atlasync
npm run preview    # serve the production build locally (what Forge would serve)
npm test           # 41 unit tests (see below)
```

The frontend builds with relative asset paths (`base: './'` in `vite.config.ts`), which Forge Custom UI requires. The manifest resource points at the build output directory (`forge-app/static/atlasync`), which must contain `index.html` — that is the entry point Forge serves.

### How the frontend talks to Forge

The app shell calls the backend resolver through `@forge/bridge`'s `invoke` (`getStatus` for the connection check, plus `getJiraIssues`, `getJiraProjects`, `getConfluencePages`, `getJsmRequests`, `getIssueDevStatus`, and `askAtlasync` for the live slices). Two rules from the official Forge docs, both followed here:

1. **Bridge import is dynamic** (`await import('@forge/bridge')` inside an effect). A static import would break the app outside a Forge iframe; dynamic loading lets the same build render a standalone preview locally and the real connected view inside Forge.
2. **No direct Atlassian API calls from the frontend.** All Atlassian access goes through the Forge resolver backend, which holds the permissions.

Outside Forge, the shell renders a standalone note ("Forge bridge unavailable (expected outside Forge)") instead of failing — that fallback is deliberate, not an error.

### Forge (needs your Atlassian account)

These steps are intentionally **not** run from this environment — they need the owner's Atlassian login and developer site:

```bash
npm install -g @forge/cli@latest
forge login
cd forge-app
forge deploy        # build the frontend first (npm run build), then deploy
forge install       # install the app on your dev site and pick the products (Jira + Confluence)
```

After deploy, live Forge behavior (resolver reads, storage, scheduled triggers, MCP tools) can only be verified on a real Atlassian site — never claim it works from a local build alone.

### Verification

Run these before committing:

```bash
npm install        # dependencies resolve
npm run dev        # dev server answers (smoke-check the root URL)
npm run build      # tsc type-check + Vite production build
npm test           # 41 unit tests (see below) + resolver structure check
forge lint         # manifest schema check (stops at "Not logged in" without an Atlassian login — expected)
```

### A note on `npm test`

`npm test` runs 41 real unit tests via `node --test`: six Forge-backend suites (`forge-app/tests/` — Jira, dev-status/Bitbucket, Confluence, JSM, projects, resolver-init) using a real documented-response fixture for JSM, plus one frontend suite for the Intelligence request-generation guard (`frontend/src/utils/requestGeneration.test.ts`, run with Node type stripping). `scripts/check-resolver.mjs` additionally guards the resolver's structure. Live resolver behavior is verified only after `forge deploy` + install — never claimed from a local run.

### Troubleshooting

- **`forge lint` says "Not logged in":** expected without `forge login`. It still means no schema errors were reported before the login stop.
- **"Forge bridge unavailable" in local preview:** expected. The bridge only exists inside a Forge iframe; the standalone note is the correct local behavior.
- **Manifest `app.id`:** it is the registered Forge app id — never hand-edit it, and never invent a real ARI.
- **Blank page after build:** check the built `index.html` uses relative `./assets/...` paths (Vite `base: './'`). Absolute paths break under Forge Custom UI.

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Install all workspaces |
| `npm run dev` | Start the frontend Vite dev server |
| `npm run build` | Type-check and build the frontend (output: `forge-app/static/atlasync`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | 41 unit tests (6 Forge-backend suites + 1 frontend suite) + resolver structure check |

## Codegeist 2026

Atlasync is built for [Codegeist 2026](https://codegeist2026.devpost.com/) ("Build with context. Ship with confidence."). Submission period: **27 Oct – 22 Dec 2026** (deadline 22 Dec 2026, 12:00 pm PT ≈ 23 Dec 2026, ~1:00 am PKT). A submission needs an installation link plus a demo video under 5 minutes (public on YouTube).

## Security

- **No secrets, credentials, or API tokens are stored in this repository.** Never commit a `.env` file or a token.
- Forge apps access Atlassian APIs through Forge permissions (`manifest.yml` scopes) and per-installation storage — not through embedded credentials.
- The scaffold requests read-only scopes only (`read:jira-work`, `read:confluence-content.all`, `read:confluence-space.summary`, `read:page:confluence`, `read:servicedesk-request`, `storage:app`) plus the Forge `llm` module. Any future write scope must be added deliberately, with a reason, and disclosed in the app listing.

## License

MIT — see [LICENSE](LICENSE).
