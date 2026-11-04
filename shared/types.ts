// Shared types for Atlasync — used by the frontend and the Forge backend
// so both sides agree on shapes. Scaffolding only; extend as features land.

// The Atlassian tools Atlasync syncs across.
export type AtlassianTool = 'jira' | 'confluence' | 'bitbucket' | 'jsm';

// Lifecycle of one tool's sync state. Sources degrade independently:
// one tool failing must never block the others.
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

// Connection record for a single tool, as stored per installation.
export interface ToolConnection {
  tool: AtlassianTool;
  connected: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

// The sync snapshot the frontend renders: one entry per tool.
export interface SyncSnapshot {
  generatedAt: string;
  tools: ToolConnection[];
}
