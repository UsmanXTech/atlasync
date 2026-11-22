// Dashboard domain types. Live data only — the demo/sample dataset was
// deleted, so every type here describes a live Atlassian record (or a
// live-derived aggregate) returned by the Forge backend.

export interface IssueBucket {
  label: string;
  count: number;
}

export interface InsightPoint {
  label: string;
  issues: number;
  docs: number;
  prs: number;
}

// A live Jira issue as returned by the Forge resolver — the small, typed
// payload the backend normalizes from the Jira REST response. Nullable
// fields stay explicit nulls so the UI can render "Unassigned" /
// "No priority" instead of guessing.
export interface LiveIssue {
  key: string;
  // Numeric Jira issue id (Task 6, Architecture A): the dev-status
  // endpoint needs it; null when the issue has no numeric id.
  id: string | null;
  summary: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  updated: string;
}


// Live read-only Confluence page metadata. `webui` is the record URL
// the API returns (_links.webui, e.g. "/spaces/AT/pages/12") — kept so
// the row can link to the original page; null when the API omits it.
export interface LiveConfluencePage {
  id: string;
  title: string;
  status: string;
  spaceId: string | null;
  webui: string | null;
  updated: string;
}

// Live read-only Jira Service Management request metadata.
export interface LiveJsmRequest {
  key: string;
  summary: string;
  status: string;
  requestType: string;
  priority: string | null;
  created: string;
}


export interface LiveJiraProject { id: string; key: string; name: string; projectType: string }
