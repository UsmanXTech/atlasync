// Settings form state, kept pure (no React) so it is unit-testable.
// The hook (hooks/useSettingsState) owns a live copy above the view
// switch; this module is the single source of truth for defaults and
// the toggle rows the view renders.
export type SettingsToggleKey = 'dailySync' | 'incidentAlerts' | 'weeklyDigest' | 'aiSummaries';

export type SettingsToggles = Record<SettingsToggleKey, boolean>;

export const DEFAULT_TOGGLES: SettingsToggles = {
  dailySync: true,
  incidentAlerts: true,
  weeklyDigest: false,
  aiSummaries: true,
};

export const DEFAULT_TIMEZONE = 'Asia/Karachi';

export interface SettingsRow {
  key: SettingsToggleKey;
  title: string;
  detail: string;
  // Real effect once the Forge backend is reachable (Phase C1): the
  // toggle is persisted in KVS and actually does something. aiSummaries
  // has no backend setting, so it keeps its preview text.
  effect?: string;
}

export const SETTINGS_ROWS: SettingsRow[] = [
  {
    key: 'dailySync',
    title: 'Daily sync',
    detail: 'Daily synchronization is a planned feature; no scheduler is active.',
    effect: 'Daily snapshots are paused while the snapshot identity model is redesigned; the toggle is kept for that redesign.',
  },
  {
    key: 'incidentAlerts',
    title: 'Incident alerts',
    detail: 'Alert preferences are preview-only and not delivered.',
    effect: 'Severe incidents surface in Intelligence and the daily snapshot; no email is sent yet.',
  },
  {
    key: 'weeklyDigest',
    title: 'Weekly digest',
    detail: 'Email delivery is not configured.',
    effect: 'A weekly readiness summary is prepared for Intelligence; email delivery is not configured yet.',
  },
  {
    key: 'aiSummaries',
    title: 'AI summaries',
    detail: 'Forge Intelligence is available on demand; no scheduled summaries run.',
  },
];

export interface SettingsSnapshot {
  name: string;
  timezone: string;
  toggles: SettingsToggles;
}

// Fresh defaults for a demo workspace: its name, the default timezone,
// and the default toggles. A fresh toggles object is returned every call,
// so mutating one snapshot never leaks into the next.
export function defaultSettingsFor(workspaceName: string): SettingsSnapshot {
  return { name: workspaceName, timezone: DEFAULT_TIMEZONE, toggles: { ...DEFAULT_TOGGLES } };
}
