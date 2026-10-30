/**
 * What the recipes screen draws.
 *
 * Declared here since ADR-074 stage 5: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/stock.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { IconName, Tone } from "./shared.ts";

export interface LabeledValue {
  label: string;
  value: string;
}

export interface Recipe {
  id: string;
  name: string;
  icon: IconName;
  /** List line; null when computed from the costed ingredients. */
  meta: string | null;
  warn: boolean;
  version: string;
  context: string;
  facts: (LabeledValue & { mappedValue?: string })[];
  /** Fully costed recipe (ingredients, cost basis, economics). */
  costed: boolean;
  menuPrice: number | null;
  vatRate: number | null;
  /** Food cost target, percent of net price. */
  target: number | null;
  yieldNote: string | null;
  /** Sold on POS without a recipe; mapping resolves it. */
  unmapped: boolean;
  mappedMeta: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe: string;
  name: string;
  note: string;
  qty: number;
  unit: string;
  conversion: string;
  stockUnit: string;
  /** Recipe units in one stock unit (1,000 g in a kg). */
  perStockUnit: number;
  /** Cost per stock unit at weighted average cost. */
  costAvg: number;
  /** Cost per stock unit at the latest invoice price. */
  costLatest: number;
}

export interface ProductionBatch {
  id: string;
  product: string;
  plan: string;
  inputs: { label: string; cost: number }[];
  plannedYield: number;
  minYield: number;
  maxYield: number;
  lastBatch: string;
  movements: string;
}

export interface PosEvent {
  id: string;
  title: string;
  icon: IconName;
  detail: string;
  state: string;
  tone: Tone;
  /** Held because the item has no recipe. */
  needsRecipe: boolean;
  /** How it reads once the recipe is mapped. */
  resolved: { detail: string; state: string; tone: Tone } | null;
}
