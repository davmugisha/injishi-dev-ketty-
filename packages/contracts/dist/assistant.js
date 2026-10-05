"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantUsageReport = exports.AssistantCallerRole = exports.AssistantUsageQuery = exports.AssistantUsageMonth = exports.AssistantFeedbackResult = exports.AssistantFeedbackInput = exports.SendAssistantEscalationResult = exports.SendAssistantEscalationInput = exports.AssistantErrorCode = exports.ClaimAssistantConversationResult = exports.ClaimAssistantConversationInput = exports.AssistantCurrentConversation = exports.SendAssistantMessageResult = exports.AssistantConversation = exports.AssistantMessage = exports.AssistantRole = exports.AssistantProposalResult = exports.AssistantProposal = exports.AssistantProposalState = exports.AssistantProposalKind = exports.AssistantSource = exports.AssistantSourceKind = exports.SendAssistantMessageInput = exports.AssistantSurface = exports.ASSISTANT_TURN_LIMIT = exports.ASSISTANT_PAGE_PATH_MAX = exports.ASSISTANT_MESSAGE_MAX = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const support_1 = require("./support");
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
exports.ASSISTANT_MESSAGE_MAX = 2000;
/** Longest page path recorded with a message (Phase 2 context, stored only). */
exports.ASSISTANT_PAGE_PATH_MAX = 200;
/** User turns in one conversation before the user is asked to start a new one. */
exports.ASSISTANT_TURN_LIMIT = 40;
/** Which surface a conversation was started on. */
exports.AssistantSurface = zod_1.z.enum(["web", "app", "admin", "mobile"]);
exports.SendAssistantMessageInput = zod_1.z
    .object({
    message: zod_1.z.string().trim().min(1).max(exports.ASSISTANT_MESSAGE_MAX),
    surface: exports.AssistantSurface,
    // Where the person was when they asked. Recorded for Phase 2 and read by
    // nothing yet (ADR-061, C13). A path, never a full URL: a query string can
    // carry a token.
    pagePath: zod_1.z
        .string()
        .trim()
        .max(exports.ASSISTANT_PAGE_PATH_MAX)
        .regex(/^\/[^?#\s]*$/, "expected a path starting with /")
        .optional(),
    // Close the current conversation and start a fresh one with this message.
    startNew: zod_1.z.boolean().optional(),
})
    .strict();
/**
 * Where an answer came from. The assistant may only cite what a tool returned
 * in the same turn; the API drops any citation it cannot trace to one.
 */
exports.AssistantSourceKind = zod_1.z.enum([
    "article",
    "task",
    "tutorial",
    "listing",
    "record",
]);
exports.AssistantSource = zod_1.z.object({
    kind: exports.AssistantSourceKind,
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    /** A path on the surface that opens it, or null when there is none. */
    href: zod_1.z.string().nullable(),
});
/**
 * A change the assistant prepared and the person has not yet approved
 * (ADR-061 D-k). The surface draws its approval card from THIS, the stored
 * row, never from the model's words: what the person approves is exactly what
 * will be executed.
 */
exports.AssistantProposalKind = zod_1.z.enum(["room_type.price"]);
exports.AssistantProposalState = zod_1.z.enum([
    "proposed",
    "approved",
    "executed",
    "failed",
    "rejected",
    "expired",
]);
exports.AssistantProposal = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.AssistantProposalKind,
    /** What changes, e.g. "Double room: price per night". */
    title: zod_1.z.string(),
    /** The value the card shows as current, formatted for people. */
    current: zod_1.z.string(),
    /** The value approval would set, formatted for people. */
    proposed: zod_1.z.string(),
    state: exports.AssistantProposalState,
    expiresAt: zod_1.z.string().datetime({ offset: true }),
    /** Why it failed or could not be approved, when it did not execute. */
    error: zod_1.z.string().nullable(),
});
/** `POST /api/v1/assistant/actions/:id/approve` and `/reject`. */
exports.AssistantProposalResult = zod_1.z.object({ proposal: exports.AssistantProposal });
exports.AssistantRole = zod_1.z.enum(["user", "assistant"]);
exports.AssistantMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    role: exports.AssistantRole,
    text: zod_1.z.string(),
    sources: zod_1.z.array(exports.AssistantSource),
    /** Changes this answer prepared, each awaiting the person's own approval. */
    proposals: zod_1.z.array(exports.AssistantProposal),
    /**
     * Set when this answer offers human support (ADR-061 D-l): the surface
     * shows a "Send to Injishi support" button. The person sends it; the model
     * never does.
     */
    escalation: zod_1.z.object({ topic: support_1.SupportTopic }).nullable(),
    /** Whether the person marked this answer helpful; null until they do. */
    helpful: zod_1.z.boolean().nullable(),
    createdAt: zod_1.z.string().datetime({ offset: true }),
});
exports.AssistantConversation = zod_1.z.object({
    id: primitives_1.Uuid,
    surface: exports.AssistantSurface,
    /** True while no account owns it (ADR-061 D-c). */
    anonymous: zod_1.z.boolean(),
    messages: zod_1.z.array(exports.AssistantMessage),
    /** User turns left before the conversation is full. */
    turnsLeft: zod_1.z.number().int().nonnegative(),
    /** When it is deleted if nothing more is said (ADR-061 D-d). */
    expiresAt: zod_1.z.string().datetime({ offset: true }),
});
/** `POST /api/v1/assistant/messages`: the conversation as it now stands. */
exports.SendAssistantMessageResult = zod_1.z.object({
    conversation: exports.AssistantConversation,
    /**
     * The anonymous token of a conversation this request STARTED, returned only
     * to a native client (`x-assistant-client: native`, ADR-061 D-c), which keeps
     * it in the keychain and sends it back as `x-assistant-token`. A web page
     * never receives it: there it rides in the `HttpOnly` cookie.
     */
    anonToken: zod_1.z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
});
/**
 * `GET /api/v1/assistant/conversations/current`. `enabled` is false when the
 * API runs with the assistant off, and a surface then draws no entry point.
 */
exports.AssistantCurrentConversation = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    conversation: exports.AssistantConversation.nullable(),
    /**
     * True when a signed in caller still carries an anonymous conversation that
     * can be attached to their account (ADR-061 D-e). The surface then calls
     * `POST /api/v1/assistant/conversations/claim`.
     */
    claimable: zod_1.z.boolean(),
});
/**
 * `POST /api/v1/assistant/conversations/claim`. `claimed` is false when there
 * was nothing to attach: no cookie, an expired conversation, or one that
 * already belongs to an account. Either way the anonymous cookie is cleared.
 */
exports.ClaimAssistantConversationInput = zod_1.z
    .object({
    surface: exports.AssistantSurface,
    // The person said the earlier conversation is not theirs (a shared
    // device): close it without attaching anything. Consent is asked for
    // because a cookie proves a browser, not a person.
    discard: zod_1.z.boolean().optional(),
})
    .strict();
exports.ClaimAssistantConversationResult = zod_1.z.object({
    claimed: zod_1.z.boolean(),
    conversation: exports.AssistantConversation.nullable(),
});
/** The stable `code` on an assistant error body. */
exports.AssistantErrorCode = zod_1.z.enum([
    "assistant_off",
    "conversation_full",
    "conversation_busy",
    // Retired by ADR-061 D-u: the API now answers by fallback with 200 and never
    // sends it. Kept so a client built against Phase 1 still parses.
    "model_unavailable",
    // Approval refusals (ADR-061 D-k).
    "proposal_closed",
    "proposal_expired",
    "proposal_stale",
]);
/**
 * `POST /api/v1/assistant/escalations`: the person sends their conversation
 * to Injishi support (ADR-061 D-l). A signed in requester comes from the
 * session; signed out, `email` is required, typed by the person, because the
 * model never sees or supplies an address. Throttled like the support intake.
 */
exports.SendAssistantEscalationInput = zod_1.z
    .object({
    surface: exports.AssistantSurface,
    topic: support_1.SupportTopic,
    email: zod_1.z.string().trim().toLowerCase().max(support_1.SUPPORT_EMAIL_MAX).email().optional(),
    name: zod_1.z.string().trim().min(1).max(support_1.SUPPORT_NAME_MAX).optional(),
})
    .strict();
exports.SendAssistantEscalationResult = zod_1.z.object({ ticketId: primitives_1.Uuid });
/** `POST /api/v1/assistant/messages/:id/feedback` (ADR-061 D-m). */
exports.AssistantFeedbackInput = zod_1.z.object({ helpful: zod_1.z.boolean() }).strict();
exports.AssistantFeedbackResult = zod_1.z.object({ messageId: primitives_1.Uuid, helpful: zod_1.z.boolean() });
/**
 * `GET /api/v1/admin/assistant/usage?month=YYYY-MM` (ADR-061 D-s), staff with
 * `admin.analytics.view`. A month is a UTC calendar month; unset means the
 * current one. Aggregates only: no person, conversation or text is returned.
 */
exports.AssistantUsageMonth = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is written YYYY-MM.");
exports.AssistantUsageQuery = zod_1.z.object({ month: exports.AssistantUsageMonth.optional() }).strict();
exports.AssistantCallerRole = zod_1.z.enum(["anonymous", "signed_in", "operator", "staff"]);
const count = zod_1.z.number().int().nonnegative();
const usd = zod_1.z.number().nonnegative();
const AssistantUsageSlice = zod_1.z.object({ modelRequests: count, estimatedCostUsd: usd });
exports.AssistantUsageReport = zod_1.z.object({
    month: exports.AssistantUsageMonth,
    /** The month's first instant and the next month's, ISO 8601 in UTC. */
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    /** US dollars per million tokens, as configured when the report was read. */
    prices: zod_1.z.object({
        inputPerMTokUsd: usd,
        outputPerMTokUsd: usd,
        cacheReadPerMTokUsd: usd,
        cacheWritePerMTokUsd: usd,
    }),
    modelRequests: count,
    tokens: zod_1.z.object({ input: count, output: count, cacheRead: count, cacheWrite: count }),
    /** Each call priced when it was made, summed; an estimate, not an invoice. */
    estimatedCostUsd: usd,
    /** Stored answers by how they were produced (D-q, D-u). */
    answers: zod_1.z.object({ direct: count, ai: count, fallback: count, total: count }),
    /** Every user turn, one row each (D-s, D-x, D-y). */
    turns: zod_1.z.object({
        total: count,
        /** How turns ended; `failed` stored nothing; `truncated` hit the output ceiling. */
        byOutcome: zod_1.z.object({
            answered: count,
            fallback: count,
            withheld: count,
            truncated: count,
            out_of_time: count,
            step_limit: count,
            refused: count,
            failed: count,
        }),
        /** Model answered turns by the calls they took: one is the norm (D-x). */
        modelCallsPerModelTurn: zod_1.z.object({ one: count, two: count, threeOrMore: count }),
        /** Model answered turns where the gathered data was enough: candidates for a router rule. */
        modelTurnsWithoutOwnToolCalls: count,
        tools: zod_1.z.array(zod_1.z.object({ tool: zod_1.z.string(), runs: count })),
    }),
    byRequestType: zod_1.z.array(AssistantUsageSlice.extend({ requestType: zod_1.z.string() })),
    byCallerRole: zod_1.z.array(AssistantUsageSlice.extend({ callerRole: exports.AssistantCallerRole })),
    byModel: zod_1.z.array(AssistantUsageSlice.extend({ model: zod_1.z.string() })),
});
//# sourceMappingURL=assistant.js.map