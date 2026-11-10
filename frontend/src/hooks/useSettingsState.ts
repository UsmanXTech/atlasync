import { useEffect, useState } from 'react';
import {
  DEFAULT_TOGGLES,
  defaultSettingsFor,
  type SettingsToggleKey,
  type SettingsToggles,
} from '../utils/settingsState';
import type { Workspace } from '../data/types';

export interface SettingsState {
  name: string;
  timezone: string;
  toggles: SettingsToggles;
  saved: boolean;
  setName: (name: string) => void;
  setTimezone: (timezone: string) => void;
  flip: (key: SettingsToggleKey) => void;
  save: () => void;
  reset: () => void;
}

// Owns the Settings form state. The hook lives in App (above the view
// switch), so a saved name, timezone or toggle choice survives navigating
// to another view and back — the view itself unmounts on switch, but this
// state does not. Before this fix (Run 17) "Save preview" showed "Saved
// in this page session only" and the values were discarded on the first
// view switch. A full page reload still starts fresh, and switching demo
// workspace still resets to that workspace's defaults.
export function useSettingsState(workspace: Workspace): SettingsState {
  const [name, setNameState] = useState(workspace.name);
  const [timezone, setTimezoneState] = useState(defaultSettingsFor(workspace.name).timezone);
  const [toggles, setToggles] = useState<SettingsToggles>({ ...DEFAULT_TOGGLES });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = defaultSettingsFor(workspace.name);
    setNameState(d.name);
    setTimezoneState(d.timezone);
    setToggles(d.toggles);
    setSaved(false);
  }, [workspace.id, workspace.name]);

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
  };
  const save = () => setSaved(true);
  const reset = () => {
    const d = defaultSettingsFor(workspace.name);
    setNameState(d.name);
    setTimezoneState(d.timezone);
    setToggles(d.toggles);
    setSaved(false);
  };

  return { name, timezone, toggles, saved, setName, setTimezone, flip, save, reset };
}
