/**
 * EVERY INVENTED BAR AND RESTAURANT NUMBER, IN ONE FILE.
 *
 * Read this before you trust anything it returns. There is no Dining module,
 * no Menu module and no Inventory module behind any of it. Nothing here was
 * read from a menu, a price list or a licence. The outlet names, the opening
 * hours, the dishes and every franc beside them are FABRICATED, written to make
 * an in-room ordering demo legible to a Rwandan audience. They must not be
 * quoted to a guest, screenshotted for a pitch, or read as a product claim.
 *
 * The one thing that is NOT invented is `propertySlug`. Every non-null value
 * there is the slug of a fictional demo hotel already carried by
 * `data/properties.ts`, because the whole point of this fixture is the rule the
 * product owes: a listing that works under a dedicated hotel is available to
 * that hotel's checked-in guests and to nobody else. A fabricated property slug
 * would make that rule untestable, which is the only reason it points at a catalogue property.
 *
 * That pairing is also the file's sharpest edge, so it is stated plainly: these
 * outlets are attached to named catalogue hotels. Those hotels have been
 * fictional since 2026-09-14 (they were real businesses before), and the file
 * still sits under a demo notice, for a presentation, never in front of a guest. `propertySlug: null` means an independent outlet that belongs to
 * no hotel at all; it is the control case that proves the scoping helpers
 * actually filter.
 *
 * PHOTOGRAPHY. No dish has been photographed. Rather than point at files that
 * were never exported — the defect that put `/assets/rwanda-*.jpg` in the 404
 * list once already — every `image` is the stem of a scenery frame that is on
 * disk today. A plate of brochettes therefore shows a hillside, which reads as
 * placeholder art rather than as a photograph of the dish, and that is the
 * intended and honest failure mode.
 *
 * WHEN A REAL MENU MODULE LANDS, DELETE THIS FILE. `apps/app/src/pms/data/dining.ts`
 * is its operator-side mirror and must be deleted, or changed, in the same pass:
 * the two are hand-kept copies because the PMS is a separate Next application
 * that cannot import from `apps/web`.
 *
 * Nothing below is derived from `Math.random` or `Date.now`. Every field is a
 * literal, so a product renders identically on the server and after hydration.
 */

/**
 * A place inside (or beside) a property that sells food and drink.
 *
 * `kind` is three values rather than free text because the guest surfaces group
 * by it and a fourth spelling of "restaurant" is how a group header silently
 * splits in two.
 */
export interface DiningOutlet {
  slug: string;
  name: string;
  kind: "bar" | "restaurant" | "cafe";
  /** The hotel that operates it, or null for an independent outlet. */
  propertySlug: string | null;
  blurb: string;
  /** An `/assets/<stem>` image stem. See the photography note above. */
  image: string;
  hours: string;
}

/**
 * One sellable line on a menu.
 *
 * `propertySlug` is carried on the product as well as on its outlet, and the
 * duplication is deliberate. Every guest-side query starts from "which property
 * am I checked into", and resolving that through the outlet on each of a few
 * hundred products is both slower and one join away from a bug where a product
 * outlives the outlet it named. `assertCatalogueIsConsistent` below is what
 * stops the copy drifting.
 */
export interface DiningProduct {
  slug: string;
  name: string;
  outletSlug: string;
  propertySlug: string | null;
  category: string;
  priceRwf: number;
  description: string;
  /** An `/assets/<stem>` image stem. See the photography note above. */
  image: string;
  /**
   * Whether the kitchen is currently selling it.
   *
   * Two fixtures are false on purpose. A menu where every single line is
   * available is the one shape that never exercises the "sold out" branch, and
   * that branch is the one an operator uses most.
   */
  available: boolean;
}

/* ------------------------------------------------------------------ outlets */

export const DINING_OUTLETS: DiningOutlet[] = [
  {
    slug: "umuganura-grill",
    name: "Umuganura Grill",
    kind: "restaurant",
    propertySlug: "lanternhouse-hotel-kiyovu",
    blurb:
      "Charcoal grill and a short Rwandan menu, served in the garden until the light goes. Brochettes are turned to order, so allow twenty minutes at dinner.",
    image: "stay-07",
    hours: "12:00 – 23:00, daily",
  },
  {
    slug: "kiyovu-terrace-bar",
    name: "Kiyovu Terrace Bar",
    kind: "bar",
    propertySlug: "lanternhouse-hotel-kiyovu",
    blurb:
      "The long terrace above Kiyovu. Cold beer, a short cocktail list built on Rwandan gin, and the city coming on below you after seven.",
    image: "kigali-night-panorama-02",
    hours: "16:00 – 01:00, daily",
  },
  {
    slug: "poolside-cafe-kiyovu",
    name: "Poolside Café",
    kind: "cafe",
    propertySlug: "hotel-des-sept-sentiers",
    blurb:
      "All-day coffee, tea and light plates by the water. The quiet place to work between meetings, and the only outlet still serving between lunch and dinner.",
    image: "mille-collines-02",
    hours: "07:00 – 19:00, daily",
  },
  {
    slug: "convention-brasserie",
    name: "Convention Brasserie",
    kind: "restaurant",
    propertySlug: "amberhill-convention-hotel",
    blurb:
      "Built for a full conference floor: a hot buffet at midday, an à la carte card in the evening, and a kitchen that keeps serving while a session overruns.",
    image: "kigali-convention-centre-02",
    hours: "06:30 – 10:30, 12:00 – 15:00, 18:30 – 22:30",
  },
  {
    slug: "kivu-shore-fish-house",
    name: "Kivu Shore Fish House",
    kind: "restaurant",
    propertySlug: "sunbird-bay-hotel",
    blurb:
      "Tilapia and sambaza from the boats that land at Gisenyi in the morning, grilled over charcoal a few metres from the water.",
    image: "lake-kivu-02",
    hours: "12:00 – 22:00, daily",
  },
  {
    slug: "ubumwe-sky-bar",
    name: "Ubumwe Sky Bar",
    kind: "bar",
    propertySlug: "cobalt-tower-hotel",
    blurb:
      "Rooftop bar over Nyarugenge with the whole of central Kigali in front of it. Bar snacks until close, and the kitchen sends anything hot up from the fifth floor.",
    image: "kigali-skyline-01",
    hours: "17:00 – 00:00, Tuesday to Sunday",
  },
  {
    /**
     * The independent outlet, and the reason it exists.
     *
     * Every scoping helper below filters on `propertySlug`. With nothing but
     * hotel outlets in the array, a filter that simply returned everything
     * would pass every test written against it. This roaster belongs to no
     * hotel, so `productsForProperty` is wrong the moment it leaks.
     */
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

/* ----------------------------------------------------------------- products */

/**
 * The canonical order menu sections print in.
 *
 * A menu that sorts its sections alphabetically opens on Beers and closes on
 * Starters, which is nobody's idea of a menu. Anything not named here sorts
 * last, in the order it was written.
 */
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

export const DINING_PRODUCTS: DiningProduct[] = [
  // ---------------------------------------------------- Umuganura Grill
  {
    slug: "beef-brochettes",
    name: "Beef brochettes",
    outletSlug: "umuganura-grill",
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
    category: "Main courses",
    priceRwf: 8000,
    description:
      "Green plantain simmered with beef and groundnut sauce until it falls apart. The kitchen's own recipe, and the one thing on this card that reheats badly, so it goes up the moment it is ready.",
    image: "stay-07",
    available: true,
  },
  {
    slug: "ibihaza-pumpkin-soup",
    name: "Ibihaza soup",
    outletSlug: "umuganura-grill",
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
    category: "Main courses",
    priceRwf: 8500,
    description:
      "Aubergine, plantain, sweet potato and peppers off the same grill, with a groundnut dressing. No meat, no dairy.",
    image: "rwanda-tea-02",
    available: true,
  },

  // ------------------------------------------------- Kiyovu Terrace Bar
  {
    slug: "primus-lager-500",
    name: "Primus lager, 500 ml",
    outletSlug: "kiyovu-terrace-bar",
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
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
    propertySlug: "lanternhouse-hotel-kiyovu",
    category: "Soft drinks",
    priceRwf: 1800,
    description: "One litre carton, poured over ice.",
    image: "kigali-night-panorama-02",
    available: true,
  },

  // -------------------------------------------------- Poolside Café
  {
    slug: "rwandan-single-origin-coffee",
    name: "Rwandan single-origin coffee",
    outletSlug: "poolside-cafe-kiyovu",
    propertySlug: "hotel-des-sept-sentiers",
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
    propertySlug: "hotel-des-sept-sentiers",
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
    propertySlug: "hotel-des-sept-sentiers",
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
    propertySlug: "hotel-des-sept-sentiers",
    category: "Desserts",
    priceRwf: 3000,
    description: "Six, fried to order, dusted with sugar. Made in batches, so there can be a wait.",
    image: "mille-collines-02",
    available: true,
  },

  // ------------------------------------------- Convention Brasserie
  {
    slug: "conference-buffet-plate",
    name: "Conference buffet plate",
    outletSlug: "convention-brasserie",
    propertySlug: "amberhill-convention-hotel",
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
    propertySlug: "amberhill-convention-hotel",
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
    propertySlug: "amberhill-convention-hotel",
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
    propertySlug: "amberhill-convention-hotel",
    category: "Light plates",
    priceRwf: 11000,
    description:
      "Eggs any way, sausage, sautéed plantain, fruit, and coffee or tea. Served until half past ten only.",
    image: "kigali-convention-centre-02",
    available: false,
  },

  // ------------------------------------------ Kivu Shore Fish House
  {
    slug: "whole-grilled-tilapia",
    name: "Whole grilled tilapia",
    outletSlug: "kivu-shore-fish-house",
    propertySlug: "sunbird-bay-hotel",
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
    propertySlug: "sunbird-bay-hotel",
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
    propertySlug: "sunbird-bay-hotel",
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
    propertySlug: "sunbird-bay-hotel",
    category: "Soft drinks",
    priceRwf: 1500,
    description: "Cultured milk, served cold in a clay cup. Not sweetened.",
    image: "karongi-02",
    available: true,
  },

  // -------------------------------------------------- Ubumwe Sky Bar
  {
    slug: "turbo-king-stout-500",
    name: "Turbo King stout, 500 ml",
    outletSlug: "ubumwe-sky-bar",
    propertySlug: "cobalt-tower-hotel",
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
    propertySlug: "cobalt-tower-hotel",
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
    propertySlug: "cobalt-tower-hotel",
    category: "Starters",
    priceRwf: 8500,
    description:
      "Eight wings, glazed with honey and akabanga. The chilli oil is on the table too, and the kitchen assumes you know what it does.",
    image: "kigali-skyline-01",
    available: true,
  },

  // ------------------------------------- Nyamirambo Coffee Roasters
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

/* ------------------------------------------------------------------ indexes */

const OUTLET_BY_SLUG = new Map(DINING_OUTLETS.map((outlet) => [outlet.slug, outlet]));
const PRODUCT_BY_SLUG = new Map(DINING_PRODUCTS.map((product) => [product.slug, product]));

/** One outlet, or undefined. Callers render a not-found state; nothing throws. */
export function diningOutlet(slug: string): DiningOutlet | undefined {
  return OUTLET_BY_SLUG.get(slug);
}

/** One product, or undefined. Used to rebuild a cart line from a stored slug. */
export function diningProduct(slug: string): DiningProduct | undefined {
  return PRODUCT_BY_SLUG.get(slug);
}

/**
 * The outlets a given hotel operates.
 *
 * Takes `string | null` rather than `string` because the caller usually holds
 * "the property this guest is checked into", which is null before the stay is
 * read out of storage. A null property has no outlets — not every outlet.
 */
export function outletsForProperty(propertySlug: string | null): DiningOutlet[] {
  if (propertySlug === null) return [];
  return DINING_OUTLETS.filter((outlet) => outlet.propertySlug === propertySlug);
}

/**
 * Everything a guest of `propertySlug` may order, sold by that hotel.
 *
 * This function IS contract C19 — "a product tied to a hotel shows to that
 * hotel's guests" — so it filters on the product's own `propertySlug` and never
 * widens to "and anything independent nearby". An independent outlet is
 * reachable from the marketplace; it is not room service.
 */
export function productsForProperty(propertySlug: string | null): DiningProduct[] {
  if (propertySlug === null) return [];
  return sortByCategory(DINING_PRODUCTS.filter((product) => product.propertySlug === propertySlug));
}

/** Every product on one outlet's card, in menu order. */
export function productsForOutlet(outletSlug: string): DiningProduct[] {
  return sortByCategory(DINING_PRODUCTS.filter((product) => product.outletSlug === outletSlug));
}

/** The independent outlets — those belonging to no hotel. */
export function independentOutlets(): DiningOutlet[] {
  return DINING_OUTLETS.filter((outlet) => outlet.propertySlug === null);
}

/** True when a property has anything to sell. Drives whether a tab appears. */
export function propertyHasDining(propertySlug: string | null): boolean {
  return outletsForProperty(propertySlug).length > 0;
}

/**
 * The distinct categories present in a set of products, in menu order.
 *
 * Derived from the products passed in rather than from `DINING_CATEGORY_ORDER`,
 * so a filtered menu never prints a section header with nothing under it.
 */
export function diningCategories(products: DiningProduct[]): string[] {
  const seen: string[] = [];
  for (const product of products) {
    if (!seen.includes(product.category)) seen.push(product.category);
  }
  return seen.sort(byCategoryOrder);
}

/** The categories on one outlet's card. */
export function categoriesForOutlet(outletSlug: string): string[] {
  return diningCategories(productsForOutlet(outletSlug));
}

/**
 * Products grouped into the sections a menu prints.
 *
 * Returned as an array of pairs rather than a `Record`, because object key
 * order is not something to rely on for a rendering order that matters.
 */
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

function byCategoryOrder(a: string, b: string): number {
  const ai = DINING_CATEGORY_ORDER.indexOf(a);
  const bi = DINING_CATEGORY_ORDER.indexOf(b);
  // An unlisted category sorts after every listed one rather than before it:
  // `indexOf` returns -1, which would otherwise put a brand-new section at the
  // very top of the menu the first time somebody adds one.
  return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
}

function sortByCategory(products: DiningProduct[]): DiningProduct[] {
  return [...products].sort((a, b) => byCategoryOrder(a.category, b.category));
}

/**
 * The consistency check the duplicated `propertySlug` on a product needs.
 *
 * Exported and called by nothing in the render path on purpose: it is for a
 * check script or a devtools console, not for a page. It exists because the
 * copy of `propertySlug` on each product is a denormalisation, and a
 * denormalisation with no check is a drift waiting to be found by a guest
 * ordering a dish from a hotel they are not staying in.
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
