import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_TOGGLES,
  SETTINGS_ROWS,
  defaultSettingsFor,
} from './settingsState.ts';

// Settings defaults (Run 17): the "Save preview" promise is only honest
// if the defaults are stable and fresh per workspace, so changing one
// workspace's snapshot can never leak into another.
describe('defaultSettingsFor', () => {
  it('uses the workspace name with the default timezone and toggles', () => {
    const d = defaultSettingsFor('Platform');
    assert.equal(d.name, 'Platform');
    assert.equal(d.timezone, 'Asia/Karachi');
    assert.equal(d.timezone, DEFAULT_TIMEZONE);
    assert.deepEqual(d.toggles, {
      dailySync: true,
      incidentAlerts: true,
      weeklyDigest: false,
      aiSummaries: true,
    });
    assert.deepEqual(d.toggles, DEFAULT_TOGGLES);
  });

  it('returns a fresh toggles object on every call', () => {
    const a = defaultSettingsFor('Atlasync HQ');
    a.toggles.weeklyDigest = true;
    const b = defaultSettingsFor('Atlasync HQ');
    assert.equal(b.toggles.weeklyDigest, false, 'mutating one snapshot must not leak');
  });
});

describe('SETTINGS_ROWS', () => {
  it('covers the four toggle keys exactly once with non-empty copy', () => {
    assert.deepEqual(
      SETTINGS_ROWS.map((r) => r.key).sort(),
      ['aiSummaries', 'dailySync', 'incidentAlerts', 'weeklyDigest'],
    );
    for (const row of SETTINGS_ROWS) {
      assert.ok(row.title.trim().length > 0, 'title must not be empty');
      assert.ok(row.detail.trim().length > 0, 'detail must not be empty');
    }
    const details = SETTINGS_ROWS.map((r) => r.detail);
    assert.equal(new Set(details).size, details.length, 'details must be distinct');
  });
});
