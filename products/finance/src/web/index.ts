/**
 * Finance's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links and shell through `FinanceProvider`; nothing here reads the API or knows a URL.
 */
export {
  type FinanceLinks,
  FinanceProvider,
  type FinanceShell,
  type TopbarStatusProps,
  // Exported only while Finance's views still sit in apps/app (ADR-074 stage 6, in place); the move makes them
  // the product's own imports.
  useBoardHref,
  useFinanceShell,
} from "./mount.tsx";
