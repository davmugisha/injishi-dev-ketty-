/**
 * Outlets' web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, shell and photographs through `OutletsProvider`; nothing here reads the API or knows a URL.
 */

export { QrOrderView, type QrStep } from "./guest-ordering/qr-order-view.tsx";
export { KitchenDisplayView } from "./kitchen/kitchen-display-view.tsx";
export { OutletsMenusView, type OutletTab } from "./menus/outlets-menus-view.tsx";
export {
  type OutletsLinks,
  type OutletsMedia,
  OutletsProvider,
  type OutletsShell,
  type TopbarStatusProps,
} from "./mount.tsx";
export { OutletOrdersView } from "./orders/outlet-orders-view.tsx";
export { RecipesView } from "./recipes/recipes-view.tsx";
