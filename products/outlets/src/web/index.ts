/**
 * Outlets' web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, shell and photographs through `OutletsProvider`; nothing here reads the API or knows a URL.
 */
export {
  type OutletsLinks,
  type OutletsMedia,
  OutletsProvider,
  type OutletsShell,
  type TopbarStatusProps,
  // Exported only while Outlets' views still sit in apps/app (ADR-074 stage 5, in place); the move makes them
  // the product's own imports.
  useBoardHref,
  useOutletsMedia,
  useOutletsShell,
} from "./mount.tsx";
