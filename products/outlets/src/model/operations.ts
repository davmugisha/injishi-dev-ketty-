/**
 * What the outlet menus screen draws: outlets, their menus, offers and orders.
 *
 * Declared here since ADR-074 stage 5: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/operations.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { IconName, Tone } from "./shared.ts";

export interface Outlet {
  id: string;
  name: string;
  kind: string;
  relation: string;
  tone: Tone;
  /** Charge to room is possible only for the hotel's own outlets. */
  chargeAllowed: boolean;
  chargeToRoom: boolean;
  facts: { label: string; value: string }[];
}

export interface DepartmentGroup {
  id: string;
  group: string;
  items: { name: string; detail: string; tone: Tone | null }[];
}

export interface MenuItem {
  name: string;
  modifiers: string;
  price: number;
  tax: string;
  stock: string;
  status: string;
  tone: Tone;
  /** Changes waiting in the draft version. */
  draft?: { price?: number; status?: string; tone?: Tone };
}

export interface OutletMenu {
  id: string;
  outlet: string;
  name: string;
  sub: string;
  version: string;
  readOnly: boolean;
  draft?: {
    title: string;
    description: string;
    action: string;
    sub: string;
    version: string;
  };
  items: MenuItem[];
}

export interface OutletOrder {
  id: string;
  icon: IconName;
  source: string;
  outlet: string;
  place: string;
  items: string;
  status: string;
  tone: Tone;
  age: string;
  settlement: string;
  settleTone: Tone | null;
}

export interface OutletOrderLoad {
  id: string;
  label: string;
  value: number;
  unit: string;
  foot: string;
}

export interface OutletOffer {
  id: string;
  name: string;
  outlet: string;
  valid: string;
  eligibility: string;
  redeemed: number;
  status: string;
  tone: Tone;
  note: string;
  redemptions: { id: string; who: string; meta: string; value: number; status: string; tone: Tone }[];
  empty?: string;
}
