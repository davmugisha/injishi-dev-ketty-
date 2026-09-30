"use server";

import {
  AssistantFeedbackInput,
  AssistantFeedbackResult,
  SendAssistantEscalationInput,
  SendAssistantEscalationResult,
  SendAssistantMessageInput,
  SendAssistantMessageResult,
  SupportTopic,
  Uuid,
} from "@injishi/contracts";

import { apiPost, type ApiWriteFailure } from "@/lib/api/server";

/**
 * The support assistant from the admin console (ADR-061 slice G).
 *
 * Server Actions for the reason every console call is one: the session cookie
 * belongs to the API origin, so only a server-side call carries it. A staffer
 * is always signed in here, so the conversation is owned by their account and
 * no anonymous cookie is ever involved.
 *
 * The console sends no workspace, so the API resolves no operator scope: the
 * staffer gets Injishi's knowledge and guides, and no business's data (D-f).
 *
 * Every input is checked against the API's own contract before it is sent, and
 * every answer is parsed against it before the panel shows it.
 */

const BASE = "/api/v1/assistant";

/** The API bounds a turn at 55 s (D-p); the round trip gets a little more. */
const TURN_TIMEOUT_MS = 65_000;

export type AssistantOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

const REFUSED: Record<ApiWriteFailure, string> = {
  anonymous: "Your session has ended. Sign in again to use the assistant.",
  denied: "Your account can't use that here.",
  step_up: "Enter your sign in code first, then try again.",
  unreachable: "The assistant couldn't be reached. Nothing was sent; try again in a moment.",
  invalid: "The assistant sent an answer this console could not read. Try again.",
  missing: "That answer is no longer in this conversation.",
  conflict: "That couldn't be done right now. Try again.",
  rejected: "That request wasn't accepted. It's a bug on our side.",
};

const BAD_INPUT = "That couldn't be sent. Check what you typed and try again.";

function refused(result: { reason: ApiWriteFailure; message?: string; code?: string }): {
  ok: false;
  message: string;
  code?: string;
} {
  return {
    ok: false,
    message: result.message ?? REFUSED[result.reason],
    ...(result.code ? { code: result.code } : {}),
  };
}

/** One turn. `startNew` closes the open conversation first. */
export async function sendAdminAssistantMessage(input: {
  message: string;
  pagePath?: string;
  startNew?: boolean;
}): Promise<AssistantOutcome<SendAssistantMessageResult>> {
  const body = SendAssistantMessageInput.safeParse({ ...input, surface: "admin" });
  if (!body.success) return { ok: false, message: BAD_INPUT };
  const result = await apiPost(`${BASE}/messages`, SendAssistantMessageResult, body.data, {
    timeoutMs: TURN_TIMEOUT_MS,
  });
  return result.ok ? result : refused(result);
}

/** Send the conversation to Injishi support (D-l). The account's address is used. */
export async function sendAdminAssistantEscalation(
  topic: string,
): Promise<AssistantOutcome<SendAssistantEscalationResult>> {
  const parsedTopic = SupportTopic.safeParse(topic);
  if (!parsedTopic.success) return { ok: false, message: BAD_INPUT };
  const body = SendAssistantEscalationInput.safeParse({ surface: "admin", topic: parsedTopic.data });
  if (!body.success) return { ok: false, message: BAD_INPUT };
  const result = await apiPost(`${BASE}/escalations`, SendAssistantEscalationResult, body.data);
  return result.ok ? result : refused(result);
}

/** Helpful or not, once per answer (D-m). */
export async function sendAdminAssistantFeedback(
  messageId: string,
  helpful: boolean,
): Promise<AssistantOutcome<AssistantFeedbackResult>> {
  const body = AssistantFeedbackInput.safeParse({ helpful });
  if (!Uuid.safeParse(messageId).success || !body.success) return { ok: false, message: BAD_INPUT };
  const result = await apiPost(`${BASE}/messages/${messageId}/feedback`, AssistantFeedbackResult, body.data);
  return result.ok ? result : refused(result);
}
