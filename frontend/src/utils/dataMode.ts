// Data mode (v2.1.0): the explicit boundary between the Sample
// Dataset and the Live Workspace. Pure helpers, unit-testable.
// - Sample mode shows ONLY sample/demo data, labelled SAMPLE.
// - Live mode shows ONLY live Atlassian data (plus exact backend
//   errors with diagnostics). The two are never mixed in one view.
import type { ForgeMode } from '../components/Topbar';

export type DataMode = 'sample' | 'live';

export const DATA_MODE_LABELS: Record<DataMode, string> = {
  sample: 'Sample Dataset',
  live: 'Live Workspace',
};

export function defaultDataMode(forgeMode: ForgeMode): DataMode {
  // Inside the installed Forge app the live data is real, so Live is
  // the default. In the standalone preview there is no backend, so
  // Sample is the default — Live can still be chosen, and then shows
  // the exact backend-unreachable diagnostic instead of fake data.
  return forgeMode === 'forge' ? 'live' : 'sample';
}
