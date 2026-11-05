import Resolver from '@forge/resolver';

// Atlasync Forge resolver — scaffold only.
// This stub exists so the manifest has a working function target.
// Real resolvers (sync reads, storage, per-tool adapters) will be added
// here as development proceeds. No application features live here yet.

const resolver = new Resolver();

resolver.define('getStatus', () => ({
  ok: true,
  app: 'atlasync',
  version: '0.2.0',
}));

export const handler = resolver.getDefinitions();
