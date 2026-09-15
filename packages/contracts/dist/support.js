"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSupportTicketResult = exports.CreateSupportTicketInput = exports.SupportTopic = exports.SUPPORT_PHONE_MAX = exports.SUPPORT_NAME_MAX = exports.SUPPORT_EMAIL_MAX = exports.SUPPORT_MESSAGE_MAX = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * Support intake wire contract — `POST /api/v1/support/tickets`.
 *
 * This is a PUBLIC write: a signed-out visitor needs help too, so anybody can
 * reach it. Every rule below exists because of that.
 *
 * EVERY STRING IS CAPPED. An uncapped text field on an anonymous write is a
 * storage bill anybody can run up and a rendering hazard on the staff screen
 * that lists it. The caps are exported so the form can set the same
 * `maxLength` and the two ends cannot disagree about what fits.
 *
 * THE TOPIC IS A CLOSED SET, not free text. It lands in
 * `support_tickets.category`, which the admin moderation screen shows as the
 * ticket's subject line, so a free-text topic would put a stranger's words in
 * the one column staff read first. Four slugs cannot carry anything.
 *
 * UNKNOWN KEYS ARE REFUSED (`.strict()`). Nothing about who is asking may come
 * from the body — the requester is read from the session, never supplied — and
 * refusing extra keys means a client that tries to send one is told so instead
 * of silently ignored.
 */
/** Longest message accepted: a long, detailed complaint, not a document. */
exports.SUPPORT_MESSAGE_MAX = 4000;
/** RFC 5321's limit on a forward path; no deliverable address is longer. */
exports.SUPPORT_EMAIL_MAX = 254;
/** Room for a full name in any script, not for a paragraph posing as one. */
exports.SUPPORT_NAME_MAX = 120;
/** E.164 is 15 digits; the rest is room for spaces, brackets and a `+`. */
exports.SUPPORT_PHONE_MAX = 32;
exports.SupportTopic = zod_1.z.enum(["booking", "payment", "listing", "other"]);
exports.CreateSupportTicketInput = zod_1.z
    .object({
    topic: exports.SupportTopic,
    message: zod_1.z.string().trim().min(1).max(exports.SUPPORT_MESSAGE_MAX),
    // Lower-cased so one address is one address to the per-email throttle and
    // to whoever replies.
    email: zod_1.z.string().trim().toLowerCase().max(exports.SUPPORT_EMAIL_MAX).email(),
    name: zod_1.z.string().trim().min(1).max(exports.SUPPORT_NAME_MAX).optional(),
    // Digits and the punctuation people type around them. Anything else is
    // not a phone number, and letting it through is letting prose through.
    phone: zod_1.z
        .string()
        .trim()
        .min(1)
        .max(exports.SUPPORT_PHONE_MAX)
        .regex(/^[+0-9 ()-]+$/, "expected a phone number")
        .optional(),
})
    .strict();
/**
 * What a successful submission returns: the ticket id and nothing else. The
 * message is never echoed back — a response that repeats a stranger's text is
 * one more place it can be rendered.
 */
exports.CreateSupportTicketResult = zod_1.z.object({ id: primitives_1.Uuid });
//# sourceMappingURL=support.js.map