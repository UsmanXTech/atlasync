// About-card facts for the Settings view, kept pure (no React) so they
// are unit-testable. Every fact here is sourced, not invented:
//   - version + live-verification: README "Deployed version
//     vs main" (v2.1.0 deployed 2026-11-21; main has deployed
//     automatically on every merge since; live-verified the same day
//     on the Codegeist dev site: 9 Jira issues incl. AS-1, 12
//     Confluence pages, 1 JSM request, 2 projects; all 7 views with
//     live data, Integrations 3/3).
//   - app id: forge-app/manifest.yml (registered app id — do not re-run
//     `forge register` for this app).
//   - live data: README "Feature status" — Jira, Confluence, JSM,
//     Intelligence and Overview stats read live data inside the
//     installed Forge app; there is no demo dataset.
//   - build identity: injected at build time by .github/workflows/
//     deploy.yml (VITE_COMMIT_SHA = the deployed commit,
//     VITE_BUILD_DATE = UTC build timestamp). The workflow assigns no
//     deploy number, so the About block shows the commit SHA + build
//     date instead of a number — the old hardcoded "latest deploy #23"
//     went stale after every deploy. Local builds and unit tests have
//     no vars set, so they fall back to "dev" / "unknown" instead of
//     inventing an identity.
// Keep this module in sync with the README when the deployed version
// changes; the test pins the shape, not the wording, so a version bump
// is a one-line edit here plus the README.
export interface AppInfoRow {
  label: string;
  value: string;
}

export const APP_VERSION = 'v2.1.0';
export const APP_ID = 'ari:cloud:ecosystem::app/63accaf9-e952-4554-af92-27b5b1b5d56d';
export const APP_BUILT_FOR = 'Codegeist 2026';

// Build identity, injected by Vite at build time from the Deploy
// workflow's env vars. `import.meta.env` is undefined under plain node
// (unit tests) and the vars are unset for local builds, so the fallbacks
// keep both honest instead of crashing or inventing an identity.
const BUILD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBuildDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())} ${BUILD_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function readBuildIdentity(): { sha: string; date: string } {
  const sha = (import.meta.env?.VITE_COMMIT_SHA ?? '').trim();
  const date = (import.meta.env?.VITE_BUILD_DATE ?? '').trim();
  return { sha: sha ? sha.slice(0, 7) : 'dev', date: date ? formatBuildDate(date) : 'unknown' };
}

const BUILD_IDENTITY = readBuildIdentity();
export const APP_BUILD_SHA = BUILD_IDENTITY.sha;
export const APP_BUILD_DATE = BUILD_IDENTITY.date;

export const APP_INFO_ROWS: AppInfoRow[] = [
  { label: 'Version', value: `${APP_VERSION} · build ${APP_BUILD_SHA} · ${APP_BUILD_DATE}` },
  {
    label: 'Live verification',
    value: 'Verified on the Codegeist dev site the same day: 9 Jira issues incl. AS-1, 12 Confluence pages, 1 JSM request, 2 projects.',
  },
  { label: 'Forge app', value: APP_ID },
  { label: 'Built for', value: APP_BUILT_FOR },
  {
    label: 'Live data',
    value:
      'Jira, Confluence, JSM, Intelligence and Overview stats read live data inside the installed Forge app; there is no demo dataset.',
  },
];

export const APP_DEPLOY_NOTE =
  `${APP_VERSION} is the Forge app version; every merge to main deploys automatically via GitHub Actions — no deploy happens from this view. This build is commit ${APP_BUILD_SHA}, built ${APP_BUILD_DATE}; the deploy workflow assigns no deploy number.`;
