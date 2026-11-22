import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors.ts';
import { toCitations, type Citation } from './agent.ts';
export interface ConversationSummary { id: string; title: string; createdAt: string; updatedAt: string; turnCount: number }
// Citations ride on the turn (backend memory.js sanitizeCitations), so
// a restored answer keeps its Sources links. Absent on turns stored
// before this change — callers treat missing as [].
export interface ConversationTurn { question: string; answer: string; at: string; citations?: Citation[] }
export interface ConversationLastReadiness { score: number | null; breakdown: { Bcrit: number; Isev: number; Pstale: number; Dmissing: number }; generatedAt: string }
export interface Conversation { id: string; title: string; turns: ConversationTurn[]; lastReadiness: ConversationLastReadiness | null; createdAt: string; updatedAt: string }
export type ConversationsResult = { ok: true; conversations: ConversationSummary[] } | { ok: false; error: { kind: string; message: string } };
export type ConversationResult = { ok: true; conversation: Conversation } | { ok: false; error: { kind: string; message: string } };
export type SiteInfoResult = { ok: true; siteUrl: string } | { ok: false; error: { kind: string; message: string } };
export type VoidResult = { ok: true } | { ok: false; error: { kind: string; message: string } };
function toError(value: Record<string, unknown>): { kind: string; message: string } {
  const error = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
  return { kind: typeof error.kind === 'string' ? error.kind : 'API_ERROR', message: typeof error.message === 'string' ? error.message : serviceUnreachableMessage('Intelligence') };
}
function isSummary(value: unknown): value is ConversationSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id !== '' && typeof v.title === 'string'
    && typeof v.createdAt === 'string' && typeof v.updatedAt === 'string' && typeof v.turnCount === 'number';
}
function isTurn(value: unknown): value is ConversationTurn {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.question === 'string' && typeof v.answer === 'string' && typeof v.at === 'string'
    && (v.citations === undefined || Array.isArray(v.citations));
}
// Drop malformed citations from a stored turn (the backend already
// sanitizes on write; this is defense in depth for older records).
export function sanitizeConversationTurn(value: ConversationTurn): ConversationTurn {
  if (value.citations === undefined) return value;
  const citations = toCitations(value.citations);
  return citations.length > 0 ? { ...value, citations } : { question: value.question, answer: value.answer, at: value.at };
}
function cleanConversation(value: Conversation): Conversation {
  return { ...value, turns: value.turns.map(sanitizeConversationTurn) };
}
function isLastReadiness(value: unknown): value is ConversationLastReadiness {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const b = v.breakdown as Record<string, unknown> | undefined;
  return (typeof v.score === 'number' || v.score === null) && !!b
    && ['Bcrit', 'Isev', 'Pstale', 'Dmissing'].every((k) => typeof b[k] === 'number')
    && typeof v.generatedAt === 'string';
}
function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id !== '' && typeof v.title === 'string'
    && Array.isArray(v.turns) && (v.turns as unknown[]).every(isTurn)
    && (v.lastReadiness === null || isLastReadiness(v.lastReadiness))
    && typeof v.createdAt === 'string' && typeof v.updatedAt === 'string';
}
async function callResolver(name: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const { invoke } = await import('@forge/bridge');
    const result: unknown = await invoke(name, payload);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    return result as Record<string, unknown>;
  } catch {
    return null;
  }
}
export async function listConversations(): Promise<ConversationsResult> {
  const value = await callResolver('listConversations', {});
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true || !Array.isArray(value.conversations)) {
    return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) };
  }
  return { ok: true, conversations: (value.conversations as unknown[]).filter(isSummary) };
}
export async function createConversation(title?: string): Promise<ConversationResult> {
  const value = await callResolver('createConversation', { ...(title ? { title } : {}) });
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true || !isConversation(value.conversation)) {
    return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) };
  }
  return { ok: true, conversation: value.conversation as Conversation };
}
export async function renameConversation(conversationId: string, title: string): Promise<ConversationResult> {
  const value = await callResolver('renameConversation', { conversationId, title });
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true || !isConversation(value.conversation)) {
    return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) };
  }
  return { ok: true, conversation: value.conversation as Conversation };
}
export async function deleteConversation(conversationId: string): Promise<VoidResult> {
  const value = await callResolver('deleteConversation', { conversationId });
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true) return { ok: false, error: toError(value) };
  return { ok: true };
}
export async function getConversation(conversationId: string): Promise<ConversationResult> {
  const value = await callResolver('getConversation', { conversationId });
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true || !isConversation(value.conversation)) {
    return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) };
  }
  return { ok: true, conversation: cleanConversation(value.conversation as Conversation) };
}
// The site URL is fetched once per session and shared by every record
// link (cards, search, Intelligence citations): the promise is cached
// so ten components do not fire ten identical resolver calls.
let siteInfoPromise: Promise<SiteInfoResult> | null = null;

export async function getSiteInfo(): Promise<SiteInfoResult> {
  if (siteInfoPromise) return siteInfoPromise;
  siteInfoPromise = (async () => {
    const value = await callResolver('getSiteInfo', {});
    if (!value) return { ok: false, error: backendUnreachableError('Intelligence') } as SiteInfoResult;
    if (value.ok !== true || typeof value.siteUrl !== 'string' || value.siteUrl === '') {
      return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) } as SiteInfoResult;
    }
    return { ok: true, siteUrl: value.siteUrl as string } as SiteInfoResult;
  })();
  const result = await siteInfoPromise;
  // Cache only successes: a failed fetch clears so a later call retries
  // instead of serving the failure for the whole session.
  if (!result.ok) siteInfoPromise = null;
  return result;
}
