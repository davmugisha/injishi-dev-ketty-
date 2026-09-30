import { z } from "zod";
import { Uuid } from "./primitives";
import { SUPPORT_EMAIL_MAX, SUPPORT_NAME_MAX, SupportTopic } from "./support";

/**
 * Support assistant wire contract (ADR-061, F-S16).
 *
 * `POST /api/v1/assistant/messages` is a PUBLIC write, like the support
 * intake: a signed-out visitor may ask too. So every string is capped, unknown
 * keys are refused (`.strict()`), and nothing about who is asking comes from
 * the body. The asker is the session, or the anonymous conversation cookie the
 * API sets; neither is ever a field here.
 *
 * The caps are exported so every surface sets the same `maxLength` and the two
 * ends cannot disagree about what fits.
 */

/** Longest message accepted: a detailed question, not a document. */
export const ASSISTANT_MESSAGE_MAX = 2000;
/** Longest page path recorded with a message (Phase 2 context, stored only). */
export const ASSISTANT_PAGE_PATH_MAX = 200;
/** User turns in one conversation before the user is asked to start a new one. */
export const ASSISTANT_TURN_LIMIT = 40;

/** Which surface a conversation was started on. */
export const AssistantSurface = z.enum(["web", "app", "admin", "mobile"]);
export type AssistantSurface = z.infer<typeof AssistantSurface>;

export const SendAssistantMessageInput = z
  .object({
    message: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX),
    surface: AssistantSurface,
    // Where the person was when they asked. Recorded for Phase 2 and read by
    // nothing yet (ADR-061, C13). A path, never a full URL: a query string can
    // carry a token.
    pagePath: z
      .string()
      .trim()
      .max(ASSISTANT_PAGE_PATH_MAX)
      .regex(/^\/[^?#\s]*$/, "expected a path starting with /")
      .optional(),
    // Close the current conversation and start a fresh one with this message.
    startNew: z.boolean().optional(),
  })
  .strict();
export type SendAssistantMessageInput = z.infer<
  typeof SendAssistantMessageInput
>;

/**
 * Where an answer came from. The assistant may only cite what a tool returned
 * in the same turn; the API drops any citation it cannot trace to one.
 */
export const AssistantSourceKind = z.enum([
  "article",
  "task",
  "tutorial",
  "listing",
  "record",
]);
export type AssistantSourceKind = z.infer<typeof AssistantSourceKind>;

export const AssistantSource = z.object({
  kind: AssistantSourceKind,
  id: z.string(),
  title: z.string(),
  /** A path on the surface that opens it, or null when there is none. */
  href: z.string().nullable(),
});
export type AssistantSource = z.infer<typeof AssistantSource>;

/**
 * A change the assistant prepared and the person has not yet approved
 * (ADR-061 D-k). The surface draws its approval card from THIS, the stored
 * row, never from the model's words: what the person approves is exactly what
 * will be executed.
 */
export const AssistantProposalKind = z.enum(["room_type.price"]);
export type AssistantProposalKind = z.infer<typeof AssistantProposalKind>;

export const AssistantProposalState = z.enum([
  "proposed",
  "approved",
  "executed",
  "failed",
  "rejected",
  "expired",
]);
export type AssistantProposalState = z.infer<typeof AssistantProposalState>;

export const AssistantProposal = z.object({
  id: Uuid,
  kind: AssistantProposalKind,
  /** What changes, e.g. "Double room: price per night". */
  title: z.string(),
  /** The value the card shows as current, formatted for people. */
  current: z.string(),
  /** The value approval would set, formatted for people. */
  proposed: z.string(),
  state: AssistantProposalState,
  expiresAt: z.string().datetime({ offset: true }),
  /** Why it failed or could not be approved, when it did not execute. */
  error: z.string().nullable(),
});
export type AssistantProposal = z.infer<typeof AssistantProposal>;

/** `POST /api/v1/assistant/actions/:id/approve` and `/reject`. */
export const AssistantProposalResult = z.object({ proposal: AssistantProposal });
export type AssistantProposalResult = z.infer<typeof AssistantProposalResult>;

export const AssistantRole = z.enum(["user", "assistant"]);
export type AssistantRole = z.infer<typeof AssistantRole>;

export const AssistantMessage = z.object({
  id: Uuid,
  role: AssistantRole,
  text: z.string(),
  sources: z.array(AssistantSource),
  /** Changes this answer prepared, each awaiting the person's own approval. */
  proposals: z.array(AssistantProposal),
  /**
   * Set when this answer offers human support (ADR-061 D-l): the surface
   * shows a "Send to Injishi support" button. The person sends it; the model
   * never does.
   */
  escalation: z.object({ topic: SupportTopic }).nullable(),
  /** Whether the person marked this answer helpful; null until they do. */
  helpful: z.boolean().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type AssistantMessage = z.infer<typeof AssistantMessage>;

export const AssistantConversation = z.object({
  id: Uuid,
  surface: AssistantSurface,
  /** True while no account owns it (ADR-061 D-c). */
  anonymous: z.boolean(),
  messages: z.array(AssistantMessage),
  /** User turns left before the conversation is full. */
  turnsLeft: z.number().int().nonnegative(),
  /** When it is deleted if nothing more is said (ADR-061 D-d). */
  expiresAt: z.string().datetime({ offset: true }),
});
export type AssistantConversation = z.infer<typeof AssistantConversation>;

/** `POST /api/v1/assistant/messages`: the conversation as it now stands. */
export const SendAssistantMessageResult = z.object({
  conversation: AssistantConversation,
  /**
   * The anonymous token of a conversation this request STARTED, returned only
   * to a native client (`x-assistant-client: native`, ADR-061 D-c), which keeps
   * it in the keychain and sends it back as `x-assistant-token`. A web page
   * never receives it: there it rides in the `HttpOnly` cookie.
   */
  anonToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
});
export type SendAssistantMessageResult = z.infer<
  typeof SendAssistantMessageResult
>;

/**
 * `GET /api/v1/assistant/conversations/current`. `enabled` is false when the
 * API runs with the assistant off, and a surface then draws no entry point.
 */
export const AssistantCurrentConversation = z.object({
  enabled: z.boolean(),
  conversation: AssistantConversation.nullable(),
  /**
   * True when a signed in caller still carries an anonymous conversation that
   * can be attached to their account (ADR-061 D-e). The surface then calls
   * `POST /api/v1/assistant/conversations/claim`.
   */
  claimable: z.boolean(),
});
export type AssistantCurrentConversation = z.infer<
  typeof AssistantCurrentConversation
>;

/**
 * `POST /api/v1/assistant/conversations/claim`. `claimed` is false when there
 * was nothing to attach: no cookie, an expired conversation, or one that
 * already belongs to an account. Either way the anonymous cookie is cleared.
 */
export const ClaimAssistantConversationInput = z
  .object({
    surface: AssistantSurface,
    // The person said the earlier conversation is not theirs (a shared
    // device): close it without attaching anything. Consent is asked for
    // because a cookie proves a browser, not a person.
    discard: z.boolean().optional(),
  })
  .strict();
export type ClaimAssistantConversationInput = z.infer<
  typeof ClaimAssistantConversationInput
>;

export const ClaimAssistantConversationResult = z.object({
  claimed: z.boolean(),
  conversation: AssistantConversation.nullable(),
});
export type ClaimAssistantConversationResult = z.infer<
  typeof ClaimAssistantConversationResult
>;

/** The stable `code` on an assistant error body. */
export const AssistantErrorCode = z.enum([
  "assistant_off",
  "conversation_full",
  "conversation_busy",
  "model_unavailable",
  // Approval refusals (ADR-061 D-k).
  "proposal_closed",
  "proposal_expired",
  "proposal_stale",
]);
export type AssistantErrorCode = z.infer<typeof AssistantErrorCode>;

/**
 * `POST /api/v1/assistant/escalations`: the person sends their conversation
 * to Injishi support (ADR-061 D-l). A signed in requester comes from the
 * session; signed out, `email` is required, typed by the person, because the
 * model never sees or supplies an address. Throttled like the support intake.
 */
export const SendAssistantEscalationInput = z
  .object({
    surface: AssistantSurface,
    topic: SupportTopic,
    email: z.string().trim().toLowerCase().max(SUPPORT_EMAIL_MAX).email().optional(),
    name: z.string().trim().min(1).max(SUPPORT_NAME_MAX).optional(),
  })
  .strict();
export type SendAssistantEscalationInput = z.infer<typeof SendAssistantEscalationInput>;

export const SendAssistantEscalationResult = z.object({ ticketId: Uuid });
export type SendAssistantEscalationResult = z.infer<typeof SendAssistantEscalationResult>;

/** `POST /api/v1/assistant/messages/:id/feedback` (ADR-061 D-m). */
export const AssistantFeedbackInput = z.object({ helpful: z.boolean() }).strict();
export type AssistantFeedbackInput = z.infer<typeof AssistantFeedbackInput>;

export const AssistantFeedbackResult = z.object({ messageId: Uuid, helpful: z.boolean() });
export type AssistantFeedbackResult = z.infer<typeof AssistantFeedbackResult>;
