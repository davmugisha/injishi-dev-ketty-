import { z } from "zod";
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
 * (`server/api/src/modules/ebm/infrastructure/ebm-api.client.ts`), because a
 * third party's field names are not a contract this platform gets to define, and
 * putting them here would invite a screen to depend on them.
 *
 * **Nothing here carries a token.** The access and refresh tokens live encrypted
 * in `ebm_connections` and never leave the API — not to the operator app, not to
 * a log line. A screen needs to know THAT the business is connected and to WHOM;
 * it never needs the credential.
 */
/**
 * Whether this business can invoice through RRA right now.
 *
 * `not_connected` and `revoked` are told apart on purpose. The first is a
 * business that never connected; the second is one whose authorisation stopped
 * working — the taxpayer withdrew consent, or the refresh token expired — and
 * that difference is the difference between "set this up" and "this broke, and
 * sales are piling up unsent".
 */
export declare const EbmConnectionStatus: z.ZodEnum<["not_connected", "connected", "revoked"]>;
export type EbmConnectionStatus = z.infer<typeof EbmConnectionStatus>;
/**
 * The EBM account's own state at the provider. The consent screen registers the
 * company, so an account can be connected before RRA has approved it; only an
 * `approved` account can certify a sale.
 */
export declare const EbmAccountStatus: z.ZodEnum<["submitted", "approved", "disabled"]>;
export type EbmAccountStatus = z.infer<typeof EbmAccountStatus>;
/**
 * The RRA taxation type of a catalog item (VSDC spec §4.1), as the provider
 * reports it: `A` exempt, `B` standard 18%, `C` zero-rated export, `D`
 * non-taxable. It is the provider's vocabulary rather than ours, which is why
 * it keeps the provider's spelling instead of the `TAX_B` form the ledger uses.
 */
export declare const EbmItemTaxType: z.ZodEnum<["A", "B", "C", "D"]>;
export type EbmItemTaxType = z.infer<typeof EbmItemTaxType>;
/**
 * One line of the taxpayer's registered product catalog.
 *
 * An RRA sale is invoiced against REGISTERED items, not free text: the item code
 * and its classification are declared to the Authority before anything may be
 * sold under them. So a stay cannot be invoiced as the sentence a receipt prints
 * — it has to be sold as one of these, which is what makes the mapping below a
 * required setup step rather than a convenience.
 */
export declare const EbmCatalogItem: z.ZodObject<{
    id: z.ZodNumber;
    /** The RRA item code, e.g. `RW1NTXU0000001`. */
    itemCd: z.ZodString;
    itemNm: z.ZodString;
    taxTyCd: z.ZodEnum<["A", "B", "C", "D"]>;
    unitPriceRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    unitPriceRwf: number;
    itemCd: string;
    itemNm: string;
    taxTyCd: "A" | "B" | "C" | "D";
}, {
    id: number;
    unitPriceRwf: number;
    itemCd: string;
    itemNm: string;
    taxTyCd: "A" | "B" | "C" | "D";
}>;
export type EbmCatalogItem = z.infer<typeof EbmCatalogItem>;
/**
 * One customer in the taxpayer's EBM customer list, for picking the walk-in
 * customer. `tin` is shown because it is the reason one is refused: a customer
 * with a TIN makes the sale business-to-business.
 */
export declare const EbmCustomerOption: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    tin: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: number;
    tin: string | null;
    name: string;
}, {
    id: number;
    tin: string | null;
    name: string;
}>;
export type EbmCustomerOption = z.infer<typeof EbmCustomerOption>;
/** What `GET /api/v1/ops/ebm/items` answers. */
export declare const EbmCatalogItemList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        /** The RRA item code, e.g. `RW1NTXU0000001`. */
        itemCd: z.ZodString;
        itemNm: z.ZodString;
        taxTyCd: z.ZodEnum<["A", "B", "C", "D"]>;
        unitPriceRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: number;
        unitPriceRwf: number;
        itemCd: string;
        itemNm: string;
        taxTyCd: "A" | "B" | "C" | "D";
    }, {
        id: number;
        unitPriceRwf: number;
        itemCd: string;
        itemNm: string;
        taxTyCd: "A" | "B" | "C" | "D";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: number;
        unitPriceRwf: number;
        itemCd: string;
        itemNm: string;
        taxTyCd: "A" | "B" | "C" | "D";
    }[];
}, {
    items: {
        id: number;
        unitPriceRwf: number;
        itemCd: string;
        itemNm: string;
        taxTyCd: "A" | "B" | "C" | "D";
    }[];
}>;
export type EbmCatalogItemList = z.infer<typeof EbmCatalogItemList>;
/** What `GET /api/v1/ops/ebm/customers` answers. */
export declare const EbmCustomerOptionList: z.ZodObject<{
    customers: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        tin: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        tin: string | null;
        name: string;
    }, {
        id: number;
        tin: string | null;
        name: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    customers: {
        id: number;
        tin: string | null;
        name: string;
    }[];
}, {
    customers: {
        id: number;
        tin: string | null;
        name: string;
    }[];
}>;
export type EbmCustomerOptionList = z.infer<typeof EbmCustomerOptionList>;
/** `?search=` on the catalog and customer pickers. */
export declare const EbmSearchQuery: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
}, {
    search?: string | undefined;
}>;
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
export declare const EbmItemMapping: z.ZodObject<{
    accommodationItemId: z.ZodNullable<z.ZodNumber>;
    serviceFeeItemId: z.ZodNullable<z.ZodNumber>;
    /**
     * The EBM customer a stay is billed to when the guest is not a registered
     * taxpayer, which is every ordinary booking. The provider requires a
     * customer on the invoice; RRA itself treats a sale with no buyer TIN as
     * B2C. Booking guests are never asked for a TIN, so one standing "walk-in"
     * customer stands for all of them.
     */
    walkInCustomerId: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    accommodationItemId: number | null;
    serviceFeeItemId: number | null;
    walkInCustomerId: number | null;
}, {
    accommodationItemId: number | null;
    serviceFeeItemId: number | null;
    walkInCustomerId: number | null;
}>;
export type EbmItemMapping = z.infer<typeof EbmItemMapping>;
/** The write half of the mapping: what the operator picked on the setup screen. */
export declare const EbmItemMappingInput: z.ZodObject<{
    accommodationItemId: z.ZodNullable<z.ZodNumber>;
    serviceFeeItemId: z.ZodNullable<z.ZodNumber>;
    /**
     * The EBM customer a stay is billed to when the guest is not a registered
     * taxpayer, which is every ordinary booking. The provider requires a
     * customer on the invoice; RRA itself treats a sale with no buyer TIN as
     * B2C. Booking guests are never asked for a TIN, so one standing "walk-in"
     * customer stands for all of them.
     */
    walkInCustomerId: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    accommodationItemId: number | null;
    serviceFeeItemId: number | null;
    walkInCustomerId: number | null;
}, {
    accommodationItemId: number | null;
    serviceFeeItemId: number | null;
    walkInCustomerId: number | null;
}>;
export type EbmItemMappingInput = z.infer<typeof EbmItemMappingInput>;
/**
 * What `GET /api/v1/ops/ebm/connection` answers.
 *
 * The TIN is on here and is the field the screen must show most prominently: it
 * is how an operator confirms the platform is about to declare their sales under
 * THEIR tax identity and not somebody else's. The API refuses a connection whose
 * TIN is not the org's, so this is a confirmation rather than a choice — but a
 * silent confirmation is not one.
 */
export declare const EbmConnection: z.ZodObject<{
    /**
     * Whether this deployment certifies with RRA at all. `mock` means receipts
     * carry fabricated device fields and there is nothing to connect, which a
     * setup screen must say rather than offer a button the API will refuse.
     * The demo environment always answers `mock`.
     */
    mode: z.ZodEnum<["mock", "live"]>;
    status: z.ZodEnum<["not_connected", "connected", "revoked"]>;
    /** Null until connected. The taxpayer's TIN as the EBM account reports it. */
    tin: z.ZodNullable<z.ZodString>;
    /** The account name at the provider, e.g. the registered trade name. */
    accountName: z.ZodNullable<z.ZodString>;
    /**
     * The EBM account's approval state at the provider. Only `approved` may
     * invoice; a `submitted` account is connected and waiting on RRA, which is
     * a different thing to tell an operator than "not connected".
     */
    accountStatus: z.ZodNullable<z.ZodEnum<["submitted", "approved", "disabled"]>>;
    /** RRA branch id, `00` for a head office. */
    branchId: z.ZodNullable<z.ZodString>;
    /** Whether that account is registered for VAT. A non-VAT taxpayer still invoices. */
    vatRegistered: z.ZodNullable<z.ZodBoolean>;
    /** OAuth scopes the taxpayer actually granted. */
    scopes: z.ZodArray<z.ZodString, "many">;
    connectedAt: z.ZodNullable<z.ZodString>;
    mapping: z.ZodObject<{
        accommodationItemId: z.ZodNullable<z.ZodNumber>;
        serviceFeeItemId: z.ZodNullable<z.ZodNumber>;
        /**
         * The EBM customer a stay is billed to when the guest is not a registered
         * taxpayer, which is every ordinary booking. The provider requires a
         * customer on the invoice; RRA itself treats a sale with no buyer TIN as
         * B2C. Booking guests are never asked for a TIN, so one standing "walk-in"
         * customer stands for all of them.
         */
        walkInCustomerId: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        accommodationItemId: number | null;
        serviceFeeItemId: number | null;
        walkInCustomerId: number | null;
    }, {
        accommodationItemId: number | null;
        serviceFeeItemId: number | null;
        walkInCustomerId: number | null;
    }>;
    /**
     * Connected AND fully mapped, so the next captured sale can be certified.
     * Computed by the server rather than by each screen, because "ready" is the
     * condition the emission worker actually tests, and two definitions of it
     * would let a screen promise something the worker refuses.
     */
    isReady: z.ZodBoolean;
    /**
     * How many sales are waiting because this business cannot invoice yet.
     *
     * On the connection rather than on a separate dashboard because it is the
     * consequence of THIS record being unfinished, and a setup screen that does
     * not say "14 sales are held" understates what the operator is putting off.
     */
    heldSaleCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "not_connected" | "connected" | "revoked";
    mode: "mock" | "live";
    tin: string | null;
    accountName: string | null;
    accountStatus: "submitted" | "approved" | "disabled" | null;
    branchId: string | null;
    vatRegistered: boolean | null;
    scopes: string[];
    connectedAt: string | null;
    mapping: {
        accommodationItemId: number | null;
        serviceFeeItemId: number | null;
        walkInCustomerId: number | null;
    };
    isReady: boolean;
    heldSaleCount: number;
}, {
    status: "not_connected" | "connected" | "revoked";
    mode: "mock" | "live";
    tin: string | null;
    accountName: string | null;
    accountStatus: "submitted" | "approved" | "disabled" | null;
    branchId: string | null;
    vatRegistered: boolean | null;
    scopes: string[];
    connectedAt: string | null;
    mapping: {
        accommodationItemId: number | null;
        serviceFeeItemId: number | null;
        walkInCustomerId: number | null;
    };
    isReady: boolean;
    heldSaleCount: number;
}>;
export type EbmConnection = z.infer<typeof EbmConnection>;
/**
 * What `POST /api/v1/ops/ebm/connect` answers: where to send the taxpayer.
 *
 * A URL rather than a redirect, because the caller is a fetch from an operator
 * screen. The screen sends the person there; the provider sends them back to the
 * API's callback.
 */
export declare const EbmConnectStart: z.ZodObject<{
    authorizeUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    authorizeUrl: string;
}, {
    authorizeUrl: string;
}>;
export type EbmConnectStart = z.infer<typeof EbmConnectStart>;
/**
 * One sale's certification state, for the operator's compliance view.
 *
 * `held` and `failed` are both visible and both count: F-B13's rule is that a
 * compliance event queues and is never silently skipped, and a queue nobody can
 * see is indistinguishable from a skip.
 */
export declare const EbmEmissionStatus: z.ZodEnum<["held", "emitted", "failed"]>;
export type EbmEmissionStatus = z.infer<typeof EbmEmissionStatus>;
export declare const EbmEmission: z.ZodObject<{
    id: z.ZodString;
    bookingReference: z.ZodString;
    status: z.ZodEnum<["held", "emitted", "failed"]>;
    attempts: z.ZodNumber;
    /** Plain wording for why it is not emitted. Null once it is. */
    lastError: z.ZodNullable<z.ZodString>;
    emittedAt: z.ZodNullable<z.ZodString>;
    /** The RRA receipt number, once the Authority has issued one. */
    receiptNumber: z.ZodNullable<z.ZodNumber>;
    totalRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "held" | "emitted";
    id: string;
    totalRwf: number;
    bookingReference: string;
    attempts: number;
    lastError: string | null;
    emittedAt: string | null;
    receiptNumber: number | null;
}, {
    status: "failed" | "held" | "emitted";
    id: string;
    totalRwf: number;
    bookingReference: string;
    attempts: number;
    lastError: string | null;
    emittedAt: string | null;
    receiptNumber: number | null;
}>;
export type EbmEmission = z.infer<typeof EbmEmission>;
//# sourceMappingURL=ebm-connection.d.ts.map