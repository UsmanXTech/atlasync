import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE, type LiveServiceName } from './errors';
export interface WorkspaceSettings { dailySync: boolean; incidentAlerts: boolean; weeklyDigest: boolean }
export type SettingsResult = { ok: true; settings: WorkspaceSettings } | { ok: false; error: { kind: string; message: string } };
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = { dailySync: true, incidentAlerts: true, weeklyDigest: false };
function isSettings(value: unknown): value is WorkspaceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.dailySync === 'boolean' && typeof v.incidentAlerts === 'boolean' && typeof v.weeklyDigest === 'boolean';
}
function toError(value: Record<string, unknown>, service: LiveServiceName): { kind: string; message: string } {
  const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
  return { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage(service) };
}
export async function fetchSettings(): Promise<SettingsResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('getSettings', {});
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true || !isSettings(value.settings)) return { ok: false, error: toError(value, 'Settings') };
    return { ok: true, settings: value.settings as WorkspaceSettings };
  } catch { return { ok: false, error: backendUnreachableError('Settings') }; }
}
export async function saveSettings(settings: WorkspaceSettings): Promise<SettingsResult> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke('saveSettings', { settings });
    if (!result || typeof result !== 'object' || Array.isArray(result)) return { ok: false, error: { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } };
    const value = result as Record<string, unknown>;
    if (value.ok !== true || !isSettings(value.settings)) return { ok: false, error: toError(value, 'Settings') };
    return { ok: true, settings: value.settings as WorkspaceSettings };
  } catch { return { ok: false, error: backendUnreachableError('Settings') }; }
}
