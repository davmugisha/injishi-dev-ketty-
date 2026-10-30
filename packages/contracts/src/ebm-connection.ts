import { z } from "zod";
import { AdapterMode, Uuid } from "./primitives";
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
export const EbmConnectionStatus = z.enum([
    "not_connected",
    "connected",
    "revoked",
]);
export type EbmConnectionStatus = z.infer<typeof EbmConnectionStatus>;
/**
 * The EBM account's own state at the provider. The consent screen registers the
 * company, so an account can be connected before RRA has approved it; only an
 * `approved` account can certify a sale.
 */
export const EbmAccountStatus = z.enum(["submitted", "approved", "disabled"]);
export type EbmAccountStatus = z.infer<typeof EbmAccountStatus>;
/**
 * The RRA taxation type of a catalog item (VSDC spec §4.1), as the provider
 * reports it: `A` exempt, `B` standard 18%, `C` zero-rated export, `D`
 * non-taxable. It is the provider's vocabulary rather than ours, which is why
 * it keeps the provider's spelling instead of the `TAX_B` form the ledger uses.
 */
export const EbmItemTaxType = z.enum(["A", "B", "C", "D"]);
export type EbmItemTaxType = z.infer<typeof EbmItemTaxType>;
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
export const EbmCatalogItem = z.object({
    id: z.number().int().positive(),
    /** The RRA item code, e.g. `RW1NTXU0000001`. */
    itemCd: z.string(),
    itemNm: z.string(),
    taxTyCd: EbmItemTaxType,
    unitPriceRwf: z.number(),
});
export type EbmCatalogItem = z.infer<typeof EbmCatalogItem>;
/**
 * One customer in the taxpayer's EBM customer list, for picking the walk-in
 * customer. `tin` is shown because it is the reason one is refused: a customer
 * with a TIN makes the sale business-to-business.
 */
export const EbmCustomerOption = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    tin: z.string().nullable(),
});
export type EbmCustomerOption = z.infer<typeof EbmCustomerOption>;
/** What `GET /api/v1/ops/ebm/items` answers. */
export const EbmCatalogItemList = z.object({ items: z.array(EbmCatalogItem) });
export type EbmCatalogItemList = z.infer<typeof EbmCatalogItemList>;
/** What `GET /api/v1/ops/ebm/customers` answers. */
export const EbmCustomerOptionList = z.object({ customers: z.array(EbmCustomerOption) });
export type EbmCustomerOptionList = z.infer<typeof EbmCustomerOptionList>;
/** `?search=` on the catalog and customer pickers. */
export const EbmSearchQuery = z.object({
    search: z.string().trim().max(60).optional(),
});
export type EbmSearchQuery = z.infer<typeof EbmSearchQuery>;
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
export const EbmItemMapping = z.object({
    accommodationItemId: z.number().int().positive().nullable(),
    serviceFeeItemId: z.number().int().positive().nullable(),
    /**
     * The EBM customer a stay is billed to when the guest is not a registered
     * taxpayer, which is every ordinary booking. The provider requires a
     * customer on the invoice; RRA itself treats a sale with no buyer TIN as
     * B2C. Booking guests are never asked for a TIN, so one standing "walk-in"
     * customer stands for all of them.
     */
    walkInCustomerId: z.number().int().positive().nullable(),
});
export type EbmItemMapping = z.infer<typeof EbmItemMapping>;
/** The write half of the mapping: what the operator picked on the setup screen. */
export const EbmItemMappingInput = EbmItemMapping;
export type EbmItemMappingInput = z.infer<typeof EbmItemMappingInput>;
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
export const EbmConnection = z.object({
    /**
     * Whether this deployment certifies with RRA at all. `mock` means receipts
     * carry fabricated device fields and there is nothing to connect, which a
     * setup screen must say rather than offer a button the API will refuse.
     * The demo environment always answers `mock`.
     */
    mode: AdapterMode,
    status: EbmConnectionStatus,
    /** Null until connected. The taxpayer's TIN as the EBM account reports it. */
    tin: z.string().nullable(),
    /** The account name at the provider, e.g. the registered trade name. */
    accountName: z.string().nullable(),
    /**
     * The EBM account's approval state at the provider. Only `approved` may
     * invoice; a `submitted` account is connected and waiting on RRA, which is
     * a different thing to tell an operator than "not connected".
     */
    accountStatus: EbmAccountStatus.nullable(),
    /** RRA branch id, `00` for a head office. */
    branchId: z.string().nullable(),
    /** Whether that account is registered for VAT. A non-VAT taxpayer still invoices. */
    vatRegistered: z.boolean().nullable(),
    /** OAuth scopes the taxpayer actually granted. */
    scopes: z.array(z.string()),
    connectedAt: z.string().datetime().nullable(),
    mapping: EbmItemMapping,
    /**
     * Connected AND fully mapped, so the next captured sale can be certified.
     * Computed by the server rather than by each screen, because "ready" is the
     * condition the emission worker actually tests, and two definitions of it
     * would let a screen promise something the worker refuses.
     */
    isReady: z.boolean(),
    /**
     * How many sales are waiting because this business cannot invoice yet.
     *
     * On the connection rather than on a separate dashboard because it is the
     * consequence of THIS record being unfinished, and a setup screen that does
     * not say "14 sales are held" understates what the operator is putting off.
     */
    heldSaleCount: z.number().int().nonnegative(),
});
export type EbmConnection = z.infer<typeof EbmConnection>;
/**
 * What `POST /api/v1/ops/ebm/connect` answers: where to send the taxpayer.
 *
 * A URL rather than a redirect, because the caller is a fetch from an operator
 * screen. The screen sends the person there; the provider sends them back to the
 * API's callback.
 */
export const EbmConnectStart = z.object({
    authorizeUrl: z.string().url(),
});
export type EbmConnectStart = z.infer<typeof EbmConnectStart>;
/**
 * One sale's certification state, for the operator's compliance view.
 *
 * `held` and `failed` are both visible and both count: F-B13's rule is that a
 * compliance event queues and is never silently skipped, and a queue nobody can
 * see is indistinguishable from a skip.
 */
export const EbmEmissionStatus = z.enum(["held", "emitted", "failed"]);
export type EbmEmissionStatus = z.infer<typeof EbmEmissionStatus>;
export const EbmEmission = z.object({
    id: Uuid,
    bookingReference: z.string(),
    status: EbmEmissionStatus,
    attempts: z.number().int().nonnegative(),
    /** Plain wording for why it is not emitted. Null once it is. */
    lastError: z.string().nullable(),
    emittedAt: z.string().datetime().nullable(),
    /** The RRA receipt number, once the Authority has issued one. */
    receiptNumber: z.number().int().nullable(),
    totalRwf: z.number().int(),
});
export type EbmEmission = z.infer<typeof EbmEmission>;
