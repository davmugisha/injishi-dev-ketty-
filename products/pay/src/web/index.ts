/**
 * Pay's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links through `PayProvider`; nothing here reads the API or knows a URL.
 */
export {
  type PayLinks,
  PayProvider,
  // Exported only while Pay's views still sit in apps/app (ADR-074 stage 6, in place); the move makes them
  // the product's own imports.
  useBoardHref,
} from "./mount.tsx";
