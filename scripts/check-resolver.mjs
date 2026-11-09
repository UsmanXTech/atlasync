// Resolver check: verifies the Forge resolver module's structure WITHOUT
// executing it (execution is covered by forge-app/tests/resolver-init.test.js).
//
// History (Task 5.1): @forge/resolver@1.8.0 is a CommonJS module whose
// constructor lives under `exports.default`. Forge's function bundler hands
// the resolver file the module namespace object instead of the default
// export, so plain `new Resolver()` threw "out_namespaceObject is not a
// constructor" on the live install (forge logs, 2026-11-05) — the old
// assumption that the official pattern works on the Forge runtime was
// wrong. The source must therefore resolve the constructor defensively
// (`Resolver.default ?? Resolver`), and this check asserts that pattern.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'forge-app', 'src', 'index.js'), 'utf8');

assert.match(source, /from '@forge\/resolver'/, 'resolver must import @forge/resolver');
assert.match(
  source,
  /ResolverCtor = Resolver\?\.default \?\? Resolver/,
  'resolver must resolve the constructor defensively (Task 5.1)',
);
assert.match(source, /new ResolverCtor\(\)/, 'resolver must construct ResolverCtor');
assert.match(
  source,
  /define\('getStatus'/,
  "resolver must define a 'getStatus' function",
);
assert.match(
  source,
  /define\('getJiraIssues'/,
  "resolver must define a 'getJiraIssues' function",
);
assert.match(
  source,
  /define\('getIssueDevStatus'/,
  "resolver must define a 'getIssueDevStatus' function (Task 6, Architecture A)",
);
assert.match(
  source,
  /export const handler = resolver\.getDefinitions\(\)/,
  'resolver must export handler via getDefinitions()',
);

console.log('resolver check passed: defensive constructor resolution + getStatus + getJiraIssues + getIssueDevStatus defined, handler exported');
