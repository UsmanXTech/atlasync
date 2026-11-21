// Local manifest validation — the same @forge/manifest validator the
// Forge CLI's `forge lint` runs, without the CLI's login gate (the
// sandbox has no Forge token value, so `forge lint` itself cannot run
// here). Usage: node scripts/validate-manifest.mjs
import { validate } from '@forge/manifest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'forge-app', 'manifest.yml');
// The validator takes the manifest FILE PATH (its FileValidator checks
// existsSync on the argument), not YAML text or a parsed object.
const result = await validate(false, manifestPath);
const errors = result?.errors ?? [];
const warnings = result?.warnings ?? [];
if (errors.length > 0) {
  console.error('MANIFEST ERRORS:');
  for (const e of errors) console.error(' -', typeof e === 'string' ? e : JSON.stringify(e));
  process.exit(1);
}
if (warnings.length > 0) {
  console.log('MANIFEST WARNINGS:');
  for (const w of warnings) console.log(' -', typeof w === 'string' ? w : JSON.stringify(w));
}
console.log('MANIFEST VALID');
