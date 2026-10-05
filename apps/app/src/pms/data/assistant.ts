import {
  AssistantCurrentConversation,
  AssistantFeedbackResult,
  SendAssistantEscalationResult,
  type SupportTopic,
  AssistantProposalResult,
  SendAssistantMessageResult,
  type SendAssistantMessageInput,
} from "@injishi/contracts";

import { API_BASE, ApiError, humanError, readRefusal } from "./api";
import { branchHeader } from "./branch";

/**
 * The support assistant from the operator app (ADR-061 slice D).
 *
 * Its own fetch rather than `command`: an assistant turn may take up to the
 * 60 s the API promises, ten times `command`'s ceiling. It still names the
 * workspace and the branch in view exactly as `command` does, so the API
 * resolves the same grant and branch scope the screens act under.
 *
 * Every response is checked against the contract before it is shown.
 */
const TURN_TIMEOUT_MS = 65_000;
const READ_TIMEOUT_MS = 10_000;

export type AssistantResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

async function call<T>(
  path: string,
  workspaceId: string,
  parse: (data: unknown) => T | null,
  init: { method?: "GET" | "POST"; body?: unknown; timeoutMs: number; idempotencyKey?: string },
): Promise<AssistantResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  const headers: Record<string, string> = { "x-workspace-id": workspaceId, ...branchHeader() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const refusal = await readRefusal(res);
      return { ok: false, message: humanError(refusal), code: codeOf(refusal) };
    }
    const data = parse(await res.json());
    return data === null
      ? { ok: false, message: "The assistant sent an answer this app could not read. Try again." }
      : { ok: true, data };
  } catch {
    return { ok: false, message: "The assistant couldn't be reached. Your question wasn't sent; try again in a moment." };
  } finally {
    clearTimeout(timer);
  }
}

function codeOf(error: ApiError): string | undefined {
  const body = error.body as { code?: unknown } | null;
  return typeof body?.code === "string" ? body.code : undefined;
}

export function getAssistantConversation(workspaceId: string): Promise<AssistantResult<AssistantCurrentConversation>> {
  return call("/assistant/conversations/current?surface=app", workspaceId, (d) => {
    const parsed = AssistantCurrentConversation.safeParse(d);
    return parsed.success ? parsed.data : null;
  }, { timeoutMs: READ_TIMEOUT_MS });
}

/**
 * Approve or reject a change the assistant prepared (ADR-061 D-k). This is the
 * person's own decision: the key is minted ONCE per press by the caller, so a
 * retried request finds the first outcome instead of changing the price twice.
 */
export function decideAssistantProposal(
  workspaceId: string,
  proposalId: string,
  decision: "approve" | "reject",
  idempotencyKey: string,
): Promise<AssistantResult<AssistantProposalResult>> {
  return call(
    `/assistant/actions/${proposalId}/${decision}`,
    workspaceId,
    (d) => {
      const parsed = AssistantProposalResult.safeParse(d);
      return parsed.success ? parsed.data : null;
    },
    { method: "POST", timeoutMs: READ_TIMEOUT_MS, idempotencyKey: decision === "approve" ? idempotencyKey : undefined },
  );
}

export function sendAssistantMessage(
  workspaceId: string,
  input: Omit<SendAssistantMessageInput, "surface">,
): Promise<AssistantResult<SendAssistantMessageResult>> {
  return call("/assistant/messages", workspaceId, (d) => {
    const parsed = SendAssistantMessageResult.safeParse(d);
    return parsed.success ? parsed.data : null;
  }, { method: "POST", body: { ...input, surface: "app" }, timeoutMs: TURN_TIMEOUT_MS });
}

/** Send the conversation to Injishi support (ADR-061 D-l); the account's address is used. */
export function sendAssistantEscalation(
  workspaceId: string,
  topic: SupportTopic,
): Promise<AssistantResult<SendAssistantEscalationResult>> {
  return call("/assistant/escalations", workspaceId, (d) => {
    const parsed = SendAssistantEscalationResult.safeParse(d);
    return parsed.success ? parsed.data : null;
  }, { method: "POST", body: { surface: "app", topic }, timeoutMs: READ_TIMEOUT_MS });
}

/** Mark one answer helpful or not (ADR-061 D-m). */
export function sendAssistantFeedback(
  workspaceId: string,
  messageId: string,
  helpful: boolean,
): Promise<AssistantResult<AssistantFeedbackResult>> {
  return call(`/assistant/messages/${messageId}/feedback`, workspaceId, (d) => {
    const parsed = AssistantFeedbackResult.safeParse(d);
    return parsed.success ? parsed.data : null;
  }, { method: "POST", body: { helpful }, timeoutMs: READ_TIMEOUT_MS });
}
