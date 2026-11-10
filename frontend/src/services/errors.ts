// User-facing copy for live-service failures — single source of truth.
//
// One condition, one wording (Nielsen H4 — consistency): the same
// backend failure must never read differently per service. The wording
// follows the Jira service's established pattern, chosen deliberately
// in Task 5.1: a failed bridge call means the Forge backend could not
// be reached — it must never be reported as a missing installation
// ("available only inside the installed Forge app"), a message that
// misled a real live test.
//
// Every live service (Jira, Confluence, JSM, Intelligence) builds its
// BACKEND_UNREACHABLE / API_ERROR / unreachable fallbacks from here,
// so the copy cannot drift again when a service is added or edited.

export type LiveServiceName = 'Jira' | 'Confluence' | 'JSM' | 'Intelligence';

export interface BackendUnreachableError {
  kind: 'BACKEND_UNREACHABLE';
  message: string;
}

/** The bridge call itself failed: no Forge backend answered. Retryable. */
export function backendUnreachableError(service: LiveServiceName): BackendUnreachableError {
  return {
    kind: 'BACKEND_UNREACHABLE',
    message: `Live ${service} could not reach the Forge backend. Try again shortly.`,
  };
}

/** The backend answered, but the payload was not the expected shape. */
export const UNEXPECTED_RESPONSE_MESSAGE =
  'The Forge backend returned an unexpected response. Try again shortly.';

/** The backend answered with a failure and no usable message. */
export function serviceUnreachableMessage(service: LiveServiceName): string {
  return `${service} could not be reached. Try again shortly.`;
}
