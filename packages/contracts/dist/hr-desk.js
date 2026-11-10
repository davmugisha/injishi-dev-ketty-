"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturnAssetLoanRequest = exports.CreateAssetLoanRequest = exports.AssetLoanList = exports.AssetLoan = exports.AssetKind = exports.ReplyHrTicketRequest = exports.CreateHrTicketRequest = exports.HrTicketList = exports.HrTicket = exports.HrTicketMessage = exports.HrTicketStatus = exports.HrTicketTopic = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const people_1 = require("./people");
const primitives_1 = require("./primitives");
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
exports.HrTicketTopic = zod_1.z.enum(["pay", "leave", "documents", "uniform", "it", "other"]);
exports.HrTicketStatus = zod_1.z.enum(["open", "answered", "closed"]);
exports.HrTicketMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The person who asked, or HR answering. */
    fromStaff: zod_1.z.boolean(),
    authorName: zod_1.z.string().nullable(),
    body: zod_1.z.string(),
    createdAt: zod_1.z.string(),
});
exports.HrTicket = zod_1.z.object({
    id: primitives_1.Uuid,
    /** "HD-0007": what a person quotes when they ask about it. */
    reference: zod_1.z.string(),
    employee: people_1.RosterCard,
    topic: exports.HrTicketTopic,
    subject: zod_1.z.string(),
    status: exports.HrTicketStatus,
    messages: zod_1.z.array(exports.HrTicketMessage),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    closedAt: zod_1.z.string().nullable(),
});
exports.HrTicketList = zod_1.z.object({ tickets: zod_1.z.array(exports.HrTicket) });
const Body = zod_1.z.string().trim().min(2, "Write your question.").max(2000);
/** `POST /me/work/:employeeId/tickets`. */
exports.CreateHrTicketRequest = zod_1.z.object({
    topic: exports.HrTicketTopic,
    subject: zod_1.z.string().trim().min(2, "Say what it is about.").max(120),
    body: Body,
});
/** `POST /me/work/:employeeId/tickets/:id/messages` and `POST /ops/hr-tickets/:id/reply`. */
exports.ReplyHrTicketRequest = zod_1.z.object({
    body: Body,
    /** HR only: close the ticket with this answer. */
    close: zod_1.z.boolean().optional(),
});
// ---------------------------------------------------------------------------
// Things lent to staff
// ---------------------------------------------------------------------------
exports.AssetKind = zod_1.z.enum(["key", "uniform", "phone", "laptop", "tool", "other"]);
exports.AssetLoan = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    /** Whether the person still works here: a leaver with something out is the reminder. */
    employeeActive: zod_1.z.boolean(),
    kind: exports.AssetKind,
    name: zod_1.z.string(),
    /** A serial or asset number. */
    tag: zod_1.z.string().nullable(),
    issuedOn: booking_1.IsoDate,
    dueBackOn: booking_1.IsoDate.nullable(),
    returnedOn: booking_1.IsoDate.nullable(),
    note: zod_1.z.string().nullable(),
    issuedByName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.AssetLoanList = zod_1.z.object({ loans: zod_1.z.array(exports.AssetLoan) });
/** `POST /ops/asset-loans`. */
exports.CreateAssetLoanRequest = zod_1.z
    .object({
    employeeId: primitives_1.Uuid,
    kind: exports.AssetKind,
    name: zod_1.z.string().trim().min(2, "Name the item.").max(120),
    tag: zod_1.z.string().trim().max(60).nullable().optional(),
    issuedOn: booking_1.IsoDate,
    dueBackOn: booking_1.IsoDate.nullable().optional(),
    note: zod_1.z.string().trim().max(300).nullable().optional(),
})
    .refine((b) => !b.dueBackOn || b.dueBackOn >= b.issuedOn, {
    message: "It comes back after it goes out.",
    path: ["dueBackOn"],
});
/** `POST /ops/asset-loans/:id/return`. */
exports.ReturnAssetLoanRequest = zod_1.z.object({
    returnedOn: booking_1.IsoDate,
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
//# sourceMappingURL=hr-desk.js.map