"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerExport = exports.CustomerProfile = exports.CustomerOrderRow = exports.CustomerList = exports.CustomerSummary = exports.EraseCustomerRequest = exports.MergeCustomersRequest = exports.AttachCustomerRequest = exports.CustomerListQuery = exports.UpdateCustomerRequest = exports.CreateCustomerRequest = exports.CustomerStatus = exports.CustomerSource = exports.CustomerEmail = exports.CustomerName = exports.CustomerPhone = exports.CUSTOMER_PAGE_MAX = exports.CUSTOMER_PAGE_SIZE = exports.CUSTOMER_SEARCH_MIN = void 0;
exports.maskCustomerPhone = maskCustomerPhone;
exports.maskCustomerEmail = maskCustomerEmail;
const zod_1 = require("zod");
const guests_1 = require("./guests");
const pos_1 = require("./pos");
const primitives_1 = require("./primitives");
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
exports.CUSTOMER_SEARCH_MIN = 3;
exports.CUSTOMER_PAGE_SIZE = 25;
exports.CUSTOMER_PAGE_MAX = 100;
const PHONE_MESSAGE = "Enter a Rwandan mobile like 0788 123 456, or a number from another country starting with +.";
const E164 = /^\+[1-9]\d{7,14}$/;
/** A customer's phone, normalised to E.164 on the way in. */
exports.CustomerPhone = zod_1.z
    .string({ required_error: "Enter the customer's phone number.", invalid_type_error: PHONE_MESSAGE })
    .trim()
    .transform((raw) => (0, guests_1.normaliseGuestPhone)(raw))
    .pipe(zod_1.z.string({ invalid_type_error: PHONE_MESSAGE }).regex(E164, PHONE_MESSAGE));
exports.CustomerName = zod_1.z
    .string({ required_error: "Type the customer's name." })
    .trim()
    .min(2, "Type the customer's name.")
    .max(120, "Keep the name under 120 characters.");
const CustomerEmailValue = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .max(200, "Keep the email under 200 characters.")
    .email("Enter a valid email address, like name@example.com.");
/** An email, or nothing: a blank field is "no email", not an invalid one. */
exports.CustomerEmail = zod_1.z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), CustomerEmailValue.nullable());
const CustomerNotes = zod_1.z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), zod_1.z.string().trim().max(500, "Keep the note under 500 characters.").nullable());
/** Where a customer first came from. Phase 1 writes `pos` and `import`; the others are reserved for later phases. */
exports.CustomerSource = zod_1.z.enum(["pos", "qr", "reservation", "import"]);
exports.CustomerStatus = zod_1.z.enum(["active", "merged", "erased"]);
// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------
/**
 * `+250788123456` -> `+250******456`: the country code and the last three digits stay, so a person can
 * tell two customers apart on the screen without the number being copyable.
 */
function maskCustomerPhone(e164) {
    if (e164.length <= 7)
        return "*".repeat(e164.length);
    return `${e164.slice(0, 4)}${"*".repeat(e164.length - 7)}${e164.slice(-3)}`;
}
/** `jean@example.com` -> `j***@example.com`. */
function maskCustomerEmail(email) {
    const at = email.lastIndexOf("@");
    if (at < 1)
        return "***";
    return `${email.slice(0, 1)}***${email.slice(at)}`;
}
// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
exports.CreateCustomerRequest = zod_1.z.object({
    fullName: exports.CustomerName,
    phone: exports.CustomerPhone,
    email: exports.CustomerEmail.optional(),
    /** The staff member confirms the customer agreed to be contacted with offers. Never assumed. */
    marketingConsent: zod_1.z.boolean().default(false),
    notes: CustomerNotes.optional(),
});
exports.UpdateCustomerRequest = zod_1.z
    .object({
    fullName: exports.CustomerName,
    phone: exports.CustomerPhone,
    email: exports.CustomerEmail,
    marketingConsent: zod_1.z.boolean(),
    notes: CustomerNotes,
})
    .partial()
    .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Change at least one field." });
exports.CustomerListQuery = zod_1.z.object({
    q: zod_1.z.string().trim().max(80).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(exports.CUSTOMER_PAGE_MAX).default(exports.CUSTOMER_PAGE_SIZE),
    offset: zod_1.z.coerce.number().int().min(0).max(100000).default(0),
});
/** Put a customer on an order, or take them off it (`customerId: null`). */
exports.AttachCustomerRequest = zod_1.z.object({ customerId: primitives_1.Uuid.nullable() });
/** Fold a duplicate (`:id`) into the customer it really is. The duplicate stops being listed; its orders move. */
exports.MergeCustomersRequest = zod_1.z.object({
    intoCustomerId: primitives_1.Uuid,
    reason: zod_1.z.string().trim().min(3, "Say why these are the same person.").max(300),
});
/** Erase a customer's personal details (the right to be forgotten). Orders and money stay, anonymised. */
exports.EraseCustomerRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3, "Say why the details are being erased.").max(300),
});
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
exports.CustomerSummary = zod_1.z.object({
    id: primitives_1.Uuid,
    fullName: zod_1.z.string(),
    /** The full number for `customer.manage`, otherwise masked. */
    phone: zod_1.z.string(),
    email: zod_1.z.string().nullable(),
    /** True when `phone` and `email` are masked for this reader. */
    contactHidden: zod_1.z.boolean(),
    marketingConsent: zod_1.z.boolean(),
    source: exports.CustomerSource,
    visitCount: zod_1.z.number().int(),
    lifetimeSpendRwf: zod_1.z.number().int(),
    lastVisitAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.CustomerList = zod_1.z.object({
    customers: zod_1.z.array(exports.CustomerSummary),
    total: zod_1.z.number().int(),
    limit: zod_1.z.number().int(),
    offset: zod_1.z.number().int(),
    /** The reader may look customers up but not browse them, and has not typed enough to search. */
    searchRequired: zod_1.z.boolean(),
    contactHidden: zod_1.z.boolean(),
});
/** One of a customer's orders, as the profile lists it. */
exports.CustomerOrderRow = zod_1.z.object({
    orderId: primitives_1.Uuid,
    orderNumber: zod_1.z.string(),
    outletName: zod_1.z.string(),
    orderType: pos_1.PosOrderType,
    tableLabel: zod_1.z.string().nullable(),
    status: pos_1.PosOrderStatus,
    totalRwf: zod_1.z.number().int(),
    createdAt: zod_1.z.string(),
});
exports.CustomerProfile = exports.CustomerSummary.extend({
    notes: zod_1.z.string().nullable(),
    consentAt: zod_1.z.string().nullable(),
    consentSource: zod_1.z.string().nullable(),
    phoneVerifiedAt: zod_1.z.string().nullable(),
    status: exports.CustomerStatus,
    /** Newest first, only at the outlets the reader's branch scope covers. */
    orders: zod_1.z.array(exports.CustomerOrderRow),
});
/** Everything held about one customer, for the person who asks to see it. */
exports.CustomerExport = zod_1.z.object({
    exportedAt: zod_1.z.string(),
    customer: exports.CustomerProfile,
    audit: zod_1.z.array(zod_1.z.object({
        action: zod_1.z.string(),
        at: zod_1.z.string(),
        reason: zod_1.z.string().nullable(),
    })),
});
//# sourceMappingURL=customers.js.map