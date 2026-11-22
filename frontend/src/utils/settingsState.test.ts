import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_TOGGLES,
  SETTINGS_ROWS,
  defaultSettings,
} from './settingsState.ts';

// Settings defaults (Run 17): the "Save preview" promise is only honest
// if the defaults are stable and fresh, so changing one snapshot can
// never leak into another. No demo workspace exists to prefill the name,
// so the default name is empty and the user types their own.
describe('defaultSettings', () => {
  it('uses an empty name with the default timezone and toggles', () => {
    const d = defaultSettings();
    assert.equal(d.name, '');
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
    const a = defaultSettings();
    a.toggles.weeklyDigest = true;
    const b = defaultSettings();
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
