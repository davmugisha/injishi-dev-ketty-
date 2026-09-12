/**
 * THE OPERATOR-SIDE MIRROR OF `apps/web/src/data/dining.ts`.
 *
 * IT IS A HAND-KEPT COPY AND THE TWO MUST BE CHANGED TOGETHER. Add a product on
 * one side without the other and the guest orders a dish the PMS menu screen
 * cannot show, or the operator withdraws a dish the guest can still order — the
 * single defect contract C20 ("the same catalogue drives Menu and Orders in the
 * PMS") exists to prevent. Every field name here is deliberately identical to
 * the guest side, `priceRwf` included, so a divergence is a compile error at the
 * first consumer rather than a wrong number on a ticket.
 *
 * WHY A COPY AND NOT AN IMPORT. `apps/app` is a separate Next application with
 * its own `tsconfig` and its own `@/*` root; it cannot resolve a path into
 * `apps/web`, and neither may reach across without becoming a shared package.
 * Promoting this catalogue into `@injishi/*` would force `packages:build` into
 * every consumer of it, which is out of scope for a presentation prototype. So:
 * two files, one comment, and this warning.
 *
 * FABRICATED DATA. Read the header of the guest-side file before trusting
 * anything below. No outlet name, opening time, dish or price here was read
 * from a menu or a licence; all of it is invented to make an in-room ordering
 * demo legible. It must not be quoted to a guest or read as a product claim.
 * The one thing that is real is `propertySlug` — every non-null value is a
 * property that exists in the marketplace catalogue, because the rule being
 * demonstrated is that a hotel's products belong to that hotel's guests.
 *
 * `image` values are `/assets/<stem>` stems that exist on the guest app's
 * public tree. No dish has been photographed; they are scenery frames standing
 * in, which is why a plate of brochettes shows a hillside.
 */

import type { PropertyKey } from "./types";

export interface DiningOutlet {
  slug: string;
  name: string;
  kind: "bar" | "restaurant" | "cafe";
  /** The hotel that operates it, or null for an independent outlet. */
  propertySlug: string | null;
  blurb: string;
  image: string;
  hours: string;
}

export interface DiningProduct {
  slug: string;
  name: string;
  outletSlug: string;
  propertySlug: string | null;
  category: string;
  priceRwf: number;
  description: string;
  image: string;
  /** Whether the kitchen is currently selling it. The PMS toggles this. */
  available: boolean;
}

/**
 * Which marketplace property each PMS demo workspace is standing in for.
 *
 * The PMS demo dataset carries two invented properties — Kivu Crest Hotel and
 * Umucyo Guesthouse — and the marketplace carries thirty real ones. Neither is
 * the other. This map is a DEMO BRIDGE and nothing more: it gives the operator
 * screens a menu to manage by pointing each workspace at one marketplace
 * catalogue. It is not a claim that Kivu Crest Hotel is the Kigali Serena, and
 * it disappears the day a real property id joins the two sides.
 */
export const DEMO_PMS_PROPERTY_SLUG: Record<PropertyKey, string> = {
  hotel: "kigali-serena-hotel",
  guesthouse: "lake-kivu-serena-hotel",
};

/** The canonical order menu sections print in. Mirrors the guest side exactly. */
export const DINING_CATEGORY_ORDER: string[] = [
  "Starters",
  "From the grill",
  "From the lake",
  "Main courses",
  "Light plates",
  "Sides",
  "Desserts",
  "Coffee & tea",
  "Soft drinks",
  "Beers",
  "Wine & cocktails",
];

export const DINING_OUTLETS: DiningOutlet[] = [
  {
    slug: "umuganura-grill",
    name: "Umuganura Grill",
    kind: "restaurant",
    propertySlug: "kigali-serena-hotel",
    blurb:
      "Charcoal grill and a short Rwandan menu, served in the garden until the light goes. Brochettes are turned to order, so allow twenty minutes at dinner.",
    image: "stay-07",
    hours: "12:00 – 23:00, daily",
  },
  {
    slug: "kiyovu-terrace-bar",
    name: "Kiyovu Terrace Bar",
    kind: "bar",
    propertySlug: "kigali-serena-hotel",
    blurb:
      "The long terrace above Kiyovu. Cold beer, a short cocktail list built on Rwandan gin, and the city coming on below you after seven.",
    image: "kigali-night-panorama-02",
    hours: "16:00 – 01:00, daily",
  },
  {
    slug: "poolside-cafe-kiyovu",
    name: "Poolside Café",
    kind: "cafe",
    propertySlug: "hotel-des-mille-collines",
    blurb:
      "All-day coffee, tea and light plates by the water. The quiet place to work between meetings, and the only outlet still serving between lunch and dinner.",
    image: "mille-collines-02",
    hours: "07:00 – 19:00, daily",
  },
  {
    slug: "convention-brasserie",
    name: "Convention Brasserie",
    kind: "restaurant",
    propertySlug: "radisson-blu-hotel-and-convention-centre-kigali",
    blurb:
      "Built for a full conference floor: a hot buffet at midday, an à la carte card in the evening, and a kitchen that keeps serving while a session overruns.",
    image: "kigali-convention-centre-02",
    hours: "06:30 – 10:30, 12:00 – 15:00, 18:30 – 22:30",
  },
  {
    slug: "kivu-shore-fish-house",
    name: "Kivu Shore Fish House",
    kind: "restaurant",
    propertySlug: "lake-kivu-serena-hotel",
    blurb:
      "Tilapia and sambaza from the boats that land at Gisenyi in the morning, grilled over charcoal a few metres from the water.",
    image: "lake-kivu-02",
    hours: "12:00 – 22:00, daily",
  },
  {
    slug: "ubumwe-sky-bar",
    name: "Ubumwe Sky Bar",
    kind: "bar",
    propertySlug: "ubumwe-grande-hotel",
    blurb:
      "Rooftop bar over Nyarugenge with the whole of central Kigali in front of it. Bar snacks until close, and the kitchen sends anything hot up from the fifth floor.",
    image: "kigali-skyline-01",
    hours: "17:00 – 00:00, Tuesday to Sunday",
  },
  {
    /** The independent outlet: belongs to no hotel, so it proves the filters filter. */
    slug: "nyamirambo-coffee-roasters",
    name: "Nyamirambo Coffee Roasters",
    kind: "cafe",
    propertySlug: null,
    blurb:
      "An independent roastery on the Nyamirambo road, roasting lots from Huye and Nyamasheke. Not attached to any hotel — it sells to whoever walks in.",
    image: "kigali-city-street-01",
    hours: "06:30 – 18:00, Monday to Saturday",
  },
];

export const DINING_PRODUCTS: DiningProduct[] = [
  {
    slug: "beef-brochettes",
    name: "Beef brochettes",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "From the grill",
    priceRwf: 9500,
    description:
      "Four skewers of beef over charcoal, with grilled plantain and a dish of akabanga on the side.",
    image: "stay-07",
    available: true,
  },
  {
    slug: "goat-brochettes",
    name: "Goat brochettes",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "From the grill",
    priceRwf: 10500,
    description:
      "The Kigali standard: goat cut small, salted, and turned over the coals until the edges char. Served with ibirayi.",
    image: "stay-07",
    available: true,
  },
  {
    slug: "isombe-na-ubugali",
    name: "Isombe na ubugali",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "Main courses",
    priceRwf: 7500,
    description:
      "Cassava leaves pounded with groundnut and aubergine, cooked down slowly, with a hot mound of ubugali.",
    image: "rwanda-tea-02",
    available: true,
  },
  {
    slug: "agatogo-plantain-stew",
    name: "Agatogo",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "Main courses",
    priceRwf: 8000,
    description:
      "Green plantain simmered with beef and groundnut sauce until it falls apart. The one thing on this card that reheats badly, so it goes up the moment it is ready.",
    image: "stay-07",
    available: true,
  },
  {
    slug: "ibihaza-pumpkin-soup",
    name: "Ibihaza soup",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "Starters",
    priceRwf: 4500,
    description: "Pumpkin and sweetcorn soup, finished with ginger, with bread.",
    image: "rwanda-tea-01",
    available: true,
  },
  {
    slug: "grilled-vegetable-plate",
    name: "Grilled vegetable plate",
    outletSlug: "umuganura-grill",
    propertySlug: "kigali-serena-hotel",
    category: "Main courses",
    priceRwf: 8500,
    description:
      "Aubergine, plantain, sweet potato and peppers off the same grill, with a groundnut dressing. No meat, no dairy.",
    image: "rwanda-tea-02",
    available: true,
  },
  {
    slug: "primus-lager-500",
    name: "Primus lager, 500 ml",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "kigali-serena-hotel",
    category: "Beers",
    priceRwf: 2000,
    description: "The big green bottle, served cold. Rwanda's oldest lager.",
    image: "kigali-night-panorama-02",
    available: true,
  },
  {
    slug: "mutzig-lager-500",
    name: "Mützig lager, 500 ml",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "kigali-serena-hotel",
    category: "Beers",
    priceRwf: 2200,
    description: "A shade stronger than Primus and a shade drier. Cold from the crate.",
    image: "kigali-night-panorama-02",
    available: true,
  },
  {
    slug: "skol-lager-330",
    name: "Skol lager, 330 ml",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "kigali-serena-hotel",
    category: "Beers",
    priceRwf: 1800,
    description: "The small bottle, for when one large one is too much.",
    image: "kigali-night-panorama-02",
    available: true,
  },
  {
    slug: "virunga-gin-and-tonic",
    name: "Virunga gin & tonic",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "kigali-serena-hotel",
    category: "Wine & cocktails",
    priceRwf: 7500,
    description:
      "Rwandan gin, tonic, a wedge of lime and a great deal of ice. Made double by default; say so if you would rather it were not.",
    image: "kigali-night-panorama-02",
    available: true,
  },
  {
    slug: "inyange-passion-juice",
    name: "Inyange passion fruit juice",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "kigali-serena-hotel",
    category: "Soft drinks",
    priceRwf: 1800,
    description: "One litre carton, poured over ice.",
    image: "kigali-night-panorama-02",
    available: true,
  },
  {
    slug: "rwandan-single-origin-coffee",
    name: "Rwandan single-origin coffee",
    outletSlug: "poolside-cafe-kiyovu",
    propertySlug: "hotel-des-mille-collines",
    category: "Coffee & tea",
    priceRwf: 2500,
    description:
      "A washed Bourbon lot from the Southern Province, pulled as an espresso or served long. Ask which washing station it came from; the counter knows.",
    image: "rwanda-tea-01",
    available: true,
  },
  {
    slug: "icyayi-cyamata-milk-tea",
    name: "Icyayi cy'amata",
    outletSlug: "poolside-cafe-kiyovu",
    propertySlug: "hotel-des-mille-collines",
    category: "Coffee & tea",
    priceRwf: 2000,
    description: "Black tea brewed in milk with ginger, sweetened at the pot.",
    image: "rwanda-tea-01",
    available: true,
  },
  {
    slug: "club-sandwich-and-chips",
    name: "Club sandwich & chips",
    outletSlug: "poolside-cafe-kiyovu",
    propertySlug: "hotel-des-mille-collines",
    category: "Light plates",
    priceRwf: 9000,
    description: "Chicken, bacon, egg and tomato on toasted bread, with hand-cut chips.",
    image: "mille-collines-02",
    available: true,
  },
  {
    slug: "mandazi-basket",
    name: "Basket of mandazi",
    outletSlug: "poolside-cafe-kiyovu",
    propertySlug: "hotel-des-mille-collines",
    category: "Desserts",
    priceRwf: 3000,
    description:
      "Six, fried to order, dusted with sugar. Made in batches, so there can be a wait.",
    image: "mille-collines-02",
    available: true,
  },
  {
    slug: "conference-buffet-plate",
    name: "Conference buffet plate",
    outletSlug: "convention-brasserie",
    propertySlug: "radisson-blu-hotel-and-convention-centre-kigali",
    category: "Main courses",
    priceRwf: 18000,
    description:
      "One pass at the midday buffet: two hot mains, rice or ubugali, salads and a dessert. Available to room accounts as a tray to the room.",
    image: "kigali-convention-centre-02",
    available: true,
  },
  {
    slug: "beef-fillet-and-potatoes",
    name: "Beef fillet & potatoes",
    outletSlug: "convention-brasserie",
    propertySlug: "radisson-blu-hotel-and-convention-centre-kigali",
    category: "Main courses",
    priceRwf: 17500,
    description: "Fillet cooked to order, gratin potatoes, a pepper sauce served alongside.",
    image: "kigali-convention-centre-02",
    available: true,
  },
  {
    slug: "chicken-peri-peri-half",
    name: "Half chicken peri-peri",
    outletSlug: "convention-brasserie",
    propertySlug: "radisson-blu-hotel-and-convention-centre-kigali",
    category: "From the grill",
    priceRwf: 13500,
    description: "Marinated overnight, grilled hard, with chips and a green salad.",
    image: "kigali-convention-centre-02",
    available: true,
  },
  {
    slug: "kigali-breakfast-plate",
    name: "Kigali breakfast plate",
    outletSlug: "convention-brasserie",
    propertySlug: "radisson-blu-hotel-and-convention-centre-kigali",
    category: "Light plates",
    priceRwf: 11000,
    description:
      "Eggs any way, sausage, sautéed plantain, fruit, and coffee or tea. Served until half past ten only.",
    image: "kigali-convention-centre-02",
    available: false,
  },
  {
    slug: "whole-grilled-tilapia",
    name: "Whole grilled tilapia",
    outletSlug: "kivu-shore-fish-house",
    propertySlug: "lake-kivu-serena-hotel",
    category: "From the lake",
    priceRwf: 14000,
    description:
      "A whole tilapia from Lake Kivu, scored, salted and grilled over charcoal, with ibirayi and a tomato salad. Landed the same morning at Gisenyi.",
    image: "lake-kivu-02",
    available: true,
  },
  {
    slug: "sambaza-fry",
    name: "Crisp-fried sambaza",
    outletSlug: "kivu-shore-fish-house",
    propertySlug: "lake-kivu-serena-hotel",
    category: "From the lake",
    priceRwf: 6500,
    description:
      "The small lake sardine, floured and fried whole, eaten with the fingers and a squeeze of lime. Depends entirely on what the night boats brought in.",
    image: "lake-kivu-03",
    available: false,
  },
  {
    slug: "tilapia-fillet-in-tomato",
    name: "Tilapia fillet in tomato",
    outletSlug: "kivu-shore-fish-house",
    propertySlug: "lake-kivu-serena-hotel",
    category: "From the lake",
    priceRwf: 12500,
    description: "Filleted and braised in tomato, onion and green pepper, with rice.",
    image: "karongi-01",
    available: true,
  },
  {
    slug: "ikivuguto-fresh",
    name: "Ikivuguto",
    outletSlug: "kivu-shore-fish-house",
    propertySlug: "lake-kivu-serena-hotel",
    category: "Soft drinks",
    priceRwf: 1500,
    description: "Cultured milk, served cold in a clay cup. Not sweetened.",
    image: "karongi-02",
    available: true,
  },
  {
    slug: "turbo-king-stout-500",
    name: "Turbo King stout, 500 ml",
    outletSlug: "ubumwe-sky-bar",
    propertySlug: "ubumwe-grande-hotel",
    category: "Beers",
    priceRwf: 2500,
    description: "Dark, sweet and heavier than it looks. One is usually enough.",
    image: "kigali-skyline-01",
    available: true,
  },
  {
    slug: "house-red-wine-glass",
    name: "House red, by the glass",
    outletSlug: "ubumwe-sky-bar",
    propertySlug: "ubumwe-grande-hotel",
    category: "Wine & cocktails",
    priceRwf: 6000,
    description: "A South African blend, poured at 175 ml. The bottle is on the card as well.",
    image: "kigali-skyline-01",
    available: true,
  },
  {
    slug: "akabanga-chicken-wings",
    name: "Akabanga chicken wings",
    outletSlug: "ubumwe-sky-bar",
    propertySlug: "ubumwe-grande-hotel",
    category: "Starters",
    priceRwf: 8500,
    description:
      "Eight wings, glazed with honey and akabanga. The chilli oil is on the table too, and the kitchen assumes you know what it does.",
    image: "kigali-skyline-01",
    available: true,
  },
  {
    slug: "nyamirambo-espresso",
    name: "Espresso",
    outletSlug: "nyamirambo-coffee-roasters",
    propertySlug: null,
    category: "Coffee & tea",
    priceRwf: 2200,
    description: "A double, from whichever lot is on the grinder that week.",
    image: "kigali-city-street-01",
    available: true,
  },
  {
    slug: "honey-process-pour-over",
    name: "Honey-process pour-over",
    outletSlug: "nyamirambo-coffee-roasters",
    propertySlug: null,
    category: "Coffee & tea",
    priceRwf: 3500,
    description:
      "A honey-process Nyamasheke lot, brewed to order in about four minutes. Sold by the cup and by the 250 g bag.",
    image: "rwanda-tea-01",
    available: true,
  },
  {
    slug: "chapati-and-eggs",
    name: "Chapati & eggs",
    outletSlug: "nyamirambo-coffee-roasters",
    propertySlug: null,
    category: "Light plates",
    priceRwf: 3800,
    description: "Two chapati off the pan, two fried eggs, tomato and onion.",
    image: "kigali-city-street-01",
    available: true,
  },
];

const OUTLET_BY_SLUG = new Map(DINING_OUTLETS.map((outlet) => [outlet.slug, outlet]));
const PRODUCT_BY_SLUG = new Map(DINING_PRODUCTS.map((product) => [product.slug, product]));

export function diningOutlet(slug: string): DiningOutlet | undefined {
  return OUTLET_BY_SLUG.get(slug);
}

export function diningProduct(slug: string): DiningProduct | undefined {
  return PRODUCT_BY_SLUG.get(slug);
}

/** The outlets one property operates. A null property has none, not all of them. */
export function outletsForProperty(propertySlug: string | null): DiningOutlet[] {
  if (propertySlug === null) return [];
  return DINING_OUTLETS.filter((outlet) => outlet.propertySlug === propertySlug);
}

/** Everything one property sells — the operator's whole menu, across its outlets. */
export function productsForProperty(propertySlug: string | null): DiningProduct[] {
  if (propertySlug === null) return [];
  return sortByCategory(DINING_PRODUCTS.filter((p) => p.propertySlug === propertySlug));
}

export function productsForOutlet(outletSlug: string): DiningProduct[] {
  return sortByCategory(DINING_PRODUCTS.filter((p) => p.outletSlug === outletSlug));
}

/** The menu a PMS workspace manages, via the demo bridge above. */
export function outletsForWorkspace(property: PropertyKey): DiningOutlet[] {
  return outletsForProperty(DEMO_PMS_PROPERTY_SLUG[property]);
}

/** The products a PMS workspace manages, via the demo bridge above. */
export function productsForWorkspace(property: PropertyKey): DiningProduct[] {
  return productsForProperty(DEMO_PMS_PROPERTY_SLUG[property]);
}

/** The distinct categories present in a set of products, in menu order. */
export function diningCategories(products: DiningProduct[]): string[] {
  const seen: string[] = [];
  for (const product of products) {
    if (!seen.includes(product.category)) seen.push(product.category);
  }
  return seen.sort(byCategoryOrder);
}

export function categoriesForOutlet(outletSlug: string): string[] {
  return diningCategories(productsForOutlet(outletSlug));
}

/** Products grouped into the sections a menu prints, in a stable order. */
export function groupByCategory(
  products: DiningProduct[],
): { category: string; products: DiningProduct[] }[] {
  return diningCategories(products).map((category) => ({
    category,
    products: products.filter((product) => product.category === category),
  }));
}

/** Only what the kitchen is actually selling. */
export function availableOnly(products: DiningProduct[]): DiningProduct[] {
  return products.filter((product) => product.available);
}

/** What the operator sees as needing attention: the withdrawn lines. */
export function unavailableOnly(products: DiningProduct[]): DiningProduct[] {
  return products.filter((product) => !product.available);
}

function byCategoryOrder(a: string, b: string): number {
  const ai = DINING_CATEGORY_ORDER.indexOf(a);
  const bi = DINING_CATEGORY_ORDER.indexOf(b);
  // An unlisted category sorts last rather than first: `indexOf` returns -1,
  // which would otherwise put a brand-new section at the top of the menu.
  return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
}

function sortByCategory(products: DiningProduct[]): DiningProduct[] {
  return [...products].sort((a, b) => byCategoryOrder(a.category, b.category));
}

/**
 * The drift check between this file and its guest-side twin.
 *
 * Compares an outlet's property against the copy carried on each product, which
 * is the denormalisation both files share. It cannot see the other file — that
 * is what makes the header's warning the real control — but it does catch the
 * half-applied edit, where a product was moved to another outlet here and its
 * `propertySlug` was left behind.
 */
export function diningCatalogueProblems(): string[] {
  const problems: string[] = [];
  for (const product of DINING_PRODUCTS) {
    const outlet = OUTLET_BY_SLUG.get(product.outletSlug);
    if (outlet === undefined) {
      problems.push(`${product.slug}: names outlet ${product.outletSlug}, which does not exist`);
      continue;
    }
    if (outlet.propertySlug !== product.propertySlug) {
      problems.push(
        `${product.slug}: sits under ${outlet.slug} (${outlet.propertySlug ?? "independent"}) ` +
          `but claims ${product.propertySlug ?? "independent"}`,
      );
    }
  }
  return problems;
}
