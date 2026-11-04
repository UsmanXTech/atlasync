# Agents

The AI agent layer for Atlasync — Rovo agents and MCP tools that let agents
answer questions and act on synced Atlassian context.

## Plan (in order, after the core sync works)

1. **Read-only MCP tools first** (`mcp/`): tools that expose the synced
   snapshot to agents — e.g. a sync-status summary and per-tool state.
   Read-only means no scope beyond what the app already has.
2. **Rovo agent next:** an agent module that uses those tools to answer
   "what changed, what does it affect, who owns it" questions.
3. **Careful writes last, if at all:** any write action must be explicit,
   scoped, and disclosed — never a silent side effect of a read.

## Rules

- Agents never invent data: a missing or failed source is reported as such.
- Agent output is labeled honestly as agent-assisted, not as human fact.
- No credentials ever live here — agents use Forge permissions and storage
  only.

## Status

No agents or MCP tools are implemented yet — `mcp/` is a placeholder for
the structure.
