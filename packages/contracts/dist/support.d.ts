import { z } from "zod";
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
export declare const SUPPORT_MESSAGE_MAX = 4000;
/** RFC 5321's limit on a forward path; no deliverable address is longer. */
export declare const SUPPORT_EMAIL_MAX = 254;
/** Room for a full name in any script, not for a paragraph posing as one. */
export declare const SUPPORT_NAME_MAX = 120;
/** E.164 is 15 digits; the rest is room for spaces, brackets and a `+`. */
export declare const SUPPORT_PHONE_MAX = 32;
export declare const SupportTopic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
export type SupportTopic = z.infer<typeof SupportTopic>;
export declare const CreateSupportTicketInput: z.ZodObject<{
    topic: z.ZodEnum<["booking", "payment", "listing", "other"]>;
    message: z.ZodString;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    message: string;
    email: string;
    topic: "other" | "booking" | "payment" | "listing";
    name?: string | undefined;
    phone?: string | undefined;
}, {
    message: string;
    email: string;
    topic: "other" | "booking" | "payment" | "listing";
    name?: string | undefined;
    phone?: string | undefined;
}>;
export type CreateSupportTicketInput = z.infer<typeof CreateSupportTicketInput>;
/**
 * What a successful submission returns: the ticket id and nothing else. The
 * message is never echoed back — a response that repeats a stranger's text is
 * one more place it can be rendered.
 */
export declare const CreateSupportTicketResult: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateSupportTicketResult = z.infer<typeof CreateSupportTicketResult>;
//# sourceMappingURL=support.d.ts.map