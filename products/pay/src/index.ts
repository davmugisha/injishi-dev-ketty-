import type { ProductDefinition } from "@injishi/product-contract";

/**
 * Injishi Pay (ADR-074): what it is, and the shapes its views draw.
 *
 * Each module names the permissions its API routes declare, so an app shows the module when the workspace grant
 * holds any one of them. That is an affordance only: the API refuses what the grant does not hold. Refunds are
 * decided through `ops/refunds` (`refund.decide`); the dashboard and reconciliation have no route of their
 * own yet, so they name the permission that reads money (`money.view`). Payment links, payouts, merchant
 * accounts and the payment sheet have no view yet, so they are not listed.
 */
export const definition = {
  id: "pay",
  name: "Injishi Pay",
  surfaces: ["web"],
  modules: [
    { id: "dashboard", surfaces: ["web"], permissions: ["money.view"] },
    { id: "refunds", surfaces: ["web"], permissions: ["refund.decide"] },
    { id: "reconciliation", surfaces: ["web"], permissions: ["money.view"] },
  ],
} as const satisfies ProductDefinition<"pay">;

export type {
  CheckTone,
  DeskMethod,
  EventStatus,
  FinanceEvent,
  MatchSummaryItem,
  PaymentEvidence,
  PaymentIntent,
  PaymentState,
  ReconInvoice,
  ReconMatch,
  ReconSource,
  RefundRequest,
  SettlementBatch,
} from "./model/finance.ts";
// `Tone` is declared once, as in every product.
export type * from "./model/shared.ts";
