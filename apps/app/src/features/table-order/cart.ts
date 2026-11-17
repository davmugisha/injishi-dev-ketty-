/**
 * A guest's cart at a table (migration 0156), as pure functions so the arithmetic is tested on its own.
 *
 * The amounts follow `lineAmounts` in contracts pos.ts exactly (a guest's order carries no discount): a tax
 * exclusive outlet adds each line's VAT rounded half up, a tax inclusive one charges the line as priced. The server
 * prices the order again from the menu when it is sent and its total is the one on the bill; this is the preview.
 */
import type { TableOrderMenuItem } from "@/server/table-order";

export interface Selection {
  name: string;
  choices: string[];
}

export interface CartLine {
  /** One line per item, choice of options and note: the same again adds to its quantity. */
  key: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPriceRwf: number;
  taxRateBps: number;
  selectedOptions: Selection[];
  note: string;
}

export const MAX_QUANTITY = 30;
export const MAX_LINES = 40;

/** a / b rounded half up, for whole non-negative a and positive b (contracts `divRoundHalfUp`). */
const roundHalfUp = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));

/** The item's price with the chosen options' deltas. */
export function unitPrice(item: Pick<TableOrderMenuItem, "priceRwf" | "options">, selected: Selection[]): number {
  let price = item.priceRwf;
  for (const s of selected) {
    const option = item.options.find((o) => o.name === s.name);
    for (const label of s.choices) price += option?.choices.find((c) => c.label === label)?.priceDeltaRwf ?? 0;
  }
  return Math.max(0, price);
}

/** Why this choice of options cannot be ordered, or null when it can. */
export function optionProblem(item: Pick<TableOrderMenuItem, "options">, selected: Selection[]): string | null {
  for (const o of item.options) {
    const picked = selected.find((s) => s.name === o.name)?.choices ?? [];
    if (o.required && picked.length === 0) return `Choose ${o.name.toLowerCase()}.`;
    if (picked.length > o.maxChoices) return `Choose up to ${o.maxChoices} for ${o.name.toLowerCase()}.`;
  }
  return null;
}

export function lineKey(itemId: string, selected: Selection[], note: string): string {
  const options = selected
    .filter((s) => s.choices.length)
    .map((s) => `${s.name}=${[...s.choices].sort().join("+")}`)
    .sort()
    .join("|");
  return `${itemId}#${options}#${note.trim()}`;
}

export interface LineAmounts {
  netRwf: number;
  taxRwf: number;
  totalRwf: number;
}

export function lineAmounts(
  line: Pick<CartLine, "unitPriceRwf" | "quantity" | "taxRateBps">,
  mode: "exclusive" | "inclusive",
): LineAmounts {
  const netRwf = line.unitPriceRwf * line.quantity;
  if (mode === "exclusive") {
    const taxRwf = roundHalfUp(netRwf * line.taxRateBps, 10_000);
    return { netRwf, taxRwf, totalRwf: netRwf + taxRwf };
  }
  return { netRwf, taxRwf: roundHalfUp(netRwf * line.taxRateBps, 10_000 + line.taxRateBps), totalRwf: netRwf };
}

export function cartTotals(lines: CartLine[], mode: "exclusive" | "inclusive"): LineAmounts & { count: number } {
  const each = lines.map((l) => lineAmounts(l, mode));
  return {
    netRwf: each.reduce((a, l) => a + l.netRwf, 0),
    taxRwf: each.reduce((a, l) => a + l.taxRwf, 0),
    totalRwf: each.reduce((a, l) => a + l.totalRwf, 0),
    count: lines.reduce((a, l) => a + l.quantity, 0),
  };
}

/** Add `quantity` of an item with these options: onto its line when the same line is there, else a new line. */
export function addToCart(
  lines: CartLine[],
  item: Pick<TableOrderMenuItem, "id" | "name" | "priceRwf" | "taxRateBps" | "options">,
  selected: Selection[],
  quantity = 1,
  note = "",
): CartLine[] {
  const chosen = selected.filter((s) => s.choices.length);
  const key = lineKey(item.id, chosen, note);
  const found = lines.find((l) => l.key === key);
  if (found)
    return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l));
  if (lines.length >= MAX_LINES) return lines;
  return [
    ...lines,
    {
      key,
      itemId: item.id,
      name: item.name,
      quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)),
      unitPriceRwf: unitPrice(item, chosen),
      taxRateBps: item.taxRateBps,
      selectedOptions: chosen,
      note: note.trim(),
    },
  ];
}

/** Set a line's quantity; 0 takes it out. */
export function setQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l));
}

/** How many of an item are in the cart, across its lines. */
export const countOf = (lines: CartLine[], itemId: string) =>
  lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.quantity, 0);

/** The body the API takes: ids, quantities, options and notes only. Never a price. */
export function orderBody(lines: CartLine[], clientKey: string, guestNote: string, guestCount: number | null) {
  return {
    clientKey,
    lines: lines.map((l) => ({
      serviceItemId: l.itemId,
      quantity: l.quantity,
      ...(l.selectedOptions.length ? { selectedOptions: l.selectedOptions } : {}),
      ...(l.note ? { note: l.note } : {}),
    })),
    ...(guestNote.trim() ? { guestNote: guestNote.trim().slice(0, 200) } : {}),
    ...(guestCount ? { guestCount } : {}),
  };
}

/** Where an item's photo is: its uploaded one through this table's own address, else null (the caller suggests). */
export function uploadedPhotoSrc(code: string, itemId: string, photo: string | null): string | null {
  const m = photo ? /^upload:([0-9a-f-]{36})\.([0-9a-f]{1,16})$/.exec(photo) : null;
  return m && m[1] === itemId ? `/api/table-order/${encodeURIComponent(code)}/photos/${itemId}?v=${m[2]}` : null;
}
