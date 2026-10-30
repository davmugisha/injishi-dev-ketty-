/**
 * Pay's web views, and the provider an app mounts around them. The app hands each view its data as props, and
 * its links through `PayProvider`; nothing here reads the API or knows a URL.
 */

export { type PayLinks, PayProvider } from "./mount.tsx";
export { PaymentsView } from "./payments/payments-view.tsx";
export { ReconciliationView } from "./reconciliation/reconciliation-view.tsx";
