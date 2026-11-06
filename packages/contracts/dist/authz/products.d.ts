import { z } from "zod";
import { Domain } from "../primitives";
/**
 * The products a business can have switched on, and the facts Account needs
 * about each one (ADR-074 D-a and D-k, ADR-076 slice G).
 *
 * A LOCAL COPY UNTIL ADR-074 STAGE 1 LANDS. `@injishi/product-contract` owns
 * the eleven IDs (as a type, with each product's modules); it is not on `main`
 * yet, so this list keeps the same IDs in the same order and moves there when
 * it merges (ADR-076 slice G build plan, step 1). The database refuses an ID
 * this list does not hold anyway: `org_product_entitlements.product_id` is a
 * foreign key into the `products` table, which a migration seeds.
 */
export declare const ProductId: z.ZodEnum<["account", "admin", "membership", "marketplace", "finance", "pay", "pms", "outlets", "pos", "hr", "residence"]>;
export type ProductId = z.infer<typeof ProductId>;
/** What each product is called on a screen. Brand names may change; an ID never does. */
export declare const PRODUCT_LABEL: Readonly<Record<ProductId, string>>;
/**
 * Where a product may be switched on (ADR-076 contract section 5).
 *
 * - `branch`: for the whole business or for chosen branches.
 * - `business`: on or off for the whole business only, so its row always
 *   covers every branch (a branch's listing keeps its own publish checks).
 * - `locked`: written when the org is created and never switched off.
 * - `none`: not a business product at all. Reached through the staff or
 *   oversight grant families, or PSF membership, and never an entitlement.
 */
export declare const EntitlementLevel: z.ZodEnum<["branch", "business", "locked", "none"]>;
export type EntitlementLevel = z.infer<typeof EntitlementLevel>;
export declare const ENTITLEMENT_LEVEL: Readonly<Record<ProductId, EntitlementLevel>>;
/** The products a business can hold an entitlement row for: every product but `admin` and `membership`. */
export declare const ENTITLED_PRODUCTS: readonly ProductId[];
/** May a business hold a row for this product at all? */
export declare function isEntitledProduct(product: ProductId): boolean;
/**
 * Which product set a business starts with (ADR-074 D-k), grouped from
 * ADR-075's `business_kind` (ADR-076 slice G, "The business kind"):
 *
 * - `stay`: a place guests sleep (hotel, motel, tented camp, guest house,
 *   apartment, lodge, villa, other);
 * - `venue`: food and drink with no rooms (bar and restaurant, coffee shop);
 * - `residence`: a landlord's rentals;
 * - `broker`: listed so the map covers every kind. A broker registers as a
 *   `brokers` row and a `broker` workspace with no org, so no org reaches it
 *   today.
 *
 * Not ADR-075's `BusinessKind` itself (business-kind.ts): this is the product
 * set a business starts with, and several kinds share one.
 */
export declare const ProductSetKind: z.ZodEnum<["stay", "venue", "residence", "broker", "enterprise"]>;
export type ProductSetKind = z.infer<typeof ProductSetKind>;
/**
 * The product set of one org, read from `orgs.business_kind`, or null when the
 * kind has no set. Null is never guessed into a set: activation then writes
 * `account` only and escalates the org to a person (ADR-076 G4).
 *
 * Typed loosely on purpose (`string`, not `BusinessKind`): it reads a database
 * row, and a database can gain an enum value before the code maps it. Such a
 * value must come back null rather than fall into a set that hands out
 * products.
 */
export declare function businessKindOf(org: {
    businessKind: string | null;
    domain?: string | null;
}): ProductSetKind | null;
/**
 * The products a business of each kind gets when it becomes `active`
 * (ADR-074 D-k). `account` is in every set but is written earlier, with the org
 * row itself; the activation write inserts only rows that are missing.
 *
 * Every kind gets `marketplace`, because its channels, host pages and the
 * publishing that makes a business live belong to Marketplace.
 */
export declare const KIND_PRODUCTS: Readonly<Record<ProductSetKind, readonly ProductId[]>>;
/**
 * What the switch on migration gave each business that was already `active` or
 * `suspended` (ADR-076 A-13, G3): the products it could reach the day before,
 * by domain, NOT its kind's set. That is what makes the slice invisible to a
 * business that already existed; only a business activated later gets
 * `KIND_PRODUCTS`.
 *
 * Kept here, beside the kind sets, so the snapshot tests and the migration can
 * be read against one table. The migration itself is SQL and repeats it.
 */
export declare const BACKFILL_PRODUCTS: Readonly<Record<Domain, readonly ProductId[]>>;
/**
 * Where a member holding several products lands (ADR-076 G14): the first of
 * these they hold a permission in. An owner and a manager keep their own home.
 */
export declare const HOME_PRODUCT_ORDER: readonly ProductId[];
//# sourceMappingURL=products.d.ts.map