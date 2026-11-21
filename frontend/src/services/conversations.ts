import { backendUnreachableError, serviceUnreachableMessage, UNEXPECTED_RESPONSE_MESSAGE } from './errors';
export interface ConversationSummary { id: string; title: string; createdAt: string; updatedAt: string; turnCount: number }
export interface ConversationTurn { question: string; answer: string; at: string }
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
  return typeof v.question === 'string' && typeof v.answer === 'string' && typeof v.at === 'string';
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
  return { ok: true, conversation: value.conversation as Conversation };
}
export async function getSiteInfo(): Promise<SiteInfoResult> {
  const value = await callResolver('getSiteInfo', {});
  if (!value) return { ok: false, error: backendUnreachableError('Intelligence') };
  if (value.ok !== true || typeof value.siteUrl !== 'string' || value.siteUrl === '') {
    return { ok: false, error: value.ok === true ? { kind: 'API_ERROR', message: UNEXPECTED_RESPONSE_MESSAGE } : toError(value) };
  }
  return { ok: true, siteUrl: value.siteUrl as string };
}
