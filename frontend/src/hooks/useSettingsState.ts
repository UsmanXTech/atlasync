import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TOGGLES,
  defaultSettings,
  type SettingsToggleKey,
  type SettingsToggles,
} from '../utils/settingsState';
import { fetchSettings, saveSettings } from '../services/settings';

export type SettingsBackend = 'loading' | 'connected' | 'preview';

export interface SettingsState {
  name: string;
  timezone: string;
  toggles: SettingsToggles;
  saved: boolean;
  backend: SettingsBackend;
  saveError: string | null;
  setName: (name: string) => void;
  setTimezone: (timezone: string) => void;
  flip: (key: SettingsToggleKey) => void;
  save: () => void;
  reset: () => void;
}

// Owns the Settings form state. The hook lives in App (above the view
// switch), so a saved name, timezone or toggle choice survives navigating
// to another view and back — the view itself unmounts on switch, but this
// state does not. A full page reload still starts fresh.
//
// v2.1.0 Phase C1: Daily sync / Incident alerts / Weekly digest are
// persisted in the Forge backend (KVS) when it is reachable — the hook
// loads them on mount and Save writes them back. AI summaries stays
// local-only (no backend setting exists for it). In the standalone
// preview there is no backend, so the toggles stay preview-only and the
// view says so. Backend settings are install-wide.
export function useSettingsState(): SettingsState {
  const [name, setNameState] = useState(defaultSettings().name);
  const [timezone, setTimezoneState] = useState(defaultSettings().timezone);
  const [toggles, setToggles] = useState<SettingsToggles>({ ...DEFAULT_TOGGLES });
  const [saved, setSaved] = useState(false);
  const [backend, setBackend] = useState<SettingsBackend>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let alive = true;
    void fetchSettings().then((r) => {
      if (!alive) return;
      if (r.ok) {
        setToggles((v) => ({ ...v, ...r.settings }));
        setBackend('connected');
      } else {
        setBackend('preview');
      }
    });
    return () => {
      alive = false;
    };
  }, []);


  const setName = (value: string) => {
    setNameState(value);
    setSaved(false);
  };
  const setTimezone = (value: string) => {
    setTimezoneState(value);
    setSaved(false);
  };
  const flip = (key: SettingsToggleKey) => {
    setToggles((v) => ({ ...v, [key]: !v[key] }));
    setSaved(false);
    setSaveError(null);
  };
  const save = useCallback(() => {
    if (backend !== 'connected') {
      setSaved(true);
      return;
    }
    void saveSettings({
      dailySync: toggles.dailySync,
      incidentAlerts: toggles.incidentAlerts,
      weeklyDigest: toggles.weeklyDigest,
    }).then((r) => {
      if (r.ok) {
        setToggles((v) => ({ ...v, ...r.settings }));
        setSaved(true);
        setSaveError(null);
      } else {
        setSaveError(r.error.message);
      }
    });
  }, [backend, toggles]);
  const reset = () => {
    const d = defaultSettings();
    setNameState(d.name);
    setTimezoneState(d.timezone);
    setToggles(d.toggles);
    setSaved(false);
    setSaveError(null);
  };

  return { name, timezone, toggles, saved, backend, saveError, setName, setTimezone, flip, save, reset };
}
