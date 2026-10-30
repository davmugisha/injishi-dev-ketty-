import {
  ServiceItemOptions,
  type RraItemField,
  type SelectedOption,
  type SelectedOptionSnapshot,
  type ServiceItemOption,
} from '@injishi/contracts';

/**
 * WHAT MAY BE SOLD, AND AT WHAT PRICE (ADR-050 D-m, amended 2026-09-12).
 *
 * Pure, so the rule can be tested without a database, and ONE copy of it, so
 * the guest route, the staff route and the menu screen can never disagree about
 * whether an item may sell. The rule is the service's and not a database check,
 * because every item on sale when the codes arrived carried none.
 */

/** The RRA values an item carries. `tax_code` is NOT NULL, so it is never missing. */
export interface RraCodes {
  rraItemClsCd: string | null;
  rraItemTyCd: string | null;
  rraItemCd: string | null;
  rraPkgUnitCd: string | null;
  rraQtyUnitCd: string | null;
}

/** What still stops an item selling, in the order a menu screen asks for them. Empty means it may sell. */
export function missingRra(item: RraCodes): RraItemField[] {
  const missing: RraItemField[] = [];
  if (!item.rraItemClsCd) missing.push('classification');
  if (!item.rraItemTyCd) missing.push('productType');
  if (!item.rraItemCd) missing.push('itemCode');
  if (!item.rraPkgUnitCd) missing.push('packagingUnit');
  if (!item.rraQtyUnitCd) missing.push('quantityUnit');
  return missing;
}

export function isSellable(item: RraCodes): boolean {
  return missingRra(item).length === 0;
}

/** The one sentence for an item refused because it cannot be declared, on any channel. */
export function unclassifiedSentence(name: string): string {
  return `${name} cannot be sold yet: it is missing the RRA codes a receipt needs. Add them on the menu first.`;
}

/** The modifiers an order line locked, read defensively from its jsonb. */
export function snapshotsOf(value: unknown): SelectedOptionSnapshot[] {
  return Array.isArray(value) ? (value as SelectedOptionSnapshot[]) : [];
}

/** The serial is 7 digits (VSDC v1.0.5 §4.17), so an org can mint this many codes. */
export const MAX_ITEM_SERIAL = 9_999_999;

/**
 * An `itemCd`, as VSDC v1.0.5 §4.17 writes it: the origin country (2), the
 * product type (1), the packaging unit code, the quantity unit code, then an
 * ascending 7 digit serial. §4.17's own example is `RW2NTBA0000012`.
 *
 * The unit codes are written as they are, never padded: the specification's
 * API samples pad some with `X` and not others, which contradicts the written
 * rule, and the written rule wins. `CHAR 20` holds the longest (2+1+5+5+7).
 */
export function itemCode(parts: {
  origin: string;
  productType: string;
  packagingUnit: string;
  quantityUnit: string;
  serial: number;
}): string {
  if (!Number.isInteger(parts.serial) || parts.serial < 1 || parts.serial > MAX_ITEM_SERIAL) {
    throw new RangeError(`An item code serial runs from 1 to ${MAX_ITEM_SERIAL}.`);
  }
  const code = `${parts.origin}${parts.productType}${parts.packagingUnit}${parts.quantityUnit}${String(parts.serial).padStart(7, '0')}`;
  if (code.length > 20) throw new RangeError(`${code} is longer than an itemCd may be.`);
  return code;
}

/** The serial at the end of a minted code, or null for a code this rule did not mint. */
export function serialOf(code: string): number | null {
  const match = /(\d{7})$/.exec(code);
  return match ? Number(match[1]) : null;
}

/**
 * The modifiers stored on an item. Anything unreadable is read as none rather
 * than thrown: a malformed jsonb written before this schema must not take a
 * whole menu down, and an item with no modifiers still sells at its price.
 */
export function readOptions(value: unknown): ServiceItemOption[] {
  const parsed = ServiceItemOptions.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

export type PricedLine =
  | {
      ok: true;
      /** Tax exclusive: the item's price plus every chosen delta. */
      unitPriceRwf: number;
      lineTotalRwf: number;
      selectedOptions: SelectedOptionSnapshot[];
    }
  | { ok: false; problem: string };

/**
 * Price one line from the item as it is NOW, which is then snapshotted onto the
 * order so it never changes again (AC-23).
 *
 * Refuses, with a sentence a person can act on, an option the item does not
 * offer, a choice it does not list, too many choices, a repeated choice, and a
 * required option left out.
 */
export function priceLine(
  item: { name: string; priceRwf: number; options: unknown },
  quantity: number,
  selected: SelectedOption[] | undefined,
): PricedLine {
  const offered = readOptions(item.options);
  const picked = selected ?? [];
  const snapshots: SelectedOptionSnapshot[] = [];
  let deltaRwf = 0;

  for (const choice of picked) {
    const option = offered.find((o) => o.name === choice.name);
    if (!option) {
      return { ok: false, problem: `${item.name} has no "${choice.name}" to choose.` };
    }
    if (picked.filter((p) => p.name === choice.name).length > 1) {
      return { ok: false, problem: `"${choice.name}" on ${item.name} was chosen twice.` };
    }
    if (new Set(choice.choices).size !== choice.choices.length) {
      return { ok: false, problem: `A choice for "${option.name}" on ${item.name} was picked twice.` };
    }
    if (choice.choices.length > option.maxChoices) {
      return {
        ok: false,
        problem: `Pick at most ${option.maxChoices} for "${option.name}" on ${item.name}.`,
      };
    }
    const lines: SelectedOptionSnapshot['choices'] = [];
    for (const label of choice.choices) {
      const found = option.choices.find((c) => c.label === label);
      if (!found) {
        return { ok: false, problem: `"${label}" is not a choice for "${option.name}" on ${item.name}.` };
      }
      deltaRwf += found.priceDeltaRwf;
      lines.push({ label: found.label, priceDeltaRwf: found.priceDeltaRwf });
    }
    snapshots.push({ name: option.name, choices: lines });
  }

  const unanswered = offered.find(
    (o) => o.required && !picked.some((p) => p.name === o.name),
  );
  if (unanswered) {
    return { ok: false, problem: `Choose "${unanswered.name}" for ${item.name}.` };
  }

  const unitPriceRwf = item.priceRwf + deltaRwf;
  if (unitPriceRwf < 0) {
    return { ok: false, problem: `Those choices would price ${item.name} below nothing.` };
  }
  return {
    ok: true,
    unitPriceRwf,
    lineTotalRwf: unitPriceRwf * quantity,
    selectedOptions: snapshots,
  };
}
