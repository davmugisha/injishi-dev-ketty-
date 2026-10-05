import {
  AssistantCurrentConversation,
  AssistantFeedbackResult,
  SendAssistantEscalationResult,
  type SendAssistantEscalationInput,
  ClaimAssistantConversationResult,
  SendAssistantMessageResult,
  type AssistantSurface,
  type SendAssistantMessageInput,
} from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for the support assistant (ADR-061), `/api/v1/assistant/*`.
 *
 * Every response is checked against the contract before it is shown: a 2xx
 * that is not a conversation is not an answer, and showing one as if it were
 * is the failure an assistant built for reliability must never produce.
 *
 * The anonymous conversation rides on an `HttpOnly` cookie the API sets;
 * `apiFetch` sends credentials, so nothing here stores or reads a token.
 */

/** The API caps a turn at 60 s; wait a little past that before giving up. */
const TURN_TIMEOUT_MS = 65_000;

export async function getAssistantConversation(
  surface: AssistantSurface,
): Promise<ApiResult<AssistantCurrentConversation>> {
  const result = await apiFetch<unknown>(
    `/api/v1/assistant/conversations/current?surface=${surface}`,
  );
  if (result.status !== "ok") return result;
  const parsed = AssistantCurrentConversation.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Attach the anonymous conversation this browser holds to the signed in
 * account (ADR-061 D-e), or with `discard` close it without attaching it,
 * when the person says it is not theirs. Called only after the person
 * answers the prompt `claimable` raises; the API clears the anonymous cookie
 * either way.
 */
export async function claimAssistantConversation(
  surface: AssistantSurface,
  discard = false,
): Promise<ApiResult<ClaimAssistantConversationResult>> {
  const result = await apiFetch<unknown>("/api/v1/assistant/conversations/claim", {
    method: "POST",
    body: discard ? { surface, discard: true } : { surface },
  });
  if (result.status !== "ok") return result;
  const parsed = ClaimAssistantConversationResult.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function sendAssistantMessage(
  input: SendAssistantMessageInput,
): Promise<ApiResult<SendAssistantMessageResult>> {
  const result = await apiFetch<unknown>("/api/v1/assistant/messages", {
    method: "POST",
    body: input,
    timeoutMs: TURN_TIMEOUT_MS,
  });
  if (result.status !== "ok") return result;
  const parsed = SendAssistantMessageResult.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Send the current conversation to Injishi support (ADR-061 D-l). The
 * person's own request; signed out, `email` is the address they typed.
 */
export async function sendAssistantEscalation(
  input: SendAssistantEscalationInput,
): Promise<ApiResult<SendAssistantEscalationResult>> {
  const result = await apiFetch<unknown>("/api/v1/assistant/escalations", { method: "POST", body: input });
  if (result.status !== "ok") return result;
  const parsed = SendAssistantEscalationResult.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/** Mark one answer helpful or not (ADR-061 D-m). */
export async function sendAssistantFeedback(
  messageId: string,
  helpful: boolean,
): Promise<ApiResult<AssistantFeedbackResult>> {
  const result = await apiFetch<unknown>(`/api/v1/assistant/messages/${messageId}/feedback`, {
    method: "POST",
    body: { helpful },
  });
  if (result.status !== "ok") return result;
  const parsed = AssistantFeedbackResult.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
