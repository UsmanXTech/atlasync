# Atlasync — Every Atlassian Tool, One Sync

![CI](https://github.com/UsmanXTech/atlasync/actions/workflows/ci.yml/badge.svg)

> Build with context. Ship with confidence.

> Demo guide for judges and reviewers: [DEMO.md](./DEMO.md) — the 60–90
> second flow, the "Are we ready to release Atlas v2?" scenario, what is
> mocked, and what live integrations are planned.

Atlasync is an Atlassian Forge app built for **Codegeist 2026**. It gives teams one synced view across every Atlassian tool they use — Jira, Confluence, Bitbucket, and Jira Service Management — so the context behind work is always in one place, instead of scattered across silos.

**Status:** Premium dashboard on mock data (v0.2.0) + first live slice: read-only Jira issues inside Forge installs. Everything else still comes from the sample dataset in `frontend/src/data/mock.ts`.

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
- **integrations/** — one adapter per Atlassian tool (Jira, Confluence, Bitbucket, JSM). Adapters are independent: if one source fails, the others still return data, and the UI reports which source degraded.
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
│       ├── components/  # Sidebar, Topbar, Card, Stat, Gauge, charts
│       ├── views/       # Overview, Intelligence, Projects, Integrations,
│       │                # Agents, Insights, Settings
│       ├── data/        # types.ts + mock.ts (sample data layer)
│       └── App.tsx      # Shell: nav, workspace, Forge bridge status
├── forge-app/
│   ├── manifest.yml     # Forge app definition (placeholder id until `forge register`)
│   └── src/index.js     # Resolver (getStatus + read-only getJiraIssues)
├── integrations/        # One adapter per Atlassian tool (planned)
│   ├── jira/
│   ├── confluence/
│   ├── bitbucket/
│   └── jsm/
├── agents/              # Rovo agents & MCP tools (planned)
│   └── mcp/
├── shared/
│   └── types.ts         # Shared TypeScript types
├── README.md
├── LICENSE
└── .gitignore
```

## Dashboard

The frontend is a dark-first, premium enterprise dashboard (deep charcoal, thin borders, restrained electric-blue accents, Lucide icons, subtle animations). It is a real, interactive React UI — not a static mockup — running on the mock data layer, with the first live slice (read-only Jira issues) available inside a Forge installation — see Live Jira below.

### Views (sidebar)

- **Overview** — project health, Jira issue statistics, active blockers (with working Resolve buttons), Confluence activity, Bitbucket PRs (status filters), JSM incidents, recent activity (Today/7D/30D range), plus the Jira issues card with a Demo data / Live Jira toggle.
- **Intelligence** — AI assistant panel. Ask the sample prompt *"Are we ready to release Atlas v2?"* (or the other presets, or your own text) and get a structured sample response: readiness percentage, critical blockers, risk assessment, relevant issues, suggested next actions. Every response is labeled mock data.
- **Projects** — per-workspace project cards with health, progress, and status filters.
- **Integrations** — per-tool connection cards with working connect/disconnect toggles and mock sync buttons.
- **AI Agents** — agent cards with working enable/disable toggles.
- **Insights** — weekly throughput charts (issues/docs/PRs) derived from the mock dataset.
- **Settings** — workspace form and preference toggles (mock — nothing persists).

### Interactive controls

Workspace selector (filters projects, blockers, PRs, incidents, activity), global search across issues/PRs/docs/incidents, notifications with mark-all-read, and the Forge connection badge (green when connected inside Forge, "Preview mode" otherwise).

### Mock data

All dashboard content lives in `frontend/src/data/` (`types.ts` + `mock.ts`) and is clearly labeled **MOCK DATA** in the sidebar, the topbar badge area, and the AI panel. Stats on the Overview are derived from those arrays (workspace filters and Resolve buttons change them); only the small "vs last week" annotations are fixed display text.

### Preview it

```bash
npm run dev      # dev server, then open the printed localhost URL
npm run build && npm run preview   # production build preview
```

To see it inside Forge instead of preview mode, deploy and install the app on a dev site (see Live Jira below) — the same build renders with the bridge connected.

## Live Jira (read-only)

The first real integration: the Overview **Jira issues** card can load actual Jira issues through the Forge backend. This is the first vertical slice — Forge authentication → Jira API → resolver → frontend → real issue data.

### Deploy and install

These steps need the owner's Atlassian account and a free developer site:

```bash
npm install -g @forge/cli@latest
forge login
cd forge-app
forge register      # replaces the placeholder app id in manifest.yml
npm run build       # build the frontend first (from the repo root)
forge deploy
forge install       # pick your dev site and the Jira product
```

### Required permissions

- **App scope (already in the manifest, no new scopes):** `read:jira-work`.
- **User permission (enforced by Jira itself):** the signed-in user needs **Browse Projects** permission on the Jira projects being read, plus a Jira license on the site. Calls run via `asUser()`, so Jira enforces that user's own access — the app never sees projects the user cannot see.
- **No writes, no tokens:** the integration is read-only, requests at most 50 issues (default 25, newest first), and no credential ever enters the codebase — Forge holds the authentication.

### How to enable live mode

In a Forge-installed app, open **Overview → Jira issues** and switch the toggle from **Demo data** to **Live Jira**. It loads automatically; **Refresh** re-loads, **Back to demo data** returns to samples. In the standalone preview the same toggle shows a
backend-unreachable state — that is correct behavior, not an app error.

### What is live vs mock

| Surface | Data |
|---|---|
| Jira issues card, Live mode | **Live** — key, summary, status, priority, assignee, updated timestamp, via the `getJiraIssues` resolver |
| Jira aggregates, blockers, Confluence, Bitbucket, JSM, AI answers, Insights, agents, integration sync states | **Mock** — sample data from `frontend/src/data/mock.ts`, labeled as such |

Mock Bitbucket, Confluence, and JSM records are never labeled live.

### Limitations and troubleshooting

- **Live behavior verified against a real Forge installation (2026-11-05)** — Live Jira on the AT project page returned HTTP 200 and rendered a real issues list after the Task 5.1 fixes. The empty-state branch renders only when the query returns zero issues.
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
npm test           # resolver structure check (see below)
```

The frontend builds with relative asset paths (`base: './'` in `vite.config.ts`), which Forge Custom UI requires. The manifest resource points at the build output directory (`forge-app/static/atlasync`), which must contain `index.html` — that is the entry point Forge serves.

### How the frontend talks to Forge

The app shell calls the backend resolver through `@forge/bridge`'s `invoke` (currently `getStatus` for the connection check and `getJiraIssues` for live Jira issues). Two rules from the official Forge docs, both followed here:

1. **Bridge import is dynamic** (`await import('@forge/bridge')` inside an effect). A static import would break the app outside a Forge iframe; dynamic loading lets the same build render a standalone preview locally and the real connected view inside Forge.
2. **No direct Atlassian API calls from the frontend.** All Atlassian access goes through the Forge resolver backend, which holds the permissions.

Outside Forge, the shell renders a standalone note ("Forge bridge unavailable (expected outside Forge)") instead of failing — that fallback is deliberate, not an error.

### Forge (needs your Atlassian account)

These steps are intentionally **not** run from this environment — they need the owner's Atlassian login and developer site:

```bash
npm install -g @forge/cli@latest
forge login
cd forge-app
forge register      # replaces the placeholder app id in manifest.yml — never invent a real ARI
forge deploy        # build the frontend first (npm run build), then deploy
forge install       # install the app on your dev site and pick the products
```

After deploy, live Forge behavior (resolver reads, storage, scheduled triggers, MCP tools) can only be verified on a real Atlassian site — never claim it works from a local build alone.

### Verification

Run these before committing:

```bash
npm install        # dependencies resolve
npm run dev        # dev server answers (smoke-check the root URL)
npm run build      # tsc type-check + Vite production build
npm test           # resolver structure check (defines getStatus + getJiraIssues, exports handler) + Jira unit tests
forge lint         # manifest schema check (stops at "Not logged in" without an Atlassian login — expected)
```

### A note on `npm test`

`npm test` checks the resolver's structure without executing it, on purpose: `forge-app/src/index.js` follows the official Forge pattern (`import Resolver from '@forge/resolver'; new Resolver()`), which the Forge runtime resolves correctly but plain Node does not (Node lands on the package's CommonJS namespace object instead of the class, so executing it here throws a false failure). Live resolver behavior is verified only after `forge deploy` + install — never claimed from a local run.

### Troubleshooting

- **`forge lint` says "Not logged in":** expected without `forge login`. It still means no schema errors were reported before the login stop.
- **"Forge bridge unavailable" in local preview:** expected. The bridge only exists inside a Forge iframe; the standalone note is the correct local behavior.
- **Manifest `app.id` looks fake:** it is a placeholder by design. `forge register` replaces it; never hand-write a real ARI.
- **Blank page after build:** check the built `index.html` uses relative `./assets/...` paths (Vite `base: './'`). Absolute paths break under Forge Custom UI.

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Install all workspaces |
| `npm run dev` | Start the frontend Vite dev server |
| `npm run build` | Type-check and build the frontend (output: `forge-app/static/atlasync`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Resolver structure check (defines `getStatus` + `getJiraIssues`, exports handler) + Jira unit tests |

## Codegeist 2026

Atlasync is built for [Codegeist 2026](https://codegeist2026.devpost.com/) ("Build with context. Ship with confidence."). Submission period: **27 Oct – 22 Dec 2026** (deadline 22 Dec 2026, 12:00 pm PT ≈ 23 Dec 2026, ~1:00 am PKT). A submission needs an installation link plus a demo video under 5 minutes (public on YouTube).

## Security

- **No secrets, credentials, or API tokens are stored in this repository.** Never commit a `.env` file or a token.
- Forge apps access Atlassian APIs through Forge permissions (`manifest.yml` scopes) and per-installation storage — not through embedded credentials.
- The scaffold requests read-only scopes only (`read:jira-work`, `storage:app`). Any future write scope must be added deliberately, with a reason, and disclosed in the app listing.

## License

MIT — see [LICENSE](LICENSE).
