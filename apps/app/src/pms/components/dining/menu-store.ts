/**
 * THE OWNER'S EDITS TO THEIR OWN MENU, kept as an OVERLAY on the catalogue.
 *
 * `data/dining.ts` is a frozen fixture shared with the guest app, so an operator
 * repricing a dish cannot write into it. What is stored here is the DIFFERENCE:
 * the fields that were changed, the products that were added, and the slugs
 * that were taken off. Reading applies the difference to the fixture, which
 * means a fixture the two apps keep in step stays the floor and the demo still
 * survives a reload.
 *
 * The alternative — copying all 29 products into storage on first edit — was
 * rejected because it freezes the catalogue at whatever the browser saw first:
 * a dish added to `data/dining.ts` next week would never appear for anyone who
 * had already opened the screen, which is the same class of bug the guest
 * store's seeded threads avoid by treating the seed as a floor.
 *
 * FABRICATED DATA. Read the header of `data/dining.ts` first. Nothing here was
 * read off a real menu; a price typed into this screen is a demo price and must
 * not be quoted as one this property charges.
 *
 * NO CLOCK, NO RANDOMNESS. A new product's slug is derived from its name, so
 * the same name always yields the same slug and a server render and a client
 * render of the same overlay agree.
 */

import {
  DINING_CATEGORY_ORDER,
  type DiningProduct,
  groupByCategory,
  outletsForProperty,
  productsForProperty,
} from "../../data/dining";

/** The fields an operator may change on a product they did not invent. */
export interface ProductDraft {
  name: string;
  outletSlug: string;
  category: string;
  priceRwf: number;
  description: string;
  available: boolean;
}

/**
 * One property's difference from the fixture.
 *
 * `edits` is keyed by slug and holds whole drafts rather than partials: an
 * operator edits a product in one dialog and saves all six fields at once, so a
 * partial would only add a merge that never has anything to merge.
 */
export interface MenuOverlay {
  edits: Record<string, ProductDraft>;
  added: DiningProduct[];
  removed: string[];
}

const EMPTY: MenuOverlay = { edits: {}, added: [], removed: [] };

const STORAGE_KEY = "injishi:pms-menu";

/**
 * Fired on every write. `storage` alone is not enough: the browser does not
 * deliver it to the tab that wrote the value, so the list and the counts above
 * it would disagree until a reload.
 */
export const MENU_STORE_CHANGE_EVENT = "injishi:pms-menu-change";

/* -------------------------------------------------------------- persistence */

function parseDraft(value: unknown): ProductDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.name !== "string" ||
    typeof raw.outletSlug !== "string" ||
    typeof raw.category !== "string" ||
    typeof raw.priceRwf !== "number" ||
    typeof raw.description !== "string" ||
    typeof raw.available !== "boolean"
  ) {
    return null;
  }
  return {
    name: raw.name,
    outletSlug: raw.outletSlug,
    category: raw.category,
    priceRwf: raw.priceRwf,
    description: raw.description,
    available: raw.available,
  };
}

function parseProduct(value: unknown): DiningProduct[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as Record<string, unknown>;
  const draft = parseDraft(raw);
  if (
    draft === null ||
    typeof raw.slug !== "string" ||
    typeof raw.image !== "string" ||
    !(typeof raw.propertySlug === "string" || raw.propertySlug === null)
  ) {
    return [];
  }
  return [{ ...draft, slug: raw.slug, image: raw.image, propertySlug: raw.propertySlug }];
}

/**
 * Narrow a parsed blob back into an overlay, field by field.
 *
 * This data was last written by a previous deploy of this file, so a shape
 * change has to be discarded here rather than reaching a render as a product
 * with no price.
 */
function parseOverlay(value: unknown): MenuOverlay {
  if (typeof value !== "object" || value === null) return EMPTY;
  const raw = value as Record<string, unknown>;

  const edits: Record<string, ProductDraft> = {};
  if (typeof raw.edits === "object" && raw.edits !== null) {
    for (const [slug, draft] of Object.entries(raw.edits as Record<string, unknown>)) {
      const parsed = parseDraft(draft);
      if (parsed !== null) edits[slug] = parsed;
    }
  }

  return {
    edits,
    added: Array.isArray(raw.added) ? raw.added.flatMap(parseProduct) : [],
    removed: Array.isArray(raw.removed) ? raw.removed.filter((s) => typeof s === "string") : [],
  };
}

/** Every property's overlay, or empty. Server-safe. */
function readAll(): Record<string, MenuOverlay> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, MenuOverlay> = {};
    for (const [slug, overlay] of Object.entries(parsed as Record<string, unknown>)) {
      out[slug] = parseOverlay(overlay);
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(next: Record<string, MenuOverlay>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(MENU_STORE_CHANGE_EVENT));
  } catch {
    /* A browser refusing site data still renders the answer for this render. */
  }
}

function mutate(propertySlug: string, fn: (overlay: MenuOverlay) => MenuOverlay): void {
  const all = readAll();
  writeAll({ ...all, [propertySlug]: fn(all[propertySlug] ?? EMPTY) });
}

export function subscribeMenuStore(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MENU_STORE_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(MENU_STORE_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/* -------------------------------------------------------------------- reads */

/**
 * The menu this property is selling right now: the fixture, plus every change
 * the operator has made to it.
 *
 * PURE with respect to the clock, so a server render and the first client
 * render of the same storage produce identical markup.
 */
export function readMenu(propertySlug: string): DiningProduct[] {
  const overlay = readAll()[propertySlug] ?? EMPTY;
  const removed = new Set(overlay.removed);

  const fromFixture = productsForProperty(propertySlug)
    .filter((product) => !removed.has(product.slug))
    .map((product) => {
      const edit = overlay.edits[product.slug];
      return edit === undefined ? product : { ...product, ...edit };
    });

  const added = overlay.added
    .filter((product) => product.propertySlug === propertySlug && !removed.has(product.slug))
    .map((product) => {
      const edit = overlay.edits[product.slug];
      return edit === undefined ? product : { ...product, ...edit };
    });

  return sortForMenu([...fromFixture, ...added]);
}

/** One product as it now stands, or null once it has been taken off. */
export function readProduct(propertySlug: string, slug: string): DiningProduct | null {
  return readMenu(propertySlug).find((product) => product.slug === slug) ?? null;
}

/**
 * The shipped catalogue, in this screen's order, with no overlay applied.
 *
 * THE SERVER'S ANSWER, and therefore the hook's opening value. Overlay reads
 * touch `localStorage`, which does not exist during a server render, so a
 * component that read one while rendering would produce different markup on the
 * two sides of hydration and React would throw the tree away. It shares
 * `sortForMenu` with `readMenu` so that the overlay landing does not also
 * reshuffle a menu that has no edits on it.
 */
export function menuFromFixture(propertySlug: string): DiningProduct[] {
  return sortForMenu(productsForProperty(propertySlug));
}

/** The sections a menu prints, in a stable order. Re-exported so screens read one API. */
export { groupByCategory };

/**
 * Every category an operator may file a product under.
 *
 * Takes the menu rather than reading it, because the caller already has the
 * subscribed copy and a second read here would be a second answer — and a read
 * during render is the hydration defect `menuFromFixture` exists to avoid.
 *
 * The canonical list, plus anything this property has invented, so a category
 * typed last week is still offered this week rather than silently becoming
 * unreachable.
 */
export function categoryOptions(menu: DiningProduct[]): string[] {
  const extra = menu
    .map((product) => product.category)
    .filter((category) => !DINING_CATEGORY_ORDER.includes(category));
  return [...DINING_CATEGORY_ORDER, ...new Set(extra)];
}

function sortForMenu(products: DiningProduct[]): DiningProduct[] {
  return [...products].sort((a, b) => {
    const byOutlet = a.outletSlug.localeCompare(b.outletSlug);
    if (byOutlet !== 0) return byOutlet;
    const ai = DINING_CATEGORY_ORDER.indexOf(a.category);
    const bi = DINING_CATEGORY_ORDER.indexOf(b.category);
    // An unlisted category sorts LAST rather than first: `indexOf` returns -1,
    // which would otherwise put a brand-new section at the top of the menu.
    const rank = (i: number) => (i === -1 ? Number.MAX_SAFE_INTEGER : i);
    if (rank(ai) !== rank(bi)) return rank(ai) - rank(bi);
    return a.name.localeCompare(b.name);
  });
}

/* ------------------------------------------------------------------- writes */

/**
 * A slug from a name, uniquified against every slug this property has EVER used.
 *
 * Derived rather than minted, so the same dish typed twice on two machines
 * produces the same identifier and nothing here depends on a clock. The counter
 * suffix is what stops a second "Espresso" from silently overwriting the first.
 *
 * "Ever used" rather than "currently on the menu", and that is the fix for a
 * real defect rather than caution. `removed` is a list of slugs, so a product
 * taken off is still ADDRESSED by its slug. Uniquifying against the visible
 * menu let a newly added "Beef brochettes" take `beef-brochettes` back — which
 * dropped that slug out of `removed`, un-removed the fixture row it named, and
 * left the list rendering two products with one key.
 */
export function slugForProduct(propertySlug: string, name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      // Strip the combining marks NFD just split off, so "Mützig" slugs as
      // "mutzig" rather than losing the letter the mark was attached to.
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "product";
  const overlay = readAll()[propertySlug] ?? EMPTY;
  const taken = new Set([
    ...productsForProperty(propertySlug).map((product) => product.slug),
    ...overlay.added.map((product) => product.slug),
  ]);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 200; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-new`;
}

/**
 * Put a product on the menu.
 *
 * The `image` is inherited from the outlet rather than asked for, because there
 * is no photo pipeline in this prototype and an empty stem renders as a broken
 * frame on the guest's card. It is scenery either way — see the fixture header.
 */
export function addProduct(propertySlug: string, draft: ProductDraft): DiningProduct {
  const outlet = outletsForProperty(propertySlug).find((o) => o.slug === draft.outletSlug);
  const product: DiningProduct = {
    ...draft,
    slug: slugForProduct(propertySlug, draft.name),
    propertySlug,
    image: outlet?.image ?? "",
  };
  // `removed` is not touched: `slugForProduct` guarantees the new slug is not
  // one, so filtering it here would only ever un-remove something by accident.
  mutate(propertySlug, (overlay) => ({ ...overlay, added: [...overlay.added, product] }));
  return product;
}

/** Change what a product is called, costs, says, or whether it is on today. */
export function updateProduct(
  propertySlug: string,
  slug: string,
  draft: ProductDraft,
): DiningProduct | null {
  if (readProduct(propertySlug, slug) === null) return null;
  mutate(propertySlug, (overlay) => ({
    ...overlay,
    edits: { ...overlay.edits, [slug]: draft },
    // An added product keeps its edit in `edits` rather than being rewritten in
    // place, so one code path applies a change whatever the product's origin.
  }));
  return readProduct(propertySlug, slug);
}

/** Turn a product on or off without opening the editor. */
export function setProductAvailable(
  propertySlug: string,
  slug: string,
  available: boolean,
): DiningProduct | null {
  const current = readProduct(propertySlug, slug);
  if (current === null) return null;
  return updateProduct(propertySlug, slug, {
    name: current.name,
    outletSlug: current.outletSlug,
    category: current.category,
    priceRwf: current.priceRwf,
    description: current.description,
    available,
  });
}

/**
 * Take a product off the menu for good.
 *
 * Distinct from turning it off, and the wording on the screen has to keep them
 * apart: "off today" is a kitchen that ran out, and removing is a dish the
 * property has stopped selling. Orders already placed keep their own snapshot
 * of the name and the price, so removing one never rewrites a ticket.
 */
export function removeProduct(propertySlug: string, slug: string): void {
  mutate(propertySlug, (overlay) => ({
    edits: Object.fromEntries(Object.entries(overlay.edits).filter(([s]) => s !== slug)),
    added: overlay.added.filter((product) => product.slug !== slug),
    removed: overlay.removed.includes(slug) ? overlay.removed : [...overlay.removed, slug],
  }));
}

/**
 * Put a shipped product back on the menu after it was taken off.
 *
 * Only a shipped one can come back, and that asymmetry is honest rather than
 * lazy: a product the operator invented is deleted outright — its row is gone
 * from `added` and there is nothing left to restore — while a fixture row is
 * only ever hidden behind a slug in `removed`. The screen lists exactly what
 * this function can bring back and offers the action on nothing else.
 */
export function restoreProduct(propertySlug: string, slug: string): void {
  mutate(propertySlug, (overlay) => ({
    ...overlay,
    removed: overlay.removed.filter((s) => s !== slug),
  }));
}

/** Put this property's menu back to the shipped catalogue. The demo reset. */
export function resetMenu(propertySlug: string): void {
  const all = readAll();
  const next = { ...all };
  delete next[propertySlug];
  writeAll(next);
}
