/**
 * `@injishi/product-contract`: what a product is (ADR-074).
 *
 * A product is a folder under `products/`, published to the workspace as
 * `@injishi/product-<id>`, holding screens, flows and product metadata. It
 * holds no authority: every rule that decides anything stays on the API. What
 * a product exports about itself is a `ProductDefinition`, typed here, so the
 * apps that mount products and the products themselves agree on its shape.
 *
 * Types only, and no registry. An app registers the products it imports and
 * supplies their concrete routes; nothing here lists what is installed, and
 * nothing here may hold a value. The `exports` map offers only a `types`
 * condition, so a value import fails to resolve rather than bundling nothing.
 * Import it with `import type`.
 *
 * The product IDs and each product's module IDs are the machine copy of
 * `adrs/074-injishi-as-a-platform/074-products-and-modules.md`. That table is
 * the record, with what each module owns and its starting material; this file
 * only names them. A module slug is also its directory name inside
 * `products/<id>/src/modules/`.
 */

import type { Permission } from "@injishi/contracts";

/**
 * The eleven products (ADR-074 D-a). An ID keys entitlements in the database
 * (the `products` reference table, D-q), prefixes permission keys from stage 8
 * and names the package. Brand names may change freely; an ID never does.
 */
export type ProductId =
  | "account"
  | "admin"
  | "membership"
  | "marketplace"
  | "finance"
  | "pay"
  | "pms"
  | "outlets"
  | "pos"
  | "hr"
  | "residence";

/**
 * Where a module has views. `native` is claimed only once a native module
 * exists: an empty `native.ts` does not count as mobile support.
 */
export type Surface = "web" | "native";

/**
 * Each product's modules. Modules marked *Horizon* are outside v1 in the
 * current domain map; naming their owner here does not approve them.
 *
 * Compliance, fiscal (EBM), property, inventory and billing are absent on
 * purpose: they are server only capabilities (D-b), with no product folder, so
 * they have no module ID here either.
 */
export interface ProductModules {
  account:
    | "authentication"
    | "profile"
    | "identity"
    | "business-registration"
    | "organizations"
    | "memberships"
    | "team-and-roles"
    | "workspaces"
    | "connections"
    | "plan-and-billing"
    | "preferences";
  admin:
    | "control-tower"
    | "businesses"
    | "staff-and-appointments"
    | "configuration"
    | "platform-health"
    | "support-desk"
    | "training-admin"
    | "audit"
    | "localization-admin";
  membership:
    | "public-hub"
    | "applications"
    | "dues"
    | "certificates-and-directory"
    | "registration-review"
    | "membership-decisions"
    | "district-view";
  marketplace:
    | "discovery"
    | "property-pages"
    | "checkout"
    | "trips-and-saved"
    | "reviews"
    | "broker-network"
    | "host-acquisition"
    | "help"
    | "seo-content";
  finance:
    | "overview"
    | "cash-control"
    | "tax"
    | "reports"
    /** Horizon. */
    | "receivables"
    /** Horizon. */
    | "commissions";
  pay:
    | "dashboard"
    | "payment-links"
    | "refunds"
    | "payouts"
    | "reconciliation"
    | "merchant-accounts"
    | "payment-sheet";
  pms:
    | "reservations"
    | "front-desk"
    | "stays-and-guests"
    | "folios-and-night-audit"
    | "housekeeping"
    | "rates-and-availability"
    | "stay-setup"
    | "guest-requests"
    | "maintenance"
    /** Horizon. */
    | "loyalty"
    /** Horizon. */
    | "lost-and-found"
    /** Horizon. */
    | "groups-and-packages";
  outlets:
    | "outlet-setup"
    | "hours"
    | "menus-and-modifiers"
    | "floor-plan-and-tables"
    | "waiter-assignment"
    | "kitchen-and-bar-routing"
    | "qr-table-ordering"
    | "room-service"
    | "recipes";
  pos:
    | "till"
    | "discounts"
    | "split-bills"
    | "tender"
    | "drawer-and-shifts"
    | "receipts"
    | "voids-refunds-returns"
    | "offline-queue"
    | "devices"
    | "stock";
  hr: "people" | "roster" | "attendance" | "leave" | "payroll" | "self-service";
  residence:
    | "lease-listings"
    | "applicants"
    | "leases"
    | "rent"
    | "deposits"
    | "move-in-and-out"
    | "resident-portal"
    | "landlord-statements";
}

/** A module of one product. Never the occupancy `domain` (`hospitality`, `residence`), which is a business concept. */
export type ModuleId<P extends ProductId = ProductId> = ProductModules[P];

/** One module, as its product describes it. */
export interface ProductModule<P extends ProductId = ProductId> {
  id: ModuleId<P>;
  /** Where this module has views today. */
  surfaces: readonly Surface[];
  /**
   * The permissions the module's routes declare. Navigation shows the module
   * when the workspace grant holds any one of them, the way a route declares
   * `@RequireAnyPermission`. That is an affordance only: the grant comes from
   * `GET /api/v1/me/workspaces`, never computed in the client, and the API's
   * guards are the control. Empty for a module whose routes need only the
   * session.
   */
  permissions: readonly Permission[];
}

/**
 * A navigation entry a product contributes. It names the module and a label;
 * the app that mounts the product supplies the concrete route.
 */
export interface ProductNavEntry<P extends ProductId = ProductId> {
  module: ModuleId<P>;
  label: string;
}

/**
 * What a product exports as `definition`. Write it with `satisfies`, so the
 * literal keeps its narrow types and no helper value is needed:
 *
 *     export const definition = { id: "hr", ... } satisfies ProductDefinition<"hr">;
 */
export interface ProductDefinition<P extends ProductId = ProductId> {
  /** The permanent ID, which must match the package name `@injishi/product-<id>`. */
  id: P;
  /** The brand name a person reads. Free to change; the ID is not. */
  name: string;
  /** Where the product has views at all: the union of its modules' surfaces. */
  surfaces: readonly Surface[];
  modules: readonly ProductModule<P>[];
  nav?: readonly ProductNavEntry<P>[];
}

/* ------------------------------------------------------------ Self checks */
/*
 * Checked by this package's own `typecheck`. Each alias fails to compile when
 * its condition is false.
 */

type Expect<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Every product has a module list, and nothing that is not a product does. */
type _EveryProductHasModules = Expect<Same<keyof ProductModules, ProductId>>;
