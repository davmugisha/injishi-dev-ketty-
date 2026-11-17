/**
 * The picture of a dish or a drink. The photo saved with the item wins: one the owner uploaded (served by the API
 * through `/api/pos/menu-photo/:itemId`), or one they chose from the bundled library in `/public/menu` (credits in
 * `/public/menu/CREDITS.md`). An item with no saved photo gets the library photo its name suggests first and its
 * section second. An item neither says anything about (a test entry, a typo) gets a calm initials tile, never a
 * drawing. Decoration only: hidden from screen readers, since the name is always written beside it.
 */
const BY_NAME: [RegExp, string][] = [
  [/mandazi/i, "mandazi"],
  [/mojito/i, "mojito"],
  [/pi[ñn]a colada/i, "pina_colada"],
  [/long island/i, "long_island"],
  [/tequila sunrise/i, "tequila_sunrise"],
  [/caipirinha/i, "caipirinha"],
  [/cocktail|daiquiri|margarita\b/i, "mojito"],
  [/beer|lager|primus|m[üu]tzig|skol|virunga|heineken|guinness/i, "beer"],
  [/ros[ée]/i, "rose_wine"],
  [/sparkling|champagne|prosecco/i, "sparkling"],
  [/white wine/i, "white_wine"],
  [/wine/i, "red_wine"],
  [/whisk/i, "whisky"],
  [/vodka/i, "vodka"],
  [/\bgin\b/i, "gin"],
  [/\brum\b/i, "rum"],
  [/cognac|brandy/i, "cognac"],
  [/amarula|baileys|liqueur/i, "amarula"],
  [/cappuccino|latte|macchiato/i, "cappuccino"],
  [/espresso/i, "espresso"],
  [/coffee|americano/i, "americano"],
  [/african tea|chai|spiced tea/i, "african_tea"],
  [/\btea\b/i, "tea"],
  [/passion/i, "passion_juice"],
  [/pineapple/i, "pineapple_juice"],
  [/tree tomato|tamarillo/i, "tomato_juice"],
  [/juice|smoothie/i, "fresh_juice"],
  [/soda|soft drink|coke|cola|fanta|sprite|tonic/i, "soda"],
  [/water/i, "water"],
  [/chicken burger/i, "chicken_burger"],
  [/bean burger|veggie burger/i, "bean_burger"],
  [/burger/i, "beef_burger"],
  [/pizza|margherita/i, "pizza"],
  [/sandwich|toast/i, "sandwich"],
  [/fruit salad|fruit plate|fruit/i, "fruit_plate"],
  [/salad/i, "salad"],
  [/tilapia|whole fish/i, "whole_fish"],
  [/sambaza|sardine/i, "sambaza"],
  [/fish/i, "fish_fillet"],
  [/wings/i, "wings"],
  [/samosa/i, "samosa"],
  [/chicken stew|chicken curry/i, "chicken_stew"],
  [/brochette|kebab|skewer|mishkaki/i, "brochette"],
  [/grilled chicken|chicken quarter|roast chicken|chicken/i, "grilled_chicken"],
  [/stew/i, "goat_stew"],
  [/isombe|cassava leaves/i, "isombe"],
  [/ugali|posho/i, "ugali"],
  [/beans/i, "beans_rice"],
  [/curry/i, "curry"],
  [/fillet|steak|pepper sauce/i, "beef_fillet"],
  [/chips masala|masala chips/i, "chips_masala"],
  [/chips|fries/i, "chips"],
  [/plantain|matoke|banana(?! pancake)/i, "plantain"],
  [/umuceri|\brice\b/i, "rice"],
  [/pancake/i, "pancakes"],
  [/ice cream|gelato/i, "ice_cream"],
  [/omelette|eggs?\b/i, "omelette"],
  [/full breakfast|english breakfast/i, "full_breakfast"],
  [/continental|breakfast|croissant/i, "continental"],
  [/birthday|party|set-up/i, "birthday"],
  [/cake/i, "cake"],
  [/corkage/i, "corkage"],
  [/delivery/i, "delivery"],
  [/hire|private room|room booking/i, "room_hire"],
  [/meat|beef|goat|nyama/i, "brochette"],
];

/** When the name says nothing, the section usually does. */
const BY_SECTION: [RegExp, string][] = [
  [/beer/i, "beer"],
  [/wine/i, "red_wine"],
  [/cocktail/i, "mojito"],
  [/spirit/i, "whisky"],
  [/coffee|tea/i, "americano"],
  [/juice|soft/i, "fresh_juice"],
  [/water/i, "water"],
  [/dessert/i, "ice_cream"],
  [/breakfast/i, "continental"],
  [/burger/i, "beef_burger"],
  [/pizza/i, "pizza"],
  [/side/i, "chips"],
  [/bar bite|snack|starter/i, "wings"],
  [/grill|main|lunch|dinner|room|in-room/i, "grilled_chicken"],
  [/drink/i, "soda"],
];

export type LibraryGroup = "Drinks" | "Food" | "Services";
export interface LibraryPhoto {
  /** The file's name without `.jpg`: what the API keeps as the item's chosen photo. */
  id: string;
  label: string;
  group: LibraryGroup;
}

const lib = (group: LibraryGroup, rows: [string, string][]): LibraryPhoto[] =>
  rows.map(([id, label]) => ({ id, label, group }));

/** Every photograph in `/public/menu`, as the photo library offers them. */
export const MENU_LIBRARY: readonly LibraryPhoto[] = [
  ...lib("Drinks", [
    ["beer", "Beer"],
    ["red_wine", "Red wine"],
    ["white_wine", "White wine"],
    ["rose_wine", "Rosé wine"],
    ["sparkling", "Sparkling wine"],
    ["whisky", "Whisky"],
    ["vodka", "Vodka"],
    ["gin", "Gin"],
    ["rum", "Rum"],
    ["cognac", "Cognac"],
    ["amarula", "Cream liqueur"],
    ["mojito", "Mojito"],
    ["pina_colada", "Piña colada"],
    ["long_island", "Long Island iced tea"],
    ["tequila_sunrise", "Tequila sunrise"],
    ["caipirinha", "Caipirinha"],
    ["cappuccino", "Cappuccino"],
    ["espresso", "Espresso"],
    ["americano", "Coffee"],
    ["african_tea", "African tea"],
    ["tea", "Tea"],
    ["passion_juice", "Passion fruit juice"],
    ["pineapple_juice", "Pineapple juice"],
    ["tomato_juice", "Tree tomato juice"],
    ["fresh_juice", "Fresh juice"],
    ["soda", "Soda"],
    ["water", "Water"],
  ]),
  ...lib("Food", [
    ["grilled_chicken", "Grilled chicken"],
    ["chicken_stew", "Chicken stew"],
    ["brochette", "Brochettes"],
    ["goat_stew", "Goat stew"],
    ["beef_fillet", "Beef fillet"],
    ["whole_fish", "Whole fish"],
    ["fish_fillet", "Fish fillet"],
    ["sambaza", "Sambaza"],
    ["wings", "Chicken wings"],
    ["samosa", "Samosas"],
    ["beef_burger", "Beef burger"],
    ["chicken_burger", "Chicken burger"],
    ["bean_burger", "Bean burger"],
    ["pizza", "Pizza"],
    ["sandwich", "Sandwich"],
    ["salad", "Salad"],
    ["curry", "Curry"],
    ["beans_rice", "Beans and rice"],
    ["rice", "Rice"],
    ["isombe", "Isombe"],
    ["ugali", "Ugali"],
    ["plantain", "Plantain"],
    ["chips", "Chips"],
    ["chips_masala", "Chips masala"],
    ["omelette", "Omelette"],
    ["full_breakfast", "Full breakfast"],
    ["continental", "Continental breakfast"],
    ["pancakes", "Pancakes"],
    ["mandazi", "Mandazi"],
    ["fruit_plate", "Fruit plate"],
    ["ice_cream", "Ice cream"],
    ["cake", "Cake"],
  ]),
  ...lib("Services", [
    ["birthday", "Birthday set-up"],
    ["corkage", "Corkage"],
    ["delivery", "Delivery"],
    ["room_hire", "Room hire"],
  ]),
];

const LIBRARY_BY_ID = new Map(MENU_LIBRARY.map((p) => [p.id, p]));

/** A library photo by its id, or undefined for an id the library does not hold. */
export function libraryPhoto(id: string | null | undefined): LibraryPhoto | undefined {
  return id ? LIBRARY_BY_ID.get(id) : undefined;
}

/** The library photo the name (or else the section) suggests, or null when neither says what the item is. */
export function suggestedPhoto(name: string, section = ""): string | null {
  return BY_NAME.find(([re]) => re.test(name))?.[1] ?? BY_SECTION.find(([re]) => re.test(section))?.[1] ?? null;
}

export const photoSrc = (id: string) => `/menu/${id}.jpg`;

/**
 * An uploaded photo, as the API names it: `upload:<itemId>.<version>` once saved with an item, `upload:<storedId>`
 * between the upload and Save. Either way it is the owner's own picture, not a library one.
 */
export const isUpload = (photo: string | null | undefined): photo is string => !!photo?.startsWith("upload:");

const SAVED_UPLOAD = /^upload:([0-9a-f-]{36})\.([0-9a-f]{1,16})$/;

/** Where a saved upload is served (through the app, with the session); null for anything else. */
export function uploadSrc(photo: string | null | undefined): string | null {
  const m = photo ? SAVED_UPLOAD.exec(photo) : null;
  return m ? `/api/pos/menu-photo/${m[1]}?v=${m[2]}` : null;
}

/**
 * The photo a recipe is saved with: the owner's upload, else the library photo they chose, else the one its name
 * suggests, else none.
 */
export function finalPhoto(chosen: string | null, name: string, section: string): string | null {
  if (isUpload(chosen)) return chosen;
  return libraryPhoto(chosen)?.id ?? suggestedPhoto(name, section);
}

/**
 * The photograph for an item (a path under /public): the photo chosen and saved for it, else the one its name or
 * section suggests, else null.
 */
export function dishPhoto(name: string, section = "", chosen?: string | null): string | null {
  const uploaded = uploadSrc(chosen);
  if (uploaded) return uploaded;
  const id = libraryPhoto(chosen)?.id ?? suggestedPhoto(name, section);
  return id ? photoSrc(id) : null;
}

/** Kept for callers that only need to know whether an item has a picture. */
export function dishSymbol(name: string, section = ""): string | null {
  return dishPhoto(name, section);
}

const SIZE = {
  /** The till's product card: the full width of the card. */
  tile: "aspect-[4/3] w-full rounded-[14px]",
  /** A square beside a line on the bill, in a list or a table. */
  thumb: "size-11 rounded-xl",
  /** A small square in a dense table row. */
  row: "size-9 rounded-[10px]",
} as const;

export function DishArt({
  name,
  section = "",
  photo,
  size = "tile",
}: {
  name: string;
  section?: string;
  /** The photo chosen and saved for the item; without one the name suggests it. */
  photo?: string | null;
  size?: keyof typeof SIZE;
}) {
  const src = dishPhoto(name, section, photo);
  const initials = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      data-ui="dish-photo"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[var(--pos-band)] ${SIZE[size]}`}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: small bundled JPEGs; the till must work without the image optimiser
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`size-full object-cover ${size === "tile" ? "transition duration-300 group-enabled:group-hover:scale-[1.04]" : ""}`}
        />
      ) : (
        <span
          className={`font-semibold tracking-tight text-[var(--pos-ink-3)] ${size === "tile" ? "text-[26px]" : "text-[13px]"}`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
