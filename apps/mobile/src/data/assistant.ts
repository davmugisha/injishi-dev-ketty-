/**
 * The support assistant from the mobile app (ADR-061 slice G).
 *
 * The same API, limits and rules as the web widget and the operator panel.
 * What differs is identity, because this app has no cookie jar (ADR-061 D-c):
 *
 * - Signed in, the bearer header is the asker, exactly as on every other call.
 * - Signed out, the conversation is named by a token the API hands to a NATIVE
 *   client alone, in the body of the answer that started it. It lives in the
 *   platform keychain, never in AsyncStorage, and goes back as
 *   `x-assistant-token` through `api.ts`, the one file that attaches headers.
 *
 * Every answer is parsed against the contract before a screen sees it.
 */
import * as SecureStore from 'expo-secure-store';
import {
  AssistantCurrentConversation,
  AssistantFeedbackResult,
  AssistantProposalResult,
  ClaimAssistantConversationResult,
  SendAssistantEscalationResult,
  SendAssistantMessageResult,
  type SupportTopic,
} from '@injishi/contracts';

import { api, type ApiCallOptions, type ApiResult } from '../lib/api';
import { ENDPOINTS, type ApiPath } from '../lib/endpoints';

export const ASSISTANT_TOKEN_KEY = 'injishi.assistant.token';

/** The API bounds a turn at 55 s (D-p); the round trip gets a little more. */
export const ASSISTANT_TURN_TIMEOUT_MS = 65_000;

/**
 * One outcome. `failed` is "we could not reach it" and the screen words it;
 * `refused` carries the server's own sentence and, when it sent one, its code
 * (`conversation_full`, `assistant_off`).
 */
export type AssistantOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'refused'; message: string; code?: string }
  | { kind: 'unauthenticated' }
  | { kind: 'failed' };

let cachedToken: string | null | undefined;

export async function readAssistantToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(ASSISTANT_TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

async function saveAssistantToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await SecureStore.setItemAsync(ASSISTANT_TOKEN_KEY, token);
  } catch {
    // The conversation still works for this launch from the cached value.
  }
}

/** Forget the signed out conversation: after a claim, a discard, or a sign out. */
export async function forgetAssistantToken(): Promise<void> {
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(ASSISTANT_TOKEN_KEY);
  } catch {
    // Nothing stored is the state we wanted.
  }
}

/** Tests only: drop the in memory copy so the keychain is read again. */
export function resetAssistantTokenCache(): void {
  cachedToken = undefined;
}

interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

async function call<T>(
  path: ApiPath,
  schema: Schema<T>,
  options: Omit<ApiCallOptions, 'assistant'> = {},
): Promise<AssistantOutcome<T>> {
  const token = await readAssistantToken();
  const answer: ApiResult<unknown> = await api<unknown>(path, { ...options, assistant: { token } });
  switch (answer.status) {
    case 'ok': {
      const parsed = schema.safeParse(answer.data);
      return parsed.success ? { kind: 'ok', data: parsed.data } : { kind: 'failed' };
    }
    case 'refused':
      return { kind: 'refused', message: answer.message, ...(answer.code ? { code: answer.code } : {}) };
    case 'unauthenticated':
      return { kind: 'unauthenticated' };
    case 'failed':
      return { kind: 'failed' };
  }
}

export function fetchAssistant(signal?: AbortSignal): Promise<AssistantOutcome<AssistantCurrentConversation>> {
  return call(ENDPOINTS.assistantCurrent, AssistantCurrentConversation, { signal });
}

export async function sendAssistantMessage(input: {
  message: string;
  pagePath?: string;
  startNew?: boolean;
}): Promise<AssistantOutcome<SendAssistantMessageResult>> {
  const result = await call(ENDPOINTS.assistantMessages, SendAssistantMessageResult, {
    method: 'POST',
    body: { ...input, surface: 'mobile' },
    timeoutMs: ASSISTANT_TURN_TIMEOUT_MS,
  });
  // A conversation this answer STARTED comes with its token; keep it.
  if (result.kind === 'ok' && result.data.anonToken) await saveAssistantToken(result.data.anonToken);
  return result;
}

/**
 * Attach the signed out conversation to the account, or discard it, with the
 * person's say so (D-e). The token is forgotten whatever the answer: once
 * signed in it opens nothing, and keeping it would hand what is left to the
 * next person who signs out on this phone.
 */
export async function claimAssistant(discard: boolean): Promise<AssistantOutcome<ClaimAssistantConversationResult>> {
  const result = await call(ENDPOINTS.assistantClaim, ClaimAssistantConversationResult, {
    method: 'POST',
    body: { surface: 'mobile', ...(discard ? { discard: true } : {}) },
  });
  if (result.kind !== 'failed') await forgetAssistantToken();
  return result;
}

/** Send the conversation to Injishi support (D-l). Signed out, `email` is required. */
export function sendAssistantEscalation(
  topic: SupportTopic,
  email?: string,
): Promise<AssistantOutcome<SendAssistantEscalationResult>> {
  return call(ENDPOINTS.assistantEscalations, SendAssistantEscalationResult, {
    method: 'POST',
    body: { surface: 'mobile', topic, ...(email ? { email } : {}) },
  });
}

/** Helpful or not, once per answer (D-m). */
export function sendAssistantFeedback(
  messageId: string,
  helpful: boolean,
): Promise<AssistantOutcome<AssistantFeedbackResult>> {
  return call(ENDPOINTS.assistantFeedback(messageId), AssistantFeedbackResult, {
    method: 'POST',
    body: { helpful },
  });
}

/**
 * Approve or reject a prepared change (D-k). The person's own decision; the
 * key is minted ONCE per press by the caller, so a retry acts once.
 */
export function decideAssistantProposal(
  proposalId: string,
  decision: 'approve' | 'reject',
  idempotencyKey: string,
): Promise<AssistantOutcome<AssistantProposalResult>> {
  return call(ENDPOINTS.assistantDecide(proposalId, decision), AssistantProposalResult, {
    method: 'POST',
    ...(decision === 'approve' ? { idempotencyKey } : {}),
  });
}
