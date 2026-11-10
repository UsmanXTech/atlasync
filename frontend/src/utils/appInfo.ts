// About-card facts for the Settings view, kept pure (no React) so they
// are unit-testable. Every fact here is sourced, not invented:
//   - version + deploy date + live-verification: README "Deployed version
//     vs main" (v3.0.0 deployed 2026-11-09, live-verified the same day on
//     the Codegeist dev site: 9 Jira issues incl. AS-1, 12 Confluence
//     pages, 2 projects).
//   - app id: forge-app/manifest.yml (registered app id — do not re-run
//     `forge register` for this app).
//   - live/demo split: README "Feature status" — Jira, Confluence, JSM
//     and Intelligence read live data inside the installed Forge app;
//     Overview stats and the demo workspace profile are sample data.
//   - deploy note: changes merged to main after v3.0.0 reach the
//     installed app only on the next deploy.
// Keep this module in sync with the README when the deployed version
// changes; the test pins the shape, not the wording, so a version bump
// is a one-line edit here plus the README.
export interface AppInfoRow {
  label: string;
  value: string;
}

export const APP_VERSION = 'v3.0.0';
export const APP_ID = 'ari:cloud:ecosystem::app/63accaf9-e952-4554-af92-27b5b1b5d56d';
export const APP_DEPLOYED = '9 Nov 2026';
export const APP_BUILT_FOR = 'Codegeist 2026';

export const APP_INFO_ROWS: AppInfoRow[] = [
  { label: 'Version', value: `${APP_VERSION} — deployed ${APP_DEPLOYED}` },
  {
    label: 'Live verification',
    value: 'Verified on the Codegeist dev site the same day: 9 Jira issues incl. AS-1, 12 Confluence pages, 2 projects.',
  },
  { label: 'Forge app', value: APP_ID },
  { label: 'Built for', value: APP_BUILT_FOR },
  {
    label: 'Live vs demo',
    value:
      'Jira, Confluence, JSM and Intelligence read live data inside the installed Forge app; Overview stats and this profile are sample data.',
  },
];

export const APP_DEPLOY_NOTE =
  'Changes merged to main after v3.0.0 reach the installed app on the next deploy — no deploy happens from this view.';
