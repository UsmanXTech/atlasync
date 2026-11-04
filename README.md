# Atlasync — Every Atlassian Tool, One Sync

> Build with context. Ship with confidence.

Atlasync is an Atlassian Forge app built for **Codegeist 2026**. It gives teams one synced view across every Atlassian tool they use — Jira, Confluence, Bitbucket, and Jira Service Management — so the context behind work is always in one place, instead of scattered across silos.

**Status:** Initial scaffold (v0.1.0). No application features are implemented yet — this repository is a clean, minimal foundation ready for development.

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
│   └── src/             # App shell (no features yet)
├── forge-app/
│   ├── manifest.yml     # Forge app definition (placeholder id until `forge register`)
│   └── src/index.js     # Resolver stub (getStatus only)
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

## Development Setup

### Prerequisites

- Node.js 20+ (developed on Node 24) and npm
- A free Atlassian Cloud developer site (only needed for Forge deploy/install, not for frontend work)
- The Forge CLI (only needed for deploy/install, not for frontend work)

### Install

```bash
npm install
```

This installs the root workspace plus `frontend/` and `forge-app/`.

### Frontend (no Atlassian account needed)

```bash
npm run dev        # start the Vite dev server for the frontend
npm run build      # type-check + build the frontend into forge-app/static/atlasync
```

The frontend builds with relative asset paths (`base: './'` in `vite.config.ts`), which Forge Custom UI requires.

### Forge (needs your Atlassian account)

These steps are intentionally **not** run from this scaffold — they need the owner's Atlassian login and developer site:

```bash
npm install -g @forge/cli
forge login
cd forge-app
forge register      # replaces the placeholder app id in manifest.yml — never invent a real ARI
forge deploy        # build the frontend first (npm run build), then deploy
forge install       # install the app on your dev site and pick the products
```

After deploy, live Forge behavior (resolver reads, storage, scheduled triggers, MCP tools) can only be verified on a real Atlassian site.

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Install all workspaces |
| `npm run dev` | Start the frontend Vite dev server |
| `npm run build` | Type-check and build the frontend (output: `forge-app/static/atlasync`) |

## Codegeist 2026

Atlasync is built for [Codegeist 2026](https://codegeist2026.devpost.com/) ("Build with context. Ship with confidence."). Submission period: **27 Oct – 22 Dec 2026** (deadline 22 Dec 2026, 12:00 pm PT ≈ 23 Dec 2026, ~1:00 am PKT). A submission needs an installation link plus a demo video under 5 minutes (public on YouTube).

## Security

- **No secrets, credentials, or API tokens are stored in this repository.** Never commit a `.env` file or a token.
- Forge apps access Atlassian APIs through Forge permissions (`manifest.yml` scopes) and per-installation storage — not through embedded credentials.
- The scaffold requests read-only scopes only (`read:jira-work`, `storage:app`). Any future write scope must be added deliberately, with a reason, and disclosed in the app listing.

## License

MIT — see [LICENSE](LICENSE).
