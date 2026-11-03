"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbmEmission = exports.EbmEmissionStatus = exports.EbmConnectStart = exports.EbmConnection = exports.EbmItemMappingInput = exports.EbmItemMapping = exports.EbmSearchQuery = exports.EbmCustomerOptionList = exports.EbmCatalogItemList = exports.EbmCustomerOption = exports.EbmCatalogItem = exports.EbmItemTaxType = exports.EbmAccountStatus = exports.EbmConnectionStatus = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * A business's link to its own RRA EBM account (ADR-041).
 *
 * The receipt shape in `ebm.ts` says what a fiscal document LOOKS like. This
 * file says where the authority to produce one comes from: a taxpayer connects
 * the EBM account that RRA issued to them, and every sale of that business is
 * declared under it. The two are separate facts and separate files because a
 * receipt is printed on every stay and a connection is made once.
 *
 * These are OUR shapes, on OUR wire — what `/api/v1/ops/ebm/*` answers the
 * operator app. The EBM provider's own request and response shapes are NOT here:
 * they belong to the adapter that speaks to it
 * (`server/api/src/modules/platform/fiscal/infrastructure/ebm-api.client.ts`), because a
 * third party's field names are not a contract this platform gets to define, and
 * putting them here would invite a screen to depend on them.
 *
 * **Nothing here carries a token.** The access and refresh tokens live encrypted
 * in `ebm_connections` and never leave the API — not to the operator app, not to
 * a log line. A screen needs to know THAT the business is connected and to WHOM;
 * it never needs the credential.
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
/**
 * Whether this business can invoice through RRA right now.
 *
 * `not_connected` and `revoked` are told apart on purpose. The first is a
 * business that never connected; the second is one whose authorisation stopped
 * working — the taxpayer withdrew consent, or the refresh token expired — and
 * that difference is the difference between "set this up" and "this broke, and
 * sales are piling up unsent".
 */
exports.EbmConnectionStatus = zod_1.z.enum([
    "not_connected",
    "connected",
    "revoked",
]);
/**
 * The EBM account's own state at the provider. The consent screen registers the
 * company, so an account can be connected before RRA has approved it; only an
 * `approved` account can certify a sale.
 */
exports.EbmAccountStatus = zod_1.z.enum(["submitted", "approved", "disabled"]);
/**
 * The RRA taxation type of a catalog item (VSDC spec §4.1), as the provider
 * reports it: `A` exempt, `B` standard 18%, `C` zero-rated export, `D`
 * non-taxable. It is the provider's vocabulary rather than ours, which is why
 * it keeps the provider's spelling instead of the `TAX_B` form the ledger uses.
 */
exports.EbmItemTaxType = zod_1.z.enum(["A", "B", "C", "D"]);
// ---------------------------------------------------------------------------
// Catalog and mapping
// ---------------------------------------------------------------------------
/**
 * One line of the taxpayer's registered product catalog.
 *
 * An RRA sale is invoiced against REGISTERED items, not free text: the item code
 * and its classification are declared to the Authority before anything may be
 * sold under them. So a stay cannot be invoiced as the sentence a receipt prints
 * — it has to be sold as one of these, which is what makes the mapping below a
 * required setup step rather than a convenience.
 */
exports.EbmCatalogItem = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    /** The RRA item code, e.g. `RW1NTXU0000001`. */
    itemCd: zod_1.z.string(),
    itemNm: zod_1.z.string(),
    taxTyCd: exports.EbmItemTaxType,
    unitPriceRwf: zod_1.z.number(),
});
/**
 * One customer in the taxpayer's EBM customer list, for picking the walk-in
 * customer. `tin` is shown because it is the reason one is refused: a customer
 * with a TIN makes the sale business-to-business.
 */
exports.EbmCustomerOption = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    name: zod_1.z.string(),
    tin: zod_1.z.string().nullable(),
});
/** What `GET /api/v1/ops/ebm/items` answers. */
exports.EbmCatalogItemList = zod_1.z.object({ items: zod_1.z.array(exports.EbmCatalogItem) });
/** What `GET /api/v1/ops/ebm/customers` answers. */
exports.EbmCustomerOptionList = zod_1.z.object({ customers: zod_1.z.array(exports.EbmCustomerOption) });
/** `?search=` on the catalog and customer pickers. */
exports.EbmSearchQuery = zod_1.z.object({
    search: zod_1.z.string().trim().max(60).optional(),
});
/**
 * Which catalog item each part of a stay is sold as, and who a walk-in guest is.
 *
 * Every field is nullable because a connection exists before it is configured,
 * and a half-configured connection must be readable — the screen that finishes
 * the setup is the one that has to show what is still missing. `isReady` below
 * is the single answer to "may this business invoice yet".
 *
 * `serviceFeeItemId` is separate from the accommodation item because the fee is
 * a different service sold at the same rate, and the receipt prints it as its
 * own line (see `receipt-builder.ts`, which also records the open question about
 * whose taxpayer identity that line belongs to).
 */
exports.EbmItemMapping = zod_1.z.object({
    accommodationItemId: zod_1.z.number().int().positive().nullable(),
    serviceFeeItemId: zod_1.z.number().int().positive().nullable(),
    /**
     * The EBM customer a stay is billed to when the guest is not a registered
     * taxpayer, which is every ordinary booking. The provider requires a
     * customer on the invoice; RRA itself treats a sale with no buyer TIN as
     * B2C. Booking guests are never asked for a TIN, so one standing "walk-in"
     * customer stands for all of them.
     */
    walkInCustomerId: zod_1.z.number().int().positive().nullable(),
});
/** The write half of the mapping: what the operator picked on the setup screen. */
exports.EbmItemMappingInput = exports.EbmItemMapping;
// ---------------------------------------------------------------------------
// The connection
// ---------------------------------------------------------------------------
/**
 * What `GET /api/v1/ops/ebm/connection` answers.
 *
 * The TIN is on here and is the field the screen must show most prominently: it
 * is how an operator confirms the platform is about to declare their sales under
 * THEIR tax identity and not somebody else's. The API refuses a connection whose
 * TIN is not the org's, so this is a confirmation rather than a choice — but a
 * silent confirmation is not one.
 */
exports.EbmConnection = zod_1.z.object({
    /**
     * Whether this deployment certifies with RRA at all. `mock` means receipts
     * carry fabricated device fields and there is nothing to connect, which a
     * setup screen must say rather than offer a button the API will refuse.
     * The demo environment always answers `mock`.
     */
    mode: primitives_1.AdapterMode,
    status: exports.EbmConnectionStatus,
    /** Null until connected. The taxpayer's TIN as the EBM account reports it. */
    tin: zod_1.z.string().nullable(),
    /** The account name at the provider, e.g. the registered trade name. */
    accountName: zod_1.z.string().nullable(),
    /**
     * The EBM account's approval state at the provider. Only `approved` may
     * invoice; a `submitted` account is connected and waiting on RRA, which is
     * a different thing to tell an operator than "not connected".
     */
    accountStatus: exports.EbmAccountStatus.nullable(),
    /** RRA branch id, `00` for a head office. */
    branchId: zod_1.z.string().nullable(),
    /** Whether that account is registered for VAT. A non-VAT taxpayer still invoices. */
    vatRegistered: zod_1.z.boolean().nullable(),
    /** OAuth scopes the taxpayer actually granted. */
    scopes: zod_1.z.array(zod_1.z.string()),
    connectedAt: zod_1.z.string().datetime().nullable(),
    mapping: exports.EbmItemMapping,
    /**
     * Connected AND fully mapped, so the next captured sale can be certified.
     * Computed by the server rather than by each screen, because "ready" is the
     * condition the emission worker actually tests, and two definitions of it
     * would let a screen promise something the worker refuses.
     */
    isReady: zod_1.z.boolean(),
    /**
     * How many sales are waiting because this business cannot invoice yet.
     *
     * On the connection rather than on a separate dashboard because it is the
     * consequence of THIS record being unfinished, and a setup screen that does
     * not say "14 sales are held" understates what the operator is putting off.
     */
    heldSaleCount: zod_1.z.number().int().nonnegative(),
});
/**
 * What `POST /api/v1/ops/ebm/connect` answers: where to send the taxpayer.
 *
 * A URL rather than a redirect, because the caller is a fetch from an operator
 * screen. The screen sends the person there; the provider sends them back to the
 * API's callback.
 */
exports.EbmConnectStart = zod_1.z.object({
    authorizeUrl: zod_1.z.string().url(),
});
/**
 * One sale's certification state, for the operator's compliance view.
 *
 * `held` and `failed` are both visible and both count: F-B13's rule is that a
 * compliance event queues and is never silently skipped, and a queue nobody can
 * see is indistinguishable from a skip.
 */
exports.EbmEmissionStatus = zod_1.z.enum(["held", "emitted", "failed"]);
exports.EbmEmission = zod_1.z.object({
    id: primitives_1.Uuid,
    bookingReference: zod_1.z.string(),
    status: exports.EbmEmissionStatus,
    attempts: zod_1.z.number().int().nonnegative(),
    /** Plain wording for why it is not emitted. Null once it is. */
    lastError: zod_1.z.string().nullable(),
    emittedAt: zod_1.z.string().datetime().nullable(),
    /** The RRA receipt number, once the Authority has issued one. */
    receiptNumber: zod_1.z.number().int().nullable(),
    totalRwf: zod_1.z.number().int(),
});
//# sourceMappingURL=ebm-connection.js.map