import { z } from "zod";
import { normaliseGuestPhone } from "./guests";
import { PosOrderStatus, PosOrderType } from "./pos";
import { Uuid } from "./primitives";
/**
 * Customers of the bar and restaurant (CRM, phase 1).
 *
 * A customer belongs to the BUSINESS (the workspace), not to one outlet: the person who eats at the
 * lakeside outlet on Friday is the same person at the Kimihurura outlet on Saturday. Which outlets a
 * staff member may SEE of that person's history is still decided by their branch scope.
 *
 * THE PHONE IS THE KEY. A customer is found, de-duplicated and (later) verified by phone, stored in E.164:
 * a Rwandan mobile however it was typed (`0788 123 456`), or a visitor's number with its `+` code. It is
 * validated here by the very function the guest registry uses, so the POS and the hotel cannot disagree
 * about what a number is. Two spellings of one number can never be two customers: the API normalises
 * first, and the database holds a unique index on the normalised value.
 *
 * WHAT A ROLE SEES. Everyone with `customer.view` can find and read a customer. Only `customer.manage`
 * reads the full phone and email; everybody else gets them masked, and can only LOOK UP (a search of at
 * least `CUSTOMER_SEARCH_MIN` characters), never list the whole book.
 */
// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------
/** The shortest search that is allowed to a role that may look customers up but not browse them. */
export const CUSTOMER_SEARCH_MIN = 3;
export const CUSTOMER_PAGE_SIZE = 25;
export const CUSTOMER_PAGE_MAX = 100;
const PHONE_MESSAGE = "Enter a Rwandan mobile like 0788 123 456, or a number from another country starting with +.";
const E164 = /^\+[1-9]\d{7,14}$/;
/** A customer's phone, normalised to E.164 on the way in. */
export const CustomerPhone = z
    .string({ required_error: "Enter the customer's phone number.", invalid_type_error: PHONE_MESSAGE })
    .trim()
    .transform((raw) => normaliseGuestPhone(raw))
    .pipe(z.string({ invalid_type_error: PHONE_MESSAGE }).regex(E164, PHONE_MESSAGE));
export type CustomerPhone = z.infer<typeof CustomerPhone>;
export const CustomerName = z
    .string({ required_error: "Type the customer's name." })
    .trim()
    .min(2, "Type the customer's name.")
    .max(120, "Keep the name under 120 characters.");
const CustomerEmailValue = z
    .string()
    .trim()
    .toLowerCase()
    .max(200, "Keep the email under 200 characters.")
    .email("Enter a valid email address, like name@example.com.");
/** An email, or nothing: a blank field is "no email", not an invalid one. */
export const CustomerEmail = z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    CustomerEmailValue.nullable(),
);
const CustomerNotes = z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(500, "Keep the note under 500 characters.").nullable(),
);
/** Where a customer first came from. Phase 1 writes `pos` and `import`; the others are reserved for later phases. */
export const CustomerSource = z.enum(["pos", "qr", "reservation", "import"]);
export type CustomerSource = z.infer<typeof CustomerSource>;
export const CustomerStatus = z.enum(["active", "merged", "erased"]);
export type CustomerStatus = z.infer<typeof CustomerStatus>;
// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------
/**
 * `+250788123456` -> `+250******456`: the country code and the last three digits stay, so a person can
 * tell two customers apart on the screen without the number being copyable.
 */
export function maskCustomerPhone(e164: string): string {
    if (e164.length <= 7) return "*".repeat(e164.length);
    return `${e164.slice(0, 4)}${"*".repeat(e164.length - 7)}${e164.slice(-3)}`;
}
/** `jean@example.com` -> `j***@example.com`. */
export function maskCustomerEmail(email: string): string {
    const at = email.lastIndexOf("@");
    if (at < 1) return "***";
    return `${email.slice(0, 1)}***${email.slice(at)}`;
}
// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
export const CreateCustomerRequest = z.object({
    fullName: CustomerName,
    phone: CustomerPhone,
    email: CustomerEmail.optional(),
    /** The staff member confirms the customer agreed to be contacted with offers. Never assumed. */
    marketingConsent: z.boolean().default(false),
    notes: CustomerNotes.optional(),
});
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequest>;
export const UpdateCustomerRequest = z
    .object({
        fullName: CustomerName,
        phone: CustomerPhone,
        email: CustomerEmail,
        marketingConsent: z.boolean(),
        notes: CustomerNotes,
    })
    .partial()
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Change at least one field." });
export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequest>;
export const CustomerListQuery = z.object({
    q: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(CUSTOMER_PAGE_MAX).default(CUSTOMER_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuery>;
/** Put a customer on an order, or take them off it (`customerId: null`). */
export const AttachCustomerRequest = z.object({ customerId: Uuid.nullable() });
export type AttachCustomerRequest = z.infer<typeof AttachCustomerRequest>;
/** Fold a duplicate (`:id`) into the customer it really is. The duplicate stops being listed; its orders move. */
export const MergeCustomersRequest = z.object({
    intoCustomerId: Uuid,
    reason: z.string().trim().min(3, "Say why these are the same person.").max(300),
});
export type MergeCustomersRequest = z.infer<typeof MergeCustomersRequest>;
/** Erase a customer's personal details (the right to be forgotten). Orders and money stay, anonymised. */
export const EraseCustomerRequest = z.object({
    reason: z.string().trim().min(3, "Say why the details are being erased.").max(300),
});
export type EraseCustomerRequest = z.infer<typeof EraseCustomerRequest>;
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const CustomerSummary = z.object({
    id: Uuid,
    fullName: z.string(),
    /** The full number for `customer.manage`, otherwise masked. */
    phone: z.string(),
    email: z.string().nullable(),
    /** True when `phone` and `email` are masked for this reader. */
    contactHidden: z.boolean(),
    marketingConsent: z.boolean(),
    source: CustomerSource,
    visitCount: z.number().int(),
    lifetimeSpendRwf: z.number().int(),
    lastVisitAt: z.string().nullable(),
    createdAt: z.string(),
});
export type CustomerSummary = z.infer<typeof CustomerSummary>;
export const CustomerList = z.object({
    customers: z.array(CustomerSummary),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    /** The reader may look customers up but not browse them, and has not typed enough to search. */
    searchRequired: z.boolean(),
    contactHidden: z.boolean(),
});
export type CustomerList = z.infer<typeof CustomerList>;
/** One of a customer's orders, as the profile lists it. */
export const CustomerOrderRow = z.object({
    orderId: Uuid,
    orderNumber: z.string(),
    outletName: z.string(),
    orderType: PosOrderType,
    tableLabel: z.string().nullable(),
    status: PosOrderStatus,
    totalRwf: z.number().int(),
    createdAt: z.string(),
});
export type CustomerOrderRow = z.infer<typeof CustomerOrderRow>;
export const CustomerProfile = CustomerSummary.extend({
    notes: z.string().nullable(),
    consentAt: z.string().nullable(),
    consentSource: z.string().nullable(),
    phoneVerifiedAt: z.string().nullable(),
    status: CustomerStatus,
    /** Newest first, only at the outlets the reader's branch scope covers. */
    orders: z.array(CustomerOrderRow),
});
export type CustomerProfile = z.infer<typeof CustomerProfile>;
/** Everything held about one customer, for the person who asks to see it. */
export const CustomerExport = z.object({
    exportedAt: z.string(),
    customer: CustomerProfile,
    audit: z.array(
        z.object({
            action: z.string(),
            at: z.string(),
            reason: z.string().nullable(),
        }),
    ),
});
export type CustomerExport = z.infer<typeof CustomerExport>;
