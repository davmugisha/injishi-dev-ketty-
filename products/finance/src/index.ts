import type { ProductDefinition } from "@injishi/product-contract";

/**
 * Injishi Finance (ADR-074): what it is, and the shapes its views draw.
 *
 * Each module names the permissions its API routes declare, so an app shows the module when the workspace grant
 * holds any one of them. That is an affordance only: the API refuses what the grant does not hold. The overview
 * reads the owner's dashboard (`ops/owner-dashboard`, `money.view`); cash control is the shift close review
 * (`ops/pos`' review routes, `shift.review`); tax names the EBM connection's routes (`ops/ebm`, `ebm.manage`),
 * because VAT preparation has none yet. Receivables and commissions are Horizon and have no route, so they name
 * the permission that reads money (`money.view`). Reports has no view in this product: the owner's Reports
 * screen stays the app's composition. The general ledger's screen moves with Finance too, but the ledger is
 * Horizon with no module ID of its own (ADR-074), so no module lists it.
 */
export const definition = {
  id: "finance",
  name: "Injishi Finance",
  surfaces: ["web"],
  modules: [
    { id: "overview", surfaces: ["web"], permissions: ["money.view"] },
    { id: "cash-control", surfaces: ["web"], permissions: ["shift.review"] },
    { id: "tax", surfaces: ["web"], permissions: ["ebm.manage"] },
    { id: "receivables", surfaces: ["web"], permissions: ["money.view"] },
    { id: "commissions", surfaces: ["web"], permissions: ["money.view"] },
  ],
} as const satisfies ProductDefinition<"finance">;

export type {
  AccountingKpi,
  AgingBucket,
  AllocationProposal,
  ArAccount,
  ArDispute,
  ArInvoice,
  BankTransfer,
  ClosePeriod,
  CommissionLine,
  ExportBatch,
  FiscalDocumentKind,
  FiscalInvoice,
  FiscalJournalEvent,
  FiscalProfile,
  FiscalQueueItem,
  FiscalReceipt,
  FiscalStatus,
  ItemCode,
  JournalEntry,
  KpiStatus,
  LedgerAccount,
  Levy,
  LogEntry,
  MarkerStatus,
  Payout,
  VatDeclaration,
  VatSummary,
  VsdcDevice,
  ZReport,
} from "./model/accounting.ts";
export type {
  CashDenomination,
  CashierShift,
  Check,
  CheckTone,
  EventStatus,
  ExceptionCategory,
  ExceptionGroup,
  ExceptionType,
  ExcludedTender,
  Fact,
  FinanceEvent,
  FinanceException,
  FinanceKpi,
  FloatRow,
  ResolvedException,
  ShiftTender,
  TillStatus,
} from "./model/finance.ts";
// `Tone`, the same in both areas, is declared once; a view prints who recorded a step through `Persona`.
export type * from "./model/shared.ts";
