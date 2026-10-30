/**
 * What Outlets' screens draw: the kitchen display, the live order board and the guest's QR order.
 *
 * Declared here since ADR-074 stage 5: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/outlets.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { IconName } from "./shared.ts";

export type OutletTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Where an order came from: a table or bar seat, room service, or a guest's QR order. */
export type OrderSource = "table" | "room" | "qr";

export interface MenuOption {
  id: string;
  label: string;
  /** Extra charge in RWF (0 = included). */
  price: number;
  /** How the choice reads in a line's modifiers ("pili pili sauce"). */
  short?: string;
}

export interface MenuOptionGroup {
  id: "side" | "spice" | "extras";
  label: string;
  /** Pick any number (extras) instead of exactly one. */
  multiple?: boolean;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  /** Price in RWF, VAT included. */
  price: number;
  /** Portions left when stock is running low (shown as "4 left"). */
  portionsLeft?: number;
  soldOut?: boolean;
  diet?: string;
  /** One-line description on the guest QR menu. */
  guestNote?: string;
  /** Description in the POS options dialog. */
  description?: string;
  /** Long description on the guest item page. */
  guestDescription?: string;
  station?: string;
  optionGroups?: MenuOptionGroup[];
}

export interface MenuCategory {
  id: string;
  /** "dinner" = the POS dinner menu (v14), "room" = in-room dining on the QR menu. */
  menu: "dinner" | "room";
  label: string;
  /** Menu item ids, in menu order. */
  items: string[];
}

export interface KeyFact {
  label: string;
  value: string;
}

export interface KitchenStation {
  id: "grill" | "cold" | "bar";
  label: string;
  short: string;
  icon: IconName;
}

export interface KitchenItem {
  qty: number;
  name: string;
  mods: string;
  /** Set when the line was voided after it reached the kitchen. */
  voided?: string;
}

export interface KitchenTicket {
  id: string;
  station: KitchenStation["id"];
  source: OrderSource;
  label: string;
  meta: string;
  /** Minutes since the ticket came in (drives urgency). */
  minutes: number;
  timer: string;
  status: "new" | "ack" | "held" | "bumped";
  items: KitchenItem[];
  allergy?: string;
}

export interface BasketLine {
  id: string;
  item: string;
  name: string;
  mods: string;
  qty: number;
  price: number;
}

export interface RoomServiceStep {
  status: "complete" | "active" | "inactive";
  title: string;
  detail: string;
}

export interface RoomServiceOrder {
  id: string;
  /** "placed" = already with the kitchen, "draft" = the basket, once placed. */
  state: "placed" | "draft";
  meta: string;
  eta: string;
  items: string;
  amount: number;
  steps: RoomServiceStep[];
  /** Short line for the "also tracking" link. */
  progress: string;
}

export interface ServiceHour {
  id: string;
  label: string;
  hours: string;
}

export interface ServiceKpi {
  id: string;
  label: string;
  value: number;
  format?: {
    style?: "decimal" | "currency";
    currency?: string;
    notation?: "standard" | "compact";
    maximumFractionDigits?: number;
  };
  /** Suffix after the number ("min"). */
  unit?: string;
  foot: string;
  /** Warning icon in the header. */
  warn?: boolean;
  /** Value follows the screen's live state. */
  live?: "voids";
}

export interface OrderStage {
  id: "new" | "kitchen" | "ready" | "served" | "payment";
  label: string;
  tone: OutletTone;
}

export interface LiveOrder {
  id: string;
  stage: OrderStage["id"];
  source: OrderSource;
  label: string;
  age: string;
  items: string;
  meta: string;
  late: boolean;
}

export interface VoidRequest {
  id: string;
  item: string;
  amount: number;
  meta: string;
  code: string;
  stock: string;
  status: "open" | "approved" | "rejected";
  approvedNote: string;
}

export interface RefundEvent {
  id: string;
  status: "success" | "warning" | "current" | "default";
  icon: IconName;
  title: string;
  detail: string;
}

export interface Refund {
  id: string;
  bill: string;
  summary: string;
  events: RefundEvent[];
}

export interface FiscalReport {
  id: "x" | "z";
  label: string;
  /** X report: read time and reader; the lead is composed from them. */
  readAt?: string;
  readBy?: string;
  lead?: string;
  rows: KeyFact[];
}

export interface StockOut {
  id: string;
  name: string;
  left: string;
  detail: string;
  icon: IconName;
  onMenus: boolean;
}
