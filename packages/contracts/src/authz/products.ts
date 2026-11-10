import { z } from "zod";
import { BusinessKind } from "../business-kind";
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
export const ProductId = z.enum([
    "account",
    "admin",
    "membership",
    "marketplace",
    "finance",
    "pay",
    "pms",
    "outlets",
    "pos",
    "hr",
    "residence",
]);
export type ProductId = z.infer<typeof ProductId>;
/** What each product is called on a screen. Brand names may change; an ID never does. */
export const PRODUCT_LABEL: Readonly<Record<ProductId, string>> = {
    account: "Account",
    admin: "Admin",
    membership: "Membership",
    marketplace: "Marketplace",
    finance: "Finance",
    pay: "Pay",
    pms: "PMS",
    outlets: "Outlets",
    pos: "POS",
    hr: "HR",
    residence: "Residence",
};
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
export const EntitlementLevel = z.enum(["branch", "business", "locked", "none"]);
export type EntitlementLevel = z.infer<typeof EntitlementLevel>;
export const ENTITLEMENT_LEVEL: Readonly<Record<ProductId, EntitlementLevel>> = {
    pms: "branch",
    outlets: "branch",
    pos: "branch",
    residence: "branch",
    hr: "business",
    finance: "business",
    pay: "business",
    marketplace: "business",
    account: "locked",
    admin: "none",
    membership: "none",
};
/** The products a business can hold an entitlement row for: every product but `admin` and `membership`. */
export const ENTITLED_PRODUCTS: readonly ProductId[] = ProductId.options.filter((p) => ENTITLEMENT_LEVEL[p] !== "none");
/** May a business hold a row for this product at all? */
export function isEntitledProduct(product: ProductId): boolean {
    return ENTITLEMENT_LEVEL[product] !== "none";
}
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
export const ProductSetKind = z.enum(["stay", "venue", "residence", "broker", "enterprise"]);
export type ProductSetKind = z.infer<typeof ProductSetKind>;
/**
 * The set each kind starts with. Typed over every `BusinessKind`, so a kind
 * added to ADR-075's vocabulary fails the typecheck here until somebody gives
 * it a set.
 */
const PRODUCT_SET_OF_KIND: Readonly<Record<BusinessKind, ProductSetKind>> = {
    hotel: "stay",
    motel: "stay",
    tented_camp: "stay",
    guest_house: "stay",
    apartment: "stay",
    lodge: "stay",
    villa: "stay",
    other: "stay",
    bar_restaurant: "venue",
    coffee_shop: "venue",
    residence: "residence",
    broker: "broker",
};
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
export function businessKindOf(org: { businessKind: string | null; domain?: string | null }): ProductSetKind | null {
    // A PSF business (the PSF path, `enterprise`) carries no `business_kind`, on purpose: the kinds name
    // places, and it is not one (registration writes null). Its set is the two every kind holds (D-k); its
    // PSF membership is reached through membership itself, never an entitlement.
    if (org.domain === "enterprise")
        return "enterprise";
    const kind = BusinessKind.safeParse(org.businessKind);
    return kind.success ? PRODUCT_SET_OF_KIND[kind.data] : null;
}
/**
 * The products a business of each kind gets when it becomes `active`
 * (ADR-074 D-k). `account` is in every set but is written earlier, with the org
 * row itself; the activation write inserts only rows that are missing.
 *
 * Every kind gets `marketplace`, because its channels, host pages and the
 * publishing that makes a business live belong to Marketplace.
 */
export const KIND_PRODUCTS: Readonly<Record<ProductSetKind, readonly ProductId[]>> = {
    stay: ["account", "marketplace", "pms", "outlets", "pos", "hr", "finance", "pay"],
    venue: ["account", "marketplace", "outlets", "pos", "hr", "finance", "pay"],
    residence: ["account", "marketplace", "residence", "hr", "finance", "pay"],
    broker: ["account", "marketplace"],
    enterprise: ["account", "marketplace"],
};
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
export const BACKFILL_PRODUCTS: Readonly<Record<Domain, readonly ProductId[]>> = {
    hospitality: ["account", "marketplace", "pms", "outlets", "pos", "hr", "finance", "pay"],
    residence: ["account", "marketplace", "residence", "hr", "finance", "pay"],
    // A PSF business reached nothing but its own account and membership the day before.
    enterprise: ["account"],
};
/**
 * Where a member holding several products lands (ADR-076 G14): the first of
 * these they hold a permission in. An owner and a manager keep their own home.
 */
export const HOME_PRODUCT_ORDER: readonly ProductId[] = ["pms", "residence", "outlets", "pos", "hr", "finance"];
