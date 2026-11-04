# Integrations

One adapter per Atlassian tool. Adapters live here; the Forge resolver in
`forge-app/src/` calls them, and the frontend never talks to Atlassian APIs
directly.

## Pattern (to follow when adapters are implemented)

- **One adapter per tool:** `jira/`, `confluence/`, `bitbucket/`, `jsm/`.
- **Independent failure:** each adapter fetches and maps its own source inside
  its own error boundary. If one source fails, the others still return data,
  and the UI reports exactly which source degraded — never a silent partial
  sync, never invented data.
- **No cross-tool coupling:** adapters share only the types in `shared/`.
- **Read-first:** adapters start read-only. Any future write operation gets
  its own explicit, scoped function and a manifest scope added deliberately.

## Status

No adapters are implemented yet — these directories are placeholders for the
structure. Each adapter will get its own module plus a short README describing
its source API, the fields it maps, and its failure modes.
