import { z } from "zod";
import { IsoDate } from "./booking";
import { RosterCard } from "./people";
import { Uuid } from "./primitives";

/**
 * The staff help desk and the things a business lends its staff (058-staff-services).
 *
 * A person asks HR or IT a question from Me or the staff phone; HR answers in the same thread and
 * closes it. Keys, uniforms, phones and tools a person signs out are recorded against them until
 * they come back, so a leaver's last day can list what is still out.
 */

// ---------------------------------------------------------------------------
// Help desk
// ---------------------------------------------------------------------------

export const HrTicketTopic = z.enum(["pay", "leave", "documents", "uniform", "it", "other"]);
export type HrTicketTopic = z.infer<typeof HrTicketTopic>;
export const HrTicketStatus = z.enum(["open", "answered", "closed"]);
export type HrTicketStatus = z.infer<typeof HrTicketStatus>;

export const HrTicketMessage = z.object({
    id: Uuid,
    /** The person who asked, or HR answering. */
    fromStaff: z.boolean(),
    authorName: z.string().nullable(),
    body: z.string(),
    createdAt: z.string(),
});
export type HrTicketMessage = z.infer<typeof HrTicketMessage>;

export const HrTicket = z.object({
    id: Uuid,
    /** "HD-0007": what a person quotes when they ask about it. */
    reference: z.string(),
    employee: RosterCard,
    topic: HrTicketTopic,
    subject: z.string(),
    status: HrTicketStatus,
    messages: z.array(HrTicketMessage),
    createdAt: z.string(),
    updatedAt: z.string(),
    closedAt: z.string().nullable(),
});
export type HrTicket = z.infer<typeof HrTicket>;
export const HrTicketList = z.object({ tickets: z.array(HrTicket) });
export type HrTicketList = z.infer<typeof HrTicketList>;

const Body = z.string().trim().min(2, "Write your question.").max(2000);

/** `POST /me/work/:employeeId/tickets`. */
export const CreateHrTicketRequest = z.object({
    topic: HrTicketTopic,
    subject: z.string().trim().min(2, "Say what it is about.").max(120),
    body: Body,
});
export type CreateHrTicketRequest = z.infer<typeof CreateHrTicketRequest>;

/** `POST /me/work/:employeeId/tickets/:id/messages` and `POST /ops/hr-tickets/:id/reply`. */
export const ReplyHrTicketRequest = z.object({
    body: Body,
    /** HR only: close the ticket with this answer. */
    close: z.boolean().optional(),
});
export type ReplyHrTicketRequest = z.infer<typeof ReplyHrTicketRequest>;

// ---------------------------------------------------------------------------
// Things lent to staff
// ---------------------------------------------------------------------------

export const AssetKind = z.enum(["key", "uniform", "phone", "laptop", "tool", "other"]);
export type AssetKind = z.infer<typeof AssetKind>;

export const AssetLoan = z.object({
    id: Uuid,
    employee: RosterCard,
    /** Whether the person still works here: a leaver with something out is the reminder. */
    employeeActive: z.boolean(),
    kind: AssetKind,
    name: z.string(),
    /** A serial or asset number. */
    tag: z.string().nullable(),
    issuedOn: IsoDate,
    dueBackOn: IsoDate.nullable(),
    returnedOn: IsoDate.nullable(),
    note: z.string().nullable(),
    issuedByName: z.string().nullable(),
    createdAt: z.string(),
});
export type AssetLoan = z.infer<typeof AssetLoan>;
export const AssetLoanList = z.object({ loans: z.array(AssetLoan) });
export type AssetLoanList = z.infer<typeof AssetLoanList>;

/** `POST /ops/asset-loans`. */
export const CreateAssetLoanRequest = z
    .object({
    employeeId: Uuid,
    kind: AssetKind,
    name: z.string().trim().min(2, "Name the item.").max(120),
    tag: z.string().trim().max(60).nullable().optional(),
    issuedOn: IsoDate,
    dueBackOn: IsoDate.nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
})
    .refine((b) => !b.dueBackOn || b.dueBackOn >= b.issuedOn, {
    message: "It comes back after it goes out.",
    path: ["dueBackOn"],
});
export type CreateAssetLoanRequest = z.infer<typeof CreateAssetLoanRequest>;

/** `POST /ops/asset-loans/:id/return`. */
export const ReturnAssetLoanRequest = z.object({
    returnedOn: IsoDate,
    note: z.string().trim().max(300).nullable().optional(),
});
export type ReturnAssetLoanRequest = z.infer<typeof ReturnAssetLoanRequest>;
