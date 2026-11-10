// The About card in Settings renders APP_INFO_ROWS + APP_DEPLOY_NOTE.
// Pins the shape (every row labelled, non-empty, distinct; app id in the
// registered `ari:cloud:ecosystem::app/<uuid>` form) so a stale or
// half-edited fact fails loudly instead of shipping silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_INFO_ROWS, APP_DEPLOY_NOTE, APP_ID, APP_VERSION } from './appInfo.ts';

test('about card: every row has a distinct non-empty label and value', () => {
  assert.ok(APP_INFO_ROWS.length >= 4, 'expected at least 4 info rows');
  const labels = new Set<string>();
  for (const row of APP_INFO_ROWS) {
    assert.notEqual(row.label.trim(), '', 'row label must not be empty');
    assert.notEqual(row.value.trim(), '', `row "${row.label}" value must not be empty`);
    assert.ok(!labels.has(row.label), `duplicate label "${row.label}"`);
    labels.add(row.label);
  }
});

test('about card: app id is the registered Forge app id shape', () => {
  assert.match(APP_ID, /^ari:cloud:ecosystem::app\/[0-9a-f-]{36}$/);
  assert.ok(
    APP_INFO_ROWS.some((r) => r.value.includes(APP_ID)),
    'app id must appear in the rendered rows',
  );
});

test('about card: version row names the deployed version', () => {
  assert.ok(
    APP_INFO_ROWS.some((r) => r.label === 'Version' && r.value.startsWith(APP_VERSION)),
    `expected a Version row starting with ${APP_VERSION}`,
  );
});

test('about card: deploy note is honest about the next deploy', () => {
  assert.ok(APP_DEPLOY_NOTE.includes(APP_VERSION), 'deploy note must name the deployed version');
  assert.ok(
    APP_DEPLOY_NOTE.includes('next deploy'),
    'deploy note must say main changes wait for the next deploy',
  );
});
