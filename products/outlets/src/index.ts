import type { ProductDefinition } from "@injishi/product-contract";

/**
 * Injishi Outlets (ADR-074): what it is, and the shapes its views draw.
 *
 * Each module names the permissions its API routes declare (the `ops` outlets, outlet parties, service catalog
 * and service orders controllers), so an app shows the module when the workspace grant holds any one of them.
 * That is an affordance only: the API refuses what the grant does not hold. Ordering from a table's QR or to a
 * room is the guest's (`/api/v1/me/orders`), behind a session alone, because a guest holds no workspace.
 * Recipes has no route of its own yet, so it names the permission of the menu it would extend (`menu.manage`).
 * Hours, floor plans and tables, and waiter assignment have no view yet, so they are not listed.
 */
export const definition = {
  id: "outlets",
  name: "Injishi Outlets",
  surfaces: ["web"],
  modules: [
    { id: "outlet-setup", surfaces: ["web"], permissions: ["outlet.manage"] },
    { id: "menus-and-modifiers", surfaces: ["web"], permissions: ["menu.manage", "order.advance"] },
    { id: "kitchen-and-bar-routing", surfaces: ["web"], permissions: ["order.advance", "kitchen.work"] },
    { id: "qr-table-ordering", surfaces: ["web"], permissions: [] },
    { id: "room-service", surfaces: ["web"], permissions: [] },
    { id: "recipes", surfaces: ["web"], permissions: ["menu.manage"] },
  ],
} as const satisfies ProductDefinition<"outlets">;

export type {
  DepartmentGroup,
  MenuItem as OperationsMenuItem,
  Outlet,
  OutletMenu,
  OutletOffer,
  OutletOrder,
  OutletOrderLoad,
} from "./model/operations.ts";
export type {
  BasketLine,
  FiscalReport,
  KeyFact,
  KitchenItem,
  KitchenStation,
  KitchenTicket,
  LiveOrder,
  MenuCategory,
  MenuItem as OutletMenuItem,
  MenuOption,
  MenuOptionGroup,
  OrderSource,
  OrderStage,
  OutletTone,
  Refund,
  RefundEvent,
  RoomServiceOrder,
  RoomServiceStep,
  ServiceHour,
  ServiceKpi,
  StockOut,
  VoidRequest,
} from "./model/outlets.ts";
// `MenuItem` means a different shape in two areas, so each is renamed here with its area's name in front; inside
// the product every view imports from its own model file. `Tone`, the same in both areas, is declared once.
export type * from "./model/shared.ts";
export type {
  LabeledValue,
  PosEvent,
  ProductionBatch,
  Recipe,
  RecipeIngredient,
} from "./model/stock.ts";
