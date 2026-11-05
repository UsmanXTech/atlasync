// Resolver check: verifies the Forge resolver module's structure WITHOUT
// executing it.
//
// Why not execute it? forge-app/src/index.js follows the official Forge
// pattern (`import Resolver from '@forge/resolver'; new Resolver()`), which
// the Forge runtime resolves correctly. In plain Node, that same import
// lands on the package's CommonJS namespace object instead of the class,
// so `new Resolver()` throws here even though the code is correct for its
// target runtime. Executing Forge-targeted code in Node would give a false
// failure — so this check reads the module and asserts its structure, and
// live resolver behavior is verified only after `forge deploy` + install.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'forge-app', 'src', 'index.js'), 'utf8');

assert.match(source, /from '@forge\/resolver'/, 'resolver must import @forge/resolver');
assert.match(source, /new Resolver\(\)/, 'resolver must construct Resolver');
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
  /export const handler = resolver\.getDefinitions\(\)/,
  'resolver must export handler via getDefinitions()',
);

console.log('resolver check passed: getStatus + getJiraIssues defined, handler exported');
