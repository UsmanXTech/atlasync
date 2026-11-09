import assert from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeJiraProject, parseJiraProjects, validateProjectInput } from '../src/projects.js';
describe('Jira project normalization', () => {
  it('normalizes project metadata and discards unrelated fields', () => {
    assert.deepEqual(normalizeJiraProject({ id: 100, key: 'AT', name: 'Atlasync', projectTypeKey: 'software', token: 'drop' }), { id: '100', key: 'AT', name: 'Atlasync', projectType: 'software' });
  });
  it('skips malformed rows and returns empty for bad payload', () => {
    assert.deepEqual(parseJiraProjects({ values: [null, {}, { key: 'AT', name: 'Atlasync' }] }), [{ id: 'AT', key: 'AT', name: 'Atlasync', projectType: 'Unknown' }]);
    assert.deepEqual(parseJiraProjects(null), []);
  });
  it('clamps project limit', () => {
    assert.equal(validateProjectInput({ limit: 99 }).limit, 50);
    assert.equal(validateProjectInput({ limit: 0 }).limit, 1);
    assert.equal(validateProjectInput({ limit: 'bad' }).ok, false);
  });
});