/**
 * Finance's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links and shell through `FinanceProvider`; nothing here reads the API or knows a URL.
 */

export { ShiftCloseView } from "./cash-control/shift-close-view.tsx";
export { CommissionsView } from "./commissions/commissions-view.tsx";
export { GeneralLedgerView, type LedgerTab } from "./ledger/general-ledger-view.tsx";
export {
  type FinanceLinks,
  FinanceProvider,
  type FinanceShell,
  type TopbarStatusProps,
} from "./mount.tsx";
export { FinanceHomeView, type QueryOutcome } from "./overview/finance-home-view.tsx";
export { AccountsReceivableView } from "./receivables/accounts-receivable-view.tsx";
export { FiscalReceiptsView, type FiscalTab } from "./tax/fiscal-receipts-view.tsx";
export { TaxSummaryView } from "./tax/tax-summary-view.tsx";
